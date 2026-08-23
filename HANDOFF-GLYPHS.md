# Handoff — the method step glyphs (feat/method-glyphs)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
You are in the worktree `/Users/abhishek/projects/personal/akaushik.org-worktrees/method-glyphs`.
**Never touch the main checkout.** Three other workstreams are running in sibling worktrees.

Branch: `feat/method-glyphs`, off `origin/main`.

---

## The operator looked at it and rejected it

Verbatim, so it does not get paraphrased away:

> the whole cursor snapping thing: when I said I want that snapping cursor, I think it looked
> better in my head than it did in reality. In fact, it actually even looked better on the
> reference website because the reference website had simpler graphics on each of the steps […]
> and they would be normal black or white depending on the theme.
>
> When the cursor snaps, they would get colored in a circular background pattern, where a
> spherical background would be there, and it would animate for each of the selections. It would
> not show like a rectangle like we do right now. That looks terrible. Plus, we're using the same
> kind of art for both the individual sections as well as the top one, which has all four, so that
> also makes it look less appealing.

Three separate defects in there. Fix all three.

### D1 — the step tiles are too busy at rest

Today each tile renders `stage(kind)` from `lib/pixel/stages.ts`: the full glyph, in full palette,
all the time. The reference kept the per-step icons **simple and monochrome at rest** — plain ink,
which means near-black in light mode and near-white in dark, taking the theme from the engine's
own ramp rather than from a hard-coded colour.

So: a resting tile is a simple ink glyph. Not a scene. Fewer marks, larger, readable at a glance.
The tiles are ~40 × 26 cells at the `tile` preset — design for that, not for the hero grid.

### D2 — the snap response is a rectangle, and it should be a circle

The active treatment today swells the glyph inside its rectangular tile. The operator's word for
it is "terrible", and the specific ask is a **circular / spherical background that animates in**
behind the glyph, carrying the colour.

Concretely: at rest, ink glyph, no field behind it. On snap, a disc blooms behind the glyph from
the centre outward, and the glyph picks up that step's accent (`cobalt` / `amber` / `red` / `ink`,
already on each step in `components/sections/Process.tsx`). On leave, it retracts the same way.

The bloom is a **radial** thing, so it must read as round on the cell grid — which means it has to
be drawn as a disc in grid space and sampled, not faked with a scaled rectangle. `sources.ts` has
`arc` usage already; the stub context records arcs, so it is testable.

Drive it from the `progress` value in the `pixel:cursor-near` event detail — it is a 0..1 ramp
stepping ±0.07 per frame and it exists precisely so the element can render its own response.
`lib/scenes/cursor.ts` already dispatches it and `ProcessPipeline` already listens; you are
changing what the response looks like, not rewiring the channel.

### D3 — the tiles and the band draw the same art

They both come from the same glyph library, which was a deliberate choice when the band's emphasis
shift was the whole interaction. The operator's read is that it makes the section look repetitive,
and he is right: the eye sees the same shape five times.

The band keeps the pipeline view — four stages joined by a conduit, that is its job. The tiles need
their **own** simpler vocabulary. Same subject per step (read / spec / build / harden), different
drawing. Think of the band as the diagram and the tile as the icon.

---

## Constraints

- **Reduced motion**: the bloom must not animate. Snap to its end state or stay at rest. The engine
  already gates `animate`; check `prefersReducedMotion()` in `lib/pixel.ts` and honour it.
- **No fine pointer** (touch): there is no cursor, so there is no snap. The tiles must still be
  legible and the steps must still be reachable by keyboard focus, which drives the same active
  state. Do not make the colour the only signal of which step is active.
- **Never hard-code a hex.** Palette comes from `lib/pixel.ts` and the theme from
  `lib/pixel-theme.ts`, per the house rule every other source follows.
- **The density oracle applies.** `lib/pixel/products.test.ts` caps every 8×8 window at 35% lit.
  Extend the same oracle to the tile glyphs — a filled disc is exactly the shape that will blow
  through it, so tune the disc to read as round while staying under the cap, and add the tile
  profile to the test rather than exempting it.

## Receipts

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage`, all green, plus **screenshots**:
the method section at 1440px and 375px, in both themes, at rest and with a step active. This is a
visual change and the operator rejected the last one by looking at it. Do not report it done on a
passing test.

Apex owns the deploy. Do not deploy. Commit at every boundary; a red or uncommitted tree is not a
checkpoint.
