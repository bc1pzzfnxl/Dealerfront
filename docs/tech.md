# Tech — Évolution du matos

> Statut : **v1 (DealerFront)** — arbre de tech du cartel, 3 branches × 5 paliers.
> S'inscrit dans le mode god view (4–6 factions, 256 quartiers, session 20–30 min).

## Objectif

Donner au cartel une **montée en puissance lisible et optionnelle** : convertir le Cash propre accumulé (`economy.md`) en avantages **militaires** (Armement), **défensifs** (Protection) et **logistiques** (Logistique). La tech doit créer des **choix exclusifs dans le temps** (où investir l'Atelier et l'argent) et se répercuter **directement** dans les formules de combat (`combat.md`).

## Règles

### 1. Prérequis — l'Atelier

- **Une faction n'a aucune tech sans Atelier.** L'**Atelier** (`economy.md`) est le bâtiment qui **débloque** et **monte** les paliers.
- Chaque Atelier fournit **1 canal de recherche** : on ne progresse que d'**un palier à la fois et par canal**. Plusieurs Ateliers permettent de paralléliser des branches différentes (ou d'accélérer, à équilibrer).
- La tech est **globale à la faction** (pas par quartier) une fois débloquée. Elle est perdue si **tous les Ateliers** sont détruits (retour aux paliers acquis ? → non : les paliers acquis sont conservés, seul le *progrès en cours* est perdu ; à confirmer en playtest).
- Rechercher un palier **occupe** un Atelier pendant sa durée : la tech **concurrence la production** si l'Atelier servait aussi de bâtiment économique (voir `economy.md`).

### 2. Les 3 branches

| Branche | Domaine | Effet principal |
|---|---|---|
| **Armement** | Puissance d'attaque | Multiplie les dégâts d'assaut sur les quartiers ; débloque le **Tueur à gage** |
| **Protection** | Défense des quartiers | Multiplie la défense des quartiers ; active le **Contre-espionnage** |
| **Logistique** | Vitesse d'expansion/convois | Accélère les déplacements d'Influence, la conquête et les convois |

### 3. Paliers et effets

Chaque branche a **5 paliers** (P0 = base, P1→P4 recherchables). Effets **multiplicatifs** sur les formules de `combat.md`.

**Armement** — puissance d'attaque (TBD / à équilibrer) :

| Palier | Multiplicateur d'attaque | Déblocage |
|---|---|---|
| P0 | ×1,00 | — |
| P1 | ×1,20 | — |
| P2 | ×1,45 | — |
| P3 | ×1,75 | **Tueur à gage** |
| P4 | ×2,10 | — |

**Protection** — défense des quartiers (à équilibrer) :

| Palier | Multiplicateur de défense | Déblocage |
|---|---|---|
| P0 | ×1,00 | — |
| P1 | ×1,15 | — |
| P2 | ×1,35 | — |
| P3 | ×1,60 | **Contre-espionnage actif** |
| P4 | ×1,90 | — |

**Logistique** — vitesse d'expansion/convois (à équilibrer) :

| Palier | Multiplicateur de vitesse/logistique | Déblocage |
|---|---|---|
| P0 | ×1,00 | — |
| P1 | ×1,15 | — |
| P2 | ×1,35 | Convois d'Influence accélérés |
| P3 | ×1,55 | — |
| P4 | ×1,80 | — |

### 4. Déblocages clés

- **Tueur à gage** (Armement P3) : action ciblée d'**assassinat**, **dégâts de zone** — élimine un agent/leader ennemi et inflige des dégâts autour de la cible. Coût en Cash propre + Influence, cooldown long. Détails en `combat.md` et `factions.md`.
- **Contre-espionnage actif** (Protection P3) : amplifie le bâtiment Contre-espionnage (`economy.md`) ; sa réduction d'efficacité des tueurs/agents ennemis passe de **−40 %** (base) à **−70 %** (à équilibrer), et son rayon s'étend.

### 5. Coûts et durée de recherche

Barème **croissant**, payé en **Cash sale** puis **Cash propre** pour les hauts paliers (à équilibrer) :

| Palier | Coût | Devise | Durée de recherche |
|---|---|---|---|
| P1 | 10 000 | Cash sale | 60 ticks (6 s) |
| P2 | 25 000 | Cash sale | 120 ticks (12 s) |
| P3 | 50 000 | Cash propre | 300 ticks (30 s) |
| P4 | 120 000 | Cash propre | 600 ticks (60 s) |

- Le **coût est par branche et par palier** : investir dans une branche n'affecte pas le prix des autres, mais un palier **N+1** exige le palier **N** de la même branche.
- Les paliers **P3 et P4** exigent du **Cash propre** : la tech haut de gamme **concurrence directement le seuil de victoire** (`win-conditions.md`) — arbitrage central.

### 6. Lien avec le combat (`combat.md`)

- `combat.md` définit les formules d'assaut et de défense ; la tech les **multiplie** au moment du calcul :
  - Attaque effective = `attaque_base × M_Armement`.
  - Défense effective = `défense_base × M_Protection × bonus_Planque`.
  - Vitesse de conquête / transfert d'Influence = `vitesse_base × M_Logistique`.
- La tech **ne contourne jamais** les règles de combat : elle change les **coefficients**, pas les **conditions de victoire locales** ni la causalité.
- **Tueur à gage** introduit une action **hors ligne de front** (assassinat ciblé) qui doit être résolue par `combat.md` (portée, cooldown, dégâts de zone, contre-mesures).

## Paramètres chiffrés

| Paramètre | Valeur de départ | Statut |
|---|---|---|
| Branches | 3 : Armement, Protection, Logistique | fixé |
| Paliers / branche | 5 (P0 base + P1–P4) | fixé |
| Multiplicateurs Armement | ×1,00 / 1,20 / 1,45 / 1,75 / 2,10 | à équilibrer |
| Multiplicateurs Protection | ×1,00 / 1,15 / 1,35 / 1,60 / 1,90 | à équilibrer |
| Multiplicateurs Logistique | ×1,00 / 1,15 / 1,35 / 1,55 / 1,80 | à équilibrer |
| Coûts P1–P4 | 10k / 25k / 50k / 120k | à équilibrer |
| Devises | P1–P2 Cash sale, P3–P4 Cash propre | à équilibrer |
| Durées de recherche | 60 / 120 / 300 / 600 ticks | à équilibrer |
| Canaux par Atelier | 1 | fixé |
| Perte de progrès en cours | oui si tous les Ateliers détruits | à équilibrer |
| Paliers acquis après perte des Ateliers | conservés | fixé |
| Tueur à gage | Armement P3 | fixé (valeurs TBD) |
| Coût / cooldown Tueur à gage | **TBD** | TBD |
| Contre-espionnage base | −40 % | fixé |
| Contre-espionnage actif (Protection P3) | −70 %, rayon élargi | à équilibrer |
| Recherche parallèle multi-Ateliers | autorisée (1 canal/Atelier) | à équilibrer |

## Cas limites

- **Aucun Atelier** : aucune recherche possible ; toute tech débloquée reste active. Détruire les Ateliers ne **retire pas** les paliers acquis, mais **stoppe** le progrès en cours.
- **Atelier détruit pendant une recherche** : la recherche en cours est **perdue**, le coût déjà payé est **perdu** (pas de remboursement), la file reprend au palier suivant non acquis.
- **Ateliers multiples** : peuvent paralléliser plusieurs branches ; un même palier ne peut pas être recherché en double (pas de « stock » de tech).
- **Revente/reconquête d'un Atelier** : un Atelier ennemi capturé redevient fonctionnel pour le conquérant ; la tech ennemie n'est **jamais** volée (pas d'espionnage de tech au MVP).
- **Tueur à gage sans cible** : l'action est annulée et le coût non consommé (ou partiellement remboursé, à trancher) ; pas de dégâts « dans le vide ».
- **Déséquilibre de branche** : un investissement massif en Armement doit rester **contrable** par Protection + Planques ; si une branche domine, ajuster les multiplicateurs (levier principal) avant les coûts.
- **Tech vs victoire** : un joueur qui sur-investit en P3/P4 peut ne plus atteindre le seuil de Cash propre dans le temps imparti — arbitrage voulu, à surveiller en playtest.

## Dépendances

- `economy.md` — Atelier (prérequis), Contre-espionnage (base), coûts en Cash sale/propre.
- `combat.md` — formules d'attaque/défense modifiées par les multiplicateurs ; résolution du Tueur à gage.
- `territory.md` — portée de la Logistique (expansion, convois, transferts d'Influence).
- `win-conditions.md` — concurrence entre tech P3/P4 et seuil de Cash propre.
- `factions.md` — cibles du Tueur à gage et agents ennemis affectés par le Contre-espionnage.
- `scoring.md` — traçabilité des investissements tech dans le récap causal.

## Critères de validation

- [ ] Aucune branche ne peut être montée sans Atelier (prérequis dur vérifié).
- [ ] Les paliers sont **cumulatifs** (impossible d'acheter P3 sans P2).
- [ ] Chaque multiplicateur de tech est **visible dans un calcul de combat** testable (`combat.md`).
- [ ] Un joueur qui investit tout dans une seule branche reste **contré** par une combinaison des deux autres + Planques.
- [ ] Le Tueur à gage ne peut pas cibler une faction alliée/neutre ni infliger de dégâts sans cible valide.
- [ ] La destruction de tous les Ateliers ne provoque ni soft-lock ni perte des paliers acquis.
- [ ] L'arbitrage tech ↔ seuil de victoire est mesurable en playtest (sur-investissement punitif, pas suicidaire).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Prérequis | Atelier obligatoire pour débloquer/monter la tech |
| 2 | Structure | 3 branches × 5 paliers (P0 base + P1–P4) |
| 3 | Branches | Armement (attaque), Protection (défense), Logistique (expansion/convois) |
| 4 | Multiplicateurs | Armement 1,20→2,10 · Protection 1,15→1,90 · Logistique 1,15→1,80 |
| 5 | Coûts | Croissants 10k/25k/50k/120k, Cash sale puis Cash propre |
| 6 | Déblocage Tueur à gage | Armement P3 (assassinat ciblé, dégâts de zone) |
| 7 | Contre-espionnage actif | Protection P3, −40 % → −70 % |
| 8 | Canaux de recherche | 1 par Atelier, parallélisation multi-Ateliers autorisée |
| 9 | Perte de progrès | Progrès en cours perdu si tous les Ateliers détruits ; paliers acquis conservés |
| 10 | Lien combat | La tech multiplie les formules de `combat.md`, sans en changer les conditions |

---

## Implémentation (P4) — valeurs en vigueur

> Section **faisant foi** pour le code (`src/sim/tech.ts`, `src/sim/world.ts`). À équilibrer.

- **Capacité de tech** : `niveau_max = nombre d'Ateliers` (plafonné à **5**). Il faut donc N Ateliers pour atteindre le palier N.
- **Coût** d'un palier (en **Cash propre**) : `2000 × niveau_visé` (2 000, 4 000, 6 000, 8 000, 10 000).

| Branche | Effet par palier | Au max (5) |
|---|---|---|
| **Armement** | +10 % dégâts d'attaque | +50 % |
| **Protection** | +10 % défense des quartiers | +50 % |
| **Logistique** | +20 % production de Membres **et** +20 % régénération de Contrôle | +100 % |

### Tueur à gage

- **Prérequis** : **Armement ≥ 2**.
- **Coût** : 3 000 Cash propre + 1 000 Membres · **cooldown 100 ticks (10 s)**.
- **Effet** : −40 Contrôle sur le quartier visé, −20 sur les quartiers adjacents ; **détruit les bâtiments** touchés.
- **Ne capture pas** (Contrôle plancher à 5) : il affaiblit, la conquête se fait ensuite par bagarre.
- **Contre-espionnage** : réduit les dégâts de **15 % par unité** (plafond **60 %**).


### P20 — Armement, Descente, Sabotage

- **Armement** : +10 % dégâts **et** le **plafond de dégâts par tick suit l'Armement** (`5 × (1 + 0,1 × niveau)`) — sans ça la tech était inutile au-delà du cap.
- **Descente** (Armement ≥ 1) : 2 000 Cash sale + 600 Membres, recharge 25 s → **vole le butin** d'un bâtiment adjacent **sans le détruire ni capturer**. Un **Guetteur** adverse réduit le butin de moitié.
- **Sabotage** (Armement ≥ 2) : 1 500 Cash sale, recharge 25 s → **production du bâtiment ÷ 2 pendant 30 s**. **Bloqué** par un Guetteur.
- **Guetteur** (ex-Contre-espionnage, 2 000 Cash propre) : **alerte** les descentes (rayon 1), **−15 % tueur**, **gêne descentes et sabotages**.
