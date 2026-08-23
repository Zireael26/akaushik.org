// Served as a Route Handler (not MetadataRoute.Robots) because Cloudflare's
// Content-Signal directive is not expressible through the metadata API.
// Spec: contentsignals.org. Plan default: ai-train=yes (AGENT_READINESS §11 Q1).

/**
 * Canonical hosts get the welcoming policy below. Anything else is a preview,
 * and a preview that invites crawlers is duplicate content competing with the
 * real site — so it refuses everything and advertises no sitemap. Host-derived
 * for the same reason as the X-Robots-Tag guard in proxy.ts: an env var can be
 * forgotten on a new preview, a host cannot.
 */
const CANONICAL_HOSTS = new Set(['akaushik.org', 'www.akaushik.org']);

export function GET(request: Request) {
  const host = (new URL(request.url).host || '').toLowerCase().replace(/:\d+$/, '');
  const isLocal = host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';
  if (host && !isLocal && !CANONICAL_HOSTS.has(host)) {
    return new Response(
      ['# Preview deployment. Not the canonical site.', 'User-agent: *', 'Disallow: /', ''].join(
        '\n',
      ),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const body = [
    '# Crawlers and agents are welcome.',
    '# Training on this content is opt-in — see Content Signals below.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    '# Cloudflare Content Signals (contentsignals.org) — opt-in model.',
    '# search      — indexing for search results',
    '# ai-input    — use as retrieval/RAG context at inference time',
    '# ai-train    — use as model training data',
    'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
    '',
    'Sitemap: https://akaushik.org/sitemap.xml',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
