# Spec 005 — Arcade field

**Status:** APPROVED FOR IMPLEMENTATION
**Branch:** `feat/arcade`
**Author:** Abhishek Kaushik
**Created:** 2026-08-23

---

## Problem

The home page's pixel language proves itself in decorative fields, diagrams and
navigation, but not in sustained interaction. A maze-chase game can make that
language playable, provided it remains original, accessible, lightweight and
native to the page rather than imitating a known arcade property.

The risky shortcuts are also the obvious ones: familiar character silhouettes,
a recognizable maze, ripped audio, a game framework, a black cabinet slab, or a
canvas that works only for sighted pointer users. None is acceptable.

## Goals

1. Add an original, complete maze-chase section to the home page.
2. Use the site's existing deterministic pixel, theme and motion contracts.
3. Support keyboard and touch play with score, lives, win and loss states.
4. Synthesize restrained arcade-style feedback at runtime with WebAudio.
5. Produce rendered visual and audio receipts, not source-only confidence.

## Non-goals

- Adapting, naming, quoting or reproducing any third-party arcade property.
- Downloaded, embedded, sampled or base64 audio; sprite sheets; image assets.
- A game framework, physics library, additional motion library or package.
- Online scores, accounts, telemetry, difficulty settings or procedural levels.
- A separate route, fullscreen mode, pause menu, power-ups or mobile haptics.
- Deployment, merge or changes to the main checkout.

## Experience

The final home-page section is `#arcade`, immediately after the component
`components/sections/OpenSource.tsx` (whose visible label is “In the open”) and
before the footer. Its statement head introduces an asymmetric survey field
rather than an arcade cabinet. The right-hand body contains a DOM status
register, the canvas, visible controls and a text explanation.

The visual signature is the **closing register**: perimeter cells fill in order
as readings are cleared. Walls use stable field texture through the shared hash
while retaining a solid, readable topology. The player is a themed-ink open
directional bracket. Direct is a cobalt needle, Cutline a lime chevron and Drift
an amber knot. Shape and labels repeat every colour distinction. No entity has a
face, body, mascot outline or copied sprite proportion.

The run begins only after Start. The player clears one reading per occupied
cell. Direct targets the current player cell, Cutline targets cells ahead of the
current heading, and Drift chooses a deterministic non-reversing branch. A
collision removes one life and resets positions while preserving cleared
readings and score. Zero readings wins; zero lives loses. Restart begins a clean,
identical run.

## Functional requirements

### Game state

- **R1:** The board is a fixed, hand-authored, asymmetric orthogonal layout. It
  has no central enclosure, open wrap tunnel or horizontal/vertical mirror
  symmetry. Every reading and spawn is reachable from the player spawn, and
  every pursuer begins at least six path cells away.
- **R2:** State phases are `idle`, `running`, `respawn`, `won` and `lost`.
- **R3:** The run starts with three lives. A cleared reading scores 10 points.
  Live periods are 110ms per player cell, 190ms for Direct, 210ms for Cutline
  and 230ms for Drift.
- **R4:** Player intent is buffered by one direction so a turn entered just
  before an intersection is accepted at the first legal cell.
- **R5:** Direct targets the current player cell. Cutline targets up to three
  legal cells ahead, backing toward the player when blocked. Drift chooses a
  deterministic non-reversing branch and reverses only at a dead end.
- **R6:** Same-cell and position-swap collisions both count. Clearing the final
  reading wins immediately and ends the step before any later pursuer move.
- **R7:** A collision preserves readings and score, decrements one life and
  returns all entities to authored spawns. Live mode ignores input for a 900ms
  respawn; discrete mode resets in the collision redraw without a timer.
- **R8:** Restart reconstructs the exact initial state with no stale timers,
  inputs or audio events.

### Input

- **R9:** Arrow keys and WASD move only while the canvas has focus. Those eight
  recognized keys prevent page scrolling only in that focused state; idle,
  respawn, won and lost phases do not move.
- **R10:** The canvas accepts four-direction swipes at least 24 CSS pixels long
  when the dominant axis is at least 1.25 times the other axis.
- **R11:** Four visible direction buttons provide a reliable touch alternative.
- **R12:** Start, restart, sound and direction controls are real buttons. Restart
  is shown only after win or loss. Tab and Shift+Tab follow normal document
  order; focus is never trapped.

### Motion and lifecycle

- **R13:** Normal play uses at most one `requestAnimationFrame` loop. The loop,
  listeners, media-query subscriptions and observers are disposed on unmount.
- **R14:** Event listeners use the house `AbortController` pattern. Theme changes
  use `onThemeChange` and redraw without resetting the run.
- **R15:** Either `prefers-reduced-motion: reduce` or
  `html[data-motion="off"]` cancels continuous animation. In that mode one legal
  direction input advances the player one cell and exactly one pursuer in
  Direct → Cutline → Drift order, then redraws once. A blocked input advances
  nothing; collision reset has no timer.
- **R16:** No object, array, path or gradient is allocated in the per-frame draw
  loop. Device pixel ratio is capped at 2.

### Audio

- **R17:** Sound is off by default and controlled by a visible `aria-pressed`
  button. The preference is remembered at
  `abhishek.portfolio.arcade.sound`.
- **R18:** No `AudioContext`, oscillator or gain node is created before a user
  gesture inside the game. A remembered opt-in restores only control state; a
  later Start, Restart, Sound, direction key, direction button or swipe may
  create or resume the context.
- **R19:** Every sound is scheduled from oscillator and gain nodes at runtime.
  The implementation may use square and triangle waves only.
- **R20:** Events are limited to reading, collision, win and loss. Reading
  variation may use small continuous frequency/duration jitter but no scale,
  repeating melody or recognizable interval/timing pattern. There is no
  background loop, movement sound, attract audio or confirmation jingle.
- **R21:** Disabling sound stops active sources and prevents later scheduling.
  Disposal closes the owned context and clears references.

### Accessibility

- **R22:** The canvas has a stable accessible name, fallback text and a DOM
  description of objective, controls, symbols and pursuer behaviours.
- **R23:** Score, lives, readings and phase are DOM text. A polite live region
  announces start, collision, win and loss without announcing every frame.
- **R24:** Colour is never the only entity distinction; marks differ by geometry
  and are named in the legend.
- **R25:** Coarse-pointer buttons are at least 44×44 CSS pixels and the page has no
  horizontal overflow at 375px.
- **R26:** The landing page keeps zero axe-core WCAG A/AA violations.

### Visual and IP constraints

- **R27:** Canvas colours come only from `lib/pixel.ts`; CSS colours come only
  from `app/styles/tokens.css`. No new hex literal is added.
- **R28:** Every drawn cell follows the existing one-pixel gutter rule and all
  visual texture is deterministic through `h(x, y)`. `Math.random()` is banned.
- **R29:** No third-party title, character, pursuer design, maze, audio pattern,
  sprite, recording or asset is reproduced, imitated, downloaded or embedded.
  Changed UI copy is scanned for third-party arcade vocabulary; topology checks
  enforce R1's enclosure, tunnel and symmetry bans.
- **R30:** The section stays on the themed page surface. It has no cabinet bezel,
  scanlines, glow treatment, isolated dark slab or generic retro chrome.

## Architecture contract

- `lib/arcade/layout.ts` owns the authored board, spawns and reachability data.
- `lib/arcade/game.ts` owns the deterministic state machine and contains no DOM,
  React, canvas, storage or audio calls.
- `lib/arcade/audio.ts` owns WebAudio scheduling and the audio preference key.
- `lib/scenes/arcade.ts` owns one canvas instance, input, resize, theme, motion,
  drawing, the game clock and complete disposal.
- `components/pixel/ArcadeGame.tsx` is the client island and accessible control
  surface. It receives status snapshots only when observable state changes.
- `components/sections/Arcade.tsx` is the server-rendered section shell.

No second engine, compatibility alias, generic game abstraction or framework is
introduced.

## Success criteria

| # | Criterion | Check |
|---|---|---|
| SC1 | A complete run can start, score, lose lives, win, lose and restart | pure game tests cover every phase; Playwright covers start, score, life and restart presentation |
| SC2 | The fixed layout is connected, asymmetric and safe at spawn | reachability, mirror, tunnel, enclosure and minimum-distance tests |
| SC3 | Direct, Cutline and Drift make distinct deterministic choices | focused state-machine tests |
| SC4 | Keyboard, direction buttons and swipe all control the same run | `e2e/arcade.spec.ts` at desktop and mobile widths |
| SC5 | Canvas name, text alternative, focus order and live state are usable | Playwright role/focus assertions and landing-page axe scan |
| SC6 | Theme switches redraw without resetting game state | Playwright theme assertion and light/dark screenshots |
| SC7 | Both motion vetoes stop continuous play and allow discrete input | unit clock/turn checks and `e2e/reduced-motion.spec.ts` |
| SC8 | Sound defaults off, waits for a gesture, persists, tears down and is original | mocked WebAudio tests plus listening/waveform review of the production-scheduler WAV |
| SC9 | No shipped audio/image asset or added dependency | `package.json`/lock unchanged, changed-file media/IP scan and successful production build |
| SC10 | One loop, allocation-free draw and complete cleanup survive remount | focused scene lifecycle test, code inspection and browser remount test |
| SC11 | Desktop and mobile remain legible in both themes | screenshots at 1440×900 and 375×667; short play GIF |
| SC12 | Repository gates remain green | `pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage && pnpm process:check`; production build and Playwright green |

## Receipt policy

Visual acceptance uses actual browser screenshots for light/dark at 1440×900 and
375×667 and a GIF containing real play. Sonic acceptance uses a WAV rendered
from the production oscillator scheduler and inspected by waveform, duration and
listening for harshness or recognizable patterns. All captures live outside the
worktree at `/tmp/akaushik-arcade-receipts-20260823/`. Model prose, source
snapshots and unit-test success alone are not visual or sonic evidence.
