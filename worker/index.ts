/**
 * Worker API — hosted on Cloudflare Workers (free plan).
 * - `/api/health`: health.
 * - `/api/map`: static map (zones, adjacency, profiles) for agents.
 * - `/api/arena*`: agent vs agent arenas (Durable Objects) + WS spectator.
 * See docs/arena.md.
 */

import { agentGuide } from "../src/server/agent-guide";
import { mapPayload } from "../src/server/map-payload";
import type { ArenaConfig } from "../src/server/protocol";
import { handleMcp } from "../src/server/mcp";

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type,Authorization",
} as const;

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: CORS });
}

async function handleArena(request: Request, env: Env, id: string): Promise<Response> {
	const stub = env.ARENA.get(env.ARENA.idFromName(id));
	return stub.fetch(request);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

		if (pathname === "/api/health") {
			return json({
				service: "dealer-rts",
				status: "ok",
				runtime: "cloudflare-workers",
			});
		}

		if (pathname === "/api/map") return json(mapPayload());

		// Copy-paste prompt that turns an LLM into an agent. Served both at the
		// root and under `/api/` (the latter is always routed to the Worker).
		if (pathname === "/agent.md" || pathname === "/api/agent.md") {
			const origin = new URL(request.url).origin;
			return new Response(agentGuide(origin), {
				headers: { "Content-Type": "text/markdown; charset=utf-8", ...CORS },
			});
		}

		// MCP server (LLM agents): JSON-RPC Streamable HTTP.
		if (pathname === "/mcp" || pathname === "/mcp/") return handleMcp(request, env);

		// Create an arena: generate an id, initialize it, register it.
		if (pathname === "/api/arena" && request.method === "POST") {
			const config = (await request.json()) as ArenaConfig;
			const id = crypto.randomUUID().slice(0, 8);
			const stub = env.ARENA.get(env.ARENA.idFromName(id));
			const created = await stub.fetch(`https://arena/${id}/create`, {
				method: "POST",
				body: JSON.stringify(config),
			});
			const payload = (await created.json()) as { view: unknown };
			await env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch("https://lobby/update", {
				method: "POST",
				body: JSON.stringify(payload.view),
			});
			return json(payload);
		}

		if (pathname === "/api/arena" && request.method === "GET") {
			const lobby = env.LOBBY.get(env.LOBBY.idFromName("lobby"));
			return lobby.fetch("https://lobby/list");
		}

		// Wipes every listed arena (list + history). The Durable Objects
		// themselves are left alone; they are keyed by id and never reused.
		if (pathname === "/api/lobby/clear" && request.method === "POST") {
			const lobby = env.LOBBY.get(env.LOBBY.idFromName("lobby"));
			return json(await (await lobby.fetch("https://lobby/clear")).json());
		}

		const arenaMatch = /^\/api\/arena\/([^/]+)(\/.*)?$/.exec(pathname);
		if (arenaMatch) {
			const id = arenaMatch[1]!;
			const response = await handleArena(request, env, id);
			// After an action/turn, update the lobby.
			if (request.method === "POST") {
				const stub = env.ARENA.get(env.ARENA.idFromName(id));
				if (pathname.endsWith("/delete")) {
					await env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch("https://lobby/remove", {
						method: "POST",
						body: JSON.stringify({ id }),
					});
				} else {
					const view = await (await stub.fetch(`https://arena/${id}/view`)).json();
					await env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch("https://lobby/update", {
						method: "POST",
						body: JSON.stringify(view),
					});
				}
			}
			return response;
		}

		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

export { Arena } from "../src/server/arena";
export { Lobby } from "../src/server/lobby";
