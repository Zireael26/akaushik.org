---
slug: agent-readiness-contract
purpose: Content-negotiation, API catalog, OpenAPI 3.1, and llms-full.txt surfaces for the agent-readiness contract; live scanner validation remains pending.
pinned_to: 883e508dd3e7e4c7b3247ebcb575228c6840b5bd
created: 2026-05-15
last_refreshed: 2026-10-03
related_primers: [mdx-content-pipeline]
---

# Agent Readiness Contract

## Purpose

Expose the portfolio's content surfaces to agent crawlers and retrieval consumers under the conventions in `docs/AGENT_READINESS.md`: an RFC 9727 API Catalog, an OpenAPI 3.1 spec, Markdown alternates (`.md` suffix + `Accept: text/markdown` negotiation), and a single-file Markdown corpus at `/llms-full.txt`. The readiness target includes `isitagentready.com`; production MCP rate limiting and external Agent Readiness validation remain pending. The site's thesis is "AI engineer building agent systems" — a low score is a credibility leak.

## Entry points

- `app/.well-known/api-catalog/route.ts` — RFC 9727 linkset JSON advertising seven typed links: OpenAPI, JSON listings, llms.txt, llms-full.txt, sitemap, and agent-skills index.
- `app/llms-full.txt/route.ts` — concatenates about/services, published case studies, and public writing posts (excluding drafts and unlisted writing) into one Markdown document with `<about>`, `<services>`, `<case-study slug=…>`, `<post slug=…>` pseudo-HTML wrappers. Service copy, including autonomy and proof sections, comes from `lib/services.ts`.
- `app/llms.txt/route.ts` — short-form site digest per llmstxt.org format.
- `lib/openapi-spec.ts` — hand-maintained OpenAPI 3.1 source of truth (extracted from the route in PR-5), shared by the JSON route and human-readable page; it documents the Markdown/listing surfaces and `/api/mcp`.
- `app/api/openapi.json/route.ts` — thin handler that returns `OPENAPI_SPEC` from `lib/openapi-spec.ts` with `force-static` + 1-hour revalidate.
- `app/api/docs/page.tsx` — server-rendered human-readable OpenAPI page; uses a custom viewer rather than Redoc/Swagger UI (dropped on bundle-budget grounds) and reads `lib/openapi-spec.ts`.
- `lib/agent-proxy.ts` — shared policy for discovery headers, Markdown rewrites, and security headers.
- `proxy.ts` — local `next dev` / `next start` adapter; production Cloudflare traffic uses `worker/index.ts`. Both apply the shared `lib/agent-proxy.ts` policy.
- `lib/agent-discovery.ts` — shared discovery `Link` header values.
- `docs/AGENT_READINESS.md` — alignment spec for required surfaces and current validation status.
- `docs/adr/0006-content-negotiation-patterns.md` — rationale and design history for Patterns A + B.

## Data flow

An agent discovering and consuming the corpus:

1. Agent fetches `https://akaushik.org/.well-known/api-catalog`. Route handler is `force-static` with 1-hour revalidate; returns `application/linkset+json` with seven typed links (OpenAPI, two JSON listings, two Markdown digests, sitemap, agent-skills index).
2. Agent follows `rel="service-desc"` to `/api/openapi.json`. The hand-maintained OpenAPI 3.1 spec has eight path entries covering the llms files, both JSON listings, `/api/mcp`, home-page negotiation, and per-page `.md` routes. The route is `force-static` with 1-hour revalidate.
3. For enumeration the agent calls `/api/case-studies` and `/api/writing` — each returns `{count, …}` JSON sourced from `lib/content.ts`. Both include `url` (HTML canonical) and `markdown` (`.md` alternate) fields; the writing list is newest-first.
4. For a case study or writing post the agent has HTML, a `.md` suffix alternate, or `Accept: text/markdown` negotiation. Shared policy in `lib/agent-proxy.ts` rewrites `.md` URLs to the `/md` handlers and rewrites preferred Markdown requests on those detail paths; the home-page preference rewrites to `/llms.txt`.
5. For one-shot corpus retrieval the agent fetches `/llms-full.txt`. The route reads published case studies and public writing posts (excluding drafts and unlisted writing), loads each body via `getPost`, wraps sections in pseudo-HTML tags, and serves `text/markdown` with 5-minute revalidate. Case studies have an explicit curated order; service copy comes from `lib/services.ts`.
6. Contract-handled responses receive a shared discovery `Link:` header. It advertises `/llms.txt`, `/llms-full.txt`, sitemap, skills and MCP discovery, the API catalog, OpenAPI and human API docs; detail pages with Markdown alternates also advertise the `.md` URL. The RFC 8631 `service-desc` and `service-doc` relations point to `/api/openapi.json` and `/api/docs` respectively.

## Dependencies

- `mdx-content-pipeline` primer — `lib/content.ts` is the shared source for frontmatter + bodies consumed by the corpus, JSON listings, and Markdown alternates. The OpenAPI spec is maintained separately.
- `lib/about-copy.ts` + `lib/services.ts` — additional corpus sections rendered into `/llms-full.txt` alongside MDX content.
- `app/sitemap.ts` — referenced by the API catalog (`rel="sitemap"`) and the `robots.txt` route.
- `app/robots.txt/route.ts` — declares Content Signals (`Content-Signal: search=yes, ai-train=yes, ai-input=yes`) and references the sitemap.
- `app/work/[slug]/md/route.ts` + `app/writing/[slug]/md/route.ts` — the Markdown alternate handlers; the shared rewrite policy is in `lib/agent-proxy.ts`.
- External: `isitagentready.com` scanner; its MCP tool at `https://isitagentready.com/.well-known/mcp.json`.

## Test commands

```bash
# Hit agent-readiness endpoints against dev
pnpm dev

curl -s http://localhost:3100/.well-known/api-catalog | jq
curl -s http://localhost:3100/api/openapi.json | jq '.paths | keys'
curl -s http://localhost:3100/api/case-studies   | jq '.caseStudies[].slug'
curl -s http://localhost:3100/api/writing        | jq '.posts[].slug'
curl -s http://localhost:3100/llms.txt
curl -s http://localhost:3100/llms-full.txt | head -50

# Markdown alternate — Pattern B (path suffix)
curl -s http://localhost:3100/work/neev.md | head -20

# Markdown alternate — Pattern A (header negotiation)
curl -s -H 'Accept: text/markdown' http://localhost:3100/work/neev | head -20

# Verify Link headers on an HTML page
curl -sI http://localhost:3100/work/neev | rg -i '^link:'

# Production scan against the deployed site
# https://isitagentready.com/?url=https://akaushik.org
```

`pnpm test` (Vitest) covers the shared negotiation/header policy in `lib/agent-proxy.test.ts`; Playwright `e2e/agent-readiness.spec.ts` and `e2e/content-negotiation.spec.ts` exercise the HTTP surfaces. Live scanner validation remains pending (see `docs/AGENT_READINESS.md` §§5.3, 8).

## Gotchas

- **`Accept: text/markdown` must be the _preferred_ type** in the comma list — middleware checks it's first, otherwise browsers (which send `text/html,application/xhtml+xml,...`) would trigger the rewrite. Don't simplify the check to a substring match.
- **Pattern A is the fragile one.** ADR-0006 R4 records historical Vercel Edge Runtime risk for header-driven rewrites. The current production adapter is Cloudflare Workers, not Vercel Edge; if its preview smoke shows Pattern A breaking, disable the shared Pattern A branch in `lib/agent-proxy.ts` and keep Pattern B (the scanner accepts either).
- **`force-static` + `revalidate = 300` (5 minutes) on `/llms-full.txt`** balances freshness against traffic. The scanner re-fetches on each scan, but the response also advertises `max-age=300` and `stale-while-revalidate=3600`; a scan can therefore receive cached content while it refreshes.
- **MDX bodies already lead with `# <title>` + `> <dek>`.** Per AGENT_READINESS §4.4 the corpus wrapper only adds slug + metadata-list rows below the body. Don't re-emit the title — agents would see it twice.
- **API Catalog content type is `application/linkset+json`**, not `application/json`. RFC 9727 mandates this; the scanner sniffs it.
- **Proxy matcher was loosened** to allow `.md` paths through (ADR-0006). The blanket `.*\..*` exclusion shortcut is gone; any newly-added static asset extension may unexpectedly trigger proxy logic. Watch for this when adding fonts/icons.
- **Curated ORDER vs alphabetical.** `/api/case-studies` and `/llms-full.txt` each maintain an explicit curated order (Neev → VeriCite → Bluehost → curat.money → ClusterBid), not alphabetical. A case study omitted from either list is silently filtered out; update both when adding one.
- **OpenAPI spec is hand-maintained.** Not generated from route scans (the deliberate call in `lib/openapi-spec.ts:1`). Add new API paths to `lib/openapi-spec.ts`; update the API catalog linkset when a new discovery resource should be advertised. `app/api/openapi.json/route.ts` is only the response/cache wrapper.
- **`/about` and `/services` Markdown handlers are intentionally deferred.** Those sections live on the home composite, not standalone pages. They surface in `/llms-full.txt` so corpus completeness still holds; revisit if either promotes to its own page.

## Out of scope

- Content Signals authoring (`Content-Signal:` policy) — declared in `app/robots.txt/route.ts`; revisit only if the maximally-open `ai-train=yes` policy changes.
- Agent Skills index at `/.well-known/agent-skills/index.json` — referenced by the API catalog but built by `scripts/build-agent-skills-index.ts` at `prebuild`; that pipeline deserves its own primer if it grows.
- MCP tool implementation is out of this primer's detailed scope. `/api/mcp` and site/scanner-specific `/.well-known/mcp.json` now exist; the discovery document labels the release candidate `ready-pending-rate-limit` until the production WAF receipt is complete. Do not describe it as live. OAuth protected-resource metadata (RFC 9728) remains out of scope because the site has no authenticated endpoints.
- The MDX loader itself — see `mdx-content-pipeline` primer.

## Notes

- ADR-0003 fixes the canonical URL at `https://akaushik.org`; the API catalog, OpenAPI servers entry, and corpus wrappers all hard-code this string. Any domain change must grep all three.
- AGENT_READINESS doc is sourced from secondary reporting on Cloudflare's launch — `isitagentready.com` direct fetches were proxy-blocked at authoring time. Before declaring a check passing, run the live scanner against the deployed URL and reconcile any deltas back into the doc.
