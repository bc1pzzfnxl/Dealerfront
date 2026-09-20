import {
	Boxes,
	Coins,
	Droplets,
	Eye,
	Factory,
	FlaskConical,
	HandCoins,
	Landmark,
	Paintbrush,
	Shield,
	Skull,
	Store,
	Truck,
	Users,
	Warehouse,
	Zap,
} from "lucide-react";
import type { BuildingType } from "../sim/buildings";

/**
 * Icônes par type de bâtiment (une action = un logo, lisible sans lire le libellé).
 * `currentColor` : la couleur vient de la faction / de l'état, jamais d'un décor.
 */
export const BUILDING_ICONS: Record<BuildingType, typeof FlaskConical> = {
	logement: Users,
	labo: FlaskConical,
	vente: Store,
	facade: Landmark,
	planque: Shield,
	depot: Warehouse,
	atelier: Factory,
	contre: Eye,
};

/**
 * Image MapLibre (pixels RGBA) d'une icône de bâtiment : badge circulaire coloré
 * + glyphe blanc. `glyphMarkup` = SVG Lucide déjà rendu (async : rasterisation canvas).
 */
export async function buildingIconImage(
	glyphMarkup: string,
	color: string,
): Promise<ImageData | null> {
	if (typeof document === "undefined") return null;
	const size = 40;
	const glyph = glyphMarkup
		.replace(/\swidth="[^"]*"/, "")
		.replace(/\sheight="[^"]*"/, "")
		.replace("<svg", `<svg x="9" y="9" width="22" height="22"`)
		.replace(/currentColor/g, "#12161d");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<circle cx="20" cy="20" r="18" fill="${color}" stroke="#0b0e12" stroke-width="2"/>
${glyph}
</svg>`;
	const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	const image = new Image();
	image.src = url;
	try {
		await image.decode();
	} catch {
		return null;
	}
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.drawImage(image, 0, 0, size, size);
	return ctx.getImageData(0, 0, size, size);
}

/** Icônes des ressources du cartel (barre haute). */
export const RESOURCE_ICONS = {
	members: Users,
	produit: Droplets,
	sale: HandCoins,
	clean: Coins,
} as const;

/** Icônes des opérations de guerre (barre de commandement). */
export const ACTION_ICONS = {
	attack: Zap,
	raid: Skull,
	descent: HandCoins,
	sabotage: Paintbrush,
	intercept: Truck,
	hitman: Skull,
	batch: Boxes,
} as const;

export type ActionIcon = keyof typeof ACTION_ICONS;
