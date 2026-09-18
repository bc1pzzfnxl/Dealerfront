/**
 * Simulation massive — harnais d'équilibrage headless (bun).
 * Usage : bun run sim:mass   (variables : SEEDS, TICKS)
 */

import { BUILDING_TYPES } from "../src/sim/buildings";
import { AUTOPLAY_EVERY, playOut } from "../src/sim/bot";
import { createRng } from "../src/sim/rng";
import { ARCHETYPES, type Archetype } from "../src/sim/types";
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
			console.error(`[invariant] owner invalide ${owner} au module ${i}`);
		}
		const control = world.territory.control[i]!;
		if (!Number.isFinite(control) || control < 0) {
			violations += 1;
			console.error(`[invariant] contrôle invalide ${control} au module ${i}`);
		}
		const building = world.territory.building[i]!;
		if (building < -1 || building >= BUILDING_TYPES.length) {
			violations += 1;
			console.error(`[invariant] bâtiment invalide ${building} au module ${i}`);
		}
	}
	for (const faction of world.factions) {
		if (!Number.isFinite(faction.members) || faction.members < 0) {
			violations += 1;
			console.error(`[invariant] membres invalides pour ${faction.name}`);
		}
		if (!Number.isFinite(faction.cashPropre) || faction.cashPropre < 0) {
			violations += 1;
			console.error(`[invariant] cash propre invalide pour ${faction.name}`);
		}
	}
}

function archetypeFor(seed: number): Archetype {
	return ARCHETYPES[seed % ARCHETYPES.length] as Archetype;
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
	const world = new World(seed, archetypeFor(seed));
	const rng = createRng((seed * 7919 + 13) >>> 0);
	let cleanAll = 0;
	const ticks = playOut(world, rng, MAX_TICKS, CADENCE);
	checkInvariants(world);
	for (const faction of world.factions) cleanAll += faction.cashPropre;
	return {
		outcome: world.outcome ?? "none",
		ticks,
		control: world.controlRatio(world.player.id),
		clean: world.player.cashPropre,
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
			const world = new World(seed, archetypeFor(seed));
			const rng = createRng((seed * 7919 + 13) >>> 0);
			playOut(world, rng, 1200, CADENCE);
			return Array.from(world.territory.owner);
		};
		const a = run();
		const b = run();
		if (a.some((value, index) => value !== b[index])) {
			console.error(`[déterminisme] divergence à la seed ${seed}`);
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
	const cause = result.reason.includes("Temps écoulé")
		? "temps écoulé"
		: result.reason.includes("Liquidation")
			? "liquidation policière"
			: result.reason.includes("Faillite")
				? "faillite"
				: result.reason.includes("éliminé")
					? "élimination"
					: "victoire (contrôle + cash)";
	causes[cause] = (causes[cause] ?? 0) + 1;
}
const elapsed = (performance.now() - start) / 1000;
const deterministic = determinismCheck();
const avgSeconds = totalTicks / SEEDS / 10;

console.log("=== Simulation massive (DealerFront) ===");
console.log(`Seeds             : ${SEEDS}  ·  ticks max/seed : ${MAX_TICKS}  ·  bot toutes les ${CADENCE} ticks`);
console.log(
	`Résultats         : victoire ${outcomes.victory} · défaite ${outcomes.defeat} · sans fin ${outcomes.none}`,
);
console.log(`Durée moyenne     : ${avgSeconds.toFixed(0)} s (${(totalTicks / SEEDS).toFixed(0)} ticks)`);
console.log(`Contrôle joueur   : ${((totalControl / SEEDS) * 100).toFixed(1)} %`);
console.log(`Cash propre joueur: ${(totalClean / SEEDS).toFixed(0)}`);
console.log(`Cash propre total : ${(totalCleanAll / SEEDS).toFixed(0)} (toutes factions)`);
console.log(`Bâtiments joueur  : ${(totalBuildings / SEEDS).toFixed(1)}`);
console.log(
	`Police            : Pression ${(totalPressure / SEEDS).toFixed(1)} · raids ${(totalRaids / SEEDS).toFixed(1)}/partie · liquidations ${(totalLiquidations / SEEDS).toFixed(2)}/partie`,
);
console.log(`Défaites police   : ${policeDefeats}`);
console.log(`Pactes actifs     : ${(totalPacts / SEEDS).toFixed(2)} en fin de partie`);
console.log(`Causes de fin     : ${Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`Violations        : ${violations}`);
console.log(`Déterminisme      : ${deterministic ? "OK" : "ÉCHEC"}`);
console.log(`Durée calcul      : ${elapsed.toFixed(2)} s`);

if (violations > 0 || !deterministic) {
	process.exit(1);
}
