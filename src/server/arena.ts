/**
 * Arena — one Durable Object **per game**. Holds the authoritative `World`,
 * receives agent intents (HTTP), advances the simulation **at the agents'
 * pace** (one turn = `turnTicks` ticks, triggered when everyone is done), and
 * broadcasts state to spectators (WebSocket).
 * See docs/arena.md.
 */

import { DurableObject } from "cloudflare:workers";
import { applyIntent, type Intent } from "../sim/intents";
import { World, type WorldSnapshot } from "../sim/world";
import type {
	ArenaConfig,
	ArenaPhase,
	ArenaResult,
	ArenaView,
	AgentInfo,
	CreateResponse,
	SpectatorMessage,
} from "./protocol";

interface ArenaState {
	seed: number;
	turnTicks: number;
	turn: number;
	phase: ArenaPhase;
	ownerToken: string;
	agents: AgentInfo[];
	/** Total factions in play (agents + AI bots). */
	factionCount: number;
}

const MAX_AGENTS = 4;
const MIN_AGENTS = 1;
/** Hard cap: the faction name palette has 6 entries. */
const MAX_FACTIONS = 6;

export class Arena extends DurableObject<Env> {
	private arena: ArenaState | null = null;
	private world: World | null = null;
	private result: ArenaResult | null = null;

	/** Loads (or creates) state from the DO storage. */
	private async load(): Promise<void> {
		if (this.arena) return;
		const stored = await this.ctx.storage.get<ArenaState>("arena");
		if (!stored) throw new Error("arena does not exist");
		this.arena = stored;
		const snapshot = await this.ctx.storage.get<WorldSnapshot>("world");
		const world = new World(stored.seed, {
			factionCount: stored.factionCount ?? stored.agents.length,
			controlled: stored.agents.map((agent) => agent.factionId),
		});
		if (snapshot) world.applySnapshot(snapshot);
		this.world = world;
		this.result = (await this.ctx.storage.get<ArenaResult>("result")) ?? null;
	}

	private async save(): Promise<void> {
		if (!this.arena || !this.world) return;
		await this.ctx.storage.put("arena", this.arena);
		await this.ctx.storage.put("world", this.world.snapshot());
		if (this.result) await this.ctx.storage.put("result", this.result);
	}

	private view(id: string): ArenaView {
		const arena = this.arena!;
		const world = this.world!;
		return {
			id,
			phase: arena.phase,
			turn: arena.turn,
			tick: world.tick,
			turnTicks: arena.turnTicks,
			seed: arena.seed,
			agents: arena.agents.map((agent) => ({
				factionId: agent.factionId,
				name: agent.name,
				ready: agent.ready,
				actions: agent.actions,
			})),
			result: this.result,
		};
	}

	private broadcast(): void {
		const id = this.arenaId();
		const message: SpectatorMessage =
			this.arena!.phase === "finished"
				? { kind: "finished", view: this.view(id) }
				: { kind: "state", view: this.view(id), snapshot: this.world!.snapshot() };
		const payload = JSON.stringify(message);
		for (const socket of this.ctx.getWebSockets()) {
			try {
				socket.send(payload);
			} catch {
				// closed socket: ignored
			}
		}
	}

	private arenaId(): string {
		return (this.ctx.id.name ?? this.ctx.id.toString()) as string;
	}

	/** Creates the arena (called by the Worker). */
	private async create(id: string, config: ArenaConfig): Promise<CreateResponse> {
		const count = Math.max(MIN_AGENTS, Math.min(MAX_AGENTS, Math.floor(config.agents)));
		const bots = Math.max(0, Math.min(MAX_FACTIONS - count, Math.floor(config.bots ?? 0)));
		const factionCount = count + bots;
		const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
		const names = ["Cartel", "Northside Gang", "Eastside Gang", "Southside Gang"];
		const agents: AgentInfo[] = Array.from({ length: count }, (_, index) => ({
			factionId: index,
			name: names[index] ?? `Gang ${index}`,
			token: crypto.randomUUID(),
			ready: false,
			actions: 0,
		}));
		this.arena = {
			seed,
			turnTicks: Math.max(1, config.turnTicks ?? 50),
			turn: 0,
			phase: "playing",
			ownerToken: crypto.randomUUID(),
			agents,
			factionCount,
		};
		// Only the agents are `controlled`: the bots are left to the AI, so the
		// simulation drives them while the agents wait for their turn.
		this.world = new World(seed, {
			factionCount,
			controlled: agents.map((agent) => agent.factionId),
		});
		this.result = null;
		await this.save();
		return {
			view: this.view(id),
			ownerToken: this.arena.ownerToken,
			agents: agents.map((agent) => ({
				factionId: agent.factionId,
				name: agent.name,
				token: agent.token,
			})),
		};
	}

	/** Applies an agent intent. */
	private async act(token: string, intent: Intent): Promise<{ ok: boolean; error?: string; turn: number }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent) return { ok: false, error: "unknown token", turn: arena.turn };
		if (arena.phase !== "playing") return { ok: false, error: "game not active", turn: arena.turn };
		if (agent.ready) return { ok: false, error: "turn already ended", turn: arena.turn };
		const result = applyIntent(this.world!, agent.factionId, intent);
		if (result.ok) agent.actions += 1;
		return { ok: result.ok, error: result.error, turn: arena.turn };
	}

	/** Marks the agent ready; when everyone is, advances one turn. */
	private async endTurn(token: string): Promise<{ advanced: boolean; turn: number }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent || arena.phase !== "playing") return { advanced: false, turn: arena.turn };
		agent.ready = true;
		if (!arena.agents.every((candidate) => candidate.ready)) {
			return { advanced: false, turn: arena.turn };
		}
		// Everyone is done: advance the simulation.
		for (let i = 0; i < arena.turnTicks; i += 1) this.world!.step();
		arena.turn += 1;
		for (const candidate of arena.agents) {
			candidate.ready = false;
			candidate.actions = 0;
		}
		if (this.world!.outcome !== null) {
			arena.phase = "finished";
			this.result = this.buildResult();
		}
		await this.save();
		this.broadcast();
		return { advanced: true, turn: arena.turn };
	}

	private buildResult(): ArenaResult {
		const world = this.world!;
		const ranking = world.rankings().map((factionId, index) => {
			const faction = world.factions[factionId]!;
			return {
				factionId,
				name: faction.name,
				rank: index + 1,
				quarters: world.modulesOwned(factionId),
				control: Math.round(world.controlRatio(factionId) * 1000) / 10,
				cleanCash: Math.round(faction.cleanCash),
				captures: faction.captures,
				eliminations: faction.eliminations,
			};
		});
		return { outcome: world.endReason, ranking, turns: this.arena!.turn };
	}

	/** Agent view: full snapshot (the agent filters it itself). */
	private async agentView(token: string): Promise<unknown> {
		await this.load();
		const agent = this.arena!.agents.find((candidate) => candidate.token === token);
		if (!agent) return { error: "unknown token" };
		return {
			factionId: agent.factionId,
			view: this.view(this.arenaId()),
			snapshot: this.world!.snapshot(),
		};
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const id = this.arenaId();

		if (path.endsWith("/create")) {
			const config = (await request.json()) as ArenaConfig;
			return Response.json(await this.create(id, config));
		}

		if (path.endsWith("/spectate")) {
			if (request.headers.get("Upgrade") !== "websocket") {
				return new Response("expected websocket", { status: 426 });
			}
			await this.load();
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			this.ctx.acceptWebSocket(server);
			server.send(
				JSON.stringify({
					kind: this.arena!.phase === "finished" ? "finished" : "state",
					view: this.view(id),
					snapshot: this.world!.snapshot(),
				} satisfies SpectatorMessage),
			);
			return new Response(null, { status: 101, webSocket: client });
		}

		if (path.endsWith("/view")) {
			await this.load();
			return Response.json(this.view(id));
		}

		if (path.endsWith("/state")) {
			const token = url.searchParams.get("token") ?? "";
			return Response.json(await this.agentView(token));
		}

		if (path.endsWith("/act")) {
			const body = (await request.json()) as { token: string; intent: Intent };
			return Response.json(await this.act(body.token, body.intent));
		}

		if (path.endsWith("/endTurn")) {
			const body = (await request.json()) as { token: string };
			return Response.json(await this.endTurn(body.token));
		}

		return new Response("Not Found", { status: 404 });
	}

	async webSocketMessage(): Promise<void> {
		// Read-only spectators: no message expected.
	}

	async webSocketClose(socket: WebSocket): Promise<void> {
		socket.close();
	}
}
