# Win Conditions — Victory, defeat and endgame

> Status: **v2 (battle royale)** — no more control, cash or time threshold: **last cartel in play**.
> Solo vs AI, **6 factions**, game with no time limit.

## Objective

Define DealerFront's **victory**, **defeat** and **endgame** conditions, as well as the **end recap**. The game is a **battle royale**: you win by staying the **last cartel in play**. The economy is no longer a victory condition but the **engine** of war (Members, tech, buildings).

## Rules

### Victory

**Single** victory: be the **last cartel in play**.

- A faction is **eliminated** when it owns no more quarters.
- The game ends as soon as the player is the only survivor (`aliveCount() === 1`).
- **No control threshold, no Clean cash threshold, no clock.** Total domination is the means, not the condition: holding an overwhelming share triggers the police (anti-snowball), so winning too slowly or too brutally costs you.

### Defeats

Three causes of defeat, all **traceable**:

1. **Elimination**: the player drops to **0 quarters** → immediate defeat.
2. **Bankruptcy**: **Clean cash AND Dirty cash at 0** for **300 ticks (30 s)** → defeat. A treasury that goes back > 0 **rearms** the window.
3. **Police liquidation**: **Pressure** reaches the liquidation threshold (`docs/police-ai.md`) → immediate defeat.

- An **eliminated** player can no longer act; the game is over for them (frozen recap).
- If **several factions are eliminated on the same tick**, the tiebreak is deterministic (quarters, Members, Cash, id).

### Endgame

- **No time limit**: the game is played until only one cartel remains (or until the player's defeat).
- The AI **finishes off the weak** (elimination priority) to guarantee a resolution — otherwise games would stall with several survivors.

### End recap

The recap (see `docs/ui-ux.md`) shows: **final rank**, **owned quarters / 992**, **laundered Clean cash**, **quarters taken**, **gangs eliminated**, **raids/seizures suffered**, **survival time**, explicit end cause (`Victory (last survivor)`, `Elimination`, `Bankruptcy`, `Police liquidation`).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Map | Paris IRIS — 992 quarters | fixed |
| Factions | **6** (player + 5 AI gangs) | fixed |
| Victory condition | last cartel in play | fixed |
| Time limit | **none** | fixed |
| Control / cash threshold | **removed** | fixed |
| Bankruptcy window | 300 ticks (30 s) | fixed |
| Encirclement | closed cluster ≥ 8 quarters **and** ≥ 35% of the faction **and** smaller than the encircler | fixed |

## Edge cases

- **Last survivor by force**: if the player reaches ~80% of the map, the police can liquidate them before the end (deliberate anti-snowball).
- **Stagnation**: the AI prioritizes eliminating the weak → no infinite game with 4 survivors.
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
