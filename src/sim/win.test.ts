/**
 * End of game — battle royale: last survivor, bankruptcy, standings.
 * See docs/win-conditions.md and docs/scoring.md.
 */

import { describe, expect, it } from "vitest";
import { NEUTRAL } from "./territory";
import { World } from "./world";

function giveNeutral(world: World, factionId: number, count: number): void {
	let given = 0;
	for (let i = 0; i < world.territory.count && given < count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) {
			world.territory.owner[i] = factionId;
			world.territory.control[i] = 100;
			given += 1;
		}
	}
}

/** Eliminates every faction but 0 (0 quarters each). */
function eliminateRivals(world: World): void {
	for (let i = 0; i < world.territory.count; i += 1) {
		const owner = world.territory.owner[i]!;
		if (owner > 0) {
			world.territory.owner[i] = NEUTRAL;
			world.territory.control[i] = 60;
		}
	}
}

describe("end of game (battle royale)", () => {
	it("no victory while a rival remains", () => {
		const world = new World(1);
		giveNeutral(world, 0, Math.ceil(world.territory.count * 0.6));
		world.player.cleanCash = 5_000_000;
		world.step();
		expect(world.aliveCount()).toBeGreaterThan(1);
		expect(world.outcome).toBeNull();
	});

	it("victory for the last cartel standing", () => {
		const world = new World(1);
		eliminateRivals(world);
		world.step();
		expect(world.aliveCount()).toBe(1);
		expect(world.outcome).toBe("victory");
		expect(world.endReason).toContain("Last cartel");
	});

	it("eliminating a faction doesn't end the game", () => {
		const world = new World(1);
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === 0) {
				world.territory.owner[i] = NEUTRAL;
				world.territory.control[i] = 60;
			}
		}
		world.step();
		expect(world.factions[0]!.eliminated).toBe(true);
		expect(world.aliveCount()).toBe(5);
		expect(world.outcome).toBeNull();
	});

	it("mutual annihilation ends the game with no winner", () => {
		const world = new World(1);
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i]! >= 0) {
				world.territory.owner[i] = NEUTRAL;
				world.territory.control[i] = 60;
			}
		}
		world.step();
		expect(world.aliveCount()).toBe(0);
		expect(world.outcome).toBe("defeat");
		expect(world.endReason).toContain("annihilation");
	});

	it("bankruptcy dismantles the broke faction, game goes on", () => {
		const world = new World(1);
		const broke = world.factions[0]!;
		broke.dirtyCash = 0;
		broke.cleanCash = 0;
		for (let i = 0; i < 320 && world.modulesOwned(0) > 0; i += 1) world.step();
		expect(world.modulesOwned(0)).toBe(0);
		expect(broke.eliminated).toBe(true);
		expect(world.outcome).toBeNull();
	});

	it("resets the bankruptcy window if cash recovers", () => {
		const world = new World(1);
		const broke = world.factions[0]!;
		broke.dirtyCash = 0;
		broke.cleanCash = 0;
		for (let i = 0; i < 100; i += 1) {
			world.step();
			if (i === 50) broke.dirtyCash = 500;
		}
		expect(broke.eliminated).toBe(false);
		expect(world.modulesOwned(0)).toBeGreaterThan(0);
		expect(world.outcome).toBeNull();
	});

	it("ranks by controlled quarters then Members", () => {
		const world = new World(1);
		giveNeutral(world, 1, 10);
		world.step();
		const ranks = world.rankings();
		expect(ranks[0]).toBe(1);
		expect(world.summary(1).rank).toBe(1);
	});

	it("the briefing exposes survivors, rank and progress", () => {
		const world = new World(1);
		world.step();
		const briefing = world.briefing();
		expect(briefing.map).toBe("paris");
		expect(briefing.alive).toBe(world.aliveCount());
		expect(briefing.rank).toBeGreaterThanOrEqual(1);
		expect(briefing.done).toBe(false);
	});
});
