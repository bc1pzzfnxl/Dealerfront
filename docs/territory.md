# Territory — Quartiers, Membres et Contrôle

> Statut : **v1 (DealerFront)** — cœur du mode god-view, inspiré d'OpenFront (idées, pas de code ; OpenFront est AGPL-3).

## Objectif

Définir la **prise de contrôle de la ville** : qui possède quoi, comment on étend son territoire, comment on le défend, et comment il se perd. C'est le socle du mode : conquête ↔ économie. Toutes les autres specs s'y rattachent.

## Règles

### Quartier = module

- Unité de territoire = **module 6×6** de la grille **16×16** (**256 quartiers**). La ville **préexiste** (voir `procgen.md`) : les quartiers contiennent déjà des bâtiments.
- Chaque quartier a : un **propriétaire** (faction ou **neutre**) et un **Contrôle ∈ [0, 100]**.
- **Adjacence** : deux quartiers sont voisins s'ils partagent une frontière (rues). L'expansion et les attaques se propagent par adjacence (BFS).

### Membres (ressource-troupe)

- Chaque faction possède un **pool de Membres**, équivalent des « troupes » d'OpenFront.
- **Production** par tick : `(8 × quartiers possédés + 25 × logements aménagés) × (1 − membres / maxMembres)`.
- **`maxMembres = 2000 + quartiers × 1500 + logements × 2000 + dépôts × 2000`**.
- Les Membres servent à **étendre** (neutre), **attaquer** (faction) et **défendre** (renfort). Voir `combat.md`.

### Contrôle d'un quartier

- Un quartier possédé a un Contrôle qui **régénère** vers 100 (∝ Membres disponibles, ralenti par les dégâts récents).
- Une **Planque** augmente la résistance (défense) ; le type de zone module la défense (voir `combat.md`).
- À **Contrôle = 0**, le quartier est **capturé** par l'attaquant (bâtiments transférés).

### Expansion sur le neutre

- Attaquer un quartier **neutre** coûte des Membres (garnison neutre) et suit la branche « neutre » de `combat.md`.
- Les quartiers neutres peuvent être **défendus** (garnison) : ils ne tombent pas gratuitement.

### Anti-snowball — clusters isolés

- Reprise d'OpenFront : un **cluster** de quartiers possédés, **entièrement encerclé** par une seule faction ennemie (ou la police), est **perdu** (capturé par l'encercleur).
- Empêche les excroissances absurdes et récompense l'encerclement.

### Spawn et immunité

- **4–6 factions** (joueur + 3–5 IA, voir `factions.md`).
- Spawn : **distance minimale** entre factions, **1–2 quartiers** de départ + Membres initiaux, **immunité de spawn** (pas d'attaque pendant N ticks).

## Paramètres chiffrés

| Paramètre | Valeur de départ | Statut |
|---|---|---|
| Grille | 16×16 = 256 quartiers (modules 6×6) | fixé |
| Factions | 4–6 (joueur + 3–5 IA) | fixé |
| Contrôle max | 100 | fixé |
| Contrôle initial (quartier capturé) | ~30 | à équilibrer |
| `maxMembres` | `2000 + quartiers × 1500 + logements × 2000 + dépôts × 2000` | à équilibrer |
| Production de Membres | `(8 × quartiers + 25 × logements) × (1 − membres/max)` /tick | à équilibrer |
| Coût d'aménagement d'un logement | 800 membres | à équilibrer |
| Logement aménagé | +25 Membres/tick (perdu si le quartier est capturé) | à équilibrer |
| Membres de départ (faction) | 3 000 | à équilibrer |
| Garnison neutre (par quartier) | ~2 000 | à équilibrer |
| Distance min entre factions (spawn) | ~5 quartiers | à équilibrer |
| Immunité de spawn | 50 ticks (5 s) | inspiration OpenFront |
| Régénération de Contrôle | +X/tick après Y s sans dégât | TBD |

## Cas limites

- **Quartier encerclé** : cluster isolé → perdu (anti-snowball) ; tracer la cause.
- **Faction éliminée** (0 quartier) : ses bâtiments sont détruits ou transférés (à trancher → `TBD`).
- **Quartier neutre sans garnison** : expansion gratuite ? Non — garnison minimale garantie à la génération.
- **Contrôle contesté** : si deux attaques visent le même quartier le même tick, résolution déterministe (ordre stable des factions).
- **Spawn écrasé** : si aucune position valide (distance min), relâchement progressif puis repli (façon OpenFront).

## Dépendances

- `pillars.md` — R1–R4 (causalité, pas de rubber-banding).
- `combat.md` — formules d'attaque/défense, capture.
- `economy.md` — Membres, bâtiments (Dépôt, Planque).
- `factions.md` — IA, diplomatie, clusters.
- `police-ai.md` — la police comme faction adverse.
- `win-conditions.md` — seuil de contrôle.
- `procgen.md` — ville préexistante, spawns, neutres.

## Critères de validation

- [ ] Une faction peut étendre son territoire sur le neutre et sur une faction ennemie.
- [ ] Le Contrôle régénère, monte et tombe de façon traçable (audit causal).
- [ ] Un quartier capturé transfère ses bâtiments.
- [ ] Un cluster isolé est bien perdu par son propriétaire.
- [ ] Le déterminisme est respecté (même seed → mêmes quartiers/spawns).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Unité de territoire | Module 6×6 (256 quartiers) |
| 2 | Modèle | Propriétaire + Contrôle 0–100 + pool de Membres |
| 3 | Expansion | Par adjacence (BFS), coût en Membres |
| 4 | Anti-snowball | Clusters isolés perdus (façon OpenFront) |
| 5 | Factions | 4–6, spawn espacé, immunité 50 ticks |
