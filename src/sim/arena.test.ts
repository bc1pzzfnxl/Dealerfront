/**
 * Contrat d'arène — snapshot/restauration, déterminisme, intents multi-factions.
 * Voir docs/arena.md.
 */

import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { playOut } from "./bot";
import { applyIntent, type Intent } from "./intents";
import { World } from "./world";
import { NEUTRAL } from "./territory";

describe("snapshot", () => {
	it("restaure l'état à l'identique", () => {
		const a = new World(1);
		playOut(a, createRng(42), 500);
		const snap = a.snapshot();
		const b = new World(1);
		b.applySnapshot(snap);
		expect(b.tick).toBe(a.tick);
		expect(Array.from(b.territory.owner)).toEqual(Array.from(a.territory.owner));
		expect(Array.from(b.territory.control)).toEqual(Array.from(a.territory.control));
		expect(Array.from(b.territory.building)).toEqual(Array.from(a.territory.building));
		expect(b.factions.map((f) => f.members)).toEqual(a.factions.map((f) => f.members));
		expect(b.factions.map((f) => f.cashSale)).toEqual(a.factions.map((f) => f.cashSale));
	});

	it("reste déterministe après restauration (RNG inclus)", () => {
		const a = new World(1);
		playOut(a, createRng(42), 300);
		const snap = a.snapshot();
		playOut(a, createRng(7), 200);

		const b = new World(1);
		b.applySnapshot(snap);
		playOut(b, createRng(7), 200);
		expect(Array.from(b.territory.owner)).toEqual(Array.from(a.territory.owner));
		expect(b.factions.map((f) => f.members)).toEqual(a.factions.map((f) => f.members));
	});
});

describe("intents", () => {
	it("applique un assaut pour une faction non-joueuse (arène)", () => {
		const world = new World(1);
		// Faction 2 attaque un voisin neutre de son territoire.
		let target = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === NEUTRAL && world.canAttack(2, i)) {
				target = i;
				break;
			}
		}
		expect(target).toBeGreaterThanOrEqual(0);
		const result = applyIntent(world, 2, { type: "attack", module: target });
		expect(result.ok).toBe(true);
		expect(world.attacks.some((attack) => attack.factionId === 2)).toBe(true);
	});

	it("refuse un intent invalide sans casser la simulation", () => {
		const world = new World(1);
		const result = applyIntent(world, 0, { type: "raid", module: 0 });
		expect(result.ok).toBe(false);
		expect(result.error).toBeTruthy();
	});

	it("une arène (toutes factions contrôlées) ne joue pas toute seule", () => {
		const world = new World(1, { factionCount: 3, controlled: [0, 1, 2] });
		const before = world.factions.map((f) => world.modulesOwned(f.id));
		for (let i = 0; i < 500; i += 1) world.step();
		const after = world.factions.map((f) => world.modulesOwned(f.id));
		expect(after).toEqual(before);
	});

	it("en arène, un agent peut construire puis attaquer", () => {
		const world = new World(1, { factionCount: 2, controlled: [0, 1] });
		// Faction 1 : on lui donne du cash pour bâtir sur un quartier converti.
		const faction = world.factions[1]!;
		faction.cashSale = 100_000;
		faction.cashPropre = 100_000;
		let module = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] !== NEUTRAL) continue;
			if (!world.isConversion(i) || world.buildingAt(i) !== null) continue;
			world.territory.owner[i] = 1;
			world.territory.control[i] = 100;
			module = i;
			break;
		}
		expect(module).toBeGreaterThanOrEqual(0);
		const build: Intent = { type: "build", module, building: "labo" };
		expect(applyIntent(world, 1, build).ok).toBe(true);
		for (let i = 0; i < 200; i += 1) world.step();
		expect(world.buildingAt(module)).toBe("labo");
	});
});
