/**
 * Types partagés du cœur de simulation.
 * Source : docs/city-sim.md, docs/procgen.md, docs/agents.md.
 */

/** Types de zones urbaines (city-sim.md). */
export const ZONE_TYPES = [
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

/** Libellés français des zones (IHM). */
export const ZONE_LABELS: Record<ZoneType, string> = {
	residential: "Résidentiel",
	commercial: "Commercial",
	nightlife: "Vie nocturne",
	industrial: "Industriel",
	park: "Parc",
	police: "Police",
	laundry: "Laverie",
	vacant: "Terrain vague",
};

/** Index stable par zone (stockage compact dans un Uint8Array). */
export const ZONE_INDEX: Record<ZoneType, number> = Object.fromEntries(
	ZONE_TYPES.map((zone, index) => [zone, index]),
) as Record<ZoneType, number>;

/** Profils de génération de ville (procgen.md §Archétypes). */
export const ARCHETYPES = [
	"nightlife",
	"residential",
	"industrial",
	"student",
	"port",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

/** Grille urbaine générée (procgen.md : modules 6×6 sur grille 48×48). */
export interface CityGrid {
	readonly seed: number;
	readonly archetype: Archetype;
	readonly width: number;
	readonly height: number;
	readonly moduleSize: number;
	/** Index de zone par tuile, en row-major (width * height). */
	readonly tiles: Uint8Array;
	/** Zone par module, en row-major (MODULES_W * MODULES_H). */
	readonly modules: readonly ZoneType[];
}
