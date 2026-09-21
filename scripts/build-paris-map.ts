/**
 * Generates the "real city" Paris map (IRIS) for DealerFront.
 *
 * Source: IRIS 2024 (INSEE / IGN) via OpenDataSoft (992 quarters of the 75).
 * Produces:
 *   - src/sim/maps/paris.ts          → simulation data (zones, adjacency, spawns)
 *   - src/sim/maps/paris-iris.geojson → display geometry (slimmed, property `i`)
 *
 * Usage: bun run scripts/build-paris-map.ts   (cache: data/paris-iris-src.geojson)
 * Deterministic: same inputs → same outputs.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRng, pickWeighted, type Weighted } from "../src/sim/rng";
import type { ZoneType } from "../src/sim/types";

const SOURCE = resolve(import.meta.dir, "../data/paris-iris-src.geojson");
const SIM_OUT = resolve(import.meta.dir, "../src/sim/maps/paris.ts");
const GEO_OUT = resolve(import.meta.dir, "../src/sim/maps/paris-iris.geojson");
const URL =
	"https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-france-iris/exports/geojson?where=dep_code%3D%2275%22&limit=-1";

type Position = [number, number];
type Polygon = Position[][];
type MultiPolygon = Polygon[];

interface Feature {
	type: "Feature";
	geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Polygon | MultiPolygon };
	properties: {
		iris_code: string[];
		iris_name: string[];
		iris_type: string;
		com_arm_name: string[];
		geo_point_2d: { lon: number; lat: number };
	};
}

interface Collection {
	features: Feature[];
}

/** Source IRIS labels are French; strip accents so they can be keyed in English. */
const profileKey = (type: string) =>
	type.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Zone weights per IRIS type. Housing = urban core, activity = industry/commerce. */
const WEIGHTS: Record<string, readonly Weighted<ZoneType>[]> = {
	"iris d'habitat": [
		{ value: "residential", weight: 55 },
		{ value: "commercial", weight: 12 },
		{ value: "nightlife", weight: 8 },
		{ value: "park", weight: 8 },
		{ value: "laundry", weight: 5 },
		{ value: "police", weight: 4 },
		{ value: "vacant", weight: 8 },
	],
	"iris d'activite": [
		{ value: "commercial", weight: 30 },
		{ value: "industrial", weight: 25 },
		{ value: "nightlife", weight: 15 },
		{ value: "vacant", weight: 20 },
		{ value: "park", weight: 10 },
	],
	"iris divers": [
		{ value: "vacant", weight: 30 },
		{ value: "park", weight: 25 },
		{ value: "police", weight: 20 },
		{ value: "industrial", weight: 15 },
		{ value: "laundry", weight: 10 },
	],
};

const BUILT: readonly ZoneType[] = [
	"residential",
	"commercial",
	"nightlife",
	"industrial",
	"laundry",
];

/**
 * Approximate real wealth by arrondissement (INSEE median income).
 * Working-class quarters recruit more, wealthy ones sell for more.
 */
const ARRONDISSEMENT_WEALTH: Record<number, number> = {
	1: 1.25,
	2: 1.1,
	3: 1.05,
	4: 1.1,
	5: 1.15,
	6: 1.35,
	7: 1.45,
	8: 1.4,
	9: 1.1,
	10: 0.9,
	11: 0.95,
	12: 1.0,
	13: 0.85,
	14: 1.0,
	15: 1.05,
	16: 1.45,
	17: 1.1,
	18: 0.7,
	19: 0.7,
	20: 0.65,
};

/** Demand (clientele) per IRIS type. */
const TYPE_DEMAND: Record<string, number> = {
	"iris d'habitat": 1.1,
	"iris d'activite": 0.9,
	"iris divers": 0.65,
};

function hash01(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i += 1) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) / 4294967296;
}

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Scales a series to a mean of 1 (localizing redistributes the total). */
function normalize(values: Float32Array, min: number, max: number): void {
	let sum = 0;
	for (const value of values) sum += value;
	const mean = sum / values.length || 1;
	for (let i = 0; i < values.length; i += 1) {
		values[i] = Math.round(clamp(values[i]! / mean, min, max) * 1000) / 1000;
	}
}

/** Area of a ring (shoelace formula), in degrees² — used as a size proxy. */
function ringArea(ring: Position[]): number {
	let a = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		a += (ring[j]![0]! + ring[i]![0]!) * (ring[j]![1]! - ring[i]![1]!);
	}
	return Math.abs(a / 2);
}

function featureArea(geometry: Feature["geometry"]): number {
	let total = 0;
	for (const polygon of ringsOf(geometry)) total += ringArea(polygon[0]!);
	return total;
}

function ringsOf(geometry: Feature["geometry"]): Polygon[] {
	return geometry.type === "Polygon"
		? [geometry.coordinates as Polygon]
		: (geometry.coordinates as MultiPolygon);
}

async function main(): Promise<void> {
	if (!existsSync(SOURCE)) {
		console.log(`Downloading IRIS 75 → ${SOURCE}`);
		mkdirSync(dirname(SOURCE), { recursive: true });
		const response = await fetch(URL);
		if (!response.ok) throw new Error(`IRIS download failed (${response.status})`);
		await Bun.write(SOURCE, response);
	}
	const collection = JSON.parse(readFileSync(SOURCE, "utf8")) as Collection;
	const features = collection.features;
	console.log(`${features.length} IRIS quarters`);

	// 1. Deterministic zones per quarter (seed = IRIS code).
	const codes = features.map((f) => f.properties.iris_code[0]!);
	const centroids = features.map(
		(f) => [f.properties.geo_point_2d.lon, f.properties.geo_point_2d.lat] as Position,
	);
	const zones: ZoneType[] = features.map((f, i) => {
		const rng = createRng(Number(codes[i]!) >>> 0);
		const weights = WEIGHTS[profileKey(f.properties.iris_type)] ?? WEIGHTS["iris divers"]!;
		return pickWeighted(rng, weights);
	});

	// 1b. Profiles: demand (IRIS type) and wealth (real arrondissement).
	const demand = new Float32Array(features.length);
	const wealth = new Float32Array(features.length);
	features.forEach((feature, i) => {
		const code = codes[i]!;
		const typeDemand = TYPE_DEMAND[profileKey(feature.properties.iris_type)] ?? 0.7;
		const arrondissement = Number(/(\d+)/.exec(feature.properties.com_arm_name[0] ?? "")?.[1] ?? 0);
		const arrondissementWealth = ARRONDISSEMENT_WEALTH[arrondissement] ?? 0.9;
		demand[i] = round3(clamp(typeDemand + (hash01(`${code}d`) - 0.5) * 0.4, 0.4, 1.4));
		wealth[i] = round3(
			clamp(arrondissementWealth + (hash01(`${code}w`) - 0.5) * 0.2, 0.5, 1.4),
		);
	});
	// Localizing redistributes, doesn't change the total: mean scaled to 1.
	normalize(demand, 0.4, 1.4);
	normalize(wealth, 0.5, 1.4);

	// 1c. Size: square root of area, normalized (mean 1, bounded 0.7–1.5).
	// A large quarter offers more Control to drain during a siege.
	const size = new Float32Array(features.length);
	features.forEach((feature, i) => {
		size[i] = Math.sqrt(featureArea(feature.geometry));
	});
	normalize(size, 0.7, 1.5);

	// 2. Adjacency: quarters sharing ≥ 2 vertices (common border).
	const neighbors = adjacent(features);

	// 3. Spawns: 4 built quarters farthest apart (greedy sampling).
	const spawns = pickSpawns(centroids, zones);

	// 4. Outputs.
	mkdirSync(dirname(SIM_OUT), { recursive: true });
	writeFileSync(SIM_OUT, emitSim(centroids, zones, neighbors, spawns, demand, wealth, size));
	writeFileSync(GEO_OUT, emitGeo(features));
	console.log(`→ ${SIM_OUT}`);
	console.log(`→ ${GEO_OUT}`);
}

/** Adjacency by shared vertices (at least two → border, not a corner). */
function adjacent(features: Feature[]): number[][] {
	const vertex = new Map<string, Set<number>>();
	const key = (p: Position) => `${p[0]!.toFixed(6)},${p[1]!.toFixed(6)}`;
	features.forEach((feature, i) => {
		for (const polygon of ringsOf(feature.geometry)) {
			for (const ring of polygon) {
				for (const point of ring) {
					let set = vertex.get(key(point));
					if (!set) vertex.set(key(point), (set = new Set()));
					set.add(i);
				}
			}
		}
	});
	const shared = new Map<number, number>();
	const bump = (a: number, b: number) => {
		const k = a < b ? a * 100000 + b : b * 100000 + a;
		shared.set(k, (shared.get(k) ?? 0) + 1);
	};
	for (const set of vertex.values()) {
		const list = [...set];
		for (let a = 0; a < list.length; a += 1) {
			for (let b = a + 1; b < list.length; b += 1) bump(list[a]!, list[b]!);
		}
	}
	const out: number[][] = features.map(() => []);
	for (const [k, count] of shared) {
		if (count < 2) continue;
		const a = Math.floor(k / 100000);
		const b = k % 100000;
		out[a]!.push(b);
		out[b]!.push(a);
	}
	return out.map((list) => list.sort((x, y) => x - y));
}

/** Greedy farthest-point sampling among built zones. */
function pickSpawns(centroids: Position[], zones: ZoneType[], count = 4): number[] {
	const candidates = zones
		.map((zone, i) => ({ zone, i }))
		.filter(({ zone }) => BUILT.includes(zone))
		.map(({ i }) => i);
	const chosen: number[] = [candidates[0]!];
	const dist = (a: number, b: number) =>
		(centroids[a]![0] - centroids[b]![0]) ** 2 + (centroids[a]![1] - centroids[b]![1]) ** 2;
	while (chosen.length < count && chosen.length < candidates.length) {
		let best = -1;
		let bestDist = -1;
		for (const candidate of candidates) {
			const nearest = Math.min(...chosen.map((c) => dist(c, candidate)));
			if (nearest > bestDist) {
				bestDist = nearest;
				best = candidate;
			}
		}
		chosen.push(best);
	}
	return chosen;
}

function emitSim(
	centroids: Position[],
	zones: ZoneType[],
	neighbors: number[][],
	spawns: number[],
	demand: Float32Array,
	wealth: Float32Array,
	size: Float32Array,
): string {
	const arr = (items: unknown[]) => `[${items.map((x) => JSON.stringify(x)).join(",")}]`;
	const floats = (items: Float32Array) => `Float32Array.from([${items.join(",")}])`;
	return `/**
 * Paris — "real city" map (992 IRIS quarters). GENERATED, do not edit.
 * See scripts/build-paris-map.ts and docs/procgen.md.
 */

import type { CityGrid, ZoneType } from "../types";

export const PARIS_CENTROIDS: readonly (readonly [number, number])[] = ${arr(centroids)};
export const PARIS_ZONES: readonly ZoneType[] = ${arr(zones)};
export const PARIS_NEIGHBORS: readonly (readonly number[])[] = ${arr(neighbors)};
export const PARIS_SPAWNS: readonly number[] = ${arr(spawns)};
export const PARIS_DEMAND: Float32Array = ${floats(demand)};
export const PARIS_WEALTH: Float32Array = ${floats(wealth)};
export const PARIS_SIZE: Float32Array = ${floats(size)};

/** Playable Paris map (992 IRIS quarters), rendered with mapcn/MapLibre. */
export const PARIS_MAP: CityGrid = {
	zones: PARIS_ZONES,
	modules: PARIS_ZONES,
	neighbors: PARIS_NEIGHBORS,
	spawns: PARIS_SPAWNS,
	demand: PARIS_DEMAND,
	wealth: PARIS_WEALTH,
	size: PARIS_SIZE,
};
`;
}

function emitGeo(features: Feature[]): string {
	const slim = {
		type: "FeatureCollection" as const,
		features: features.map((feature, i) => ({
			type: "Feature" as const,
			geometry: roundGeometry(feature.geometry),
			properties: {
				i,
				code: feature.properties.iris_code[0]!,
				name: feature.properties.iris_name[0]!,
			},
		})),
	};
	return JSON.stringify(slim);
}

function roundGeometry(geometry: Feature["geometry"]): Feature["geometry"] {
	const round = (p: Position): Position => [Number(p[0]!.toFixed(5)), Number(p[1]!.toFixed(5))];
	if (geometry.type === "Polygon") {
		return { type: "Polygon", coordinates: geometry.coordinates.map((r) => r.map(round)) };
	}
	return {
		type: "MultiPolygon",
		coordinates: (geometry.coordinates as MultiPolygon).map((p) => p.map((r) => r.map(round))),
	};
}

main();
