/**
 * Tech — gear tree driven by Workshops. See docs/tech.md.
 * Workshops provide the **capacity** (max level); Clean cash pays for tiers.
 */

export const TECH_BRANCHES = ["armament", "protection", "logistics"] as const;
export type TechBranch = (typeof TECH_BRANCHES)[number];

export const TECH_LABELS: Record<TechBranch, string> = {
	armament: "Armament",
	protection: "Protection",
	logistics: "Logistics",
};

export const TECH = {
	maxLevel: 5,
	/** Cost(n) = costPerLevel × n (in Clean cash). */
	costPerLevel: 2000,
	/** Attack bonus per Armament tier. */
	attackPerLevel: 0.1,
	/** Defense bonus per Protection tier. */
	defensePerLevel: 0.1,
	/** Member production bonus per Logistics tier. */
	logisticsProduction: 0.2,
	/** Control regeneration bonus per Logistics tier. */
	logisticsControlRegen: 0.2,
} as const;

export function techCost(nextLevel: number): number {
	return TECH.costPerLevel * nextLevel;
}

/** Hitman (unlocked by Armament ≥ 2). */
export const HITMAN = {
	requiredArmament: 2,
	costClean: 3000,
	costMembers: 1000,
	/** Control damage to the targeted quarter. */
	damageCenter: 40,
	/** Control damage to adjacent quarters. */
	damageSplash: 20,
	/** Cooldown (ticks). */
	cooldownTicks: 100,
	/** Damage reduction per defender Counter-intel (capped). */
	counterReductionPerUnit: 0.15,
	counterReductionMax: 0.6,
} as const;
