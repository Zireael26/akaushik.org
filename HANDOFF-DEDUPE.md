# Handoff — one piece of art per page (feat/route-art-dedupe)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
You are in the worktree `/Users/abhishek/projects/personal/akaushik.org-worktrees/route-art-dedupe`.
**Never touch the main checkout.** Three other workstreams run in sibling worktrees.

Branch: `feat/route-art-dedupe`, off `origin/main`.

**You depend on `feat/pixel-art-pass`, which is in review as PR #155 and not yet on main.** Merge
or cherry-pick it into your branch first, or you will be looking at a page that does not have the
problem. Confirm before you start: `/work/neev` must render two canvases, not one.

---

## The defect, in the operator's words

> on the blogs that I opened on beta, or on the projects that I opened on beta, in some places
> there were two variants of the same art showing up. One was up top, which was a thinner variant
> of it, a more stretched-out variant that was not looking good. There was a proper hero section
> one that looked good below it, so we have to consolidate that as well.

Confirmed in the source. On a case-study route, two components both draw the slug's art:

    components/work/CaseStudyPage.tsx:21   <RouteField slug={routeSlug} />      <- thin strip, top
    components/work/reels.tsx:60           <ReelField slug={slug} preset={…} /> <- the good one

Measured on the deployed art branch, the strip is **1328 × 108** at the `strip` preset — the same
source squeezed into a letterbox, which is why it reads as stretched. The `ReelField` below it is
the one the operator likes.

Writing routes (`app/writing/[slug]/page.tsx:173`) render **only** `RouteField`, so they have one
piece of art and are not affected. Verify that yourself rather than trusting this line.

## What to do

Keep one piece of art per page, and keep the good one.

- On case-study routes: drop the `RouteField` strip. `ReelField` already carries the slug's own
  product source and renders at a preset that suits it.
- On writing routes: `RouteField` stays — it is the only art there and, since `feat/pixel-art-pass`,
  it draws per-post topic art rather than the same `trellis` for everything.
- If `RouteField` ends up used by exactly one caller, say so in your checkpoint and propose whether
  it should keep its name or fold into the writing template. **Do not delete it on your own
  judgement** — check every reference first (direct calls, type references, string literals,
  dynamic imports, re-exports, barrel files, test mocks) per the parent rules.

## Watch for

- `e2e/work.spec.ts` asserts on case-study media; there is a spec named
  *"ClusterBid uses a static reel without media requests"*. Removing a canvas may change canvas
  counts that other specs rely on. Update the specs to the new truth — do not weaken an assertion
  to make it pass, and do not leave a spec asserting something that is no longer the design.
- The strip may be load-bearing for layout spacing on the detail template. Look at the page after
  removing it; a hole where the strip was is not a fix.

## Receipts

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage`, plus a Playwright run, plus
**screenshots** of a case-study route and a writing route at 1440px and 375px in both themes,
showing exactly one piece of art per page and no gap where the strip was.

Apex owns the deploy. Do not deploy. Commit at every boundary.
