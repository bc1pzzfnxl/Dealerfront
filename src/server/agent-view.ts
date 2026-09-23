/**
 * Compact agent state — a **decision-oriented** view of the world.
 *
 * The raw `WorldSnapshot` is ~30 KB, of which ~23 KB is seven 529-entry
 * territory arrays. Feeding that to an LLM on every poll is pure noise: it
 * costs tokens and parsing time for numbers the agent cannot use. This view
 * keeps only what an agent acts on, and stays a few KB.
 *
 * The spectator still receives the full snapshot (it has to draw the map).
 */

import { BUILDING_TYPES, type BuildingType } from "../sim/buildings";
import { SIM_HZ } from "../sim/constants";
import { NEUTRAL } from "../sim/territory";
import type { World } from "../sim/world";

/** Cap on the actionable lists, to keep the payload small. */
const MAX_TARGETS = 24; // ponytail: 40→24 saves ~30% at peak without hurting multi-front (6 factions, 20 is enough; 24 keeps margin)
const MAX_EMPTY = 12;
const MAX_LOG = 5;

export interface CompactState {
	tick: number;
	/** Wall-clock seconds of game time elapsed (tick / 10). */
	seconds: number;
	hour: number;
	you: {
		factionId: number;
		name: string;
		members: number;
		product: number;
		productInTransit: number;
		dirtyCash: number;
		dirtyInTransit: number;
		cleanCash: number;
		quarters: number;
		buildings: Record<BuildingType, number>;
		tech: { armament: number; protection: number; logistics: number };
		attackRatio: number;
		launderRatio: number;
		upkeepPaid: boolean;
		/** Ticks before you can strike again (0 = ready). */
		strikeReadyIn: number;
	};
	/** Battle-royale standings, best first. */
	standings: { rank: number; factionId: number; name: string; quarters: number; you: boolean }[];
	/** Owned quarters with nothing built — where `build` can go. */
	emptyQuarters: number[];
	/**
	 * Quarters you can attack **right now** (adjacent, not yours, not pacted),
	 * cheapest first. This is the actionable list for `attack`.
	 */
	targets: { module: number; owner: number; ownerName: string; control: number; garrison: number }[];
	/** Assaults you are running. */
	outgoing: { module: number; troops: number }[];
	/** Assaults aimed at you. */
	incoming: { module: number; from: number; fromName: string; troops: number; yourGarrison: number }[];
	/** Heavy strikes in flight (anyone's). */
	strikes: { from: number; module: number; landsInTicks: number }[];
	police: { pressure: number; target: number; targetingYou: boolean; raids: number };
	/** Recent log lines, oldest first. */
	log: string[];
}

/** Builds the compact view for one faction. */
export function compactState(world: World, factionId: number): CompactState {
	const faction = world.factions[factionId]!;
	const neighbors = world.city.neighbors;
	const owned = world.modulesOwned(factionId);

	const emptyQuarters: number[] = [];
	const pacted = new Set(
		world.factions.filter((other) => world.hasPact(factionId, other.id)).map((other) => other.id),
	);
	const targets: CompactState["targets"] = [];
	const seen = new Set<number>();
	for (let module = 0; module < world.territory.count; module += 1) {
		if (world.territory.owner[module] !== factionId) continue;
		if (world.territory.building[module] === -1 && world.territory.construction[module] === 0) {
			if (emptyQuarters.length < MAX_EMPTY) emptyQuarters.push(module);
		}
		for (const neighbor of neighbors[module] ?? []) {
			if (seen.has(neighbor)) continue;
			const owner = world.territory.owner[neighbor]!;
			if (owner === factionId) continue;
			if (owner !== NEUTRAL && pacted.has(owner)) continue;
			seen.add(neighbor);
			targets.push({
				module: neighbor,
				owner,
				ownerName: owner === NEUTRAL ? "neutral" : (world.factions[owner]?.name ?? `f${owner}`),
				control: Math.round(world.controlAt(neighbor)),
				garrison: Math.round(world.garrisonAt(neighbor)),
			});
		}
	}
	targets.sort((a, b) => a.control - b.control);

	const incoming = world.attacks
		.filter((attack) => world.territory.owner[attack.target] === factionId)
		.map((attack) => ({
			module: attack.target,
			from: attack.factionId,
			fromName: world.factions[attack.factionId]?.name ?? `f${attack.factionId}`,
			troops: Math.round(attack.troops),
			yourGarrison: Math.round(world.garrisonAt(attack.target)),
		}));

	const standings = world.rankings().map((id, index) => ({
		rank: index + 1,
		factionId: id,
		name: world.factions[id]?.name ?? `f${id}`,
		quarters: world.modulesOwned(id),
		you: id === factionId,
	}));

	return {
		tick: world.tick,
		seconds: Math.round(world.tick / SIM_HZ),
		hour: world.hourOfDay(),
		you: {
			factionId,
			name: faction.name,
			members: Math.round(faction.members),
			product: Math.round(faction.product),
			productInTransit: Math.round(faction.productInTransit),
			dirtyCash: Math.round(faction.dirtyCash),
			dirtyInTransit: Math.round(faction.dirtyInTransit),
			cleanCash: Math.round(faction.cleanCash),
			quarters: owned,
			buildings: world.buildingCounts(factionId),
			tech: { ...faction.tech },
			attackRatio: faction.attackRatio,
			launderRatio: faction.launderRatio,
			upkeepPaid: faction.upkeepPaid,
			strikeReadyIn: Math.max(0, faction.strikeCooldown),
		},
		standings,
		emptyQuarters,
		targets: targets.slice(0, MAX_TARGETS),
		outgoing: world.attacks
			.filter((attack) => attack.factionId === factionId)
			.map((attack) => ({ module: attack.target, troops: Math.round(attack.troops) })),
		incoming,
		strikes: world.pendingStrikes().map((strike) => ({
			from: strike.factionId,
			module: strike.target,
			landsInTicks: Math.max(0, strike.landsAt - world.tick),
		})),
		police: {
			pressure: Math.round(world.police.pressure * 10) / 10,
			target: world.police.target,
			targetingYou: world.police.target === factionId,
			raids: world.police.raids,
		},
		log: world.log.slice(-MAX_LOG),
	};
}

/** Building type list, exposed so the MCP catalog and docs stay in sync. */
export const AGENT_BUILDINGS: readonly BuildingType[] = BUILDING_TYPES;
