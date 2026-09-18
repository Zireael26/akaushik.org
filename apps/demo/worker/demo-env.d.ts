/**
 * Worker bindings for demo.akaushik.org.
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
  /** Chat rate-limit window and the per-account upstream visitor credential. */
  DEMO_DB: unknown;
  ASSETS: unknown;

  /** 'production' | 'development'. Anything else fails closed as production. */
  ENVIRONMENT?: string;
  /** The one Host this deployment answers to. Never derived from a request. */
  CANONICAL_HOST?: string;
  /** better-auth signing secret. Set with `wrangler secret put`. */
  BA_SECRET?: string;

  /**
   * Plain vars (wrangler.jsonc `vars`; nothing client-specific, safe to
   * commit). VERICITE_API_BASE is the answer API; VERICITE_ORIGIN is the
   * Origin sent upstream, which a publishable key's origin allowlist must
   * contain; VERICITE_MAX_SOURCES is clamped to 1-10, default 5.
   */
  VERICITE_API_BASE?: string;
  VERICITE_ORIGIN?: string;
  VERICITE_MAX_SOURCES?: string;
  /**
   * Secrets (`wrangler secret put`, never committed — anything naming the
   * client or the upstream channel lives here because the repo is public).
   * Required: VERICITE_API_KEY, VERICITE_CHANNEL_ID; without either, every
   * question gets the single generic error. Optional: DEMO_TITLE,
   * DEMO_SUBTITLE (chat branding) and DEMO_SUGGESTIONS (JSON array of
   * starter chips; invalid JSON renders no chips and never throws).
   */
  VERICITE_API_KEY?: string;
  VERICITE_CHANNEL_ID?: string;
  DEMO_TITLE?: string;
  DEMO_SUBTITLE?: string;
  DEMO_SUGGESTIONS?: string;
}

/**
 * The execution context Cloudflare hands `fetch`. Only passed through to
 * OpenNext here, so the two documented methods are enough.
 */
declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
