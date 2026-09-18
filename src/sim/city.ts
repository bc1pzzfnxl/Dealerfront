/**
 * Génération de ville — squelette déterministe.
 * Placeholder volontairement simple : modules tirés par archétype.
 * Les contraintes dures / budget O/D (procgen.md, difficulty.md) viendront ensuite.
 */

import { MODULE_SIZE, MODULES_H, MODULES_W } from "./constants";
import { createRng, pickWeighted, randInt, type Rng, type Weighted } from "./rng";
import {
	ARCHETYPES,
	type Archetype,
	type CityGrid,
	ZONE_INDEX,
	type ZoneType,
} from "./types";

/**
 * Pondérations de zones par archétype.
 * Volontairement **aérés** : ~30 % d'espaces ouverts (parcs + terrains vagues)
 * pour éviter la ville « pleine de bâtiments » (direction art/level design).
 */
const ARCHETYPE_WEIGHTS: Record<Archetype, readonly Weighted<ZoneType>[]> = {
	nightlife: [
		{ value: "nightlife", weight: 18 },
		{ value: "commercial", weight: 12 },
		{ value: "residential", weight: 11 },
		{ value: "industrial", weight: 4 },
		{ value: "police", weight: 3 },
		{ value: "laundry", weight: 4 },
		{ value: "park", weight: 14 },
		{ value: "vacant", weight: 34 },
	],
	residential: [
		{ value: "residential", weight: 28 },
		{ value: "park", weight: 16 },
		{ value: "commercial", weight: 5 },
		{ value: "industrial", weight: 5 },
		{ value: "police", weight: 3 },
		{ value: "laundry", weight: 3 },
		{ value: "nightlife", weight: 2 },
		{ value: "vacant", weight: 38 },
	],
	industrial: [
		{ value: "industrial", weight: 28 },
		{ value: "residential", weight: 6 },
		{ value: "park", weight: 14 },
		{ value: "commercial", weight: 5 },
		{ value: "police", weight: 4 },
		{ value: "laundry", weight: 4 },
		{ value: "nightlife", weight: 2 },
		{ value: "vacant", weight: 37 },
	],
	student: [
		{ value: "commercial", weight: 14 },
		{ value: "nightlife", weight: 11 },
		{ value: "residential", weight: 12 },
		{ value: "park", weight: 16 },
		{ value: "police", weight: 3 },
		{ value: "laundry", weight: 4 },
		{ value: "industrial", weight: 3 },
		{ value: "vacant", weight: 37 },
	],
	port: [
		{ value: "industrial", weight: 25 },
		{ value: "commercial", weight: 8 },
		{ value: "police", weight: 4 },
		{ value: "residential", weight: 6 },
		{ value: "park", weight: 14 },
		{ value: "laundry", weight: 3 },
		{ value: "nightlife", weight: 2 },
		{ value: "vacant", weight: 38 },
	],
};

/** Un module convertible en espace ouvert (préserve parcs, postes, façades). */
function isBuildingZone(zone: ZoneType): boolean {
	return (
		zone !== "park" &&
		zone !== "police" &&
		zone !== "laundry" &&
		zone !== "vacant"
	);
}

/**
 * Transforme une ligne et une colonne en **boulevard** (modules ouverts),
 * pour donner des axes lisibles et de grands espaces (parcs/postes préservés).
 */
function carveAvenues(modules: ZoneType[], rng: Rng): void {
	const avenueRow = randInt(rng, 2, MODULES_H - 2);
	const avenueCol = randInt(rng, 2, MODULES_W - 2);
	for (let x = 0; x < MODULES_W; x += 1) {
		const index = avenueRow * MODULES_W + x;
		if (isBuildingZone(modules[index]!)) modules[index] = "vacant";
	}
	for (let y = 0; y < MODULES_H; y += 1) {
		const index = y * MODULES_W + avenueCol;
		if (isBuildingZone(modules[index]!)) modules[index] = "vacant";
	}
}

/** Crée quelques places/parcs 2×2 pour des espaces ouverts lisibles. */
function carveOpenAreas(modules: ZoneType[], rng: Rng, count = 3): void {
	for (let c = 0; c < count; c += 1) {
		const originX = randInt(rng, 1, MODULES_W - 3);
		const originY = randInt(rng, 1, MODULES_H - 3);
		const zone: ZoneType = c % 2 === 0 ? "park" : "vacant";
		for (let dy = 0; dy < 2; dy += 1) {
			for (let dx = 0; dx < 2; dx += 1) {
				const index = (originY + dy) * MODULES_W + (originX + dx);
				if (isBuildingZone(modules[index]!)) modules[index] = zone;
			}
		}
	}
}

/** Tire un archétype uniformément (pondérations inter-archétypes à définir). */
export function pickArchetype(rng: Rng): Archetype {
	const weights: readonly Weighted<Archetype>[] = ARCHETYPES.map((value) => ({
		value,
		weight: 1,
	}));
	return pickWeighted(rng, weights);
}

/** Archétype d'une seed **sans** générer la ville (écran de sélection). */
export function archetypeOf(seed: number): Archetype {
	return pickArchetype(createRng(seed));
}

/** Génère une ville déterministe à partir d'une seed. */
export function generateCity(seed: number, archetype?: Archetype): CityGrid {
	const rng = createRng(seed);
	const chosen = archetype ?? pickArchetype(rng);
	const weights = ARCHETYPE_WEIGHTS[chosen];

	const modules: ZoneType[] = [];
	for (let i = 0; i < MODULES_W * MODULES_H; i += 1) {
		modules.push(pickWeighted(rng, weights));
	}
	carveAvenues(modules, rng);
	carveOpenAreas(modules, rng);

	const width = MODULES_W * MODULE_SIZE;
	const height = MODULES_H * MODULE_SIZE;

	// Les tuiles ne sont calculées qu'à la demande (le rendu utilise `modules`).
	let tilesCache: Uint8Array | null = null;
	const buildTiles = (): Uint8Array => {
		const tiles = new Uint8Array(width * height);
		for (let my = 0; my < MODULES_H; my += 1) {
			for (let mx = 0; mx < MODULES_W; mx += 1) {
				const zone = modules[my * MODULES_W + mx]!;
				const zoneIndex = ZONE_INDEX[zone];
				for (let ty = 0; ty < MODULE_SIZE; ty += 1) {
					const row = (my * MODULE_SIZE + ty) * width + mx * MODULE_SIZE;
					for (let tx = 0; tx < MODULE_SIZE; tx += 1) {
						tiles[row + tx] = zoneIndex;
					}
				}
			}
		}
		return tiles;
	};

	return {
		seed,
		archetype: chosen,
		width,
		height,
		moduleSize: MODULE_SIZE,
		modules,
		get tiles(): Uint8Array {
			tilesCache ??= buildTiles();
			return tilesCache;
		},
	};
}

