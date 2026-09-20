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
