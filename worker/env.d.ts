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

  /**
   * The two runtime types the `scheduled` handler's signature needs, declared
   * to the same minimum as `STATS_KV` above and for the same reason. Only the
   * members this worker could plausibly read are listed; the handler ignores
   * both parameters today, so this exists to type the signature, not to model
   * the runtime.
   */
  interface ScheduledController {
    readonly scheduledTime: number;
    readonly cron: string;
    noRetry(): void;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}

export {};
