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
	/** Part des Membres engagée à chaque assaut (0,05–0,6). */
	attackRatio: number;
	/** Part de la capacité des façades effectivement blanchie (0–1). */
	launderRatio: number;
	/** Cooldowns **propres** à chaque opération (ticks) — évite le faux choix. */
	hitmanCooldown: number;
	raidCooldown: number;
	descentCooldown: number;
	sabotageCooldown: number;
	interceptCooldown: number;
	/** Nombre de corruptions achetées (coût croissant). */
	corruptionUses: number;
	/** Les guetteurs sont-ils payés ce tick ? (sinon le renseignement est aveugle). */
	guardsPaid: boolean;
	/** Fin de la fenêtre d'armement achetée (tick) — bonus d'attaque temporaire. */
	armamentUntil: number;
	/** Niveau d'armement acheté (0 = aucun). */
	armamentLevel: number;
	/** Nombre d'achats d'armement (coût croissant). */
	armamentUses: number;
	/** Cooldown de rachat de quartier (ticks). */
	buyCooldown: number;
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
	"#8FC7E8",
	"#E8C57A",
	"#8FD8A5",
	"#B79DE0",
	"#E88C80",
	"#6FD0C4",
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
export const FACTION_COUNT = 6;

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
			cashPropre: 1000,
			housing: 0,
			buildings: 0,
			tech: { armement: 0, protection: 0, logistique: 0 },
			hitmanCooldown: 0,
			raidCooldown: 0,
			descentCooldown: 0,
			sabotageCooldown: 0,
			interceptCooldown: 0,
			attackRatio: 0.2,
			launderRatio: 0.5,
			corruptionUses: 0,
			guardsPaid: true,
			armamentUntil: 0,
			armamentLevel: 0,
			armamentUses: 0,
			buyCooldown: 0,
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
