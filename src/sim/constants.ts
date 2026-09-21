/**
 * Simulation constants — aligned with docs/tech-stack.md.
 * The map played is a real city (Paris IRIS): no more procedural grid.
 */

/** Simulation frequency (Hz) — tech-stack.md: 10 Hz. */
export const SIM_HZ = 10;

/** Fixed simulation step (ms) — framerate-independent. */
export const SIM_STEP_MS = 1000 / SIM_HZ;

/** Ticks per in-game hour (12 real seconds at 10 Hz) → one day = 4.8 min. */
export const TICKS_PER_HOUR = 120;

/** Ticks per in-game day. */
export const TICKS_PER_DAY = TICKS_PER_HOUR * 24;

/** Game start hour (8 a.m.). */
export const START_HOUR = 8;
