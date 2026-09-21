/**
 * Intents — **porte d'entrée unique** de la simulation pour l'extérieur
 * (agents IA, serveur d'arène). Aucun accès direct au `World` : tout passe par
 * `applyIntent`, qui bascule la faction active et valide le résultat.
 * Voir docs/arena.md.
 */

import type { BuildingType } from "./buildings";
import type { TechBranch } from "./tech";
import { World } from "./world";

/** Actions qu'un agent peut demander pour sa faction. */
export type Intent =
	| { type: "attack"; module: number }
	| { type: "attackBest" }
	| { type: "build"; module: number; building: BuildingType }
	| { type: "batchBuild" }
	| { type: "raid"; module: number }
	| { type: "descent"; module: number }
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
	| { type: "buyArmement" }
	| { type: "setAttackRatio"; ratio: number }
	| { type: "setLaunderRatio"; ratio: number }
	| { type: "choose"; choice: 0 | 1 };

export interface IntentResult {
	ok: boolean;
	/** Raison du refus (si `ok = false`). */
	error?: string;
}

/**
 * Applique un intent pour `factionId`. La faction devient la « faction active »
 * le temps de l'appel (les méthodes `player*` s'appliquent à elle).
 */
export function applyIntent(world: World, factionId: number, intent: Intent): IntentResult {
	if (world.outcome !== null) return { ok: false, error: "partie terminée" };
	world.setPlayer(factionId);
	const ok = (value: boolean, error: string): IntentResult =>
		value ? { ok: true } : { ok: false, error };

	switch (intent.type) {
		case "attack":
			return ok(world.playerAttack(intent.module), "assaut impossible");
		case "attackBest":
			return ok(world.playerAttackBest(), "aucune cible adjacente");
		case "build":
			return ok(world.playerBuild(intent.module, intent.building), "construction impossible");
		case "batchBuild":
			return { ok: world.playerBatchBuild() >= 0 };
		case "raid":
			return ok(world.playerRaid(intent.module), "raid impossible");
		case "descent":
			return ok(world.playerDescent(intent.module), "descente impossible");
		case "sabotage":
			return ok(world.playerSabotage(intent.module), "sabotage impossible");
		case "intercept":
			return ok(world.playerIntercept(intent.module), "interception impossible");
		case "hitman":
			return ok(world.playerHitman(intent.module), "tueur impossible");
		case "corrupt":
			return ok(world.playerCorrupt(), "corruption impossible");
		case "upgradeTech":
			return ok(world.playerUpgradeTech(intent.branch), "tech impossible");
		case "proposePact":
			return ok(world.playerProposePact(intent.faction), "pacte impossible");
		case "respondOffer":
			return ok(
				world.playerRespondToOffer(intent.from, intent.accept),
				"aucune offre de ce gang",
			);
		case "breakPact":
			return ok(world.playerBreakPact(intent.faction), "aucun pacte");
		case "embargo":
			return ok(world.playerEmbargo(intent.faction), "embargo impossible");
		case "fundContract":
			return ok(
				world.playerFundContract(intent.target, intent.enemy),
				"contrat impossible",
			);
		case "buyQuarter":
			return ok(world.playerBuy(intent.module), "rachat impossible");
		case "hireMercenaries":
			return ok(world.playerHireMercenaries(), "embauche impossible");
		case "buyArmement":
			return ok(world.playerBuyArmement(), "armement impossible");
		case "setAttackRatio":
			world.playerSetAttackRatio(intent.ratio);
			return { ok: true };
		case "setLaunderRatio":
			world.playerSetLaunderRatio(intent.ratio);
			return { ok: true };
		case "choose":
			return ok(world.playerChoose(intent.choice), "aucun événement");
		default:
			return { ok: false, error: "intent inconnu" };
	}
}

/** Catalogue lisible des actions (pour l'aide / le prompt d'un agent). */
export const INTENT_CATALOG: readonly { type: Intent["type"]; doc: string }[] = [
	{ type: "attack", doc: "Assaut sur un quartier adjacent (module)." },
	{ type: "attackBest", doc: "Assaut automatique sur le voisin le plus faible." },
	{ type: "build", doc: "Bâtir (module, building) : labo/vente/facade/logement/planque/depot/atelier/contre." },
	{ type: "batchBuild", doc: "Aménager automatiquement les quartiers vides." },
	{ type: "raid", doc: "Raid : détruit contrôle et bâtiment d'une cible." },
	{ type: "descent", doc: "Descente : vole le butin d'un bâtiment ennemi." },
	{ type: "sabotage", doc: "Sabotage : production ÷2 pendant 30 s." },
	{ type: "intercept", doc: "Interception : vole un convoi et coupe la ligne." },
	{ type: "hitman", doc: "Tueur à gage : affaiblit un quartier et ses voisins." },
	{ type: "corrupt", doc: "Corrompre la police : baisse la Pression." },
	{ type: "upgradeTech", doc: "Rechercher un palier (armement/protection/logistique)." },
	{ type: "proposePact", doc: "Proposer un pacte (faction)." },
	{ type: "respondOffer", doc: "Répondre à une offre (from, accept)." },
	{ type: "breakPact", doc: "Trahir un pacte (faction)." },
	{ type: "embargo", doc: "Embargo contre une faction." },
	{ type: "fundContract", doc: "Payer un gang (target) pour frapper un rival (enemy)." },
	{ type: "buyQuarter", doc: "Racheter un quartier neutre adjacent (Cash propre)." },
	{ type: "hireMercenaries", doc: "Cash sale → Membres immédiats." },
	{ type: "buyArmement", doc: "Cash propre → bonus d'attaque temporaire." },
	{ type: "setAttackRatio", doc: "Part des Membres engagée à l'assaut (0,1–0,8)." },
	{ type: "setLaunderRatio", doc: "Part de la capacité des façades blanchie (0–1)." },
	{ type: "choose", doc: "Répondre à l'événement en cours (0 ou 1)." },
];
