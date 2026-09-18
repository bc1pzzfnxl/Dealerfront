# Combat — Bagarres de quartier, défense et tueurs

> Statut : **ébauche (v0)** — modèle « DealerFront » (God view) proposé, valeurs de départ **à équilibrer**.
> Inspiré des **idées** d'OpenFront (RTS territorial open-source, AGPL) : influence-troupe abstraite, conquête tick par tick, terrain, Planques, nuke/MIRV. **Aucun code repris.**

## Objectif

Définir le combat **territorial** de DealerFront : comment une faction dépense son **Influence** pour prendre un **quartier** (module 6×6), comment un défenseur résiste (Planques, terrain, tech), et comment un **tueur à gage** frappe un quartier à distance. Le combat n'a **pas d'unités individuelles** : c'est une lutte de **Contrôle 0–100** alimentée par un pool d'Influence.

## Règles

### Modèle d'influence abstraite

- **Quartier = module** (6×6) d'une grille 16×16 → **256 quartiers**. Chaque quartier a un **propriétaire** (faction, neutre) et un **Contrôle 0–100**.
- **Influence** = « ressource-troupe » **par faction**, stockée dans un **pool global** (pas de logistique par unité). C'est la seule monnaie de combat.
- L'Influence se propage **de quartier en quartier** en **BFS sur le graphe d'adjacence des rues** : on ne peut attaquer qu'un quartier **frontalier** à un quartier possédé (frontière = arête de rue). Hors de portée = pas d'attaque.
- Un **front** peut couvrir plusieurs quartiers frontaliers ; le paquet d'Influence engagé est **réparti** selon `borderSize` (nombre de quartiers frontaliers contestés).
- Le combat est un **processus continu à 10 Hz** (tick 100 ms) : chaque tick applique les formules ci-dessous, sans résolution instantanée.
- **Pas de hasard dans les formules** (déterminisme, `pillars.md`) : seules les décisions de l'IA et les tirages de génération sont aléatoires.

### Expansion sur un quartier neutre

Inspiré de la branche `defender === null` d'OpenFront (garnison neutre).

- Un quartier **neutre** possède une **garnison** `G_n` (Contrôle initial, ex. 30–60 selon la distance au centre de la carte — **à équilibrer**).
- On engage un **paquet d'Influence** `I_eng`. Chaque tick :
  - **Pertes attaquant** : `pertes_att = mag_zone / 5`.
  - **Vitesse de conquête** (`tickFraction`, fraction de la garnison traitée par tick) :
    `tickFraction = clamp(2000 × tileCost / I_eng, 5, 100) / (borderSize × 2)`.
  - `Cible ← Cible − tickFraction × k_c` (baisse de Contrôle ; `k_c` = constante d'échelle **à équilibrer**).
- La conquête est **plus lente** avec un petit paquet d'Influence (le clamp 5–100 borne la vitesse) : il faut masser l'Influence pour aller vite.
- **Capture** dès `Contrôle ≤ 0` (voir « Capture »). Un neutre **ne riposte pas au-delà** de ses pertes de garnison implicites.

### Attaque d'une faction

Adapté de la branche cible-joueur d'OpenFront. Soit `I_def` l'Influence défensive **effective** du propriétaire (pool engagé + garnison des quartiers adjacents), `n_q` son nombre de quartiers.

- **Défense effective par quartier** : `D_eff = I_def / n_q` (équivalent du `defender.troops / defender.numTiles`).
- **Ratio de force** : `ratio = I_def / I_eng` (équivalent de `troopRatio`).
- **Pertes défenseur / tick** : `pertes_def = D_eff × k_d` (**à équilibrer**) ; le Contrôle baisse sous la pression.
- **Pertes attaquant / tick** :
  `pertes_att = mag_zone × clamp(ratio, 0,6, 2) × (0,463 × bonus_territoire + 0,0039 × D_eff)`.
  → Attaquer une faction **numériquement supérieure** (ratio élevé) coûte cher ; attacker à armes égales (ratio ≈ 1) est le point d'équilibre.
- **Vitesse de conquête** : `tickFraction = (speedCost_zone × tileCost_zone) / borderSize`.
- **Bonus de grand territoire** : un attaquant **profond** (`depth` élevé, beaucoup de quartiers à l'arrière) est avantagé ; le défenseur l'est chez lui :
  - attaquant `depth = 0,7` · défenseur `depth = 0,3` (inspiration OpenFront, **à équilibrer**).
  - `bonus_territoire` = `depth_attaquant − depth_défenseur` borné (le « chez soi » défensif compense la masse).
- **Terminer l'attaque** : la conquête s'arrête sur **annulation du joueur**, **Influence épuisée**, ou **Contrôle ≤ 0** (capture).

### Défense

- **Planque** (`docs/economy.md`) — bâtiment de défense du quartier :
  - applique un **multiplicateur de pertes** à l'attaquant : `mag × 5` (inspiration DefensePost, **à équilibrer**) ;
  - applique un **multiplicateur de lenteur** : `tileCost × 3` (inspiration, **à équilibrer**).
- **Terrain** (type de zone du quartier) : Plaines `mag 80 / tileCost 16,5`, Hautes terres `100 / 20`, Montagne `120 / 25` (inspiration, **à équilibrer**). La Montagne est lente et meurtrière.
- **Tech Protection** (`docs/tech.md`) : multiplicateur de défense `P_tech` (réduit `pertes_def` et/ou augmente le coût attaquant) — **à équilibrer**.
- **Contre-espionnage** (`docs/economy.md`) : défense **hors combat** contre les tueurs (voir ci-dessous), n'affecte pas la bagarre de quartier.
- **Défense mutualisée** : une faction peut **pré-positionner** de l'Influence en garnison dans ses quartiers de front (augmente `D_eff` des quartiers adjacents attaqués).

### Capture

- **Seuil** : `Contrôle ≤ 0` → le quartier change de propriétaire au tick suivant.
- **Transfert** : le quartier **et ses bâtiments** passent au vainqueur (Labo, Point de vente, Façade, Planque, etc.). Les bâtiments sont **conservés** (intacts), sauf destruction par tueur (voir ci-dessous).
- **Contrôle après capture** : reset à une valeur de **consolidation** faible (ex. 25, **à équilibrer**) — le quartier fraîchement pris est **vulnérable à une contre-attaque**.
- **Butin** : le stock de Produit du quartier capturé revient au vainqueur (**à équilibrer** : 50 % ?).

### Retraite

- Le joueur (et l'IA) peut **décrocher** un front : l'Influence engagée revient au pool amputée de **25 % de pertes** (inspiration OpenFront).
- La retraite **stoppe la baisse de Contrôle** et **rend le reliquat d'Influence** immédiatement réaffectable ailleurs.
- Une retraite est **interdite pendant le tick de capture** (le sort du quartier est déjà scellé).

### Tueurs à gage

Équivalent du nuke/MIRV d'OpenFront, **à l'échelle du quartier** (pas de la carte).

- **Ciblage** : on désigne un **quartier** (pas une tuile exacte) à portée de renseignement. La **portée de ciblage** est de **150** (inspiration MIRV, **à équilibrer**) et le **temps de trajet** dépend d'une **vitesse de 22** (inspiration, **à équilibrer**) → matérialise un **délai de frappe** visible (le défenseur peut réagir).
- **Coût** : en Cash propre (`docs/economy.md`) et/ou Influence (**à équilibrer**), payé au lancement.
- **Dégâts de zone** : le quartier visé subit des dégâts **inner** (centre) et les quartiers **adjacents** des dégâts **outer** (périphérie) :
  - **Tueur simple** (ex-« Atom ») : inner **12** / outer **30** (inspiration).
  - **Tueur lourd** (ex-« Hydrogène ») : inner **80** / outer **100** (inspiration).
  - **Salve multiple** (ex-« MIRV ») : 3+ têtes, inner **12** / outer **18** (inspiration).
- Les dégâts **baissent le Contrôle** des quartiers touchés (dans l'échelle 0–100, **à équilibrer**) et peuvent **détruire les bâtiments** du quartier central (probabilité ou seuil de dégâts, **à équilibrer**).
- **Cooldown** : `~5 min` par faction (**à équilibrer**), pour éviter le spam.
- **Contre-espionnage** : un bâtiment Contre-espionnage dans le quartier visé (ou adjacent) peut **réduire les dégâts de 30–50 %** ou **intercepter le tueur** (probabilité **à équilibrer**). Il peut aussi **masquer** le propriétaire réel d'un quartier (fausse cible).
- **Causalité** : la frappe est **toujours visible** (alerte diégétique, `ui-ux.md`) et **traçable** ; le récap de fin indique qui a tué qui (`docs/scoring.md`).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Quartiers | **256** (modules 6×6, grille 16×16) | fixé |
| Factions | **4–6** (joueur + IA) | fixé |
| Tick de simulation | **100 ms** (10 Hz) | fixé |
| Contrôle | 0–100 | fixé |
| Influence de départ par faction | ~1 000 | à équilibrer |
| `attackAmount` (dépense) — joueur | `I_pool / 5` | inspiration (à équilibrer) |
| `attackAmount` (dépense) — IA | `I_pool / 20` | inspiration (à équilibrer) |
| Garnison neutre `G_n` | 30–60 (selon distance au centre) | à équilibrer |
| Terrain `mag` / `tileCost` | Plaines **80 / 16,5** · Hautes terres **100 / 20** · Montagne **120 / 25** | inspiration (à équilibrer) |
| Planque — multiplicateur pertes | `mag × 5` | inspiration (à équilibrer) |
| Planque — multiplicateur lenteur | `tileCost × 3` | inspiration (à équilibrer) |
| Fallout | `×5 → ×3` | inspiration (TBD) |
| Neutre — pertes attaquant / tick | `mag / 5` | inspiration |
| Neutre — `tickFraction` | `clamp(2000 × tileCost / I_eng, 5, 100) / (borderSize × 2)` | inspiration |
| Faction — défense par quartier `D_eff` | `I_def / n_q` | inspiration |
| Faction — ratio de force `ratio` | `I_def / I_eng` | inspiration |
| Faction — pertes attaquant / tick | `mag × clamp(ratio, 0,6, 2) × (0,463 × bonus + 0,0039 × D_eff)` | inspiration |
| Faction — `tickFraction` | `(speedCost × tileCost) / borderSize` | inspiration |
| Bonus grand territoire | attaquant **0,7** · défenseur **0,3** | inspiration (à équilibrer) |
| Traître / retournement | pertes défenseur `×0,5` · vitesse `×0,8` | inspiration (à équilibrer) |
| Constantes d'échelle Contrôle `k_c`, `k_d` | à calibrer en playtest | à équilibrer |
| Retraite | **−25 %** de l'Influence engagée | fixé (inspiration) |
| Contrôle après capture (consolidation) | ~25 | à équilibrer |
| Butin de Produit à la capture | 50 % | à équilibrer |
| Tueur simple — dégâts inner / outer | **12 / 30** | inspiration (à équilibrer) |
| Tueur lourd — dégâts inner / outer | **80 / 100** | inspiration (à équilibrer) |
| Salve multiple — inner / outer | **12 / 18** ; portée **150** ; vitesse **22** | inspiration (à équilibrer) |
| Délai de frappe d'un tueur | ~30 s (visible) | à équilibrer |
| Cooldown tueur | ~5 min | à équilibrer |
| Contre-espionnage — réduction dégâts | 30–50 % | à équilibrer |
| Tech Protection `P_tech` | multiplicateur de défense | à équilibrer (`tech.md`) |
| Portée de défense d'une Planque | **30** | inspiration (à équilibrer) |
| `structureMinDist` (placement) | **15** | inspiration (`procgen.md`) |

## Cas limites

- **Attaque annulée avant capture** : le paquet d'Influence déjà dépensé est **perdu** ; seul le reliquat non engagé revient au pool. Annuler une attaque contre un neutre ne restitue **pas** les pertes déjà subies.
- **Quartier isolé / encerclé** (clusters d'OpenFront) : un quartier **sans frontière de rue** avec le reste de sa faction (poche isolée) **ne peut pas être ravitaillé** — il tombe à `D_eff` minimal et devient **capturable en un front**. Le BFS ne traverse jamais l'ennemi.
- **Tueur intercepté** : si le Contre-espionnage intercepte, le coût est **perdu**, aucun dégât n'est appliqué, et le lanceur est **révélé** (position approximative, cohérent avec `police-ai.md`).
- **Tueur sur un quartier déjà à 0** : les dégâts excédentaires ne sont **pas reportés** sur les quartiers adjacents ; ils sont perdus.
- **Double capture simultanée** : deux factions qui atteignent `Contrôle ≤ 0` sur le même quartier au même tick → le quartier va à la faction avec le **plus grand `I_eng`** ; en cas d'égalité parfaite, **statu quo** (le quartier reste à son propriétaire précédent) et les deux paquets subissent leurs pertes.
- **Traître retourné en cours d'attaque** : le multiplicateur traître s'applique **au tick suivant** ; une attaque déjà lancée n'est pas rétroactivement modifiée.
- **Influence épuisée sur un front** : le front s'arrête **sans** retraite automatique (pas de −25 %), le Contrôle cible **remonte lentement** vers sa valeur de repos tant qu'aucune pression ne s'exerce.
- **Tueur sans Contre-espionnage** : dégâts **pleins** ; les bâtiments du quartier central peuvent être **détruits** (le quartier conquis ne rapporte alors aucun bâtiment).

## Dépendances

- `docs/territory.md` — quartiers, propriété, Contrôle, adjacence des rues (BFS), frontières.
- `docs/tech.md` — Protection (`P_tech`), tueurs (déblocage, niveaux), contre-espionnage.
- `docs/economy.md` — Planque, Dépôt, Atelier, coûts en Cash propre, butin de Produit.
- `docs/factions.md` — pool d'Influence, IA (fréquence d'attaque, `attackAmount` bot), diplomatie/trahison.
- `docs/win-conditions.md` — seuil de contrôle, élimination d'une faction à 0 quartier.
- `docs/procgen.md` — terrain des quartiers, garnisons neutres, `structureMinDist`.
- `docs/scoring.md` — traçabilité des frappes et des victimes dans le récap.
- `docs/pillars.md` — déterminisme, causalité pure, pas d'omniscience.

## Critères de validation

- [ ] Aucune conquête n'est instantanée : tout passe par une baisse de Contrôle tick par tick, traçable.
- [ ] L'Influence ne circule que par l'adjacence des rues (BFS) — un quartier non frontalier est inattaquable.
- [ ] Attaquer plus fort que soi coûte proportionnellement plus cher (ratio borné 0,6–2 vérifié en simulation).
- [ ] Une Planque change **visiblement** l'issue d'une attaque à budget d'Influence égal.
- [ ] La retraite rend bien **75 %** de l'Influence engagée et stoppe la baisse de Contrôle.
- [ ] Un tueur a un **délai de frappe visible** et un **cooldown** ; il n'existe pas de spam.
- [ ] Le Contre-espionnage réduit/intercepte effectivement, et une interception est **révélée** au récap.
- [ ] Aucun `Math.random()` dans les formules de combat (audit du déterminisme).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Modèle de combat | Influence abstraite (pool) → Contrôle 0–100, tick 100 ms, BFS sur rues |
| 2 | Quartier | = module 6×6 ; 256 quartiers (16×16) |
| 3 | Expansion neutre | Garnison `G_n` + pertes `mag/5` + `tickFraction` clampé |
| 4 | Attaque de faction | Formule ratio × bonus territoire + `D_eff` (adaptée d'OpenFront) |
| 5 | Défense Planque | Pertes attaquant `×5`, lenteur `×3` |
| 6 | Capture | `Contrôle ≤ 0` → transfert quartier + bâtiments, consolidation ~25 |
| 7 | Retraite | −25 % de l'Influence engagée |
| 8 | Tueurs | Ciblage d'un quartier, dégâts de zone inner/outer, délai + cooldown |
| 9 | Contre-espionnage | Réduction 30–50 % ou interception révélée |
| 10 | `attackAmount` | Joueur `I/5`, IA `I/20` |
| 11 | Double capture | Plus grand `I_eng` ; égalité = statu quo |
| 12 | Poche isolée | Non ravitaillable (BFS bloque à l'ennemi) |
| 13 | Inspiration | OpenFront (AGPL) : idées reprises, code non repris |

---

## Implémentation (P1–P4) — valeurs en vigueur

> Section **faisant foi** pour `src/sim/world.ts`. Le modèle implémenté est **Membres-based** (pas encore le pool d'Influence ni le BFS/rue décrits plus haut) ; les écarts sont listés en fin de section.

### Attaque (bagarre)

- **Engagement** : `troupes = floor(Membres × 0,20)` ; refus si `< 400` (MIN_COMMIT). Les troupes engagées sont retirées des Membres à l'émission.
- **Dégâts / tick** : `max(0,5 ; troupes × 0,001 × (1 + 0,1 × Armement) / défense)`.
- **Défense** : `ZONE_DEFENSE[zone] × (1,5 si Planque) × (1 + 0,1 × Protection)`.
- **Zones** : `résidentiel 1,0 · commercial 1,2 · nightlife 1,1 · industriel 0,8 · parc 1,4 · police 2,0 · blanchisserie 1,0 · vacant 0,5`.
- **Pertes attaquant** : `troupes −= dégâts × 6` ; attaque retirée quand épuisée ou cible capturée.
- **Contrôle** : régénère `+1,0/tick × (1 + 0,2 × Logistique)` (sauf quartiers attaqués ce tick), plafond 100.
- **Capture** : `Contrôle ≤ 0` → changement de propriétaire, Contrôle remis à **30**, **bâtiment détruit** (remis à vide).

### Adjacence & IA

- Cible attaquable = **voisin 4-connexe** (`neighborsOf`) possédé par un autre (ou neutre).
- **IA** : une décision toutes les **25 ticks** ; dans l'ordre — 40 % construire (`chooseBuildType`), 30 % monter une tech, 25 % tueur à gage, sinon attaquer la cible au **Contrôle le plus faible**.

### Écarts avec la cible (à implémenter plus tard)

- **Influence pool** → remplacée par **Membres** ; `attackAmount I/5 (joueur) / I/20 (IA)` non implémenté.
- **BFS sur les rues / poches isolées** → adjacence de grille simple ; l'anti-snowball « clusters isolés » n'est pas encore en place.
- **Retraite** (rend 75 % de l'Influence, `tickFraction` neutre) → non implémentées.
- **Capture** : la spec annonce « transfère ses bâtiments » ; le code **détruit** le bâtiment (à trancher).
