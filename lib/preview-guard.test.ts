import { describe, expect, it } from 'vitest';
import { GET as robots } from '@/app/robots.txt/route';

/**
 * The preview guard is the one piece of this deployment that is expensive to
 * get wrong: a preview host indexed alongside production is duplicate content,
 * it competes with the real site, and de-indexing takes far longer than
 * indexing did. So it gets a test that fails if the guard is ever loosened.
 *
 * proxy.ts carries the matching `X-Robots-Tag` header guard. It is Next
 * middleware and cannot be imported into vitest without a request/response
 * harness, so it is covered by the e2e suite; this file pins the robots side,
 * which is pure and importable.
 */
function get(url: string) {
  return robots(new Request(url));
}

describe('robots.txt host policy', () => {
  it('welcomes crawlers on the canonical host', async () => {
    const body = await get('https://akaushik.org/robots.txt').text();
    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://akaushik.org/sitemap.xml');
    expect(body).not.toContain('Disallow: /');
  });

  it('welcomes crawlers on www', async () => {
    const body = await get('https://www.akaushik.org/robots.txt').text();
    expect(body).toContain('Allow: /');
  });

  it.each(['https://beta.akaushik.org', 'https://dev.akaushik.org', 'https://x.workers.dev'])(
    'refuses everything on preview host %s',
    async (origin) => {
      const res = get(`${origin}/robots.txt`);
      const body = await res.text();
      expect(body).toContain('Disallow: /');
      expect(body).not.toContain('Allow: /');
      // No sitemap: a preview must not hand crawlers a map of itself.
      expect(body).not.toContain('Sitemap:');
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    },
  );

  it('keeps the welcoming policy on localhost so dev matches production', async () => {
    const body = await get('http://localhost:3100/robots.txt').text();
    expect(body).toContain('Allow: /');
  });
});
