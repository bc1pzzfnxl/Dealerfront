/**
 * Factions — joueur (cartel) et gangs IA.
 * Mode DealerFront : on commande une faction, pas un personnage.
 */

export interface Faction {
	id: number;
	name: string;
	color: string;
	isPlayer: boolean;
	/** Membres (troupes) : ressource-troupe du cartel. */
	members: number;
	/** Produit (stock généré par les labos). */
	produit: number;
	/** Cash sale (argent non blanchi). */
	cashSale: number;
	/** Cash propre (argent blanchi, base du score). */
	cashPropre: number;
	/** Logements aménagés (production de membres). */
	housing: number;
	/** Total de bâtiments construits. */
	buildings: number;
	/** Niveaux de tech (Armement / Protection / Logistique). */
	tech: { armement: number; protection: number; logistique: number };
	/** Cooldown du tueur à gage (ticks). */
	hitmanCooldown: number;
	/** Nombre de corruptions achetées (coût croissant). */
	corruptionUses: number;
	/** Quartiers pris (toute capture, neutre comprise). */
	captures: number;
	/** Quartiers perdus. */
	quartersLost: number;
	/** Gangs réduits à 0 quartier. */
	eliminations: number;
	/** Raids policiers subis. */
	raidsSuffered: number;
	/** Saisies policières subies. */
	seizures: number;
	/** Faction réduite à 0 quartier. */
	eliminated: boolean;
	/** Fin de la pénalité de traître (tick). */
	traitorUntil: number;
}

/** Palette de factions (voir docs/art-direction.md). */
export const FACTION_COLORS = [
	"#6FB7E8",
	"#E0A030",
	"#7FD08A",
	"#A97BD8",
	"#E23B2E",
	"#2FB0A0",
] as const;

export const FACTION_NAMES = [
	"Cartel",
	"Gang Nord",
	"Gang Est",
	"Gang Sud",
	"Gang Ouest",
	"Syndicat",
] as const;

/** Nombre de factions par défaut (joueur + IA). */
export const FACTION_COUNT = 4;

export function createFactions(count: number, startMembers: number): Faction[] {
	const factions: Faction[] = [];
	for (let i = 0; i < count; i += 1) {
		factions.push({
			id: i,
			name: FACTION_NAMES[i % FACTION_NAMES.length]!,
			color: FACTION_COLORS[i % FACTION_COLORS.length]!,
			isPlayer: i === 0,
			members: startMembers,
			produit: 0,
			cashSale: 2000,
			cashPropre: 0,
			housing: 0,
			buildings: 0,
			tech: { armement: 0, protection: 0, logistique: 0 },
			hitmanCooldown: 0,
			corruptionUses: 0,
			captures: 0,
			quartersLost: 0,
			eliminations: 0,
			raidsSuffered: 0,
			seizures: 0,
			eliminated: false,
			traitorUntil: 0,
		});
	}
	return factions;
}
