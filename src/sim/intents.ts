/**
 * Intents — the simulation's **single entry point** for the outside
 * (AI agents, arena server). No direct access to `World`: everything goes
 * through `applyIntent`, which switches the active faction and validates the
 * result. See docs/arena.md.
 */

import type { BuildingType } from "./buildings";
import type { TechBranch } from "./tech";
import { World } from "./world";

/** Actions an agent can request for its faction. */
export type Intent =
	| { type: "attack"; module: number }
	| { type: "attackBest" }
	| { type: "build"; module: number; building: BuildingType }
	| { type: "batchBuild" }
	| { type: "raid"; module: number }
	| { type: "bust"; module: number }
	| { type: "sabotage"; module: number }
	| { type: "intercept"; module: number }
	| { type: "hitman"; module: number }
	| { type: "corrupt" }
	| { type: "upgradeTech"; branch: TechBranch }
	| { type: "proposePact"; faction: number }
	| { type: "respondOffer"; from: number; accept: boolean }
	| { type: "breakPact"; faction: number }
	| { type: "embargo"; faction: number }
	| { type: "fundContract"; target: number; enemy: number }
	| { type: "buyQuarter"; module: number }
	| { type: "hireMercenaries" }
	| { type: "buyArmament" }
	| { type: "setAttackRatio"; ratio: number }
	| { type: "setLaunderRatio"; ratio: number }
	| { type: "choose"; choice: 0 | 1 };

export interface IntentResult {
	ok: boolean;
	/** Refusal reason (if `ok = false`). */
	error?: string;
}

/**
 * Applies an intent for `factionId`. The faction becomes the "active faction"
 * for the duration of the call (the `player*` methods apply to it).
 */
export function applyIntent(world: World, factionId: number, intent: Intent): IntentResult {
	if (world.outcome !== null) return { ok: false, error: "game over" };
	world.setPlayer(factionId);
	const ok = (value: boolean, error: string): IntentResult =>
		value ? { ok: true } : { ok: false, error };

	switch (intent.type) {
		case "attack":
			return ok(world.playerAttack(intent.module), "assault impossible");
		case "attackBest":
			return ok(world.playerAttackBest(), "no adjacent target");
		case "build":
			return ok(world.playerBuild(intent.module, intent.building), "construction impossible");
		case "batchBuild":
			return { ok: world.playerBatchBuild() >= 0 };
		case "raid":
			return ok(world.playerRaid(intent.module), "raid impossible");
		case "bust":
			return ok(world.playerBust(intent.module), "bust impossible");
		case "sabotage":
			return ok(world.playerSabotage(intent.module), "sabotage impossible");
		case "intercept":
			return ok(world.playerIntercept(intent.module), "interception impossible");
		case "hitman":
			return ok(world.playerHitman(intent.module), "hitman impossible");
		case "corrupt":
			return ok(world.playerCorrupt(), "corruption impossible");
		case "upgradeTech":
			return ok(world.playerUpgradeTech(intent.branch), "tech impossible");
		case "proposePact":
			return ok(world.playerProposePact(intent.faction), "pact impossible");
		case "respondOffer":
			return ok(
				world.playerRespondToOffer(intent.from, intent.accept),
				"no offer from this gang",
			);
		case "breakPact":
			return ok(world.playerBreakPact(intent.faction), "no pact");
		case "embargo":
			return ok(world.playerEmbargo(intent.faction), "embargo impossible");
		case "fundContract":
			return ok(
				world.playerFundContract(intent.target, intent.enemy),
				"contract impossible",
			);
		case "buyQuarter":
			return ok(world.playerBuy(intent.module), "buyout impossible");
		case "hireMercenaries":
			return ok(world.playerHireMercenaries(), "hire impossible");
		case "buyArmament":
			return ok(world.playerBuyArmament(), "armament impossible");
		case "setAttackRatio":
			world.playerSetAttackRatio(intent.ratio);
			return { ok: true };
		case "setLaunderRatio":
			world.playerSetLaunderRatio(intent.ratio);
			return { ok: true };
		case "choose":
			return ok(world.playerChoose(intent.choice), "no event");
		default:
			return { ok: false, error: "unknown intent" };
	}
}

/** Readable catalog of actions (for help / an agent's prompt). */
export const INTENT_CATALOG: readonly { type: Intent["type"]; doc: string }[] = [
	{ type: "attack", doc: "Assault on an adjacent quarter (module)." },
	{ type: "attackBest", doc: "Automatic assault on the weakest neighbor." },
	{ type: "build", doc: "Build (module, building): lab/storefront/front/housing/safehouse/depot/workshop/counter." },
	{ type: "batchBuild", doc: "Automatically develop empty quarters." },
	{ type: "raid", doc: "Raid: destroys a target's control and building." },
	{ type: "bust", doc: "Bust: steals the loot from an enemy building." },
	{ type: "sabotage", doc: "Sabotage: production ÷2 for 30 s." },
	{ type: "intercept", doc: "Interception: steals a convoy and cuts the line." },
	{ type: "hitman", doc: "Hitman: weakens a quarter and its neighbors." },
	{ type: "corrupt", doc: "Bribe the police: lowers Pressure." },
	{ type: "upgradeTech", doc: "Research a tier (armament/protection/logistics)." },
	{ type: "proposePact", doc: "Propose a pact (faction)." },
	{ type: "respondOffer", doc: "Respond to an offer (from, accept)." },
	{ type: "breakPact", doc: "Betray a pact (faction)." },
	{ type: "embargo", doc: "Embargo against a faction." },
	{ type: "fundContract", doc: "Pay a gang (target) to strike a rival (enemy)." },
	{ type: "buyQuarter", doc: "Buy an adjacent neutral quarter (Clean cash)." },
	{ type: "hireMercenaries", doc: "Dirty cash → immediate Members." },
	{ type: "buyArmament", doc: "Clean cash → temporary attack bonus." },
	{ type: "setAttackRatio", doc: "Share of Members committed to the assault (0.1–0.8)." },
	{ type: "setLaunderRatio", doc: "Share of Fronts' capacity laundered (0–1)." },
	{ type: "choose", doc: "Respond to the current event (0 or 1)." },
];
