# Clarify 006 — Ship It

**Spec:** `spec.md` · **Branch:** `feat/shipit` · **Autonomy:** build the approved rebuild; do not deploy

This clarification records the operator's binding handoff. Three decisions are
already approved and are not reopened.

---

## 1. Intent

Replace the arcade section shipped in #160 (`feat/arcade`, `c756ce3`) with a
maze-chase that plays by the original's *rules* and this site's *skin*.

The mount/dispose shape, the WebAudio oscillator kit, and the theme
subscription in the current arcade field are sound and are carried forward.
The maze, the rules, the sprites, and the name are not.

Operator, verbatim:

> - In the real Pac-Man, when the player moves and they get stuck in a corner,
>   they don't bounce back. They remain stuck until the player changes
>   direction.
> - For the real game, I want you to figure out all the rules by researching
>   what they should be, and then let's redo this. Why is it called Survey? It
>   should not be called Survey.
> - It should have a nice eating animation of this thing. It should not look
>   like a bracket.
> - The things that we get chased by could be representative of bugs. Instead
>   of the Pac-Man sprite, we could do maybe a developer sprite, and the bugs
>   are chasing them.
> - I want you to research the proper interactions and the proper map layout …
>   something that we want identical to the game. The only thing we will change
>   is the ghost and the player.

The research is done. Approved:

1. **Maze** — same grammar, original walls.
2. **Name** — "Ship It".
3. **Sprites** — cursor eats code, bugs chase.

## 2. IP boundary

Game *rules and mechanics* are not copyrightable. The *maze as drawn*, the
character designs, and the sounds are protected audiovisual work.

- **Implement** every rule in `spec.md`, faithfully, sourced from Jamey
  Pittman's *Pac-Man Dossier*.
- **Do not reproduce** the original wall layout tile-for-tile, the ghost or
  Pac-Man character designs, or any original audio. No sampled WAVs. Audio
  stays synthesized from WebAudio oscillators, as #160 already does.

"Same grammar, original walls" means: 28×31 tile grid, a central ghost house,
four energizers near the four corners, a horizontal warp tunnel at mid-height,
the red-zone no-turn-up tiles, and roughly 240 dots + 4 energizers — but **our
own wall drawing** inside that structure. The maze must satisfy the grammar
and look like this site.

No third-party title appears in UI copy. The section is named Ship It. Every
user-visible and code-level trace of "Survey" and, after cutover, of "Arcade"
as this game's name is removed.

## 3. Chosen direction — Ship It

The player is a blinking text cursor: a solid block caret whose leading edge
splits and rejoins on a short cycle, oriented to travel direction. It must
read as a cursor consuming characters at the tile size the maze gives it, not
as a wedge or a `<` bracket. Prototype at actual size before committing.

Dots are small code characters. Energizers are larger pulsing commits. The
four chasers are visually distinct pixel bugs, each readable as a different
bug and matched to one chase personality, distinguishable in both themes and
not by colour alone.

## 4. Inputs and game state

- Start is explicit; there is no attract mode or autoplay.
- Keyboard: arrow keys and WASD while the canvas has focus.
- Touch: swipe on the canvas plus visible direction controls.
- The canvas does not trap focus.
- Score, lives, remaining pellets, level, and phase are visible DOM text.
- Audio is off by default, visibly muted, remembered, and never created before
  a user gesture.

Corner-stuck is the operator's first item and is load-bearing: input sets a
*desired* direction. The actor turns only when that direction is legal. Facing
a wall, the actor **stops and stays stopped**, holding the desired direction
until it becomes legal. It never bounces and never auto-reverses.

## 5. Motion and accessibility

`prefersReducedMotion()` and `html[data-motion="off"]` are equal vetoes. Either
cancels continuous animation. Discrete mode still plays: one legal input
advances the simulation by a fixed step and redraws once.

The canvas has a name and a text alternative. Keyboard play must work without
a pointer. Colour is never the only signal. axe zero violations remains the
bar.

## 6. Success and rollback

Success requires observable play at 1440px and 375px in both themes, captured
as screenshots and a GIF of actual play showing corner-stuck, the eating
animation at real size, a fright cycle, and each of the four targeting rules.
Targeting functions are pure and unit-tested directly.

Rollback is one branch. The rebuild replaces the arcade section in place. The
foreman owns local unit commits and receipts. The apex owns visual acceptance
and any push, deploy, or merge.

## Open questions

None. The three product decisions are approved. Visual taste is accepted only
against rendered artifacts.
