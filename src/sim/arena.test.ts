/**
 * Arena contract — snapshot/restore, determinism, multi-faction intents.
 * No bot: every faction is driven by external agents through `applyIntent`.
 * See docs/arena.md.
 */

import { describe, expect, it } from "vitest";
import { applyIntent, type Intent } from "./intents";
import { World } from "./world";
import { NEUTRAL } from "./territory";

/** Drives every faction with intents, then steps — the agents' side of the table. */
function drive(world: World, ticks: number): void {
	for (let tick = 0; tick < ticks && world.outcome === null; tick += 1) {
		if (tick % 20 === 0) {
			for (const faction of world.factions) {
				applyIntent(world, faction.id, { type: "batchBuild" });
				applyIntent(world, faction.id, { type: "attackBest" });
			}
		}
		world.step();
	}
}

describe("snapshot", () => {
	it("restores the state identically", () => {
		const a = new World(1);
		drive(a, 500);
		const snap = a.snapshot();
		const b = new World(1);
		b.applySnapshot(snap);
		expect(b.tick).toBe(a.tick);
		expect(Array.from(b.territory.owner)).toEqual(Array.from(a.territory.owner));
		expect(Array.from(b.territory.control)).toEqual(Array.from(a.territory.control));
		expect(Array.from(b.territory.building)).toEqual(Array.from(a.territory.building));
		expect(b.factions.map((f) => f.members)).toEqual(a.factions.map((f) => f.members));
		expect(b.factions.map((f) => f.dirtyCash)).toEqual(a.factions.map((f) => f.dirtyCash));
	});

	it("stays deterministic after restoration (RNG included)", () => {
		const a = new World(1);
		drive(a, 300);
		const snap = a.snapshot();
		drive(a, 200);

		const b = new World(1);
		b.applySnapshot(snap);
		drive(b, 200);
		expect(Array.from(b.territory.owner)).toEqual(Array.from(a.territory.owner));
		expect(b.factions.map((f) => f.members)).toEqual(a.factions.map((f) => f.members));
	});
});

describe("intents", () => {
	it("applies an assault for a non-player faction (arena)", () => {
		const world = new World(1);
		// Faction 2 attacks a neutral neighbor of its territory.
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

	it("refuses an invalid intent without breaking the simulation", () => {
		const world = new World(1);
		const result = applyIntent(world, 0, { type: "raid", module: 0 });
		expect(result.ok).toBe(false);
		expect(result.error).toBeTruthy();
	});

	it("factions never act on their own (external agents only)", () => {
		const world = new World(1, { factionCount: 3 });
		const before = world.factions.map((f) => world.modulesOwned(f.id));
		for (let i = 0; i < 500; i += 1) world.step();
		const after = world.factions.map((f) => world.modulesOwned(f.id));
		expect(after).toEqual(before);
		expect(world.attacks).toEqual([]);
	});

	it("in an arena, an agent can build then attack", () => {
		const world = new World(1, { factionCount: 2 });
		// Faction 1: give it cash to build on a converted quarter.
		const faction = world.factions[1]!;
		faction.dirtyCash = 100_000;
		faction.cleanCash = 100_000;
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
		const build: Intent = { type: "build", module, building: "lab" };
		expect(applyIntent(world, 1, build).ok).toBe(true);
		for (let i = 0; i < 200; i += 1) world.step();
		expect(world.buildingAt(module)).toBe("lab");
	});
});
