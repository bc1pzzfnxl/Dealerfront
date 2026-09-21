/**
 * Integration playtest: exercises the entire player loop through the `World`
 * API (the same one the UI uses) and checks that a game stays playable to the end.
 * Usage: bun run scripts/playtest.ts
 */
import { BUILDING_INDEX, type BuildingType } from "../src/sim/buildings";
import { NEUTRAL } from "../src/sim/territory";
import { createRng } from "../src/sim/rng";
import { playOut } from "../src/sim/bot";
import { STRIKE } from "../src/sim/tech";
import { World } from "../src/sim/world";

const results: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
	results.push(`${ok ? "OK  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function firstNeutral(world: World): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) return i;
	}
	return -1;
}

function ownConversion(world: World, factionId: number, type: BuildingType): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] !== NEUTRAL) continue;
		if (world.buildingAt(i) !== null || world.constructionLeft(i) > 0) continue;
		if (!world.isConversion(i) || !world.allowedBuildings(i).includes(type)) continue;
		world.territory.owner[i] = factionId;
		world.territory.control[i] = 100;
		return i;
	}
	return -1;
}

/** Owned quarter adjacent to `target` (to launch an assault). */
function ownAdjacentTo(world: World, factionId: number, target: number): number {
	for (const n of world.neighbors(target)) {
		if (world.territory.owner[n] === factionId) return n;
	}
	// Otherwise take a neighboring neutral quarter and give it to the faction.
	for (const n of world.neighbors(target)) {
		if (world.territory.owner[n] === NEUTRAL) {
			world.territory.owner[n] = factionId;
			world.territory.control[n] = 100;
			return n;
		}
	}
	return -1;
}

function boost(world: World, clean = 1e6, sale = 1e6, members = 1e6): void {
	const p = world.player;
	p.cleanCash = clean;
	p.dirtyCash = sale;
	p.members = members;
}

// ---------- 1. Conquest ----------
{
	const world = new World(1);
	const target = world.neighbors(0)[0]!;
	world.territory.owner[target] = 1;
	world.territory.control[target] = 1;
	boost(world);
	const before = world.modulesOwned(world.player.id);
	const ok = world.playerAttack(target);
	let captured = false;
	for (let i = 0; i < 60; i += 1) {
		world.step();
		if (world.ownerAt(target) === world.player.id) captured = true;
	}
	check("assault + capture", ok && captured, `quarters ${before}→${world.modulesOwned(world.player.id)}`);
}

// ---------- 2. Construction (lab / storefront / front) ----------
{
	const world = new World(1);
	boost(world);
	const built: string[] = [];
	for (const type of ["lab", "storefront", "front"] as const) {
		const module = ownConversion(world, world.player.id, type);
		if (module < 0) continue;
		if (world.playerBuild(module, type)) {
			for (let i = 0; i < 400 && world.constructionLeft(module) > 0; i += 1) world.step();
			if (world.buildingAt(module) === type) built.push(type);
		}
	}
	check("build lab/storefront/front", built.length === 3, built.join(", "));
}

// ---------- 3. Build sites (no queue) ----------
{
	const world = new World(1);
	boost(world);
	const a = ownConversion(world, world.player.id, "lab");
	const b = ownConversion(world, world.player.id, "storefront");
	const builtA = a >= 0 && world.playerBuild(a, "lab");
	const builtB = b >= 0 && world.playerBuild(b, "storefront");
	const active = world.activeConstructions(world.player.id);
	const batch = world.playerBatchPreview();
	check("direct build sites + batch", builtA && builtB && active === 2, `${active} build sites, batch ${batch.count}`);
}

// ---------- 4. Tech ----------
{
	const world = new World(1);
	boost(world);
	const module = ownConversion(world, world.player.id, "workshop");
	world.territory.building[module] = BUILDING_INDEX.workshop;
	world.step();
	const ok = world.playerUpgradeTech("armament");
	check("tech research", ok && world.player.tech.armament === 1, `armament ${world.player.tech.armament}`);
}

// ---------- 5. Operations ----------
{
	const world = new World(1);
	boost(world);
	world.player.tech.armament = 3;
	const target = firstNeutral(world);
	world.territory.owner[target] = 1;
	world.territory.control[target] = 60;
	world.territory.building[target] = BUILDING_INDEX.storefront;
	world.factions[1]!.dirtyCash = 5000;
	ownAdjacentTo(world, world.player.id, target);
	// Bust requires a building: play it BEFORE the raid (which destroys it).
	const bust = world.playerCanBust(target) && world.playerBust(target);
	const raid = world.playerCanRaid(target) && world.playerRaid(target);
	check("bust / raid", bust && raid, `bust=${bust} raid=${raid}`);
}

// ---------- 6. Heavy strike ----------
{
	const world = new World(1);
	boost(world);
	world.player.tech.armament = 2;
	const target = firstNeutral(world);
	world.territory.owner[target] = 1;
	world.territory.control[target] = 90;
	ownAdjacentTo(world, world.player.id, target);
	const launched = world.playerCanStrike(target) && world.playerStrike(target);
	// Telegraphed: it must be visible in flight before it lands.
	const inFlight = world.pendingStrikes().length === 1;
	for (let i = 0; i < STRIKE.delayTicks; i += 1) world.step();
	check(
		"heavy strike",
		launched && inFlight && world.controlAt(target) < 90,
		`telegraphed, control ${Math.round(world.controlAt(target))}`,
	);
}

// ---------- 7. Police corruption ----------
{
	const world = new World(1);
	boost(world);
	world.police.pressure = 50;
	const cost = world.playerCorruptionCost();
	const ok = world.playerCanCorrupt() && world.playerCorrupt();
	check("corrupt the police", ok && world.police.pressure < 50, `cost ${cost}`);
}

// ---------- 8. Diplomacy ----------
{
	const world = new World(1);
	boost(world);
	const proposed = world.playerProposePact(1);
	// An outgoing offer sets the cooldown: you can't propose again right away.
	const cooldown = world.playerCanProposePact(1) === false;
	const embargo = world.playerCanEmbargo(2) && world.playerEmbargo(2);
	const refuses = world.playerBreakPact(1) === false; // no pact yet
	check("pact / embargo", proposed && cooldown && embargo && refuses, `proposed=${proposed} embargo=${embargo}`);
}

// ---------- 9. Choice event ----------
{
	const world = new World(1);
	boost(world);
	world.debugSetEvent({
		id: "livraison",
		title: "Test",
		body: "Test",
		kind: "info",
		choices: [
			{ label: "A", detail: "A" },
			{ label: "B", detail: "B" },
		],
	});
	const pending = world.pendingEvent();
	const before = world.player.dirtyCash;
	const chosen = pending ? world.playerChoose(0) : false;
	check("choice event", !!pending && chosen && world.player.dirtyCash > before, `+${world.player.dirtyCash - before} dirty`);
}

// ---------- 9b. War chest (paid armament) ----------
{
	const world = new World(1);
	boost(world);
	const before = world.attackBonus(world.player.id);
	const ok = world.playerCanBuyArmament() && world.playerBuyArmament();
	check("buy armament", ok && world.attackBonus(world.player.id) > before, `bonus ${before.toFixed(2)} → ${world.attackBonus(world.player.id).toFixed(2)}`);
}

// ---------- 9c. Mercenaries ----------
{
	const world = new World(1);
	boost(world);
	world.player.members = 0;
	const ok = world.playerCanHireMercenaries() && world.playerHireMercenaries();
	check("mercenaries (dirty → Members)", ok && world.player.members > 0, `+${Math.round(world.player.members)} members`);
}

// ---------- 9d. Quarter buyout ----------
{
	const world = new World(1);
	boost(world);
	const target = firstNeutral(world);
	world.territory.owner[target] = NEUTRAL;
	const adjacent = world.neighbors(target).some((n) => world.territory.owner[n] === world.player.id);
	// Force adjacency by giving the player a neighbor if needed.
	if (!adjacent) {
		const n = world.neighbors(target)[0];
		if (n !== undefined) {
			world.territory.owner[n] = world.player.id;
			world.territory.control[n] = 100;
		}
	}
	const ok = world.playerCanBuy(target) && world.playerBuy(target);
	check("buy a quarter (clean → territory)", ok && world.ownerAt(target) === world.player.id);
}

// ---------- 9e. Contract against a gang ----------
{
	const world = new World(1);
	boost(world);
	const ok = world.playerCanFundContract(1) && world.playerFundContract(1, 2);
	check("contract (pay a gang)", ok && world.factions[1]!.contractTarget === 2);
}

// ---------- 10. Full game (bot) ----------
{
	let finished = 0;
	let violations = 0;
	for (let seed = 0; seed < 8; seed += 1) {
		const world = new World(seed);
		const rng = createRng((seed * 7919 + 13) >>> 0);
		playOut(world, rng, 60000);
		if (world.outcome !== null) finished += 1;
		for (const f of world.factions) {
			if (!Number.isFinite(f.members) || f.members < 0) violations += 1;
		}
	}
	check("full games (8 seeds)", finished === 8 && violations === 0, `${finished}/8 finished, ${violations} violation(s)`);
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
