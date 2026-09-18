/**
 * Territory — propriété, contrôle et logement des quartiers (modules 6×6).
 * Voir docs/territory.md et docs/economy.md.
 */

import { MODULES_H, MODULES_W } from "./constants";
import { NO_BUILDING } from "./buildings";

/** Propriétaire neutre. */
export const NEUTRAL = -1;

export interface Territory {
	/** id de faction par module, NEUTRAL sinon. */
	readonly owner: Int16Array;
	/** Contrôle 0–100 (quartiers possédés) ou garnison (neutres). */
	readonly control: Float32Array;
	/** Bâtiment aménagé : NO_BUILDING, sinon index dans BUILDING_TYPES. */
	readonly building: Int8Array;
	/** Chantier en cours : ticks restants (0 = aucun). */
	readonly construction: Int16Array;
	/** Bâtiment en chantier : NO_BUILDING sinon index. */
	readonly pending: Int8Array;
	readonly count: number;
}

export function createTerritory(count: number): Territory {
	return {
		owner: new Int16Array(count).fill(NEUTRAL),
		control: new Float32Array(count),
		building: new Int8Array(count).fill(NO_BUILDING),
		construction: new Int16Array(count),
		pending: new Int8Array(count).fill(NO_BUILDING),
		count,
	};
}

/** Voisins d'un module (4-directions) dans la grille de quartiers. */
export function neighborsOf(module: number): number[] {
	const x = module % MODULES_W;
	const y = Math.floor(module / MODULES_W);
	const out: number[] = [];
	if (x > 0) out.push(module - 1);
	if (x < MODULES_W - 1) out.push(module + 1);
	if (y > 0) out.push(module - MODULES_W);
	if (y < MODULES_H - 1) out.push(module + MODULES_W);
	return out;
}

/** Index de module à partir d'une tuile (x, y en tuiles). */
export function moduleAtTile(x: number, y: number, moduleSize: number): number {
	const mx = Math.min(MODULES_W - 1, Math.max(0, Math.floor(x / moduleSize)));
	const my = Math.min(MODULES_H - 1, Math.max(0, Math.floor(y / moduleSize)));
	return my * MODULES_W + mx;
}
