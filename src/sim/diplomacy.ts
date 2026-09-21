/**
 * Diplomacy — pairwise relations, pacts, betrayals. See docs/factions.md.
 * Deterministic: every AI decision comes from an injected Rng (World side).
 */

export const DIPLOMACY = {
	/** Initial relation between two factions (0–100). */
	initialRelation: 60,
	/** Slow return of the relation toward its initial value (per tick). */
	relationDrift: 0.02,
	/** Relation drop per attack against a faction. */
	attackRelationHit: 25,
	/** Relation drop on betrayal (attacking an ally). */
	betrayalRelationHit: 50,
	/** Duration of a pact (ticks). */
	pactDuration: 1500,
	/** Maximum response delay to a pact offer (ticks). */
	offerWait: 200,
	/** Cooldown before re-proposing (ticks). */
	proposeCooldown: 300,
	/** Minimum relation to accept a pact. */
	acceptRelation: 55,
	/** The proposer must stay below this power ratio to be accepted (anti-bloc). */
	acceptPowerRatio: 1.5,
	/** Relation below which an ally may betray. */
	betrayRelation: 20,
	/** Duration of the traitor penalty (ticks) and defense multiplier. */
	traitorTicks: 300,
	traitorDefense: 0.5,
	/** Probability (per AI decision) of proposing a pact. */
	aiOfferChance: 0.02,
	/**
	 * Anti-leader coalition: probability (∝ leader's domination) that an AI
	 * decision targets a leader's quarter first. Zero at parity → no dogpile.
	 */
	leaderFocus: 0.25,
	/** The anti-leader coalition only triggers beyond this map share. */
	coalitionFloor: 0.4,
} as const;

/** Embargo: market blockade (dirty revenue penalty for the target). */
export const EMBARGO = {
	duration: 3000,
	/** Share of dirty revenue lost by the target. */
	salePenalty: 0.35,
	/** Relation drop on declaration. */
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
