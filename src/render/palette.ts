import type { ZoneType } from "../sim/types";

/**
 * Per-zone rendering styles — grayscale only (art-direction.md, R5).
 * `shade` = volume tint, `ground` = module ground tint.
 * Colored tints are reserved for information (never decorative).
 */
export interface ZoneStyle {
	height: number;
	footprint: number;
	shade: number;
	ground: number;
}

export const ZONE_STYLE: Record<ZoneType, ZoneStyle> = {
	residential: { height: 2.6, footprint: 2.8, shade: 0.55, ground: 0.3 },
	commercial: { height: 4.0, footprint: 2.6, shade: 0.64, ground: 0.34 },
	nightlife: { height: 5.0, footprint: 2.4, shade: 0.7, ground: 0.36 },
	industrial: { height: 3.2, footprint: 3.0, shade: 0.46, ground: 0.28 },
	park: { height: 0.18, footprint: 5.4, shade: 0.38, ground: 0.42 },
	police: { height: 5.6, footprint: 2.6, shade: 0.78, ground: 0.38 },
	laundry: { height: 2.2, footprint: 2.8, shade: 0.6, ground: 0.32 },
	/** Vacant lot / open square: light ground, no volume. */
	vacant: { height: 0.05, footprint: 5.6, shade: 0.46, ground: 0.5 },
};

/** Colorblind mode: distinct gray values per faction (art-direction.md). */
export const FACTION_GRAYSCALE = [
	"#F2F4F7",
	"#C7CDD4",
	"#9AA1AA",
	"#6B7280",
	"#464C55",
	"#2F343B",
] as const;

/** Patterns/symbols per faction (legend + readability beyond color). */
export const FACTION_SYMBOLS = ["●", "■", "▲", "◆", "✚", "✖"] as const;

/** Display color of a faction (color, or distinct gray in colorblind mode). */
export function factionDisplayColor(index: number, hex: string, colorblind: boolean): string {
	if (!colorblind) return hex;
	return FACTION_GRAYSCALE[index % FACTION_GRAYSCALE.length]!;
}
