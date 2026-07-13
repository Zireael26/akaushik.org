import { NextResponse, type NextRequest } from 'next/server';

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

const LINK_HEADER = [
  '</llms.txt>; rel="describedby"; type="text/markdown"',
  '</llms-full.txt>; rel="describedby"; type="text/markdown"',
  '</sitemap.xml>; rel="sitemap"; type="application/xml"',
  '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
  '</.well-known/mcp.json>; rel="describedby"; type="application/json"',
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  // RFC 8631: service-desc (machine-readable spec) + service-doc (human page).
  '</api/openapi.json>; rel="service-desc"; type="application/json"',
  '</api/docs>; rel="service-doc"; type="text/html"',
].join(', ');

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

function buildResponseHeaders(
  pathname: string,
  productionSecurityHeaders: Record<string, string>,
): Headers {
  const headers = new Headers();
  headers.set('Link', LINK_HEADER);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Robots-Tag', 'index, follow');
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
): NextResponse {
  const defaults = buildResponseHeaders(pathname, productionSecurityHeaders);
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

  const patternB = rewritePatternB(pathname);
  if (patternB) {
    return applyHeaders(
      NextResponse.rewrite(new URL(patternB, request.url)),
      pathname,
      productionSecurityHeaders,
    );
  }

  if (prefersMarkdown(request.headers.get('accept'))) {
    const patternA = rewritePatternA(pathname);
    if (patternA) {
      return applyHeaders(
        NextResponse.rewrite(new URL(patternA, request.url)),
        pathname,
        productionSecurityHeaders,
      );
    }
  }

  const contentSecurityPolicy = productionSecurityHeaders['content-security-policy'];
  if (!contentSecurityPolicy) {
    return applyHeaders(NextResponse.next(), pathname, productionSecurityHeaders);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', contentSecurityPolicy);

  return applyHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    pathname,
    productionSecurityHeaders,
  );
}

export const config = {
  // Match everything except Next's own internals and favicon. `.md` URLs need
  // to pass through so Pattern B can rewrite them, so we can't use the usual
  // "exclude paths with a dot" shortcut.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|init-theme\\.js|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf|txt|xml|json)$).*)',
  ],
};
