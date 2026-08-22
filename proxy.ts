import { NextResponse, type NextRequest } from 'next/server';
import { mergeContractHeaders, planRequest } from './lib/agent-proxy';

/**
 * The Next adapter for the agent-readiness contract. Local only.
 *
 * `next dev` and `next start` run this. Cloudflare does not — Next 16 executes
 * `proxy.ts` in the Node runtime and offers no way to opt out (`runtime:
 * 'edge'` is rejected with "Proxy does not support Edge runtime"), while
 * `@opennextjs/cloudflare` supports edge middleware only. `scripts/cf-build.mjs`
 * parks this file for the duration of the Cloudflare build and `worker/index.ts`
 * carries the same contract there.
 *
 * There is no policy in this file on purpose. Everything that decides what the
 * contract *is* lives in `lib/agent-proxy.ts`, which both adapters call and
 * which `lib/agent-proxy.test.ts` covers. Keep it that way: a rule implemented
 * here and not there ships to localhost and nowhere else.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const plan = planRequest(
    pathname,
    { host: request.headers.get('host'), accept: request.headers.get('accept') },
    { isProduction: process.env.NODE_ENV === 'production' },
  );

  if (plan.rewriteTo) {
    const rewritten = NextResponse.rewrite(new URL(plan.rewriteTo, request.url));
    mergeContractHeaders(rewritten.headers, pathname, plan);
    return rewritten;
  }

  const contentSecurityPolicy = plan.securityHeaders['content-security-policy'];
  if (!contentSecurityPolicy) {
    const passthrough = NextResponse.next();
    mergeContractHeaders(passthrough.headers, pathname, plan);
    return passthrough;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', plan.nonce);
  requestHeaders.set('content-security-policy', contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  mergeContractHeaders(response.headers, pathname, plan);
  return response;
}

export const config = {
  // Match everything except Next's own internals and favicon. `.md` URLs need
  // to pass through so Pattern B can rewrite them, so we can't use the usual
  // "exclude paths with a dot" shortcut. `isContractPath` in
  // `lib/agent-proxy.ts` is the Worker's equivalent of this list — change both.
  matcher: [
    '/((?!api/mcp/?$|_next/static|_next/image|favicon.ico|init-theme\\.js|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf|txt|xml|json)$).*)',
  ],
};
