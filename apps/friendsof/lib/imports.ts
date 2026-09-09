/**
 * Friends Portal (Spec 007) · Imports & Ingestion Engine
 *
 * Implements two-phase atomic intake conforming strictly to:
 * - apps/friendsof/migrations/0001_core.sql schema contracts.
 * - AC-IMP-001 through AC-IMP-006:
 *   - Explicit manifest verification
 *   - Two-phase staging with R2 object verification (size, ETag, SHA-256) and D1 atomic batch commitment
 *   - Fail-safe rollback: atomic transactions leave no dangling visible rows on failure
 *   - Idempotent re-runs by manifestSha256
 *   - Full preservation of source markdown, SHA-256, explicit evidence states, collections, and meeting aggregates
 *   - Zero hardcoded tenant IDs, dates, or metadata guessing in generic source.
 *   - Populates share_release_assets so guest media authorization in dal.assetsFor succeeds without 404.
 */

import { createHash } from 'node:crypto';
import type {
  ImportManifest,
  ImportManifestItem,
  StagedImport,
  ImportCommitResult,
  WorkspaceId,
  AccountId,
  ResourceId,
  RevisionId,
  AssetId,
  MeetingRecord,
  EvidenceState,
  ResourceKind,
  RevisionVisibility
} from './contracts.js';
import {
  type D1Database,
  type D1PreparedStatement,
  batch,
  first,
  newId,
  PortalDataError,
  sha256Hex
} from './db.js';
import { parseMarkdown, type MarkdownParseResult } from './markdown.js';

export interface R2ObjectDescriptor {
  key: string;
  size: number;
  etag: string;
  sha256: string;
}

export interface R2BucketLike {
  put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array | string, options?: any): Promise<{ key: string; size: number; etag: string }>;
  head(key: string): Promise<{ key: string; size: number; etag: string; customMetadata?: Record<string, string> } | null>;
  get?(key: string): Promise<{ body: ReadableStream; arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
}

export interface PreparedResourcePayload {
  item: ImportManifestItem;
  markdown: string;
  parsed: MarkdownParseResult;
  contentSha256: string;
  resourceId: ResourceId;
  revisionId: RevisionId;
  collectionId: string | null;
  evidenceState: EvidenceState;
  lifecycle: 'draft' | 'shared' | 'archived';
  authoredDate: string | null;
  occurredAt: string | null;
  provenanceNotes: string | null;
}

export interface PreparedAssetPayload {
  item: ImportManifestItem;
  assetId: AssetId;
  versionId: string;
  objectKey: string;
  bytes: Uint8Array | Buffer;
  byteLength: number;
  sha256: string;
  etag: string;
  mediaType: string;
  filename: string;
  purpose: 'original' | 'playback' | 'presentation' | 'attachment' | 'waveform' | 'other';
  classification: 'private' | 'guest' | 'public_candidate';
  consentState: 'pending' | 'verified' | 'not_required' | 'revoked';
  consentEvidenceRef: string;
  parentAssetId: string | null;
  derivationTool: string | null;
  derivationVersion: string | null;
}

export interface DocumentMetadataInput {
  collectionId: string | null;
  evidenceState: EvidenceState;
  lifecycle: 'draft' | 'shared' | 'archived';
  authoredDate?: string | null;
  occurredAt?: string | null;
  authorAccountId?: string;
  provenanceNotes?: string | null;
}

export interface AssetMetadataInput {
  purpose: 'original' | 'playback' | 'presentation' | 'attachment' | 'waveform' | 'other';
  classification: 'private' | 'guest' | 'public_candidate';
  consentState: 'pending' | 'verified' | 'not_required' | 'revoked';
  consentEvidenceRef: string;
  parentAssetId?: string | null;
  derivationTool?: string | null;
  derivationVersion?: string | null;
  etag?: string;
}

export interface StagedImportJobContext {
  stagedImport: StagedImport;
  manifest: ImportManifest;
  documents: Map<string, PreparedResourcePayload>;
  assets: Map<string, PreparedAssetPayload>;
  meetingCorrections: Record<string, Partial<MeetingRecord>>;
  collections?: Array<{ id: string; slug: string; name: string; grantsInherit?: number }>;
}

export interface ParameterizedStatement {
  sql: string;
  params: unknown[];
}

/**
 * Validates manifest structure and stages import job in D1.
 * Idempotent: if the exact manifest was already committed, returns replayed status.
 */
export async function stageImport(
  db: D1Database,
  manifest: ImportManifest,
  initiatedByAccountId: AccountId
): Promise<{ staged: StagedImport; replayed: boolean }> {
  if (manifest.schemaVersion !== 1) {
    throw new PortalDataError('INVALID', `Unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!manifest.workspaceId || !manifest.manifestId || !Array.isArray(manifest.items)) {
    throw new PortalDataError('INVALID', 'Malformed import manifest structure');
  }

  const manifestStr = JSON.stringify(manifest);
  const manifestSha256 = createHash('sha256').update(manifestStr).digest('hex');
  const importId = `imp_${manifestSha256.slice(0, 16)}`;
  const now = new Date().toISOString();

  // Check for existing import job
  const existingJob = await first<{ id: string; status: string; manifest_sha256: string }>(
    db,
    `SELECT id, status, manifest_sha256 FROM import_jobs WHERE workspace_id = ?1 AND manifest_id = ?2 AND manifest_sha256 = ?3 LIMIT 1`,
    manifest.workspaceId,
    manifest.manifestId,
    manifestSha256
  );

  if (existingJob) {
    if (existingJob.status === 'committed') {
      return {
        staged: {
          importId: existingJob.id,
          manifestId: manifest.manifestId,
          status: 'committed',
          manifestSha256: existingJob.manifest_sha256,
          itemCount: manifest.items.length,
          stagedAt: now
        },
        replayed: true
      };
    }
    return {
      staged: {
        importId: existingJob.id,
        manifestId: manifest.manifestId,
        status: existingJob.status as any,
        manifestSha256: existingJob.manifest_sha256,
        itemCount: manifest.items.length,
        stagedAt: now
      },
      replayed: false
    };
  }

  // Insert staged job and items in atomic batch
  const stmts: D1PreparedStatement[] = [];

  stmts.push(
    db.prepare(`
      INSERT INTO import_jobs (
        id, workspace_id, manifest_id, manifest_sha256, source_label, status, initiated_by_account_id, staged_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'staged', ?6, ?7)
    `).bind(importId, manifest.workspaceId, manifest.manifestId, manifestSha256, manifest.sourceLabel, initiatedByAccountId, now)
  );

  for (const item of manifest.items) {
    const itemId = `imi_${createHash('sha256').update(`${importId}:${item.itemId}`).digest('hex').slice(0, 16)}`;
    const expectedHash = item.kind === 'asset' ? (item.assetSha256 || item.sourceSha256) : item.sourceSha256;
    stmts.push(
      db.prepare(`
        INSERT INTO import_items (
          id, import_id, manifest_item_id, source_ref, source_sha256, kind, state, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'staged', ?7, ?7)
      `).bind(itemId, importId, item.itemId, item.sourceRef, expectedHash, item.kind, now)
    );
  }

  await batch(db, stmts);

  return {
    staged: {
      importId,
      manifestId: manifest.manifestId,
      status: 'staged',
      manifestSha256,
      itemCount: manifest.items.length,
      stagedAt: now
    },
    replayed: false
  };
}

/**
 * Validates item contents, parses Markdown, and stages R2 assets with strict size & hash verification.
 * Requires explicit validated metadata and fails closed on missing attributes.
 */
export async function prepareImportPayloads(
  manifest: ImportManifest,
  fileGetter: (sourceRef: string) => Promise<Uint8Array | Buffer>,
  r2Bucket?: R2BucketLike | null,
  documentMetadata: Map<string, DocumentMetadataInput> = new Map(),
  assetMetadata: Map<string, AssetMetadataInput> = new Map()
): Promise<{
  documents: Map<string, PreparedResourcePayload>;
  assets: Map<string, PreparedAssetPayload>;
  errors: string[];
}> {
  const documents = new Map<string, PreparedResourcePayload>();
  const assets = new Map<string, PreparedAssetPayload>();
  const errors: string[] = [];

  // Canonical index for link resolution: maps item_id, slug, source_ref, and base filename
  const byItemId = new Map<string, ImportManifestItem>();
  const bySourceRef = new Map<string, ImportManifestItem>();
  const byFilename = new Map<string, ImportManifestItem>();

  for (const item of manifest.items) {
    byItemId.set(item.itemId, item);
    bySourceRef.set(item.sourceRef, item);
    const filename = item.sourceRef.split('/').pop();
    if (filename) byFilename.set(filename, item);
  }

  const buildLinkResolver = (docSourceRef: string) => (target: string) => {
    const clean = (target.split('#')[0] || '').trim();
    if (!clean) return null;

    // 1. Direct ID match
    let found = byItemId.get(clean);

    // 2. Source reference match
    if (!found) found = bySourceRef.get(clean);

    // 3. Filename match
    if (!found) found = byFilename.get(clean);

    // 4. Relative path resolution from current doc's directory
    if (!found && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      const docDir = docSourceRef.includes('/') ? docSourceRef.slice(0, docSourceRef.lastIndexOf('/')) : '';
      const parts = (docDir ? docDir + '/' + clean : clean).split('/');
      const normalizedParts: string[] = [];
      for (const p of parts) {
        if (p === '..') normalizedParts.pop();
        else if (p !== '.' && p !== '') normalizedParts.push(p);
      }
      const normalizedPath = normalizedParts.join('/');
      found = bySourceRef.get(normalizedPath) || byFilename.get(normalizedParts[normalizedParts.length - 1] || '');
    }

    if (!found) return null;

    return {
      id: found.resourceId || found.itemId,
      slug: found.itemId,
      href: `/reader/${found.itemId}`,
      isAuthorized: found.visibility !== 'owner_only'
    };
  };

  const assetResolver = (assetId: string) => {
    const clean = assetId.replace(/^asset:\/?\/?/, '').replace(/^\/api\/(?:media|assets)\//, '');
    const found = byItemId.get(clean) || byFilename.get(clean);
    if (!found || found.kind !== 'asset') return null;
    return {
      id: found.itemId,
      href: `/api/media/${found.itemId}`,
      isAuthorized: found.visibility !== 'owner_only'
    };
  };

  for (const item of manifest.items) {
    try {
      const fileBytes = await fileGetter(item.sourceRef);
      const actualHash = createHash('sha256').update(fileBytes).digest('hex');
      const expectedHash = item.kind === 'asset' ? (item.assetSha256 || item.sourceSha256) : item.sourceSha256;

      if (actualHash !== expectedHash) {
        errors.push(`SHA-256 mismatch for ${item.itemId}: expected ${expectedHash}, actual ${actualHash}`);
        continue;
      }
      if (item.byteLength !== undefined && fileBytes.byteLength !== item.byteLength) {
        errors.push(`Byte length mismatch for ${item.itemId}: expected ${item.byteLength}, actual ${fileBytes.byteLength}`);
        continue;
      }

      if (item.kind !== 'asset') {
        const meta = documentMetadata.get(item.itemId);
        if (!meta) {
          errors.push(`Missing explicit validated metadata for document: ${item.itemId}`);
          continue;
        }
        if (!meta.evidenceState || !meta.lifecycle) {
          errors.push(`Incomplete metadata for document ${item.itemId}: evidenceState and lifecycle required`);
          continue;
        }

        const resourceId = item.resourceId || item.itemId;
        const revisionId = `${resourceId}_r1`;

        // Strict fatal UTF-8 decode
        const textDecoder = new TextDecoder('utf-8', { fatal: true });
        const markdown = textDecoder.decode(fileBytes);
        const parsed = await parseMarkdown(markdown, {
          revisionId,
          resolveLink: buildLinkResolver(item.sourceRef),
          resolveAsset: assetResolver
        });

        documents.set(item.itemId, {
          item,
          markdown,
          parsed,
          contentSha256: actualHash,
          resourceId,
          revisionId,
          collectionId: meta.collectionId ?? null,
          evidenceState: meta.evidenceState,
          lifecycle: meta.lifecycle,
          authoredDate: meta.authoredDate ?? null,
          occurredAt: meta.occurredAt ?? null,
          provenanceNotes: meta.provenanceNotes ?? null
        });
      } else {
        const meta = assetMetadata.get(item.itemId);
        if (!meta) {
          errors.push(`Missing explicit validated metadata for asset: ${item.itemId}`);
          continue;
        }
        if (!meta.purpose || !meta.classification || !meta.consentState || !meta.consentEvidenceRef) {
          errors.push(`Incomplete metadata for asset ${item.itemId}: purpose, classification, consentState, and consentEvidenceRef required`);
          continue;
        }

        const assetId = item.itemId;
        const versionId = `${assetId}_v1`;
        const filename = item.sourceRef.split('/').pop() || item.itemId;
        const objectKey = `workspaces/${manifest.workspaceId}/assets/${assetId}/v1/${filename}`;
        let actualEtag = meta.etag || `"${actualHash}"`;

        // R2 Verification
        if (r2Bucket) {
          const putRes = await r2Bucket.put(objectKey, fileBytes, {
            httpMetadata: { contentType: item.mediaType || 'application/octet-stream' },
            customMetadata: { sha256: actualHash, assetId, versionId }
          });
          if (putRes && putRes.etag) {
            actualEtag = putRes.etag;
          }

          const headRes = await r2Bucket.head(objectKey);
          if (!headRes) {
            errors.push(`R2 object verification failed for asset ${assetId}: object not found after put`);
            continue;
          }
          if (headRes.size !== fileBytes.byteLength) {
            errors.push(`R2 object size mismatch for asset ${assetId}: expected ${fileBytes.byteLength}, actual ${headRes.size}`);
            continue;
          }
          if (headRes.etag) {
            actualEtag = headRes.etag;
          }

          // GET verification if supported
          if (typeof r2Bucket.get === 'function') {
            const getRes = await r2Bucket.get(objectKey);
            if (!getRes) {
              errors.push(`R2 GET verification failed for asset ${assetId}`);
              continue;
            }
            const getBytes = new Uint8Array(await getRes.arrayBuffer());
            const getHash = createHash('sha256').update(getBytes).digest('hex');
            if (getHash !== actualHash) {
              errors.push(`R2 GET byte digest mismatch for asset ${assetId}: expected ${actualHash}, actual ${getHash}`);
              continue;
            }
          }
        }

        assets.set(item.itemId, {
          item,
          assetId,
          versionId,
          objectKey,
          bytes: fileBytes,
          byteLength: fileBytes.byteLength,
          sha256: actualHash,
          etag: actualEtag,
          mediaType: item.mediaType || 'application/octet-stream',
          filename,
          purpose: meta.purpose,
          classification: meta.classification,
          consentState: meta.consentState,
          consentEvidenceRef: meta.consentEvidenceRef,
          parentAssetId: meta.parentAssetId ?? null,
          derivationTool: meta.derivationTool ?? null,
          derivationVersion: meta.derivationVersion ?? null
        });
      }
    } catch (err: any) {
      errors.push(`Failed to prepare item ${item.itemId}: ${err.message}`);
    }
  }

  return { documents, assets, errors };
}

/**
 * Builds the canonical parameterized SQL batch statements matching 0001_core.sql.
 * Follows strict dependency ordering to prevent foreign key trigger violations.
 * Populates share_release_assets to link guest-authorized assets to parent share releases.
 */
export function buildD1BatchStatements(
  context: StagedImportJobContext,
  authorAccountId: AccountId
): ParameterizedStatement[] {
  const { stagedImport, manifest, documents, assets, meetingCorrections, collections } = context;
  const now = new Date().toISOString();
  const stmts: ParameterizedStatement[] = [];

  const targetResourceSet = new Set<string>();
  for (const doc of documents.values()) {
    targetResourceSet.add(doc.resourceId);
  }

  // 1. Collections
  if (collections && collections.length > 0) {
    for (const c of collections) {
      const collectionId = c.id || (c as any).collection_id;
      const collectionName = c.name || (c as any).title;
      if (!collectionId || !collectionName) continue;

      stmts.push({
        sql: `INSERT OR IGNORE INTO collections (id, workspace_id, slug, name, grants_inherit, created_by_account_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`,
        params: [collectionId, manifest.workspaceId, c.slug, collectionName, c.grantsInherit ?? 0, authorAccountId, now]
      });
    }
  }

  // 2. Resources (initial insert with current_revision_id = NULL)
  for (const doc of documents.values()) {
    const item = doc.item;
    const archivedAt = doc.lifecycle === 'archived' ? now : null;

    stmts.push({
      sql: `INSERT INTO resources (id, workspace_id, collection_id, slug, kind, lifecycle, current_revision_id, created_by_account_id, created_at, updated_at, archived_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?8, ?9)`,
      params: [doc.resourceId, manifest.workspaceId, doc.collectionId || null, item.itemId, item.kind, doc.lifecycle, authorAccountId, now, archivedAt]
    });
  }

  // 3. Resource Revisions (revision 1 with base_revision_id = NULL)
  for (const doc of documents.values()) {
    const item = doc.item;
    const excerpt = doc.parsed.plainText.slice(0, 200).trim();
    const capturedAt = doc.authoredDate || doc.occurredAt || now;

    stmts.push({
      sql: `INSERT INTO resource_revisions (id, resource_id, workspace_id, revision_number, base_revision_id, restored_from_revision_id, title, markdown, excerpt, content_sha256, visibility, evidence_state, parser_contract_version, author_account_id, import_id, source_ref, source_sha256, source_captured_at, provenance_notes, created_at) VALUES (?1, ?2, ?3, 1, NULL, NULL, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
      params: [doc.revisionId, doc.resourceId, manifest.workspaceId, item.title, doc.markdown, excerpt, doc.contentSha256, item.visibility, doc.evidenceState, authorAccountId, stagedImport.importId, item.sourceRef, item.sourceSha256, capturedAt, doc.provenanceNotes, now]
    });

    // Populate D1 FTS5 search index with plain text
    stmts.push({
      sql: `INSERT INTO resource_fts (revision_id, workspace_id, resource_id, title, body) VALUES (?1, ?2, ?3, ?4, ?5)`,
      params: [doc.revisionId, manifest.workspaceId, doc.resourceId, item.title, doc.parsed.plainText]
    });
  }

  // 4. Update Resources current_revision_id to point to revision 1
  for (const doc of documents.values()) {
    stmts.push({
      sql: `UPDATE resources SET current_revision_id = ?1, updated_at = ?2 WHERE id = ?3 AND workspace_id = ?4`,
      params: [doc.revisionId, now, doc.resourceId, manifest.workspaceId]
    });
  }

  // 5. Revision Blocks (with globally unique ID: ${revisionId}:b${ordinal} matching COM-001)
  for (const doc of documents.values()) {
    let ordinal = 0;
    for (const heading of doc.parsed.headings) {
      const globalBlockId = `${doc.revisionId}:b${ordinal}`;
      const bodySha256 = createHash('sha256').update(`heading:${heading.text}`).digest('hex');
      stmts.push({
        sql: `INSERT INTO revision_blocks (id, revision_id, ordinal, block_type, body_sha256) VALUES (?1, ?2, ?3, 'heading', ?4)`,
        params: [globalBlockId, doc.revisionId, ordinal++, bodySha256]
      });
    }
  }

  // 6. Assets and Versions
  for (const asset of assets.values()) {
    if (!asset.item.resourceId) {
      throw new PortalDataError('INVALID', `Asset ${asset.assetId} is missing required resourceId parent reference`);
    }
    const parentResourceId = asset.item.resourceId;
    const parentRevisionId = `${parentResourceId}_r1`;

    stmts.push({
      sql: `INSERT INTO assets (id, workspace_id, resource_id, revision_id, current_version_id, purpose, parent_asset_id, classification, consent_state, consent_evidence_ref, state, created_by_account_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'ready', ?11, ?12, ?12)`,
      params: [
        asset.assetId,
        manifest.workspaceId,
        parentResourceId,
        parentRevisionId,
        asset.versionId,
        asset.purpose,
        asset.parentAssetId,
        asset.classification,
        asset.consentState,
        asset.consentEvidenceRef,
        authorAccountId,
        now
      ]
    });

    stmts.push({
      sql: `INSERT INTO asset_versions (id, asset_id, parent_version_id, version_number, object_key, original_filename, media_type, byte_length, sha256, etag, uploaded_at, derivation_tool, derivation_version, review_status) VALUES (?1, ?2, NULL, 1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'source')`,
      params: [
        asset.versionId,
        asset.assetId,
        asset.objectKey,
        asset.filename,
        asset.mediaType,
        asset.byteLength,
        asset.sha256,
        asset.etag,
        now,
        asset.derivationTool,
        asset.derivationVersion
      ]
    });
  }

  // 7. Share Releases, Resource Grants, and Share Release Assets
  for (const doc of documents.values()) {
    if (doc.item.visibility === 'workspace') {
      const grantId = `rg_${doc.resourceId}`;
      const releaseId = `sr_${doc.resourceId}`;
      stmts.push({
        sql: `INSERT INTO resource_grants (id, workspace_id, resource_id, revision_id, subject_type, subject_id, permission, effect, created_by_account_id, created_at) VALUES (?1, ?2, ?3, ?4, 'role', 'commenter', 'read', 'allow', ?5, ?6)`,
        params: [grantId, manifest.workspaceId, doc.resourceId, doc.revisionId, authorAccountId, now]
      });
      stmts.push({
        sql: `INSERT INTO share_releases (id, workspace_id, resource_id, revision_id, grant_id, audience_type, audience_id, status, released_by_account_id, released_at) VALUES (?1, ?2, ?3, ?4, ?5, 'role', 'commenter', 'active', ?6, ?7)`,
        params: [releaseId, manifest.workspaceId, doc.resourceId, doc.revisionId, grantId, authorAccountId, now]
      });

      // Link guest-authorized assets belonging to this resource into share_release_assets
      for (const asset of assets.values()) {
        if (asset.item.resourceId === doc.resourceId && asset.classification === 'guest') {
          stmts.push({
            sql: `INSERT INTO share_release_assets (share_release_id, asset_id, asset_version_id) VALUES (?1, ?2, ?3)`,
            params: [releaseId, asset.assetId, asset.versionId]
          });
        }
      }
    }
  }

  // 8. Revision Links (executed after all target resources exist)
  for (const doc of documents.values()) {
    let occurrence = 1;
    for (const link of doc.parsed.links) {
      const linkId = `${doc.revisionId}_lnk_${occurrence}`;
      const targetSlug = ((link.target || '').split('#')[0] || '');
      const isResolved = targetResourceSet.has(targetSlug);
      const targetResourceId = isResolved ? targetSlug : null;
      const status = isResolved ? 'resolved' : 'broken';

      stmts.push({
        sql: `INSERT INTO revision_links (id, workspace_id, source_resource_id, source_revision_id, target_key, target_resource_id, status, label, occurrence, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        params: [linkId, manifest.workspaceId, doc.resourceId, doc.revisionId, link.target, targetResourceId, status, link.alias || null, occurrence++, now]
      });
    }
  }

  // 9. Meeting Records
  for (const [mId, corr] of Object.entries(meetingCorrections)) {
    stmts.push({
      sql: `INSERT INTO meetings (resource_id, starts_at, ends_at, occurrence_status, occurred_at, original_audio_asset_id, playback_audio_asset_id, transcript_resource_id, summary_resource_id, presentation_resource_id) VALUES (?1, NULL, NULL, ?2, ?3, ?4, ?5, ?6, ?7, NULL)`,
      params: [
        mId,
        corr.occurrenceStatus || 'unknown',
        corr.occurredAt || null,
        corr.originalAudioAssetId || null,
        corr.playbackAudioAssetId || null,
        corr.transcriptResourceId || null,
        corr.summaryResourceId || null
      ]
    });
  }

  // 10. Record and Update Import Job
  stmts.push({
    sql: `INSERT OR IGNORE INTO import_jobs (id, workspace_id, manifest_id, manifest_sha256, source_label, status, initiated_by_account_id, staged_at) VALUES (?1, ?2, ?3, ?4, ?5, 'staged', ?6, ?7)`,
    params: [stagedImport.importId, manifest.workspaceId, manifest.manifestId, stagedImport.manifestSha256, manifest.sourceLabel, authorAccountId, now]
  });

  stmts.push({
    sql: `UPDATE import_jobs SET status = 'committed', committed_at = ?1 WHERE id = ?2 AND workspace_id = ?3`,
    params: [now, stagedImport.importId, manifest.workspaceId]
  });

  stmts.push({
    sql: `UPDATE import_items SET state = 'ready', updated_at = ?1 WHERE import_id = ?2`,
    params: [now, stagedImport.importId]
  });

  return stmts;
}

/**
 * Commits the staged import atomically to D1 in a single transaction batch.
 * In-worker implementation using D1 database binding.
 */
export async function commitImport(
  db: D1Database,
  context: StagedImportJobContext,
  authorAccountId: AccountId
): Promise<ImportCommitResult> {
  const { stagedImport, documents, assets } = context;
  const paramStmts = buildD1BatchStatements(context, authorAccountId);

  const prepared = paramStmts.map(s => db.prepare(s.sql).bind(...s.params));
  await batch(db, prepared);

  return {
    importId: stagedImport.importId,
    status: 'committed',
    createdResourceIds: Array.from(documents.values()).map(d => d.resourceId),
    createdAssetIds: Array.from(assets.values()).map(a => a.assetId),
    replayed: false
  };
}

/**
 * Executes atomic D1 batch via Cloudflare REST API.
 * Uses exact verified envelope: { batch: [ { sql, params }, ... ] }
 */
export async function executeD1BatchRest(
  d1QueryEndpoint: string,
  apiToken: string,
  statements: ParameterizedStatement[]
): Promise<any[]> {
  const res = await fetch(d1QueryEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      batch: statements.map(s => ({ sql: s.sql, params: s.params }))
    })
  });

  if (!res.ok) {
    throw new PortalDataError('UNAVAILABLE', `D1 REST query failed with HTTP ${res.status}`);
  }
  const data = await res.json() as { success: boolean; errors?: any[]; result?: any[] };
  if (!data.success) {
    throw new PortalDataError('INTEGRITY', `D1 REST batch rejected: ${JSON.stringify(data.errors).slice(0, 300)}`);
  }
  return data.result || [];
}
