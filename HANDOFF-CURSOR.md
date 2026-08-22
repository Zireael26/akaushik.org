# Handoff — the cursor engine (feat/pixel-cursor)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
You are in the worktree `/Users/abhishek/projects/personal/akaushik.org-worktrees/cursor`.
**Never touch the main checkout.**

You already ported five canvas engines for this site (commit `9b7ace2`). This is the sixth and last,
and the only one with real design work in it.

## The source

```sh
cd /Users/abhishek/projects/personal/gaurijha.com
git show public-site-v1:src/scripts/cursor.ts     # 520 lines — the whole system
```
`design-refs/design.md` § "Cursor engine" at HEAD is the binding description.

## The pattern — non-negotiable, and you already know it

Follow `lib/scenes/heatfield.ts` + `components/pixel/Heatfield.tsx` in this worktree exactly:
`mountCursor(canvas) => () => void`, listeners through an `AbortController`,
`cancelAnimationFrame` in the disposer, theme via `lib/pixel-theme.ts`, palette and hash via
`lib/pixel.ts`. Never hard-code a hex.

## What changes from the source, and why

gaurijha's engine is **one system that owns both the cursor and the method icons** — an icon's
background blooms because the cursor came near it, and the same pass picks the cursor shape. That
coupling does not survive here: the method section is being redesigned as a process pipeline in
parallel, in the main checkout, and it will own its own art.

**So: port the cursor, not the icons.** Where the original draws an icon bloom, you instead
dispatch events on the element and let it decide what to do:

- entering proximity of an element carrying `data-pixel-hover` → dispatch
  `pixel:cursor-near` (bubbles, `detail: { distance: number, progress: number }` where progress
  is the same 0..1 ramp the original used for its dissolve, ±0.07/frame)
- leaving → dispatch `pixel:cursor-leave` (bubbles)

The cursor still hides itself while inside such an element, exactly as the original does. Export the
two event names as consts so the consumer imports them rather than retyping strings.

## The four modes — same priority order, different art

The subject matter is a litigator's and none of it survives. Replacements, in the site's own terms:

1. **`hidden`** — over `[data-pixel-hover]`: cursor vanishes, events fire. (mechanic unchanged)
2. **`arrow`** — near `[data-cursor-target]`: the chunky lime arrow rotating to point at the
   element's centre, with the one-sided cobalt/ink rim. **Port this as-is** — it is subject-neutral
   and it is the best thing in the original.
3. **`caret`** — in the page gutters, outside the content band: a **blinking block caret**, the
   terminal kind. Replaces the original's amber/red heart. Two-tone: ink body, cobalt trailing edge.
   Blink is a slow square wave, roughly 1.1s period; it must stop under reduced motion.
4. **`keycap`** — the default everywhere else: a **pixel Enter/Return keycap** seen slightly from
   above — a rounded-square cap face with a 1-cell side wall beneath it, and the ⏎ glyph notched
   into the face in the darker tone. On any click it **depresses**: the face drops onto the wall for
   ~150ms and emits four spark cells, exactly the timing and spark count the original gavel used for
   its slam. Amber cap, navy wall, red sparks.

Keep the **motion trail** from the original: the current shape's silhouette redrawn offset opposite
velocity, cobalt at 1×, ink (light in dark mode) at 2×, magnitude `min(26, speed * 1.4)`, threshold
`speed > 2.5`.

**Taste is the brief here.** The operator asked for this "done tastefully" and specifically does not
want the whimsy of the original — no hearts, no floating hearts, no confetti. Restrained,
mechanical, precise. If a flourish does not read as *engineering*, leave it out.

## Hard constraints

- Decorative only. Gate to `(pointer: fine)`, disable entirely under `prefers-reduced-motion`,
  overlay is `pointer-events: none`, and it must never eat a click, break keyboard navigation, or
  suppress a focus ring. The native cursor is hidden only while the overlay is active.
- Ship `lib/scenes/cursor.ts` + `components/pixel/Cursor.tsx`. The wrapper mounts the fixed
  full-viewport overlay canvas.
- Do **not** mount it in a layout or page — the apex wires it up.
- Do **not** touch `app/styles/**`, `components/sections/**`, `components/site/**`, or any other
  engine. If the overlay needs CSS, put it in a **new** file `app/styles/sections/cursor.css` and
  say so in your report; the apex adds the import.
- No new dependencies.

## Gates and commit

`pnpm typecheck`, `pnpm lint`, `pnpm test` (178 tests) must all pass. **Do not start a dev server** —
port 3100 is the apex's.

The pre-commit process-gate requires a staged `docs/CHANGELOG.md` entry for code changes; you are
authorized to add exactly one long-form entry under `## [Unreleased]` → `### Changed`, dated
2026-08-22, matching the prose style already in that file. **Never** use `SKIP_PROCESS_GATE=1`.

One commit on `feat/pixel-cursor`. Repo voice: terse, lowercase scope, no `Co-authored-by`, no
generated-with footers. Do not merge, do not push.

Report: the file pair, the gate output, the event contract you settled on, and anything in the
source you could not port faithfully and why.
