# Dealer RTS — Full Feedback + 30 min Game Design Summary

> **Analysis based on**: reading the bundle `index-C07yph_X.js` (1.69 MB), extracting constants/formulas from the code.
> **Target**: 25–35 min game (median 30 min), 6 cartels, Paris IRIS 992 quarters, battle royale.
> **Reference**: OpenFront (territory painting, troop losses, expansion) + war economy + drug convoys + police.

---

## 0. Current code state — extracted constants

### Starting data (per faction, `AR`)

| Resource | Initial value |
|---|---|
| Members | 3,000 |
| Product | 0 |
| Dirty cash | 2,000 |
| Clean cash | 1,000 |
| Tech (armament/protection/logistics) | 0/0/0 |
| Attack ratio | 20% fixed |
| Laundering ratio | 50% |
| Embargoes suffered | 0 |

### Buildings (`lR` — costs and effects)

| Building | Clean cost | Members cost | Effect per tick |
|---|---|---|---|
| housing | 800 | 0 | +25 requester × rush factor |
| lab | 600 | 20 | +1.5 product/tick (× zone + sabotage) |
| storefront | 500 | 15 | consumes 2 product/tick → +60 dirty/product |
| front | 500 | 10 | launders 60 dirty cash → clean (−25% commission) |
| safehouse | 500 | 0 | +2,000 member cap, +1.5× local defense |
| watcher (counter) | 350 | 0 | −15% attacker damage/unit (max 60%), anti-sabotage |
| depot | 400 | 0 | +2,000 member cap |
| workshop | 400 | 0 | Unlocks 1 tech level (max per workshop) |

**Increasing cost**: `baseCost × 1.35^existingCount × discountConversion`

### Zones and bonuses (`xR`)

| Zone | Boosted building | Multiplier |
|---|---|---|
| residential | housing | ×1.5 |
| commercial | storefront | ×1.5 |
| night | storefront | ×1.3 |
| industrial | lab | ×1.5 |
| laundromat | front | ×1.6 |
| police | watcher | ×1.6 |
| park | safehouse | ×1.5 |

### Rush hours (`CR`)

| Zone | Type | Peak | Amplitude |
|---|---|---|---|
| commercial | storefront | 13:00 | +40% |
| night | storefront | 23:00 | +50% |
| residential | housing | 19:00 | +30% |
| industrial | lab | 02:00 | +20% |
| laundromat | front | 11:00 | +15% |

Formula: `factor = 1 + amplitude × cos(2π × (hour - peak) / 24)`

### Recruitment

```
recruits = (8 × recruitDemand + 25 × housingDemand × sabotageFactor(housing))
           × (1 - members/maxMembers)
           × (1 + 0.2 × logistics_level)
```

**Member cap**: `maxMembers = 2000 + modulesOwned×1500 + housing×2000 + depot×2000`

### Operations (exact costs from the code)

| Operation | Cost | Effect | Cooldown |
|---|---|---|---|
| Raid (`Iz`) | 2,500 dirty + 800 members | −35 Control, destroys building, cancels construction | 300 ticks (30s) |
| Bust (`Mz`) | 2,000 dirty + 600 members | Steals 40% of building value (20% if 1 watcher, 0 if 2+) | 250 ticks (25s) |
| Sabotage (`Nz`) | 1,500 dirty | −50% output for 300 ticks (30s) | 250 ticks (25s) |
| Interception (`zz`) | 500 members | Steals 25% of convoy + cuts it for 250 ticks | 300 ticks (30s) |
| Hitman (`cz`) | 3,000 clean + 1,000 members | −40 Control center, −20 Control neighbors, destroys buildings | 100 ticks (10s) |

**Shared cooldown**: `hitmanCooldown` shared between Raid, Bust, Sabotage, Interception, Hitman.

### Combat system

```
sent = floor(members × 0.20)      // Sz = 20% fixed, no slider
minimum = 400 members             // Fz
travelTime = 12 ticks             // 1.2s
maxSimultaneousAttacks = 4        // Dz

damage/tick = min(5, max(0.5, sent × 0.0004 × attackPower / baseDefense))
losses/tick = damage × 8          // Tz = 8

baseDefense = zoneDef × safehouseDef × (1 + defenseBonus) × traitorMod
attackPower = 1 + 0.1 × armament_level

controllerRegen = (1 + 0.2 × logistics) × 1.2   // out of combat
```

**Defense values per zone**: residential=1.0, commercial=1.2, night=1.1, industrial=0.8, park=1.4, police=2.0, laundromat=1.0, vacant=0.5.

**Capture**: control ≤ 0 → quarter taken with `control = clamp(8, 48, 16+26×survivors)`

**Encirclement** (every 5 ticks): if a group ≥8 quarters, <35% of the faction total, fully encircled → all flips, control=30.

### Police

```
pressureChange = 0.02 × dominationRatio + 0.0015 × crime − 0.002
dominationFloor = max(0, ownedLeader/totalModules − 0.8) × 250
```

| Threshold | Level | Effect |
|---|---|---|
| <40 | Surveillance | None |
| ≥40 | Raid | 1 module hit, −25 Control, cooldown 600 ticks |
| ≥70 | Crackdown | 3 modules hit + 10% clean cash seized |
| ≥95 | Liquidation | Player elimination |

**Corruption**: `cost = min(1,000,000, 3,000 × 1.8^uses)`, −20 Pressure, 15% backlash (+10 Pressure).

### Score

```
score = modulesOwned × 1,000,000 + members + cleanCash × 0.001
```

### Random events (every 1,200 ticks after 600, 50% chance)

| Event | Choice A | Choice B |
|---|---|---|
| Risky delivery | +3,500 dirty, heat ×3 | +4,000 clean |
| Informant talks | −6,000 dirty, −12 Pressure | +6,000 total, +8 Pressure |
| Rival front | Free front | +5,000 dirty |

### End conditions

| Condition | Outcome |
|---|---|
| 0 quarters | Defeat |
| 1 cartel left | Victory |
| cleanCash=0 AND dirtyCash=0 for 300 ticks | Defeat (bankruptcy) |
| Pressure ≥95 | Defeat (liquidation) |

---

## 1. Play-test feedback — what I felt (simulated by reading the code)

### 0-30s: Launch

- Strong hook: "The cartel on the real map of Paris, 992 quarters, 6 cartels, battle royale".
- **Problem**: 3,000 members + 2,000 dirty + 1,000 clean. No idea what that is worth. No comparative gauge.
- 6 factions: Cartel (me), Northside/Eastside/Southside/Westside Gang, Syndicate. **Zero personality** — same AI tree, same skin.

### 1-5 min: First clicks

- I place a lab. It produces 1.5 product/tick = **900 dirty/s**. My lab costs ~600 clean. **ROI in 0.7 seconds.** Absurd.
- I place a storefront. It consumes 2 product/tick → +120 dirty/tick. **In 10 seconds, 12,000 dirty.** Money never runs out.
- `launderRatio` is a 50% slider I cannot see. 1,000 dirty attempted → 500 laundered → 375 clean. **I lose 62.5% of value without knowing.**

### 5-15 min: Combat

- I click attack on a neighboring quarter. 20% of my troops are sent (fixed, no slider). 600 members leave. **No visual feedback.**
- Damage: 0.24/tick against 100 Control. **41.6 seconds to capture a neutral quarter.** The defender does nothing. No combat, just a timer.
- I launch a Raid: −2,500 dirty − 800 members for −35 Control and a destroyed building. **I lose more than I gain.** Bust steals 40% and costs less.
- **The shared cooldown** (`hitmanCooldown`) blocks me for 30 seconds after every operation. **I can only do ONE action every 30 seconds in an RTS.** It is suffocating.

### 15-25 min: Police

- My Pressure rises. I see a raid at Pressure ≥40: 1 module, −25 Control. Manageable.
- At ≥70: 3 modules hit + 10% clean cash seized. **That hurts.**
- At ≥95: **instant death.** No timer, no warning. 95 = dead.
- **The critical problem**: `dominationFloor = (ownedLeader/totalModules − 0.8) × 250`. If I own 80%+ of the map, Pressure rises by **at least 5/s**. From 40 to 95 = **11 seconds to die**. The leader is punished for winning in ~10s.

### 25-30 min: Endgame

- If 2 players survive → **infinite stalemate**. No end timer. No economic victory at 30 min.
- The score `modulesOwned × 1,000,000` means the only thing that matters is the number of tiles. The economy is secondary.

---

## 2. Top 5 critical bugs (from the code)

| # | Bug | Impact | Fix |
|---|---|---|---|
| 1 | **Shared cooldown** for 5 operations | 1 action/30s, frozen RTS | 5 separate cooldowns |
| 2 | **Leader dies in 11s** (dominationFloor × 250) | The best player automatically loses | Lower dominationFloor or cap it at 60 |
| 3 | **No mutual losses** in a siege | Attacking = timer, not combat | Defenders inflict losses on attackers |
| 4 | **Absurdly fast ROI** (lab in 0.7s) | No economic tension | Costs ×10 or output ÷10 |
| 5 | **Fixed 20% attack** | No tactical choice | Rush slider 10-80% |

---

## 3. Vision in one sentence

**Paint Paris in 30 minutes: your economy funds your war, your convoys feed your front, the police punishes the greedy.**

### Pillars (non-negotiable)

1. **Readable expansion** like OpenFront: 1 gesture = attack, 1 number = % committed, 1 color = who owns what.
2. **War economy, not a torrent**: tension over money, a choice between investing and attacking.
3. **Physical convoys**: drugs move on the map, get stolen, get cut.
4. **Police as a 7th player**: readable thresholds, telegraphing, no surprise death.
5. **Guaranteed 30 min ending**: economic victory or attrition.

---

## 4. Target 30-minute pacing

```
00:00–03:00  SETUP          3 quarters, 1 lab + 1 storefront. Zero war.
03:00–10:00  EXPANSION      3 → 10 quarters. First convoys. 1st event.
10:00–20:00  ECON WAR       10 → 25 quarters. 1st cartel eliminated.
20:00–27:00  ATTRITION      3 left. Leader Heat×2. 2nd elimination.
27:00–32:00  FINALE         1v1. Anti-turtle + econ victory possible.
```

### Duration levers

- **Control regen**: base `1.2/s` (× logistics), nerfed to 0.6 after 20:00, 0.4 after 27:00.
- **Bankruptcy**: 300 ticks at zero = 30s, with a **visible countdown**.
- **Final police**: at 25:00, multi-raid on top 1 and 2.
- **Econ victory** at 30:00: if 2+ survivors, score = modules×1M + members + clean×0.001.

---

## 5. War economy — reformulated for 30 min

### Chain

```
Lab (Product) ──convoy──> Storefront (→ Dirty) ──front──> Clean
Clean ──> Recruitment (Members) + Tech + Buildings
Dirty ──> Military operations
```

### Target output (post-balancing)

| Building | Output/s (neutral) | Cost | ROI | Note |
|---|---|---|---|---|
| Lab | 900 dirty/s (1.5×60) | 600 clean | 0.7s | **DIVIDE BY 10** → 90 dirty/s, ROI 6.7s |
| Storefront | consumes 20 product/s | 500 clean | instant | **DIVIDE BY 10** → 2 product/s |
| Front | 60 dirty→45 clean/s | 500 clean | 11s | OK but 25% commission too high |
| Safehouse | +2,000 cap +1.5× def | 500 clean | — | Good, but not visible |
| Watcher | −15% damage/unit | 350 clean | — | Invisible radius to fix |

### Laundering commission

Current: **25% loss**. That is huge. A player making 10,000 dirty/s only recovers 7,500 clean/s. **Breaks the game in mid-game.** → Propose **10%** (9,000 clean/s) with police risk.

### Member cap (proposed)

```
Cap = 2000 + 1500×quarters + 2000×housing + 2000×depots
```

Current: 3,000 base members + a formula that explodes quickly (10 quarters + 1 housing = 22,000 cap). **Too big.** → Propose a tighter cap with desertion above it.

---

## 6. Expansion — proposed rules

1. **Rush slider 10-80%** instead of a fixed 20%. Show: `Attack 600 (40%) / Defense 900`.
2. **Mutual losses**: defenders inflict `losses = damage × 8` on attackers. Attacking a strong quarter is expensive.
3. **Loot 40% → 20%** + Contested state for 60s anti-snowball.
4. **1 building/quarter kept**, order queue `kz=12`, simultaneous build sites `Oz=2` shown.
5. **Zoning**: 8 zones, bonuses permanently visible on the map.

---

## 7. Operations — proposed fixes

### 5 separate cooldowns

| Operation | Cost | Effect | Cooldown | Counter |
|---|---|---|---|---|
| Raid | 2,500 dirty + 800 members | −35 Control, destroys building | 30s | Watcher: −15%/unit (max 60%) |
| Bust | 2,000 dirty + 600 members | Steals 20% of value, captures if Control < 30 | 25s | 2+ watchers = failure |
| Sabotage | 1,500 dirty | −50% output for 30s | 25s | 1+ watchers = failure |
| Interception | 500 members | Steals 25% of convoy, cuts for 25s | 30s | N2 escort |
| Hitman | 3,000 clean + 1,000 members | −40 center, −20 neighbors | 10s | Watcher: −15%/unit |

**Rule**: never pay for a binary failure. Show `2 watchers — Likely failure` before payment.

---

## 8. Police — proposed fixes

### Thresholds (keep the existing ones but nerf dominationFloor)

| Threshold | Effect | Fix |
|---|---|---|
| ≥40 | Raid 1 module, −25 Control | Keep, 20s telegraphing |
| ≥70 | 3 modules + 10% clean seized | Keep |
| ≥95 | Liquidation | Keep, but **cap dominationFloor at 60** instead of 250 |

### Corruption

Current: `3000 × 1.8^uses` → exponential, 15% backlash. **Too risky after 2 uses.**
→ Propose: `5000 × 1.5^uses`, −15 Pressure, 5% backlash +5 Pressure.

### Heat

Current: `+30 capture, +20 hitman, +15 operation, +0.15/storefront/tick, +0.08/front/tick`.
Decay: `decay = 0.08 × (1 + heat/30) × (policeZone ? 3 : 1)`.
**Heat decays too fast in police zones** (×3) → players build next to stations to be immune. → Propose ×2 instead of ×3.

---

## 9. Convoys — current state

**4 routes max** (`Rz=4`). No physical convoy. `convoys.find(to)` = abstract lookup. Interception steals 25% of an invisible amount. **The player never sees their drugs travel.**

→ **Physical convoys required**: animated dots on the map, Lab→Storefront, cut path = blocked. Cap 4 routes → 8.

---

## 10. Diplomacy

| Constant | Value |
|---|---|
| Initial relation | 60 |
| Pact duration | 1,500 ticks (2.5 min) |
| Betrayal | −50 relation, −50% defense for 300 ticks |
| Embargo | 3,000 ticks (5 min), −35% sales |

**Problem**: diplo is purely binary (pact or not). No trade, no tribute, no shared vision. → Propose: pact = non-aggression + 60s vision + visible betrayal.

---

## 11. AI

| Behavior | Detail |
|---|---|
| Cycle | 1 action / 25 ticks (2.5s) |
| Priority | Defense → Construction → Tech → Corruption → Ops → Attack |
| Target | Weakest adjacent (60%) or leader (25%) |
| Personality | **None** — Northside Gang = Eastside Gang = Southside Gang |

→ Add 3 archetypes: Turtle (def+tech), Aggro (rush 60%), Econo (fast laundering).

---

## 12. UX

| Problem | Fix |
|---|---|
| Topbar = 7 numbers | Reduce to 5: Dirty/s, Clean/s, Members +/s, Map% (Rank), Pressure |
| Q = only attack | Big ATTACK button + secondary Q |
| "module" vs "quarter" | Standardize to "quarter" everywhere |
| Invisible laundering slider | Show ratio + prediction "dirty runout in X s" |
| Help = wall of text | 3 interactive missions |
| Invisible zoning | Permanent map icon for each zone |

---

## 13. Balancing plan (in priority order)

- [ ] **URGENT**: Split `hitmanCooldown` into 5 independent cooldowns.
- [ ] **URGENT**: Cap `dominationFloor` at 60 (instead of 250) to avoid death in 11s.
- [ ] **URGENT**: Add mutual losses in sieges (defenders attack attackers).
- [ ] **URGENT**: Rush slider 10-80% instead of a fixed 20%.
- [ ] Econ nerf: lab ×0.1 (90 dirty/s instead of 900), storefront ×0.1.
- [ ] Laundering commission 25% → 10%.
- [ ] Loot 40% → 20% + Contested 60s.
- [ ] Physical convoys + dedicated Interception.
- [ ] Heat/Pressure gauges + 20s raid telegraphing.
- [ ] Visible bankruptcy timer + econ victory at 30:00.
- [ ] Watcher pre-check before payment.
- [ ] AI: 3 archetypes (Turtle/Aggro/Econo).
- [ ] Telemetry: duration, T50%, end causes.

---

*File updated after analyzing the source code. Constants and formulas extracted from the bundle.*
