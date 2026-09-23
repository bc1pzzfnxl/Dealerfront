/**
 * Police — anti-leader, raids, liquidation, corruption. See docs/police-ai.md.
 */

import { describe, expect, it } from "vitest";
import { BUILDING_INDEX } from "./buildings";
import { POLICE } from "./police";
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

/** First neutral quarter. */
function firstNeutral(world: World): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) return i;
	}
	throw new Error("no neutral quarter");
}

describe("police", () => {	it("targets the leader (on a tie, the lowest id)", () => {
		const world = new World(1);
		world.step();
		expect(world.police.target).toBe(0);

		giveNeutral(world, 1, 5);
		world.step();
		expect(world.police.target).toBe(1);
		expect(world.findLeader()).toBe(1);
	});

	it("Pressure rises when a cartel crushes and falls back otherwise", () => {
		const world = new World(1);
		giveNeutral(world, 0, Math.ceil(world.territory.count * 0.85));
		world.step();
		const risen = world.police.pressure;
		expect(risen).toBeGreaterThan(0);

		const calm = new World(1);
		calm.police.pressure = 50;
		calm.police.cooldown = 999;
		calm.step();
		expect(calm.police.pressure).toBeLessThan(50);
	});

	it("corruption lowers Pressure (no immunity under crushing domination)", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		world.police.pressure = 60;
		expect(world.playerCorrupt()).toBe(true);
		world.step();
		expect(world.police.pressure).toBeLessThan(60);
	});

	it("a raid removes Control and destroys a leader's building", () => {
		const world = new World(1);
		const player = world.player;
		giveNeutral(world, player.id, 5);
		const target = 0;
		expect(world.territory.owner[target]).toBe(player.id);
		player.members = 100000;
		player.dirtyCash = 100000;
		player.cleanCash = 100000;
		const type = world.allowedBuildings(target)[0]!;
		expect(world.playerBuild(target, type)).toBe(true);

		world.police.pressure = 45;
		world.police.cooldown = 0;
		const before = world.controlAt(target);
		world.step();

		expect(world.police.lastRaidTick).toBe(world.tick);
		expect(world.police.cooldown).toBeGreaterThan(0);
		expect(world.controlAt(target)).toBeLessThan(before);
		expect(world.buildingAt(target)).toBeNull();
	});

	it("police liquidation dismantles the leader, game goes on", () => {
		const world = new World(1);
		const leader = world.findLeader();
		world.police.pressure = 99;
		world.step();
		expect(world.modulesOwned(leader)).toBe(0);
		expect(world.factions[leader]!.eliminated).toBe(true);
		expect(world.outcome).toBeNull();
	});

	it("the police can dismantle a dominant AI gang", () => {
		const world = new World(1);
		giveNeutral(world, 1, 10);
		world.step();
		expect(world.findLeader()).toBe(1);
		world.police.pressure = 99;
		world.step();
		expect(world.modulesOwned(1)).toBe(0);
		expect(world.outcome).toBeNull();
	});

	it("the police raid targets the hottest quarter", () => {
		const world = new World(1);
		const player = world.player;
		giveNeutral(world, player.id, 5);
		const hot = 3;
		world.heat[hot] = 100;
		world.police.pressure = 45;
		world.police.cooldown = 0;
		const before = world.controlAt(hot);
		world.step();
		expect(world.controlAt(hot)).toBeLessThan(before);
	});

	it("a Storefront's activity heats the quarter, then falls back", () => {
		const world = new World(1);
		const module = firstNeutral(world);
		world.territory.owner[module] = 1;
		world.territory.control[module] = 100;
		world.territory.building[module] = BUILDING_INDEX.storefront;
		world.step();
		const hot = world.heatAt(module);
		expect(hot).toBeGreaterThan(0);

		world.territory.building[module] = -1;
		for (let i = 0; i < 50; i += 1) world.step();
		expect(world.heatAt(module)).toBeLessThan(hot);
	});

	it("corruption cools the cartel's quarters", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		const spawn = world.city.spawns[0]!;
		world.heat[spawn] = 80;
		world.police.pressure = 60;
		expect(world.playerCorrupt()).toBe(true);
		expect(world.heatAt(spawn)).toBeCloseTo(40);
	});

	it("corrupting the police is expensive (increasing cost) and varies Pressure", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		world.police.pressure = 80;

		const cost = world.playerCorruptionCost();
		expect(world.playerCorrupt()).toBe(true);
		expect(player.corruptionUses).toBe(1);
		expect(player.cleanCash).toBe(100000 - cost);
		expect([80 - POLICE.corruptionReduction, 80 + POLICE.corruptionBurnBacklash]).toContain(
			world.police.pressure,
		);
		expect(world.playerCorruptionCost()).toBeGreaterThan(cost);

		player.cleanCash = 0;
		expect(world.playerCanCorrupt()).toBe(false);
	});
});

describe("heat & laundering (anti-lock)", () => {
	it("default laundering leaves Dirty cash to build", () => {
		const world = new World(1);
		expect(world.playerLaunderRatio()).toBeLessThan(1);
	});

	it("a Storefront's heat stabilizes below 100 (normal demand)", () => {
		const world = new World(1);
		const module = firstNeutral(world);
		world.territory.owner[module] = world.player.id;
		world.territory.control[module] = 100;
		world.territory.building[module] = BUILDING_INDEX.storefront;
		world.city.demand[module] = 1;
		for (let t = 0; t < 3000; t += 1) world.step();
		expect(world.heatAt(module)).toBeGreaterThan(10);
		expect(world.heatAt(module)).toBeLessThan(60);
	});
});

describe("paid intel (watchers)", () => {
	it("unpaid watchers blind the intel", () => {
		const world = new World(1);
		const player = world.player;
		const module = firstNeutral(world);
		world.territory.owner[module] = player.id;
		world.territory.control[module] = 100;
		world.territory.building[module] = BUILDING_INDEX.counter;
		player.dirtyCash = 1000;
		world.step();
		expect(player.guardsPaid).toBe(true);
		expect(world.guardsAt(module)).toBeGreaterThan(0);

		// Not a penny left: watchers are no longer paid → blind.
		player.dirtyCash = 0;
		for (let i = 0; i < 5; i += 1) world.step();
		expect(player.guardsPaid).toBe(false);
		expect(world.guardsAt(module)).toBe(0);
	});
});
