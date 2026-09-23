/**
 * Static map payload — the same shape served at `GET /api/map` and returned by
 * the MCP `get_map` tool. Shared so the MCP tool can build it **in-process**:
 * fetching `/api/map` from inside the Worker is a subrequest back to itself and
 * fails.
 */

import { PARIS_MAP } from "../sim/maps/paris";

export function mapPayload(): {
	count: number;
	zones: readonly string[];
	neighbors: readonly (readonly number[])[];
	spawns: readonly number[];
	demand: number[];
	wealth: number[];
	size: number[];
} {
	// ponytail: round profiles to 2 decimals — saves ~20KB / ~5k tok one-shot, gameplay delta <1% (ratios, no sim change)
	const round2 = (v: number): number => Math.round(v * 100) / 100;
	return {
		count: PARIS_MAP.modules.length,
		zones: PARIS_MAP.modules,
		neighbors: PARIS_MAP.neighbors,
		spawns: PARIS_MAP.spawns,
		demand: Array.from(PARIS_MAP.demand, round2),
		wealth: Array.from(PARIS_MAP.wealth, round2),
		size: Array.from(PARIS_MAP.size, round2),
	};
}
