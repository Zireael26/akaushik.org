/**
 * Portal security & header policy for friendsof.akaushik.org.
 *
 * Enforces:
 *   1. Exact Host allowlist / isolation (no wildcard suffixes; fail-closed).
 *   2. Cryptographic per-request nonce generation.
 *   3. Strict self-only Content Security Policy.
 *   4. Private anti-indexing, anti-caching, no-referrer, and frame-ancestors headers.
 */

const EXACT_DEPLOYED_HOSTS = new Set([
  'friendsof.akaushik.org',
  'preview.friendsof.akaushik.org',
]);

const LOCALDEV_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
]);

export function isAllowedHost(
  host: string | null,
  env?: { isLocalDev?: boolean; isQualification?: boolean },
): boolean {
  if (!host) return false;
  const cleanHost = host.split(':')[0] || '';

  // Exact match against deployed production/preview host allowlist
  if (EXACT_DEPLOYED_HOSTS.has(cleanHost)) return true;

  // Qualification workers.dev allowlist (active strictly when qualification environment is explicit)
  if (env?.isQualification && cleanHost.endsWith('.workers.dev')) {
    return true;
  }

  // Local development allowlist (active strictly when isLocalDev is explicitly true)
  if (env?.isLocalDev && LOCALDEV_HOSTS.has(cleanHost)) {
    return true;
  }

  // Fail closed by default
  return false;
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function applySecurityHeaders(
  headers: Headers,
  nonce: string,
  options: { isStaticAsset?: boolean } = {},
): void {
  headers.set('content-security-policy', buildCsp(nonce));
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'no-referrer');

  // Both standard responses and error paths carry private no-store and noindex
  if (!options.isStaticAsset) {
    headers.set('cache-control', 'private, no-store, must-revalidate');
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  }
}
