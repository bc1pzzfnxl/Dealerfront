/**
 * Serveur MCP (Model Context Protocol) minimal, transport **Streamable HTTP**
 * (JSON-RPC 2.0 en POST). Expose l'arène comme des outils : les agents LLM
 * n'ont qu'à appeler `get_state`, `act`, `end_turn`, `list_actions`.
 * Voir docs/arena.md.
 */

import { INTENT_CATALOG, type Intent } from "../sim/intents";
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
		name: "get_state",
		description:
			"État complet de la partie pour ton agent : ta faction, le tour, et l'instantané (quartiers, factions, police).",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string", description: "Identifiant de l'arène." },
				token: { type: "string", description: "Ton token d'agent." },
			},
			required: ["arena", "token"],
		},
	},
	{
		name: "list_actions",
		description: "Catalogue des actions (intents) que tu peux jouer.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "act",
		description:
			"Joue une action pour ta faction (autant que tu veux par tour). Ex. : {type:'attack',module:42}, {type:'build',module:7,building:'labo'}.",
		inputSchema: {
			type: "object",
			properties: {
				arena: { type: "string" },
				token: { type: "string" },
				intent: { type: "object", description: "L'intent à appliquer (voir list_actions)." },
			},
			required: ["arena", "token", "intent"],
		},
	},
	{
		name: "end_turn",
		description:
			"Termine ton tour. Quand tous les agents ont terminé, la simulation avance d'un tour.",
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
		description: "Carte statique de Paris (992 quartiers : zones, adjacence, profils).",
		inputSchema: { type: "object", properties: {} },
	},
] as const;

function text(value: unknown): { content: { type: "text"; text: string }[] } {
	return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

async function callTool(
	env: Env,
	name: string,
	args: Record<string, unknown>,
	origin: string,
): Promise<unknown> {
	const arena = String(args.arena ?? "");
	const token = String(args.token ?? "");
	const stub = () => env.ARENA.get(env.ARENA.idFromName(arena));

	if (name === "list_actions") return { actions: INTENT_CATALOG };
	if (name === "get_map") {
		const response = await fetch(`${origin}/api/map`);
		return response.json();
	}
	if (!arena) return { error: "arena manquant" };

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
		const response = await stub().fetch(`https://arena/${arena}/endTurn`, {
			method: "POST",
			body: JSON.stringify({ token }),
		});
		return response.json();
	}
	return { error: `outil inconnu : ${name}` };
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
	const origin = new URL(request.url).origin;
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
		const result = await callTool(env, String(params.name), params.arguments ?? {}, origin);
		return reply(text(result));
	}
	if (message.method === "ping") return reply({});

	return Response.json(
		{ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32601, message: "method not found" } },
		{ headers: { "Access-Control-Allow-Origin": "*" } },
	);
}

export type { ArenaView };
