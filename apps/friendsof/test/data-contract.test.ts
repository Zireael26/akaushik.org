import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capabilitiesForRole, normalizedHost, PortalDataError, sha256Hex, stableJson } from "../lib/db";
import { parseSingleByteRange, serveAuthorizedMedia, type R2Bucket } from "../lib/media";
import type { PortalDal } from "../lib/dal";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`ok ${passed} - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

await test("role capabilities default deny", () => {
  assert.equal(capabilitiesForRole("viewer").has("resource.read"), true);
  assert.equal(capabilitiesForRole("viewer").has("resource.edit"), false);
  assert.equal(capabilitiesForRole("commenter").has("publication.approve"), false);
  assert.equal(capabilitiesForRole("owner").has("audit.read"), true);
});

await test("host normalization rejects malformed authority", () => {
  assert.equal(normalizedHost("PORTAL.EXAMPLE."), "portal.example");
  assert.throws(() => normalizedHost("portal.example/path"), PortalDataError);
  assert.throws(() => normalizedHost("portal.example bad"), PortalDataError);
});

await test("stable JSON and SHA-256 are deterministic", async () => {
  assert.equal(stableJson({ b: 2, a: [1, { z: true }] }), '{"a":[1,{"z":true}],"b":2}');
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

await test("chosen single-range policy distinguishes ignored and unsatisfiable", () => {
  assert.deepEqual(parseSingleByteRange(null, 10), { kind: "none" });
  assert.deepEqual(parseSingleByteRange("items=0-1", 10), { kind: "ignore" });
  assert.deepEqual(parseSingleByteRange("bytes=oops", 10), { kind: "ignore" });
  assert.deepEqual(parseSingleByteRange("bytes=0-1,3-4", 10), { kind: "ignore" });
  assert.deepEqual(parseSingleByteRange("bytes=-0", 10), { kind: "unsatisfiable" });
  assert.deepEqual(parseSingleByteRange("bytes=10-", 10), { kind: "unsatisfiable" });
  assert.deepEqual(parseSingleByteRange("bytes=2-4", 10), { kind: "satisfiable", start: 2, end: 4 });
  assert.deepEqual(parseSingleByteRange("bytes=-3", 10), { kind: "satisfiable", start: 7, end: 9 });
});

await test("media authorizes before metadata and implements GET/HEAD/precondition policy", async () => {
  const bytes = new TextEncoder().encode("0123456789");
  const sha = await sha256Hex(bytes);
  let authorizations = 0;
  let heads = 0;
  let gets = 0;
  const dal = {
    authorizeAsset: async () => {
      authorizations++;
      return { principal: {}, row: {
        id: "asset", resource_id: "resource", revision_id: "revision", purpose: "playback",
        parent_asset_id: null, original_filename: "playback.m4a", media_type: "audio/mp4",
        byte_length: bytes.byteLength, sha256: sha, object_key: "private/key", etag: "r2",
        uploaded_at: "2026-09-09T00:00:00.000Z", derivation_tool: "ffmpeg",
        derivation_version: "verified", review_status: "approved",
      } };
    },
  } as unknown as PortalDal;
  const bucket = {
    head: async () => { heads++; return metadata(bytes.byteLength, sha); },
    get: async (_key: string, options?: { range?: { offset: number; length: number } }) => {
      gets++;
      const selected = options?.range ? bytes.slice(options.range.offset, options.range.offset + options.range.length) : bytes;
      return { ...metadata(bytes.byteLength, sha), body: new ReadableStream({ start(controller) { controller.enqueue(selected); controller.close(); } }) };
    },
    put: async () => null,
    delete: async () => undefined,
  } satisfies R2Bucket;

  const unsupported = await serveAuthorizedMedia(new Request("https://portal.test/a", { method: "POST" }), "asset", { dal, bucket });
  assert.equal(unsupported.status, 405); assert.equal(authorizations, 0); assert.equal(heads, 0);

  const head = await serveAuthorizedMedia(new Request("https://portal.test/a", { method: "HEAD", headers: { Range: "bytes=0-0" } }), "asset", { dal, bucket });
  assert.equal(head.status, 200); assert.equal(head.headers.get("content-range"), null); assert.equal(await head.text(), ""); assert.equal(gets, 0);

  const malformed = await serveAuthorizedMedia(new Request("https://portal.test/a", { headers: { Range: "bytes=bad" } }), "asset", { dal, bucket });
  assert.equal(malformed.status, 200); assert.equal(await malformed.text(), "0123456789");
  const multi = await serveAuthorizedMedia(new Request("https://portal.test/a", { headers: { Range: "bytes=0-0,2-2" } }), "asset", { dal, bucket });
  assert.equal(multi.status, 200);
  const unknown = await serveAuthorizedMedia(new Request("https://portal.test/a", { headers: { Range: "items=0-1" } }), "asset", { dal, bucket });
  assert.equal(unknown.status, 200);

  const range = await serveAuthorizedMedia(new Request("https://portal.test/a", { headers: { Range: "bytes=2-4" } }), "asset", { dal, bucket });
  assert.equal(range.status, 206); assert.equal(range.headers.get("content-range"), "bytes 2-4/10"); assert.equal(await range.text(), "234");
  const unsat = await serveAuthorizedMedia(new Request("https://portal.test/a", { headers: { Range: "bytes=-0" } }), "asset", { dal, bucket });
  assert.equal(unsat.status, 416); assert.equal(unsat.headers.get("content-range"), "bytes */10");

  const notModified = await serveAuthorizedMedia(new Request("https://portal.test/a", { headers: {
    "If-None-Match": `"${sha}"`, Range: "bytes=0-0",
  } }), "asset", { dal, bucket });
  assert.equal(notModified.status, 304); assert.equal(notModified.headers.get("content-range"), null);
});

await test("media integrity mismatch emits metadata-only audit/alert and no bytes", async () => {
  let audited = 0;
  let alerted: { workspaceId: string; assetId: string } | null = null;
  const dal = {
    authorizeAsset: async () => ({ principal: { workspaceId: "ws", context: { accountId: "acct" } }, row: {
      id: "asset", resource_id: "resource", revision_id: "revision", purpose: "original",
      parent_asset_id: null, classification: "private", consent_state: "verified",
      original_filename: "private.bin", media_type: "application/octet-stream", byte_length: 10,
      sha256: "a".repeat(64), object_key: "never-log-this", etag: "r2",
      uploaded_at: "2026-09-09T00:00:00.000Z", derivation_tool: null,
      derivation_version: null, review_status: "source",
    } }),
    recordAssetIntegrityFailure: async () => { audited++; },
  } as unknown as PortalDal;
  const bucket = { head: async () => metadata(9, "b".repeat(64)), get: async () => { throw new Error("must not read"); },
    put: async () => null, delete: async () => undefined } satisfies R2Bucket;
  const response = await serveAuthorizedMedia(new Request("https://portal.test/a"), "asset", {
    dal, bucket, onIntegrityFailure: (event) => { alerted = event; },
  });
  assert.equal(response.status, 503); assert.equal(await response.text(), "");
  assert.equal(audited, 1); assert.deepEqual(alerted, { workspaceId: "ws", assetId: "asset" });
});

await test("unauthorized media is indistinguishable and does not touch R2", async () => {
  let touched = false;
  const dal = { authorizeAsset: async () => { throw new PortalDataError("NOT_FOUND", "Not found"); } } as unknown as PortalDal;
  const bucket = { head: async () => { touched = true; return null; }, get: async () => null,
    put: async () => null, delete: async () => undefined } satisfies R2Bucket;
  const response = await serveAuthorizedMedia(new Request("https://portal.test/a"), "foreign", { dal, bucket });
  assert.equal(response.status, 404); assert.equal(response.headers.get("etag"), null); assert.equal(touched, false);
});

await test("migration enforces immutable rows and stale CAS rollback", () => {
  const directory = mkdtempSync(join(tmpdir(), "friendsof-data-"));
  const database = join(directory, "data.sqlite");
  try {
    const migration = readFileSync(new URL("../migrations/0001_core.sql", import.meta.url), "utf8");
    sqlite(database, migration);
    sqlite(database, seedSql());
    expectSqlFailure(database, `UPDATE resource_revisions SET title='tampered' WHERE id='rev1';`, "immutable-revision");
    expectSqlFailure(database, `DELETE FROM audit_events WHERE id='audit1';`, "immutable-audit-event");
    expectSqlFailure(database, `.bail on\nBEGIN;\nINSERT INTO resource_revisions
      (id,resource_id,workspace_id,revision_number,base_revision_id,title,markdown,content_sha256,visibility,evidence_state,author_account_id,created_at)
      VALUES ('loser','res1','ws1',2,NULL,'loser','loser','${"0".repeat(64)}','owner_only','source','acct1','2026-09-09T00:01:00Z');
      INSERT INTO audit_events(id,workspace_id,request_id,actor_account_id,action,target_type,target_id,outcome,occurred_at)
      VALUES('loser-audit','ws1','req','acct1','revision.save','revision','loser','success','2026-09-09T00:01:00Z');\nCOMMIT;`, "stale-base");
    assert.equal(sqlite(database, `SELECT COUNT(*) FROM resource_revisions WHERE id='loser';`).trim(), "0");
    assert.equal(sqlite(database, `SELECT COUNT(*) FROM audit_events WHERE id='loser-audit';`).trim(), "0");
    assert.equal(sqlite(database, `PRAGMA integrity_check;`).trim(), "ok");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

await test("concurrent same-base saves have one complete winner and zero loser residue", async () => {
  const directory = mkdtempSync(join(tmpdir(), "friendsof-cas-"));
  const database = join(directory, "data.sqlite");
  try {
    sqlite(database, readFileSync(new URL("../migrations/0001_core.sql", import.meta.url), "utf8"));
    sqlite(database, seedSql());
    sqlite(database, "PRAGMA journal_mode=WAL;");
    const saves = ["a", "b"].map((suffix) => sqliteProcess(database, concurrentSaveSql(suffix)));
    const results = await Promise.all(saves);
    assert.equal(results.filter((result) => result.code === 0).length, 1);
    assert.equal(results.filter((result) => result.code !== 0).length, 1);
    assert.match(results.find((result) => result.code !== 0)?.stderr ?? "", /stale-base/i);
    assert.equal(sqlite(database, "SELECT COUNT(*) FROM resource_revisions WHERE revision_number=2;").trim(), "1");
    assert.equal(sqlite(database, "SELECT COUNT(*) FROM revision_blocks WHERE revision_id IN ('winner-a','winner-b');").trim(), "1");
    assert.equal(sqlite(database, "SELECT COUNT(*) FROM audit_events WHERE id IN ('audit-a','audit-b');").trim(), "1");
    const head = sqlite(database, "SELECT current_revision_id FROM resources WHERE id='res1';").trim();
    assert.match(head, /^winner-[ab]$/u);
    const loser = head === "winner-a" ? "b" : "a";
    assert.equal(sqlite(database, `SELECT (SELECT COUNT(*) FROM resource_revisions WHERE id='winner-${loser}') +
      (SELECT COUNT(*) FROM revision_blocks WHERE id='block-${loser}') +
      (SELECT COUNT(*) FROM audit_events WHERE id='audit-${loser}');`).trim(), "0");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

console.log(`1..${passed}`);

function metadata(size: number, sha256: string) {
  return { key: "private/key", size, etag: "r2", uploaded: new Date("2026-09-09T00:00:00.000Z"), customMetadata: { sha256 } };
}
function sqlite(database: string, input: string): string {
  return execFileSync("sqlite3", [database], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}
function sqliteProcess(database: string, input: string): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [database]);
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
    child.stdin.end(input);
  });
}
function expectSqlFailure(database: string, input: string, pattern: string): void {
  let message = "";
  try { sqlite(database, input); } catch (error) {
    message = String((error as { stderr?: string }).stderr ?? error);
  }
  assert.match(message, new RegExp(pattern, "i"));
}
function concurrentSaveSql(suffix: string): string { return `.bail on
.timeout 5000
BEGIN IMMEDIATE;
INSERT INTO resource_revisions
(id,resource_id,workspace_id,revision_number,base_revision_id,title,markdown,content_sha256,visibility,evidence_state,author_account_id,created_at)
VALUES('winner-${suffix}','res1','ws1',2,'rev1','Winner ${suffix}','Body','${"b".repeat(64)}','owner_only','source','acct1','2026-09-09T00:02:00Z');
INSERT INTO revision_blocks(id,revision_id,ordinal,block_type,body_sha256)
VALUES('block-${suffix}','winner-${suffix}',0,'paragraph','${"c".repeat(64)}');
INSERT INTO audit_events(id,workspace_id,request_id,actor_account_id,action,target_type,target_id,outcome,occurred_at)
VALUES('audit-${suffix}','ws1','req-${suffix}','acct1','revision.save','revision','winner-${suffix}','success','2026-09-09T00:02:00Z');
UPDATE resources SET current_revision_id='winner-${suffix}',updated_at='2026-09-09T00:02:00Z'
WHERE id='res1' AND current_revision_id='rev1';
COMMIT;
`; }
function seedSql(): string { return `
INSERT INTO workspaces(id,slug,name,status,created_at,updated_at)
VALUES('ws1','workspace','Workspace','active','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO workspace_hosts(host,workspace_id,created_at) VALUES('portal.test','ws1','2026-09-09T00:00:00Z');
INSERT INTO memberships(id,workspace_id,account_id,role,status,joined_at,created_at,updated_at)
VALUES('member1','ws1','acct1','owner','active','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO resources(id,workspace_id,collection_id,slug,kind,lifecycle,current_revision_id,created_by_account_id,created_at,updated_at,archived_at)
VALUES('res1','ws1',NULL,'resource','document','draft',NULL,'acct1','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z',NULL);
INSERT INTO resource_revisions
(id,resource_id,workspace_id,revision_number,base_revision_id,title,markdown,content_sha256,visibility,evidence_state,author_account_id,created_at)
VALUES('rev1','res1','ws1',1,NULL,'Title','Body','${"a".repeat(64)}','owner_only','source','acct1','2026-09-09T00:00:00Z');
UPDATE resources SET current_revision_id='rev1' WHERE id='res1';
INSERT INTO audit_events(id,workspace_id,request_id,actor_account_id,action,target_type,target_id,outcome,occurred_at)
VALUES('audit1','ws1','req1','acct1','resource.create','resource','res1','success','2026-09-09T00:00:00Z');
`; }
