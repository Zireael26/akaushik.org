import type {
  CreatePublicationInput,
  PublicationExport,
  PublicationItem,
  PublicationRequest,
} from "./contracts";
import type { PortalDal } from "./dal";
import { all, batch, first, newId, PortalDataError, sha256Hex, stableJson } from "./db";

export interface PublicationServiceOptions { dal: PortalDal; now?: () => Date }

/** Server-only frozen bundle. Export only this copy; never let the public host query portal stores. */
export interface ApprovedPublicationBundle {
  publicationId: string;
  destination: string;
  approvalId: string;
  approvalDigest: string;
  resources: readonly {
    resourceId: string;
    revisionId: string;
    title: string;
    markdown: string;
    contentSha256: string;
    redactions: readonly { blockId: string; reason: string }[];
    consentEvidenceRef: string;
    assets: readonly {
      assetId: string;
      assetVersionId: string;
      objectKey: string;
      filename: string;
      mediaType: string;
      byteLength: number;
      sha256: string;
    }[];
  }[];
}

export class PublicationService {
  private readonly now: () => Date;
  constructor(private readonly options: PublicationServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async createDraft(input: CreatePublicationInput) {
    return this.options.dal.result(async () => {
      const principal = await this.options.dal.principal("publication.request");
      validatePublicationInput(input);
      const publicationId = newId("publication");
      const now = this.now().toISOString();
      const statements = [this.options.dal.db.prepare(`INSERT INTO publication_requests
        (id, workspace_id, status, purpose, destination, requested_by_account_id, requested_at)
        VALUES (?1, ?2, 'draft', ?3, ?4, ?5, ?6)`)
        .bind(publicationId, principal.workspaceId, input.purpose.trim(), normalizedDestination(input.destination),
          principal.context.accountId, now)];
      for (const item of uniqueItems(input.items)) {
        const revision = await first<{ ok: number }>(this.options.dal.db, `SELECT 1 AS ok
          FROM resources r JOIN resource_revisions rr ON rr.resource_id = r.id
          WHERE r.workspace_id = ?1 AND r.id = ?2 AND rr.id = ?3`,
        principal.workspaceId, item.resourceId, item.revisionId);
        if (!revision) throw new PortalDataError("INVALID", "Publication item is invalid");
        statements.push(this.options.dal.db.prepare(`INSERT INTO publication_items
          (publication_id, resource_id, revision_id, redactions_json, consent_evidence_ref)
          VALUES (?1, ?2, ?3, ?4, ?5)`)
          .bind(publicationId, item.resourceId, item.revisionId, stableJson(item.redactions), item.consentEvidenceRef.trim()));
        for (const assetId of [...new Set(item.assetIds)]) {
          const asset = await first<{ version_id: string }>(this.options.dal.db, `SELECT a.current_version_id AS version_id
            FROM assets a WHERE a.id = ?1 AND a.workspace_id = ?2 AND a.resource_id = ?3
              AND a.revision_id = ?4 AND a.state = 'ready'
              AND a.consent_state IN ('verified', 'not_required')`,
          assetId, principal.workspaceId, item.resourceId, item.revisionId);
          if (!asset?.version_id) throw new PortalDataError("INVALID", "Publication asset is invalid");
          statements.push(this.options.dal.db.prepare(`INSERT INTO publication_item_assets
            (publication_id, resource_id, revision_id, asset_id, asset_version_id)
            VALUES (?1, ?2, ?3, ?4, ?5)`)
            .bind(publicationId, item.resourceId, item.revisionId, assetId, asset.version_id));
        }
      }
      statements.push(audit(this.options.dal, principal.workspaceId, principal.context.accountId,
        "publication.create", publicationId, now));
      await batch(this.options.dal.db, statements);
      return this.read(publicationId, principal.workspaceId);
    });
  }

  async submit(publicationId: string) {
    return this.options.dal.result(async () => {
      const principal = await this.options.dal.principal("publication.request");
      const draft = await this.read(publicationId, principal.workspaceId);
      if (draft.status !== "draft") throw new PortalDataError("CONFLICT", "Publication is not a draft");
      const now = this.now().toISOString();
      await batch(this.options.dal.db, [
        this.options.dal.db.prepare(`UPDATE publication_requests SET status = 'awaiting_approval', submitted_at = ?3
          WHERE id = ?1 AND workspace_id = ?2 AND status = 'draft'`).bind(publicationId, principal.workspaceId, now),
        audit(this.options.dal, principal.workspaceId, principal.context.accountId, "publication.submit", publicationId, now),
      ]);
      return this.read(publicationId, principal.workspaceId);
    });
  }

  async approve(publicationId: string) {
    return this.options.dal.result(async () => {
      const principal = await this.options.dal.principal("publication.approve");
      requireRecentAuthentication(principal.context.authenticatedAt, this.now());
      const request = await first<{ status: string }>(this.options.dal.db,
        `SELECT status FROM publication_requests WHERE id = ?1 AND workspace_id = ?2`, publicationId, principal.workspaceId);
      if (request?.status !== "awaiting_approval") throw new PortalDataError("CONFLICT", "Publication is not awaiting approval");
      const snapshot = await this.snapshot(publicationId, principal.workspaceId);
      const digest = await sha256Hex(stableJson(snapshot));
      const approvalId = newId("approval");
      const now = this.now().toISOString();
      await batch(this.options.dal.db, [
        this.options.dal.db.prepare(`INSERT INTO publication_approvals
          (id, publication_id, approval_digest, decision, approver_account_id, decided_at)
          VALUES (?1, ?2, ?3, 'approved', ?4, ?5)`)
          .bind(approvalId, publicationId, digest, principal.context.accountId, now),
        this.options.dal.db.prepare(`UPDATE publication_requests SET status = 'approved'
          WHERE id = ?1 AND workspace_id = ?2 AND status = 'awaiting_approval'`).bind(publicationId, principal.workspaceId),
        audit(this.options.dal, principal.workspaceId, principal.context.accountId, "publication.approve", publicationId, now),
      ]);
      return { publicationId, approvalId, approvalDigest: digest };
    });
  }

  async approvedBundle(publicationId: string) {
    return this.options.dal.result(async (): Promise<ApprovedPublicationBundle> => {
      const principal = await this.options.dal.principal("publication.export");
      requireRecentAuthentication(principal.context.authenticatedAt, this.now());
      const request = await first<{ destination: string; status: string }>(this.options.dal.db,
        `SELECT destination, status FROM publication_requests WHERE id = ?1 AND workspace_id = ?2`, publicationId, principal.workspaceId);
      if (request?.status !== "approved") throw new PortalDataError("CONFLICT", "Publication is not approved");
      const approval = await first<{ id: string; approval_digest: string }>(this.options.dal.db,
        `SELECT id, approval_digest FROM publication_approvals
         WHERE publication_id = ?1 AND decision = 'approved' ORDER BY decided_at DESC LIMIT 1`, publicationId);
      if (!approval) throw new PortalDataError("INTEGRITY", "Approval record is missing");
      const snapshot = await this.snapshot(publicationId, principal.workspaceId);
      if (await sha256Hex(stableJson(snapshot)) !== approval.approval_digest) {
        throw new PortalDataError("INTEGRITY", "Approved publication changed");
      }
      return { publicationId, destination: request.destination, approvalId: approval.id,
        approvalDigest: approval.approval_digest, resources: snapshot };
    });
  }

  async recordExport(bundle: ApprovedPublicationBundle, manifestSha256: string) {
    return this.options.dal.result(async (): Promise<PublicationExport> => {
      const principal = await this.options.dal.principal("publication.export");
      requireRecentAuthentication(principal.context.authenticatedAt, this.now());
      if (!/^[a-f0-9]{64}$/u.test(manifestSha256)) throw new PortalDataError("INVALID", "Manifest hash is invalid");
      const current = await this.snapshot(bundle.publicationId, principal.workspaceId);
      if (await sha256Hex(stableJson(current)) !== bundle.approvalDigest) {
        throw new PortalDataError("INTEGRITY", "Approved publication changed");
      }
      const now = this.now().toISOString();
      const assetCount = bundle.resources.reduce((total, item) => total + item.assets.length, 0);
      await batch(this.options.dal.db, [
        this.options.dal.db.prepare(`INSERT INTO publication_exports
          (id, publication_id, approval_id, approval_digest, manifest_sha256, destination,
           resource_count, asset_count, exported_by_account_id, exported_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
          .bind(newId("export"), bundle.publicationId, bundle.approvalId, bundle.approvalDigest,
            manifestSha256, bundle.destination, bundle.resources.length, assetCount, principal.context.accountId, now),
        this.options.dal.db.prepare(`UPDATE publication_requests SET status = 'exported'
          WHERE id = ?1 AND workspace_id = ?2 AND status = 'approved'`).bind(bundle.publicationId, principal.workspaceId),
        audit(this.options.dal, principal.workspaceId, principal.context.accountId, "publication.export", bundle.publicationId, now),
      ]);
      return { publicationId: bundle.publicationId, approvalDigest: bundle.approvalDigest,
        manifestSha256, resourceCount: bundle.resources.length, assetCount, exportedAt: now };
    });
  }

  private async read(id: string, workspaceId: string): Promise<PublicationRequest> {
    const row = await first<PublicationRow>(this.options.dal.db, `SELECT pr.id, pr.workspace_id, pr.status,
      pr.purpose, pr.requested_by_account_id, pr.requested_at, pa.approver_account_id,
      pa.decided_at, pa.approval_digest FROM publication_requests pr
      LEFT JOIN publication_approvals pa ON pa.publication_id = pr.id AND pa.decision = 'approved'
      WHERE pr.id = ?1 AND pr.workspace_id = ?2 ORDER BY pa.decided_at DESC LIMIT 1`, id, workspaceId);
    if (!row) throw new PortalDataError("NOT_FOUND", "Not found");
    const items = await all<PublicationItemRow>(this.options.dal.db, `SELECT pi.resource_id, pi.revision_id,
      pi.redactions_json, pi.consent_evidence_ref,
      COALESCE(json_group_array(pia.asset_id) FILTER (WHERE pia.asset_id IS NOT NULL), '[]') AS asset_ids
      FROM publication_items pi LEFT JOIN publication_item_assets pia
        ON pia.publication_id = pi.publication_id AND pia.resource_id = pi.resource_id AND pia.revision_id = pi.revision_id
      WHERE pi.publication_id = ?1 GROUP BY pi.resource_id, pi.revision_id ORDER BY pi.resource_id`, id);
    return { id: row.id, workspaceId: row.workspace_id, status: row.status,
      purpose: row.purpose, requestedByAccountId: row.requested_by_account_id,
      requestedAt: row.requested_at, items: items.map(mapPublicationItem),
      approvedByAccountId: row.approver_account_id, approvedAt: row.decided_at,
      approvalDigest: row.approval_digest };
  }

  private async snapshot(publicationId: string, workspaceId: string): Promise<ApprovedPublicationBundle["resources"]> {
    const rows = await all<SnapshotRow>(this.options.dal.db, `SELECT pi.resource_id, pi.revision_id,
      rr.title, rr.markdown, rr.content_sha256, pi.redactions_json, pi.consent_evidence_ref,
      pia.asset_id, pia.asset_version_id, av.object_key, av.original_filename, av.media_type,
      av.byte_length, av.sha256
      FROM publication_items pi JOIN publication_requests pr ON pr.id = pi.publication_id
      JOIN resource_revisions rr ON rr.id = pi.revision_id AND rr.resource_id = pi.resource_id
      LEFT JOIN publication_item_assets pia ON pia.publication_id = pi.publication_id
        AND pia.resource_id = pi.resource_id AND pia.revision_id = pi.revision_id
      LEFT JOIN asset_versions av ON av.id = pia.asset_version_id AND av.asset_id = pia.asset_id
      WHERE pi.publication_id = ?1 AND pr.workspace_id = ?2
      ORDER BY pi.resource_id, pi.revision_id, pia.asset_id`, publicationId, workspaceId);
    const grouped = new Map<string, ApprovedPublicationBundle["resources"][number]>();
    for (const row of rows) {
      const key = `${row.resource_id}\u0000${row.revision_id}`;
      let item = grouped.get(key);
      if (!item) {
        item = { resourceId: row.resource_id, revisionId: row.revision_id, title: row.title,
          markdown: row.markdown, contentSha256: row.content_sha256,
          redactions: JSON.parse(row.redactions_json) as { blockId: string; reason: string }[],
          consentEvidenceRef: row.consent_evidence_ref, assets: [] };
        grouped.set(key, item);
      }
      if (row.asset_id && row.asset_version_id && row.object_key) {
        (item.assets as ApprovedPublicationBundle["resources"][number]["assets"][number][]).push({
          assetId: row.asset_id, assetVersionId: row.asset_version_id, objectKey: row.object_key,
          filename: row.original_filename!, mediaType: row.media_type!, byteLength: row.byte_length!, sha256: row.sha256!,
        });
      }
    }
    return [...grouped.values()];
  }
}

export function createPublicationService(options: PublicationServiceOptions): PublicationService {
  return new PublicationService(options);
}

interface PublicationRow {
  id: string; workspace_id: string; status: PublicationRequest["status"]; purpose: string;
  requested_by_account_id: string; requested_at: string; approver_account_id: string | null;
  decided_at: string | null; approval_digest: string | null;
}
interface PublicationItemRow {
  resource_id: string; revision_id: string; redactions_json: string;
  consent_evidence_ref: string; asset_ids: string;
}
interface SnapshotRow {
  resource_id: string; revision_id: string; title: string; markdown: string; content_sha256: string;
  redactions_json: string; consent_evidence_ref: string; asset_id: string | null;
  asset_version_id: string | null; object_key: string | null; original_filename: string | null;
  media_type: string | null; byte_length: number | null; sha256: string | null;
}

function mapPublicationItem(row: PublicationItemRow): PublicationItem {
  return { resourceId: row.resource_id, revisionId: row.revision_id,
    assetIds: JSON.parse(row.asset_ids) as string[],
    redactions: JSON.parse(row.redactions_json) as PublicationItem["redactions"],
    consentEvidenceRef: row.consent_evidence_ref };
}
function uniqueItems(items: readonly PublicationItem[]): PublicationItem[] {
  const seen = new Set<string>();
  return items.filter((item) => { const key = `${item.resourceId}\u0000${item.revisionId}`;
    if (seen.has(key)) return false; seen.add(key); return true; });
}
function validatePublicationInput(input: CreatePublicationInput): void {
  if (!input.purpose.trim() || input.items.length === 0 || input.items.length > 100) {
    throw new PortalDataError("INVALID", "Publication request is invalid");
  }
  for (const item of input.items) {
    if (!item.consentEvidenceRef.trim() || item.redactions.some((redaction) => !redaction.blockId || !redaction.reason.trim())) {
      throw new PortalDataError("INVALID", "Publication consent or redaction is invalid");
    }
  }
}
function normalizedDestination(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new PortalDataError("INVALID", "Publication destination is invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new PortalDataError("INVALID", "Publication destination is invalid");
  }
  return url.toString();
}
function requireRecentAuthentication(authenticatedAt: string, now: Date): void {
  const age = now.getTime() - Date.parse(authenticatedAt);
  if (!Number.isFinite(age) || age < 0 || age > 15 * 60_000) {
    throw new PortalDataError("UNAUTHENTICATED", "Recent authentication required");
  }
}
function audit(dal: PortalDal, workspaceId: string, accountId: string, action: string, targetId: string, now: string) {
  return dal.db.prepare(`INSERT INTO audit_events
    (id, workspace_id, request_id, actor_account_id, action, target_type, target_id, outcome, occurred_at, metadata_json)
    VALUES (?1, ?2, ?3, ?4, ?5, 'publication', ?6, 'success', ?7, '{}')`)
    .bind(newId("audit"), workspaceId, newId("req"), accountId, action, targetId, now);
}
