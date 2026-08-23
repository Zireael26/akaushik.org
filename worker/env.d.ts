/**
 * Ambient Worker bindings.
 *
 * Declared here rather than pulled from `wrangler types` for the same reason
 * `worker/index.ts` keeps its `env` as `unknown`: the generated half-megabyte
 * of runtime declarations is not worth carrying for a handful of names, and a
 * fresh clone must typecheck before `wrangler types` has ever run.
 *
 * These are the bindings the stats path reads at request time. The cron side
 * receives them through the handler's `env` parameter instead (see
 * `worker/index.ts`), which is why only the global declaration lives here.
 */
declare global {
  // eslint-disable-next-line no-var -- ambient var is the only form mergeable onto globalThis
  var STATS_KV: { get(key: string): Promise<string | null> } | undefined;
}

export {};
