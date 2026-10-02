---
slug: seo-strategy
purpose: SEO + AIO program for akaushik.org — three-goal plan, per-page canonical + JSON-LD wiring, five repository task sources with separate registration, live status doc, human-required handoff queue.
pinned_to: 883e508dd3e7e4c7b3247ebcb575228c6840b5bd
created: 2026-05-18
last_refreshed: 2026-10-03
related_primers: [agent-readiness-contract, mdx-content-pipeline, og-image-generation]
---

# SEO Strategy

## Purpose

Build search + AIO discovery for `akaushik.org` against three prioritized goals: (G1) rank for client-acquisition queries that bring MSME buyers, (G2) win identity disambiguation via Knowledge Panel + Wikidata + schema, (G3) get cited in AI Overviews / ChatGPT / Perplexity for case-study-shaped engineering questions. G3 ceiling is acknowledged-lower because the community-presence lever (Reddit/HN) was kept off the table; on-site signals only.

Plan written 2026-05-18 after the canonical-host rename (`developerabhishek.live` → `akaushik.org`, ADR-0003) revealed that legacy 301 redirects were never wired. The legacy host registration subsequently lapsed 2026-05-19 (ADR-0003 Outcome addendum), so Phase 0 collapses to (a) `akaushik.dev` 308 redirect, (b) GSC verify + sitemap submit, and (c) on-site equity-recovery via Wikidata `sameAs`. Everything else is downstream.

## Entry points

- `docs/seo/2026-05-18-seo-strategy-design.md` — the static plan. Goals, phases, success metrics, risks. Read this before changing program direction.
- `docs/seo/STATUS.md` — **live status doc**. Phase progress, canonical NAP block, metrics, alerts, drift log, automation health, leads attributed, human handoff queue. Read this each session; dated observations are not live scheduler or production checks.
- `docs/seo/editorial-calendar.md` — 50-slot publishing calendar (human-seeded 2026-05-19; one fixed-width row per post; `status: pending|drafted|published|dropped`). A registered `seo-weekly-draft` run reads it fresh and records the real draft PR URL in a trailing row annotation.
- `docs/seo/scheduled-tasks/` — repository source templates for five intended Cowork tasks plus `REGISTER.md`; source presence does not prove active registration, and registration controls cadence and enabled/paused state.
- `docs/adr/0020-canvas-fields-over-hyperframes-video.md` — accepted media policy; it supersedes ADR-0011 and says writing pages use a `RouteField` hero band under the byline, not HyperFrames loops.
- `docs/adr/0011-writing-post-hyperframes-loops.md` — historical policy only; explicitly superseded by ADR-0020.
- `lib/canonical.ts` — helper exporting `canonical(path)` for per-page `alternates.canonical` metadata.
- `lib/structured-data.ts` — Schema.org JSON-LD builders for `Person`, `Organization`, `WebSite`, `Article` (including case studies), and `BreadcrumbList` graphs.
- `components/seo/JsonLdScript.tsx` — server-rendered component that emits a literal `<script type="application/ld+json">` into the static HTML head (parse-only crawlers need the tag in SSR HTML, not the RSC payload).
- `app/layout.tsx` — root `Person` + `Organization` + `WebSite` JSON-LD `@graph`; also advertises the Atom feed.
- `app/writing/[slug]/page.tsx` + `app/work/[slug]/page.tsx` — per-page Article and BreadcrumbList JSON-LD; writing pages add FAQPage only when grounded FAQ copy exists.
- `app/feed.xml/route.ts` — Atom feed for dated, public writing posts; drafts and unlisted posts are excluded.
- `lib/agent-proxy.ts` — shared Link-header and Markdown-negotiation contract; `proxy.ts` and `worker/index.ts` are runtime adapters.

## Data flow

How discovery + automation thread together:

1. Crawler hits `akaushik.org/<any-page>`. Pages have per-page canonicals and the root `Person` + `Organization` + `WebSite` graph; detail pages add Article + BreadcrumbList, with FAQPage only for writing posts with grounded FAQ copy. `Link` headers advertise `llms.txt`, `llms-full.txt`, sitemap, agent skills, and Markdown alternates; `/feed.xml` is also linked from the root HTML head and serves Atom.
2. `akaushik.dev` is intended to 308-redirect to the canonical host via the Cloudflare Worker `workers/akaushik-dev-redirect/` (production env routes `akaushik.dev/*` and `www.akaushik.dev/*`; cutover approved by the owner 2026-10-01, `wrangler.jsonc:12-27`). Commit 128d467 states the Worker was not deployed by that commit, so confirm the live state before relying on it. Rollback is deleting those routes, which falls back to the Vercel redirect; the Vercel domains must stay attached until 2026-10-15. The last STATUS record says manual probes were green on 2026-07-04 but the automated seven-day streak was not recorded as of 2026-07-15; recheck before relying on that external state. When registered and enabled, `seo-redirect-health` is intended to check daily and open an alert PR on failure. (`developerabhishek.live` registration lapsed 2026-05-19 — see ADR-0003 Outcome addendum; excluded from the redirect-health checks.)
3. Editorial calendar drives content. When registered and enabled, `seo-weekly-draft` is intended for Monday 06:00, resumes its exact dated branch idempotently, drafts the next `pending` MDX, opens or reuses one draft PR, then commits and pushes the real PR URL to the selected calendar row. Abhishek edits + merges. Its media-policy reference is stale; see Gotchas.
4. Monthly source contracts: `seo-monthly-health` covers schema, Lighthouse, sitemap, and metrics; `seo-monthly-profile-drift` compares public profiles with the canonical NAP block and records mismatches. They run only if registered and enabled.
5. The quarterly source contract proposes a flagship-post topic, drafts a brief, and opens a PR when registered and enabled.
6. Registered task runs use `seo-bot/...` branches and PR flow. **Never push to main.**

## Dependencies

- **External (account-bound, Abhishek-only):** Cloudflare zone/Worker routes for `akaushik.dev` (Vercel domains kept attached as the rollback path until 2026-10-15); Google Search Console + Bing Webmaster Tools verification and sitemap submission; Wikidata entry; LinkedIn / GitHub / X / Bluesky / dev.to / Hashnode profile editing. Status tracked in `STATUS.md > Human handoff queue`.
- **Internal code:** `lib/canonical.ts`, `lib/structured-data.ts`, `components/seo/JsonLdScript.tsx`, `app/sitemap.ts`, `app/robots.txt/route.ts`, `app/feed.xml/route.ts`, and the shared `lib/agent-proxy.ts` contract (adapted by `proxy.ts` and `worker/index.ts`) for Link headers plus Markdown negotiation.
- **Tooling (used by task sources when registered):** `gh` CLI for PR creation; `curl` for redirect health; `linkinator` or equivalent for internal-link audit; `validator.schema.org` HTTP API; Lighthouse via the source contract's `pnpm dlx @lhci/cli` command.
- **Registration model:** `docs/seo/scheduled-tasks/REGISTER.md` supplies one-time bootstrap prompts that re-read committed source templates on every run. Prompt behavior is repo-driven; registration, cadence, and enabled/paused state are scheduler-driven.
- **Last repo-recorded registration audit (2026-07-15):** `STATUS.md` says the scheduled-task directory was absent and H10 remained pending. The repo does not prove current scheduler state; confirm in the scheduler before relying on any cadence.
- **Related primers:** `agent-readiness-contract` (LLM/agent surfaces), `og-image-generation` (per-page OG images; STATUS marks this task complete), `mdx-content-pipeline` (content sources used by `llms-full.txt`).

## Test commands

```bash
# Check canonical redirect behavior; consult STATUS.md for the last recorded result
curl -sIL https://akaushik.dev/                                          | head -8
curl -sIL https://akaushik.dev/work/neev                                 | head -8
curl -sIL https://akaushik.org/                                          | head -8   # should be 200, no chain

# Schema validation (post-Phase-2)
curl -s https://akaushik.org/ | grep -oE '<script type="application/ld\+json">[^<]*' | head -3
# Or against validator.schema.org:
#   POST https://validator.schema.org/validate  body: {url: "https://akaushik.org/"}

# Sitemap freshness
curl -s https://akaushik.org/sitemap.xml | head -20

# LLM surfaces
curl -s https://akaushik.org/llms.txt | head -20
curl -s https://akaushik.org/llms-full.txt | wc -c    # byte-size growth = content compounding

# Atom feed
curl -s https://akaushik.org/feed.xml | head -20

# Inspect repository sources; this does not prove active registration
rg --files docs/seo/scheduled-tasks
test -d "$HOME/.claude/scheduled-tasks" && echo present || echo absent
# Confirm active/enabled state in the scheduler itself before relying on a cadence.
```

## Gotchas

- **Source is not registration.** Files under `docs/seo/scheduled-tasks/` are inert templates until a scheduler registration exists and is enabled. Never infer active health from source files or empty STATUS sections.
- **Cowork-only scheduling.** If these tasks are registered in Cowork, they fire only while the app is open (or on next launch for deferred runs). The daily redirect check is the most cadence-sensitive.
- **Fresh-context tasks.** Every registered run starts with no memory of prior conversations or runs. Source templates MUST remain self-contained: repo, exact branch/worktree policy, files to read, writes, commit/push sequence, PR behavior, and failure reporting.
- **Never push to main.** Every registered run must still use its exact `seo-bot/...` branch and PR flow. Editorial review is the gate.
- **Wikidata deletion risk.** First-pass entries for non-famous individuals may be deleted as "non-notable." Cite akaushik.org/about + LinkedIn + Bluehost team page + any external press as references; add sources if an entry is deleted.
- **GSC Change of Address from `developerabhishek.live` is no longer on the table.** Registration lapsed 2026-05-19 (ADR-0003 Outcome) — there is no source property to verify or redirect from. Equity recovery relies on `sameAs` Wikidata + sitemap re-submission + on-site signals only.
- **Canonical NAP block.** Lives in `STATUS.md §2`. Editing it changes what the drift monitor compares against — keep deliberately current. Empty fields = "ignore this `sameAs`" (TODO until filled).
- **AIO ceiling.** No community presence (HN/Reddit/Lobsters off the table) caps how often AI Overviews cite this site. If 12-month review shows zero AIO citations, the no-community trade-off should be re-litigated with new evidence — not silently absorbed.
- **Per-page canonical, not site-wide.** Next's `metadataBase` alone does NOT emit `<link rel="canonical">`. Each page (root + every dynamic route's `generateMetadata`) must set `alternates: { canonical: '/<path>' }`. Helper `canonical()` in `lib/canonical.ts` exists to keep this consistent.
- **Weekly media-policy references are stale.** `seo-weekly-draft.md` still points at ADR-0011 and asks for “loop pending”; STATUS H13 still queues writing-loop renders. ADR-0020 supersedes that policy, and writing pages now use a `RouteField` hero band. Treat ADR-0020 and current code as authoritative; no HyperFrames render handoff is needed.
