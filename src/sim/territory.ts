/**
 * Territory — ownership, control and buildings of quarters (real IRIS zones).
 * See docs/territory.md and docs/economy.md.
 */

import { NO_BUILDING } from "./buildings";

/** Neutral owner. */
export const NEUTRAL = -1;

export interface Territory {
	/** faction id per quarter, NEUTRAL otherwise. */
	readonly owner: Int16Array;
	/** Control 0–100 (owned quarters) or garrison (neutral). */
	readonly control: Float32Array;
	/** Upgraded building: NO_BUILDING, otherwise index in BUILDING_TYPES. */
	readonly building: Int8Array;
	/** Ongoing build site: remaining ticks (0 = none). */
	readonly construction: Int16Array;
	/** Building under construction: NO_BUILDING otherwise index. */
	readonly pending: Int8Array;
	/** Building delivery tick (creation animation). */
	readonly builtAt: Int32Array;
	/** Tick of the last capture (animation). */
	readonly capturedAt: Int32Array;
	/** End of a building's sabotage (reduced production), 0 = none. */
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
