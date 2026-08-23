import { describe, expect, it } from 'vitest';
import {
  buildResponseHeaders,
  wwwRedirect,
  isContractPath,
  isPreviewHost,
  mergeContractHeaders,
  planRequest,
  prefersMarkdown,
  rewritePatternA,
  rewritePatternB,
  securityHeaders,
} from './agent-proxy';

/**
 * These decisions used to live inside `proxy.ts` and were reachable only
 * through Playwright. They now have two callers — the Next adapter and the
 * Cloudflare Worker — and a rule that holds in one and not the other is a bug
 * nobody would see until production. So the policy is tested here, once, where
 * both adapters read it from.
 */
describe('isPreviewHost', () => {
  it.each(['akaushik.org', 'www.akaushik.org', 'AKAUSHIK.ORG'])(
    'treats %s as canonical',
    (host) => {
      expect(isPreviewHost(host)).toBe(false);
    },
  );

  it.each([
    'beta.akaushik.org',
    'dev.akaushik.org',
    'akaushik-org-preview.workers.dev',
    'akaushik.dev',
  ])('treats %s as a preview', (host) => {
    expect(isPreviewHost(host)).toBe(true);
  });

  it.each(['localhost:3100', 'localhost', '127.0.0.1', 'site.localhost'])(
    'leaves %s alone so local matches production',
    (host) => {
      expect(isPreviewHost(host)).toBe(false);
    },
  );

  it('does not guess when there is no host header', () => {
    expect(isPreviewHost(null)).toBe(false);
    expect(isPreviewHost('')).toBe(false);
  });
});

describe('wwwRedirect', () => {
  const at = (path: string) => new URL(`https://www.akaushik.org${path}`);

  it('sends www to the apex, keeping path and query', () => {
    expect(wwwRedirect('www.akaushik.org', at('/work/neev?utm_source=x'))).toBe(
      'https://akaushik.org/work/neev?utm_source=x',
    );
  });

  it('redirects the root', () => {
    expect(wwwRedirect('www.akaushik.org', at('/'))).toBe('https://akaushik.org/');
  });

  it.each(['akaushik.org', 'beta.akaushik.org', 'localhost:3000', 'akaushik.dev'])(
    'leaves %s alone',
    (host) => {
      expect(wwwRedirect(host, at('/'))).toBeNull();
    },
  );

  it('does not guess when there is no host header', () => {
    expect(wwwRedirect(null, at('/'))).toBeNull();
    expect(wwwRedirect('', at('/'))).toBeNull();
  });

  /**
   * www must stay canonical for the robots decision even though it redirects:
   * `X-Robots-Tag: noindex` on a redirect tells a crawler not to follow it,
   * which is the opposite of consolidating the two hosts.
   */
  it('does not make www a preview host', () => {
    expect(isPreviewHost('www.akaushik.org')).toBe(false);
  });
});

describe('Pattern B — literal .md suffix', () => {
  it.each([
    ['/work/clusterbid.md', '/work/clusterbid/md'],
    ['/writing/ai-for-msme.md', '/writing/ai-for-msme/md'],
  ])('%s rewrites to %s', (input, expected) => {
    expect(rewritePatternB(input)).toBe(expected);
  });

  it.each([
    '/work/clusterbid',
    '/about.md',
    '/work.md',
    '/work/a/b.md',
    '/writing/deep/nested/post.md',
  ])('leaves %s alone', (input) => {
    expect(rewritePatternB(input)).toBeNull();
  });
});

describe('Pattern A — Accept negotiation', () => {
  it('sends the home page to the short-form digest', () => {
    expect(rewritePatternA('/')).toBe('/llms.txt');
    expect(rewritePatternA('')).toBe('/llms.txt');
  });

  it.each([
    ['/work/neev', '/work/neev/md'],
    ['/writing/building-this-portfolio', '/writing/building-this-portfolio/md'],
  ])('%s negotiates to %s', (input, expected) => {
    expect(rewritePatternA(input)).toBe(expected);
  });

  it('never doubles a suffix that is already there', () => {
    expect(rewritePatternA('/work/neev/md')).toBeNull();
    expect(rewritePatternA('/work/neev.md')).toBeNull();
  });

  it('does not negotiate paths with no markdown twin', () => {
    expect(rewritePatternA('/api/docs')).toBeNull();
    expect(rewritePatternA('/work')).toBeNull();
  });

  it('reads only the preferred type, not anything in the list', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true);
    expect(prefersMarkdown('text/markdown;q=0.9, text/html')).toBe(true);
    // A browser sending html-first must get HTML, even though markdown is
    // acceptable to it further down the list.
    expect(prefersMarkdown('text/html,application/xhtml+xml,text/markdown')).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown('')).toBe(false);
  });
});

describe('securityHeaders', () => {
  it('carries the per-request nonce with strict-dynamic (ADR-0014)', () => {
    const csp = securityHeaders('abc123')['content-security-policy']!;
    expect(csp).toContain("'nonce-abc123'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('never allows unsafe-inline script', () => {
    expect(securityHeaders('n')['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });
});

describe('planRequest', () => {
  const canonical = { host: 'akaushik.org', accept: 'text/html' };

  it('mints a distinct nonce per request', () => {
    const a = planRequest('/', canonical, { isProduction: true });
    const b = planRequest('/', canonical, { isProduction: true });
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('omits the CSP outside production so dev is not fighting strict-dynamic', () => {
    const plan = planRequest('/', canonical, { isProduction: false });
    expect(plan.securityHeaders).toEqual({});
  });

  it('restates the public URL as canonical on a Pattern B rewrite', () => {
    const plan = planRequest('/work/neev.md', canonical, { isProduction: true });
    expect(plan.rewriteTo).toBe('/work/neev/md');
    expect(plan.markdownCanonicalPath).toBe('/work/neev');
  });

  it('does not claim a canonical for the negotiated home digest', () => {
    const plan = planRequest(
      '/',
      { host: 'akaushik.org', accept: 'text/markdown' },
      { isProduction: true },
    );
    expect(plan.rewriteTo).toBe('/llms.txt');
    expect(plan.markdownCanonicalPath).toBeUndefined();
  });

  it('marks a preview host', () => {
    expect(planRequest('/', { host: 'beta.akaushik.org', accept: '' }, { isProduction: true }).preview).toBe(
      true,
    );
  });
});

describe('buildResponseHeaders', () => {
  it('advertises the .md alternate on a content page', () => {
    const link = buildResponseHeaders('/work/neev', {}, false).get('Link')!;
    expect(link).toContain('<//work/neev.md>'.replace('//', '/'));
    expect(link).toContain('rel="alternate"');
    expect(link).toContain('type="text/markdown"');
  });

  it('does not advertise a .md.md self-reference', () => {
    expect(buildResponseHeaders('/work/neev.md', {}, false).get('Link')).not.toContain('.md.md');
  });

  it('does not advertise from the internal /md subpath', () => {
    expect(buildResponseHeaders('/work/neev/md', {}, false).get('Link')).not.toContain(
      'rel="alternate"',
    );
  });

  it('adds the robots refusal only on a preview', () => {
    expect(buildResponseHeaders('/', {}, true).get('X-Robots-Tag')).toBe(
      'noindex, nofollow, noarchive',
    );
    expect(buildResponseHeaders('/', {}, false).get('X-Robots-Tag')).toBeNull();
  });

  it('always carries the discovery Link and the sniffing guards', () => {
    const headers = buildResponseHeaders('/about', {}, false);
    expect(headers.get('Link')).toBeTruthy();
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});

describe('mergeContractHeaders', () => {
  it('lets a route handler keep its own Cache-Control', () => {
    const target = new Headers({ 'Cache-Control': 'public, max-age=300' });
    mergeContractHeaders(target, '/work/neev/md', {
      securityHeaders: { 'cache-control': 'no-store' },
      preview: false,
      markdownCanonicalPath: undefined,
    });
    expect(target.get('Cache-Control')).toBe('public, max-age=300');
  });

  it('appends the discovery Link rather than replacing the handler’s', () => {
    const target = new Headers({ Link: '<https://akaushik.org/work/neev>; rel="canonical"' });
    mergeContractHeaders(target, '/work/neev/md', {
      securityHeaders: {},
      preview: false,
      markdownCanonicalPath: undefined,
    });
    const link = target.get('Link')!;
    expect(link).toContain('rel="canonical"');
    expect(link).toContain('llms.txt');
  });

  it('states the canonical for a rewritten markdown response', () => {
    const target = new Headers();
    mergeContractHeaders(target, '/work/neev.md', {
      securityHeaders: {},
      preview: false,
      markdownCanonicalPath: '/work/neev',
    });
    expect(target.get('Link')).toContain('<https://akaushik.org/work/neev>; rel="canonical"');
  });
});

describe('isContractPath', () => {
  it.each(['/', '/work', '/work/neev', '/work/neev.md', '/writing/ai-for-msme', '/api/docs'])(
    'applies the contract to %s',
    (pathname) => {
      expect(isContractPath(pathname)).toBe(true);
    },
  );

  it.each([
    '/api/mcp',
    '/_next/static/chunks/main.js',
    '/_next/image',
    '/favicon.ico',
    '/init-theme.js',
    '/og.png',
    '/styles.css',
    '/fonts/JetBrainsMono.woff2',
    '/llms.txt',
    '/sitemap.xml',
  ])('skips %s', (pathname) => {
    expect(isContractPath(pathname)).toBe(false);
  });

  /**
   * The Worker has no Next matcher, so `isContractPath` has to agree with the
   * regex in `proxy.ts`. This pins the one case where the obvious shortcut
   * ("anything with a dot is a file") gives the wrong answer.
   */
  it('keeps .md paths in the contract even though they contain a dot', () => {
    expect(isContractPath('/work/neev.md')).toBe(true);
  });
});
