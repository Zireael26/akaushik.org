/**
 * (a) SSE filter contract — lib/sse-filter.ts (U3 implementation).
 *
 * The proxy re-emits only allowlisted VeriCite events with strict per-type
 * field projections, and drops everything else (metadata, suggested
 * follow-ups, telemetry) before bytes reach the browser. Fixture data is
 * invented ("Acme Tower" / "Widget Corp" — never real client material).
 *
 * Removal guard: the route-import test fails if /api/chat stops going
 * through the filter module, and the drop tests fail if the allowlist is
 * widened or the filter is bypassed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterSseEvent,
  filterVericiteEvent,
  GENERIC_CHAT_ERROR_EVENT,
} from "../lib/sse-filter.ts";

const FILTER_SRC = readFileSync(new URL("../lib/sse-filter.ts", import.meta.url), "utf8");
const ROUTE_SRC = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");

const UPSTREAM_SOURCE = {
  document_id: "acme-tower-overview",
  title: "Acme Tower — overview",
  page: 3,
  excerpt: "Acme Tower completed its lobby retrofit in spring.",
  url: "https://example.invalid/acme-tower",
  cost: 0.0042,
  model: "internal-reranker-9",
  score: 0.981,
  verification: { verdict: "supported", confidence: 0.93, extra: "internal-debug-trace" },
};

test("route re-emits upstream only through the filter module", () => {
  assert.match(ROUTE_SRC, /lib\/sse-filter/, "route must import lib/sse-filter");
  assert.match(ROUTE_SRC, /filterVericiteEvent|filterSseEvent/, "route must call the filter");
});

test("filter keeps a strict type allowlist; telemetry types are dropped", () => {
  for (const key of ["chunk", "sources", "revised_answer", "answer_gated", "answer_verification", "error"]) {
    assert.match(FILTER_SRC, new RegExp(`["']${key}["']`), `filter must name kept type ${key}`);
  }
  for (const evt of [
    { type: "metadata", session: "x", cost: 1, model_used: "internal-9" },
    { type: "suggested_followups", items: ["Tell me about Acme Tower"] },
    { type: "reflection_skipped", reason: "x" },
    { type: "provenance", data: {} },
    { type: "usage", cost: 1 },
  ]) {
    assert.equal(filterSseEvent(evt), null, `${evt.type} must be dropped`);
  }
  assert.equal(filterSseEvent("not-an-object"), null, "non-objects are dropped");
});

test("sources are projected to id/title/page/excerpt/url + bare verdict", () => {
  const out = filterSseEvent({ type: "sources", sources: [UPSTREAM_SOURCE] });
  assert.ok(out, "sources event must pass the allowlist");
  assert.equal(out.type, "sources");
  assert.deepEqual(out.sources, [
    {
      id: "acme-tower-overview",
      title: "Acme Tower — overview",
      page: 3,
      excerpt: "Acme Tower completed its lobby retrofit in spring.",
      url: "https://example.invalid/acme-tower",
      verification: { verdict: "supported" },
    },
  ]);
  const text = JSON.stringify(out);
  for (const key of ["cost", "model", "score", "confidence", "extra"]) {
    assert.doesNotMatch(text, new RegExp(`"${key}"`), `filtered output must not contain ${key}`);
  }
});

test("chunk passes the text delta only; revised_answer and gated are strict", () => {
  const chunk = filterSseEvent({ type: "chunk", data: "Widget Corp", model_used: "internal-9", execution_cost: { input_tokens: 3 } });
  assert.deepEqual(chunk, { type: "chunk", data: "Widget Corp" }, "chunk keeps data only");
  const revised = filterSseEvent({ type: "revised_answer", data: "Acme Tower summary", confidence_score: 0.9, model_used: "internal-9" });
  assert.deepEqual(revised, { type: "revised_answer", data: "Acme Tower summary" });
  const gated = filterSseEvent({ type: "answer_gated", data: { action: "abstain", groundedness_score: 0.1, session_id: "secret" } });
  assert.deepEqual(gated, { type: "answer_gated" }, "gated drops its whole payload");
  assert.doesNotMatch(JSON.stringify([chunk, revised, gated]), /model_used|execution_cost|groundedness_score|session_id/);
});

test("verification collapses to verdict; errors become the generic message", () => {
  const out = filterSseEvent({
    type: "answer_verification",
    data: { verdict: "supported", confidence: 0.93, claim_spans: [] },
  });
  assert.deepEqual(out, { type: "answer_verification", answer_verification: { verdict: "supported" } });
  const err = filterSseEvent({ type: "error", message: "internal-acme-tower-failure", code: 500 });
  assert.deepEqual(err, { type: "error", data: "The assistant could not complete this response." });
  assert.doesNotMatch(JSON.stringify(err), /internal-acme-tower-failure/);
  assert.equal(filterVericiteEvent("[DONE]"), "[DONE]", "[DONE] sentinel passes through");
  assert.equal(
    filterVericiteEvent(JSON.stringify({ type: "error", message: "x" })),
    GENERIC_CHAT_ERROR_EVENT,
    "string-level helper maps errors to the generic event",
  );
});
