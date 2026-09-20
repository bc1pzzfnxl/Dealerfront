/**
 * Buildings — bâtiments de cartel convertis depuis les bâtiments de la ville.
 * Voir docs/economy.md.
 */

import type { ZoneType } from "./types";

export const BUILDING_TYPES = [
	"logement",
	"labo",
	"vente",
	"facade",
	"planque",
	"depot",
	"atelier",
	"contre",
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];

export const NO_BUILDING = -1;
export const BUILDING_INDEX: Record<BuildingType, number> = Object.fromEntries(
	BUILDING_TYPES.map((type, index) => [type, index]),
) as Record<BuildingType, number>;

export interface BuildingSpec {
	type: BuildingType;
	label: string;
	/** Coût (une seule monnaie selon le bâtiment). */
	costMembers?: number;
	costSale?: number;
	costClean?: number;
	/** Taille du marqueur (largeur, hauteur). */
	width: number;
	height: number;
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
	logement: { type: "logement", label: "Recrutement", costMembers: 800, width: 1.6, height: 1.2 },
	labo: { type: "labo", label: "Labo", costSale: 1500, width: 1.4, height: 1.6 },
	vente: { type: "vente", label: "Point de vente", costSale: 1500, width: 1.8, height: 0.8 },
	facade: { type: "facade", label: "Façade", costSale: 2200, width: 2.0, height: 1.0 },
	planque: { type: "planque", label: "Planque", costSale: 1800, width: 1.6, height: 0.7 },
	depot: { type: "depot", label: "Dépôt", costSale: 1800, width: 2.2, height: 1.4 },
	atelier: { type: "atelier", label: "Atelier", costClean: 3500, width: 1.6, height: 1.1 },
	contre: { type: "contre", label: "Guetteur", costClean: 3000, width: 1.2, height: 1.3 },
};

/** Effets chiffrés (par tick sauf mention). */
export const BUILDING_EFFECTS = {
	/** Membres produits par quartier possédé. */
	baseMembersPerQuarter: 8,
	/** Membres produits par logement. */
	membersPerLogement: 25,
	/** Produit par labo. */
	produitPerLabo: 1.5,
	/** Produit converti par point de vente et par tick. */
	produitPerVente: 2,
	/** Cash sale par unité de produit vendue. */
	pricePerProduit: 60,
	/** Cash sale blanchi par façade et par tick. */
	cashPerFacade: 60,
	/** Commission de blanchiment. */
	commission: 0.25,
	/** Membres max ajoutés par dépôt. */
	maxMembersPerDepot: 2000,
	/** Multiplicateur de défense local d'une planque. */
	planqueDefense: 1.5,
} as const;

/** Coût d'une **conversion** (bâti existant réutilisé) : 50 % du coût plein. */
export const CONVERSION_COST = 0.5;

/**
 * Coût croissant : chaque bâtiment du même type renchérit le suivant.
 * Crée un vrai arbitrage (diversifier plutôt que spammer un type).
 */
export const BUILDING_COST_GROWTH = 1.35;

/** Facteur de coût du `count`-ième bâtiment d'un type (0 = premier). */
export function buildingCostGrowth(count: number): number {
	return BUILDING_COST_GROWTH ** count;
}

/** Durée d'une **construction neuve** (terrain vague), en ticks. La conversion est instantanée. */
export const BUILD_TICKS: Record<BuildingType, number> = {
	logement: 90,
	labo: 120,
	vente: 120,
	facade: 180,
	planque: 180,
	depot: 180,
	atelier: 240,
	contre: 240,
};

/** La conversion (bâti existant) prend la moitié du temps d'une construction neuve. */
export const CONVERSION_TIME = 0.5;

/** Description courte de l'effet (aide à la décision / infobulles). */
export const BUILDING_EFFECT_LABELS: Record<BuildingType, string> = {
	logement: "recrute +25 membres/tick (immeuble récupéré)",
	labo: "+1,5 produit/tick",
	vente: "vend le produit (≈60 sale/unité)",
	facade: "blanchit 60 cash sale/tick",
	planque: "défense ×1,5",
	depot: "+2000 membres max",
	atelier: "+1 niveau de tech",
	contre: "alerte les descentes · −15 % tueur · gêne descentes/sabotages",
};

/** Ordre d'amorçage de la chaîne économique (à construire en priorité). */
export const ECONOMY_CHAIN: readonly BuildingType[] = ["labo", "vente", "facade"];

/**
 * Prochaine étape manquante de la chaîne économique, si abordable.
 * Tant qu'elle existe, on ne construit **rien d'autre** : cela évite de
 * gaspiller le budget d'amorçage (ex. une Planque avant le Labo).
 */
export function missingEconomyStep(
	counts: Record<BuildingType, number>,
	affordable: (type: BuildingType) => boolean,
): BuildingType | null {
	for (const type of ECONOMY_CHAIN) {
		if (counts[type] === 0 && affordable(type)) return type;
	}
	return null;
}

/**
 * Compatibilité zone → bâtiment de cartel (conversion d'un bâti existant).
 * Voir docs/economy.md §4 : une conversion incompatible est refusée. Chaque
 * zone accepte au moins un type (jamais de blocage total).
 */
export const ZONE_BUILDINGS: Record<ZoneType, readonly BuildingType[]> = {
	// Immeubles d'habitation : cœur économique + défense.
	residential: ["logement", "labo", "vente", "facade", "planque", "contre"],
	// Commerces : idem (+ contre-espionnage en arrière-boutique).
	commercial: ["logement", "labo", "vente", "facade", "planque", "contre"],
	// Vie nocturne : cœur économique + planque (arrière-salle).
	nightlife: ["logement", "labo", "vente", "facade", "planque"],
	// Friches industrielles : tout, plus Dépôt et Atelier.
	industrial: ["logement", "labo", "vente", "facade", "planque", "depot", "atelier", "contre"],
	// Laveries : cœur économique + contre-espionnage.
	laundry: ["logement", "labo", "vente", "facade", "planque", "contre"],
	// Postes détournés : uniquement contre-espionnage et planque.
	police: ["contre", "planque"],
	// Parcs : seulement une planque dissimulée.
	park: ["planque"],
	// Terrains vagues : construction neuve seulement (rien à réquisitionner pour recruter).
	vacant: ["labo", "vente", "facade", "planque", "depot", "atelier"],
};

export function canBuildInZone(zone: ZoneType, type: BuildingType): boolean {
	return ZONE_BUILDINGS[zone].includes(type);
}

/** Zones « bâties » : c'est là qu'on peut convertir un bâti existant. */
export const BUILT_ZONES: readonly ZoneType[] = [
	"residential",
	"commercial",
	"nightlife",
	"industrial",
	"laundry",
];

/**
 * Composition cible d'un domaine (part des quartiers possédés par type).
 * Sert à l'IA et aux simulations : on comble le plus grand déficit, jamais
 * « le premier abordable » (qui remplissait tout de logements).
 */
export const BUILD_TARGETS: Record<BuildingType, number> = {
	logement: 0.3, // recrutement
	labo: 0.2,
	vente: 0.15,
	facade: 0.15,
	depot: 0.05,
	atelier: 0.05,
	contre: 0.05,
	planque: 0.05,
};

export function chooseBuildType(
	counts: Record<BuildingType, number>,
	owned: number,
	affordable: (type: BuildingType) => boolean,
	caps: Partial<Record<BuildingType, number>> = {},
): BuildingType | null {
	if (owned <= 0) return null;
	let best: BuildingType | null = null;
	let bestDeficit = 0;
	for (const type of BUILDING_TYPES) {
		if (!affordable(type)) continue;
		const cap = caps[type];
		if (cap !== undefined && counts[type]! >= cap) continue;
		const deficit = BUILD_TARGETS[type] * owned - counts[type]!;
		if (deficit > bestDeficit) {
			bestDeficit = deficit;
			best = type;
		}
	}
	return best;
}
