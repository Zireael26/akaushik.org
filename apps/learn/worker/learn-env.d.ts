/**
 * Worker bindings for learn.akaushik.org.
 *
 * Hand-written, and the binding types are deliberately structural rather than
 * imported from @cloudflare/workers-types. That package's globals shadow node's
 * Buffer, which breaks lib/password.ts — and password.ts is shared verbatim with
 * the account CLI, which really does run on node. Nothing in the Worker consumes
 * these bindings directly: it forwards `env` to OpenNext, and the routes that
 * use a binding narrow it themselves.
 *
 * Keep in step with wrangler.jsonc by hand.
 */
declare interface Env {
  /** better-auth tables (user, account, session, verification, rateLimit). */
  AUTH_DB: unknown;
  /** Reader progress; see migrations/learn/0001_progress.sql. */
  LEARN_DB: unknown;
  /** Course files served by /api/course-file, keyed by course-relative path. */
  COURSE_FILES: unknown;
  ASSETS: unknown;

  /** 'production' | 'development'. Anything else fails closed as production. */
  ENVIRONMENT?: string;
  /** The one Host this deployment answers to. Never derived from a request. */
  CANONICAL_HOST?: string;
  /** better-auth signing secret. Set with `wrangler secret put`. */
  BA_SECRET?: string;
}

/**
 * The execution context Cloudflare hands `fetch`. Only passed through to
 * OpenNext here, so the two documented methods are enough.
 */
declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
