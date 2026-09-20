/**
 * Fin de partie — battle royale : dernier survivant, faillite, classement.
 * Voir docs/win-conditions.md et docs/scoring.md.
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

/** Élimine toutes les factions IA (0 quartier) pour ne laisser que le joueur. */
function eliminateRivals(world: World): void {
	for (let i = 0; i < world.territory.count; i += 1) {
		const owner = world.territory.owner[i]!;
		if (owner > 0) {
			world.territory.owner[i] = NEUTRAL;
			world.territory.control[i] = 60;
		}
	}
}

describe("fin de partie (battle royale)", () => {
	it("aucune victoire tant qu'il reste un rival", () => {
		const world = new World(1);
		giveNeutral(world, 0, Math.ceil(world.territory.count * 0.6));
		world.player.cashPropre = 5_000_000;
		world.step();
		expect(world.aliveCount()).toBeGreaterThan(1);
		expect(world.outcome).toBeNull();
	});

	it("victoire au dernier cartel en jeu", () => {
		const world = new World(1);
		eliminateRivals(world);
		world.step();
		expect(world.aliveCount()).toBe(1);
		expect(world.outcome).toBe("victory");
		expect(world.endReason).toContain("Dernier cartel");
	});

	it("défaite quand le joueur n'a plus de quartier", () => {
		const world = new World(1);
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i]! >= 0) {
				world.territory.owner[i] = NEUTRAL;
				world.territory.control[i] = 60;
			}
		}
		world.step();
		expect(world.outcome).toBe("defeat");
		expect(world.endReason).toContain("éliminé");
	});

	it("déclare la faillite après une fenêtre à zéro", () => {
		const world = new World(1);
		world.player.cashSale = 0;
		world.player.cashPropre = 0;
		for (let i = 0; i < 320 && world.outcome === null; i += 1) world.step();
		expect(world.outcome).toBe("defeat");
		expect(world.endReason).toContain("Faillite");
	});

	it("réarme la fenêtre de faillite si la trésorerie remonte", () => {
		const world = new World(1);
		world.player.cashSale = 0;
		for (let i = 0; i < 100; i += 1) {
			world.step();
			if (i === 50) world.player.cashSale = 500;
		}
		expect(world.outcome).toBeNull();
	});

	it("classe par quartiers contrôlés puis Membres", () => {
		const world = new World(1);
		giveNeutral(world, 1, 10);
		world.step();
		const ranks = world.rankings();
		expect(ranks[0]).toBe(1);
		expect(world.summary(1).rank).toBe(1);
	});

	it("le briefing expose survivants, rang et progression", () => {
		const world = new World(1);
		world.step();
		const briefing = world.briefing();
		expect(briefing.map).toBe("paris");
		expect(briefing.alive).toBe(world.aliveCount());
		expect(briefing.rank).toBeGreaterThanOrEqual(1);
		expect(briefing.done).toBe(false);
	});
});
