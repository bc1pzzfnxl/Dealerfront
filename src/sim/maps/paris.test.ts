import { describe, expect, it } from "vitest";
import { World } from "../world";
import { PARIS_MAP, PARIS_NEIGHBORS, PARIS_ZONES } from "./paris";

/** Garde-fous de la carte Paris (données générées) + run d'intégration. */
describe("carte Paris (IRIS)", () => {
	it("a 992 quartiers nommés et une zone valide", () => {
		expect(PARIS_ZONES).toHaveLength(992);
		expect(PARIS_MAP.neighbors).toHaveLength(992);
		expect(PARIS_ZONES.every((zone) => typeof zone === "string")).toBe(true);
	});

	it("adjacence symétrique, sans boucle ni quartier isolé", () => {
		PARIS_NEIGHBORS.forEach((neighbors, index) => {
			expect(neighbors.length).toBeGreaterThan(0);
			for (const neighbor of neighbors) {
				expect(neighbor).not.toBe(index);
				expect(PARIS_NEIGHBORS[neighbor]).toContain(index);
			}
		});
	});

	it("départs valides et constructibles", () => {
		expect(PARIS_MAP.spawns.length).toBeGreaterThanOrEqual(4);
		for (const spawn of PARIS_MAP.spawns) {
			expect(PARIS_ZONES[spawn]).toBeDefined();
		}
	});

	it("simule une partie sur la carte réelle", () => {
		const world = new World(0);
		expect(world.territory.count).toBe(992);
		for (let i = 0; i < 1500; i += 1) world.step();
		expect(world.modulesOwned(world.player.id)).toBeGreaterThan(0);
		expect(world.log.length).toBeGreaterThan(0);
	});
});
