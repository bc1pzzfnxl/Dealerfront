# Scoring — Final score (DealerFront)

> Status: **v2 (battle royale)** — the composite score is replaced by a **power standings** (quarters, Members, cash). The recap shows **survival + stats**.

## Objective

Compute a **realistic and transparent final score** from events that actually occurred, and a **causal recap** of the endgame.

## Rules

### Computation model

```
Score = Clean_cash × (1 + b_control + b_diversity + b_discretion)
        − penalties (police suffered, quarters lost)
```

- **Base = laundered Clean cash** (only actually laundered money counts).
- **`b_control`**: bonus tied to the share of controlled quarters at endgame (up to +30%).
- **`b_diversity`**: bonus for the variety of quarters/fronts exploited (up to +10%).
- **`b_discretion`**: bonus for keeping **police Pressure** low (up to +20%).
- **Penalties**: police seizures (Clean cash lost), quarters lost at endgame.

### Components

| Component | Role | Detail |
|---|---|---|
| **Clean cash** | Score base | Actually laundered money. |
| **Final control** | Main bonus | Share of the 992 controlled quarters (victory objective). |
| **Diversity** | Moderate bonus | Number of distinct quarters/fronts exploited. |
| **Discretion** | Bonus | Time spent below police Pressure thresholds. |
| **Penalties** | Malus | Seizures, quarters lost. |
| **Violence** | Malus | Gang eliminations (see below). |

### Violence

- In DealerFront mode, violence goes through **brawls** and **hitmen**.
- **Gang eliminations** (factions reduced to 0) weigh negatively (multiplier), in a **traceable** way.
- A "clean" run (no elimination) must be able to **outrank** a richer but violent run.

### Traceable backend

- Each event (capture, construction, laundering, raid, corruption, elimination) is **logged** with its **systemic cause**.
- The **recap** details the **causal chain** (why Pressure rose, which quarter flipped), consistent with R6.
- **No "gamified" rounding**.

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Base | Clean cash | fixed |
| `b_control` | 0 → +30% | to balance |
| `b_diversity` | 0 → +10% | to balance |
| `b_discretion` | 0 → +20% | to balance |
| Elimination multiplier | strongly negative (coefficients TBD) | TBD |
| Police seizure penalty | **TBD** | TBD |
| Low Pressure thresholds (discretion) | **TBD** (`police-ai.md`) | TBD |

## Edge cases

- **Draw / simultaneous end**: deterministic tiebreak (e.g. control, then Clean cash, then faction order) — `win-conditions.md`.
- **Eliminated early**: score frozen at the elimination state, recap shown.
- **Huge Clean cash but 0 control**: the control bonus cannot compensate for the defeat (victory requires both).
- **No component depends on base difficulty** (fairness).

## Dependencies

- `pillars.md` — R1/R2/R3/R6.
- `core-loop.md`, `territory.md`, `economy.md`, `combat.md`, `police-ai.md`, `win-conditions.md`.
- `ui-ux.md` — recap presentation.

## Validation criteria

- [ ] The score is entirely derivable from the event log.
- [ ] A run without elimination outranks a richer violent run (scenario test).
- [ ] The recap explains the end cause in one understandable sentence.
- [ ] No component depends on base difficulty.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Base | Clean cash |
| 2 | Bonus | Control (+30%), diversity (+10%), discretion (+20%) |
| 3 | Violence | Eliminations = traceable malus |
| 4 | Backend | Individual causal log, recap without rounding |

---

## Implementation (P6) — formula in force

> **Authoritative** section for `World.score` / `World.rankings` (`src/sim/world.ts`).

```
score = max(0, Clean_cash × (1 + b_control + b_diversity + b_discretion) × violence − penalties)
```

| Term | Value |
|---|---|
| `b_control` | `0.30 × min(1; control / 0.60)` |
| `b_diversity` | `0.10 × (building types present / 8)` |
| `b_discretion` | `0.20 × (1 − police Pressure / 100)` |
| `violence` | `1 − min(0.5; 0.15 × eliminations)` |
| `penalties` | `seizures × 50,000 + quarters lost × 5,000` |

- **Eliminated** faction → score **0**.
- **Standings** (deterministic tiebreaks): score → Clean cash → control → id.
- The recap exposes score and rank (`World.summary()`), displayed by `App.tsx`.
