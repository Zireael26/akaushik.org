/**
 * Ambient Worker bindings.
 *
 * Declared here rather than pulled from `wrangler types` for the same reason
 * `worker/index.ts` keeps its `env` as `unknown`: the generated half-megabyte
 * of runtime declarations is not worth carrying for a handful of names, and a
 * fresh clone must typecheck before `wrangler types` has ever run.
 *
 * Request-time reads go through OpenNext's `getCloudflareContext().env`
 * (`lib/stats.ts`). Cron reads the same names from the handler `env`
 * parameter. Bindings are not copied onto `globalThis`.
 */
declare global {
  interface CloudflareEnv {
    STATS_KV?: { get(key: string): Promise<string | null> };
    GH_STATS_TOKEN?: string;
  }

  /**
   * The two runtime types the `scheduled` handler's signature needs. Only the
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
