# Handoff — every remaining route (feat/pixel-pages, phase 2)

Apex: Claude Code, pane `w4:p1`. You are the foreman in
`/Users/abhishek/projects/personal/akaushik.org-worktrees/pages`.
Phase 1 (U1, U3, U4, U6, U7) is committed and audited — I re-ran your receipts
myself and they hold: 18 files / 173 tests. Build phase 2 on top.

## Read first

`skill://eval-workflow`, then `~/.omp/agent/AGENTS.md` § OMP eval routing and
§ Foreman contract. `eval.agent()` is the fan-out primitive and takes an agent
**name**, not a model — the named agents in `~/.omp/agent/agents/` carry the
model. Roles are in `~/.omp/agent/roles-resolved.json` (`roles.<role>.chosen.agent`),
already re-resolved with `--implementer ox-alpha` so cross-family holds.

Then read, in this order: `specs/004-pixel-transplant/spec.md`,
`app/styles/sections/_shared.css`, `lib/pixel/field.ts`, `lib/pixel/sources.ts`,
and `docs/voice.md`. The design system is
`/Users/abhishek/projects/personal/gaurijha.com/design-refs/design.md`.

## Standing corrections from phase 1

- **ox-alpha has a daily cap.** You hit `429 free-models-per-day-stealth`.
  `roles.json` wrongly treats openrouter as unmetered, so the resolver will keep
  sending you there. Expect it, fall back to `cheap` (muse) or `deepseek`
  without asking, and report each fallback.
- **Skip `xai-oauth`** for any role. Take the next entry in that role's trail.
- **Commit at every phase boundary.** Phase 1 sat at 36 uncommitted files with
  zero commits until I intervened. Do not repeat that.

## The units — dispatch ALL of these concurrently via eval.agent()

**R1 · `/writing` index and article** *(this is the open U2 — finish it first,
it blocks R6)*
Owns `app/writing/**` (not `md/`), `app/styles/sections/writing-detail.css`.
Per design.md § "Blog / SEO pattern": breadcrumb, H1, dek, mono byline,
a **"The short answer"** ruled box, 70ch body, H2s phrased as questions, a
**Common questions** FAQ block. `Article` + `FAQPage` JSON-LD must be **merged
into the existing `lib/structured-data.ts` graph** against its stable `@id`
URIs — never a second competing graph. 14 posts; `_test-draft.mdx` is a draft,
respect however `lib/content.ts` filters it.

**R2 · `/api/docs`** — owns `app/api/docs/page.tsx` and a new
`app/styles/sections/docs.css`.
This is a **rendered HTML page nobody has converted** — it still wears the
deleted design. It is the human-readable face of the agent surface (OpenAPI,
MCP, llms.txt), so it is thematically the most on-brand page on the site: give
it the ruled-row grammar and a `strip`-preset field. Do **not** touch the
OpenAPI spec, the MCP contract, or any `route.ts` it documents — presentation
only, and if the page and the spec disagree, report it rather than editing
either.

**R3 · 404 and error pages** — owns new `app/not-found.tsx`, `app/error.tsx`,
and `app/styles/sections/status.css`.
Neither exists. People hit both. Give each a hero-scale `PixelField`:
- 404 — the agent graph with a **severed edge and one unreachable node**. Write
  it as a new source in `lib/pixel/sources.ts` (`brokenGraph`), reusing
  `agentGraph`'s geometry rather than copying it.
- error — the same network with a node **failing loudly**: one node overdriven,
  its edges recoiling.
Copy: plain and short, in `voice.md`'s register. No apology theatre, no
"Oops!", no emoji. Say what happened and offer the way back. `error.tsx` must be
a client component and must accept `{ error, reset }`.

**R4 · OG image templates** — owns `app/opengraph-image.tsx`,
`app/work/[slug]/opengraph-image.tsx`, `app/writing/[slug]/opengraph-image.tsx`.
All three still render the deleted design's colours and fonts. Bring them into
the pixel language.
**Hard constraint, read it twice:** these run through `next/og` (satori), which
supports flexbox and inline SVG and has **no canvas**. You cannot call
`lib/pixel/field.ts` here. Draw the pixel art as an **SVG `<rect>` grid**
computed from the same `h(x, y)` hash in `lib/pixel.ts`, so the art is
recognisably the same language and still deterministic. Keep every card under
satori's 500 KB bundle ceiling — that includes fonts, so subset or use one
weight. Verify each renders; a broken OG card fails silently in production and
only shows up when someone shares a link.

**R5 · Playwright specs** *(the open U5)* — owns `e2e/**`.
Nine specs are selector-coupled to markup that no longer exists. **Keep every
assertion; change only how it finds things.** `agent-readiness.spec.ts`,
`mcp.spec.ts`, `content-negotiation.spec.ts`, `structured-metadata.spec.ts`
cover machinery that did not change — selector edits at most. If one needs a
*behavioural* change, stop and report it: that means the re-skin broke something
it should not have. Add coverage for R3's two new routes. Do not run them.

**R6 · Per-route field variety** *(after R1 lands)* — owns
`components/pixel/RouteField.tsx` and a clearly-marked block in
`app/styles/sections/writing-detail.css`.
Every article and case study gets its own header field, seeded via
`seedFrom(slug)` so it is stable forever and unique per post without anyone
authoring art. Use the `strip` preset. Pick the source from frontmatter topic if
it reads well; one source with a per-slug seed is the correct restrained answer
otherwise.

## Rules every unit inherits

- **No invented facts about Abhishek.** No employer, date, title, client or
  metric not already in this repo. Marked TODO if you need one you cannot
  source. This outranks everything else here.
- **No hard-coded colours** — `app/styles/tokens.css` or `lib/pixel.ts` only.
- Reuse `SectionHead` / `RuledRow` / `MatterRow` / `PixelField`. Do not author a
  second one of anything.
- Respect `prefers-reduced-motion`; keep focus rings visible; decorative
  canvases stay `aria-hidden`, meaningful ones get a real label.
- **Fenced, do not touch:** `lib/mcp*`, `proxy.ts`, `app/llms*`, `app/api/**`
  except `docs/page.tsx`, `app/sitemap.ts`, `app/robots.txt`,
  `public/.well-known/**`, `lib/content.ts`, `lib/structured-data.ts` (read,
  never edit), `lib/pixel/field.ts`.
- No new dependencies.

## Parallelism — the operator's explicit instruction

Dispatch R2, R3, R4, R5 immediately and concurrently; R1 is already in flight;
R6 follows R1. Pipeline reviews — a unit's cross-family reviewer starts the
moment that unit lands, not after all of them. Spend the free lanes on
redundancy per rule 3: 3-vote adversarial refute on any behaviour-changing
finding, 2–3 attempts plus a judge on any unit a worker fails twice.

Report **peak concurrent eval workers**. If it is 1, tell me what is wrong with
the eval call rather than retrying.

## Gates and commits

Per unit: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Receipts executed by you
with pass counts — a worker saying "tests pass" is a claim. **Do not start a dev
server** (port 3100 is the apex's) and do not run `pnpm build`.

Changelog fragments to `docs/.changelog-fragments/<unit>.md`, staged with each
unit commit; one final pass folds them into `## [Unreleased]` → `### Changed`
and deletes the directory. One commit per unit, repo voice, no AI footers.
Never `SKIP_PROCESS_GATE=1`. No merge, no push, no PR.

Checkpoint to this pane after each unit: files, worker route, reviewer and
family, executed pass counts, commit SHA, and anything you refused.
