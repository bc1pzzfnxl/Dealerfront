/**
 * Police — anti-leader, raids, liquidation, corruption. Voir docs/police-ai.md.
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

/** Premier quartier neutre. */
function firstNeutral(world: World): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) return i;
	}
	throw new Error("aucun quartier neutre");
}

describe("police", () => {
	it("cible le leader (à égalité, l'id le plus faible)", () => {
		const world = new World(1);
		world.step();
		expect(world.police.target).toBe(0);

		giveNeutral(world, 1, 5);
		world.step();
		expect(world.police.target).toBe(1);
		expect(world.findLeader()).toBe(1);
	});

	it("la Pression monte quand un cartel domine écrasamment et retombe sinon", () => {
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

	it("la corruption fait baisser la Pression (sans immunité sous domination écrasante)", () => {
		const world = new World(1);
		const player = world.player;
		player.cashPropre = 100000;
		world.police.pressure = 60;
		expect(world.playerCorrupt()).toBe(true);
		world.step();
		expect(world.police.pressure).toBeLessThan(60);
	});

	it("un raid retire du Contrôle et détruit un bâtiment du leader", () => {
		const world = new World(1);
		const player = world.player;
		giveNeutral(world, player.id, 5);
		const target = 0;
		expect(world.territory.owner[target]).toBe(player.id);
		player.members = 100000;
		player.cashSale = 100000;
		player.cashPropre = 100000;
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

	it("la liquidation policière échoue le joueur", () => {
		const world = new World(1);
		world.police.pressure = 99;
		world.step();
		expect(world.outcome).toBe("defeat");
		expect(world.endReason).toContain("Liquidation");
	});

	it("la police peut démanteler un gang IA dominant", () => {
		const world = new World(1);
		giveNeutral(world, 1, 10);
		world.step();
		expect(world.findLeader()).toBe(1);
		world.police.pressure = 99;
		world.step();
		expect(world.modulesOwned(1)).toBe(0);
		expect(world.outcome).toBeNull();
	});

	it("le raid policier vise le quartier le plus chaud", () => {
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

	it("l'activité d'un point de vente chauffe le quartier, puis retombe", () => {
		const world = new World(1);
		const module = firstNeutral(world);
		world.territory.owner[module] = 1;
		world.territory.control[module] = 100;
		world.territory.building[module] = BUILDING_INDEX.vente;
		world.step();
		const hot = world.heatAt(module);
		expect(hot).toBeGreaterThan(0);

		world.territory.building[module] = -1;
		for (let i = 0; i < 50; i += 1) world.step();
		expect(world.heatAt(module)).toBeLessThan(hot);
	});

	it("la corruption refroidit les quartiers du cartel", () => {
		const world = new World(1);
		const player = world.player;
		player.cashPropre = 100000;
		const spawn = world.city.spawns[0]!;
		world.heat[spawn] = 80;
		world.police.pressure = 60;
		expect(world.playerCorrupt()).toBe(true);
		expect(world.heatAt(spawn)).toBeCloseTo(40);
	});

	it("corrompre la police coûte cher (coût croissant) et fait varier la Pression", () => {
		const world = new World(1);
		const player = world.player;
		player.cashPropre = 100000;
		world.police.pressure = 80;

		const cost = world.playerCorruptionCost();
		expect(world.playerCorrupt()).toBe(true);
		expect(player.corruptionUses).toBe(1);
		expect(player.cashPropre).toBe(100000 - cost);
		expect([80 - POLICE.corruptionReduction, 80 + POLICE.corruptionBurnBacklash]).toContain(
			world.police.pressure,
		);
		expect(world.playerCorruptionCost()).toBeGreaterThan(cost);

		player.cashPropre = 0;
		expect(world.playerCanCorrupt()).toBe(false);
	});
});
