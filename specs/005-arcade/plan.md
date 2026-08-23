# Plan 005 — Arcade field

**Spec:** `spec.md` · **Branch:** `feat/arcade`

---

## 1. Decision

Build one small deterministic engine, one WebAudio scheduler and one React canvas
island. Do not adapt `mountField` into a game engine: its source-to-intensity
pipeline is designed for stochastic decorative silhouettes, while maze topology
must remain solid and collision-readable. Reuse its vocabulary and primitives,
not its loop.

The fixed board is preferable to procedural generation. It can be reviewed for
originality, asymmetry, spawn safety and mobile legibility; connectivity becomes
a permanent test rather than a probabilistic property. `h(x, y)` still supplies
wall texture and Drift tie-breaking.

The section is the last item in `<main>`, immediately after the OpenSource
component whose visible label is “In the open”. The professional narrative
remains uninterrupted and the game becomes a playable coda before the footer.

## 2. Boundaries

### `lib/arcade/layout.ts`

Export board dimensions, immutable tile data and four authored spawn cells. Keep
the source as readable rows and compile it once to a compact typed grid. Validate
row width while constructing the module. Provide allocation-free helpers for
indexing, bounds and walkability. The layout contains no recognizable enclosure,
central pen, wrap tunnel or bilateral symmetry.

### `lib/arcade/game.ts`

Export the state types and a small mutating engine API:

- `createArcadeGame()` — fresh readings, score, lives, phases and preallocated
  pathfinding scratch buffers;
- `startGame`, `restartGame`, `queueDirection`;
- `stepGame(game, deltaMs)` for live mode;
- `stepTurn(game)` for reduced-motion mode;
- `snapshotGame(game)` only at observable boundaries for the React HUD.

Movement remains cell-based. Store previous/current cells and an interpolation
fraction for drawing. Use fixed accumulators and cap catch-up steps after a long
background pause. Live periods are player 110ms, Direct 190ms, Cutline 210ms and
Drift 230ms. Player turns prefer the queued direction, then the current
direction, then stop.

Direct and Cutline compute one distance field into reused typed arrays when they
move. Direct targets the player's current cell. Cutline walks up to three legal
cells ahead, backing toward the player when the projected target is blocked.
Drift enumerates legal non-reversing neighbours and indexes them with `h(x, y)`
plus a stable move counter; it reverses at dead ends. No per-tick arrays or path
objects.

Collision is checked after each entity move and includes position swaps.
Clearing the final reading wins and ends the step before a pursuer can move. A
live collision enters a 900ms input-locked respawn; a discrete collision resets
in the same redraw. The engine emits compact event flags (`reading`,
`collision`, `won`, `lost`, `phase`) that the scene drains; it does not call UI
or audio code.

### `lib/arcade/audio.ts`

Keep the event scheduler independent from the game. `scheduleArcadeSound`
accepts an AudioContext-compatible owner, a destination and one event; this is
the production function used by both live audio and the offline receipt. It
creates square/triangle oscillators and gains, schedules short envelopes, then
stops and disconnects sources.

`createArcadeAudio()` owns lazy context creation, the exact storage key
`abhishek.portfolio.arcade.sound`, stored opt-in state, active-source cleanup and
disposal. Reading sounds use only small continuous frequency/duration jitter,
never a scale or repeating interval. Collision, win and loss use short,
original, non-melodic gestures. No fetch, buffer decode, media element or asset
URL exists in the module.

### `lib/scenes/arcade.ts`

`mountArcade(canvas, options): ArcadeHandle` owns exactly one run:

- create game and audio handles;
- size canvas at DPR ≤ 2;
- attach canvas keyboard and pointer/swipe events under one AbortController;
- subscribe to theme and both motion sources;
- start/cancel at most one rAF loop;
- update and draw through the existing palette helpers;
- notify React only when the serializable HUD snapshot changes;
- expose `start`, `restart`, `input`, `setSoundEnabled`, `snapshot`, `focus` and
  `dispose`.

The draw pass uses precomputed wall/readings data and module-level shape masks.
Walls are always legible, with deterministic accent cells as texture. The
closing register is derived from `(initialReadings - remainingReadings) /
initialReadings`. No gradient, path, temporary array or object is constructed in
the frame loop.

If motion is vetoed, cancel rAF. A legal input moves the player one cell and one
pursuer in Direct → Cutline → Drift round-robin order, drains events and redraws
once; a blocked input does nothing. A collision resets in that redraw. A theme
change redraws only. When motion becomes allowed again during a running phase,
restart the single loop.

### React and CSS

`components/pixel/ArcadeGame.tsx` mounts the scene in an effect and disposes it.
It owns DOM status only: score, readings, lives, phase, a polite announcement,
Start/Restart, Sound, four direction buttons, legend and text alternative. The
canvas is focusable, named and described; game keys are scoped to it.

`components/sections/Arcade.tsx` supplies the statement head and editorial copy.
`app/styles/sections/arcade.css` uses existing tokens, aligns the HUD to ruled
rows, keeps the board on the page surface and provides 44px coarse-pointer
controls. `app/layout.tsx` imports it before `_mobile.css`; `app/page.tsx` adds
it immediately after `<OpenSource />`.

## 3. Sequence and commit boundaries

### U0 — specification

Land `clarify.md`, `spec.md`, `plan.md` and `tasks.md` before code. Run the process
check against the staged specification commit. Commit:
`docs(arcade): specify original field game`.

### U1 — deterministic core

Create layout and game modules with focused tests. The tests prove connectivity,
mirror/tunnel/enclosure bans, minimum spawn distance, deterministic initial
state, fixed live periods, buffered turns, reading score, collision reset, swap
collision, final-reading precedence, three pursuer strategies including Drift's
dead-end reversal, win, loss, restart and reduced-motion turns. Run only the
focused Vitest files, then typecheck.
Commit: `feat(arcade): add deterministic field engine`.

### U2 — oscillator audio

Create the scheduler and lazy audio owner with a fake AudioContext test harness.
Prove default-off, exact preference key, no pre-gesture context, persisted
opt-in, event envelopes, active-source stop and disposal. Render an early offline
WAV from the production scheduler; inspect duration, peak and waveform and
listen for harshness or recognizable patterns before accepting the sound design.
Commit: `feat(arcade): synthesize field audio`.

### U3 — section and canvas

Create the scene, client island, section and stylesheet; wire page/layout imports
and a CHANGELOG entry in the same staged unit. Read the bundled Next.js 16 guide
for client components before writing the wrapper. Start the actual dev server,
play with keyboard and touch emulation, switch themes and motion, and capture the
first desktop/mobile screenshots. Visual failure is fixed here, not deferred to
tests. Commit: `feat(arcade): add playable homepage section`.

### U4 — browser contract

Add `e2e/arcade.spec.ts` and extend reduced-motion/canvas coverage only where the
observable contract is new. Exercise Start, keyboard direction, button input,
swipe, score, audio control, state preservation across theme, reduced-motion
turns, focus escape and responsive overflow. Keep the landing-page axe scan at
zero. Run the focused Playwright files first. Commit:
`test(arcade): cover accessible play`.

### U5 — hardening and receipts

Run the complete required commands. Pin the deciding review to Grok because the
implementation uses OpenAI lanes; use Muse and other free non-OpenAI lanes for
independent refuter votes. Fix accepted findings and rerun affected receipts.

Capture under `/tmp/akaushik-arcade-receipts-20260823/`:

- 1440×900 light screenshot;
- 1440×900 dark screenshot;
- 375×667 light screenshot;
- 375×667 dark screenshot;
- a short GIF showing a real start, movement and reading clear;
- a WAV rendered from the production scheduler, plus duration, peak, waveform
  and listening inspection.

Run a production build, confirm `package.json` and `pnpm-lock.yaml` are unchanged,
and scan changed files for shipped media, base64, hard-coded colours,
`Math.random()` and third-party arcade vocabulary. Captures remain outside the
worktree and are reported by path; they are not committed or served. Commit
final code/doc fixes only. Do not deploy or push.

## 4. Tests that defend the contract

### Unit

- Board rows are rectangular, connected, non-mirrored, have no open wrap tunnel
  or central enclosure, and contain one player plus three distinct valid spawns.
- Every initial reading is reachable, no reading overlaps a spawn and every
  pursuer begins at least six path cells from the player.
- Identical input/timing sequences produce identical snapshots.
- A queued legal turn wins at the first intersection; an illegal turn does not
  erase current movement.
- Same-cell and swapped-cell collisions decrement exactly one life.
- A final reading wins before a later pursuer move.
- Live respawn lasts 900ms and preserves score/readings; discrete collision
  resets immediately; restart resets everything.
- Direct shortens distance to current position; Cutline differs when there is
  legal space three cells ahead; Drift is stable, non-reversing except at a dead
  end and not a direct clone.
- Clearing the final reading wins; the third collision loses.
- Discrete mode advances the player plus one round-robin pursuer only after a
  legal input.
- A focused scene lifecycle test proves one rAF and complete disposal.
- Audio creation and node scheduling obey the exact key, gesture and mute gates.

### Browser

- The section renders and the engine sizes the canvas backing store.
- Canvas, instructions, legend and controls expose the required accessible names.
- Start then keyboard input changes an observable HUD value without pointer use.
- Direction button and swipe paths change the same game state.
- Tab can leave the canvas and arrow keys outside it still scroll the page.
- Sound is off initially, persists, and creates no sound before activation.
- Theme toggles preserve score/readings and redraw.
- Both motion vetoes stop autonomous changes; one input advances once.
- At 375px the document has no horizontal overflow and controls are ≥44px.
- The existing axe scan remains empty.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Fixed layout accidentally resembles familiar work | asymmetric authored topology, no central enclosure/tunnels, visual review in both widths before acceptance |
| Field texture makes collision boundaries unclear | walls remain solid; hash changes colour/accent only, never occupancy |
| Keyboard steals page scroll | key listener lives on the focusable canvas and prevents only recognized game keys while focused |
| Canvas touch blocks page navigation | swipe region is bounded; visible buttons provide an equivalent path; mobile smoke test includes scrolling past the section |
| Remembered sound violates autoplay | restore intent only; context remains absent until a fresh gesture |
| Reduced motion makes game unusable | cancel continuous loop and use one-input/one-turn discrete mode |
| React state updates every frame | snapshot callback fires only after observable state transitions |
| Background tab causes a catch-up burst | cap elapsed time and maximum simulation steps per frame |
| Audio passes tests but sounds harsh or derivative | offline render and listening are acceptance gates; adjust oscillator type, interval and envelope from the rendered WAV |
| Visual model feedback repeats slab failure | judge actual screenshots, not model descriptions; apex owns final visual acceptance |

## 6. Required receipts

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm process:check
pnpm test:e2e
```

Report pass counts for Vitest and Playwright, axe violation count, screenshot/GIF
paths and dimensions, WAV path/duration/peak, commit hashes and a clean worktree.
No deploy and no push to main.
