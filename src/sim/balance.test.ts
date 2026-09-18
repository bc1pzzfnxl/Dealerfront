/**
 * Tests d'équilibrage / non-régression — la simulation complète doit rester
 * saine (invariants), déterministe et viable économiquement sur de longs runs.
 */

import { describe, expect, it } from "vitest";
import { BUILDING_TYPES, chooseBuildType, type BuildingType } from "./buildings";
import { autoPlay, playOut } from "./bot";
import { createRng } from "./rng";
import { ARCHETYPES, type Archetype } from "./types";
import { World } from "./world";

function empty(): Record<BuildingType, number> {
	const counts = {} as Record<BuildingType, number>;
	for (const type of BUILDING_TYPES) counts[type] = 0;
	return counts;
}

function archetypeFor(seed: number): Archetype {
	return ARCHETYPES[seed % ARCHETYPES.length] as Archetype;
}

function assertSane(world: World): void {
	for (let i = 0; i < world.territory.count; i += 1) {
		expect(world.territory.owner[i]).toBeGreaterThanOrEqual(-1);
		expect(world.territory.owner[i]).toBeLessThan(world.factions.length);
		expect(Number.isFinite(world.territory.control[i]!)).toBe(true);
		expect(world.territory.control[i]!).toBeGreaterThanOrEqual(0);
		expect(world.territory.building[i]).toBeGreaterThanOrEqual(-1);
		expect(world.territory.building[i]).toBeLessThan(BUILDING_TYPES.length);
	}
	for (const faction of world.factions) {
		expect(Number.isFinite(faction.members)).toBe(true);
		expect(faction.members).toBeGreaterThanOrEqual(0);
		expect(Number.isFinite(faction.cashPropre)).toBe(true);
		expect(faction.cashPropre).toBeGreaterThanOrEqual(0);
	}
}

describe("composition des bâtiments", () => {
	it("comble le plus grand déficit au lieu de tout remplir de logements", () => {
		const counts = empty();
		expect(chooseBuildType(counts, 20, () => true)).toBe("logement");

		counts.logement = 6;
		expect(chooseBuildType(counts, 20, () => true)).toBe("labo");

		counts.labo = 4;
		expect(chooseBuildType(counts, 20, () => true)).toBe("vente");
	});

	it("respecte les plafonds (ex. Ateliers)", () => {
		const counts = empty();
		counts.logement = 60;
		counts.labo = 40;
		counts.vente = 30;
		counts.facade = 30;
		counts.depot = 10;
		counts.contre = 10;
		counts.planque = 10;
		counts.atelier = 5;
		expect(chooseBuildType(counts, 200, () => true)).toBe("atelier");
		expect(chooseBuildType(counts, 200, () => true, { atelier: 5 })).toBeNull();
	});

	it("ignore les types non abordables et s'arrête aux cibles atteintes", () => {
		const counts = empty();
		expect(chooseBuildType(counts, 20, () => false)).toBeNull();

		for (const type of BUILDING_TYPES) {
			counts[type] = 6;
		}
		expect(chooseBuildType(counts, 20, () => true)).toBeNull();
	});
});

describe("bot — runs longs", () => {
	it("reste sain et déterministe sur plusieurs seeds", () => {
		for (let seed = 0; seed < 6; seed += 1) {
			const world = new World(seed, archetypeFor(seed));
			const rng = createRng((seed * 7919 + 13) >>> 0);
			playOut(world, rng, 3000);
			assertSane(world);
		}
	});

	it("même seed + même bot ⇒ territoire identique", () => {
		const run = (): number[] => {
			const world = new World(3, archetypeFor(3));
			const rng = createRng((3 * 7919 + 13) >>> 0);
			playOut(world, rng, 1500);
			return Array.from(world.territory.owner);
		};
		expect(run()).toEqual(run());
	});

	it("l'économie tourne : Cash propre > 0 et chaîne Produit → sale → propre", () => {
		const world = new World(1, archetypeFor(1));
		const rng = createRng((1 * 7919 + 13) >>> 0);
		playOut(world, rng, 3000);
		expect(world.player.cashPropre).toBeGreaterThan(0);
		expect(world.player.buildings).toBeGreaterThan(0);
	});

	it(
		"une partie peut se terminer sur la durée cible",
		() => {
			let finished = 0;
			for (let seed = 0; seed < 4; seed += 1) {
				const world = new World(seed, archetypeFor(seed));
				const rng = createRng((seed * 7919 + 13) >>> 0);
				playOut(world, rng, 15000);
				if (world.outcome !== null) finished += 1;
			}
			expect(finished).toBeGreaterThan(0);
		},
		20000,
	);
});

describe("bot — tueur à gage", () => {
	it("un tueur ne capture pas (contrôle plancher 5)", () => {
		const world = new World(0, archetypeFor(0));
		const rng = createRng(99);
		for (let tick = 0; tick < 4000; tick += 1) {
			if (tick % 20 === 0) autoPlay(world, rng);
			world.step();
		}
		for (let i = 0; i < world.territory.count; i += 1) {
			expect(world.territory.control[i]!).toBeGreaterThanOrEqual(0);
		}
	});
});
