import { describe, expect, it } from "vitest";
import { BUILDING_INDEX } from "./buildings";
import { NEUTRAL } from "./territory";
import { World } from "./world";

/** Premier quartier neutre (hors spawns). */
function firstNeutral(world: World): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) return i;
	}
	throw new Error("aucun quartier neutre");
}

/** Vend un stock fixe sur un point de vente, pour une richesse locale donnée. */
function saleAt(wealth: number): number {
	const world = new World(1);
	const module = firstNeutral(world);
	world.territory.owner[module] = 1;
	world.territory.control[module] = 100;
	world.territory.building[module] = BUILDING_INDEX.vente;
	world.city.demand[module] = 1;
	world.city.wealth[module] = wealth;
	const faction = world.factions[1]!;
	faction.produit = 1000;
	faction.cashSale = 0;
	world.step();
	return faction.cashSale;
}

/** Production de membres pour une demande locale donnée (un logement). */
function recruitmentAt(demand: number): number {
	const world = new World(1);
	const module = firstNeutral(world);
	world.territory.owner[module] = 1;
	world.territory.control[module] = 100;
	world.territory.building[module] = BUILDING_INDEX.logement;
	world.city.demand[module] = demand;
	world.step();
	return world.productionPerTick(1);
}

describe("marché local", () => {
	it("vend plus cher dans un quartier riche", () => {
		expect(saleAt(1.4)).toBeGreaterThan(saleAt(0.6));
	});

	it("recrute plus dans un quartier à forte demande", () => {
		expect(recruitmentAt(1.3)).toBeGreaterThan(recruitmentAt(0.5));
	});

	it("reste déterministe (même seed, même résultat)", () => {
		expect(saleAt(1.0)).toBe(saleAt(1.0));
	});
});
