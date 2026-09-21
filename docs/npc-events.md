# NPC & Events — Decoy, notable NPCs and choices with consequences

> Status: **implemented (P26)** — pool of 3 choice events, one at a time, traceable effects. — decoy, informant, corrupt contact, rival and choices decided; MVP scope locked.
> The **agent engine** (brain, life, IQ, roles, serve/betray) is specified in **`factions.md`**; this file covers its **notable uses** and the **choice events**.
> ✅ **GDD §14D arbitration locked**: agents/rivals are **included from the MVP** (the GDD placed them post-MVP).

## Objective

Describe the "light RPG / choices with consequences" layer included from the MVP: a paid decoy, recurring notable NPCs and choice events whose effects are traceable and consistent with pure causality (no "scripted good/bad" choice). These mechanics enrich anticipation without introducing direct combat or meta-progression.

## Rules

### A. Decoy / distraction

- The player can generate an event that diverts a patrol's attention (false alarm, provoked altercation, triggered traffic jam).
- **Cost**: a **small amount of dirty money** + a risk of **deferred global Heat** — never free (avoid a "cancels the danger" button).
- **Discoverable**: the police can **discover the decoy**; if they do, the case rises (**+global Heat**): the police "know" they were fooled.
- It is an **order-system action** (`command.md`).

### B. Notable NPCs (light RPG layer)

- **Potential informant** — can **report** the player (local Heat) or be **bought once**; the purchase **reduces their reporting risk for the rest of the run** (they are not turned into an ally).
- **Corrupt contact** (dirty agent) — **temporarily reduces global Heat** in a zone; **recurring payment**; **risk of being arrested or transferred** mid-run (loss of the advantage + consequence on the case).
- **Quarter rival** — **consumes the opportunity** of a neglected zone (clients, fronts); **can resort to violence depending on their profile** (aggressive profiles overlap with the hitmen of `factions.md`).
- Notable NPCs are **agents** in the sense of `factions.md` (IQ, memory, relation, serve/betray).

### C. In-run choices with consequences

- **5+ choice events per run** (high frequency), each with a **traceable** effect, immediate or deferred, on Heat/opportunity/relations.
- Examples: accept a risky but lucrative delivery, report or cover an NPC caught red-handed, choose between two competing fronts.
- **No choice is scripted good/bad**: each has a real cost and benefit in the system.

### D. MVP scope

- **All roles are in the MVP**: dealers, watchers, hitmen, informant, corrupt contact, rival (`factions.md`).
- Violence (hitmen, aggressive rival) is **traced** and weighs on the score (`scoring.md`).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Decoy cost (dirty money) | small amount, **TBD** | TBD |
| Decoy discovery chance | **TBD** | TBD |
| Global Heat if decoy discovered | **TBD** | TBD |
| Informant purchase cost | **TBD** | TBD |
| Reporting risk reduction (bought informant) | **TBD** | TBD |
| Global Heat reduction (corrupt contact) | **TBD** | TBD |
| Recurring contact payment | **TBD** (amount + frequency) | TBD |
| Contact arrest/transfer chance | **TBD** | TBD |
| Opportunity consumption rate (rival) | **TBD** | TBD |
| Rival profiles (peaceful / aggressive) | **TBD** (distribution) | TBD |
| Number of choice events per run | **5+** | fixed |
| Choice event pool size | **TBD** | TBD |
| Number of simultaneously active notable NPCs | **8–12** (`factions.md`) | fixed |

## Edge cases

- **Decoy too strong**: if it systematically cancels the danger, it violates the spirit of risk → cost + discovery must be dissuasive.
- **Violent rival**: depending on their profile, they can resort to violence (traced, score penalty); peaceful profiles only consume opportunity.
- **Corrupt contact arrested**: planned event (loss of the advantage + consequence on the case) → values **TBD**.
- **Choice with deferred consequence**: the player must understand the choice's effect a posteriori at the end of the run (`scoring.md`, R6).
- **Accumulation of hostile NPCs**: risk of an unfair spiral → **safeguard** (cap of simultaneous hostiles + cooldowns) **TBD**.
- **factions.md consistency**: a notable NPC follows the same engine (memory, relation, IQ) as any agent; no exception.

## Dependencies

- `pillars.md` — R2 (no meta), R3 (causality), R6 (a posteriori feedback).
- `factions.md` — agent engine (IQ, memory, relation, serve/betray, roles).
- `police-ai.md` — costs and effects on police Pressure.
- `city-sim.md` — NPCs/events fit into the zones and urban events.
- `command.md` — the decoy and interactions are actions.
- `scoring.md` — choices, relations and violence integrated into the causal recap.
- `art-direction.md` — purple/mauve = choice interaction available.

## Validation criteria

- [ ] No choice is "free": each has a measurable cost and benefit.
- [ ] The decoy is never a dominant "cancels the danger" button (discovery + global Heat).
- [ ] Notable NPCs have a memorized state and genuinely influence the run.
- [ ] The effects of choices (including violence) are traceable in the end-of-run recap.
- [ ] No mechanic in this spec creates persistent progression between runs (R2).
- [ ] All listed roles are actually present in the MVP.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Decoy cost | Dirty money + deferred global Heat |
| 2 | Decoy discovery | Discoverable → +global Heat (case) |
| 3 | Informant | One-time purchase (reduces the run's reporting risk) |
| 4 | Corrupt contact | Global Heat reduction + risk of arrest/transfer |
| 5 | Rival | Consumes opportunity + violence depending on profile |
| 6 | Choices with consequences | 5+ per run |
| 7 | MVP scope | All roles in the MVP (locks the deviation from GDD §14D) |
