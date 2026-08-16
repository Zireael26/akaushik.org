---
slug: seo-strategy
purpose: SEO + AIO program for akaushik.org — three-goal plan, per-page canonical + JSON-LD wiring, five repository task sources with separate registration, live status doc, human-required handoff queue.
pinned_to: 12e2ddd
created: 2026-05-18
last_refreshed: 2026-07-15
related_primers: [agent-readiness-contract, mdx-content-pipeline, og-image-generation]
---

# SEO Strategy

## Purpose

Build search + AIO discovery for `akaushik.org` against three prioritized goals: (G1) rank for client-acquisition queries that bring MSME buyers, (G2) win identity disambiguation via Knowledge Panel + Wikidata + schema, (G3) get cited in AI Overviews / ChatGPT / Perplexity for case-study-shaped engineering questions. G3 ceiling is acknowledged-lower because the community-presence lever (Reddit/HN) was kept off the table; on-site signals only.

Plan written 2026-05-18 after the canonical-host rename (`developerabhishek.live` → `akaushik.org`, ADR-0003) revealed that legacy 301 redirects were never wired — six years of backlink equity was stranded. The legacy host registration subsequently lapsed 2026-05-19 (ADR-0003 Outcome addendum), so Phase 0 collapses to (a) `akaushik.dev` 308 redirect, (b) GSC verify + sitemap submit, and (c) on-site equity-recovery via Wikidata `sameAs`. Everything else is downstream.

## Entry points

- `docs/seo/2026-05-18-seo-strategy-design.md` — the static plan. Goals, phases, success metrics, risks. Read this before changing program direction.
- `docs/seo/STATUS.md` — **live status doc**. Phase progress, canonical NAP block, metrics, alerts, drift log, automation health, leads attributed, human handoff queue. Read this every session to know current state without re-exploration.
- `docs/seo/editorial-calendar.md` — 50-slot publishing calendar (human-seeded 2026-05-19; one fixed-width row per post; `status: pending|drafted|published|dropped`). A registered `seo-weekly-draft` run reads it fresh and records the real draft PR URL in a trailing row annotation.
- `docs/seo/scheduled-tasks/*.md` — repository source templates for five intended Cowork tasks. Their presence does not prove active registration.
- `docs/seo/scheduled-tasks/REGISTER.md` — one-time registration source. Each bootstrap re-reads its task file every run, so edit the source file alone for behavior changes; use scheduler controls only for registration, cadence, or enabled/paused state.
- `docs/adr/0011-writing-post-hyperframes-loops.md` — media policy for weekly drafts: loops are the default, process/non-visual posts may take the documented exception, and render work remains an explicit owner handoff.
- `lib/canonical.ts` — helper exporting `canonical(path)` for per-page `alternates.canonical` metadata.
- `lib/structured-data.ts` — Schema.org JSON-LD builders for `Person`, `Organization`, `WebSite`, `Article`, case-study `Article`, and content-detail `BreadcrumbList` graphs.
- `components/seo/JsonLdScript.tsx` — server-rendered component that emits a literal `<script type="application/ld+json">` into the static HTML head (parse-only crawlers need the tag in SSR HTML, not the RSC payload).
- `app/layout.tsx` — `Person` + `Organization` + `WebSite` JSON-LD `@graph` injection point (root-only).
- `app/writing/[slug]/page.tsx` + `app/work/[slug]/page.tsx` — `Article` JSON-LD per-page injection (cross-references the root `@id` URIs).

## Data flow

How discovery + automation thread together:

1. Crawler hits `akaushik.org/<any-page>`. Receives a per-page canonical, the root `Person` + `Organization` + `WebSite` JSON-LD graph, and `Article` plus `BreadcrumbList` JSON-LD on writing/case-study detail pages. `Link:` headers advertise `llms.txt`, `llms-full.txt`, sitemap, agent skills, and `.md` alternates.
2. Legacy alias `akaushik.dev` 308-redirects to canonical at the Vercel layer. When registered and enabled, `seo-redirect-health` is intended to verify it daily; failures append to `STATUS.md > Alerts` and open a PR with the transcript. (`developerabhishek.live` registration lapsed 2026-05-19 — see ADR-0003 Outcome addendum; no longer in the redirect-health check list.)
3. Editorial calendar drives content. When registered and enabled, `seo-weekly-draft` runs Monday 06:00, resumes its exact dated branch idempotently, drafts the next `pending` MDX, and opens or reuses one draft PR. Per ADR-0011, the PR flags `loop pending` by default or names the process/non-visual exception; the owner performs any local HyperFrames render. The task then commits and pushes the real PR URL to the selected calendar row. Abhishek edits + merges.
4. Monthly source contracts: `seo-monthly-health` covers schema, Lighthouse, sitemap, and metrics; `seo-monthly-profile-drift` compares public profiles with the canonical NAP block and records mismatches. They run only if registered and enabled.
5. The quarterly source contract proposes a flagship-post topic and opens an issue / PR with the brief when registered and enabled.
6. Registered task runs use `seo-bot/...` branches and PR flow. **Never push to main.**

## Dependencies

- **External (account-bound, Abhishek-only):** Vercel project domains config; Google Search Console + Bing Webmaster Tools verification; GSC Change-of-Address; Wikidata entry; LinkedIn / GitHub / X / Bluesky / dev.to / Hashnode profile editing. Status tracked in `STATUS.md > Human handoff queue`.
- **Internal code:** `lib/canonical.ts`, `lib/structured-data.ts`, `components/seo/JsonLdScript.tsx`, `app/sitemap.ts`, `app/robots.txt/route.ts`, and `proxy.ts` for Link headers plus Markdown negotiation.
- **Tooling (used by task sources when registered):** `gh` CLI for PR creation; `curl` for redirect health; `linkinator` or equivalent for internal-link audit; `validator.schema.org` HTTP API; Lighthouse (npm package or pnpm script).
- **Registration model:** `REGISTER.md` supplies one-time bootstrap prompts that re-read the committed source templates on every run. Prompt behavior is repo-driven; registration, cadence, and enabled/paused state are scheduler-driven.
- **Observed registration state (2026-07-15):** `$HOME/.claude/scheduled-tasks/` is absent and `STATUS.md` H10 remains pending. No active Cowork registration is evidenced by the repo or expected local task store; confirm in the scheduler before relying on any cadence.
- **Related primers:** `agent-readiness-contract` (LLM/agent surfaces already shipped), `og-image-generation` (per-page OG images; extend per spec §4.7), `mdx-content-pipeline` (drives content + listing endpoints feeding `llms-full.txt`).

## Test commands

```bash
# Redirect health (current canonical behavior)
curl -sIL https://akaushik.dev/                                          | head -8
curl -sIL https://akaushik.dev/work/neev                                 | head -8
curl -sIL https://akaushik.org/                                          | head -8   # should be 200, no chain

# Schema validation (post-Phase-2)
curl -s https://akaushik.org/ | grep -oE '<script type="application/ld\+json">[^<]*' | head -3
# Or against validator.schema.org:
#   POST https://validator.schema.org/validate  body: {url: "https://akaushik.org/"}

# Sitemap freshness
curl -s https://akaushik.org/sitemap.xml | head -20

# llms.txt and llms-full.txt (already shipped per agent-readiness-contract)
curl -s https://akaushik.org/llms.txt | head -20
curl -s https://akaushik.org/llms-full.txt | wc -c    # byte-size growth = content compounding

# Inspect repository sources; this does not prove active registration
rg --files docs/seo/scheduled-tasks
test -d "$HOME/.claude/scheduled-tasks" && echo present || echo absent
# Confirm active/enabled state in the scheduler itself before relying on a cadence.
```

## Gotchas

- **Source is not registration.** Files under `docs/seo/scheduled-tasks/` are inert templates until a scheduler registration exists and is enabled. Never infer active health from source files or empty STATUS sections.
- **Cowork-only scheduling.** If these tasks are registered in Cowork, they fire only while the app is open (or on next launch for deferred runs). The daily redirect check is the most cadence-sensitive.
- **Fresh-context tasks.** Every registered run starts with no memory of prior conversations or runs. Source templates MUST remain self-contained: repo, exact branch/worktree policy, files to read, writes, commit/push sequence, PR behavior, and failure reporting.
- **Never push to main.** GitHub branch protection on `main` refuses direct pushes server-side (PR required; `verify`/`test`/`audit` must pass; admins included) — do not expect a local hook to catch it, there is none in this repo. Every registered run must still use its exact `seo-bot/...` branch and PR flow. Editorial review is the gate.
- **Wikidata deletion risk.** First-pass entries for non-famous individuals get deleted by editors as "non-notable." Cite akaushik.org/about + LinkedIn + Bluehost team page + any external press as references. Re-submit with additional sources if deleted.
- **GSC Change of Address from `developerabhishek.live` is no longer on the table.** Registration lapsed 2026-05-19 (ADR-0003 Outcome) — there is no source property to verify or redirect from. Equity recovery relies on `sameAs` Wikidata + sitemap re-submission + on-site signals only.
- **Canonical NAP block.** Lives in `STATUS.md §2`. Editing it changes what the drift monitor compares against — keep deliberately current. Empty fields = "ignore this `sameAs`" (TODO until filled).
- **AIO ceiling.** No community presence (HN/Reddit/Lobsters off the table) caps how often AI Overviews cite this site. If 12-month review shows zero AIO citations, the no-community trade-off should be re-litigated with new evidence — not silently absorbed.
- **Per-page canonical, not site-wide.** Next's `metadataBase` alone does NOT emit `<link rel="canonical">`. Each page (root + every dynamic route's `generateMetadata`) must set `alternates: { canonical: '/<path>' }`. Helper `canonical()` in `lib/canonical.ts` exists to keep this consistent.
