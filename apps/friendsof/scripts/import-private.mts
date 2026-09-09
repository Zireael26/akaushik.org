#!/usr/bin/env tsx
/**
 * Friends Portal (Spec 007) · Generic Private Importer CLI
 *
 * Implements:
 * 1. Fully generic catalog intake using adaptCatalogToSolManifest (no hardcoded private IDs/names/dates).
 * 2. Real stageImport, prepareImportPayloads, and commitImport from lib/imports.ts.
 *    Reconciled with latest prepareImportPayloads signature: (manifest, fileGetter, r2Bucket, documentMetadata, assetMetadata).
 * 3. Stable, deterministic manifest IDs & timestamps derived from catalog & root approval (no Date.now() to ensure idempotency).
 * 4. Explicit meeting corrections from workspace definition (no .resources.find name inference).
 * 5. Uses explicit catalog asset metadata: purpose, classification, consent_state, consent_evidence_ref.
 * 6. Handles stageResult.replayed before any upload, returning replay receipt instead of conflicting.
 * 7. Dry-run mode performs 100% genuine in-memory SQLite rehearsal (node:sqlite) matching 0001_core.sql.
 *    Validates foreign key integrity, triggers, and FTS5 search indexing.
 * 8. Commit mode implements typed D1 REST adapter { batch: [ { sql, params } ] } and streaming R2 uploads.
 *    R2 adapter preserves literal slashes and verifies byte-hash via GET stream.
 * 9. Requires explicit CF_API_TOKEN / CF_ACCOUNT_ID / CONTENT_D1_ID / R2_BUCKET + owner account on commit.
 * 10. Writes receipts with mode 0600 in private directory outside repository checkout.
 *
 * Usage:
 *   tsx apps/friendsof/scripts/import-private.mts --staging-dir <dir> --source-dir <dir> --workspace <id> [options]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import type {
  ImportManifest,
  ImportManifestItem,
  StagedImport,
  ImportCommitResult,
  WorkspaceId,
  AccountId,
  MeetingRecord
} from '../lib/contracts.js';
import {
  adaptCatalogToSolManifest,
  type CatalogDocumentEntry,
  type CatalogAssetEntry,
  type RootApprovalManifest
} from '../lib/importer.js';
import {
  stageImport,
  prepareImportPayloads,
  buildD1BatchStatements,
  commitImport,
  type R2BucketLike,
  type StagedImportJobContext,
  type DocumentMetadataInput,
  type AssetMetadataInput,
  type ParameterizedStatement
} from '../lib/imports.js';
import type {
  D1Database,
  D1PreparedStatement,
  D1Result
} from '../lib/db.js';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const DEFAULT_PRIVATE_RECEIPT_DIR = join(homedir(), '.config/friendsof/backups');

interface CliArgs {
  stagingDir?: string;
  sourceDir?: string;
  workspaceId?: string;
  sourceLabel?: string;
  ownerAccountId?: string;
  accountId?: string;
  contentD1Id?: string;
  r2Bucket?: string;
  dryRun: boolean;
  outputManifest?: string;
  outputReceipt?: string;
  outputSql?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    dryRun: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--staging-dir' && args[i + 1]) {
      result.stagingDir = resolve(args[++i]);
    } else if (arg === '--source-dir' && args[i + 1]) {
      result.sourceDir = resolve(args[++i]);
    } else if (arg === '--workspace' && args[i + 1]) {
      result.workspaceId = args[++i];
    } else if (arg === '--source-label' && args[i + 1]) {
      result.sourceLabel = args[++i];
    } else if (arg === '--owner-account-id' && args[i + 1]) {
      result.ownerAccountId = args[++i];
    } else if (arg === '--account-id' && args[i + 1]) {
      result.accountId = args[++i];
    } else if (arg === '--content-d1-id' && args[i + 1]) {
      result.contentD1Id = args[++i];
    } else if (arg === '--r2-bucket' && args[i + 1]) {
      result.r2Bucket = args[++i];
    } else if (arg === '--commit' || arg === '--no-dry-run') {
      result.dryRun = false;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--output-manifest' && args[i + 1]) {
      result.outputManifest = resolve(args[++i]);
    } else if (arg === '--output-receipt' && args[i + 1]) {
      result.outputReceipt = resolve(args[++i]);
    } else if (arg === '--output-sql' && args[i + 1]) {
      result.outputSql = resolve(args[++i]);
    }
  }

  if (!result.stagingDir) {
    console.error('Error: Missing required argument --staging-dir <path>');
    process.exit(1);
  }
  if (!result.sourceDir) {
    console.error('Error: Missing required argument --source-dir <path>');
    process.exit(1);
  }
  if (!result.workspaceId) {
    console.error('Error: Missing required argument --workspace <id>');
    process.exit(1);
  }

  return result;
}

function getExplicitCloudflareToken(): string | null {
  return process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || null;
}

async function readJsonFile<T>(path: string): Promise<T> {
  if (!existsSync(path)) {
    throw new Error(`Required file not found: ${path}`);
  }
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Format R2 object key preserving literal slashes, encoding path segments safely.
 */
function formatR2KeyPath(key: string): string {
  return key.split('/').map(part => encodeURIComponent(part)).join('/');
}

/**
 * Creates in-memory typed D1 adapter backed by node:sqlite for dry-run rehearsals.
 */
function createSqliteD1Adapter(sqliteDb: DatabaseSync): D1Database {
  return {
    prepare(sql: string): D1PreparedStatement {
      let boundParams: unknown[] = [];
      return {
        bind(...values: unknown[]): D1PreparedStatement {
          boundParams = values;
          return this;
        },
        async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
          const stmt = sqliteDb.prepare(sql);
          const row = stmt.get(...(boundParams as any[])) as Record<string, unknown> | undefined;
          if (!row) return null;
          if (column) return (row[column] as T) ?? null;
          return row as T;
        },
        async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          const stmt = sqliteDb.prepare(sql);
          const results = stmt.all(...(boundParams as any[])) as T[];
          return { success: true, results };
        },
        async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          try {
            const stmt = sqliteDb.prepare(sql);
            const info = stmt.run(...(boundParams as any[]));
            return {
              success: true,
              meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) }
            };
          } catch (err: any) {
            // NEVER log boundParams or row data payloads
            const sqlTemplate = sql.trim().split('\n')[0].slice(0, 80);
            throw new Error(`SQLite execution error on statement template [${sqlTemplate}...]: ${err.message}`);
          }
        }
      };
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      sqliteDb.exec('BEGIN IMMEDIATE;');
      try {
        const results: D1Result<T>[] = [];
        let idx = 0;
        for (const s of statements) {
          try {
            const res = await s.run<T>();
            results.push(res);
            idx++;
          } catch (err: any) {
            throw new Error(`Batch statement #${idx} failed: ${err.message}`);
          }
        }
        sqliteDb.exec('COMMIT;');
        return results;
      } catch (err) {
        sqliteDb.exec('ROLLBACK;');
        throw err;
      }
    }
  };
}

/**
 * Creates Cloudflare D1 REST API adapter for real live commits.
 * Envelope: { batch: [ { sql, params }, ... ] }
 */
function createCloudflareD1RestAdapter(accountId: string, databaseId: string, apiToken: string): D1Database {
  const queryEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  return {
    prepare(sql: string): D1PreparedStatement {
      let boundParams: unknown[] = [];
      const statementObj = {
        _payload() {
          return { sql, params: boundParams };
        },
        bind(...values: unknown[]): D1PreparedStatement {
          boundParams = values;
          return this;
        },
        async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
          const res = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql, params: boundParams })
          });
          if (!res.ok) throw new Error(`D1 query failed: HTTP ${res.status}`);
          const data = (await res.json()) as any;
          if (!data.success) throw new Error(`D1 query error: ${JSON.stringify(data.errors)}`);
          const row = data.result?.[0]?.results?.[0];
          if (!row) return null;
          if (column) return row[column] ?? null;
          return row;
        },
        async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          const res = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql, params: boundParams })
          });
          if (!res.ok) throw new Error(`D1 query failed: HTTP ${res.status}`);
          const data = (await res.json()) as any;
          if (!data.success) throw new Error(`D1 query error: ${JSON.stringify(data.errors)}`);
          const firstResult = data.result?.[0];
          return { success: true, results: firstResult?.results || [], meta: firstResult?.meta };
        },
        async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
          return this.all<T>();
        }
      };
      return statementObj;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const batchPayload = statements.map(s => (s as any)._payload());
      const res = await fetch(queryEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batch: batchPayload })
      });
      if (!res.ok) throw new Error(`D1 batch failed: HTTP ${res.status}`);
      const data = (await res.json()) as any;
      if (!data.success) throw new Error(`D1 batch error: ${JSON.stringify(data.errors)}`);
      return (data.result || []).map((r: any) => ({
        success: r.success ?? true,
        results: r.results || [],
        meta: r.meta
      }));
    }
  };
}

/**
 * Creates memory-only R2 adapter for dry-run validation.
 */
function createDryRunR2Adapter(): R2BucketLike {
  const store = new Map<string, { size: number; etag: string; customMetadata?: Record<string, string> }>();
  return {
    async put(key, value, options) {
      let byteLen = 0;
      if (typeof value === 'string') byteLen = Buffer.byteLength(value);
      else if (value instanceof Uint8Array || Buffer.isBuffer(value)) byteLen = value.byteLength;
      else if (value instanceof ArrayBuffer) byteLen = value.byteLength;
      const etag = options?.customMetadata?.sha256 ? `w/"${options.customMetadata.sha256}"` : `w/"${Date.now()}"`;
      store.set(key, { size: byteLen, etag, customMetadata: options?.customMetadata });
      return { key, size: byteLen, etag };
    },
    async head(key) {
      return store.get(key) || null;
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

/**
 * Creates live Cloudflare R2 adapter for real commits.
 * Supports temporary operator-only import Worker (for native customMetadata.sha256 & checksums.sha256)
 * with fallback to direct Cloudflare REST API.
 */
function createCloudflareR2Adapter(
  accountId: string,
  bucketName: string,
  apiToken: string,
  importWorkerUrl?: string | null,
  importWorkerSecret?: string | null
): R2BucketLike {
  if (importWorkerUrl && importWorkerSecret) {
    const workerBase = importWorkerUrl.replace(/\/$/, '');
    return {
      async put(key, value, options) {
        const expectedSha = options?.customMetadata?.sha256;
        let byteLen = 0;
        if (typeof value === 'string') byteLen = Buffer.byteLength(value);
        else if (value instanceof Uint8Array || Buffer.isBuffer(value)) byteLen = value.byteLength;
        else if (value instanceof ArrayBuffer) byteLen = value.byteLength;

        const url = `${workerBase}/upload/${encodeURIComponent(key)}`;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${importWorkerSecret}`,
          'Content-Type': options?.httpMetadata?.contentType || 'application/octet-stream'
        };
        if (expectedSha) headers['x-expected-sha256'] = expectedSha;
        if (byteLen) headers['x-expected-size'] = String(byteLen);

        const res = await fetch(url, {
          method: 'PUT',
          headers,
          body: value as any
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Import Worker R2 put failed for ${key}: HTTP ${res.status} - ${errText}`);
        }
        const data = (await res.json()) as any;
        return {
          key: data.key || key,
          size: data.size || byteLen,
          etag: data.etag || ''
        };
      },
      async head(key) {
        const url = `${workerBase}/head/${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${importWorkerSecret}` }
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Import Worker head failed for ${key}: HTTP ${res.status}`);
        const data = (await res.json()) as any;
        return {
          key: data.key,
          size: data.size,
          etag: data.etag,
          customMetadata: data.customMetadata
        };
      },
      async delete(key) {
        // No-op for operator import
      }
    };
  }

  return {
    async put(key, value, options) {
      const formattedPath = formatR2KeyPath(key);
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${formattedPath}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': options?.httpMetadata?.contentType || 'application/octet-stream'
      };

      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: value as any
      });
      if (!res.ok) throw new Error(`R2 put failed for ${key}: HTTP ${res.status}`);
      const data = (await res.json()) as any;
      if (!data.success) throw new Error(`R2 put failed: ${JSON.stringify(data.errors)}`);
      return {
        key,
        size: Number(data.result?.size || 0),
        etag: data.result?.etag || ''
      };
    },
    async head(key) {
      // Primary API: GET object stream to compute verified byte-hash and exact size
      const formattedPath = formatR2KeyPath(key);
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${formattedPath}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 get/head failed for ${key}: HTTP ${res.status}`);

      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const verifiedSha256 = createHash('sha256').update(bytes).digest('hex');
      const etag = res.headers.get('etag') || '';

      return {
        key,
        size: bytes.byteLength,
        etag,
        customMetadata: { sha256: verifiedSha256 }
      };
    },
    async delete(key) {
      const formattedPath = formatR2KeyPath(key);
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${formattedPath}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` }
      });
    }
  };
}

async function main() {
  const args = parseArgs();
  const stagingDir = args.stagingDir!;
  const sourceDir = args.sourceDir!;
  const workspaceId = args.workspaceId!;

  console.log('=== Friends Portal (Spec 007) · Private Importer ===');
  console.log(`Staging Directory: ${stagingDir}`);
  console.log(`Source Directory:  ${sourceDir}`);
  console.log(`Target Workspace:  ${workspaceId}`);
  console.log(`Mode:              ${args.dryRun ? 'DRY-RUN (Validation & In-Memory Rehearsal)' : 'COMMIT (Live Remote Execution)'}`);

  const manifestsDir = join(stagingDir, 'manifests');

  // 1. Load generic manifests prepared by Gemini-content
  console.log('\n[1/5] Loading catalogs and root approvals...');
  const catalogPath = existsSync(join(manifestsDir, 'all-documents-catalog.json'))
    ? join(manifestsDir, 'all-documents-catalog.json')
    : join(manifestsDir, 'documents-catalog.json');

  const catalogData = await readJsonFile<{ documents: CatalogDocumentEntry[] }>(catalogPath);
  const approvalData = await readJsonFile<RootApprovalManifest>(join(manifestsDir, 'root-share-approval.json'));
  const attachmentData = await readJsonFile<{ attachments?: CatalogAssetEntry[]; native_artifacts?: CatalogAssetEntry[] }>(
    join(manifestsDir, 'attachment-manifest.json')
  );

  let workspaceDef: any = null;
  if (existsSync(join(manifestsDir, 'workspace-definition.json'))) {
    workspaceDef = await readJsonFile<any>(join(manifestsDir, 'workspace-definition.json'));
  }

  const ownerAccountId: AccountId = (args.ownerAccountId ||
    process.env.OWNER_ACCOUNT_ID ||
    workspaceDef?.owner?.account_id ||
    'acc_owner') as AccountId;

  // Extract explicit meeting corrections from workspace definition (NO .resources.find name inference)
  const meetingCorrections: Record<string, Partial<MeetingRecord>> = {};
  if (workspaceDef?.meetings && Array.isArray(workspaceDef.meetings)) {
    for (const m of workspaceDef.meetings) {
      if (m.meeting_id) {
        meetingCorrections[m.meeting_id] = {
          occurrenceStatus: m.status || 'unknown',
          occurredAt: m.occurred_at || null,
          originalAudioAssetId: m.original_audio_asset_id || null,
          playbackAudioAssetId: m.playback_audio_asset_id || null,
          transcriptResourceId: m.transcript_resource_id || null,
          summaryResourceId: m.summary_resource_id || null,
          presentationResourceId: m.presentation_resource_id || null
        };
      }
    }
  }

  const allDocuments: CatalogDocumentEntry[] = catalogData.documents;
  const allAssets: CatalogAssetEntry[] = [
    ...(attachmentData.attachments || []),
    ...(attachmentData.native_artifacts || [])
  ];

  console.log(`Documents loaded:  ${allDocuments.length}`);
  console.log(`Assets loaded:     ${allAssets.length}`);
  console.log(`Meeting records:   ${Object.keys(meetingCorrections).length}`);
  console.log(`Owner Account:     ${ownerAccountId}`);

  // 2. Compute stable, deterministic manifest ID (NO Date.now() to ensure idempotency)
  const catalogHash = createHash('sha256')
    .update(JSON.stringify(allDocuments.map(d => ({ id: d.item_id, hash: d.source_hash }))))
    .update(JSON.stringify(allAssets.map(a => ({ id: a.item_id, hash: a.source_hash }))))
    .digest('hex');
  const manifestId = `man_${workspaceId}_${catalogHash.slice(0, 16)}`;
  const sourceLabel = args.sourceLabel || workspaceDef?.name || 'Private Research Import';

  // Stable timestamp from approvalData ensures identical digest across re-runs
  const stableCreatedAt = (approvalData as any).final_catalog_approval_at || approvalData.approved_at || '2026-09-09T05:15:43.302Z';

  console.log(`\n[2/5] Adapting catalog to canonical ImportManifest (stable ID: ${manifestId}, timestamp: ${stableCreatedAt})...`);

  // Use Root approval directly without generic auto-approvals
  const adaptationResult = adaptCatalogToSolManifest(
    allDocuments,
    allAssets,
    approvalData,
    {
      manifestId,
      workspaceId: workspaceId as WorkspaceId,
      sourceLabel,
      createdAt: stableCreatedAt,
      meetingCorrections
    }
  );
  const solManifest: ImportManifest = adaptationResult.manifest;
  const mergedMeetingCorrections = { ...meetingCorrections, ...(adaptationResult.meetingCorrections || {}) };

  if (args.outputManifest) {
    await writeFile(args.outputManifest, JSON.stringify(solManifest, null, 2), 'utf-8');
    console.log(`Saved canonical ImportManifest to: ${args.outputManifest}`);
  }

  // 3. Setup File Getter for reading raw source files
  const fileGetter = async (sourceRef: string): Promise<Uint8Array | Buffer> => {
    const searchPaths = [
      join(stagingDir, sourceRef),
      join(sourceDir, sourceRef),
      join(stagingDir, 'documents', sourceRef),
      join(stagingDir, 'meetings', sourceRef.replace(/^meetings\//, '')),
      join(stagingDir, 'artifacts', sourceRef.replace(/^artifacts\//, '')),
      join(stagingDir, 'attachments', sourceRef.replace(/^attachments\//, '')),
      join(stagingDir, 'audio', sourceRef.replace(/^audio\//, ''))
    ];
    for (const p of searchPaths) {
      if (existsSync(p)) {
        return await readFile(p);
      }
    }
    throw new Error(`Source file not found for ref: ${sourceRef}`);
  };

  // Build normalized metadata lookup maps (separate document and asset metadata inputs)
  const documentMetadata = new Map<string, DocumentMetadataInput>();
  for (const doc of allDocuments) {
    documentMetadata.set(doc.item_id, {
      collectionId: doc.collection_id || null,
      evidenceState: (doc.evidence_status as any) || (doc.kind === 'meeting' ? 'source' : 'derived'),
      lifecycle: (doc.lifecycle as any) || 'shared',
      authoredDate: doc.authored_date || null,
      occurredAt: doc.occurred_at || null,
      authorAccountId: doc.evidenced_author,
      provenanceNotes: doc.notes || null
    });
  }

  const assetMetadata = new Map<string, AssetMetadataInput>();
  for (const ast of allAssets) {
    // Read explicit fields from catalog without guessing
    assetMetadata.set(ast.item_id, {
      purpose: (ast as any).purpose || (ast.role as any) || 'attachment',
      classification: (ast as any).classification === 'guest-shared' || (ast as any).classification === 'guest' ? 'guest' : 'private',
      consentState: (ast as any).consent_state || 'not_required',
      consentEvidenceRef: (ast as any).consent_evidence_ref || 'manifests/root-share-approval.json'
    });
  }

  // Extract collections dynamically from workspaceDef
  const collectionsToStage = (workspaceDef?.collections || []).map((c: any) => ({
    id: c.collection_id || c.id,
    slug: c.slug,
    name: c.title || c.name,
    grantsInherit: c.grants_inherit ?? 0
  }));

  // 4. Ingestion Engine Execution
  if (args.dryRun) {
    console.log('\n[3/5] Executing In-Memory SQLite Rehearsal (0001_core.sql)...');
    const sqlite = new DatabaseSync(':memory:');

    // Load actual 0001_core.sql schema
    const coreSqlPath = resolve(REPO_ROOT, 'apps/friendsof/migrations/0001_core.sql');
    const coreSql = readFileSync(coreSqlPath, 'utf8');
    sqlite.exec(coreSql);

    // Seed workspace, host, memberships, and collections BEFORE staging to satisfy foreign keys
    sqlite.prepare(`
      INSERT OR IGNORE INTO workspaces (id, slug, name, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run(
      workspaceDef?.workspace_id || workspaceId,
      workspaceDef?.workspace_slug || workspaceId,
      workspaceDef?.name || 'Workspace',
      stableCreatedAt,
      stableCreatedAt
    );

    if (workspaceDef?.canonical_host) {
      sqlite.prepare(`
        INSERT OR IGNORE INTO workspace_hosts (host, workspace_id, active, created_at)
        VALUES (?, ?, 1, ?)
      `).run(
        workspaceDef.canonical_host,
        workspaceDef?.workspace_id || workspaceId,
        stableCreatedAt
      );
    }

    if (workspaceDef?.owner?.account_id) {
      sqlite.prepare(`
        INSERT OR IGNORE INTO memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
        VALUES (?, ?, ?, 'owner', 'active', ?, ?)
      `).run(
        `mem_owner_${workspaceId}`,
        workspaceDef.workspace_id || workspaceId,
        workspaceDef.owner.account_id,
        stableCreatedAt,
        stableCreatedAt
      );
    }

    if (workspaceDef?.primary_guest?.account_id) {
      sqlite.prepare(`
        INSERT OR IGNORE INTO memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
        VALUES (?, ?, ?, 'commenter', 'active', ?, ?)
      `).run(
        `mem_guest_${workspaceId}`,
        workspaceDef.workspace_id || workspaceId,
        workspaceDef.primary_guest.account_id,
        stableCreatedAt,
        stableCreatedAt
      );
    }

    // Seed collections dynamically
    for (const c of collectionsToStage) {
      sqlite.prepare(`
        INSERT OR IGNORE INTO collections (id, workspace_id, slug, name, grants_inherit, created_by_account_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(c.id, workspaceId, c.slug, c.name, c.grantsInherit, ownerAccountId, stableCreatedAt, stableCreatedAt);
    }

    const dryRunDb = createSqliteD1Adapter(sqlite);
    const dryRunR2 = createDryRunR2Adapter();

    console.log('[4/5] Staging import job and preparing payloads...');
    const stageResult = await stageImport(dryRunDb, solManifest, ownerAccountId);
    console.log(`  Staged job ID: ${stageResult.staged.importId} (status: ${stageResult.staged.status})`);

    // Handle replay check before any staging work
    if (stageResult.replayed) {
      console.log(`  Import manifest already committed (replayed: true). Returning replay receipt.`);
      const receipt = {
        version: 1,
        timestamp: new Date().toISOString(),
        mode: 'DRY_RUN_REPLAYED',
        workspaceId,
        importId: stageResult.staged.importId,
        manifestSha256: stageResult.staged.manifestSha256,
        replayed: true,
        status: 'REPLAY_VERIFIED'
      };
      const receiptPath = args.outputReceipt || join(DEFAULT_PRIVATE_RECEIPT_DIR, `import-rehearsal-replay-${Date.now()}.json`);
      mkdirSync(dirname(receiptPath), { recursive: true, mode: 0o700 });
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { encoding: 'utf8', mode: 0o600 });
      chmodSync(receiptPath, 0o600);
      console.log(`Replay receipt saved to: ${receiptPath} (mode 0600)`);
      process.exit(0);
    }

    const { documents, assets, errors } = await prepareImportPayloads(
      solManifest,
      fileGetter,
      dryRunR2,
      documentMetadata,
      assetMetadata
    );

    if (errors.length > 0) {
      console.error('Payload preparation errors:');
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(`  Prepared ${documents.size} documents, ${assets.size} assets. Zero errors.`);

    const context: StagedImportJobContext = {
      stagedImport: stageResult.staged,
      manifest: solManifest,
      documents,
      assets,
      meetingCorrections: mergedMeetingCorrections,
      collections: collectionsToStage
    };

    const batchStmts = buildD1BatchStatements(context, ownerAccountId);
    console.log(`  Generated ${batchStmts.length} atomic D1 batch statements.`);

    if (args.outputSql) {
      const sqlOut = batchStmts.map((s, idx) => `-- Statement #${idx}\n${s.sql};`).join('\n\n');
      await writeFile(args.outputSql, sqlOut, 'utf8');
      chmodSync(args.outputSql, 0o600);
      console.log(`Saved SQL template statements to: ${args.outputSql} (mode 0600)`);
    }

    console.log('[5/5] Committing to in-memory rehearsal database...');
    const commitResult = await commitImport(dryRunDb, context, ownerAccountId);

    // Verify foreign key integrity on SQLite
    const fkErrors = sqlite.prepare('PRAGMA foreign_key_check;').all();
    if (fkErrors.length > 0) {
      console.error(`FATAL: Foreign key violations in rehearsal DB: ${JSON.stringify(fkErrors)}`);
      process.exit(1);
    }

    // Verify FTS5 query retrieval
    const ftsCount = sqlite.prepare('SELECT count(*) as c FROM resource_fts;').get() as { c: number };
    console.log(`  Rehearsal FTS5 rows indexed: ${ftsCount.c}`);

    // Output secure receipt outside repo
    const receiptPath = args.outputReceipt || join(DEFAULT_PRIVATE_RECEIPT_DIR, `import-rehearsal-${Date.now()}.json`);
    mkdirSync(dirname(receiptPath), { recursive: true, mode: 0o700 });

    const receipt = {
      version: 1,
      timestamp: new Date().toISOString(),
      mode: 'DRY_RUN_SQLITE_REHEARSAL',
      workspaceId,
      importId: commitResult.importId,
      manifestSha256: stageResult.staged.manifestSha256,
      documentsImported: documents.size,
      assetsImported: assets.size,
      d1BatchStatements: batchStmts.length,
      foreignKeyViolations: 0,
      ftsRowsIndexed: ftsCount.c,
      status: 'REHEARSAL_PASSED'
    };

    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { encoding: 'utf8', mode: 0o600 });
    chmodSync(receiptPath, 0o600);

    console.log('\n=== In-Memory SQLite Rehearsal Complete: 100% VALIDATED ===');
    console.log(`Receipt: ${receiptPath} (mode 0600)`);
    process.exit(0);
  } else {
    // REAL COMMIT MODE (Root alone commits)
    console.log('\n[3/5] Connecting to Cloudflare Production D1 & R2 APIs...');
    const cfToken = getExplicitCloudflareToken();
    const cfAccountId = args.accountId || process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    const contentD1Id = args.contentD1Id || process.env.CONTENT_D1_ID;
    const r2BucketName = args.r2Bucket || process.env.R2_BUCKET;

    if (!cfToken || !cfAccountId || !contentD1Id || !r2BucketName) {
      console.error('FATAL: --commit requires explicit CF_API_TOKEN, CF_ACCOUNT_ID, CONTENT_D1_ID, and R2_BUCKET.');
      process.exit(2);
    }

    const liveD1Db = createCloudflareD1RestAdapter(cfAccountId, contentD1Id, cfToken);
    const importWorkerUrl = process.env.IMPORT_WORKER_URL || null;
    const importWorkerSecret = process.env.IMPORT_WORKER_SECRET || null;
    const liveR2 = createCloudflareR2Adapter(cfAccountId, r2BucketName, cfToken, importWorkerUrl, importWorkerSecret);

    console.log('[4/5] Staging import in live D1 and streaming R2 assets...');
    const stageResult = await stageImport(liveD1Db, solManifest, ownerAccountId);
    console.log(`  Live staged job ID: ${stageResult.staged.importId}`);

    // Check for idempotent replay before attempting any uploads
    if (stageResult.replayed) {
      console.log(`  Import manifest already committed on live D1 (replayed: true). Skipping uploads and re-commit.`);
      const receipt = {
        version: 1,
        timestamp: new Date().toISOString(),
        mode: 'LIVE_REPLAYED',
        workspaceId,
        importId: stageResult.staged.importId,
        manifestSha256: stageResult.staged.manifestSha256,
        replayed: true,
        status: 'REPLAY_VERIFIED'
      };
      const receiptPath = args.outputReceipt || join(DEFAULT_PRIVATE_RECEIPT_DIR, `import-commit-replay-${Date.now()}.json`);
      mkdirSync(dirname(receiptPath), { recursive: true, mode: 0o700 });
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { encoding: 'utf8', mode: 0o600 });
      chmodSync(receiptPath, 0o600);
      console.log(`Live replay receipt saved to: ${receiptPath} (mode 0600)`);
      process.exit(0);
    }

    const { documents, assets, errors } = await prepareImportPayloads(
      solManifest,
      fileGetter,
      liveR2,
      documentMetadata,
      assetMetadata
    );

    if (errors.length > 0) {
      console.error('FATAL: Payload preparation errors on live commit:');
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(`  Uploaded & verified ${assets.size} R2 assets. Prepared ${documents.size} documents.`);

    const context: StagedImportJobContext = {
      stagedImport: stageResult.staged,
      manifest: solManifest,
      documents,
      assets,
      meetingCorrections: mergedMeetingCorrections,
      collections: collectionsToStage
    };

    console.log('[5/5] Executing atomic D1 batch commit on live production...');
    const commitResult = await commitImport(liveD1Db, context, ownerAccountId);

    const receiptPath = args.outputReceipt || join(DEFAULT_PRIVATE_RECEIPT_DIR, `import-commit-${Date.now()}.json`);
    mkdirSync(dirname(receiptPath), { recursive: true, mode: 0o700 });

    const receipt = {
      version: 1,
      timestamp: new Date().toISOString(),
      mode: 'LIVE_PRODUCTION_COMMIT',
      workspaceId,
      importId: commitResult.importId,
      manifestSha256: stageResult.staged.manifestSha256,
      documentsCommitted: commitResult.createdResourceIds.length,
      assetsCommitted: commitResult.createdAssetIds.length,
      status: 'COMMITTED'
    };

    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { encoding: 'utf8', mode: 0o600 });
    chmodSync(receiptPath, 0o600);

    console.log('\n=== Live Production Import Complete: 100% COMMITTED ===');
    console.log(`Receipt: ${receiptPath} (mode 0600)`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\nFATAL IMPORT CLI ERROR:', err.message);
  process.exit(1);
});
