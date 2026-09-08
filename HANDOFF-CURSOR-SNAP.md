# Handoff — the cursor snap (feat/cursor-snap)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
Worktree: `/Users/abhishek/projects/personal/akaushik.org-worktrees/cursor-snap`, branch
`feat/cursor-snap` off `origin/main` (4e5082a).
**Never touch the main checkout.** Two other streams run in sibling worktrees.

Ignore the stale `HANDOFF-CURSOR.md` sitting next to this file — it briefed the original cursor
port months ago. This file is the live contract.

---

## The defect

The operator sent a screenshot of the method section with a step hovered. Verbatim:

> When the cursor is on, it's focusing on that particular thing. It should disappear and not go to
> the corner. It should snap onto the actual item itself, and it should have a proper, nice,
> colorful background fill with animations on that particular item instead of appearing weirdly in
> the corner.

This is the **second** rejection of this interaction. Round one replaced a rectangular swell with a
circular bloom; the bloom was accepted in principle, but the cursor behaviour is wrong and the fill
is too timid. Two things to fix.

### D1 — the drawn cursor sits at the corner instead of on the target

`lib/scenes/cursor.ts` already computes proximity and dispatches `pixel:cursor-near` with a
`progress` ramp (0..1, ±0.07 per frame). What it does not do is move or hide the drawn glyph when a
target takes focus. The result the operator photographed: the glyph parked at a tile corner while
the tile lights up, so the pointer and the response are in two different places.

Required:

1. Over an element carrying `[data-pixel-hover]`, the **native** cursor hides — scoped to that
   element via `cursor: none`, never globally. A hidden cursor across the whole page is a
   usability failure, not a flourish.
2. The drawn glyph **eases to the centre of the target** and reads as attached to it. Eased, not
   jumped. Not parked at an edge.
3. On leave it releases back to following the pointer and the native cursor returns.

Do not leave any state where both the drawn glyph and the native arrow are visible over a target.
That doubling is exactly what "appearing weirdly in the corner" describes.

### D2 — the fill is an outline, not a fill

The active treatment currently reads as a thin ring. The ask is *"a proper, nice, colorful
background fill with animations"*. So: a genuinely filled disc carrying that step's accent —
`cobalt` / `amber` / `red` / `ink`, already assigned per step in `components/sections/Process.tsx` —
blooming from the centre and retracting the same way, with the glyph legible on top throughout.

**Contrast is the constraint that will bite you.** An ink glyph on saturated cobalt can fall under
4.5:1. Either invert the glyph over the fill or choose fill tints that hold the ratio. Measure it;
do not eyeball it. The snapped state is a state a reader sits in, so hold it to the resting bar.

**The density oracle will fight a filled disc.** `lib/pixel/products.test.ts` caps every 8×8 window
at 35% lit. Tune the disc to read round and solid under the cap — or, if a real fill genuinely
cannot live under it, add a **separate, justified profile for the snapped state** rather than
exempting the tiles wholesale. Say which you did and why in your checkpoint.

---

## Constraints

- **Reduced motion**: no bloom animation, no cursor easing. Snap to the end state or stay at rest.
  `prefersReducedMotion()` in `lib/pixel.ts` is the gate every other engine here uses.
- **No fine pointer**: on touch there is no cursor and no snap. Tiles stay legible, and keyboard
  focus drives the same active state. Colour must never be the only signal of which step is active.
- **Never hard-code a hex.** Palette from `lib/pixel.ts`, theme from `lib/pixel-theme.ts`.
- One rAF loop, disposed on unmount, `AbortController` for listeners. House pattern; follow it.
- Decorative overlay stays `pointer-events: none`. It must never eat a click, break keyboard
  navigation, or suppress a focus ring.

## Receipts

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage`, axe clean, plus **a short screen
recording or GIF** of the pointer entering a tile, snapping, and leaving, at 1440px in both themes,
and a screenshot at 375px proving the touch fallback.

The operator has rejected this interaction twice by looking at it. A passing test is not a receipt
here.

Apex owns the deploy. Do not deploy. Commit at every boundary.
