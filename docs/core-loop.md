# Core Loop — Game loop and pacing of a game

> Status: **v3 (DealerFront)** — balanced god-view loop (management ↔ conquest).

## Objective

Describe the cartel player's activity loop and the macro pacing of a game (**≈ 25 min**): what they do continuously, what they seek to maximize, and how the game ends.

## Rules

### Gameplay loop

1. **Produce** — **Labs** (owned quarters) generate **Product**.
2. **Sell** — **Storefronts** convert Product into **Dirty cash**.
3. **Launder** — **Fronts** convert Dirty cash into **Clean cash** (commission) — basis of the score and victory.
4. **Expand** — **brawls** conquer **neutral** or enemy quarters (`combat.md`), which increases max Influence and income.
5. **Equip** — **Workshops** unlock **tech** (Armament/Protection/Logistics, `tech.md`) that changes the outcome of brawls.
6. **Defend** — **Safehouses** and reinforcements protect quarters; **Counter-intel** against hitmen.
7. **Manage the police** — **Pressure** rises with the leader's control share; you endure it or **corrupt** it (`police-ai.md`).
8. **Manage the gangs** — pacts, embargoes, betrayals, agents (`factions.md`).

### Victory / defeat condition

- **Victory**: **last cartel in play** (battle royale, see `win-conditions.md`).
- **Defeats**: 0 quarters (total liquidation), bankruptcy, **police liquidation**.

### Macro pacing of a game

| Phase | Marker | Characteristic |
|---|---|---|
| **Setup** | ~0–5 min | 1–2 quarters, a few Labs/Storefronts, neutral everywhere else, discreet AIs |
| **Expansion** | ~5–15 min | Conquest of neutrals, first buildings, first pacts/betrayals, weak police |
| **Quarter war** | ~15–25 min | Clashes between gangs, tech, hitmen, police raids against the leader |
| **Closing** | end | Only one cartel remains: the weak are finished off (encirclement), the police may liquidate |

Pacing is driven by **causality** (control + Heat), not by a hard clock.

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Duration | unlimited (until elimination) | fixed |
| Victory condition | last survivor (no threshold) | fixed |
| Number of factions | 6 | fixed |
| Quarters | 529 (Paris IRIS) | fixed |
| Endgame | causal (victory/defeat) | fixed |

## Edge cases

- **Passive waiting**: doing nothing does not lower base difficulty, but lets the AIs expand → inaction is punished by the world (not by an artifice).
- **Leader too strong**: the police ramp up (anti-snowball) → no free runaway.
- **Bankruptcy**: no more Cash (dirty and clean) for 300 ticks (30 s) → defeat.
- **Elimination**: 0 quarters → immediate defeat.
- **Simultaneous eliminations**: deterministic tiebreak by quarters, then Members, then Cash (`win-conditions.md`).

## Dependencies

- `pillars.md` — R1/R3/R8.
- `territory.md` — quarters, Influence, control.
- `economy.md` — production, sales, laundering.
- `combat.md` — brawls, capture.
- `tech.md`, `factions.md`, `police-ai.md`.
- `win-conditions.md`, `scoring.md`, `ui-ux.md`.

## Validation criteria

- [ ] A full run is described by the 8 steps, with no missing step.
- [ ] The economy loop and the conquest loop feed each other (neither is optional).
- [ ] Every endgame is causal and traceable.
- [ ] No runaway: the leader faces increasing pressure.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Loop | 8 steps (produce→sell→launder→expand→equip→defend→police→gangs) |
| 2 | Balance | Economy ↔ conquest on equal footing |
| 3 | Victory | Last survivor (battle royale) |
| 4 | Duration | 20–30 min, driven by causality |
