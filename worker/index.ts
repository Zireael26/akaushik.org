/**
 * The Cloudflare adapter for the agent-readiness contract.
 *
 * `@opennextjs/cloudflare` generates `.open-next/worker.js`, which knows how to
 * run the Next app. It does not know about this site's contract, and it cannot
 * learn it from `proxy.ts` — the adapter supports edge middleware only, and
 * Next 16 runs `proxy.ts` in the Node runtime with no way to opt out. So the
 * contract is applied here, wrapped around the generated handler, instead.
 *
 * This file contains no policy. `lib/agent-proxy.ts` decides everything and is
 * unit-tested; `proxy.ts` is the same decisions applied through Next's
 * middleware API for local development. If the two adapters ever disagree,
 * this file is the one that is actually serving akaushik.org.
 *
 * `export *` forwards whatever else the generated worker exports — OpenNext
 * emits Durable Object classes for its queue and tag cache, and Wrangler
 * resolves those against the entry module, which is now this file rather than
 * the generated one.
 */
import { isContractPath, mergeContractHeaders, planRequest, wwwRedirect } from '../lib/agent-proxy';
import { runStatsRefresh, type StatsCronEnv } from '../lib/stats-source';

// Typed by `worker/open-next.d.ts`, which stands in when the generated file is
// absent — a fresh clone must typecheck before anything has been built.
import openNext from '../.open-next/worker.js';

// Re-exports OpenNext's Durable Object classes; Wrangler resolves them against
// the entry module, which is this file now rather than the generated one.
export * from '../.open-next/worker.js';

/**
 * `env` and `ctx` are passed straight through and never inspected, so they are
 * `unknown` rather than the real Workers types. That keeps `wrangler types`'
 * half-megabyte of generated runtime declarations out of the repo for the sake
 * of two parameters this file only forwards.
 */
type Handler = {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
};

const next = openNext as Handler;

async function fetchHandler(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  // Before anything else, including the contract: a request on the wrong host
  // should not be served at all, so there is nothing to attach headers to.
  const redirect = wwwRedirect(request.headers.get('host'), url);
  if (redirect) {
    return new Response(null, { status: 308, headers: { location: redirect } });
  }

  if (!isContractPath(pathname)) {
    return next.fetch(request, env, ctx);
  }

  // The Worker only ever runs a production build, so the CSP is always on.
  // `next dev` is the only place it is off, and that path goes through
  // proxy.ts, not this file.
  const plan = planRequest(
    pathname,
    { host: request.headers.get('host'), accept: request.headers.get('accept') },
    { isProduction: true },
  );

  // A rewrite is a different URL to the app and the same URL to the client:
  // the response is annotated with the *original* pathname below, and the
  // canonical Link is restated for the Markdown routes, exactly as the Next
  // adapter does.
  let target = url;
  if (plan.rewriteTo) {
    target = new URL(plan.rewriteTo, url);
    target.search = url.search;
  }

  const inboundHeaders = new Headers(request.headers);
  inboundHeaders.set('x-nonce', plan.nonce);
  const contentSecurityPolicy = plan.securityHeaders['content-security-policy'];
  if (contentSecurityPolicy) {
    inboundHeaders.set('content-security-policy', contentSecurityPolicy);
  }

  const inbound = new Request(target, { ...request, headers: inboundHeaders });
  const response = await next.fetch(inbound, env, ctx);

  // Responses out of the handler are immutable; copy to get writable headers.
  // 101/204/304 carry a null body already, so this is safe for them too.
  const out = new Response(response.body, response);
  mergeContractHeaders(out.headers, pathname, plan);
  return out;
}

/**
 * The daily GitHub-stats refresh (wrangler.jsonc crons, 04:17 UTC — the same
 * slot the GitHub Actions schedule used). Its inputs come from the env
 * bindings and nothing else: the token is a wrangler secret, the namespace is
 * bound as STATS_KV. A failure rejects into the cron invocation, which
 * Cloudflare marks failed in the dashboard; KV is written only after a
 * complete successful fetch, so a bad run leaves the previous snapshot — and
 * the site's degraded-state labelling — intact.
 */
async function scheduled(
  _event: ScheduledController,
  env: StatsCronEnv,
  _ctx: ExecutionContext,
): Promise<void> {
  await runStatsRefresh(env);
}

const worker = {
  fetch: fetchHandler,
  scheduled,
};

export default worker;
