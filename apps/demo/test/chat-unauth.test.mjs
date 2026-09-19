/**
 * (b) /api/chat requires a session and never touches upstream without one.
 *
 * Global fetch throws on any call, so any upstream attempt fails loudly.
 * The request carries no session cookie; outside the Cloudflare runtime
 * currentAccount() resolves null, and the route must answer 401 JSON.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/chat/route.ts";

test("POST /api/chat without a session → 401 JSON, upstream untouched", async () => {
  let fetchCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("upstream must not be called without a session");
  };
  try {
    const req = new Request("https://demo.akaushik.org/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://demo.akaushik.org",
      },
      body: JSON.stringify({ query: "Tell me about Acme Tower" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 401, "anonymous chat POST must be 401");
    const body = await res.json();
    assert.equal(typeof body.error, "string", "401 body must carry a JSON error");
    assert.equal(fetchCalls, 0, "upstream fetch must not be called without a session");
  } finally {
    globalThis.fetch = realFetch;
  }
});
