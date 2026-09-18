# Factions — Gangs IA, diplomatie et agents

> Statut : **v1 (DealerFront)** — mode « cartel » en God view, solo vs IA.
> Ce fichier **absorbe l'ancien `agents.md`** : les agents autonomes deviennent des gangs/PNJ de faction.

## Objectif

Définir les **4–6 factions** du mode **DealerFront** — le joueur incarne **le cartel**, face à **3–5 gangs IA** — ainsi que la **diplomatie** (pactes, demandes, embargoes, trahisons) et les **agents/PNJ notables** qui les peuplent. Une session dure **20–30 min** sur **256 quartiers** (modules 6×6, grille 16×16), avec une boucle équilibrée **économie ↔ conquête**.

Inspirations : **OpenFront** (territoire, alliances, traîtres) + gestion (Heat, police). Les valeurs OpenFront sont citées comme point de départ et **à équilibrer**.

## Règles

### Factions

- **4–6 factions** : le **joueur** + **3–5 gangs IA** (nombre tiré par seed, à équilibrer).
- Chaque faction possède : de l'**Influence** (ressource-troupe), des **quartiers** (module 6×6 ; propriétaire + **Contrôle 0–100**), des **bâtiments** (Labo, Point de vente, Façade, Planque, Atelier, Contre-espionnage, Dépôt) et des ressources abstraites (**Produit**, **Cash sale**, **Cash propre**).
- **Spawn** : sur la ville procédurale, **distance minimale entre factions** (30 tuiles, inspiration OpenFront ; à équilibrer). Chaque faction démarre sur **1–2 quartiers** + une **Influence de départ**. Immunité de spawn **50 ticks** (inspiration OpenFront ; à équilibrer).
- **Contrôle d'un quartier** : 0–100 ; il se gagne/perd par conquête, Influence dépensée, raids police (`police-ai.md`) et trahisons. Un quartier à Contrôle 0 change de propriétaire (`territory.md`).

### IA de faction

- Chaque gang IA **réutilise le cerveau d'agent** : **QI ~N(50, 20)** borné 10–90, **perception locale** (~8 tuiles, jamais la carte entière), **routine/agenda**, **peur + loyauté** (0–100), erreurs probabilistes ∝ (100 − QI).
- **Objectifs** (priorité dynamique, à équilibrer) :
  1. **S'étendre sur le neutre** (quartiers sans propriétaire) ;
  2. **Blanchir** (Cash sale → Cash propre) ;
  3. **Se défendre** (renforcer les quartiers menacés) ;
  4. **Attaquer le leader** (faction au plus fort Contrôle ; anti-snowball partagé avec la police) ;
  5. **Honorer ou trahir les pactes** selon loyauté/peur et le rapport de force.
- **Difficulté IA** : cadence d'attaque/expansion variable (inspiration OpenFront — Easy 65–100, Medium 55–70, Hard 45–60, Impossible 30–50 ticks ; **à équilibrer**). Tribus neutres : `attackRate = rand(40, 80)` ticks, `triggerRatio 50–60 %`, `reserveRatio 30–40 %`, `expandRatio 10–20 %`, troupes initiales 10 000 (inspiration, **à équilibrer**).
- **Non-omniscience** : une IA ne « sait » que par perception/mémoire/routine ; toute décision est traçable (R3).

### Diplomatie

- **Pactes / alliances** : durée par défaut **3 000 ticks (5 min ; inspiration OpenFront, à équilibrer)**. Une **demande** attend **200 ticks** (à équilibrer) ; **cooldown** de redemande **300 ticks** (à équilibrer).
- **Embargo** : temporaire, **3 000 ticks** (à équilibrer) ; bloque les échanges économiques entre factions.
- **Relations** : variable par paire de factions. **Attaquer** une faction fait chuter la relation de **−60 (Easy) à −100 (Impossible)** (inspiration OpenFront ; à équilibrer). Les relations conditionnent l'acceptation des pactes et le ciblage.
- **Retournement / trahison** : une faction (IA, ou joueur via ses agents) peut trahir. **Trahison probable** si **Loyauté < 20 et Peur < 20** (seuils hérités du cerveau d'agent). Le traître subit une pénalité temporaire (**300 ticks** ; défense ×0,5, vitesse ×0,8 ; inspiration OpenFront, à équilibrer) et une chute de réputation.
- **Réputation** : agrégat des relations ; elle module la propension des IA à pactiser, à attaquer un traître ou à le laisser se faire frapper par la police.

### Agents / PNJ notables

Les **agents autonomes** de l'ancien système deviennent des **PNJ de faction** (possédés par un gang, ou indépendants) :

| Rôle | Fonction | Interaction | Intégration faction |
|---|---|---|---|
| **Vendeur** | Écoule le Produit | Sert ou arnaque | Génère du Cash sale pour sa faction |
| **Guetteur** | Surveille un quartier | Alerte ou dénonce | Révèle les mouvements ennemis/police |
| **Informateur** | Renseigne | Dénonce ou se fait acheter | Vendu entre factions contre paiement |
| **Contact corrompu** | Agent véreux | Réduit la Pression police contre paiement | Utile à toutes les factions (`police-ai.md`) |
| **Rival** | Concurrence locale | Consomme clients/façades | Peut être recruté ou éliminé |
| **Tueur** | Violence ciblée | Peut être engagé | Retire un agent/PNJ ennemi (victimes → score) |

- **Population** : **8–12 agents notables** par run (héritage `agents.md`) répartis entre factions, + civils LOD et police (`tech-stack.md`). Nombre exact **à équilibrer**.
- Un agent peut **changer de camp** si sa faction est éliminée ou via trahison.

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Nombre de factions | 4–6 (joueur + 3–5 IA) | fixé |
| Quartiers de départ / faction | 1–2 + Influence de départ | à équilibrer |
| Distance min entre factions au spawn | 30 tuiles | inspiration, à équilibrer |
| Immunité de spawn | 50 ticks | inspiration, à équilibrer |
| Influence de départ | **TBD** | à équilibrer |
| Distribution QI (IA/agents) | ~N(50, 20) borné 10–90 | fixé |
| Rayon de perception | ~8 tuiles | fixé |
| Erreurs IA | probabilité ∝ (100 − QI) | fixé (principe) |
| Cadence d'attaque IA (Easy/Medium/Hard/Impossible) | 65–100 / 55–70 / 45–60 / 30–50 ticks | inspiration, à équilibrer |
| Tribus neutres — `attackRate` | rand(40, 80) ticks | inspiration, à équilibrer |
| Tribus neutres — `trigger/reserve/expandRatio` | 50–60 % / 30–40 % / 10–20 % | inspiration, à équilibrer |
| Troupes initiales (neutres) | 10 000 | inspiration, à équilibrer |
| Durée d'un pacte | 3 000 ticks (5 min) | inspiration, à équilibrer |
| Attente d'une demande de pacte | 200 ticks | inspiration, à équilibrer |
| Cooldown de redemande | 300 ticks | inspiration, à équilibrer |
| Durée d'un embargo | 3 000 ticks | inspiration, à équilibrer |
| Impact relation (attaque) | −60 (Easy) à −100 (Impossible) | inspiration, à équilibrer |
| Seuil de trahison | Loyauté < 20 **et** Peur < 20 | fixé |
| Effet traître | 300 ticks : défense ×0,5, vitesse ×0,8 | inspiration, à équilibrer |
| Agents notables / run | 8–12 | fixé |

## Cas limites

- **Faction éliminée** : si elle perd tous ses quartiers, ses agents deviennent **indépendants** (recrutables) ou rejoignent une faction à forte loyauté ; ses pactes sont annulés.
- **Alliance qui se brise** : une trahison place le traître en pénalité temporaire et chute sa réputation ; les victimes peuvent former une **coalition anti-traître**.
- **Agent qui change de camp** : possible si sa faction meurt, s'il trahit ou s'il est acheté ; sa mémoire (perception, relations) suit le changement.
- **IA sans quartier** : elle cherche à **reprendre du neutre** ; sans neutre accessible, elle devient mercenaire (vend ses agents) ou demande un pacte.
- **Pacte avec le joueur** : une IA peut honorer un pacte tout en préparant une trahison (loyauté basse) — toujours traçable.
- **Snowball** : si une faction atteint un seuil de domination, la police (`police-ai.md`) et les IA restantes **ciblent conjointement** le leader.
- **Joueur dernier survivant** : la partie tend vers la victoire (`win-conditions.md`) ou la liquidation par la police.

## Dépendances

- `territory.md` — quartiers, propriétaire, Contrôle, conquête.
- `combat.md` — résolution des attaques, Influence, pertes.
- `police-ai.md` — anti-snowball, corruption du contact.
- `economy.md` — Produit, Cash sale, Cash propre, bâtiments, blanchiment.
- `win-conditions.md` — fin de session (20–30 min), liquidation.
- `agents.md` — **fusionné ici** ; cette spec le remplace.
- `core-loop.md` / `scoring.md` — boucle et évaluation.
- `ui-ux.md` / `art-direction.md` — lisibilité des factions (N&B, diplomatie).

## Critères de validation

- [ ] Une session complète tient en **20–30 min** avec 4–6 factions.
- [ ] Chaque décision d'IA est traçable à sa perception/mémoire/routine (audit R3, pas d'omniscience).
- [ ] Pactes, demandes, cooldowns et embargoes se comportent comme spécifié et sont **lisibles** par le joueur.
- [ ] Une trahison survient uniquement avec cause traçable (loyauté < 20 et peur < 20, ou sollicitation).
- [ ] Un agent peut changer de camp sans incohérence de mémoire.
- [ ] Une faction sans quartier reste cohérente (mercenariat, demande de pacte).
- [ ] Le ciblage anti-snowball du leader fonctionne sans rubber-banding (R1).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Nb de factions | 4–6 (joueur + 3–5 gangs IA) |
| 2 | Cerveau IA | Réutilise le cerveau d'agent (QI, perception, routine, peur, loyauté) |
| 3 | Spawn | Distance min 30 tuiles, 1–2 quartiers, immunité 50 ticks |
| 4 | Influence | Ressource-troupe par faction |
| 5 | Diplomatie | Pactes 3 000 ticks ; demande 200 ; cooldown 300 ; embargo 3 000 |
| 6 | Trahison | Loyauté < 20 **et** peur < 20 ; pénalité 300 ticks |
| 7 | Relations | Attaque ∝ difficulté (−60 à −100) |
| 8 | Agents | Fusionnés : rôles = PNJ de faction |
| 9 | Population | 8–12 agents notables / run |
| 10 | Anti-snowball | IA restantes + police ciblent le leader |
| 11 | `agents.md` | Absorbé par ce fichier |

---

## Implémentation (P1–P4) — valeurs en vigueur

> Section **faisant foi** pour `src/sim/factions.ts` et `src/sim/bot.ts`. La diplomatie décrite plus haut **n'est pas encore implémentée** (P5).

- **Nombre de factions** : `FACTION_COUNT = 4` (joueur + 3 gangs) — la cible 4–6 n'est pas encore tirée par seed.
- **Noms** : Cartel, Gang Nord, Gang Est, Gang Sud (… Ouest, Syndicat au-delà de 4).
- **Couleurs** : `#6FB7E8`, `#E0A030`, `#7FD08A`, `#A97BD8`, `#E23B2E`, `#2FB0A0` (couleur = information de faction).
- **Ressources de départ** : Membres **3 000**, Cash sale **2 000** — **identiques pour tous** (l'asymétrie IA passe par le comportement, pas par le départ).
- **IA** : une décision toutes les **25 ticks (2,5 s)** ; construire / tech / tueur / attaquer selon `chooseBuildType` (voir `economy.md`).
- **Bot d'équilibrage** : `bot.ts` (`autoPlay` / `playOut`) — même politique que l'IA, avec cadence paramétrable pour simuler un rythme humain (env `CADENCE`).
- **Diplomatie** : implémentée en v1 (voir section P8 ci-dessous). **Agents/PNJ notables** et **difficulté variable** : non implémentés.

---

## Implémentation (P8) — diplomatie v1

> Section **faisant foi** pour `src/sim/diplomacy.ts` et `src/sim/world.ts`.

- **Relations** : matrice **symétrique par paire**, 0–100, initiale **60** ; **dérive** de `+0,02/tick` vers 60 (une guerre se referme lentement).
- **Attaquer** une faction : **−25** de relation (ou **trahison** si un pacte existe).
- **Pactes** : durée **1 500 ticks**, demande valable **200 ticks**, **cooldown** de re-proposition **300 ticks**, acceptation si **relation ≥ 55** et si le proposeur n'est pas un runaway (`quartiers_proposeur ≤ 1,5 × quartiers_cible + 2`). Les alliés **ne s'attaquent pas**.
- **Trahison** : attaquer un allié (ou rompre via l'IHM) → pacte rompu, **−50** de relation, **pénalité de traître 300 ticks** (défense ×0,5). Un allié à relation < 20 peut trahir (probabilité 10 % par décision).
- **Coalition anti-leader** : une faction IA vise en priorité un quartier du **leader** avec une probabilité `leaderFocus × (contrôle_leader − 1/nb_factions)` (`leaderFocus = 0,25`) → **aucun dogpile à parité**, pression croissante à mesure qu'un cartel domine.
- **IHM** : panneau **Diplomatie** (relation, pacte/trahir, offres reçues à accepter/refuser) + entrées de journal.

### Écarts / non implémenté

- **Embargo** : reporté (nécessite des échanges économiques inter-factions, absents).
- **Agents / PNJ notables** (vendeur, guetteur, informateur, contact corrompu, rival, tueur-PNJ) : non implémentés (le tueur reste une capacité de faction, pas un agent).
- **Réputation d'agrégat** : approchée par la relation par paire ; pas de réputation globale.
- **QI / perception locale / peur / loyauté** : le cerveau IA reste une politique déterministe simple (pas de perception bornée).

### Équilibrage (simulation massive, 20 APM, 100 seeds)

Avec la coalition (`leaderFocus = 0,25`) + diplomatie : **84 victoires / 16 défaites**, contrôle moyen **~50 %**, ~**24 min**, ~0,1 pacte actif en fin de partie. Sans coalition (`leaderFocus = 0`) : 93 % de victoires — c'est donc le **ciblage anti-leader** qui pèse, pas les pactes.

### Embargo (P12, v1 joueur)

- Le joueur peut **déclarer un embargo** : durée **3 000 ticks**, **−35 % de revenu sale** pour la cible, **−40 de relation**, **pacte interdit** entre les deux tant qu'il dure.
- Un embargo sur un **allié** rompt le pacte (**trahison**). Les IA n'en déclarent pas (v1).
- **Agents/PNJ notables : abandonnés** (décision) — guetteur/informateur sans rôle sans fog, tueur/corruption/diplomatie couvrent déjà le reste. Seul le **contact corrompu nommé** est conservé.
