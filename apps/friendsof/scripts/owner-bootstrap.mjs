#!/usr/bin/env node
/**
 * Owner bootstrap / recovery CLI (private, never runs in production builds).
 *
 * Commands: create | reset-password | revoke-sessions
 * Reads credentials from a root-managed private JSON file given by
 * OWNER_CREDENTIAL_FILE: { "email", "username", "password", "name"?,
 *   "id"? (fixed user id), "accountId"? (fixed account row id) }.
 * The credential file MUST be mode 0600 (rejects otherwise).
 *
 * - Password hashing ALWAYS flows through the qualified hook in lib/password.ts
 *   (OWASP-listed scrypt tuple) — no invented crypto, no raw SQL hashing.
 * - create: single atomic D1 batch (user + credential account inserts).
 *   Existing username/email → nonzero exit, never silent overwrite.
 * - reset-password: single atomic D1 batch (password UPDATE + session DELETE)
 *   so no live session can survive a partial failure.
 * - revoke-sessions: parameterized DELETE; reports changes.
 * - NEVER prints secrets; logs only opaque IDs and row counts.
 * - Public signup stays disabled in the product app (disableSignUp); this CLI
 *   is the only creation path and never opens signup, even temporarily.
 * - Root runs this only after prod readiness; never copy credentials to repo/logs.
 *
 * Required env: OWNER_CREDENTIAL_FILE, CF_API_TOKEN, CF_ACCOUNT_ID, AUTH_D1_ID
 */
import { readFileSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";

const cmd = process.argv[2];
if (!["create", "reset-password", "revoke-sessions"].includes(cmd)) {
  console.error("usage: owner-bootstrap.mjs <create|reset-password|revoke-sessions>");
  process.exit(1);
}

const credPath = process.env.OWNER_CREDENTIAL_FILE;
if (!credPath) {
  console.error("OWNER_CREDENTIAL_FILE is not set; refusing to run.");
  process.exit(1);
}
try {
  const mode = statSync(credPath).mode & 0o777;
  if (mode !== 0o600) {
    console.error(`Owner credential file mode is ${mode.toString(8)}, need 600; refusing to run.`);
    process.exit(1);
  }
} catch {
  console.error("Cannot stat owner credential file; refusing to run.");
  process.exit(1);
}
let cred;
try {
  cred = JSON.parse(readFileSync(credPath, "utf8"));
} catch {
  console.error("Cannot read owner credential file; refusing to run.");
  process.exit(1);
}
for (const k of ["CF_API_TOKEN", "CF_ACCOUNT_ID", "AUTH_D1_ID"]) {
  if (!process.env[k]) {
    console.error(`${k} is not set; refusing to run.`);
    process.exit(1);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
function genId(len = 27) {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % 64];
  return s;
}

const D1_BASE = process.env.D1_API_BASE || "https://api.cloudflare.com/client/v4";
const D1 = `${D1_BASE}/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.AUTH_D1_ID}/query`;
async function d1Batch(statements) {
  // One /query call with N statements executes atomically on D1.
  const res = await fetch(D1, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ batch: statements.map(([sql, params]) => ({ sql, params })) }),
  });
  if (!res.ok) throw new Error(`D1 request failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors).slice(0, 300)}`);
  return data.result;
}
async function d1One(sql, params) {
  const [r] = await d1Batch([[sql, params]]);
  return r.results?.[0] ?? null;
}

const username = typeof cred?.username === "string" ? cred.username : "";
if (!username || username.length < 3) {
  console.error("Owner credential file has invalid username; refusing to run.");
  process.exit(1);
}

if (cmd === "create") {
  const email = typeof cred.email === "string" ? cred.email.toLowerCase() : "";
  const password = typeof cred.password === "string" ? cred.password : "";
  const name = typeof cred.name === "string" && cred.name ? cred.name : username;
  if (!EMAIL_RE.test(email)) {
    console.error("Owner credential file has invalid email; refusing to run.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Owner credential password is below minimum length 8; refusing to run.");
    process.exit(1);
  }
  const dup = await d1One("SELECT id FROM user WHERE username = ?1 OR email = ?2", [
    username.toLowerCase(),
    email,
  ]);
  if (dup) {
    console.error(`Identity already exists id=${JSON.stringify(dup.id)}; refusing silent overwrite.`);
    process.exit(1);
  }
  const { hashPassword } = await import("../lib/password.ts");
  const now = new Date().toISOString();
  const userId = typeof cred.id === "string" && cred.id ? cred.id : genId();
  const accountRowId = typeof cred.accountId === "string" && cred.accountId ? cred.accountId : genId();
  const hash = await hashPassword(password);
  try {
    await d1Batch([
      [
        "INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt, username, displayUsername) VALUES (?1,?2,?3,0,NULL,?4,?4,?5,?6)",
        [userId, name, email, now, username.toLowerCase(), username],
      ],
      [
        "INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?1,?2,'credential',?2,?3,?4,?4)",
        [accountRowId, userId, hash, now],
      ],
    ]);
  } catch (e) {
    console.error(`Atomic create failed, nothing applied: ${e.message || e}`);
    process.exit(1);
  }
  console.error(`owner created userId=${JSON.stringify(userId)}`);
  process.exit(0);
}

if (cmd === "revoke-sessions") {
  const row = await d1One("SELECT id FROM user WHERE username = ?1", [username.toLowerCase()]);
  if (!row) {
    console.error("no such user; nothing revoked.");
    process.exit(1);
  }
  const [del] = await d1Batch([["DELETE FROM session WHERE userId = ?1", [row.id]]]);
  console.error(`revoked sessions userId=${JSON.stringify(row.id)} changes=${del.meta?.changes ?? "?"}`);
  process.exit(0);
}

if (cmd === "reset-password") {
  const password = typeof cred.password === "string" ? cred.password : "";
  if (password.length < 8) {
    console.error("Owner credential password is below minimum length 8; refusing to run.");
    process.exit(1);
  }
  const { hashPassword } = await import("../lib/password.ts");
  const row = await d1One("SELECT id FROM user WHERE username = ?1", [username.toLowerCase()]);
  if (!row) {
    console.error("no such user; refusing to run.");
    process.exit(1);
  }
  const acc = await d1One("SELECT id FROM account WHERE userId = ?1 AND providerId = 'credential'", [row.id]);
  if (!acc) {
    console.error("no credential account for user; refusing to run.");
    process.exit(1);
  }
  const hash = await hashPassword(password);
  // Atomic: password rotation + full session revocation in one D1 batch.
  try {
    const [, del] = await d1Batch([
      ["UPDATE account SET password = ?1, updatedAt = ?2 WHERE userId = ?3 AND providerId = 'credential'", [hash, new Date().toISOString(), row.id]],
      ["DELETE FROM session WHERE userId = ?1", [row.id]],
    ]);
    console.error(
      `password rotated userId=${JSON.stringify(row.id)} sessionsRevoked=${del.meta?.changes ?? "?"}`,
    );
  } catch (e) {
    console.error(`Atomic reset failed, nothing applied: ${e.message || e}`);
    process.exit(1);
  }
  process.exit(0);
}
