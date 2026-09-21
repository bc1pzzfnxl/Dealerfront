/**
 * Diplomacy — relations, pacts, betrayal. See docs/factions.md.
 */

import { describe, expect, it } from "vitest";
import { DIPLOMACY, EMBARGO } from "./diplomacy";
import { CONTACT_NAMES } from "./police";
import { World } from "./world";

/** Quarter adjacent to the player spawn (map adjacency). */
const ADJACENT = 6;

describe("diplomacy", () => {
	it("starts with no pact and an initial relation", () => {
		const world = new World(1);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(DIPLOMACY.initialRelation);
	});

	it("attacking a faction drops the relation", () => {
		const world = new World(1);
		world.territory.owner[ADJACENT] = 1;
		world.territory.control[ADJACENT] = 100;
		expect(world.playerAttack(ADJACENT)).toBe(true);
		expect(world.relationBetween(0, 1)).toBe(
			DIPLOMACY.initialRelation - DIPLOMACY.attackRelationHit,
		);
	});

	it("an accepted pact offer becomes a pact", () => {
		const world = new World(1);
		expect(world.playerProposePact(1)).toBe(true);
		expect(world.offers.length).toBe(1);
		expect(world.pacts.length).toBe(0);
		for (let i = 0; i < 60; i += 1) world.step();
		expect(world.hasPact(0, 1)).toBe(true);
	});

	it("an offer with a low relation is refused", () => {
		const world = new World(1);
		world.territory.owner[ADJACENT] = 1;
		world.territory.control[ADJACENT] = 100;
		world.playerAttack(ADJACENT);
		world.playerProposePact(1);
		for (let i = 0; i < 60; i += 1) world.step();
		expect(world.hasPact(0, 1)).toBe(false);
	});

	it("betraying breaks the pact, drops the relation and marks the traitor", () => {
		const world = new World(1);
		world.playerProposePact(1);
		for (let i = 0; i < 60; i += 1) world.step();
		expect(world.hasPact(0, 1)).toBe(true);
		const before = world.relationBetween(0, 1);

		expect(world.playerBreakPact(1)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(
			before - DIPLOMACY.betrayalRelationHit,
		);
		expect(world.isTraitor(0)).toBe(true);
	});

	it("allies don't attack each other", () => {
		const world = new World(1);
		// Forces a player ↔ gang 1 pact.
		world.playerProposePact(1);
		for (let i = 0; i < 40; i += 1) world.step();
		expect(world.hasPact(0, 1)).toBe(true);

		// Gang 1 is adjacent (quarter stuck to the spawn): without a pact it would attack.
		const attacker = 1;
		let attackedPlayer = false;
		for (let i = 0; i < 400; i += 1) {
			world.step();
			if (world.attacks.some((attack) => attack.factionId === attacker && world.ownerAt(attack.target) === 0)) {
				attackedPlayer = true;
				break;
			}
		}
		expect(attackedPlayer).toBe(false);
	});
});

describe("embargo & contact", () => {
	it("an embargo blocks pacts, drops the relation and expires", () => {
		const world = new World(1);
		expect(world.playerEmbargo(1)).toBe(true);
		expect(world.playerHasEmbargo(1)).toBe(true);
		expect(world.isEmbargoed(1)).toBe(true);
		expect(world.playerCanProposePact(1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(
			DIPLOMACY.initialRelation - EMBARGO.relationHit,
		);

		world.tick = EMBARGO.duration;
		world.step();
		expect(world.playerHasEmbargo(1)).toBe(false);
	});

	it("the corrupt contact has a name", () => {
		const world = new World(1);
		expect(CONTACT_NAMES).toContain(world.contactName);
	});
});
