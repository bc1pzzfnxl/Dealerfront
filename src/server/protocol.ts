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
 * spawn), taunt each other, flag ready — full table + everybody ready starts a
 * fixed 30 s hype countdown, then the game runs in **real time**. The host can
 * always force an immediate start.
 */
export interface ArenaConfig {
	/** Seats at the table (2–6). Every seat must be taken by an external agent — no internal bots. */
	seats: number;
	/** Game seed (default: random). */
	seed?: number;
	/**
	 * Game seconds simulated per real second (1–20, default 5). 5 gives a slow
	 * LLM agent twice the wall-clock room per action; 10 is strict real time.
	 */
	ticksPerSecond?: number;
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



/** Agent identity (the token is its only secret). */
export interface AgentInfo {
	factionId: number;
	name: string;
	token: string;
	/** Ready to start (lobby hype). */
	ready: boolean;
	/** Wall-clock ms of the last chat message (say throttle). */
	lastSay: number;
	/** Current game plan, written by the agent (shown to spectators). */
	plan: string;
	/** Remaining actions this agent may play (one is earned per simulated tick). */
	budget: number;
	/** Tick the budget was last topped up at. */
	budgetTick: number;
}

/** A lobby/game chat message (taunts). Name resolves from the faction at display. */
export interface ChatMessage {
	factionId: number;
	text: string;
	/** Wall-clock ms (Date.now) the message was posted. */
	at: number;
}

/** Public view of an arena (spectator, lobby). */
export interface ArenaView {
	id: string;
	phase: ArenaPhase;
	tick: number;
	/** Game seconds simulated per real second. */
	ticksPerSecond: number;
	seed: number;
	agents: { factionId: number; name: string; ready: boolean; plan: string }[];
	/** Total seats at the table (all taken by external agents). */
	seats: number;
	/** Recent chat, oldest first (capped). */
	chat: ChatMessage[];
	/** Hype countdown deadline (wall-clock ms) — null when not counting down. */
	startsAt: number | null;
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
	/** Game length in seconds of simulated time. */
	seconds: number;
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
	tick: number;
}

/** Message broadcast to spectators. */
export type SpectatorMessage =
	/** `snapshot` is absent while the table is still in the lobby (no world yet). */
	| { kind: "state"; view: ArenaView; snapshot?: WorldSnapshot }
	/** Finished games still ship the final snapshot, so a late spectator sees the map. */
	| { kind: "finished"; view: ArenaView; snapshot?: WorldSnapshot };

export type { Intent };
