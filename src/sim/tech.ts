/**
 * Tech — arbre de matos piloté par les Ateliers. Voir docs/tech.md.
 * Les Ateliers donnent la **capacité** (niveau max) ; le Cash propre paie les paliers.
 */

export const TECH_BRANCHES = ["armement", "protection", "logistique"] as const;
export type TechBranch = (typeof TECH_BRANCHES)[number];

export const TECH_LABELS: Record<TechBranch, string> = {
	armement: "Armement",
	protection: "Protection",
	logistique: "Logistique",
};

export const TECH = {
	maxLevel: 5,
	/** Coût(n) = costPerLevel × n (en Cash propre). */
	costPerLevel: 2000,
	/** Bonus d'attaque par palier d'Armement. */
	attackPerLevel: 0.1,
	/** Bonus de défense par palier de Protection. */
	defensePerLevel: 0.1,
	/** Bonus de production de Membres par palier de Logistique. */
	logistiqueProduction: 0.2,
	/** Bonus de régénération de Contrôle par palier de Logistique. */
	logistiqueControlRegen: 0.2,
} as const;

export function techCost(nextLevel: number): number {
	return TECH.costPerLevel * nextLevel;
}

/** Tueur à gage (débloqué par Armement ≥ 2). */
export const HITMAN = {
	requiredArmement: 2,
	costClean: 3000,
	costMembers: 1000,
	/** Dégâts de Contrôle au quartier visé. */
	damageCenter: 40,
	/** Dégâts de Contrôle aux quartiers adjacents. */
	damageSplash: 20,
	/** Cooldown (ticks). */
	cooldownTicks: 100,
	/** Réduction de dégâts par Contre-espionnage du défenseur (plafonnée). */
	contreReductionPerUnit: 0.15,
	contreReductionMax: 0.6,
} as const;
