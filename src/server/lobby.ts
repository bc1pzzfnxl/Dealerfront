/**
 * Lobby — singleton Durable Object: list of arenas (active and finished)
 * for the spectator home screen. See docs/arena.md.
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
			// Keep active games + a bounded history of finished ones.
			const all = [...this.arenas.values()].sort((a, b) => b.tick - a.tick);
			const active = all.filter((arena) => arena.phase !== "finished");
			const finished = all.filter((arena) => arena.phase === "finished").slice(0, MAX_HISTORY);
			await this.ctx.storage.put("arenas", [...active, ...finished]);
			return Response.json({ ok: true });
		}

		if (url.pathname.endsWith("/list")) {
			const all = [...this.arenas.values()].sort((a, b) => b.tick - a.tick);
			return Response.json(all);
		}

		/** Drops one arena from the list (after it is deleted). */
		if (url.pathname.endsWith("/remove")) {
			const { id } = (await request.json()) as { id: string };
			this.arenas.delete(id);
			await this.ctx.storage.put("arenas", [...this.arenas.values()]);
			return Response.json({ ok: true });
		}

		/** Wipes the list and the history. */
		if (url.pathname.endsWith("/clear")) {
			this.arenas.clear();
			await this.ctx.storage.put("arenas", []);
			return Response.json({ ok: true, cleared: true });
		}

		return new Response("Not Found", { status: 404 });
	}
}
