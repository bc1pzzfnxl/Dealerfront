/**
 * Territory — propriété, contrôle et bâtiments des quartiers (zones IRIS réelles).
 * Voir docs/territory.md et docs/economy.md.
 */

import { NO_BUILDING } from "./buildings";

/** Propriétaire neutre. */
export const NEUTRAL = -1;

export interface Territory {
	/** id de faction par quartier, NEUTRAL sinon. */
	readonly owner: Int16Array;
	/** Contrôle 0–100 (quartiers possédés) ou garnison (neutres). */
	readonly control: Float32Array;
	/** Bâtiment aménagé : NO_BUILDING, sinon index dans BUILDING_TYPES. */
	readonly building: Int8Array;
	/** Chantier en cours : ticks restants (0 = aucun). */
	readonly construction: Int16Array;
	/** Bâtiment en chantier : NO_BUILDING sinon index. */
	readonly pending: Int8Array;
	/** Tick de livraison du bâtiment (animation de création). */
	readonly builtAt: Int32Array;
	/** Tick de la dernière capture (animation). */
	readonly capturedAt: Int32Array;
	/** Fin du sabotage d'un bâtiment (production réduite), 0 = aucun. */
	readonly sabotageUntil: Int32Array;
	readonly count: number;
}

export function createTerritory(count: number): Territory {
	return {
		owner: new Int16Array(count).fill(NEUTRAL),
		control: new Float32Array(count),
		building: new Int8Array(count).fill(NO_BUILDING),
		construction: new Int16Array(count),
		pending: new Int8Array(count).fill(NO_BUILDING),
		builtAt: new Int32Array(count).fill(-999),
		capturedAt: new Int32Array(count).fill(-999),
		sabotageUntil: new Int32Array(count),
		count,
	};
}
