import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RequestContext } from "../lib/contracts";
import { createPortalDal } from "../lib/dal";
import {
  type D1Database,
  type D1PreparedStatement,
  type D1Result,
  PortalDataError,
  readableRevision,
  resolvePrincipal,
} from "../lib/db";

const directory = mkdtempSync(join(tmpdir(), "friendsof-acl-"));
const database = join(directory, "data.sqlite");
let count = 0;

async function main(): Promise<void> {
try {
  sql(readFileSync(new URL("../migrations/0001_core.sql", import.meta.url), "utf8"));
  sql(buildSeed());
  const db = new SqliteD1(database);
  const context: RequestContext = {
    accountId: "acct1",
    sessionId: "session1",
    host: "portal.test",
    authenticatedAt: "2026-09-09T00:00:00Z",
    expiresAt: "2026-09-10T00:00:00Z",
  };

  await check("exact host resolves only active persisted membership", async () => {
    const principal = await resolvePrincipal(db, context);
    assert.equal(principal.workspaceId, "ws1");
    assert.equal(principal.membershipId, "member1");
    assert.equal(principal.role, "viewer");
    await assert.rejects(() => resolvePrincipal(db, { ...context, host: "foreign.test" }),
      (error: unknown) => error instanceof PortalDataError && error.code === "UNAUTHENTICATED");
  });

  await check("exact active release plus resource allow is readable", async () => {
    const principal = await resolvePrincipal(db, context);
    const row = await readableRevision(db, principal, "shared", "shared-r1");
    assert.equal(row?.title, "Shared exact revision");
    assert.equal(row?.workspace_id, "ws1");
  });

  await check("answer drafts are visible only to their own author", async () => {
    const dal = createPortalDal({ db, getRequestContext: async () => context });
    const result = await dal.questions("shared", "shared-r1");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value[0]?.answers.map((answer) => answer.id).sort(), ["answer-own-draft", "answer-submitted"]);
    assert.equal(result.value[0]?.answers.some((answer) => answer.id === "answer-other-draft"), false);
  });

  await check("broken and hidden-resolved links collapse for non-author readers", async () => {
    const dal = createPortalDal({ db, getRequestContext: async () => context });
    const result = await dal.getResource("shared", "shared-r1");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.links.length, 2);
    for (const link of result.value.links) {
      assert.equal(link.status, "unavailable");
      assert.equal(link.target, "");
      assert.equal(link.targetResourceId, null);
    }
  });

  await check("server link catalog contains only exact authorized revisions and assets", async () => {
    const dal = createPortalDal({ db, getRequestContext: async () => context });
    const summaries = await dal.listResources();
    assert.equal(summaries.ok, true);
    if (!summaries.ok) return;
    assert.equal(summaries.value.some((resource) => 'sourceRef' in resource), false, 'public summaries do not expose source refs');

    const result = await dal.authorizedLinkCatalog();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const ids = result.value.map((entry) => entry.id);
    assert.equal(ids.includes('shared'), true);
    assert.equal(ids.includes('asset-shared'), true);
    assert.equal(ids.includes('hidden'), false);
    assert.equal(ids.includes('asset-hidden'), false);
    assert.equal(ids.includes('asset-private-released'), false, 'a release cannot override private classification');
    assert.equal(ids.includes('foreign'), false);
    assert.equal(result.value.find((entry) => entry.id === 'shared')?.sourceRef, 'research/meeting/README.md');
    assert.equal(result.value.find((entry) => entry.id === 'asset-shared')?.sourceRef, 'research/meeting/output/shared.pdf');

    const resource = await dal.getResource('shared', 'shared-r1');
    assert.equal(resource.ok, true);
    if (resource.ok) {
      assert.deepEqual(resource.value.assets.map((asset) => asset.id), ['asset-shared']);
    }
    await assert.rejects(() => dal.authorizeAsset('asset-private-released'),
      (error: unknown) => error instanceof PortalDataError && error.code === 'NOT_FOUND');
  });

  await check("resource deny wins without leaking a row", async () => {
    sql(`INSERT INTO resource_grants
      (id,workspace_id,resource_id,revision_id,subject_type,subject_id,permission,effect,created_by_account_id,created_at)
      VALUES('deny1','ws1','shared','shared-r1','member','member1','read','deny','acct-owner','2026-09-09T00:01:00Z');`);
    const principal = await resolvePrincipal(db, context);
    assert.equal(await readableRevision(db, principal, "shared", "shared-r1"), null);
    sql("UPDATE resource_grants SET revoked_at='2026-09-09T00:02:00Z' WHERE id='deny1';");
    assert.equal((await readableRevision(db, principal, "shared", "shared-r1"))?.revision_id, "shared-r1");
  });

  await check("collection inheritance works only when explicitly enabled", async () => {
    const principal = await resolvePrincipal(db, context);
    assert.equal((await readableRevision(db, principal, "inherited", "inherited-r1"))?.revision_id, "inherited-r1");
    sql("UPDATE collections SET grants_inherit=0 WHERE id='collection1';");
    assert.equal(await readableRevision(db, principal, "inherited", "inherited-r1"), null);
  });

  await check("foreign workspace and unselected revisions are hidden", async () => {
    const principal = await resolvePrincipal(db, context);
    assert.equal(await readableRevision(db, principal, "foreign", "foreign-r1"), null);
    assert.equal(await readableRevision(db, principal, "selected", "selected-r1"), null);
    sql("INSERT INTO revision_selected_members(revision_id,membership_id) VALUES('selected-r1','member1');");
    assert.equal((await readableRevision(db, principal, "selected", "selected-r1"))?.revision_id, "selected-r1");
  });

  await check("search filters authorization before its result limit", async () => {
    sql(searchDisplacementSeed());
    const dal = createPortalDal({ db, getRequestContext: async () => context });
    const result = await dal.search("needle", 20);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.map((hit) => hit.resource.id), ["shared"]);
  });

  await check("membership disable revokes on next principal resolution", async () => {
    sql("UPDATE memberships SET status='disabled' WHERE id='member1';");
    await assert.rejects(() => resolvePrincipal(db, context),
      (error: unknown) => error instanceof PortalDataError && error.code === "UNAUTHENTICATED");
  });

  console.log(`1..${count}`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

class SqliteD1 implements D1Database {
  constructor(private readonly filename: string) {}
  prepare(statement: string): D1PreparedStatement { return new SqliteStatement(this.filename, statement); }
  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const body = statements.map((statement) => (statement as SqliteStatement).boundSql()).join(";\n");
    execFileSync("sqlite3", [this.filename], { input: `.bail on\nBEGIN IMMEDIATE;\n${body};\nCOMMIT;`, encoding: "utf8" });
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  }
}

class SqliteStatement implements D1PreparedStatement {
  private values: unknown[] = [];
  constructor(private readonly filename: string, private readonly statement: string) {}
  bind(...values: unknown[]): D1PreparedStatement { this.values = values; return this; }
  boundSql(): string {
    return this.statement.replace(/\?(\d+)/gu, (_match, index: string) => literal(this.values[Number(index) - 1]));
  }
  async first<T>(): Promise<T | null> { return (await this.rows<T>())[0] ?? null; }
  async all<T>(): Promise<D1Result<T>> { return { success: true, results: await this.rows<T>() }; }
  async run<T>(): Promise<D1Result<T>> {
    execFileSync("sqlite3", [this.filename], { input: this.boundSql(), encoding: "utf8" });
    return { success: true, results: [] };
  }
  private async rows<T>(): Promise<T[]> {
    const output = execFileSync("sqlite3", ["-json", this.filename], { input: this.boundSql(), encoding: "utf8" }).trim();
    return output ? JSON.parse(output) as T[] : [];
  }
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/gu, "''")}'`;
}
function sql(input: string): string {
  return execFileSync("sqlite3", [database], { input, encoding: "utf8" });
}

function h(char: string): string { return char.repeat(64); }
function searchDisplacementSeed(): string { return `
WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<25)
INSERT INTO resources(id,workspace_id,collection_id,slug,kind,lifecycle,current_revision_id,created_by_account_id,created_at,updated_at,archived_at)
SELECT 'hidden-search-'||n,'ws1',NULL,'hidden-search-'||n,'document','draft',NULL,'acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z',NULL FROM seq;
WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<25)
INSERT INTO resource_revisions(id,resource_id,workspace_id,revision_number,base_revision_id,title,markdown,content_sha256,visibility,evidence_state,author_account_id,created_at)
SELECT 'hidden-search-'||n||'-r1','hidden-search-'||n,'ws1',1,NULL,'Needle private '||n,'needle needle needle','${h("f")}','owner_only','source','acct-owner','2026-09-09T00:00:00Z' FROM seq;
UPDATE resources SET current_revision_id=id||'-r1' WHERE id LIKE 'hidden-search-%';
WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<25)
INSERT INTO resource_fts(revision_id,workspace_id,resource_id,title,body)
SELECT 'hidden-search-'||n||'-r1','ws1','hidden-search-'||n,'Needle private '||n,'needle needle needle' FROM seq;
INSERT INTO resource_fts(revision_id,workspace_id,resource_id,title,body)
VALUES('shared-r1','ws1','shared','Shared exact revision','needle');
`; }
function buildSeed(): string { return `
INSERT INTO workspaces(id,slug,name,status,created_at,updated_at) VALUES
 ('ws1','one','One','active','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z'),
 ('ws2','two','Two','active','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO workspace_hosts(host,workspace_id,active,created_at)
 VALUES('portal.test','ws1',1,'2026-09-09T00:00:00Z');
INSERT INTO memberships(id,workspace_id,account_id,role,status,joined_at,created_at,updated_at)
 VALUES('member1','ws1','acct1','viewer','active','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO collections(id,workspace_id,slug,name,grants_inherit,created_by_account_id,created_at,updated_at)
 VALUES('collection1','ws1','research','Research',1,'acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO resources(id,workspace_id,collection_id,slug,kind,lifecycle,current_revision_id,created_by_account_id,created_at,updated_at,archived_at) VALUES
 ('shared','ws1',NULL,'shared','document','shared',NULL,'acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z',NULL),
 ('inherited','ws1','collection1','inherited','research','shared',NULL,'acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z',NULL),
 ('selected','ws1',NULL,'selected','document','shared',NULL,'acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z',NULL),
 ('hidden','ws1',NULL,'hidden','document','draft',NULL,'acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z',NULL),
 ('foreign','ws2',NULL,'foreign','document','shared',NULL,'acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z',NULL);
INSERT INTO resource_revisions(id,resource_id,workspace_id,revision_number,base_revision_id,title,markdown,content_sha256,visibility,evidence_state,author_account_id,source_ref,created_at) VALUES
 ('shared-r1','shared','ws1',1,NULL,'Shared exact revision','body','${h("a")}','workspace','source','acct-owner','research/meeting/README.md','2026-09-09T00:00:00Z'),
 ('inherited-r1','inherited','ws1',1,NULL,'Inherited','body','${h("b")}','workspace','source','acct-owner','research/inherited.md','2026-09-09T00:00:00Z'),
 ('selected-r1','selected','ws1',1,NULL,'Selected','body','${h("c")}','selected_members','source','acct-owner','research/selected.md','2026-09-09T00:00:00Z'),
 ('hidden-r1','hidden','ws1',1,NULL,'Hidden sentinel','body','${h("e")}','owner_only','source','acct-owner','research/meeting/private.md','2026-09-09T00:00:00Z'),
 ('foreign-r1','foreign','ws2',1,NULL,'Foreign sentinel','body','${h("d")}','workspace','source','acct-owner','research/meeting/foreign.md','2026-09-09T00:00:00Z');
UPDATE resources SET current_revision_id=id||'-r1';
INSERT INTO resource_grants(id,workspace_id,resource_id,revision_id,subject_type,subject_id,permission,effect,created_by_account_id,created_at) VALUES
 ('allow-shared','ws1','shared','shared-r1','member','member1','read','allow','acct-owner','2026-09-09T00:00:00Z'),
 ('allow-selected','ws1','selected','selected-r1','member','member1','read','allow','acct-owner','2026-09-09T00:00:00Z');
INSERT INTO collection_grants(id,workspace_id,collection_id,subject_type,subject_id,permission,effect,inheritable,created_by_account_id,created_at)
 VALUES('allow-collection','ws1','collection1','member','member1','read','allow',1,'acct-owner','2026-09-09T00:00:00Z');
INSERT INTO share_releases(id,workspace_id,resource_id,revision_id,grant_id,audience_type,audience_id,status,released_by_account_id,released_at) VALUES
 ('share-shared','ws1','shared','shared-r1','allow-shared','member','member1','active','acct-owner','2026-09-09T00:00:00Z'),
 ('share-inherited','ws1','inherited','inherited-r1','allow-shared','member','member1','active','acct-owner','2026-09-09T00:00:00Z'),
 ('share-selected','ws1','selected','selected-r1','allow-selected','member','member1','active','acct-owner','2026-09-09T00:00:00Z');
INSERT INTO assets(id,workspace_id,resource_id,revision_id,current_version_id,purpose,parent_asset_id,classification,consent_state,consent_evidence_ref,state,created_by_account_id,created_at,updated_at) VALUES
 ('asset-shared','ws1','shared','shared-r1','asset-shared-v1','attachment',NULL,'guest','not_required','approval','ready','acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z'),
 ('asset-private-released','ws1','shared','shared-r1','asset-private-released-v1','attachment',NULL,'private','not_required','approval','ready','acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z'),
 ('asset-hidden','ws1','hidden','hidden-r1','asset-hidden-v1','attachment',NULL,'private','not_required','approval','ready','acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO asset_versions(id,asset_id,parent_version_id,version_number,object_key,original_filename,media_type,byte_length,sha256,etag,uploaded_at,review_status) VALUES
 ('asset-shared-v1','asset-shared',NULL,1,'shared-key','shared.pdf','application/pdf',10,'${h("1")}','etag','2026-09-09T00:00:00Z','source'),
 ('asset-private-released-v1','asset-private-released',NULL,1,'private-released-key','private-released.pdf','application/pdf',10,'${h("4")}','etag','2026-09-09T00:00:00Z','source'),
 ('asset-hidden-v1','asset-hidden',NULL,1,'hidden-key','hidden.pdf','application/pdf',10,'${h("2")}','etag','2026-09-09T00:00:00Z','source');
INSERT INTO share_release_assets(share_release_id,asset_id,asset_version_id) VALUES
 ('share-shared','asset-shared','asset-shared-v1'),
 ('share-shared','asset-private-released','asset-private-released-v1');
INSERT INTO import_jobs(id,workspace_id,manifest_id,manifest_sha256,source_label,status,initiated_by_account_id,staged_at,committed_at)
 VALUES('import1','ws1','manifest1','${h("3")}','fixture','committed','acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO import_items(id,import_id,manifest_item_id,source_ref,source_sha256,kind,state,asset_id,asset_version_id,created_at,updated_at) VALUES
 ('import-asset-shared','import1','asset-shared','research/meeting/output/shared.pdf','${h("1")}','asset','ready','asset-shared','asset-shared-v1','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z'),
 ('import-asset-private-released','import1','asset-private-released','research/meeting/output/private-released.pdf','${h("4")}','asset','ready','asset-private-released','asset-private-released-v1','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z'),
 ('import-asset-hidden','import1','asset-hidden','research/meeting/output/hidden.pdf','${h("2")}','asset','ready','asset-hidden','asset-hidden-v1','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO revision_links(id,workspace_id,source_resource_id,source_revision_id,target_key,target_resource_id,status,label,occurrence,created_at) VALUES
 ('link-broken','ws1','shared','shared-r1','missing',NULL,'broken',NULL,1,'2026-09-09T00:00:00Z'),
 ('link-hidden','ws1','shared','shared-r1','hidden','hidden','resolved',NULL,2,'2026-09-09T00:00:00Z');
INSERT INTO questions(id,workspace_id,resource_id,revision_id,prompt_markdown,status,created_by_account_id,created_at,updated_at)
 VALUES('question1','ws1','shared','shared-r1','Question?','open','acct-owner','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO question_assignments(question_id,membership_id,assigned_by_account_id,assigned_at)
 VALUES('question1','member1','acct-owner','2026-09-09T00:00:00Z');
INSERT INTO question_answers(id,question_id,author_account_id,current_version,status,created_at,updated_at) VALUES
 ('answer-own-draft','question1','acct1',1,'draft','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z'),
 ('answer-other-draft','question1','acct2',1,'draft','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z'),
 ('answer-submitted','question1','acct3',1,'submitted','2026-09-09T00:00:00Z','2026-09-09T00:00:00Z');
INSERT INTO question_answer_versions(answer_id,version,body_markdown,editor_account_id,created_at) VALUES
 ('answer-own-draft',1,'my draft','acct1','2026-09-09T00:00:00Z'),
 ('answer-other-draft',1,'private other draft','acct2','2026-09-09T00:00:00Z'),
 ('answer-submitted',1,'submitted answer','acct3','2026-09-09T00:00:00Z');
`; }

await main();
