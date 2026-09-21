/**
 * Player actions — full surface of `World` called by the UI (src/App.tsx).
 * Each test targets a nominal case or a refusal. See docs/economy.md,
 * docs/combat.md, docs/factions.md, docs/police-ai.md, docs/win-conditions.md.
 */

import { describe, expect, it } from "vitest";
import {
	BUILDING_EFFECTS,
	BUILDING_INDEX,
	BUILDINGS,
	BUILD_TICKS,
	CONVERSION_COST,
	type BuildingType,
} from "./buildings";
import { DIPLOMACY, EMBARGO } from "./diplomacy";
import { CONTACT_NAMES, POLICE } from "./police";
import { STRIKE, TECH, techCost } from "./tech";
import { NEUTRAL } from "./territory";
import { World } from "./world";

/** Player spawn (first starting quarter of the map). */
const SPAWN = 0;
/** Immediate neighbor of the spawn (map adjacency). */
const ADJACENT = 6;

/** First neutral module of the map. */
function firstNeutral(world: World): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) return i;
	}
	return -1;
}

/** Gives `factionId` an empty **convertible** neutral quarter accepting `type`. */
function ownConversion(world: World, factionId: number, type: BuildingType, skip = 0): number {
	let seen = 0;
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] !== NEUTRAL) continue;
		if (world.buildingAt(i) !== null || world.constructionLeft(i) > 0) continue;
		if (!world.isConversion(i) || !world.allowedBuildings(i).includes(type)) continue;
		if (seen < skip) {
			seen += 1;
			continue;
		}
		world.territory.owner[i] = factionId;
		world.territory.control[i] = 100;
		return i;
	}
	return -1;
}

/** Gives `factionId` an empty **vacant-lot** neutral quarter accepting `type`. */
function ownVacant(world: World, factionId: number, type: BuildingType): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] !== NEUTRAL) continue;
		if (world.buildingAt(i) !== null || world.constructionLeft(i) > 0) continue;
		if (world.city.modules[i] !== "vacant") continue;
		if (!world.allowedBuildings(i).includes(type)) continue;
		world.territory.owner[i] = factionId;
		world.territory.control[i] = 100;
		return i;
	}
	return -1;
}

/** Gives `count` neutral quarters to `factionId`. */
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

/** Prevents AIs from attacking (avoids their actions interfering with a build site). */
/** Advances until the given build sites finish. */
function finishBuild(world: World, ...modules: number[]): void {
	for (let i = 0; i < 3000; i += 1) {
		if (modules.every((module) => world.constructionLeft(module) === 0)) return;
		world.step();
	}
}

function disarmAi(world: World): void {
	for (let f = 1; f < world.factions.length; f += 1) world.factions[f]!.members = 0;
}

/** Forces a victory (last survivor: all rivals eliminated). */
function forceVictory(world: World): void {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i]! > 0) {
			world.territory.owner[i] = NEUTRAL;
			world.territory.control[i] = 60;
		}
	}
	world.step();
}

/** Control drop at the center of a strike, based on the target's Counter-intel count. */
function strikeCenterDrop(counter: number): number {
	const world = new World(1);
	const player = world.player;
	player.cleanCash = 100000;
	player.members = 100000;
	player.dirtyCash = 100000;
	player.tech.armament = 2;
	const enemy = firstNeutral(world);
	world.territory.owner[enemy] = 1;
	world.territory.control[enemy] = 100;
	let placed = 0;
	for (let i = 0; i < world.territory.count && placed < counter; i += 1) {
		if (i === enemy || world.territory.owner[i] !== NEUTRAL) continue;
		world.territory.owner[i] = 1;
		world.territory.building[i] = BUILDING_INDEX.counter;
		placed += 1;
	}
	// Forced recount: direct edits don't refresh `buildingCount`.
	world.playerBuild(SPAWN, "housing");
	expect(world.playerStrike(enemy)).toBe(true);
	// The strike is telegraphed: it only lands after the warning.
	for (let i = 0; i < STRIKE.delayTicks; i += 1) world.step();
	return 100 - world.controlAt(enemy);
}

describe("construction — refusals", () => {
	it("refuses a quarter not owned", () => {
		const world = new World(1);
		const neutral = firstNeutral(world);
		expect(world.playerCanBuild(neutral, "housing")).toBe(false);
		expect(world.playerBuild(neutral, "housing")).toBe(false);
	});

	it("refuses an already built quarter", () => {
		const world = new World(1);
		world.player.dirtyCash = 100000;
		const module = ownConversion(world, world.player.id, "housing");
		expect(world.playerBuild(module, "housing")).toBe(true);
		expect(world.playerCanBuild(module, "safehouse")).toBe(false);
		expect(world.playerBuild(module, "safehouse")).toBe(false);
	});

	it("refuses a quarter with an ongoing build site", () => {
		const world = new World(1);
		world.player.dirtyCash = 100000;
		const module = ownVacant(world, world.player.id, "lab");
		expect(world.playerBuild(module, "lab")).toBe(true);
		expect(world.constructionLeft(module)).toBe(BUILD_TICKS.lab);
		expect(world.playerCanBuild(module, "housing")).toBe(false);
		expect(world.playerBuild(module, "housing")).toBe(false);
	});

	it("refuses an incompatible zone", () => {
		const world = new World(1);
		let module = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (!world.allowedBuildings(i).includes("workshop")) {
				module = i;
				break;
			}
		}
		expect(module).toBeGreaterThanOrEqual(0);
		world.territory.owner[module] = world.player.id;
		world.territory.control[module] = 100;
		world.player.dirtyCash = 100000;
		world.player.cleanCash = 100000;
		expect(world.playerCanBuild(module, "workshop")).toBe(false);
		expect(world.playerBuild(module, "workshop")).toBe(false);
	});

	it("refuses insufficient resources", () => {
		const world = new World(1);
		world.player.members = 100000;
		world.player.dirtyCash = 0;
		const module = ownConversion(world, world.player.id, "lab");
		expect(world.playerCanBuild(module, "lab")).toBe(false);
		expect(world.playerBuild(module, "lab")).toBe(false);
	});

	it("playerCanAfford is optimistic (conversion cost)", () => {
		const world = new World(1);
		world.player.dirtyCash = BUILDINGS.lab.costSale! * CONVERSION_COST;
		expect(world.playerCanAfford("lab")).toBe(true);
		// But a vacant lot (full cost) stays unaffordable.
		const vacant = ownVacant(world, world.player.id, "lab");
		expect(world.playerCanBuild(vacant, "lab")).toBe(false);
	});
});

describe("construction — conversion vs build site", () => {
	it("conversion costs −50% and takes half the time", () => {
		const world = new World(1);
		world.player.dirtyCash = 10000;
		const module = ownConversion(world, world.player.id, "front");
		expect(module).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(module, "front")).toBe(true);
		expect(world.player.dirtyCash).toBe(10000 - BUILDINGS.front.costSale! * CONVERSION_COST);
		expect(world.buildingAt(module)).toBeNull();
		expect(world.constructionLeft(module)).toBe(Math.round(BUILD_TICKS.front * 0.5));
		expect(world.pendingBuilding(module)).toBe("front");
		finishBuild(world, module);
		expect(world.buildingAt(module)).toBe("front");
	});

	it("new construction on a vacant lot follows BUILD_TICKS", () => {
		const world = new World(1);
		disarmAi(world);
		world.player.dirtyCash = 10000;
		const module = ownVacant(world, world.player.id, "lab");
		expect(module).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(module, "lab")).toBe(true);
		expect(world.player.dirtyCash).toBe(10000 - BUILDINGS.lab.costSale!);
		expect(world.buildingAt(module)).toBeNull();
		expect(world.pendingBuilding(module)).toBe("lab");
		expect(world.constructionLeft(module)).toBe(BUILD_TICKS.lab);
		expect(world.buildingCount(world.player.id, "lab")).toBe(0);

		let ticks = 0;
		while (world.buildingAt(module) === null && ticks < BUILD_TICKS.lab + 5) {
			world.step();
			ticks += 1;
		}
		expect(ticks).toBe(BUILD_TICKS.lab);
		expect(world.buildingAt(module)).toBe("lab");
		expect(world.buildingCount(world.player.id, "lab")).toBe(1);
	});

	it("a build site produces nothing until delivered", () => {
		const world = new World(1);
		disarmAi(world);
		const player = world.player;
		player.dirtyCash = 10000;
		player.product = 0;
		const module = ownVacant(world, player.id, "lab");
		expect(world.playerBuild(module, "lab")).toBe(true);
		for (let i = 0; i < 10; i += 1) world.step();
		expect(player.product).toBe(0);
		expect(world.buildingCount(player.id, "lab")).toBe(0);
	});
});

describe("construction — build site cancellation", () => {
	it("a capture cancels the build site", () => {
		const world = new World(1);
		world.player.dirtyCash = 10000;
		const module = ownVacant(world, world.player.id, "lab");
		expect(world.playerBuild(module, "lab")).toBe(true);
		world.territory.control[module] = 1;
		world.attacks.push({
			factionId: 1,
			source: -1,
			target: module,
			troops: 100000,
			arrivesAt: 0,
			startControl: 1,
			initialTroops: 100000,
		});
		world.step();
		expect(world.ownerAt(module)).toBe(1);
		expect(world.constructionLeft(module)).toBe(0);
		expect(world.pendingBuilding(module)).toBeNull();
	});

	it("a police raid cancels the build site", () => {
		const world = new World(1);
		giveNeutral(world, world.player.id, 40);
		const module = SPAWN;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === world.player.id) world.territory.control[i] = 50;
		}
		world.territory.control[module] = 100;
		world.territory.pending[module] = BUILDING_INDEX.lab;
		world.territory.construction[module] = BUILD_TICKS.lab;
		// The raid now targets the hottest quarters.
		world.heat[module] = 100;
		world.police.pressure = POLICE.raidThreshold + 5;
		world.police.cooldown = 0;
		world.step();
		expect(world.police.lastRaidTick).toBe(world.tick);
		expect(world.constructionLeft(module)).toBe(0);
		expect(world.pendingBuilding(module)).toBeNull();
	});

	it("a hitman cancels the targeted build site", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		player.members = 100000;
		player.tech.armament = 2;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;
		world.territory.pending[enemy] = BUILDING_INDEX.lab;
		world.territory.construction[enemy] = BUILD_TICKS.lab;
		expect(world.playerCanStrike(enemy)).toBe(true);
		expect(world.playerStrike(enemy)).toBe(true);
		// The strike lands after its warning and cancels the build site.
		for (let i = 0; i < STRIKE.delayTicks; i += 1) world.step();
		expect(world.constructionLeft(enemy)).toBe(0);
		expect(world.pendingBuilding(enemy)).toBeNull();
	});
});

describe("attack", () => {
	it("refuses a non-adjacent quarter", () => {
		const world = new World(1);
		const far = world.city.modules.length - 1;
		expect(world.playerCanAttack(far)).toBe(false);
		expect(world.playerAttack(far)).toBe(false);
	});

	it("refuses its own quarter", () => {
		const world = new World(1);
		expect(world.playerCanAttack(SPAWN)).toBe(false);
		expect(world.playerAttack(SPAWN)).toBe(false);
	});

	it("refuses until the minimum commitment is reached", () => {
		const world = new World(1);
		const needed = world.minCommit() / world.commitRatio();
		world.player.members = needed - 1;
		expect(world.playerCanAttack(ADJACENT)).toBe(false);
		expect(world.playerAttack(ADJACENT)).toBe(false);
		world.player.members = needed;
		expect(world.playerCanAttack(ADJACENT)).toBe(true);
	});

	it("captures an adjacent quarter after resolution", () => {
		const world = new World(1);
		const player = world.player;
		expect(world.playerAttack(ADJACENT)).toBe(true);
		for (let i = 0; i < 400 && world.ownerAt(ADJACENT) !== player.id; i += 1) {
			world.step();
		}
		expect(world.ownerAt(ADJACENT)).toBe(player.id);
		expect(world.buildingAt(ADJACENT)).toBeNull();
	});
});

describe("heavy strike", () => {
	it("requires Armament ≥ 2", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		player.members = 100000;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;
		player.tech.armament = STRIKE.requiredArmament - 1;
		expect(world.playerCanStrike(enemy)).toBe(false);
		expect(world.playerStrike(enemy)).toBe(false);
		player.tech.armament = STRIKE.requiredArmament;
		expect(world.playerCanStrike(enemy)).toBe(true);
	});

	it("refuses its own target and neutral quarters", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		player.members = 100000;
		player.tech.armament = STRIKE.requiredArmament;
		expect(world.playerCanStrike(SPAWN)).toBe(false);
		expect(world.playerCanStrike(firstNeutral(world))).toBe(false);
	});

	it("is telegraphed: paid now, lands only after the warning", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		player.members = 100000;
		player.tech.armament = STRIKE.requiredArmament;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;

		const cashBefore = player.cleanCash;
		const membersBefore = player.members;
		expect(world.playerStrike(enemy)).toBe(true);
		// Paid immediately, and visible in flight...
		expect(player.cleanCash).toBe(cashBefore - STRIKE.costClean);
		expect(player.members).toBe(membersBefore - STRIKE.costMembers);
		expect(player.strikeCooldown).toBe(STRIKE.cooldownTicks);
		expect(world.pendingStrikes()).toHaveLength(1);
		// ...but nothing has landed yet.
		expect(world.controlAt(enemy)).toBe(100);
		for (let i = 0; i < STRIKE.delayTicks; i += 1) world.step();
		expect(world.controlAt(enemy)).toBeLessThan(100);
		expect(world.pendingStrikes()).toHaveLength(0);
	});

	it("refuses without enough Clean cash or Members", () => {
		const world = new World(1);
		const player = world.player;
		player.members = 100000;
		player.tech.armament = STRIKE.requiredArmament;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;
		player.cleanCash = STRIKE.costClean - 1;
		expect(world.playerCanStrike(enemy)).toBe(false);
		player.cleanCash = 100000;
		player.members = STRIKE.costMembers - 1;
		expect(world.playerCanStrike(enemy)).toBe(false);
	});

	it("reduces damage via Counter-intel (cap)", () => {
		expect(strikeCenterDrop(0)).toBeCloseTo(STRIKE.damageCenter, 6);
		expect(strikeCenterDrop(4)).toBeCloseTo(
			STRIKE.damageCenter * (1 - STRIKE.counterReductionMax),
			6,
		);
	});

	it("weakens but never captures", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		player.members = 100000;
		player.tech.armament = STRIKE.requiredArmament;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;
		expect(world.playerStrike(enemy)).toBe(true);
		for (let i = 0; i < STRIKE.delayTicks; i += 1) world.step();
		expect(world.ownerAt(enemy)).toBe(1);
		expect(world.controlAt(enemy)).toBeLessThan(100);
	});
});

describe("tech", () => {
	it("one Workshop = one max tier, increasing cost", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 100000;
		expect(world.maxTechLevel(player.id)).toBe(0);
		expect(world.canUpgradeTech(player.id, "armament")).toBe(false);
		expect(world.playerUpgradeTech("armament")).toBe(false);

		const first = ownConversion(world, player.id, "workshop");
		expect(first).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(first, "workshop")).toBe(true);
		finishBuild(world, first);
		expect(world.maxTechLevel(player.id)).toBe(1);

		const before = player.cleanCash;
		expect(world.playerUpgradeTech("armament")).toBe(true);
		expect(player.tech.armament).toBe(1);
		expect(player.cleanCash).toBe(before - techCost(1));
		expect(world.canUpgradeTech(player.id, "armament")).toBe(false);
		expect(world.playerUpgradeTech("armament")).toBe(false);

		const second = ownConversion(world, player.id, "workshop");
		expect(second).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(second, "workshop")).toBe(true);
		finishBuild(world, second);
		expect(world.maxTechLevel(player.id)).toBe(2);
		const beforeSecond = player.cleanCash;
		expect(world.playerUpgradeTech("armament")).toBe(true);
		expect(player.cleanCash).toBe(beforeSecond - techCost(2));
	});

	it("refuses a tier without Clean cash", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = BUILDINGS.workshop.costClean! * CONVERSION_COST;
		const module = ownConversion(world, player.id, "workshop");
		expect(world.playerBuild(module, "workshop")).toBe(true);
		finishBuild(world, module);
		player.cleanCash = 0;
		expect(world.maxTechLevel(player.id)).toBe(1);
		expect(world.canUpgradeTech(player.id, "armament")).toBe(false);
		expect(world.playerUpgradeTech("armament")).toBe(false);
	});

	it("caps the level at TECH.maxLevel", () => {
		const world = new World(1);
		const player = world.player;
		let placed = 0;
		for (let i = 0; i < world.territory.count && placed < 6; i += 1) {
			if (world.territory.owner[i] !== NEUTRAL) continue;
			world.territory.owner[i] = player.id;
			world.territory.control[i] = 100;
			world.territory.building[i] = BUILDING_INDEX.workshop;
			placed += 1;
		}
		expect(placed).toBe(6);
		world.step();
		expect(world.maxTechLevel(player.id)).toBe(TECH.maxLevel);
	});
});

describe("corruption", () => {
	it("lowers Pressure (nominal case)", () => {
		const world = new World(1);
		world.player.cleanCash = 1000000;
		world.police.pressure = 60;
		expect(world.playerCanCorrupt()).toBe(true);
		expect(world.playerCorrupt()).toBe(true);
		expect(world.police.pressure).toBe(60 - POLICE.corruptionReduction);
		expect(world.police.window).toBe(POLICE.corruptionWindow);
	});

	it("raises Pressure if the contact is burned", () => {
		const world = new World(38);
		const before = world.contactName;
		world.player.cleanCash = 1000000;
		world.police.pressure = 60;
		expect(world.playerCorrupt()).toBe(true);
		expect(world.police.pressure).toBe(60 + POLICE.corruptionBurnBacklash);
		expect(world.contactName).not.toBe(before);
		expect(CONTACT_NAMES).toContain(world.contactName);
	});

	it("refuses if Clean cash is insufficient", () => {
		const world = new World(1);
		world.player.cleanCash = 0;
		expect(world.playerCanCorrupt()).toBe(false);
		expect(world.playerCorrupt()).toBe(false);
		expect(world.player.corruptionUses).toBe(0);
	});

	it("increasing cost then capped", () => {
		const world = new World(1);
		world.player.cleanCash = 1_000_000_000;
		let previous = 0;
		for (let use = 0; use < 12; use += 1) {
			const cost = world.playerCorruptionCost();
			expect(cost).toBeGreaterThanOrEqual(previous);
			expect(world.playerCorrupt()).toBe(true);
			previous = cost;
		}
		expect(world.playerCorruptionCost()).toBe(POLICE.corruptionMaxCost);
	});
});

describe("diplomacy — pacts", () => {
	it("proposes an offer, then blocks via cooldown", () => {
		const world = new World(1);
		expect(world.playerProposePact(world.player.id)).toBe(false);
		expect(world.playerProposePact(1)).toBe(true);
		expect(world.offers.length).toBe(1);
		expect(world.playerCanProposePact(1)).toBe(false);
		world.offers.length = 0;
		expect(world.playerCanProposePact(1)).toBe(false);
		world.tick = DIPLOMACY.proposeCooldown;
		expect(world.playerCanProposePact(1)).toBe(true);
	});

	it("accepts a received offer (pact + relation)", () => {
		const world = new World(1);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		expect(world.playerOffers().length).toBe(1);
		expect(world.playerOffers()[0]!.from).toBe(1);
		const before = world.relationBetween(0, 1);
		expect(world.playerRespondToOffer(1, true)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(true);
		expect(world.offers.length).toBe(0);
		expect(world.relationBetween(0, 1)).toBe(Math.min(100, before + 15));
	});

	it("refuses a received offer", () => {
		const world = new World(1);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		expect(world.playerRespondToOffer(1, false)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.offers.length).toBe(0);
		expect(world.log.some((line) => line.includes("refused"))).toBe(true);
	});

	it("refuses to respond to a nonexistent offer", () => {
		const world = new World(1);
		expect(world.playerRespondToOffer(2, true)).toBe(false);
	});

	it("the pact expires at its deadline", () => {
		const world = new World(1);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		world.playerRespondToOffer(1, true);
		const pact = world.pacts[0]!;
		world.tick = pact.until;
		world.step();
		expect(world.hasPact(0, 1)).toBe(false);
	});

	it("betraying breaks the pact, drops the relation and marks the traitor", () => {
		const world = new World(1);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		world.playerRespondToOffer(1, true);
		const before = world.relationBetween(0, 1);
		expect(world.playerBreakPact(1)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(
			Math.max(0, before - DIPLOMACY.betrayalRelationHit),
		);
		expect(world.isTraitor(0)).toBe(true);
		expect(world.playerBreakPact(1)).toBe(false);
	});
});

describe("embargo", () => {
	it("declares, blocks pacts and expires", () => {
		const world = new World(1);
		expect(world.playerEmbargo(world.player.id)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(true);
		expect(world.playerHasEmbargo(1)).toBe(true);
		expect(world.isEmbargoed(1)).toBe(true);
		expect(world.playerCanProposePact(1)).toBe(false);
		expect(world.playerCanEmbargo(1)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(
			DIPLOMACY.initialRelation - EMBARGO.relationHit,
		);

		world.tick = EMBARGO.duration;
		world.step();
		expect(world.playerHasEmbargo(1)).toBe(false);
		expect(world.isEmbargoed(1)).toBe(false);
	});

	it("reduces the target's dirty revenue", () => {
		const sale = (embargo: boolean): number => {
			const world = new World(1);
			const module = firstNeutral(world);
			world.territory.owner[module] = 1;
			world.territory.control[module] = 100;
			world.territory.building[module] = BUILDING_INDEX.storefront;
			const faction = world.factions[1]!;
			faction.product = 1000;
			faction.dirtyCash = 0;
			if (embargo) world.playerEmbargo(1);
			world.step();
			return faction.dirtyCash;
		};
		const normal = sale(false);
		expect(normal).toBeGreaterThan(0);
		// The embargo reduces revenue (modulo upkeep).
		expect(sale(true)).toBeLessThan(normal);
		expect(sale(true)).toBeCloseTo(normal * (1 - EMBARGO.salePenalty), 0);
	});

	it("breaks an existing pact by treating it as a betrayal", () => {
		const world = new World(1);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		world.playerRespondToOffer(1, true);
		const before = world.relationBetween(0, 1);
		expect(world.playerEmbargo(1)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.playerHasEmbargo(1)).toBe(true);
		expect(world.relationBetween(0, 1)).toBe(
			Math.max(0, before - DIPLOMACY.betrayalRelationHit),
		);
		expect(world.isTraitor(0)).toBe(true);
	});
});

describe("end of game", () => {
	it("refuses all actions after a victory", () => {
		const world = new World(1);
		forceVictory(world);
		expect(world.outcome).toBe("victory");
		world.player.members = 100000;
		world.player.dirtyCash = 100000;
		world.player.cleanCash = 100000;
		world.player.tech.armament = STRIKE.requiredArmament;
		world.territory.owner[0] = 1;
		world.territory.control[0] = 100;

		expect(world.playerCanBuild(SPAWN, "housing")).toBe(false);
		expect(world.playerBuild(SPAWN, "housing")).toBe(false);
		expect(world.playerCanAttack(ADJACENT)).toBe(false);
		expect(world.playerAttack(ADJACENT)).toBe(false);
		expect(world.playerCanStrike(0)).toBe(false);
		expect(world.playerStrike(0)).toBe(false);
		expect(world.playerUpgradeTech("armament")).toBe(false);
		expect(world.playerCanCorrupt()).toBe(false);
		expect(world.playerCorrupt()).toBe(false);
		expect(world.playerCanProposePact(1)).toBe(false);
		expect(world.playerProposePact(1)).toBe(false);
		expect(world.playerCanEmbargo(1)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(false);
	});

	it("refuses all actions after a defeat", () => {
		const world = new World(1);
		world.police.pressure = POLICE.liquidation + 1;
		world.step();
		expect(world.outcome).toBe("defeat");
		world.player.members = 100000;
		world.player.dirtyCash = 100000;
		world.player.cleanCash = 100000;
		world.player.tech.armament = STRIKE.requiredArmament;
		world.territory.owner[0] = 1;
		world.territory.control[0] = 100;

		expect(world.playerBuild(SPAWN, "housing")).toBe(false);
		expect(world.playerAttack(ADJACENT)).toBe(false);
		expect(world.playerStrike(0)).toBe(false);
		expect(world.playerUpgradeTech("armament")).toBe(false);
		expect(world.playerCorrupt()).toBe(false);
		expect(world.playerProposePact(1)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(false);
	});

	it("keeps survivors, rank and recap consistent", () => {
		const world = new World(1);
		expect(world.aliveCount()).toBeGreaterThanOrEqual(1);
		expect(world.briefing().map).toBe("paris");
		expect(world.rankings()).toHaveLength(world.factions.length);

		world.player.cleanCash = 10000;
		const line = world.summary();
		expect(line.quarters).toBe(world.modulesOwned(world.player.id));
		expect(line.control).toBeCloseTo(world.controlRatio(world.player.id));
		expect(line.cleanCash).toBe(10000);
		expect(line.rank).toBeGreaterThanOrEqual(1);
		expect(world.score(world.player.id)).toBeGreaterThan(0);
		expect(world.contactName).toBeTruthy();
	});
});

describe("zones", () => {
	it("every quarter accepts at least one building (spawn included)", () => {
		for (const seed of [0, 1, 2, 3, 7]) {
			const world = new World(seed);
			for (let i = 0; i < world.territory.count; i += 1) {
				expect(world.allowedBuildings(i)).toContain("safehouse");
			}
			let spawn = -1;
			for (let i = 0; i < world.territory.count; i += 1) {
				if (world.territory.owner[i] === world.player.id) {
					spawn = i;
					break;
				}
			}
			expect(spawn).toBeGreaterThanOrEqual(0);
			expect(world.allowedBuildings(spawn).length).toBeGreaterThan(0);
			expect(world.isConversion(spawn)).toBe(true);
		}
	});

	it("conversion (built zone) vs vacant lot: cost and zone", () => {
		const world = new World(1);
		let built = -1;
		let vacant = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.isConversion(i) && built < 0) built = i;
			if (world.city.modules[i] === "vacant" && vacant < 0) vacant = i;
		}
		expect(built).toBeGreaterThanOrEqual(0);
		expect(vacant).toBeGreaterThanOrEqual(0);
		expect(world.buildCostFactor(world.player.id, built, "lab")).toBe(CONVERSION_COST);
		expect(world.buildCostFactor(world.player.id, vacant, "lab")).toBe(1);
		expect(world.isConversion(vacant)).toBe(false);
		// Counter-intel is not buildable on a vacant lot.
		expect(world.allowedBuildings(vacant)).not.toContain("counter");
		expect(world.allowedBuildings(vacant)).toContain("workshop");
	});
});

describe("state consistency", () => {
	it("exposes commitRatio, minCommit and defenseAt", () => {
		const world = new World(1);
		expect(world.commitRatio()).toBeGreaterThan(0);
		expect(world.minCommit()).toBeGreaterThan(0);

		const module = ownConversion(world, world.player.id, "safehouse");
		const base = world.defenseAt(module);
		world.player.dirtyCash = 100000;
		expect(world.playerBuild(module, "safehouse")).toBe(true);
		finishBuild(world, module);
		const withSafehouse = world.defenseAt(module);
		expect(withSafehouse).toBeCloseTo(base * BUILDING_EFFECTS.safehouseDefense);

		world.player.tech.protection = 1;
		expect(world.defenseAt(module)).toBeCloseTo(
			withSafehouse * (1 + TECH.defensePerLevel),
		);

		world.player.traitorUntil = world.tick + 10;
		expect(world.defenseAt(module)).toBeCloseTo(
			withSafehouse * (1 + TECH.defensePerLevel) * DIPLOMACY.traitorDefense,
		);
	});

	it("buildingCount / buildingCounts reflect constructions", () => {
		const world = new World(1);
		world.player.dirtyCash = 100000;
		const module = ownConversion(world, world.player.id, "lab");
		expect(world.playerBuild(module, "lab")).toBe(true);
		finishBuild(world, module);
		expect(world.buildingCount(world.player.id, "lab")).toBe(1);
		expect(world.buildingCounts(world.player.id).lab).toBe(1);
	});
});

describe("regressions (fixed bugs)", () => {
	it("refuses to accept or break a pact after the end", () => {
		const world = new World(1);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + 100 });
		world.playerRespondToOffer(1, true);
		expect(world.hasPact(0, 1)).toBe(true);

		forceVictory(world);
		expect(world.playerBreakPact(1)).toBe(false);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + 100 });
		expect(world.playerRespondToOffer(1, true)).toBe(false);
	});

	it("an embargo prevents accepting a pending offer", () => {
		const world = new World(1);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + 100 });
		expect(world.playerEmbargo(1)).toBe(true);
		expect(world.playerOffers().length).toBe(0);
		expect(world.playerRespondToOffer(1, true)).toBe(false);
		expect(world.hasPact(0, 1)).toBe(false);
	});

	it("the contact changes when burned", () => {
		const world = new World(18);
		world.player.cleanCash = 1_000_000;
		world.police.pressure = 60;
		const before = world.contactName;
		world.playerCorrupt();
		expect(world.contactName).not.toBe(before);
	});

	it("canUpgradeTech is false after the end", () => {
		const world = new World(1);
		world.player.cleanCash = 100_000;
		forceVictory(world);
		expect(world.canUpgradeTech(0, "armament")).toBe(false);
	});
});

describe("raid & simultaneous assaults", () => {
	it("the raid weakens an adjacent quarter without capturing it", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 100_000;
		player.members = 100_000;
		const target = ADJACENT;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		world.territory.building[target] = BUILDING_INDEX.safehouse;

		expect(world.playerCanRaid(target)).toBe(true);
		const sale = player.dirtyCash;
		expect(world.playerRaid(target)).toBe(true);
		expect(world.ownerAt(target)).toBe(1);
		expect(world.controlAt(target)).toBe(65);
		expect(world.buildingAt(target)).toBeNull();
		expect(player.dirtyCash).toBe(sale - world.raidCost().sale);
		expect(world.playerCanRaid(target)).toBe(false);
	});

	it("has no cap on simultaneous assaults: the troop pool is the limit", () => {
		const world = new World(1);
		const player = world.player;
		player.members = 100_000;
		// Takes a group of contiguous owned quarters with neutral neighbors.
		const targets = [...(world.city.neighbors[SPAWN] ?? [])];
		for (const target of targets) {
			world.territory.owner[target] = NEUTRAL;
			world.territory.control[target] = 100;
		}
		const before = player.members;
		let launched = 0;
		for (const target of targets) {
			if (world.playerAttack(target)) launched += 1;
		}
		// Every bordering quarter can be pushed at once...
		expect(launched).toBe(targets.length);
		// ...but each one commits troops from the same pool.
		expect(player.members).toBeLessThan(before);
	});

	it("a siege drains the defender's global army (defense has a cost)", () => {
		const world = new World(1);
		const player = world.player;
		const victim = world.factions[1]!;
		const target = world.city.neighbors[SPAWN]![0]!;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		victim.members = 20_000;
		player.members = 1_000_000;
		const before = victim.members;
		expect(world.playerAttack(target)).toBe(true);
		for (let i = 0; i < 20; i += 1) world.step();
		// The defending army pays for holding the line...
		expect(victim.members).toBeLessThan(before);
		// ...and the battle gauge moves.
		expect(world.controlAt(target)).toBeLessThan(100);
	});
});

describe("assault ratio", () => {
	it("is bounded and drives troop commitment", () => {
		const world = new World(1);
		world.playerSetAttackRatio(2);
		expect(world.playerAttackRatio()).toBe(0.6);
		world.playerSetAttackRatio(0);
		expect(world.playerAttackRatio()).toBe(0.05);
		world.playerSetAttackRatio(0.3);
		expect(world.commitRatio()).toBe(0.3);
	});
});

describe("build sites (no queue)", () => {
	it("starts directly, within crew limits", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 100_000;
		player.cleanCash = 100_000;
		const a = ownConversion(world, player.id, "lab");
		const b = ownConversion(world, player.id, "lab");
		const c = ownConversion(world, player.id, "lab");

		expect(world.playerBuild(a, "lab")).toBe(true);
		expect(world.playerBuild(b, "lab")).toBe(true);
		expect(world.activeConstructions(player.id)).toBe(world.buildCrews());
		// Crews busy: no more queue, the 3rd is refused.
		expect(world.playerBuild(c, "lab")).toBe(false);
		expect(world.constructionLeft(c)).toBe(0);

		// A crew frees up → the next build site is possible.
		finishBuild(world, a);
		expect(world.playerBuild(c, "lab")).toBe(true);
		expect(world.constructionLeft(c)).toBeGreaterThan(0);
	});

	it("a build site interrupted by a capture is partially refunded", () => {
		const world = new World(1);
		const player = world.player;
		player.members = 100_000;
		world.playerSetAttackRatio(0.6);
		const target = ADJACENT;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 1;
		const victim = world.factions[1]!;
		victim.dirtyCash = 0;
		// Ongoing build site at the victim's.
		world.territory.pending[target] = BUILDING_INDEX.storefront;
		world.territory.construction[target] = 999;

		expect(world.playerAttack(target)).toBe(true);
		for (let i = 0; i < 40 && world.ownerAt(target) !== player.id; i += 1) world.step();

		expect(world.ownerAt(target)).toBe(player.id);
		// The victim recovers 50% of the interrupted build site's cost.
		expect(victim.dirtyCash).toBeCloseTo(BUILDINGS.storefront.costSale! * 0.5);
	});
});

describe("batch build", () => {
	it("prices then queues the build of empty quarters", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 100_000;
		player.cleanCash = 100_000;
		ownConversion(world, player.id, "lab");
		ownConversion(world, player.id, "lab");

		const preview = world.playerBatchPreview();
		expect(preview.count).toBeGreaterThanOrEqual(2);
		expect(preview.sale + preview.members + preview.clean).toBeGreaterThan(0);

		const built = world.playerBatchBuild();
		expect(built).toBeGreaterThanOrEqual(1);
		expect(world.activeConstructions(player.id)).toBeGreaterThanOrEqual(1);
	});
});

describe("loot (buildings as objectives)", () => {
	it("capturing a built quarter yields a share of the building's value", () => {
		const world = new World(1);
		const player = world.player;
		player.members = 100_000;
		player.dirtyCash = 0;
		world.playerSetAttackRatio(0.6);

		const target = ADJACENT;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 1;
		world.territory.building[target] = BUILDING_INDEX.storefront;
		world.city.demand[target] = 0; // the target doesn't sell during the siege
		const victim = world.factions[1]!;
		victim.dirtyCash = 10_000;

		expect(world.playerAttack(target)).toBe(true);
		for (let i = 0; i < 40 && world.ownerAt(target) !== player.id; i += 1) world.step();

		expect(world.ownerAt(target)).toBe(player.id);
		expect(player.dirtyCash).toBeCloseTo(BUILDINGS.storefront.costSale! * 0.2);
		// Loot is taken (modulo upkeep during the siege ticks).
		expect(victim.dirtyCash).toBeLessThan(10_000 - BUILDINGS.storefront.costSale! * 0.2 + 100);
		expect(victim.dirtyCash).toBeGreaterThan(10_000 - BUILDINGS.storefront.costSale! * 0.2 - 100);
	});
});

describe("bust (armament)", () => {
	it("the bust steals loot without destroying or capturing (Armament ≥ 1)", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 100_000;
		player.members = 100_000;
		player.tech.armament = 1;
		const target = ADJACENT;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		world.territory.building[target] = BUILDING_INDEX.storefront;
		world.factions[1]!.dirtyCash = 10_000;
		const before = player.dirtyCash;

		expect(world.playerCanBust(target)).toBe(true);
		expect(world.playerBust(target)).toBe(true);
		expect(world.ownerAt(target)).toBe(1);
		expect(world.buildingAt(target)).toBe("storefront");
		expect(player.dirtyCash).toBeCloseTo(
			before - world.bustCost().sale + BUILDINGS.storefront.costSale! * 0.2,
		);
	});

	it("without enough Armament, no operation", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 100_000;
		player.members = 100_000;
		const target = ADJACENT;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		world.territory.building[target] = BUILDING_INDEX.storefront;
		expect(world.playerCanBust(target)).toBe(false);
		player.tech.armament = 1;
		expect(world.playerCanBust(target)).toBe(true);
	});

	it("an enemy Watcher foils the bust", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 100_000;
		player.members = 100_000;
		player.tech.armament = 1;
		const target = ADJACENT;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		world.territory.building[target] = BUILDING_INDEX.storefront;
		const lookout = world.city.neighbors[ADJACENT]!.find((neighbor) => neighbor !== SPAWN)!;
		world.territory.owner[lookout] = 1;
		world.territory.building[lookout] = BUILDING_INDEX.counter;
		const before = player.dirtyCash;

		// The op is paid for, but the loot never lands.
		expect(world.playerBust(target)).toBe(true);
		expect(player.dirtyCash).toBeLessThan(before);
	});
});

describe("separate operation cooldowns", () => {
	it("a raid doesn't prevent a bust (distinct cooldowns)", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 1_000_000;
		player.members = 1_000_000;
		player.tech.armament = 3;
		world.territory.owner[ADJACENT] = 1;
		world.territory.control[ADJACENT] = 80;
		world.territory.building[ADJACENT] = BUILDING_INDEX.storefront;

		expect(world.playerRaid(ADJACENT)).toBe(true);
		expect(player.raidCooldown).toBeGreaterThan(0);
		expect(player.bustCooldown).toBe(0);
		// The raid destroyed the building: put it back to test the bust.
		world.territory.building[ADJACENT] = BUILDING_INDEX.storefront;
		expect(world.playerCanBust(ADJACENT)).toBe(true);
	});
});

describe("conquest time ∝ quarter size", () => {
	it("a large quarter resists longer than a small one", () => {
		const capture = (size: number): number => {
			const world = new World(1);
			world.player.members = 1_000_000;
			world.playerSetAttackRatio(0.3);
			const target = ADJACENT;
			world.territory.owner[target] = NEUTRAL;
			world.territory.control[target] = 60;
			world.city.size[target] = size;
			expect(world.playerAttack(target)).toBe(true);
			let ticks = 0;
			while (world.ownerAt(target) !== world.player.id && ticks < 4000) {
				world.step();
				ticks += 1;
			}
			return ticks;
		};
		expect(capture(1.5)).toBeGreaterThan(capture(0.7));
	});
});

describe("war chest (paid armament)", () => {
	it("buying armament increases the attack bonus", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 1_000_000;
		const before = world.attackBonus(player.id);
		const cost = world.armamentCost();
		expect(world.playerBuyArmament()).toBe(true);
		expect(world.attackBonus(player.id)).toBeGreaterThan(before);
		expect(player.cleanCash).toBe(1_000_000 - cost);
		// The next purchase costs more.
		expect(world.armamentCost()).toBeGreaterThan(cost);
	});
});

describe("quarter buyout (Clean cash → territory)", () => {
	it("converts Clean cash into an adjacent neutral quarter", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 1_000_000;
		const target = ADJACENT;
		world.territory.owner[target] = NEUTRAL;
		world.territory.control[target] = 60;
		const cost = world.buyCost(target);

		expect(world.playerCanBuy(target)).toBe(true);
		expect(world.playerBuy(target)).toBe(true);
		expect(world.ownerAt(target)).toBe(player.id);
		expect(player.cleanCash).toBe(1_000_000 - cost);

		// Cooldown: no immediate follow-up on another adjacent neutral quarter.
		expect(player.buyCooldown).toBeGreaterThan(0);
		let next = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === NEUTRAL && world.canAttack(player.id, i)) {
				next = i;
				break;
			}
		}
		if (next >= 0) expect(world.playerCanBuy(next)).toBe(false);
	});

	it("refuses an enemy quarter (buyout only applies to neutral)", () => {
		const world = new World(1);
		world.player.cleanCash = 1_000_000;
		world.territory.owner[ADJACENT] = 1;
		expect(world.playerCanBuy(ADJACENT)).toBe(false);
	});
});

describe("mercenaries (Dirty cash → Members)", () => {
	it("hires Members for Dirty cash, increasing cost", () => {
		const world = new World(1);
		const player = world.player;
		player.dirtyCash = 1_000_000;
		player.members = 0;
		const cost = world.mercCost();
		expect(world.playerCanHireMercenaries()).toBe(true);
		expect(world.playerHireMercenaries()).toBe(true);
		expect(player.members).toBeGreaterThan(0);
		expect(player.dirtyCash).toBe(1_000_000 - cost);
		expect(world.mercCost()).toBeGreaterThan(cost);
	});
});

describe("contract against a gang (Clean cash)", () => {
	it("pays a gang to focus its offensive on a rival", () => {
		const world = new World(1);
		const player = world.player;
		player.cleanCash = 1_000_000;
		expect(world.playerCanFundContract(1)).toBe(true);
		expect(world.playerFundContract(1, 2)).toBe(true);
		expect(world.factions[1]!.contractTarget).toBe(2);
		expect(world.factions[1]!.contractUntil).toBeGreaterThan(world.tick);
	});
});
