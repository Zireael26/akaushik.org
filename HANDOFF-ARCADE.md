# Handoff — the arcade section (feat/arcade)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
You are in the worktree `/Users/abhishek/projects/personal/akaushik.org-worktrees/arcade`.
**Never touch the main checkout.** Three other workstreams run in sibling worktrees.

Branch: `feat/arcade`, off `origin/main`.

---

## What the operator asked for

> I asked you to do a game section where I wanted this pixelated version of Pac-Man. That is
> something that we can do on my website, including the original Pac-Man sounds as well.

## What you are building instead, and why — read this before you write anything

**Do not ship Pac-Man.** Not the character, not the ghosts as designed, not the maze layout, not
the name, and above all **not the original sounds**. PAC-MAN is an active Bandai Namco trademark
and the audio, sprites and maze are copyrighted works. "Original Pac-Man sounds" means somebody's
rip of a copyrighted recording; embedding it on a personal site that also sells consulting is a
real exposure, not a theoretical one, and the site's whole argument is that its author is careful.

Do not source, download, embed, or base64 any Pac-Man audio or sprite asset. If you find yourself
looking for a `.wav` of the death jingle, stop.

**Build the thing underneath it instead**: a maze-chase arcade game in this site's own pixel
language, with arcade-style audio **synthesized at runtime in WebAudio** from oscillators — square
and triangle waves, short envelopes, the timbre of the era rather than the recordings of it. That
is original work, it sounds right, it ships as code rather than as assets, and it costs no bytes.

The apex has flagged this trade to the operator directly. Build the substitute; do not wait.

## The game

- A pixel maze on a canvas, drawn through the existing field vocabulary so it belongs to this site.
  Read `lib/pixel/field.ts`, `lib/pixel.ts` and `lib/scenes/cursor.ts` first — the palette, the
  cell rule, the hash and the theme subscription are all there and none of it may be re-invented
  or hard-coded.
- A player that eats dots through a maze, and pursuers with distinguishable behaviour (one direct,
  one that cuts ahead, one that wanders) so the chase has texture. Original maze, original shapes.
- Keyboard (arrows + WASD) and touch (swipe) input. Score, lives, a win state and a lose state.
- **Audio is opt-in and off by default.** A visible mute/unmute control, state remembered, and
  nothing may play before a user gesture — browsers block it anyway and autoplaying sound on a
  portfolio is hostile. Honour `prefers-reduced-motion` for the animation and treat the site's
  own `data-motion="off"` switch as a stop, exactly as `prefersReducedMotion()` in `lib/pixel.ts`
  already does for every other engine.

## This is a feature, so it goes through the pipeline

Net new behaviour across several files, so the mandatory-pipeline gate will block a push without a
spec triad. Run `clarify -> spec -> plan -> tasks` and put the triad under `specs/NNN-arcade/` on
this branch **before** the implementation. Do not attempt a surgical declaration; this is exactly
what surgical is not for.

## Constraints

- Accessibility: the canvas needs a name and a text alternative, keyboard play must work without a
  pointer, and the section must not trap focus. `axe-core` runs in CI over the routes — zero
  violations is the standing bar and this section must not be the first to break it.
- Performance: one rAF loop, disposed on unmount like every other engine here
  (`mount(canvas) => dispose`). No leaked listeners; `AbortController` is the house pattern.
- The bundle must not balloon. No game framework, no audio files, no sprite sheets.
- Never hard-code a hex. Theme via `lib/pixel-theme.ts`.

## Receipts

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage`, Playwright green, axe clean, plus
**screenshots and a short GIF** of actual play at 1440px and 375px in both themes. A game reported
working on a passing unit test is not reported working.

Apex owns the deploy. Do not deploy. Commit at every boundary.
