# Game Design Document — "Dealer RTS" (orchestrateur)

> **Point d'entrée du projet.** Ce document **orchestre** les spécifications modulaires du dossier [`docs/`](docs/index.md).
> Statut : **DealerFront (v1)** — bascule d'un dealer incarné vers un **god-view cartel** (contrôle de quartiers). Détails et décisions dans les specs ; points ouverts dans [`docs/open-questions.md`](docs/open-questions.md).

---

## 1. Pitch (résumé)

Jeu **solo** de stratégie/gestion, vue **isométrique 2.5D** dans une **ville procédurale**, jouable en navigateur. Tu incarnes **le cartel** (God view) : tu ne contrôles plus un personnage, tu **commandes de loin**. Objectif : **contrôler ≥ ~60 % des quartiers** et **blanchir assez d'argent** en **20–30 min**, face à **3–5 gangs IA** et à la **police**.

**Inspirations** : **OpenFront** (contrôle territorial temps réel, alliances, traîtres), gestion sous pression (police/Heat), Frostpunk (diegetic UI), gestion de cartel.

---

## 2. Carte du projet — spec par spec

| Thème | Spec |
|---|---|
| Vision & piliers | [`docs/pillars.md`](docs/pillars.md) |
| Boucle & déroulé | [`docs/core-loop.md`](docs/core-loop.md) |
| Territoire (quartiers, Influence, Contrôle) | [`docs/territory.md`](docs/territory.md) |
| Combat (bagarres, défense, tueurs) | [`docs/combat.md`](docs/combat.md) |
| Économie (ressources, 7 bâtiments) | [`docs/economy.md`](docs/economy.md) |
| Tech / matos | [`docs/tech.md`](docs/tech.md) |
| Factions (gangs IA, diplomatie, agents) | [`docs/factions.md`](docs/factions.md) |
| Police (anti-leader, corruption) | [`docs/police-ai.md`](docs/police-ai.md) |
| Génération & mise en place | [`docs/procgen.md`](docs/procgen.md) |
| Commandement god-view | [`docs/command.md`](docs/command.md) |
| Victoire / défaite | [`docs/win-conditions.md`](docs/win-conditions.md) |
| Score final | [`docs/scoring.md`](docs/scoring.md) |
| UI/UX | [`docs/ui-ux.md`](docs/ui-ux.md) |
| Direction artistique | [`docs/art-direction.md`](docs/art-direction.md) |
| Ville (zones, densité) | [`docs/city-sim.md`](docs/city-sim.md) |
| Difficulté | [`docs/difficulty.md`](docs/difficulty.md) |
| Événements à choix | [`docs/npc-events.md`](docs/npc-events.md) |
| Stack technique | [`docs/tech-stack.md`](docs/tech-stack.md) |
| Index & glossaire | [`docs/index.md`](docs/index.md) |
| Questions ouvertes | [`docs/open-questions.md`](docs/open-questions.md) |

---

## 3. Décisions majeures

| Sujet | Décision |
|---|---|
| Modèle joueur | **God view cartel** (plus de dealer incarné — pilier 5 redéfini) |
| Inspiration | **OpenFront** (idées, pas de code : OpenFront est AGPL-3) |
| Échelle | **256 quartiers** (16×16 modules), **4–6 factions**, 20–30 min |
| Boucle | **Économie ↔ conquête à égalité** |
| Combat | **Influence abstraite** par quartier (pas d'unités individuelles) |
| Ressources | Abstraites : Produit, Cash sale, Cash propre, Influence |
| Bâtiments | 7 : Labo, Point de vente, Façade, Planque, Atelier, Contre-espionnage, Dépôt |
| Police | **Anti-leader** + **corruption** |
| Victoire | **Contrôle ≥ ~60 %** ET **seuil de Cash propre** |
| Couleur | **Information de faction** (exception assumée au N&B strict) |
| Architecture | **Solo**, core déterministe 10 Hz, style **intents → executions**, multi différé |

---

## 4. Remplacements de specs (ancien mode)

- Ancien *orders.md* → **`command.md`** (ordres de faction).
- Ancien *agents.md* → **fusionné dans `factions.md`**.
- Ancien *resources-heat.md* → **remplacé** par `economy.md` + `police-ai.md` (Heat → **Pression police**).

---

## 5. Comment lire

1. [`pillars.md`](docs/pillars.md) · 2. [`core-loop.md`](docs/core-loop.md) · 3. [`territory.md`](docs/territory.md) · 4. [`combat.md`](docs/combat.md) · 5. [`economy.md`](docs/economy.md) · 6. [`tech.md`](docs/tech.md) · 7. [`factions.md`](docs/factions.md) · 8. [`police-ai.md`](docs/police-ai.md) · 9. [`procgen.md`](docs/procgen.md) · 10. [`command.md`](docs/command.md) · 11. [`win-conditions.md`](docs/win-conditions.md) + [`scoring.md`](docs/scoring.md) · 12. [`ui-ux.md`](docs/ui-ux.md) + [`art-direction.md`](docs/art-direction.md) · 13. [`tech-stack.md`](docs/tech-stack.md).

> Glossaire : [`docs/index.md`](docs/index.md).

---

## 6. Statut & gouvernance

- Toutes les specs sont en **v1 DealerFront** (ou v2/v3 pour les réécritures).
- Les **TBD** sont centralisés dans [`docs/open-questions.md`](docs/open-questions.md).
- Toute décision se consigne dans la spec concernée.
- **Migration code en cours** : le code actuel implémente encore l'ancien mode « dealer piloté » ; la bascule se fait par phases (voir `open-questions.md` §Dette et le plan d'implémentation).

---

*Document orchestrateur — pour modifier un système, éditez la spec correspondante dans `docs/`.*
