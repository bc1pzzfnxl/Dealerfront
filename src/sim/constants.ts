/**
 * Constantes de simulation — alignées sur docs/tech-stack.md.
 * La carte jouée est une vraie ville (Paris IRIS) : plus de grille procédurale.
 */

/** Fréquence de simulation (Hz) — tech-stack.md : 10 Hz. */
export const SIM_HZ = 10;

/** Pas de simulation fixe (ms) — indépendant du framerate. */
export const SIM_STEP_MS = 1000 / SIM_HZ;

/** Ticks par heure in-game (12 s réelles à 10 Hz) → un jour = 4,8 min. */
export const TICKS_PER_HOUR = 120;

/** Ticks par jour in-game. */
export const TICKS_PER_DAY = TICKS_PER_HOUR * 24;

/** Heure de départ d'une partie (8 h du matin). */
export const START_HOUR = 8;
