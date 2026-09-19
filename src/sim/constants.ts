/**
 * Constantes de simulation — alignées sur docs/tech-stack.md et docs/procgen.md.
 */

/** Largeur de la grille (tuiles) — 144×144 → 24×24 quartiers. */
export const GRID_WIDTH = 144;

/** Hauteur de la grille (tuiles). */
export const GRID_HEIGHT = 144;

/** Taille d'un module urbain en tuiles — procgen.md : modules 6×6. */
export const MODULE_SIZE = 6;

/** Nombre de modules par côté (24×24 = 576 quartiers). */
export const MODULES_W = GRID_WIDTH / MODULE_SIZE;
export const MODULES_H = GRID_HEIGHT / MODULE_SIZE;

/** Fréquence de simulation (Hz) — tech-stack.md : 10 Hz. */
export const SIM_HZ = 10;

/** Pas de simulation fixe (ms) — indépendant du framerate. */
export const SIM_STEP_MS = 1000 / SIM_HZ;
