# Win Conditions — Victory and endgame

> Status: **v2 (battle royale)** — no more control, cash or time threshold: **last cartel in play**.
> AI vs AI, **6 factions**, game with no time limit. Every faction is driven by an external agent: nothing here is scoped to a "player" seat.

## Objective

Define DealerFront's **victory** and **endgame** conditions, as well as the **end recap**. The game is a **battle royale**: you win by staying the **last cartel in play**. The economy is no longer a victory condition but the **engine** of war (Members, tech, buildings).

## Rules

### Victory

**Single** victory: be the **last cartel in play**.

- A faction is **eliminated** when it owns no more quarters.
- The game ends as soon as a single faction survives (`aliveCount() === 1`).
- **No control threshold, no Clean cash threshold, no clock.** Total domination is the means, not the condition: holding an overwhelming share triggers the police (anti-snowball), so winning too slowly or too brutally costs you.

### Eliminations (never a game over on their own)

Three ways to lose your quarters, all **traceable** — the game goes on without you:

1. **Conquest**: drop to **0 quarters** → eliminated (`eliminated = true`, decided by the map in `recount()`).
2. **Bankruptcy**: **Clean cash AND Dirty cash at 0** for **300 ticks (30 s)** → the cartel **collapses**: its quarters go **neutral** (up for grabs). A treasury that goes back > 0 **rearms** the window. Tracked **per faction** (`brokeTicks`).
3. **Police liquidation**: **Pressure** reaches the liquidation threshold (`docs/police-ai.md`) → the leader is **dismantled** (quarters go neutral), whatever its seat.

- An **eliminated** faction can no longer win; the game continues until one cartel remains.
- If **several factions are eliminated on the same tick**, the tiebreak is deterministic (quarters, Members, Cash, id).
- Guard: mutual annihilation (`aliveCount() === 0`) ends the game with no winner.

### Endgame

- **No time limit**: the game is played until only one cartel remains.
- An eliminated faction's agent should stop acting (its intents keep failing); the lobby tells it the game goes on without it.

### End recap

The recap (see `docs/ui-ux.md`) shows: **final rank**, **owned quarters / 992**, **laundered Clean cash**, **quarters taken**, **gangs eliminated**, **raids/seizures suffered**, **survival time**, explicit end cause (`Victory (last survivor)`, `Mutual annihilation`).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Map | Paris IRIS — 992 quarters | fixed |
| Factions | **6**, one per external agent | fixed |
| Victory condition | last cartel in play | fixed |
| Time limit | **none** | fixed |
| Control / cash threshold | **removed** | fixed |
| Bankruptcy window | 300 ticks (30 s) | fixed |
| Encirclement | closed cluster ≥ 8 quarters **and** ≥ 35% of the faction **and** smaller than the encircler | fixed |

## Edge cases

- **Last survivor only**: conquest, bankruptcy or liquidation eliminate a faction but never end the game (except mutual annihilation).
- **Stagnation**: with no internal AI, a stalled table (agents idle) never resolves — the 5 min idle clock stops the sim; the host restarts or deletes it.
- **Tiny cluster**: a cluster < 8 quarters or < 35% of the faction does not capitulate (no free nibbling).
- **Near-complete empire**: a cluster larger than the encircler never capitulates.

## Dependencies

- `pillars.md` — R1/R3/R8 (causal ending).
- `combat.md` — capture, encirclement.
- `police-ai.md` — liquidation, anti-snowball.
- `factions.md` — 6 factions, elimination AI.
- `npc-events.md` — in-run choice events.
- `scoring.md` — standings (power).

## Validation criteria

- [x] No victory while a rival is in play.
- [x] A game eventually concludes (elimination of a camp).
- [x] Every ending is causal and traceable.
- [x] Massive simulation: 94 wins / 6 losses (100 seeds), 0 no-end.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Victory condition | **Last survivor** (battle royale) |
| 2 | Time | Unlimited (no more session) |
| 3 | Control/cash thresholds | **Removed** |
| 4 | Factions | **6** |
| 5 | Police | Kept, lethal beyond 80% domination |
| 6 | Recap | Survival + stats, no composite score |
