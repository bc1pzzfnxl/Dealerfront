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

/** Eliminates all AI factions (0 quarters) to leave only the player. */
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

	it("defeat when the player has no quarter left", () => {
		const world = new World(1);
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i]! >= 0) {
				world.territory.owner[i] = NEUTRAL;
				world.territory.control[i] = 60;
			}
		}
		world.step();
		expect(world.outcome).toBe("defeat");
		expect(world.endReason).toContain("eliminated");
	});

	it("declares bankruptcy after a window at zero", () => {
		const world = new World(1);
		world.player.dirtyCash = 0;
		world.player.cleanCash = 0;
		for (let i = 0; i < 320 && world.outcome === null; i += 1) world.step();
		expect(world.outcome).toBe("defeat");
		expect(world.endReason).toContain("Bankruptcy");
	});

	it("resets the bankruptcy window if cash recovers", () => {
		const world = new World(1);
		world.player.dirtyCash = 0;
		for (let i = 0; i < 100; i += 1) {
			world.step();
			if (i === 50) world.player.dirtyCash = 500;
		}
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
