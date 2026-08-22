# Handoff — detail pages, tests and sweep (feat/pixel-pages)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
You are the **foreman** in the worktree
`/Users/abhishek/projects/personal/akaushik.org-worktrees/pages`.
**Never touch the main checkout.** Another foreman is live on `feat/pixel-cursor` in its own
worktree — do not read or write it.

This one is a fan-out, not a single port. **Author an eval that runs the units below in parallel
and drives them to done.** You are orchestrating workers, not typing all of this yourself.

## Worker routing — read this before you resolve roles

```sh
python3 ~/.claude/skills/herdr-foreman/scripts/resolve-roles.py --implementer ox-alpha
```

The operator has asked that **grok (`xai-oauth`) not be relied on**. It still appears in the
release's `roles.json` chains and that file is inside the immutable Trellis release payload, so it
cannot be edited from here. **Skip any role the resolver hands you that resolves to `xai-oauth` and
take the next candidate in that chain.** Say in your report each time you did.

Preferred routes, all already in the chains:

| Use for | Route |
|---|---|
| Bulk implementation, unmetered | `openrouter/stealth/ox-alpha:high` |
| Cheap parallel breadth, unmetered | `meta/muse-spark-1.2-contributor:xhigh` |
| Hard units, weak oracle | `openai-codex/gpt-5.6-sol:xhigh` (83% left) |
| Second GPT lane | `openai-codex/gpt-5.6-luna:max` |
| Scan / triage / classify | `google/gemini-3.7-flash:high` |
| Cheap third lane | `opencode-go/deepseek-v4-flash` |

Cross-family rule still holds: a unit's reviewer must not share a family with its implementer.
With grok out, use `sol`/`luna` (openai-codex) to review `ox-alpha`/`muse` work, and `ox-alpha` to
review openai-codex work.

## Context you need first

Read, in this order: `specs/004-pixel-transplant/spec.md`, then `plan.md`, then `tasks.md`. Then
`app/styles/sections/_shared.css` and `lib/pixel/field.ts`. The design system is
`/Users/abhishek/projects/personal/gaurijha.com/design-refs/design.md`; the reference implementation
is at that repo's git tag `public-site-v1` (`git show public-site-v1:<path>`). Voice is
`docs/voice.md` and it is binding on every word you write.

## The units — disjoint file ownership, run them in parallel

**U1 · `/work` pages** — owns `app/work/**` (not the `md/` route handlers), `components/work/**`,
and a new `app/styles/sections/work-detail.css`.
The index and the case-study detail template, in the pixel language. Five case studies exist in
`content/case-studies/`. Reuse `SectionHead` / `RuledRow` / `MatterRow`. Do not touch the MDX
pipeline, frontmatter, or the `/md` content-negotiation routes.

**U2 · `/writing` pages** — owns `app/writing/**` (not `md/`), and a new
`app/styles/sections/writing-detail.css`.
Index rows and the article template. The article pattern is in design.md § "Blog / SEO pattern":
breadcrumb, H1, dek, mono byline, a **"The short answer"** ruled box, 70ch body, H2s phrased as
questions, a **Common questions** FAQ block. The `Article` + `FAQPage` JSON-LD must be **merged with
the existing `lib/structured-data.ts` graph**, pointing at the stable `@id` URIs already there —
do not emit a second competing graph. 13 posts exist; `_test-draft.mdx` is a draft, check how
`lib/content.ts` filters it and respect that.

**U3 · Per-article pixel headers** — owns `components/pixel/ArticleField.tsx` and its CSS block
inside U2's `writing-detail.css` (coordinate: U2 owns the file, U3 appends one clearly-marked
section; do them in sequence, not concurrently).
Every article gets its own field header. `lib/pixel/sources.ts` exports `seedFrom(slug)` for exactly
this: same slug, same texture, forever, with no per-post art to author. Use the `strip` preset.
Pick the source per post from its frontmatter topic if that reads well; otherwise one source with a
per-slug seed is the correct, restrained answer.

**U4 · Dead code sweep** — owns `components/sections/Contact.tsx`, `components/scene/**`,
`components/dev/**`, `components/site/ThemeToggle.tsx`, `package.json`.
Delete what the pixel design orphaned: the Wanderer companion, `AgentGraph`, `StaticSVGScene`, the
`three` and `@types/three` dependencies, `TweakBridge`, the old `ThemeToggle` (superseded by
`components/pixel/ThemeSwitch.tsx`), and `Contact.tsx`. **Verify nothing references each file before
deleting it** — grep for the symbol, the path, and any string literal. `WandererCrane.test.ts` goes
with its component. Run `pnpm test` after: 178 tests must still pass.

**U5 · Playwright specs** — owns `e2e/**`.
Nine specs are selector-coupled to markup that no longer exists. Rewrite them against the new
markup. **The assertions are the valuable part — keep what each one checks and change only how it
finds things.** `agent-readiness.spec.ts`, `mcp.spec.ts`, `content-negotiation.spec.ts` and
`structured-metadata.spec.ts` test machinery that did not change: those should need selector edits
at most, and if one needs a *behavioural* change, stop and report it, because that means the
re-skin broke something it should not have. Do not run them (no dev server); typecheck only.

**U6 · ADR-0018** — owns `docs/adr/0018-*.md`.
Records the stack decision: retrofit Next.js and deploy to Cloudflare via `@opennextjs/cloudflare`,
rather than rewriting in Astro. Supersede the framework half of `docs/adr/0001-nextjs-over-sveltekit.md`.
The reasoning is in `specs/004-pixel-transplant/plan.md` §1 — the load-bearing fact is that
`proxy.ts` is Next 16 edge middleware carrying the agent-readiness contract, and OpenNext supports
edge middleware. Match the house ADR format: context, decision, consequences, status.

**U7 · Favicon** — owns `app/icon.tsx` or `public/favicon.svg`, whichever fits Next 16 better.
A pixel mark from the design language. The hero's shell-prompt exhibit reduces well to 16×16.

## Rules every unit inherits

- **No invented facts about Abhishek.** No employer, date, title, client or metric that is not
  already in this repo. If copy needs a fact you cannot source, leave a marked TODO and say so.
  This is the single most important rule in this brief.
- **No hard-coded colours.** Everything through `app/styles/tokens.css` or `lib/pixel.ts`.
- Reuse the shared primitives. Do not author a second `SectionHead`.
- No new dependencies. U4 only removes.
- Respect `prefers-reduced-motion`; keep focus rings visible.
- **Do not touch:** `lib/mcp*`, `proxy.ts`, `app/llms*`, `app/api/**`, `app/sitemap.ts`,
  `app/robots.txt`, `public/.well-known/**`, `lib/content.ts`, `lib/structured-data.ts` (U2 reads
  it, does not edit it), or anything under `lib/pixel/**`. That surface is the site's thesis and it
  is not in scope.

## Gates

Per unit: `pnpm typecheck`, `pnpm lint`, `pnpm test` (178 tests). **Do not start a dev server** —
port 3100 is the apex's. Do not run `pnpm build`.

The pre-commit process-gate requires a staged `docs/CHANGELOG.md` entry for code changes. You are
authorized to add entries there — **one per unit commit**, long-form prose matching the file's
existing style. **Never** `SKIP_PROCESS_GATE=1`. `docs/CHANGELOG.md` is the one file several units
touch; serialize those edits so they do not conflict.

One commit per unit on `feat/pixel-pages`, repo voice (terse, lowercase scope, no `Co-authored-by`,
no generated-with footers). Do not merge, do not push, do not open a PR.

## Report back

Per unit: files, the worker route that did it, its reviewer and family, gate output, and anything
refused. Plus: every role you had to skip because it resolved to `xai-oauth`, and any unit where a
worker failed twice and you escalated.
