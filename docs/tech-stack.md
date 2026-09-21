# Tech Stack — Cadrage technique (DealerFront)

> Statut : **v2 (DealerFront)** — solo, core déterministe, style intents → executions. Prépare un multi éventuel sans le livrer.

## Objectif

Fixer les choix techniques structurants du mode god-view : simulation de contrôle territorial, économie, factions IA, rendu large, et **déterminisme** (reproductibilité, tests).

## Choix retenus

- **Runtime** : **solo** = **client-side** (pas de serveur de jeu). **Arène agent vs agent** = **serveur** : 1 **Durable Object** par partie (autoritaire, plan gratuit), API **HTTP + MCP** (`/mcp`), spectateur **WebSocket**. Cloudflare Workers sert l'API statique/utilitaires (`/api/*`). Voir `arena.md` et `../MCP.md`.
- **Core de simulation** : **TypeScript déterministe**, **pur** (aucune dépendance React/DOM), à pas fixe **10 Hz**. Isolé pour pouvoir tourner dans un **Web Worker** plus tard.
- **Style d'architecture** : **`intents → executions`** (inspiré d'OpenFront) : les actions du joueur et des IA deviennent des **intents**, convertis en **executions** qui sont les seules à muter l'état. Découple UI et simulation, facilite les tests et un éventuel multi.
- **Rendu** : **mapcn / MapLibre** sur la **carte réelle** (Paris IRIS) — fond muet, aplats de possession/faction par `feature-state`. JSON statique, PWA-friendly.
- **UI** : **React + TypeScript**.
- **Déterminisme** : carte générée/versionnée + PRNG seedé pour la simulation ; même seed → même déroulé, IA comprise.
- **Perf** : mises à jour ciblées (`feature-state` par quartier, caches `recount`/`owned`/BFS), rendu symbolique (aplats + points) plutôt que modèles détaillés.

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Tick de simulation | 10 Hz (100 ms) | fixé |
| Carte | Paris IRIS — 992 quartiers réels | fixé |
| Factions | 4 | fixé |
| Rendu | mapcn (Map / MapGeoJSON / MapArc / MapControls) sur MapLibre | fixé |
| Déterminisme | carte versionnée + simulation seedée | fixé |
| Web Worker | non au MVP, prévu | différé |
| Multi (Workers + DO) | **Arène agent vs agent** | v1 (voir `arena.md`) |
| Budget perf (agents/quartiers) | **TBD** | TBD |

## Cas limites

- **Beaucoup d'unités/États** : privilégier les overlays et l'instancing ; éviter les modèles détaillés par quartier.
- **Déterminisme vs 60 FPS** : la simulation (10 Hz) est **indépendante** du rendu (accumulateur à pas fixe) — conserve la reproductibilité.
- **Extraction multi (faite)** : le core est sans dépendance navigateur ; l'arène le fait tourner dans un **Durable Object** (Cloudflare), piloté par des agents externes via `applyIntent`.
- **Sérialisation** : intents/executions et logs d'événements **sérialisables** (replay, validation).

## Dépendances

- `territory.md`, `combat.md`, `economy.md` — charge de simulation.
- `factions.md` — IA (charge).
- `ui-ux.md`, `art-direction.md` — rendu et overlays.
- `procgen.md` — déterminisme, validation.

## Critères de validation

- [x] La simulation tient à 10 Hz avec 6 factions sur 992 quartiers.
- [ ] Le rendu god-view est fluide (overlays, instancing).
- [x] Une seed rejouée reproduit le déroulé et l'IA (carte identique).
- [ ] Le core est sans dépendance navigateur (Worker-ready).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Solo/multi | **Solo** au MVP, multi différé |
| 2 | Serveur de jeu | Aucun (tout client-side) |
| 3 | Architecture sim | **intents → executions**, core déterministe 10 Hz |
| 4 | Rendu | mapcn / MapLibre sur carte réelle, fond muet |
| 5 | Worker/DO | prévu mais différé |


### Carte réelle (v3)

- **Paris IRIS** : 992 quartiers réels, zones déduites du type IRIS, profils marché (`demand`/`wealth`), adjacence par arêtes partagées (`scripts/build-paris-map.ts`).
- **Rendu** : **mapcn** (`Map`/`MapGeoJSON`/`MapArc`/`MapControls`) sur MapLibre ; possession + Contrôle + heat par `feature-state`, convois en points animés.
- **Ancien mode supprimé** : grille procédurale 16×16/24×24 et rendu 3D isométrique (Three.js / R3F) retirés.
