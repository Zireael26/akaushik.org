/**
 * (f) The upstream visitor credential outlives any one isolate.
 *
 * The upstream binds a conversation to the visitor id that opened it, so a
 * second isolate (simulated by a fresh module instance) must reuse the
 * credential stored in DEMO_DB instead of minting a new visitor id.
 */
import test from "node:test";
import assert from "node:assert/strict";

function fakeD1() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...v) {
          return {
            async first() {
              const r = rows.get(v[0]);
              return /^SELECT/.test(sql) && r ? { ...r } : null;
            },
            async all() {
              return { success: true, results: [] };
            },
            async run() {
              if (/^INSERT/.test(sql)) rows.set(v[0], { credential: v[1], visitor_id: v[2], expires_at: v[3] });
              if (/^DELETE/.test(sql)) rows.delete(v[0]);
              return { success: true };
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

test("second isolate reuses the stored credential; no second mint", async () => {
  process.env.VERICITE_API_BASE = "https://api.example.test";
  process.env.VERICITE_API_KEY = "test-key";
  process.env.VERICITE_CHANNEL_ID = "test-channel";
  const db = fakeD1();
  let mints = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /visitor-credential$/);
    mints += 1;
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          visitorId: `00000000-0000-4000-8000-00000000000${mints}`,
          visitorCredential: `cred-${mints}`,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const a = await import("../lib/vericite.ts?isolate=a");
    const b = await import("../lib/vericite.ts?isolate=b");
    const first = await a.getVisitorCredential(db, "acct-1");
    const second = await b.getVisitorCredential(db, "acct-1");
    assert.equal(mints, 1, "a second isolate must not mint again");
    assert.equal(second.visitorId, first.visitorId);
    assert.equal(db.rows.get("acct-1").visitor_id, first.visitorId);
  } finally {
    globalThis.fetch = realFetch;
  }
});
