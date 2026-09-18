import { describe, expect, it } from "vitest";
import { generateCity } from "./city";
import { ZONE_TYPES } from "./types";
import { SimClock } from "./clock";
import { GRID_HEIGHT, GRID_WIDTH, SIM_HZ } from "./constants";
import { createRng } from "./rng";

describe("rng", () => {
	it("est déterministe pour une même seed", () => {
		const a = createRng(42);
		const b = createRng(42);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});

	it("produit des valeurs dans [0, 1)", () => {
		const rng = createRng(7);
		for (let i = 0; i < 1000; i += 1) {
			const value = rng();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe("generateCity", () => {
	it("produit une grille complète et stable par seed", () => {
		const c1 = generateCity(7, "nightlife");
		const c2 = generateCity(7, "nightlife");
		expect(c1.width).toBe(GRID_WIDTH);
		expect(c1.height).toBe(GRID_HEIGHT);
		expect(c1.tiles.length).toBe(GRID_WIDTH * GRID_HEIGHT);
		expect(Array.from(c1.tiles)).toEqual(Array.from(c2.tiles));
	});

	it("produit des indices de zone valides", () => {
		const city = generateCity(1, "residential");
		expect(city.tiles.length).toBe(GRID_WIDTH * GRID_HEIGHT);
		for (const zoneIndex of city.tiles) {
			expect(zoneIndex).toBeLessThan(ZONE_TYPES.length);
		}
	});
});

describe("SimClock", () => {
	it("exécute des pas fixes indépendamment du framerate", () => {
		let ticks = 0;
		const clock = new SimClock(() => {
			ticks += 1;
		}, SIM_HZ);
		// 10 impulsions de 100 ms = 1000 ms → SIM_HZ pas
		for (let i = 0; i < 10; i += 1) {
			clock.advance(100);
		}
		expect(ticks).toBe(SIM_HZ);
	});
});
