# AGENTS.md — Dealer RTS (DealerFront)

Guide pour les agents qui travaillent sur ce dépôt. **Lire ce fichier avant toute tâche.**

## Le projet

Jeu **solo** de stratégie/gestion sur une **carte réelle** (Paris, quartiers IRIS) rendue avec **mapcn / MapLibre**, jouable en navigateur. Le joueur incarne **le cartel** (God view) : il **commande de loin** (plus de personnage unique). Objectif : **rester le dernier cartel en jeu** (battle royale), face à **5 gangs IA** et à la **police**.

Hébergement : **Cloudflare Workers** (API/utilitaires) + **assets statiques** (SPA). La simulation tourne **côté client**.

> ✅ **Refonte OpenFront-like engagée** : le design (`docs/`) **et le cœur de simulation (P1 territoire)** sont en mode **DealerFront** (gestion de quartiers, god-view, plus de personnage). Les systèmes suivants (économie, tech, police, fin de partie) restent à implémenter par phases.

## Source de vérité du design

- [`GDD-dealer-rts.md`](./GDD-dealer-rts.md) = **orchestrateur** → renvoie vers `docs/`.
- Les règles vivent dans les specs de [`docs/`](./docs/index.md), une par système.
- Nouveau socle : `pillars` → `core-loop` → `territory` → `combat` → `economy` → `tech` → `factions` → `police-ai` → `procgen` → `command` → `win-conditions`/`scoring` → `ui-ux`/`art-direction` → `tech-stack`.
- Chaque spec finit par un **§ Décisions tranchées** ; les `TBD` sont dans [`docs/open-questions.md`](./docs/open-questions.md).
- **Toute décision de design se consigne dans la spec concernée.**

## Stack

- **Runtime** : Cloudflare Workers (API sous `/api/*`) + Workers static assets. **Pas de serveur de jeu** (simulation client-side).
- **Front** : Vite + React 19 + TypeScript strict + **mapcn / MapLibre**.
- **Simulation** : cœur **déterministe et agnostique** (aucune dépendance React/DOM), pas fixe **10 Hz**. Architecture cible : **intents → executions** (inspirée d'OpenFront), Worker-ready.
- **Package manager** : **bun**. Audio : **cuelume** (Web Audio, sans fichiers).

## Commandes

| Commande | Rôle |
|---|---|
| `bun install` | Installer les dépendances |
| `bun run dev` | **Jeu** : dev local (Vite + Worker) — **http://localhost:5173** |
| `bun run build` | Typecheck + build de production (jeu + Worker) |
| `bun run preview` | Prévisualiser le build dans le runtime Workers (jeu + `/api/*`) |
| `bun run typecheck` | Typecheck (app / node / worker) |
| `bun run test` | Tests Vitest |
| `bun run sim:mass` | Simulation massive d'équilibrage (bot, 200 seeds × 15 000 ticks ; `SEEDS`/`TICKS` en env) |
| `bun run sim:bench` | 100 parties → SQLite (`data/sim.sqlite`) + export JSON dashboard (`SEEDS`/`CADENCE`/`TICKS`) |
| `bun run dashboard:dev` | **Dashboard d'équilibrage local** (`http://localhost:5174`, racine = le dashboard) — lancer `sim:bench` d'abord |
| `bun run dashboard:build` | Build du dashboard (`dist-dashboard/`, **hors git et hors déploiement**) |
| `bun run cf-typegen` | Régénérer `worker-configuration.d.ts` |
| `bun run deploy` | **Ne pas exécuter sans demande explicite** |

> Le **dashboard** est un **outil local** : config Vite séparée (`vite.dashboard.config.ts`), sources gitignorées, jamais inclus dans le build Workers du jeu.

## Conventions

- **TypeScript strict**, `verbatimModuleSyntax` (`import type`), pas de `any`, pas de double-cast.
- **Cœur de simulation pur et déterministe** : jamais de `Math.random()` (PRNG seedé), pas d'accès DOM/React, temps via pas fixe (10 Hz).
- **Piliers non négociables** ([`docs/pillars.md`](./docs/pillars.md)) : pas de rubber-banding, pas de méta, causalité pure, N&B fonctionnel, **couleur = information de faction**, pas d'omniscience IA.
- **God view** : on commande des **quartiers** (ordres de faction), pas un personnage.
- **Langue** : docs et commentaires *de design* en **français** ; code et identifiants en **anglais**.
- **Commentaires** : uniquement si non évidents.
- **Cloudflare** : `wrangler.jsonc` (JSONC), `compatibility_date` à jour, `nodejs_compat`, observabilité ; secrets via `wrangler secret put` ; pas d'état de requête en global ; `await`/`waitUntil` sur toute promesse.
- **Licence** : OpenFront est **AGPL-3** → on reprend les **idées**, **aucun code copié**.

## Structure actuelle (à migrer)

```
GDD-dealer-rts.md        Orchestrateur (pointe vers docs/)
docs/                    Spécifications DealerFront (territory, combat, economy, …)
worker/index.ts          Worker natif (fetch) — route /api/health
src/main.tsx             Entrée React
src/App.tsx              UI + HUD
src/sim/                 Cœur de simulation déterministe (DealerFront)
  factions.ts            Factions (joueur + gangs IA), couleurs, ressources
  territory.ts           Propriété, contrôle et bâtiments des quartiers, adjacence
  buildings.ts           Types de bâtiments, coûts et effets
  tech.ts                Paliers de tech (Armement/Protection/Logistique) + tueur à gage
  police.ts              Police anti-leader (Pression, raids, liquidation, corruption)
  diplomacy.ts           Relations par paire, pactes, trahisons (v1)
  world.ts               Boucle : production, vente, blanchiment, bagarres, IA, police, diplomatie, victoire/défaite
  bot.ts                 Bot déterministe (équilibrage) : autoPlay / playOut
  balance.test.ts        Non-régression : composition, runs longs, déterminisme, économie
  police.test.ts         Police : ciblage, raids, liquidation, corruption
  win.test.ts            Fin de partie : victoire double, faillite, score, overtime
  diplomacy.test.ts      Diplomatie : relations, pactes, trahison, alliés
  constants.ts / rng.ts / clock.ts / types.ts
scripts/mass-sim.ts      Simulation massive d'équilibrage (SEEDS/TICKS/CADENCE)
scripts/build-paris-map.ts  Génère la carte Paris IRIS (zones, adjacence, spawns, profils, géométrie)
src/sim/maps/            paris.ts (généré) + paris-iris.geojson (géométrie) — seule carte jouée
src/render/              Rendu mapcn / MapLibre (plus de 3D)
  WorldMap.tsx           Carte : zones faction/Contrôle/heat (feature-state), arcs d'assaut, convois
  palette.ts             Gris daltoniens + symboles de faction
wrangler.jsonc / vite.config.ts / tsconfig*.json
```

## Vérifications avant de terminer une tâche

```
bun run typecheck && bun run test && bun run build
```

## État actuel

- **Design** : `docs/` est passé au mode **DealerFront** (territoire, influence/contrôle, économie à 7 bâtiments, tech, factions IA, police anti-leader, victoire contrôle+blanchiment, couleurs de faction).
- **Code (P1–P9 faits — refonte OpenFront-like)** : `src/sim/` implémente les **quartiers** (propriété + Contrôle 0–100 + bâtiment), les **factions** (Membres/Produit/Cash sale/Cash propre/tech), les **bagarres**, une **IA** (bâtit, s'étend, monte la tech, tueurs), l'**économie** : **8 bâtiments** posés par **conversion** (Logement, Labo, Point de vente, Façade, Planque, Dépôt, Atelier, Contre-espionnage), chaîne **Produit → Cash sale → Cash propre**, la **tech** (Armement/Protection/Logistique, paliers débloqués par les Ateliers), le **tueur à gage** (+ contre-espionnage), la **police anti-leader** (Pression, raids, saisie, liquidation, corruption), la **diplomatie** (relations, pactes, trahisons, coalition anti-leader) et la **fin de partie** (victoire = **dernier survivant**, faillite, temps écoulé, score composite, récap). Déterministe + tests. Rendu **god-view** : **écran de sélection** (Paris), overlay de possession coloré ∝ Contrôle, **contours d'attaque** (couleur de l'attaquant), **convois** animés, **heat local** en contour orange, **vignette d'ambiance police**, **mode daltonien** (gris + symboles), **HUD en zones sans scroll** (barre haute ressources/objectif, gauche = ordres, droite = pilotage, bas = journal/contrôles). **Plus de personnage ni de déplacement souris/clavier.**
- **Opérations (P20)** : **Descente** (vole le butin, gaté Armement ≥ 1) et **Sabotage** (production ÷2, Armement ≥ 2) ; **Guetteur** = alerte + bloque les opérations ; le **plafond de dégâts suit l'Armement** (la tech compte).
- **Guerre de quartiers (P19)** : **butin** à la capture (40 % de la valeur du bâtiment), **guetteurs** (Contre-espionnage = alerte de descente), contours de territoire **continus** (arêtes), **aménagement par lot** (chiffré), victoire **dernier survivant**.
- **DA/UI (P16)** : palette **pastel** (factions), aplats par faction ∝ Contrôle, **frontières** épaisses, animations (siège qui pulse, flash de capture) ; **fog abandonné** (tout visible).
- **Conquête (P15)** : **sièges** (dégâts plafonnés, régén forte), **3 assauts simultanés max**, **Raid** payant (contrôle/bâtiments, sans capture), constructions **9–24 s**, conversion −50 %/**temps ÷2** ; diplomatie masquée (`?`/`~X %`) ; quartiers réels.
- **UX (P13)** : simulation **en pause pendant le tuto**, **curseur de blanchiment** (0–100 %), **sons cuelume** (boutons + événements : captures, raids, tech, corruption, fin), HUD allégé (Tech/Diplomatie repliables) et animations CSS.
- **Carte unique — Paris IRIS (P24)** : seule carte jouée. `CityGrid` = `zones` + `neighbors` + `spawns` + `demand`/`wealth` (profils) ; `PARIS_MAP` = 992 quartiers IRIS (INSEE/IGN), adjacence par arêtes partagées, spawns espacés. Rendu **mapcn** (`Map`/`MapGeoJSON`/`MapArc`/`MapControls`) dans `WorldMap.tsx`, possession/Contrôle/heat par `feature-state`, fond muet, convois animés. Généré par `scripts/build-paris-map.ts`. L'ancien mode (grille procédurale + rendu 3D isométrique) est **supprimé**.
- **Marché local (P21)** : chaque quartier a un **profil** (`CityGrid.demand` / `.wealth`) — demande = capacité de vente/recrutement, richesse = prix/blanchiment. Paris : richesse par **arrondissement réel** (INSEE), demande par **type IRIS**. Profils normalisés à moyenne 1,0. `world.demandAt` / `wealthAt` ; affiché au survol et dans le panneau Quartier. Testé (`market.test.ts`).
- **Logistique (P22)** : une vente doit être **reliée à un labo** (et une façade à une vente) par un chemin de quartiers possédés ; sinon capacité ×0,35. **Convois** visibles (mapcn, points animés) et **interceptables** (Armement ≥ 1). BFS recalculé uniquement quand propriété/bâtiments changent (signature). Testé (`logistics.test.ts`).
- **Police locale (P23)** : **heat par quartier** (monte au crime, retombe, ×3 près des postes réels) ; les **raids visent les quartiers les plus chauds** ; la **corruption refroidit** les quartiers du cartel (÷2). Heat rendu en contour orange. Testé (`police.test.ts`).
- **À venir** : rien de bloquant (P1–P13 faits). Reste optionnel : coût croissant par type, sélection multiple + prévisualisation chiffrée, motifs daltoniens, overtime (codé mais désactivé), équilibrage (les parties gagnées « au score » dominent). **Agents/PNJ notables : abandonnés** (décision, voir `docs/factions.md`).
- **Battle royale (P26)** : **victoire = dernier cartel en jeu** (plus de seuil de contrôle/cash ni d'horloge), **6 factions**. **Encirclement** : un cluster fermé (≥ 8 quartiers, ≥ 35 % de la faction, plus petit que l'encercleur) capitule d'un coup. **Événements à choix** (3 types) : un à la fois, deux options à effet traçable. **100 seeds** : 94 victoires / 6 défaites, 0 sans-fin, 0 violation. Détails dans `docs/win-conditions.md`, `docs/core-loop.md`, `docs/factions.md`, `docs/npc-events.md`.
- **Performance** : cœur sim optimisé via comptages sans allocation par tick et caches (`recount`, `owned`, `underAttack`, `supplySignature`). Rendu : **`feature-state` incrémental** (seuls les quartiers changés sont mis à jour), convois recalculés par tick. Logistique : BFS uniquement quand propriété/bâtiments changent.
- **Aucune base de données** (solo, sans méta).
