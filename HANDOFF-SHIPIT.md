# Handoff — "Ship It", the maze-chase rebuild (feat/shipit)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
Worktree: `/Users/abhishek/projects/personal/akaushik.org-worktrees/shipit`, branch `feat/shipit`
off `origin/main` (4e5082a).
**Never touch the main checkout.** Two other streams run in sibling worktrees.

This **replaces** the arcade section shipped in #160 (`feat/arcade`, commit `c756ce3`). Read that
code first — the mount/dispose shape, the WebAudio oscillator kit and the theme subscription are
all sound and should be carried forward. What gets replaced is the maze, the rules, the sprites and
the name.

---

## Operator brief, verbatim

> - In the real Pac-Man, when the player moves and they get stuck in a corner, they don't bounce
>   back. They remain stuck until the player changes direction.
> - For the real game, I want you to figure out all the rules by researching what they should be,
>   and then let's redo this. Why is it called Survey? It should not be called Survey.
> - It should have a nice eating animation of this thing. It should not look like a bracket.
> - The things that we get chased by could be representative of bugs. Instead of the Pac-Man
>   sprite, we could do maybe a developer sprite, and the bugs are chasing them.
> - I want you to research the proper interactions and the proper map layout … something that we
>   want identical to the game. The only thing we will change is the ghost and the player.

The research is done and **three decisions are already approved by the operator**. Do not re-open
them:

1. **Maze** — same grammar, original walls.
2. **Name** — "Ship It".
3. **Sprites** — cursor eats code, bugs chase.

---

## The copyright line, and why the maze is "grammar, not copy"

Game *rules and mechanics* are not copyrightable — you may implement the original's behaviour
exactly, and you should. The *maze as drawn*, the character designs and the sounds are protected
audiovisual work. So:

- **Implement**: every rule below, faithfully.
- **Do not reproduce**: the original wall layout tile-for-tile, the ghost/Pac-Man character
  designs, or any original audio. No sampled WAVs of the game. Audio stays synthesized from
  WebAudio oscillators, as #160 already does.

"Same grammar, original walls" means: 28×31 tile grid, a central ghost house, four energizers near
the four corners, a horizontal warp tunnel at mid-height, the red-zone no-turn-up tiles, and
roughly 240 dots + 4 energizers — but **our own wall drawing** inside that structure. Design a maze
that satisfies the grammar and looks like this site.

---

## The rules — implement all of these

Sourced from Jamey Pittman's *Pac-Man Dossier*, the reference disassembly analysis.

### Grid and movement

- 28 × 31 tiles. Actors move on a pixel grid and make decisions at tile centres.
- **Corner-stuck (the operator's first item)**: input sets a *desired* direction. The actor turns
  only when the desired direction is legal. Facing a wall, the actor **stops and stays stopped**,
  holding the desired direction until it becomes legal. It never bounces back and never
  auto-reverses. This is the single most-noticed defect in the current build.
- **Cornering**: the player may begin turning up to ~4px before the tile centre, cutting the
  corner and gaining distance. Ghosts may not — they turn only at centres. This asymmetry is how a
  skilled player escapes, so it is load-bearing, not a detail.
- **Warp tunnel**: exiting one side re-enters the other. Ghosts move at reduced speed inside it.

### Speeds (level 1, as a percentage of the base 75.7575 px/s)

| Actor | Normal | Frightened | Tunnel |
|---|---|---|---|
| Player | 80% | 90% | — |
| Ghost | 75% | 50% | 40% |

Player speed also drops slightly while actively eating dots. Scale these per level if you implement
levels; level 1 is the floor.

### Ghost modes

Ghosts alternate **scatter** and **chase** on a fixed timer. Level 1: scatter 7s, chase 20s,
scatter 7s, chase 20s, scatter 5s, chase 20s, scatter 5s, then chase indefinitely. The timer pauses
while frightened.

On **every mode change**, ghosts reverse direction immediately — the one time reversal is legal.

**Scatter**: each ghost targets its own fixed corner, which produces the familiar looping patterns.

**Chase targeting — four distinct personalities. Implement all four; this is what makes it a game
rather than four identical pursuers:**

- **Direct** (Blinky's rule): targets the player's current tile.
- **Ambush** (Pinky's rule): targets 4 tiles ahead of the player. Reproduce the original's
  up-direction overflow — when the player faces up, the target is 4 up **and** 4 left. That quirk
  is a documented behaviour players rely on, so it is part of the rules, not a bug to fix.
- **Flank** (Inky's rule): take the tile 2 ahead of the player, draw the vector from the Direct
  ghost's tile to it, and double that vector. Requires the Direct ghost's live position.
- **Shy** (Clyde's rule): targets the player when farther than 8 tiles away; otherwise targets its
  own scatter corner. Produces the characteristic approach-and-flee.

**Direction choice**: at each tile centre, a ghost considers the legal exits excluding a reversal,
and picks the one whose *next* tile is nearest the target by straight-line distance. Ties break
up > left > down. Never a reversal except on a mode change.

**Red zones**: four tile groups (two directly above the ghost house, two in the lower middle) where
a ghost may not choose to turn upward. Place the equivalents in your maze.

### Energizers and frightened state

- Eating an energizer sends every ghost to frightened: they reverse, slow to 50%, and wander
  (pseudo-random at each junction rather than targeting).
- Level 1 fright lasts 6s with 5 end-of-fright flashes. The flash warning must be visible.
- Eating frightened ghosts scores 200/400/800/1600 within a single energizer.
- An eaten ghost becomes eyes and returns to the house at high speed, then re-enters play.

### Ghost house release

Each ghost leaves on a personal dot counter (level 1: 0 / 30 / 60 for the second, third and fourth)
**or** on a global timer (~4s of no dots eaten), whichever comes first.

### Cruise Elroy

When dots remaining falls to a threshold, the Direct ghost speeds up and keeps chasing even during
scatter. Level 1: 20 dots left → 80%, 10 dots left → 85%. This is what makes the endgame tense.

### Eating animation (the operator's third item)

> It should not look like a bracket.

The current sprite is a wedge that reads as `<`. The approved player is **a blinking text cursor
that opens and closes as it eats** — a solid block caret whose leading edge splits and rejoins on a
short cycle, oriented to travel direction. It should read unmistakably as a cursor consuming
characters, and it must still read at the tile size the maze gives it. Prototype it at actual size
before committing to it.

### The skin (approved)

- **Player**: the blinking text cursor above.
- **Dots**: code characters, not dots. Small glyphs.
- **Energizers**: commits — larger, pulsing.
- **Chasers**: four visually distinct pixel bugs, each one readable as a different bug, matched to
  the four personalities above so a player can learn which is which. Distinguishable in both themes
  and not by colour alone.

---

## Constraints

- **Pipeline**: this is net-new behaviour across several files, so the mandatory-pipeline gate
  blocks a push without a spec triad. Run `clarify -> spec -> plan -> tasks` into `specs/NNN-shipit/`
  on this branch **before** implementation. This is not surgical work; do not declare it so.
- **Accessibility**: canvas needs a name and text alternative; keyboard play (arrows + WASD) must
  work without a pointer; touch gets swipe input; the section must not trap focus. axe runs in CI
  and zero violations is the standing bar.
- **Audio off by default**, visible mute control, state remembered, nothing before a user gesture.
- **Reduced motion**: honour `prefersReducedMotion()` and the site's `data-motion="off"` switch.
- One rAF loop, disposed on unmount, `AbortController` for listeners. No game framework, no audio
  files, no sprite sheets. Never hard-code a hex — `lib/pixel.ts` and `lib/pixel-theme.ts`.
- Rename every user-visible and code-level trace of "Survey".

## Receipts

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage`, Playwright green, axe clean, plus
**a GIF of actual play** at 1440px and 375px in both themes, showing: corner-stuck behaviour, the
eating animation at real size, a fright cycle, and at least one ghost visibly using each targeting
rule. Unit-test the targeting functions directly — they are pure and there is no excuse not to.

A game reported working on a passing unit test is not reported working.

Apex owns the deploy. Do not deploy. Commit at every boundary.
