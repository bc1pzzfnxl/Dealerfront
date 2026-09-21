/**
 * Agent de référence — joue une arène DealerFront via l'API HTTP.
 * Sert de **template** : remplace `decide()` par ton LLM.
 *
 * Usage : bun run scripts/agent-example.ts <arena> <token> [baseUrl]
 */

import type { Intent } from "../src/sim/intents";

const BASE = process.argv[4] ?? "http://localhost:5173";
const ARENA = process.argv[2] ?? "";
const TOKEN = process.argv[3] ?? "";

interface Snapshot {
	tick: number;
	territory: { owner: number[]; control: number[]; building: number[] };
	factions: {
		id: number;
		members: number;
		produit: number;
		cashSale: number;
		cashPropre: number;
		buildings: number;
	}[];
}

const post = async (path: string, body: unknown): Promise<unknown> => {
	const response = await fetch(BASE + path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return response.json();
};

const state = async (): Promise<{ factionId: number; snapshot: Snapshot }> =>
	(await fetch(`${BASE}/api/arena/${ARENA}/state?token=${TOKEN}`).then((r) => r.json())) as {
		factionId: number;
		snapshot: Snapshot;
	};

const act = (intent: Intent): Promise<unknown> => post(`/api/arena/${ARENA}/act`, { token: TOKEN, intent });

/** Stratégie naïve : bâtir la chaîne éco, puis étendre sur le voisin le plus faible. */
async function decide(snapshot: Snapshot, factionId: number): Promise<Intent[]> {
	const me = snapshot.factions[factionId]!;
	const mine = snapshot.territory.owner.filter((owner) => owner === factionId).length;
	const intents: Intent[] = [];

	// 1. Chaîne économique d'abord.
	if (me.buildings < mine) {
		intents.push({ type: "batchBuild" });
	}
	// 2. Puis un peu de tech / guerre quand on a du Cash propre.
	if (me.cashPropre > 8000) intents.push({ type: "upgradeTech", branch: "armement" });
	if (me.cashSale > 6000) intents.push({ type: "hireMercenaries" });
	// 3. Expansion.
	intents.push({ type: "attackBest" });
	return intents;
}

async function main(): Promise<void> {
	if (!ARENA || !TOKEN) {
		console.error("Usage : bun run scripts/agent-example.ts <arena> <token> [baseUrl]");
		process.exit(1);
	}
	let lastTurn = -1;
	for (;;) {
		const { factionId, snapshot } = await state();
		if (!snapshot) {
			console.error("arène introuvable");
			process.exit(1);
		}
		const view = (await fetch(`${BASE}/api/arena/${ARENA}/view`).then((r) => r.json())) as {
			turn: number;
			phase: string;
		};
		if (view.phase === "finished") {
			console.log("Partie terminée.");
			return;
		}
		if (view.turn !== lastTurn) {
			lastTurn = view.turn;
			const intents = await decide(snapshot, factionId);
			for (const intent of intents) {
				await act(intent);
			}
			await post(`/api/arena/${ARENA}/endTurn`, { token: TOKEN });
			console.log(`Tour ${view.turn} joué (${intents.length} actions).`);
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
}

void main();
