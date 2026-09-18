import { describe, expect, it } from "vitest";
import { type BuildingType, NO_BUILDING } from "./buildings";
import { MODULES_W } from "./constants";
import { NEUTRAL } from "./territory";
import { World } from "./world";

/** Avance la simulation jusqu'à la fin des chantiers donnés. */
function finishBuild(world: World, ...modules: number[]): void {
	for (let i = 0; i < 3000; i += 1) {
		if (modules.every((module) => world.constructionLeft(module) === 0)) return;
		world.step();
	}
}

/** Donne à `factionId` un quartier vide **bâti** (conversion à moitié temps) acceptant `type`. */
function ownFor(world: World, factionId: number, type: BuildingType, skip = 0): number {
	let seen = 0;
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.territory.owner[i] === factionId) continue;
		if (world.territory.building[i] !== NO_BUILDING) continue;
		if (!world.isConversion(i) || !world.canBuildInZone(i, type)) continue;
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

describe("territory", () => {
	it("démarre avec des quartiers neutres et des factions placées", () => {
		const world = new World(1, "nightlife");
		// Chaque faction possède exactement 1 quartier au départ.
		for (const faction of world.factions) {
			expect(world.modulesOwned(faction.id)).toBe(1);
		}
		const neutralCount = Array.from(world.territory.owner).filter(
			(owner) => owner === NEUTRAL,
		).length;
		expect(neutralCount).toBe(world.city.modules.length - world.factions.length);
	});

	it("refuse d'attaquer un quartier non adjacent", () => {
		const world = new World(1, "nightlife");
		// Coin opposé (bas-droite), jamais adjacent au spawn du joueur (haut-gauche).
		const far = (world.city.modules.length - 1) as number;
		expect(world.canAttack(world.player.id, far)).toBe(false);
		expect(world.playerAttack(far)).toBe(false);
	});

	it("capture un quartier neutre adjacent et étend le territoire", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		// Module adjacent au spawn (1,1) : le voisin à droite.
		const spawn = 1 * MODULES_W + 1;
		const target = spawn + 1;
		expect(world.canAttack(player.id, target)).toBe(true);

		const before = world.modulesOwned(player.id);
		expect(world.playerAttack(target)).toBe(true);
		for (let i = 0; i < 400 && world.ownerAt(target) !== player.id; i += 1) {
			world.step();
		}
		expect(world.ownerAt(target)).toBe(player.id);
		expect(world.modulesOwned(player.id)).toBeGreaterThan(before);
	});

	it("est déterministe pour une même seed", () => {
		const a = new World(42, "nightlife");
		const b = new World(42, "nightlife");
		for (let i = 0; i < 300; i += 1) {
			a.step();
			b.step();
		}
		expect(Array.from(a.territory.owner)).toEqual(Array.from(b.territory.owner));
	});

	it("les IA s'étendent aussi", () => {
		const world = new World(7, "residential");
		for (let i = 0; i < 800; i += 1) world.step();
		const aiOwned = world.factions
			.slice(1)
			.reduce((sum, faction) => sum + world.modulesOwned(faction.id), 0);
		expect(aiOwned).toBeGreaterThan(world.factions.length - 1);
	});

	it("bâtit un logement possédé et augmente la production de membres", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		const module = 1 * MODULES_W + 1;
		expect(world.territory.owner[module]).toBe(player.id);

		const beforeProd = world.productionPerTick(player.id);
		const beforeMembers = player.members;
		expect(world.playerBuild(module, "logement")).toBe(true);
		finishBuild(world, module);
		expect(world.buildingAt(module)).toBe("logement");
		expect(player.housing).toBe(1);
		expect(player.members).toBeLessThan(beforeMembers);
		expect(world.productionPerTick(player.id)).toBeGreaterThan(beforeProd);

		// Un quartier déjà aménagé ne peut pas recevoir un second bâtiment.
		expect(world.playerBuild(module, "labo")).toBe(false);
	});

	it("ne peut pas bâtir sur un quartier non possédé", () => {
		const world = new World(1, "nightlife");
		const neutral = 5 * MODULES_W + 5;
		expect(world.territory.owner[neutral]).toBe(NEUTRAL);
		expect(world.playerCanBuild(neutral, "logement")).toBe(false);
	});

	it("un labo produit du Produit", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.members = 100000;
		player.cashSale = 100000;
		player.produit = 0;

		const laboModule = 1 * MODULES_W + 1;
		expect(world.playerBuild(laboModule, "labo")).toBe(true);
		finishBuild(world, laboModule);
		for (let i = 0; i < 20; i += 1) world.step();
		expect(player.produit).toBeGreaterThan(0);
	});

	it("la chaîne labo → vente → façade produit du cash propre", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.members = 100000;
		player.cashSale = 100000;

		// Trois quartiers possédés, zones compatibles (labo / vente / façade).
		const a = ownFor(world, player.id, "labo");
		const b = ownFor(world, player.id, "vente");
		const c = ownFor(world, player.id, "facade");

		expect(world.playerBuild(a, "labo")).toBe(true);
		expect(world.playerBuild(b, "vente")).toBe(true);
		expect(world.playerBuild(c, "facade")).toBe(true);

		const cleanBefore = player.cashPropre;
		for (let i = 0; i < 600; i += 1) world.step();
		expect(player.cashPropre).toBeGreaterThan(cleanBefore);
	});

	it("la tech nécessite des Ateliers et améliore l'attaque", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		const m = ownFor(world, player.id, "atelier");

		expect(world.playerBuild(m, "atelier")).toBe(true);
		finishBuild(world, m);
		expect(world.maxTechLevel(player.id)).toBe(1);
		expect(world.playerUpgradeTech("armement")).toBe(true);
		expect(player.tech.armement).toBe(1);
		expect(world.attackBonus(player.id)).toBeCloseTo(0.1);
		// Pas de 2e palier sans un 2e Atelier.
		expect(world.canUpgradeTech(player.id, "armement")).toBe(false);
	});

	it("le tueur à gage affaiblit un quartier ennemi (Armement ≥ 2)", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100000;
		player.members = 100000;

		const a = ownFor(world, player.id, "atelier");
		const b = ownFor(world, player.id, "atelier");
		world.playerBuild(a, "atelier");
		world.playerBuild(b, "atelier");
		finishBuild(world, a, b);
		world.playerUpgradeTech("armement");
		world.playerUpgradeTech("armement");
		expect(player.tech.armement).toBe(2);

		const enemy = ownFor(world, 1, "logement");
		world.territory.control[enemy] = 100;

		const before = world.controlAt(enemy);
		expect(world.playerCanHitman(enemy)).toBe(true);
		expect(world.playerHitman(enemy)).toBe(true);
		expect(world.controlAt(enemy)).toBeLessThan(before);
		expect(player.hitmanCooldown).toBeGreaterThan(0);
	});
});

describe("conversion par zone", () => {
	it("refuse une conversion incompatible et accepte les types autorisés", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.members = 100000;
		player.cashSale = 100000;
		player.cashPropre = 100000;

		// Un quartier restreint (parc, poste de police ou laverie).
		let module = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (!world.canBuildInZone(i, "logement")) {
				module = i;
				break;
			}
		}
		expect(module).toBeGreaterThanOrEqual(0);

		world.territory.owner[module] = player.id;
		world.territory.control[module] = 100;
		world.territory.building[module] = NO_BUILDING;

		expect(world.playerCanBuild(module, "logement")).toBe(false);
		expect(world.playerBuild(module, "logement")).toBe(false);

		const allowed = world.allowedBuildings(module);
		expect(allowed.length).toBeGreaterThan(0);
		expect(world.playerCanBuild(module, allowed[0]!)).toBe(true);
		expect(world.playerBuild(module, allowed[0]!)).toBe(true);
	});

	it("garantit un spawn constructible", () => {
		for (const seed of [0, 1, 2, 3, 4]) {
			const world = new World(seed, "residential");
			let spawn = -1;
			for (let i = 0; i < world.territory.count; i += 1) {
				if (world.territory.owner[i] === 0) {
					spawn = i;
					break;
				}
			}
			expect(world.allowedBuildings(spawn).length).toBeGreaterThan(0);
		}
	});
});

describe("construction neuve vs conversion", () => {
	/** Donne un quartier **terrain vague** vide au joueur. */
	function ownVacant(world: World, type: BuildingType): number {
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === world.player.id) continue;
			if (world.territory.building[i] !== NO_BUILDING) continue;
			if (world.city.modules[i] !== "vacant") continue;
			if (!world.canBuildInZone(i, type)) continue;
			world.territory.owner[i] = world.player.id;
			world.territory.control[i] = 100;
			return i;
		}
		return -1;
	}

	it("la conversion coûte −50 % et prend la moitié du temps", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 10000;
		const module = ownFor(world, world.player.id, "labo");
		const before = world.player.cashSale;
		expect(world.playerBuild(module, "labo")).toBe(true);
		expect(world.player.cashSale).toBe(before - 1000 * 0.5);
		expect(world.buildingAt(module)).toBeNull();
		expect(world.constructionLeft(module)).toBeGreaterThan(0);
		finishBuild(world, module);
		expect(world.buildingAt(module)).toBe("labo");
	});

	it("la construction neuve sur terrain vague est chronométrée", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 10000;
		const module = ownVacant(world, "labo");
		expect(module).toBeGreaterThanOrEqual(0);
		expect(world.playerBuild(module, "labo")).toBe(true);
		// Coût plein, pas encore de bâtiment, chantier en cours.
		expect(world.player.cashSale).toBe(10000 - 1000);
		expect(world.buildingAt(module)).toBeNull();
		expect(world.pendingBuilding(module)).toBe("labo");
		expect(world.constructionLeft(module)).toBeGreaterThan(0);
		// Interdit de relancer un chantier sur le même quartier.
		expect(world.playerCanBuild(module, "labo")).toBe(false);

		for (let i = 0; i < 200 && world.constructionLeft(module) > 0; i += 1) world.step();
		expect(world.buildingAt(module)).toBe("labo");
		expect(world.constructionLeft(module)).toBe(0);
	});
});

describe("blanchiment contrôlé", () => {
	it("le ratio limite la conversion cash sale → cash propre", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashSale = 10_000;
		const module = ownFor(world, player.id, "facade");
		expect(world.playerBuild(module, "facade")).toBe(true);
		finishBuild(world, module);
		world.territory.control[module] = 100;

		world.playerSetLaunderRatio(0);
		const saleBefore = player.cashSale;
		world.step();
		expect(player.cashSale).toBe(saleBefore);
		expect(player.cashPropre).toBe(0);

		world.playerSetLaunderRatio(1);
		world.step();
		expect(player.cashSale).toBeLessThan(saleBefore);
		expect(player.cashPropre).toBeGreaterThan(0);
	});

	it("le ratio est borné à 0–1", () => {
		const world = new World(1, "nightlife");
		world.playerSetLaunderRatio(2);
		expect(world.playerLaunderRatio()).toBe(1);
		world.playerSetLaunderRatio(-1);
		expect(world.playerLaunderRatio()).toBe(0);
	});
});

describe("renseignement", () => {
	it("on ne connaît que sa frontière au départ", () => {
		const world = new World(1, "nightlife");
		let spawn = -1;
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === world.player.id) {
				spawn = i;
				break;
			}
		}
		expect(world.isKnown(spawn)).toBe(true);
		const far = world.territory.count - 1;
		expect(world.isKnown(far)).toBe(false);
	});

	it("la reconnaissance révèle, coûte du Cash sale, pose un cooldown et expire", () => {
		const world = new World(1, "nightlife");
		world.player.cashSale = 10_000;
		const far = world.territory.count - 1;
		const before = world.player.cashSale;

		expect(world.playerCanRecon(far)).toBe(true);
		expect(world.playerRecon(far)).toBe(true);
		expect(world.isKnown(far)).toBe(true);
		expect(world.player.cashSale).toBe(before - world.playerReconCost());
		// Cooldown : impossible d'en relancer une juste après.
		const other = world.territory.count - 2;
		expect(world.playerCanRecon(other)).toBe(false);
		// Expiration.
		for (let i = 0; i < 700; i += 1) world.step();
		expect(world.isKnown(far)).toBe(false);
	});

	it("un Contre-espionnage révèle un rayon autour de lui", () => {
		const world = new World(1, "nightlife");
		const player = world.player;
		player.cashPropre = 100_000;
		const module = ownFor(world, player.id, "contre");
		const far = Math.min(world.territory.count - 1, module + MODULES_W * 2 + 2);
		expect(world.isKnown(far)).toBe(false);
		expect(world.playerBuild(module, "contre")).toBe(true);
		finishBuild(world, module);
		expect(world.isKnown(far)).toBe(true);
	});
});
