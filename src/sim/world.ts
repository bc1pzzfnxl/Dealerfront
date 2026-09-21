/**
 * World — DealerFront simulation (god view).
 * Quarters (ownership + control + building), factions (Members + economy),
 * brawls, AI. Pure, deterministic, fixed step 10 Hz.
 * See docs/territory.md, docs/economy.md, docs/combat.md.
 */

import {
	BUILDINGS,
	BUILDING_EFFECTS,
	BUILDING_INDEX,
	BUILDING_TYPES,
	BUILD_TICKS,
	BUILT_ZONES,
	CONVERSION_TIME,
	canBuildInZone,
	chooseBuildType,
	chainIncomplete,
	CONVERSION_COST,
	missingEconomyStep,
	type BuildingType,
	NO_BUILDING,
	ZONE_BUILDINGS,
	BUILDING_UPKEEP,
	UNPAID_UPKEEP_FACTOR,
	buildingCostGrowth,
	zoneBuildBonus,
	zoneTimeFactor,
} from "./buildings";
import { SIM_HZ, START_HOUR, TICKS_PER_HOUR } from "./constants";
import { PARIS_CENTROIDS, PARIS_MAP } from "./maps/paris";
import { createRng, type Rng } from "./rng";
import { createFactions, FACTION_COUNT, type Faction } from "./factions";
import { STRIKE, TECH, TECH_BRANCHES, type TechBranch, techCost } from "./tech";
import { CONTACT_NAMES, POLICE, policeTier, type PoliceState, type PoliceTier } from "./police";
import {
	DIPLOMACY,
	EMBARGO,
	type Embargo,
	type Pact,
	type PactOffer,
} from "./diplomacy";
import { createTerritory, NEUTRAL, type Territory } from "./territory";
import type { CityGrid, ZoneType } from "./types";

const EMPTY_NEIGHBORS: readonly number[] = [];

const NEUTRAL_GARRISON = 60;
const CAPTURE_CONTROL = 30;
const START_MEMBERS = 3000;
const COMMIT_RATIO = 0.2;
/** Damage cap per tick: prevents instant captures (sieges required). */
const MAX_DAMAGE_PER_TICK = 5;
const ATTACK_LOSS = 8;
/** Losses inflicted on the defender per siege tick (mutual attrition). */
const DEFENDER_LOSS = 4;

/**
 * War chest: buying **armament** (Clean cash) grants a **temporary** attack
 * bonus. Money is king of war: you invest before an offensive. Increasing
 * cost, stackable level, limited window.
 */
const ARMAMENT = {
	costClean: 3000,
	costGrowth: 1.5,
	/** Cap on the **bonus** (the cost keeps growing: endless sink). */
	maxLevel: 6,
	bonusPerLevel: 0.2,
	durationTicks: 400,
} as const;

/**
 * Quarter buyout: convert **Clean cash** into **territory** instead of
 * attacking it. Only on an **adjacent neutral** quarter. Cost grows with the
 * empire → permanent trade-off between tech and expansion.
 */
/**
 * Mercenaries: convert **Dirty cash** into immediate **Members** (war
 * manpower). Increasing cost; capped by the Member cap.
 */
const MERC = {
	costSale: 4000,
	members: 400,
	costGrowth: 1.4,
} as const;

/**
 * Contract: pay a gang to **attack a rival** (Clean cash). The gang focuses its
 * offensive on the target for the duration of the contract.
 */
const CONTRACT = {
	costClean: 6000,
	costGrowth: 1.5,
	durationTicks: 600,
} as const;

const BUY = {
	baseCostClean: 4000,
	perOwned: 0.15,
	cooldownTicks: 100,
	control: 25,
} as const;
const CONTROL_REGEN = 1.2;
/** Max simultaneous assaults per faction: no "click everywhere". */
/** Troop movement before the siege (ticks). */
export const TRAVEL_TICKS = 12;
/** Simultaneous build crews per faction. */
const BUILD_CREWS = 2;
/** Max length of the order queue per faction. */
/** Share of a building's value taken as loot on capture. */
const LOOT_RATIO = 0.2;
/** Bust: heist to steal loot without destroying (gated by Armament). */
const BUST = { costSale: 2000, costMembers: 600, requiredArmament: 1, cooldownTicks: 250 } as const;
/**
 * Share of its army an AI is willing to leave on the field at once. Each front
 * commits `attackRatio` (20%), so 0.5 capped it at ~3 fronts — far more timid
 * than a player, who pushes every border at once. The reserve still matters
 * (committed troops are not defending), it just no longer strangles the war.
 */
const AI_MAX_COMMIT = 0.7;
/** Fronts an AI pushes per decision (mirrors the balancing bot's policy). */
const AI_FRONTS = 2;
const AI_INTERVAL = 20;
const MIN_COMMIT = 400;
/** Raid: weakens an adjacent quarter without capturing it. */
const RAID = { costSale: 2500, costMembers: 800, control: 35, cooldownTicks: 300 } as const;
/**
 * Logistics: a Storefront must be connected to a Lab (and a Front to a
 * Storefront) by a path of owned quarters. Off-line, capacity drops to the floor.
 */
const SUPPLY_FLOOR = 0.35;
/**
 * Margin kept on Product **bought from an external supplier** when the in-house
 * stock is insufficient. Lets a Storefront run without a Lab (reduced margin) —
 * a dealer can always source supply, otherwise the build order could block the
 * player.
 */
const EXTERNAL_SUPPLY_MARGIN = 0.6;
/** Convoy routes displayed per faction (visible logistics). */
const MAX_CONVOY_ROUTES = 4;
/**
 * Ticks a convoy takes to run its leg. Income is **not** a faucet: Product and
 * Dirty cash only land when a convoy physically arrives (OpenFront idea).
 */
const CONVOY_TRANSIT_TICKS = 60;
/** Interception: diverts an enemy convoy's cargo and cuts the line. */
const INTERCEPT = {
	costMembers: 500,
	requiredArmament: 1,
	cooldownTicks: 300,
} as const;
/**
 * Local police: a quarter's heat rises with local crime and falls back;
 * precincts (police zones) patrol and make it fall faster. Raids target the
 * hottest quarters.
 */
const HEAT = {
	capture: 30,
	strike: 20,
	operation: 15,
	storefront: 0.15,
	front: 0.08,
	decay: 0.08,
	/** Decay half-life: decay doubles at this heat level. */
	decayHalf: 30,
	policeSuppress: 2,
	max: 100,
} as const;

/** Visible convoy: a faction's supply route, carrying real cargo. */
export interface ConvoyRoute {
	factionId: number;
	from: number;
	to: number;
	kind: "product" | "cash";
	/** Cargo currently on the road — what an interception takes. */
	cargo: number;
	/** Leg completion, 0 → 1 (drives the convoy's map position). */
	progress: number;
}

/** Stable convoy identity across topology rebuilds (keeps cargo on the road). */
function convoyKey(route: Pick<ConvoyRoute, "factionId" | "from" | "to" | "kind">): string {
	return `${route.factionId}:${route.from}:${route.to}:${route.kind}`;
}

/** Choice offered by an event (traceable effect applied immediately). */
export interface EventChoice {
	/** Short label shown on the button. */
	label: string;
	/** Numeric description of the effect (tooltip). */
	detail: string;
}

/** Pending choice event (only one at a time, deterministic). */
export interface PendingEvent {
	id: string;
	title: string;
	body: string;
	/** Suggested color (info / gain / loss). */
	kind: "info" | "gain" | "loss";
	choices: [EventChoice, EventChoice];
}

/** Gang name based on the real geographic position (center of Paris). */
function spawnDirectionName(center: readonly [number, number]): string {
	const dLng = center[0] - 2.3522;
	const dLat = center[1] - 48.8566;
	const ns = dLat > 0.008 ? "North" : dLat < -0.008 ? "South" : "";
	const ew = dLng > 0.008 ? "East" : dLng < -0.008 ? "West" : "";
	const dir = [ns, ew].filter(Boolean).join("-");
	return dir ? `${dir}side Gang` : "Downtown Gang";
}

const ZONE_DEFENSE: Record<ZoneType, number> = {
	residential: 1.0,
	commercial: 1.2,
	nightlife: 1.1,
	industrial: 0.8,
	park: 1.4,
	police: 2.0,
	laundry: 1.0,
	vacant: 0.5,
};

/** Battle royale: no time limit — you play until elimination. */
const BANKRUPT_TICKS = 300; // 30 s with no cash → defeat
/** Encirclement: minimum cluster size to capitulate (avoids stingy loss). */
const ENCIRCLE_MIN_SIZE = 8;
/** Encirclement: the cluster must weigh at least this share of the faction to capitulate. */
const ENCIRCLE_SHARE = 0.35;

export interface WorldOptions {
	/** Map played (default: Paris). */
	map?: CityGrid;
	/** Number of factions (default: 6). */
	factionCount?: number;
	/**
	 * Factions **controlled by an agent** (no AI on them). Solo: `[0]` (the
	 * player). Arena: all factions are controlled.
	 */
	controlled?: readonly number[];
}

/**
 * Serializable world snapshot — the **arena contract** (server ↔ agents ↔
 * spectator). `applySnapshot` reloads everything and recomputes derived caches.
 */
export interface WorldSnapshot {
	tick: number;
	playerId: number;
	outcome: Outcome;
	endReason: string;
	territory: {
		owner: number[];
		control: number[];
		building: number[];
		construction: number[];
		pending: number[];
		builtAt: number[];
		capturedAt: number[];
	};
	factions: Faction[];
	/** Cargo on the road — must survive a snapshot round-trip. */
	convoys: ConvoyRoute[];
	strikes: Strike[];
	attacks: Attack[];
	pacts: Pact[];
	offers: PactOffer[];
	embargoes: Embargo[];
	police: PoliceState;
	heat: number[];
	relations: number[][];
	proposalCooldown: number[][];
	contactIndex: number;
	log: string[];
	pending: PendingEvent | null;
	/** PRNG state (determinism after restoration). */
	rngState: number;
	/** AI cadence and bankruptcy counter (determinism). */
	aiCooldowns: number[];
	brokeTicks: number;
	outcomeRecorded: boolean;
}

export interface FactionSummary {
	control: number;
	quarters: number;
	cleanCash: number;
	captures: number;
	eliminations: number;
	raidsSuffered: number;
	seizures: number;
	eliminated: boolean;
	score: number;
	rank: number;
}

/** Serializable briefing (objective + progress), reusable outside the UI. */
export interface Briefing {
	map: string;
	alive: number;
	control: number;
	clean: number;
	rank: number;
	done: boolean;
}

function emptyCounts(): Record<BuildingType, number> {
	return {
		housing: 0,
		lab: 0,
		storefront: 0,
		front: 0,
		safehouse: 0,
		depot: 0,
		workshop: 0,
		counter: 0,
	};
}

/** Pending build order (processed as soon as a crew frees up). */
export interface BuildOrder {
	factionId: number;
	module: number;
	type: BuildingType;
	/** Queue tick (purges orders that stay unaffordable). */
	queuedAt: number;
}

export interface Attack {
	factionId: number;
	/** Origin quarter (for unit movement). */
	source: number;
	target: number;
	troops: number;
	/** Arrival tick at the target (before: troops en route). */
	arrivesAt: number;
	/** Target control at the start of the assault (for the conquest gauge). */
	startControl: number;
	/** Troops committed at launch (for the control established after capture). */
	initialTroops: number;
}

/**
 * Heavy strike in flight: paid for at launch, lands at `landsAt`. Visible to
 * everyone in between, which is what makes it a threat rather than a surprise.
 */
export interface Strike {
	factionId: number;
	target: number;
	landsAt: number;
}

export type Outcome = null | "victory" | "defeat";

/** Floating text (juice) anchored to a quarter, ephemeral. */
export interface Floater {
	module: number;
	text: string;
	kind: "gain" | "loss" | "info";
	until: number;
}

/** **Player** events (audio/UX feedback), drained by the UI. */
export type GameEvent =
	| "attack"
	| "capture"
	| "lost"
	| "raid"
	| "strike"
	| "tech"
	| "pact"
	| "betray"
	| "embargo"
	| "corrupt"
	| "build"
	| "bust"
	| "intercept"
	| "event"
	| "alert"
	| "victory"
	| "defeat";

export class World {
	readonly city: CityGrid;
	readonly territory: Territory;
	readonly factions: Faction[];
	readonly attacks: Attack[] = [];
	/** Heavy strikes in flight (telegraphed). */
	readonly strikes: Strike[] = [];
	readonly log: string[] = [];
	readonly police: PoliceState = {
		pressure: 0,
		target: -1,
		cooldown: 0,
		window: 0,
		crime: 0,
		lastRaidTick: -1,
		raids: 0,
		liquidations: 0,
	};
	readonly pacts: Pact[] = [];
	readonly offers: PactOffer[] = [];
	readonly embargoes: Embargo[] = [];
	/** Player events waiting to be consumed by the UI. */
	private readonly events: GameEvent[] = [];
	private readonly floaters: Floater[] = [];
	/** Pending build orders, per faction. */
	private outcomeRecorded = false;
	/** Index of the current corrupt contact (changes if burned). */
	private contactIndex: number;
	tick = 0;
	outcome: Outcome = null;
	endReason = "";

	private readonly rng: Rng;
	private brokeTicks = 0;
	private readonly aiCooldowns: number[] = [];
	/** Symmetric pairwise relations (0–100). */
	private relations: number[][] = [];
	/** Pact proposal cooldown per pair (tick). */
	private proposalCooldown: number[][] = [];
	/** Quarters attacked this tick (reused, avoids a per-tick allocation). */
	private readonly underAttack = new Set<number>();
	/** Building count per faction (recomputed once per tick). */
	private counts: Array<Record<BuildingType, number>> = [];
	/** Quarters owned per faction (recomputed once per tick). */
	private owned: number[] = [];
	/** Local sums weighted by quarter profile (recomputed per tick). */
	private recruitDemand: number[] = [];
	private housingDemand: number[] = [];
	private retailDemand: number[] = [];
	private retailWeighted: number[] = [];
	private launderWealth: number[] = [];
	/** Labs weighted by zone bonus (recomputed per tick). */
	private labWeight: number[] = [];
	/** Share of capacity connected to a source (lab/retail) — logistics. */
	private retailSupply: number[] = [];
	private launderSupply: number[] = [];
	/** Current convoy routes (rendering). */
	private convoys: ConvoyRoute[] = [];
	/** Pending choice event (only one at a time). */
	private pending: PendingEvent | null = null;
	/** Ownership+building signature: avoids a useless logistics BFS. */
	private supplySignature = -1;
	/** Police heat per quarter (0–100): rises with crime, falls back. */
	readonly heat: Float32Array;
	/** Quarter under surveillance (police zone or neighbor of one). */
	private readonly policeZone: Uint8Array;

	constructor(seed: number, options?: WorldOptions) {
		this.city = options?.map ?? PARIS_MAP;
		this.territory = createTerritory(this.city.modules.length);
		this.heat = new Float32Array(this.city.modules.length);
		this.policeZone = this.buildPoliceZone();
		this.factions = createFactions(options?.factionCount ?? FACTION_COUNT, START_MEMBERS);
		this.controlled = new Set(options?.controlled ?? [0]);
		this.rng = createRng((seed ^ 0x9e3779b9) >>> 0);
		this.contactIndex = seed % CONTACT_NAMES.length;

		this.territory.control.fill(NEUTRAL_GARRISON);
		const spawns = this.pickSpawns(this.factions.length);
		// Spawn is always buildable: force a "built" zone on each spawn.
		const modules = this.city.modules as ZoneType[];
		spawns.forEach((module, index) => {
			if (!BUILT_ZONES.includes(modules[module]!)) {
				modules[module] = BUILT_ZONES[index % BUILT_ZONES.length]!;
			}
		});
		// Name gangs by their real position (avoids "Northside Gang" in the south).
		const usedNames = new Set<string>([this.factions[0]!.name]);
		for (let i = 1; i < this.factions.length; i += 1) {
			const center = PARIS_CENTROIDS[spawns[i]!];
			if (!center) continue;
			const base = spawnDirectionName(center);
			let name = base;
			let n = 2;
			while (usedNames.has(name)) {
				name = `${base} ${n}`;
				n += 1;
			}
			usedNames.add(name);
			this.factions[i]!.name = name;
		}
		this.factions.forEach((faction, index) => {
			const module = spawns[index]!;
			this.territory.owner[module] = faction.id;
			this.territory.control[module] = 100;
			this.aiCooldowns.push(20 + (faction.id % 3) * 15);
		});
		this.relations = this.factions.map(() =>
			this.factions.map(() => DIPLOMACY.initialRelation),
		);
		this.proposalCooldown = this.factions.map(() => this.factions.map(() => 0));
		this.counts = this.factions.map(() => emptyCounts());
		this.owned = this.factions.map(() => 0);
		this.recruitDemand = this.factions.map(() => 0);
		this.housingDemand = this.factions.map(() => 0);
		this.retailDemand = this.factions.map(() => 0);
		this.retailWeighted = this.factions.map(() => 0);
		this.launderWealth = this.factions.map(() => 0);
		this.labWeight = this.factions.map(() => 0);
		this.retailSupply = this.factions.map(() => 1);
		this.launderSupply = this.factions.map(() => 1);
		this.recount();
	}

	/** "Active" faction for `player*` methods (default: 0). */
	private playerId = 0;
	/** Factions driven by an agent (never by the AI). */
	readonly controlled: Set<number>;

	/** Switches the active faction (arena: each agent acts on its turn). */
	setPlayer(factionId: number): void {
		if (factionId >= 0 && factionId < this.factions.length) this.playerId = factionId;
	}

	activePlayerId(): number {
		return this.playerId;
	}

	get player(): Faction {
		return this.factions[this.playerId]!;
	}

	/** Serializes all state (arena contract). */
	snapshot(): WorldSnapshot {
		return {
			tick: this.tick,
			playerId: this.playerId,
			outcome: this.outcome,
			endReason: this.endReason,
			territory: {
				owner: Array.from(this.territory.owner),
				control: Array.from(this.territory.control),
				building: Array.from(this.territory.building),
				construction: Array.from(this.territory.construction),
				pending: Array.from(this.territory.pending),
				builtAt: Array.from(this.territory.builtAt),
				capturedAt: Array.from(this.territory.capturedAt),
				},
			factions: this.factions.map((faction) => ({
				...faction,
				tech: { ...faction.tech },
			})),
			convoys: this.convoys.map((route) => ({ ...route })),
			strikes: this.strikes.map((strike) => ({ ...strike })),
			attacks: this.attacks.map((attack) => ({ ...attack })),
			pacts: this.pacts.map((pact) => ({ ...pact })),
			offers: this.offers.map((offer) => ({ ...offer })),
			embargoes: this.embargoes.map((embargo) => ({ ...embargo })),
			police: { ...this.police },
			heat: Array.from(this.heat),
			relations: this.relations.map((row) => [...row]),
			proposalCooldown: this.proposalCooldown.map((row) => [...row]),
			contactIndex: this.contactIndex,
			log: [...this.log],
			pending: this.pending ? { ...this.pending } : null,
			rngState: this.rng.state(),
			aiCooldowns: [...this.aiCooldowns],
			brokeTicks: this.brokeTicks,
			outcomeRecorded: this.outcomeRecorded,
		};
	}

	/** Reloads a snapshot and recomputes derived caches. */
	applySnapshot(snap: WorldSnapshot): void {
		this.tick = snap.tick;
		this.playerId = snap.playerId;
		this.outcome = snap.outcome;
		this.endReason = snap.endReason;
		this.territory.owner.set(snap.territory.owner);
		this.territory.control.set(snap.territory.control);
		this.territory.building.set(snap.territory.building);
		this.territory.construction.set(snap.territory.construction);
		this.territory.pending.set(snap.territory.pending);
		this.territory.builtAt.set(snap.territory.builtAt);
		this.territory.capturedAt.set(snap.territory.capturedAt);
		for (let i = 0; i < this.factions.length && i < snap.factions.length; i += 1) {
			const source = snap.factions[i]!;
			Object.assign(this.factions[i]!, source, { tech: { ...source.tech } });
		}
		this.strikes.length = 0;
		this.strikes.push(...(snap.strikes ?? []).map((strike) => ({ ...strike })));
		this.attacks.length = 0;
		this.attacks.push(...snap.attacks.map((attack) => ({ ...attack })));
		this.pacts.length = 0;
		this.pacts.push(...snap.pacts.map((pact) => ({ ...pact })));
		this.offers.length = 0;
		this.offers.push(...snap.offers.map((offer) => ({ ...offer })));
		this.embargoes.length = 0;
		this.embargoes.push(...snap.embargoes.map((embargo) => ({ ...embargo })));
		Object.assign(this.police, snap.police);
		this.heat.set(snap.heat);
		this.relations = snap.relations.map((row) => [...row]);
		this.proposalCooldown = snap.proposalCooldown.map((row) => [...row]);
		this.contactIndex = snap.contactIndex;
		this.log.length = 0;
		this.log.push(...snap.log);
		this.pending = snap.pending ? { ...snap.pending } : null;
		this.rng.setState(snap.rngState);
		this.aiCooldowns.length = 0;
		this.aiCooldowns.push(...snap.aiCooldowns);
		this.brokeTicks = snap.brokeTicks;
		this.outcomeRecorded = snap.outcomeRecorded;
		// Restore the cargo on the road *before* `recount()` rebuilds the routes,
		// so `updateSupply` can carry it over. Persisted snapshots may predate it.
		this.convoys.length = 0;
		this.convoys.push(...(snap.convoys ?? []).map((route) => ({ ...route })));
		this.supplySignature = -1;
		this.recount();
		this.updateSupply();
	}

	/** Zones under police surveillance (precinct or quarter adjacent to one). */
	private buildPoliceZone(): Uint8Array {
		const count = this.city.zones.length;
		const mask = new Uint8Array(count);
		for (let i = 0; i < count; i += 1) {
			if (this.city.zones[i] === "police") mask[i] = 1;
		}
		for (let i = 0; i < count; i += 1) {
			if (mask[i]) continue;
			for (const neighbor of this.neighbors(i)) {
				if (this.city.zones[neighbor] === "police") {
					mask[i] = 1;
					break;
				}
			}
		}
		return mask;
	}

	/** Adds local police heat (capped). */
	private addHeat(module: number, amount: number): void {
		this.heat[module] = Math.min(HEAT.max, (this.heat[module] ?? 0) + amount);
	}

	heatAt(module: number): number {
		return this.heat[module] ?? 0;
	}

	get contactName(): string {
		return CONTACT_NAMES[this.contactIndex]!;
	}

	ownerAt(module: number): number {
		return this.territory.owner[module]!;
	}

	controlAt(module: number): number {
		return this.territory.control[module]!;
	}

	buildingAt(module: number): BuildingType | null {
		const index = this.territory.building[module]!;
		if (index === NO_BUILDING) return null;
		return BUILDING_TYPES[index] ?? null;
	}

	modulesOwned(factionId: number): number {
		return this.owned[factionId] ?? 0;
	}

	controlRatio(factionId: number): number {
		return (this.owned[factionId] ?? 0) / this.city.modules.length;
	}

	buildingCount(factionId: number, type: BuildingType): number {
		return this.counts[factionId]?.[type] ?? 0;
	}

	buildingCounts(factionId: number): Record<BuildingType, number> {
		return this.counts[factionId] ?? emptyCounts();
	}

	private maxMembers(factionId: number): number {
		const owned = this.modulesOwned(factionId);
		const housing = this.buildingCount(factionId, "housing");
		const depots = this.buildingCount(factionId, "depot");
		return (
			2000 +
			owned * 1500 +
			housing * 2000 +
			depots * BUILDING_EFFECTS.maxMembersPerDepot
		);
	}

	productionPerTick(factionId: number): number {
		const faction = this.factions[factionId]!;
		const ownedDemand = this.recruitDemand[factionId] ?? 0;
		const housingDemand =
			this.housingDemand[factionId] ?? 0;
		const max = this.maxMembers(factionId);
		if (faction.members >= max) return 0;
		const logistics = 1 + TECH.logisticsProduction * faction.tech.logistics;
		return (
			(BUILDING_EFFECTS.baseMembersPerQuarter * ownedDemand +
				BUILDING_EFFECTS.membersPerHousing * housingDemand) *
			(1 - faction.members / max) *
			logistics
		);
	}

	/** Local demand of a quarter (clientele) — see docs/economy.md §local market. */
	demandAt(module: number): number {
		return this.city.demand[module] ?? 1;
	}

	/** Local wealth of a quarter (price, laundering). */
	wealthAt(module: number): number {
		return this.city.wealth[module] ?? 1;
	}

	/** Yield bonus of a building in the quarter's zone (1 = neutral). */
	zoneBonusAt(module: number, type: BuildingType): number {
		const zone = this.city.modules[module];
		return zone ? zoneBuildBonus(zone, type) : 1;
	}

	/** In-game hour (0–24, fractional) — day/night cycle. */
	hourOfDay(): number {
		return (START_HOUR + this.tick / TICKS_PER_HOUR) % 24;
	}

	/** Rush-hour factor for a building in a quarter (1 = neutral). */
	rushFactorAt(module: number, type: BuildingType): number {
		const zone = this.city.modules[module];
		return zone ? zoneTimeFactor(zone, type, this.hourOfDay()) : 1;
	}

	attackBonus(factionId: number): number {
		const faction = this.factions[factionId]!;
		const tech = TECH.attackPerLevel * faction.tech.armament;
		const war = faction.armamentUntil > this.tick ? ARMAMENT.bonusPerLevel * faction.armamentLevel : 0;
		return tech + war;
	}

	/** Cost of the next armament purchase (Clean cash, increasing). */
	armamentCost(): number {
		return Math.round(ARMAMENT.costClean * ARMAMENT.costGrowth ** this.player.armamentUses);
	}

	playerCanBuyArmament(): boolean {
		if (this.outcome !== null) return false;
		return this.player.cleanCash >= this.armamentCost();
	}

	/** Buys an armament tier (temporary attack bonus). */
	playerBuyArmament(): boolean {
		if (!this.playerCanBuyArmament()) return false;
		const player = this.player;
		player.cleanCash -= this.armamentCost();
		player.armamentLevel = Math.min(ARMAMENT.maxLevel, player.armamentLevel + 1);
		player.armamentUntil = this.tick + ARMAMENT.durationTicks;
		player.armamentUses += 1;
		const armAnchor = this.playerAnchor();
		if (armAnchor >= 0) {
			this.float(armAnchor, `⚔ armament +${Math.round(ARMAMENT.bonusPerLevel * 100)} %`, "gain");
		}
		this.pushLog(
			`Armament +${Math.round(ARMAMENT.bonusPerLevel * 100)} % (${ARMAMENT.durationTicks / 10} s)`,
		);
		this.events.push("tech");
		return true;
	}

	/** Are the player's Watchers paid? */
	playerGuardsPaid(): boolean {
		return this.player.guardsPaid;
	}

	/** Cost of the next mercenary hire (Dirty cash, increasing). */
	mercCost(): number {
		return Math.round(MERC.costSale * MERC.costGrowth ** this.player.mercUses);
	}

	mercMembers(): number {
		return MERC.members;
	}

	playerCanHireMercenaries(): boolean {
		if (this.outcome !== null) return false;
		return this.player.dirtyCash >= this.mercCost();
	}

	/** Hires mercenaries: Dirty cash → immediate Members. */
	playerHireMercenaries(): boolean {
		if (!this.playerCanHireMercenaries()) return false;
		const player = this.player;
		const cost = this.mercCost();
		player.dirtyCash -= cost;
		const before = player.members;
		player.members = Math.min(this.maxMembers(player.id), player.members + MERC.members);
		player.mercUses += 1;
		const gained = Math.round(player.members - before);
		const anchor = this.playerAnchor();
		if (anchor >= 0) this.float(anchor, `+${gained} mercenaries`, "gain");
		this.pushLog(`Mercenaries: +${gained} Members (−${cost.toLocaleString("en-US")} dirty)`);
		this.events.push("capture");
		return true;
	}

	/** Cost of the next contract against a gang (Clean cash, increasing). */
	contractCost(): number {
		return Math.round(CONTRACT.costClean * CONTRACT.costGrowth ** this.player.contractUses);
	}

	playerCanFundContract(targetId: number): boolean {
		if (this.outcome !== null) return false;
		if (targetId === this.player.id) return false;
		if (this.factions[targetId]?.eliminated) return false;
		if (this.hasPact(this.player.id, targetId)) return false;
		return this.player.cleanCash >= this.contractCost();
	}

	/** Pays a gang to attack a rival for the duration of the contract. */
	playerFundContract(targetId: number, enemyId: number): boolean {
		if (!this.playerCanFundContract(targetId)) return false;
		if (enemyId === targetId || this.factions[enemyId]?.eliminated) return false;
		this.player.cleanCash -= this.contractCost();
		this.player.contractUses += 1;
		const target = this.factions[targetId]!;
		target.contractTarget = enemyId;
		target.contractUntil = this.tick + CONTRACT.durationTicks;
		const contractAnchor = this.playerAnchor();
		if (contractAnchor >= 0) this.float(contractAnchor, `🤝 contrat : ${target.name}`, "gain");
		this.pushLog(
			`Contract: ${target.name} paid to strike ${this.factions[enemyId]!.name}`,
		);
		this.events.push("pact");
		return true;
	}
	buyCost(module: number): number {
		const size = this.city.size?.[module] ?? 1;
		return Math.round(
			BUY.baseCostClean * size * (1 + this.modulesOwned(this.player.id) * BUY.perOwned),
		);
	}

	playerCanBuy(module: number): boolean {
		if (this.outcome !== null) return false;
		if (this.ownerAt(module) !== NEUTRAL) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		if (this.player.buyCooldown > 0) return false;
		return this.player.cleanCash >= this.buyCost(module);
	}

	/** Buys an adjacent neutral quarter: Clean cash → territory. */
	playerBuy(module: number): boolean {
		if (!this.playerCanBuy(module)) return false;
		this.player.cleanCash -= this.buyCost(module);
		this.player.buyCooldown = BUY.cooldownTicks;
		this.territory.owner[module] = this.player.id;
		this.territory.control[module] = BUY.control;
		this.territory.capturedAt[module] = this.tick;
		this.player.captures += 1;
		this.recount();
		this.float(module, `🏷 bought (${this.buyCost(module).toLocaleString("en-US")})`, "gain");
		this.pushLog(`Quarter bought at a premium (module ${module})`);
		this.events.push("capture");
		return true;
	}

	private defenseBonus(factionId: number): number {
		return TECH.defensePerLevel * this.factions[factionId]!.tech.protection;
	}

	/** Max tech level unlocked by Workshops. */
	maxTechLevel(factionId: number): number {
		return Math.min(TECH.maxLevel, this.buildingCount(factionId, "workshop"));
	}

	canUpgradeTech(factionId: number, branch: TechBranch): boolean {
		if (this.outcome !== null) return false;
		const faction = this.factions[factionId]!;
		const level = faction.tech[branch];
		if (level >= this.maxTechLevel(factionId)) return false;
		return faction.cleanCash >= techCost(level + 1);
	}

	private upgradeTech(factionId: number, branch: TechBranch): boolean {
		if (!this.canUpgradeTech(factionId, branch)) return false;
		const faction = this.factions[factionId]!;
		const level = faction.tech[branch];
		faction.cleanCash -= techCost(level + 1);
		faction.tech[branch] = level + 1;
		if (factionId === this.player.id) {
			const anchor = this.playerAnchor();
			if (anchor >= 0) this.float(anchor, `🔧 ${branch} ${level + 1}`, "gain");
		}
		this.pushLog(`Tech ${branch} → ${level + 1}`);
		if (factionId === this.player.id) this.events.push("tech");
		return true;
	}

	/** Player quarter used as anchor for feedback (tech, corruption). */
	private playerAnchor(): number {
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.owner[i] === this.player.id) return i;
		}
		return -1;
	}

	playerUpgradeTech(branch: TechBranch): boolean {
		if (this.outcome !== null) return false;
		return this.upgradeTech(this.player.id, branch);
	}

	canStrike(factionId: number, module: number): boolean {
		if (this.outcome !== null) return false;
		const owner = this.territory.owner[module];
		if (owner === factionId || owner === NEUTRAL) return false;
		const faction = this.factions[factionId]!;
		if (faction.tech.armament < STRIKE.requiredArmament) return false;
		if (faction.strikeCooldown > 0) return false;
		if (this.strikes.some((strike) => strike.factionId === factionId)) return false;
		return faction.cleanCash >= STRIKE.costClean && faction.members >= STRIKE.costMembers;
	}

	playerCanStrike(module: number): boolean {
		return this.canStrike(this.player.id, module);
	}

	/**
	 * Heavy strike: pays now, lands `STRIKE.delayTicks` later. The delay is the
	 * whole point — everyone sees the target ring and can brace for it, so it is
	 * a threat you play around, not a surprise (OpenFront's nuke telegraph).
	 */
	playerStrike(module: number): boolean {
		if (!this.canStrike(this.player.id, module)) return false;
		this.launchStrike(this.player.id, module);
		this.events.push("strike");
		this.float(module, `💥 strike in ${STRIKE.delayTicks / SIM_HZ}s`, "loss");
		this.pushLog(`Strike inbound (module ${module}) — ${STRIKE.delayTicks / SIM_HZ}s`);
		return true;
	}

	private launchStrike(factionId: number, module: number): void {
		const faction = this.factions[factionId]!;
		faction.cleanCash -= STRIKE.costClean;
		faction.members -= STRIKE.costMembers;
		faction.strikeCooldown = STRIKE.cooldownTicks;
		this.strikes.push({ factionId, target: module, landsAt: this.tick + STRIKE.delayTicks });
	}

	/** Pending strikes waiting for their impact tick (telegraphed). */
	pendingStrikes(): readonly Strike[] {
		return this.strikes;
	}

	private resolveStrikes(): void {
		for (let index = this.strikes.length - 1; index >= 0; index -= 1) {
			const strike = this.strikes[index]!;
			if (strike.landsAt > this.tick) continue;
			this.strikes.splice(index, 1);
			this.applyStrike(strike);
		}
	}

	private applyStrike(strike: Strike): void {
		const { factionId, target: module } = strike;
		const targets = [module, ...this.neighbors(module)];
		for (const target of targets) {
			const owner = this.territory.owner[target];
			if (owner === factionId || owner === NEUTRAL) continue;
			const reduction = Math.min(
				STRIKE.counterReductionMax,
				this.buildingCount(owner, "counter") * STRIKE.counterReductionPerUnit,
			);
			const base = target === module ? STRIKE.damageCenter : STRIKE.damageSplash;
			this.territory.control[target] = Math.max(
				5,
				this.territory.control[target]! - base * (1 - reduction),
			);
			if (this.territory.building[target] !== NO_BUILDING) {
				this.territory.building[target] = NO_BUILDING;
				this.recount();
			}
			this.cancelConstruction(target);
			this.addHeat(target, HEAT.strike);
		}
		if (this.territory.owner[module] === this.player.id) {
			this.events.push("alert");
			this.float(module, "💥 strike hit", "loss");
		}
		this.pushLog(`Strike impact (module ${module})`);
	}

	/** Faction with the most quarters (the "leader"), -1 if none. */
	findLeader(): number {
		let best = -1;
		let bestOwned = 0;
		for (const faction of this.factions) {
			const owned = this.owned[faction.id] ?? 0;
			if (owned > bestOwned) {
				bestOwned = owned;
				best = faction.id;
			}
		}
		return bestOwned > 0 ? best : -1;
	}

	policeLevel(): PoliceTier {
		return policeTier(this.police.pressure);
	}

	private corruptionCost(factionId: number): number {
		const uses = this.factions[factionId]!.corruptionUses;
		return Math.min(
			POLICE.corruptionMaxCost,
			Math.round(POLICE.corruptionBaseCost * POLICE.corruptionCostGrowth ** uses),
		);
	}

	playerCorruptionCost(): number {
		return this.corruptionCost(this.player.id);
	}

	private canCorrupt(factionId: number): boolean {
		if (this.outcome !== null) return false;
		return this.factions[factionId]!.cleanCash >= this.corruptionCost(factionId);
	}

	playerCanCorrupt(): boolean {
		return this.canCorrupt(this.player.id);
	}

	/** Corruption: pays to lower Pressure (risk of a burned contact). */
	private corruptPolice(factionId: number): boolean {
		if (!this.canCorrupt(factionId)) return false;
		const faction = this.factions[factionId]!;
		faction.cleanCash -= this.corruptionCost(factionId);
		faction.corruptionUses += 1;
		this.coolFaction(factionId);
		if (this.rng() < POLICE.corruptionBurnChance) {
			this.police.pressure = Math.min(
				POLICE.max,
				this.police.pressure + POLICE.corruptionBurnBacklash,
			);
			this.contactIndex = (this.contactIndex + 1) % CONTACT_NAMES.length;
			this.pushLog(`Contact burned (${faction.name}) — new contact: ${this.contactName}`);
			if (faction.isPlayer) this.events.push("corrupt");
			return true;
		}
		this.police.pressure = Math.max(0, this.police.pressure - POLICE.corruptionReduction);
		this.police.window = POLICE.corruptionWindow;
		if (faction.isPlayer) {
			const anchor = this.playerAnchor();
			if (anchor >= 0) this.float(anchor, "🤝 −Pressure", "gain");
		}
		this.pushLog(`${this.contactName} lowers Pressure (${faction.name})`);
		if (faction.isPlayer) this.events.push("corrupt");
		return true;
	}

	playerCorrupt(): boolean {
		return this.corruptPolice(this.player.id);
	}

	/** A corrupt contact cools a faction's quarters (heat ÷2). */
	private coolFaction(factionId: number): void {
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.owner[i] === factionId) this.heat[i] = (this.heat[i] ?? 0) * 0.5;
		}
	}

	relationBetween(a: number, b: number): number {
		return this.relations[a]?.[b] ?? DIPLOMACY.initialRelation;
	}

	hasPact(a: number, b: number): boolean {
		return this.pactBetween(a, b) !== undefined;
	}

	playerHasPact(factionId: number): boolean {
		return this.hasPact(this.player.id, factionId);
	}

	isTraitor(factionId: number): boolean {
		return this.factions[factionId]!.traitorUntil > this.tick;
	}

	/** Pending pact offers addressed to the player. */
	playerOffers(): PactOffer[] {
		return this.offers.filter((offer) => offer.to === this.player.id);
	}

	private canProposePact(from: number, to: number): boolean {
		if (this.outcome !== null || from === to) return false;
		if (this.hasPact(from, to)) return false;
		if (this.hasEmbargo(from, to)) return false;
		if ((this.proposalCooldown[from]?.[to] ?? 0) > this.tick) return false;
		return !this.offers.some((offer) => offer.from === from && offer.to === to);
	}

	playerCanProposePact(factionId: number): boolean {
		return this.canProposePact(this.player.id, factionId);
	}

	private proposePact(from: number, to: number): boolean {
		if (!this.canProposePact(from, to)) return false;
		this.offers.push({ from, to, expires: this.tick + DIPLOMACY.offerWait });
		this.proposalCooldown[from]![to] = this.tick + DIPLOMACY.proposeCooldown;
		this.proposalCooldown[to]![from] = this.tick + DIPLOMACY.proposeCooldown;
		this.pushLog(`${this.factions[from]!.name} proposes a pact to ${this.factions[to]!.name}`);
		return true;
	}

	playerProposePact(factionId: number): boolean {
		if (!this.proposePact(this.player.id, factionId)) return false;
		this.events.push("pact");
		return true;
	}

	playerRespondToOffer(from: number, accept: boolean): boolean {
		if (this.outcome !== null) return false;
		const index = this.offers.findIndex(
			(offer) => offer.to === this.player.id && offer.from === from,
		);
		if (index < 0) return false;
		const offer = this.offers[index]!;
		this.offers.splice(index, 1);
		if (accept && !this.hasEmbargo(offer.from, offer.to)) {
			this.formPact(offer.from, offer.to);
			this.events.push("pact");
		} else {
			this.pushLog(`Pact refused (${this.factions[from]!.name})`);
		}
		return true;
	}

	isEmbargoed(factionId: number): boolean {
		return this.embargoes.some((embargo) => embargo.to === factionId && embargo.until > this.tick);
	}

	playerHasEmbargo(factionId: number): boolean {
		return this.embargoes.some(
			(embargo) =>
				embargo.from === this.player.id &&
				embargo.to === factionId &&
				embargo.until > this.tick,
		);
	}

	playerCanEmbargo(factionId: number): boolean {
		if (this.outcome !== null || factionId === this.player.id) return false;
		return !this.playerHasEmbargo(factionId);
	}

	/** Embargo: market blockade, breaks any pact (betrayal). */
	playerEmbargo(factionId: number): boolean {
		if (!this.playerCanEmbargo(factionId)) return false;
		const pact = this.pactBetween(this.player.id, factionId);
		if (pact) {
			this.pacts.splice(this.pacts.indexOf(pact), 1);
			this.betray(this.player.id, factionId);
		} else {
			this.dropRelation(this.player.id, factionId, EMBARGO.relationHit);
		}
		this.embargoes.push({
			from: this.player.id,
			to: factionId,
			until: this.tick + EMBARGO.duration,
		});
		// Purges pending pact offers between the two.
		for (let i = this.offers.length - 1; i >= 0; i -= 1) {
			const offer = this.offers[i]!;
			if (
				(offer.from === this.player.id && offer.to === factionId) ||
				(offer.from === factionId && offer.to === this.player.id)
			) {
				this.offers.splice(i, 1);
			}
		}
		this.pushLog(`Embargo declared on ${this.factions[factionId]!.name}`);
		this.events.push("embargo");
		return true;
	}

	/** Betrayal: breaks the pact with a faction and suffers the penalty. */
	playerBreakPact(factionId: number): boolean {
		if (this.outcome !== null) return false;
		const pact = this.pactBetween(this.player.id, factionId);
		if (!pact) return false;
		this.pacts.splice(this.pacts.indexOf(pact), 1);
		this.betray(this.player.id, factionId);
		this.events.push("betray");
		return true;
	}

	private hasEmbargo(a: number, b: number): boolean {
		return this.embargoes.some(
			(embargo) =>
				(embargo.from === a && embargo.to === b) ||
				(embargo.from === b && embargo.to === a),
		);
	}

	private pactBetween(a: number, b: number): Pact | undefined {
		return this.pacts.find(
			(pact) => (pact.a === a && pact.b === b) || (pact.a === b && pact.b === a),
		);
	}

	private setRelation(a: number, b: number, value: number): void {
		const clamped = Math.max(0, Math.min(100, value));
		if (this.relations[a]) this.relations[a]![b] = clamped;
		if (this.relations[b]) this.relations[b]![a] = clamped;
	}

	private dropRelation(a: number, b: number, amount: number): void {
		this.setRelation(a, b, this.relationBetween(a, b) - amount);
	}

	private formPact(a: number, b: number): void {
		if (a === b || this.hasPact(a, b) || this.hasEmbargo(a, b)) return;
		for (let i = this.offers.length - 1; i >= 0; i -= 1) {
			const offer = this.offers[i]!;
			if ((offer.from === a && offer.to === b) || (offer.from === b && offer.to === a)) {
				this.offers.splice(i, 1);
			}
		}
		this.pacts.push({ a, b, until: this.tick + DIPLOMACY.pactDuration });
		this.setRelation(a, b, Math.min(100, this.relationBetween(a, b) + 15));
		this.pushLog(`Pact ${this.factions[a]!.name} ↔ ${this.factions[b]!.name}`);
	}

	private betray(traitor: number, victim: number): void {
		this.dropRelation(traitor, victim, DIPLOMACY.betrayalRelationHit);
		this.factions[traitor]!.traitorUntil = this.tick + DIPLOMACY.traitorTicks;
		this.pushLog(`${this.factions[traitor]!.name} betrays ${this.factions[victim]!.name}`);
	}

	/** Reacts to an attack: betrayal if an ally, otherwise a relation drop. */
	private registerAttack(attacker: number, owner: number): void {
		if (owner === NEUTRAL || owner === attacker) return;
		const pact = this.pactBetween(attacker, owner);
		if (pact) {
			this.pacts.splice(this.pacts.indexOf(pact), 1);
			this.betray(attacker, owner);
			return;
		}
		this.dropRelation(attacker, owner, DIPLOMACY.attackRelationHit);
	}

	private aiDiplomacy(factionId: number): void {
		for (let index = this.offers.length - 1; index >= 0; index -= 1) {
			const offer = this.offers[index]!;
			if (offer.to !== factionId) continue;
			const accept =
				this.relationBetween(offer.from, factionId) >= DIPLOMACY.acceptRelation &&
				this.modulesOwned(offer.from) <=
					this.modulesOwned(factionId) * DIPLOMACY.acceptPowerRatio + 2;
			this.offers.splice(index, 1);
			if (accept) this.formPact(offer.from, offer.to);
		}

		for (let index = this.pacts.length - 1; index >= 0; index -= 1) {
			const pact = this.pacts[index]!;
			if (pact.a !== factionId && pact.b !== factionId) continue;
			const other = pact.a === factionId ? pact.b : pact.a;
			if (this.relationBetween(factionId, other) < DIPLOMACY.betrayRelation && this.rng() < 0.1) {
				this.pacts.splice(index, 1);
				this.betray(factionId, other);
			}
		}

		if (this.rng() >= DIPLOMACY.aiOfferChance) return;
		for (const other of this.factions) {
			if (other.id === factionId) continue;
			if (!this.canProposePact(factionId, other.id)) continue;
			if (this.relationBetween(factionId, other.id) < DIPLOMACY.acceptRelation) continue;
			this.proposePact(factionId, other.id);
			break;
		}
	}

	private updateDiplomacyTimers(): void {
		for (let i = this.offers.length - 1; i >= 0; i -= 1) {
			if (this.offers[i]!.expires <= this.tick) this.offers.splice(i, 1);
		}
		for (let i = this.pacts.length - 1; i >= 0; i -= 1) {
			if (this.pacts[i]!.until <= this.tick) this.pacts.splice(i, 1);
		}
		for (let i = this.embargoes.length - 1; i >= 0; i -= 1) {
			if (this.embargoes[i]!.until <= this.tick) this.embargoes.splice(i, 1);
		}
		for (let a = 0; a < this.factions.length; a += 1) {
			for (let b = a + 1; b < this.factions.length; b += 1) {
				const current = this.relationBetween(a, b);
				if (current < DIPLOMACY.initialRelation) {
					this.setRelation(
						a,
						b,
						Math.min(DIPLOMACY.initialRelation, current + DIPLOMACY.relationDrift),
					);
				}
			}
		}
	}

	/** Local police: crime heats quarters, patrols cool them down. */
	private updateHeat(): void {
		const count = this.territory.count;
		for (let i = 0; i < count; i += 1) {
			let value = this.heat[i]!;
			const building = this.territory.building[i]!;
			if (building === BUILDING_INDEX.storefront) value += HEAT.storefront * (this.city.demand[i] ?? 1);
			else if (building === BUILDING_INDEX.front) value += HEAT.front * (this.city.wealth[i] ?? 1);
			// Decay **proportional to heat**: a hot quarter cools faster, so the
			// equilibrium stabilizes below 100 (≈45 for a Storefront with demand
			// 1). Otherwise every sale ended at 100 in ~2 min.
			const decay =
				HEAT.decay *
				(1 + this.heat[i]! / HEAT.decayHalf) *
				(this.policeZone[i] ? HEAT.policeSuppress : 1);
			this.heat[i] = Math.max(0, Math.min(HEAT.max, value - decay));
		}
	}

	private updatePolice(): void {
		const state = this.police;
		if (state.cooldown > 0) state.cooldown -= 1;
		if (state.window > 0) state.window -= 1;

		const leader = this.findLeader();
		state.target = leader;
		const modules = this.city.modules.length;
		const leaderShare = leader >= 0 ? (this.owned[leader] ?? 0) / modules : 0;
		// Battle royale: we don't punish a mere lead, only crushing domination.
		const excess = Math.max(0, leaderShare - POLICE.dominationShare);

		// Proportional decay: the hotter the Pressure, the faster it cools, so it
		// settles at an equilibrium instead of ratcheting to liquidation.
		let delta =
			POLICE.excessWeight * excess +
			POLICE.crimeWeight * state.crime -
			POLICE.baseDecay * (1 + state.pressure / POLICE.decayHalf);
		if (state.window > 0) delta -= POLICE.corruptionSuppress;
		state.crime *= POLICE.crimeDecay;
		const floor = excess * POLICE.dominationFloor;
		state.pressure = Math.min(POLICE.max, Math.max(floor, state.pressure + delta));

		if (leader < 0) return;
		if (state.pressure >= POLICE.liquidation) {
			this.policeLiquidation(leader);
			return;
		}
		if (state.cooldown <= 0 && state.pressure >= POLICE.raidThreshold) {
			this.policeRaid(leader);
		}
	}

	private highestHeatModules(factionId: number, count: number): number[] {
		const owned: number[] = [];
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.owner[i] === factionId) owned.push(i);
		}
		owned.sort((a, b) => {
			const diff = this.heat[b]! - this.heat[a]!;
			return diff !== 0 ? diff : a - b;
		});
		return owned.slice(0, count);
	}

	/** Raid: removes Control (and destroys buildings) from the leader. */
	private policeRaid(leader: number): void {
		const state = this.police;
		const multiple = state.pressure >= POLICE.multiThreshold;
		const targets = this.highestHeatModules(
			leader,
			multiple ? POLICE.raidsMulti : POLICE.raidsSingle,
		);
		for (const module of targets) {
			this.territory.control[module] = Math.max(
				0,
				this.territory.control[module]! - POLICE.raidControl,
			);
			this.territory.building[module] = NO_BUILDING;
			this.cancelConstruction(module);
		}
		if (targets.length > 0) this.recount();
		const leaderFaction = this.factions[leader]!;
		leaderFaction.raidsSuffered += 1;
		if (leaderFaction.isPlayer) this.events.push("raid");
		if (multiple) {
			leaderFaction.cleanCash *= 1 - POLICE.seizureRatio;
			leaderFaction.seizures += 1;
		}
		state.cooldown = POLICE.raidCooldown;
		state.lastRaidTick = this.tick;
		state.raids += 1;
		this.pushLog(`Police raid on ${this.factions[leader]!.name} (${targets.length})`);
	}

	/** Liquidation: player defeat, or dismantling of a dominant AI gang. */
	private policeLiquidation(leader: number): void {
		const faction = this.factions[leader]!;
		this.police.liquidations += 1;
		if (faction.isPlayer) {
			this.outcome = "defeat";
			this.endReason = "Police liquidation: your cartel has fallen.";
			this.pushLog("Police liquidation of the Cartel");
			return;
		}
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.owner[i] !== leader) continue;
			this.territory.owner[i] = NEUTRAL;
			this.territory.control[i] = NEUTRAL_GARRISON;
			this.territory.building[i] = NO_BUILDING;
			this.cancelConstruction(i);
		}
		this.recount();
		this.police.pressure = POLICE.multiThreshold;
		faction.eliminated = true;
		this.pushLog(`${faction.name} dismantled by the police`);
	}

	canAttack(factionId: number, module: number): boolean {
		if (this.territory.owner[module] === factionId) return false;
		return this.neighbors(module).some((neighbor) => this.territory.owner[neighbor] === factionId);
	}

	playerAttack(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		if (!this.attackFrom(this.player.id, module)) return false;
		this.events.push("attack");
		return true;
	}

	/**
	 * Best adjacent target for automatic expansion: the attackable quarter with
	 * the **lowest Control** (neutral or non-pact enemy). Lets you expand without
	 * micromanaging every click.
	 */
	bestAdjacentTarget(): number {
		let best = -1;
		let bestScore = Number.POSITIVE_INFINITY;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (!this.canAttack(this.player.id, i)) continue;
			const owner = this.territory.owner[i]!;
			if (owner !== NEUTRAL && this.hasPact(this.player.id, owner)) continue;
			const score = this.territory.control[i]!;
			if (score < bestScore) {
				bestScore = score;
				best = i;
			}
		}
		return best;
	}

	/** Automatically attacks the best adjacent target. */
	playerAttackBest(): boolean {
		const target = this.bestAdjacentTarget();
		return target >= 0 && this.playerAttack(target);
	}

	playerCanAttack(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		return Math.floor(this.player.members * COMMIT_RATIO) >= MIN_COMMIT;
	}

	/** Can the player build `type` on this quarter? */
	playerCanBuild(module: number, type: BuildingType): boolean {
		if (this.outcome !== null) return false;
		if (this.territory.owner[module] !== this.player.id) return false;
		if (this.territory.building[module] !== NO_BUILDING) return false;
		if (this.territory.construction[module]! > 0) return false;
		if (this.activeConstructions(this.player.id) >= BUILD_CREWS) return false;
		if (!canBuildInZone(this.city.modules[module]!, type)) return false;
		return this.canAfford(this.player, type, this.buildCostFactor(this.player.id, module, type));
	}

	/** Building types convertible on this quarter (depending on its zone). */
	allowedBuildings(module: number): readonly BuildingType[] {
		return ZONE_BUILDINGS[this.city.modules[module]!];
	}

	canBuildInZone(module: number, type: BuildingType): boolean {
		return canBuildInZone(this.city.modules[module]!, type);
	}

	/** Affordability independent of the zone (choose the type before the module). */
	playerCanAfford(type: BuildingType): boolean {
		// Optimistic cost: a conversion costs half price.
		return this.canAfford(this.player, type, CONVERSION_COST);
	}

	playerBuild(module: number, type: BuildingType): boolean {
		if (!this.playerCanBuild(module, type)) return false;
		const conversion = this.isConversion(module);
		this.startBuild(this.player.id, module, type);
		this.float(module, `🏗 ${BUILDINGS[type].label}`, "info");
		this.pushLog(
			conversion
				? `${BUILDINGS[type].label} upgraded (module ${module})`
				: `Build site ${BUILDINGS[type].label} (module ${module})`,
		);
		this.events.push("build");
		return true;
	}

	/** Defense multiplier of a quarter (zone, Safehouse, tech, traitor). */
	defenseAt(module: number): number {
		const owner = this.territory.owner[module]!;
		const zone = this.city.modules[module]!;
		const safehouse =
			this.buildingAt(module) === "safehouse" ? BUILDING_EFFECTS.safehouseDefense : 1;
		const defenderBonus = owner === NEUTRAL ? 0 : this.defenseBonus(owner);
		const traitor = owner !== NEUTRAL && this.isTraitor(owner) ? DIPLOMACY.traitorDefense : 1;
		return (ZONE_DEFENSE[zone] ?? 1) * safehouse * (1 + defenderBonus) * traitor;
	}

	raidCost(): { sale: number; members: number } {
		return { sale: RAID.costSale, members: RAID.costMembers };
	}

	playerCanRaid(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		if (this.ownerAt(module) === NEUTRAL) return false;
		if (this.player.dirtyCash < RAID.costSale) return false;
		if (this.player.members < RAID.costMembers) return false;
		return this.player.raidCooldown <= 0;
	}

	/** Raid: weakens an adjacent quarter (Control + buildings) without capturing it. */
	playerRaid(module: number): boolean {
		if (!this.playerCanRaid(module)) return false;
		this.player.dirtyCash -= RAID.costSale;
		this.player.members -= RAID.costMembers;
		this.player.raidCooldown = RAID.cooldownTicks;
		this.territory.control[module] = Math.max(
			5,
			this.territory.control[module]! - RAID.control,
		);
		this.territory.building[module] = NO_BUILDING;
		this.cancelConstruction(module);
		this.addHeat(module, HEAT.operation);
		this.recount();
		this.events.push("raid");
		this.float(module, `raid −${RAID.control}`, "loss");
		this.pushLog(`Raid on module ${module}`);
		return true;
	}

	/** Player laundering ratio (0–1). */
	playerLaunderRatio(): number {
		return this.player.launderRatio;
	}

	playerSetLaunderRatio(ratio: number): void {
		this.player.launderRatio = Math.max(0, Math.min(1, ratio));
	}

	/** Active floating texts (juice). */
	activeFloaters(): readonly Floater[] {
		return this.floaters;
	}

	private float(module: number, text: string, kind: Floater["kind"]): void {
		this.floaters.push({ module, text, kind, until: this.tick + 14 });
		if (this.floaters.length > 24) this.floaters.shift();
	}

	/** Number of Watchers covering a quarter (radius 1) — UI pre-check. */
	guardsAt(module: number): number {
		const owner = this.ownerAt(module);
		return owner === NEUTRAL ? 0 : this.guardedBy(owner, module);
	}

	/** Does a Watcher (counter-intel) cover this quarter (radius 1)? */
	private guardedBy(owner: number, module: number): number {
		// Unpaid Watchers → blind.
		if (!this.factions[owner]?.guardsPaid) return 0;
		let guards = 0;
		if (
			this.territory.owner[module] === owner &&
			this.territory.building[module] === BUILDING_INDEX.counter
		) {
			guards += 1;
		}
		for (const neighbor of this.neighbors(module)) {
			if (
				this.territory.owner[neighbor] === owner &&
				this.territory.building[neighbor] === BUILDING_INDEX.counter
			) {
				guards += 1;
			}
		}
		return guards;
	}

	bustCost(): { sale: number; members: number } {
		return { sale: BUST.costSale, members: BUST.costMembers };
	}

	playerCanBust(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		const owner = this.ownerAt(module);
		if (owner === NEUTRAL || owner === this.player.id) return false;
		if (!this.buildingAt(module)) return false;
		if (this.player.tech.armament < BUST.requiredArmament) return false;
		if (this.player.bustCooldown > 0) return false;
		return (
			this.player.dirtyCash >= BUST.costSale && this.player.members >= BUST.costMembers
		);
	}

	/** Bust: steals a building's loot without destroying it or changing control. */
	playerBust(module: number): boolean {
		if (!this.playerCanBust(module)) return false;
		const owner = this.ownerAt(module);
		const type = this.buildingAt(module)!;
		this.player.dirtyCash -= BUST.costSale;
		this.player.members -= BUST.costMembers;
		this.player.bustCooldown = BUST.cooldownTicks;
		// An enemy Watcher hinders the operation (reduced loot, fails if the network is dense).
		const guards = this.guardedBy(owner, module);
		if (guards >= 2) {
			this.pushLog(`Bust foiled (watchers, module ${module})`);
			this.events.push("alert");
			return true;
		}
		const gained = this.loot(this.player.id, owner, type, guards >= 1 ? LOOT_RATIO * 0.5 : LOOT_RATIO);
		this.addHeat(module, HEAT.operation);
		this.events.push("bust");
		this.float(
			module,
			gained.sale
				? `bust +${Math.round(gained.sale)} dirty`
				: gained.clean
					? `bust +${Math.round(gained.clean)} clean`
					: `bust +${Math.round(gained.members)} members`,
			"gain",
		);
		this.pushLog(`Bust successful (module ${module})`);
		return true;
	}

	/** Convoy heading to this quarter (interception target), if any. */
	private convoyTo(module: number): ConvoyRoute | undefined {
		return this.convoys.find((route) => route.to === module);
	}

	interceptCost(): number {
		return INTERCEPT.costMembers;
	}

	playerCanIntercept(module: number): boolean {
		if (this.outcome !== null) return false;
		const owner = this.ownerAt(module);
		if (owner === NEUTRAL || owner === this.player.id) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		const route = this.convoyTo(module);
		// Only worth it when there is cargo on the road.
		if (!route || route.cargo <= 0) return false;
		if (this.player.tech.armament < INTERCEPT.requiredArmament) return false;
		if (this.player.interceptCooldown > 0) return false;
		return this.player.members >= INTERCEPT.costMembers;
	}

	/** Interception: takes the cargo the convoy is carrying and cuts the line. */
	playerIntercept(module: number): boolean {
		if (!this.playerCanIntercept(module)) return false;
		const route = this.convoyTo(module)!;
		this.player.members -= INTERCEPT.costMembers;
		this.player.interceptCooldown = INTERCEPT.cooldownTicks;
		const gained = this.takeCargo(this.player, route);
		this.addHeat(module, HEAT.operation);
		this.events.push("intercept");
		this.float(module, `interception +${Math.round(gained)}`, "gain");
		this.pushLog(`Convoy intercepted (module ${module})`);
		return true;
	}

	/** Hands the cargo on the road to the thief and restarts the leg. */
	private takeCargo(thief: Faction, route: ConvoyRoute): number {
		const gained = route.cargo;
		route.cargo = 0;
		route.progress = 0;
		if (route.kind === "product") thief.product += gained;
		else thief.dirtyCash += gained;
		return gained;
	}

	/** Pending choice event for the player (only one at a time). */
	pendingEvent(): PendingEvent | null {
		return this.pending;
	}

	/** Forces an event (tests / scenarios) — does not affect the normal simulation. */
	debugSetEvent(event: PendingEvent | null): void {
		this.pending = event;
	}

	/**
	 * Resolves the current event. Both choices have a real cost and benefit,
	 * **neither is scripted good/bad** (docs/npc-events.md).
	 */
	playerChoose(choice: 0 | 1): boolean {
		const event = this.pending;
		if (!event || this.outcome !== null) return false;
		const player = this.player;
		const anchor = this.playerAnchor();
		if (event.id === "livraison") {
			if (choice === 0) {
				player.dirtyCash += 3500;
				if (anchor >= 0) {
					this.addHeat(anchor, HEAT.operation * 3);
					this.float(anchor, "+3,500 dirty", "gain");
				}
				this.pushLog("Delivery accepted: +3,500 dirty, heat rising");
			} else {
				player.cleanCash += 4000;
				this.pushLog("Delivery refused: +4,000 clean");
			}
		} else if (event.id === "indicateur") {
			if (choice === 0) {
				player.dirtyCash = Math.max(0, player.dirtyCash - 6000);
				this.police.pressure = Math.max(0, this.police.pressure - 12);
				this.pushLog("Informant bought: −12 Pressure (−6,000 dirty)");
			} else {
				player.dirtyCash += 3000;
				player.cleanCash += 3000;
				this.police.pressure = Math.min(POLICE.max, this.police.pressure + 8);
				if (anchor >= 0) this.addHeat(anchor, HEAT.operation * 4);
				this.pushLog("Informant silenced: +6,000, Pressure +8");
			}
		} else if (event.id === "front") {
			if (choice === 0) {
				// Look for an owned, empty quarter compatible with a Front.
				let free = -1;
				for (let i = 0; i < this.territory.count; i += 1) {
					if (this.territory.owner[i] !== this.player.id) continue;
					if (this.territory.building[i] !== NO_BUILDING) continue;
					if (this.territory.construction[i]! > 0) continue;
					if (!canBuildInZone(this.city.modules[i]!, "front")) continue;
					free = i;
					break;
				}
				if (free >= 0) {
					this.territory.building[free] = BUILDING_INDEX.front;
					this.territory.builtAt[free] = this.tick;
					this.recount();
					this.float(free, "🏛 Free Front", "gain");
					this.pushLog(`Rival Front bought out (module ${free})`);
				} else {
					// No free premises: compensate with Clean cash (choice is never useless).
					player.cleanCash += 3000;
					this.pushLog("Front bought: no free premises → +3,000 clean");
				}
			} else {
				player.dirtyCash += 5000;
				this.pushLog("Front resold: +5,000 dirty");
			}
		}
		this.events.push("event");
		this.pending = null;
		return true;
	}

	/** Draws a choice event (deterministic, one at a time, ~every 2 min). */
	private maybeTriggerEvent(): void {
		if (this.pending || this.outcome !== null) return;
		if (this.tick < 600 || this.tick % 1200 !== 0) return;
		if (this.rng() >= 0.5) return;
		const pool: PendingEvent[] = [
			{
				id: "livraison",
				title: "Risky delivery",
				body: "A supplier offers an off-the-books shipment: immediate payment, but the police are lurking.",
				kind: "info",
				choices: [
					{ label: "Accept", detail: "+3,500 dirty · heat rising" },
					{ label: "Refuse", detail: "+4,000 clean" },
				],
			},
			{
				id: "indicateur",
				title: "An informant talks",
				body: "Someone snitched on you. He can be bought… or silenced.",
				kind: "loss",
				choices: [
					{ label: "Buy", detail: "−6,000 dirty · −12 Pressure" },
					{ label: "Silence", detail: "+6,000 · Pressure +8" },
				],
			},
			{
				id: "front",
				title: "Rival Front",
				body: "A well-placed Front frees up in one of your quarters.",
				kind: "gain",
				choices: [
					{ label: "Buy it", detail: "Front upgraded for free" },
					{ label: "Resell", detail: "+5,000 dirty" },
				],
			},
		];
		this.pending = pool[Math.floor(this.rng() * pool.length)]!;
	}

	/** Loot: transfers a share of the destroyed building's value to the attacker. */
	private loot(attackerId: number, victimId: number, type: BuildingType, ratio = LOOT_RATIO): { sale: number; clean: number; members: number } {
		const spec = BUILDINGS[type];
		const attacker = this.factions[attackerId]!;
		const victim = this.factions[victimId]!;
		const take = (cost: number | undefined, stock: number): number => {
			if (!cost) return 0;
			return Math.min(cost * ratio, stock);
		};
		const members = take(spec.costMembers, victim.members);
		const sale = take(spec.costSale, victim.dirtyCash);
		const clean = take(spec.costClean, victim.cleanCash);
		victim.members -= members;
		attacker.members += members;
		victim.dirtyCash -= sale;
		attacker.dirtyCash += sale;
		victim.cleanCash -= clean;
		attacker.cleanCash += clean;
		return { sale, clean, members };
	}

	/** Consumes player events accumulated since the last render. */
	drainEvents(): GameEvent[] {
		if (this.events.length === 0) return [];
		return this.events.splice(0, this.events.length);
	}

	/**
	 * Batch build plan: develops empty owned quarters according to the target
	 * composition. Numbers for preview (without the queue).
	 */
	playerBatchPreview(): { count: number; sale: number; members: number; clean: number } {
		const player = this.player;
		const counts = this.buildingCounts(player.id);
		const scratch = { ...counts };
		const owned = this.modulesOwned(player.id);
		const bootstrap = missingEconomyStep(scratch, (t) =>
			this.canAfford(player, t, CONVERSION_COST),
		);
		let count = 0;
		let sale = 0;
		let members = 0;
		let clean = 0;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.ownerAt(i) !== player.id) continue;
			if (this.territory.building[i] !== NO_BUILDING) continue;
			if (this.territory.construction[i]! > 0) continue;
			const type =
				bootstrap ??
				chooseBuildType(scratch, owned, (t) => canBuildInZone(this.city.modules[i]!, t));
			if (type === null) continue;
			if (!canBuildInZone(this.city.modules[i]!, type)) continue;
			const factor = this.buildCostFactor(player.id, i, type, scratch[type]);
			const spec = BUILDINGS[type];
			if (spec.costMembers) members += Math.round(spec.costMembers * factor);
			if (spec.costSale) sale += Math.round(spec.costSale * factor);
			if (spec.costClean) clean += Math.round(spec.costClean * factor);
			scratch[type] += 1;
			count += 1;
		}
		return { count, sale, members, clean };
	}

	/** Directly launches possible upgrades, within crew limits. */
	playerBatchBuild(): number {
		const player = this.player;
		const counts = this.buildingCounts(player.id);
		const scratch = { ...counts };
		const owned = this.modulesOwned(player.id);
		let built = 0;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.activeConstructions(player.id) >= BUILD_CREWS) break;
			if (this.ownerAt(i) !== player.id) continue;
			if (this.territory.building[i] !== NO_BUILDING) continue;
			if (this.territory.construction[i]! > 0) continue;
			const bootstrap = missingEconomyStep(scratch, (t) =>
				this.canAfford(player, t, CONVERSION_COST),
			);
			const type =
				bootstrap ??
				chooseBuildType(scratch, owned, (t) => canBuildInZone(this.city.modules[i]!, t));
			if (type === null) continue;
			const factor = this.buildCostFactor(player.id, i, type, scratch[type]);
			if (!this.canAfford(player, type, factor)) continue;
			this.startBuild(player.id, i, type);
			scratch[type] += 1;
			built += 1;
		}
		return built;
	}

	/** Number of simultaneous build sites allowed per faction. */
	buildCrews(): number {
		return BUILD_CREWS;
	}

	/** Ongoing build sites of a faction. */
	activeConstructions(factionId: number): number {
		let count = 0;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.construction[i]! > 0 && this.territory.owner[i] === factionId) count += 1;
		}
		return count;
	}

	/** Number of simultaneous assaults allowed per faction. */
	commitRatio(): number {
		return this.player.attackRatio;
	}

	/** Share of Members committed to each assault (0.05–0.6). */
	playerSetAttackRatio(ratio: number): void {
		this.player.attackRatio = Math.max(0.05, Math.min(0.6, ratio));
	}

	playerAttackRatio(): number {
		return this.player.attackRatio;
	}

	minCommit(): number {
		return MIN_COMMIT;
	}

	private canAfford(faction: Faction, type: BuildingType, factor = 1): boolean {
		const spec = BUILDINGS[type];
		if (spec.costMembers && faction.members < spec.costMembers * factor) return false;
		if (spec.costSale && faction.dirtyCash < spec.costSale * factor) return false;
		if (spec.costClean && faction.cleanCash < spec.costClean * factor) return false;
		return true;
	}

	private pay(faction: Faction, type: BuildingType, factor = 1): void {
		const spec = BUILDINGS[type];
		if (spec.costMembers) faction.members -= spec.costMembers * factor;
		if (spec.costSale) faction.dirtyCash -= spec.costSale * factor;
		if (spec.costClean) faction.cleanCash -= spec.costClean * factor;
	}

	/** Conversion of an existing building (excluding vacant lot): −50%, instant. */
	isConversion(module: number): boolean {
		return this.city.modules[module] !== "vacant";
	}

	/** Cost factor: 0.5 for conversion, 1.0 for new construction. */
	/**
	 * Cost factor: conversion (−50%) × growth per already-owned type.
	 * `count` accounts for buildings already planned in the same batch.
	 */
	buildCostFactor(factionId: number, module: number, type: BuildingType, count?: number): number {
		const owned = count ?? this.counts[factionId]?.[type] ?? 0;
		const base = this.isConversion(module) ? CONVERSION_COST : 1;
		return base * buildingCostGrowth(owned);
	}

	/** Pays then starts the build site (conversion = half the time, build site regardless). */
	private startBuild(factionId: number, module: number, type: BuildingType): void {
		this.pay(this.factions[factionId]!, type, this.buildCostFactor(factionId, module, type));
		const ticks = Math.round(
			BUILD_TICKS[type] * (this.isConversion(module) ? CONVERSION_TIME : 1),
		);
		this.territory.pending[module] = BUILDING_INDEX[type];
		this.territory.construction[module] = ticks;
		this.recount();
	}

	/**
	 * Interrupts a build site (building destroyed, quarter lost). The paid cost is
	 * **partially refunded** (50%) to the owner who paid it — otherwise losing a
	 * quarter under construction was an opaque dead loss.
	 */
	private cancelConstruction(module: number, refundTo?: number): void {
		const pending = this.territory.pending[module]!;
		const payer = refundTo ?? this.territory.owner[module];
		this.territory.construction[module] = 0;
		this.territory.pending[module] = NO_BUILDING;
		if (pending === NO_BUILDING || payer === undefined || payer === NEUTRAL) return;
		const type = BUILDING_TYPES[pending];
		if (type) this.refund(this.factions[payer]!, type, 0.5);
	}

	/** Refunds a share of a building's cost (build site cancellation). */
	private refund(faction: Faction, type: BuildingType, ratio: number): void {
		const spec = BUILDINGS[type];
		if (spec.costMembers) faction.members += spec.costMembers * ratio;
		if (spec.costSale) faction.dirtyCash += spec.costSale * ratio;
		if (spec.costClean) faction.cleanCash += spec.costClean * ratio;
	}

	/** Advances build sites by one tick; delivers those that complete. */
	private advanceConstruction(): void {
		let completed = false;
		for (let i = 0; i < this.territory.count; i += 1) {
			const left = this.territory.construction[i]!;
			if (left <= 0) continue;
			if (left > 1) {
				this.territory.construction[i] = left - 1;
				continue;
			}
			this.territory.construction[i] = 0;
			if (this.territory.pending[i] !== NO_BUILDING && this.territory.owner[i] !== NEUTRAL) {
				this.territory.building[i] = this.territory.pending[i]!;
				this.territory.builtAt[i] = this.tick;
				const type = BUILDING_TYPES[this.territory.building[i]!];
				if (type) this.float(i, `${BUILDINGS[type].label} ready`, "gain");
				completed = true;
			}
			this.territory.pending[i] = NO_BUILDING;
		}
		if (completed) this.recount();
	}

	constructionLeft(module: number): number {
		return this.territory.construction[module] ?? 0;
	}

	pendingBuilding(module: number): BuildingType | null {
		const index = this.territory.pending[module]!;
		return index === NO_BUILDING ? null : (BUILDING_TYPES[index] ?? null);
	}

	private attackFrom(factionId: number, module: number): boolean {
		const faction = this.factions[factionId]!;
		// No cap on simultaneous assaults: the **global troop pool** is the limit.
		// Every front you open drains your own army (and the defender's).
		const troops = Math.floor(faction.members * faction.attackRatio);
		if (troops < MIN_COMMIT) return false;
		// Origin = owned quarter adjacent with the highest control.
		let source = -1;
		let best = -1;
		for (const neighbor of this.neighbors(module)) {
			if (this.territory.owner[neighbor] !== factionId) continue;
			const control = this.territory.control[neighbor]!;
			if (control > best) {
				best = control;
				source = neighbor;
			}
		}
		if (source < 0) return false;
		this.registerAttack(factionId, this.territory.owner[module]!);
		faction.members -= troops;
		this.attacks.push({
			factionId,
			source,
			target: module,
			troops,
			arrivesAt: this.tick + TRAVEL_TICKS,
			startControl: this.territory.control[module]!,
			initialTroops: troops,
		});
		// Watcher: a Counter-intel adjacent to the target alerts the player defender.
		const defender = this.territory.owner[module];
		if (defender === this.player.id && factionId !== this.player.id) {
			const lookout = this.neighbors(module).some(
				(neighbor) =>
					this.territory.owner[neighbor] === defender &&
					this.territory.building[neighbor] === BUILDING_INDEX.counter,
			);
			if (lookout) {
				this.events.push("alert");
				this.float(module, "Bust!", "loss");
				this.pushLog(`Alert: enemy bust (module ${module})`);
			}
		}
		return true;
	}

	step(): void {
		if (this.outcome !== null) return;
		this.tick += 1;
		this.recount();
		for (const faction of this.factions) {
			if (faction.strikeCooldown > 0) faction.strikeCooldown -= 1;
			if (faction.raidCooldown > 0) faction.raidCooldown -= 1;
			if (faction.bustCooldown > 0) faction.bustCooldown -= 1;
			if (faction.interceptCooldown > 0) faction.interceptCooldown -= 1;
			if (faction.buyCooldown > 0) faction.buyCooldown -= 1;
		}
		this.produce();
		this.sell();
		this.launder();
		this.deliverConvoys();
		this.payUpkeep();
		this.regenerateControl();
		this.advanceConstruction();
		this.resolveAttacks();
		this.resolveStrikes();
		this.resolveEncirclements();
		this.updateDiplomacyTimers();
		this.think();
		for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
			if (this.floaters[i]!.until <= this.tick) this.floaters.splice(i, 1);
		}
		this.updateTreasury();
		this.updateHeat();
		this.updatePolice();
		this.maybeTriggerEvent();
		this.checkOutcome();
		if (this.outcome !== null && !this.outcomeRecorded) {
			this.outcomeRecorded = true;
			this.events.push(this.outcome === "victory" ? "victory" : "defeat");
		}
	}

	/** Production: members (Housing/quarters) and product (Labs). */
	private produce(): void {
		for (const faction of this.factions) {
			const max = this.maxMembers(faction.id);
			faction.members = Math.min(
				max,
				faction.members + Math.max(0, this.productionPerTick(faction.id)),
			);
			const labs = (this.labWeight[faction.id] ?? 0) * this.upkeepFactor(faction.id);
			if (labs > 0) faction.productInTransit += labs * BUILDING_EFFECTS.productPerLab;
		}
	}

	/** Storefronts: Product → Dirty cash, at the quarter's price (local wealth). */
	private sell(): void {
		for (const faction of this.factions) {
			const demand = this.retailDemand[faction.id] ?? 0;
			const supply = SUPPLY_FLOOR + (1 - SUPPLY_FLOOR) * (this.retailSupply[faction.id] ?? 1);
			const storefronts = demand * supply * this.upkeepFactor(faction.id);
			if (storefronts === 0) continue;
			const capacity = storefronts * BUILDING_EFFECTS.productPerStorefront;
			// In-house product first; the rest comes from an external supplier.
			const fromStock = Math.min(faction.product, capacity);
			faction.product -= fromStock;
			const external = capacity - fromStock;
			const margin = fromStock + external * EXTERNAL_SUPPLY_MARGIN;
			const avgWealth = demand > 0 ? (this.retailWeighted[faction.id] ?? 0) / demand : 1;
			const embargo = this.isEmbargoed(faction.id) ? 1 - EMBARGO.salePenalty : 1;
			faction.dirtyInTransit += margin * BUILDING_EFFECTS.pricePerProduct * avgWealth * embargo;
		}
	}

	/** Fronts: Dirty cash → Clean cash (capacity ∝ local wealth). */
	private launder(): void {
		for (const faction of this.factions) {
			const fronts =
				(this.launderWealth[faction.id] ?? 0) *
				(SUPPLY_FLOOR + (1 - SUPPLY_FLOOR) * (this.launderSupply[faction.id] ?? 1)) *
				this.upkeepFactor(faction.id);
			if (fronts === 0 || faction.dirtyCash <= 0 || faction.launderRatio <= 0) continue;
			const capacity = fronts * BUILDING_EFFECTS.cashPerFront * faction.launderRatio;
			const laundered = Math.min(faction.dirtyCash, capacity);
			faction.dirtyCash -= laundered;
			faction.cleanCash += laundered * (1 - BUILDING_EFFECTS.commission);
		}
	}

	/**
	 * Convoys are the **only** way Product and Dirty cash reach their
	 * destination: each route loads an equal share of what is waiting, runs its
	 * leg, then hands the cargo over on arrival. What is on the road is exactly
	 * what interception can take (OpenFront idea: no faucet).
	 */
	private deliverConvoys(): void {
		for (const faction of this.factions) {
			this.deliverLeg(faction, "product");
			this.deliverLeg(faction, "cash");
		}
	}

	private deliverLeg(faction: Faction, kind: ConvoyRoute["kind"]): void {
		const isProduct = kind === "product";
		const routes = this.convoys.filter((route) => route.factionId === faction.id && route.kind === kind);
		if (routes.length === 0) {
			// Broken chain: no line means no convoy and no transit — bank directly,
			// so a missing Front can never starve the treasury. The supply penalty
			// (SUPPLY_FLOOR) already prices the broken link.
			if (isProduct) {
				faction.product += faction.productInTransit;
				faction.productInTransit = 0;
			} else {
				faction.dirtyCash += faction.dirtyInTransit;
				faction.dirtyInTransit = 0;
			}
			return;
		}
		for (const route of routes) {
			if (route.cargo === 0) {
				const waiting = isProduct ? faction.productInTransit : faction.dirtyInTransit;
				const share = waiting / routes.length;
				if (share <= 0) continue;
				if (isProduct) faction.productInTransit -= share;
				else faction.dirtyInTransit -= share;
				route.cargo = share;
			}
			route.progress += 1 / CONVOY_TRANSIT_TICKS;
			if (route.progress < 1) continue;
			route.progress = 0;
			if (isProduct) faction.product += route.cargo;
			else faction.dirtyCash += route.cargo;
			route.cargo = 0;
		}
	}

	private regenerateControl(): void {
		const underAttack = this.underAttack;
		underAttack.clear();
		for (const attack of this.attacks) underAttack.add(attack.target);
		for (let i = 0; i < this.territory.count; i += 1) {
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL) continue;
			if (underAttack.has(i)) continue;
			const logistics = 1 + TECH.logisticsControlRegen * this.factions[owner]!.tech.logistics;
			this.territory.control[i] = Math.min(
				100,
				this.territory.control[i]! + CONTROL_REGEN * logistics,
			);
		}
	}

	/**
	 * Encirclement (OpenFront idea): a connected set of quarters of the same
	 * faction with no border to neutral or another faction **capitulates** at once
	 * to its encircler. Rewards maneuver and avoids endless endgames.
	 * Deterministic, size threshold.
	 */
	private resolveEncirclements(): void {
		if (this.tick % 5 !== 0) return;
		const count = this.territory.count;
		const assigned = new Uint8Array(count);
		let changed = false;
		for (let start = 0; start < count; start += 1) {
			const owner = this.territory.owner[start]!;
			if (owner === NEUTRAL || assigned[start]) continue;
			// Connected component of the same owner.
			const cluster: number[] = [start];
			assigned[start] = 1;
			let encircler = -1;
			let closed = true;
			for (let head = 0; head < cluster.length; head += 1) {
				const module = cluster[head]!;
				for (const neighbor of this.neighbors(module)) {
					const other = this.territory.owner[neighbor]!;
					if (other === owner) {
						if (!assigned[neighbor]) {
							assigned[neighbor] = 1;
							cluster.push(neighbor);
						}
						continue;
					}
					if (other === NEUTRAL) {
						closed = false;
					} else if (encircler === -1) {
						encircler = other;
					} else if (encircler !== other) {
						closed = false;
					}
				}
			}
			if (!closed || encircler < 0 || encircler === owner) continue;
			// Only significant clusters capitulate: avoids free nibbling and lets a
			// reduced faction fight (its loss would otherwise be arbitrary).
			const factionOwned = this.owned[owner] ?? 0;
			if (cluster.length < ENCIRCLE_MIN_SIZE) continue;
			if (factionOwned > 0 && cluster.length < factionOwned * ENCIRCLE_SHARE) continue;
			// The encircler must be the bigger one: an almost-complete empire doesn't
			// fall to contact with a tiny pocket.
			if (cluster.length >= (this.owned[encircler] ?? 0)) continue;
			const victim = this.factions[owner]!;
			const taker = this.factions[encircler]!;
			for (const module of cluster) {
				this.territory.owner[module] = encircler;
				this.territory.control[module] = CAPTURE_CONTROL;
				this.territory.building[module] = NO_BUILDING;
				this.territory.capturedAt[module] = this.tick;
				this.cancelConstruction(module);
			}
			victim.quartersLost += cluster.length;
			taker.captures += cluster.length;
			this.addHeat(cluster[0]!, HEAT.capture);
			if (owner === this.player.id) {
				this.events.push("lost");
				this.float(cluster[0]!, `encircled −${cluster.length}`, "loss");
			} else if (encircler === this.player.id) {
				this.events.push("capture");
				this.float(cluster[0]!, `encirclement +${cluster.length}`, "gain");
			}
			this.pushLog(`${taker.name} encircles ${victim.name} (${cluster.length})`);
			changed = true;
		}
		if (changed) this.recount();
	}

	/**
	 * Share of a faction's army currently out on the field (0–1). Committing
	 * everything leaves the homeland empty: the pool is also your defense.
	 */
	committedShare(factionId: number): number {
		let committed = 0;
		for (const attack of this.attacks) {
			if (attack.factionId === factionId) committed += attack.troops;
		}
		const total = (this.factions[factionId]?.members ?? 0) + committed;
		return total > 0 ? committed / total : 0;
	}

	/**
	 * Troop-equivalent holding a quarter — what the front label shows: the
	 * owner's Members spread over its quarters (OpenFront's `troops / tiles`).
	 * A neutral quarter holds the standing garrison.
	 */
	garrisonAt(module: number): number {
		const owner = this.territory.owner[module]!;
		if (owner === NEUTRAL) return NEUTRAL_GARRISON;
		const quarters = this.owned[owner] ?? 0;
		if (quarters <= 0) return 0;
		return this.factions[owner]!.members / quarters;
	}

	private resolveAttacks(): void {
		for (let index = this.attacks.length - 1; index >= 0; index -= 1) {
			const attack = this.attacks[index]!;
			// Troops still moving: no damage before arrival.
			if (attack.arrivesAt > this.tick) continue;
			const owner = this.territory.owner[attack.target];
			if (owner === attack.factionId) {
				this.attacks.splice(index, 1);
				continue;
			}
			const zone = this.city.modules[attack.target]!;
			const building = this.buildingAt(attack.target);
			const safehouse = building === "safehouse" ? BUILDING_EFFECTS.safehouseDefense : 1;
			const defenderBonus = owner === NEUTRAL ? 0 : this.defenseBonus(owner);
			const traitorDefense =
				owner !== NEUTRAL && this.isTraitor(owner) ? DIPLOMACY.traitorDefense : 1;
			const defenseMul =
				(ZONE_DEFENSE[zone] ?? 1) * safehouse * (1 + defenderBonus) * traitorDefense;
			const attackBonus = 1 + this.attackBonus(attack.factionId);
			// Quarter size: a large quarter puts up more resistance.
			const sizeFactor = this.city.size?.[attack.target] ?? 1;
			// **Defense is the defender's army, not an abstract value**: its Members
			// spread over its quarters (OpenFront idea). A neutral quarter holds the
			// standing garrison. Attacking several quarters at once therefore drains
			// the defender's army several times faster — defense finally has a cost.
			const garrison = Math.max(1, this.garrisonAt(attack.target) * defenseMul);
			// Share of the fight the attacker owns: 0.5 at parity. The battle gauge
			// drains fast when you outnumber, slowly when you don't. A small force
			// still creeps forward, so no quarter is ever a hard wall.
			const share = attack.troops / (attack.troops + garrison);
			const damage = Math.max(
				0.25,
				(MAX_DAMAGE_PER_TICK * 2 * attackBonus * share) / sizeFactor,
			);
			const control = this.territory.control[attack.target]! - damage;
			// Both sides pay: the attacker in committed troops (more when
			// outnumbered), the defender in its global army.
			attack.troops = Math.max(0, attack.troops - damage * ATTACK_LOSS * (1 - share) * 2);
			if (owner !== NEUTRAL) {
				const defender = this.factions[owner]!;
				defender.members = Math.max(0, defender.members - damage * DEFENDER_LOSS);
			}

			if (control <= 0) {
				const previous = this.territory.owner[attack.target];
				const destroyed = this.buildingAt(attack.target);
				// Established control ∝ surviving troops: a crushing assault secures
				// more than a costly siege. A target contested by another assault
				// (gang war) stays precarious.
				const survived =
					attack.initialTroops > 0
						? Math.max(0, Math.min(1, attack.troops / attack.initialTroops))
						: 0;
				const contested = this.attacks.some(
					(other) => other !== attack && other.target === attack.target,
				);
				const base = previous === NEUTRAL ? 16 : 10;
				const gain = base + 26 * survived;
				this.territory.owner[attack.target] = attack.factionId;
				this.territory.control[attack.target] = Math.round(
					Math.max(8, Math.min(48, contested ? gain * 0.6 : gain)),
				);
				this.territory.building[attack.target] = NO_BUILDING;
				this.territory.capturedAt[attack.target] = this.tick;
				this.cancelConstruction(attack.target, previous);
				this.addHeat(attack.target, HEAT.capture);
				this.attacks.splice(index, 1);
				this.recount();
				const attacker = this.factions[attack.factionId]!;
				attacker.captures += 1;
				if (previous !== NEUTRAL) {
					const victim = this.factions[previous]!;
					victim.quartersLost += 1;
					if (this.modulesOwned(previous) === 0 && !victim.eliminated) {
						victim.eliminated = true;
						attacker.eliminations += 1;
					}
				}
				const taker = this.factions[attack.factionId]!.name;
				const loser = previous === NEUTRAL ? "neutral" : this.factions[previous]!.name;
				this.pushLog(`${taker} takes a quarter from ${loser}`);
				// Only the **leader's** activity feeds the anti-leader Pressure: the
				// signal must track the faction the police actually hunt, not the
				// total violence of the map. Counting every capture made the leader
				// pay for five other gangs' wars (and liquidated them for it).
				if (attack.factionId === this.police.target) this.police.crime += 1;
				// Loot: buildings are valuable objectives.
				if (destroyed && previous !== NEUTRAL && previous !== attack.factionId) {
					const gained = this.loot(attack.factionId, previous, destroyed);
					if (attack.factionId === this.player.id && (gained.sale || gained.clean || gained.members)) {
						const label = gained.sale
							? `+${Math.round(gained.sale)} dirty`
							: gained.clean
								? `+${Math.round(gained.clean)} clean`
								: `+${Math.round(gained.members)} members`;
						this.float(attack.target, `loot ${label}`, "gain");
					}
				}
				if (attack.factionId === this.player.id) {
					this.events.push("capture");
					this.float(attack.target, "+1 quarter", "gain");
				} else if (previous === this.player.id) {
					this.events.push("lost");
					this.float(attack.target, "−1 quarter", "loss");
				}
			} else if (attack.troops <= 0) {
				this.territory.control[attack.target] = control;
				this.attacks.splice(index, 1);
			} else {
				this.territory.control[attack.target] = control;
			}
		}
	}

	private think(): void {
		for (let i = 0; i < this.factions.length; i += 1) {
			if (this.controlled.has(i)) continue;
			this.aiCooldowns[i] = (this.aiCooldowns[i] ?? 0) - 1;
			if ((this.aiCooldowns[i] ?? 0) > 0) continue;
			this.aiCooldowns[i] = AI_INTERVAL;
			// Housekeeping and war must not compete for the same decision: an AI
			// that spends its turn building never attacks, and is permanently on
			// the back foot. So these are all *additive* — the assault below always
			// gets its chance.
			this.aiDiplomacy(i);
			this.aiDefend(i);
			if (this.rng() < 0.4) this.aiBuild(i);

			// Tech: levels up a branch if a Workshop allows it.
			if (this.rng() < 0.3) {
				for (const branch of TECH_BRANCHES) {
					if (this.upgradeTech(i, branch)) break;
				}
			}
			// Defensive corruption: the targeted leader bribes the police if it can afford it.
			if (
				this.police.target === i &&
				this.police.pressure >= POLICE.multiThreshold &&
				this.canCorrupt(i)
			) {
				this.corruptPolice(i);
			}
			if (this.rng() < 0.3) this.aiOperate(i);
			if (this.rng() < 0.2) this.aiIntercept(i);
			if (this.rng() < 0.15) this.aiStrike(i);
			// Push a couple of fronts. The first is **force concentration**: reinforce
			// the ongoing assault before opening a new one. The rest expand the war.
			const pushed = new Set<number>();
			for (let push = 0; push < AI_FRONTS; push += 1) {
				// Keep a reserve: the pool you commit is the pool that is not defending.
				if (this.committedShare(i) > AI_MAX_COMMIT) break;
				const active = this.attacks.find(
					(attack) => attack.factionId === i && !pushed.has(attack.target),
				);
				const focus =
					active && this.canAttack(i, active.target)
						? active.target
						: this.pickAiTarget(i);
				if (focus === null || pushed.has(focus)) break;
				pushed.add(focus);
				if (!this.attackFrom(i, focus)) break;
			}
		}
	}

	private aiStrike(factionId: number): boolean {
		for (let i = 0; i < this.territory.count; i += 1) {
			if (!this.canAttack(factionId, i)) continue;
			if (!this.canStrike(factionId, i)) continue;
			this.launchStrike(factionId, i);
			return true;
		}
		return false;
	}

	private aiBuild(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		if (this.activeConstructions(factionId) >= BUILD_CREWS) return false;
		const counts = this.buildingCounts(factionId);
		const owned = this.modulesOwned(factionId);
		// Bootstrap: as long as a chain step is missing, build only that.
		const bootstrap = missingEconomyStep(counts, (t) =>
			this.canAfford(faction, t, CONVERSION_COST),
		);
		// Save up for the missing chain step instead of building filler.
		if (bootstrap === null && chainIncomplete(counts)) return false;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.owner[i] !== factionId) continue;
			if (this.territory.building[i] !== NO_BUILDING) continue;
			if (this.territory.construction[i]! > 0) continue;
			const zone = this.city.modules[i]!;
			const type = chooseBuildType(
				counts,
				owned,
				(t) =>
					this.canAfford(faction, t, this.buildCostFactor(factionId, i, t)) &&
					canBuildInZone(zone, t) &&
					(bootstrap === null || t === bootstrap),
				{ workshop: TECH.maxLevel },
			);
			if (type === null) continue;
			this.startBuild(factionId, i, type);
			return true;
		}
		return false;
	}

	/** Reactive defense: places a Safehouse on an attacked, empty owned quarter. */
	private aiDefend(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		if (!this.attacks.length) return false;
		// We don't sacrifice the economic bootstrap: a complete chain is required.
		if (
			this.buildingCount(factionId, "lab") === 0 ||
			this.buildingCount(factionId, "storefront") === 0
		) {
			return false;
		}
		for (const attack of this.attacks) {
			const target = attack.target;
			if (this.territory.owner[target] !== factionId) continue;
			if (this.territory.building[target] !== NO_BUILDING) continue;
			if (this.territory.construction[target]! > 0) continue;
			if (!canBuildInZone(this.city.modules[target]!, "safehouse")) continue;
			if (!this.canAfford(faction, "safehouse", this.buildCostFactor(factionId, target, "safehouse"))) return false;
			this.startBuild(factionId, target, "safehouse");
			return true;
		}
		return false;
	}

	/** AI operations: bust of an enemy building (gated by Armament). */
	private aiOperate(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		if (faction.bustCooldown > 0) return false;
		// We don't launch operations before having an established economy and a surplus.
		if (this.buildingCount(factionId, "lab") === 0 || this.buildingCount(factionId, "storefront") === 0) {
			return false;
		}
		if (faction.dirtyCash < 6000) return false;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (!this.canAttack(factionId, i)) continue;
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL || owner === factionId) continue;
			const type = this.buildingAt(i);
			if (!type) continue;
			if (this.guardedBy(owner, i) > 0) continue;
			if (
				faction.tech.armament >= BUST.requiredArmament &&
				faction.dirtyCash >= BUST.costSale &&
				faction.members >= BUST.costMembers
			) {
				faction.dirtyCash -= BUST.costSale;
				faction.members -= BUST.costMembers;
				faction.bustCooldown = BUST.cooldownTicks;
				this.loot(factionId, owner, type);
				this.addHeat(i, HEAT.operation);
				if (owner === this.player.id) {
					this.events.push("bust");
					this.float(i, "enemy bust", "loss");
					this.pushLog(`Enemy bust (module ${i})`);
				}
				return true;
			}
		}
		return false;
	}

	/** AI interception: diverts an adjacent enemy convoy. */
	private aiIntercept(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		if (faction.interceptCooldown > 0) return false;
		if (faction.tech.armament < INTERCEPT.requiredArmament) return false;
		if (faction.members < INTERCEPT.costMembers) return false;
		for (let i = 0; i < this.territory.count; i += 1) {
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL || owner === factionId) continue;
			if (!this.canAttack(factionId, i)) continue;
			const route = this.convoyTo(i);
			if (!route || route.cargo <= 0) continue;
			faction.members -= INTERCEPT.costMembers;
			faction.interceptCooldown = INTERCEPT.cooldownTicks;
			this.takeCargo(faction, route);
			this.addHeat(i, HEAT.operation);
			if (owner === this.player.id) {
				this.events.push("intercept");
				this.float(i, "convoy intercepted", "loss");
				this.pushLog(`Convoy intercepted (module ${i})`);
			}
			return true;
		}
		return false;
	}

	private pickAiTarget(factionId: number): number | null {
		const faction = this.factions[factionId]!;
		// Paid contract: focus the offensive on the designated target.
		const contract = faction.contractUntil > this.tick ? faction.contractTarget : -1;
		const leader = this.police.target;
		// Anti-snowball: a fraction of decisions target the leader, ∝ its domination.
		const focusChance =
			leader >= 0 && leader !== factionId
				? Math.max(0, this.controlRatio(leader) - DIPLOMACY.coalitionFloor) *
					DIPLOMACY.leaderFocus
				: 0;
		const focusLeader = focusChance > 0 && this.rng() < focusChance;

		// Battle royale: finish off the weak so a game concludes.
		let weakest = -1;
		let weakestOwned = Number.POSITIVE_INFINITY;
		for (const faction of this.factions) {
			if (faction.id === factionId || faction.id === leader) continue;
			const owned = this.modulesOwned(faction.id);
			if (owned > 0 && owned < weakestOwned) {
				weakestOwned = owned;
				weakest = faction.id;
			}
		}

		let best: number | null = null;
		let bestScore = Number.POSITIVE_INFINITY;
		let bestLeader: number | null = null;
		let bestLeaderScore = Number.POSITIVE_INFINITY;
		let bestWeak: number | null = null;
		let bestWeakScore = Number.POSITIVE_INFINITY;
		let bestContract: number | null = null;
		let bestContractScore = Number.POSITIVE_INFINITY;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (!this.canAttack(factionId, i)) continue;
			const owner = this.territory.owner[i]!;
			if (owner !== NEUTRAL && this.hasPact(factionId, owner)) continue;
			const score = this.territory.control[i]! + (this.rng() - 0.5) * 10;
			if (score < bestScore) {
				bestScore = score;
				best = i;
			}
			if (owner === leader && leader !== factionId && score < bestLeaderScore) {
				bestLeaderScore = score;
				bestLeader = i;
			}
			if (owner === weakest && score < bestWeakScore) {
				bestWeakScore = score;
				bestWeak = i;
			}
			if (owner === contract && score < bestContractScore) {
				bestContractScore = score;
				bestContract = i;
			}
		}
		if (bestContract !== null) return bestContract;
		if (focusLeader && bestLeader !== null) return bestLeader;
		// Elimination priority: finish off the weakest rival if in range.
		if (bestWeak !== null && this.rng() < 0.6) return bestWeak;
		return best;
	}

	private recount(): void {
		const hour = this.hourOfDay();
		for (let f = 0; f < this.factions.length; f += 1) {
			const c = this.counts[f]!;
			c.housing = 0;
			c.lab = 0;
			c.storefront = 0;
			c.front = 0;
			c.safehouse = 0;
			c.depot = 0;
			c.workshop = 0;
			c.counter = 0;
			this.owned[f] = 0;
			this.recruitDemand[f] = 0;
			this.housingDemand[f] = 0;
			this.retailDemand[f] = 0;
			this.retailWeighted[f] = 0;
			this.launderWealth[f] = 0;
			this.labWeight[f] = 0;
		}
		for (let i = 0; i < this.territory.count; i += 1) {
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL) continue;
			this.owned[owner] = (this.owned[owner] ?? 0) + 1;
			// Local market: demand (clientele) and wealth (price) of the quarter.
			const demand = this.city.demand[i] ?? 1;
			const wealth = this.city.wealth[i] ?? 1;
			const zone = this.city.modules[i]!;
			this.recruitDemand[owner] = (this.recruitDemand[owner] ?? 0) + demand;
			const buildIndex = this.territory.building[i]!;
			if (buildIndex === NO_BUILDING) continue;
			const type = BUILDING_TYPES[buildIndex];
			if (!type) continue;
			this.counts[owner]![type] += 1;
			// Zone bonus: the building produces more in a favorable zone.
			// Rush hour: yield follows the in-game hour (average 1/day).
			const bonus = zoneBuildBonus(zone, type) * zoneTimeFactor(zone, type, hour);
			if (type === "housing") {
				this.housingDemand[owner] = (this.housingDemand[owner] ?? 0) + demand * bonus;
			}
			if (type === "lab") this.labWeight[owner] = (this.labWeight[owner] ?? 0) + bonus;
			if (type === "storefront") {
				this.retailDemand[owner] = (this.retailDemand[owner] ?? 0) + demand * bonus;
				this.retailWeighted[owner] =
					(this.retailWeighted[owner] ?? 0) + demand * wealth * bonus;
			}
			if (type === "front") {
				this.launderWealth[owner] = (this.launderWealth[owner] ?? 0) + wealth * bonus;
			}
		}
		for (const faction of this.factions) {
			// Elimination is decided by the map, not by *how* the quarters were
			// lost: an encirclement or a police raid can zero a faction out without
			// going through the assault path. Without this it lingers forever as an
			// inert zombie that still gets an AI turn every 2.5 s.
			if ((this.owned[faction.id] ?? 0) === 0) faction.eliminated = true;
			const c = this.counts[faction.id]!;
			faction.housing = c.housing;
			faction.buildings =
				c.housing +
				c.lab +
				c.storefront +
				c.front +
				c.safehouse +
				c.depot +
				c.workshop +
				c.counter;
		}
		this.updateSupply();
	}

	/** Breadth-first traversal of owned quarters from `sourceType` buildings. */
	private reachableFrom(
		factionId: number,
		sourceType: number,
	): { reached: Uint8Array; origin: Int32Array } {
		const count = this.territory.count;
		const reached = new Uint8Array(count);
		const origin = new Int32Array(count).fill(-1);
		const queue: number[] = [];
		for (let i = 0; i < count; i += 1) {
			if (this.territory.owner[i] === factionId && this.territory.building[i] === sourceType) {
				reached[i] = 1;
				origin[i] = i;
				queue.push(i);
			}
		}
		for (let head = 0; head < queue.length; head += 1) {
			const module = queue[head]!;
			for (const neighbor of this.neighbors(module)) {
				if (this.territory.owner[neighbor] !== factionId || reached[neighbor]) continue;
				reached[neighbor] = 1;
				origin[neighbor] = origin[module]!;
				queue.push(neighbor);
			}
		}
		return { reached, origin };
	}

	/** Supply lines: Lab → Storefront → Front, through owned quarters. */
	private updateSupply(): void {
		const count = this.territory.count;
		// Topology only changes on captures/upgrades: skip the BFS otherwise.
		let signature = 2166136261;
		for (let i = 0; i < count; i += 1) {
			signature = Math.imul(signature ^ (this.territory.owner[i]! + 7), 16777619);
			signature = Math.imul(signature ^ (this.territory.building[i]! + 13), 16777619);
		}
		signature >>>= 0;
		if (signature === this.supplySignature) return;
		this.supplySignature = signature;

		// Rebuild the routes but keep whatever cargo is already on the road.
		const carried = new Map<string, ConvoyRoute>();
		for (const route of this.convoys) carried.set(convoyKey(route), route);
		this.convoys = [];
		const addRoute = (route: Pick<ConvoyRoute, "factionId" | "from" | "to" | "kind">): void => {
			const previous = carried.get(convoyKey(route));
			this.convoys.push({ ...route, cargo: previous?.cargo ?? 0, progress: previous?.progress ?? 0 });
		};
		for (const faction of this.factions) {
			const id = faction.id;
			const lab = this.reachableFrom(id, BUILDING_INDEX.lab);
			const storefront = this.reachableFrom(id, BUILDING_INDEX.storefront);
			let totalDemand = 0;
			let suppliedDemand = 0;
			let totalWealth = 0;
			let suppliedWealth = 0;
			let routes = 0;
			for (let i = 0; i < count; i += 1) {
				if (this.territory.owner[i] !== id) continue;
				const building = this.territory.building[i]!;
				const demand = this.city.demand[i] ?? 1;
				const wealth = this.city.wealth[i] ?? 1;
				if (building === BUILDING_INDEX.storefront) {
					totalDemand += demand;
					if (lab.reached[i]) suppliedDemand += demand;
				} else if (building === BUILDING_INDEX.front) {
					totalWealth += wealth;
					if (storefront.reached[i]) suppliedWealth += wealth;
				}
				if (routes >= MAX_CONVOY_ROUTES) continue;
				if (building === BUILDING_INDEX.storefront && lab.origin[i]! >= 0 && lab.origin[i] !== i) {
					addRoute({ factionId: id, from: lab.origin[i]!, to: i, kind: "product" });
					routes += 1;
				} else if (
					building === BUILDING_INDEX.front &&
					storefront.origin[i]! >= 0 &&
					storefront.origin[i] !== i
				) {
					addRoute({ factionId: id, from: storefront.origin[i]!, to: i, kind: "cash" });
					routes += 1;
				}
			}
			this.retailSupply[id] = totalDemand > 0 ? suppliedDemand / totalDemand : 1;
			this.launderSupply[id] = totalWealth > 0 ? suppliedWealth / totalWealth : 1;
		}
	}

	/** Current convoys (visible logistics). */
	convoyRoutes(): readonly ConvoyRoute[] {
		return this.convoys;
	}

	/** Share of retail connected to a Lab (0–1). */
	retailSupplyRatio(factionId: number): number {
		return this.retailSupply[factionId] ?? 1;
	}

	/** Number of factions still in play (≥ 1 quarter). */
	aliveCount(): number {
		let alive = 0;
		for (const faction of this.factions) {
			if ((this.owned[faction.id] ?? 0) > 0) alive += 1;
		}
		return alive;
	}

	/**
	 * Faction power (battle royale standings):
	 * quarters first, then Members, then Clean cash — deterministic tiebreak.
	 */
	score(factionId: number): number {
		const faction = this.factions[factionId]!;
		return this.modulesOwned(factionId) * 1e6 + faction.members + faction.cleanCash * 1e-3;
	}

	/** Deterministic power ranking (quarters, members, cash, id). */
	/** Player rank (1 = leader). */
	playerRank(): number {
		return this.rankings().indexOf(this.player.id) + 1;
	}

	/** Ticks remaining before bankruptcy (0 if not overdrawn). */
	bankruptcyTicksLeft(): number {
		if (this.brokeTicks <= 0) return 0;
		return Math.max(0, BANKRUPT_TICKS - this.brokeTicks);
	}

	rankings(): number[] {
		return this.factions
			.map((faction) => faction.id)
			.sort((a, b) => {
				const byQuarters = this.modulesOwned(b) - this.modulesOwned(a);
				if (byQuarters !== 0) return byQuarters;
				const byMembers = this.factions[b]!.members - this.factions[a]!.members;
				if (byMembers !== 0) return byMembers;
				const byCash = this.factions[b]!.cleanCash - this.factions[a]!.cleanCash;
				if (byCash !== 0) return byCash;
				return a - b;
			});
	}

	summary(factionId = this.player.id): FactionSummary {
		const faction = this.factions[factionId]!;
		const rank = this.rankings().indexOf(factionId) + 1;
		return {
			control: this.controlRatio(factionId),
			quarters: this.modulesOwned(factionId),
			cleanCash: faction.cleanCash,
			captures: faction.captures,
			eliminations: faction.eliminations,
			raidsSuffered: faction.raidsSuffered,
			seizures: faction.seizures,
			eliminated: faction.eliminated,
			score: this.score(factionId),
			rank,
		};
	}

	/**
	 * Serializable game briefing (seed for multi/replay): objective, progress
	 * and rank. No UI dependency, JSON-transportable.
	 */
	briefing(factionId = this.player.id): Briefing {
		const summary = this.summary(factionId);
		return {
			map: "paris",
			alive: this.aliveCount(),
			control: summary.control,
			clean: summary.cleanCash,
			rank: summary.rank,
			done: this.outcome === "victory",
		};
	}

	/** Upkeep: each building costs Dirty cash/tick. Unpaid → slow. */
	private payUpkeep(): void {
		for (const faction of this.factions) {
			if (faction.armamentUntil <= this.tick) faction.armamentLevel = 0;
			const counts = this.counts[faction.id]!;
			let upkeep = 0;
			for (const type of BUILDING_TYPES) upkeep += counts[type]! * BUILDING_UPKEEP[type];
			faction.upkeep = upkeep;
			if (upkeep <= 0) {
				faction.upkeepPaid = true;
				faction.guardsPaid = true;
				continue;
			}
			if (faction.dirtyCash >= upkeep) {
				faction.dirtyCash -= upkeep;
				faction.upkeepPaid = true;
				faction.guardsPaid = true;
			} else {
				faction.upkeepPaid = false;
				faction.guardsPaid = false;
			}
		}
	}

	/** Production multiplier: 1 if upkeep is paid, otherwise 0.5. */
	private upkeepFactor(factionId: number): number {
		return this.factions[factionId]!.upkeepPaid ? 1 : UNPAID_UPKEEP_FACTOR;
	}

	/** Current upkeep of a faction (Dirty cash/tick) — for the UI. */
	upkeepPerTick(factionId = this.player.id): number {
		return this.factions[factionId]?.upkeep ?? 0;
	}

	private updateTreasury(): void {
		const player = this.player;
		if (player.cleanCash <= 0 && player.dirtyCash <= 0) {
			this.brokeTicks += 1;
		} else {
			this.brokeTicks = 0;
		}
	}

	/** Battle royale: victory for the last survivor, causal defeats. */
	private checkOutcome(): void {
		const playerModules = this.modulesOwned(this.player.id);
		if (playerModules === 0) {
			this.outcome = "defeat";
			this.endReason = "Your cartel has been eliminated.";
			return;
		}
		if (this.aliveCount() === 1) {
			this.outcome = "victory";
			this.endReason = "Last cartel standing — the city is yours.";
			return;
		}
		if (this.brokeTicks >= BANKRUPT_TICKS) {
			this.outcome = "defeat";
			this.endReason = "Bankruptcy: out of cash for too long.";
		}
	}

	private pushLog(message: string): void {
		this.log.push(message);
		if (this.log.length > 8) this.log.shift();
	}

	/**
	 * One spawn per faction. The map ships fewer spawns than the faction count
	 * (Paris ships 4, the game plays 6), so the extras are derived
	 * deterministically: the built quarters farthest from every spawn already
	 * taken. Without this the extra gangs start with **zero** quarter — dead on
	 * arrival, and the game silently plays 4 cartels instead of 6.
	 */
	private pickSpawns(count: number): number[] {
		const chosen = this.city.spawns.slice(0, count);
		const built = this.city.modules
			.map((zone, index) => ({ zone, index }))
			.filter(({ zone }) => BUILT_ZONES.includes(zone))
			.map(({ index }) => index);
		const distance = (a: number, b: number): number => {
			const from = PARIS_CENTROIDS[a];
			const to = PARIS_CENTROIDS[b];
			if (!from || !to) return 0;
			return (from[0] - to[0]) ** 2 + (from[1] - to[1]) ** 2;
		};
		while (chosen.length < count && built.length > 0) {
			let best = -1;
			let bestDistance = -1;
			for (const candidate of built) {
				if (chosen.includes(candidate)) continue;
				const nearest = Math.min(...chosen.map((c) => distance(c, candidate)));
				if (nearest > bestDistance) {
					bestDistance = nearest;
					best = candidate;
				}
			}
			if (best < 0) break;
			chosen.push(best);
		}
		return chosen;
	}

	/** Neighbors of a quarter (adjacency provided by the map). */
	private neighbors(module: number): readonly number[] {
		return this.city.neighbors[module] ?? EMPTY_NEIGHBORS;
	}
}
