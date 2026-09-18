# AGENTS.md — Dealer RTS (DealerFront)

Guide pour les agents qui travaillent sur ce dépôt. **Lire ce fichier avant toute tâche.**

## Le projet

Jeu **solo** de stratégie/gestion, vue **isométrique 2.5D** dans une **ville procédurale** vivante, jouable en navigateur. Le joueur incarne **le cartel** (God view) : il **commande de loin** (plus de personnage unique). Objectif : **contrôler ≥ ~60 % des quartiers** et **blanchir assez d'argent** en 20–30 min, face à **3–5 gangs IA** et à la **police**.

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
- **Front** : Vite + React 19 + TypeScript strict + Three.js (`@react-three/fiber` / `drei`).
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
  city.ts                Génération de ville procédurale (quartiers + bâtiments)
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
src/render/              Rendu god-view (R3F)
  IsoCanvas.tsx          Vue aérienne (caméra libre, iso fixe)
  CityMeshes.tsx         Ville N&B chanfreinée (static, instancié)
  TerritoryOverlay.tsx   Aplats de possession (∝ Contrôle), icônes de bâtiments, contours d'attaque
  Radar.tsx              Minimap de possession (raids en rouge), clic = sélection
  palette.ts             Niveaux de gris par zone + palette/gris daltonien + symboles
wrangler.jsonc / vite.config.ts / tsconfig*.json
```

## Vérifications avant de terminer une tâche

```
bun run typecheck && bun run test && bun run build
```

## État actuel

- **Design** : `docs/` est passé au mode **DealerFront** (territoire, influence/contrôle, économie à 7 bâtiments, tech, factions IA, police anti-leader, victoire contrôle+blanchiment, couleurs de faction).
- **Code (P1–P9 faits — refonte OpenFront-like)** : `src/sim/` implémente les **quartiers** (propriété + Contrôle 0–100 + bâtiment), les **factions** (Membres/Produit/Cash sale/Cash propre/tech), les **bagarres**, une **IA** (bâtit, s'étend, monte la tech, tueurs), l'**économie** : **8 bâtiments** posés par **conversion** (Logement, Labo, Point de vente, Façade, Planque, Dépôt, Atelier, Contre-espionnage), chaîne **Produit → Cash sale → Cash propre**, la **tech** (Armement/Protection/Logistique, paliers débloqués par les Ateliers), le **tueur à gage** (+ contre-espionnage), la **police anti-leader** (Pression, raids, saisie, liquidation, corruption), la **diplomatie** (relations, pactes, trahisons, coalition anti-leader) et la **fin de partie** (victoire contrôle ≥ 60 % **+** 500 000 Cash propre, faillite, temps écoulé, score composite, récap). Déterministe + tests. Rendu **god-view** : **écran de sélection de ville**, overlay de possession coloré ∝ Contrôle, **contours d'attaque** (couleur de l'attaquant), **icônes de bâtiments** par type, radar cliquable, **vignette d'ambiance police**, **mode daltonien** (gris + symboles), **HUD en zones sans scroll** (barre haute ressources/objectif, gauche = ordres, droite = pilotage, bas = journal/contrôles). **Plus de personnage ni de déplacement souris/clavier.**
- **UX (P13)** : simulation **en pause pendant le tuto**, **curseur de blanchiment** (0–100 %), **sons cuelume** (boutons + événements : captures, raids, tech, corruption, fin), HUD allégé (Tech/Diplomatie repliables) et animations CSS.
- **À venir** : rien de bloquant (P1–P13 faits). Reste optionnel : coût croissant par type, sélection multiple + prévisualisation chiffrée, motifs daltoniens, overtime (codé mais désactivé), équilibrage (les parties gagnées « au score » dominent). **Agents/PNJ notables : abandonnés** (décision, voir `docs/factions.md`).
- **Équilibrage (simulation massive)** : `bun run sim:mass` (bot `bot.ts`). Constats : économie IA réparée (composition `chooseBuildType`, départ sale 2 000) ; **victoire à double condition** (contrôle ≥ 60 % **+** 500 000 Cash propre), **session plafonnée à 25 min** ; police ~64 de Pression, ~17 raids/partie. **100 seeds** : 91 victoires / 9 défaites à **20 APM** (~24 min, contrôle moyen 50 %), 95 / 5 à 30 APM. Détails dans `docs/economy.md`, `docs/combat.md`, `docs/factions.md`, `docs/police-ai.md`, `docs/win-conditions.md`.
- **Performance** : cœur sim **~2,5× plus rapide** (100 × 20 000 ticks : 42 s → 17 s) via comptages sans allocation par tick et caches (`recount`, `owned`, `underAttack`). Rendu 3D : **shadow map statique** (recalcul au changement de seed), **overlays incrémentaux** (matrices posées une fois, couleurs/contours reconstruits au changement, Contrôle quantifié à 5), **minimap** redessinée seulement si l'état change, plus de `computeBoundingSphere` inutile. Procgen : `tiles` **paresseux** + `archetypeOf(seed)` (écran de sélection sans générer la ville).
- **Aucune base de données** (solo, sans méta).
