import assert from "node:assert/strict";
import { test } from "node:test";
import worker, { redirectLocation } from "./index.js";

test("preserves path and query", () => {
  assert.equal(redirectLocation("https://akaushik.dev/about?x=1&y=a%20b"), "https://akaushik.org/about?x=1&y=a%20b");
});

test("root maps to root", () => {
  assert.equal(redirectLocation("https://www.akaushik.dev/"), "https://akaushik.org/");
});

test("responds 308 with location, for any method", async () => {
  for (const method of ["GET", "HEAD", "POST"]) {
    const res = worker.fetch(new Request("https://akaushik.dev/a/b?c=d", { method }));
    assert.equal(res.status, 308);
    assert.equal(res.headers.get("location"), "https://akaushik.org/a/b?c=d");
  }
});

test("host header cannot change the target", () => {
  assert.equal(redirectLocation("https://evil.example/x"), "https://akaushik.org/x");
});
