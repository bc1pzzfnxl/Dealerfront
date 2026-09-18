/**
 * PRNG seedé — déterminisme de génération ET de simulation (tech-stack.md).
 * Implémentation mulberry32 (rapide, suffisante pour du gameplay).
 */

export type Rng = () => number;

/** Crée un générateur déterministe à partir d'une seed entière. */
export function createRng(seed: number): Rng {
	let a = seed >>> 0;
	return function mulberry32(): number {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Entier dans [minInclusive, maxExclusive). */
export function randInt(rng: Rng, minInclusive: number, maxExclusive: number): number {
	return minInclusive + Math.floor(rng() * (maxExclusive - minInclusive));
}

export interface Weighted<T> {
	value: T;
	weight: number;
}

/** Tirage pondéré déterministe. */
export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T {
	const total = items.reduce((sum, item) => sum + item.weight, 0);
	if (total <= 0) throw new Error("pickWeighted: poids total nul");
	let r = rng() * total;
	for (const item of items) {
		r -= item.weight;
		if (r <= 0) return item.value;
	}
	return items[items.length - 1]!.value;
}
