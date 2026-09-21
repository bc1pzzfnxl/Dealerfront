# Tech — Gear progression

> Status: **v1 (DealerFront)** — cartel tech tree, 3 branches × 5 tiers.
> Part of the god-view mode (6 factions, 992 quarters, battle royale).

## Objective

Give the cartel a **readable and optional power curve**: convert accumulated Clean cash (`economy.md`) into **military** (Armament), **defensive** (Protection) and **logistical** (Logistics) advantages. Tech must create **mutually exclusive choices over time** (where to invest the Workshop and money) and feed **directly** into the combat formulas (`combat.md`).

## Rules

### 1. Prerequisite — the Workshop

- **A faction has no tech without a Workshop.** The **Workshop** (`economy.md`) is the building that **unlocks** and **upgrades** tiers.
- Each Workshop provides **1 research channel**: you only progress **one tier at a time and per channel**. Multiple Workshops allow parallelizing different branches (or speeding up, to balance).
- Tech is **faction-wide** (not per quarter) once unlocked. It is lost if **all Workshops** are destroyed (revert to acquired tiers? → no: acquired tiers are kept, only *in-progress progress* is lost; to confirm in playtest).
- Researching a tier **occupies** a Workshop for its duration: tech **competes with production** if the Workshop also served as an economic building (see `economy.md`).

### 2. The 3 branches

| Branch | Domain | Main effect |
|---|---|---|
| **Armament** | Attack power | Multiplies assault damage on quarters; unlocks the **Hitman** |
| **Protection** | Quarter defense | Multiplies quarter defense; activates **Counter-intel** |
| **Logistics** | Expansion/convoy speed | Speeds up Influence movement, conquest and convoys |

### 3. Tiers and effects

Each branch has **5 tiers** (P0 = base, P1→P4 researchable). **Multiplicative** effects on the `combat.md` formulas.

**Armament** — attack power (TBD / to balance):

| Tier | Attack multiplier | Unlock |
|---|---|---|
| P0 | ×1.00 | — |
| P1 | ×1.20 | — |
| P2 | ×1.45 | — |
| P3 | ×1.75 | **Hitman** |
| P4 | ×2.10 | — |

**Protection** — quarter defense (to balance):

| Tier | Defense multiplier | Unlock |
|---|---|---|
| P0 | ×1.00 | — |
| P1 | ×1.15 | — |
| P2 | ×1.35 | — |
| P3 | ×1.60 | **Active Counter-intel** |
| P4 | ×1.90 | — |

**Logistics** — expansion/convoy speed (to balance):

| Tier | Speed/logistics multiplier | Unlock |
|---|---|---|
| P0 | ×1.00 | — |
| P1 | ×1.15 | — |
| P2 | ×1.35 | Accelerated Influence convoys |
| P3 | ×1.55 | — |
| P4 | ×1.80 | — |

### 4. Key unlocks

- **Hitman** (Armament P3): targeted **assassination** action, **area damage** — eliminates an enemy agent/leader and deals damage around the target. Cost in Clean cash + Influence, long cooldown. Details in `combat.md` and `factions.md`.
- **Active Counter-intel** (Protection P3): amplifies the Counter-intel building (`economy.md`); its reduction of enemy hitman/agent effectiveness goes from **−40%** (base) to **−70%** (to balance), and its radius expands.

### 5. Research costs and duration

**Increasing** scale, paid in **Dirty cash** then **Clean cash** for high tiers (to balance):

| Tier | Cost | Currency | Research duration |
|---|---|---|---|
| P1 | 10,000 | Dirty cash | 60 ticks (6 s) |
| P2 | 25,000 | Dirty cash | 120 ticks (12 s) |
| P3 | 50,000 | Clean cash | 300 ticks (30 s) |
| P4 | 120,000 | Clean cash | 600 ticks (60 s) |

- The **cost is per branch and per tier**: investing in one branch does not affect the price of the others, but a tier **N+1** requires tier **N** of the same branch.
- Tiers **P3 and P4** require **Clean cash**: high-end tech **directly competes with the victory threshold** (`win-conditions.md`) — central trade-off.

### 6. Link with combat (`combat.md`)

- `combat.md` defines the assault and defense formulas; tech **multiplies** them at computation time:
  - Effective attack = `base_attack × M_Armament`.
  - Effective defense = `base_defense × M_Protection × Safehouse_bonus`.
  - Conquest speed / Influence transfer = `base_speed × M_Logistics`.
- Tech **never bypasses** the combat rules: it changes the **coefficients**, not the **local victory conditions** or causality.
- **Hitman** introduces an **off-front-line** action (targeted assassination) that must be resolved by `combat.md` (range, cooldown, area damage, countermeasures).

## Numeric parameters

| Parameter | Starting value | Status |
|---|---|---|
| Branches | 3: Armament, Protection, Logistics | fixed |
| Tiers / branch | 5 (P0 base + P1–P4) | fixed |
| Armament multipliers | ×1.00 / 1.20 / 1.45 / 1.75 / 2.10 | to balance |
| Protection multipliers | ×1.00 / 1.15 / 1.35 / 1.60 / 1.90 | to balance |
| Logistics multipliers | ×1.00 / 1.15 / 1.35 / 1.55 / 1.80 | to balance |
| Costs P1–P4 | 10k / 25k / 50k / 120k | to balance |
| Currencies | P1–P2 Dirty cash, P3–P4 Clean cash | to balance |
| Research durations | 60 / 120 / 300 / 600 ticks | to balance |
| Channels per Workshop | 1 | fixed |
| Loss of in-progress progress | yes if all Workshops are destroyed | to balance |
| Acquired tiers after losing Workshops | kept | fixed |
| Hitman | Armament P3 | fixed (values TBD) |
| Hitman cost / cooldown | **TBD** | TBD |
| Counter-intel base | −40% | fixed |
| Active Counter-intel (Protection P3) | −70%, expanded radius | to balance |
| Multi-Workshop parallel research | allowed (1 channel/Workshop) | to balance |

## Edge cases

- **No Workshop**: no research possible; any unlocked tech stays active. Destroying Workshops does **not remove** acquired tiers, but **stops** in-progress progress.
- **Workshop destroyed during research**: the in-progress research is **lost**, the cost already paid is **lost** (no refund), the queue resumes at the next unacquired tier.
- **Multiple Workshops**: can parallelize several branches; the same tier cannot be researched twice (no tech "stock").
- **Resale/reconquest of a Workshop**: a captured enemy Workshop becomes functional for the conqueror; enemy tech is **never** stolen (no tech espionage at MVP).
- **Hitman without a target**: the action is canceled and the cost not consumed (or partially refunded, to decide); no damage "into the void".
- **Branch imbalance**: a massive investment in Armament must remain **counterable** by Protection + Safehouses; if a branch dominates, adjust the multipliers (main lever) before the costs.
- **Tech vs victory**: a player who over-invests in P3/P4 may no longer reach the Clean cash threshold within the allotted time — intended trade-off, to watch in playtest.

## Dependencies

- `economy.md` — Workshop (prerequisite), Counter-intel (base), costs in Dirty/clean cash.
- `combat.md` — attack/defense formulas modified by the multipliers; Hitman resolution.
- `territory.md` — scope of Logistics (expansion, convoys, Influence transfers).
- `win-conditions.md` — competition between P3/P4 tech and the Clean cash threshold.
- `factions.md` — Hitman targets and enemy agents affected by Counter-intel.
- `scoring.md` — traceability of tech investments in the causal recap.

## Validation criteria

- [ ] No branch can be upgraded without a Workshop (hard prerequisite verified).
- [ ] Tiers are **cumulative** (impossible to buy P3 without P2).
- [ ] Each tech multiplier is **visible in a testable combat computation** (`combat.md`).
- [ ] A player who invests everything in a single branch remains **countered** by a combination of the other two + Safehouses.
- [ ] The Hitman cannot target an allied/neutral faction or deal damage without a valid target.
- [ ] Destroying all Workshops causes neither a soft-lock nor the loss of acquired tiers.
- [ ] The tech ↔ victory threshold trade-off is measurable in playtest (over-investment punitive, not suicidal).

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Prerequisite | Workshop required to unlock/upgrade tech |
| 2 | Structure | 3 branches × 5 tiers (P0 base + P1–P4) |
| 3 | Branches | Armament (attack), Protection (defense), Logistics (expansion/convoys) |
| 4 | Multipliers | Armament 1.20→2.10 · Protection 1.15→1.90 · Logistics 1.15→1.80 |
| 5 | Costs | Increasing 10k/25k/50k/120k, Dirty cash then Clean cash |
| 6 | Hitman unlock | Armament P3 (targeted assassination, area damage) |
| 7 | Active Counter-intel | Protection P3, −40% → −70% |
| 8 | Research channels | 1 per Workshop, multi-Workshop parallelization allowed |
| 9 | Progress loss | In-progress progress lost if all Workshops are destroyed; acquired tiers kept |
| 10 | Combat link | Tech multiplies the `combat.md` formulas, without changing their conditions |

---

## Implementation (P4) — values in force

> **Authoritative** section for the code (`src/sim/tech.ts`, `src/sim/world.ts`). To balance.

- **Tech capacity**: `max_level = number of Workshops` (capped at **5**). So N Workshops are needed to reach tier N.
- **Cost** of a tier (in **Clean cash**): `2000 × target_level` (2,000, 4,000, 6,000, 8,000, 10,000).

| Branch | Effect per tier | At max (5) |
|---|---|---|
| **Armament** | +10% attack damage | +50% |
| **Protection** | +10% quarter defense | +50% |
| **Logistics** | +20% Member production **and** +20% Control regeneration | +100% |

### Hitman

- **Prerequisite**: **Armament ≥ 2**.
- **Cost**: 3,000 Clean cash + 1,000 Members · **cooldown 100 ticks (10 s)**.
- **Effect**: −40 Control on the target quarter, −20 on adjacent quarters; **destroys the buildings** hit.
- **Does not capture** (Control floor at 5): it weakens, conquest then happens through a brawl.
- **Counter-intel**: reduces damage by **15% per unit** (cap **60%**).


### P20 — Armament, Bust, Strike

- **Armament**: +10% damage **and** the **damage cap per tick follows Armament** (`5 × (1 + 0.1 × level)`) — without that, tech was useless beyond the cap.
- **Bust** (Armament ≥ 1): 2,000 Dirty cash + 600 Members, 25 s recharge → **steals the loot** of an adjacent building **without destroying or capturing it**. An enemy **Watcher** halves the loot.
- **Heavy strike** (Armament ≥ 2): 12,000 Clean cash + 1,500 Members, 90 s recharge → **telegraphed** area strike (50 ticks / 5 s of warning, target ring visible to everyone): −55 Control at the epicenter, −25 on the neighbours, **destroys buildings** and cancels build sites. **Blunted by Counter-intel** (−25% per unit, capped at −70%).
- **Watcher** (ex-Counter-intel, 2,000 Clean cash): **alerts** busts (radius 1), **−25% strike damage**, **hinders busts**.
