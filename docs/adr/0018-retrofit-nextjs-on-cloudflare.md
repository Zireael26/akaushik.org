# ADR-0018 — Retrofit Next.js 16 on Cloudflare via OpenNext, not an Astro rewrite

**Status:** Accepted · 2026-08-22
**Supersedes:** the framework half of ADR-0001 (`docs/adr/0001-nextjs-over-sveltekit.md`)
**Author:** Abhishek Kaushik, with Claude

## Context

The pixel transplant (spec 004) replaces the entire presentation layer of `akaushik.org` with the pixel design authored for `gaurijha.com` (`design-refs/design.md`, tag `public-site-v1`). That design shipped as Astro with vanilla-TS canvas islands, so an Astro rewrite was the obvious first instinct. It was investigated before any presentation code was ported.

The site also has a second goal that landed in the same spec: move hosting from Vercel to Cloudflare Workers, alongside `evals.akaushik.org` on the same account. The hosting decision and the framework decision are coupled, because the agent-readiness surface lives in framework code.

That surface is load-bearing. `proxy.ts` is Next 16 edge middleware — Next 16's renamed `middleware.ts` — and it carries the whole contract verified in `docs/AGENT_READINESS.md`:

1. RFC 8288 `Link` headers on every response that passes the proxy's matcher — `lib/agent-discovery.ts:5–9` defines `describedby` for Agent Skills and MCP (both `application/json`), `api-catalog` for `/.well-known/api-catalog` (`application/linkset+json`), `service-desc` for `/api/openapi.json` (`application/json`) and `service-doc` for `/api/docs` (`text/html`), alongside `describedby` for `/llms.txt`/`/llms-full.txt` and `sitemap` for `/sitemap.xml`.
2. Markdown content negotiation: both patterns from ADR-0006 — Pattern B (`.md` suffix) and Pattern A (`Accept: text/markdown` preferred, including the home → `llms.txt` rewrite).
3. The ADR-0014 nonce CSP: a per-request `btoa(crypto.randomUUID())` nonce, `script-src 'self' 'nonce-…' 'strict-dynamic'`, set on both the request headers (so Next stamps its own inline hydration scripts) and the response.

The question was whether to keep that file where it is or rebuild it. Under Astro, `proxy.ts` would have to be re-implemented as Worker logic outside the framework, and the nonce CSP would need an `HTMLRewriter` pass over every HTML response or a move to hash-based CSP. The original `proposal` had already rejected hash-based CSP as impractical for the `self.__next_f.push(...)` streaming scripts (ADR-0014).

The investigation found that the retention path is viable. `@opennextjs/cloudflare` supports all minor and patch versions of Next.js 16, including Turbopack builds, edge middleware, ISR and image optimization, and Next 16.2 shipped a stable Adapter API built with Cloudflare. Cloudflare's own guidance is that Workers now has parity with Pages for static assets, SSR, and custom domains. The load-bearing fact for this ADR is that OpenNext supports edge middleware, so `proxy.ts` can stay as Next 16 edge middleware without a Worker rewrite.

The alternative cost is not in the design layer. Porting the pixel engines and re-authoring the law-specific art costs the same on either path — the engines are `lib/scenes/*.ts` mounts behind thin React wrappers, and the art is one drawing function per exhibit. The difference is entirely in what is put at risk. Retrofitting keeps roughly 2,000 lines of agent-surface machinery and roughly 3,950 lines of tests exactly where they are. Rewriting puts at risk the site's thesis: that an agent can discover `llms.txt`, `llms-full.txt`, `/.well-known/*`, the MCP endpoint, and every `.md` alternate without parsing the DOM.

## Decision

Retrofit **Next.js 16** with App Router, React 19, TypeScript 6, and Turbopack, and deploy via **`@opennextjs/cloudflare`** to Cloudflare Workers, rather than rewriting the site in Astro.

Concretely:

- Keep `proxy.ts` as the Next 16 edge middleware. No Worker-level reimplementation, no `HTMLRewriter` nonce pass, no hash list. The implementation stays unchanged and OpenNext supports edge middleware, so the file is intended to continue emitting the RFC 8288 `Link` headers, both content-negotiation rewrites, and the nonce CSP through the adapter — with adapter-level equivalence pending the P1 spike verification (tasks T06–T07). The `proxy.ts` matcher excludes `/_next/static` and `/_next/image` (not all `/_next/*`) and the MCP route that must bypass the proxy path (ADR-0015).
- Keep the entire agent-discoverability surface untouched: MCP server (`lib/mcp*`, `pages/api/mcp.ts`), `app/llms*`, `app/sitemap.ts`, `app/robots.txt`, `public/.well-known/*`, `lib/content.ts`, `lib/structured-data.ts`, `lib/pixel/**`, and every `app/**/md/route.ts` handler. The transplant is a presentation-layer replacement only (spec 004 §Constraints).
- Adopt the Cloudflare Worker as the production origin. The adapter handles static assets, SSR, middleware, and custom domains. The Vercel project is paused, not deleted, for 14 days after the domain cutover, per the spec's success criteria.
- Do not add Astro, do not introduce an Astro island bridge, and do not carry two frameworks in the repository. The design's Astro source remains a reference (the `public-site-v1` tag) for the pixel language, not a runtime.

This ADR supersedes only the framework selection in ADR-0001 (`0001-nextjs-over-sveltekit.md`). That ADR's SvelteKit-vs-Next.js choice was correct for the v2 rewrite from `developerabhishek.live`; the choice to stay on Next.js is reaffirmed here on different grounds (edge-middleware preservation and Cloudflare deployability). The dependency-baseline half of ADR-0001 (`0001-framework-dependency-baselines.md`), the process-gate policy in ADR-0002, and the canonical-host decision in ADR-0003 are unaffected.

Deployment is not claimed complete in this ADR. The P1 spike — deploying the site as-is to a preview Worker and verifying `next/og` image routes, the nonce CSP, and both content-negotiation patterns through the adapter — is still blocked pending an operator-minted Workers-scoped API token (plan §1, tasks T04–T08). An ADR records a decision, not a receipt.

## Consequences

**Positive**

- The agent-readiness contract is intended to stay byte-identical in behaviour. `e2e/content-negotiation.spec.ts` and the homepage Link-header case in `e2e/agent-readiness.spec.ts` continue to exercise the same `proxy.ts` code they covered before; `lib/mcp*.test.ts` and `e2e/mcp.spec.ts` preserve the independently implemented, proxy-bypassing MCP contract at `pages/api/mcp.ts` (ADR-0015) which the proxy matcher deliberately excludes. The implementation is unchanged and OpenNext supports edge middleware, with adapter-level equivalence pending preview-Worker verification (tasks T06–T07) before an `isitagentready.com` scan can reconcile with `docs/AGENT_READINESS.md` as a receipt.
- No new CSP machinery. The `headers()` read in `app/layout.tsx` that opts HTML routes into dynamic rendering and the `x-nonce` forwarding that lets `next/script` stamp the Cloudflare beacon both survive unchanged.
- Authoring friction stays low. Content remains 13 writing posts and 5 case studies under `content/`, with the same `lib/content.ts` frontmatter parser and `next-mdx-remote/rsc` server-only compilation from ADR-0004. Writers do not learn a content-collection API to keep shipping.

**Negative**

- The site stays on Next.js's App Router and its per-request rendering cost for nonce'd HTML routes. The ADR-0014 tradeoff (dynamic rendering for HTML, higher TTFB, no CDN static caching on those routes) is carried forward rather than revisited.
- The bundle keeps `next` and `react` in the client graph. The pixel design replaces `three` with canvas islands, but the framework weight is not reduced by this decision. Future bundle work must still defend the `docs/BUNDLE_BUDGET.md` budget.
- Preview ergonomics downgrade. `wrangler versions upload` per version replaces Vercel's per-PR preview URLs until CI wiring for Workers previews lands.

**Neutral**

- `@opennextjs/cloudflare` is the deploy adapter, not a framework migration. Local development stays `next dev --turbo` on the same port and host; only the production build target changes.
- The Astro source for the pixel language remains useful as a design reference. Reading it with `git -C …/gaurijha.com show public-site-v1:<path>` is the fastest way to answer a fidelity question about a cell rule or ramp.
- Cloudflare credentials remain operator-scoped. The local shell `CLOUDFLARE_API_TOKEN` is zone-scoped and `wrangler` prefers it over OAuth, failing with a misleading account-lookup error; locally `env -u CLOUDFLARE_API_TOKEN` is required, and CI needs a dashboard-minted Workers-scoped token. This is an operator action and cannot be automated.

## Alternatives considered

**Rewrite the site in Astro with the pixel design as the native target.**

Rejected. The design fidelity is not the differentiator — the engines port cleanly either way (P3 reuses `h(x, y)`, the cell rule, and the heat decay without change). The differentiator is `proxy.ts`. Rebuilding it as Worker logic means re-proving RFC 8288 header composition, both negotiation patterns, the CSP nonce pipeline, and the `Link: rel=canonical` preservation on rewrites that `e2e/content-negotiation.spec.ts` currently guards. The nonce path would also require choosing between an `HTMLRewriter` streaming transform and a hash-based CSP that was already rejected for the 26-plus `self.__next_f.push(...)` streaming scripts per page. The retrofit keeps roughly 2,000 lines of machinery and 3,950 lines of tests where their existing coverage applies; the rewrite repays that proof for no design gain.

**Keep Vercel as the origin and adopt Cloudflare only for DNS.**

Rejected on the hosting goal. The spec moves the Worker alongside `evals.akaushik.org` on the same account so one place owns static assets, SSR, and custom domains. Workers parity for assets/SSR/domains (per Cloudflare's own guidance) removes the reason to keep two origins.

**Vendor `proxy.ts` into a standalone Worker and keep Astro for pages.**

Rejected for the same reason as a full rewrite, plus an additional seam. Splitting the request path into a Worker shim plus an Astro SSR origin creates two places where headers can be dropped or reordered. The current `buildResponseHeaders` / `applyHeaders` layering in `proxy.ts` is subtle about `Link` header appending versus clobbering and about canonical preservation on rewrites; duplicating that layering across a Worker boundary doubles the surface for header-suppression bugs.

## Status

Accepted 2026-08-22. Supersedes only the framework selection in ADR-0001. The P1 Worker spike (preview deploy, `next/og`, nonce, and negotiation verification) and the final DNS cutover are tracked in `specs/004-pixel-transplant/tasks.md` (T04–T08, T34) and are not claimed here.
