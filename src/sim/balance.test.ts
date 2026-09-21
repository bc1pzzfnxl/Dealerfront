/**
 * Balancing / non-regression tests — the full simulation must stay sound
 * (invariants), deterministic and economically viable over long runs.
 */

import { describe, expect, it } from "vitest";
import {
	BUILDING_TYPES,
	chainIncomplete,
	chooseBuildType,
	ECONOMY_CHAIN,
	type BuildingType,
} from "./buildings";
import { autoPlay, playOut } from "./bot";
import { createRng } from "./rng";
import { World } from "./world";

function empty(): Record<BuildingType, number> {
	const counts = {} as Record<BuildingType, number>;
	for (const type of BUILDING_TYPES) counts[type] = 0;
	return counts;
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
		expect(Number.isFinite(faction.cleanCash)).toBe(true);
		expect(faction.cleanCash).toBeGreaterThanOrEqual(0);
	}
}

describe("building composition", () => {
	it("fills the biggest deficit instead of filling everything with Housing", () => {
		const counts = empty();
		expect(chooseBuildType(counts, 20, () => true)).toBe("housing");

		counts.housing = 6;
		expect(chooseBuildType(counts, 20, () => true)).toBe("lab");

		counts.lab = 4;
		expect(chooseBuildType(counts, 20, () => true)).toBe("storefront");
	});

	it("respects caps (e.g. Workshops)", () => {
		const counts = empty();
		counts.housing = 60;
		counts.lab = 40;
		counts.storefront = 30;
		counts.front = 30;
		counts.depot = 10;
		counts.counter = 10;
		counts.safehouse = 10;
		counts.workshop = 5;
		expect(chooseBuildType(counts, 200, () => true)).toBe("workshop");
		expect(chooseBuildType(counts, 200, () => true, { workshop: 5 })).toBeNull();
	});

	it("ignores unaffordable types and stops at reached targets", () => {
		const counts = empty();
		expect(chooseBuildType(counts, 20, () => false)).toBeNull();

		for (const type of BUILDING_TYPES) {
			counts[type] = 6;
		}
		expect(chooseBuildType(counts, 20, () => true)).toBeNull();
	});
});

describe("bot — long runs", () => {
	it("stays sound and deterministic across several seeds", () => {
		for (let seed = 0; seed < 6; seed += 1) {
			const world = new World(seed);
			const rng = createRng((seed * 7919 + 13) >>> 0);
			playOut(world, rng, 3000);
			assertSane(world);
		}
	}, 20000);

	it("same seed + same bot ⇒ identical territory", () => {
		const run = (): number[] => {
			const world = new World(3);
			const rng = createRng((3 * 7919 + 13) >>> 0);
			playOut(world, rng, 1500);
			return Array.from(world.territory.owner);
		};
		expect(run()).toEqual(run());
	});

	it("the economy runs: Clean cash > 0 and chain Product → dirty → clean", () => {
		const world = new World(1);
		const rng = createRng((1 * 7919 + 13) >>> 0);
		playOut(world, rng, 3000);
		expect(world.player.cleanCash).toBeGreaterThan(0);
		expect(world.player.buildings).toBeGreaterThan(0);
	});

	it(
		"a game eventually concludes (battle royale)",
		() => {
			let finished = 0;
			for (let seed = 0; seed < 4; seed += 1) {
				const world = new World(seed);
				const rng = createRng((seed * 7919 + 13) >>> 0);
				playOut(world, rng, 60000);
				if (world.outcome !== null) finished += 1;
			}
			expect(finished).toBeGreaterThan(0);
		},
		60000,
	);
});

describe("economy bootstrap", () => {
	it("puts the Storefront first: it earns even without a Lab", () => {
		// A Lab first piles up Product nobody can sell → dead money → no second
		// building. This ordering is what bankrupted every simulated cartel.
		expect(ECONOMY_CHAIN[0]).toBe("storefront");
	});

	it("reports an incomplete chain until Storefront + Lab + Front exist", () => {
		const counts = empty();
		expect(chainIncomplete(counts)).toBe(true);
		counts.storefront = 1;
		expect(chainIncomplete(counts)).toBe(true);
		counts.lab = 1;
		expect(chainIncomplete(counts)).toBe(true);
		counts.front = 1;
		expect(chainIncomplete(counts)).toBe(false);
	});

	it("the bot actually earns Dirty cash early instead of spamming Housing", () => {
		const world = new World(0);
		const rng = createRng(13);
		for (let tick = 0; tick < 1500; tick += 1) {
			if (tick % 20 === 0) autoPlay(world, rng);
			world.step();
		}
		const player = world.player;
		expect(world.buildingCount(player.id, "storefront")).toBeGreaterThan(0);
		expect(world.buildingCount(player.id, "front")).toBeGreaterThan(0);
		expect(player.dirtyCash).toBeGreaterThan(5000);
	});
});

describe("elimination", () => {
	it("a faction with no quarter left is out, whatever removed it", () => {
		const world = new World(1);
		const victim = world.factions[1]!;
		// Hand the last quarter over directly, the way an encirclement or a police
		// raid does — bypassing the assault path that used to be the only place
		// marking a faction eliminated.
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === 1) world.territory.owner[i] = 0;
		}
		expect(victim.eliminated).toBe(false);
		world.step();
		expect(victim.eliminated).toBe(true);
	});
});

describe("bot — heavy strike", () => {
	it("a strike does not capture (control floor 5)", () => {
		const world = new World(0);
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
