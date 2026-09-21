/**
 * Police — non-playable anti-leader faction. See docs/police-ai.md.
 * Its **Pressure** rises with the leader's domination (control share) and
 * criminal activity; it falls otherwise. It is **corruptible**.
 */

export const POLICE = {
	max: 100,
	/** Rise / tick ∝ the leader's control share above a "fair" share. */
	excessWeight: 0.02,
	/** Rise / tick ∝ accumulated crime signal (recent captures). */
	crimeWeight: 0.0015,
	/** Crime signal decay (per tick). */
	crimeDecay: 0.985,
	/**
	 * Passive Pressure decay (per tick) at zero pressure. Decay is
	 * **proportional** (see `decayHalf`): without it, any sustained capture rate
	 * makes Pressure a one-way ratchet — playing *better* (expanding faster) got
	 * you liquidated, which is the opposite of punishing domination.
	 */
	baseDecay: 0.006,
	/**
	 * Decay half-life: decay doubles at this Pressure. Pressure settles where
	 * `crimeWeight × crime = baseDecay × (1 + P / decayHalf)` — so a calm cartel
	 * falls back to 0, a normal war settles around 50, and a *sustained* rampage
	 * still climbs to liquidation.
	 */
	decayHalf: 60,
	/**
	 * Domination floor. In a battle royale, the leader naturally holds a large
	 * share: excess is no longer measured against `1/nb factions` but against a
	 * **crushing domination threshold** (~80% of the map). Below it, no floor
	 * pressure; above it, the police hound you. Since dominating is required to
	 * finish, the threshold is high: the police punish *total* domination, not
	 * a lead.
	 */
	dominationFloor: 60,
	/** Map share beyond which a leader is "crushing". */
	dominationShare: 0.8,
	/** Tiers. */
	raidThreshold: 40,
	multiThreshold: 70,
	liquidation: 95,
	/** Raid: Control removed per quarter, cooldown, nb of targeted quarters. */
	raidControl: 25,
	raidCooldown: 600,
	raidsSingle: 1,
	raidsMulti: 3,
	/** Clean cash seizure at the "crackdown" tier. */
	seizureRatio: 0.1,
	/** Corruption: increasing cost (Clean cash), effect, window, risk. */
	corruptionBaseCost: 3000,
	corruptionCostGrowth: 1.8,
	corruptionMaxCost: 1_000_000,
	corruptionReduction: 20,
	corruptionWindow: 150,
	corruptionSuppress: 0.02,
	corruptionBurnChance: 0.15,
	corruptionBurnBacklash: 10,
} as const;

/** Corrupt contact names (flavor; the contact can be "burned"). */
export const CONTACT_NAMES = [
	"The Serpent",
	"The Accountant",
	"The Old Man",
	"The Godmother",
	"The Steward",
	"Curly",
] as const;

export type PoliceTier = "surveillance" | "raid" | "crackdown" | "liquidation";

export function policeTier(pressure: number): PoliceTier {
	if (pressure >= POLICE.liquidation) return "liquidation";
	if (pressure >= POLICE.multiThreshold) return "crackdown";
	if (pressure >= POLICE.raidThreshold) return "raid";
	return "surveillance";
}

export const POLICE_TIER_LABELS: Record<PoliceTier, string> = {
	surveillance: "Surveillance",
	raid: "Targeted raid",
	crackdown: "Multiple raid + seizure",
	liquidation: "Liquidation",
};

export interface PoliceState {
	pressure: number;
	/** Currently targeted faction (leader with the highest Control), -1 if none. */
	target: number;
	/** Ticks until the next raid. */
	cooldown: number;
	/** Remaining ticks of active corruption. */
	window: number;
	/** Accumulated crime signal (decays each tick). */
	crime: number;
	/** Last tick a raid took place, -1 otherwise. */
	lastRaidTick: number;
	/** Number of raids triggered. */
	raids: number;
	/** Number of liquidations (player or AI). */
	liquidations: number;
}
