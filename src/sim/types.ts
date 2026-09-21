/**
 * Shared types of the simulation core.
 * Source: docs/city-sim.md, docs/procgen.md.
 */

/** Urban zone types (city-sim.md), derived from the IRIS type for Paris. */
const ZONE_TYPES = [
	"residential",
	"commercial",
	"nightlife",
	"industrial",
	"park",
	"police",
	"laundry",
	"vacant",
] as const;

export type ZoneType = (typeof ZONE_TYPES)[number];

/** Zone labels (UI). */
export const ZONE_LABELS: Record<ZoneType, string> = {
	residential: "Residential",
	commercial: "Commercial",
	nightlife: "Nightlife",
	industrial: "Industrial",
	park: "Park",
	police: "Police",
	laundry: "Laundromat",
	vacant: "Vacant lot",
};

/**
 * Playable map: a real city (Paris IRIS).
 * Zones, adjacency, spawns and economic profiles per quarter.
 */
export interface CityGrid {
	/** Zone per quarter (length = number of quarters). */
	readonly zones: readonly ZoneType[];
	/** Alias of `zones` (legacy compatibility). */
	readonly modules: readonly ZoneType[];
	/** Adjacent quarters (shared border, not just a corner). */
	readonly neighbors: readonly (readonly number[])[];
	/** Starting quarters offered to factions. */
	readonly spawns: readonly number[];
	/** Local demand (clientele): sales/recruitment multiplier (≈0.5–1.4). */
	readonly demand: Float32Array;
	/** Local wealth: price and laundering multiplier (≈0.6–1.4). */
	readonly wealth: Float32Array;
	/** Relative quarter size (≈0.7–1.5): siege resistance. */
	readonly size: Float32Array;
}
