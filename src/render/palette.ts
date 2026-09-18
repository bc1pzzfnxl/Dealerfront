import type { BuildingType } from "../sim/buildings";
import type { ZoneType } from "../sim/types";

/**
 * Styles de rendu par zone — uniquement des niveaux de gris (art-direction.md, R5).
 * `shade` = teinte du volume, `ground` = teinte du sol du module.
 * Les teintes colorées sont réservées à l'information (jamais décoratives).
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
	/** Terrain vague / place ouverte : sol clair, pas de volume. */
	vacant: { height: 0.05, footprint: 5.6, shade: 0.46, ground: 0.5 },
};

/** Mode daltonien : valeurs de gris distinctes par faction (art-direction.md). */
export const FACTION_GRAYSCALE = [
	"#F2F4F7",
	"#C7CDD4",
	"#9AA1AA",
	"#6B7280",
	"#464C55",
	"#2F343B",
] as const;

/** Motifs/symboles par faction (légende + lisibilité hors couleur). */
export const FACTION_SYMBOLS = ["●", "■", "▲", "◆", "✚", "✖"] as const;

/** Couleur d'affichage d'une faction (couleur, ou gris distinct en daltonien). */
export function factionDisplayColor(index: number, hex: string, colorblind: boolean): string {
	if (!colorblind) return hex;
	return FACTION_GRAYSCALE[index % FACTION_GRAYSCALE.length]!;
}

/** Couleur pastel par type de bâtiment de cartel (DA P16 : code couleur). */
export const BUILDING_COLORS: Record<BuildingType, string> = {
	logement: "#C9D6E3",
	labo: "#9FD8B4",
	vente: "#F2CE86",
	facade: "#F0B6D2",
	planque: "#C6BEE8",
	depot: "#D8C7A8",
	atelier: "#8FC7E8",
	contre: "#EBA6A0",
};
