/**
 * Constantes de simulation — alignées sur docs/tech-stack.md.
 * La carte jouée est une vraie ville (Paris IRIS) : plus de grille procédurale.
 */

/** Fréquence de simulation (Hz) — tech-stack.md : 10 Hz. */
export const SIM_HZ = 10;

/** Pas de simulation fixe (ms) — indépendant du framerate. */
export const SIM_STEP_MS = 1000 / SIM_HZ;
