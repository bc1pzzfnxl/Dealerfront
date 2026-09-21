/**
 * Mass simulation — headless balancing harness (bun).
 * Usage: bun run sim:mass   (env vars: SEEDS, TICKS)
 */

import { BUILDING_TYPES } from "../src/sim/buildings";
import { AUTOPLAY_EVERY, playOut } from "../src/sim/bot";
import { createRng } from "../src/sim/rng";
import { World } from "../src/sim/world";

const SEEDS = Number(process.env.SEEDS ?? 200);
const MAX_TICKS = Number(process.env.TICKS ?? 15000);
const CADENCE = Number(process.env.CADENCE ?? AUTOPLAY_EVERY);

let violations = 0;

function checkInvariants(world: World): void {
	const factions = world.factions.length;
	for (let i = 0; i < world.territory.count; i += 1) {
		const owner = world.territory.owner[i]!;
		if (owner < -1 || owner >= factions) {
			violations += 1;
			console.error(`[invariant] invalid owner ${owner} at module ${i}`);
		}
		const control = world.territory.control[i]!;
		if (!Number.isFinite(control) || control < 0) {
			violations += 1;
			console.error(`[invariant] invalid control ${control} at module ${i}`);
		}
		const building = world.territory.building[i]!;
		if (building < -1 || building >= BUILDING_TYPES.length) {
			violations += 1;
			console.error(`[invariant] invalid building ${building} at module ${i}`);
		}
	}
	for (const faction of world.factions) {
		if (!Number.isFinite(faction.members) || faction.members < 0) {
			violations += 1;
			console.error(`[invariant] invalid members for ${faction.name}`);
		}
		if (!Number.isFinite(faction.cleanCash) || faction.cleanCash < 0) {
			violations += 1;
			console.error(`[invariant] invalid clean cash for ${faction.name}`);
		}
	}
}

function runSeed(seed: number): {
	outcome: string;
	ticks: number;
	control: number;
	clean: number;
	buildings: number;
	cleanAll: number;
	pressure: number;
	raids: number;
	liquidations: number;
	policeDefeat: boolean;
	reason: string;
	pacts: number;
} {
	const world = new World(seed);
	const rng = createRng((seed * 7919 + 13) >>> 0);
	let cleanAll = 0;
	const ticks = playOut(world, rng, MAX_TICKS, CADENCE);
	checkInvariants(world);
	for (const faction of world.factions) cleanAll += faction.cleanCash;
	return {
		outcome: world.outcome ?? "none",
		ticks,
		control: world.controlRatio(world.player.id),
		clean: world.player.cleanCash,
		buildings: world.player.buildings,
		cleanAll,
		pressure: world.police.pressure,
		raids: world.police.raids,
		liquidations: world.police.liquidations,
		policeDefeat: world.outcome === "defeat" && world.endReason.includes("Liquidation"),
		reason: world.endReason,
		pacts: world.pacts.length,
	};
}

function determinismCheck(): boolean {
	for (let seed = 0; seed < 8; seed += 1) {
		const run = (): number[] => {
			const world = new World(seed);
			const rng = createRng((seed * 7919 + 13) >>> 0);
			playOut(world, rng, 1200, CADENCE);
			return Array.from(world.territory.owner);
		};
		const a = run();
		const b = run();
		if (a.some((value, index) => value !== b[index])) {
			console.error(`[determinism] divergence at seed ${seed}`);
			return false;
		}
	}
	return true;
}

const outcomes: Record<string, number> = { victory: 0, defeat: 0, none: 0 };
let totalTicks = 0;
let totalControl = 0;
let totalClean = 0;
let totalBuildings = 0;
let totalCleanAll = 0;
let totalPressure = 0;
let totalRaids = 0;
let totalLiquidations = 0;
let policeDefeats = 0;
let totalPacts = 0;
const causes: Record<string, number> = {};

const start = performance.now();
for (let seed = 0; seed < SEEDS; seed += 1) {
	const result = runSeed(seed);
	outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
	totalTicks += result.ticks;
	totalControl += result.control;
	totalClean += result.clean;
	totalBuildings += result.buildings;
	totalCleanAll += result.cleanAll;
	totalPressure += result.pressure;
	totalRaids += result.raids;
	totalLiquidations += result.liquidations;
	if (result.policeDefeat) policeDefeats += 1;
	totalPacts += result.pacts;
	const cause = result.reason.includes("Liquidation")
		? "police liquidation"
		: result.reason.includes("Bankruptcy")
			? "bankruptcy"
			: result.reason.includes("eliminated")
				? "elimination"
				: "victory (last survivor)";
	causes[cause] = (causes[cause] ?? 0) + 1;
}
const elapsed = (performance.now() - start) / 1000;
const deterministic = determinismCheck();
const avgSeconds = totalTicks / SEEDS / 10;

console.log("=== Mass simulation (DealerFront) ===");
console.log(`Seeds             : ${SEEDS}  ·  max ticks/seed : ${MAX_TICKS}  ·  bot every ${CADENCE} ticks`);
console.log(
	`Results           : victory ${outcomes.victory} · defeat ${outcomes.defeat} · no end ${outcomes.none}`,
);
console.log(`Average length    : ${avgSeconds.toFixed(0)} s (${(totalTicks / SEEDS).toFixed(0)} ticks)`);
console.log(`Player control    : ${((totalControl / SEEDS) * 100).toFixed(1)} %`);
console.log(`Player clean cash : ${(totalClean / SEEDS).toFixed(0)}`);
console.log(`Total clean cash  : ${(totalCleanAll / SEEDS).toFixed(0)} (all factions)`);
console.log(`Player buildings  : ${(totalBuildings / SEEDS).toFixed(1)}`);
console.log(
	`Police            : Pressure ${(totalPressure / SEEDS).toFixed(1)} · raids ${(totalRaids / SEEDS).toFixed(1)}/game · liquidations ${(totalLiquidations / SEEDS).toFixed(2)}/game`,
);
console.log(`Police defeats    : ${policeDefeats}`);
console.log(`Active pacts      : ${(totalPacts / SEEDS).toFixed(2)} at end of game`);
console.log(`End causes        : ${Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`Violations        : ${violations}`);
console.log(`Determinism       : ${deterministic ? "OK" : "FAIL"}`);
console.log(`Compute time      : ${elapsed.toFixed(2)} s`);

if (violations > 0 || !deterministic) {
	process.exit(1);
}
