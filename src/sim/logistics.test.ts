import { describe, expect, it } from "vitest";
import { BUILDING_INDEX } from "./buildings";
import { NEUTRAL } from "./territory";
import { World } from "./world";

/** Neutral neighbor of a quarter, excluding `exclude`. */
function neutralNeighbor(world: World, module: number, exclude: number[] = []): number {
	for (const neighbor of world.city.neighbors[module] ?? []) {
		if (neighbor === exclude[0]) continue;
		if (world.territory.owner[neighbor] === NEUTRAL) return neighbor;
	}
	throw new Error("no neutral neighbor");
}

/** Sets up an enemy Lab → Storefront line, the Storefront bordering the player. */
function enemySupplyLine(): { world: World; lab: number; storefront: number } {
	const world = new World(1);
	const spawn = world.city.spawns[0]!;
	const storefront = neutralNeighbor(world, spawn);
	const lab = neutralNeighbor(world, storefront, [spawn]);
	world.territory.owner[storefront] = 1;
	world.territory.control[storefront] = 100;
	world.territory.building[storefront] = BUILDING_INDEX.storefront;
	world.territory.owner[lab] = 1;
	world.territory.control[lab] = 100;
	world.territory.building[lab] = BUILDING_INDEX.lab;
	world.step();
	return { world, lab, storefront };
}

describe("logistics", () => {
	it("a Storefront connected to a Lab is supplied, otherwise not", () => {
		const { world, lab } = enemySupplyLine();
		expect(world.retailSupplyRatio(1)).toBe(1);

		// Remove the Lab: the Storefront no longer has a source.
		world.territory.building[lab] = -1;
		world.step();
		expect(world.retailSupplyRatio(1)).toBe(0);
	});

	it("exposes a Lab → Storefront convoy", () => {
		const { world, lab, storefront } = enemySupplyLine();
		const route = world.convoyRoutes().find((r) => r.from === lab && r.to === storefront);
		expect(route?.factionId).toBe(1);
		expect(route?.kind).toBe("product");
	});

	it("Product is on the road before it is usable", () => {
		const { world } = enemySupplyLine();
		const victim = world.factions[1]!;
		victim.product = 0;
		world.step();
		// Produced, but not delivered yet: no faucet.
		expect(victim.productInTransit).toBeGreaterThan(0);
		expect(victim.product).toBe(0);

		// The convoy eventually arrives and hands the cargo over.
		let delivered = false;
		for (let i = 0; i < 70 && !delivered; i += 1) {
			world.step();
			if (victim.product > 0) delivered = true;
		}
		expect(delivered).toBe(true);
	});

	it("intercepts a convoy: takes the cargo on the road and cuts the line", () => {
		const { world, storefront } = enemySupplyLine();
		const player = world.player;
		player.members = world.interceptCost() + 1000;
		player.tech.armament = 1;
		player.product = 0;

		// Let the Lab load the convoy: what is on the road is what gets taken.
		for (let i = 0; i < 3; i += 1) world.step();
		const route = world.convoyRoutes().find((r) => r.to === storefront)!;
		expect(route.cargo).toBeGreaterThan(0);
		const cargo = route.cargo;

		expect(world.playerCanIntercept(storefront)).toBe(true);
		expect(world.playerIntercept(storefront)).toBe(true);
		expect(player.product).toBeCloseTo(cargo, 6);
		expect(route.cargo).toBe(0);
		expect(world.territory.sabotageUntil[storefront]!).toBeGreaterThan(world.tick);
	});

	it("refuses to intercept an empty convoy", () => {
		const { world, storefront } = enemySupplyLine();
		const player = world.player;
		player.members = world.interceptCost() + 1000;
		player.tech.armament = 1;
		world.convoyRoutes().find((r) => r.to === storefront)!.cargo = 0;
		expect(world.playerCanIntercept(storefront)).toBe(false);
	});

	it("refuses to intercept without a convoy", () => {
		const world = new World(1);
		const spawn = world.city.spawns[0]!;
		const target = neutralNeighbor(world, spawn);
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		world.territory.building[target] = BUILDING_INDEX.storefront;
		world.step();
		expect(world.playerCanIntercept(target)).toBe(false);
	});
});
