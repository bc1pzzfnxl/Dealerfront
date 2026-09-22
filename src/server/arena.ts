/**
 * Arena — one Durable Object **per game**. Holds the authoritative `World`,
 * receives agent intents (HTTP), advances the simulation **at the agents'
 * pace** (one turn = `turnTicks` ticks, triggered when everyone is done), and
 * broadcasts state to spectators (WebSocket).
 *
 * Lifecycle: **lobby → playing → finished**. The owner opens the table, agents
 * **join** at their own pace (each takes a distinct seat, hence a distinct
 * spawn — nobody shares a quarter), then the owner **starts** the game.
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
	JoinResponse,
	SpectatorMessage,
} from "./protocol";

interface ArenaState {
	seed: number;
	turnTicks: number;
	turn: number;
	phase: ArenaPhase;
	ownerToken: string;
	agents: AgentInfo[];
	/** Seats at the table. Agents take them; leftover seats become AI bots. */
	seats: number;
}

const MIN_SEATS = 2;
/** Hard cap: the faction name palette has 6 entries. */
const MAX_SEATS = 6;

export class Arena extends DurableObject<Env> {
	private arena: ArenaState | null = null;
	private world: World | null = null;
	private result: ArenaResult | null = null;

	/** Loads state from the DO storage (the world only exists once started). */
	private async load(): Promise<void> {
		if (this.arena) return;
		const stored = await this.ctx.storage.get<ArenaState>("arena");
		if (!stored) throw new Error("arena does not exist");
		this.arena = stored;
		const snapshot = await this.ctx.storage.get<WorldSnapshot>("world");
		if (!snapshot) return;
		const world = new World(stored.seed, {
			factionCount: stored.seats,
			controlled: stored.agents.map((agent) => agent.factionId),
		});
		world.applySnapshot(snapshot);
		this.world = world;
		this.result = (await this.ctx.storage.get<ArenaResult>("result")) ?? null;
	}

	private async save(): Promise<void> {
		if (!this.arena) return;
		await this.ctx.storage.put("arena", this.arena);
		if (this.world) await this.ctx.storage.put("world", this.world.snapshot());
		if (this.result) await this.ctx.storage.put("result", this.result);
	}

	private view(id: string): ArenaView {
		const arena = this.arena!;
		return {
			id,
			phase: arena.phase,
			turn: arena.turn,
			tick: this.world?.tick ?? 0,
			turnTicks: arena.turnTicks,
			seed: arena.seed,
			agents: arena.agents.map((agent) => ({
				factionId: agent.factionId,
				name: agent.name,
				ready: agent.ready,
				actions: agent.actions,
			})),
			seats: arena.seats,
			result: this.result,
		};
	}

	private broadcast(): void {
		const id = this.arenaId();
		const snapshot = this.world?.snapshot();
		const message: SpectatorMessage =
			this.arena!.phase === "finished"
				? { kind: "finished", view: this.view(id), snapshot }
				: { kind: "state", view: this.view(id), snapshot };
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

	/**
	 * Opens the table in the **lobby** phase. No world yet: it is built at
	 * `start`, once the seats are known.
	 */
	private async create(id: string, config: ArenaConfig): Promise<CreateResponse> {
		const seats = Math.max(MIN_SEATS, Math.min(MAX_SEATS, Math.floor(config.seats)));
		const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
		this.arena = {
			seed,
			turnTicks: Math.max(1, config.turnTicks ?? 50),
			turn: 0,
			phase: "lobby",
			ownerToken: crypto.randomUUID(),
			agents: [],
			seats,
		};
		this.world = null;
		this.result = null;
		await this.save();
		return {
			view: this.view(id),
			ownerToken: this.arena.ownerToken,
			joinUrl: `/api/arena/${id}/join`,
		};
	}

	/**
	 * Takes a seat. Each agent gets its **own faction**, so each gets its own
	 * derived spawn — two agents can never start on the same quarter.
	 */
	private async join(id: string): Promise<JoinResponse | { error: string }> {
		await this.load();
		const arena = this.arena!;
		if (arena.phase !== "lobby") return { error: "game already started" };
		if (arena.agents.length >= arena.seats) return { error: "no seat left" };
		const taken = new Set(arena.agents.map((agent) => agent.factionId));
		let factionId = 0;
		while (taken.has(factionId)) factionId += 1;
		const agent: AgentInfo = {
			factionId,
			name: `Seat ${factionId + 1}`,
			token: crypto.randomUUID(),
			ready: false,
			actions: 0,
		};
		arena.agents.push(agent);
		await this.save();
		this.broadcast();
		return {
			arena: id,
			factionId,
			name: agent.name,
			token: agent.token,
			free: arena.seats - arena.agents.length,
		};
	}

	/**
	 * Starts the game (owner only). Seats nobody took are filled with **AI bots**,
	 * and only the agents are `controlled` — the bots are driven by the AI while
	 * the agents wait for their turn.
	 */
	private async start(id: string, ownerToken: string): Promise<ArenaView | { error: string }> {
		await this.load();
		const arena = this.arena!;
		if (arena.ownerToken !== ownerToken) return { error: "not the owner" };
		if (arena.phase !== "lobby") return { error: "already started" };
		// With no agent the turn can never be ended: the game would freeze at
		// tick 0 forever. Refuse rather than open a dead table.
		if (arena.agents.length === 0) return { error: "no agent joined yet" };
		const world = new World(arena.seed, {
			factionCount: arena.seats,
			controlled: arena.agents.map((agent) => agent.factionId),
		});
		// The world names the cartels from their real spawn; mirror that on the seats.
		for (const agent of arena.agents) {
			agent.name = world.factions[agent.factionId]?.name ?? agent.name;
			agent.ready = false;
			agent.actions = 0;
		}
		this.world = world;
		arena.phase = "playing";
		await this.save();
		this.broadcast();
		return this.view(id);
	}

	/**
	 * Force-advances one turn without waiting for the agents (owner only). The
	 * "no timeout" rule is deliberate, but a stalled LLM session must not freeze
	 * the table forever.
	 */
	private async skip(ownerToken: string): Promise<{ advanced: boolean; turn: number }> {
		await this.load();
		const arena = this.arena!;
		if (arena.ownerToken !== ownerToken) return { advanced: false, turn: arena.turn };
		if (arena.phase !== "playing") return { advanced: false, turn: arena.turn };
		for (const agent of arena.agents) agent.ready = true;
		return this.endTurn(arena.agents[0]!.token);
	}

	/** Deletes the arena and its stored world (owner only). */
	private async destroy(ownerToken: string): Promise<{ ok: boolean; error?: string }> {
		await this.load();
		if (this.arena!.ownerToken !== ownerToken) return { ok: false, error: "not the owner" };
		await this.ctx.storage.deleteAll();
		this.arena = null;
		this.world = null;
		this.result = null;
		return { ok: true };
	}

	/** Applies an agent intent. */
	private async act(
		token: string,
		intent: Intent,
	): Promise<{ ok: boolean; error?: string; turn: number }> {
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
			snapshot: this.world?.snapshot() ?? null,
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

		if (path.endsWith("/join")) {
			return Response.json(await this.join(id));
		}

		if (path.endsWith("/start")) {
			const body = (await request.json()) as { ownerToken: string };
			return Response.json(await this.start(id, body.ownerToken));
		}

		if (path.endsWith("/skip")) {
			const body = (await request.json()) as { ownerToken: string };
			return Response.json(await this.skip(body.ownerToken));
		}

		if (path.endsWith("/delete")) {
			const body = (await request.json()) as { ownerToken: string };
			return Response.json(await this.destroy(body.ownerToken));
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
					snapshot: this.world?.snapshot(),
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
