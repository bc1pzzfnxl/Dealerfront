# Economy — Ressources, bâtiments et blanchiment

> Statut : **v1 (DealerFront)** — modèle cartel (god view), boucle économie ↔ conquête.
> Inspiré mécaniquement d'**OpenFront** (RTS territorial open-source) ; les valeurs OpenFront citées servent de référence d'échelle, pas de copie.

## Objectif

Définir la **boucle économique du cartel** : produire du **Produit** dans les quartiers possédés, le vendre contre du **Cash sale**, le blanchir en **Cash propre**, et convertir ces flux en **Membres** (ressource-troupe) et en **bâtiments** qui étendent le territoire. L'économie doit rester **équilibrée avec la conquête** : ni un jeu de construction passif, ni un pur jeu de conquête sans arrière-plan logistique.

## Règles

### 1. Les 4 ressources et leurs flux

| Ressource | Nature | Gagnée par | Dépensée par |
|---|---|---|---|
| **Produit** | Ressource abstraite (pas d'inventaire par unité) | **Labos** (production/tick) | **Points de vente** (conversion) |
| **Cash sale** | Monnaie non blanchie | **Points de vente** (Produit → Cash sale) | Bâtiments, conversions, paliers de tech |
| **Cash propre** | Monnaie blanchied, compte au score | **Façades** (Cash sale → Cash propre, commission) | Tech haut de gamme, services stratégiques, objectif de victoire |
| **Membres** | Ressource-troupe (pool de faction) | **Recrutement aménagé** + quartiers possédés | Conquête/défense de quartiers |

Chaîne principale :

```
Labo ──Produit──> Point de vente ──Cash sale──> Façade ──Cash propre──> tech / score / victoire
                                          │
                          bâtiments & conversions (Cash sale)
```

L'**Membres** est une ressource **séparée** : elle ne s'achète pas avec du cash (sauf tech/services), elle se régénère avec la taille du territoire. C'est le carburant de la **conquête** (`territory.md`, `combat.md`).

### 2. Modèle de quartier et bâtiments

- La carte est une **vraie ville** (Paris IRIS, **992 quartiers**) ; chaque quartier a un **propriétaire**, un **Contrôle 0–100** et un **profil** de marché (`territory.md`, `procgen.md`).
- La ville **préexiste** : le joueur **ne pose pas dans le vide** : il **convertit/rachète** le bâti existant d'un quartier possédé, selon la **zone** du quartier (voir § 4).
- Un quartier possédé accueille **un** bâtiment fonctionnel parmi les 8.

### 3. Les 7 bâtiments

Valeurs **de départ proposées (« à équilibrer »)** ; durée exprimée en **ticks à 10 Hz (tick = 100 ms)**.

| Bâtiment | Rôle | Effet chiffré (départ) | Coût (départ) | Durée | Prérequis |
|---|---|---|---|---|---|
| **Labo** | Production de Produit | +1,5 Produit/tick par Labo | 12 500 Cash sale (×2 par Labo existant, cap 1 M) | 20 ticks (2 s) | Quartier possédé, zone compatible |
| **Point de vente** | Produit → Cash sale | Convertit jusqu'à 2 Produit/tick ; prix 1 Produit = 60 × richesse locale | 12 500 Cash sale (×2 par PdV existant, cap 1 M) | 20 ticks (2 s) | Idem |
| **Façade** | Cash sale → Cash propre | Blanchit 60 × richesse locale/tick ; commission **20 %** | 12 500 Cash sale (×2 par Façade existante, cap 1 M) | 50 ticks (5 s) | Idem |
| **Planque** | Défense du quartier | Défense du quartier **×5** (inspiré DefensePost OpenFront, portée locale) | `min(250 000, (n+1) × 5 000)` Cash sale | 50 ticks (5 s) | Idem |
| **Atelier** | Débloque/monte la tech | Ouvre les 3 branches (`tech.md`) ; 1 canal de recherche par Atelier | 50 000 Cash propre | 50 ticks (5 s) | Quartier possédé, zone industrielle |
| **Contre-espionnage** | Réduit tueurs/agents ennemis | −40 % d'efficacité des tueurs/agents ennemis dans un rayon de 3 quartiers | 75 000 Cash propre | 100 ticks (10 s) | Idem |
| **Recrutement** | Production de Membres | +25 Membres/tick (immeuble récupéré) | 800 Membres | immédiat | Aménager un appartement/immeuble existant |

**Interactions :**
- Un **Point de vente** **tourne toujours** : il vend d'abord le **Produit maison** (marge pleine), puis s'**approvisionne à l'extérieur** pour le complément (marge réduite, `EXTERNAL_SUPPLY_MARGIN = 0,6`). Être **relié à un Labo** par un chemin de quartiers possédés porte la capacité à 100 % (sinon 35 %) — la logistique **bonifie**, elle ne **bloque** plus. Un **Labo** sans Point de vente accumule du Produit plafonné.
- Les **Façades** sont le **seul** débouché vers le Cash propre ; leur commission de 20 % est la friction économique centrale.
- **Planques** et **Contre-espionnage** sont des bâtiments défensifs : ils ne produisent rien, ils protègent le rendement.
- L'**Atelier** est le **prérequis global** de la tech : sans lui, aucun palier n'est recherchable.
- Les **Dépôts** amplifient la régénération de Membres, donc la capacité de conquête : ils sont le pont économie → militaire.

### 4. Conversion de bâtiments existants

La ville générée contient des bâtiments « neutres » (appartements, commerces, entrepôts, usines). Le joueur les **transforme** en bâtiments fonctionnels.

| Cible | Bâtiment source compatible | Coût de conversion | Durée |
|---|---|---|---|
| Labo | Appartement, entrepôt | 50 % du coût Labo | 50 % de la durée Labo |
| Point de vente | Commerce, night-life | 50 % du coût PdV | 50 % de la durée PdV |
| Façade | Commerce, bar, laverie | 50 % du coût Façade | 50 % de la durée Façade |
| Planque | Appartement, entrepôt | 50 % du coût Planque | 50 % de la durée Planque |
| Atelier | Usine, entrepôt | 50 % du coût Atelier | 50 % de la durée Atelier |
| Contre-espionnage | Bureaux, résidentiel mixte | 50 % du coût CE | 50 % de la durée CE |
| Dépôt | Entrepôt, zone portuaire | 50 % du coût Dépôt | 50 % de la durée Dépôt |

**Contraintes :**
- Le quartier doit être **possédé** par la faction (Contrôle ≥ seuil de possession, `territory.md`).
- **Zonage = incitation, pas blocage** : la **chaîne économique** (Logement, Labo, Point de vente, Façade, Planque) est constructible dans **toutes** les zones ; seuls les bâtiments **spécialisés** (Dépôt, Atelier, Guetteur) restent réservés (Dépôt/Atelier → industriel ou terrain vague ; Atelier aussi en commercial ; Guetteur → pas en terrain vague). Le rendement est modulé par le **bonus de zone** (voir §5bis).
- **Recrutement** exige un **immeuble existant** (zone bâtie) : impossible sur terrain vague ou dans un parc.
- Un bâtiment converti **remplace** la fonction d'origine (ex. appartements → Labos consomme la population du quartier, effet secondaire à équilibrer avec `city-sim.md`).
- La conversion **réutilise** l'emprise : elle coûte et dure **moins cher** qu'une construction neuve, mais reste soumise au **coût croissant** par nombre de bâtiments du même type.
- **Bonus de zone** : un bâtiment produit **plus** dans une zone faite pour lui (`ZONE_BUILD_BONUS`, multiplicateur appliqué à la capacité de production/vente/blanchiment, jamais au coût). Spécialise le territoire : bâtir « n'importe où » n'est plus optimal.

| Zone | Bâtiment bonifié | Multiplicateur |
|---|---|---|
| résidentiel | Logement (recrutement) | ×1,50 (planque ×1,15) |
| commercial | Point de vente | ×1,50 (façade ×1,15) |
| nightlife | Point de vente + Façade | ×1,30 |
| industriel | Labo ×1,50 · Atelier ×1,40 · Dépôt ×1,30 | — |
| laverie | Façade (blanchiment) | ×1,60 |
| police | Contre-espionnage | ×1,60 |
| parc | Planque (défense) | ×1,50 |
| terrain vague | aucun (construction neuve) | ×1,00 |

### 5bis. Cycle jour/nuit & heures de pointe

- **Horloge in-game** : `TICKS_PER_HOUR = 120` (12 s réelles à 10 Hz) → un jour = 4,8 min ; départ à 8 h.
- Chaque zone a une **heure de pointe** pour son bâtiment phare. Le rendement suit
  `facteur(h) = 1 + amplitude × cos(2π (h − pic) / 24)` — maximum au pic, minimum 12 h plus tard, **moyenne 1 sur la journée** (équilibre global préservé).

| Zone | Bâtiment | Heure de pointe | Amplitude |
|---|---|---|---|
| commercial | Point de vente | 13 h | ±0,40 |
| nightlife | Point de vente | 23 h | ±0,50 |
| résidentiel | Logement | 19 h | ±0,30 |
| industriel | Labo | 2 h | ±0,20 |
| laverie | Façade | 11 h | ±0,15 |

- **Effet** : un point de vente en nightlife vend ~1,5× à 23 h et ~0,5× à 11 h. Rythme les ventes et invite à planifier (vendre en pointe, attaquer en creux).
- **UI** : horloge `Jour/Nuit HH:MM`, et pour le quartier sélectionné une pastille « Pointe ×1,40 » / « Creux ×0,60 ».

### 5. Rendements et formules

- **Production de Produit** : `2 Produit/tick × N_labos` (à équilibrer).
- **Conversion Produit → Cash sale** : `1 Produit = 15 Cash sale`, plafonnée par `min(Produit_disponible ; 2 × N_pdv)` Produit/tick (à équilibrer).
- **Blanchiment** : `Cash propre = Cash sale × (1 − 0,20)`, plafonné par `30 × N_façades` Cash sale/tick ; la commission de **20 %** est **fixée** (voir `scoring.md`).
- **Membres max** (inspiré OpenFront `maxTroops`) :
  `Membres_max = 2 × (quartiers_possédés^0.6 × 1 000 + 50 000) + dépôts × 250 000` (à équilibrer).
- **Régénération de Membres/tick** (inspiré OpenFront) :
  `régén = (10 + Membres^0.73 / 4) × (1 − Membres / Membres_max) + dépôts × 5` (à équilibrer).
- **Chantiers directs** : plus de **file d'attente**. Un build démarre immédiatement s'il reste une **équipe** (2 max) et est refusé sinon (« équipes occupées »). Le lot (`Aménager`) lance directement ce que les équipes permettent.
- **Coût croissant** des bâtiments (inspiré OpenFront City/Factory/Port) : `coût(n) = coût_base × 1,35^n` où `n` = nombre de bâtiments **du même type** déjà possédés (conversion = ×0,5). Le coût est calculé par faction et par type ; un lot tient compte des bâtiments déjà prévus. Force la **diversification** plutôt que le spam d'un seul type.

### 5ter. L'argent est roi de la guerre (puits stratégiques)

Le Cash **sale** et **propre** ne sont pas que des scores : ils **achètent la guerre**.

- **Soldes des guetteurs** (`GUARD_UPKEEP = 1,5` sale/tick par Guetteur) : le renseignement se paie. Guetteurs **impayés = aveugles** (plus d'alerte de descente, plus de contre-sabotage, plus de réduction de tueur). Un cartel pauvre est sourd.
- **Trésorerie d'armement** (`ARMAMENT`) : acheter de l'armement en **Cash propre** donne `+20 %` d'attaque pendant **40 s**, cumulable jusqu'à **×6**, coût **croissant** (`3000 × 1,5^n`) — puits permanent. On investit avant une offensive : l'argent décide du tempo militaire.
- **Entretien** (`BUILDING_UPKEEP`) : chaque bâtiment coûte du **Cash sale/tick** (Logement 0,5 ; Labo/Vente/Planque/Dépôt 1 ; Façade/Guetteur 1,5 ; Atelier 2). S'il n'est pas couvert, `upkeepPaid = false` → **production ×0,5** (`UNPAID_UPKEEP_FACTOR`) et **guetteurs aveugles**. Les gros empires coûtent cher à faire tourner.
- **Mercenaires** (`MERC`) : **Cash sale → Membres** immédiats (`+400`), coût croissant (`4000 × 1,4^n`), plafonné par le cap de Membres. *(Dérogation au pilier « les Membres ne s'achètent pas » : c'est un levier de guerre, borné par le cap.)*
- **Contrat** (`CONTRACT`) : **Cash propre** → payer un gang pour qu'il **attaque le leader** pendant 60 s. Coût croissant (`6000 × 1,5^n`).
- **Rachat de quartier** (`BUY`) : convertir du **Cash propre** en **territoire** sans combattre. Cible = quartier **neutre adjacent**. Coût `4000 × taille × (1 + 0,15 × quartiers possédés)`, recharge 10 s, contrôle établi 25. Arbitrage permanent **tech vs expansion** : le même Cash propre achète l'armement, la tech **ou** la carte.

### 6. Objectif économique

- **Victoire** : **dernier cartel en jeu** (`win-conditions.md`) — l'économie finance la guerre, elle n'est plus la condition de victoire.
- Le Cash propre n'est **pas** dépensable pour conquérir directement : il finance la **tech** (`tech.md`) et sert de **score**. La conquête se paie en **Membres**. Cette séparation force l'équilibre économie/conquête.
- Option **Overtime** : à 30 min, le seuil de victoire baisse de **2 %/min** (inspiré OpenFront).

## Paramètres chiffrés

| Paramètre | Valeur de départ | Statut |
|---|---|---|
| Tick de simulation | 100 ms (10 Hz) | fixé |
| Quartiers | 992 (Paris IRIS) | fixé |
| Emplacements de bâtiments / quartier | 3 (à équilibrer) | à équilibrer |
| Produit/labo/tick | 2 | à équilibrer |
| Taux Produit → Cash sale | 1 Produit = 15 Cash sale | à équilibrer |
| Débit Point de vente | 2 Produit/tick | à équilibrer |
| Commission de blanchiment | 20 % | fixé |
| Débit Façade | 30 Cash sale/tick | à équilibrer |
| Coût Labo / PdV / Façade | `min(1e6, 2^num × 12 500)` Cash sale | à équilibrer |
| Coût Planque | `min(250 000, (n+1) × 5 000)` Cash sale | à équilibrer |
| Défense Planque | ×5 (portée locale) | à équilibrer |
| Coût Atelier | 50 000 Cash propre | à équilibrer |
| Coût Contre-espionnage | 75 000 Cash propre | à équilibrer |
| Réduction Contre-espionnage | −40 % (rayon 3 quartiers) | à équilibrer |
| Coût Dépôt | 100 000 Cash propre | à équilibrer |
| Bonus Membres Dépôt | +250 000 max, +5/tick | à équilibrer |
| Coût de conversion | 50 % du coût / 50 % de la durée | fixé (montants à équilibrer) |
| Durées de construction | Labo/PdV 20 ticks · Façade/Planque/Atelier 50 · CE/Dépôt 100 | à équilibrer |
| `structureMinDist` (emprises voisines, inspiré OpenFront) | 15 tuiles | à équilibrer |
| Ressources de départ | 20 000 Cash sale, 0 Cash propre, 50 000 Membres | à équilibrer |
| Condition de victoire | dernier survivant | fixé |
| Seuil de victoire — Cash propre | **TBD** | TBD |
| Overtime | −2 %/min après 30 min | fixé |
| Poids des formules de Membres | exposants 0.6 / 0.73 | à équilibrer |

## Cas limites

- **Bâtiment détruit par un raid** : le bâtiment est **détruit** (place libérée), pas remboursé ; les éventuels dégâts collatéraux sont loggés (`scoring.md`). Un quartier repris peut être reconverti.
- **Quartier perdu avec des bâtiments dessus** : par défaut les bâtiments **changent de propriétaire avec le quartier** (le conquérant hérite de l'infrastructure) ; seule une action de **sabotage/raid** les détruit. Décision à confirmer en `combat.md`.
- **Faillite** : plus de Cash sale ni Cash propre ni Produit → aucun bâtiment constructible ; l'**Membres continue de régénérer** (issue de secours : conquête de quartiers riches ou vente forcée), jamais de blocage total.
- **Produit stocké plafonné** : le stock de Produit par faction est borné (ex. `10 000 × N_dépôts + base`), pour éviter l'accumulation infinie et forcer l'écoulement via les Points de vente.
- **Conversion en cours de perte de quartier** : la conversion est annulée, le coût versé est **partiellement remboursé** (à équilibrer) ; le bâtiment source retrouve son état neutre.
- **Bâtiments neutres épuisés** : si un quartier n'a plus de bâtiment source compatible, la construction neuve reste possible (coût plein, durée pleine) dans la limite des emplacements.
- **Concurrence sur un même quartier** : deux factions ne peuvent pas convertir simultanément le même bâtiment source ; le premier arrivé verrouille l'emplacement.

## Dépendances

- `territory.md` — propriété, Contrôle 0–100, possession, emplacements, conquête.
- `combat.md` — destruction des bâtiments, raids, héritage des infrastructures.
- `tech.md` — l'Atelier ouvre les branches ; coûts payés en Cash sale/propre.
- `win-conditions.md` — seuil de Cash propre et condition de Contrôle.
- `scoring.md` — Cash propre = base du score ; log causal des flux, pertes et destructions.
- `scoring.md` — usage du Cash propre (score, victoire).
- `city-sim.md` — bâtiments sources générés, effet des conversions sur la population locale.

## Critères de validation

- [ ] Les 4 ressources ont un flux **entrant et sortant** identifiable, sans ressource orpheline.
- [ ] Un joueur peut toujours retrouver un chemin de reprise après une faillite (pas de soft-lock).
- [ ] La boucle Produit → Cash sale → Cash propre est **obligatoire** (aucun raccourci direct).
- [ ] Les Membres ne peut **jamais** s'acheter avec du Cash sale/propre (séparation conquête/économie).
- [ ] Les 7 bâtiments sont convertibles depuis au moins un type de bâtiment généré.
- [x] Le coût croissant des bâtiments empêche le spam d'un seul type.
- [x] L'économie permet de soutenir une guerre de longue haleine (battle royale).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Nature des ressources | 4 ressources abstraites : Produit, Cash sale, Cash propre, Membres |
| 2 | Séparation conquête/économie | Les Membres ne s'achète pas ; l'économie finance la tech et le score |
| 3 | Quartier | Quartier IRIS (992 quartiers réels), propriétaire + Contrôle 0–100 + profil marché |
| 4 | Bâtiments | 7 : Labo, Point de vente, Façade, Planque, Atelier, Contre-espionnage, Dépôt |
| 5 | Implantation | La ville préexiste ; le joueur **convertit** des bâtiments existants |
| 6 | Coût de conversion | 50 % du coût et de la durée, quartier possédé + zone compatible |
| 7 | Commission de blanchiment | 20 % (fixé) |
| 8 | Coût croissant | Modèle `min(1e6, 2^n × 12 500)` inspiré OpenFront City/Factory/Port |
| 9 | Membres | `maxTroops` et régénération adaptées d'OpenFront, bonus par Dépôts |
| 10 | Défense Planque | ×5 local, inspiré DefensePost OpenFront |
| 11 | Victoire | Dernier survivant (battle royale) |
| 12 | Overtime | Optionnel : seuil −2 %/min après 30 min |
| 13 | Marché local | Chaque quartier a un profil : **demande** (clientele → capacité de vente et recrutement) et **richesse** (prix et capacité de blanchiment). Paris : richesse par arrondissement (INSEE), demande par type IRIS ; grille : par type de zone. Profils normalisés à moyenne 1,0 (localiser redistribue, sans changer le total). |
| 14 | Logistique | Une vente doit être **reliée à un labo** et une façade à une vente par un chemin de quartiers possédés (BFS). Hors ligne, la capacité tombe à 35 % (plancher). Les lignes sont visibles (convois) et **interceptables** (Armement ≥ 1, 500 membres : détourne 25 % de la cargaison, coupe la ligne 25 s). |

---

## Implémentation (P2–P4) — valeurs en vigueur

> Section **faisant foi** pour le code actuel (`src/sim/buildings.ts`, `src/sim/world.ts`). Le tableau de bâtiments plus haut décrit la cible ; ces valeurs sont celles implémentées (à équilibrer).

### Ressources de départ

| Ressource | Joueur | IA |
|---|---|---|
| Membres | 3 000 | 3 000 |
| Cash sale | 2 000 | 2 000 |
| Produit / Cash propre | 0 | 0 |

> Le départ IA est **aligné sur le joueur (2 000)** : en dessous, Labo (1 000) + Point de vente (1 000) = 2 000 rendait tout démarrage économique impossible (constaté en simulation massive).

### Les 8 bâtiments (1 par quartier possédé)

| Bâtiment | Coût | Effet / tick |
|---|---|---|
| **Recrutement** | 800 membres | +25 Membres |
| **Labo** | 1 000 sale | +1,5 Produit |
| **Point de vente** | 1 000 sale | convertit jusqu'à 2 Produit → 60 sale/unité |
| **Façade** | 1 500 sale | blanchit jusqu'à **60** sale → propre (commission 20 %) |
| **Planque** | 1 200 sale | défense locale ×1,5 |
| **Dépôt** | 1 200 sale | +2 000 Membres max |
| **Atelier** | 2 500 propre | +1 niveau de tech débloqué (max 5) |
| **Contre-espionnage** | 2 000 propre | −15 % dégâts de tueur à gage (plafond −60 %) |

### Formules de Membres

- `maxMembres = 2000 + quartiers × 1500 + logements × 2000 + dépôts × 2000`
- `production/tick = (8 × quartiers + 25 × logements) × (1 − membres/max) × (1 + 0,2 × logistique)`
- Capture d'un quartier : son **bâtiment est détruit** (remis à vide).

### Composition cible (IA et bot)

`chooseBuildType` (`buildings.ts`) comble le **plus grand déficit** par rapport à cette composition, au lieu de prendre « le premier abordable » (qui remplissait tout de logements → 0 Cash propre). Ordre **amont → aval** : Labo avant Point de vente.

| Type | Part visée |
|---|---|
| Recrutement | 30 % |
| Labo | 20 % |
| Point de vente | 15 % |
| Façade | 15 % |
| Dépôt / Atelier / Contre / Planque | 5 % chacun |

L'Atelier est **plafonné** à `TECH.maxLevel` (5).

### Conversion de bâtiments existants

- Chaque quartier possédé et **vide** peut recevoir **un** bâtiment (conversion du bâti existant).
- Coût payable en **Membres** (logement) ou en **Cash sale** (production/vente/défense) ou **Cash propre** (Atelier/Contre-espionnage).
- La capture du quartier **détruit** le bâtiment.

---

## Implémentation (P11) — conversion par zone

> Section **faisant foi** pour `src/sim/buildings.ts` (`ZONE_BUILDINGS`). Applique la contrainte « zone compatible » de la spec (§4).

Un quartier possédé et **vide** ne peut être converti que vers les types **compatibles avec sa zone** :

| Zone | Bâtiments convertibles |
|---|---|
| Résidentiel | Recrutement, Labo, Point de vente, Façade, Planque, Contre-espionnage |
| Commercial | idem (boutique/arrière-boutique) |
| Vie nocturne | Recrutement, Labo, Point de vente, Façade, Planque |
| Industriel | + **Dépôt**, **Atelier** |
| Laverie | Recrutement, Labo, Point de vente, Façade, Planque, Contre-espionnage |
| **Poste de police** | **Contre-espionnage, Planque** uniquement |
| **Parc** | **Planque** uniquement |
| **Terrain vague** | Construction neuve uniquement : Labo, Point de vente, Façade, Planque, Dépôt, Atelier (**pas de Recrutement** : rien à réquisitionner) |

- Le **spawn** de chaque faction est forcé sur une zone « bâtie » : on peut toujours amorcer.
- **Amorçage** : tant que la chaîne (Labo → Point de vente → Façade) est incomplète, l'IA/le bot ne construisent **que** l'étape manquante (évite de gaspiller le budget).
- L'IHM affiche la **zone**, la liste des conversions possibles, et « zone incompatible » sur les boutons refusés.

### Reste à faire (spec §4)

- **Durée de conversion** (20–100 ticks) et **coût réduit à 50 %** : non implémentés (conversion instantanée au coût plein).
- **Coût croissant par type** et **effet sur la population** (`city-sim.md`) : non implémentés.

---

## Implémentation (P12) — conversion vs construction

- **Conversion** (zone **bâtie** : résidentiel, commercial, vie nocturne, industriel, laverie, parc, police) : **instantanée**, coût **−50 %**.
- **Construction neuve** (terrain vague) : **coût plein** + **chantier** (`BUILD_TICKS` ≈ 3–8 s selon le type, 10 Hz).
- **Chantier** : payé à l'ordre, **parallèle** (un par quartier), **perdu** si le quartier est capturé ou le bâtiment détruit (raid police, tueur). Le quartier ne produit rien pendant les travaux.
- Rendu : bloc **ambre réduit** sur la carte ; panneau Quartier → « Chantier : X — encore N s ».

### Blanchiment contrôlé (P13)

- Le joueur règle un **ratio de blanchiment 0–100 %** (curseur) : la capacité effective des façades est `façades × 60 × ratio`. **Défaut : 50 %** — à 100 % tout le Cash sale part en Cash propre et il n'en reste plus pour bâtir (blocage).
- À **0 %**, le Cash sale s'accumule (pour acheter) ; à **100 %**, tout part en Cash propre. Compromis central de la boucle.

### Réglages P15 — chantiers

- **Construction neuve** : `BUILD_TICKS` ≈ **9–24 s** (90–240 ticks).
- **Conversion** (bâti existant) : **coût −50 %** et **temps ÷2**, mais **plus instantanée** (chantier malgré tout).

### P17 — thème « recrutement » et ratio d'assaut

- Le bâtiment de production de Membres est **« Recrutement »** (on **réquisitionne un immeuble d'habitation** plutôt que d'en construire — plus crédible pour un cartel). Mécanique inchangée (+25 Membres/tick).
- **Ratio d'assaut réglable** (curseur, 5–60 %) : part des Membres engagée à chaque attaque (OpenFront-like).

### P19 — bâtiments objectifs (butin)

- Capturer un quartier **bâti** rapporte **20 % de la valeur du bâtiment** (prélevé sur le défenseur, dans sa monnaie de coût), en plus du quartier. *Abaissé de 40 % → 20 % pour freiner le snowball.* Les bâtiments restent des **cibles à valeur**.
- Un **Contre-espionnage** adjacent à un quartier attaqué **alerte** son propriétaire (événement, texte flottant, son) : rôle de **guetteur**.
