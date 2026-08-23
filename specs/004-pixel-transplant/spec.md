# Spec 004 — Pixel transplant

**Status:** IN PROGRESS
**Branch:** `feat/pixel-transplant`
**Author:** Abhishek Kaushik (with Claude)
**Created:** 2026-08-22

> Authored in-place, after the first four commits, per the mandatory-pipeline
> gate's remediation path. The work was underway before the gate fired; this
> triad documents what is being built and what remains, and is the contract the
> rest of the branch is held to.

---

## Problem

akaushik.org shipped in a parchment-on-ink editorial design with a three.js
`AgentGraph` hero. It works, but it is not distinctive: the palette, the serif
display face, and the hairline-rule layout are the defaults a hundred other
portfolio sites arrive at, and the hero's motion piece is expensive
(`three` in the client bundle) for what it communicates.

Separately, a pixel-art editorial design was built for gaurijha.com — a full
design system with a deterministic pixel language, a heatfield hero, a cursor
engine, and a footer marquee and skyline. That site's owner declined to publish
it: Bar Council of India advertising rules constrain what an advocate may put on
a website, and her public site was taken down on 2026-08-20 (preserved at tag
`public-site-v1`). The design has no such constraint here, and its author wants
it on his own site.

The transplant is not a copy-paste. The design's subject matter is a litigator's
— scales, a gavel, a section sign, the Delhi legal skyline, "see you in court" —
and every one of those has to be re-authored for an AI engineer before the site
means anything.

## Goals

1. Replace the entire presentation layer of akaushik.org with the pixel design,
   at high fidelity to `gaurijha.com/design-refs/design.md`.
2. Re-author every law-specific piece of art and copy so the site reads as this
   person's, not as a re-skin of someone else's.
3. Preserve the agent-discoverability surface **exactly**. It is the site's
   thesis and its contract is `docs/AGENT_READINESS.md`.
4. Move hosting from Vercel to Cloudflare Workers, alongside
   `evals.akaushik.org` on the same account.

## Non-goals

- Rewriting the site in Astro. Considered and rejected — see `plan.md` §1.
- Porting the sealed wing (`/private/`). It is Gauri's birthday gift and is not
  transplanted.
- Any change to content. The 13 writing posts and 5 case studies move across
  untouched, and every URL keeps its path.
- New writing. `CLAUDE.md` requires MDX to be a deliberate editorial unit.

## Success criteria

| # | Criterion | How it is checked |
|---|---|---|
| SC1 | Home page renders the full pixel design in both themes | `scripts/visual-receipt.mjs`, both `page-light` and `page-dark` |
| SC2 | No law-specific art or copy survives anywhere in the shipped site | grep for gavel/scales/court/advocate/Bar Council across `app/`, `components/`, `lib/` returns only comments explaining the port |
| SC3 | The agent surface is byte-identical in behaviour | `lib/mcp*.test.ts` + `e2e/agent-readiness.spec.ts` + `e2e/mcp.spec.ts` pass unchanged; an `isitagentready.com` scan of the preview reconciles with `docs/AGENT_READINESS.md` |
| SC4 | Every existing URL still resolves | `e2e/content-negotiation.spec.ts` and a link-integrity sweep over `/work/*`, `/writing/*`, `/llms.txt`, `/.well-known/*` |
| SC5 | Typecheck, lint, unit tests, and the process gate are green | `pnpm typecheck && pnpm lint && pnpm test && pnpm process:check` |
| SC6 | Canvas engines do not leak across React remounts | every `mount*` returns a disposer; StrictMode double-mount leaves one rAF loop |
| SC7 | Theme switching re-themes every canvas without a reload | visual receipt in both themes; `e2e/theme.spec.ts` |
| SC8 | Reduced-motion and keyboard users are not harmed | `e2e/reduced-motion.spec.ts`; the cursor engine stays decorative and never takes focus |
| SC9 | The client bundle does not grow | `three` removed; bundle compared against `docs/BUNDLE_BUDGET.md` |
| SC10 | Deployed to Cloudflare with the domain cut over | preview Worker green, then apex repointed; Vercel project paused not deleted for 14 days |

## Constraints

- **No invented facts.** The site is a real person's professional record. No
  employer, date, title, metric, or claim may appear unless it is already
  sourced in this repo. A thin honest section beats a padded one.
- **No hard-coded colours.** Everything through `app/styles/tokens.css` or the
  `PALETTE` constants in `lib/pixel.ts`.
- **Deterministic art.** All randomness goes through `h(x, y)`. Never
  `Math.random` in decorative code — the art must be identical on every load.
- **Voice.** `docs/voice.md` governs all copy, including its banned AI-tells.
- **Bar Council ethics line is not ported.** It is a legal requirement for an
  advocate and would be meaningless here.
- Fonts must be self-hosted and licence-clean. Instagram Sans was requested and
  **rejected**: it is a proprietary Meta asset, not licensed for third-party use.

## Open questions

- **OQ1** — Display face. Cabinet Grotesk is the design's own; a more
  geometric alternative was raised. Unresolved.
- **OQ2** — The secret entrance (triple-click the hero pivot) currently fires
  `pixel:secret` with nothing listening. Keep the mechanic, wire a destination,
  or remove it.
- **OQ3** — Whether the hyperframes case-study video loops survive alongside the
  pixel language on `/work/[slug]`.
