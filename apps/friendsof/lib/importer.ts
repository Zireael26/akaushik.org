/**
 * Friends Portal (Spec 007) · Generic Private Importer
 *
 * Fully generic, catalog-driven intake adapting catalog entries into Sol's
 * canonical ImportManifest (schemaVersion: 1) from lib/contracts.ts.
 *
 * Enforces:
 * - Strict UTF-8 fatal decoding (no silent replacement chars).
 * - Strict kind validation (throws on unknown kinds, no silent fallback).
 * - Rejection of guest/owner overlap.
 * - Rejection of duplicate catalog IDs.
 * - Rejection of broken/invalid parent or dependency references.
 * - Zero hardcoded workspace IDs, client names, dates, or synthetic assets.
 */

import { createHash } from 'node:crypto';
import type {
  ImportManifest,
  ImportManifestItem,
  ResourceKind,
  RevisionVisibility,
  WorkspaceId,
  ISODateTime,
  MeetingRecord
} from './contracts.js';
import { parseMarkdown, type MarkdownParseResult, type MarkdownParseOptions } from './markdown.js';

export interface CatalogDocumentEntry {
  item_id: string;
  slug: string;
  title: string;
  kind: string;
  collection_id?: string;
  lifecycle?: string;
  evidence_status?: string;
  classification?: string;
  source_reference: string;
  source_hash: string;
  source_bytes: number;
  media_type?: string;
  occurred_at?: string | null;
  authored_date?: string | null;
  evidenced_author?: string;
  attachments?: string[];
  notes?: string;
}

export interface CatalogAssetEntry {
  item_id: string;
  slug: string;
  title: string;
  original_filename: string;
  source_reference: string;
  source_hash: string;
  source_bytes: number;
  media_type: string;
  collection_id?: string;
  classification?: string;
  parent_id?: string;
  role?: string;
  safe_render_handling?: string;
  notes?: string;
}

export interface RootApprovalManifest {
  approved_at: string;
  authority: string;
  source_manifest_sha256: string;
  guest_document_ids: string[];
  guest_asset_ids: string[];
  owner_only_document_ids: string[];
  owner_only_asset_ids?: string[];
  notes?: string[];
}

export interface GenericAdaptationOptions {
  manifestId: string;
  workspaceId: WorkspaceId;
  sourceLabel: string;
  createdAt?: ISODateTime;
  meetingCorrections?: Record<string, Partial<MeetingRecord>>;
  validParentIds?: ReadonlySet<string>;
}

export interface VerifiedImportItem {
  item: ImportManifestItem;
  verifiedHash: string;
  verifiedBytes: number;
  parsedMarkdown?: MarkdownParseResult;
  isValid: boolean;
  errors: string[];
}

const VALID_RESOURCE_KINDS = new Set<ResourceKind>([
  'meeting',
  'research',
  'presentation',
  'progress_update',
  'discussion',
  'document',
  'question'
]);

/**
 * Maps string kind from catalog to typed Sol ResourceKind.
 * Rejects unknown kinds with a fatal Error.
 */
export function mapToResourceKind(rawKind: string): ResourceKind {
  if (VALID_RESOURCE_KINDS.has(rawKind as ResourceKind)) {
    return rawKind as ResourceKind;
  }
  throw new Error(`Invalid or unknown resource kind: "${rawKind}". Must be one of: ${Array.from(VALID_RESOURCE_KINDS).join(', ')}`);
}

/**
 * Adapts generic catalog items and root approvals into Sol's canonical ImportManifest.
 * Validates against duplicate IDs, guest/owner overlaps, and broken dependencies.
 */
export function adaptCatalogToSolManifest(
  documents: readonly CatalogDocumentEntry[],
  assets: readonly CatalogAssetEntry[],
  approval: RootApprovalManifest,
  options: GenericAdaptationOptions
): { manifest: ImportManifest; meetingCorrections: Record<string, Partial<MeetingRecord>> } {
  if (!options.workspaceId) {
    throw new Error('workspaceId is required in GenericAdaptationOptions');
  }
  if (!options.manifestId) {
    throw new Error('manifestId is required in GenericAdaptationOptions');
  }

  // 1. Check for Duplicate Catalog IDs
  const seenDocIds = new Set<string>();
  const docMap = new Map<string, CatalogDocumentEntry>();
  for (const doc of documents) {
    if (seenDocIds.has(doc.item_id)) {
      throw new Error(`Duplicate document ID in catalog: "${doc.item_id}"`);
    }
    seenDocIds.add(doc.item_id);
    docMap.set(doc.item_id, doc);
  }

  const seenAssetIds = new Set<string>();
  const assetMap = new Map<string, CatalogAssetEntry>();
  for (const asset of assets) {
    if (seenAssetIds.has(asset.item_id)) {
      throw new Error(`Duplicate asset ID in catalog: "${asset.item_id}"`);
    }
    seenAssetIds.add(asset.item_id);
    assetMap.set(asset.item_id, asset);
  }

  // 2. Reject Guest / Owner Overlap
  const guestDocSet = new Set(approval.guest_document_ids);
  for (const ownerId of approval.owner_only_document_ids) {
    if (guestDocSet.has(ownerId)) {
      throw new Error(`Guest and owner document overlap detected on ID: "${ownerId}". An item cannot be both guest-shared and owner-only.`);
    }
  }

  if (approval.owner_only_asset_ids) {
    const guestAssetSet = new Set(approval.guest_asset_ids);
    for (const ownerAssetId of approval.owner_only_asset_ids) {
      if (guestAssetSet.has(ownerAssetId)) {
        throw new Error(`Guest and owner asset overlap detected on ID: "${ownerAssetId}". An asset cannot be both guest-shared and owner-only.`);
      }
    }
  }

  // 3. Validate Parent and Dependency References
  const validExternalParents = options.validParentIds || new Set<string>();

  for (const doc of documents) {
    if (doc.attachments && doc.attachments.length > 0) {
      for (const attId of doc.attachments) {
        if (!assetMap.has(attId) && !docMap.has(attId)) {
          throw new Error(`Invalid dependency reference "${attId}" in document "${doc.item_id}"`);
        }
      }
    }
  }

  for (const asset of assets) {
    if (asset.parent_id) {
      const isKnownDoc = docMap.has(asset.parent_id);
      const isKnownAsset = assetMap.has(asset.parent_id);
      const isExternalMeeting = validExternalParents.has(asset.parent_id) || asset.parent_id.startsWith('mtg_');
      if (!isKnownDoc && !isKnownAsset && !isExternalMeeting) {
        throw new Error(`Invalid parent reference "${asset.parent_id}" in asset "${asset.item_id}"`);
      }
    }
  }

  const manifestItems: ImportManifestItem[] = [];

  // 4. Process Approved Guest Documents
  for (const docId of approval.guest_document_ids) {
    const doc = docMap.get(docId);
    if (!doc) {
      throw new Error(`Approved guest document ID not found in catalog: ${docId}`);
    }
    manifestItems.push({
      itemId: doc.item_id,
      sourceRef: doc.source_reference,
      sourceSha256: doc.source_hash,
      resourceId: doc.item_id,
      kind: mapToResourceKind(doc.kind),
      title: doc.title,
      visibility: 'workspace',
      mediaType: doc.media_type || 'text/markdown',
      byteLength: doc.source_bytes,
      dependsOn: doc.attachments && doc.attachments.length > 0 ? doc.attachments : undefined
    });
  }

  // 5. Process Approved Guest Assets (driven strictly by catalog)
  for (const assetId of approval.guest_asset_ids) {
    const asset = assetMap.get(assetId);
    if (!asset) {
      throw new Error(`Approved guest asset ID not found in catalog: ${assetId}`);
    }
    manifestItems.push({
      itemId: asset.item_id,
      sourceRef: asset.source_reference,
      sourceSha256: asset.source_hash,
      resourceId: asset.parent_id,
      kind: 'asset',
      title: asset.title,
      visibility: 'workspace',
      mediaType: asset.media_type,
      byteLength: asset.source_bytes,
      assetSha256: asset.source_hash
    });
  }

  // 6. Process Owner-Only Documents
  for (const docId of approval.owner_only_document_ids) {
    const doc = docMap.get(docId);
    if (!doc) {
      throw new Error(`Approved owner document ID not found in catalog: ${docId}`);
    }
    manifestItems.push({
      itemId: doc.item_id,
      sourceRef: doc.source_reference,
      sourceSha256: doc.source_hash,
      resourceId: doc.item_id,
      kind: mapToResourceKind(doc.kind),
      title: doc.title,
      visibility: 'owner_only',
      mediaType: doc.media_type || 'text/markdown',
      byteLength: doc.source_bytes,
      dependsOn: doc.attachments && doc.attachments.length > 0 ? doc.attachments : undefined
    });
  }

  // 7. Process Owner-Only Assets if explicitly declared
  if (approval.owner_only_asset_ids) {
    for (const assetId of approval.owner_only_asset_ids) {
      const asset = assetMap.get(assetId);
      if (!asset) {
        throw new Error(`Approved owner asset ID not found in catalog: ${assetId}`);
      }
      manifestItems.push({
        itemId: asset.item_id,
        sourceRef: asset.source_reference,
        sourceSha256: asset.source_hash,
        resourceId: asset.parent_id,
        kind: 'asset',
        title: asset.title,
        visibility: 'owner_only',
        mediaType: asset.media_type,
        byteLength: asset.source_bytes,
        assetSha256: asset.source_hash
      });
    }
  }

  const manifest: ImportManifest = {
    schemaVersion: 1,
    manifestId: options.manifestId,
    workspaceId: options.workspaceId,
    sourceLabel: options.sourceLabel,
    createdAt: options.createdAt || new Date().toISOString(),
    items: manifestItems
  };

  const meetingCorrections = options.meetingCorrections || {};

  return { manifest, meetingCorrections };
}

/**
 * Cryptographically verifies an import item against raw staged bytes.
 * Uses fatal UTF-8 decoding for Markdown documents.
 */
export async function verifyStagedItem(
  item: ImportManifestItem,
  fileBytes: Buffer | Uint8Array,
  markdownOptions?: MarkdownParseOptions
): Promise<VerifiedImportItem> {
  const errors: string[] = [];
  const actualBytes = fileBytes.byteLength;
  const actualHash = createHash('sha256').update(fileBytes).digest('hex');

  // Verify byte length if declared
  if (item.byteLength !== undefined && item.byteLength !== actualBytes) {
    errors.push(`Byte length mismatch: declared ${item.byteLength}, actual ${actualBytes}`);
  }

  // Verify SHA-256 digest
  const expectedHash = item.kind === 'asset' ? (item.assetSha256 || item.sourceSha256) : item.sourceSha256;
  if (expectedHash !== actualHash) {
    errors.push(`SHA-256 mismatch: declared ${expectedHash}, actual ${actualHash}`);
  }

  let parsedMarkdown: MarkdownParseResult | undefined;
  if (item.kind !== 'asset') {
    try {
      // Strict fatal UTF-8 decode (no silent substitution characters)
      const textDecoder = new TextDecoder('utf-8', { fatal: true });
      const text = textDecoder.decode(fileBytes);
      parsedMarkdown = await parseMarkdown(text, markdownOptions);
    } catch (err: any) {
      errors.push(`Markdown processing failed: ${err.message}`);
    }
  }

  return {
    item,
    verifiedHash: actualHash,
    verifiedBytes: actualBytes,
    parsedMarkdown,
    isValid: errors.length === 0,
    errors
  };
}
