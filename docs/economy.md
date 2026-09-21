# Economy — Resources, buildings and laundering

> Status: **v1 (DealerFront)** — cartel model (god view), economy ↔ conquest loop.
> Mechanically inspired by **OpenFront** (open-source territorial RTS); the OpenFront values cited serve as scale references, not as copies.

## Objective

Define the **cartel's economic loop**: produce **Product** in owned quarters, sell it for **Dirty cash**, launder it into **Clean cash**, and convert these flows into **Members** (troop resource) and **buildings** that expand territory. The economy must stay **balanced with conquest**: neither a passive builder nor a pure conquest game with no logistical background.

## Rules

### 1. The 4 resources and their flows

| Resource | Nature | Gained by | Spent by |
|---|---|---|---|
| **Product** | Abstract resource (no per-unit inventory) | **Labs** (production/tick) | **Storefronts** (conversion) |
| **Dirty cash** | Unlaundered money | **Storefronts** (Product → Dirty cash) | Buildings, conversions, tech tiers |
| **Clean cash** | Laundered money, counts toward the score | **Fronts** (Dirty cash → Clean cash, commission) | High-end tech, strategic services, victory objective |
| **Members** | Troop resource (faction pool) | **Developed recruitment** + owned quarters | Conquest/defense of quarters |

Main chain:

```
Lab ──Product──> Storefront ──Dirty cash──> Front ──Clean cash──> tech / score / victory
                                          │
                          buildings & conversions (Dirty cash)
```

**Members** is a **separate** resource: it is not bought with cash (except tech/services), it regenerates with territory size. It is the fuel of **conquest** (`territory.md`, `combat.md`).

### 2. Quarter model and buildings

- The map is a **real city** (Paris IRIS, **992 quarters**); each quarter has an **owner**, a **Control 0–100** and a market **profile** (`territory.md`, `procgen.md`).
- The city **pre-exists**: the player **does not build in a void**: they **convert/buy out** the existing buildings of an owned quarter, according to the quarter's **zone** (see § 4).
- An owned quarter holds **one** functional building out of the 8.

### 3. The 7 buildings

**Proposed starting values ("to balance")**; duration expressed in **ticks at 10 Hz (tick = 100 ms)**.

| Building | Role | Numeric effect (starting) | Cost (starting) | Duration | Prerequisite |
|---|---|---|---|---|---|
| **Lab** | Product production | +1.5 Product/tick per Lab | 12,500 Dirty cash (×2 per existing Lab, cap 1M) | 20 ticks (2 s) | Owned quarter, compatible zone |
| **Storefront** | Product → Dirty cash | Converts up to 2 Product/tick; price 1 Product = 60 × local wealth | 12,500 Dirty cash (×2 per existing Storefront, cap 1M) | 20 ticks (2 s) | Same |
| **Front** | Dirty cash → Clean cash | Launders 60 × local wealth/tick; commission **20%** | 12,500 Dirty cash (×2 per existing Front, cap 1M) | 50 ticks (5 s) | Same |
| **Safehouse** | Quarter defense | Quarter defense **×5** (inspired by OpenFront DefensePost, local range) | `min(250,000, (n+1) × 5,000)` Dirty cash | 50 ticks (5 s) | Same |
| **Workshop** | Unlocks/upgrades tech | Opens the 3 branches (`tech.md`); 1 research channel per Workshop | 50,000 Clean cash | 50 ticks (5 s) | Owned quarter, industrial zone |
| **Counter-intel** | Reduces enemy hitmen/agents | −40% effectiveness of enemy hitmen/agents within a 3-quarter radius | 75,000 Clean cash | 100 ticks (10 s) | Same |
| **Recruitment** | Member production | +25 Members/tick (recovered building) | 800 Members | immediate | Develop an existing apartment/building |

**Interactions:**
- A **Storefront** **always runs**: it first sells **in-house Product** (full margin), then **sources externally** for the remainder (reduced margin, `EXTERNAL_SUPPLY_MARGIN = 0.6`). Being **connected to a Lab** by a path of owned quarters brings capacity to 100% (otherwise 35%) — logistics **improves**, it no longer **blocks**. A **Lab** without a Storefront accumulates capped Product.
- **Fronts** are the **only** outlet toward Clean cash; their 20% commission is the central economic friction.
- **Safehouses** and **Counter-intel** are defensive buildings: they produce nothing, they protect output.
- The **Workshop** is the **global prerequisite** of tech: without it, no tier can be researched.
- **Depots** amplify Member regeneration, hence conquest capacity: they are the economy → military bridge.

### 4. Conversion of existing buildings

The generated city contains "neutral" buildings (apartments, shops, warehouses, factories). The player **transforms** them into functional buildings.

| Target | Compatible source building | Conversion cost | Duration |
|---|---|---|---|
| Lab | Apartment, warehouse | 50% of Lab cost | 50% of Lab duration |
| Storefront | Shop, nightlife | 50% of Storefront cost | 50% of Storefront duration |
| Front | Shop, bar, laundromat | 50% of Front cost | 50% of Front duration |
| Safehouse | Apartment, warehouse | 50% of Safehouse cost | 50% of Safehouse duration |
| Workshop | Factory, warehouse | 50% of Workshop cost | 50% of Workshop duration |
| Counter-intel | Offices, mixed residential | 50% of Counter-intel cost | 50% of Counter-intel duration |
| Depot | Warehouse, port area | 50% of Depot cost | 50% of Depot duration |

**Constraints:**
- The quarter must be **owned** by the faction (Control ≥ possession threshold, `territory.md`).
- **Zoning = incentive, not a blocker**: the **economic chain** (Housing, Lab, Storefront, Front, Safehouse) is buildable in **all** zones; only the **specialized** buildings (Depot, Workshop, Watcher) remain restricted (Depot/Workshop → industrial or vacant lot; Workshop also in commercial; Watcher → not in vacant lot). Output is modulated by the **zone bonus** (see §5bis).
- **Recruitment** requires an **existing building** (built zone): impossible on a vacant lot or in a park.
- A converted building **replaces** the original function (e.g. apartments → Labs consumes the quarter's population, a side effect to balance with `city-sim.md`).
- Conversion **reuses** the footprint: it costs and takes **less** than a new construction, but remains subject to the **increasing cost** per number of buildings of the same type.
- **Zone bonus**: a building produces **more** in a zone made for it (`ZONE_BUILD_BONUS`, multiplier applied to production/sales/laundering capacity, never to cost). Specializes territory: building "anywhere" is no longer optimal.

| Zone | Boosted building | Multiplier |
|---|---|---|
| residential | Housing (recruitment) | ×1.50 (safehouse ×1.15) |
| commercial | Storefront | ×1.50 (front ×1.15) |
| nightlife | Storefront + Front | ×1.30 |
| industrial | Lab ×1.50 · Workshop ×1.40 · Depot ×1.30 | — |
| laundromat | Front (laundering) | ×1.60 |
| police | Counter-intel | ×1.60 |
| park | Safehouse (defense) | ×1.50 |
| vacant lot | none (new construction) | ×1.00 |

### 5bis. Day/night cycle & rush hours

- **In-game clock**: `TICKS_PER_HOUR = 120` (12 real s at 10 Hz) → one day = 4.8 min; start at 8:00.
- Each zone has a **rush hour** for its flagship building. Output follows
  `factor(h) = 1 + amplitude × cos(2π (h − peak) / 24)` — maximum at the peak, minimum 12 h later, **mean 1 over the day** (global balance preserved).

| Zone | Building | Rush hour | Amplitude |
|---|---|---|---|
| commercial | Storefront | 13:00 | ±0.40 |
| nightlife | Storefront | 23:00 | ±0.50 |
| residential | Housing | 19:00 | ±0.30 |
| industrial | Lab | 02:00 | ±0.20 |
| laundromat | Front | 11:00 | ±0.15 |

- **Effect**: a storefront in nightlife sells ~1.5× at 23:00 and ~0.5× at 11:00. Paces sales and invites planning (sell at peak, attack in the trough).
- **UI**: `Day/Night HH:MM` clock, and for the selected quarter a badge "Peak ×1.40" / "Trough ×0.60".

### 5. Output and formulas

- **Product production**: `2 Product/tick × N_labs` (to balance).
- **Product → Dirty cash conversion**: `1 Product = 15 Dirty cash`, capped by `min(available_Product; 2 × N_storefronts)` Product/tick (to balance).
- **Laundering**: `Clean cash = Dirty cash × (1 − 0.20)`, capped by `30 × N_fronts` Dirty cash/tick; the **20%** commission is **fixed** (see `scoring.md`).
- **Max Members** (inspired by OpenFront `maxTroops`):
  `max_Members = 2 × (owned_quarters^0.6 × 1,000 + 50,000) + depots × 250,000` (to balance).
- **Member regeneration/tick** (inspired by OpenFront):
  `regen = (10 + Members^0.73 / 4) × (1 − Members / max_Members) + depots × 5` (to balance).
- **Direct build sites**: no more **queue**. A build starts immediately if a **crew** remains (2 max) and is rejected otherwise ("crews busy"). The batch (`Develop`) directly launches what the crews allow.
- **Increasing cost** of buildings (inspired by OpenFront City/Factory/Port): `cost(n) = base_cost × 1.35^n` where `n` = number of buildings **of the same type** already owned (conversion = ×0.5). The cost is computed per faction and per type; a batch accounts for the buildings already planned. Forces **diversification** rather than spamming a single type.

### 5ter. Money is king of war (strategic sinks)

**Dirty** and **clean** cash are not just scores: they **buy the war**.

- **Watcher wages** (`GUARD_UPKEEP = 1.5` dirty/tick per Watcher): intel costs money. **Unpaid** watchers = **blind** (no bust alert, no strike reduction). A poor cartel is deaf.
- **Armament stockpile** (`ARMAMENT`): buying armament with **Clean cash** gives `+20%` attack for **40 s**, stackable up to **×6**, **increasing** cost (`3000 × 1.5^n`) — a permanent sink. You invest before an offensive: money decides the military tempo.
- **Upkeep** (`BUILDING_UPKEEP`): each building costs **Dirty cash/tick** (Housing 0.5; Lab/Storefront/Safehouse/Depot 1; Front/Watcher 1.5; Workshop 2). If it is not covered, `upkeepPaid = false` → **production ×0.5** (`UNPAID_UPKEEP_FACTOR`) and **blind watchers**. Big empires are expensive to run.
- **Mercenaries** (`MERC`): **Dirty cash → Members** immediately (`+400`), increasing cost (`4000 × 1.4^n`), capped by the Members cap. *(Exception to the "Members cannot be bought" pillar: it is a war lever, bounded by the cap.)*
- **Contract** (`CONTRACT`): **Clean cash** → pay a gang to **attack the leader** for 60 s. Increasing cost (`6000 × 1.5^n`).
- **Quarter buyout** (`BUY`): convert **Clean cash** into **territory** without fighting. Target = **adjacent neutral** quarter. Cost `4000 × size × (1 + 0.15 × owned quarters)`, 10 s recharge, established control 25. Permanent **tech vs expansion** trade-off: the same Clean cash buys armament, tech **or** map.

### 6. Economic objective

- **Victory**: **last cartel in play** (`win-conditions.md`) — the economy funds the war, it is no longer the victory condition.
- Clean cash is **not** spendable to conquer directly: it funds **tech** (`tech.md`) and serves as **score**. Conquest is paid in **Members**. This separation enforces the economy/conquest balance.
- **Overtime** option: at 30 min, the victory threshold drops by **2%/min** (inspired by OpenFront).

## Numeric parameters

| Parameter | Starting value | Status |
|---|---|---|
| Simulation tick | 100 ms (10 Hz) | fixed |
| Quarters | 992 (Paris IRIS) | fixed |
| Building slots / quarter | 3 (to balance) | to balance |
| Product/lab/tick | 2 | to balance |
| Product → Dirty cash rate | 1 Product = 15 Dirty cash | to balance |
| Storefront throughput | 2 Product/tick | to balance |
| Laundering commission | 20% | fixed |
| Front throughput | 30 Dirty cash/tick | to balance |
| Lab / Storefront / Front cost | `min(1e6, 2^num × 12,500)` Dirty cash | to balance |
| Safehouse cost | `min(250,000, (n+1) × 5,000)` Dirty cash | to balance |
| Safehouse defense | ×5 (local range) | to balance |
| Workshop cost | 50,000 Clean cash | to balance |
| Counter-intel cost | 75,000 Clean cash | to balance |
| Counter-intel reduction | −40% (3-quarter radius) | to balance |
| Depot cost | 100,000 Clean cash | to balance |
| Depot Member bonus | +250,000 max, +5/tick | to balance |
| Conversion cost | 50% of cost / 50% of duration | fixed (amounts to balance) |
| Construction durations | Lab/Storefront 20 ticks · Front/Safehouse/Workshop 50 · Counter-intel/Depot 100 | to balance |
| `structureMinDist` (neighboring footprints, inspired by OpenFront) | 15 tiles | to balance |
| Starting resources | 20,000 Dirty cash, 0 Clean cash, 50,000 Members | to balance |
| Victory condition | last survivor | fixed |
| Victory threshold — Clean cash | **TBD** | TBD |
| Overtime | −2%/min after 30 min | fixed |
| Member formula weights | exponents 0.6 / 0.73 | to balance |

## Edge cases

- **Building destroyed by a raid**: the building is **destroyed** (slot freed), not refunded; any collateral damage is logged (`scoring.md`). A retaken quarter can be reconverted.
- **Quarter lost with buildings on it**: by default the buildings **change owner with the quarter** (the conqueror inherits the infrastructure); only a **raid** or a **heavy strike** destroys them. Decision to confirm in `combat.md`.
- **Bankruptcy**: no more Dirty cash, Clean cash or Product → no building buildable; **Members keep regenerating** (escape route: conquering rich quarters or forced selling), never a total lock.
- **Stored Product capped**: the Product stock per faction is bounded (e.g. `10,000 × N_depots + base`), to avoid infinite accumulation and force outflow through Storefronts.
- **Conversion during a quarter loss**: the conversion is canceled, the paid cost is **partially refunded** (to balance); the source building returns to its neutral state.
- **Neutral buildings exhausted**: if a quarter has no compatible source building left, new construction remains possible (full cost, full duration) within the slot limit.
- **Contention on the same quarter**: two factions cannot convert the same source building simultaneously; first come locks the slot.

## Dependencies

- `territory.md` — ownership, Control 0–100, possession, slots, conquest.
- `combat.md` — building destruction, raids, infrastructure inheritance.
- `tech.md` — the Workshop opens the branches; costs paid in Dirty/clean cash.
- `win-conditions.md` — Clean cash threshold and Control condition.
- `scoring.md` — Clean cash = score basis; causal log of flows, losses and destructions.
- `scoring.md` — use of Clean cash (score, victory).
- `city-sim.md` — generated source buildings, effect of conversions on the local population.

## Validation criteria

- [ ] The 4 resources have an identifiable **inbound and outbound** flow, with no orphan resource.
- [ ] A player can always find a recovery path after bankruptcy (no soft-lock).
- [ ] The Product → Dirty cash → Clean cash loop is **mandatory** (no direct shortcut).
- [ ] Members can **never** be bought with Dirty/clean cash (conquest/economy separation).
- [ ] The 7 buildings are convertible from at least one generated building type.
- [x] The increasing cost of buildings prevents spamming a single type.
- [x] The economy can sustain a long war (battle royale).

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Nature of resources | 4 abstract resources: Product, Dirty cash, Clean cash, Members |
| 2 | Conquest/economy separation | Members are not bought; the economy funds tech and the score |
| 3 | Quarter | IRIS quarter (992 real quarters), owner + Control 0–100 + market profile |
| 4 | Buildings | 7: Lab, Storefront, Front, Safehouse, Workshop, Counter-intel, Depot |
| 5 | Placement | The city pre-exists; the player **converts** existing buildings |
| 6 | Conversion cost | 50% of cost and duration, owned quarter + compatible zone |
| 7 | Laundering commission | 20% (fixed) |
| 8 | Increasing cost | `min(1e6, 2^n × 12,500)` model inspired by OpenFront City/Factory/Port |
| 9 | Members | `maxTroops` and regeneration adapted from OpenFront, bonus per Depot |
| 10 | Safehouse defense | ×5 local, inspired by OpenFront DefensePost |
| 11 | Victory | Last survivor (battle royale) |
| 12 | Overtime | Optional: threshold −2%/min after 30 min |
| 13 | Local market | Each quarter has a profile: **demand** (clientele → sales and recruitment capacity) and **wealth** (price and laundering capacity). Paris: wealth by arrondissement (INSEE), demand by IRIS type; grid: by zone type. Profiles normalized to mean 1.0 (localizing redistributes, without changing the total). |
| 14 | Logistics | A storefront must be **connected to a lab** and a front to a storefront by a path of owned quarters (BFS). Off-line, capacity drops to 35% (floor). Lines are visible (convoys) and **interceptable** (Armament ≥ 1, 500 members: takes the cargo **on the road**, cuts the line for 25 s). |
| 15 | **Delivery (no faucet)** | Product and Dirty cash are **not** credited on production: they go **on the road** (`productInTransit` / `dirtyInTransit`) and only land when a convoy completes its leg (`CONVOY_TRANSIT_TICKS = 60` = 6 s). Each convoy loads an equal share of what is waiting, so what an interception takes is **real cargo**, not a slice of the treasury. A **broken chain banks directly** (no convoy = no transit) so a missing Front can never starve the treasury — the 35% supply penalty already prices the broken link. |

---

## Implementation (P2–P4) — values in force

> **Authoritative** section for the current code (`src/sim/buildings.ts`, `src/sim/world.ts`). The building table above describes the target; these values are the implemented ones (to balance).

### Starting resources

| Resource | Player | AI |
|---|---|---|
| Members | 3,000 | 3,000 |
| Dirty cash | 2,000 | 2,000 |
| Product / Clean cash | 0 | 0 |

> The AI start is **aligned with the player (2,000)**: below that, Lab (1,000) + Storefront (1,000) = 2,000 made any economic start impossible (observed in massive simulation).

### The 8 buildings (1 per owned quarter)

| Building | Cost | Effect / tick |
|---|---|---|
| **Recruitment** | 800 members | +25 Members |
| **Lab** | 1,000 dirty | +1.5 Product |
| **Storefront** | 1,000 dirty | converts up to 2 Product → 60 dirty/unit |
| **Front** | 1,500 dirty | launders up to **60** dirty → clean (20% commission) |
| **Safehouse** | 1,200 dirty | local defense ×1.5 |
| **Depot** | 1,200 dirty | +2,000 max Members |
| **Workshop** | 2,500 clean | +1 tech level unlocked (max 5) |
| **Counter-intel** | 2,000 clean | −25% strike damage (cap −70%) |

### Member formulas

- `maxMembers = 2000 + quarters × 1500 + housing × 2000 + depots × 2000`
- `production/tick = (8 × quarters + 25 × housing) × (1 − members/max) × (1 + 0.2 × logistics)`
- Capture of a quarter: its **building is destroyed** (reset to empty).

### Target composition (AI and bot)

`chooseBuildType` (`buildings.ts`) fills the **largest deficit** relative to this composition, instead of taking "the first affordable" (which filled everything with housing → 0 Clean cash). Order **upstream → downstream**: Lab before Storefront.

| Type | Target share |
|---|---|
| Recruitment | 30% |
| Lab | 20% |
| Storefront | 15% |
| Front | 15% |
| Depot / Workshop / Counter / Safehouse | 5% each |

The Workshop is **capped** at `TECH.maxLevel` (5).

### Conversion of existing buildings

- Each owned and **empty** quarter can receive **one** building (conversion of existing buildings).
- Cost payable in **Members** (housing) or in **Dirty cash** (production/sales/defense) or **Clean cash** (Workshop/Counter-intel).
- Capturing the quarter **destroys** the building.

---

## Implementation (P11) — conversion per zone

> **Authoritative** section for `src/sim/buildings.ts` (`ZONE_BUILDINGS`). Applies the spec's "compatible zone" constraint (§4).

An owned and **empty** quarter can only be converted to types **compatible with its zone**:

| Zone | Convertible buildings |
|---|---|
| Residential | Recruitment, Lab, Storefront, Front, Safehouse, Counter-intel |
| Commercial | same (shop/back room) |
| Nightlife | Recruitment, Lab, Storefront, Front, Safehouse |
| Industrial | + **Depot**, **Workshop** |
| Laundromat | Recruitment, Lab, Storefront, Front, Safehouse, Counter-intel |
| **Police station** | **Counter-intel, Safehouse** only |
| **Park** | **Safehouse** only |
| **Vacant lot** | New construction only: Lab, Storefront, Front, Safehouse, Depot, Workshop (**no Recruitment**: nothing to requisition) |

- Each faction's **spawn** is forced onto a "built" zone: you can always bootstrap.
- **Bootstrapping**: as long as the chain (Lab → Storefront → Front) is incomplete, the AI/bot builds **only** the missing step (avoids wasting the budget).
- The UI shows the **zone**, the list of possible conversions, and "incompatible zone" on rejected buttons.

### To do (spec §4)

- **Conversion duration** (20–100 ticks) and **cost reduced to 50%**: not implemented (instant conversion at full cost).
- **Increasing cost per type** and **effect on population** (`city-sim.md`): not implemented.

---

## Implementation (P12) — conversion vs construction

- **Conversion** (**built** zone: residential, commercial, nightlife, industrial, laundromat, park, police): **instant**, cost **−50%**.
- **New construction** (vacant lot): **full cost** + **build site** (`BUILD_TICKS` ≈ 3–8 s depending on type, 10 Hz).
- **Build site**: paid on order, **parallel** (one per quarter), **lost** if the quarter is captured or the building destroyed (police raid, heavy strike). The quarter produces nothing during the work.
- Rendering: **reduced amber** block on the map; Quarter panel → "Build site: X — N s left".

### Controlled laundering (P13)

- The player sets a **laundering ratio 0–100%** (slider): the effective capacity of fronts is `fronts × 60 × ratio`. **Default: 50%** — at 100% all Dirty cash goes to Clean cash and none is left to build (lock).
- At **0%**, Dirty cash accumulates (to buy); at **100%**, everything goes to Clean cash. Central trade-off of the loop.

### P15 tuning — build sites

- **New construction**: `BUILD_TICKS` ≈ **9–24 s** (90–240 ticks).
- **Conversion** (existing buildings): **cost −50%** and **time ÷2**, but **no longer instant** (a build site anyway).

### P17 — "recruitment" theme and assault ratio

- The Member production building is **"Recruitment"** (you **requisition a residential building** rather than building one — more credible for a cartel). Mechanics unchanged (+25 Members/tick).
- **Adjustable assault ratio** (slider, 5–60%): share of Members committed to each attack (OpenFront-like).

### P19 — objective buildings (loot)

- Capturing a **built** quarter yields **20% of the building's value** (taken from the defender, in their cost currency), in addition to the quarter. *Lowered from 40% → 20% to slow the snowball.* Buildings remain **value targets**.
- A **Counter-intel** adjacent to an attacked quarter **alerts** its owner (event, floating text, sound): **watcher** role.
