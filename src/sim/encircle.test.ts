/**
 * Encirclement and choice events — decision mechanics (P26).
 */

import { describe, expect, it } from "vitest";
import { World } from "./world";

describe("encirclement", () => {
	it("encircles a closed cluster for the encircler", () => {
		const world = new World(1);
		// Builds a connected pocket of at least ENCIRCLE_MIN_SIZE quarters.
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
		// The player owns the pocket; an AI owns everything else (closed).
		for (let i = 0; i < world.territory.count; i += 1) {
			world.territory.owner[i] = pocket.has(i) ? 0 : 1;
			world.territory.control[i] = 100;
		}
		// Forces a tick multiple of 5 (encirclement resolution).
		while (world.tick % 5 !== 0) world.step();
		for (let i = 0; i < 5; i += 1) world.step();
		expect(world.modulesOwned(0)).toBeLessThan(pocket.size);
		expect(world.modulesOwned(1)).toBeGreaterThan(0);
	});
});

describe("choice events", () => {
	it("applies a traceable effect for each choice", () => {
		const world = new World(1);
		// Forces a delivery event.
		world.debugSetEvent({
			id: "livraison",
			title: "t",
			body: "b",
			kind: "info",
			choices: [
				{ label: "Accept", detail: "" },
				{ label: "Refuse", detail: "" },
			],
		});
		const sale = world.player.dirtyCash;
		expect(world.playerChoose(0)).toBe(true);
		expect(world.player.dirtyCash).toBe(sale + 3500);
		expect(world.pendingEvent()).toBeNull();
	});

	it("refuses a choice without an event", () => {
		const world = new World(1);
		expect(world.playerChoose(0)).toBe(false);
	});
});
