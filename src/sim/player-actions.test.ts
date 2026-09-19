/**
 * Actions joueur — surface complète de `World` appelée par l'UI (src/App.tsx).
 * Chaque test vise un cas nominal ou un refus. Voir docs/economy.md,
 * docs/combat.md, docs/factions.md, docs/police-ai.md, docs/win-conditions.md.
 */

import { describe, expect, it } from "vitest";
import {
	BUILDING_EFFECTS,
	BUILDING_INDEX,
	BUILDINGS,
	BUILD_TICKS,
	CONVERSION_COST,
	type BuildingType,
} from "./buildings";
import { MODULES_W } from "./constants";
import { DIPLOMACY, EMBARGO } from "./diplomacy";
import { CONTACT_NAMES, POLICE } from "./police";
import { HITMAN, TECH, techCost } from "./tech";
import { NEUTRAL } from "./territory";
import { World } from "./world";

/** Spawn du joueur (coin haut-gauche, module (1,1)). */
const SPAWN = 1 * MODULES_W + 1;
/** Voisin immédiat à droite du spawn. */
const ADJACENT = SPAWN + 1;

/** Premier module neutre de la carte. */
function firstNeutral(world: World): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) return i;
	}
	return -1;
}

/** Donne à `factionId` un quartier neutre **convertible** vide acceptant `type`. */
function ownConversion(world: World, factionId: number, type: BuildingType, skip = 0): number {
	let seen = 0;
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] !== NEUTRAL) continue;
		if (world.buildingAt(i) !== null || world.constructionLeft(i) > 0) continue;
		if (!world.isConversion(i) || !world.allowedBuildings(i).includes(type)) continue;
		if (seen < skip) {
			seen += 1;
			continue;
		}
		world.territory.owner[i] = factionId;
		world.territory.control[i] = 100;
		return i;
	}
	return -1;
}

/** Donne à `factionId` un quartier neutre **terrain vague** vide acceptant `type`. */
function ownVacant(world: World, factionId: number, type: BuildingType): number {
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] !== NEUTRAL) continue;
		if (world.buildingAt(i) !== null || world.constructionLeft(i) > 0) continue;
		if (world.city.modules[i] !== "vacant") continue;
		if (!world.allowedBuildings(i).includes(type)) continue;
		world.territory.owner[i] = factionId;
		world.territory.control[i] = 100;
		return i;
	}
	return -1;
}

/** Donne `count` quartiers neutres à `factionId`. */
function giveNeutral(world: World, factionId: number, count: number): void {
	let given = 0;
	for (let i = 0; i < world.territory.count && given < count; i += 1) {
		if (world.territory.owner[i] === NEUTRAL) {
			world.territory.owner[i] = factionId;
			world.territory.control[i] = 100;
			given += 1;
		}
	}
}

/** Empêche les IA d'attaquer (évite que leurs actions interfèrent avec un chantier). */
/** Avance jusqu'à la fin des chantiers donnés. */
function finishBuild(world: World, ...modules: number[]): void {
	for (let i = 0; i < 3000; i += 1) {
		if (modules.every((module) => world.constructionLeft(module) === 0)) return;
		world.step();
	}
}

function disarmAi(world: World): void {
	for (let f = 1; f < world.factions.length; f += 1) world.factions[f]!.members = 0;
}

/** Force une victoire (contrôle ≥ 60 % + Cash propre ≥ objectif). */
function forceVictory(world: World): void {
	giveNeutral(world, world.player.id, Math.ceil(world.territory.count * 0.63));
	world.step();
	world.player.cashPropre = world.cleanGoal();
	world.step();
}

/** Baisse de Contrôle au centre d'un tueur, selon le nombre de Contre-espionnage de la cible. */
function hitmanCenterDrop(contre: number): number {
	const world = new World(1, "nightlife");
	const player = world.player;
	player.cashPropre = 100000;
	player.members = 100000;
	player.cashSale = 100000;
	player.tech.armement = 2;
	const enemy = firstNeutral(world);
	world.territory.owner[enemy] = 1;
	world.territory.control[enemy] = 100;
	let placed = 0;
	for (let i = 0; i < world.territory.count && placed < contre; i += 1) {
		if (i === enemy || world.territory.owner[i] !== NEUTRAL) continue;
		world.territory.owner[i] = 1;
		world.territory.building[i] = BUILDING_INDEX.contre;
		placed += 1;
	}
	// Recount forcé : les édits directs ne rafraîchissent pas `buildingCount`.
	world.playerBuild(SPAWN, "logement");
	expect(world.playerHitman(enemy)).toBe(true);
	return 100 - world.controlAt(enemy);
}

describe("construction — refus", () => {
	it("refuse un quartier non possédé", () => {
		const world = new World(1, "nightlife");
		const neutral = firstNeutral(world);
		expect(world.playerCanBuild(neutral, "logement")).toBe(false);
		expect(world.playerBuild(neutral, "logement")).toBe(false);
	});

	it("refuse un quartier déjà bâti", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 100000;
		const module = ownConversion(world, world.player.id, "logement");
		expect(world.playerBuild(module, "logement")).toBe(true);
		expect(world.playerCanBuild(module, "planque")).toBe(false);
		expect(world.playerBuild(module, "planque")).toBe(false);
	});

	it("refuse un quartier avec un chantier en cours", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 100000;
		const module = ownVacant(world, world.player.id, "labo");
		expect(world.playerBuild(module, "labo")).toBe(true);
		expect(world.constructionLeft(module)).toBe(BUILD_TICKS.labo);
		expect(world.playerCanBuild(module, "logement")).toBe(false);
		expect(world.playerBuild(module, "logement")).toBe(false);
	});

	it("refuse une zone incompatible", () => {
		const world = new World(1, "nightlife");
		let module = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (!world.allowedBuildings(i).includes("atelier")) {
				module = i;
				break;
			}
		}
		expect(module).toBeGreaterThanOrEqual(0);
		world.territory.owner[module] = world.player.id;
		world.territory.control[module] = 100;
		world.player.cashSale = 100000;
		world.player.cashPropre = 100000;
		expect(world.playerCanBuild(module, "atelier")).toBe(false);
		expect(world.playerBuild(module, "atelier")).toBe(false);
	});

	it("refuse des ressources insuffisantes", () => {
		const world = new World(1, "nightlife");
		world.player.members = 100000;
		world.player.cashSale = 0;
		const module = ownConversion(world, world.player.id, "labo");
		expect(world.playerCanBuild(module, "labo")).toBe(false);
		expect(world.playerBuild(module, "labo")).toBe(false);
	});

	it("playerCanAfford est optimiste (coût de conversion)", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = BUILDINGS.labo.costSale! * CONVERSION_COST;
		expect(world.playerCanAfford("labo")).toBe(true);
		// Mais un terrain vague (coût plein) reste inabordable.
		const vacant = ownVacant(world, world.player.id, "labo");
		expect(world.playerCanBuild(vacant, "labo")).toBe(false);
	});
});

describe("construction — conversion vs chantier", () => {
	it("la conversion coûte −50 % et prend la moitié du temps", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 10000;
		const module = ownConversion(world, world.player.id, "facade");
		expect(module).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(module, "facade")).toBe(true);
		expect(world.player.cashSale).toBe(10000 - BUILDINGS.facade.costSale! * CONVERSION_COST);
		expect(world.buildingAt(module)).toBeNull();
		expect(world.constructionLeft(module)).toBe(Math.round(BUILD_TICKS.facade * 0.5));
		expect(world.pendingBuilding(module)).toBe("facade");
		finishBuild(world, module);
		expect(world.buildingAt(module)).toBe("facade");
	});

	it("la construction neuve sur terrain vague suit BUILD_TICKS", () => {
		const world = new World(1, "nightlife");
		disarmAi(world);
		world.player.cashSale = 10000;
		const module = ownVacant(world, world.player.id, "labo");
		expect(module).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(module, "labo")).toBe(true);
		expect(world.player.cashSale).toBe(10000 - BUILDINGS.labo.costSale!);
		expect(world.buildingAt(module)).toBeNull();
		expect(world.pendingBuilding(module)).toBe("labo");
		expect(world.constructionLeft(module)).toBe(BUILD_TICKS.labo);
		expect(world.buildingCount(world.player.id, "labo")).toBe(0);

		let ticks = 0;
		while (world.buildingAt(module) === null && ticks < BUILD_TICKS.labo + 5) {
			world.step();
			ticks += 1;
		}
		expect(ticks).toBe(BUILD_TICKS.labo);
		expect(world.buildingAt(module)).toBe("labo");
		expect(world.buildingCount(world.player.id, "labo")).toBe(1);
	});

	it("un chantier ne produit rien tant qu'il n'est pas livré", () => {
		const world = new World(1, "nightlife");
		disarmAi(world);
		const player = world.player;
		player.cashSale = 10000;
		player.produit = 0;
		const module = ownVacant(world, player.id, "labo");
		expect(world.playerBuild(module, "labo")).toBe(true);
		for (let i = 0; i < 10; i += 1) world.step();
		expect(player.produit).toBe(0);
		expect(world.buildingCount(player.id, "labo")).toBe(0);
	});
});

describe("construction — annulation du chantier", () => {
	it("une capture annule le chantier", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 10000;
		const module = ownVacant(world, world.player.id, "labo");
		expect(world.playerBuild(module, "labo")).toBe(true);
		world.territory.control[module] = 1;
		world.attacks.push({ factionId: 1, source: -1, target: module, troops: 100000, arrivesAt: 0 });
		world.step();
		expect(world.ownerAt(module)).toBe(1);
		expect(world.constructionLeft(module)).toBe(0);
		expect(world.pendingBuilding(module)).toBeNull();
	});

	it("un raid policier annule le chantier", () => {
		const world = new World(1, "nightlife");
		giveNeutral(world, world.player.id, 40);
		const module = SPAWN;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === world.player.id) world.territory.control[i] = 50;
		}
		world.territory.control[module] = 100;
		world.territory.pending[module] = BUILDING_INDEX.labo;
		world.territory.construction[module] = BUILD_TICKS.labo;
		world.police.pressure = POLICE.raidThreshold + 5;
		world.police.cooldown = 0;
		world.step();
		expect(world.police.lastRaidTick).toBe(world.tick);
		expect(world.constructionLeft(module)).toBe(0);
		expect(world.pendingBuilding(module)).toBeNull();
	});

	it("un tueur à gage annule le chantier visé", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		player.members = 100000;
		player.tech.armement = 2;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;
		world.territory.pending[enemy] = BUILDING_INDEX.labo;
		world.territory.construction[enemy] = BUILD_TICKS.labo;
		expect(world.playerCanHitman(enemy)).toBe(true);
		expect(world.playerHitman(enemy)).toBe(true);
		expect(world.constructionLeft(enemy)).toBe(0);
		expect(world.pendingBuilding(enemy)).toBeNull();
	});
});

describe("attaque", () => {
	it("refuse un quartier non adjacent", () => {
		const world = new World(1, "nightlife");
		const far = world.city.modules.length - 1;
		expect(world.playerCanAttack(far)).toBe(false);
		expect(world.playerAttack(far)).toBe(false);
	});

	it("refuse son propre quartier", () => {
		const world = new World(1, "nightlife");
		expect(world.playerCanAttack(SPAWN)).toBe(false);
		expect(world.playerAttack(SPAWN)).toBe(false);
	});

	it("refuse tant que l'engagement minimum n'est pas atteint", () => {
		const world = new World(1, "nightlife");
		const needed = world.minCommit() / world.commitRatio();
		world.player.members = needed - 1;
		expect(world.playerCanAttack(ADJACENT)).toBe(false);
		expect(world.playerAttack(ADJACENT)).toBe(false);
		world.player.members = needed;
		expect(world.playerCanAttack(ADJACENT)).toBe(true);
	});

	it("capture un quartier adjacent après résolution", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		expect(world.playerAttack(ADJACENT)).toBe(true);
		for (let i = 0; i < 400 && world.ownerAt(ADJACENT) !== player.id; i += 1) {
			world.step();
		}
		expect(world.ownerAt(ADJACENT)).toBe(player.id);
		expect(world.buildingAt(ADJACENT)).toBeNull();
	});
});

describe("tueur à gage", () => {
	it("exige Armement ≥ 2", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		player.members = 100000;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;
		player.tech.armement = HITMAN.requiredArmement - 1;
		expect(world.playerCanHitman(enemy)).toBe(false);
		expect(world.playerHitman(enemy)).toBe(false);
		player.tech.armement = HITMAN.requiredArmement;
		expect(world.playerCanHitman(enemy)).toBe(true);
	});

	it("refuse sa propre cible et les quartiers neutres", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		player.members = 100000;
		player.tech.armement = HITMAN.requiredArmement;
		expect(world.playerCanHitman(SPAWN)).toBe(false);
		expect(world.playerCanHitman(firstNeutral(world))).toBe(false);
	});

	it("respecte le coût et le cooldown", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		player.members = 100000;
		player.tech.armement = HITMAN.requiredArmement;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;

		const cashBefore = player.cashPropre;
		const membersBefore = player.members;
		expect(world.playerHitman(enemy)).toBe(true);
		expect(player.cashPropre).toBe(cashBefore - HITMAN.costClean);
		expect(player.members).toBe(membersBefore - HITMAN.costMembers);
		expect(player.hitmanCooldown).toBe(HITMAN.cooldownTicks);
		expect(world.playerCanHitman(enemy)).toBe(false);
		player.hitmanCooldown = 0;
		expect(world.playerCanHitman(enemy)).toBe(true);
	});

	it("refuse sans Cash propre ni Membres suffisants", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.members = 100000;
		player.tech.armement = HITMAN.requiredArmement;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 100;
		player.cashPropre = HITMAN.costClean - 1;
		expect(world.playerCanHitman(enemy)).toBe(false);
		player.cashPropre = 100000;
		player.members = HITMAN.costMembers - 1;
		expect(world.playerCanHitman(enemy)).toBe(false);
	});

	it("réduit les dégâts par Contre-espionnage (plafond)", () => {
		expect(hitmanCenterDrop(0)).toBe(HITMAN.damageCenter);
		expect(hitmanCenterDrop(4)).toBeCloseTo(
			HITMAN.damageCenter * (1 - HITMAN.contreReductionMax),
		);
	});

	it("ne capture pas (plancher de Contrôle à 5)", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		player.members = 100000;
		player.tech.armement = HITMAN.requiredArmement;
		const enemy = firstNeutral(world);
		world.territory.owner[enemy] = 1;
		world.territory.control[enemy] = 10;
		expect(world.playerHitman(enemy)).toBe(true);
		expect(world.controlAt(enemy)).toBe(5);
		expect(world.ownerAt(enemy)).toBe(1);
	});
});

describe("tech", () => {
	it("un Atelier = un palier max, coût croissant", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		expect(world.maxTechLevel(player.id)).toBe(0);
		expect(world.canUpgradeTech(player.id, "armement")).toBe(false);
		expect(world.playerUpgradeTech("armement")).toBe(false);

		const first = ownConversion(world, player.id, "atelier");
		expect(first).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(first, "atelier")).toBe(true);
		finishBuild(world, first);
		expect(world.maxTechLevel(player.id)).toBe(1);

		const before = player.cashPropre;
		expect(world.playerUpgradeTech("armement")).toBe(true);
		expect(player.tech.armement).toBe(1);
		expect(player.cashPropre).toBe(before - techCost(1));
		expect(world.canUpgradeTech(player.id, "armement")).toBe(false);
		expect(world.playerUpgradeTech("armement")).toBe(false);

		const second = ownConversion(world, player.id, "atelier");
		expect(second).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(second, "atelier")).toBe(true);
		finishBuild(world, second);
		expect(world.maxTechLevel(player.id)).toBe(2);
		const beforeSecond = player.cashPropre;
		expect(world.playerUpgradeTech("armement")).toBe(true);
		expect(player.cashPropre).toBe(beforeSecond - techCost(2));
	});

	it("refuse un palier sans Cash propre", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = BUILDINGS.atelier.costClean! * CONVERSION_COST;
		const module = ownConversion(world, player.id, "atelier");
		expect(world.playerBuild(module, "atelier")).toBe(true);
		finishBuild(world, module);
		player.cashPropre = 0;
		expect(world.maxTechLevel(player.id)).toBe(1);
		expect(world.canUpgradeTech(player.id, "armement")).toBe(false);
		expect(world.playerUpgradeTech("armement")).toBe(false);
	});

	it("plafonne le niveau à TECH.maxLevel", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		let placed = 0;
		for (let i = 0; i < world.territory.count && placed < 6; i += 1) {
			if (world.territory.owner[i] !== NEUTRAL) continue;
			world.territory.owner[i] = player.id;
			world.territory.control[i] = 100;
			world.territory.building[i] = BUILDING_INDEX.atelier;
			placed += 1;
		}
		expect(placed).toBe(6);
		world.step();
		expect(world.maxTechLevel(player.id)).toBe(TECH.maxLevel);
	});
});

describe("corruption", () => {
	it("fait baisser la Pression (cas nominal)", () => {
		const world = new World(1, "nightlife");
		world.player.cashPropre = 1000000;
		world.police.pressure = 60;
		expect(world.playerCanCorrupt()).toBe(true);
		expect(world.playerCorrupt()).toBe(true);
		expect(world.police.pressure).toBe(60 - POLICE.corruptionReduction);
		expect(world.police.window).toBe(POLICE.corruptionWindow);
	});

	it("fait monter la Pression si le contact est grillé", () => {
		const world = new World(38, "nightlife");
		const before = world.contactName;
		world.player.cashPropre = 1000000;
		world.police.pressure = 60;
		expect(world.playerCorrupt()).toBe(true);
		expect(world.police.pressure).toBe(60 + POLICE.corruptionBurnBacklash);
		expect(world.contactName).not.toBe(before);
		expect(CONTACT_NAMES).toContain(world.contactName);
	});

	it("refuse si le Cash propre est insuffisant", () => {
		const world = new World(1, "nightlife");
		world.player.cashPropre = 0;
		expect(world.playerCanCorrupt()).toBe(false);
		expect(world.playerCorrupt()).toBe(false);
		expect(world.player.corruptionUses).toBe(0);
	});

	it("coût croissant puis plafonné", () => {
		const world = new World(1, "nightlife");
		world.player.cashPropre = 1_000_000_000;
		let previous = 0;
		for (let use = 0; use < 12; use += 1) {
			const cost = world.playerCorruptionCost();
			expect(cost).toBeGreaterThanOrEqual(previous);
			expect(world.playerCorrupt()).toBe(true);
			previous = cost;
		}
		expect(world.playerCorruptionCost()).toBe(POLICE.corruptionMaxCost);
	});
});

describe("diplomatie — pactes", () => {
	it("propose une offre, puis bloque par cooldown", () => {
		const world = new World(1, "nightlife");
		expect(world.playerProposePact(world.player.id)).toBe(false);
		expect(world.playerProposePact(1)).toBe(true);
		expect(world.offers.length).toBe(1);
		expect(world.playerCanProposePact(1)).toBe(false);
		world.offers.length = 0;
		expect(world.playerCanProposePact(1)).toBe(false);
		world.tick = DIPLOMACY.proposeCooldown;
		expect(world.playerCanProposePact(1)).toBe(true);
	});

	it("accepte une offre reçue (pacte + relation)", () => {
		const world = new World(1, "nightlife");
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		expect(world.playerOffers().length).toBe(1);
		expect(world.playerOffers()[0]!.from).toBe(1);
		const before = world.relationBetween(0, 1);
		expect(world.playerRespondToOffer(1, true)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(true);
		expect(world.offers.length).toBe(0);
		expect(world.relationBetween(0, 1)).toBe(Math.min(100, before + 15));
	});

	it("refuse une offre reçue", () => {
		const world = new World(1, "nightlife");
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		expect(world.playerRespondToOffer(1, false)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.offers.length).toBe(0);
		expect(world.log.some((line) => line.includes("refusé"))).toBe(true);
	});

	it("refuse de répondre à une offre inexistante", () => {
		const world = new World(1, "nightlife");
		expect(world.playerRespondToOffer(2, true)).toBe(false);
	});

	it("le pacte expire à son échéance", () => {
		const world = new World(1, "nightlife");
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		world.playerRespondToOffer(1, true);
		const pact = world.pacts[0]!;
		world.tick = pact.until;
		world.step();
		expect(world.hasPact(0, 1)).toBe(false);
	});

	it("trahir rompt le pacte, fait chuter la relation et marque le traître", () => {
		const world = new World(1, "nightlife");
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		world.playerRespondToOffer(1, true);
		const before = world.relationBetween(0, 1);
		expect(world.playerBreakPact(1)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(
			Math.max(0, before - DIPLOMACY.betrayalRelationHit),
		);
		expect(world.isTraitor(0)).toBe(true);
		expect(world.playerBreakPact(1)).toBe(false);
	});
});

describe("embargo", () => {
	it("déclare, bloque les pactes et expire", () => {
		const world = new World(1, "nightlife");
		expect(world.playerEmbargo(world.player.id)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(true);
		expect(world.playerHasEmbargo(1)).toBe(true);
		expect(world.isEmbargoed(1)).toBe(true);
		expect(world.playerCanProposePact(1)).toBe(false);
		expect(world.playerCanEmbargo(1)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(false);
		expect(world.relationBetween(0, 1)).toBe(
			DIPLOMACY.initialRelation - EMBARGO.relationHit,
		);

		world.tick = EMBARGO.duration;
		world.step();
		expect(world.playerHasEmbargo(1)).toBe(false);
		expect(world.isEmbargoed(1)).toBe(false);
	});

	it("réduit le revenu sale de la cible", () => {
		const sale = (embargo: boolean): number => {
			const world = new World(1, "nightlife");
			const module = firstNeutral(world);
			world.territory.owner[module] = 1;
			world.territory.control[module] = 100;
			world.territory.building[module] = BUILDING_INDEX.vente;
			const faction = world.factions[1]!;
			faction.produit = 1000;
			faction.cashSale = 0;
			if (embargo) world.playerEmbargo(1);
			world.step();
			return faction.cashSale;
		};
		const normal = sale(false);
		expect(normal).toBeGreaterThan(0);
		expect(sale(true)).toBeCloseTo(normal * (1 - EMBARGO.salePenalty));
	});

	it("rompt un pacte existant en le traitant comme une trahison", () => {
		const world = new World(1, "nightlife");
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + DIPLOMACY.offerWait });
		world.playerRespondToOffer(1, true);
		const before = world.relationBetween(0, 1);
		expect(world.playerEmbargo(1)).toBe(true);
		expect(world.hasPact(0, 1)).toBe(false);
		expect(world.playerHasEmbargo(1)).toBe(true);
		expect(world.relationBetween(0, 1)).toBe(
			Math.max(0, before - DIPLOMACY.betrayalRelationHit),
		);
		expect(world.isTraitor(0)).toBe(true);
	});
});

describe("fin de partie", () => {
	it("refuse toutes les actions après une victoire", () => {
		const world = new World(1, "nightlife");
		forceVictory(world);
		expect(world.outcome).toBe("victory");
		world.player.members = 100000;
		world.player.cashSale = 100000;
		world.player.cashPropre = 100000;
		world.player.tech.armement = HITMAN.requiredArmement;
		world.territory.owner[0] = 1;
		world.territory.control[0] = 100;

		expect(world.playerCanBuild(SPAWN, "logement")).toBe(false);
		expect(world.playerBuild(SPAWN, "logement")).toBe(false);
		expect(world.playerCanAttack(ADJACENT)).toBe(false);
		expect(world.playerAttack(ADJACENT)).toBe(false);
		expect(world.playerCanHitman(0)).toBe(false);
		expect(world.playerHitman(0)).toBe(false);
		expect(world.playerUpgradeTech("armement")).toBe(false);
		expect(world.playerCanCorrupt()).toBe(false);
		expect(world.playerCorrupt()).toBe(false);
		expect(world.playerCanProposePact(1)).toBe(false);
		expect(world.playerProposePact(1)).toBe(false);
		expect(world.playerCanEmbargo(1)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(false);
	});

	it("refuse toutes les actions après une défaite", () => {
		const world = new World(1, "nightlife");
		world.police.pressure = POLICE.liquidation + 1;
		world.step();
		expect(world.outcome).toBe("defeat");
		world.player.members = 100000;
		world.player.cashSale = 100000;
		world.player.cashPropre = 100000;
		world.player.tech.armement = HITMAN.requiredArmement;
		world.territory.owner[0] = 1;
		world.territory.control[0] = 100;

		expect(world.playerBuild(SPAWN, "logement")).toBe(false);
		expect(world.playerAttack(ADJACENT)).toBe(false);
		expect(world.playerHitman(0)).toBe(false);
		expect(world.playerUpgradeTech("armement")).toBe(false);
		expect(world.playerCorrupt()).toBe(false);
		expect(world.playerProposePact(1)).toBe(false);
		expect(world.playerEmbargo(1)).toBe(false);
	});

	it("garde seuils, échéance et récap cohérents", () => {
		const world = new World(1, "nightlife", { timeLimitTicks: 1000 });
		expect(world.victoryControlThreshold()).toBe(0.42);
		expect(world.cleanGoal()).toBe(500000);
		expect(world.ticksLeft()).toBe(1000);
		world.tick = 1100;
		expect(world.ticksLeft()).toBe(-100);

		world.player.cashPropre = 10000;
		const line = world.summary();
		expect(line.quarters).toBe(world.modulesOwned(world.player.id));
		expect(line.control).toBeCloseTo(world.controlRatio(world.player.id));
		expect(line.cashPropre).toBe(10000);
		expect(line.rank).toBeGreaterThanOrEqual(1);
		expect(world.score(world.player.id)).toBeGreaterThan(0);
		expect(world.contactName).toBeTruthy();
	});
});

describe("zones", () => {
	it("chaque quartier accepte au moins un bâtiment (spawn compris)", () => {
		for (const seed of [0, 1, 2, 3, 7]) {
			const world = new World(seed, "nightlife");
			for (let i = 0; i < world.territory.count; i += 1) {
				expect(world.allowedBuildings(i)).toContain("planque");
			}
			let spawn = -1;
			for (let i = 0; i < world.territory.count; i += 1) {
				if (world.territory.owner[i] === world.player.id) {
					spawn = i;
					break;
				}
			}
			expect(spawn).toBeGreaterThanOrEqual(0);
			expect(world.allowedBuildings(spawn).length).toBeGreaterThan(0);
			expect(world.isConversion(spawn)).toBe(true);
		}
	});

	it("conversion (zone bâtie) vs terrain vague : coût et zone", () => {
		const world = new World(1, "nightlife");
		let built = -1;
		let vacant = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.isConversion(i) && built < 0) built = i;
			if (world.city.modules[i] === "vacant" && vacant < 0) vacant = i;
		}
		expect(built).toBeGreaterThanOrEqual(0);
		expect(vacant).toBeGreaterThanOrEqual(0);
		expect(world.buildCostFactor(built)).toBe(CONVERSION_COST);
		expect(world.buildCostFactor(vacant)).toBe(1);
		expect(world.isConversion(vacant)).toBe(false);
		// Le contre-espionnage n'est pas constructible sur terrain vague.
		expect(world.allowedBuildings(vacant)).not.toContain("contre");
		expect(world.allowedBuildings(vacant)).toContain("atelier");
	});
});

describe("cohérence de l'état", () => {
	it("expose commitRatio, minCommit et defenseAt", () => {
		const world = new World(1, "nightlife");
		expect(world.commitRatio()).toBeGreaterThan(0);
		expect(world.minCommit()).toBeGreaterThan(0);

		const module = ownConversion(world, world.player.id, "planque");
		const base = world.defenseAt(module);
		world.player.cashSale = 100000;
		expect(world.playerBuild(module, "planque")).toBe(true);
		finishBuild(world, module);
		const withPlanque = world.defenseAt(module);
		expect(withPlanque).toBeCloseTo(base * BUILDING_EFFECTS.planqueDefense);

		world.player.tech.protection = 1;
		expect(world.defenseAt(module)).toBeCloseTo(
			withPlanque * (1 + TECH.defensePerLevel),
		);

		world.player.traitorUntil = world.tick + 10;
		expect(world.defenseAt(module)).toBeCloseTo(
			withPlanque * (1 + TECH.defensePerLevel) * DIPLOMACY.traitorDefense,
		);
	});

	it("buildingCount / buildingCounts reflètent les constructions", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 100000;
		const module = ownConversion(world, world.player.id, "labo");
		expect(world.playerBuild(module, "labo")).toBe(true);
		finishBuild(world, module);
		expect(world.buildingCount(world.player.id, "labo")).toBe(1);
		expect(world.buildingCounts(world.player.id).labo).toBe(1);
	});
});

describe("régressions (bugs corrigés)", () => {
	it("refuse d'accepter ou de rompre un pacte après la fin", () => {
		const world = new World(1, "nightlife");
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + 100 });
		world.playerRespondToOffer(1, true);
		expect(world.hasPact(0, 1)).toBe(true);

		forceVictory(world);
		expect(world.playerBreakPact(1)).toBe(false);
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + 100 });
		expect(world.playerRespondToOffer(1, true)).toBe(false);
	});

	it("un embargo empêche d'accepter une offre en attente", () => {
		const world = new World(1, "nightlife");
		world.offers.push({ from: 1, to: world.player.id, expires: world.tick + 100 });
		expect(world.playerEmbargo(1)).toBe(true);
		expect(world.playerOffers().length).toBe(0);
		expect(world.playerRespondToOffer(1, true)).toBe(false);
		expect(world.hasPact(0, 1)).toBe(false);
	});

	it("le contact change quand il est grillé", () => {
		const world = new World(18, "nightlife");
		world.player.cashPropre = 1_000_000;
		world.police.pressure = 60;
		const before = world.contactName;
		world.playerCorrupt();
		expect(world.contactName).not.toBe(before);
	});

	it("canUpgradeTech est faux après la fin", () => {
		const world = new World(1, "nightlife");
		world.player.cashPropre = 100_000;
		forceVictory(world);
		expect(world.canUpgradeTech(0, "armement")).toBe(false);
	});
});

describe("raid & assauts simultanés", () => {
	it("le raid affaiblit un quartier adjacent sans le capturer", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashSale = 100_000;
		player.members = 100_000;
		const target = ADJACENT;
		world.territory.owner[target] = 1;
		world.territory.control[target] = 100;
		world.territory.building[target] = BUILDING_INDEX.planque;

		expect(world.playerCanRaid(target)).toBe(true);
		const sale = player.cashSale;
		expect(world.playerRaid(target)).toBe(true);
		expect(world.ownerAt(target)).toBe(1);
		expect(world.controlAt(target)).toBe(65);
		expect(world.buildingAt(target)).toBeNull();
		expect(player.cashSale).toBe(sale - world.raidCost().sale);
		expect(world.playerCanRaid(target)).toBe(false);
	});

	it("limite les assauts simultanés", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.members = 100_000;
		// Possède une ligne et vise la ligne du dessous (indices relatifs à la largeur).
		const max = world.maxAssaults();
		const own0 = MODULES_W * 2;
		const target0 = MODULES_W * 3;
		for (let i = own0; i < own0 + max; i += 1) {
			world.territory.owner[i] = player.id;
			world.territory.control[i] = 100;
		}
		for (let i = target0; i < target0 + max + 1; i += 1) {
			world.territory.owner[i] = NEUTRAL;
			world.territory.control[i] = 100;
		}
		for (let i = 0; i < max; i += 1) {
			expect(world.playerAttack(target0 + i)).toBe(true);
		}
		expect(world.playerAttack(target0 + max)).toBe(false);
	});
});

describe("ratio d'assaut", () => {
	it("est borné et pilote l'engagement des troupes", () => {
		const world = new World(1, "nightlife");
		world.playerSetAttackRatio(2);
		expect(world.playerAttackRatio()).toBe(0.6);
		world.playerSetAttackRatio(0);
		expect(world.playerAttackRatio()).toBe(0.05);
		world.playerSetAttackRatio(0.3);
		expect(world.commitRatio()).toBe(0.3);
	});
});

describe("file de construction", () => {
	it("met en file quand les équipes sont occupées puis démarre à leur libération", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashSale = 100_000;
		player.cashPropre = 100_000;
		const a = ownConversion(world, player.id, "labo");
		const b = ownConversion(world, player.id, "labo");
		const c = ownConversion(world, player.id, "labo");

		expect(world.playerQueueBuild(a, "labo")).toBe(true);
		expect(world.playerQueueBuild(b, "labo")).toBe(true);
		expect(world.playerQueueBuild(c, "labo")).toBe(true);
		expect(world.activeConstructions(player.id)).toBe(world.buildCrews());
		expect(world.queueLength()).toBe(1);
		expect(world.constructionLeft(c)).toBe(0);

		finishBuild(world, a);
		expect(world.queueLength()).toBe(0);
		expect(world.constructionLeft(c)).toBeGreaterThan(0);
	});

	it("annule un ordre en file", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashSale = 100_000;
		player.cashPropre = 100_000;
		const a = ownConversion(world, player.id, "labo");
		const b = ownConversion(world, player.id, "labo");
		const c = ownConversion(world, player.id, "labo");
		world.playerQueueBuild(a, "labo");
		world.playerQueueBuild(b, "labo");
		world.playerQueueBuild(c, "labo");
		expect(world.queueLength()).toBe(1);
		expect(world.playerCancelOrder(c)).toBe(true);
		expect(world.queueLength()).toBe(0);
		expect(world.constructionLeft(c)).toBe(0);
	});
});
