/**
 * The agent-readiness contract, as pure functions over plain values.
 *
 * This used to live entirely in `proxy.ts` as Next middleware. It was pulled
 * out because the site has two runtimes now and they cannot share a middleware
 * implementation:
 *
 *   - `next dev` / `next start` run `proxy.ts`, which Next 16 executes in the
 *     Node runtime. (Next 16 renamed `middleware.ts` to `proxy.ts` and removed
 *     the edge runtime option for it — `runtime: 'edge'` is rejected outright.)
 *   - Cloudflare Workers run `worker/index.ts`, because
 *     `@opennextjs/cloudflare` supports edge middleware only and refuses to
 *     build a project with Node middleware in it.
 *
 * Two adapters, one contract. Everything that decides *what* the contract is
 * lives here and is unit-tested; the adapters are thin enough to read in one
 * sitting and contain no policy. If you are changing behaviour, change it in
 * this file — a change made in only one adapter is a bug by construction.
 *
 * The contract itself:
 *
 *   1. RFC 8288 `Link` headers on every response, so a crawler discovers
 *      llms.txt / llms-full.txt / sitemap / agent-skills / mcp / api-catalog
 *      without parsing the DOM. The `describedby` + `sitemap` rels are the
 *      IANA-registered shapes per AGENT_READINESS §3.3; the remaining three
 *      use `describedby` with distinct MIME types rather than inventing
 *      schema.org or modelcontextprotocol.io relation URIs.
 *   2. Markdown content negotiation (AGENT_READINESS §4.1):
 *        Pattern B — `/work/<slug>.md` → `/work/<slug>/md`, same for writing
 *        Pattern A — `Accept: text/markdown` on `/work/<slug>` or
 *                    `/writing/<slug>` rewrites to the `/md` handler, and on
 *                    `/` rewrites to `/llms.txt`
 *      Pattern B is the safety net: `.md` literally appended is the shape the
 *      `isitagentready.com` probe uses. Pattern A is additive.
 *   3. A per-request nonce CSP (ADR-0014), passed inward on `x-nonce` and
 *      outward as `content-security-policy`.
 *   4. `X-Robots-Tag: noindex` on any host that is not canonical.
 */
import { AGENT_DISCOVERY_LINK_HEADER } from './agent-discovery';

/** Paths that have a `.md` alternate. Each needs an `/md/route.ts` handler. */
const MD_ALTERNATE_PREFIXES = ['/work/', '/writing/'] as const;

/** The only hosts that are the real site. Everything else is a preview. */
const CANONICAL_HOSTS = new Set(['akaushik.org', 'www.akaushik.org']);

export function securityHeaders(nonce: string): Record<string, string> {
  return {
    'content-security-policy': [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://static.cloudflareinsights.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'x-frame-options': 'DENY',
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  };
}

/**
 * Any host that is not the canonical one is a preview and must never be
 * indexed.
 *
 * A preview serving the same content as production is duplicate content: it
 * competes with the real site in search, and the damage outlives the preview,
 * because de-indexing takes far longer than indexing did. The canonical tags
 * already point at production, which is necessary but not sufficient — a
 * crawler still has to fetch and interpret the page to see them.
 * `X-Robots-Tag` is refused at the header, before any of that.
 *
 * Derived from the request host rather than an env var on purpose: an env var
 * is a thing someone can forget to set on a new preview, and the failure is
 * silent and expensive. A host cannot be forgotten.
 */
export function isPreviewHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const bare = host.toLowerCase().replace(/:\d+$/, '');
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare === '127.0.0.1') return false;
  return !CANONICAL_HOSTS.has(bare);
}

export function rewritePatternB(pathname: string): string | null {
  if (!pathname.endsWith('.md')) return null;
  if (!MD_ALTERNATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const base = pathname.slice(0, -'.md'.length);
  const parts = base.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  return `${base}/md`;
}

export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  const head = accept.split(',')[0]?.trim().toLowerCase() ?? '';
  return head.startsWith('text/markdown');
}

export function rewritePatternA(pathname: string): string | null {
  // Home → short-form digest. AGENT_READINESS §4.1: "every content page…
  // returns Markdown on Accept: text/markdown."
  if (pathname === '/' || pathname === '') return '/llms.txt';

  if (!MD_ALTERNATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  if (pathname.endsWith('/md')) return null;
  if (pathname.endsWith('.md')) return null;
  return `${pathname}/md`;
}

export function buildResponseHeaders(
  pathname: string,
  productionSecurityHeaders: Record<string, string>,
  preview: boolean,
): Headers {
  const headers = new Headers();
  if (preview) {
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  headers.set('Link', AGENT_DISCOVERY_LINK_HEADER);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  Object.entries(productionSecurityHeaders).forEach(([name, value]) => {
    headers.set(name, value);
  });
  // Advertise the sibling `.md` alternate for HTML content pages that have one.
  // Not on the `.md` path itself (would produce a `.md.md` self-reference) and
  // not on the internal `/md` subpath.
  if (
    MD_ALTERNATE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !pathname.endsWith('.md') &&
    !pathname.endsWith('/md')
  ) {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 2) {
      const existing = headers.get('Link') ?? '';
      const alternate = `<${pathname}.md>; rel="alternate"; type="text/markdown"`;
      headers.set('Link', existing ? `${existing}, ${alternate}` : alternate);
    }
  }
  return headers;
}

/**
 * What the adapter should do with one request, decided entirely here.
 *
 * `rewriteTo` is a path, not a URL, so neither adapter has to agree with the
 * other about how to build one. `markdownCanonicalPath` is set only on the
 * negotiated Markdown responses, where the public HTML URL has to be restated
 * explicitly — a rewritten response is finalized before the destination
 * handler runs, so its `Link` cannot be composed with the handler's canonical
 * `Link` the way it can on a normal response.
 */
export type ProxyPlan = {
  nonce: string;
  preview: boolean;
  securityHeaders: Record<string, string>;
  rewriteTo: string | null;
  markdownCanonicalPath: string | undefined;
};

export function planRequest(
  pathname: string,
  headers: { host: string | null | undefined; accept: string | null | undefined },
  { isProduction }: { isProduction: boolean },
): ProxyPlan {
  const nonce = btoa(crypto.randomUUID());
  const preview = isPreviewHost(headers.host);
  // The CSP is production-only: `next dev` serves eval'd modules and inline
  // bootstrapping that `strict-dynamic` would kill, and debugging a broken CSP
  // in dev has never once caught a real production problem.
  const security = isProduction ? securityHeaders(nonce) : {};

  const patternB = rewritePatternB(pathname);
  if (patternB) {
    return {
      nonce,
      preview,
      securityHeaders: security,
      rewriteTo: patternB,
      markdownCanonicalPath: pathname.slice(0, -'.md'.length),
    };
  }

  if (prefersMarkdown(headers.accept)) {
    const patternA = rewritePatternA(pathname);
    if (patternA) {
      return {
        nonce,
        preview,
        securityHeaders: security,
        rewriteTo: patternA,
        markdownCanonicalPath: pathname === '/' || pathname === '' ? undefined : pathname,
      };
    }
  }

  return {
    nonce,
    preview,
    securityHeaders: security,
    rewriteTo: null,
    markdownCanonicalPath: undefined,
  };
}

/**
 * Merge the contract's headers onto a response's headers, in place.
 *
 * Route handlers that already set a header win — several `/md` handlers set
 * their own `Cache-Control` and canonical `Link`. `Link` is the exception:
 * the discovery header has to land somewhere, so it is appended to whatever
 * the handler set rather than dropped.
 */
export function mergeContractHeaders(
  target: Headers,
  pathname: string,
  plan: Pick<ProxyPlan, 'securityHeaders' | 'preview' | 'markdownCanonicalPath'>,
): void {
  if (plan.markdownCanonicalPath) {
    target.set('Link', `<https://akaushik.org${plan.markdownCanonicalPath}>; rel="canonical"`);
  }
  const defaults = buildResponseHeaders(pathname, plan.securityHeaders, plan.preview);
  defaults.forEach((value, key) => {
    if (key.toLowerCase() === 'link') {
      const existing = target.get('link');
      target.set('Link', existing ? `${existing}, ${value}` : value);
      return;
    }
    if (!target.has(key)) {
      target.set(key, value);
    }
  });
}

/**
 * Paths the contract does not apply to.
 *
 * Mirrors the negative lookahead that `proxy.ts` carries as a Next matcher.
 * The Worker has no matcher, so it asks this instead, and both adapters get
 * the same answer. Static assets are excluded because they are served off the
 * asset store without a body worth annotating, and `/api/mcp` because the MCP
 * handler owns its own headers end to end.
 */
const STATIC_EXTENSIONS =
  /\.(?:png|jpg|jpeg|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf|txt|xml|json)$/;

export function isContractPath(pathname: string): boolean {
  if (pathname === '/api/mcp' || pathname === '/api/mcp/') return false;
  if (pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image')) return false;
  if (pathname === '/favicon.ico' || pathname === '/init-theme.js') return false;
  // `.md` URLs must pass through — Pattern B rewrites them — so the usual
  // "anything with a dot is a file" shortcut does not work here.
  if (pathname.endsWith('.md')) return true;
  return !STATIC_EXTENSIONS.test(pathname);
}
