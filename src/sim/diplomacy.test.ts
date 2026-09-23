/**
 * Diplomacy — relations, pacts, betrayal. See docs/factions.md.
 */

import { describe, expect, it } from "vitest";
import { DIPLOMACY, EMBARGO } from "./diplomacy";
import { CONTACT_NAMES } from "./police";
import { World } from "./world";

/** Quarter adjacent to the player spawn (map adjacency). */
import { PARIS_MAP } from "./maps/paris";
const ADJACENT = PARIS_MAP.neighbors[0]?.[0] ?? 6;

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
		// Faction 1 is an external agent: it accepts the offer itself.
		world.setPlayer(1);
		expect(world.playerRespondToOffer(0, true)).toBe(true);
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
		world.setPlayer(1);
		world.playerRespondToOffer(0, true);
		expect(world.hasPact(0, 1)).toBe(true);
		const before = world.relationBetween(0, 1);

		world.setPlayer(0);
		expect(world.playerBreakPact(1)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(
			before - DIPLOMACY.betrayalRelationHit,
		);
		expect(world.isTraitor(0)).toBe(true);
	});

	it("attackBest skips pacted allies", () => {
		const world = new World(1);
		// Faction 1 holds the weakest adjacent quarter (would be picked first).
		world.territory.owner[ADJACENT] = 1;
		world.territory.control[ADJACENT] = 1;
		expect(world.bestAdjacentTarget()).toBe(ADJACENT);
		// Pact it (both sides are agents): the ally's quarters are skipped.
		world.playerProposePact(1);
		world.setPlayer(1);
		expect(world.playerRespondToOffer(0, true)).toBe(true);
		world.setPlayer(0);
		expect(world.hasPact(0, 1)).toBe(true);
		expect(world.bestAdjacentTarget()).not.toBe(ADJACENT);
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
