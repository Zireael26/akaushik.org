/**
 * Reader authentication for learn.akaushik.org. better-auth 1.7.3 pinned.
 *
 * Lifted from apps/friendsof with the host, cookie name and session ceiling
 * changed. The security properties below are the reason it was lifted rather
 * than rewritten: they were qualified once, for that app, and re-deriving them
 * for a second private subdomain would only be a chance to get one of them
 * wrong.
 *
 * - Username/password via emailAndPassword + username() plugin; public signup
 *   disabled (disableSignUp) — reader accounts are
 *   created only by scripts/owner-bootstrap.mjs, so a leaked URL grants nothing.
 * - Password KDF: OWASP-listed scrypt (N=16384, r=8, p=5) behind better-auth's
 *   documented password.hash/verify hook using the node:crypto scrypt
 *   primitive with constant-time compare. Disposition recorded in
 *   apps/friendsof/README.md: maintained documented
 *   hook + platform primitive at an OWASP-listed tuple, NOT custom crypto.
 * - Sessions: opaque DB sessions, token stored ONLY as SHA-256 (see
 *   ./auth-session-adapter). Raw bearer never persisted.
 * - Cookies: literal `__Host-learn-session` (useSecureCookies:false removes
 *   the automatic `__Secure-` prefix; Secure enforced via
 *   defaultCookieAttributes). HttpOnly, SameSite=Lax, Path=/, no Domain.
 *   Never trust client-provided identity: use getRequestContext() only.
 */
import "server-only";
import { betterAuth, type BetterAuthOptions, type DBAdapter } from "better-auth";
import { username } from "better-auth/plugins/username";
import { headers } from "next/headers";
import { withHashedSessionTokens } from "./auth-session-adapter";

export const SESSION_COOKIE_NAME = "__Host-learn-session";

/** Absolute 7-day session cap enforced regardless of sliding refresh (H1). */
export const ABSOLUTE_SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export { PASSWORD_KDF, hashPassword, verifyPassword } from "./password";
import { hashPassword, verifyPassword } from "./password";

export interface LearnAuthEnv {
  AUTH_DB: unknown;
  BA_SECRET: string;
  /** Canonical host from Worker env/allowlist. Never derived from request headers. */
  canonicalHost: string;
}

// Cache identity compares the ACTUAL binding reference (never a fresh
// instance against a stale pool), the canonical host, and the secret value.
// Never cache across different D1 bindings, even for the same host.
interface CacheEntry {
  db: unknown;
  canonicalHost: string;
  secret: string;
  auth: ReaderAuth;
}

export type ReaderAuth = Awaited<ReturnType<typeof buildAuth>>;

let cached: CacheEntry | null = null;

async function buildAuth(env: LearnAuthEnv) {
  const { createKyselyAdapter, kyselyAdapter } = await import("@better-auth/kysely-adapter");
  const { kysely, databaseType } = (await createKyselyAdapter({ database: env.AUTH_DB })) as {
    kysely: unknown;
    databaseType: string;
  };
  // Factory form is supported at runtime by getBaseAdapter
  // (`typeof options.database === "function"`) though the option type only
  // lists instances/bindings; the cast below is intentional and covered by
  // the deployed D1 proof (REPORT.md).
  const innerFactory = (opts: BetterAuthOptions): DBAdapter<BetterAuthOptions> =>
    kyselyAdapter(kysely as never, { type: (databaseType || "sqlite") as never })(opts);
  // http only for a loopback canonical host, which the Worker's host allowlist
  // can never produce in production: CANONICAL_HOST there is the deployed
  // domain, and `isAllowedHost` rejects anything else before auth runs.
  const isLoopback = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.canonicalHost);
  const baseURL = `${isLoopback ? "http" : "https"}://${env.canonicalHost}`;
  return betterAuth({
    database: withHashedSessionTokens(innerFactory) as unknown as BetterAuthOptions["database"],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: true,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }: { hash: string; password: string }) =>
          verifyPassword(hash, password),
      },
    },
    plugins: [username()],
    secret: env.BA_SECRET,
    baseURL,
    trustedOrigins: [baseURL],
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    // Database-backed (D1 `rateLimit` table) so throttles hold across
    // isolates. The route's atomic gate enforces 5 per account and 20
    // per IP per 900s; this provides an additional general request limit.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "database",
      customRules: {
        "/sign-in/*": { window: 900, max: 20 },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      useSecureCookies: false,
      cookies: {
        session_token: { name: SESSION_COOKIE_NAME },
        dont_remember: { name: "__Host-learn-remember" },
      },
      defaultCookieAttributes: {
        // `__Host-` requires Secure. Chrome and Firefox both treat
        // http://localhost as a secure context and accept it there, so this
        // stays true in dev rather than weakening the production cookie.
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
  });
}

export async function getReaderAuth(env: LearnAuthEnv): Promise<ReaderAuth> {
  const current: CacheEntry | null = cached;
  if (
    !current ||
    current.db !== env.AUTH_DB ||
    current.canonicalHost !== env.canonicalHost ||
    current.secret !== env.BA_SECRET
  ) {
    const fresh: CacheEntry = {
      db: env.AUTH_DB,
      canonicalHost: env.canonicalHost,
      secret: env.BA_SECRET,
      auth: await buildAuth(env),
    };
    cached = fresh;
    return fresh.auth;
  }
  return current.auth;
}

/**
 * Server-only reader identity. Derived from the session record, never from
 * anything the client sent apart from the opaque cookie itself.
 */
export interface RequestContext {
  accountId: string;
  sessionId: string;
  host: string;
  authenticatedAt: string;
  expiresAt: string;
}

/**
 * Structural session-reader: only getSession is required, nothing broader.
 */
export interface SessionReader {
  api: {
    getSession: (opts: { headers: Headers }) => Promise<unknown>;
  };
}

export async function getRequestContext(
  auth: SessionReader,
  cookieHeader: string,
  host: string,
): Promise<RequestContext | null> {
  const session = (await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  })) as unknown as {
    session?: { id: string; userId: string; createdAt: Date; expiresAt: Date };
  } | null;
  if (!session?.session) return null;

  // Enforce strict 7-day absolute session ceiling & reject invalid/future timestamps (H1)
  const createdAtMs = new Date(session.session.createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return null;
  const now = Date.now();
  if (createdAtMs > now + 60_000) return null;
  if (now - createdAtMs > ABSOLUTE_SESSION_MAX_MS) return null;

  return {
    accountId: session.session.userId,
    sessionId: session.session.id,
    host,
    authenticatedAt: new Date(session.session.createdAt).toISOString(),
    expiresAt: new Date(session.session.expiresAt).toISOString(),
  };
}

/** Next.js convenience wrapper: reads cookies + host from request headers.
 *  Uses ONLY the `host` header (never `x-forwarded-host`, which is
 *  client-controlled). Host allowlisting itself is enforced in the Worker
 *  before auth runs; the DAL re-validates host→workspace independently. */
export async function getRequestContextFromHeaders(auth: SessionReader): Promise<RequestContext | null> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const host = (h.get("host") ?? "").toLowerCase();
  if (!cookie || !host) return null;
  return getRequestContext(auth, cookie, host);
}
