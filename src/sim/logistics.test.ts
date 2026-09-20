import { describe, expect, it } from "vitest";
import { BUILDING_INDEX } from "./buildings";
import { NEUTRAL } from "./territory";
import { World } from "./world";

/** Voisin neutre d'un quartier, hors `exclude`. */
function neutralNeighbor(world: World, module: number, exclude: number[] = []): number {
	for (const neighbor of world.city.neighbors[module] ?? []) {
		if (neighbor === exclude[0]) continue;
		if (world.territory.owner[neighbor] === NEUTRAL) return neighbor;
	}
	throw new Error("aucun voisin neutre");
}

/** Monte une ligne ennemie labo → vente, la vente étant frontalière du joueur. */
function enemySupplyLine(): { world: World; labo: number; vente: number } {
	const world = new World(1);
	const spawn = world.city.spawns[0]!;
	const vente = neutralNeighbor(world, spawn);
	const labo = neutralNeighbor(world, vente, [spawn]);
	world.territory.owner[vente] = 1;
	world.territory.control[vente] = 100;
	world.territory.building[vente] = BUILDING_INDEX.vente;
	world.territory.owner[labo] = 1;
	world.territory.control[labo] = 100;
	world.territory.building[labo] = BUILDING_INDEX.labo;
	world.step();
	return { world, labo, vente };
}

describe("logistique", () => {
	it("une vente reliée à un labo est approvisionnée, sinon non", () => {
		const { world, labo } = enemySupplyLine();
		expect(world.retailSupplyRatio(1)).toBe(1);

		// On retire le labo : la vente n'a plus de source.
		world.territory.building[labo] = -1;
		world.step();
		expect(world.retailSupplyRatio(1)).toBe(0);
	});

	it("expose un convoi labo → vente", () => {
		const { world, labo, vente } = enemySupplyLine();
		expect(world.convoyRoutes()).toContainEqual({ factionId: 1, from: labo, to: vente, kind: "produit" });
	});

	it("intercepte un convoi : détourne la cargaison et coupe la ligne", () => {
		const { world, vente } = enemySupplyLine();
		const player = world.player;
		const victim = world.factions[1]!;
		victim.produit = 1000;
		player.produit = 0;
		player.members = world.interceptCost() + 1000;
		player.tech.armement = 1;
		player.hitmanCooldown = 0;

		expect(world.playerCanIntercept(vente)).toBe(true);
		expect(world.playerIntercept(vente)).toBe(true);
		expect(player.produit).toBeGreaterThan(0);
		expect(victim.produit).toBeLessThan(1000);
		expect(world.territory.sabotageUntil[vente]!).toBeGreaterThan(world.tick);
	});

	it("refuse d'intercepter sans convoi", () => {
		const world = new World(1);
		const spawn = world.city.spawns[0]!;
		const target = neutralNeighbor(world, spawn);
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		world.territory.building[target] = BUILDING_INDEX.vente;
		world.step();
		expect(world.playerCanIntercept(target)).toBe(false);
	});
});
