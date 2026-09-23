# Tech Stack — Technical framing (DealerFront)

> Status: **v2 (DealerFront)** — solo, deterministic core, intents → executions style. Prepares for a possible multiplayer without shipping it.

## Objective

Fix the structuring technical choices of god-view mode: territorial control simulation, economy, AI factions, wide rendering, and **determinism** (reproducibility, tests).

## Chosen options

- **Runtime**: **solo** = **client-side** (no game server). **Agent-vs-agent arena** = **server**: 1 **Durable Object** per game (authoritative, free plan), **HTTP + MCP** API (`/mcp`), **WebSocket** spectator. Cloudflare Workers serves the static/utility API (`/api/*`). See `arena.md` and `../MCP.md`.
- **Simulation core**: **deterministic TypeScript**, **pure** (no React/DOM dependency), at a fixed **10 Hz** step. Isolated so it can run in a **Web Worker** later.
- **Architecture style**: **`intents → executions`** (inspired by OpenFront): player and AI actions become **intents**, converted into **executions** that are the only ones to mutate state. Decouples UI and simulation, eases testing and possible multiplayer.
- **Rendering**: **mapcn / MapLibre** on the **real map** (Paris IRIS) — muted basemap, possession/faction fills via `feature-state`. Static JSON, PWA-friendly.
- **UI**: **React + TypeScript**.
- **Determinism**: generated/versioned map + seeded PRNG for the simulation; same seed → same run, AI included.
- **Perf**: targeted updates (`feature-state` per quarter, `recount`/`owned`/BFS caches), symbolic rendering (fills + dots) rather than detailed models.

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Simulation tick | 10 Hz (100 ms) | fixed |
| Map | Paris IRIS — 529 real quarters | fixed |
| Factions | 4 | fixed |
| Rendering | mapcn (Map / MapGeoJSON / MapArc / MapControls) on MapLibre | fixed |
| Determinism | versioned map + seeded simulation | fixed |
| Web Worker | not at MVP, planned | deferred |
| Multiplayer (Workers + DO) | **Agent-vs-agent arena** | v1 (see `arena.md`) |
| Perf budget (agents/quarters) | **TBD** | TBD |

## Edge cases

- **Many units/states**: prefer overlays and instancing; avoid detailed per-quarter models.
- **Determinism vs 60 FPS**: the simulation (10 Hz) is **independent** of rendering (fixed-step accumulator) — preserves reproducibility.
- **Multiplayer extraction (done)**: the core has no browser dependency; the arena runs it in a **Durable Object** (Cloudflare), driven by external agents via `applyIntent`.
- **Serialization**: intents/executions and event logs **serializable** (replay, validation).

## Dependencies

- `territory.md`, `combat.md`, `economy.md` — simulation load.
- `factions.md` — AI (load).
- `ui-ux.md`, `art-direction.md` — rendering and overlays.
- `procgen.md` — determinism, validation.

## Validation criteria

- [x] The simulation holds at 10 Hz with 6 factions over 529 quarters.
- [ ] God-view rendering is smooth (overlays, instancing).
- [x] A replayed seed reproduces the run and the AI (identical map).
- [ ] The core has no browser dependency (Worker-ready).

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Solo/multi | **Solo** at MVP, multiplayer deferred |
| 2 | Game server | None (all client-side) |
| 3 | Sim architecture | **intents → executions**, deterministic 10 Hz core |
| 4 | Rendering | mapcn / MapLibre on real map, muted basemap |
| 5 | Worker/DO | planned but deferred |


### Real map (v3)

- **Paris IRIS**: 529 real quarters, zones derived from the IRIS type, market profiles (`demand`/`wealth`), adjacency by shared edges (`scripts/build-paris-map.ts`).
- **Rendering**: **mapcn** (`Map`/`MapGeoJSON`/`MapArc`/`MapControls`) on MapLibre; possession + Control + heat via `feature-state`, convoys as animated dots.
- **Old mode removed**: procedural 16×16/24×24 grid and isometric 3D rendering (Three.js / R3F) removed.
