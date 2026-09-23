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
	ChatMessage,
	CreateResponse,
	JoinResponse,
	SpectatorMessage,
} from "./protocol";

interface ArenaState {
	seed: number;
	phase: ArenaPhase;
	ownerToken: string;
	agents: AgentInfo[];
	/** Seats at the table. Every seat must be taken by an external agent. */
	seats: number;
	/** Game seconds simulated per real second. */
	ticksPerSecond: number;
	/** Wall clock of the last agent request — used to stop idle games. */
	lastActivity: number;
	/** Alarms since the last snapshot write. */
	alarms: number;
	/** Lobby/game chat, oldest first (capped). */
	chat: ChatMessage[];
	/** Hype countdown deadline (wall-clock ms) — null when not counting down. */
	startsAt: number | null;
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
/** Stop simulating after this long with no agent activity (free-plan courtesy). 10 min for slow LLMs. */
const IDLE_STOP_MS = 10 * 60 * 1000;
/** Persist the world every N alarms rather than every second. */
const SAVE_EVERY_ALARMS = 10;
/**
 * Action budget: an agent earns **one action per simulated tick** (so 5/s at the
 * default speed — a human clicking), and can bank up to this many. Without it a
 * script can fire thousands of actions per second while an LLM is still reading
 * the state: real-time alone is not a fair pace.
 */
const MAX_ACTION_BUDGET = 10;
/**
 * Hype: once the table is full and every agent is ready, the game starts
 * after this long — the taunt window. Fixed: one less thing to configure.
 */
const HYPE_MS = 30_000;
/** Chat history kept per arena (the view ships the tail). */
const CHAT_CAP = 50;
const VIEW_CHAT = 20;
/** One chat message per agent every 2 s — taunts, not spam. */
const SAY_EVERY_MS = 2000;
const SAY_MAX_CHARS = 280;
/** Game plans: longer than taunts, at most one every 5 s. */
const PLAN_EVERY_MS = 5000;
const PLAN_MAX_CHARS = 500;
/** Gang names: short, unique per table. */
const NAME_MAX_CHARS = 24;

export class Arena extends DurableObject<Env> {
	private arena: ArenaState | null = null;
	private world: World | null = null;
	private result: ArenaResult | null = null;

	/** Loads state from the DO storage (the world only exists once started). */
	private async load(): Promise<void> {
		if (this.arena) return;
		const stored = await this.ctx.storage.get<ArenaState>("arena");
		if (!stored) throw new Error("arena does not exist");
		// Refuse ancient states (pre-realtime builds): the engine's required
		// fields are missing, and running them would corrupt the view (dropped
		// JSON keys, stalled clock). Delete the table and open a new one.
		if (
			typeof stored.seats !== "number" ||
			typeof stored.ticksPerSecond !== "number" ||
			!Array.isArray(stored.agents)
		) {
			throw new Error("arena outdated: delete it and open a new table");
		}
		this.arena = stored;
		// Backfill fields added after this arena was stored (chat/ready/hype).
		if (!Array.isArray(this.arena.chat)) this.arena.chat = [];
		if (typeof this.arena.startsAt !== "number" && this.arena.startsAt !== null) {
			this.arena.startsAt = null;
		}
		for (const agent of this.arena.agents) {
			if (typeof agent.ready !== "boolean") agent.ready = false;
			if (typeof agent.lastSay !== "number") agent.lastSay = 0;
			if (typeof agent.plan !== "string") agent.plan = "";
		}
		const snapshot = await this.ctx.storage.get<WorldSnapshot>("world");
		if (!snapshot) return;
		const world = new World(stored.seed, { factionCount: stored.seats });
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
	 * One real second. In lobby it ticks the hype countdown; in game it
	 * advances the simulation. Re-arms itself while there is something to do.
	 */
	async alarm(): Promise<void> {
		await this.load();
		const arena = this.arena;
		if (!arena) return;
		if (arena.phase === "lobby") {
			if (arena.startsAt === null) return;
			if (Date.now() >= arena.startsAt) {
				arena.startsAt = null;
				await this.beginGame(this.arenaId());
				return;
			}
			this.broadcast();
			await this.schedule();
			return;
		}
		if (arena.phase !== "playing" || !this.world) return;
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
				ready: agent.ready,
				plan: agent.plan,
			})),
			seats: arena.seats,
			chat: arena.chat.slice(-VIEW_CHAT),
			startsAt: arena.startsAt,
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
			chat: [],
			startsAt: null,
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
			lastSay: 0,
			plan: "",
			budget: MAX_ACTION_BUDGET,
			budgetTick: 0,
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
	 * Starts the game (owner only). Every seat must be taken by an external
	 * agent — there are no internal bots, so a partial table cannot start.
	 * Forces an immediate start, skipping any hype countdown.
	 */
	private async start(id: string, ownerToken: string): Promise<ArenaView | { error: string }> {
		await this.load();
		const arena = this.arena!;
		if (arena.ownerToken !== ownerToken) return { error: "not the owner" };
		if (arena.phase !== "lobby") return { error: "already started" };
		if (arena.agents.length < arena.seats) {
			return {
				error: `table not full: ${arena.agents.length}/${arena.seats} seats taken, every seat needs an external agent`,
			};
		}
		return this.beginGame(id);
	}

	/** Builds the world and flips the table to playing (host or countdown). */
	private async beginGame(id: string): Promise<ArenaView> {
		const arena = this.arena!;
		const world = new World(arena.seed, { factionCount: arena.seats });
		for (const agent of arena.agents) {
			// Names flow BOTH ways so every surface agrees: a gang that named
			// itself keeps its name in the world (map labels, standings,
			// agent views); the rest take the map's names.
			const def = `Seat ${agent.factionId + 1}`;
			const faction = world.factions[agent.factionId]!;
			if (agent.name === def) agent.name = faction.name;
			else faction.name = agent.name;
		}
		this.world = world;
		arena.phase = "playing";
		arena.startsAt = null;
		arena.lastActivity = Date.now();
		arena.alarms = 0;
		await this.save();
		await this.schedule();
		this.broadcast();
		return this.view(id);
	}

	/** Gang name (lobby + game). Short, unique per table — this is you. */
	private async rename(token: string, name: string): Promise<{ ok: boolean; name?: string; error?: string }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent) return { ok: false, error: "unknown token" };
		if (arena.phase === "finished") return { ok: false, error: "game over" };
		const clean = name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX_CHARS);
		if (!clean) return { ok: false, error: "empty name" };
		if (arena.agents.some((other) => other !== agent && other.name === clean)) {
			return { ok: false, error: "name taken" };
		}
		agent.name = clean;
		arena.lastActivity = Date.now();
		await this.save();
		this.broadcast();
		return { ok: true, name: clean };
	}

	/** Lobby/game chat: taunts before the game, trash-talk during it, recaps after. */
	private async say(token: string, text: string): Promise<{ ok: boolean; error?: string }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent) return { ok: false, error: "unknown token" };
		const clean = text.replace(/\s+/g, " ").trim().slice(0, SAY_MAX_CHARS);
		if (!clean) return { ok: false, error: "empty message" };
		const now = Date.now();
		if (now - agent.lastSay < SAY_EVERY_MS) {
			return { ok: false, error: "too fast: one message every 2 s" };
		}
		agent.lastSay = now;
		arena.chat.push({ factionId: agent.factionId, text: clean, at: now });
		if (arena.chat.length > CHAT_CAP) arena.chat.splice(0, arena.chat.length - CHAT_CAP);
		arena.lastActivity = now;
		await this.save();
		this.broadcast();
		return { ok: true };
	}

	/** Game plan, written by the agent (lobby, game, after): shown to spectators. */
	private async plan(token: string, text: string): Promise<{ ok: boolean; error?: string }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent) return { ok: false, error: "unknown token" };
		const clean = text.replace(/\s+/g, " ").trim().slice(0, PLAN_MAX_CHARS);
		if (!clean) return { ok: false, error: "empty plan" };
		const now = Date.now();
		if (now - agent.lastSay < PLAN_EVERY_MS) {
			return { ok: false, error: "too fast: one plan every 5 s" };
		}
		agent.lastSay = now;
		agent.plan = clean;
		arena.lastActivity = now;
		await this.save();
		this.broadcast();
		return { ok: true };
	}

	/** Ready flag (lobby). Full table + everybody ready → 30 s hype, then go. */
	private async ready(
		token: string,
		ready: boolean,
	): Promise<{ ok: boolean; ready?: boolean; startsAt?: number | null; error?: string }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent) return { ok: false, error: "unknown token" };
		if (arena.phase !== "lobby") return { ok: false, error: "already started" };
		agent.ready = ready;
		arena.lastActivity = Date.now();
		await this.maybeCountdown();
		await this.save();
		this.broadcast();
		return { ok: true, ready: agent.ready, startsAt: arena.startsAt };
	}

	/** Arms (or cancels) the hype countdown: full table and everybody ready. */
	private async maybeCountdown(): Promise<void> {
		const arena = this.arena!;
		if (arena.phase !== "lobby") return;
		const full = arena.agents.length >= arena.seats;
		const allReady = full && arena.agents.every((agent) => agent.ready);
		if (allReady && arena.startsAt === null) {
			arena.startsAt = Date.now() + HYPE_MS;
			await this.schedule();
		} else if (!allReady) {
			arena.startsAt = null;
		}
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
		// Action budget: one action per simulated tick, bankable up to a small cap.
		const tick = this.world!.tick;
		if (tick > agent.budgetTick) {
			agent.budget = Math.min(MAX_ACTION_BUDGET, agent.budget + (tick - agent.budgetTick));
			agent.budgetTick = tick;
		}
		if (agent.budget < 1) {
			return {
				ok: false,
				error: "too fast: one action per game second, bankable up to 10",
				tick,
			};
		}
		const result = applyIntent(this.world!, agent.factionId, intent);
		// Only an accepted action costs budget: a refused one did nothing.
		if (result.ok) agent.budget -= 1;
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
		// Lobby: no world yet. Say so plainly, so an agent waits instead of
		// hammering `act` and burning its context on errors.
		if (!this.world || this.arena!.phase !== "playing") {
			return {
				factionId: agent.factionId,
				view: this.view(this.arenaId()),
				state: null,
				chat: this.arena!.chat.slice(-10),
				hint:
					this.arena!.phase === "lobby"
						? `Lobby ${this.arena!.agents.length}/${this.arena!.seats}. MANDATORY order: 1) say hello 2) rename your gang 3) ready — NOTHING starts until every agent is ready, then a 30 s countdown starts the game by itself. 4) WAIT: poll get_state until state appears, do NOT act before.`
						: "The game is over. Write your recap with say: strategy, key moments, mistakes.",
			};
		}
		return {
			factionId: agent.factionId,
			view: this.view(this.arenaId()),
			state: compactState(this.world, agent.factionId),
			chat: this.arena!.chat.slice(-10),
			snapshot: full ? this.world.snapshot() : undefined,
		};
	}

	/** Never throws text: HTTP and MCP callers always get JSON, even for dead tables. */
	async fetch(request: Request): Promise<Response> {
		try {
			return await this.handle(request);
		} catch (error) {
			const message = error instanceof Error ? error.message : "unknown error";
			const status = message.includes("does not exist") ? 404 : 500;
			return Response.json({ error: message }, { status });
		}
	}

	private async handle(request: Request): Promise<Response> {
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

		if (path.endsWith("/say")) {
			const body = (await request.json()) as { token: string; text: string };
			return Response.json(await this.say(body.token, body.text ?? ""));
		}

		if (path.endsWith("/rename")) {
			const body = (await request.json()) as { token: string; name: string };
			return Response.json(await this.rename(body.token, body.name ?? ""));
		}

		if (path.endsWith("/plan")) {
			const body = (await request.json()) as { token: string; text: string };
			return Response.json(await this.plan(body.token, body.text ?? ""));
		}

		if (path.endsWith("/ready")) {
			const body = (await request.json()) as { token: string; ready?: boolean };
			return Response.json(await this.ready(body.token, body.ready !== false));
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
