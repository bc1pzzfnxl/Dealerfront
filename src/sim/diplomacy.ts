/**
 * Diplomatie — relations par paire, pactes, trahisons. Voir docs/factions.md.
 * Déterministe : toute décision d'IA provient d'un Rng injecté (côté World).
 */

export const DIPLOMACY = {
	/** Relation initiale entre deux factions (0–100). */
	initialRelation: 60,
	/** Retour lent de la relation vers sa valeur initiale (par tick). */
	relationDrift: 0.02,
	/** Chute de relation par attaque contre une faction. */
	attackRelationHit: 25,
	/** Chute de relation en cas de trahison (attaque d'un allié). */
	betrayalRelationHit: 50,
	/** Durée d'un pacte (ticks). */
	pactDuration: 1500,
	/** Délai maximum de réponse à une demande de pacte (ticks). */
	offerWait: 200,
	/** Cooldown avant de pouvoir re-proposer (ticks). */
	proposeCooldown: 300,
	/** Relation minimale pour accepter un pacte. */
	acceptRelation: 55,
	/** Le proposeur doit rester sous ce ratio de puissance pour être accepté (anti-bloc). */
	acceptPowerRatio: 1.5,
	/** Relation en dessous de laquelle un allié peut trahir. */
	betrayRelation: 20,
	/** Durée de la pénalité de traître (ticks) et multiplicateur de défense. */
	traitorTicks: 300,
	traitorDefense: 0.5,
	/** Probabilité (par décision IA) de proposer un pacte. */
	aiOfferChance: 0.02,
	/**
	 * Coalition anti-leader : probabilité (∝ domination du leader) qu'une décision IA
	 * vise en priorité un quartier du leader. Nulle à parité → pas de dogpile.
	 */
	leaderFocus: 0.25,
} as const;

/** Embargo : blocus marché (malus de revenu sale de la cible). */
export const EMBARGO = {
	duration: 3000,
	/** Part du revenu sale perdue par la cible. */
	salePenalty: 0.35,
	/** Chute de relation à la déclaration. */
	relationHit: 40,
} as const;

export interface Embargo {
	from: number;
	to: number;
	until: number;
}

export interface Pact {
	a: number;
	b: number;
	until: number;
}

export interface PactOffer {
	from: number;
	to: number;
	expires: number;
}
