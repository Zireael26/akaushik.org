import { afterEach, describe, expect, it, vi } from 'vitest';
import { securityHeaders } from './proxy';

describe('securityHeaders', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns CSP, X-Frame-Options, and HSTS in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const headers = securityHeaders();

    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('returns no production security headers in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(securityHeaders()).toEqual({});
  });
});
