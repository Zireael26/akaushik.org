#!/usr/bin/env node
/**
 * Demo account CLI for demo.akaushik.org (private; never runs in a build).
 *
 * Public signup is disabled in the app (better-auth `disableSignUp`), so this
 * is the only way an account comes into existence. That is the entire access
 * model: the demo is visible to exactly the people whose accounts you
 * created here, and a leaked URL grants nothing.
 *
 * Commands:
 *   create            add one or more accounts
 *   reset-password    rotate a password and kill that account's sessions
 *   revoke-sessions   kill an account's sessions, leaving the account
 *   remove            delete the account and its sessions
 *   list              print usernames and created dates (no secrets)
 *
 * Credentials come from a root-managed private JSON file named by
 * READER_CREDENTIAL_FILE, which must be mode 0600. It holds either one account
 * object or an array of them:
 *
 *   { "email": "...", "username": "...", "password": "...", "name": "..." }
 *
 * Adapted from apps/learn/scripts/reader-accounts.mjs. The properties kept
 * deliberately: hashing always goes through lib/password.ts (the qualified
 * OWASP scrypt tuple, never raw SQL), creates are refused rather than
 * overwriting an existing identity, password rotation and session revocation
 * happen in one atomic D1 batch so no live session outlives a partial failure,
 * and nothing secret is ever printed.
 *
 * Two transports to D1:
 *
 *   REST (preferred). Set CF_API_TOKEN, CF_ACCOUNT_ID and AUTH_D1_ID. Every
 *   value is bound, and a multi-statement batch commits atomically.
 *
 *   Wrangler (fallback). Set DEMO_AUTH_DB to the database *name* and run with
 *   a logged-in wrangler. Use this when the available API token has no D1
 *   permission. It is a genuine downgrade and the script says so: the CLI has
 *   no bind parameters, so values are escaped and interpolated, and a batch is
 *   NOT atomic. `create` therefore verifies its own result and undoes a partial
 *   write rather than leaving an account nobody can sign in to.
 *
 * Required env: READER_CREDENTIAL_FILE, plus one transport's variables.
 * Chat-state cleanup on `remove` is deferred to the chat unit, which owns the
 * DEMO_DB schema; `remove` today deletes only the AUTH_DB rows and says so.
 */
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const COMMANDS = ["create", "reset-password", "revoke-sessions", "remove", "list"];
const cmd = process.argv[2];
if (!COMMANDS.includes(cmd)) {
  console.error(`usage: demo-accounts.mjs <${COMMANDS.join("|")}>`);
  process.exit(1);
}

const USE_REST = Boolean(process.env.CF_API_TOKEN);

if (USE_REST) {
  for (const key of ["CF_ACCOUNT_ID", "AUTH_D1_ID"]) {
    if (!process.env[key]) {
      console.error(`${key} is not set; refusing to run.`);
      process.exit(1);
    }
  }
} else if (!process.env.DEMO_AUTH_DB) {
  console.error(
    "Set CF_API_TOKEN (+ CF_ACCOUNT_ID, AUTH_D1_ID) for the REST transport, " +
      "or DEMO_AUTH_DB for the wrangler transport; refusing to run.",
  );
  process.exit(1);
} else {
  console.error(
    "Using the wrangler transport: values are escaped rather than bound, and " +
      "batches are not atomic. `create` verifies and rolls itself back.",
  );
}

const D1_BASE = process.env.D1_API_BASE || "https://api.cloudflare.com/client/v4";

function d1Url(databaseId) {
  return `${D1_BASE}/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${databaseId}/query`;
}

/**
 * Renders one bound value as a SQL literal for the wrangler transport.
 * Conservative on purpose: only the three shapes this script actually passes
 * are accepted, and anything else is a bug rather than something to coerce.
 */
function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number in SQL");
    return String(value);
  }
  if (typeof value !== "string") throw new Error(`unsupported SQL value: ${typeof value}`);
  if (value.includes("\u0000")) throw new Error("NUL byte in SQL value");
  return `'${value.replaceAll("'", "''")}'`;
}

function inlineParams(sql, params) {
  // ?1-based, matching the REST call sites above.
  return sql.replace(/\?(\d+)/g, (_match, index) => literal(params[Number(index) - 1]));
}

// DEMO_WRANGLER_TARGET picks the database the fallback transport writes to:
// "production" (default), "preview" (the top-level config) or "local" (the
// miniflare state `pnpm dev` reads).
const WRANGLER_TARGET = {
  production: ["--env", "production", "--remote"],
  preview: ["--remote"],
  local: ["--local"],
}[process.env.DEMO_WRANGLER_TARGET ?? "production"];
if (!WRANGLER_TARGET) {
  console.error("DEMO_WRANGLER_TARGET must be production, preview or local; refusing to run.");
  process.exit(2);
}

function wranglerExecute(sql, databaseName) {
  // `--command`, not `--file`. The file form returns a summary ("Total queries
  // executed", "Rows read") instead of the rows, so every read through it comes
  // back as one meaningless object. Passing SQL through execFileSync argv also
  // means no shell is involved and nothing needs shell-escaping; the statements
  // here are small, the largest value being a 160-character scrypt hash.
  const out = execFileSync(
    "pnpm",
    [
      "exec", "wrangler", "d1", "execute", databaseName,
      ...WRANGLER_TARGET, "--json", "--command", sql,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 16 * 1024 * 1024 },
  );

  // wrangler prints a progress banner before the JSON. Anchor on a line that is
  // exactly "[" rather than the first bracket anywhere in the output.
  const lines = out.split("\n");
  const start = lines.findIndex((line) => line.trim() === "[");
  if (start < 0) throw new Error("wrangler returned no JSON");
  return JSON.parse(lines.slice(start).join("\n"));
}

const DB_NAMES = {
  auth: process.env.DEMO_AUTH_DB,
};

async function d1Batch(statements, databaseId = process.env.AUTH_D1_ID) {
  if (USE_REST) {
    // One /query call with N statements executes atomically on D1.
    const res = await fetch(d1Url(databaseId), {
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

  const name = DB_NAMES.auth;
  if (!name) throw new Error("No database name configured for the wrangler transport");
  const sql = statements.map(([text, params]) => inlineParams(text, params)).join(";\n") + ";";
  return wranglerExecute(sql, name);
}

async function d1One(sql, params, databaseId) {
  const [result] = await d1Batch([[sql, params]], databaseId);
  return result.results?.[0] ?? null;
}

async function d1All(sql, params, databaseId) {
  const [result] = await d1Batch([[sql, params]], databaseId);
  return result.results ?? [];
}

/* ---------------------------------------------------------------- *
 * `list` needs no credential file.
 * ---------------------------------------------------------------- */

if (cmd === "list") {
  const rows = await d1All("SELECT username, displayUsername, createdAt FROM user ORDER BY createdAt", []);
  if (rows.length === 0) {
    console.error("no accounts.");
    process.exit(0);
  }
  for (const row of rows) {
    console.log(`${row.displayUsername || row.username}\t${row.createdAt}`);
  }
  process.exit(0);
}

/* ---------------------------------------------------------------- *
 * Credential file
 * ---------------------------------------------------------------- */

const credPath = process.env.READER_CREDENTIAL_FILE;
if (!credPath) {
  console.error("READER_CREDENTIAL_FILE is not set; refusing to run.");
  process.exit(1);
}
try {
  const mode = statSync(credPath).mode & 0o777;
  if (mode !== 0o600) {
    console.error(`Credential file mode is ${mode.toString(8)}, need 600; refusing to run.`);
    process.exit(1);
  }
} catch {
  console.error("Cannot stat credential file; refusing to run.");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(credPath, "utf8"));
} catch {
  console.error("Cannot read credential file; refusing to run.");
  process.exit(1);
}

const readers = Array.isArray(parsed) ? parsed : [parsed];
if (readers.length === 0) {
  console.error("Credential file contains no accounts; refusing to run.");
  process.exit(1);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

function genId(len = 27) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % 64];
  return out;
}

function requireUsername(reader) {
  const username = typeof reader?.username === "string" ? reader.username : "";
  if (!username || username.length < 3) {
    console.error("An account entry has an invalid username; refusing to run.");
    process.exit(1);
  }
  return username;
}

function requirePassword(reader) {
  const password = typeof reader?.password === "string" ? reader.password : "";
  // 12, not better-auth's 8. These are shared by hand with friends and then
  // typed rarely, so there is no usability argument for a short one.
  if (password.length < 12) {
    console.error("An account password is below minimum length 12; refusing to run.");
    process.exit(1);
  }
  return password;
}

// Validate every entry before writing any of them: a half-applied batch of
// friends is worse than a refusal you can fix in the file.
for (const reader of readers) {
  requireUsername(reader);
  if (cmd === "create") {
    requirePassword(reader);
    const email = typeof reader.email === "string" ? reader.email.toLowerCase() : "";
    if (!EMAIL_RE.test(email)) {
      console.error(`Account ${JSON.stringify(reader.username)} has an invalid email; refusing to run.`);
      process.exit(1);
    }
  }
  if (cmd === "reset-password") requirePassword(reader);
}

const { hashPassword } = await import("../lib/password.ts");

/* ---------------------------------------------------------------- *
 * Commands
 * ---------------------------------------------------------------- */

/** Best-effort cleanup for the non-atomic transport. Never used under REST. */
async function undoPartialCreate(userId, username) {
  try {
    await d1Batch([
      ["DELETE FROM account WHERE userId = ?1", [userId]],
      ["DELETE FROM user WHERE id = ?1", [userId]],
    ]);
    console.error(`${username}: partial create undone.`);
  } catch (error) {
    console.error(
      `${username}: could not undo partial create (${error.message || error}). ` +
        `Remove userId=${JSON.stringify(userId)} by hand before retrying.`,
    );
  }
}

if (cmd === "create") {
  for (const reader of readers) {
    const username = requireUsername(reader);
    const email = reader.email.toLowerCase();
    const name = typeof reader.name === "string" && reader.name ? reader.name : username;

    const duplicate = await d1One("SELECT id FROM user WHERE username = ?1 OR email = ?2", [
      username.toLowerCase(),
      email,
    ]);
    if (duplicate) {
      console.error(
        `${username}: identity already exists id=${JSON.stringify(duplicate.id)}; refusing silent overwrite.`,
      );
      process.exit(1);
    }

    const now = new Date().toISOString();
    const userId = typeof reader.id === "string" && reader.id ? reader.id : genId();
    const accountRowId = typeof reader.accountId === "string" && reader.accountId ? reader.accountId : genId();
    const hash = await hashPassword(requirePassword(reader));

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
    } catch (error) {
      console.error(`${username}: create failed: ${error.message || error}`);
      if (!USE_REST) await undoPartialCreate(userId, username);
      process.exit(1);
    }

    // The wrangler transport is not atomic, so the success of the call is not
    // evidence that both rows landed. Read the state back; a user row without a
    // credential row is an account nobody can sign in to and that `create`
    // would refuse to retry, so it is removed rather than reported as created.
    if (!USE_REST) {
      const credential = await d1One(
        "SELECT id FROM account WHERE userId = ?1 AND providerId = 'credential'",
        [userId],
      );
      if (!credential) {
        console.error(`${username}: credential row missing after create; undoing.`);
        await undoPartialCreate(userId, username);
        process.exit(1);
      }
    }

    console.error(`created ${username} userId=${JSON.stringify(userId)}`);
  }
  process.exit(0);
}

if (cmd === "revoke-sessions") {
  for (const reader of readers) {
    const username = requireUsername(reader);
    const row = await d1One("SELECT id FROM user WHERE username = ?1", [username.toLowerCase()]);
    if (!row) {
      console.error(`${username}: no such account; nothing revoked.`);
      process.exit(1);
    }
    const [deleted] = await d1Batch([["DELETE FROM session WHERE userId = ?1", [row.id]]]);
    console.error(`${username}: sessions revoked changes=${deleted.meta?.changes ?? "?"}`);
  }
  process.exit(0);
}

if (cmd === "reset-password") {
  for (const reader of readers) {
    const username = requireUsername(reader);
    const row = await d1One("SELECT id FROM user WHERE username = ?1", [username.toLowerCase()]);
    if (!row) {
      console.error(`${username}: no such account; refusing to run.`);
      process.exit(1);
    }
    const account = await d1One(
      "SELECT id FROM account WHERE userId = ?1 AND providerId = 'credential'",
      [row.id],
    );
    if (!account) {
      console.error(`${username}: no credential account; refusing to run.`);
      process.exit(1);
    }

    const hash = await hashPassword(requirePassword(reader));
    try {
      // Rotation and revocation in one batch: a password change that left the
      // old sessions alive would not be a password change.
      const [, deleted] = await d1Batch([
        [
          "UPDATE account SET password = ?1, updatedAt = ?2 WHERE userId = ?3 AND providerId = 'credential'",
          [hash, new Date().toISOString(), row.id],
        ],
        ["DELETE FROM session WHERE userId = ?1", [row.id]],
      ]);
      console.error(
        `${username}: password rotated sessionsRevoked=${deleted.meta?.changes ?? "?"}`,
      );
    } catch (error) {
      console.error(`${username}: atomic reset failed, nothing applied: ${error.message || error}`);
      process.exit(1);
    }
  }
  process.exit(0);
}

if (cmd === "remove") {
  for (const reader of readers) {
    const username = requireUsername(reader);
    const row = await d1One("SELECT id FROM user WHERE username = ?1", [username.toLowerCase()]);
    if (!row) {
      console.error(`${username}: no such account; nothing removed.`);
      process.exit(1);
    }

    // AUTH_DB rows only. DEMO_DB chat-state cleanup belongs to the chat unit,
    // which owns that schema; until it lands there is nothing else to delete.
    await d1Batch([
      ["DELETE FROM session WHERE userId = ?1", [row.id]],
      ["DELETE FROM account WHERE userId = ?1", [row.id]],
      ["DELETE FROM user WHERE id = ?1", [row.id]],
    ]);

    console.error(`${username}: removed userId=${JSON.stringify(row.id)}`);
  }
  process.exit(0);
}
