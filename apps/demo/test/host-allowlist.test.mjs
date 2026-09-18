/**
 * (c) Host allowlist isolates the demo portal.
 *
 * demo.akaushik.org and preview.demo.akaushik.org are accepted; neighbouring
 * portals (learn.akaushik.org) and unlisted hosts are rejected fail-closed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedHost } from "../lib/demo-security.ts";

test("accepts the two demo hosts", () => {
  assert.equal(isAllowedHost("demo.akaushik.org"), true);
  assert.equal(isAllowedHost("preview.demo.akaushik.org"), true);
});

test("accepts demo hosts with an explicit port", () => {
  assert.equal(isAllowedHost("demo.akaushik.org:443"), true);
  assert.equal(isAllowedHost("preview.demo.akaushik.org:3000"), true);
});

test("rejects neighbouring portals and unlisted hosts", () => {
  assert.equal(isAllowedHost("learn.akaushik.org"), false);
  assert.equal(isAllowedHost("friendsof.akaushik.org"), false);
  assert.equal(isAllowedHost("akaushik.org"), false);
  assert.equal(isAllowedHost("evil-demo.akaushik.org"), false);
  assert.equal(isAllowedHost("demo.akaushik.org.evil.invalid"), false);
  assert.equal(isAllowedHost(null), false);
  assert.equal(isAllowedHost(""), false);
});
