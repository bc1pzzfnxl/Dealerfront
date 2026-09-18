/**
 * Banc de simulation — 100 parties headless, résultats en SQLite (`bun:sqlite`)
 * + export JSON pour le dashboard.
 * Usage : bun run sim:bench   (env : SEEDS, CADENCE, TICKS)
 */

import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { playOut } from "../src/sim/bot";
import { createRng } from "../src/sim/rng";
import { ARCHETYPES, type Archetype } from "../src/sim/types";
import { World } from "../src/sim/world";

const SEEDS = Number(process.env.SEEDS ?? 100);
const CADENCE = Number(process.env.CADENCE ?? 30);
const MAX_TICKS = Number(process.env.TICKS ?? 20000);
const DB_PATH = "data/sim.sqlite";
const JSON_PATH = "src/dashboard/sim-data.json";

interface Run {
	seed: number;
	archetype: string;
	outcome: string;
	reason: string;
	ticks: number;
	durationS: number;
	control: number;
	clean: number;
	totalClean: number;
	buildings: number;
	pressure: number;
	raids: number;
	pacts: number;
	captures: number;
	eliminations: number;
}

function runSeed(seed: number): Run {
	const archetype = ARCHETYPES[seed % ARCHETYPES.length] as Archetype;
	const world = new World(seed, archetype);
	const rng = createRng((seed * 7919 + 13) >>> 0);
	const ticks = playOut(world, rng, MAX_TICKS, CADENCE);
	let totalClean = 0;
	for (const faction of world.factions) totalClean += faction.cashPropre;
	return {
		seed,
		archetype: world.city.archetype,
		outcome: world.outcome ?? "none",
		reason: world.endReason,
		ticks,
		durationS: ticks / 10,
		control: world.controlRatio(world.player.id),
		clean: Math.round(world.player.cashPropre),
		totalClean: Math.round(totalClean),
		buildings: world.player.buildings,
		pressure: Math.round(world.police.pressure * 10) / 10,
		raids: world.police.raids,
		pacts: world.pacts.length,
		captures: world.player.captures,
		eliminations: world.player.eliminations,
	};
}

const startedAt = new Date().toISOString();
const runs: Run[] = [];
const start = performance.now();
for (let seed = 0; seed < SEEDS; seed += 1) runs.push(runSeed(seed));
const elapsed = (performance.now() - start) / 1000;

mkdirSync("data", { recursive: true });
const db = new Database(DB_PATH);
db.run(`CREATE TABLE IF NOT EXISTS runs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	seed INTEGER, archetype TEXT, cadence INTEGER, outcome TEXT, reason TEXT,
	ticks INTEGER, duration_s REAL, control REAL, clean INTEGER, total_clean INTEGER,
	buildings INTEGER, pressure REAL, raids INTEGER, pacts INTEGER,
	captures INTEGER, eliminations INTEGER, created_at TEXT
)`);
db.run("DELETE FROM runs");
const insert = db.prepare(
	`INSERT INTO runs (seed, archetype, cadence, outcome, reason, ticks, duration_s, control,
	 clean, total_clean, buildings, pressure, raids, pacts, captures, eliminations, created_at)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
db.transaction(() => {
	for (const run of runs) {
		insert.run(
			run.seed,
			run.archetype,
			CADENCE,
			run.outcome,
			run.reason,
			run.ticks,
			run.durationS,
			run.control,
			run.clean,
			run.totalClean,
			run.buildings,
			run.pressure,
			run.raids,
			run.pacts,
			run.captures,
			run.eliminations,
			startedAt,
		);
	}
})();
const total = db.query("SELECT COUNT(*) AS n FROM runs").get() as { n: number };
db.close();

mkdirSync("src/dashboard", { recursive: true });
writeFileSync(
	JSON_PATH,
	JSON.stringify(
		{
			meta: {
				seeds: SEEDS,
				cadence: CADENCE,
				maxTicks: MAX_TICKS,
				generatedAt: startedAt,
				computeSeconds: Math.round(elapsed * 10) / 10,
			},
			runs,
		},
		null,
		2,
	),
);

const wins = runs.filter((run) => run.outcome === "victory").length;
console.log(`=== Bench ${SEEDS} parties · bot toutes les ${CADENCE} ticks ===`);
console.log(`SQLite : ${DB_PATH} (${total.n} lignes) · JSON : ${JSON_PATH}`);
console.log(`Victoires ${wins} · Défaites ${runs.length - wins} · calcul ${elapsed.toFixed(1)} s`);
console.log(`Butin : avg ${Math.round(runs.reduce((s, r) => s + r.captures, 0) / runs.length)} captures, ` +
	`pression ${Math.round(runs.reduce((s, r) => s + r.pressure, 0) / runs.length)}, ` +
	`durée ${Math.round(runs.reduce((s, r) => s + r.durationS, 0) / runs.length / 60)} min`);
