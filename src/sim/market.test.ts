import { describe, expect, it } from "vitest";
import { BUILDING_INDEX, zoneBuildBonus, zoneTimeFactor } from "./buildings";
import { TICKS_PER_HOUR } from "./constants";
import { NEUTRAL } from "./territory";
import type { ZoneType } from "./types";
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

	it("un point de vente sans labo vend quand même (fournisseur extérieur)", () => {
		const world = new World(1);
		const module = firstNeutral(world);
		world.territory.owner[module] = 1;
		world.territory.control[module] = 100;
		world.territory.building[module] = BUILDING_INDEX.vente;
		world.city.demand[module] = 1;
		const faction = world.factions[1]!;
		faction.produit = 0;
		faction.cashSale = 0;
		world.step();
		expect(faction.cashSale).toBeGreaterThan(0);
	});
});

/** Premier quartier neutre de la zone demandée. */
function firstNeutralZone(world: World, zone: ZoneType): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL && world.city.modules[i] === zone) return i;
	}
	throw new Error(`aucun quartier neutre de zone ${zone}`);
}

/** Produit généré par un labo selon la zone du quartier. */
function laboOutput(zone: ZoneType): number {
	const world = new World(1);
	const module = firstNeutralZone(world, zone);
	world.territory.owner[module] = 1;
	world.territory.control[module] = 100;
	world.territory.building[module] = BUILDING_INDEX.labo;
	const faction = world.factions[1]!;
	faction.produit = 0;
	world.step();
	return faction.produit;
}

describe("bonus de zone", () => {
	it("les friches industrielles bonifient les labos", () => {
		expect(laboOutput("industrial")).toBeGreaterThan(laboOutput("residential"));
	});

	it("le résidentiel bonifie le recrutement, pas la production", () => {
		expect(zoneBuildBonus("residential", "logement")).toBeGreaterThan(1);
		expect(zoneBuildBonus("residential", "labo")).toBe(1);
	});

	it("les terrains vagues n'ont aucun bonus", () => {
		expect(zoneBuildBonus("vacant", "labo")).toBe(1);
		expect(zoneBuildBonus("vacant", "logement")).toBe(1);
	});
});

describe("heures de pointe", () => {
	it("la nuit bonifie la vie nocturne, pas le jour", () => {
		expect(zoneTimeFactor("nightlife", "vente", 23)).toBeGreaterThan(1);
		expect(zoneTimeFactor("nightlife", "vente", 11)).toBeLessThan(1);
	});

	it("le commercial vend en journée", () => {
		expect(zoneTimeFactor("commercial", "vente", 13)).toBeGreaterThan(
			zoneTimeFactor("commercial", "vente", 1),
		);
	});

	it("moyenne ~1 sur la journée (équilibre préservé)", () => {
		let sum = 0;
		for (let h = 0; h < 24; h += 1) sum += zoneTimeFactor("nightlife", "vente", h);
		expect(sum / 24).toBeCloseTo(1, 1);
	});

	it("l'horloge avance avec les ticks", () => {
		const world = new World(1);
		const start = world.hourOfDay();
		for (let i = 0; i < TICKS_PER_HOUR; i += 1) world.step();
		expect(world.hourOfDay()).toBeCloseTo((start + 1) % 24, 3);
	});
});
