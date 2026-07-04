# Agent Readiness — Alignment Spec

**Status:** Draft v0.1 (review)
**Author:** Claude (synthesis from Cloudflare's Agent Readiness score + related open standards)
**Last updated:** 2026-04-19
**Companion to:** `PRD.md` (this spec is a hard requirement, not a nice-to-have)

---

## 1. Why this doc exists

Cloudflare shipped **isitagentready.com** during Agents Week 2026. It scores sites along four dimensions — Discoverability, Content, Bot Access Control, Capabilities — against emerging agent standards (robots.txt, Content Signals, llms.txt, Markdown content negotiation, Link headers, API Catalogs, OAuth, MCP, Agent Skills). Most of the web is not aligned: only ~4% of sites declare AI preferences, ~3.9% support Markdown content negotiation, fewer than 15 expose API Catalogs.

For a portfolio whose thesis is *"AI engineer building agent systems that go to production"*, a low Agent Readiness score is a credibility leak. The portfolio must score high because it would be embarrassing if it didn't. This doc is the implementation contract.

**Target:** pass every applicable check on isitagentready.com at launch. Treat a failed check the way we treat a failed Lighthouse accessibility audit — a ship-blocker, not a future improvement.

**Note on sourcing.** Direct fetches of `isitagentready.com` and `blog.cloudflare.com/agent-readiness/` were blocked by the environment's egress proxy, so this spec is reconstructed from Cloudflare's public announcement (via search snippets), the underlying open standards themselves (RFCs + agentskills.io + contentsignals.org + modelcontextprotocol.io), and cross-referenced secondary reporting. Key paths have been verified against multiple sources. Before v1 launch, Abhishek should run the actual `isitagentready.com` scanner against the deployed site — or better, invoke its `scan_site` MCP tool at `https://isitagentready.com/.well-known/mcp.json` from a local MCP client — and reconcile any deltas back into this doc.

**Useful upside of the tool:** for each failing check, `isitagentready.com` emits an **actionable prompt** we can paste into a coding agent to implement the fix. We should capture those prompts as the first run output and fold them into the EPM progress log so the implementation is auditable.

---

## 2. The four dimensions, summarized

| Dimension | What Cloudflare's tool looks at | Our strategy |
| --- | --- | --- |
| Discoverability | `robots.txt`, `sitemap.xml`, HTTP `Link` headers, `/.well-known/` endpoints | Ship all of them, wired correctly |
| Content | Markdown content negotiation (`Accept: text/markdown`), `/llms.txt`, `/llms-full.txt` | First-class Markdown variant per page + well-formed `llms.txt` |
| Bot Access Control | Content Signals (`Content-Signal:` in `robots.txt`), AI-bot user-agent rules | Publish an opinionated, permissive-but-clear policy |
| Capabilities | Agent Skills, API Catalogs (RFC 9727), OAuth (RFC 9728), MCP server cards | Ship a narrow surface — the portfolio's "API" is modest, but we expose it properly |

The tool also checks **agentic commerce standards** (payment primitives, stored credentials, etc.). Those don't affect the score yet. They're out of scope for this site.

---

## 3. Discoverability — required implementations

### 3.1 `robots.txt`

Served at `/robots.txt`. Must:

- Declare at least one `User-agent` block.
- List allowed/disallowed paths intentionally (no catch-all `Disallow: /`).
- Reference the sitemap.
- Carry Content Signals (see §5.1).

Starter content — refine during implementation:

```
User-agent: *
Allow: /

# Content Signals Policy (contentsignals.org)
Content-Signal: search=yes, ai-train=yes, ai-input=yes

Sitemap: https://<canonical-domain>/sitemap.xml
```

The signal values above reflect the portfolio's intent: this content exists to be found by search, indexed by AI, and used as AI input. Abhishek should confirm he wants `ai-train=yes` — it's the maximally-open position and aligns with the portfolio's sales function, but the call is his.

### 3.2 `sitemap.xml`

Served at `/sitemap.xml`. Must enumerate every canonical URL (home, case-study index, each case-study detail page, writing index, each post, services, contact, about, process page).

Next.js 16 has built-in sitemap generation via `app/sitemap.ts` — use it. Auto-regenerate on MDX post add/remove. Include `<lastmod>`, `<changefreq>` and `<priority>` for each URL.

### 3.3 HTTP `Link` headers (RFC 8288)

This is the agent-specific discoverability channel. Agents read response headers before parsing HTML. On **every HTML response**, emit:

```
Link: </llms.txt>; rel="describedby"; type="text/markdown"
Link: </llms-full.txt>; rel="describedby"; type="text/markdown"
Link: </.well-known/api-catalog>; rel="api-catalog"
Link: </sitemap.xml>; rel="sitemap"
```

Plus, for any page that has a Markdown variant (see §4.1), advertise it:

```
Link: </case-studies/neev.md>; rel="alternate"; type="text/markdown"
```

Implementation: set these in `next.config.ts` `headers()` or in middleware. Prefer middleware so per-page `alternate` links can be computed.

### 3.4 `/.well-known/` endpoints

The `/.well-known/` prefix is reserved (RFC 8615) for machine-discoverable metadata. Ship at minimum:

- `/.well-known/api-catalog` — see §6.1 (RFC 9727).
- `/.well-known/agent-skills/index.json` — agent-skills discovery index (Cloudflare Agent Skills Discovery RFC; see §6.4).
- `/.well-known/oauth-protected-resource` — only if we expose any authenticated capability (probably not in v1; document intent in a placeholder so the absence is explicit rather than implicit).
- `/.well-known/mcp.json` — MCP server card if and when we ship one (see §6.3). `isitagentready.com` itself exposes its server at this path — we match the convention. The spec is in flight (SEP-1649 and SEP-1960 both propose related `/.well-known/` layouts); we mirror what the Cloudflare scanner actually checks for today.

Also ensure `/favicon.ico`, `/apple-touch-icon.png`, `/manifest.webmanifest` are present — not agent-specific, but signals site hygiene.

---

## 4. Content — required implementations

### 4.1 Markdown content negotiation

The highest-signal check. Every content page (home, about, case studies, writing posts, services, contact) must respond with **Markdown** when the client sends `Accept: text/markdown`.

Two patterns, both acceptable — we use both:

**Pattern A — content negotiation at the same URL.** A middleware inspects `Accept` and returns the MDX-source (or a Markdown projection) instead of the rendered HTML. Keeps URL parity. More complex in Next.js' App Router.

**Pattern B — `.md` suffix convention.** `/case-studies/neev` renders HTML; `/case-studies/neev.md` returns raw Markdown. Simpler to ship in Next.js (just a parallel route or a catch-all). Advertise via `Link: rel="alternate"; type="text/markdown"`.

We ship **both**. Pattern A for agents that only send `Accept`. Pattern B for agents that follow `Link` alternates and for human-readable deep links.

Implementation notes for Next.js 16:

- MDX is already the post format — reuse the raw frontmatter-stripped MDX as the Markdown payload.
- Case study pages: source `.mdx` files live under `content/case-studies/`. Render a Markdown endpoint at `app/case-studies/[slug]/route.md.ts` (or equivalent) returning `text/markdown; charset=utf-8`.
- Cache-control: same as the HTML page.
- Ensure both variants are linked from the sitemap *or* at minimum referenced in `llms.txt` (below).

### 4.2 `/llms.txt`

Served at `/llms.txt` with `Content-Type: text/markdown; charset=utf-8`. Follows the llmstxt.org format:

- H1 with the site/project name (**required**).
- Blockquote summary under the H1.
- Optional prose.
- H2 sections with link lists, each link formatted `- [Title](url): short description`.

Starter content — refine before launch:

```markdown
# Abhishek Kaushik — Portfolio

> Personal portfolio of Abhishek Kaushik, an AI engineer building agent
> systems for production. This file indexes the content on the site
> for LLM/agent consumption; all content pages also serve clean Markdown
> on Accept: text/markdown.

Abhishek is an AI engineer with six years of experience, currently working
on the agents-framework backend behind Bluehost's AI products. He is also
building Neev, an operations platform for Indian MSMEs.

## About

- [About](https://<domain>/about.md): long-form bio and background
- [Services](https://<domain>/services.md): engagement archetypes and scope

## Case Studies

- [Neev](https://<domain>/case-studies/neev.md): modular operations platform for Indian MSMEs
- [VeriCite](https://<domain>/case-studies/vericite.md): institutional RAG system, Fastembed→TEI migration, Qdrant
- [Bluehost agents framework](https://<domain>/case-studies/bluehost-agents.md): production agent platform behind Bluehost AI products
- [curat.money](https://<domain>/case-studies/curatmoney.md): crypto-card comparison platform with K8s pipeline

## Writing

- [Writing index](https://<domain>/writing.md): all posts
- [(post URLs auto-enumerated by the build)]

## Contact

- [Contact](https://<domain>/contact.md): how to reach me about a project
```

Regenerate on build (`scripts/generate-llms-txt.ts`) so new writing posts land automatically.

### 4.3 `/llms-full.txt`

Served at `/llms-full.txt` with `Content-Type: text/markdown; charset=utf-8`. This is the *full concatenated corpus* of the site — every case study, every post, the About, Services — inlined so an agent can grab the whole thing in one request.

Generate at build time from the MDX sources:

```
# Abhishek Kaushik — Portfolio (full content)

> Single-file concatenation of all portfolio content. Build timestamp: ...

---

<about>
...
</about>

---

<case-study slug="neev">
...
</case-study>

---

<case-study slug="vericite">
...
</case-study>

... etc.
```

Use MDX → Markdown serialization with frontmatter stripped and with `<section>` wrappers that agents can pattern-match on. Advertise in the `Link` header (§3.3) with `rel="describedby"`.

### 4.4 Content structure for agent consumption

Inside the MDX sources themselves, make them agent-friendly:

- Use **semantic headings**. No heading-jumping (H1 → H3 skipping H2).
- Put the **one-line summary** at the top of every case study and every post, immediately after the H1 — as a blockquote or first paragraph. Agents often truncate; give them the essence up top.
- **Tables for structured data** (e.g., Tech stack tables in case studies) are better than comma-prose for agents.
- **Name specific things**: models, services, versions. Agents are specificity-sensitive.

---

## 5. Bot Access Control — required implementations

### 5.1 Content Signals in `robots.txt`

The Content Signals policy (contentsignals.org) is the emerging standard for expressing AI-usage preferences inside `robots.txt`. Three signals, each with value `yes`, `no`, or omitted (neutral):

- **search** — allow content in traditional search indexes and snippets.
- **ai-input** — allow content as inference-time context (RAG grounding, answer generation).
- **ai-train** — allow content as training data.

Syntax: `Content-Signal: search=<yes|no>, ai-train=<yes|no>, ai-input=<yes|no>` as a directive alongside `User-agent` blocks.

For the portfolio, recommended policy: `Content-Signal: search=yes, ai-train=yes, ai-input=yes`. Rationale — this content is a sales asset. Every AI agent that ingests it is a downstream reader we wanted to reach. Abhishek should confirm, particularly on `ai-train=yes`; this is the intentional-openness stance.

### 5.2 AI-bot user-agent rules

Beyond Content Signals, isitagentready.com also checks whether `robots.txt` has considered major AI crawlers as named user-agents (GPTBot, ClaudeBot, Google-Extended, Bingbot, PerplexityBot, etc.). Recommendation: a single `User-agent: *` block with open Allow — no per-bot blocking unless we have a reason. This is the simplest pass.

If Abhishek later wants to block specific AI bots for any reason, add named `User-agent:` blocks *above* the wildcard. We document the list in a comment so future-us remembers the policy intent.

### 5.3 Rate-limiting & abuse surface

Vercel edge platform provides baseline DDoS and rate-limit handling. We don't add custom bot-blocking WAF rules in v1 — the portfolio's content is meant to be read.

---

## 6. Capabilities — required implementations

### 6.1 API Catalog (RFC 9727)

Served at `/.well-known/api-catalog`, JSON. Even for a content site, an API catalog signals that the site has thought about agent integration.

The portfolio's API is modest. Propose:

```json
{
  "apis": [
    {
      "name": "Portfolio content API",
      "description": "Read-only access to portfolio content in Markdown.",
      "links": {
        "self": "https://<domain>/.well-known/api-catalog",
        "service-doc": "https://<domain>/api/docs",
        "service-desc": "https://<domain>/api/openapi.json"
      }
    }
  ]
}
```

Accompany with an **OpenAPI 3.1 spec** at `/api/openapi.json` describing:

- `GET /llms.txt` → `text/markdown`
- `GET /llms-full.txt` → `text/markdown`
- `GET /{path}` with `Accept: text/markdown` → `text/markdown`
- `GET /{path}.md` → `text/markdown`
- `GET /api/writing` → JSON list of posts (for agents that prefer structured enumeration)
- `GET /api/case-studies` → JSON list of case studies

The JSON endpoints are a small addition. Next.js route handlers; cheap to ship.

Human-readable docs at `/api/docs` — a simple rendered page from the OpenAPI spec.

### 6.2 OAuth Protected Resource Metadata (RFC 9728)

Skip in v1 — the site has no authenticated endpoints. Document the omission explicitly so an auditor knows it's intentional. If we ever add "Book a call" with a calendar integration or a client portal, revisit.

### 6.3 MCP Server Card

The portfolio does not expose an MCP server in v1. We *could* ship a small read-only MCP server that exposes `list_case_studies`, `read_case_study`, `list_posts`, `read_post` as tools — a low-effort implementation using the Cloudflare Workers + MCP reference architecture, deployed to Cloudflare (not Vercel).

Recommendation for v1: **out of scope, stubbed for v1.1**. Document the shape of the future MCP server in this file so we can ship it as a v1.1 announcement (good blog-post fodder: "the portfolio's MCP server").

### 6.4 Agent Skills

Agent Skills (agentskills.io) is the emerging standard for packaged agent capabilities (folder with `SKILL.md` + optional scripts/templates). isitagentready.com checks whether a site publishes skills.

For v1, ship **one Agent Skill** in the repo at `content/agent-skills/portfolio-content/SKILL.md` and expose it via the Agent Skills discovery index at `/.well-known/agent-skills/index.json`.

The discovery index follows the v0.2.0 schema from the Cloudflare Agent Skills Discovery RFC (schema URI: `https://schemas.agentskills.io/discovery/0.2.0/schema.json`). Each entry requires `$schema`, `name`, `description`, `type` (`"skill-md"` for a single-file skill, `"archive"` for a bundled skill), `url` (fully-qualified location of the skill artifact), and `digest` (content hash for integrity). Clients must switch on `$schema` to determine index compatibility — **do not mix v0.1.0 and v0.2.0 fields**.

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "portfolio-content",
      "description": "Fetch Markdown content from Abhishek Kaushik's portfolio — case studies, writing, about, services.",
      "type": "skill-md",
      "url": "https://<canonical-domain>/agent-skills/portfolio-content/SKILL.md",
      "digest": "sha256:<computed-at-build-time>"
    }
  ]
}
```

Compute the `digest` at build time (a `scripts/build-agent-skills-index.ts` pass) so the integrity hash is always in sync with the SKILL.md content.

The SKILL.md body itself:

```markdown
---
name: portfolio-content
description: Fetch Markdown content from Abhishek Kaushik's portfolio — case studies, writing, about, services.
---

# Portfolio Content Skill

This skill helps agents fetch content from Abhishek's portfolio.

## Fetching pages
- `llms.txt` at `/llms.txt` lists all content URLs.
- `llms-full.txt` at `/llms-full.txt` contains the entire site as concatenated Markdown.
- Every HTML page has a `.md` alternate at the same path with `.md` appended (e.g., `/case-studies/neev` → `/case-studies/neev.md`).
- Every page responds to `Accept: text/markdown` with the Markdown variant.

## Content types
- Case studies: under `/case-studies/{slug}`
- Writing: under `/writing/{slug}`
```

Minimum bar; we iterate the skill once the site content is in place.

---

## 7. Concrete Next.js implementation map

| Requirement | File / code location |
| --- | --- |
| `robots.txt` | `app/robots.txt/route.ts` (Route Handler with direct `Content-Signal` directive control) |
| `sitemap.xml` | `app/sitemap.ts` |
| `Link` headers on all HTML responses | `proxy.ts` |
| `/llms.txt` | `app/llms.txt/route.ts` |
| `/llms-full.txt` | `app/llms-full.txt/route.ts` (built from MDX at request time with caching, or prebuilt at `build` step) |
| `.md` alternates for pages | `app/work/[slug]/md/route.ts` and `app/writing/[slug]/md/route.ts` |
| `Accept: text/markdown` negotiation | `proxy.ts` rewrites to `.md` endpoint when `Accept` matches |
| `/.well-known/api-catalog` | `app/.well-known/api-catalog/route.ts` |
| `/api/openapi.json` | `app/api/openapi.json/route.ts` (generated from a schema file committed in repo) |
| `/api/docs` | `app/api/docs/page.tsx` (server-rendered React; reads `lib/openapi-spec.ts`; no client JS — Redoc/Swagger UI dropped on bundle-budget grounds) |
| `/.well-known/agent-skills/index.json` | `app/.well-known/agent-skills/index.json/route.ts` (emits v0.2.0 schema; `digest` computed at build) |
| `content/agent-skills/portfolio-content/SKILL.md` | Skill artifact itself, served at `/agent-skills/portfolio-content/SKILL.md` |
| Content Signals | embedded in `app/robots.txt/route.ts` output |

All of the above is implementable in under a day of focused work once the scaffold is up.

---

## 8. Validation plan

Three layers, mirroring how we handle accessibility and performance:

1. **Build-time unit tests.** Snapshot the generated `robots.txt`, `/llms.txt`, `/llms-full.txt`, `/.well-known/api-catalog`, and the `/api/openapi.json`. Fail the build if any of them loses a required field.
2. **Preview-deploy check.** After every Vercel preview, a CI script curls each canonical URL with `Accept: text/markdown`, `Accept: text/html`, and `Accept: application/json` variants and asserts the expected content type. Also curls `.md` alternates and asserts they're Markdown.
3. **External validation — two paths.**
   - **Web UI:** run `isitagentready.com` against the live URL after every production deploy. Persist a dated screenshot of the report in `docs/agent-readiness-snapshots/YYYY-MM-DD.png`.
   - **Programmatic via the tool's own MCP server:** `isitagentready.com` exposes a stateless MCP server at `https://isitagentready.com/.well-known/mcp.json` with a `scan_site` tool over Streamable HTTP. Wire this into the deploy gate so the latest score and any newly-failed checks are captured as JSON in CI artifacts. This is the version we trust as a regression gate; the screenshot is for the changelog.

Also cross-check with the **Cloudflare URL Scanner's Agent Readiness tab** as an independent verification.

---

## 9. Process-gate additions

Add to the PRD's process-gate script (`scripts/check-docs.sh` or equivalent):

- Reject a release candidate if `app/robots.txt/route.ts` doesn't emit a `Content-Signal` directive.
- Reject if `app/llms.txt/route.ts` output fails the llmstxt.org format check (has H1, has blockquote, has at least one H2 section with link list).
- Reject if `proxy.ts` doesn't emit the required `Link` headers.
- Reject if `app/sitemap.ts` is missing.

This keeps agent-readiness regressions from merging unnoticed.

---

## 10. Out of scope (for v1, with rationale)

- **MCP server.** Implementable in a day but adds a second deploy target (Cloudflare Workers). Deferred to v1.1 so v1 can ship cleanly.
- **OAuth-protected endpoints.** Nothing to protect yet.
- **Agentic commerce primitives.** The portfolio doesn't transact. Not checked against the score anyway.
- **Multi-language `llms.txt` variants.** If we add Hindi/Devanagari copy in v1.1, we ship `llms.hi.txt` at that point.

---

## 11. Open questions for Abhishek

- **Q1. `ai-train=yes`?** The recommendation is yes for a portfolio (it's marketing content). Confirm, or we set `ai-train=no`.
- **Q2. MCP server in v1 or v1.1?** Low effort, high signal — but splits deploy targets. My recommendation: v1.1 as a launch follow-up.
- **Q3. Is the modest API catalog worth it for a content-only site?** I say yes because the score depends on it, and it's cheap. Confirm the scope (a `/api/writing` and `/api/case-studies` read-only JSON surface alongside the Markdown endpoints).
- **Q4. Do we publish `/llms-full.txt` as the entire corpus including writing posts, or only the "evergreen" content (About, Services, Case Studies)?** Recommendation: include everything; writing is a core asset.

---

## 12. References

### 12.1 Primary sources (Cloudflare)

- Cloudflare announcement (Agents Week 2026): `https://blog.cloudflare.com/agent-readiness/`
- The tool itself: `https://isitagentready.com/`
- Tool MCP server (for programmatic scans): `https://isitagentready.com/.well-known/mcp.json` (`scan_site` tool via Streamable HTTP)
- Tool Agent Skills index: `https://isitagentready.com/.well-known/agent-skills/index.json`
- Content Signals announcement: `https://blog.cloudflare.com/content-signals-policy/`
- Agent Skills Discovery RFC (repo): `https://github.com/cloudflare/agent-skills-discovery-rfc`

### 12.2 Open standards

- RFC 8288 — Web Linking (the `Link` response header)
- RFC 8615 — Well-Known Uniform Resource Identifiers (`/.well-known/`)
- RFC 9727 — `api-catalog` Well-Known URI and Link Relation
- RFC 9728 — OAuth 2.0 Protected Resource Metadata
- `https://llmstxt.org/` — `llms.txt` / `llms-full.txt` format
- `https://contentsignals.org/` — Content Signals policy (`search` / `ai-input` / `ai-train`)
- `https://agentskills.io/specification` — Agent Skills format
- `https://schemas.agentskills.io/discovery/0.2.0/schema.json` — Agent Skills discovery index schema
- `https://modelcontextprotocol.io/` — MCP

### 12.3 PRD integration note

The PRD references this spec as §7 "Engineering Principles — Agent readiness." The relevant bullet is already updated to point at this file. Any further additions to this spec must be reflected in the PRD §7 bullet or cross-indexed so a reader of the PRD knows the full implementation contract lives here.
