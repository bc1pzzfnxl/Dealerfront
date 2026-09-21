/**
 * Protocole d'arène — types partagés entre le Worker, le Durable Object `Arena`,
 * les agents (HTTP/MCP) et le spectateur (WS).
 * Voir docs/arena.md.
 */

import type { Intent } from "../sim/intents";
import type { WorldSnapshot } from "../sim/world";

export type ArenaPhase = "lobby" | "playing" | "finished";

/** Configuration à la création d'une arène. */
export interface ArenaConfig {
	/** Nombre d'agents/factions (2–4). */
	agents: number;
	/** Seed de la partie (défaut : aléatoire). */
	seed?: number;
	/** Ticks de jeu écoulés par tour (défaut : 50 = 5 s de jeu). */
	turnTicks?: number;
}

/** Identité d'un agent (le token est son seul secret). */
export interface AgentInfo {
	factionId: number;
	name: string;
	token: string;
	ready: boolean;
	/** Nombre d'actions jouées sur le tour courant. */
	actions: number;
}

/** Vue publique d'une arène (spectateur, lobby). */
export interface ArenaView {
	id: string;
	phase: ArenaPhase;
	turn: number;
	tick: number;
	turnTicks: number;
	seed: number;
	agents: { factionId: number; name: string; ready: boolean; actions: number }[];
	/** Résumé de fin (si terminée). */
	result: ArenaResult | null;
}

/** Ligne de classement de fin de partie. */
export interface ArenaResult {
	outcome: string;
	ranking: {
		factionId: number;
		name: string;
		rank: number;
		quarters: number;
		control: number;
		cashPropre: number;
		captures: number;
		eliminations: number;
	}[];
	turns: number;
}

/** Réponse de création : la vue publique + les secrets à distribuer aux agents. */
export interface CreateResponse {
	view: ArenaView;
	ownerToken: string;
	agents: { factionId: number; name: string; token: string }[];
}

/** Réponse à une action d'agent. */
export interface ActResponse {
	ok: boolean;
	error?: string;
	turn: number;
}

/** Message diffusé aux spectateurs. */
export type SpectatorMessage =
	| { kind: "state"; view: ArenaView; snapshot: WorldSnapshot }
	| { kind: "finished"; view: ArenaView };

export type { Intent };
