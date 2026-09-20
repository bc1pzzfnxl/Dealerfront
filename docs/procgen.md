# Carte & mise en place (DealerFront)

> Statut : **v2** — la carte est une **vraie ville** (Paris, quartiers IRIS). La génération procédurale de grille est **abandonnée**.

## Objectif

Charger une **carte réelle** (quartiers, zones, profils) puis **mettre en place** la partie : spawns des factions, quartiers neutres, garnisons, postes de police. Le rendu et la logique s'appuient sur **mapcn / MapLibre**.

## Règles

### La carte est réelle

- **Paris IRIS** : **992 quartiers** INSEE/IGN (`src/sim/maps/paris.ts`, généré par `scripts/build-paris-map.ts`).
- Chaque quartier porte : une **zone** (déduite du type IRIS), un **profil** de marché (`demand`, `wealth`) et la liste de ses **voisins** (arêtes partagées, pas les coins).
- Les zones servent de **bâti convertible** (`economy.md`) : les quartiers acceptent certains bâtiments selon leur zone.
- **Fond muet** : la couleur ne porte que l'information de faction (pas de fond de carte décoratif).

### Mise en place de la partie

1. **Spawns de factions** : 4 positions espacées (échantillonnage glouton sur les quartiers bâtis).
2. **Quartiers neutres** : le reste de la ville, avec **garnisons** (les neutres ne tombent pas gratuitement, cf. `territory.md`).
3. **Postes de police** : les zones IRIS de type « police » alimentent la **surveillance locale** et la **Pression** anti-leader (`police-ai.md`).

### Difficulté lisible

- La difficulté dépend du **nombre/étalement des postes de police**, de la **densité**, de la **richesse** (par arrondissement) et de l'**agressivité des IA** (`factions.md`).
- Elle est **visible** à l'écran (postes, heat, factions) — jamais un chiffre caché.

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Carte | Paris IRIS — 992 quartiers réels | fixé |
| Factions | 4 | fixé |
| Spawns | 4 quartiers bâtis les plus éloignés | fixé |
| Garnison neutre | 60 Contrôle | fixé |
| Profils de marché | `demand`/`wealth` par quartier, moyenne 1,0 | fixé |
| Cellule de surveillance | zone police + ses voisines | fixé |

## Cas limites

- **Quartier isolé** (sans voisin) : impossible sur Paris (adjacence vérifiée : aucun quartier isolé).
- **Ville sans façade** : les zones commerciales/activités assurent des façades — contrainte dure.
- **Déterminisme** : le fichier de carte est **généré une fois** et versionné — même build ⇒ même carte.

## Dépendances

- `pillars.md` — R3/R4.
- `territory.md` — quartiers, spawns, neutres.
- `economy.md` — bâtiments, profils de marché, conversions.
- `factions.md` — spawns IA.
- `police-ai.md` — postes et heat local.
- `tech-stack.md` — mapcn / MapLibre, déterminisme.

## Critères de validation

- [x] Chaque quartier a une zone valide et au moins un voisin.
- [x] Les 6 factions ont des spawns espacés et une frontière ouverte.
- [x] Les bâtiments convertibles sont présents et variés.
- [x] Carte reproductible (fichier généré, versionné).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Carte | Paris IRIS (992 quartiers réels), fond muet, mapcn/MapLibre |
| 2 | Spawns | 6 factions espacées (échantillonnage glouton), 1 quartier |
| 3 | Neutres | garnisons, non gratuits |
| 4 | Difficulté | lisible (postes/densité/richesse) |
| 5 | Rendu | **mapcn** (`Map`/`MapGeoJSON`/`MapArc`/`MapControls`) |
| 6 | Ancienne version | grille procédurale 16×16/24×24 + rendu 3D isométrique **supprimés** |
