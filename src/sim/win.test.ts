/**
 * Fin de partie — victoire à double condition, faillite, score. Voir
 * docs/win-conditions.md et docs/scoring.md.
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

describe("fin de partie", () => {
	it("la victoire exige contrôle ET Cash propre", () => {
		const world = new World(1, "nightlife");
		giveNeutral(world, 0, Math.ceil(world.territory.count * 0.63));
		world.step();
		expect(world.controlRatio(0)).toBeGreaterThanOrEqual(0.6);
		expect(world.player.cashPropre).toBe(0);
		expect(world.outcome).toBeNull();

		world.player.cashPropre = world.cleanGoal();
		world.step();
		expect(world.outcome).toBe("victory");
		expect(world.endReason).toContain("Cash propre");
	});

	it("déclare la faillite après une fenêtre à zéro", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 0;
		world.player.cashPropre = 0;
		for (let i = 0; i < 320 && world.outcome === null; i += 1) world.step();
		expect(world.outcome).toBe("defeat");
		expect(world.endReason).toContain("Faillite");
	});

	it("réarme la fenêtre de faillite si la trésorerie remonte", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 0;
		for (let i = 0; i < 100; i += 1) {
			world.step();
			if (i === 50) world.player.cashSale = 500;
		}
		expect(world.outcome).toBeNull();
	});

	it("à l'échéance, classe par score composite", () => {
		const world = new World(1, "nightlife", { timeLimitTicks: 40 });
		world.player.cashPropre = 1000000;
		for (let i = 0; i < 60 && world.outcome === null; i += 1) world.step();
		expect(world.outcome).toBe("victory");
		expect(world.endReason).toContain("Temps écoulé");
		expect(world.summary().rank).toBe(1);
	});

	it("le score est pénalisé par les éliminations et les saisies", () => {
		const world = new World(1, "nightlife");
		world.player.cashPropre = 1000000;
		const base = world.score(0);
		expect(base).toBeGreaterThan(0);

		world.player.eliminations = 3;
		expect(world.score(0)).toBeLessThan(base);

		world.player.eliminations = 0;
		world.player.seizures = 2;
		expect(world.score(0)).toBeLessThan(base);
	});

	it("l'overtime abaisse le seuil de contrôle après l'échéance", () => {
		const standard = new World(1, "nightlife", { timeLimitTicks: 10 });
		expect(standard.victoryControlThreshold()).toBe(0.6);

		const overtime = new World(1, "nightlife", { timeLimitTicks: 10, overtime: true });
		overtime.tick = 10 + 600; // 1 min au-delà
		expect(overtime.victoryControlThreshold()).toBeCloseTo(0.58);
	});
});
