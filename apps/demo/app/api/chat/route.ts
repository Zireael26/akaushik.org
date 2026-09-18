/**
 * POST /api/chat — authenticated demo chat over the VeriCite stream.
 *
 * Guard order is deliberate: session first (401 without ever touching the
 * upstream fetch path), then the same-origin check, body validation, and the
 * D1 rate budget — only then is a visitor credential minted and the upstream
 * SSE stream opened. Every upstream frame passes through filterVericiteEvent;
 * the response always ends with `data: [DONE]`, and any upstream failure
 * becomes exactly one generic error event followed by `[DONE]`.
 *
 * Import discipline: the ONLY static import is the dependency-free SSE
 * filter (relative path — plain node test runners cannot resolve the `@/`
 * alias). The Next/D1/secret-bearing modules resolve lazily inside POST so
 * a broken server bundle fails closed (401/503) instead of throwing at
 * import time; `test/chat-unauth.test.mjs` and
 * `test/chat-upstream-error.test.mjs` exercise exactly that fail-closed
 * branch under plain node.
 */
// Explicit `.ts` extension so plain-node test runners (no bundler extension
// probing) can import this route directly; Next/Turbopack resolve the exact
// file path as-is. allowImportingTsExtensions stays off project-wide.
// @ts-expect-error TS5097: explicit extension for plain-node resolution (see above)
import { filterVericiteEvent, GENERIC_CHAT_ERROR_EVENT } from "../../../lib/sse-filter.ts";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "private, no-store, must-revalidate",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

type DemoEnv = Partial<{
  CANONICAL_HOST: string;
  ENVIRONMENT: string;
}>;

function jsonError(message: string, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store, must-revalidate",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

/**
 * Same-origin gate mirroring apps/learn /api/auth and the Worker edge check:
 * production allows exactly https://<canonical host>; dev/qualification also
 * allow the loopback dev origins. Missing or foreign Origin is rejected.
 */
function sameOrigin(request: Request, env: DemoEnv): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let canonicalHost = (env.CANONICAL_HOST ?? "").toLowerCase();
  if (!canonicalHost) {
    canonicalHost = (request.headers.get("host") ?? "").toLowerCase().split(":")[0] ?? "";
  }
  if (!canonicalHost) return false;
  const environment = (env.ENVIRONMENT ?? "").toLowerCase();
  const isProduction = environment !== "qualification" && environment !== "development";
  const allowed = new Set([`https://${canonicalHost}`]);
  if (!isProduction) {
    allowed.add(`http://${canonicalHost}`);
    allowed.add("http://localhost:3000");
    allowed.add("http://localhost:3301");
    allowed.add("http://127.0.0.1:3301");
    allowed.add("http://127.0.0.1:4173");
  }
  return allowed.has(origin);
}

function failureStream(): Response {
  const body = `data: ${GENERIC_CHAT_ERROR_EVENT}\n\ndata: [DONE]\n\n`;
  return new Response(body, { status: 200, headers: { ...SSE_HEADERS } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<Response> {
  // Lazy server modules (see header): any resolution failure fails closed.
  let sessionMod: typeof import("../../../lib/session");
  let chatLimitMod: typeof import("../../../lib/chat-limit");
  let vericiteMod: typeof import("../../../lib/vericite");
  try {
    [sessionMod, chatLimitMod, vericiteMod] = await Promise.all([
      import("../../../lib/session"),
      import("../../../lib/chat-limit"),
      import("../../../lib/vericite"),
    ]);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  // Session BEFORE any upstream contact: an anonymous request must 401 here,
  // with the upstream fetch path unreachable.
  const account = await sessionMod.currentAccount();
  if (!account) {
    return jsonError("Unauthorized", 401);
  }

  let env: DemoEnv = {};
  try {
    env = sessionMod.demoEnv();
  } catch {
    env = {};
  }
  if (!sameOrigin(request, env)) {
    return jsonError("Forbidden (CSRF Origin Mismatch)", 403);
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return jsonError("Bad Request (Malformed JSON)", 400);
  }
  // U2's widget posts {message, sessionId}; the VeriCite contract names the
  // field `query`. Accept both spellings so the frozen widget keeps working.
  const rawQuery = isRecord(parsed) ? (parsed.query ?? parsed.message) : undefined;
  const sessionId = isRecord(parsed) ? parsed.sessionId : undefined;
  if (typeof rawQuery !== "string" || rawQuery.length < 1 || rawQuery.length > 1000) {
    return jsonError("Bad Request (query must be 1-1000 characters)", 400);
  }
  const query: string = rawQuery;
  if (sessionId !== undefined && (typeof sessionId !== "string" || !UUID_RE.test(sessionId))) {
    return jsonError("Bad Request (Invalid session ID)", 400);
  }

  // D1 handle from the same env snapshot (never process.env secrets).
  let db: import("../../../lib/session").D1Like | undefined;
  try {
    db = sessionMod.demoEnv().DEMO_DB;
  } catch {
    db = undefined;
  }
  if (!db) {
    return jsonError("Service Unavailable (Chat Unconfigured)", 503);
  }
  const allowed = await chatLimitMod.checkAndRecord(db, account.accountId);
  if (!allowed) {
    return jsonError("Too Many Requests (Chat budget exceeded)", 429, { "retry-after": "300" });
  }

  let upstream: Response;
  try {
    upstream = await vericiteMod.streamVericiteChat({
      query,
      ...(sessionId ? { sessionId } : {}),
      accountId: account.accountId,
      db,
    });
  } catch {
    return failureStream();
  }

  const reader = upstream.body!.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const doneLine = encoder.encode("data: [DONE]\n\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let errorSent = false;
      let doneSent = false;
      const emitErrorOnce = (): void => {
        if (errorSent) return;
        errorSent = true;
        controller.enqueue(encoder.encode(`data: ${GENERIC_CHAT_ERROR_EVENT}\n\n`));
      };
      const emitDoneOnce = (): void => {
        if (doneSent) return;
        doneSent = true;
        controller.enqueue(doneLine);
      };
      // Returns true when the stream must terminate: an error was seen
      // (emit exactly one generic error, then [DONE]) or upstream sent
      // [DONE] (never emit it twice).
      const pushLine = (line: string): boolean => {
        if (!line.startsWith("data:")) return false;
        const payload = line.slice(5).trimStart();
        if (!payload) return false;
        const out = filterVericiteEvent(payload);
        if (out === null) return false;
        if (out === "[DONE]") {
          emitDoneOnce();
          return true;
        }
        let type: unknown;
        try {
          type = (JSON.parse(out) as Record<string, unknown>).type;
        } catch {
          return false;
        }
        if (type === "error") {
          emitErrorOnce();
          return true;
        }
        controller.enqueue(encoder.encode(`data: ${out}\n\n`));
        return false;
      };
      let stop = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            let idx = buffer.indexOf("\n");
            while (idx >= 0 && !stop) {
              const line = buffer.slice(0, idx).replace(/\r$/, "");
              buffer = buffer.slice(idx + 1);
              if (line.trim() !== "") stop = pushLine(line);
              idx = buffer.indexOf("\n");
            }
          }
          if (done || stop) break;
        }
        if (!stop) {
          buffer += decoder.decode();
          for (const line of buffer.split("\n")) {
            if (stop) break;
            const trimmed = line.replace(/\r$/, "");
            if (trimmed.trim() !== "") stop = pushLine(trimmed);
          }
        }
      } catch {
        emitErrorOnce();
      } finally {
        // Release the upstream body on early termination so a failed or
        // gated stream never holds the connection open behind us.
        if (stop) {
          try {
            await reader.cancel();
          } catch {
            /* already closed */
          }
        }
        emitDoneOnce();
        controller.close();
      }
    },
    async cancel() {
      try {
        await reader.cancel();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, { status: 200, headers: { ...SSE_HEADERS } });
}
