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
	buildingCostGrowth,
	zoneBuildBonus,
	zoneTimeFactor,
} from "./buildings";
import { START_HOUR, TICKS_PER_HOUR } from "./constants";
import { PARIS_CENTROIDS, PARIS_MAP } from "./maps/paris";
import { createRng, type Rng } from "./rng";
import { createFactions, FACTION_COUNT, type Faction } from "./factions";
import { HITMAN, TECH, TECH_BRANCHES, type TechBranch, techCost } from "./tech";
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
const DAMAGE_PER_TROOP = 0.0004;
/** Plafond de dégâts par tick : empêche les prises instantanées (sièges obligatoires). */
const MAX_DAMAGE_PER_TICK = 5;
const ATTACK_LOSS = 8;
const CONTROL_REGEN = 1.2;
/** Assauts simultanés max par faction : pas de « clique-partout ». */
const MAX_ASSAULTS = 4;
/** Déplacement des troupes avant le siège (ticks). */
export const TRAVEL_TICKS = 12;
/** Équipes de construction simultanées par faction. */
const BUILD_CREWS = 2;
/** Longueur max de la file d'ordres par faction. */
const QUEUE_MAX = 12;
/** Durée (ticks) avant de purger un ordre durablement inabordable (libère la file). */
const QUEUE_GRACE = 300;
/** Part de la valeur d'un bâtiment prise en butin à la capture. */
const LOOT_RATIO = 0.4;
/** Descente : coup de main pour voler le butin sans détruire (gaté Armement). */
const DESCENT = { costSale: 2000, costMembers: 600, requiredArmement: 1, cooldownTicks: 250 } as const;
/** Sabotage : production d'un bâtiment divisée par 2 pendant N ticks (gaté Armement). */
const SABOTAGE = {
	costSale: 1500,
	requiredArmement: 2,
	duration: 300,
	cooldownTicks: 250,
	factor: 0.5,
} as const;
const AI_INTERVAL = 25;
const MIN_COMMIT = 400;
/** Raid : affaiblit un quartier adjacent sans le capturer. */
const RAID = { costSale: 2500, costMembers: 800, control: 35, cooldownTicks: 300 } as const;
/**
 * Logistique : une vente doit être reliée à un labo (et une façade à une vente)
 * par un chemin de quartiers possédés. Hors ligne, la capacité tombe au plancher.
 */
const SUPPLY_FLOOR = 0.35;
/** Routes de convoi affichées par faction (logistique visible). */
const MAX_CONVOY_ROUTES = 4;
/** Interception : détourne la cargaison d'un convoi ennemi et coupe la ligne. */
const INTERCEPT = {
	costMembers: 500,
	requiredArmement: 1,
	stealRatio: 0.25,
	disruptTicks: 250,
	cooldownTicks: 300,
} as const;
/**
 * Police locale : le « heat » d'un quartier monte avec le crime local et
 * retombe ; les commissariats (zones police) patrouillent et le font baisser
 * plus vite. Les raids visent les quartiers les plus chauds.
 */
const HEAT = {
	capture: 30,
	hitman: 20,
	operation: 15,
	vente: 0.15,
	facade: 0.08,
	decay: 0.08,
	policeSuppress: 3,
	max: 100,
} as const;

/** Convoi visible : trajet d'approvisionnement d'une faction. */
export interface ConvoyRoute {
	factionId: number;
	from: number;
	to: number;
	kind: "produit" | "cash";
}

/** Choix offert par un événement (effet traçable appliqué immédiatement). */
export interface EventChoice {
	/** Libellé court affiché sur le bouton. */
	label: string;
	/** Description chiffrée de l'effet (infobulle). */
	detail: string;
}

/** Événement à choix en attente (un seul à la fois, déterministe). */
export interface PendingEvent {
	id: string;
	title: string;
	body: string;
	/** Couleur suggérée (info / gain / perte). */
	kind: "info" | "gain" | "loss";
	choices: [EventChoice, EventChoice];
}

/** Nom de gang d'après la position géographique réelle (centre de Paris). */
function spawnDirectionName(center: readonly [number, number]): string {
	const dLng = center[0] - 2.3522;
	const dLat = center[1] - 48.8566;
	const ns = dLat > 0.008 ? "Nord" : dLat < -0.008 ? "Sud" : "";
	const ew = dLng > 0.008 ? "Est" : dLng < -0.008 ? "Ouest" : "";
	const dir = [ns, ew].filter(Boolean).join("-");
	return dir ? `Gang ${dir}` : "Gang du Centre";
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

/** Battle royale : aucune limite de temps — on joue jusqu'à l'élimination. */
const BANKRUPT_TICKS = 300; // 30 s sans trésorerie → défaite
/** Encirclement : taille minimale d'un cluster pour capituler (évite la perte pingre). */
const ENCIRCLE_MIN_SIZE = 8;
/** Encirclement : le cluster doit peser au moins cette part de la faction pour capituler. */
const ENCIRCLE_SHARE = 0.35;

export interface WorldOptions {
	/** Carte jouée (défaut : Paris). */
	map?: CityGrid;
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

/** Briefing sérialisable (objectif + progression), réutilisable hors UI. */
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

/** Ordre de construction en attente (traité dès qu'une équipe se libère). */
export interface BuildOrder {
	factionId: number;
	module: number;
	type: BuildingType;
	/** Tick de mise en file (purge des ordres durablement inabordables). */
	queuedAt: number;
}

export interface Attack {
	factionId: number;
	/** Quartier d'origine (pour le déplacement des unités). */
	source: number;
	target: number;
	troops: number;
	/** Tick d'arrivée sur la cible (avant : troupes en route). */
	arrivesAt: number;
	/** Contrôle de la cible au début de l'assaut (pour la jauge de conquête). */
	startControl: number;
	/** Troupes engagées au départ (pour le contrôle établi après capture). */
	initialTroops: number;
}

export type Outcome = null | "victory" | "defeat";

/** Texte flottant (juice) ancré à un quartier, éphémère. */
export interface Floater {
	module: number;
	text: string;
	kind: "gain" | "loss" | "info";
	until: number;
}

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
	| "descent"
	| "sabotage"
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
	private readonly floaters: Floater[] = [];
	/** Ordres de construction en attente, par faction. */
	readonly buildOrders: BuildOrder[] = [];
	private outcomeRecorded = false;
	/** Index du contact corrompu courant (change s'il est grillé). */
	private contactIndex: number;
	tick = 0;
	outcome: Outcome = null;
	endReason = "";

	private readonly rng: Rng;
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
	/** Bâtiments sabotés par faction (recalculé une fois par tick). */
	private sabotaged: Array<Record<BuildingType, number>> = [];
	/** Sommes locales pondérées par le profil du quartier (recalculées par tick). */
	private recruitDemand: number[] = [];
	private housingDemand: number[] = [];
	private retailDemand: number[] = [];
	private retailWeighted: number[] = [];
	private launderWealth: number[] = [];
	/** Labos pondérés par le bonus de zone (recalculé par tick). */
	private laboWeight: number[] = [];
	/** Part de la capacité reliée à une source (labo/vente) — logistique. */
	private retailSupply: number[] = [];
	private launderSupply: number[] = [];
	/** Routes de convoi courantes (rendu). */
	private convoys: ConvoyRoute[] = [];
	/** Événement à choix en attente (un seul à la fois). */
	private pending: PendingEvent | null = null;
	/** Empreinte propriété+bâtiments : évite un BFS de logistique inutile. */
	private supplySignature = -1;
	/** Heat policier par quartier (0–100) : monte au crime, retombe. */
	readonly heat: Float32Array;
	/** Quartier sous surveillance (zone police ou voisine d'une zone police). */
	private readonly policeZone: Uint8Array;

	constructor(seed: number, options?: WorldOptions) {
		this.city = options?.map ?? PARIS_MAP;
		this.territory = createTerritory(this.city.modules.length);
		this.heat = new Float32Array(this.city.modules.length);
		this.policeZone = this.buildPoliceZone();
		this.factions = createFactions(FACTION_COUNT, START_MEMBERS);
		this.rng = createRng((seed ^ 0x9e3779b9) >>> 0);
		this.contactIndex = seed % CONTACT_NAMES.length;

		this.territory.control.fill(NEUTRAL_GARRISON);
		const spawns = this.city.spawns.slice(0, this.factions.length);
		// Spawn toujours constructible : on force une zone « bâtie » sur chaque spawn.
		const modules = this.city.modules as ZoneType[];
		spawns.forEach((module, index) => {
			if (!BUILT_ZONES.includes(modules[module]!)) {
				modules[module] = BUILT_ZONES[index % BUILT_ZONES.length]!;
			}
		});
		// Nomme les gangs d'après leur position réelle (évite « Gang Nord » au sud).
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
		this.sabotaged = this.factions.map(() => emptyCounts());
		this.owned = this.factions.map(() => 0);
		this.recruitDemand = this.factions.map(() => 0);
		this.housingDemand = this.factions.map(() => 0);
		this.retailDemand = this.factions.map(() => 0);
		this.retailWeighted = this.factions.map(() => 0);
		this.launderWealth = this.factions.map(() => 0);
		this.laboWeight = this.factions.map(() => 0);
		this.retailSupply = this.factions.map(() => 1);
		this.launderSupply = this.factions.map(() => 1);
		this.recount();
	}

	get player(): Faction {
		return this.factions[0]!;
	}

	/** Zones sous surveillance policière (poste ou quartier voisin d'un poste). */
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

	/** Ajoute du heat policier local (plafonné). */
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
		const ownedDemand = this.recruitDemand[factionId] ?? 0;
		const housingDemand =
			(this.housingDemand[factionId] ?? 0) * this.sabotageFactor(factionId, "logement");
		const max = this.maxMembers(factionId);
		if (faction.members >= max) return 0;
		const logistique = 1 + TECH.logistiqueProduction * faction.tech.logistique;
		return (
			(BUILDING_EFFECTS.baseMembersPerQuarter * ownedDemand +
				BUILDING_EFFECTS.membersPerLogement * housingDemand) *
			(1 - faction.members / max) *
			logistique
		);
	}

	/** Demande locale d'un quartier (clientele) — voir docs/economy.md §marché local. */
	demandAt(module: number): number {
		return this.city.demand[module] ?? 1;
	}

	/** Richesse locale d'un quartier (prix, blanchiment). */
	wealthAt(module: number): number {
		return this.city.wealth[module] ?? 1;
	}

	/** Bonus de rendement d'un bâtiment dans la zone du quartier (1 = neutre). */
	zoneBonusAt(module: number, type: BuildingType): number {
		const zone = this.city.modules[module];
		return zone ? zoneBuildBonus(zone, type) : 1;
	}

	/** Heure in-game (0–24, fractionnaire) — cycle jour/nuit. */
	hourOfDay(): number {
		return (START_HOUR + this.tick / TICKS_PER_HOUR) % 24;
	}

	/** Facteur d'heure de pointe pour un bâtiment dans un quartier (1 = neutre). */
	rushFactorAt(module: number, type: BuildingType): number {
		const zone = this.city.modules[module];
		return zone ? zoneTimeFactor(zone, type, this.hourOfDay()) : 1;
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
		if (factionId === this.player.id) {
			const anchor = this.playerAnchor();
			if (anchor >= 0) this.float(anchor, `🔧 ${branch} ${level + 1}`, "gain");
		}
		this.pushLog(`Tech ${branch} → ${level + 1}`);
		if (factionId === this.player.id) this.events.push("tech");
		return true;
	}

	/** Quartier du joueur servant d'ancre aux retours (tech, corruption). */
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
		const targets = [module, ...this.neighbors(module)];
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
			this.addHeat(target, HEAT.hitman);
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
		this.coolFaction(factionId);
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
		if (faction.isPlayer) {
			const anchor = this.playerAnchor();
			if (anchor >= 0) this.float(anchor, "🤝 −Pression", "gain");
		}
		this.pushLog(`${this.contactName} fait baisser la Pression (${faction.name})`);
		if (faction.isPlayer) this.events.push("corrupt");
		return true;
	}

	playerCorrupt(): boolean {
		return this.corruptPolice(this.player.id);
	}

	/** Un contact corrompu refroidit les quartiers d'une faction (heat ÷2). */
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

	/** Police locale : le crime chauffe les quartiers, la patrouille les refroidit. */
	private updateHeat(): void {
		const count = this.territory.count;
		for (let i = 0; i < count; i += 1) {
			let value = this.heat[i]!;
			const building = this.territory.building[i]!;
			if (building === BUILDING_INDEX.vente) value += HEAT.vente * (this.city.demand[i] ?? 1);
			else if (building === BUILDING_INDEX.facade) value += HEAT.facade * (this.city.wealth[i] ?? 1);
			const decay = HEAT.decay * (this.policeZone[i] ? HEAT.policeSuppress : 1);
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
		// Battle royale : on ne punit pas la simple avance, seulement la domination écrasante.
		const excess = Math.max(0, leaderShare - POLICE.dominationShare);

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

	/** Raid : retire du Contrôle (et détruit les bâtiments) au leader. */
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
	 * Meilleure cible adjacente pour une expansion automatique : le quartier
	 * attaquable au **Contrôle le plus faible** (neutre ou ennemi hors pacte).
	 * Permet d'étendre sans micro-gérer chaque clic.
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

	/** Attaque automatiquement la meilleure cible adjacente. */
	playerAttackBest(): boolean {
		const target = this.bestAdjacentTarget();
		return target >= 0 && this.playerAttack(target);
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
		if (this.activeConstructions(this.player.id) >= BUILD_CREWS) return false;
		if (!canBuildInZone(this.city.modules[module]!, type)) return false;
		return this.canAfford(this.player, type, this.buildCostFactor(this.player.id, module, type));
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
		this.float(module, `🏗 ${BUILDINGS[type].label}`, "info");
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
		this.addHeat(module, HEAT.operation);
		this.recount();
		this.events.push("hitman");
		this.float(module, `raid −${RAID.control}`, "loss");
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

	/** Textes flottants actifs (juice). */
	activeFloaters(): readonly Floater[] {
		return this.floaters;
	}

	private float(module: number, text: string, kind: Floater["kind"]): void {
		this.floaters.push({ module, text, kind, until: this.tick + 14 });
		if (this.floaters.length > 24) this.floaters.shift();
	}

	/** Un Guetteur (contre-espionnage) couvre-t-il ce quartier (rayon 1) ? */
	private guardedBy(owner: number, module: number): number {
		let guards = 0;
		if (
			this.territory.owner[module] === owner &&
			this.territory.building[module] === BUILDING_INDEX.contre
		) {
			guards += 1;
		}
		for (const neighbor of this.neighbors(module)) {
			if (
				this.territory.owner[neighbor] === owner &&
				this.territory.building[neighbor] === BUILDING_INDEX.contre
			) {
				guards += 1;
			}
		}
		return guards;
	}

	descentCost(): { sale: number; members: number } {
		return { sale: DESCENT.costSale, members: DESCENT.costMembers };
	}

	playerCanDescent(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		const owner = this.ownerAt(module);
		if (owner === NEUTRAL || owner === this.player.id) return false;
		if (!this.buildingAt(module)) return false;
		if (this.player.tech.armement < DESCENT.requiredArmement) return false;
		if (this.player.hitmanCooldown > 0) return false;
		return (
			this.player.cashSale >= DESCENT.costSale && this.player.members >= DESCENT.costMembers
		);
	}

	/** Descente : vole le butin d'un bâtiment sans le détruire ni changer le contrôle. */
	playerDescent(module: number): boolean {
		if (!this.playerCanDescent(module)) return false;
		const owner = this.ownerAt(module);
		const type = this.buildingAt(module)!;
		this.player.cashSale -= DESCENT.costSale;
		this.player.members -= DESCENT.costMembers;
		this.player.hitmanCooldown = DESCENT.cooldownTicks;
		// Un Guetteur adverse gêne l'opération (butin réduit, échec si réseau dense).
		const guards = this.guardedBy(owner, module);
		if (guards >= 2) {
			this.pushLog(`Descente éventée (guetteurs, module ${module})`);
			this.events.push("alert");
			return true;
		}
		const gained = this.loot(this.player.id, owner, type, guards >= 1 ? LOOT_RATIO * 0.5 : LOOT_RATIO);
		this.addHeat(module, HEAT.operation);
		this.events.push("descent");
		this.float(
			module,
			gained.sale
				? `descente +${Math.round(gained.sale)} sale`
				: gained.clean
					? `descente +${Math.round(gained.clean)} propre`
					: `descente +${Math.round(gained.members)} membres`,
			"gain",
		);
		this.pushLog(`Descente réussie (module ${module})`);
		return true;
	}

	sabotageCost(): number {
		return SABOTAGE.costSale;
	}

	playerCanSabotage(module: number): boolean {
		if (this.outcome !== null) return false;
		if (!this.canAttack(this.player.id, module)) return false;
		const owner = this.ownerAt(module);
		if (owner === NEUTRAL || owner === this.player.id) return false;
		if (!this.buildingAt(module)) return false;
		if (this.player.tech.armement < SABOTAGE.requiredArmement) return false;
		if (this.territory.sabotageUntil[module]! > this.tick) return false;
		if (this.player.hitmanCooldown > 0) return false;
		return this.player.cashSale >= SABOTAGE.costSale;
	}

	/** Sabotage : divise la production d'un bâtiment ennemi pendant un temps. */
	playerSabotage(module: number): boolean {
		if (!this.playerCanSabotage(module)) return false;
		const owner = this.ownerAt(module);
		this.player.cashSale -= SABOTAGE.costSale;
		this.player.hitmanCooldown = SABOTAGE.cooldownTicks;
		if (this.guardedBy(owner, module) >= 1) {
			this.pushLog(`Sabotage déjoué (guetteurs, module ${module})`);
			this.events.push("alert");
			return true;
		}
		this.territory.sabotageUntil[module] = this.tick + SABOTAGE.duration;
		this.addHeat(module, HEAT.operation);
		this.events.push("sabotage");
		this.float(module, "saboté −50 %", "loss");
		this.pushLog(`Sabotage (module ${module})`);
		return true;
	}

	/** Convoi visant ce quartier (cible d'une interception), s'il existe. */
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
		if (!this.convoyTo(module)) return false;
		if (this.player.tech.armement < INTERCEPT.requiredArmement) return false;
		if (this.player.hitmanCooldown > 0) return false;
		return this.player.members >= INTERCEPT.costMembers;
	}

	/** Interception : détourne la cargaison d'un convoi et coupe la ligne. */
	playerIntercept(module: number): boolean {
		if (!this.playerCanIntercept(module)) return false;
		const route = this.convoyTo(module)!;
		const victim = this.factions[route.factionId]!;
		this.player.members -= INTERCEPT.costMembers;
		this.player.hitmanCooldown = INTERCEPT.cooldownTicks;
		const gained = this.stealCargo(this.player, victim, route.kind);
		this.territory.sabotageUntil[module] = this.tick + INTERCEPT.disruptTicks;
		this.addHeat(module, HEAT.operation);
		this.events.push("intercept");
		this.float(module, `interception +${Math.round(gained)}`, "gain");
		this.pushLog(`Convoi intercepté (module ${module})`);
		return true;
	}

	/** Détourne une part de la cargaison du convoi (produit ou cash sale). */
	private stealCargo(thief: Faction, victim: Faction, kind: ConvoyRoute["kind"]): number {
		if (kind === "produit") {
			const amount = victim.produit * INTERCEPT.stealRatio;
			victim.produit -= amount;
			thief.produit += amount;
			return amount;
		}
		const amount = victim.cashSale * INTERCEPT.stealRatio;
		victim.cashSale -= amount;
		thief.cashSale += amount;
		return amount;
	}

	/** Événement à choix en attente pour le joueur (un seul à la fois). */
	pendingEvent(): PendingEvent | null {
		return this.pending;
	}

	/** Force un événement (tests / scénarios) — n'affecte pas la simulation normale. */
	debugSetEvent(event: PendingEvent | null): void {
		this.pending = event;
	}

	/**
	 * Résout l'événement courant. Les deux choix ont un coût et un bénéfice réels,
	 * **aucun n'est scripté bon/mauvais** (docs/npc-events.md).
	 */
	playerChoose(choice: 0 | 1): boolean {
		const event = this.pending;
		if (!event || this.outcome !== null) return false;
		const player = this.player;
		const anchor = this.playerAnchor();
		if (event.id === "livraison") {
			if (choice === 0) {
				player.cashSale += 3500;
				if (anchor >= 0) {
					this.addHeat(anchor, HEAT.operation * 3);
					this.float(anchor, "+3 500 sale", "gain");
				}
				this.pushLog("Livraison acceptée : +3 500 sale, heat en hausse");
			} else {
				player.cashPropre += 4000;
				this.pushLog("Livraison refusée : +4 000 propre");
			}
		} else if (event.id === "indicateur") {
			if (choice === 0) {
				player.cashSale = Math.max(0, player.cashSale - 6000);
				this.police.pressure = Math.max(0, this.police.pressure - 12);
				this.pushLog("Indicateur acheté : −12 Pression (−6 000 sale)");
			} else {
				player.cashSale += 3000;
				player.cashPropre += 3000;
				this.police.pressure = Math.min(POLICE.max, this.police.pressure + 8);
				if (anchor >= 0) this.addHeat(anchor, HEAT.operation * 4);
				this.pushLog("Indicateur réduit au silence : +6 000, Pression +8");
			}
		} else if (event.id === "facade") {
			if (choice === 0) {
				// On cherche un quartier possédé, vide et compatible façade.
				let free = -1;
				for (let i = 0; i < this.territory.count; i += 1) {
					if (this.territory.owner[i] !== this.player.id) continue;
					if (this.territory.building[i] !== NO_BUILDING) continue;
					if (this.territory.construction[i]! > 0) continue;
					if (!canBuildInZone(this.city.modules[i]!, "facade")) continue;
					free = i;
					break;
				}
				if (free >= 0) {
					this.territory.building[free] = BUILDING_INDEX.facade;
					this.territory.builtAt[free] = this.tick;
					this.recount();
					this.float(free, "🏛 Façade offerte", "gain");
					this.pushLog(`Façade concurrente rachetée (module ${free})`);
				} else {
					// Aucun local libre : on compense en Cash propre (choix jamais inutile).
					player.cashPropre += 3000;
					this.pushLog("Façade rachetée : aucun local libre → +3 000 propre");
				}
			} else {
				player.cashSale += 5000;
				this.pushLog("Façade revendue : +5 000 sale");
			}
		}
		this.events.push("event");
		this.pending = null;
		return true;
	}

	/** Tire un événement à choix (déterministe, un seul à la fois, ~toutes les 2 min). */
	private maybeTriggerEvent(): void {
		if (this.pending || this.outcome !== null) return;
		if (this.tick < 600 || this.tick % 1200 !== 0) return;
		if (this.rng() >= 0.5) return;
		const pool: PendingEvent[] = [
			{
				id: "livraison",
				title: "Livraison risquée",
				body: "Un fournisseur propose une cargaison hors circuit : paiement immédiat, mais la police rôde.",
				kind: "info",
				choices: [
					{ label: "Accepter", detail: "+3 500 sale · heat en hausse" },
					{ label: "Refuser", detail: "+4 000 propre" },
				],
			},
			{
				id: "indicateur",
				title: "Un indicateur parle",
				body: "Quelqu'un vous a dénoncé. Il peut être acheté… ou réduit au silence.",
				kind: "loss",
				choices: [
					{ label: "Acheter", detail: "−6 000 sale · −12 Pression" },
					{ label: "Faire taire", detail: "+6 000 · Pression +8" },
				],
			},
			{
				id: "facade",
				title: "Façade concurrente",
				body: "Une façade bien placée se libère dans un de vos quartiers.",
				kind: "gain",
				choices: [
					{ label: "Racheter", detail: "Façade aménagée gratuitement" },
					{ label: "Revendre", detail: "+5 000 sale" },
				],
			},
		];
		this.pending = pool[Math.floor(this.rng() * pool.length)]!;
	}

	/** Facteur de production d'une faction (bâtiments sabotés = moitié). */
	private sabotageFactor(factionId: number, type: BuildingType): number {
		const total = this.buildingCount(factionId, type);
		const hit = this.sabotaged[factionId]?.[type] ?? 0;
		if (total === 0) return 0;
		return (total - hit * (1 - SABOTAGE.factor)) / total;
	}

	/** Butin : transfère une part de la valeur du bâtiment détruit vers l'attaquant. */
	private loot(attackerId: number, victimId: number, type: BuildingType, ratio = LOOT_RATIO): { sale: number; clean: number; members: number } {
		const spec = BUILDINGS[type];
		const attacker = this.factions[attackerId]!;
		const victim = this.factions[victimId]!;
		const take = (cost: number | undefined, stock: number): number => {
			if (!cost) return 0;
			return Math.min(cost * ratio, stock);
		};
		const members = take(spec.costMembers, victim.members);
		const sale = take(spec.costSale, victim.cashSale);
		const clean = take(spec.costClean, victim.cashPropre);
		victim.members -= members;
		attacker.members += members;
		victim.cashSale -= sale;
		attacker.cashSale += sale;
		victim.cashPropre -= clean;
		attacker.cashPropre += clean;
		return { sale, clean, members };
	}

	/** Consomme les événements joueur accumulés depuis le dernier rendu. */
	drainEvents(): GameEvent[] {
		if (this.events.length === 0) return [];
		return this.events.splice(0, this.events.length);
	}

	/** Ordres en file pour une faction. */
	playerBuildOrders(): readonly BuildOrder[] {
		return this.buildOrders.filter((order) => order.factionId === this.player.id);
	}

	queueCap(): number {
		return QUEUE_MAX;
	}

	queueLength(factionId = this.player.id): number {
		return this.buildOrders.filter((order) => order.factionId === factionId).length;
	}

	/** Peut-on mettre cet ordre en file ? (état, zone, file non pleine) */
	playerCanQueue(module: number, type: BuildingType): boolean {
		if (this.outcome !== null) return false;
		if (this.ownerAt(module) !== this.player.id) return false;
		if (this.territory.building[module] !== NO_BUILDING) return false;
		if (this.territory.construction[module]! > 0) return false;
		if (!canBuildInZone(this.city.modules[module]!, type)) return false;
		if (this.buildOrders.some((order) => order.module === module)) return false;
		return this.queueLength() < QUEUE_MAX;
	}

	/**
	 * Plan de construction par lot : aménage tous les quartiers possédés vides
	 * (hors file/chantier) selon la composition cible. Chiffres pour prévisualisation.
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
			if (this.buildOrders.some((order) => order.module === i)) continue;
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

	/** Met en file le lot d'aménagement (dans la limite de la file). */
	playerBatchBuild(): number {
		const player = this.player;
		const counts = this.buildingCounts(player.id);
		const scratch = { ...counts };
		const owned = this.modulesOwned(player.id);
		let queued = 0;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.queueLength() >= QUEUE_MAX) break;
			if (this.ownerAt(i) !== player.id) continue;
			if (this.territory.building[i] !== NO_BUILDING) continue;
			if (this.territory.construction[i]! > 0) continue;
			if (this.buildOrders.some((order) => order.module === i)) continue;
			const bootstrap = missingEconomyStep(scratch, (t) =>
				this.canAfford(player, t, CONVERSION_COST),
			);
			const type =
				bootstrap ??
				chooseBuildType(scratch, owned, (t) => canBuildInZone(this.city.modules[i]!, t));
			if (type === null) continue;
			if (this.playerQueueBuild(i, type)) {
				scratch[type] += 1;
				queued += 1;
			}
		}
		return queued;
	}

	/** Met un ordre en file ; démarre immédiatement si une équipe est libre. */
	playerQueueBuild(module: number, type: BuildingType): boolean {
		if (!this.playerCanQueue(module, type)) return false;
		this.buildOrders.push({ factionId: this.player.id, module, type, queuedAt: this.tick });
		this.processBuildQueues();
		return true;
	}

	/** Annule l'ordre en file visant ce quartier. */
	playerCancelOrder(module: number): boolean {
		const index = this.buildOrders.findIndex(
			(order) => order.factionId === this.player.id && order.module === module,
		);
		if (index < 0) return false;
		this.buildOrders.splice(index, 1);
		return true;
	}

	/** Démarre les ordres en file tant qu'une équipe est disponible et abordable. */
	private processBuildQueues(): void {
		for (const faction of this.factions) {
			let guard = QUEUE_MAX;
			while (guard > 0) {
				guard -= 1;
				if (this.activeConstructions(faction.id) >= BUILD_CREWS) break;
				// On cherche le premier ordre **valide et abordable** de la faction.
				// Un ordre invalide est retiré ; un ordre inabordable ne bloque plus
				// les suivants (et est purgé s'il le reste trop longtemps).
				let started = false;
				for (let k = 0; k < this.buildOrders.length; k += 1) {
					const order = this.buildOrders[k]!;
					if (order.factionId !== faction.id) continue;
					const valid =
						this.ownerAt(order.module) === faction.id &&
						this.territory.building[order.module] === NO_BUILDING &&
						this.territory.construction[order.module] === 0 &&
						canBuildInZone(this.city.modules[order.module]!, order.type);
					if (!valid) {
						this.buildOrders.splice(k, 1);
						k -= 1;
						continue;
					}
					if (!this.canAfford(faction, order.type, this.buildCostFactor(faction.id, order.module, order.type))) {
						if (this.tick - order.queuedAt > QUEUE_GRACE) {
							this.buildOrders.splice(k, 1);
							k -= 1;
							if (faction.isPlayer) {
								this.pushLog(`Ordre annulé (fonds insuffisants) : ${BUILDINGS[order.type].label}`);
							}
							continue;
						}
						continue;
					}
					this.buildOrders.splice(k, 1);
					this.startBuild(faction.id, order.module, order.type);
					started = true;
					break;
				}
				if (!started) break;
			}
		}
	}

	/** Nombre de chantiers simultanés autorisés par faction. */
	buildCrews(): number {
		return BUILD_CREWS;
	}

	/** Chantiers en cours d'une faction. */
	activeConstructions(factionId: number): number {
		let count = 0;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (this.territory.construction[i]! > 0 && this.territory.owner[i] === factionId) count += 1;
		}
		return count;
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
	/**
	 * Facteur de coût : conversion (−50 %) × croissance par type déjà possédé.
	 * `count` permet de tenir compte des bâtiments déjà prévus dans un même lot.
	 */
	buildCostFactor(factionId: number, module: number, type: BuildingType, count?: number): number {
		const owned = count ?? this.counts[factionId]?.[type] ?? 0;
		const base = this.isConversion(module) ? CONVERSION_COST : 1;
		return base * buildingCostGrowth(owned);
	}

	/** Paie puis lance le chantier (conversion = moitié du temps, chantier malgré tout). */
	private startBuild(factionId: number, module: number, type: BuildingType): void {
		this.pay(this.factions[factionId]!, type, this.buildCostFactor(factionId, module, type));
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
				const type = BUILDING_TYPES[this.territory.building[i]!];
				if (type) this.float(i, `${BUILDINGS[type].label} prêt`, "gain");
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
		// Origine = quartier possédé adjacent au contrôle le plus élevé.
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
		// Guetteur : un Contre-espionnage adjacent à la cible alerte le défenseur joueur.
		const defender = this.territory.owner[module];
		if (defender === this.player.id && factionId !== this.player.id) {
			const lookout = this.neighbors(module).some(
				(neighbor) =>
					this.territory.owner[neighbor] === defender &&
					this.territory.building[neighbor] === BUILDING_INDEX.contre,
			);
			if (lookout) {
				this.events.push("alert");
				this.float(module, "Descente !", "loss");
				this.pushLog(`Alerte : descente ennemie (module ${module})`);
			}
		}
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
		this.processBuildQueues();
		this.resolveAttacks();
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

	/** Production : membres (logements/quartiers) et produit (labos). */
	private produce(): void {
		for (const faction of this.factions) {
			const max = this.maxMembers(faction.id);
			faction.members = Math.min(
				max,
				faction.members + Math.max(0, this.productionPerTick(faction.id)),
			);
			const labos =
				(this.laboWeight[faction.id] ?? 0) * this.sabotageFactor(faction.id, "labo");
			if (labos > 0) faction.produit += labos * BUILDING_EFFECTS.produitPerLabo;
		}
	}

	/** Points de vente : Produit → Cash sale, au prix du quartier (richesse locale). */
	private sell(): void {
		for (const faction of this.factions) {
			const demand = this.retailDemand[faction.id] ?? 0;
			const supply = SUPPLY_FLOOR + (1 - SUPPLY_FLOOR) * (this.retailSupply[faction.id] ?? 1);
			const ventes = demand * supply * this.sabotageFactor(faction.id, "vente");
			if (ventes === 0 || faction.produit <= 0) continue;
			const capacity = ventes * BUILDING_EFFECTS.produitPerVente;
			const sold = Math.min(faction.produit, capacity);
			faction.produit -= sold;
			const avgWealth = demand > 0 ? (this.retailWeighted[faction.id] ?? 0) / demand : 1;
			const embargo = this.isEmbargoed(faction.id) ? 1 - EMBARGO.salePenalty : 1;
			faction.cashSale += sold * BUILDING_EFFECTS.pricePerProduit * avgWealth * embargo;
		}
	}

	/** Façades : Cash sale → Cash propre (capacité ∝ richesse locale). */
	private launder(): void {
		for (const faction of this.factions) {
			const facades =
				(this.launderWealth[faction.id] ?? 0) *
				(SUPPLY_FLOOR + (1 - SUPPLY_FLOOR) * (this.launderSupply[faction.id] ?? 1)) *
				this.sabotageFactor(faction.id, "facade");
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

	/**
	 * Encirclement (idée OpenFront) : un ensemble connexe de quartiers d'une même
	 * faction sans aucune frontière avec du neutre ou une autre faction est
	 * **capitulé** d'un coup au profit de son encercleur. Récompense la manœuvre
	 * et évite les fins de partie interminables. Déterministe, seuil de taille.
	 */
	private resolveEncirclements(): void {
		if (this.tick % 5 !== 0) return;
		const count = this.territory.count;
		const assigned = new Uint8Array(count);
		let changed = false;
		for (let start = 0; start < count; start += 1) {
			const owner = this.territory.owner[start]!;
			if (owner === NEUTRAL || assigned[start]) continue;
			// Composante connexe de même propriétaire.
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
			// Seuls les clusters significatifs capitulent : évite le grignotage gratuit
			// et laisse une faction réduite se battre (sa perte serait sinon arbitraire).
			const factionOwned = this.owned[owner] ?? 0;
			if (cluster.length < ENCIRCLE_MIN_SIZE) continue;
			if (factionOwned > 0 && cluster.length < factionOwned * ENCIRCLE_SHARE) continue;
			// L'encercleur doit être le plus gros : un empire quasi complet ne tombe
			// pas au contact d'une poche minuscule.
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
				this.float(cluster[0]!, `encerclé −${cluster.length}`, "loss");
			} else if (encircler === this.player.id) {
				this.events.push("capture");
				this.float(cluster[0]!, `encerclement +${cluster.length}`, "gain");
			}
			this.pushLog(`${taker.name} encercle ${victim.name} (${cluster.length})`);
			changed = true;
		}
		if (changed) this.recount();
	}

	private resolveAttacks(): void {
		for (let index = this.attacks.length - 1; index >= 0; index -= 1) {
			const attack = this.attacks[index]!;
			// Troupes encore en déplacement : aucun dégât avant l'arrivée.
			if (attack.arrivesAt > this.tick) continue;
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
			// Le plafond de dégâts suit l'Armement : la tech reste utile au-delà du cap.
			const damage = Math.min(
				MAX_DAMAGE_PER_TICK * attackBonus,
				Math.max(0.5, (attack.troops * DAMAGE_PER_TROOP * attackBonus) / defense),
			);
			const control = this.territory.control[attack.target]! - damage;
			attack.troops -= damage * ATTACK_LOSS;

			if (control <= 0) {
				const previous = this.territory.owner[attack.target];
				const destroyed = this.buildingAt(attack.target);
				// Contrôle établi ∝ troupes survivantes : un assaut écrasant sécurise
				// plus qu'un siège coûteux. Une cible disputée par un autre assaut
				// (guerre entre gangs) reste précaire.
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
				this.cancelConstruction(attack.target);
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
				const loser = previous === NEUTRAL ? "neutre" : this.factions[previous]!.name;
				this.pushLog(`${taker} prend un quartier à ${loser}`);
				this.police.crime += 1;
				// Butin : les bâtiments sont des objectifs à valeur.
				if (destroyed && previous !== NEUTRAL && previous !== attack.factionId) {
					const gained = this.loot(attack.factionId, previous, destroyed);
					if (attack.factionId === this.player.id && (gained.sale || gained.clean || gained.members)) {
						const label = gained.sale
							? `+${Math.round(gained.sale)} sale`
							: gained.clean
								? `+${Math.round(gained.clean)} propre`
								: `+${Math.round(gained.members)} membres`;
						this.float(attack.target, `butin ${label}`, "gain");
					}
				}
				if (attack.factionId === this.player.id) {
					this.events.push("capture");
					this.float(attack.target, "+1 quartier", "gain");
				} else if (previous === this.player.id) {
					this.events.push("lost");
					this.float(attack.target, "−1 quartier", "loss");
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
			// Opérations (descente/sabotage) : armement requis, donc investissement tech.
			if (this.rng() < 0.3 && this.aiOperate(i)) continue;
			// Interception d'un convoi adverse frontalier.
			if (this.rng() < 0.2 && this.aiIntercept(i)) continue;
			// Tueur à gage occasionnel sur un quartier ennemi frontalier.
			if (this.rng() < 0.25 && this.aiHitman(i)) continue;
			// Concentration de force : on renforce l'assaut en cours avant d'ouvrir un front.
			const active = this.attacks.find((attack) => attack.factionId === i);
			const focus =
				active && this.canAttack(i, active.target) ? active.target : this.pickAiTarget(i);
			if (focus !== null) this.attackFrom(i, focus);
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
		if (this.activeConstructions(factionId) >= BUILD_CREWS) return false;
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
			const type = chooseBuildType(
				counts,
				owned,
				(t) =>
					this.canAfford(faction, t, this.buildCostFactor(factionId, i, t)) &&
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
			if (!this.canAfford(faction, "planque", this.buildCostFactor(factionId, target, "planque"))) return false;
			this.startBuild(factionId, target, "planque");
			return true;
		}
		return false;
	}

	/** Opérations IA : descente/sabotage d'un bâtiment adverse (gatées Armement). */
	private aiOperate(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		if (faction.hitmanCooldown > 0) return false;
		// On n'engage pas d'opérations avant d'avoir une économie établie et un surplus.
		if (this.buildingCount(factionId, "labo") === 0 || this.buildingCount(factionId, "vente") === 0) {
			return false;
		}
		if (faction.cashSale < 6000) return false;
		for (let i = 0; i < this.territory.count; i += 1) {
			if (!this.canAttack(factionId, i)) continue;
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL || owner === factionId) continue;
			const type = this.buildingAt(i);
			if (!type) continue;
			if (this.guardedBy(owner, i) > 0) continue;
			if (
				faction.tech.armement >= SABOTAGE.requiredArmement &&
				faction.cashSale >= SABOTAGE.costSale &&
				this.territory.sabotageUntil[i]! <= this.tick
			) {
				faction.cashSale -= SABOTAGE.costSale;
				faction.hitmanCooldown = SABOTAGE.cooldownTicks;
				this.territory.sabotageUntil[i] = this.tick + SABOTAGE.duration;
				this.addHeat(i, HEAT.operation);
				if (owner === this.player.id) {
					this.events.push("sabotage");
					this.float(i, "saboté −50 %", "loss");
					this.pushLog(`Sabotage ennemi (module ${i})`);
				}
				return true;
			}
			if (
				faction.tech.armement >= DESCENT.requiredArmement &&
				faction.cashSale >= DESCENT.costSale &&
				faction.members >= DESCENT.costMembers
			) {
				faction.cashSale -= DESCENT.costSale;
				faction.members -= DESCENT.costMembers;
				faction.hitmanCooldown = DESCENT.cooldownTicks;
				this.loot(factionId, owner, type);
				this.addHeat(i, HEAT.operation);
				if (owner === this.player.id) {
					this.events.push("descent");
					this.float(i, "descente ennemie", "loss");
					this.pushLog(`Descente ennemie (module ${i})`);
				}
				return true;
			}
		}
		return false;
	}

	/** Interception IA : détourne un convoi adverse frontalier. */
	private aiIntercept(factionId: number): boolean {
		const faction = this.factions[factionId]!;
		if (faction.hitmanCooldown > 0) return false;
		if (faction.tech.armement < INTERCEPT.requiredArmement) return false;
		if (faction.members < INTERCEPT.costMembers) return false;
		for (let i = 0; i < this.territory.count; i += 1) {
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL || owner === factionId) continue;
			if (!this.canAttack(factionId, i)) continue;
			const route = this.convoyTo(i);
			if (!route) continue;
			const victim = this.factions[route.factionId]!;
			faction.members -= INTERCEPT.costMembers;
			faction.hitmanCooldown = INTERCEPT.cooldownTicks;
			this.stealCargo(faction, victim, route.kind);
			this.territory.sabotageUntil[i] = this.tick + INTERCEPT.disruptTicks;
			this.addHeat(i, HEAT.operation);
			if (owner === this.player.id) {
				this.events.push("intercept");
				this.float(i, "convoi intercepté", "loss");
				this.pushLog(`Convoi intercepté (module ${i})`);
			}
			return true;
		}
		return false;
	}

	private pickAiTarget(factionId: number): number | null {
		const leader = this.police.target;
		// Anti-snowball : une fraction des décisions vise le leader, ∝ à sa domination.
		const focusChance =
			leader >= 0 && leader !== factionId
				? Math.max(0, this.controlRatio(leader) - DIPLOMACY.coalitionFloor) *
					DIPLOMACY.leaderFocus
				: 0;
		const focusLeader = focusChance > 0 && this.rng() < focusChance;

		// Battle royale : on achève les faibles pour qu'une partie se conclue.
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
		}
		if (focusLeader && bestLeader !== null) return bestLeader;
		// Priorité à l'élimination : on achève le rival le plus faible s'il est à portée.
		if (bestWeak !== null && this.rng() < 0.6) return bestWeak;
		return best;
	}

	private recount(): void {
		const hour = this.hourOfDay();
		for (let f = 0; f < this.factions.length; f += 1) {
			const c = this.counts[f]!;
			const sab = this.sabotaged[f]!;
			sab.logement = 0;
			sab.labo = 0;
			sab.vente = 0;
			sab.facade = 0;
			sab.planque = 0;
			sab.depot = 0;
			sab.atelier = 0;
			sab.contre = 0;
			c.logement = 0;
			c.labo = 0;
			c.vente = 0;
			c.facade = 0;
			c.planque = 0;
			c.depot = 0;
			c.atelier = 0;
			c.contre = 0;
			this.owned[f] = 0;
			this.recruitDemand[f] = 0;
			this.housingDemand[f] = 0;
			this.retailDemand[f] = 0;
			this.retailWeighted[f] = 0;
			this.launderWealth[f] = 0;
			this.laboWeight[f] = 0;
		}
		for (let i = 0; i < this.territory.count; i += 1) {
			const owner = this.territory.owner[i]!;
			if (owner === NEUTRAL) continue;
			this.owned[owner] = (this.owned[owner] ?? 0) + 1;
			// Marché local : demande (clientele) et richesse (prix) du quartier.
			const demand = this.city.demand[i] ?? 1;
			const wealth = this.city.wealth[i] ?? 1;
			const zone = this.city.modules[i]!;
			this.recruitDemand[owner] = (this.recruitDemand[owner] ?? 0) + demand;
			const buildIndex = this.territory.building[i]!;
			if (buildIndex === NO_BUILDING) continue;
			const type = BUILDING_TYPES[buildIndex];
			if (!type) continue;
			this.counts[owner]![type] += 1;
			// Bonus de zone : le bâtiment produit plus dans une zone favorable.
			// Heures de pointe : le rendement suit l'heure in-game (moyenne 1/jour).
			const bonus = zoneBuildBonus(zone, type) * zoneTimeFactor(zone, type, hour);
			if (type === "logement") {
				this.housingDemand[owner] = (this.housingDemand[owner] ?? 0) + demand * bonus;
			}
			if (type === "labo") this.laboWeight[owner] = (this.laboWeight[owner] ?? 0) + bonus;
			if (type === "vente") {
				this.retailDemand[owner] = (this.retailDemand[owner] ?? 0) + demand * bonus;
				this.retailWeighted[owner] =
					(this.retailWeighted[owner] ?? 0) + demand * wealth * bonus;
			}
			if (type === "facade") {
				this.launderWealth[owner] = (this.launderWealth[owner] ?? 0) + wealth * bonus;
			}
			if (this.territory.sabotageUntil[i]! > this.tick) this.sabotaged[owner]![type] += 1;
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
		this.updateSupply();
	}

	/** Parcours en largeur des quartiers possédés depuis les bâtiments `sourceType`. */
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

	/** Lignes d'approvisionnement : labo → vente → façade, par quartiers possédés. */
	private updateSupply(): void {
		const count = this.territory.count;
		// La topologie ne change qu'aux captures/aménagements : on saute le BFS sinon.
		let signature = 2166136261;
		for (let i = 0; i < count; i += 1) {
			signature = Math.imul(signature ^ (this.territory.owner[i]! + 7), 16777619);
			signature = Math.imul(signature ^ (this.territory.building[i]! + 13), 16777619);
		}
		signature >>>= 0;
		if (signature === this.supplySignature) return;
		this.supplySignature = signature;

		this.convoys = [];
		for (const faction of this.factions) {
			const id = faction.id;
			const labo = this.reachableFrom(id, BUILDING_INDEX.labo);
			const vente = this.reachableFrom(id, BUILDING_INDEX.vente);
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
				if (building === BUILDING_INDEX.vente) {
					totalDemand += demand;
					if (labo.reached[i]) suppliedDemand += demand;
				} else if (building === BUILDING_INDEX.facade) {
					totalWealth += wealth;
					if (vente.reached[i]) suppliedWealth += wealth;
				}
				if (routes >= MAX_CONVOY_ROUTES) continue;
				if (building === BUILDING_INDEX.vente && labo.origin[i]! >= 0 && labo.origin[i] !== i) {
					this.convoys.push({ factionId: id, from: labo.origin[i]!, to: i, kind: "produit" });
					routes += 1;
				} else if (
					building === BUILDING_INDEX.facade &&
					vente.origin[i]! >= 0 &&
					vente.origin[i] !== i
				) {
					this.convoys.push({ factionId: id, from: vente.origin[i]!, to: i, kind: "cash" });
					routes += 1;
				}
			}
			this.retailSupply[id] = totalDemand > 0 ? suppliedDemand / totalDemand : 1;
			this.launderSupply[id] = totalWealth > 0 ? suppliedWealth / totalWealth : 1;
		}
	}

	/** Convois en cours (logistique visible). */
	convoyRoutes(): readonly ConvoyRoute[] {
		return this.convoys;
	}

	/** Part de la vente reliée à un labo (0–1). */
	retailSupplyRatio(factionId: number): number {
		return this.retailSupply[factionId] ?? 1;
	}

	/** Nombre de factions encore en jeu (≥ 1 quartier). */
	aliveCount(): number {
		let alive = 0;
		for (const faction of this.factions) {
			if ((this.owned[faction.id] ?? 0) > 0) alive += 1;
		}
		return alive;
	}

	/**
	 * Puissance d'une faction (classement du battle royale) :
	 * quartiers d'abord, puis Membres, puis Cash propre — départage déterministe.
	 */
	score(factionId: number): number {
		const faction = this.factions[factionId]!;
		return this.modulesOwned(factionId) * 1e6 + faction.members + faction.cashPropre * 1e-3;
	}

	/** Classement déterministe par puissance (quartiers, membres, cash, id). */
	rankings(): number[] {
		return this.factions
			.map((faction) => faction.id)
			.sort((a, b) => {
				const byQuarters = this.modulesOwned(b) - this.modulesOwned(a);
				if (byQuarters !== 0) return byQuarters;
				const byMembers = this.factions[b]!.members - this.factions[a]!.members;
				if (byMembers !== 0) return byMembers;
				const byCash = this.factions[b]!.cashPropre - this.factions[a]!.cashPropre;
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

	/**
	 * Briefing sérialisable d'une partie (graine de multi/replay) : objectif,
	 * progression et rang. Aucune dépendance UI, transportable en JSON.
	 */
	briefing(factionId = this.player.id): Briefing {
		const summary = this.summary(factionId);
		return {
			map: "paris",
			alive: this.aliveCount(),
			control: summary.control,
			clean: summary.cashPropre,
			rank: summary.rank,
			done: this.outcome === "victory",
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

	/** Battle royale : victoire au dernier survivant, défaites causales. */
	private checkOutcome(): void {
		const playerModules = this.modulesOwned(this.player.id);
		if (playerModules === 0) {
			this.outcome = "defeat";
			this.endReason = "Votre cartel a été éliminé.";
			return;
		}
		if (this.aliveCount() === 1) {
			this.outcome = "victory";
			this.endReason = "Dernier cartel en jeu — la ville est à vous.";
			return;
		}
		if (this.brokeTicks >= BANKRUPT_TICKS) {
			this.outcome = "defeat";
			this.endReason = "Faillite : trésorerie à zéro trop longtemps.";
		}
	}

	private pushLog(message: string): void {
		this.log.push(message);
		if (this.log.length > 8) this.log.shift();
	}

	/** Voisins d'un quartier (adjacence fournie par la carte). */
	private neighbors(module: number): readonly number[] {
		return this.city.neighbors[module] ?? EMPTY_NEIGHBORS;
	}
}
