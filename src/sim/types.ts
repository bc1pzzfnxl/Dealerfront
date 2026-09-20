/**
 * Types partagés du cœur de simulation.
 * Source : docs/city-sim.md, docs/procgen.md.
 */

/** Types de zones urbaines (city-sim.md), déduits du type IRIS pour Paris. */
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

/**
 * Carte jouable : une vraie ville (Paris IRIS).
 * Zones, adjacence, départs et profils économiques par quartier.
 */
export interface CityGrid {
	/** Zone par quartier (longueur = nombre de quartiers). */
	readonly zones: readonly ZoneType[];
	/** Alias de `zones` (compatibilité historique). */
	readonly modules: readonly ZoneType[];
	/** Quartiers adjacents (partage de frontière, pas seulement un coin). */
	readonly neighbors: readonly (readonly number[])[];
	/** Quartiers de départ proposés aux factions. */
	readonly spawns: readonly number[];
	/** Demande locale (clientele) : multiplicateur de vente/recrutement (≈0,5–1,4). */
	readonly demand: Float32Array;
	/** Richesse locale : multiplicateur de prix et de blanchiment (≈0,6–1,4). */
	readonly wealth: Float32Array;
}
