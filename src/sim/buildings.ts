/**
 * Buildings — cartel buildings converted from city buildings.
 * See docs/economy.md.
 */

import type { ZoneType } from "./types";

export const BUILDING_TYPES = [
	"housing",
	"lab",
	"storefront",
	"front",
	"safehouse",
	"depot",
	"mortar",
	"counter",
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];

export const NO_BUILDING = -1;
export const BUILDING_INDEX: Record<BuildingType, number> = Object.fromEntries(
	BUILDING_TYPES.map((type, index) => [type, index]),
) as Record<BuildingType, number>;

export interface BuildingSpec {
	type: BuildingType;
	label: string;
	/** Cost (a single currency depending on the building). */
	costMembers?: number;
	costSale?: number;
	costClean?: number;
	/** Marker size (width, height). */
	width: number;
	height: number;
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
	housing: { type: "housing", label: "Recruitment", costMembers: 800, width: 1.6, height: 1.2 },
	lab: { type: "lab", label: "Lab", costSale: 1500, width: 1.4, height: 1.6 },
	storefront: { type: "storefront", label: "Storefront", costSale: 1500, width: 1.8, height: 0.8 },
	front: { type: "front", label: "Front", costSale: 2200, width: 2.0, height: 1.0 },
	safehouse: { type: "safehouse", label: "Safehouse", costSale: 1800, width: 1.6, height: 0.7 },
	depot: { type: "depot", label: "Depot", costSale: 1800, width: 2.2, height: 1.4 },
	mortar: { type: "mortar", label: "Mortar", costClean: 4000, width: 1.6, height: 1.1 },
	counter: { type: "counter", label: "Watcher", costClean: 3000, width: 1.2, height: 1.3 },
};

/** Numeric effects (per tick unless noted). */
export const BUILDING_EFFECTS = {
	/** Members produced per owned quarter. */
	baseMembersPerQuarter: 8,
	/** Members produced per Housing. */
	membersPerHousing: 25,
	/** Product per Lab. */
	productPerLab: 1.5,
	/** Product converted per Storefront and per tick. */
	productPerStorefront: 2,
	/** Dirty cash per unit of product sold. */
	pricePerProduct: 60,
	/** Dirty cash laundered per Front and per tick. */
	cashPerFront: 60,
	/** Laundering commission. */
	commission: 0.25,
	/** Max members added per Depot. */
	maxMembersPerDepot: 2000,
	/** Local defense multiplier of a Safehouse. */
	safehouseDefense: 1.5,
} as const;

/**
 * Upkeep: **Dirty cash per tick** and per building. Big empires are expensive
 * to run — if it isn't paid, production runs slow (×0.5) and **Watchers go
 * blind**. It's the recurring sink that keeps money from sitting idle.
 */
export const BUILDING_UPKEEP: Record<BuildingType, number> = {
	housing: 0.5,
	lab: 1,
	storefront: 1,
	front: 1.5,
	safehouse: 1,
	depot: 1,
	mortar: 2,
	counter: 1.5,
};

/** Production multiplier when upkeep is unpaid. */
export const UNPAID_UPKEEP_FACTOR = 0.5;

/** Cost of a **conversion** (existing building reused): 50% of the full cost. */
export const CONVERSION_COST = 0.5;

/**
 * Increasing cost: each building of the same type makes the next one more
 * expensive. Creates a real trade-off (diversify rather than spam one type).
 */
export const BUILDING_COST_GROWTH = 1.35;

/** Cost factor of the `count`-th building of a type (0 = first). */
export function buildingCostGrowth(count: number): number {
	return BUILDING_COST_GROWTH ** count;
}

/** Duration of a **new construction** (vacant lot), in ticks. Conversion is instant. */
export const BUILD_TICKS: Record<BuildingType, number> = {
	housing: 90,
	lab: 120,
	storefront: 120,
	front: 180,
	safehouse: 180,
	depot: 180,
	mortar: 240,
	counter: 240,
};

/** Conversion (existing building) takes half the time of a new construction. */
export const CONVERSION_TIME = 0.5;

/** Short effect description (decision aid / tooltips). */
export const BUILDING_EFFECT_LABELS: Record<BuildingType, string> = {
	housing: "recruits +25 members/tick (repurposed building)",
	lab: "+1.5 product/tick",
	storefront: "sells product (≈60 dirty/unit)",
	front: "launders 60 dirty cash/tick",
	safehouse: "defense ×1.5",
	depot: "+2000 max members",
	mortar: "mortar strike — destroys building, neutralizes zone",
	counter: "alerts on busts · −15% hitman · hinders busts",
};

/**
 * Bootstrap order of the economy chain. A **Storefront comes first**: it sells
 * straight away thanks to the external supplier (`EXTERNAL_SUPPLY_MARGIN`),
 * while a Lab with nowhere to sell just piles up dead Product. Getting this
 * order wrong bankrupts the bootstrap — no income, so no second building.
 */
export const ECONOMY_CHAIN: readonly BuildingType[] = ["storefront", "lab", "front"];

/**
 * Next missing step of the economy chain, if affordable.
 * As long as it exists, **nothing else** is built: this avoids wasting the
 * bootstrap budget (e.g. a Safehouse before the Lab).
 */
export function missingEconomyStep(
	counts: Record<BuildingType, number>,
	affordable: (type: BuildingType) => boolean,
): BuildingType | null {
	for (const type of ECONOMY_CHAIN) {
		if (counts[type] === 0 && affordable(type)) return type;
	}
	return null;
}

/**
 * True while the economy chain is incomplete: the cartel must **save** for the
 * missing step instead of spending on filler. Without it a broke cartel spams
 * Housing (paid in Members, always affordable) and never earns a single coin.
 */
export function chainIncomplete(counts: Record<BuildingType, number>): boolean {
	return ECONOMY_CHAIN.some((type) => counts[type] === 0);
}

/**
 * Zone → cartel building compatibility (conversion of an existing building).
 * See docs/economy.md §4. The **economy chain** (Housing, Lab, Storefront,
 * Front, Safehouse) is buildable **anywhere**: zoning is no longer a
 * paralyzing blocker but an **incentive** (yield bonus, §zone bonus). Only
 * specialized buildings (Depot, Workshop, Watcher) remain restricted to
 * certain zones.
 */
export const ZONE_BUILDINGS: Record<ZoneType, readonly BuildingType[]> = {
	// Residential buildings: economic core + defense.
	residential: ["housing", "lab", "storefront", "front", "safehouse", "counter"],
	// Shops: economic core + Mortar (back room) + Watcher.
	commercial: ["housing", "lab", "storefront", "front", "safehouse", "mortar", "counter"],
	// Nightlife: economic core + Safehouse (back room).
	nightlife: ["housing", "lab", "storefront", "front", "safehouse"],
	// Industrial wasteland: everything, plus Depot and Mortar.
	industrial: ["housing", "lab", "storefront", "front", "safehouse", "depot", "mortar", "counter"],
	// Laundromats: economic core + Counter-intel.
	laundry: ["housing", "lab", "storefront", "front", "safehouse", "counter"],
	// Repurposed precincts: economic core (Safehouse, Watcher).
	police: ["housing", "lab", "storefront", "front", "safehouse", "counter"],
	// Parks: economic core + hidden Safehouse.
	park: ["housing", "lab", "storefront", "front", "safehouse"],
	// Vacant lots: new construction (nothing to repurpose for recruitment).
	vacant: ["lab", "storefront", "front", "safehouse", "depot", "mortar"],
};

export function canBuildInZone(zone: ZoneType, type: BuildingType): boolean {
	return ZONE_BUILDINGS[zone].includes(type);
}

/**
 * Yield bonus of a building based on the quarter's **zone**.
 * A residential quarter makes Housing more productive, a commercial quarter
 * Storefronts, etc. Multiplier applied to capacity (production/sale/
 * laundering) — never to cost. `1` = no bonus.
 * Specializes territory: you no longer build "anywhere".
 */
export const ZONE_BUILD_BONUS: Record<ZoneType, Partial<Record<BuildingType, number>>> = {
	// Housing: recruitment is most effective here.
	residential: { housing: 1.5, safehouse: 1.15 },
	// Shops: sales rule here, the Front gets a small boost.
	commercial: { storefront: 1.5, front: 1.15 },
	// Nightlife: sales and laundering neck and neck.
	nightlife: { storefront: 1.3, front: 1.3 },
	// Wasteland: production and tooling.
	industrial: { lab: 1.5, mortar: 1.4, depot: 1.3 },
	// Laundromats: maximum laundering.
	laundry: { front: 1.6 },
	// Repurposed precincts: intel.
	police: { counter: 1.6 },
	// Parks: well-hidden Safehouse.
	park: { safehouse: 1.5 },
	// Vacant lots: nothing to boost (new construction).
	vacant: {},
};

export function zoneBuildBonus(zone: ZoneType, type: BuildingType): number {
	return ZONE_BUILD_BONUS[zone]?.[type] ?? 1;
}

/**
 * Rush hour: each zone has an **activity hour** for its flagship building.
 * Yield follows `1 + amplitude × cos(2π(h − peak)/24)`: maximum at the peak,
 * minimum 12h later, average **1** over the day (balance preserved).
 * Adds a day/night rhythm: you can plan your sales/raids.
 */
export const ZONE_RUSH: Partial<
	Record<ZoneType, { type: BuildingType; peakHour: number; amplitude: number }>
> = {
	// Shops: daytime crowds.
	commercial: { type: "storefront", peakHour: 13, amplitude: 0.4 },
	// Nightlife: sales happen at night.
	nightlife: { type: "storefront", peakHour: 23, amplitude: 0.5 },
	// Housing: recruitment in the evening, when people come home.
	residential: { type: "housing", peakHour: 19, amplitude: 0.3 },
	// Wasteland: clandestine production at night.
	industrial: { type: "lab", peakHour: 2, amplitude: 0.2 },
	// Laundromats: laundering during business hours.
	laundry: { type: "front", peakHour: 11, amplitude: 0.15 },
};

export function zoneTimeFactor(zone: ZoneType, type: BuildingType, hour: number): number {
	const rush = ZONE_RUSH[zone];
	if (!rush || rush.type !== type) return 1;
	return 1 + rush.amplitude * Math.cos((2 * Math.PI * (hour - rush.peakHour)) / 24);
}

/** "Built" zones: where an existing building can be converted. */
export const BUILT_ZONES: readonly ZoneType[] = [
	"residential",
	"commercial",
	"nightlife",
	"industrial",
	"laundry",
];

/**
 * Target composition of a domain (share of owned quarters per type).
 * Used by the AI and simulations: fills the biggest deficit, never
 * "the first affordable" (which filled everything with Housing).
 */
export const BUILD_TARGETS: Record<BuildingType, number> = {
	housing: 0.3, // recruitment
	lab: 0.2,
	storefront: 0.15,
	front: 0.15,
	depot: 0.05,
	mortar: 0.05,
	counter: 0.05,
	safehouse: 0.05,
};

export function chooseBuildType(
	counts: Record<BuildingType, number>,
	owned: number,
	affordable: (type: BuildingType) => boolean,
	caps: Partial<Record<BuildingType, number>> = {},
): BuildingType | null {
	if (owned <= 0) return null;
	let best: BuildingType | null = null;
	let bestDeficit = 0;
	for (const type of BUILDING_TYPES) {
		if (!affordable(type)) continue;
		const cap = caps[type];
		if (cap !== undefined && counts[type]! >= cap) continue;
		const deficit = BUILD_TARGETS[type] * owned - counts[type]!;
		if (deficit > bestDeficit) {
			bestDeficit = deficit;
			best = type;
		}
	}
	return best;
}
