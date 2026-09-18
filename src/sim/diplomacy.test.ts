/**
 * Diplomatie — relations, pactes, trahison. Voir docs/factions.md.
 */

import { describe, expect, it } from "vitest";
import { DIPLOMACY, EMBARGO } from "./diplomacy";
import { CONTACT_NAMES } from "./police";
import { MODULES_W } from "./constants";
import { World } from "./world";

/** Quartier adjacent au spawn du joueur (1,1) → voisin de droite. */
const ADJACENT = 1 * MODULES_W + 2;

describe("diplomatie", () => {
	it("démarre sans pacte avec une relation initiale", () => {
		const world = new World(1, "nightlife");
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(DIPLOMACY.initialRelation);
	});

	it("attaquer une faction fait chuter la relation", () => {
		const world = new World(1, "nightlife");
		world.territory.owner[ADJACENT] = 1;
		world.territory.control[ADJACENT] = 100;
		expect(world.playerAttack(ADJACENT)).toBe(true);
		expect(world.relationBetween(0, 1)).toBe(
			DIPLOMACY.initialRelation - DIPLOMACY.attackRelationHit,
		);
	});

	it("une offre de pacte acceptée devient un pacte", () => {
		const world = new World(1, "nightlife");
		expect(world.playerProposePact(1)).toBe(true);
		expect(world.offers.length).toBe(1);
		expect(world.pacts.length).toBe(0);
		for (let i = 0; i < 60; i += 1) world.step();
		expect(world.hasPact(0, 1)).toBe(true);
	});

	it("une offre à relation basse est refusée", () => {
		const world = new World(1, "nightlife");
		world.territory.owner[ADJACENT] = 1;
		world.territory.control[ADJACENT] = 100;
		world.playerAttack(ADJACENT);
		world.playerProposePact(1);
		for (let i = 0; i < 60; i += 1) world.step();
		expect(world.hasPact(0, 1)).toBe(false);
	});

	it("trahir rompt le pacte, fait chuter la relation et marque le traître", () => {
		const world = new World(1, "nightlife");
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

	it("les alliés ne s'attaquent pas", () => {
		const world = new World(1, "nightlife");
		// Force un pacte joueur ↔ gang 1.
		world.playerProposePact(1);
		for (let i = 0; i < 40; i += 1) world.step();
		expect(world.hasPact(0, 1)).toBe(true);

		// Le gang 1 est adjacent (quartier collé au spawn) : sans pacte il attaquerait.
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
	it("un embargo bloque les pactes, fait chuter la relation et expire", () => {
		const world = new World(1, "nightlife");
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

	it("le contact corrompu porte un nom", () => {
		const world = new World(1, "nightlife");
		expect(CONTACT_NAMES).toContain(world.contactName);
	});
});
