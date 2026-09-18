# Procgen — Génération de ville et mise en place (DealerFront)

> Statut : **v1 (DealerFront)** — la ville **préexiste** avec ses bâtiments ; la génération place aussi factions, neutres et zones.

## Objectif

Générer une **ville cohérente** (quartiers + bâtiments) sur laquelle le joueur **transforme/rachète** des bâtiments, puis **mettre en place** la partie : spawns des factions, quartiers neutres, garnisons, profils de difficulté lisibles.

## Règles

### La ville préexiste

- Grille **16×16 modules** (6×6 tuiles) = **256 quartiers**. Chaque quartier a un **type de zone** (résidentiel, commercial, nightlife, industriel, parc, police, façade, terrain vague) et des **bâtiments** générés (appartements, commerces, entrepôts…).
- Les **bâtiments existants** sont des **cibles de conversion** (`economy.md`) : appartements → **Labos**, commerces → **Points de vente/Façades**, entrepôts → **Dépôts**, etc.
- Contraintes : connectivité par les rues, densité aérée (~30–36 % d'espaces ouverts), au moins un axe structurant, landmarks (poste de police, façades).

### Mise en place de la partie

1. **Spawns de factions** : 4–6 positions espacées (**distance minimale**), chacune avec **1–2 quartiers** + Influence initiale + immunité de spawn.
2. **Quartiers neutres** : le reste de la ville, avec **garnisons** (les neutres ne tombent pas gratuitement, cf. `territory.md`).
3. **Postes de police** : présents dès la génération ; ils alimentent la **Pression** anti-leader (`police-ai.md`).
4. **Profils de ville** (archétypes) : night-life (riche, dense, policé), résidentiel (calme), industriel (production), portuaire (logistique/douane). Chaque profil module : profit, densité, densité policière, camouflage.

### Difficulté lisible

- La difficulté de base = **nombre/étalement des postes de police**, **densité du neutre**, **richesse des quartiers**, **agressivité des IA** (`factions.md`).
- Elle est **visible** à l'écran (postes, patrouilles, factions) — jamais un chiffre caché.
- **Fourchette de budget** opportunité/danger conservée (adaptée : opportunité = profit/façades ; danger = police + proximité IA).

### Validation

- Validation automatique par **agents autonomes** (`factions.md`) : une partie doit être **jouable** (le seuil de contrôle/blanchiment atteignable) et **non triviale**.

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Grille | 16×16 = 256 quartiers (6×6) | fixé |
| Factions | 4–6 | fixé |
| Distance min entre spawns | ~5 quartiers | à équilibrer |
| Quartiers de départ / faction | 1–2 | à équilibrer |
| Garnison neutre | ~2 000 Influence | à équilibrer |
| Densité ouverte | 30–36 % | fixé |
| Fourchette opportunité/danger | **TBD** (adaptée) | TBD |
| Postes de police par profil | à définir par archétype | TBD |

## Cas limites

- **Spawn sans place** : relâchement progressif de la distance min, puis repli.
- **Quartier de spawn sans accès au neutre** : garantir une frontière ouverte.
- **Ville sans façade** : en garantir au moins N (sinon blanchiment impossible) — contrainte dure.
- **Déterminisme** : même seed → mêmes quartiers, bâtiments, spawns, neutres.

## Dépendances

- `pillars.md` — R3/R4.
- `territory.md` — quartiers, spawns, neutres.
- `economy.md` — bâtiments et conversions.
- `factions.md` — spawns IA, validation par agents.
- `police-ai.md` — postes et pression.
- `difficulty.md` — fourchette opportunité/danger.
- `city-sim.md` — types de zones, densité.
- `tech-stack.md` — déterminisme.

## Critères de validation

- [ ] Toute ville générée garantit un chemin neutre ↔ façades ↔ zones de profit.
- [ ] Les 4–6 factions ont des spawns espacés et une frontière ouverte.
- [ ] Les bâtiments convertibles sont présents et variés.
- [ ] Même seed → même ville (reproductible).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Ville | préexiste avec bâtiments (conversion) |
| 2 | Spawns | 4–6 factions espacées, 1–2 quartiers, immunité |
| 3 | Neutres | garnisons, non gratuits |
| 4 | Difficulté | lisible (postes/densité/richesse), fourchette O/D conservée |
| 5 | Validation | agents autonomes |
