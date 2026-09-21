/**
 * Arena — un Durable Object **par partie**. Détient le `World` autoritaire,
 * reçoit les intents des agents (HTTP), avance la simulation **au rythme des
 * agents** (un tour = `turnTicks` ticks, déclenché quand tous ont fini) et
 * diffuse l'état aux spectateurs (WebSocket).
 * Voir docs/arena.md.
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
}

const MAX_AGENTS = 4;
const MIN_AGENTS = 2;

export class Arena extends DurableObject<Env> {
	private arena: ArenaState | null = null;
	private world: World | null = null;
	private result: ArenaResult | null = null;

	/** Charge (ou crée) l'état depuis le stockage du DO. */
	private async load(): Promise<void> {
		if (this.arena) return;
		const stored = await this.ctx.storage.get<ArenaState>("arena");
		if (!stored) throw new Error("arène inexistante");
		this.arena = stored;
		const snapshot = await this.ctx.storage.get<WorldSnapshot>("world");
		const world = new World(stored.seed, {
			factionCount: stored.agents.length,
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
				// socket fermé : ignoré
			}
		}
	}

	private arenaId(): string {
		return (this.ctx.id.name ?? this.ctx.id.toString()) as string;
	}

	/** Crée l'arène (appelé par le Worker). */
	private async create(id: string, config: ArenaConfig): Promise<CreateResponse> {
		const count = Math.max(MIN_AGENTS, Math.min(MAX_AGENTS, Math.floor(config.agents)));
		const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
		const names = ["Cartel", "Gang Nord", "Gang Est", "Gang Sud"];
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
		};
		this.world = new World(seed, {
			factionCount: count,
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

	/** Applique un intent d'agent. */
	private async act(token: string, intent: Intent): Promise<{ ok: boolean; error?: string; turn: number }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent) return { ok: false, error: "token inconnu", turn: arena.turn };
		if (arena.phase !== "playing") return { ok: false, error: "partie non active", turn: arena.turn };
		if (agent.ready) return { ok: false, error: "tour déjà terminé", turn: arena.turn };
		const result = applyIntent(this.world!, agent.factionId, intent);
		if (result.ok) agent.actions += 1;
		return { ok: result.ok, error: result.error, turn: arena.turn };
	}

	/** Marque l'agent prêt ; quand tous le sont, avance d'un tour. */
	private async endTurn(token: string): Promise<{ advanced: boolean; turn: number }> {
		await this.load();
		const arena = this.arena!;
		const agent = arena.agents.find((candidate) => candidate.token === token);
		if (!agent || arena.phase !== "playing") return { advanced: false, turn: arena.turn };
		agent.ready = true;
		if (!arena.agents.every((candidate) => candidate.ready)) {
			return { advanced: false, turn: arena.turn };
		}
		// Tout le monde a fini : on avance la simulation.
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
				cashPropre: Math.round(faction.cashPropre),
				captures: faction.captures,
				eliminations: faction.eliminations,
			};
		});
		return { outcome: world.endReason, ranking, turns: this.arena!.turn };
	}

	/** Vue agent : snapshot complet (l'agent filtre lui-même). */
	private async agentView(token: string): Promise<unknown> {
		await this.load();
		const agent = this.arena!.agents.find((candidate) => candidate.token === token);
		if (!agent) return { error: "token inconnu" };
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
		// Spectateurs en lecture seule : aucun message attendu.
	}

	async webSocketClose(socket: WebSocket): Promise<void> {
		socket.close();
	}
}
