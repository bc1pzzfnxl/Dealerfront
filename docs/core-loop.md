# Core Loop — Boucle de jeu et déroulé d'une partie

> Statut : **v3 (DealerFront)** — boucle god-view équilibrée (gestion ↔ conquête).

## Objectif

Décrire la boucle d'activité du joueur-cartel et le déroulé macro d'une partie (**≈ 25 min**) : ce qu'il fait en permanence, ce qu'il cherche à maximiser, et comment la partie se termine.

## Règles

### Boucle de gameplay

1. **Produire** — les **Labos** (quartiers possédés) génèrent du **Produit**.
2. **Vendre** — les **Points de vente** convertissent le Produit en **Cash sale**.
3. **Blanchir** — les **Façades** convertissent le Cash sale en **Cash propre** (commission) — base du score et de la victoire.
4. **Étendre** — les **bagarres** conquièrent des quartiers **neutres** ou ennemis (`combat.md`), ce qui augmente l'Influence max et le revenu.
5. **Équiper** — les **Ateliers** débloquent la **tech** (Armement/Protection/Logistique, `tech.md`) qui change l'issue des bagarres.
6. **Défendre** — **Planques** et renforts protègent les quartiers ; **Contre-espionnage** contre les tueurs.
7. **Gérer la police** — la **Pression** monte avec la part de contrôle du leader ; on l'endure ou on la **corrompt** (`police-ai.md`).
8. **Gérer les gangs** — pactes, embargoes, trahisons, agents (`factions.md`).

### Condition de victoire / défaite

- **Victoire** : **dernier cartel en jeu** (battle royale, voir `win-conditions.md`).
- **Défaites** : 0 quartier (liquidation totale), faillite, **liquidation policière**.

### Déroulé macro d'une partie

| Phase | Repère | Caractéristique |
|---|---|---|
| **Implantation** | ~0–5 min | 1–2 quartiers, quelques Labos/Points de vente, neutre partout ailleurs, IA discrètes |
| **Expansion** | ~5–15 min | Conquête du neutre, premiers bâtiments, premiers pactes/trahisons, police faible |
| **Guerre de quartiers** | ~15–25 min | Affrontements entre gangs, tech, tueurs, raids de police contre le leader |
| **Clôture** | fin | Il ne reste qu'un cartel : les faibles sont achevés (encirclement), la police peut liquider |

Le rythme est piloté par la **causalité** (contrôle + Heat), pas par un chrono dur.

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Durée | illimitée (jusqu'à élimination) | fixé |
| Condition de victoire | dernier survivant (aucun seuil) | fixé |
| Nombre de factions | 6 | fixé |
| Quartiers | 992 (Paris IRIS) | fixé |
| Fin de partie | causale (victoire/défaites) | fixé |

## Cas limites

- **Attente passive** : ne rien faire ne baisse pas la difficulté de base, mais laisse les IA s'étendre → l'inaction est punie par le monde (pas par un artifice).
- **Leader trop fort** : la police monte (anti-snowball) → aucun runaway gratuit.
- **Faillite** : plus de Cash (sale et propre) pendant 300 ticks (30 s) → défaite.
- **Élimination** : 0 quartier → défaite immédiate.
- **Éliminations simultanées** : départage déterministe par quartiers, puis Membres, puis Cash (`win-conditions.md`).

## Dépendances

- `pillars.md` — R1/R3/R8.
- `territory.md` — quartiers, Influence, contrôle.
- `economy.md` — production, vente, blanchiment.
- `combat.md` — bagarres, capture.
- `tech.md`, `factions.md`, `police-ai.md`.
- `win-conditions.md`, `scoring.md`, `ui-ux.md`.

## Critères de validation

- [ ] Un run complet se décrit avec les 8 étapes, sans étape manquante.
- [ ] La boucle éco et la boucle conquête s'alimentent mutuellement (aucune n'est optionnelle).
- [ ] Toute fin de partie est causale et traçable.
- [ ] Aucun runaway : le leader subit une pression croissante.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Boucle | 8 étapes (produire→vendre→blanchir→étendre→équiper→défendre→police→gangs) |
| 2 | Équilibre | Économie ↔ conquête à égalité |
| 3 | Victoire | Dernier survivant (battle royale) |
| 4 | Durée | 20–30 min, pilotée par la causalité |
