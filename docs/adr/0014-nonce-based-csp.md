# ADR-0014 — Nonce-based CSP (drop script-src 'unsafe-inline')

**Status:** Accepted, 2026-07-13. Supersedes the CSP decision in ADR-0013 (§Decision, T7).
**Context:** Post-audit follow-up. ADR-0013 shipped a production CSP with `script-src 'self' 'unsafe-inline' …` and explicitly deferred a nonce pipeline to "a future ADR if warranted." The operator chose to build it now, with full knowledge of the tradeoff below.
**Author:** Claude (orchestrator) + gpt-5.6-sol (implementation).

## Context

The T7 CSP used `'unsafe-inline'` for `script-src` because Next 16's App Router injects inline hydration scripts and there was no nonce infrastructure. Two paths could remove `'unsafe-inline'`:

1. **Hash-based CSP** — enumerate `'sha256-…'` for every inline script. Rejected: the prerendered HTML carries ~26 inline `self.__next_f.push(...)` RSC-streaming scripts whose content varies per page and per build. Hashing them is impractical and fragile.
2. **Nonce-based CSP** — a per-request nonce on every inline script. This is the Next-recommended pattern, but a per-request value **cannot exist in statically-generated HTML**, so it opts the affected pages into **dynamic rendering**.

The site's actual XSS surface is small: no user input reaches the DOM (no forms, no `searchParams`/`formData` rendering), MDX is authored-only, and the single `dangerouslySetInnerHTML` (`components/seo/JsonLdScript.tsx`) emits escaped JSON-LD. So the marginal security gain was weighed against a real SSG/caching regression and surfaced to the operator, who accepted it.

## Decision

Implement the Next.js middleware nonce pattern in `proxy.ts`:

- Generate a fresh nonce per request (`btoa(crypto.randomUUID())`).
- Production CSP `script-src` becomes `'self' 'nonce-<nonce>' 'strict-dynamic' https://static.cloudflareinsights.com` — no `'unsafe-inline'`. `'strict-dynamic'` lets the nonced bootstrap load the async chunk scripts; the Cloudflare host stays as a fallback for non-`strict-dynamic` browsers.
- `style-src` **keeps** `'unsafe-inline'` (Next injects inline styles; nonce-ing styles is not automatic and would break styling — out of scope, lower risk).
- On the main HTML path, the nonce and CSP are set on both the **request** headers (so Next stamps the nonce onto its own inline scripts) and the **response** headers. The Pattern A/B markdown rewrites and discovery/security headers are unchanged.
- `app/layout.tsx` reads the nonce via `headers()` and passes it to the two manually-authored scripts (`/init-theme.js` and the Cloudflare `next/script` beacon — Next's auto-nonce does not reach the `afterInteractive` beacon).

## Consequences

- **Tradeoff accepted:** `/`, `/work/[slug]`, `/writing`, `/writing/[slug]` are now **dynamically rendered** (`headers()` in the layout opts them out of static generation) — higher TTFB, no CDN static caching, more per-request compute. The `.md` route handlers remain SSG. This is the deliberate cost of removing `'unsafe-inline'`.
- No inline script can execute without the per-request nonce; XSS-injected inline scripts are blocked even though no current injection vector exists (defense-in-depth).
- Verified against a production build + real headless-Chromium render over four routes: **0 CSP violations, 0 hydration errors**, every inline script carries the nonce, `script-src` has no `'unsafe-inline'`, the home AgentGraph canvas mounts (client JS executes → hydration intact), and the nonce differs across requests.
- Rollback: revert this ADR's commit; the T7 `'unsafe-inline'` baseline (ADR-0013) returns and pages go back to SSG.
