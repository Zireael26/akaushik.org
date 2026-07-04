---
slug: agent-readiness-contract
purpose: Content-negotiation, API catalog, OpenAPI 3.1, and llms-full.txt surfaces so the portfolio passes isitagentready.com checks.
pinned_to: 903ccde
created: 2026-05-15
last_refreshed: 2026-07-04
related_primers: [mdx-content-pipeline]
---

# Agent Readiness Contract

## Purpose

Expose the portfolio's content surfaces to agent crawlers and retrieval consumers via the conventions Cloudflare's `isitagentready.com` scanner checks: an RFC 9727 API Catalog, an OpenAPI 3.1 spec, Markdown alternates (`.md` suffix + `Accept: text/markdown` negotiation), and a single-file Markdown corpus at `/llms-full.txt`. The site's thesis is "AI engineer building agent systems" — a low score is a credibility leak.

## Entry points

- `app/.well-known/api-catalog/route.ts` — RFC 9727 linkset JSON advertising every machine-readable surface (OpenAPI, JSON listings, llms.txt, llms-full.txt, sitemap, agent-skills index).
- `app/llms-full.txt/route.ts` — concatenates the entire corpus (about, services, every case study body, every writing post body) into one Markdown document with `<about>`, `<services>`, `<case-study slug=…>`, `<post slug=…>` pseudo-HTML wrappers.
- `app/llms.txt/route.ts` — short-form site digest per llmstxt.org format.
- `lib/openapi-spec.ts` — source of truth for the OpenAPI 3.1 spec (extracted from the route in PR-5 so it can be shared with the human-readable page).
- `app/api/openapi.json/route.ts` — thin handler that re-exports `OPENAPI_SPEC` from `lib/openapi-spec.ts` with `force-static` + 1-hour revalidate.
- `app/api/docs/page.tsx` — server-rendered human-readable OpenAPI page (no client JS; Redoc/Swagger UI dropped on bundle-budget grounds); reads `lib/openapi-spec.ts`.
- `proxy.ts` — rewrites `/work/<slug>.md` → `/work/<slug>/md` (Pattern B) and `Accept: text/markdown` requests to the same `/md` variant (Pattern A).
- `docs/AGENT_READINESS.md` — the alignment spec; the source of truth for what's required vs deferred.
- `docs/adr/0006-content-negotiation-patterns.md` — the why and how of Patterns A + B.

## Data flow

An agent discovering and consuming the corpus:

1. Agent fetches `https://akaushik.org/.well-known/api-catalog`. Route handler is `force-static` with 1-hour revalidate; returns `application/linkset+json` with seven typed links (OpenAPI, two JSON listings, two Markdown digests, sitemap, agent-skills index).
2. Agent follows `rel="service-desc"` to `/api/openapi.json`. Hand-coded OpenAPI 3.1 spec lists the four paths and their content types. `force-static`, 1-hour revalidate.
3. For enumeration the agent calls `/api/case-studies` and `/api/writing` — each returns `{count, …}` JSON sourced from `lib/content.ts:getAllPosts*`. Includes `url` (HTML canonical) and `markdown` (`.md` alternate) fields.
4. For a single case study the agent has three options: HTML at `/work/<slug>`, Markdown at `/work/<slug>.md` (path suffix), or HTML URL with `Accept: text/markdown` (header negotiation). `proxy.ts` rewrites both Markdown paths to `/work/<slug>/md`, which is a separate route handler.
5. For one-shot corpus retrieval the agent fetches `/llms-full.txt`. Route reads `getAllPosts` for both content types, reads each body via `getPost`, wraps each in semantic pseudo-HTML tags, and serves `text/markdown` with 5-minute revalidate.
6. Every HTML page additionally emits `Link:` headers via `proxy.ts` advertising `/llms.txt`, `/llms-full.txt`, the API catalog, and (for pages with Markdown alternates) the `.md` URL. Two RFC 8631 rel types were added: `service-desc` → `/api/openapi.json` and `service-doc` → `/api/docs`.

## Dependencies

- `mdx-content-pipeline` primer — `lib/content.ts` is the single source for frontmatter + bodies that the corpus, JSON listings, OpenAPI examples, and Markdown alternates all consume.
- `lib/about-copy.ts` + `lib/services.ts` — additional corpus sections rendered into `/llms-full.txt` alongside MDX content.
- `app/sitemap.ts` — referenced by the API catalog (`rel="sitemap"`) and the `robots.txt` route.
- `app/robots.txt/route.ts` — declares Content Signals (`Content-Signal: search=yes, ai-train=yes, ai-input=yes`) and references the sitemap.
- `app/work/[slug]/md/route.ts` + `app/writing/[slug]/md/route.ts` — the Markdown alternate handlers (not listed as entry points because the rewrite in `proxy.ts` is the actual contract surface).
- External: `isitagentready.com` scanner; its MCP tool at `https://isitagentready.com/.well-known/mcp.json`.

## Test commands

```bash
# Hit every well-known surface against dev
pnpm dev

curl -s http://localhost:3000/.well-known/api-catalog | jq
curl -s http://localhost:3000/api/openapi.json | jq '.paths | keys'
curl -s http://localhost:3000/api/case-studies   | jq '.caseStudies[].slug'
curl -s http://localhost:3000/api/writing        | jq '.posts[].slug'
curl -s http://localhost:3000/llms.txt
curl -s http://localhost:3000/llms-full.txt | head -50

# Markdown alternate — Pattern B (path suffix)
curl -s http://localhost:3000/work/neev.md | head -20

# Markdown alternate — Pattern A (header negotiation)
curl -s -H 'Accept: text/markdown' http://localhost:3000/work/neev | head -20

# Verify Link headers on an HTML page
curl -sI http://localhost:3000/work/neev | rg -i '^link:'

# Production scan against the deployed site
# https://isitagentready.com/?url=https://akaushik.org
```

`pnpm test` (Vitest) does not cover these surfaces directly; verification is contract-level via curl + the external scanner.

## Gotchas

- **`Accept: text/markdown` must be the _preferred_ type** in the comma list — middleware checks it's first, otherwise browsers (which send `text/html,application/xhtml+xml,...`) would trigger the rewrite. Don't simplify the check to a substring match.
- **Pattern A is the fragile one.** ADR-0006 R4 flags Vercel Edge Runtime as historically flaky with header-driven rewrites on streaming responses. If the preview smoke shows Pattern A breaking, disable the single `if` guard in `proxy.ts` and ship Pattern B alone — the scanner accepts either.
- **`force-static` + `revalidate = 300` (5 minutes) on `/llms-full.txt`** balances freshness against traffic. The scanner re-fetches every scan; a 5-minute cache window means a content edit propagates within 5 minutes on prod.
- **MDX bodies already lead with `# <title>` + `> <dek>`.** Per AGENT_READINESS §4.4 the corpus wrapper only adds slug + metadata-list rows below the body. Don't re-emit the title — agents would see it twice.
- **API Catalog content type is `application/linkset+json`**, not `application/json`. RFC 9727 mandates this; the scanner sniffs it.
- **Proxy matcher was loosened** to allow `.md` paths through (ADR-0006). The blanket `.*\..*` exclusion shortcut is gone; any newly-added static asset extension may unexpectedly trigger proxy logic. Watch for this when adding fonts/icons.
- **Curated ORDER vs alphabetical.** `/api/case-studies` returns slugs in the home-page reading order (Neev → VeriCite → Bluehost → curat.money), not alphabetical. A new case study without an `ORDER` entry is silently filtered out — see `mdx-content-pipeline` gotcha list.
- **OpenAPI spec is hand-maintained.** Not generated from route scans (the deliberate call in `lib/openapi-spec.ts:1`). Adding a new agent-facing route requires hand-editing `lib/openapi-spec.ts` and the API catalog linkset; `app/api/openapi.json/route.ts` is now just a thin pass-through.
- **`/about` and `/services` Markdown handlers are intentionally deferred.** Those sections live on the home composite, not standalone pages. They surface in `/llms-full.txt` so corpus completeness still holds; revisit if either promotes to its own page.

## Out of scope

- Content Signals authoring (`Content-Signal:` policy) — declared in `app/robots.txt/route.ts`; revisit only if the maximally-open `ai-train=yes` policy changes.
- Agent Skills index at `/.well-known/agent-skills/index.json` — referenced by the API catalog but built by `scripts/build-agent-skills-index.ts` at `prebuild`; that pipeline deserves its own primer if it grows.
- MCP server card / OAuth (RFC 9728) — listed in AGENT_READINESS §6 as out-of-scope-for-now; revisit when the portfolio exposes a tool surface.
- The MDX loader itself — see `mdx-content-pipeline` primer.

## Notes

- ADR-0003 fixes the canonical URL at `https://akaushik.org`; the API catalog, OpenAPI servers entry, and corpus wrappers all hard-code this string. Any domain change must grep all three.
- AGENT_READINESS doc is sourced from secondary reporting on Cloudflare's launch — `isitagentready.com` direct fetches were proxy-blocked at authoring time. Before declaring a check passing, run the live scanner against the deployed URL and reconcile any deltas back into the doc.
