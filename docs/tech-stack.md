# Tech Stack — Cadrage technique (DealerFront)

> Statut : **v2 (DealerFront)** — solo, core déterministe, style intents → executions. Prépare un multi éventuel sans le livrer.

## Objectif

Fixer les choix techniques structurants du mode god-view : simulation de contrôle territorial, économie, factions IA, rendu large, et **déterminisme** (reproductibilité, tests).

## Choix retenus

- **Runtime** : **solo** au MVP, **tout client-side** (pas de serveur de jeu). Cloudflare Workers conservé pour l'API statique/utilitaires (`/api/*`), pas pour la simulation.
- **Core de simulation** : **TypeScript déterministe**, **pur** (aucune dépendance React/DOM), à pas fixe **10 Hz**. Isolé pour pouvoir tourner dans un **Web Worker** plus tard.
- **Style d'architecture** : **`intents → executions`** (inspiré d'OpenFront) : les actions du joueur et des IA deviennent des **intents**, convertis en **executions** qui sont les seules à muter l'état. Découple UI et simulation, facilite les tests et un éventuel multi.
- **Rendu** : **Three.js** en projection **orthographique** (iso 2.5D), **god view large** (pan/zoom, iso fixe). Overlays de possession (aplats colorés) au-dessus du N&B.
- **UI** : **React + TypeScript**.
- **Pathfinding** : A* sur grille (rues) pour les convois/agents si besoin.
- **Déterminisme** : PRNG seedé ; même seed → même ville, spawns, neutres, IA.
- **Perf** : instancing, `memo`, mises à jour ciblées ; beaucoup de quartiers/unités → rendu symbolique (overlays) plutôt que modèles détaillés.

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Tick de simulation | 10 Hz (100 ms) | fixé |
| Grille | 48×48 tuiles → 16×16 quartiers | fixé |
| Factions | 4–6 | fixé |
| Rendu | Three.js ortho, iso fixe, god view | fixé |
| Déterminisme | génération + simulation seedées | fixé |
| Web Worker | non au MVP, prévu | différé |
| Multi (Workers + DO) | post-MVP | différé |
| Budget perf (agents/quartiers) | **TBD** | TBD |

## Cas limites

- **Beaucoup d'unités/États** : privilégier les overlays et l'instancing ; éviter les modèles détaillés par quartier.
- **Déterminisme vs 60 FPS** : la simulation (10 Hz) est **indépendante** du rendu (accumulateur à pas fixe) — conserve la reproductibilité.
- **Extraction multi future** : garder le core sans dépendance navigateur et l'isoler (Worker-ready) ; coordonner plus tard via **Durable Objects** (Cloudflare) si on passe en ligne.
- **Sérialisation** : intents/executions et logs d'événements **sérialisables** (replay, validation).

## Dépendances

- `territory.md`, `combat.md`, `economy.md` — charge de simulation.
- `factions.md` — IA (charge).
- `ui-ux.md`, `art-direction.md` — rendu et overlays.
- `procgen.md` — déterminisme, validation.

## Critères de validation

- [ ] La simulation tient à 10 Hz avec 4–6 factions sur 256 quartiers.
- [ ] Le rendu god-view est fluide (overlays, instancing).
- [ ] Une seed rejouée reproduit ville, spawns et IA.
- [ ] Le core est sans dépendance navigateur (Worker-ready).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Solo/multi | **Solo** au MVP, multi différé |
| 2 | Serveur de jeu | Aucun (tout client-side) |
| 3 | Architecture sim | **intents → executions**, core déterministe 10 Hz |
| 4 | Rendu | Three.js ortho, god view large + overlays |
| 5 | Worker/DO | prévu mais différé |
