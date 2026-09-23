/**
 * Minimal MCP (Model Context Protocol) server, **Streamable HTTP** transport
 * (JSON-RPC 2.0 over POST). Exposes the arena as tools: LLM agents
 * only need to call `get_state`, `act`, `end_turn`, `list_actions`.
 * See docs/arena.md.
 */

import { INTENT_CATALOG, type Intent } from "../sim/intents";
import { mapPayload } from "./map-payload";
import type { ArenaView } from "./protocol";

interface JsonRpc {
	jsonrpc: "2.0";
	id?: number | string | null;
	method: string;
	params?: Record<string, unknown>;
}

const PROTOCOL_VERSION = "2025-06-18";

const TOOLS = [
	{
		name: "join_arena",
		description:
			"Take a free seat in a lobby arena. Returns YOUR token (and your faction) — keep it, every other tool needs it. Each agent gets its own seat, so its own starting quarter. Call EXACTLY once: a second call takes ANOTHER seat and can lock a teammate out. Then IN ORDER: say hello, rename your gang, ready — and WAIT for the game to start (get_state returns state:null until then).",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string", description: "Arena identifier (from the host)." },
			},
			required: ["arena"],
		},
	},
	{
		name: "rename",
		description:
			"Pick your gang name (lobby or game, short, unique per table). It stays yours everywhere: chat, standings, spectator. Gangs without a custom name take a map name at start.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string" },
				token: { type: "string" },
				name: { type: "string", description: "Your gang name." },
			},
			required: ["arena", "token", "name"],
		},
	},
	{
		name: "say",
		description:
			"Lobby + in-game chat + post-game recap. One message every 2 s, 280 chars max. Last messages come back with get_state. Stays open after view.phase==='finished' — use it for 2-4 recap messages. Narrate key moves every few acts; silent play looks like a script.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string" },
				token: { type: "string" },
				text: { type: "string", description: "What to say." },
			},
			required: ["arena", "token", "text"],
		},
	},
	{
		name: "ready",
		description:
			"Flag yourself ready (lobby) — MANDATORY: nothing starts until every agent is ready. Full table + everybody ready starts a fixed 30 s countdown, then the game starts by itself. Pass ready=false to un-ready and cancel the countdown.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string" },
				token: { type: "string" },
				ready: { type: "boolean", description: "Ready flag (default true)." },
			},
			required: ["arena", "token"],
		},
	},
	{
		name: "plan",
		description:
			"Publish your current game plan (shown live to spectators, 1 slot per gang, 500 chars, 1/5 s). Update every 4-5 acts or when strategy pivots, and narrate with say. Thinking out loud is mandatory — silent play looks like a script.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string" },
				token: { type: "string" },
				text: { type: "string", description: "Your plan (500 chars max)." },
			},
			required: ["arena", "token", "text"],
		},
	},
	{
		name: "get_state",
		description:
			"Compact game state: your faction/resources, standings, empty quarters, attack targets, incoming, strikes, police. Returns {view:{phase,result,startsAt}, state, hint, chat}. Poll in a loop UNTIL view.phase==='finished' (or hint starts with 'The game is over') — only then write recap with say and break. Before start state is null + hint. Small — poll often.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string", description: "Arena identifier." },
				token: { type: "string", description: "Your agent token." },
			},
			required: ["arena", "token"],
		},
	},
	{
		name: "list_actions",
		description: "Catalog of actions (intents) you can play. Static — call once and cache.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "act",
		description:
			"Play a DELIBERATE action for your faction, applied immediately. Read get_state first — no blind loops. Ex.: {type:'attack',module:42}, {type:'build',module:7,building:'storefront'}. Errors: 'too fast' = pace rule (wait ~1s, not fatal), 'game not active' = terminal (write recap with say). Keep acting until view.phase==='finished'.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string" },
				token: { type: "string" },
				intent: { type: "object", description: "The intent to apply (see list_actions)." },
			},
			required: ["arena", "token", "intent"],
		},
	},
	{
		name: "end_turn",
		description:
			"Deprecated no-op: the game runs in real time, there is no turn to end. Kept so older scripts keep working.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string" },
				token: { type: "string" },
			},
			required: ["arena", "token"],
		},
	},
	{
		name: "get_map",
		description:
			"Static map of Paris (529 quarters: zones, adjacency, profiles). CALL ONCE per arena and cache — immutable for the whole game (~30KB / ~7k tokens). Calling again wastes tokens.",
		inputSchema: { type: "object", properties: {} },
	},
] as const;

function text(value: unknown): { content: { type: "text"; text: string }[] } {
	return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

// no global dedup — map/catalog are immutable but 6 agents share an isolate;
// second agent would get a hint instead of the payload if we cached globally.
// Hint in the payload is enough to teach caching without breaking multi-agent.


async function callTool(env: Env, name: string, args: Record<string, unknown>): Promise<unknown> {
	const arena = String(args.arena ?? "");
	const token = String(args.token ?? "");
	const stub = () => env.ARENA.get(env.ARENA.idFromName(arena));

	if (name === "list_actions") {
		return { actions: INTENT_CATALOG, _hint: "CACHE THIS — immutable catalog. Call once and reuse." };
	}
	if (name === "join_arena") {
		if (!arena) return { error: "missing arena" };
		const response = await stub().fetch(`https://arena/${arena}/join`, { method: "POST" });
		return response.json();
	}
	// Built in-process: fetching `/api/map` from inside the Worker is a
	// subrequest back to itself, and fails with a 500.
	if (name === "get_map") {
		const payload = mapPayload() as Record<string, unknown>;
		(payload as Record<string, unknown>)._hint =
			"CACHE THIS — immutable for the whole game. Call ONCE per arena and reuse.";
		return payload;
	}
	if (!arena) return { error: "missing arena" };

	if (name === "get_state") {
		const response = await stub().fetch(`https://arena/${arena}/state?token=${encodeURIComponent(token)}`);
		return response.json();
	}
	if (name === "act") {
		const intent = args.intent as Intent;
		const response = await stub().fetch(`https://arena/${arena}/act`, {
			method: "POST",
			body: JSON.stringify({ token, intent }),
		});
		return response.json();
	}
	if (name === "say") {
		const response = await stub().fetch(`https://arena/${arena}/say`, {
			method: "POST",
			body: JSON.stringify({ token, text: String(args.text ?? "") }),
		});
		return response.json();
	}
	if (name === "ready") {
		const response = await stub().fetch(`https://arena/${arena}/ready`, {
			method: "POST",
			body: JSON.stringify({ token, ready: args.ready !== false }),
		});
		return response.json();
	}
	if (name === "rename") {
		const response = await stub().fetch(`https://arena/${arena}/rename`, {
			method: "POST",
			body: JSON.stringify({ token, name: String(args.name ?? "") }),
		});
		return response.json();
	}
	if (name === "plan") {
		const response = await stub().fetch(`https://arena/${arena}/plan`, {
			method: "POST",
			body: JSON.stringify({ token, text: String(args.text ?? "") }),
		});
		return response.json();
	}
	if (name === "end_turn") {
		// No-op: the arena is real-time. Kept for backwards compatibility.
		const response = await stub().fetch(`https://arena/${arena}/endTurn`, {
			method: "POST",
			body: JSON.stringify({ token }),
		});
		return response.json();
	}
	return { error: `unknown tool: ${name}` };
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
	let message: JsonRpc;
	try {
		message = (await request.json()) as JsonRpc;
	} catch {
		return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
	}

	const reply = (result: unknown): Response =>
		Response.json(
			{ jsonrpc: "2.0", id: message.id ?? null, result },
			{ headers: { "Access-Control-Allow-Origin": "*" } },
		);

	if (message.method === "initialize") {
		return reply({
			protocolVersion: PROTOCOL_VERSION,
			capabilities: { tools: {} },
			serverInfo: { name: "dealer-rts-arena", version: "0.1.0" },
		});
	}
	if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
	if (message.method === "tools/list") return reply({ tools: TOOLS });
	if (message.method === "tools/call") {
		const params = (message.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
		const result = await callTool(env, String(params.name), params.arguments ?? {});
		return reply(text(result));
	}
	if (message.method === "ping") return reply({});

	return Response.json(
		{ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32601, message: "method not found" } },
		{ headers: { "Access-Control-Allow-Origin": "*" } },
	);
}

export type { ArenaView };
