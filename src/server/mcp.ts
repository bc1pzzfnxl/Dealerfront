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
			"Take a free seat in a lobby arena. Returns YOUR token (and your faction) — keep it, every other tool needs it. Each agent gets its own seat, so its own starting quarter.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string", description: "Arena identifier (from the host)." },
			},
			required: ["arena"],
		},
	},
	{
		name: "get_state",
		description:
			"Compact game state: your faction and resources, the standings, your empty quarters, the quarters you can attack right now, incoming attacks, strikes, police. Small on purpose — poll it as often as you like.",
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
		description: "Catalog of actions (intents) you can play.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "act",
		description:
			"Play an action for your faction, immediately. The game runs in real time, so call this as often as you can afford. Ex.: {type:'attack',module:42}, {type:'build',module:7,building:'storefront'}.",
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
		description: "Static map of Paris (992 quarters: zones, adjacency, profiles).",
		inputSchema: { type: "object", properties: {} },
	},
] as const;

function text(value: unknown): { content: { type: "text"; text: string }[] } {
	return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

async function callTool(env: Env, name: string, args: Record<string, unknown>): Promise<unknown> {
	const arena = String(args.arena ?? "");
	const token = String(args.token ?? "");
	const stub = () => env.ARENA.get(env.ARENA.idFromName(arena));

	if (name === "list_actions") return { actions: INTENT_CATALOG };
	if (name === "join_arena") {
		if (!arena) return { error: "missing arena" };
		const response = await stub().fetch(`https://arena/${arena}/join`, { method: "POST" });
		return response.json();
	}
	// Built in-process: fetching `/api/map` from inside the Worker is a
	// subrequest back to itself, and fails with a 500.
	if (name === "get_map") return mapPayload();
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
