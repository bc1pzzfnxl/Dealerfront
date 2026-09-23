# Combat — Quarter brawls, defense and hitmen

> Status: **draft (v0)** — proposed "DealerFront" (God view) model, starting values **to balance**.
> Inspired by OpenFront's **ideas** (open-source territorial RTS, AGPL): abstract troop-influence, tick-by-tick conquest, terrain, Safehouses, nuke/MIRV. **No code reused.**

## Objective

Define DealerFront's **territorial** combat: how a faction spends its **Members** to take a **quarter**, how a defender resists (Safehouses, terrain, tech), and how a **hitman** strikes a quarter from a distance. Combat has **no individual units**: it is a struggle over **Control 0–100** fed by a Members pool.

## Rules

### Abstract influence model

- **Quarter** = IRIS quarter of the real map (**992 quarters**). Each quarter has an **owner** (faction, neutral) and a **Control 0–100**.
- **Influence** = "troop resource" **per faction**, stored in a **global pool** (no per-unit logistics). It is the only combat currency.
- Influence propagates **quarter to quarter** via **BFS on the street adjacency graph**: you can only attack a quarter **bordering** an owned quarter (border = street edge). Out of range = no attack.
- A **front** can cover several bordering quarters; the committed Influence packet is **split** according to `borderSize` (number of contested bordering quarters).
- Combat is a **continuous 10 Hz process** (tick 100 ms): each tick applies the formulas below, with no instant resolution.
- **No randomness in the formulas** (determinism, `pillars.md`): only AI decisions and generation rolls are random.

### Expansion onto a neutral quarter

Inspired by OpenFront's `defender === null` branch (neutral garrison).

- A **neutral** quarter has a **garrison** `G_n` (initial Control, e.g. 30–60 depending on distance from the map center — **to balance**).
- You commit an **Influence packet** `I_eng`. Each tick:
  - **Attacker losses**: `attacker_losses = mag_zone / 5`.
  - **Conquest speed** (`tickFraction`, fraction of the garrison processed per tick):
    `tickFraction = clamp(2000 × tileCost / I_eng, 5, 100) / (borderSize × 2)`.
  - `Target ← Target − tickFraction × k_c` (Control drop; `k_c` = scaling constant **to balance**).
- Conquest is **slower** with a small Influence packet (the 5–100 clamp bounds the speed): you must mass Influence to go fast.
- **Capture** as soon as `Control ≤ 0` (see "Capture"). A neutral **does not retaliate beyond** its implicit garrison losses.

### Attacking a faction

Adapted from OpenFront's player-target branch. Let `I_def` be the owner's **effective** defensive Influence (committed pool + garrison of adjacent quarters), `n_q` its number of quarters.

- **Effective defense per quarter**: `D_eff = I_def / n_q` (equivalent to `defender.troops / defender.numTiles`).
- **Force ratio**: `ratio = I_def / I_eng` (equivalent to `troopRatio`).
- **Defender losses / tick**: `defender_losses = D_eff × k_d` (**to balance**); Control drops under pressure.
- **Attacker losses / tick**:
  `attacker_losses = mag_zone × clamp(ratio, 0.6, 2) × (0.463 × terrain_bonus + 0.0039 × D_eff)`.
  → Attacking a **numerically superior** faction (high ratio) is expensive; attacking on equal terms (ratio ≈ 1) is the balance point.
- **Conquest speed**: `tickFraction = (speedCost_zone × tileCost_zone) / borderSize`.
- **Large-territory bonus**: a **deep** attacker (high `depth`, many quarters in the rear) is favored; the defender is favored at home:
  - attacker `depth = 0.7` · defender `depth = 0.3` (OpenFront inspiration, **to balance**).
  - `terrain_bonus` = `attacker_depth − defender_depth` bounded (the defensive "home turf" offsets mass).
- **Ending the attack**: conquest stops on **player cancel**, **Influence exhausted**, or **Control ≤ 0** (capture).

### Defense

- **Safehouse** (`docs/economy.md`) — quarter defense building:
  - applies a **loss multiplier** to the attacker: `mag × 5` (DefensePost inspiration, **to balance**);
  - applies a **slowness multiplier**: `tileCost × 3` (inspiration, **to balance**).
- **Terrain** (quarter zone type): Plains `mag 80 / tileCost 16.5`, Highlands `100 / 20`, Mountain `120 / 25` (inspiration, **to balance**). Mountain is slow and deadly.
- **Protection tech** (`docs/tech.md`): defense multiplier `P_tech` (reduces `defender_losses` and/or increases the attacker cost) — **to balance**.
- **Counter-intel** (`docs/economy.md`): **out-of-combat** defense against hitmen (see below), does not affect the quarter brawl.
- **Pooled defense**: a faction can **pre-position** Influence as a garrison in its front quarters (increases `D_eff` of adjacent attacked quarters).

### Capture

- **Threshold**: `Control ≤ 0` → the quarter changes owner on the next tick.
- **Transfer**: the quarter **and its buildings** go to the winner (Lab, Storefront, Front, Safehouse, etc.). Buildings are **kept** (intact), unless destroyed by a hitman (see below).
- **Control after capture**: reset to a low **consolidation** value (e.g. 25, **to balance**) — the freshly taken quarter is **vulnerable to a counter-attack**.
- **Loot**: the captured quarter's Product stock goes to the winner (**to balance**: 50%?).

### Retreat

- The player (and the AI) can **disengage** a front: the committed Influence returns to the pool reduced by **25% losses** (OpenFront inspiration).
- Retreat **stops the Control drop** and **returns the remaining Influence**, immediately reassignable elsewhere.
- Retreat is **forbidden during the capture tick** (the quarter's fate is already sealed).

### Hitmen

Equivalent to OpenFront's nuke/MIRV, **at quarter scale** (not map scale).

- **Targeting**: you designate a **quarter** (not an exact tile) within intel range. The **targeting range** is **150** (MIRV inspiration, **to balance**) and the **travel time** depends on a **speed of 22** (inspiration, **to balance**) → materializes a visible **strike delay** (the defender can react).
- **Cost**: in Clean cash (`docs/economy.md`) and/or Influence (**to balance**), paid at launch.
- **Area damage**: the target quarter takes **inner** damage (center) and **adjacent** quarters take **outer** damage (periphery):
  - **Simple hitman** (ex-"Atom"): inner **12** / outer **30** (inspiration).
  - **Heavy hitman** (ex-"Hydrogen"): inner **80** / outer **100** (inspiration).
  - **Multiple salvo** (ex-"MIRV"): 3+ warheads, inner **12** / outer **18** (inspiration).
- The damage **lowers the Control** of hit quarters (on the 0–100 scale, **to balance**) and can **destroy the buildings** of the central quarter (probability or damage threshold, **to balance**).
- **Cooldown**: `~5 min` per faction (**to balance**), to avoid spam.
- **Counter-intel**: a Counter-intel building in the target quarter (or adjacent) can **reduce damage by 30–50%** or **intercept the hitman** (probability **to balance**). It can also **mask** a quarter's real owner (false target).
- **Causality**: the strike is **always visible** (diegetic alert, `ui-ux.md`) and **traceable**; the end recap states who killed whom (`docs/scoring.md`).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Quarters | **992** (Paris IRIS) | fixed |
| Factions | **6** (player + AI) | fixed |
| Simulation tick | **100 ms** (10 Hz) | fixed |
| Control | 0–100 | fixed |
| Starting Influence per faction | ~1,000 | to balance |
| `attackAmount` (spend) — player | `I_pool / 5` | inspiration (to balance) |
| `attackAmount` (spend) — AI | `I_pool / 20` | inspiration (to balance) |
| Neutral garrison `G_n` | 30–60 (depending on distance from the center) | to balance |
| Terrain `mag` / `tileCost` | Plains **80 / 16.5** · Highlands **100 / 20** · Mountain **120 / 25** | inspiration (to balance) |
| Safehouse — loss multiplier | `mag × 5` | inspiration (to balance) |
| Safehouse — slowness multiplier | `tileCost × 3` | inspiration (to balance) |
| Fallout | `×5 → ×3` | inspiration (TBD) |
| Neutral — attacker losses / tick | `mag / 5` | inspiration |
| Neutral — `tickFraction` | `clamp(2000 × tileCost / I_eng, 5, 100) / (borderSize × 2)` | inspiration |
| Faction — defense per quarter `D_eff` | `I_def / n_q` | inspiration |
| Faction — force ratio `ratio` | `I_def / I_eng` | inspiration |
| Faction — attacker losses / tick | `mag × clamp(ratio, 0.6, 2) × (0.463 × bonus + 0.0039 × D_eff)` | inspiration |
| Faction — `tickFraction` | `(speedCost × tileCost) / borderSize` | inspiration |
| Large-territory bonus | attacker **0.7** · defender **0.3** | inspiration (to balance) |
| Traitor / defection | defender losses `×0.5` · speed `×0.8` | inspiration (to balance) |
| Control scaling constants `k_c`, `k_d` | to calibrate in playtest | to balance |
| Retreat | **−25%** of committed Influence | fixed (inspiration) |
| Control after capture (consolidation) | ~25 | to balance |
| Product loot on capture | 50% | to balance |
| Simple hitman — inner / outer damage | **12 / 30** | inspiration (to balance) |
| Heavy hitman — inner / outer damage | **80 / 100** | inspiration (to balance) |
| Multiple salvo — inner / outer | **12 / 18**; range **150**; speed **22** | inspiration (to balance) |
| Hitman strike delay | ~30 s (visible) | to balance |
| Hitman cooldown | ~5 min | to balance |
| Counter-intel — damage reduction | 30–50% | to balance |
| Protection tech `P_tech` | defense multiplier | to balance (`tech.md`) |
| Safehouse defense range | **30** | inspiration (to balance) |
| `structureMinDist` (placement) | **15** | inspiration (`procgen.md`) |

## Edge cases

- **Attack canceled before capture**: the Influence packet already spent is **lost**; only the uncommitted remainder returns to the pool. Canceling an attack against a neutral does **not** restore losses already taken.
- **Isolated / encircled quarter** (OpenFront clusters): a quarter **with no street border** to the rest of its faction (isolated pocket) **cannot be resupplied** — it drops to minimal `D_eff` and becomes **capturable in one front**. BFS never crosses the enemy.
- **Intercepted hitman**: if Counter-intel intercepts, the cost is **lost**, no damage is applied, and the launcher is **revealed** (approximate position, consistent with `police-ai.md`).
- **Hitman on a quarter already at 0**: excess damage is **not carried over** to adjacent quarters; it is lost.
- **Simultaneous double capture**: two factions that reach `Control ≤ 0` on the same quarter on the same tick → the quarter goes to the faction with the **largest `I_eng`**; on a perfect tie, **status quo** (the quarter stays with its previous owner) and both packets take their losses.
- **Traitor turned mid-attack**: the traitor multiplier applies **on the next tick**; an attack already launched is not retroactively modified.
- **Influence exhausted on a front**: the front stops **without** automatic retreat (no −25%), the target Control **slowly rises** back toward its resting value as long as no pressure is applied.
- **Hitman without Counter-intel**: **full** damage; the central quarter's buildings can be **destroyed** (the conquered quarter then yields no building).

## Dependencies

- `docs/territory.md` — quarters, ownership, Control, street adjacency (BFS), borders.
- `docs/tech.md` — Protection (`P_tech`), hitmen (unlock, levels), counter-intel.
- `docs/economy.md` — Safehouse, Depot, Workshop, costs in Clean cash, Product loot.
- `docs/factions.md` — Influence pool, diplomacy/betrayal.
- `docs/win-conditions.md` — control threshold, faction elimination at 0 quarters.
- `docs/procgen.md` — quarter terrain, neutral garrisons, `structureMinDist`.
- `docs/scoring.md` — traceability of strikes and victims in the recap.
- `docs/pillars.md` — determinism, pure causality, no omniscience.

## Validation criteria

- [ ] No conquest is instant: everything goes through a tick-by-tick Control drop, traceable.
- [ ] Influence only flows through street adjacency (BFS) — a non-bordering quarter is unattackable.
- [ ] Attacking someone stronger costs proportionally more (bounded ratio 0.6–2 verified in simulation).
- [ ] A Safehouse **visibly** changes the outcome of an attack with an equal Influence budget.
- [ ] Retreat does return **75%** of the committed Influence and stops the Control drop.
- [ ] A hitman has a **visible strike delay** and a **cooldown**; there is no spam.
- [ ] Counter-intel effectively reduces/intercepts, and an interception is **revealed** in the recap.
- [ ] No `Math.random()` in the combat formulas (determinism audit).

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Combat model | Abstract Influence (pool) → Control 0–100, 100 ms tick, BFS on streets |
| 2 | Quarter | = IRIS quarter; 992 real quarters |
| 3 | Neutral expansion | Garrison `G_n` + losses `mag/5` + clamped `tickFraction` |
| 4 | Faction attack | Ratio × terrain bonus formula + `D_eff` (adapted from OpenFront) |
| 5 | Safehouse defense | Attacker losses `×5`, slowness `×3` |
| 6 | Capture | `Control ≤ 0` → quarter + building transfer, consolidation ~25 |
| 7 | Retreat | −25% of committed Influence |
| 8 | Hitmen | Quarter targeting, inner/outer area damage, delay + cooldown |
| 9 | Counter-intel | 30–50% reduction or revealed interception |
| 10 | `attackAmount` | Player `I/5`, AI `I/20` |
| 11 | Double capture | Largest `I_eng`; tie = status quo |
| 12 | Isolated pocket | Not resuppliable (BFS stops at the enemy) |
| 13 | Inspiration | OpenFront (AGPL): ideas reused, code not reused |

---

## Implementation (P1–P4) — values in force

> **Authoritative** section for `src/sim/world.ts`. The implemented model is **Members-based** (not yet the Influence pool or the BFS/street described above); deviations are listed at the end of the section.

### Attack (brawl)

- **Commitment**: `troops = floor(Members × 0.20)`; rejected if `< 400` (MIN_COMMIT). Committed troops are removed from Members on issue.
- **Damage / tick**: `max(0.5; troops × 0.001 × (1 + 0.1 × Armament) / defense)`.
- **Defense**: `ZONE_DEFENSE[zone] × (1.5 if Safehouse) × (1 + 0.1 × Protection)`.
- **Zones**: `residential 1.0 · commercial 1.2 · nightlife 1.1 · industrial 0.8 · park 1.4 · police 2.0 · laundry 1.0 · vacant 0.5`.
- **Attacker losses**: `troops −= damage × 6`; attack withdrawn when exhausted or target captured.
- **Control**: regenerates `+1.0/tick × (1 + 0.2 × Logistics)` (except quarters attacked this tick), cap 100.
- **Quarter size**: each IRIS has a `size` (0.7–1.5, ∝ √area). Damage **and** its cap are divided by `size` → a large quarter is conquered more slowly, at equal troops. `time ≈ Control / (troops × 0.0004 / (defense × size))`, bounded by `5/size` per tick.
- **Mutual attrition**: the defender loses `damage × 4` Members per siege tick — defending also bleeds (no free hold).
- **Simultaneous assaults**: **3** per faction (`MAX_ASSAULTS`).
- **Capture**: `Control ≤ 0` → owner change, **building destroyed** (reset to empty). An **in-progress build site is interrupted and refunded at 50%** to the owner who paid for it. The **established Control** is no longer fixed: it is **proportional to surviving troops** (`base + 26 × survivors/committed`, bounded 8–48; base 16 if the target was neutral, 10 otherwise). An overwhelming assault secures the quarter, an expensive siege leaves it precarious. If the target is **contested** (another active assault on it — war between gangs), the established Control is **reduced by 40%**.

### Adjacency & AI

- Attackable target = **4-connected neighbor** (`neighborsOf`) owned by another (or neutral).
- **AI**: one decision every **25 ticks**; in order — 40% build (`chooseBuildType`), 30% upgrade a tech, 25% hitman, otherwise attack the target with the **lowest Control**.

### Deviations from the target (to implement later)

- **Influence pool** → replaced by **Members**; `attackAmount I/5 (player) / I/20 (AI)` not implemented.
- **BFS on streets / isolated pockets** → simple grid adjacency; the "isolated clusters" anti-snowball is not in place yet.
- **Retreat** (returns 75% of Influence, neutral `tickFraction`) → not implemented.
- **Capture**: the spec states "transfers its buildings"; the code **destroys** the building (to decide).

### P15 tuning — sieges and assaults

- **Mandatory siege**: damage `min(5; troops × 0.0004 × (1+armament) / defense)` per tick; Control regen **1.2/tick**; troops lost `damage × 8`. No more instant capture.
- **Simultaneous assaults limited to 3** per faction: you must **choose your fronts** (no more "click everywhere").
- **Raids**: area damage, do not capture. The player has a paid **Raid** (2,500 Dirty cash + 800 Members, −35 Control, **destroys the building**, 30 s recharge).
- Neutral garrison **60** (neutral expansion remains possible but time-expensive).
