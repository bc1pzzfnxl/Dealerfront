/**
 * Fixed-step simulation clock — tech-stack.md.
 * Decouples the simulation (10 Hz) from rendering (60 FPS) and guarantees determinism.
 */

import { SIM_STEP_MS } from "./constants";

export type TickHandler = (tick: number) => void;

/** Anti-spiral clamp: avoids a burst of ticks after a backgrounded tab. */
const MAX_ACCUMULATED_MS = 1000;

export class SimClock {
	private readonly stepMs: number;
	private readonly onTick: TickHandler;
	private accumulatorMs = 0;
	private tickCount = 0;

	constructor(onTick: TickHandler, hz: number = 1000 / SIM_STEP_MS) {
		this.onTick = onTick;
		this.stepMs = 1000 / hz;
	}

	get tick(): number {
		return this.tickCount;
	}

	/** Advances based on elapsed real time; runs N fixed steps. Returns N. */
	advance(deltaMs: number): number {
		this.accumulatorMs = Math.min(this.accumulatorMs + deltaMs, MAX_ACCUMULATED_MS);
		let steps = 0;
		while (this.accumulatorMs >= this.stepMs) {
			this.accumulatorMs -= this.stepMs;
			this.tickCount += 1;
			steps += 1;
			this.onTick(this.tickCount);
		}
		return steps;
	}
}
