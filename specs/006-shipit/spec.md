# Spec 006 — Ship It

**Status:** APPROVED FOR IMPLEMENTATION
**Branch:** `feat/shipit`
**Author:** Abhishek Kaushik
**Created:** 2026-08-23
**Supersedes:** Spec 005 (arcade field) for the home-page maze-chase section

---

## Problem

The shipped arcade field (#160) is an original survey-register game. The
operator rejected that product: the name is wrong, the player reads as a
bracket, corner input bounces, and the rules are not the maze-chase they asked
for. The section must become **Ship It** — original walls, original sprites,
faithful mechanics.

## Goals

1. Replace the home-page arcade section with Ship It.
2. Implement every rule below at level 1 fidelity.
3. Keep the #160 runtime contracts: one rAF, AbortController, theme
   subscription, oscillator audio, no framework, no assets.
4. Rename every user-visible and code-level trace of "Survey" and of "Arcade"
   as this game's name.
5. Produce rendered visual receipts, not source-only confidence.

## Non-goals

- Reproducing the original maze tile-for-tile, character designs, or audio.
- Downloaded, embedded, sampled or base64 audio; sprite sheets; image assets.
- A game framework, physics library, additional motion library or package.
- Online scores, accounts, telemetry, or fruit/bonus items.
- A separate route or fullscreen cabinet chrome.
- Deployment, merge, or changes to the main checkout.
- Re-opening the three approved decisions (maze grammar, name, sprites).

## Experience

The final home-page section is `#shipit`, in the same place `#arcade` occupies
today: after “In the open”, before the footer. The statement head names the
work Ship It. The body holds a DOM status register, the canvas, visible
controls, and a text explanation of the four bugs.

The player is a blinking block caret that eats code characters. Four bugs
chase with four personalities. Energizers are commits that frighten the bugs.

## Functional requirements

### Grid and movement

- **R1:** The board is a hand-authored 28×31 tile grid. It has a central ghost
  house, four energizers near the four corners, a horizontal warp tunnel at
  mid-height, red-zone no-turn-up tiles (two groups above the house, two in the
  lower middle), and roughly 240 pellets + 4 energizers. Walls are original.
  The layout is not a tile-for-tile copy of any published maze.
- **R2:** Actors move on a pixel grid and make decisions at tile centres.
- **R3:** Input sets a *desired* direction. The player turns only when the
  desired direction is legal. Facing a wall, the player **stops and stays
  stopped**, holding the desired direction until it becomes legal. No bounce.
  No auto-reverse.
- **R4:** Cornering: the player may begin turning up to ~4px before the tile
  centre. Ghosts turn only at centres.
- **R5:** Exiting the warp tunnel re-enters the other side. Ghosts move at
  tunnel speed inside it.

### Speeds (level 1, percent of base 75.7575 px/s)

| Actor | Normal | Frightened | Tunnel |
|---|---|---|---|
| Player | 80% | 90% | — |
| Ghost | 75% | 50% | 40% |

- **R6:** Use the table. Player speed also drops slightly while actively
  eating pellets. Level 1 is the floor.

### Ghost modes

- **R7:** Ghosts alternate scatter and chase on a fixed timer. Level 1:
  7s scatter, 20s chase, 7s scatter, 20s chase, 5s scatter, 20s chase, 5s
  scatter, then chase indefinitely. The timer pauses while frightened.
- **R8:** On every mode change, ghosts reverse immediately — the one time
  reversal is legal.
- **R9:** Scatter: each ghost targets its own fixed corner.
- **R10:** Chase targeting — four distinct personalities:
  - **Direct** (Blinky): player's current tile.
  - **Ambush** (Pinky): 4 tiles ahead. When the player faces up, the target is
    4 up **and** 4 left (original overflow). That quirk is required.
  - **Flank** (Inky): take the tile 2 ahead of the player, draw the vector
    from the Direct ghost's tile to it, double that vector.
  - **Shy** (Clyde): target the player when farther than 8 tiles; otherwise
    target its own scatter corner.
- **R11:** At each tile centre a ghost considers legal exits excluding a
  reversal and picks the next tile nearest the target by straight-line
  distance. Ties break up > left > down. Never a reversal except on a mode
  change.
- **R12:** In red zones a ghost may not choose to turn upward.

### Energizers, house, Elroy

- **R13:** An energizer sends every ghost to frightened: reverse, 50% speed,
  pseudo-random wander at each junction. Level 1 fright lasts 6s with 5
  end-of-fright flashes. The flash warning is visible.
- **R14:** Eating frightened ghosts scores 200/400/800/1600 within one
  energizer. An eaten ghost becomes eyes, returns to the house at high speed,
  then re-enters play.
- **R15:** House release: personal dot counters on level 1 are 0 / 30 / 60
  for the second, third and fourth ghosts, **or** a global timer of ~4s of no
  pellets eaten, whichever comes first.
- **R16:** Cruise Elroy: 20 pellets left → Direct at 80% and keeps chasing
  during scatter; 10 left → 85%.

### Eating animation and skin

- **R17:** The player is a blinking text cursor. A solid block caret; the
  leading edge splits and rejoins on a short cycle, oriented to travel
  direction. It must not read as a bracket. Prototype at actual tile size.
- **R18:** Pellets are small code characters. Energizers are larger pulsing
  commits. The four bugs are geometrically distinct, matched to Direct /
  Ambush / Flank / Shy, readable in both themes, and not distinguished by
  colour alone.

### Runtime contracts (carried from #160)

- **R19:** Phases include at least `idle`, `running`, `respawn`, `won`,
  `lost`. Start is explicit. Three lives. Restart reconstructs the initial
  state.
- **R20:** Arrow keys and WASD move only while the canvas has focus and only
  prevent scroll for those keys in that state.
- **R21:** Swipes ≥24 CSS px with dominant axis ≥1.25× the other. Visible
  direction buttons. Start, restart, sound, and direction controls are real
  buttons. Focus is never trapped.
- **R22:** At most one `requestAnimationFrame` loop. Listeners use one
  `AbortController`. Theme changes redraw without resetting the run. Dispose
  on unmount is complete.
- **R23:** `prefers-reduced-motion: reduce` or `html[data-motion="off"]`
  cancels continuous animation. Discrete mode advances a fixed simulation
  step on a legal input and redraws once.
- **R24:** No object, array, path or gradient is allocated in the per-frame
  draw loop. Device pixel ratio is capped at 2.
- **R25:** Sound is off by default, `aria-pressed`, remembered under a Ship It
  storage key (not the arcade key). No `AudioContext` before a gesture inside
  the game. Oscillators only. Disposal closes the owned context.
- **R26:** Canvas has a stable accessible name, fallback text, and a DOM
  description of objective, controls, symbols and the four bugs. Score, lives,
  pellets and phase are DOM text. A polite live region announces start,
  death, win, loss and fright, not every frame.
- **R27:** Colour is never the only entity distinction. Coarse-pointer buttons
  are ≥44×44. No horizontal overflow at 375px. Landing-page axe stays at zero
  WCAG A/AA violations.
- **R28:** Canvas colours from `lib/pixel.ts` only; CSS colours from
  `app/styles/tokens.css` only. No new hex literal. Visual texture is
  deterministic through `h(x, y)` except the frightened wander, which uses a
  seeded PRNG (not `Math.random()`).
- **R29:** No third-party title, character, maze, audio pattern, sprite or
  recording is reproduced. The section stays on the themed page surface.

## Architecture contract

- `lib/shipit/layout.ts` — authored 28×31 board, spawns, energizers, red
  zones, tunnel, reachability.
- `lib/shipit/targeting.ts` — pure targeting and direction-choice functions.
  No DOM. Unit-tested directly.
- `lib/shipit/game.ts` — deterministic state machine. No DOM, React, canvas,
  storage or audio.
- `lib/shipit/audio.ts` — WebAudio scheduler, ported from the arcade kit,
  new storage key.
- `lib/scenes/shipit.ts` — one canvas instance, input, resize, theme, motion,
  drawing, clock, disposal.
- `components/pixel/ShipItGame.tsx` — client island and accessible controls.
- `components/sections/ShipIt.tsx` — server section shell, id `shipit`.

Clean cutover: every arcade caller for this section migrates; arcade section
modules, styles, e2e name, and user-visible "Arcade"/"Survey" copy for this
game are removed. No compatibility alias.

## Success criteria

| # | Criterion | Check |
|---|---|---|
| SC1 | Corner-stuck: face a wall, stop, hold desired direction, never bounce | pure game tests + play GIF |
| SC2 | Cornering, tunnel, speeds, mode timer, reverse-on-mode-change | unit tests |
| SC3 | Direct, Ambush (incl. up-overflow), Flank, Shy are distinct and correct | `targeting.ts` unit tests |
| SC4 | Fright 6s + 5 flashes, 200/400/800/1600, eyes return home | unit + play GIF |
| SC5 | House counters 0/30/60 or 4s idle; Elroy at 20 and 10 | unit tests |
| SC6 | Cursor eat animation reads at tile size; four bugs without colour-only distinction | prototype + screenshots |
| SC7 | Keyboard, buttons, swipe; no focus trap; axe zero | Playwright + axe |
| SC8 | Both motion vetoes stop continuous play | unit + `e2e/reduced-motion.spec.ts` |
| SC9 | Sound default-off, gesture gate, persist, teardown, oscillators only | mocked WebAudio tests |
| SC10 | One loop, allocation-free draw, complete dispose | scene lifecycle test |
| SC11 | 1440 and 375, both themes, play GIF covering SC1/SC4/SC6 and each targeting rule | rendered artifacts |
| SC12 | Gates green; no Survey/Arcade name leak for this game | commands + ripgrep |

## Receipt policy

Visual acceptance uses browser screenshots for light/dark at 1440×900 and
375×667 and a GIF of real play. Captures live outside the worktree at
`/tmp/akaushik-shipit-receipts-20260823/`. Model prose and unit-test success
alone are not visual evidence.
