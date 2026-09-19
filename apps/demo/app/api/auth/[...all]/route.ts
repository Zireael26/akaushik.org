import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDemoAuth, type DemoAuthEnv } from "@/lib/auth";

interface DemoBindings {
  AUTH_DB?: unknown;
  BA_SECRET?: string;
  CANONICAL_HOST?: string;
  ENVIRONMENT?: string;
}

interface D1DatabaseLike {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      first: <T>(col?: string) => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
}

function portalEnv(): DemoAuthEnv & { isProduction: boolean } {
  const { env } = getCloudflareContext() as unknown as {
    env: DemoBindings & Record<string, string>;
  };
  const canonicalHost = (env.CANONICAL_HOST ?? "").toLowerCase();
  if (!canonicalHost) throw new Error("CANONICAL_HOST is not configured");
  const secret = env.BA_SECRET;
  if (!secret) throw new Error("BA_SECRET is not configured");

  // Missing or non-dev environment fails closed as production
  const environment = (env.ENVIRONMENT ?? "").toLowerCase();
  const isProduction = environment !== "qualification" && environment !== "development";

  return { AUTH_DB: env.AUTH_DB, BA_SECRET: secret, canonicalHost, isProduction };
}

const MAX_AUTH_BODY_BYTES = 8192; // 8 KiB max body bounds per ABUSE
const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 256;
const ACCOUNT_FAIL_WINDOW_MS = 900 * 1000; // 900s (15 min)
const MAX_IP_ATTEMPTS = 20; // 20 attempts per IP per 900s
const MAX_ACCOUNT_ATTEMPTS = 5; // 5 attempts per account+IP per 900s

async function hashRateLimitKey(prefix: string, identifier: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${prefix}:${identifier}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          void reader.cancel();
          throw new Error("PAYLOAD_TOO_LARGE");
        }
        chunks.push(value);
      }
    }

    const result = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } finally {
    reader.releaseLock();
  }
}

function stripTokenFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTokenFields);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "token") {
        out[k] = null;
        continue;
      }
      out[k] = stripTokenFields(v);
    }
    return out;
  }
  return value;
}

async function handleAuth(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // 1. Strict Endpoint Allowlist: only sign-in/username, sign-out, and get-session allowed
  const isAllowedEndpoint =
    (request.method === "POST" && (pathname === "/api/auth/sign-in/username" || pathname === "/api/auth/sign-out")) ||
    (request.method === "GET" && pathname === "/api/auth/get-session");

  if (!isAllowedEndpoint) {
    return new Response(JSON.stringify({ message: "404 Not Found (Endpoint Not Allowed)" }), {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store, must-revalidate",
        "referrer-policy": "no-referrer",
      },
    });
  }

  let pEnv: ReturnType<typeof portalEnv>;
  try {
    pEnv = portalEnv();
  } catch {
    return new Response("503 Service Unavailable (Auth Unconfigured)", { status: 503 });
  }

  // 2. Strict CSRF Origin enforcement for auth mutations before running KDF
  if (request.method === "POST") {
    const origin = request.headers.get("origin");

    // Production: EXACT set with ONLY https://${canonicalHost}. Zero localhost, zero http.
    const allowedOrigins = pEnv.isProduction
      ? new Set([`https://${pEnv.canonicalHost}`])
      : new Set([
          `https://${pEnv.canonicalHost}`,
          `http://${pEnv.canonicalHost}`,
          "http://localhost:3000",
          "http://localhost:3301",
          "http://127.0.0.1:3301",
          "http://127.0.0.1:4173",
        ]);

    if (!origin || !allowedOrigins.has(origin)) {
      return new Response(JSON.stringify({ message: "403 Forbidden (CSRF Origin Mismatch)" }), {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
          "cache-control": "private, no-store, must-revalidate",
          "referrer-policy": "no-referrer",
        },
      });
    }

    // 3. Body size bounds check (8 KiB max) protecting against chunked encoding bypass
    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_AUTH_BODY_BYTES) {
      return new Response(JSON.stringify({ message: "413 Payload Too Large (Max 8KiB)" }), {
        status: 413,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
          "cache-control": "private, no-store, must-revalidate",
          "referrer-policy": "no-referrer",
        },
      });
    }
  }

  // 4. Bounded body reading (8 KiB max) with active stream cancellation
  let rawBodyBytes: Uint8Array | null = null;
  if (request.method === "POST") {
    try {
      rawBodyBytes = await readBoundedBody(request, MAX_AUTH_BODY_BYTES);
    } catch {
      return new Response(JSON.stringify({ message: "413 Payload Too Large (Max 8KiB)" }), {
        status: 413,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
          "cache-control": "private, no-store, must-revalidate",
          "referrer-policy": "no-referrer",
        },
      });
    }
  }

  // 5. Client IP resolution (fail-closed in production if cf-connecting-ip is missing)
  const cfIp = request.headers.get("cf-connecting-ip");
  if (pEnv.isProduction && !cfIp) {
    return new Response("503 Service Unavailable (Client IP Required)", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "referrer-policy": "no-referrer" },
    });
  }
  const clientIp = cfIp || "127.0.0.1";

  const db = pEnv.AUTH_DB as D1DatabaseLike | undefined;
  if (!db) {
    return new Response("503 Service Unavailable (AUTH_DB Unbound)", { status: 503 });
  }

  let failKey: string | null = null;

  // 6. Atomic Rate Limiting (Global IP 20/900s and Account+IP 5/900s) on sign-in before KDF
  if (request.method === "POST" && pathname === "/api/auth/sign-in/username" && rawBodyBytes) {
    let parsedJson: unknown;
    try {
      const text = new TextDecoder().decode(rawBodyBytes);
      parsedJson = JSON.parse(text);
    } catch {
      return new Response(JSON.stringify({ message: "400 Bad Request (Malformed JSON)" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (parsedJson && typeof parsedJson === "object") {
      const usernameVal = (parsedJson as { username?: unknown }).username;
      const passwordVal = (parsedJson as { password?: unknown }).password;

      if (typeof usernameVal !== "string" || usernameVal.length > MAX_USERNAME_LENGTH) {
        return new Response(JSON.stringify({ message: "400 Bad Request (Invalid username length)" }), {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (typeof passwordVal !== "string" || passwordVal.length > MAX_PASSWORD_LENGTH) {
        return new Response(JSON.stringify({ message: "400 Bad Request (Invalid password length)" }), {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      const now = Date.now();

      // Step 6a: Atomic Global IP check (max 20 per 900s) via D1 UPSERT RETURNING
      const ipKey = `rl:${await hashRateLimitKey("ip", clientIp)}`;
      try {
        const ipAdmission = await db
          .prepare(
            `INSERT INTO rateLimit (id, "key", count, lastRequest)
             VALUES (?1, ?2, 1, ?3)
             ON CONFLICT("key") DO UPDATE SET
               count = CASE WHEN ?3 - lastRequest > ${ACCOUNT_FAIL_WINDOW_MS} THEN 1 ELSE count + 1 END,
               lastRequest = ?3
             RETURNING count, lastRequest`,
          )
          .bind(`rl_${now}_${Math.random().toString(36).slice(2)}`, ipKey, now)
          .first<{ count: number; lastRequest: number }>();

        if (!ipAdmission) {
          return new Response("503 Service Unavailable (Rate Limit Database Error)", { status: 503 });
        }

        if (ipAdmission.count > MAX_IP_ATTEMPTS) {
          return new Response(
            JSON.stringify({ message: "429 Too Many Requests (IP temporarily throttled)" }),
            {
              status: 429,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "retry-after": "900",
                "x-content-type-options": "nosniff",
                "cache-control": "private, no-store, must-revalidate",
                "referrer-policy": "no-referrer",
              },
            },
          );
        }
      } catch {
        return new Response("503 Service Unavailable (IP Throttle Storage Error)", { status: 503 });
      }

      // Step 6b: Atomic Account+IP check (max 5 per 900s) via D1 UPSERT RETURNING
      const hashedKey = await hashRateLimitKey("acc", `${usernameVal.trim().toLowerCase()}:${clientIp}`);
      failKey = `rl:${hashedKey}`;

      try {
        const accAdmission = await db
          .prepare(
            `INSERT INTO rateLimit (id, "key", count, lastRequest)
             VALUES (?1, ?2, 1, ?3)
             ON CONFLICT("key") DO UPDATE SET
               count = CASE WHEN ?3 - lastRequest > ${ACCOUNT_FAIL_WINDOW_MS} THEN 1 ELSE count + 1 END,
               lastRequest = ?3
             RETURNING count, lastRequest`,
          )
          .bind(`rl_${now}_${Math.random().toString(36).slice(2)}`, failKey, now)
          .first<{ count: number; lastRequest: number }>();

        if (!accAdmission) {
          return new Response("503 Service Unavailable (Rate Limit Database Error)", { status: 503 });
        }

        if (accAdmission.count > MAX_ACCOUNT_ATTEMPTS) {
          return new Response(
            JSON.stringify({ message: "429 Too Many Requests (Account temporarily throttled)" }),
            {
              status: 429,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "retry-after": "900",
                "x-content-type-options": "nosniff",
                "cache-control": "private, no-store, must-revalidate",
                "referrer-policy": "no-referrer",
              },
            },
          );
        }
      } catch {
        return new Response("503 Service Unavailable (Account Throttle Storage Error)", { status: 503 });
      }
    }
  }

  // 7. Reconstruct inbound Request for Better Auth with verified bounded body
  const inboundRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: rawBodyBytes ? (rawBodyBytes as BodyInit) : undefined,
  });

  const auth = await getDemoAuth(pEnv);
  const res = await auth.handler(inboundRequest);

  // On successful sign-in (200), reset the account throttle key in D1
  if (failKey && res.status === 200) {
    try {
      await db.prepare('DELETE FROM rateLimit WHERE "key" = ?1').bind(failKey).run();
    } catch {
      // Non-fatal if reset cleanup fails
    }
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("application/json")) return res;

  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    return res;
  }

  const headers = new Headers(res.headers);
  headers.delete("content-length");

  return new Response(JSON.stringify(stripTokenFields(body)), {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function GET(request: Request) {
  return handleAuth(request);
}

export async function POST(request: Request) {
  return handleAuth(request);
}
