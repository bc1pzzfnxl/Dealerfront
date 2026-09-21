/**
 * Bot — minimal, deterministic play policy, for balancing.
 * Randomness comes only from an injected Rng (never Math.random).
 */

import { chooseBuildType, missingEconomyStep } from "./buildings";
import { DIPLOMACY } from "./diplomacy";
import type { Rng } from "./rng";
import { TECH_BRANCHES, TECH } from "./tech";
import type { World } from "./world";

/** Bot decision cadence (in ticks). */
export const AUTOPLAY_EVERY = 20;

export function autoPlay(world: World, rng: Rng): void {
	const player = world.player;
	if (player.members < 300) return;

	// Build: fill the biggest deficit of the target composition.
	if (rng() < 0.5) {
		const counts = world.buildingCounts(player.id);
		const owned = world.modulesOwned(player.id);
		// Zone-agnostic bootstrap: the chain comes before the rest.
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
				{ workshop: TECH.maxLevel },
			);
			if (type !== null) {
				world.playerBuild(i, type);
				break;
			}
		}
	}

	// Attack an adjacent quarter — but keep a reserve: committed troops are
	// troops that are not defending (the pool is global).
	const targets: number[] = [];
	for (let i = 0; i < world.territory.count; i += 1) {
		if (world.playerCanAttack(i)) targets.push(i);
	}
	if (targets.length > 0 && world.committedShare(player.id) < 0.5) {
		world.playerAttack(targets[Math.floor(rng() * targets.length)]!);
	}

	// Defensive corruption if the police target the player (we keep ammo).
	if (
		world.police.target === player.id &&
		world.police.pressure >= 70 &&
		world.playerCanCorrupt()
	) {
		world.playerCorrupt();
	}

	// Level up a tech branch when a Workshop allows it.
	for (const branch of TECH_BRANCHES) {
		if (world.playerUpgradeTech(branch)) break;
	}

	// Diplomacy: respond to offers, otherwise propose a pact.
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

	// Occasional heavy strike.
	if (rng() < 0.15) {
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.playerCanStrike(i)) {
				world.playerStrike(i);
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
