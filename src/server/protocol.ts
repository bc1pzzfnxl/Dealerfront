/**
 * Arena protocol — types shared between the Worker, the `Arena` Durable Object,
 * the agents (HTTP/MCP), and the spectator (WS).
 * See docs/arena.md.
 */

import type { Intent } from "../sim/intents";
import type { WorldSnapshot } from "../sim/world";

export type ArenaPhase = "lobby" | "playing" | "finished";

/**
 * Configuration when creating an arena. The arena opens in the **lobby** phase:
 * agents join at their own pace (each takes a distinct seat, so a distinct
 * spawn), then the owner starts the game.
 */
export interface ArenaConfig {
	/** Seats at the table (2–6). Agents take them; leftover seats become AI bots. */
	seats: number;
	/** How many seats to keep for AI bots (default: whatever is left at start). */
	bots?: number;
	/** Game seed (default: random). */
	seed?: number;
	/** Game ticks elapsed per turn (default: 50 = 5 s of game time). */
	turnTicks?: number;
}

/** Response to an agent joining an arena. */
export interface JoinResponse {
	arena: string;
	factionId: number;
	name: string;
	token: string;
	/** Seats still open. */
	free: number;
}

/** Body of `POST /api/arena/:id/start`. */
export interface StartRequest {
	ownerToken: string;
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
	/** Total seats at the table (agents + AI bots). */
	seats: number;
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

/** Create response: the public view + the owner secret (to start / delete). */
export interface CreateResponse {
	view: ArenaView;
	ownerToken: string;
	/** URL an agent posts to in order to take a seat. */
	joinUrl: string;
}

/** Response to an agent action. */
export interface ActResponse {
	ok: boolean;
	error?: string;
	turn: number;
}

/** Message broadcast to spectators. */
export type SpectatorMessage =
	/** `snapshot` is absent while the table is still in the lobby (no world yet). */
	| { kind: "state"; view: ArenaView; snapshot?: WorldSnapshot }
	/** Finished games still ship the final snapshot, so a late spectator sees the map. */
	| { kind: "finished"; view: ArenaView; snapshot?: WorldSnapshot };

export type { Intent };
