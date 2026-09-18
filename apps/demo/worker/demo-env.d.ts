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
  /** Demo state (rate-limit/credential cache, chat tables defined by later units). */
  DEMO_DB: unknown;
  ASSETS: unknown;

  /** 'production' | 'development'. Anything else fails closed as production. */
  ENVIRONMENT?: string;
  /** The one Host this deployment answers to. Never derived from a request. */
  CANONICAL_HOST?: string;
  /** better-auth signing secret. Set with `wrangler secret put`. */
  BA_SECRET?: string;

  /**
   * Plain vars (wrangler.jsonc `vars`; safe to commit).
   * DEMO_TITLE / DEMO_SUBTITLE brand the chat shell (defaults in
   * lib/demo-config.ts). VERICITE_API_BASE defaults to
   * https://api.vericite.ai; VERICITE_CHANNEL_ID selects the upstream
   * channel (empty = chat unconfigured → 503); VERICITE_MAX_SOURCES is
   * clamped to 1-20, default 6.
   */
  DEMO_TITLE?: string;
  DEMO_SUBTITLE?: string;
  VERICITE_API_BASE?: string;
  VERICITE_CHANNEL_ID?: string;
  VERICITE_MAX_SOURCES?: string;
  /**
   * Secrets (set with `wrangler secret put`, never committed):
   * BA_SECRET (required — better-auth signing), VERICITE_API_KEY
   * (upstream API key; chat 503s without it), DEMO_SUGGESTIONS (optional
   * JSON array of starter chips; invalid JSON renders no chips, no throw).
   */
  BA_SECRET?: string;
  VERICITE_API_KEY?: string;
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
