/**
 * Police — faction non jouable anti-leader. Voir docs/police-ai.md.
 * Sa **Pression** monte avec la domination du leader (part de contrôle) et
 * l'activité criminelle ; elle retombe sinon. Elle est **corruptible**.
 */

export const POLICE = {
	max: 100,
	/** Montée / tick ∝ excès de part de contrôle du leader au-delà d'une part « juste ». */
	excessWeight: 0.02,
	/** Montée / tick ∝ signal de crime cumulé (captures récentes). */
	crimeWeight: 0.0015,
	/** Décroissance du signal de crime (par tick). */
	crimeDecay: 0.985,
	/** Décroissance passive de la Pression (par tick). */
	baseDecay: 0.002,
	/**
	 * Plancher de domination : la Pression ne peut pas descendre sous
	 * `excès × dominationFloor` (part de carte du leader au-delà d'une part juste).
	 * La corruption achète un répit, **jamais l'immunité**.
	 */
	dominationFloor: 200,
	/** Paliers. */
	raidThreshold: 40,
	multiThreshold: 70,
	liquidation: 95,
	/** Raid : Contrôle retiré par quartier, cooldown, nb de quartiers visés. */
	raidControl: 25,
	raidCooldown: 600,
	raidsSingle: 1,
	raidsMulti: 3,
	/** Saisie de Cash propre au palier « crackdown ». */
	seizureRatio: 0.1,
	/** Corruption : coût croissant (Cash propre), effet, fenêtre, risque. */
	corruptionBaseCost: 3000,
	corruptionCostGrowth: 1.8,
	corruptionMaxCost: 1_000_000,
	corruptionReduction: 20,
	corruptionWindow: 150,
	corruptionSuppress: 0.02,
	corruptionBurnChance: 0.15,
	corruptionBurnBacklash: 10,
} as const;

/** Noms de contact corrompu (saveur ; le contact peut être « grillé »). */
export const CONTACT_NAMES = [
	"Le Serpent",
	"La Comptable",
	"Le Vieux",
	"Marraine",
	"L'Intendant",
	"Le Frisé",
] as const;

export type PoliceTier = "surveillance" | "raid" | "crackdown" | "liquidation";

export function policeTier(pressure: number): PoliceTier {
	if (pressure >= POLICE.liquidation) return "liquidation";
	if (pressure >= POLICE.multiThreshold) return "crackdown";
	if (pressure >= POLICE.raidThreshold) return "raid";
	return "surveillance";
}

export const POLICE_TIER_LABELS: Record<PoliceTier, string> = {
	surveillance: "Surveillance",
	raid: "Raid ciblé",
	crackdown: "Raid multiple + saisie",
	liquidation: "Liquidation",
};

export interface PoliceState {
	pressure: number;
	/** Faction actuellement visée (leader au plus fort Contrôle), -1 si aucune. */
	target: number;
	/** Ticks avant le prochain raid. */
	cooldown: number;
	/** Ticks restants de corruption active. */
	window: number;
	/** Signal de crime cumulé (décroît chaque tick). */
	crime: number;
	/** Dernier tick où un raid a eu lieu, -1 sinon. */
	lastRaidTick: number;
	/** Nombre de raids déclenchés. */
	raids: number;
	/** Nombre de liquidations (joueur ou IA). */
	liquidations: number;
}
