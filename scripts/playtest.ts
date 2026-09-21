/**
 * Playtest d'intégration : exerce toute la boucle joueur via l'API `World`
 * (la même que l'UI) et vérifie qu'une partie reste jouable jusqu'au bout.
 * Usage : bun run scripts/playtest.ts
 */
import { BUILDING_INDEX, type BuildingType } from "../src/sim/buildings";
import { NEUTRAL } from "../src/sim/territory";
import { createRng } from "../src/sim/rng";
import { playOut } from "../src/sim/bot";
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

/** Quartier possédé adjacent à `target` (pour lancer un assaut). */
function ownAdjacentTo(world: World, factionId: number, target: number): number {
	for (const n of world.neighbors(target)) {
		if (world.territory.owner[n] === factionId) return n;
	}
	// Sinon on prend un quartier neutre voisin et on le donne à la faction.
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
	p.cashPropre = clean;
	p.cashSale = sale;
	p.members = members;
}

// ---------- 1. Conquête ----------
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
	check("assaut + capture", ok && captured, `quartiers ${before}→${world.modulesOwned(world.player.id)}`);
}

// ---------- 2. Construction (labo / vente / façade) ----------
{
	const world = new World(1);
	boost(world);
	const built: string[] = [];
	for (const type of ["labo", "vente", "facade"] as const) {
		const module = ownConversion(world, world.player.id, type);
		if (module < 0) continue;
		if (world.playerBuild(module, type)) {
			for (let i = 0; i < 400 && world.constructionLeft(module) > 0; i += 1) world.step();
			if (world.buildingAt(module) === type) built.push(type);
		}
	}
	check("construire labo/vente/façade", built.length === 3, built.join(", "));
}

// ---------- 3. Chantiers (sans file) ----------
{
	const world = new World(1);
	boost(world);
	const a = ownConversion(world, world.player.id, "labo");
	const b = ownConversion(world, world.player.id, "vente");
	const builtA = a >= 0 && world.playerBuild(a, "labo");
	const builtB = b >= 0 && world.playerBuild(b, "vente");
	const active = world.activeConstructions(world.player.id);
	const batch = world.playerBatchPreview();
	check("chantiers directs + lot", builtA && builtB && active === 2, `${active} chantiers, lot ${batch.count}`);
}

// ---------- 4. Tech ----------
{
	const world = new World(1);
	boost(world);
	const module = ownConversion(world, world.player.id, "atelier");
	world.territory.building[module] = BUILDING_INDEX.atelier;
	world.step();
	const ok = world.playerUpgradeTech("armement");
	check("recherche tech", ok && world.player.tech.armement === 1, `armement ${world.player.tech.armement}`);
}

// ---------- 5. Opérations ----------
{
	const world = new World(1);
	boost(world);
	world.player.tech.armement = 3;
	const target = firstNeutral(world);
	world.territory.owner[target] = 1;
	world.territory.control[target] = 60;
	world.territory.building[target] = BUILDING_INDEX.vente;
	world.factions[1]!.cashSale = 5000;
	ownAdjacentTo(world, world.player.id, target);
	// Descente et sabotage exigent un bâtiment : on les joue AVANT le raid (qui le détruit).
	const descent = world.playerCanDescent(target) && world.playerDescent(target);
	const sabotage = world.playerCanSabotage(target) && world.playerSabotage(target);
	const raid = world.playerCanRaid(target) && world.playerRaid(target);
	check("descente / sabotage / raid", descent && sabotage && raid, `descente=${descent} sabotage=${sabotage} raid=${raid}`);
}

// ---------- 6. Tueur à gage ----------
{
	const world = new World(1);
	boost(world);
	world.player.tech.armement = 2;
	const target = firstNeutral(world);
	world.territory.owner[target] = 1;
	world.territory.control[target] = 90;
	ownAdjacentTo(world, world.player.id, target);
	const ok = world.playerCanHitman(target) && world.playerHitman(target);
	check("tueur à gage", ok, `contrôle cible ${Math.round(world.controlAt(target))}`);
}

// ---------- 7. Corruption police ----------
{
	const world = new World(1);
	boost(world);
	world.police.pressure = 50;
	const cost = world.playerCorruptionCost();
	const ok = world.playerCanCorrupt() && world.playerCorrupt();
	check("corrompre la police", ok && world.police.pressure < 50, `coût ${cost}`);
}

// ---------- 8. Diplomatie ----------
{
	const world = new World(1);
	boost(world);
	const proposed = world.playerProposePact(1);
	// Une offre sortante met le cooldown : impossible de reproposer aussitôt.
	const cooldown = world.playerCanProposePact(1) === false;
	const embargo = world.playerCanEmbargo(2) && world.playerEmbargo(2);
	const refuses = world.playerBreakPact(1) === false; // pas encore de pacte
	check("pacte / embargo", proposed && cooldown && embargo && refuses, `proposé=${proposed} embargo=${embargo}`);
}

// ---------- 9. Événement à choix ----------
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
	const before = world.player.cashSale;
	const chosen = pending ? world.playerChoose(0) : false;
	check("événement à choix", !!pending && chosen && world.player.cashSale > before, `+${world.player.cashSale - before} sale`);
}

// ---------- 9b. Trésorerie de guerre (armement payant) ----------
{
	const world = new World(1);
	boost(world);
	const before = world.attackBonus(world.player.id);
	const ok = world.playerCanBuyArmement() && world.playerBuyArmement();
	check("acheter de l'armement", ok && world.attackBonus(world.player.id) > before, `bonus ${before.toFixed(2)} → ${world.attackBonus(world.player.id).toFixed(2)}`);
}

// ---------- 9c. Mercenaires ----------
{
	const world = new World(1);
	boost(world);
	world.player.members = 0;
	const ok = world.playerCanHireMercenaries() && world.playerHireMercenaries();
	check("mercenaires (sale → Membres)", ok && world.player.members > 0, `+${Math.round(world.player.members)} membres`);
}

// ---------- 9d. Rachat de quartier ----------
{
	const world = new World(1);
	boost(world);
	const target = firstNeutral(world);
	world.territory.owner[target] = NEUTRAL;
	const adjacent = world.neighbors(target).some((n) => world.territory.owner[n] === world.player.id);
	// On force l'adjacence en donnant un voisin au joueur si besoin.
	if (!adjacent) {
		const n = world.neighbors(target)[0];
		if (n !== undefined) {
			world.territory.owner[n] = world.player.id;
			world.territory.control[n] = 100;
		}
	}
	const ok = world.playerCanBuy(target) && world.playerBuy(target);
	check("racheter un quartier (propre → territoire)", ok && world.ownerAt(target) === world.player.id);
}

// ---------- 9e. Contrat contre un gang ----------
{
	const world = new World(1);
	boost(world);
	const ok = world.playerCanFundContract(1) && world.playerFundContract(1, 2);
	check("contrat (payer un gang)", ok && world.factions[1]!.contractTarget === 2);
}

// ---------- 10. Partie complète (bot) ----------
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
	check("parties complètes (8 seeds)", finished === 8 && violations === 0, `${finished}/8 finies, ${violations} violation(s)`);
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
