/**
 * Seeded PRNG — generation AND simulation determinism (tech-stack.md).
 * mulberry32 implementation (fast, sufficient for gameplay).
 * The internal state is **serializable** (`state()` / `setState()`) so that
 * restoring a snapshot stays deterministic (arena, DO hibernation).
 */

export interface Rng {
	(): number;
	/** Internal state (unsigned integer) — include in a snapshot. */
	state(): number;
	setState(value: number): void;
}

/** Creates a deterministic generator from an integer seed. */
export function createRng(seed: number): Rng {
	let a = seed >>> 0;
	const next = (): number => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const rng = next as Rng;
	rng.state = () => a >>> 0;
	rng.setState = (value: number) => {
		a = value >>> 0;
	};
	return rng;
}

/** Integer in [minInclusive, maxExclusive). */
export function randInt(rng: Rng, minInclusive: number, maxExclusive: number): number {
	return minInclusive + Math.floor(rng() * (maxExclusive - minInclusive));
}

export interface Weighted<T> {
	value: T;
	weight: number;
}

/** Deterministic weighted pick. */
export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T {
	const total = items.reduce((sum, item) => sum + item.weight, 0);
	if (total <= 0) throw new Error("pickWeighted: zero total weight");
	let r = rng() * total;
	for (const item of items) {
		r -= item.weight;
		if (r <= 0) return item.value;
	}
	return items[items.length - 1]!.value;
}
