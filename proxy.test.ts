import { afterEach, describe, expect, it, vi } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server.js';
import { NextRequest } from 'next/server';
import { config, proxy, securityHeaders } from './proxy';

describe('securityHeaders', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns CSP, X-Frame-Options, and HSTS in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const headers = securityHeaders('test-nonce');
    const csp = headers['content-security-policy']!;
    const scriptSrc = csp.split('; ').find((directive) => directive.startsWith('script-src '));

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(scriptSrc).toContain("'nonce-");
    expect(scriptSrc).toContain("'nonce-test-nonce'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).toContain('https://static.cloudflareinsights.com');
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('returns no production security headers in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(securityHeaders('test-nonce')).toEqual({});
  });
});

describe('proxy nonce propagation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards the nonce CSP to Next and returns the same CSP to the browser', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = proxy(new NextRequest('https://akaushik.org/'));
    const responseCsp = response.headers.get('content-security-policy');
    const requestCsp = response.headers.get('x-middleware-request-content-security-policy');
    const requestNonce = response.headers.get('x-middleware-request-x-nonce');

    expect(requestNonce).toBeTruthy();
    expect(requestCsp).toBe(responseCsp);
    expect(responseCsp).toContain(`'nonce-${requestNonce}'`);
  });
});

describe('proxy Markdown canonical links', () => {
  it('keeps the HTML canonical on suffix rewrites and appends discovery links', () => {
    const response = proxy(new NextRequest('https://akaushik.org/work/clusterbid.md'));
    const link = response.headers.get('link') ?? '';

    expect(link).toContain(
      '<https://akaushik.org/work/clusterbid>; rel="canonical"',
    );
    expect(link).toContain('</llms.txt>; rel="describedby"; type="text/markdown"');
  });

  it('keeps the HTML canonical on Accept-driven rewrites', () => {
    const response = proxy(
      new NextRequest('https://akaushik.org/writing/micrograd-makemore', {
        headers: { accept: 'text/markdown' },
      }),
    );

    expect(response.headers.get('link')).toContain(
      '<https://akaushik.org/writing/micrograd-makemore>; rel="canonical"',
    );
  });

  it('does not invent an HTML canonical for the home digest rewrite', () => {
    const response = proxy(
      new NextRequest('https://akaushik.org/', {
        headers: { accept: 'text/markdown' },
      }),
    );

    expect(response.headers.get('link')).not.toContain('rel="canonical"');
  });
});

describe('proxy matcher', () => {
  it('leaves the raw MCP transport outside Fetch Request construction', () => {
    for (const url of ['https://akaushik.org/api/mcp', 'https://akaushik.org/api/mcp/']) {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url,
        }),
        url,
      ).toBe(false);
    }

    for (const url of ['https://akaushik.org/api/mcpx', 'https://akaushik.org/api/mcp/child']) {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url,
        }),
        url,
      ).toBe(true);
    }
  });
});
