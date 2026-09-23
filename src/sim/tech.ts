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

/**
 * Heavy strike (unlocked by Armament ≥ 2): an expensive, **telegraphed** area
 * strike. Everyone sees it coming for `delayTicks`, so it is a threat you can
 * brace for, not a surprise — Counter-intel can blunt it.
 */
export const STRIKE = {
	requiredArmament: 2,
	costClean: 12000,
	costMembers: 1500,
	/** Warning before impact (ticks, 10 Hz). */
	delayTicks: 50,
	/** Cooldown (ticks). */
	cooldownTicks: 900,
	/** Control damage at the epicenter / on the neighbouring quarters. */
	damageCenter: 55,
	damageSplash: 25,
	/** Damage reduction per defender Counter-intel (capped). */
	counterReductionPerUnit: 0.25,
	counterReductionMax: 0.7,
} as const;

/**
 * Mortar (requires 1 Mortar building): precise, cheap — destroys the
 * building on the target quarter and makes it neutral. Visible on UI as
 * "Mortar" building (1 building = 1 function).
 */
export const MORTAR = {
	requiredMortars: 1,
	costClean: 3000,
	costMembers: 600,
	cooldownTicks: 300, // 30s
} as const;
