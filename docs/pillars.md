# Pillars — Vision and non-negotiable rules (DealerFront mode)

> Status: **v3 (DealerFront)** — shift from an embodied dealer to a **god-view cartel**. Replaces the "single character" vision.

## Objective

Fix the game's identity and the invariants that apply to **all** systems. In case of conflict, these pillars prevail.

## Vision / Pitch

**Solo strategy/management** game, **real map** view (Paris, IRIS quarters) playable in the browser. You play **the cartel** (God view): you no longer control a character, you **command from afar**. Objective: **stay the last cartel in play** (battle royale), against **5 AI gangs** and the **police**.

**Inspirations**: OpenFront (real-time territorial control, alliances, traitors), management under pressure (Heat, police), Frostpunk (diegetic UI).

## The pillars

### 1. One game = one closed story
No meta progression, no link between runs. Each game stands on its own.

### 2. Honest difficulty
Never hidden, never adaptive (no rubber-banding). Base difficulty is **set at generation** (city, factions, neutral control) and **readable**. It then evolves **through pure causality** (quarter captures, Heat, police).

### 3. Realistic and traceable simulation
Every behavior (AI, police, economy) results from a **consistent and auditable rule system**. The player can understand why they lost a quarter or got liquidated.

### 4. Management AND conquest, on equal footing
**Balanced** loop: the **economy** (produce, sell, launder) funds the **army** (Influence, tech) and **conquest** (quarters) feeds the **economy**. Neither a passive builder nor a pure wargame.

### 5. Cartel command (God view)
**No more RP immersion or single character.** You observe and command from afar: quarter selection, faction orders, conquest. Depth comes from **planning** (where to strike, what to build, when to launder, when to corrupt).

### 6. Color is information (factions)
Deliberate exception to strict B&W: **color marks possession** (factions) and functional signals. The world stays B&W; color never decorates.

## Non-negotiable rules (cross-cutting)

| # | Rule | Consequence |
|---|---|---|
| R1 | **No rubber-banding** | The game never adapts rules/AI to player performance. |
| R2 | **No meta-progression** | No link between games. |
| R3 | **Pure causality** | Every tension (police Pressure, quarter losses) has a traceable in-game cause. |
| R4 | **Readable base difficulty** | Communicated by observing the world, never by a hidden number. |
| R5 | **Functional B&W** | The world is grayscale; color is **informative** (factions, alerts). |
| R6 | **A posteriori feedback** | End-of-run explanations, no intrusive pop-ups. |
| R7 | **No AI omniscience** | AI gangs act on what they perceive/remember, not on absolute truth. |
| R8 | **Causal ending** | The game ends for a cause (victory, liquidation, bankruptcy), never a simple timer. |

## Edge cases

- **Pillar / fun conflict**: a mechanic that violates R1/R2/R3 is rejected or reformulated.
- **Possession readability**: faction color must never hide terrain readability (translucent fills, outlines).
- **God view vs management**: one must be able to play **without** micro (batch/quarter orders).

## Dependencies

- Referenced by **all** specs. Implementation: `territory.md` (R3), `combat.md`, `factions.md` (R7), `police-ai.md` (R1/R3), `art-direction.md` (R5/R6), `ui-ux.md`.

## Validation criteria

- [ ] No mechanic contradicts R1–R8.
- [ ] The game is playable **without a character** (god view, quarter orders).
- [ ] Possession is readable by color without breaking the terrain's B&W.
- [ ] Every tension increase is causally traceable.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Player model | **God-view cartel** (end of the embodied dealer) |
| 2 | Loop | Economy ↔ conquest on equal footing |
| 3 | Color | Allow color as **faction information** |
| 4 | Pillars kept | R1–R4, closed run, causality |
| 5 | Pillars replaced | "single character" → **cartel command** |
