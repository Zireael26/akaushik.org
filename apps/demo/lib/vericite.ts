/**
 * Server-only VeriCite upstream client for the demo chat route.
 *
 * Server flow (never exposed to the browser):
 *   1. Mint a visitor credential: POST {VERICITE_API_BASE}/api/v1/chat/visitor-credential
 *      with `X-API-Key: VERICITE_API_KEY` -> {visitorCredential, visitorId, expiresAt}.
 *   2. Open the answer stream: POST {VERICITE_API_BASE}/api/v1/chat/stream with
 *      `X-API-Key` + `X-VC-Visitor-Credential` (+ `X-VC-User-Id` routing id) and
 *      body {query, sessionId?, channelIdentifier, options:{maxSources}}.
 *
 * Credentials are cached per demo account in DEMO_DB (with an isolate-local
 * memo in front) until expiry, so a mint happens only on a miss/expiry. The
 * upstream binds a conversation to the visitor id that opened it, so the
 * credential must outlive any one isolate; a refresh presents the previous
 * credential so the upstream keeps the same visitor id where it can.
 * Every failure surfaces as a generic Error — the route maps it to one safe
 * SSE error event and never forwards upstream status codes or bodies.
 */
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVericiteMaxSources } from "./demo-config";
import type { D1Like } from "./session";

/** Time allowed for the upstream to answer with response headers. */
const UPSTREAM_TIMEOUT_MS = 60_000;
/** Hard ceiling on one streamed answer, headers to [DONE]. */
const STREAM_CEILING_MS = 180_000;
/** Refresh ahead of true expiry so a credential never dies mid-stream. */
const CREDENTIAL_SKEW_MS = 60_000;

interface CachedCredential {
  credential: string;
  visitorId: string;
  expiresAtMs: number;
}

/** Isolate-local memo in front of the DEMO_DB row, keyed by demo account id. */
const credentialCache = new Map<string, CachedCredential>();

function isFresh(cred: CachedCredential | null | undefined): boolean {
  return !!cred && cred.expiresAtMs - CREDENTIAL_SKEW_MS > Date.now();
}

async function loadStored(db: D1Like, accountId: string): Promise<CachedCredential | null> {
  try {
    const row = await db
      .prepare("SELECT credential, visitor_id, expires_at FROM visitor_credential WHERE account_id = ?1")
      .bind(accountId)
      .first<{ credential: string; visitor_id: string; expires_at: number }>();
    if (!row) return null;
    return { credential: row.credential, visitorId: row.visitor_id, expiresAtMs: Number(row.expires_at) };
  } catch {
    return null;
  }
}

async function forget(db: D1Like, accountId: string): Promise<void> {
  credentialCache.delete(accountId);
  try {
    await db.prepare("DELETE FROM visitor_credential WHERE account_id = ?1").bind(accountId).run();
  } catch {
    /* next mint overwrites the row anyway */
  }
}

async function store(db: D1Like, accountId: string, cred: CachedCredential): Promise<void> {
  try {
    await db
      .prepare(
        "INSERT INTO visitor_credential (account_id, credential, visitor_id, expires_at) VALUES (?1, ?2, ?3, ?4) " +
          "ON CONFLICT(account_id) DO UPDATE SET credential = excluded.credential, " +
          "visitor_id = excluded.visitor_id, expires_at = excluded.expires_at",
      )
      .bind(accountId, cred.credential, cred.visitorId, cred.expiresAtMs)
      .run();
  } catch {
    /* the memo still serves this isolate; the next miss re-mints */
  }
}

function readEnv(name: string): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env: Record<string, unknown>;
    };
    const value = env?.[name];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    /* outside request scope (tests/cli) — fall through to process.env */
  }
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

interface VericiteConfig {
  apiBase: string;
  apiKey: string;
  channelId: string;
  maxSources: number;
  /**
   * Origin presented upstream. A publishable key is bound to an exact origin
   * allowlist and the gateway refuses a request without a matching Origin,
   * so the server sends it explicitly on every upstream call.
   */
  origin: string;
}

function vericiteConfig(): VericiteConfig {
  const apiBase = readEnv("VERICITE_API_BASE");
  const apiKey = readEnv("VERICITE_API_KEY");
  const channelId = readEnv("VERICITE_CHANNEL_ID");
  const origin = readEnv("VERICITE_ORIGIN");
  if (!apiBase || !apiKey || !channelId || !origin) throw new Error("Chat is not configured");
  // Single source of truth for the default (5) and clamp (1-10, the upstream
  // maximum): lib/demo-config.ts. Never parse or clamp here in parallel.
  const maxSources = getVericiteMaxSources({ VERICITE_MAX_SOURCES: readEnv("VERICITE_MAX_SOURCES") });
  return { apiBase: apiBase.replace(/\/+$/, ""), apiKey, channelId, maxSources, origin };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accept both the success-envelope shape and a flat credential body. */
function parseCredential(body: unknown): CachedCredential {
  const data = isRecord(body) && "data" in body && isRecord(body.data) ? body.data : body;
  if (!isRecord(data)) throw new Error("Chat is unavailable");
  const credential =
    typeof data.visitorCredential === "string"
      ? data.visitorCredential
      : typeof data.credential === "string"
        ? data.credential
        : null;
  const visitorId =
    typeof data.visitorId === "string"
      ? data.visitorId
      : typeof data.visitor_id === "string"
        ? data.visitor_id
        : null;
  const expiresRaw =
    typeof data.expiresAt === "string"
      ? data.expiresAt
      : typeof data.expires_at === "string"
        ? data.expires_at
        : null;
  const expiresAtMs = expiresRaw ? Date.parse(expiresRaw) : Number.NaN;
  if (!credential || !visitorId || !Number.isFinite(expiresAtMs)) {
    throw new Error("Chat is unavailable");
  }
  return { credential, visitorId, expiresAtMs };
}

async function mint(cfg: VericiteConfig, previous: CachedCredential | null): Promise<CachedCredential> {
  const { apiBase, apiKey, origin } = cfg;
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/v1/chat/visitor-credential`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        Origin: origin,
        "content-type": "application/json",
        // Presenting the previous credential keeps the same visitor id.
        ...(previous ? { "X-VC-Visitor-Credential": previous.credential } : {}),
      },
      body: "{}",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Chat is unavailable");
  }
  if (!res.ok) throw new Error("Chat is unavailable");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error("Chat is unavailable");
  }
  return parseCredential(body);
}

/**
 * Reuse (or mint) the visitor credential for one demo account.
 * `accountId` comes from the verified session — never a client value.
 */
export async function getVisitorCredential(db: D1Like, accountId: string): Promise<CachedCredential> {
  const memo = credentialCache.get(accountId);
  if (memo && isFresh(memo)) return memo;
  const stored = await loadStored(db, accountId);
  if (stored && isFresh(stored)) {
    credentialCache.set(accountId, stored);
    return stored;
  }

  const cfg = vericiteConfig();
  // An expired credential no longer verifies upstream, so present the old
  // one only while it is still valid (inside the refresh skew window).
  const previous = stored && stored.expiresAtMs > Date.now() ? stored : null;
  let minted: CachedCredential;
  try {
    minted = await mint(cfg, previous);
  } catch (err) {
    if (!previous) throw err;
    minted = await mint(cfg, null);
  }
  credentialCache.set(accountId, minted);
  await store(db, accountId, minted);
  return minted;
}

export interface StreamChatArgs {
  query: string;
  /** Upstream conversation session; omit for a one-shot question. */
  sessionId?: string;
  /** Verified demo account id: the credential-cache key. */
  accountId: string;
  /** DEMO_DB, where the credential is persisted across isolates. */
  db: D1Like;
}

/** Open the upstream SSE stream. Throws a generic Error on any failure. */
export async function streamVericiteChat(args: StreamChatArgs): Promise<Response> {
  const { apiBase, apiKey, channelId, maxSources, origin } = vericiteConfig();
  const credential = await getVisitorCredential(args.db, args.accountId);
  // One controller for the whole exchange: a header timeout while waiting
  // for the upstream to respond, then a generous ceiling on the stream so a
  // long answer is not cut off at the header deadline.
  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/v1/chat/stream`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "X-VC-Visitor-Credential": credential.credential,
        "X-VC-User-Id": credential.visitorId,
        Origin: origin,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        query: args.query,
        ...(args.sessionId ? { sessionId: args.sessionId } : {}),
        channelIdentifier: channelId,
        options: { maxSources },
      }),
      signal: controller.signal,
    });
  } catch {
    throw new Error("Chat is unavailable");
  } finally {
    clearTimeout(headerTimer);
  }
  if (!res.ok || !res.body) {
    // A refused credential must not stay cached for its remaining lifetime.
    if (res.status === 401) await forget(args.db, args.accountId);
    throw new Error("Chat is unavailable");
  }
  setTimeout(() => controller.abort(), STREAM_CEILING_MS);
  return res;
}
