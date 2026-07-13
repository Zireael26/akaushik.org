import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, securityHeaders } from './proxy';

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
