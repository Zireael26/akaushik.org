# Plan 006 — Ship It

**Spec:** `spec.md` · **Branch:** `feat/shipit`

---

## 1. Decision

Rebuild in place. Carry the #160 runtime (mount/dispose, oscillator kit, theme
subscription, client island, section rhythm). Replace layout, rules, sprites
and the name.

Do not adapt the cell-step arcade engine into Pac-Man rules. Arcade movers
step cell-to-cell on a period clock. Ship It movers travel on a pixel grid
and decide at tile centres, with player cornering at ~4px. That is a new
`game.ts`.

Keep the file split: layout / targeting / game / audio / scene / island /
section. Targeting is its own module so the four personalities can be tested
with no clock.

The maze is authored as readable rows in `layout.ts` and compiled once. It
satisfies the grammar (28×31, house, four energizers, mid-height tunnel, red
zones, ~240 pellets) and is drawn in this site's wall language. Visual review
of the rendered board is an acceptance gate, not a unit-test afterthought.

## 2. Boundaries

### `lib/shipit/layout.ts`

Export `BOARD_WIDTH = 28`, `BOARD_HEIGHT = 31`, tile enum, compiled grid,
player spawn, four ghost house seats, energizer tiles, red-zone tiles, tunnel
rows, pellet count. Helpers: index, walkable, tunnel wrap, in house, in red
zone, in tunnel. No DOM.

Validate row width at module init. Tests prove grammar counts, connectivity
from player spawn to every pellet and energizer, house interior, four
energizers in distinct quadrants, a pair of tunnel mouths, red zones present,
and that the wall bit-pattern is not a known published 28×31 dump (hash the
wall mask; pin our hash; reject accidental paste).

### `lib/shipit/targeting.ts`

Pure functions:

- `ambushTile(playerTile, facing)` — includes the up-and-left overflow.
- `flankTile(playerTile, facing, directTile)` — 2-ahead then double the
  vector from Direct.
- `shyTile(playerTile, shyTile, scatterCorner)` — 8-tile Euclidean threshold.
- `chooseExit(from, target, facing, exits)` — nearest straight-line, ties
  up > left > down, never reverse unless `allowReverse`.
- `scatterCorner(id)` — fixed per bug.

No timers, no RNG, no DOM. Exhaustive fixture tests for each personality,
including the up-overflow and the shy approach-and-flee boundary.

### `lib/shipit/game.ts`

Pixel-grid state machine:

- `createShipItGame()`, `startGame`, `restartGame`, `queueDirection`
- `stepGame(game, deltaMs)` live
- `stepDiscrete(game)` reduced-motion
- `snapshotGame(game)` at observable boundaries

Desired-direction buffer. Stop-and-hold on a blocked facing (R3). Player
cornering window ~4px (R4). Ghosts decide only at centres. Mode timer per R7,
paused in fright, reverse on change (R8). Speeds per R6. Fright, scores,
eyes, house counters, Elroy per R13–R16. Seeded PRNG for frightened wander.

Emit compact events (`pellet`, `energizer`, `eat`, `death`, `won`, `lost`,
`mode`) for the scene to drain. No UI or audio calls.

### `lib/shipit/audio.ts`

Port `lib/arcade/audio.ts`. New key `abhishek.portfolio.shipit.sound`. Same
gesture, mute, teardown contracts. Cues: pellet tick, energizer, eat-bug,
death, win, loss. No siren loop that evokes the original. Square/triangle
only.

### `lib/scenes/shipit.ts`

`mountShipIt(canvas, options): ShipItHandle`. One rAF, one AbortController,
theme + both motion sources, DPR ≤ 2, allocation-free draw. Draw the cursor
eat cycle and the four bug geometries from module-level masks. Reduced motion
cancels rAF and uses `stepDiscrete`.

### React and CSS

`ShipItGame.tsx` owns HUD, live region, Start/Restart, Sound, direction
buttons, legend. `ShipIt.tsx` is the section shell (`id="shipit"`, label
Ship It). `app/styles/sections/shipit.css` uses tokens only; import before
`_mobile.css`. `app/page.tsx` swaps `<Arcade />` for `<ShipIt />`.

Delete the arcade section modules once nothing references them: `lib/arcade/*`
(except any helper still shared — prefer copy-then-delete over alias),
`lib/scenes/arcade.ts`, `components/pixel/ArcadeGame.tsx`,
`components/sections/Arcade.tsx`, `app/styles/sections/arcade.css`,
`e2e/arcade.spec.ts`. Update `e2e/reduced-motion.spec.ts` selectors from
`#arcade` to `#shipit`.

## 3. Sequence and commit boundaries

### U0 — specification

This triad. Commit: `docs(shipit): specify maze-chase rebuild`.

### U1 — layout + targeting

`layout.ts`, `targeting.ts`, focused tests. Commit:
`feat(shipit): add maze grammar and targeting`.

### U2 — game engine

`game.ts` + tests for R3–R16. Commit: `feat(shipit): add pixel-grid rules`.

### U3 — audio + scene + section

Audio port, scene, island, section, CSS, page wire, CHANGELOG, delete arcade
callers. Prototype the caret at actual tile size before locking masks.
Commit: `feat(shipit): replace arcade section`.

### U4 — browser contract

`e2e/shipit.spec.ts`, reduced-motion updates, axe, 375px geometry.
Commit: `test(shipit): cover accessible play`.

### U5 — receipts

Foreman-run commands, screenshots, GIF. Reviewer is Grok (implementer is
ox-alpha). Do not deploy or push to main.

## 4. Tests that defend the contract

- Board is 28×31, connected, has house / tunnel / four energizers / red zones
  / pellet count in [220, 260], wall-mask hash is ours.
- Desired direction into a wall stops and holds; a later legal direction
  resumes; no reverse is invented.
- Player may turn inside the 4px window; a ghost may not.
- Tunnel wrap; ghost tunnel speed.
- Mode schedule and reverse-on-change.
- Direct / Ambush / Flank / Shy fixtures, including up-overflow and shy
  8-tile boundary.
- Fright duration, flash count, combo scores, eyes home.
- House 0/30/60 and 4s idle release.
- Elroy thresholds.
- Discrete mode advances only on legal input.
- Audio key, gesture, mute, teardown.
- One rAF and complete dispose.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Maze accidentally copies the original | authored walls, hash pin, visual review |
| Caret still reads as a bracket | prototype at tile size; reject wedges |
| Ink on cobalt fill fails contrast | bugs use geometry; measure glyph/fill pairs |
| Pixel movement desyncs from tile decisions | decide only at centres; tests on exact px |
| Arcade name leaks | ripgrep Survey/Arcade after cutover |
| Fright RNG is `Math.random` | seeded PRNG in game state |
| Reduced motion makes the game unusable | discrete step on input |

## 6. Required receipts

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm process:check
pnpm test:e2e
```

Report pass counts, axe count, screenshot/GIF paths, commit hashes, clean
worktree. No deploy. No push to main.
