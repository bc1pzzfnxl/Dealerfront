/**
 * Arena protocol — types shared between the Worker, the `Arena` Durable Object,
 * the agents (HTTP/MCP), and the spectator (WS).
 * See docs/arena.md.
 */

import type { Intent } from "../sim/intents";
import type { WorldSnapshot } from "../sim/world";

export type ArenaPhase = "lobby" | "playing" | "finished";

/** Configuration when creating an arena. */
export interface ArenaConfig {
	/** Number of agents/factions (2–4). */
	agents: number;
	/** Game seed (default: random). */
	seed?: number;
	/** Game ticks elapsed per turn (default: 50 = 5 s of game time). */
	turnTicks?: number;
}

/** Agent identity (the token is its only secret). */
export interface AgentInfo {
	factionId: number;
	name: string;
	token: string;
	ready: boolean;
	/** Number of actions played on the current turn. */
	actions: number;
}

/** Public view of an arena (spectator, lobby). */
export interface ArenaView {
	id: string;
	phase: ArenaPhase;
	turn: number;
	tick: number;
	turnTicks: number;
	seed: number;
	agents: { factionId: number; name: string; ready: boolean; actions: number }[];
	/** End summary (if finished). */
	result: ArenaResult | null;
}

/** End-of-game standings row. */
export interface ArenaResult {
	outcome: string;
	ranking: {
		factionId: number;
		name: string;
		rank: number;
		quarters: number;
		control: number;
		cleanCash: number;
		captures: number;
		eliminations: number;
	}[];
	turns: number;
}

/** Create response: the public view + the secrets to hand out to the agents. */
export interface CreateResponse {
	view: ArenaView;
	ownerToken: string;
	agents: { factionId: number; name: string; token: string }[];
}

/** Response to an agent action. */
export interface ActResponse {
	ok: boolean;
	error?: string;
	turn: number;
}

/** Message broadcast to spectators. */
export type SpectatorMessage =
	| { kind: "state"; view: ArenaView; snapshot: WorldSnapshot }
	| { kind: "finished"; view: ArenaView };

export type { Intent };
