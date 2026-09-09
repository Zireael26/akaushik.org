/**
 * Cloudflare Worker wrapper for friendsof-portal.
 * Wraps OpenNext output with portal-wide security, exact Host enforcement, and nonce CSP.
 */
import { applySecurityHeaders, buildCsp, generateNonce, isAllowedHost } from '../lib/portal-security';

import openNext from '../.open-next/worker.js';
export * from '../.open-next/worker.js';

type Handler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
};

const next = openNext as Handler;

async function fetchHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  const nonce = generateNonce();

  // Fail-closed environment resolution
  const environment = (env && env.ENVIRONMENT) ? String(env.ENVIRONMENT) : 'production';
  const isQualification = environment === 'qualification';
  const isLocalDev = environment === 'development' || environment === 'qualification';
  const isProduction = environment === 'production';

  // Exact Host validation (fail closed)
  if (!isAllowedHost(host, { isLocalDev, isQualification })) {
    const denied = new Response('400 Bad Request (Unauthorized Host Header)', {
      status: 400,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'referrer-policy': 'no-referrer',
      },
    });
    applySecurityHeaders(denied.headers, nonce);
    return denied;
  }

  // Strict CSRF Origin enforcement for auth mutations at Worker edge before invoking KDF
  if (request.method === 'POST' && url.pathname.startsWith('/api/auth/')) {
    const origin = request.headers.get('origin');
    const canonicalHost = env.CANONICAL_HOST || host;

    // Production: EXACT set with ONLY https://${canonicalHost}. Zero localhost, zero http.
    const allowedOrigins = isProduction
      ? new Set([`https://${canonicalHost}`])
      : new Set([
          `https://${canonicalHost}`,
          `http://${canonicalHost}`,
          'http://localhost:3000',
          'http://localhost:3200',
          'http://localhost:3201',
          'http://127.0.0.1:3201',
          'http://127.0.0.1:4173',
        ]);

    if (!origin || !allowedOrigins.has(origin)) {
      const csrfDenied = new Response(
        JSON.stringify({ message: '403 Forbidden (CSRF Origin Mismatch)' }),
        {
          status: 403,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'referrer-policy': 'no-referrer',
          },
        },
      );
      applySecurityHeaders(csrfDenied.headers, nonce);
      return csrfDenied;
    }
  }

  const csp = buildCsp(nonce);
  const inboundHeaders = new Headers(request.headers);

  // Inbound security & canonical forwarding
  inboundHeaders.set('x-nonce', nonce);
  inboundHeaders.set('content-security-policy', csp);

  // Remove untrusted client-supplied forwarded headers to prevent workspace spoofing
  inboundHeaders.delete('x-forwarded-host');
  inboundHeaders.delete('x-forwarded-proto');
  if (host) {
    inboundHeaders.set('x-forwarded-host', host);
  }
  inboundHeaders.set('x-forwarded-proto', url.protocol.replace(':', ''));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const inbound = new Request(request.url, {
    method: request.method,
    headers: inboundHeaders,
    body: hasBody ? request.body : undefined,
    redirect: request.redirect,
  });

  try {
    const response = await next.fetch(inbound, env, ctx);
    const out = new Response(response.body, response);
    const isStaticAsset = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/');
    applySecurityHeaders(out.headers, nonce, { isStaticAsset });
    return out;
  } catch {
    // Generic 500 without leaking stack traces or internal errors
    const errResponse = new Response('500 Internal Server Error', {
      status: 500,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
    applySecurityHeaders(errResponse.headers, nonce);
    return errResponse;
  }
}

export default {
  fetch: fetchHandler,
};
