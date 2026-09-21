/**
 * Encirclement et événements à choix — mécaniques de décision (P26).
 */

import { describe, expect, it } from "vitest";
import { World } from "./world";

describe("encirclement", () => {
	it("encercle un cluster fermé au profit de l'encercleur", () => {
		const world = new World(1);
		// Construit une poche connexe d'au moins ENCIRCLE_MIN_SIZE quartiers.
		const start = 6;
		const pocket = new Set<number>([start]);
		const queue = [start];
		while (pocket.size < 12 && queue.length > 0) {
			const module = queue.shift()!;
			for (const neighbor of world.city.neighbors[module] ?? []) {
				if (pocket.has(neighbor) || pocket.size >= 12) continue;
				pocket.add(neighbor);
				queue.push(neighbor);
			}
		}
		// Le joueur possède la poche ; une IA possède tout le reste (fermé).
		for (let i = 0; i < world.territory.count; i += 1) {
			world.territory.owner[i] = pocket.has(i) ? 0 : 1;
			world.territory.control[i] = 100;
		}
		// Force un tick multiple de 5 (résolution d'encerclement).
		while (world.tick % 5 !== 0) world.step();
		for (let i = 0; i < 5; i += 1) world.step();
		expect(world.modulesOwned(0)).toBeLessThan(pocket.size);
		expect(world.modulesOwned(1)).toBeGreaterThan(0);
	});
});

describe("événements à choix", () => {
	it("applique un effet traçable pour chaque choix", () => {
		const world = new World(1);
		// Force un événement de livraison.
		world.debugSetEvent({
			id: "livraison",
			title: "t",
			body: "b",
			kind: "info",
			choices: [
				{ label: "Accepter", detail: "" },
				{ label: "Refuser", detail: "" },
			],
		});
		const sale = world.player.cashSale;
		expect(world.playerChoose(0)).toBe(true);
		expect(world.player.cashSale).toBe(sale + 3500);
		expect(world.pendingEvent()).toBeNull();
	});

	it("refuse un choix sans événement", () => {
		const world = new World(1);
		expect(world.playerChoose(0)).toBe(false);
	});
});
