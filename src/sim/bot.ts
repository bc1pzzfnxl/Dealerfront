/**
 * Bot — politique de jeu minimale et déterministe, pour l'équilibrage.
 * Le hasard provient uniquement d'un Rng injecté (jamais Math.random).
 */

import { chooseBuildType, missingEconomyStep } from "./buildings";
import { DIPLOMACY } from "./diplomacy";
import type { Rng } from "./rng";
import { TECH_BRANCHES, TECH } from "./tech";
import type { World } from "./world";

/** Cadence de décision du bot (en ticks). */
export const AUTOPLAY_EVERY = 20;

export function autoPlay(world: World, rng: Rng): void {
	const player = world.player;
	if (player.members < 300) return;

	// Construire : on comble le plus grand déficit de la composition cible.
	if (rng() < 0.5) {
		const counts = world.buildingCounts(player.id);
		const owned = world.modulesOwned(player.id);
		// Amorçage zone-agnostique : la chaîne passe avant le reste.
		const bootstrap = missingEconomyStep(counts, (candidate) => world.playerCanAfford(candidate));
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] !== player.id) continue;
			if (world.buildingAt(i) !== null) continue;
			if (world.constructionLeft(i) > 0) continue;
			const type = chooseBuildType(
				counts,
				owned,
				(candidate) =>
					world.playerCanBuild(i, candidate) &&
					(bootstrap === null || candidate === bootstrap),
				{ atelier: TECH.maxLevel },
			);
			if (type !== null) {
				world.playerBuild(i, type);
				break;
			}
		}
	}

	// Attaquer un quartier adjacent.
	const targets: number[] = [];
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.playerCanAttack(i)) targets.push(i);
	}
	if (targets.length > 0) {
		world.playerAttack(targets[Math.floor(rng() * targets.length)]!);
	}

	// Corruption défensive si la police vise le joueur (on garde des munitions).
	if (
		world.police.target === player.id &&
		world.police.pressure >= 70 &&
		world.playerCanCorrupt()
	) {
		world.playerCorrupt();
	}

	// Monter une branche de tech quand un Atelier le permet.
	for (const branch of TECH_BRANCHES) {
		if (world.playerUpgradeTech(branch)) break;
	}

	// Diplomatie : répond aux offres, sinon propose un pacte.
	for (const offer of world.playerOffers()) {
		if (world.relationBetween(offer.from, player.id) >= DIPLOMACY.acceptRelation) {
			world.playerRespondToOffer(offer.from, true);
		}
	}
	for (const other of world.factions) {
		if (other.id === player.id) continue;
		if (world.playerCanProposePact(other.id)) {
			world.playerProposePact(other.id);
			break;
		}
	}

	// Tueur à gage occasionnel.
	if (rng() < 0.25) {
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.playerCanHitman(i)) {
				world.playerHitman(i);
				break;
			}
		}
	}
}

export function playOut(
	world: World,
	rng: Rng,
	maxTicks: number,
	cadence = AUTOPLAY_EVERY,
): number {
	let tick = 0;
	for (; tick < maxTicks && world.outcome === null; tick += 1) {
		if (tick % cadence === 0) autoPlay(world, rng);
		world.step();
	}
	return tick;
}
