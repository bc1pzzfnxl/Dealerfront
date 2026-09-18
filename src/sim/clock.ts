/**
 * Horloge de simulation à pas fixe — tech-stack.md.
 * Découple la simulation (10 Hz) du rendu (60 FPS) et garantit le déterminisme.
 */

import { SIM_STEP_MS } from "./constants";

export type TickHandler = (tick: number) => void;

/** Clamp anti-spirale : évite une rafale de ticks après un onglet en arrière-plan. */
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

	/** Avance selon le temps réel écoulé ; exécute N pas fixes. Retourne N. */
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

