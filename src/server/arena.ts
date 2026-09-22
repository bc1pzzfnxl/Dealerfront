/**
 * Arena — one Durable Object **per game**. Holds the authoritative `World`,
 * receives agent intents (HTTP/MCP), and broadcasts state to spectators (WS).
 *
 * Lifecycle: **lobby → playing → finished**. The owner opens a table, agents
 * **join** at their own pace (each takes a distinct seat, hence a distinct
 * spawn), then the owner **starts**.
 *
 * **The game runs in real time.** A Durable Object *alarm* advances the
 * simulation every second, so agents act whenever they can and never wait for
 * each other: an LLM taking 30 s per decision simply plays fewer actions than a
 * script, instead of freezing the table. The old turn barrier made the fastest
 * agent hostage to the slowest (and a 260-turn game took hours).
 * See docs/arena.md.
 */

import { DurableObject } from "cloudflare:workers";
import { applyIntent, type Intent } from "../sim/intents";
import { World, type WorldSnapshot } from "../sim/world";
import { compactState } from "./agent-view";
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
	phase: ArenaPhase;
	ownerToken: string;
	agents: AgentInfo[];
	/** Seats at the table. Agents take them; leftover seats become AI bots. */
	seats: number;
	/** Game seconds simulated per real second. */
	ticksPerSecond: number;
	/** Wall clock of the last agent request — used to stop idle games. */
	lastActivity: number;
	/** Alarms since the last snapshot write. */
	alarms: number;
}

const MIN_SEATS = 2;
/** Hard cap: the faction name palette has 6 entries. */
const MAX_SEATS = 6;
/** Real time between simulation steps. */
const ALARM_MS = 1000;
/**
 * Default game speed: 5 game seconds per real second. Half of real time, which
 * gives a slow (LLM) agent twice the wall-clock room to think per action. The
 * host can raise it to 10 for a strict real-time game.
 */
const DEFAULT_TICKS_PER_SECOND = 5;
/** Stop simulating after this long with no agent activity (free-plan courtesy). */
const IDLE_STOP_MS = 5 * 60 * 1000;
/** Persist the world every N alarms rather than every second. */
const SAVE_EVERY_ALARMS = 10;

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

	/** Arms the simulation clock if it is not already running. */
	private async schedule(): Promise<void> {
		const current = await this.ctx.storage.getAlarm();
		if (current === null) await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
	}

	/**
	 * One real second of game time. Re-arms itself; stops when the game is over
	 * or when nobody has touched the table for a while.
	 */
	async alarm(): Promise<void> {
		await this.load();
		const arena = this.arena;
		if (!arena || arena.phase !== "playing" || !this.world) return;
		// Nobody is playing: stop burning Durable Object time. The next request
		// re-arms the clock.
		if (Date.now() - arena.lastActivity > IDLE_STOP_MS) return;

		for (let i = 0; i < arena.ticksPerSecond; i += 1) this.world.step();
		arena.alarms += 1;

		if (this.world.outcome !== null) {
			arena.phase = "finished";
			this.result = this.buildResult();
			await this.save();
			this.broadcast();
			return;
		}
		if (arena.alarms % SAVE_EVERY_ALARMS === 0) await this.save();
		this.broadcast();
		await this.schedule();
	}

	private view(id: string): ArenaView {
		const arena = this.arena!;
		return {
			id,
			phase: arena.phase,
			tick: this.world?.tick ?? 0,
			ticksPerSecond: arena.ticksPerSecond,
			seed: arena.seed,
			agents: arena.agents.map((agent) => ({
				factionId: agent.factionId,
				name: agent.name,
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

	/** Opens the table in the **lobby** phase. The world is built at `start`. */
	private async create(id: string, config: ArenaConfig): Promise<CreateResponse> {
		const seats = Math.max(MIN_SEATS, Math.min(MAX_SEATS, Math.floor(config.seats)));
		const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
		this.arena = {
			seed,
			phase: "lobby",
			ownerToken: crypto.randomUUID(),
			agents: [],
			seats,
			ticksPerSecond: Math.max(
				1,
				Math.min(20, Math.floor(config.ticksPerSecond ?? DEFAULT_TICKS_PER_SECOND)),
			),
			lastActivity: Date.now(),
			alarms: 0,
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
		};
		arena.agents.push(agent);
		arena.lastActivity = Date.now();
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
	 * Starts the game (owner only). Seats nobody took become **AI bots**, and
	 * only the agents are `controlled` — the bots are driven by the AI.
	 */
	private async start(id: string, ownerToken: string): Promise<ArenaView | { error: string }> {
		await this.load();
		const arena = this.arena!;
		if (arena.ownerToken !== ownerToken) return { error: "not the owner" };
		if (arena.phase !== "lobby") return { error: "already started" };
		if (arena.agents.length === 0) return { error: "no agent joined yet" };
		const world = new World(arena.seed, {
			factionCount: arena.seats,
			controlled: arena.agents.map((agent) => agent.factionId),
		});
		for (const agent of arena.agents) {
			agent.name = world.factions[agent.factionId]?.name ?? agent.name;
		}
		this.world = world;
		arena.phase = "playing";
		arena.lastActivity = Date.now();
		arena.alarms = 0;
		await this.save();
		await this.schedule();
		this.broadcast();
		return this.view(id);
	}

	/** Deletes the arena and its stored world (owner only). */
	private async destroy(ownerToken: string): Promise<{ ok: boolean; error?: string }> {
		await this.load();
		if (this.arena!.ownerToken !== ownerToken) return { ok: false, error: "not the owner" };
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
		this.arena = null;
		this.world = null;
		this.result = null;
		return { ok: true };
	}

	/** Applies an agent intent, immediately and without any turn gating. */
	private async act(
		token: string,
		intent: Intent,
	): Promise<{ ok: boolean; error?: string; tick: number }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent) return { ok: false, error: "unknown token", tick: this.world?.tick ?? 0 };
		if (arena.phase !== "playing") {
			return { ok: false, error: "game not active", tick: this.world?.tick ?? 0 };
		}
		arena.lastActivity = Date.now();
		const result = applyIntent(this.world!, agent.factionId, intent);
		// The clock may have been stopped by an idle timeout: restart it.
		await this.schedule();
		return { ok: result.ok, error: result.error, tick: this.world!.tick };
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
		return { outcome: world.endReason, ranking, seconds: Math.round(world.tick / 10) };
	}

	/**
	 * Agent view: the **compact** state (a few KB, decision-oriented) rather than
	 * the raw 30 KB snapshot. `full=1` still returns the raw snapshot.
	 */
	private async agentView(token: string, full: boolean): Promise<unknown> {
		await this.load();
		const agent = this.arena!.agents.find((candidate) => candidate.token === token);
		if (!agent) return { error: "unknown token" };
		this.arena!.lastActivity = Date.now();
		await this.schedule();
		return {
			factionId: agent.factionId,
			view: this.view(this.arenaId()),
			state: this.world ? compactState(this.world, agent.factionId) : null,
			snapshot: full ? (this.world?.snapshot() ?? null) : undefined,
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
			return Response.json(await this.agentView(token, url.searchParams.get("full") === "1"));
		}

		if (path.endsWith("/act")) {
			const body = (await request.json()) as { token: string; intent: Intent };
			return Response.json(await this.act(body.token, body.intent));
		}

		/**
		 * Kept as a no-op so scripts written for the turn-based arena keep
		 * working: there is no turn to end any more.
		 */
		if (path.endsWith("/endTurn")) {
			await this.load();
			this.arena!.lastActivity = Date.now();
			return Response.json({ advanced: true, tick: this.world?.tick ?? 0 });
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
