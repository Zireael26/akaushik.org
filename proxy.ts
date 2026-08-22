import { NextResponse, type NextRequest } from 'next/server';
import { AGENT_DISCOVERY_LINK_HEADER } from './lib/agent-discovery';

/**
 * Agent-readiness proxy.
 *
 *   1. Attaches RFC 8288 Link headers to every response so crawlers
 *      discover llms.txt / llms-full.txt / sitemap / agent-skills / mcp /
 *      api-catalog without parsing the DOM. The `describedby` + `sitemap`
 *      rels are the IANA-registered shapes per AGENT_READINESS §3.3; the
 *      remaining three (agent-skills / mcp / api-catalog) use
 *      `describedby` with distinct MIME types rather than inventing
 *      schema.org or modelcontextprotocol.io relation URIs.
 *   2. Content negotiation for Markdown (AGENT_READINESS §4.1):
 *      - Pattern B: `/work/<slug>.md` → `/work/<slug>/md`
 *        and `/writing/<slug>.md` → `/writing/<slug>/md`
 *      - Pattern A: if `Accept: text/markdown` is the preferred type:
 *          - on `/work/<slug>` or `/writing/<slug>`, rewrite to the
 *            corresponding `/md` route handler
 *          - on `/` (home), rewrite to `/llms.txt` (the short-form
 *            digest) so an agent scanner hitting the canonical root
 *            gets Markdown too
 *
 * Pattern B is the safety net (`.md` literally appended matches the
 * `isitagentready.com` probe shape). Pattern A is additive — Vercel Edge
 * has been flaky with header-based rewrites on streaming responses (Risk
 * R4), so if it misbehaves, Pattern B still satisfies the scan.
 */

// Paths that have a `.md` alternate. The set is small and deliberate — adding
// an entry means the path must also have an `/md/route.ts` handler.
const MD_ALTERNATE_PREFIXES = ['/work/', '/writing/'] as const;

export function securityHeaders(nonce: string): Record<string, string> {
  if (process.env.NODE_ENV !== 'production') return {};

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

function rewritePatternB(pathname: string): string | null {
  if (!pathname.endsWith('.md')) return null;
  if (!MD_ALTERNATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const base = pathname.slice(0, -'.md'.length);
  const parts = base.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  return `${base}/md`;
}

function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const head = accept.split(',')[0]?.trim().toLowerCase() ?? '';
  return head.startsWith('text/markdown');
}

function rewritePatternA(pathname: string): string | null {
  // Home → short-form digest. Matches AGENT_READINESS §4.1 "every content
  // page… returns Markdown on Accept: text/markdown."
  if (pathname === '/' || pathname === '') return '/llms.txt';

  if (!MD_ALTERNATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  if (pathname.endsWith('/md')) return null;
  if (pathname.endsWith('.md')) return null;
  return `${pathname}/md`;
}

/**
 * Any host that is not the canonical one is a preview and must never be
 * indexed.
 *
 * A preview deployment serving the same content as production is duplicate
 * content: it competes with the real site in search, and the damage outlives
 * the preview because a de-indexing takes far longer than an indexing. The
 * canonical tags already point at production, which is necessary but not
 * sufficient — a crawler still has to fetch and interpret the page to see
 * them. `X-Robots-Tag` is refused at the header, before any of that.
 *
 * Derived from the request host rather than an env var on purpose: an env var
 * is a thing someone can forget to set on a new preview, and the failure is
 * silent and expensive. The host cannot be forgotten.
 */
function isPreviewHost(request: NextRequest): boolean {
  const host = request.headers.get('host')?.toLowerCase() ?? '';
  if (!host) return false;
  const bare = host.replace(/:\d+$/, '');
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare === '127.0.0.1') return false;
  return bare !== 'akaushik.org' && bare !== 'www.akaushik.org';
}

function buildResponseHeaders(
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
  // Advertise the sibling `.md` alternate for HTML content pages that have
  // one. Do not advertise on the `.md` path itself (would produce
  // `.md.md` self-reference) or on the internal `/md` subpath.
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

function applyHeaders(
  response: NextResponse,
  pathname: string,
  productionSecurityHeaders: Record<string, string>,
  preview: boolean,
  markdownCanonicalPath?: string,
): NextResponse {
  // A rewrite response is finalized before the destination route handler runs,
  // so its Link header cannot be composed with the handler's canonical Link.
  // Preserve the public HTML URL explicitly for both Markdown negotiation
  // patterns, then append the global discovery links below.
  if (markdownCanonicalPath) {
    response.headers.set(
      'Link',
      `<https://akaushik.org${markdownCanonicalPath}>; rel="canonical"`,
    );
  }
  const defaults = buildResponseHeaders(pathname, productionSecurityHeaders, preview);
  defaults.forEach((value, key) => {
    // Do not clobber headers the route handler has already set (e.g. the
    // `/md` handlers set their own Cache-Control + canonical Link). But the
    // global Link discovery header has to land somewhere — if the handler
    // already set a Link, append ours rather than replace.
    if (key.toLowerCase() === 'link') {
      const existing = response.headers.get('link');
      response.headers.set('Link', existing ? `${existing}, ${value}` : value);
      return;
    }
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const productionSecurityHeaders = securityHeaders(nonce);

  const preview = isPreviewHost(request);

  const patternB = rewritePatternB(pathname);
  if (patternB) {
    return applyHeaders(
      NextResponse.rewrite(new URL(patternB, request.url)),
      pathname,
      productionSecurityHeaders,
      preview,
      pathname.slice(0, -'.md'.length),
    );
  }

  if (prefersMarkdown(request.headers.get('accept'))) {
    const patternA = rewritePatternA(pathname);
    if (patternA) {
      return applyHeaders(
        NextResponse.rewrite(new URL(patternA, request.url)),
        pathname,
        productionSecurityHeaders,
        preview,
        pathname === '/' || pathname === '' ? undefined : pathname,
      );
    }
  }

  const contentSecurityPolicy = productionSecurityHeaders['content-security-policy'];
  if (!contentSecurityPolicy) {
    return applyHeaders(NextResponse.next(), pathname, productionSecurityHeaders, preview);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', contentSecurityPolicy);

  return applyHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    pathname,
    productionSecurityHeaders,
    preview,
  );
}

export const config = {
  // Match everything except Next's own internals and favicon. `.md` URLs need
  // to pass through so Pattern B can rewrite them, so we can't use the usual
  // "exclude paths with a dot" shortcut.
  matcher: [
    '/((?!api/mcp/?$|_next/static|_next/image|favicon.ico|init-theme\\.js|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf|txt|xml|json)$).*)',
  ],
};
