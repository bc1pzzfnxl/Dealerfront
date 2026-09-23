# Territory — Quarters, Members and Control

> Status: **v1 (DealerFront)** — heart of the god-view mode, inspired by OpenFront (ideas, no code; OpenFront is AGPL-3).

## Objective

Define **taking control of the city**: who owns what, how you expand your territory, how you defend it, and how it is lost. It is the foundation of the mode: conquest ↔ economy. All other specs hang off it.

## Rules

### Quarter = real area

- Territory unit = **IRIS quarter** of the real map (Paris, **529 quarters**, see `procgen.md`).
- Each quarter has: an **owner** (faction or **neutral**), a **Control ∈ [0, 100]** and a market **profile** (`economy.md`).
- **Adjacency**: two quarters are neighbors if they **share a border** (common edges; a mere corner does not count). Expansion and attacks propagate by adjacency (BFS).

### Members (troop resource)

- Each faction has a **Members pool**, equivalent to OpenFront's "troops".
- **Production** per tick: `(8 × Σdemand of owned quarters + 25 × Σdemand of housing) × (1 − members / maxMembers)` (the **local demand** weights it, see `economy.md`).
- **`maxMembers = 2000 + quarters × 1500 + housing × 2000 + depots × 2000`**.
- Members are used to **expand** (neutral), **attack** (faction) and **defend** (reinforcement). See `combat.md`.

### Control of a quarter

- An owned quarter has Control that **regenerates** toward 100 (∝ available Members, slowed by recent damage).
- A **Safehouse** increases resistance (defense); the zone type modulates defense (see `combat.md`).
- At **Control = 0**, the quarter is **captured** by the attacker (buildings transferred).

### Expansion onto neutrals

- Attacking a **neutral** quarter costs Members (neutral garrison) and follows the "neutral" branch of `combat.md`.
- Neutral quarters can be **defended** (garrison): they do not fall for free.

### Anti-snowball — isolated clusters

- From OpenFront: a **cluster** of owned quarters, **fully encircled** by a single enemy faction (or the police), is **lost** (captured by the encircler).
- Prevents absurd growth and rewards encirclement.

### Spawn and immunity

- **6 factions** (player + 5 AI, see `factions.md`).
- Spawn: **4 farthest built quarters** (greedy sampling), 1 starting quarter + initial Members.

## Numeric parameters

| Parameter | Starting value | Status |
|---|---|---|
| Map | Paris IRIS — 529 real quarters | fixed |
| Factions | 6 (player + 5 AI) | fixed |
| Max Control | 100 | fixed |
| Initial Control (captured quarter) | ~30 | to balance |
| `maxMembers` | `2000 + quarters × 1500 + housing × 2000 + depots × 2000` | to balance |
| Member production | `(8 × quarters + 25 × housing) × (1 − members/max)` /tick | to balance |
| Housing development cost | 800 members | to balance |
| Developed recruitment | +25 Members/tick (lost if the quarter is captured) | to balance |
| Starting Members (faction) | 3,000 | to balance |
| Neutral garrison (per quarter) | 60 Control | fixed |
| Spawns | 4 spaced built quarters (greedy) | fixed |
| Control regeneration | +X/tick after Y s without damage | TBD |

## Edge cases

- **Encircled quarter**: isolated cluster → lost (anti-snowball); trace the cause.
- **Eliminated faction** (0 quarters): its buildings are destroyed or transferred (to decide → `TBD`).
- **Neutral quarter without a garrison**: free expansion? No — a minimum garrison is guaranteed at generation.
- **Contested Control**: if two attacks target the same quarter on the same tick, deterministic resolution (stable faction order).
- **Crowded spawn**: if no valid position (min distance), progressive relaxation then fallback (OpenFront style).

## Dependencies

- `pillars.md` — R1–R4 (causality, no rubber-banding).
- `combat.md` — attack/defense formulas, capture.
- `economy.md` — Members, buildings (Depot, Safehouse).
- `factions.md` — AI, diplomacy, clusters.
- `police-ai.md` — the police as an opposing faction.
- `win-conditions.md` — control threshold.
- `procgen.md` — pre-existing city, spawns, neutrals.

## Validation criteria

- [ ] A faction can expand its territory onto neutrals and onto an enemy faction.
- [ ] Control regenerates, rises and falls in a traceable way (causal audit).
- [ ] A captured quarter transfers its buildings.
- [x] A captured quarter transfers its buildings.
- [x] Reproducible map (generated and versioned file).

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Territory unit | IRIS quarter (529 real quarters) |
| 2 | Model | Owner + Control 0–100 + Members pool |
| 3 | Expansion | By adjacency (BFS), cost in Members |
| 4 | Anti-snowball | Isolated clusters lost (OpenFront style) |
| 5 | Factions | 4, spaced spawns (greedy sampling) |
| 6 | Adjacency | Shared borders (edges), computed in `scripts/build-paris-map.ts` |
