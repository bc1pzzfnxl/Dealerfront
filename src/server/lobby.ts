/**
 * Lobby — Durable Object singleton : liste des arènes (en cours et terminées)
 * pour l'écran d'accueil du spectateur. Voir docs/arena.md.
 */

import { DurableObject } from "cloudflare:workers";
import type { ArenaView } from "./protocol";

const MAX_HISTORY = 30;

export class Lobby extends DurableObject<Env> {
	private arenas = new Map<string, ArenaView>();

	private async load(): Promise<void> {
		if (this.arenas.size > 0) return;
		const stored = await this.ctx.storage.get<ArenaView[]>("arenas");
		for (const arena of stored ?? []) this.arenas.set(arena.id, arena);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		await this.load();

		if (url.pathname.endsWith("/update")) {
			const view = (await request.json()) as ArenaView;
			this.arenas.set(view.id, view);
			// On garde les parties en cours + un historique borné des terminées.
			const all = [...this.arenas.values()].sort((a, b) => b.turn - a.turn);
			const active = all.filter((arena) => arena.phase !== "finished");
			const finished = all.filter((arena) => arena.phase === "finished").slice(0, MAX_HISTORY);
			await this.ctx.storage.put("arenas", [...active, ...finished]);
			return Response.json({ ok: true });
		}

		if (url.pathname.endsWith("/list")) {
			const all = [...this.arenas.values()].sort((a, b) => b.turn - a.turn);
			return Response.json(all);
		}

		return new Response("Not Found", { status: 404 });
	}
}
