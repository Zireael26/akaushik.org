import { afterEach, describe, expect, it, vi } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server.js';
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

/**
 * The CSP itself is `lib/agent-proxy.ts`'s and is tested in
 * `lib/agent-proxy.test.ts`, where the Worker adapter reads it from too. What
 * is still this adapter's job — and so is tested here — is deciding whether
 * production is in effect at all, which it does from `process.env.NODE_ENV`.
 */
describe('proxy production gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the full production header set when NODE_ENV says production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = proxy(new NextRequest('https://akaushik.org/'));

    expect(response.headers.get('content-security-policy')).toContain("'strict-dynamic'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('strict-transport-security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('leaves the CSP off in development, where strict-dynamic would break dev', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const response = proxy(new NextRequest('https://akaushik.org/'));

    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('x-frame-options')).toBeNull();
    // The discovery contract is not a production-only thing and stays on.
    expect(response.headers.get('link')).toContain('rel="describedby"');
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

  it('leaves crawler policy to the destination route', () => {
    const response = proxy(
      new NextRequest('https://akaushik.org/writing/detection-is-not-continuity.md'),
    );

    expect(response.headers.has('x-robots-tag')).toBe(false);
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
