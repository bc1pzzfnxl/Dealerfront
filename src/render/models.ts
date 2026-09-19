import type { BuildingType } from "../sim/buildings";

/**
 * Modèles 3D composés des bâtiments de cartel (style RTS) : chaque bâtiment est
 * une **recette** de volumes (boîtes/cylindres/cônes) posés sur le quartier.
 * Coordonnées locales au quartier : `y` = 0 au sol, +y vers le haut.
 */
export interface CartelPart {
	shape: "box" | "cylinder" | "cone" | "sphere";
	x: number;
	y: number;
	z: number;
	sx: number;
	sy: number;
	sz: number;
	color: string;
	rot?: [number, number, number];
}

const GRAY = "#C9D6E3";
const DARK = "#5C6673";
const LIGHT = "#E8EDF2";

/** Recettes par type (base ~1,8 × 1,4). */
export const CARTEL_MODELS: Record<BuildingType, CartelPart[]> = {
	// Immeuble d'habitation réquisitionné : tours en gradins + entrée + mât.
	logement: [
		{ shape: "box", x: 0, y: 0.9, z: 0, sx: 1.9, sy: 1.8, sz: 1.5, color: GRAY },
		{ shape: "box", x: 0, y: 2.1, z: 0, sx: 1.4, sy: 0.8, sz: 1.1, color: LIGHT },
		{ shape: "box", x: 0, y: 2.65, z: 0, sx: 0.9, sy: 0.3, sz: 0.7, color: DARK },
		{ shape: "box", x: 0.7, y: 0.35, z: 0.65, sx: 0.4, sy: 0.7, sz: 0.25, color: "#F2CE86" },
		{ shape: "box", x: -0.9, y: 2.4, z: -0.7, sx: 0.08, sy: 1.6, sz: 0.08, color: LIGHT },
		{ shape: "box", x: -0.75, y: 2.9, z: -0.7, sx: 0.35, sy: 0.2, sz: 0.05, color: "#E88C80" },
	],
	// Labo : unité industrielle + deux cuves + ventilation.
	labo: [
		{ shape: "box", x: 0.1, y: 0.65, z: 0, sx: 1.6, sy: 1.3, sz: 1.5, color: "#9FD8B4" },
		{ shape: "cylinder", x: -0.85, y: 0.8, z: 0.35, sx: 0.72, sy: 1.6, sz: 0.72, color: LIGHT },
		{ shape: "cylinder", x: -0.85, y: 0.8, z: -0.5, sx: 0.72, sy: 1.6, sz: 0.72, color: LIGHT },
		{ shape: "box", x: 0.5, y: 1.5, z: 0.4, sx: 0.5, sy: 0.4, sz: 0.5, color: DARK },
		{ shape: "cylinder", x: 0.6, y: 1.8, z: -0.4, sx: 0.34, sy: 0.6, sz: 0.34, color: DARK },
		{ shape: "box", x: -0.4, y: 1.45, z: 0, sx: 0.9, sy: 0.15, sz: 0.3, color: DARK },
	],
	// Point de vente : boutique + auvent + enseigne + caisses.
	vente: [
		{ shape: "box", x: 0, y: 0.7, z: 0.15, sx: 1.7, sy: 1.4, sz: 1.3, color: "#F2CE86" },
		{ shape: "box", x: 0, y: 1.35, z: 0.75, sx: 1.9, sy: 0.25, sz: 0.7, color: LIGHT, rot: [-0.25, 0, 0] },
		{ shape: "box", x: 0, y: 1.7, z: 0.72, sx: 1.5, sy: 0.45, sz: 0.12, color: "#F6E3B0" },
		{ shape: "box", x: 0.8, y: 0.25, z: -0.75, sx: 0.5, sy: 0.5, sz: 0.5, color: "#C79A55" },
		{ shape: "box", x: 0.35, y: 0.75, z: -0.75, sx: 0.5, sy: 0.5, sz: 0.5, color: "#C79A55" },
	],
	// Façade : laverie — tambours en façade + néon + cheminée.
	facade: [
		{ shape: "box", x: 0, y: 0.8, z: -0.1, sx: 1.7, sy: 1.6, sz: 1.3, color: "#F0B6D2" },
		{ shape: "cylinder", x: -0.45, y: 0.8, z: 0.62, sx: 0.8, sy: 0.25, sz: 0.8, color: "#FFF2F8", rot: [Math.PI / 2, 0, 0] },
		{ shape: "cylinder", x: 0.45, y: 0.8, z: 0.62, sx: 0.8, sy: 0.25, sz: 0.8, color: "#FFF2F8", rot: [Math.PI / 2, 0, 0] },
		{ shape: "box", x: 0, y: 1.75, z: 0.6, sx: 1.7, sy: 0.5, sz: 0.14, color: "#FFE0F0" },
		{ shape: "cylinder", x: 0.6, y: 2.1, z: -0.5, sx: 0.3, sy: 1.2, sz: 0.3, color: DARK },
	],
	// Planque : garage bas + parabole + vitres grillagées.
	planque: [
		{ shape: "box", x: 0, y: 0.45, z: 0, sx: 1.8, sy: 0.9, sz: 1.5, color: "#C6BEE8" },
		{ shape: "box", x: 0, y: 0.35, z: 0.78, sx: 1.1, sy: 0.7, sz: 0.1, color: DARK },
		{ shape: "cone", x: -0.6, y: 1.35, z: -0.4, sx: 0.9, sy: 0.9, sz: 0.9, color: LIGHT, rot: [Math.PI / 3, 0, 0] },
		{ shape: "box", x: 0.7, y: 1.05, z: 0.5, sx: 0.4, sy: 0.4, sz: 0.4, color: DARK },
	],
	// Dépôt : entrepôt + conteneurs empilés + quai.
	depot: [
		{ shape: "box", x: -0.1, y: 0.85, z: -0.2, sx: 1.5, sy: 1.7, sz: 1.3, color: "#D8C7A8" },
		{ shape: "box", x: -0.1, y: 0.55, z: 0.78, sx: 1.1, sy: 1.1, sz: 0.1, color: DARK },
		{ shape: "box", x: 0.8, y: 0.35, z: 0.4, sx: 0.7, sy: 0.7, sz: 1.1, color: "#B99A6B" },
		{ shape: "box", x: 0.8, y: 1.05, z: 0.4, sx: 0.7, sy: 0.7, sz: 1.1, color: "#A98455" },
	],
	// Atelier : atelier + portique de levage + ventilation.
	atelier: [
		{ shape: "box", x: 0, y: 0.7, z: 0, sx: 1.7, sy: 1.4, sz: 1.4, color: "#8FC7E8" },
		{ shape: "box", x: -0.95, y: 1.3, z: -0.5, sx: 0.12, sy: 2.6, sz: 0.12, color: DARK },
		{ shape: "box", x: 0.95, y: 1.3, z: -0.5, sx: 0.12, sy: 2.6, sz: 0.12, color: DARK },
		{ shape: "box", x: 0, y: 2.5, z: -0.5, sx: 2.1, sy: 0.16, sz: 0.16, color: DARK },
		{ shape: "cylinder", x: 0.5, y: 1.7, z: 0.5, sx: 0.36, sy: 0.6, sz: 0.36, color: DARK },
	],
	// Contre-espionnage : bureau + antennes + camionnette de surveillance.
	contre: [
		{ shape: "box", x: -0.2, y: 0.95, z: -0.1, sx: 1.3, sy: 1.9, sz: 1.3, color: "#EBA6A0" },
		{ shape: "box", x: -0.75, y: 2.4, z: -0.5, sx: 0.08, sy: 1.0, sz: 0.08, color: DARK },
		{ shape: "cylinder", x: -0.2, y: 2.05, z: -0.1, sx: 0.7, sy: 0.25, sz: 0.7, color: LIGHT, rot: [Math.PI / 3, 0, 0] },
		{ shape: "box", x: 0.75, y: 0.35, z: 0.55, sx: 0.6, sy: 0.7, sz: 1.2, color: LIGHT },
		{ shape: "box", x: 0.75, y: 0.85, z: 0.85, sx: 0.55, sy: 0.4, sz: 0.5, color: DARK },
	],
};
