import { describe, expect, it } from "vitest";
import { World } from "../world";
import { PARIS_MAP, PARIS_NEIGHBORS, PARIS_ZONES } from "./paris";

/** Paris map guardrails (generated data) + integration run. */
describe("Paris map (IRIS)", () => {
	it("has 992 named quarters and a valid zone", () => {
		expect(PARIS_ZONES).toHaveLength(992);
		expect(PARIS_MAP.neighbors).toHaveLength(992);
		expect(PARIS_ZONES.every((zone) => typeof zone === "string")).toBe(true);
	});

	it("symmetric adjacency, no self-loop or isolated quarter", () => {
		PARIS_NEIGHBORS.forEach((neighbors, index) => {
			expect(neighbors.length).toBeGreaterThan(0);
			for (const neighbor of neighbors) {
				expect(neighbor).not.toBe(index);
				expect(PARIS_NEIGHBORS[neighbor]).toContain(index);
			}
		});
	});

	it("valid, buildable spawns", () => {
		expect(PARIS_MAP.spawns.length).toBeGreaterThanOrEqual(4);
		for (const spawn of PARIS_MAP.spawns) {
			expect(PARIS_ZONES[spawn]).toBeDefined();
		}
	});

	it("simulates a game on the real map", () => {
		const world = new World(0);
		expect(world.territory.count).toBe(992);
		for (let i = 0; i < 1500; i += 1) world.step();
		expect(world.modulesOwned(world.player.id)).toBeGreaterThan(0);
		expect(world.log.length).toBeGreaterThan(0);
	});
});

describe("quarter size", () => {
	it("each quarter has a normalized, variable size", () => {
		expect(PARIS_MAP.size.length).toBe(PARIS_MAP.modules.length);
		let min = Number.POSITIVE_INFINITY;
		let max = 0;
		for (const value of PARIS_MAP.size) {
			min = Math.min(min, value);
			max = Math.max(max, value);
		}
		expect(min).toBeGreaterThan(0);
		expect(max).toBeGreaterThan(min);
	});
});
