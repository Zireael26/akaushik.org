# Handoff — the pixel art pass (feat/pixel-art-pass)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
You are the foreman in the worktree `/Users/abhishek/projects/personal/akaushik.org-worktrees/art`.
**Never touch the main checkout.** The apex is doing a production cutover in it, concurrently.

Branch: `feat/pixel-art-pass`, off `feat/pixel-transplant` at `7b4e8a6`.

---

## Why this work exists

The operator shipped the pixel design and then looked at it. Four things are wrong, and all four
are the same underlying failure: **the pixel engine was built to be reusable and then used once.**

`components/pixel/PixelField.tsx` takes a `sources` array and renders anything.
`lib/pixel/sources.ts` exports `fromImage()`, `loadImage()`, `wordmark()`, `layer()`, `seedFrom()`.
`lib/pixel/field.ts` has four presets and a cross-fading `setStage()`. All of that machinery is
real and tested. Almost nothing calls it with anything but the same three or four sources.

`components/pixel/RouteField.tsx` admits it in its own doc comment:

> The current frontmatter vocabulary has no clean topic mapping, so every route uses the same
> restrained trellis source and varies only by its slug seed.

That comment is the whole bug report. Close it.

---

## Read before you write anything

In this order. Do not start U1 until you have read all six.

1. `lib/pixel/field.ts` — the engine. `FieldSource`, `SourceContext` (`cols`, `rows`, `t`,
   `angle`), `FieldPreset`, `mountField`, `FieldHandle.setStage`.
2. `lib/pixel/sources.ts` — the vocabulary. Study `agentGraph` and `trellis` closely; they are the
   house style you are matching.
3. `lib/pixel/stages.ts` — `stage(kind)` and `pipeline(kinds, active)`. The glyph library.
4. `lib/pixel/neural.ts` — `neuralTraining`, the one genuinely animated source (`t` in the context).
   This is the quality bar for U1.
5. `lib/scenes/cursor.ts` — the cursor engine, especially `CURSOR_NEAR_EVENT`,
   `CURSOR_LEAVE_EVENT`, `[data-pixel-hover]`, `[data-cursor-target]`.
6. `components/pixel/ProcessPipeline.tsx` and `app/styles/sections/method.css` §"the pipeline".

**A source is a drawing function, not a bitmap.** It draws greyscale into an offscreen 2D context;
the engine samples it into cells and maps luminance onto the theme ramp. That is why sources are
theme-agnostic and why the videos have to go. Never hard-code a hex in a source. Never read
`window` or `document` inside one.

---

## The four units

Ship them in order. Commit at every unit boundary — an uncommitted tree on a dead session is the
one failure this whole arrangement exists to prevent.

### U1 — bespoke art per case study (the big one)

**Decision already taken by the operator, do not relitigate:** the art depicts *the product and the
work*, not the company logo. No logo rasterisation, no `fromImage()` on brand assets. Bluehost's
mark is third-party trademarked art and is not going on this site.

Five case studies in `content/case-studies/`. Each gets its own `FieldSource` in a new
`lib/pixel/products.ts`, exported by slug, and each is animated where animation says something
(use the `t` in `SourceContext`; look at `neural.ts` for how).

What each one depicts — this is the operator's own framing, keep it:

| slug | frontmatter says | the art |
|---|---|---|
| `vericite` | retrieval stack an institution can trust with its own words; HF TEI, Qdrant, Ory | query → embed → vector store → **cited** answer. The citation is the point: the answer block resolves with quote marks and a link back to a stored chunk. Show the retrieval actually retrieving — a query pulses, the store lights the matching rows, the answer assembles. |
| `neev` | AI for an industry that runs on WhatsApp; multi-tenant monolith | message bubbles on the left, a parse step, a structured ledger grid on the right. Bubbles arrive irregularly (they are messages, not a metronome); the ledger fills a row per parsed message. |
| `bluehost-agents` | agent runtime, tool-calling, observability, production scale | a small fleet of agents over a runtime bar, each dispatching tool calls that return. Scale is the subject: many concurrent, not one. Some calls should take longer than others. |
| `curat-money` | fair comparison of crypto cards; high-throughput pipeline | a comparison grid where rows are cards and columns are terms, with a pipeline feeding it from the left. The fairness is the point — rows settle into a sorted order rather than being drawn sorted. |
| `clusterbid` | Go+Next inference cloud, monorepo checks → k3s UAT | CI checks flowing into a cluster of scheduled pods. Pre-production, not production: leave the last stage visibly unfinished — outlined, not filled. |

Constraints:
- Every source reads `cols`/`rows` from the context and composes in **normalised** space so it
  works at `hero`, `band` and `card` sizes. Test at all three.
- `seedFrom(slug)` for any per-instance jitter, so a given page looks the same on every load.
- Animation budget: these are below the fold on a detail page. Keep per-frame work under what
  `neuralTraining` does, and prefer `animate: 3+` over `animate: 1`.
- Unit tests in `lib/pixel/products.test.ts`: for each source, mount into a stub 2D context and
  assert it draws (non-empty ink), that it is deterministic given a fixed seed and `t`, and that it
  produces **different** output per slug. The last one is the assertion that actually fails if
  someone wires all five to the same function — which is exactly the bug you are fixing, so it is
  the test that has to exist.

### U2 — the HyperFrames videos come out

`components/work/reels.tsx` renders an SVG floor plus a `<video>` of a HyperFrames render on top,
gated by `components/media/MotionVideo.tsx`. 13 MP4s under `public/video/`.

The operator's reason, verbatim: *"they won't change color with light and dark mode, and they now
look out of place with the whole pixel art thing."* Both halves are true. The videos are baked
pixels on a fixed background; the rest of the site repaints from theme tokens.

- Replace the reel with the U1 field for that slug. The `Reel` component keeps its name and its
  call sites (`components/sections/CaseStudyStub.tsx`, `components/work/CaseStudyPage.tsx`,
  `components/sections/Work.tsx`) — change what it renders, not its interface, unless the interface
  genuinely gets simpler.
- `variant="hero"` → `preset="hero"`, `variant="card"` → `preset="card"` or `"tile"`, whichever
  reads better at the real rendered size. Look at it.
- **Delete the MP4s and their posters** under `public/video/work/` once nothing references them,
  and only then. `git rm` them; do not leave orphans. `public/video/writing/` is U4's problem —
  check whether anything still references those before touching them.
- `components/media/hyperframes-loop.tsx` and `MotionVideo.tsx`: delete only if nothing imports
  them afterwards. Grep for direct calls, type references, string literals, dynamic imports,
  re-exports, barrel files, and test mocks separately — the parent rules require it and this is a
  deletion.
- `scripts/` has HyperFrames automation. If it now generates assets nothing consumes, say so in
  your checkpoint; do not delete build tooling on your own judgement.
- ADR-0008 documents the video pipeline. It is now superseded in part — write a short ADR-0020
  recording that case-study motion moved from rendered video to canvas fields, and why (theme
  responsiveness, byte weight, consistency). Do not rewrite ADR-0008; supersede it.
- `e2e/reduced-motion.spec.ts` has two specs that assert on video: *"a motion-disabled visitor is
  never sent video bytes"* and *"the SVG floor is what a motion-disabled visitor sees instead"*.
  Both need rewriting against fields. The reduced-motion contract still holds — a field must hold
  still — it just holds differently. `e2e/canvas.spec.ts` shows the sampling technique.

### U3 — the method pipeline: taller, and actually interactive

Three defects, one of which is dead code.

**(a) Too short.** `.px-pipeline-band` is `clamp(104px, 15vh, 168px)` in `method.css:117`. The
operator wants the art properly visible. Raise it and re-tune `cellSize` so the glyphs gain
resolution rather than just getting stretched — a taller band at the same cell size is a bigger
blurry band, which is not the ask. Check it at 375px, 768px and 1440px.

**(b) No cursor snap.** In the gaurijha original
(`/Users/abhishek/projects/personal/gaurijha.com`, `git show public-site-v1:src/scripts/cursor.ts`,
around line 377), hovering a method icon put the cursor in `snap` mode: the drawn cursor position
eased toward the icon's anchor at `0.2` per frame instead of tracking the pointer, so it *landed*
on the tile. Our port dropped that easing entirely — `snap()` in our `lib/scenes/cursor.ts` is
grid-alignment, an unrelated function that happens to share the name.

**(c) The hover channel is dead code.** `lib/scenes/cursor.ts` queries `[data-pixel-hover]` and
dispatches `pixel:cursor-near` / `pixel:cursor-leave` with a `0..1` progress ramp.
**Nothing in the entire codebase sets that attribute or listens to those events.** Verify that
yourself before you start (`grep -rn "data-pixel-hover" --include="*.tsx" components app`) — if it
has changed since this brief was written, the design below changes with it.

So: wire it. `ProcessPipeline` currently drives `active` from `onMouseEnter`/`onFocus`, which works
but has nothing to do with the cursor. Put `data-pixel-hover` on each `.px-pipeline-step`, listen
for the two events, and drive `active` from them — keeping the focus handlers, because keyboard
users get no cursor and must still be able to move through the steps.

Then the interaction the operator remembers and misses: the selected step should visibly *respond*,
not merely swell in the band. Use the `progress` ramp in the event detail — it is there precisely so
the element can render its own response, per the cursor port's design note. Something in the
engine's own idiom: the tile's glyph resolving, its cells densifying, an accent bleeding in. Your
call on the exact treatment; it must (i) read as a response to the cursor arriving, (ii) reverse
cleanly on leave, (iii) be inert under reduced motion and with no fine pointer, (iv) never be the
only way to perceive which step is active — the band emphasis and focus ring stay.

Restore the position easing in `lib/scenes/cursor.ts` too, so the cursor lands on the tile. Match
the original's `0.2` and reset the eased position on exit, as the original does.

Tests: `ProcessPipeline` gets a component test that dispatches synthetic `pixel:cursor-near` /
`pixel:cursor-leave` `CustomEvent`s and asserts the active stage moves and reverses. That test is
the one that would have caught this being unwired in the first place.

### U4 — per-blog art

`RouteField` gives every writing post and case study the same `trellis`. Fourteen posts.

Writing frontmatter today is `title`, `dek`, `date`, plus occasional `draft` / `unlisted`. **There
is no topic field.** So:

- Add an optional `art:` key to writing frontmatter, a small **closed** vocabulary — a union type,
  not a free string, so a typo is a typecheck failure and not a silent fallback to trellis.
- Derive the vocabulary from what is actually there. Read all fourteen. The clusters are roughly:
  agent process and tooling (`trellis`, `trellis-1-0-rc`, `trellis-loop-era`,
  `best-practices-into-trellis`, `gptx-in-trellis`, `process-gate-stack-profiles`,
  `native-git-hooks-for-non-node`), retrieval and embeddings (`fastembed-to-tei`), learning ML from
  scratch (`micrograd-makemore`), MSME and field work (`ai-for-msme`), building this site
  (`building-this-portfolio`), operations and failure (`detection-is-not-continuity`,
  `renaming-projects`). Do not force one art per post if two posts genuinely share a subject —
  shared art for a genuine cluster is correct; identical art for everything is the bug.
- Each vocabulary entry maps to a `FieldSource`. Reuse `stages.ts` glyphs and `sources.ts`
  primitives via `layer()` where they fit; write new ones where they do not.
- **Keep the seed.** `seedFrom(slug)` on top of the topic source, so two posts sharing a topic
  still differ in texture. That is the existing behaviour and it is right.
- Absent `art:` must fall back to today's `trellis` and must not throw. But make the fallback
  **visible**: log it in the content-bundle build so an un-arted post is noticed, per the parent
  rule that a fallback must be distinguishable from success.
- Case studies get their U1 product source through the same path — a case study's art is its
  product, not a topic keyword.
- `lib/content.ts` parses frontmatter; extend its types. It reads `CONTENT_BUNDLE`, not the
  filesystem — read the file's doc comment before you touch it, the reason matters.
- You **may** edit `art:` into existing MDX frontmatter. You may **not** create new MDX files or
  change any prose — `CLAUDE.md` is explicit that each MDX file is a deliberate editorial unit and
  the operator writes the words.

---

## Environment traps, all of them earned the hard way

- **`pnpm`, never `npm`.** Lockfile is `pnpm-lock.yaml`.
- **Generators run before the gates.** `pretypecheck` and `pretest` regenerate
  `lib/mdx/generated/**` (gitignored) and `lib/content-bundle.generated.ts` (**committed**). If you
  change frontmatter or content parsing, `pnpm content:bundle` and commit the regenerated bundle in
  the same commit as the code — the parent rules call this code-asset pairing and typecheck cannot
  see the drift.
- **Never `SKIP_PROCESS_GATE=1`.** Standing operator instruction.
- **Do not touch `proxy.ts`, `worker/index.ts`, `lib/agent-proxy.ts`, or `wrangler.jsonc`.** The
  apex is editing those right now for the production cutover. Any change you make there will
  collide.
- **Firefox cannot launch on this machine** (macOS sandbox: `sandbox_extension_issue_file_to_process
  … Operation not permitted`). It is not a site defect. Run `--project=chromium-desktop`, and
  `--project=webkit-*` if you want a second engine. Never report a Firefox hang as a finding.
- **`timeout` is not on macOS.** Background the run instead.
- Playwright against a remote base URL needs `CI=1` or it refuses with a `reuseExistingServer`
  error. Locally use `localhost`, not `127.0.0.1` — Next dev returns 403 for `_next` chunks on a
  cross-origin `127.0.0.1`.
- The dev server is `pnpm dev` on `:3000`. Use the `monitor` tool for it, never `tail -f`.

## Receipts

Per unit, run and report **pass counts, not exit codes**:

```
pnpm typecheck && pnpm lint && pnpm test
CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm exec playwright test --project=chromium-desktop
```

Plus, for U1/U2/U3 specifically: **a screenshot.** These are visual changes and the parent rules are
explicit that logically verified is not visually verified. Five case-study pages, the method
section at three widths, and one writing post — in **both themes**. Attach them. The last session
of this project found five defects that passed typecheck, lint and vitest while being visibly
broken; do not repeat that.

Emit the canonical marker per unit:
`<!-- dod-receipt cmd="…" exit=<int> diff="+N/-M (K files)" -->`

## Hard stops — bring these to the apex, do not decide them

- Any push, PR, merge to `main`, or deploy. You do not deploy. The apex owns the cutover.
- Deleting `scripts/` build tooling, or any file you cannot prove is unreferenced.
- Changing prose in `content/**`, or adding an MDX file.
- Anything touching `.env`, tfvars, kubeconfigs, tokens, or `wrangler.jsonc`.
- Art direction that departs from the table in U1 — that table is the operator's decision.

## Checkpoints

Report after each unit. Commit before reporting. State what you changed, the receipt, the
screenshots, and anything you found that the brief got wrong — the brief was written from a read of
the code, and the code is the authority.
