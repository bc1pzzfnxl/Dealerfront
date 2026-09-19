/**
 * World — simulation DealerFront (god view).
 * Quartiers (propriété + contrôle + bâtiment), factions (Membres + économie),
 * bagarres, IA. Pur, déterministe, pas fixe 10 Hz.
 * Voir docs/territory.md, docs/economy.md, docs/combat.md.
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
	CONVERSION_COST,
	missingEconomyStep,
	type BuildingType,
	NO_BUILDING,
	ZONE_BUILDINGS,
} from "./buildings";
import { generateCity } from "./city";
import { MODULES_H, MODULES_W, MODULE_SIZE, SIM_HZ } from "./constants";
import { createFactions, FACTION_COUNT, type Faction } from "./factions";
import { createRng, type Rng } from "./rng";
import { HITMAN, TECH, TECH_BRANCHES, type TechBranch, techCost } from "./tech";
import { CONTACT_NAMES, POLICE, policeTier, type PoliceState, type PoliceTier } from "./police";
import {
	DIPLOMACY,
	EMBARGO,
	type Embargo,
	type Pact,
	type PactOffer,
} from "./diplomacy";
import { createTerritory, NEUTRAL, neighborsOf, type Territory } from "./territory";
import type { Archetype, CityGrid, ZoneType } from "./types";

const NEUTRAL_GARRISON = 60;
const CAPTURE_CONTROL = 30;
const START_MEMBERS = 3000;
const COMMIT_RATIO = 0.2;
const DAMAGE_PER_TROOP = 0.0004;
/** Plafond de dégâts par tick : empêche les prises instantanées (sièges obligatoires). */
const MAX_DAMAGE_PER_TICK = 5;
const ATTACK_LOSS = 8;
const CONTROL_REGEN = 1.2;
/** Assauts simultanés max par faction : pas de « clique-partout ». */
const MAX_ASSAULTS = 3;
const AI_INTERVAL = 25;
const MIN_COMMIT = 400;
/** Raid : affaiblit un quartier adjacent sans le capturer. */
const RAID = { costSale: 2500, costMembers: 800, control: 35, cooldownTicks: 300 } as const;

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

/** Fin de partie (docs/win-conditions.md). */
const SESSION_TICKS = 15000; // 25 min à 10 Hz
const VICTORY_CONTROL = 0.6;
const CLEAN_GOAL = 500000;
const BANKRUPT_TICKS = 300; // 30 s
const OVERTIME_ENABLED = false;
const OVERTIME_DROP_PER_MIN = 0.02;

export interface WorldOptions {
	/** Durée de session en ticks (défaut 25 min). */
	timeLimitTicks?: number;
	/** Overtime : le seuil de contrôle baisse après l'échéance. */
	overtime?: boolean;
}

export interface FactionSummary {
	control: number;
	quarters: number;
	cashPropre: number;
	captures: number;
	eliminations: number;
	raidsSuffered: number;
	seizures: number;
	eliminated: boolean;
	score: number;
	rank: number;
}

function emptyCounts(): Record<BuildingType, number> {
	return {
		logement: 0,
		labo: 0,
		vente: 0,
		facade: 0,
		planque: 0,
		depot: 0,
		atelier: 0,
		contre: 0,
	};
}

export interface Attack {
	factionId: number;
	target: number;
	troops: number;
}

export type Outcome = null | "victory" | "defeat";

/** Événements **du joueur** (retour audio/UX), drainés par l'IHM. */
export type GameEvent =
	| "attack"
	| "capture"
	| "lost"
	| "raid"
	| "hitman"
	| "tech"
	| "pact"
	| "betray"
	| "embargo"
	| "corrupt"
	| "build"
	| "victory"
	| "defeat";

export class World {
	readonly city: CityGrid;
	readonly territory: Territory;
	readonly factions: Faction[];
	readonly attacks: Attack[] = [];
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
	/** Événements joueur en attente d'être consommés par l'IHM. */
	private readonly events: GameEvent[] = [];
	private outcomeRecorded = false;
	/** Index du contact corrompu courant (change s'il est grillé). */
	private contactIndex: number;
	tick = 0;
	outcome: Outcome = null;
	endReason = "";
	/** Durée de session en ticks (échéance). */
	readonly timeLimitTicks: number;

	private readonly rng: Rng;
	private readonly overtime: boolean;
	private brokeTicks = 0;
	private readonly aiCooldowns: number[] = [];
	/** Relations symétriques par paire (0–100). */
	private relations: number[][] = [];
	/** Cooldown de proposition de pacte par paire (tick). */
	private proposalCooldown: number[][] = [];
	/** Quartiers attaqués ce tick (réutilisé, évite une allocation par tick). */
	private readonly underAttack = new Set<number>();
	/** Comptage des bâtiments par faction (recalculé une fois par tick). */
	private counts: Array<Record<BuildingType, number>> = [];
	/** Quartiers possédés par faction (recalculé une fois par tick). */
	private owned: number[] = [];

	constructor(seed: number, archetype?: Archetype, options?: WorldOptions) {
		this.city = generateCity(seed, archetype);
		this.territory = createTerritory(this.city.modules.length);
		this.factions = createFactions(FACTION_COUNT, START_MEMBERS);
		this.rng = createRng((seed ^ 0x9e3779b9) >>> 0);
		this.timeLimitTicks = options?.timeLimitTicks ?? SESSION_TICKS;
		this.overtime = options?.overtime ?? OVERTIME_ENABLED;
		this.contactIndex = seed % CONTACT_NAMES.length;

		this.territory.control.fill(NEUTRAL_GARRISON);
		const spawns = this.spawnModules(this.factions.length);
		// Spawn toujours constructible : on force une zone « bâtie » sur chaque spawn.
		const modules = this.city.modules as ZoneType[];
		spawns.forEach((module, index) => {
			if (!BUILT_ZONES.includes(modules[module]!)) {
				modules[module] = BUILT_ZONES[index % BUILT_ZONES.length]!;
			}
		});
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
		this.recount();
	}

	get player(): Faction {
		return this.factions[0]!;
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
		const housing = this.buildingCount(factionId, "logement");
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
		const owned = this.modulesOwned(factionId);
		const housing = this.buildingCount(factionId, "logement");
		const max = this.maxMembers(factionId);
		if (faction.members >= max) return 0;
		const logistique = 1 + TECH.logistiqueProduction * faction.tech.logistique;
		return (
			(BUILDING_EFFECTS.baseMembersPerQuarter * owned +
				BUILDING_EFFECTS.membersPerLogement * housing) *
			(1 - faction.members / max) *
			logistique
		);
	}

	attackBonus(factionId: number): number {
		return TECH.attackPerLevel * this.factions[factionId]!.tech.armement;
	}

	private defenseBonus(factionId: number): number {
		return TECH.defensePerLevel * this.factions[factionId]!.tech.protection;
	}

	/** Niveau de tech max débloqué par les Ateliers. */
	maxTechLevel(factionId: number): number {
		return Math.min(TECH.maxLevel, this.buildingCount(factionId, "atelier"));
	}

	canUpgradeTech(factionId: number, branch: TechBranch): boolean {
		if (this.outcome !== null) return false;
		const faction = this.factions[factionId]!;
		const level = faction.tech[branch];
		if (level >= this.maxTechLevel(factionId)) return false;
		return faction.cashPropre >= techCost(level + 1);
	}

	private upgradeTech(factionId: number, branch: TechBranch): boolean {
		if (!this.canUpgradeTech(factionId, branch)) return false;
		const faction = this.factions[factionId]!;
		const level = faction.tech[branch];
		faction.cashPropre -= techCost(level + 1);
		faction.tech[branch] = level + 1;
		this.pushLog(`Tech ${branch} → ${level + 1}`);
		if (factionId === this.player.id) this.events.push("tech");
		return true;
	}

	playerUpgradeTech(branch: TechBranch): boolean {
		if (this.outcome !== null) return false;
		return this.upgradeTech(this.player.id, branch);
	}

	canHitman(factionId: number, module: number): boolean {
		if (this.outcome !== null) return false;
		const owner = this.territory.owner[module];
		if (owner === factionId || owner === NEUTRAL) return false;
		const faction = this.factions[factionId]!;
		if (faction.tech.armement < HITMAN.requiredArmement) return false;
		if (faction.hitmanCooldown > 0) return false;
		return faction.cashPropre >= HITMAN.costClean && faction.members >= HITMAN.costMembers;
	}

	playerCanHitman(module: number): boolean {
		return this.canHitman(this.player.id, module);
	}

	/** Tueur à gage : affaiblit un quartier ennemi et ses voisins (ne capture pas). */
	playerHitman(module: number): boolean {
		if (!this.canHitman(this.player.id, module)) return false;
		this.player.hitmanCooldown = HITMAN.cooldownTicks;
		this.events.push("hitman");
		this.payHitman(this.player.id);
		this.applyHitman(this.player.id, module);
		this.pushLog(`Tueur à gage envoyé (module ${module})`);
		return true;
	}

	private payHitman(factionId: number): void {
		const faction = this.factions[factionId]!;
		faction.cashPropre -= HITMAN.costClean;
		faction.members -= HITMAN.costMembers;
	}

	private applyHitman(factionId: number, module: number): void {
		const targets = [module, ...neighborsOf(module)];
		for (const target of targets) {
			const owner = this.territory.owner[target];
			if (owner === factionId || owner === NEUTRAL) continue;
			const reduction = Math.min(
				HITMAN.contreReductionMax,
				this.buildingCount(owner, "contre") * HITMAN.contreReductionPerUnit,
			);
			const base = target === module ? HITMAN.damageCenter : HITMAN.damageSplash;
			this.territory.control[target] = Math.max(
				5,
				this.territory.control[target]! - base * (1 - reduction),
			);
			if (this.territory.building[target] !== NO_BUILDING) {
				this.territory.building[target] = NO_BUILDING;
				this.recount();
			}
			this.cancelConstruction(target);
		}
	}

	/** Faction au plus fort nombre de quartiers (le « leader »), -1 si aucune. */
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
		return this.factions[factionId]!.cashPropre >= this.corruptionCost(factionId);
	}

	playerCanCorrupt(): boolean {
		return this.canCorrupt(this.player.id);
	}

	/** Corruption : paie pour faire baisser la Pression (risque de contact grillé). */
	private corruptPolice(factionId: number): boolean {
		if (!this.canCorrupt(factionId)) return false;
		const faction = this.factions[factionId]!;
		faction.cashPropre -= this.corruptionCost(factionId);
		faction.corruptionUses += 1;
		if (this.rng() < POLICE.corruptionBurnChance) {
			this.police.pressure = Math.min(
				POLICE.max,
				this.police.pressure + POLICE.corruptionBurnBacklash,
			);
			this.contactIndex = (this.contactIndex + 1) % CONTACT_NAMES.length;
			this.pushLog(`Contact grillé (${faction.name}) — nouveau contact : ${this.contactName}`);
			if (faction.isPlayer) this.events.push("corrupt");
			return true;
		}
		this.police.pressure = Math.max(0, this.police.pressure - POLICE.corruptionReduction);
		this.police.window = POLICE.corruptionWindow;
		this.pushLog(`${this.contactName} fait baisser la Pression (${faction.name})`);
		if (faction.isPlayer) this.events.push("corrupt");
		return true;
	}

	playerCorrupt(): boolean {
		return this.corruptPolice(this.player.id);
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

	/** Offres de pacte en attente adressées au joueur. */
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
		this.pushLog(`${this.factions[from]!.name} propose un pacte à ${this.factions[to]!.name}`);
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
			this.pushLog(`Pacte refusé (${this.factions[from]!.name})`);
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

	/** Embargo : blocus marché, rompt un éventuel pacte (trahison). */
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
		// Purge les offres de pacte en attente entre les deux.
		for (let i = this.offers.length - 1; i >= 0; i -= 1) {
			const offer = this.offers[i]!;
			if (
				(offer.from === this.player.id && offer.to === factionId) ||
				(offer.from === factionId && offer.to === this.player.id)
			) {
				this.offers.splice(i, 1);
			}
		}
		this.pushLog(`Embargo déclaré sur ${this.factions[factionId]!.name}`);
		this.events.push("embargo");
		return true;
	}

	/** Trahison : rompt le pacte avec une faction et subit la pénalité. */
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
		this.pushLog(`Pacte ${this.factions[a]!.name} ↔ ${this.factions[b]!.name}`);
	}

	private betray(traitor: number, victim: number): void {
		this.dropRelation(traitor, victim, DIPLOMACY.betrayalRelationHit);
		this.factions[traitor]!.traitorUntil = this.tick + DIPLOMACY.traitorTicks;
		this.pushLog(`${this.factions[traitor]!.name} trahit ${this.factions[victim]!.name}`);
	}

	/** Réagit à une attaque : trahison si allié, sinon chute de relation. */
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

	private updatePolice(): void {
		const state = this.police;
		if (state.cooldown > 0) state.cooldown -= 1;
		if (state.window > 0) state.window -= 1;

		const leader = this.findLeader();
		state.target = leader;
		const modules = this.city.modules.length;
		const leaderShare = leader >= 0 ? (this.owned[leader] ?? 0) / modules : 0;
		const fair = 1 / this.factions.length;
		const excess = Math.max(0, leaderShare - fair);

		let delta =
			POLICE.excessWeight * excess + POLICE.crimeWeight * state.crime - POLICE.baseDecay;
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

	private highestControlModules(factionId: number, count: number): number[] {
		const owned: number[] = [];
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.owner[i] === factionId) owned.push(i);
		}
		owned.sort((a, b) => {
			const diff = this.territory.control[b]! - this.territory.control[a]!;
			return diff !== 0 ? diff : a - b;
		});
		return owned.slice(0, count);
	}

	/** Raid : retire du Contrôle (et détruit les bâtiments) au leader. */
	private policeRaid(leader: number): void {
		const state = this.police;
		const multiple = state.pressure >= POLICE.multiThreshold;
		const targets = this.highestControlModules(
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
			leaderFaction.cashPropre *= 1 - POLICE.seizureRatio;
			leaderFaction.seizures += 1;
		}
		state.cooldown = POLICE.raidCooldown;
		state.lastRaidTick = this.tick;
		state.raids += 1;
		this.pushLog(`Raid police sur ${this.factions[leader]!.name} (${targets.length})`);
	}

	/** Liquidation : défaite du joueur, ou démantèlement d'un gang IA dominant. */
	private policeLiquidation(leader: number): void {
		const faction = this.factions[leader]!;
		this.police.liquidations += 1;
		if (faction.isPlayer) {
			this.outcome = "defeat";
			this.endReason = "Liquidation policière : votre cartel est tombé.";
			this.pushLog("Liquidation policière du Cartel");
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
		this.pushLog(`${faction.name} démantelé par la police`);
	}

	canAttack(factionId: number, module: number): boolean {
		if (this.territory.owner[module] === factionId) return false;
		return neighborsOf(module).some((neighbor) => this.territory.owner[neighbor] === factionId);
	}

	playerAttack(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		if (!this.attackFrom(this.player.id, module)) return false;
		this.events.push("attack");
		return true;
	}

	playerCanAttack(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		return Math.floor(this.player.members * COMMIT_RATIO) >= MIN_COMMIT;
	}

	/** Le joueur peut-il construire `type` sur ce quartier ? */
	playerCanBuild(module: number, type: BuildingType): boolean {
		if (this.outcome !== null) return false;
		if (this.territory.owner[module] !== this.player.id) return false;
		if (this.territory.building[module] !== NO_BUILDING) return false;
		if (this.territory.construction[module]! > 0) return false;
		if (!canBuildInZone(this.city.modules[module]!, type)) return false;
		return this.canAfford(this.player, type, this.buildCostFactor(module));
	}

	/** Types de bâtiments convertibles sur ce quartier (selon sa zone). */
	allowedBuildings(module: number): readonly BuildingType[] {
		return ZONE_BUILDINGS[this.city.modules[module]!];
	}

	canBuildInZone(module: number, type: BuildingType): boolean {
		return canBuildInZone(this.city.modules[module]!, type);
	}

	/** Abordabilité indépendante de la zone (choix du type avant le module). */
	playerCanAfford(type: BuildingType): boolean {
		// Coût optimiste : une conversion coûte moitié prix.
		return this.canAfford(this.player, type, CONVERSION_COST);
	}

	playerBuild(module: number, type: BuildingType): boolean {
		if (!this.playerCanBuild(module, type)) return false;
		const conversion = this.isConversion(module);
		this.startBuild(this.player.id, module, type);
		this.pushLog(
			conversion
				? `${BUILDINGS[type].label} aménagé (module ${module})`
				: `Chantier ${BUILDINGS[type].label} (module ${module})`,
		);
		this.events.push("build");
		return true;
	}

	/** Multiplicateur de défense d'un quartier (zone, planque, tech, traître). */
	defenseAt(module: number): number {
		const owner = this.territory.owner[module]!;
		const zone = this.city.modules[module]!;
		const planque =
			this.buildingAt(module) === "planque" ? BUILDING_EFFECTS.planqueDefense : 1;
		const defenderBonus = owner === NEUTRAL ? 0 : this.defenseBonus(owner);
		const traitor = owner !== NEUTRAL && this.isTraitor(owner) ? DIPLOMACY.traitorDefense : 1;
		return (ZONE_DEFENSE[zone] ?? 1) * planque * (1 + defenderBonus) * traitor;
	}

	raidCost(): { sale: number; members: number } {
		return { sale: RAID.costSale, members: RAID.costMembers };
	}

	playerCanRaid(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		if (this.ownerAt(module) === NEUTRAL) return false;
		if (this.player.cashSale < RAID.costSale) return false;
		if (this.player.members < RAID.costMembers) return false;
		return this.player.hitmanCooldown <= 0;
	}

	/** Raid : affaiblit un quartier adjacent (Contrôle + bâtiments) sans le capturer. */
	playerRaid(module: number): boolean {
		if (!this.playerCanRaid(module)) return false;
		this.player.cashSale -= RAID.costSale;
		this.player.members -= RAID.costMembers;
		this.player.hitmanCooldown = RAID.cooldownTicks;
		this.territory.control[module] = Math.max(
			5,
			this.territory.control[module]! - RAID.control,
		);
		this.territory.building[module] = NO_BUILDING;
		this.cancelConstruction(module);
		this.recount();
		this.events.push("hitman");
		this.pushLog(`Raid sur le module ${module}`);
		return true;
	}

	/** Ratio de blanchiment du joueur (0–1). */
	playerLaunderRatio(): number {
		return this.player.launderRatio;
	}

	playerSetLaunderRatio(ratio: number): void {
		this.player.launderRatio = Math.max(0, Math.min(1, ratio));
	}

	/** Consomme les événements joueur accumulés depuis le dernier rendu. */
	drainEvents(): GameEvent[] {
		if (this.events.length === 0) return [];
		return this.events.splice(0, this.events.length);
	}

	/** Nombre d'assauts simultanés autorisés par faction. */
	maxAssaults(): number {
		return MAX_ASSAULTS;
	}

	commitRatio(): number {
		return this.player.attackRatio;
	}

	/** Part des Membres engagée à chaque assaut (0,05–0,6). */
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
		if (spec.costSale && faction.cashSale < spec.costSale * factor) return false;
		if (spec.costClean && faction.cashPropre < spec.costClean * factor) return false;
		return true;
	}

	private pay(faction: Faction, type: BuildingType, factor = 1): void {
		const spec = BUILDINGS[type];
		if (spec.costMembers) faction.members -= spec.costMembers * factor;
		if (spec.costSale) faction.cashSale -= spec.costSale * factor;
		if (spec.costClean) faction.cashPropre -= spec.costClean * factor;
	}

	/** Conversion d'un bâti existant (hors terrain vague) : −50 %, instantanée. */
	isConversion(module: number): boolean {
		return this.city.modules[module] !== "vacant";
	}

	/** Facteur de coût : 0,5 en conversion, 1,0 en construction neuve. */
	buildCostFactor(module: number): number {
		return this.isConversion(module) ? CONVERSION_COST : 1;
	}

	/** Paie puis lance le chantier (conversion = moitié du temps, chantier malgré tout). */
	private startBuild(factionId: number, module: number, type: BuildingType): void {
		this.pay(this.factions[factionId]!, type, this.buildCostFactor(module));
		const ticks = Math.round(
			BUILD_TICKS[type] * (this.isConversion(module) ? CONVERSION_TIME : 1),
		);
		this.territory.pending[module] = BUILDING_INDEX[type];
		this.territory.construction[module] = ticks;
		this.recount();
	}

	/** Interrompt un éventuel chantier (bâtiment détruit, quartier perdu). */
	private cancelConstruction(module: number): void {
		this.territory.construction[module] = 0;
		this.territory.pending[module] = NO_BUILDING;
	}

	/** Avance les chantiers d'un tick ; livre ceux qui arrivent à terme. */
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
		// Pas plus de N assauts simultanés : il faut choisir ses fronts.
		if (this.attacks.filter((attack) => attack.factionId === factionId).length >= MAX_ASSAULTS) {
			return false;
		}
		const troops = Math.floor(faction.members * faction.attackRatio);
		if (troops < MIN_COMMIT) return false;
		this.registerAttack(factionId, this.territory.owner[module]!);
		faction.members -= troops;
		this.attacks.push({ factionId, target: module, troops });
		return true;
	}

	step(): void {
		if (this.outcome !== null) return;
		this.tick += 1;
		this.recount();
		for (const faction of this.factions) {
			if (faction.hitmanCooldown > 0) faction.hitmanCooldown -= 1;
		}
		this.produce();
		this.sell();
		this.launder();
		this.regenerateControl();
		this.advanceConstruction();
		this.resolveAttacks();
		this.updateDiplomacyTimers();
		this.think();
		this.updateTreasury();
		this.updatePolice();
		this.checkOutcome();
		if (this.outcome !== null && !this.outcomeRecorded) {
			this.outcomeRecorded = true;
			this.events.push(this.outcome === "victory" ? "victory" : "defeat");
		}
	}

	/** Production : membres (logements/quartiers) et produit (labos). */
	private produce(): void {
		for (const faction of this.factions) {
			const max = this.maxMembers(faction.id);
			faction.members = Math.min(
				max,
				faction.members + Math.max(0, this.productionPerTick(faction.id)),
			);
			const labos = this.buildingCount(faction.id, "labo");
			if (labos > 0) faction.produit += labos * BUILDING_EFFECTS.produitPerLabo;
		}
	}

	/** Points de vente : Produit → Cash sale. */
	private sell(): void {
		for (const faction of this.factions) {
			const ventes = this.buildingCount(faction.id, "vente");
			if (ventes === 0 || faction.produit <= 0) continue;
			const capacity = ventes * BUILDING_EFFECTS.produitPerVente;
			const sold = Math.min(faction.produit, capacity);
			faction.produit -= sold;
			const embargo = this.isEmbargoed(faction.id) ? 1 - EMBARGO.salePenalty : 1;
			faction.cashSale += sold * BUILDING_EFFECTS.pricePerProduit * embargo;
		}
	}

	/** Façades : Cash sale → Cash propre (commission). */
	private launder(): void {
		for (const faction of this.factions) {
			const facades = this.buildingCount(faction.id, "facade");
			if (facades === 0 || faction.cashSale <= 0 || faction.launderRatio <= 0) continue;
			const capacity = facades * BUILDING_EFFECTS.cashPerFacade * faction.launderRatio;
			const laundered = Math.min(faction.cashSale, capacity);
			faction.cashSale -= laundered;
			faction.cashPropre += laundered * (1 - BUILDING_EFFECTS.commission);
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
			const logistique = 1 + TECH.logistiqueControlRegen * this.factions[owner]!.tech.logistique;
			this.territory.control[i] = Math.min(
				100,
				this.territory.control[i]! + CONTROL_REGEN * logistique,
			);
		}
	}

	private resolveAttacks(): void {
		for (let index = this.attacks.length - 1; index >= 0; index -= 1) {
			const attack = this.attacks[index]!;
			const owner = this.territory.owner[attack.target];
			if (owner === attack.factionId) {
				this.attacks.splice(index, 1);
				continue;
			}
			const zone = this.city.modules[attack.target]!;
			const building = this.buildingAt(attack.target);
			const planque = building === "planque" ? BUILDING_EFFECTS.planqueDefense : 1;
			const defenderBonus = owner === NEUTRAL ? 0 : this.defenseBonus(owner);
			const traitorDefense =
				owner !== NEUTRAL && this.isTraitor(owner) ? DIPLOMACY.traitorDefense : 1;
			const defense =
				(ZONE_DEFENSE[zone] ?? 1) * planque * (1 + defenderBonus) * traitorDefense;
			const attackBonus = 1 + this.attackBonus(attack.factionId);
			const damage = Math.min(
				MAX_DAMAGE_PER_TICK,
				Math.max(0.5, (attack.troops * DAMAGE_PER_TROOP * attackBonus) / defense),
			);
			const control = this.territory.control[attack.target]! - damage;
			attack.troops -= damage * ATTACK_LOSS;

			if (control <= 0) {
				const previous = this.territory.owner[attack.target];
				this.territory.owner[attack.target] = attack.factionId;
				this.territory.control[attack.target] = CAPTURE_CONTROL;
				this.territory.building[attack.target] = NO_BUILDING;
				this.territory.capturedAt[attack.target] = this.tick;
				this.cancelConstruction(attack.target);
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
				const loser = previous === NEUTRAL ? "neutre" : this.factions[previous]!.name;
				this.pushLog(`${taker} prend un quartier à ${loser}`);
				this.police.crime += 1;
				if (attack.factionId === this.player.id) this.events.push("capture");
				else if (previous === this.player.id) this.events.push("lost");
			} else if (attack.troops <= 0) {
				this.territory.control[attack.target] = control;
				this.attacks.splice(index, 1);
			} else {
				this.territory.control[attack.target] = control;
			}
		}
	}

	private think(): void {
		for (let i = 1; i < this.factions.length; i += 1) {
			this.aiCooldowns[i] = (this.aiCooldowns[i] ?? 0) - 1;
			if ((this.aiCooldowns[i] ?? 0) > 0) continue;
			this.aiCooldowns[i] = AI_INTERVAL;
			// Diplomatie : répond aux pactes et en propose (toujours, avant les raccourcis).
			this.aiDiplomacy(i);
			// Défense réactive avant toute autre action.
			if (this.aiDefend(i)) continue;
			if (this.rng() < 0.4 && this.aiBuild(i)) continue;

			// Tech : monte une branche si un Atelier le permet.
			if (this.rng() < 0.3) {
				for (const branch of TECH_BRANCHES) {
					if (this.upgradeTech(i, branch)) break;
				}
			}
			// Corruption défensive : le leader visé achète la police s'il en a les moyens.
			if (
				this.police.target === i &&
				this.police.pressure >= POLICE.multiThreshold &&
				this.canCorrupt(i)
			) {
				this.corruptPolice(i);
			}
			// Tueur à gage occasionnel sur un quartier ennemi frontalier.
			if (this.rng() < 0.25 && this.aiHitman(i)) continue;
			const target = this.pickAiTarget(i);
			if (target !== null) this.attackFrom(i, target);
		}
	}

	private aiHitman(factionId: number): boolean {
		for (let i = 0; i < this.territory.count; i += 1) {
			if (!this.canAttack(factionId, i)) continue;
			if (!this.canHitman(factionId, i)) continue;
			this.factions[factionId]!.hitmanCooldown = HITMAN.cooldownTicks;
			this.payHitman(factionId);
			this.applyHitman(factionId, i);
			return true;
		}
		return false;
	}

	private aiBuild(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		const counts = this.buildingCounts(factionId);
		const owned = this.modulesOwned(factionId);
		// Amorçage : tant qu'il manque une étape de la chaîne, on ne bâtit qu'elle.
		const bootstrap = missingEconomyStep(counts, (t) =>
			this.canAfford(faction, t, CONVERSION_COST),
		);
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.owner[i] !== factionId) continue;
			if (this.territory.building[i] !== NO_BUILDING) continue;
			if (this.territory.construction[i]! > 0) continue;
			const zone = this.city.modules[i]!;
			const factor = this.buildCostFactor(i);
			const type = chooseBuildType(
				counts,
				owned,
				(t) =>
					this.canAfford(faction, t, factor) &&
					canBuildInZone(zone, t) &&
					(bootstrap === null || t === bootstrap),
				{ atelier: TECH.maxLevel },
			);
			if (type === null) continue;
			this.startBuild(factionId, i, type);
			return true;
		}
		return false;
	}

	/** Défense réactive : pose une Planque sur un quartier possédé attaqué et vide. */
	private aiDefend(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		if (!this.attacks.length) return false;
		// On ne sacrifie pas l'amorçage économique : il faut une chaîne complète.
		if (
			this.buildingCount(factionId, "labo") === 0 ||
			this.buildingCount(factionId, "vente") === 0
		) {
			return false;
		}
		for (const attack of this.attacks) {
			const target = attack.target;
			if (this.territory.owner[target] !== factionId) continue;
			if (this.territory.building[target] !== NO_BUILDING) continue;
			if (this.territory.construction[target]! > 0) continue;
			if (!canBuildInZone(this.city.modules[target]!, "planque")) continue;
			if (!this.canAfford(faction, "planque", this.buildCostFactor(target))) return false;
			this.startBuild(factionId, target, "planque");
			return true;
		}
		return false;
	}

	private pickAiTarget(factionId: number): number | null {
		const leader = this.police.target;
		// Anti-snowball : une fraction des décisions vise le leader, ∝ à sa domination.
		const focusChance =
			leader >= 0 && leader !== factionId
				? Math.max(0, this.controlRatio(leader) - 1 / this.factions.length) *
					DIPLOMACY.leaderFocus
				: 0;
		const focusLeader = focusChance > 0 && this.rng() < focusChance;

		let best: number | null = null;
		let bestScore = Number.POSITIVE_INFINITY;
		let bestLeader: number | null = null;
		let bestLeaderScore = Number.POSITIVE_INFINITY;
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
		}
		if (focusLeader && bestLeader !== null) return bestLeader;
		return best;
	}

	private recount(): void {
		for (let f = 0; f < this.factions.length; f += 1) {
			const c = this.counts[f]!;
			c.logement = 0;
			c.labo = 0;
			c.vente = 0;
			c.facade = 0;
			c.planque = 0;
			c.depot = 0;
			c.atelier = 0;
			c.contre = 0;
			this.owned[f] = 0;
		}
		for (let i = 0; i < this.territory.count; i += 1) {
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL) continue;
			this.owned[owner] = (this.owned[owner] ?? 0) + 1;
			const buildIndex = this.territory.building[i]!;
			if (buildIndex === NO_BUILDING) continue;
			const type = BUILDING_TYPES[buildIndex];
			if (type) this.counts[owner]![type] += 1;
		}
		for (const faction of this.factions) {
			const c = this.counts[faction.id]!;
			faction.housing = c.logement;
			faction.buildings =
				c.logement +
				c.labo +
				c.vente +
				c.facade +
				c.planque +
				c.depot +
				c.atelier +
				c.contre;
		}
	}

	/** Seuil de contrôle requis (baisse en overtime après l'échéance). */
	victoryControlThreshold(): number {
		if (!this.overtime || this.tick <= this.timeLimitTicks) return VICTORY_CONTROL;
		const minutes = Math.floor((this.tick - this.timeLimitTicks) / (SIM_HZ * 60));
		return Math.max(0.2, VICTORY_CONTROL - OVERTIME_DROP_PER_MIN * minutes);
	}

	cleanGoal(): number {
		return CLEAN_GOAL;
	}

	/** Ticks restants avant l'échéance (peut être négatif en overtime). */
	ticksLeft(): number {
		return this.timeLimitTicks - this.tick;
	}

	/**
	 * Score composite (docs/scoring.md) : base = Cash propre, bonus contrôle /
	 * diversité / discrétion, malus saisies, quartiers perdus et éliminations.
	 */
	score(factionId: number): number {
		if (this.modulesOwned(factionId) === 0) return 0;
		const faction = this.factions[factionId]!;
		const control = this.controlRatio(factionId);
		const bControle = 0.3 * Math.min(1, control / VICTORY_CONTROL);
		let types = 0;
		for (const type of BUILDING_TYPES) {
			if (this.buildingCount(factionId, type) > 0) types += 1;
		}
		const bDiversite = 0.1 * (types / BUILDING_TYPES.length);
		const bDiscretion = 0.2 * (1 - this.police.pressure / 100);
		const violence = 1 - Math.min(0.5, 0.15 * faction.eliminations);
		const penalties = faction.seizures * 50000 + faction.quartersLost * 5000;
		return Math.max(
			0,
			faction.cashPropre * (1 + bControle + bDiversite + bDiscretion) * violence - penalties,
		);
	}

	/** Classement déterministe par score (départages : cash, contrôle, id). */
	private rankings(): number[] {
		return this.factions
			.map((faction) => faction.id)
			.sort((a, b) => {
				const byScore = this.score(b) - this.score(a);
				if (byScore !== 0) return byScore;
				const byCash = this.factions[b]!.cashPropre - this.factions[a]!.cashPropre;
				if (byCash !== 0) return byCash;
				const byControl = this.controlRatio(b) - this.controlRatio(a);
				if (byControl !== 0) return byControl;
				return a - b;
			});
	}

	summary(factionId = this.player.id): FactionSummary {
		const faction = this.factions[factionId]!;
		const rank = this.rankings().indexOf(factionId) + 1;
		return {
			control: this.controlRatio(factionId),
			quarters: this.modulesOwned(factionId),
			cashPropre: faction.cashPropre,
			captures: faction.captures,
			eliminations: faction.eliminations,
			raidsSuffered: faction.raidsSuffered,
			seizures: faction.seizures,
			eliminated: faction.eliminated,
			score: this.score(factionId),
			rank,
		};
	}

	private updateTreasury(): void {
		const player = this.player;
		if (player.cashPropre <= 0 && player.cashSale <= 0) {
			this.brokeTicks += 1;
		} else {
			this.brokeTicks = 0;
		}
	}

	private checkOutcome(): void {
		const playerModules = this.modulesOwned(this.player.id);
		const threshold = this.victoryControlThreshold();
		if (this.controlRatio(this.player.id) >= threshold && this.player.cashPropre >= CLEAN_GOAL) {
			this.outcome = "victory";
			this.endReason = `Contrôle ≥ ${Math.round(threshold * 100)} % et ${CLEAN_GOAL} de Cash propre.`;
			return;
		}
		let aliveCount = 0;
		let lastAlive = -1;
		for (const faction of this.factions) {
			if (this.modulesOwned(faction.id) > 0) {
				aliveCount += 1;
				lastAlive = faction.id;
			}
		}
		if (aliveCount === 1 && lastAlive === this.player.id) {
			this.outcome = "victory";
			this.endReason = "Dernier cartel en jeu.";
			return;
		}
		if (playerModules === 0) {
			this.outcome = "defeat";
			this.endReason = "Votre cartel a été éliminé.";
			return;
		}
		if (this.brokeTicks >= BANKRUPT_TICKS) {
			this.outcome = "defeat";
			this.endReason = "Faillite : trésorerie à zéro trop longtemps.";
			return;
		}
		// Une défaite posée par la police (liquidation) est conservée.
		if (this.outcome !== null) return;
		if (this.tick >= this.timeLimitTicks) {
			const rank = this.rankings().indexOf(this.player.id) + 1;
			if (rank === 1) {
				this.outcome = "victory";
				this.endReason = "Temps écoulé — 1er au score.";
			} else {
				this.outcome = "defeat";
				this.endReason = `Temps écoulé — rang ${rank} au score.`;
			}
		}
	}

	private pushLog(message: string): void {
		this.log.push(message);
		if (this.log.length > 8) this.log.shift();
	}

	private spawnModules(count: number): number[] {
		const positions: [number, number][] = [
			[1, 1],
			[MODULES_W - 2, 1],
			[1, MODULES_H - 2],
			[MODULES_W - 2, MODULES_H - 2],
			[Math.floor(MODULES_W / 2), 1],
			[1, Math.floor(MODULES_H / 2)],
		];
		return positions.slice(0, count).map(([x, y]) => y * MODULES_W + x);
	}
}

export { MODULE_SIZE, SIM_HZ };
