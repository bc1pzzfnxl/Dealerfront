import {
	Boxes,
	Coins,
	Droplets,
	Eye,
	Factory,
	FlaskConical,
	HandCoins,
	Landmark,
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
 * Icons per building type (one action = one logo, readable without reading the label).
 * `currentColor`: the color comes from the faction / state, never from decoration.
 */
export const BUILDING_ICONS: Record<BuildingType, typeof FlaskConical> = {
	housing: Users,
	lab: FlaskConical,
	storefront: Store,
	front: Landmark,
	safehouse: Shield,
	depot: Warehouse,
	workshop: Factory,
	counter: Eye,
};

/**
 * MapLibre image (RGBA pixels) of a building icon: colored circular badge
 * + white glyph. `glyphMarkup` = already-rendered Lucide SVG (async: canvas rasterization).
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

/** Cartel resource icons (top bar). */
export const RESOURCE_ICONS = {
	members: Users,
	product: Droplets,
	sale: HandCoins,
	clean: Coins,
} as const;

/** War operation icons (command bar). */
export const ACTION_ICONS = {
	attack: Zap,
	raid: Skull,
	bust: HandCoins,
	intercept: Truck,
	strike: Skull,
	batch: Boxes,
	buy: Coins,
} as const;

export type ActionIcon = keyof typeof ACTION_ICONS;
