/**
 * (e) Upstream failure → exactly one generic error event + [DONE].
 *
 * No upstream body bytes may leak to the browser. Under plain node there is
 * no forgeable session (currentAccount() is null outside the Cloudflare
 * runtime), so the suite pins the contract at its two reachable seams:
 *   1. the filter maps any upstream error frame to the single generic message;
 *   2. the route source emits exactly `data: <generic>\n\ndata: [DONE]` on
 *      upstream failure (mint throws) and on mid-stream throws, and never
 *      interpolates upstream text into the stream;
 *   3. an unauthenticated POST still 401s with upstream untouched.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterVericiteEvent, GENERIC_CHAT_ERROR_EVENT } from "../lib/sse-filter.ts";
import { POST } from "../app/api/chat/route.ts";

const ROUTE_SRC = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const UPSTREAM_SECRET = "upstream-internal-failure-acme-tower";

test("filter maps upstream errors to the generic event", () => {
  const out = filterVericiteEvent(JSON.stringify({ type: "error", message: UPSTREAM_SECRET }));
  assert.equal(out, GENERIC_CHAT_ERROR_EVENT);
  assert.doesNotMatch(out, new RegExp(UPSTREAM_SECRET));
});

test("route failure path emits one generic error + [DONE], no upstream bytes", () => {
  assert.match(
    ROUTE_SRC,
    /data: \$\{GENERIC_CHAT_ERROR_EVENT\}\\n\\ndata: \[DONE\]/,
    "mint-failure stream must be exactly one generic error + [DONE]",
  );
  assert.match(ROUTE_SRC, /catch \{\s*return failureStream\(\);\s*\}/, "upstream throw → failureStream");
  assert.doesNotMatch(ROUTE_SRC, /String\(err/, "route must never interpolate upstream errors");
  assert.doesNotMatch(ROUTE_SRC, /err\.message/, "route must never forward upstream messages");
});

test("unauthenticated POST still 401s with upstream untouched", async () => {
  let fetchCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error(UPSTREAM_SECRET);
  };
  try {
    const req = new Request("https://demo.akaushik.org/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://demo.akaushik.org",
      },
      body: JSON.stringify({ query: "Tell me about Widget Corp" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 401);
    assert.equal(fetchCalls, 0, "upstream must stay untouched");
  } finally {
    globalThis.fetch = realFetch;
  }
});
