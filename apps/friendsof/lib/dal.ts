import { parseMarkdown } from "./markdown";
import type { AuthorizedSourceLinkEntry } from "./source-link-resolver";
import type {
  AssetSummary,
  AuditEvent,
  AuthorizedPrincipal,
  Backlink,
  Capability,
  CollectionSummary,
  CommentRecord,
  CreateCommentInput,
  CreateQuestionInput,
  CreateResourceInput,
  CreateShareInput,
  DataResult,
  DecisionRecord,
  GetRequestContext,
  GrantInput,
  GrantRecord,
  MeetingRecord,
  MembershipSummary,
  PromoteDecisionInput,
  QuestionRecord,
  ResourceDetail,
  ResourceId,
  ResourceKind,
  ResourceRevision,
  ResourceSummary,
  RevisionId,
  SaveRevisionInput,
  SearchHit,
  SubmitAnswerInput,
  ShareReleaseRecord,
  UnreadItem,
  WorkspaceSession,
} from "./contracts";
import {
  all,
  batch,
  type D1Database,
  first,
  newId,
  PortalDataError,
  readableRevision,
  requireCapability,
  resolvePrincipal,
  run,
  sha256Hex,
  type ReadableRevisionRow,
} from "./db";

export interface PortalDalOptions {
  db: D1Database;
  getRequestContext: GetRequestContext;
  now?: () => Date;
  requestId?: () => string;
}

interface BlockInput { id: string; ordinal: number; type: string; hash: string }
interface LinkInput {
  id: string;
  targetKey: string;
  targetResourceId: string | null;
  status: "resolved" | "broken" | "ambiguous";
  label: string | null;
  occurrence: number;
}

const MAX_LIST = 100;
const MAX_SEARCH_RESULTS = 20;
const MAX_BACKLINKS = 40;
const MAX_AWARE_PER_KIND = 10;
const MAX_SEARCH_QUERY = 200;

export class PortalDal {
  readonly db: D1Database;
  private readonly getRequestContext: GetRequestContext;
  private readonly now: () => Date;
  private readonly requestId: () => string;

  constructor(options: PortalDalOptions) {
    this.db = options.db;
    this.getRequestContext = options.getRequestContext;
    this.now = options.now ?? (() => new Date());
    this.requestId = options.requestId ?? (() => newId("req"));
  }

  /** Server-only entrypoint used by sibling data services; context is never caller supplied. */
  async principal(capability?: Capability): Promise<AuthorizedPrincipal> {
    const context = await this.getRequestContext();
    if (!context) throw new PortalDataError("UNAUTHENTICATED", "Authentication required");
    const principal = await resolvePrincipal(this.db, context);
    if (capability) requireCapability(principal, capability);
    return principal;
  }

  async result<T>(operation: () => Promise<T>): Promise<DataResult<T>> {
    try {
      return { ok: true, value: await operation() };
    } catch (error) {
      if (error instanceof PortalDataError) {
        return { ok: false, code: error.code, message: error.message, retryable: error.retryable };
      }
      return { ok: false, code: "UNAVAILABLE", message: "Operation unavailable", retryable: true };
    }
  }

  async session(): Promise<DataResult<WorkspaceSession>> {
    return this.result(async () => {
      const principal = await this.principal();
      const workspace = await first<{ slug: string; name: string }>(this.db,
        `SELECT slug, name FROM workspaces WHERE id = ?1 AND status = 'active'`, principal.workspaceId);
      if (!workspace) throw new PortalDataError("UNAUTHENTICATED", "Authentication required");
      return { accountId: principal.context.accountId, membershipId: principal.membershipId,
        workspace: { id: principal.workspaceId, slug: workspace.slug, name: workspace.name, role: principal.role },
        capabilities: [...principal.capabilities].sort() };
    });
  }

  async getResourceBySlug(slug: string): Promise<DataResult<ResourceDetail>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const resource = await first<{ id: string }>(this.db,
        `SELECT id FROM resources WHERE workspace_id = ?1 AND slug = ?2`, principal.workspaceId, safeSlug(slug));
      if (!resource) throw hiddenNotFound();
      return this.unwrap(await this.getResource(resource.id));
    });
  }

  async listMemberships(): Promise<DataResult<MembershipSummary[]>> {
    return this.result(async () => {
      const principal = await this.principal("membership.manage");
      this.requireRecent(principal);
      const rows = await all<{ id: string; account_id: string; role: MembershipSummary["role"];
        status: MembershipSummary["status"]; joined_at: string | null }>(this.db, `SELECT id, account_id, role, status, joined_at
        FROM memberships WHERE workspace_id = ?1 ORDER BY created_at`, principal.workspaceId);
      return rows.map((row) => ({ id: row.id, accountId: row.account_id, role: row.role,
        status: row.status, joinedAt: row.joined_at }));
    });
  }

  async addMembership(accountId: string, role: MembershipSummary["role"]): Promise<DataResult<MembershipSummary>> {
    return this.result(async () => {
      const principal = await this.principal("membership.manage");
      this.requireRecent(principal);
      if (!accountId || !isRole(role)) throw new PortalDataError("INVALID", "Membership is invalid");
      const id = newId("member");
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`INSERT INTO memberships
          (id, workspace_id, account_id, role, status, joined_at, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5, ?5)`)
          .bind(id, principal.workspaceId, accountId, role, now),
        this.audit(principal, "membership.create", "membership", id, "success", now),
      ]);
      return { id, accountId, role, status: "active", joinedAt: now };
    });
  }

  async setMembershipStatus(membershipId: string, status: "active" | "disabled") {
    return this.result(async () => {
      const principal = await this.principal("membership.manage");
      this.requireRecent(principal);
      if (membershipId === principal.membershipId && status === "disabled") {
        throw new PortalDataError("INVALID", "Cannot disable the current membership");
      }
      const target = await first<{ id: string }>(this.db, `SELECT id FROM memberships
        WHERE id = ?1 AND workspace_id = ?2`, membershipId, principal.workspaceId);
      if (!target) throw hiddenNotFound();
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`UPDATE memberships SET status = ?3, updated_at = ?4
          WHERE id = ?1 AND workspace_id = ?2`).bind(membershipId, principal.workspaceId, status, now),
        this.audit(principal, `membership.${status}`, "membership", membershipId, "success", now),
      ]);
    });
  }

  async createCollection(input: { slug?: string; name: string; grantsInherit: boolean }): Promise<DataResult<CollectionSummary>> {
    return this.result(async () => {
      const principal = await this.principal("collection.manage");
      if (!input.name.trim()) throw new PortalDataError("INVALID", "Collection is invalid");
      const id = newId("collection");
      const slug = safeSlug(input.slug ?? input.name);
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`INSERT INTO collections
          (id, workspace_id, slug, name, grants_inherit, created_by_account_id, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`)
          .bind(id, principal.workspaceId, slug, input.name.trim(), input.grantsInherit ? 1 : 0, principal.context.accountId, now),
        this.audit(principal, "collection.create", "collection", id, "success", now),
      ]);
      return { id, slug, name: input.name.trim(), grantsInherit: input.grantsInherit };
    });
  }

  async createGrant(input: GrantInput): Promise<DataResult<GrantRecord>> {
    return this.result(async () => {
      const principal = await this.principal("grant.manage");
      this.requireRecent(principal);
      await this.validateAudience(principal, input.subjectType, input.subjectId);
      const table = input.targetType === "resource" ? "resource_grants" : "collection_grants";
      const targetColumn = input.targetType === "resource" ? "resource_id" : "collection_id";
      const target = await first(this.db, `SELECT id FROM ${input.targetType === "resource" ? "resources" : "collections"}
        WHERE id = ?1 AND workspace_id = ?2`, input.targetId, principal.workspaceId);
      if (!target) throw hiddenNotFound();
      if (input.targetType === "collection" && input.revisionId) throw new PortalDataError("INVALID", "Collection grant cannot target a revision");
      if (input.revisionId && !await first(this.db, `SELECT id FROM resource_revisions
        WHERE id = ?1 AND resource_id = ?2 AND workspace_id = ?3`, input.revisionId, input.targetId, principal.workspaceId)) {
        throw new PortalDataError("INVALID", "Grant revision is invalid");
      }
      const id = newId("grant");
      const now = this.isoNow();
      const statement = input.targetType === "resource"
        ? this.db.prepare(`INSERT INTO resource_grants
            (id, workspace_id, ${targetColumn}, revision_id, subject_type, subject_id, permission, effect,
             created_by_account_id, created_at, revoked_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, NULL)`)
          .bind(id, principal.workspaceId, input.targetId, input.revisionId ?? null, input.subjectType,
            input.subjectId, input.permission, input.effect, principal.context.accountId, now)
        : this.db.prepare(`INSERT INTO collection_grants
            (id, workspace_id, ${targetColumn}, subject_type, subject_id, permission, effect, inheritable,
             created_by_account_id, created_at, revoked_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, NULL)`)
          .bind(id, principal.workspaceId, input.targetId, input.subjectType, input.subjectId,
            input.permission, input.effect, input.inheritable === false ? 0 : 1, principal.context.accountId, now);
      await batch(this.db, [statement, this.audit(principal, "grant.create", "grant", id, "success", now)]);
      return { ...input, id, createdAt: now, revokedAt: null };
    });
  }

  async revokeGrant(grantId: string, targetType: "resource" | "collection"): Promise<DataResult<void>> {
    return this.result(async () => {
      const principal = await this.principal("grant.manage");
      this.requireRecent(principal);
      const table = targetType === "resource" ? "resource_grants" : "collection_grants";
      if (!await first(this.db, `SELECT id FROM ${table} WHERE id = ?1 AND workspace_id = ?2 AND revoked_at IS NULL`,
        grantId, principal.workspaceId)) throw hiddenNotFound();
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`UPDATE ${table} SET revoked_at = ?3 WHERE id = ?1 AND workspace_id = ?2 AND revoked_at IS NULL`)
          .bind(grantId, principal.workspaceId, now),
        this.audit(principal, "grant.revoke", "grant", grantId, "success", now),
      ]);
    });
  }

  async listAuditEvents(limit = 50): Promise<DataResult<AuditEvent[]>> {
    return this.result(async () => {
      const principal = await this.principal("audit.read");
      this.requireRecent(principal);
      const rows = await all<AuditRow>(this.db, `SELECT id, request_id, actor_account_id, action,
        target_type, target_id, outcome, occurred_at FROM audit_events
        WHERE workspace_id = ?1 ORDER BY occurred_at DESC LIMIT ?2`, principal.workspaceId, boundedLimit(limit));
      return rows.map((row) => ({ id: row.id, requestId: row.request_id, actorAccountId: row.actor_account_id,
        action: row.action, targetType: row.target_type, targetId: row.target_id,
        outcome: row.outcome, occurredAt: row.occurred_at }));
    });
  }

  async listResources(filters: { kind?: ResourceKind; limit?: number } = {}): Promise<DataResult<ResourceSummary[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const limit = boundedLimit(filters.limit);
      const author = principal.role === "owner" || principal.role === "editor";
      const rows = author
        ? await all<SummaryRow>(this.db, `${SUMMARY_SELECT}
            JOIN resource_revisions rr ON rr.id = r.current_revision_id
            WHERE r.workspace_id = ?1 AND (?2 IS NULL OR r.kind = ?2)
            ORDER BY r.updated_at DESC LIMIT ?5`,
          principal.workspaceId, filters.kind ?? null, principal.membershipId, principal.context.accountId, limit)
        : await all<SummaryRow>(this.db, `${SUMMARY_SELECT}
            JOIN resource_revisions rr ON rr.resource_id = r.id
            JOIN share_releases sr ON sr.workspace_id = r.workspace_id AND sr.resource_id = r.id
              AND sr.revision_id = rr.id AND sr.status = 'active'
              AND ((sr.audience_type = 'member' AND sr.audience_id = ?3)
                OR (sr.audience_type = 'role' AND sr.audience_id = ?6))
            WHERE r.workspace_id = ?1 AND r.lifecycle = 'shared' AND (?2 IS NULL OR r.kind = ?2)
              AND rr.visibility <> 'owner_only'
              AND (rr.visibility <> 'selected_members' OR EXISTS (
                SELECT 1 FROM revision_selected_members rsm
                WHERE rsm.revision_id = rr.id AND rsm.membership_id = ?3))
              AND NOT EXISTS (SELECT 1 FROM resource_grants deny
                WHERE deny.workspace_id = r.workspace_id AND deny.resource_id = r.id
                  AND (deny.revision_id IS NULL OR deny.revision_id = rr.id)
                  AND deny.permission = 'read' AND deny.effect = 'deny' AND deny.revoked_at IS NULL
                  AND ((deny.subject_type = 'member' AND deny.subject_id = ?3)
                    OR (deny.subject_type = 'role' AND deny.subject_id = ?6)))
              AND NOT EXISTS (SELECT 1 FROM collection_grants deny_collection
                WHERE deny_collection.workspace_id = r.workspace_id
                  AND deny_collection.collection_id = r.collection_id
                  AND deny_collection.permission = 'read' AND deny_collection.effect = 'deny'
                  AND deny_collection.inheritable = 1 AND deny_collection.revoked_at IS NULL
                  AND ((deny_collection.subject_type = 'member' AND deny_collection.subject_id = ?3)
                    OR (deny_collection.subject_type = 'role' AND deny_collection.subject_id = ?6)))
              AND (EXISTS (SELECT 1 FROM resource_grants allow_resource
                  WHERE allow_resource.workspace_id = r.workspace_id AND allow_resource.resource_id = r.id
                    AND (allow_resource.revision_id IS NULL OR allow_resource.revision_id = rr.id)
                    AND allow_resource.permission = 'read' AND allow_resource.effect = 'allow'
                    AND allow_resource.revoked_at IS NULL
                    AND ((allow_resource.subject_type = 'member' AND allow_resource.subject_id = ?3)
                      OR (allow_resource.subject_type = 'role' AND allow_resource.subject_id = ?6)))
                OR EXISTS (SELECT 1 FROM collections c JOIN collection_grants allow_collection
                    ON allow_collection.collection_id = c.id AND allow_collection.workspace_id = c.workspace_id
                  WHERE c.id = r.collection_id AND c.workspace_id = r.workspace_id AND c.grants_inherit = 1
                    AND allow_collection.permission = 'read' AND allow_collection.effect = 'allow'
                    AND allow_collection.inheritable = 1 AND allow_collection.revoked_at IS NULL
                    AND ((allow_collection.subject_type = 'member' AND allow_collection.subject_id = ?3)
                      OR (allow_collection.subject_type = 'role' AND allow_collection.subject_id = ?6))))
            GROUP BY r.id, rr.id ORDER BY MAX(sr.released_at) DESC LIMIT ?5`,
          principal.workspaceId, filters.kind ?? null, principal.membershipId,
          principal.context.accountId, limit, principal.role);
      return rows.map(mapSummaryRow);
    });
  }

  /**
   * Server-rendering catalog only. Source references never enter public DTOs;
   * entries are derived from the current request's already-authorized revisions.
   */
  async authorizedLinkCatalog(): Promise<DataResult<AuthorizedSourceLinkEntry[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const visible = this.unwrap(await this.listResources({ limit: MAX_LIST }));
      if (visible.length === 0) return [];
      const byResource = new Map(visible.map((resource) => [resource.id, resource]));
      const resourcePlaceholders = visible.map((_, index) => `?${index + 2}`).join(",");
      const assetPlaceholders = visible.map((_, index) => `?${index + 5}`).join(",");
      const resourceRows = await all<{ resource_id: string; revision_id: string; slug: string;
        title: string; source_ref: string | null }>(this.db, `SELECT r.id AS resource_id,
          rr.id AS revision_id, r.slug, rr.title, rr.source_ref
        FROM resources r JOIN resource_revisions rr ON rr.resource_id = r.id
        WHERE r.workspace_id = ?1 AND r.id IN (${resourcePlaceholders})`,
      principal.workspaceId, ...visible.map((resource) => resource.id));

      const entries: AuthorizedSourceLinkEntry[] = resourceRows
        .filter((row) => byResource.get(row.resource_id)?.headRevisionId === row.revision_id)
        .map((row) => ({ kind: "resource", id: row.resource_id, slug: row.slug,
          title: row.title, sourceRef: row.source_ref }));

      const author = principal.role === "owner" || principal.role === "editor";
      const assetRows = await all<{ id: string; resource_id: string; revision_id: string;
        filename: string; source_ref: string | null }>(this.db, `SELECT a.id, a.resource_id,
          a.revision_id, av.original_filename AS filename,
          (SELECT ii.source_ref FROM import_items ii
            WHERE ii.manifest_item_id = a.id AND ii.state = 'ready'
            ORDER BY ii.updated_at DESC LIMIT 1) AS source_ref
        FROM assets a JOIN asset_versions av ON av.id = a.current_version_id
        WHERE a.workspace_id = ?1 AND a.state = 'ready'
          AND a.resource_id IN (${assetPlaceholders})
          AND (?2 = 1 OR (a.classification = 'guest'
            AND a.consent_state IN ('verified', 'not_required')
            AND EXISTS (SELECT 1 FROM share_release_assets sra
              JOIN share_releases sr ON sr.id = sra.share_release_id
              WHERE sra.asset_id = a.id AND sra.asset_version_id = av.id
                AND sr.workspace_id = a.workspace_id AND sr.resource_id = a.resource_id
                AND sr.revision_id = a.revision_id AND sr.status = 'active'
                AND ((sr.audience_type = 'member' AND sr.audience_id = ?3)
                  OR (sr.audience_type = 'role' AND sr.audience_id = ?4)))))`,
      principal.workspaceId, author ? 1 : 0, principal.membershipId, principal.role,
      ...visible.map((resource) => resource.id));
      for (const row of assetRows) {
        const parent = byResource.get(row.resource_id);
        if (parent?.headRevisionId !== row.revision_id) continue;
        entries.push({ kind: "asset", id: row.id, slug: row.id,
          title: row.filename, sourceRef: row.source_ref });
      }
      return entries;
    });
  }

  async getResource(resourceId: ResourceId, revisionId?: RevisionId): Promise<DataResult<ResourceDetail>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const row = await readableRevision(this.db, principal, resourceId, revisionId);
      if (!row) throw hiddenNotFound();
      const [summary, assets, rawLinks, meeting] = await Promise.all([
        this.summary(principal, row),
        this.assetsFor(principal, row),
        all<{ source_resource_id: string; source_revision_id: string; target_key: string;
          target_resource_id: string | null; status: "resolved" | "broken" | "ambiguous"; label: string | null }>(this.db, `
          SELECT source_resource_id, source_revision_id, target_key, target_resource_id, status, label
          FROM revision_links WHERE workspace_id = ?1 AND source_revision_id = ?2
          ORDER BY occurrence LIMIT 30
        `, principal.workspaceId, row.revision_id),
        first<MeetingRow>(this.db, `
          SELECT resource_id, starts_at, ends_at, occurrence_status, occurred_at,
            original_audio_asset_id, playback_audio_asset_id, transcript_resource_id,
            summary_resource_id, presentation_resource_id
          FROM meetings WHERE resource_id = ?1
        `, row.resource_id),
      ]);
      const links = [];
      const canInspectResolution = principal.role === "owner" || principal.role === "editor";
      for (const link of rawLinks) {
        if (!link.target_resource_id) {
          links.push({ sourceResourceId: link.source_resource_id, sourceRevisionId: link.source_revision_id,
            target: canInspectResolution ? link.target_key : "", targetResourceId: null,
            status: canInspectResolution ? link.status : "unavailable" as const, label: link.label });
        } else if (await readableRevision(this.db, principal, link.target_resource_id)) {
          links.push({ sourceResourceId: link.source_resource_id, sourceRevisionId: link.source_revision_id,
            target: link.target_key, targetResourceId: link.target_resource_id, status: "resolved" as const, label: link.label });
        } else {
          links.push({ sourceResourceId: link.source_resource_id, sourceRevisionId: link.source_revision_id,
            target: "", targetResourceId: null, status: "unavailable" as const, label: link.label });
        }
      }
      return { ...summary, revision: mapRevision(row), assets, links,
        meeting: meeting ? mapMeeting(meeting) : null };
    });
  }

  async search(query: string, limit = 30): Promise<DataResult<SearchHit[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const ftsQuery = safeFtsQuery(query);
      if (!ftsQuery) return [];
      const resultLimit = Math.min(MAX_SEARCH_RESULTS, boundedLimit(limit));
      const author = principal.role === "owner" || principal.role === "editor";
      const rows = author
        ? await all<SearchSummaryRow>(this.db, `${SEARCH_SELECT}
            JOIN resource_revisions rr ON rr.id = resource_fts.revision_id
              AND rr.id = r.current_revision_id
            WHERE resource_fts.workspace_id = ?1 AND resource_fts MATCH ?2
            ORDER BY rank LIMIT ?5`, principal.workspaceId, ftsQuery,
          principal.membershipId, principal.context.accountId, resultLimit)
        : await all<SearchSummaryRow>(this.db, `${SEARCH_SELECT}
            JOIN resource_revisions rr ON rr.id = resource_fts.revision_id
            WHERE resource_fts.workspace_id = ?1 AND resource_fts MATCH ?2
              AND r.lifecycle = 'shared' AND rr.visibility <> 'owner_only'
              AND EXISTS (SELECT 1 FROM share_releases sr
                WHERE sr.workspace_id = r.workspace_id AND sr.resource_id = r.id
                  AND sr.revision_id = rr.id AND sr.status = 'active'
                  AND ((sr.audience_type = 'member' AND sr.audience_id = ?3)
                    OR (sr.audience_type = 'role' AND sr.audience_id = ?6)))
              AND (rr.visibility <> 'selected_members' OR EXISTS (SELECT 1
                FROM revision_selected_members rsm WHERE rsm.revision_id = rr.id AND rsm.membership_id = ?3))
              AND NOT EXISTS (SELECT 1 FROM resource_grants deny
                WHERE deny.workspace_id = r.workspace_id AND deny.resource_id = r.id
                  AND (deny.revision_id IS NULL OR deny.revision_id = rr.id)
                  AND deny.permission = 'read' AND deny.effect = 'deny' AND deny.revoked_at IS NULL
                  AND ((deny.subject_type = 'member' AND deny.subject_id = ?3)
                    OR (deny.subject_type = 'role' AND deny.subject_id = ?6)))
              AND NOT EXISTS (SELECT 1 FROM collection_grants deny_collection
                WHERE deny_collection.workspace_id = r.workspace_id
                  AND deny_collection.collection_id = r.collection_id
                  AND deny_collection.permission = 'read' AND deny_collection.effect = 'deny'
                  AND deny_collection.inheritable = 1 AND deny_collection.revoked_at IS NULL
                  AND ((deny_collection.subject_type = 'member' AND deny_collection.subject_id = ?3)
                    OR (deny_collection.subject_type = 'role' AND deny_collection.subject_id = ?6)))
              AND (EXISTS (SELECT 1 FROM resource_grants allow_resource
                  WHERE allow_resource.workspace_id = r.workspace_id AND allow_resource.resource_id = r.id
                    AND (allow_resource.revision_id IS NULL OR allow_resource.revision_id = rr.id)
                    AND allow_resource.permission = 'read' AND allow_resource.effect = 'allow'
                    AND allow_resource.revoked_at IS NULL
                    AND ((allow_resource.subject_type = 'member' AND allow_resource.subject_id = ?3)
                      OR (allow_resource.subject_type = 'role' AND allow_resource.subject_id = ?6)))
                OR EXISTS (SELECT 1 FROM collections c JOIN collection_grants allow_collection
                    ON allow_collection.collection_id = c.id AND allow_collection.workspace_id = c.workspace_id
                  WHERE c.id = r.collection_id AND c.workspace_id = r.workspace_id AND c.grants_inherit = 1
                    AND allow_collection.permission = 'read' AND allow_collection.effect = 'allow'
                    AND allow_collection.inheritable = 1 AND allow_collection.revoked_at IS NULL
                    AND ((allow_collection.subject_type = 'member' AND allow_collection.subject_id = ?3)
                      OR (allow_collection.subject_type = 'role' AND allow_collection.subject_id = ?6))))
            ORDER BY rank LIMIT ?5`, principal.workspaceId, ftsQuery,
          principal.membershipId, principal.context.accountId, resultLimit, principal.role);
      return rows.map((row) => ({ resource: mapSearchSummaryRow(row), snippet: row.snippet, rank: row.rank }));
    });
  }

  async backlinks(resourceId: ResourceId, revisionId?: RevisionId): Promise<DataResult<Backlink[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const target = await readableRevision(this.db, principal, resourceId, revisionId);
      if (!target) throw hiddenNotFound();
      const candidates = await all<{ source_resource_id: string; source_revision_id: string; label: string | null }>(this.db, `
        SELECT source_resource_id, source_revision_id, label FROM revision_links
        WHERE workspace_id = ?1 AND target_resource_id = ?2
        ORDER BY created_at DESC LIMIT ?3
      `, principal.workspaceId, resourceId, MAX_BACKLINKS);
      const output: Backlink[] = [];
      for (const candidate of candidates) {
        const source = await readableRevision(this.db, principal, candidate.source_resource_id, candidate.source_revision_id);
        if (source) output.push({
          sourceResourceId: source.resource_id,
          sourceTitle: source.title,
          sourceRevisionId: source.revision_id,
          label: candidate.label,
        });
      }
      return output;
    });
  }

  async unread(): Promise<DataResult<UnreadItem[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const candidates = await all<{ resource_id: string; revision_id: string; released_at: string }>(this.db, `
        SELECT sr.resource_id, sr.revision_id, MAX(sr.released_at) AS released_at
        FROM share_releases sr
        LEFT JOIN member_resource_state state
          ON state.membership_id = ?2 AND state.resource_id = sr.resource_id
        WHERE sr.workspace_id = ?1 AND sr.status = 'active'
          AND ((sr.audience_type = 'member' AND sr.audience_id = ?2)
            OR (sr.audience_type = 'role' AND sr.audience_id = ?3))
          AND (state.last_read_revision_id IS NULL OR state.last_read_revision_id <> sr.revision_id)
        GROUP BY sr.resource_id, sr.revision_id
        ORDER BY released_at DESC LIMIT ?4
      `, principal.workspaceId, principal.membershipId, principal.role, MAX_AWARE_PER_KIND);
      const output: UnreadItem[] = [];
      for (const candidate of candidates) {
        const row = await readableRevision(this.db, principal, candidate.resource_id, candidate.revision_id);
        if (row) output.push({ resource: await this.summary(principal, row), reason: "new_revision", changedAt: candidate.released_at });
      }
      const assigned = await all<{ question_id: string; resource_id: string; revision_id: string; assigned_at: string }>(this.db, `
        SELECT qa.question_id, q.resource_id, q.revision_id, qa.assigned_at
        FROM question_assignments qa JOIN questions q ON q.id = qa.question_id
        WHERE qa.membership_id = ?1 AND q.workspace_id = ?2 AND q.status = 'open'
          AND NOT EXISTS (SELECT 1 FROM question_answers a
            WHERE a.question_id = q.id AND a.author_account_id = ?3 AND a.status IN ('submitted', 'accepted'))
        ORDER BY qa.assigned_at DESC LIMIT ?4
      `, principal.membershipId, principal.workspaceId, principal.context.accountId, MAX_AWARE_PER_KIND);
      for (const item of assigned) {
        const row = await readableRevision(this.db, principal, item.resource_id, item.revision_id);
        if (row) output.push({ resource: await this.summary(principal, row), reason: "assigned_question", changedAt: item.assigned_at });
      }
      return output.sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, MAX_LIST);
    });
  }

  async markRead(resourceId: ResourceId, revisionId: RevisionId): Promise<DataResult<void>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      if (!await readableRevision(this.db, principal, resourceId, revisionId)) throw hiddenNotFound();
      const now = this.isoNow();
      await run(this.db, `
        INSERT INTO member_resource_state(membership_id, resource_id, last_read_revision_id, last_read_at)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(membership_id, resource_id) DO UPDATE SET
          last_read_revision_id = excluded.last_read_revision_id,
          last_read_at = excluded.last_read_at
      `, principal.membershipId, resourceId, revisionId, now);
    });
  }

  async createResource(input: CreateResourceInput): Promise<DataResult<ResourceDetail>> {
    return this.result(async () => {
      const principal = await this.principal("resource.create");
      const resourceId = newId("res");
      const revisionId = newId("rev");
      const now = this.isoNow();
      const prepared = await this.prepareRevision(principal, revisionId, input.title, input.markdown, input.links ?? []);
      const slug = safeSlug(input.slug ?? input.title);
      await this.validateCollection(principal, input.collectionId ?? null);
      await this.validateSelectedMembers(principal, input.visibility, input.selectedMemberIds ?? []);
      const statements = [
        this.db.prepare(`INSERT INTO resources
          (id, workspace_id, collection_id, slug, kind, lifecycle, current_revision_id, created_by_account_id, created_at, updated_at, archived_at)
          VALUES (?1, ?2, ?3, ?4, ?5, 'draft', NULL, ?6, ?7, ?7, NULL)`)
          .bind(resourceId, principal.workspaceId, input.collectionId ?? null, slug, input.kind, principal.context.accountId, now),
        this.revisionInsert({ principal, resourceId, revisionId, revisionNumber: 1, baseRevisionId: null,
          title: input.title, markdown: prepared.markdown, excerpt: input.excerpt ?? null,
          visibility: input.visibility, evidenceState: input.evidenceState, sha256: prepared.sha256, now }),
        ...this.selectedMemberInserts(revisionId, input.selectedMemberIds ?? []),
        ...this.blockInserts(revisionId, prepared.blocks),
        ...this.linkInserts(principal.workspaceId, resourceId, revisionId, prepared.links, now),
        this.db.prepare(`INSERT INTO resource_fts(revision_id, workspace_id, resource_id, title, body)
          VALUES (?1, ?2, ?3, ?4, ?5)`).bind(revisionId, principal.workspaceId, resourceId, input.title, prepared.plainText),
        this.db.prepare(`UPDATE resources SET current_revision_id = ?2 WHERE id = ?1 AND current_revision_id IS NULL`)
          .bind(resourceId, revisionId),
        this.audit(principal, "resource.create", "resource", resourceId, "success", now),
      ];
      await batch(this.db, statements);
      return this.unwrap(await this.getResource(resourceId));
    });
  }

  async saveRevision(input: SaveRevisionInput): Promise<DataResult<ResourceDetail>> {
    return this.result(async () => {
      const principal = await this.principal("resource.edit");
      const current = await readableRevision(this.db, principal, input.resourceId);
      if (!current) throw hiddenNotFound();
      if (current.revision_id !== input.baseRevisionId) throw conflict();
      const revisionId = newId("rev");
      const now = this.isoNow();
      const prepared = await this.prepareRevision(principal, revisionId, input.title, input.markdown, input.links ?? []);
      await this.validateSelectedMembers(principal, input.visibility, input.selectedMemberIds ?? []);
      const statements = [
        this.revisionInsert({ principal, resourceId: input.resourceId, revisionId,
          revisionNumber: current.revision_number + 1, baseRevisionId: input.baseRevisionId,
          title: input.title, markdown: prepared.markdown, excerpt: input.excerpt ?? null,
          visibility: input.visibility, evidenceState: input.evidenceState, sha256: prepared.sha256, now }),
        ...this.selectedMemberInserts(revisionId, input.selectedMemberIds ?? []),
        ...this.blockInserts(revisionId, prepared.blocks),
        ...this.linkInserts(principal.workspaceId, input.resourceId, revisionId, prepared.links, now),
        this.db.prepare(`INSERT INTO resource_fts(revision_id, workspace_id, resource_id, title, body)
          VALUES (?1, ?2, ?3, ?4, ?5)`).bind(revisionId, principal.workspaceId, input.resourceId, input.title, prepared.plainText),
        this.db.prepare(`UPDATE resources SET current_revision_id = ?3, updated_at = ?4
          WHERE id = ?1 AND workspace_id = ?2 AND current_revision_id = ?5`)
          .bind(input.resourceId, principal.workspaceId, revisionId, now, input.baseRevisionId),
        this.audit(principal, "revision.save", "revision", revisionId, "success", now),
      ];
      await batch(this.db, statements);
      return this.unwrap(await this.getResource(input.resourceId, revisionId));
    });
  }

  async share(input: CreateShareInput): Promise<DataResult<ShareReleaseRecord>> {
    return this.result(async () => {
      const principal = await this.principal("resource.share");
      const revision = await readableRevision(this.db, principal, input.resourceId, input.revisionId);
      if (!revision) throw hiddenNotFound();
      if (revision.lifecycle === "archived") throw new PortalDataError("CONFLICT", "Archived resources must be restored before sharing");
      await this.validateAudience(principal, input.audienceType, input.audienceId);
      const assets = input.assetIds ?? [];
      if (assets.length) {
        const placeholders = assets.map(() => "?").join(",");
        const rows = await all<{ id: string }>(this.db, `SELECT id FROM assets
          WHERE workspace_id = ?1 AND resource_id = ?2 AND revision_id = ?3 AND state = 'ready'
            AND consent_state IN ('verified', 'not_required')
            AND id IN (${placeholders})`, principal.workspaceId, input.resourceId, input.revisionId, ...assets);
        if (rows.length !== new Set(assets).size) throw new PortalDataError("INVALID", "Invalid release asset selection");
      }
      const grantId = newId("grant");
      const releaseId = newId("share");
      const now = this.isoNow();
      const statements = [
        this.db.prepare(`INSERT INTO resource_grants
          (id, workspace_id, resource_id, revision_id, subject_type, subject_id, permission, effect, created_by_account_id, created_at, revoked_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'read', 'allow', ?7, ?8, NULL)`)
          .bind(grantId, principal.workspaceId, input.resourceId, input.revisionId, input.audienceType, input.audienceId, principal.context.accountId, now),
        this.db.prepare(`INSERT INTO share_releases
          (id, workspace_id, resource_id, revision_id, grant_id, audience_type, audience_id, status, released_by_account_id, released_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'active', ?8, ?9)`)
          .bind(releaseId, principal.workspaceId, input.resourceId, input.revisionId, grantId, input.audienceType, input.audienceId, principal.context.accountId, now),
        ...assets.map((assetId) => this.db.prepare(`INSERT INTO share_release_assets
          (share_release_id, asset_id, asset_version_id)
          SELECT ?1, a.id, a.current_version_id FROM assets a WHERE a.id = ?2`).bind(releaseId, assetId)),
        this.db.prepare(`UPDATE resources SET lifecycle = 'shared', updated_at = ?3
          WHERE id = ?1 AND workspace_id = ?2 AND lifecycle <> 'archived'`).bind(input.resourceId, principal.workspaceId, now),
        this.audit(principal, "share.create", "share_release", releaseId, "success", now),
      ];
      await batch(this.db, statements);
      return { id: releaseId, resourceId: input.resourceId, revisionId: input.revisionId,
        audienceType: input.audienceType, audienceId: input.audienceId, assetIds: assets, releasedAt: now };
    });
  }

  async revokeShare(releaseId: string): Promise<DataResult<void>> {
    return this.result(async () => {
      const principal = await this.principal("resource.share");
      const release = await first<{ grant_id: string }>(this.db, `SELECT grant_id FROM share_releases
        WHERE id = ?1 AND workspace_id = ?2 AND status = 'active'`, releaseId, principal.workspaceId);
      if (!release) throw hiddenNotFound();
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`UPDATE share_releases SET status = 'revoked', revoked_by_account_id = ?3, revoked_at = ?4
          WHERE id = ?1 AND workspace_id = ?2 AND status = 'active'`)
          .bind(releaseId, principal.workspaceId, principal.context.accountId, now),
        this.db.prepare(`UPDATE resource_grants SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL`)
          .bind(release.grant_id, now),
        this.audit(principal, "share.revoke", "share_release", releaseId, "success", now),
      ]);
    });
  }

  async setArchived(resourceId: ResourceId, archived: boolean): Promise<DataResult<void>> {
    return this.result(async () => {
      const principal = await this.principal("resource.archive");
      const resource = await readableRevision(this.db, principal, resourceId);
      if (!resource) throw hiddenNotFound();
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`UPDATE resources SET lifecycle = ?3, archived_at = ?4, updated_at = ?5
          WHERE id = ?1 AND workspace_id = ?2`).bind(resourceId, principal.workspaceId,
            archived ? "archived" : "draft", archived ? now : null, now),
        this.audit(principal, archived ? "resource.archive" : "resource.restore", "resource", resourceId, "success", now),
      ]);
    });
  }

  async listComments(resourceId: ResourceId, revisionId?: RevisionId): Promise<DataResult<CommentRecord[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const revision = await readableRevision(this.db, principal, resourceId, revisionId);
      if (!revision) throw hiddenNotFound();
      const rows = await all<CommentRow>(this.db, `SELECT c.id, c.thread_id, t.resource_id,
        t.revision_id, c.parent_comment_id, c.author_account_id, cv.body_markdown,
        c.status, c.current_version, c.created_at, c.updated_at
        FROM threads t JOIN comments c ON c.thread_id = t.id
        JOIN comment_versions cv ON cv.comment_id = c.id AND cv.version = c.current_version
        WHERE t.workspace_id = ?1 AND t.resource_id = ?2 AND t.revision_id = ?3
        ORDER BY c.created_at LIMIT ?4`, principal.workspaceId, resourceId, revision.revision_id, MAX_LIST);
      return rows.map(mapComment);
    });
  }

  async createComment(input: CreateCommentInput): Promise<DataResult<{ id: string; threadId: string }>> {
    return this.result(async () => {
      const principal = await this.principal("comment.create");
      if (!await readableRevision(this.db, principal, input.resourceId, input.revisionId)) throw hiddenNotFound();
      requireMarkdownBytes(input.bodyMarkdown, 16_384);
      const now = this.isoNow();
      let threadId = input.threadId ?? null;
      if (input.parentCommentId) {
        const parent = await first<{ thread_id: string }>(this.db, `SELECT c.thread_id FROM comments c
          JOIN threads t ON t.id = c.thread_id WHERE c.id = ?1 AND t.workspace_id = ?2
            AND t.resource_id = ?3 AND t.revision_id = ?4`, input.parentCommentId,
        principal.workspaceId, input.resourceId, input.revisionId);
        if (!parent || (threadId && parent.thread_id !== threadId)) throw hiddenNotFound();
        threadId = parent.thread_id;
      }
      if (threadId) {
        const thread = await first(this.db, `SELECT id FROM threads WHERE id = ?1 AND workspace_id = ?2
          AND resource_id = ?3 AND revision_id = ?4`, threadId, principal.workspaceId, input.resourceId, input.revisionId);
        if (!thread) throw hiddenNotFound();
      } else threadId = newId("thread");
      const commentId = newId("comment");
      const statements = [];
      if (!input.threadId && !input.parentCommentId) statements.push(this.db.prepare(`INSERT INTO threads
        (id, workspace_id, resource_id, revision_id, block_id, created_by_account_id, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
        .bind(threadId, principal.workspaceId, input.resourceId, input.revisionId,
          input.blockId ?? null, principal.context.accountId, now));
      statements.push(
        this.db.prepare(`INSERT INTO comments
          (id, thread_id, parent_comment_id, author_account_id, current_version, status, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, 1, 'active', ?5, ?5)`)
          .bind(commentId, threadId, input.parentCommentId ?? null, principal.context.accountId, now),
        this.db.prepare(`INSERT INTO comment_versions(comment_id, version, body_markdown, editor_account_id, created_at)
          VALUES (?1, 1, ?2, ?3, ?4)`).bind(commentId, normalizeMarkdown(input.bodyMarkdown), principal.context.accountId, now),
        this.audit(principal, "comment.create", "comment", commentId, "success", now),
      );
      await batch(this.db, statements);
      return { id: commentId, threadId };
    });
  }

  async deleteComment(commentId: string): Promise<DataResult<void>> {
    return this.result(async () => {
      const principal = await this.principal();
      const row = await first<{ author_account_id: string; resource_id: string; revision_id: string }>(this.db,
        `SELECT c.author_account_id, t.resource_id, t.revision_id FROM comments c JOIN threads t ON t.id = c.thread_id
         WHERE c.id = ?1 AND t.workspace_id = ?2 AND c.status <> 'deleted'`, commentId, principal.workspaceId);
      if (!row || !await readableRevision(this.db, principal, row.resource_id, row.revision_id)) throw hiddenNotFound();
      if (row.author_account_id === principal.context.accountId) requireCapability(principal, "comment.edit-own");
      else requireCapability(principal, "comment.moderate");
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`UPDATE comments SET status = 'deleted', updated_at = ?2
          WHERE id = ?1 AND status <> 'deleted'`).bind(commentId, now),
        this.audit(principal, "comment.tombstone", "comment", commentId, "success", now),
      ]);
    });
  }

  async replyToComment(commentId: string, bodyMarkdown: string): Promise<DataResult<{ id: string; threadId: string }>> {
    return this.result(async () => {
      const principal = await this.principal("comment.create");
      const parent = await first<{ thread_id: string; resource_id: string; revision_id: string }>(this.db,
        `SELECT c.thread_id, t.resource_id, t.revision_id FROM comments c JOIN threads t ON t.id = c.thread_id
         WHERE c.id = ?1 AND t.workspace_id = ?2`, commentId, principal.workspaceId);
      if (!parent || !await readableRevision(this.db, principal, parent.resource_id, parent.revision_id)) throw hiddenNotFound();
      return this.unwrap(await this.createComment({ resourceId: parent.resource_id,
        revisionId: parent.revision_id, threadId: parent.thread_id, parentCommentId: commentId, bodyMarkdown }));
    });
  }

  async editComment(commentId: string, baseVersion: number, bodyMarkdown: string): Promise<DataResult<CommentRecord>> {
    return this.result(async () => {
      const principal = await this.principal();
      requireMarkdownBytes(bodyMarkdown, 16_384);
      const row = await first<CommentRow>(this.db, `SELECT c.id, c.thread_id, t.resource_id, t.revision_id,
        c.parent_comment_id, c.author_account_id, cv.body_markdown, c.status, c.current_version,
        c.created_at, c.updated_at FROM comments c JOIN threads t ON t.id = c.thread_id
        JOIN comment_versions cv ON cv.comment_id = c.id AND cv.version = c.current_version
        WHERE c.id = ?1 AND t.workspace_id = ?2`, commentId, principal.workspaceId);
      if (!row || !await readableRevision(this.db, principal, row.resource_id, row.revision_id)) throw hiddenNotFound();
      if (row.author_account_id === principal.context.accountId) requireCapability(principal, "comment.edit-own");
      else requireCapability(principal, "comment.moderate");
      if (row.current_version !== baseVersion) throw conflict();
      const now = this.isoNow();
      const nextVersion = baseVersion + 1;
      await batch(this.db, [
        this.db.prepare(`INSERT INTO comment_versions(comment_id, version, body_markdown, editor_account_id, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5)`).bind(commentId, nextVersion, normalizeMarkdown(bodyMarkdown), principal.context.accountId, now),
        this.db.prepare(`UPDATE comments SET current_version = ?2, updated_at = ?3
          WHERE id = ?1 AND current_version = ?4`).bind(commentId, nextVersion, now, baseVersion),
        this.audit(principal, "comment.edit", "comment", commentId, "success", now),
      ]);
      return { ...mapComment(row), bodyMarkdown: normalizeMarkdown(bodyMarkdown), version: nextVersion, updatedAt: now };
    });
  }

  async submitAnswer(input: SubmitAnswerInput): Promise<DataResult<{ answerId: string; version: number; status: "draft" | "submitted" }>> {
    return this.result(async () => {
      const principal = await this.principal("question.answer");
      requireMarkdownBytes(input.bodyMarkdown, 16_384);
      const question = await first<{ resource_id: string; revision_id: string }>(this.db, `SELECT q.resource_id, q.revision_id
        FROM questions q JOIN question_assignments qa ON qa.question_id = q.id
        WHERE q.id = ?1 AND q.workspace_id = ?2 AND qa.membership_id = ?3 AND q.status IN ('open','answered')`,
      input.questionId, principal.workspaceId, principal.membershipId);
      if (!question || !await readableRevision(this.db, principal, question.resource_id, question.revision_id)) throw hiddenNotFound();
      const existing = await first<{ id: string; current_version: number }>(this.db, `SELECT id, current_version
        FROM question_answers WHERE question_id = ?1 AND author_account_id = ?2`, input.questionId, principal.context.accountId);
      const now = this.isoNow();
      const status = input.submit ? "submitted" : "draft";
      const answerId = existing?.id ?? newId("answer");
      const version = (existing?.current_version ?? 0) + 1;
      if (existing && input.baseVersion !== existing.current_version) throw conflict();
      if (!existing && input.baseVersion !== undefined && input.baseVersion !== 0) throw conflict();
      const statements = existing ? [
        this.db.prepare(`INSERT INTO question_answer_versions(answer_id, version, body_markdown, editor_account_id, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5)`).bind(answerId, version, normalizeMarkdown(input.bodyMarkdown), principal.context.accountId, now),
        this.db.prepare(`UPDATE question_answers SET current_version = ?2, status = ?3, updated_at = ?4
          WHERE id = ?1 AND current_version = ?5`).bind(answerId, version, status, now, existing.current_version),
      ] : [
        this.db.prepare(`INSERT INTO question_answers
          (id, question_id, author_account_id, current_version, status, created_at, updated_at)
          VALUES (?1, ?2, ?3, 1, ?4, ?5, ?5)`).bind(answerId, input.questionId, principal.context.accountId, status, now),
        this.db.prepare(`INSERT INTO question_answer_versions(answer_id, version, body_markdown, editor_account_id, created_at)
          VALUES (?1, 1, ?2, ?3, ?4)`).bind(answerId, normalizeMarkdown(input.bodyMarkdown), principal.context.accountId, now),
      ];
      if (input.submit) statements.push(this.db.prepare(`UPDATE questions SET status = 'answered', updated_at = ?2
        WHERE id = ?1 AND status = 'open'`).bind(input.questionId, now));
      statements.push(this.audit(principal, "question.answer", "question", input.questionId, "success", now));
      await batch(this.db, statements);
      return { answerId, version, status };
    });
  }

  async createQuestion(input: CreateQuestionInput): Promise<DataResult<{ questionId: string }>> {
    return this.result(async () => {
      const principal = await this.principal("question.assign");
      if (!await readableRevision(this.db, principal, input.resourceId, input.revisionId)) throw hiddenNotFound();
      requireMarkdownBytes(input.promptMarkdown, 16_384);
      const assignees = [...new Set(input.assignedMembershipIds)];
      if (!assignees.length) throw new PortalDataError("INVALID", "Question requires an assignee");
      await this.validateSelectedMembers(principal, "selected_members", assignees);
      if (input.dueAt && !Number.isFinite(Date.parse(input.dueAt))) throw new PortalDataError("INVALID", "Question due date is invalid");
      const questionId = newId("question");
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`INSERT INTO questions
          (id, workspace_id, resource_id, revision_id, prompt_markdown, status,
           created_by_account_id, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, 'open', ?6, ?7, ?7)`)
          .bind(questionId, principal.workspaceId, input.resourceId, input.revisionId,
            normalizeMarkdown(input.promptMarkdown), principal.context.accountId, now),
        ...assignees.map((membershipId) => this.db.prepare(`INSERT INTO question_assignments
          (question_id, membership_id, assigned_by_account_id, assigned_at, due_at)
          VALUES (?1, ?2, ?3, ?4, ?5)`).bind(questionId, membershipId,
            principal.context.accountId, now, input.dueAt ?? null)),
        this.audit(principal, "question.create", "question", questionId, "success", now),
      ]);
      return { questionId };
    });
  }

  async promoteDecision(input: PromoteDecisionInput): Promise<DataResult<{ decisionId: string }>> {
    return this.result(async () => {
      const principal = await this.principal("resource.edit");
      if (!await readableRevision(this.db, principal, input.resourceId, input.revisionId)) throw hiddenNotFound();
      if (!input.title.trim() || input.title.length > 300) throw new PortalDataError("INVALID", "Decision title is invalid");
      requireMarkdownBytes(input.outcomeMarkdown, 16_384);
      const sources = [input.sourceThreadId, input.sourceCommentId, input.sourceAnswerId].filter(Boolean);
      if (sources.length !== 1) throw new PortalDataError("INVALID", "Decision requires exactly one evidence source");
      const sourceValid = input.sourceThreadId
        ? await first(this.db, `SELECT id FROM threads WHERE id = ?1 AND workspace_id = ?2
            AND resource_id = ?3 AND revision_id = ?4`, input.sourceThreadId, principal.workspaceId, input.resourceId, input.revisionId)
        : input.sourceCommentId
          ? await first(this.db, `SELECT c.id FROM comments c JOIN threads t ON t.id = c.thread_id
              WHERE c.id = ?1 AND t.workspace_id = ?2 AND t.resource_id = ?3 AND t.revision_id = ?4`,
            input.sourceCommentId, principal.workspaceId, input.resourceId, input.revisionId)
          : await first(this.db, `SELECT a.id FROM question_answers a JOIN questions q ON q.id = a.question_id
              WHERE a.id = ?1 AND q.workspace_id = ?2 AND q.resource_id = ?3 AND q.revision_id = ?4`,
            input.sourceAnswerId, principal.workspaceId, input.resourceId, input.revisionId);
      if (!sourceValid) throw hiddenNotFound();
      const decisionId = newId("decision");
      const now = this.isoNow();
      await batch(this.db, [
        this.db.prepare(`INSERT INTO decision_records
          (id, workspace_id, resource_id, revision_id, source_thread_id, source_comment_id,
           source_answer_id, title, outcome_markdown, status, promoted_by_account_id, created_at, decided_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'accepted', ?10, ?11, ?11)`)
          .bind(decisionId, principal.workspaceId, input.resourceId, input.revisionId,
            input.sourceThreadId ?? null, input.sourceCommentId ?? null, input.sourceAnswerId ?? null,
            input.title.trim(), normalizeMarkdown(input.outcomeMarkdown), principal.context.accountId, now),
        this.audit(principal, "decision.promote", "decision", decisionId, "success", now),
      ]);
      return { decisionId };
    });
  }

  async listDecisions(resourceId: ResourceId, revisionId?: RevisionId): Promise<DataResult<DecisionRecord[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const revision = await readableRevision(this.db, principal, resourceId, revisionId);
      if (!revision) throw hiddenNotFound();
      const rows = await all<{ id: string; resource_id: string; revision_id: string; title: string;
        outcome_markdown: string; status: DecisionRecord["status"]; decided_at: string | null }>(this.db,
      `SELECT id, resource_id, revision_id, title, outcome_markdown, status, decided_at
       FROM decision_records WHERE workspace_id = ?1 AND resource_id = ?2 AND revision_id = ?3
       ORDER BY created_at`, principal.workspaceId, resourceId, revision.revision_id);
      return rows.map((row) => ({ id: row.id, resourceId: row.resource_id, revisionId: row.revision_id,
        title: row.title, outcomeMarkdown: row.outcome_markdown, status: row.status, decidedAt: row.decided_at }));
    });
  }

  async questions(resourceId: ResourceId, revisionId?: RevisionId): Promise<DataResult<QuestionRecord[]>> {
    return this.result(async () => {
      const principal = await this.principal("resource.read");
      const revision = await readableRevision(this.db, principal, resourceId, revisionId);
      if (!revision) throw hiddenNotFound();
      const questions = await all<QuestionRow>(this.db, `SELECT q.id, q.resource_id, q.revision_id,
        q.prompt_markdown, q.status, qa.due_at,
        CASE WHEN qa.membership_id IS NULL THEN NULL ELSE ?3 END AS assigned_account_id
        FROM questions q LEFT JOIN question_assignments qa
          ON qa.question_id = q.id AND qa.membership_id = ?3
        WHERE q.workspace_id = ?1 AND q.resource_id = ?2 AND q.revision_id = ?4
        ORDER BY q.created_at`, principal.workspaceId, resourceId, principal.membershipId, revision.revision_id);
      const result: QuestionRecord[] = [];
      for (const question of questions) {
        const answers = await all<AnswerRow>(this.db, `SELECT a.id, a.question_id, a.author_account_id,
          av.body_markdown, a.status, a.current_version, a.created_at, a.updated_at
          FROM question_answers a JOIN question_answer_versions av
            ON av.answer_id = a.id AND av.version = a.current_version
          WHERE a.question_id = ?1
            AND (a.status <> 'draft' OR a.author_account_id = ?2)
          ORDER BY a.created_at`, question.id, principal.context.accountId);
        result.push({ id: question.id, resourceId: question.resource_id, revisionId: question.revision_id,
          promptMarkdown: question.prompt_markdown, status: question.status,
          assignedAccountId: question.assigned_account_id, dueAt: question.due_at,
          answers: answers.map((a) => ({ id: a.id, questionId: a.question_id,
            authorAccountId: a.author_account_id, bodyMarkdown: a.body_markdown,
            status: a.status, version: a.current_version, createdAt: a.created_at, updatedAt: a.updated_at })) });
      }
      return result;
    });
  }

  /** Metadata-only integrity audit used by media.ts after successful authorization. */
  async recordAssetIntegrityFailure(principal: AuthorizedPrincipal, assetId: string): Promise<void> {
    const now = this.isoNow();
    await run(this.db, `INSERT INTO audit_events
      (id, workspace_id, request_id, actor_account_id, action, target_type, target_id, outcome, occurred_at, metadata_json)
      VALUES (?1, ?2, ?3, ?4, 'media.integrity_failure', 'asset', ?5, 'failure', ?6, '{}')`,
    newId("audit"), principal.workspaceId, this.requestId(), principal.context.accountId, assetId, now);
  }

  /** Exact media authorization; media.ts performs protocol handling only after this succeeds. */
  async authorizeAsset(assetId: string): Promise<{ principal: AuthorizedPrincipal; row: AssetRow }> {
    const principal = await this.principal("resource.read");
    const row = await first<AssetRow>(this.db, `SELECT a.id, a.resource_id, a.revision_id, a.purpose,
      a.parent_asset_id, a.classification, a.consent_state,
      av.original_filename, av.media_type, av.byte_length, av.sha256,
      av.object_key, av.etag, av.uploaded_at, av.derivation_tool, av.derivation_version,
      av.review_status
      FROM assets a JOIN asset_versions av ON av.id = a.current_version_id
      WHERE a.id = ?1 AND a.workspace_id = ?2 AND a.state = 'ready'`, assetId, principal.workspaceId);
    if (!row) throw hiddenNotFound();
    const revision = await readableRevision(this.db, principal, row.resource_id, row.revision_id);
    if (!revision) throw hiddenNotFound();
    if (principal.role !== "owner" && principal.role !== "editor") {
      if (row.classification !== "guest"
        || (row.consent_state !== "verified" && row.consent_state !== "not_required")) throw hiddenNotFound();
      const released = await first<{ ok: number }>(this.db, `SELECT 1 AS ok
        FROM share_release_assets sra JOIN share_releases sr ON sr.id = sra.share_release_id
        WHERE sra.asset_id = ?1 AND sr.workspace_id = ?2 AND sr.revision_id = ?3
          AND sr.status = 'active'
          AND ((sr.audience_type = 'member' AND sr.audience_id = ?4)
            OR (sr.audience_type = 'role' AND sr.audience_id = ?5)) LIMIT 1`,
      assetId, principal.workspaceId, row.revision_id, principal.membershipId, principal.role);
      if (!released) throw hiddenNotFound();
    }
    return { principal, row };
  }

  private async prepareRevision(
    principal: AuthorizedPrincipal,
    revisionId: string,
    title: string,
    markdown: string,
    suppliedLinks: readonly { targetResourceId: string; label?: string | null }[],
  ): Promise<{ markdown: string; sha256: string; plainText: string; blocks: BlockInput[]; links: LinkInput[] }> {
    if (!title.trim() || title.length > 300) throw new PortalDataError("INVALID", "Title is invalid");
    const normalized = normalizeMarkdown(markdown);
    requireMarkdownBytes(normalized, 524_288);
    const parsed = await parseMarkdown(normalized);
    const chunks = normalized.split(/\n{2,}/u).slice(0, 10_000);
    const blocks: BlockInput[] = [];
    for (let index = 0; index < chunks.length; index++) {
      blocks.push({ id: `${revisionId}:b${index}`, ordinal: index, type: blockType(chunks[index] ?? ""),
        hash: await sha256Hex(chunks[index] ?? "") });
    }
    const links: LinkInput[] = [];
    let occurrence = 0;
    for (const supplied of suppliedLinks) {
      const target = await first<{ id: string; slug: string }>(this.db, `SELECT id, slug FROM resources
        WHERE id = ?1 AND workspace_id = ?2`, supplied.targetResourceId, principal.workspaceId);
      if (!target) throw new PortalDataError("INVALID", "Link target is invalid");
      links.push({ id: newId("link"), targetKey: target.slug, targetResourceId: target.id,
        status: "resolved", label: supplied.label ?? null, occurrence: ++occurrence });
    }
    if (suppliedLinks.length === 0) {
      for (const extracted of parsed.links.filter((link) => link.type === "wikilink")) {
        const targetSlug = extracted.target.normalize("NFKD").toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 120);
        const matches = await all<{ id: string }>(this.db, `SELECT id FROM resources r
          JOIN resource_revisions rr ON rr.id = r.current_revision_id
          WHERE r.workspace_id = ?1 AND (r.slug = ?2 OR lower(rr.title) = lower(?3)) LIMIT 2`,
        principal.workspaceId, targetSlug, extracted.target);
        const status = matches.length === 1 ? "resolved" : matches.length === 0 ? "broken" : "ambiguous";
        links.push({ id: newId("link"), targetKey: extracted.target,
          targetResourceId: matches.length === 1 ? matches[0]!.id : null, status,
          label: extracted.alias ?? null, occurrence: ++occurrence });
      }
    }
    return { markdown: normalized, sha256: await sha256Hex(normalized), plainText: parsed.plainText, blocks, links };
  }

  private revisionInsert(input: {
    principal: AuthorizedPrincipal; resourceId: string; revisionId: string; revisionNumber: number;
    baseRevisionId: string | null; title: string; markdown: string; excerpt: string | null;
    visibility: string; evidenceState: string; sha256: string; now: string;
  }) {
    return this.db.prepare(`INSERT INTO resource_revisions
      (id, resource_id, workspace_id, revision_number, base_revision_id, restored_from_revision_id,
       title, markdown, excerpt, content_sha256, visibility, evidence_state, parser_contract_version,
       author_account_id, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, ?9, ?10, ?11, 1, ?12, ?13)`)
      .bind(input.revisionId, input.resourceId, input.principal.workspaceId, input.revisionNumber,
        input.baseRevisionId, input.title.trim(), input.markdown, input.excerpt, input.sha256,
        input.visibility, input.evidenceState, input.principal.context.accountId, input.now);
  }

  private selectedMemberInserts(revisionId: string, memberships: readonly string[]) {
    return [...new Set(memberships)].map((membershipId) => this.db.prepare(
      `INSERT INTO revision_selected_members(revision_id, membership_id) VALUES (?1, ?2)`,
    ).bind(revisionId, membershipId));
  }

  private blockInserts(revisionId: string, blocks: BlockInput[]) {
    return blocks.map((block) => this.db.prepare(`INSERT INTO revision_blocks
      (id, revision_id, ordinal, block_type, body_sha256) VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(block.id, revisionId, block.ordinal, block.type, block.hash));
  }

  private linkInserts(workspaceId: string, resourceId: string, revisionId: string, links: LinkInput[], now: string) {
    return links.map((link) => this.db.prepare(`INSERT INTO revision_links
      (id, workspace_id, source_resource_id, source_revision_id, target_key, target_resource_id,
       status, label, occurrence, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
      .bind(link.id, workspaceId, resourceId, revisionId, link.targetKey, link.targetResourceId,
        link.status, link.label, link.occurrence, now));
  }

  private audit(principal: AuthorizedPrincipal, action: string, targetType: string, targetId: string,
    outcome: "success" | "denied" | "conflict" | "failure", now: string) {
    return this.db.prepare(`INSERT INTO audit_events
      (id, workspace_id, request_id, actor_account_id, action, target_type, target_id, outcome, occurred_at, metadata_json)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, '{}')`)
      .bind(newId("audit"), principal.workspaceId, this.requestId(), principal.context.accountId,
        action, targetType, targetId, outcome, now);
  }

  private async summary(principal: AuthorizedPrincipal, row: ReadableRevisionRow): Promise<ResourceSummary> {
    const awareness = await first<{ last_read_revision_id: string | null; pending_count: number }>(this.db, `SELECT
      (SELECT last_read_revision_id FROM member_resource_state
        WHERE membership_id = ?3 AND resource_id = ?2) AS last_read_revision_id,
      (SELECT COUNT(*) FROM questions q JOIN question_assignments qa ON qa.question_id = q.id
        WHERE q.workspace_id = ?1 AND q.resource_id = ?2 AND qa.membership_id = ?3 AND q.status = 'open'
          AND NOT EXISTS (SELECT 1 FROM question_answers a
            WHERE a.question_id = q.id AND a.author_account_id = ?4
              AND a.status IN ('submitted','accepted'))) AS pending_count`,
    principal.workspaceId, row.resource_id, principal.membershipId, principal.context.accountId);
    return { id: row.resource_id, workspaceId: row.workspace_id, collectionId: row.collection_id,
      slug: row.slug, kind: row.kind as ResourceKind, lifecycle: row.lifecycle as ResourceSummary["lifecycle"],
      title: row.title, excerpt: row.excerpt, headRevisionId: row.revision_id,
      headRevisionNumber: row.revision_number, visibility: row.visibility as ResourceSummary["visibility"],
      updatedAt: row.updated_at, unread: awareness?.last_read_revision_id !== row.revision_id,
      pendingQuestionCount: awareness?.pending_count ?? 0 };
  }

  private async assetsFor(principal: AuthorizedPrincipal, row: ReadableRevisionRow): Promise<AssetSummary[]> {
    const author = principal.role === "owner" || principal.role === "editor";
    const assets = await all<AssetRow>(this.db, `SELECT a.id, a.resource_id, a.revision_id, a.purpose,
      a.parent_asset_id, a.classification, a.consent_state,
      av.original_filename, av.media_type, av.byte_length, av.sha256,
      av.object_key, av.etag, av.uploaded_at, av.derivation_tool, av.derivation_version, av.review_status
      FROM assets a JOIN asset_versions av ON av.id = a.current_version_id
      WHERE a.workspace_id = ?1 AND a.resource_id = ?2 AND a.revision_id = ?3 AND a.state = 'ready'
        AND (?4 = 1 OR (a.classification = 'guest'
          AND a.consent_state IN ('verified', 'not_required') AND EXISTS (
            SELECT 1 FROM share_release_assets sra JOIN share_releases sr ON sr.id = sra.share_release_id
            WHERE sra.asset_id = a.id AND sra.asset_version_id = av.id
              AND sr.workspace_id = a.workspace_id AND sr.resource_id = a.resource_id
              AND sr.revision_id = ?3 AND sr.status = 'active'
              AND ((sr.audience_type = 'member' AND sr.audience_id = ?5)
                OR (sr.audience_type = 'role' AND sr.audience_id = ?6)))))
      ORDER BY a.created_at`, principal.workspaceId, row.resource_id, row.revision_id,
    author ? 1 : 0, principal.membershipId, principal.role);
    return assets.map(mapAsset);
  }

  private async validateCollection(principal: AuthorizedPrincipal, collectionId: string | null): Promise<void> {
    if (!collectionId) return;
    if (!await first(this.db, `SELECT id FROM collections WHERE id = ?1 AND workspace_id = ?2`, collectionId, principal.workspaceId)) {
      throw new PortalDataError("INVALID", "Collection is invalid");
    }
  }

  private async validateSelectedMembers(principal: AuthorizedPrincipal, visibility: string, ids: readonly string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (visibility === "selected_members" && unique.length === 0) {
      throw new PortalDataError("INVALID", "Selected-member visibility requires an audience");
    }
    for (const id of unique) {
      if (!await first(this.db, `SELECT id FROM memberships
        WHERE id = ?1 AND workspace_id = ?2 AND status = 'active'`, id, principal.workspaceId)) {
        throw new PortalDataError("INVALID", "Selected member is invalid");
      }
    }
  }

  private async validateAudience(principal: AuthorizedPrincipal, type: string, id: string): Promise<void> {
    if (type === "role") {
      if (!(["owner", "editor", "commenter", "viewer"] as const).includes(id as never)) {
        throw new PortalDataError("INVALID", "Audience is invalid");
      }
      return;
    }
    if (!await first(this.db, `SELECT id FROM memberships
      WHERE id = ?1 AND workspace_id = ?2 AND status = 'active'`, id, principal.workspaceId)) {
      throw new PortalDataError("INVALID", "Audience is invalid");
    }
  }

  private requireRecent(principal: AuthorizedPrincipal): void {
    const age = this.now().getTime() - Date.parse(principal.context.authenticatedAt);
    if (!Number.isFinite(age) || age < 0 || age > 15 * 60_000) {
      throw new PortalDataError("UNAUTHENTICATED", "Recent authentication required");
    }
  }

  private isoNow(): string { return this.now().toISOString(); }

  private unwrap<T>(value: DataResult<T>): T {
    if (value.ok) return value.value;
    throw new PortalDataError(value.code, value.message, value.retryable);
  }
}

export function createPortalDal(options: PortalDalOptions): PortalDal {
  return new PortalDal(options);
}

/** Stable server-side surface consumed by route handlers, Server Components, and Actions. */
export type PortalDataApi = Pick<PortalDal,
  | "session" | "listResources" | "getResource" | "getResourceBySlug"
  | "search" | "backlinks" | "unread" | "markRead"
  | "createResource" | "saveRevision" | "share" | "revokeShare" | "setArchived"
  | "listComments" | "createComment" | "deleteComment" | "replyToComment" | "editComment"
  | "createQuestion" | "questions" | "submitAnswer" | "promoteDecision" | "listDecisions"
  | "listMemberships" | "addMembership" | "setMembershipStatus"
  | "createCollection" | "createGrant" | "revokeGrant" | "listAuditEvents"
>;

interface SummaryRow extends ReadableRevisionRow {
  last_read_revision_id: string | null;
  pending_count: number;
}
interface SearchSummaryRow {
  resource_id: string; workspace_id: string; collection_id: string | null; slug: string;
  kind: string; lifecycle: string; revision_id: string; revision_number: number;
  title: string; excerpt: string | null; visibility: string; updated_at: string;
  last_read_revision_id: string | null; pending_count: number; snippet: string; rank: number;
}

const SEARCH_SELECT = `SELECT r.id AS resource_id, r.workspace_id, r.collection_id, r.slug,
  r.kind, r.lifecycle, rr.id AS revision_id, rr.revision_number, rr.title, rr.excerpt,
  rr.visibility, r.updated_at,
  (SELECT state.last_read_revision_id FROM member_resource_state state
    WHERE state.membership_id = ?3 AND state.resource_id = r.id) AS last_read_revision_id,
  (SELECT COUNT(*) FROM questions q JOIN question_assignments qa ON qa.question_id = q.id
    WHERE q.workspace_id = r.workspace_id AND q.resource_id = r.id AND qa.membership_id = ?3
      AND q.status = 'open' AND NOT EXISTS (SELECT 1 FROM question_answers a
        WHERE a.question_id = q.id AND a.author_account_id = ?4
          AND a.status IN ('submitted','accepted'))) AS pending_count,
  snippet(resource_fts, 4, '<mark>', '</mark>', ' … ', 24) AS snippet,
  bm25(resource_fts) AS rank
  FROM resource_fts JOIN resources r ON r.id = resource_fts.resource_id
    AND r.workspace_id = resource_fts.workspace_id`;

const SUMMARY_SELECT = `SELECT r.id AS resource_id, r.workspace_id, r.collection_id, r.slug,
  r.kind, r.lifecycle, rr.id AS revision_id, rr.revision_number, rr.base_revision_id,
  rr.title, rr.markdown, rr.excerpt, rr.visibility, rr.evidence_state,
  rr.author_account_id, rr.import_id, rr.source_ref, rr.source_sha256,
  rr.source_captured_at, rr.provenance_notes, rr.created_at, r.updated_at,
  (SELECT state.last_read_revision_id FROM member_resource_state state
    WHERE state.membership_id = ?3 AND state.resource_id = r.id) AS last_read_revision_id,
  (SELECT COUNT(*) FROM questions q JOIN question_assignments qa ON qa.question_id = q.id
    WHERE q.workspace_id = r.workspace_id AND q.resource_id = r.id AND qa.membership_id = ?3
      AND q.status = 'open' AND NOT EXISTS (SELECT 1 FROM question_answers a
        WHERE a.question_id = q.id AND a.author_account_id = ?4
          AND a.status IN ('submitted','accepted'))) AS pending_count
  FROM resources r`;

function mapSearchSummaryRow(row: SearchSummaryRow): ResourceSummary {
  return { id: row.resource_id, workspaceId: row.workspace_id, collectionId: row.collection_id,
    slug: row.slug, kind: row.kind as ResourceKind,
    lifecycle: row.lifecycle as ResourceSummary["lifecycle"], title: row.title,
    excerpt: row.excerpt, headRevisionId: row.revision_id,
    headRevisionNumber: row.revision_number,
    visibility: row.visibility as ResourceSummary["visibility"], updatedAt: row.updated_at,
    unread: row.last_read_revision_id !== row.revision_id, pendingQuestionCount: row.pending_count };
}

function mapSummaryRow(row: SummaryRow): ResourceSummary {
  return { id: row.resource_id, workspaceId: row.workspace_id, collectionId: row.collection_id,
    slug: row.slug, kind: row.kind as ResourceKind,
    lifecycle: row.lifecycle as ResourceSummary["lifecycle"], title: row.title,
    excerpt: row.excerpt, headRevisionId: row.revision_id,
    headRevisionNumber: row.revision_number,
    visibility: row.visibility as ResourceSummary["visibility"], updatedAt: row.updated_at,
    unread: row.last_read_revision_id !== row.revision_id, pendingQuestionCount: row.pending_count };
}

export interface AssetRow {
  id: string; resource_id: string; revision_id: string; purpose: AssetSummary["purpose"];
  parent_asset_id: string | null; classification: AssetSummary["classification"];
  consent_state: AssetSummary["consentState"]; original_filename: string; media_type: string;
  byte_length: number; sha256: string; object_key: string; etag: string; uploaded_at: string;
  derivation_tool: string | null; derivation_version: string | null;
  review_status: "source" | "pending" | "approved" | "rejected";
}
interface MeetingRow {
  resource_id: string; starts_at: string | null; ends_at: string | null;
  occurrence_status: MeetingRecord["occurrenceStatus"]; occurred_at: string | null;
  original_audio_asset_id: string | null; playback_audio_asset_id: string | null;
  transcript_resource_id: string | null; summary_resource_id: string | null;
  presentation_resource_id: string | null;
}
interface AuditRow {
  id: string; request_id: string; actor_account_id: string; action: string;
  target_type: string; target_id: string; outcome: AuditEvent["outcome"]; occurred_at: string;
}
interface CommentRow {
  id: string; thread_id: string; resource_id: string; revision_id: string;
  parent_comment_id: string | null; author_account_id: string; body_markdown: string;
  status: CommentRecord["status"]; current_version: number; created_at: string; updated_at: string;
}
interface QuestionRow {
  id: string; resource_id: string; revision_id: string; prompt_markdown: string;
  status: QuestionRecord["status"]; assigned_account_id: string | null; due_at: string | null;
}
interface AnswerRow {
  id: string; question_id: string; author_account_id: string; body_markdown: string;
  status: "draft" | "submitted" | "accepted" | "superseded"; current_version: number;
  created_at: string; updated_at: string;
}

function mapRevision(row: ReadableRevisionRow): ResourceRevision {
  return { id: row.revision_id, resourceId: row.resource_id, revisionNumber: row.revision_number,
    baseRevisionId: row.base_revision_id, title: row.title, markdown: row.markdown, excerpt: row.excerpt,
    visibility: row.visibility as ResourceRevision["visibility"],
    evidenceState: row.evidence_state as ResourceRevision["evidenceState"],
    provenance: row.source_ref && row.source_sha256 ? { importId: row.import_id,
      sourceRef: row.source_ref, sourceSha256: row.source_sha256,
      capturedAt: row.source_captured_at, notes: row.provenance_notes } : null,
    authorAccountId: row.author_account_id, createdAt: row.created_at };
}

function mapAsset(row: AssetRow): AssetSummary {
  return { id: row.id, resourceId: row.resource_id, revisionId: row.revision_id,
    filename: row.original_filename, purpose: row.purpose, mediaType: row.media_type,
    byteLength: row.byte_length, sha256: row.sha256, parentAssetId: row.parent_asset_id,
    classification: row.classification, consentState: row.consent_state,
    derivation: row.derivation_tool && row.derivation_version ? { tool: row.derivation_tool,
      version: row.derivation_version, reviewStatus: row.review_status } : null,
    createdAt: row.uploaded_at };
}

function mapComment(row: CommentRow): CommentRecord {
  return { id: row.id, threadId: row.thread_id, resourceId: row.resource_id,
    revisionId: row.revision_id, parentCommentId: row.parent_comment_id,
    authorAccountId: row.author_account_id, bodyMarkdown: row.body_markdown,
    status: row.status, version: row.current_version, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapMeeting(row: MeetingRow): MeetingRecord {
  return { resourceId: row.resource_id, startsAt: row.starts_at, endsAt: row.ends_at,
    occurrenceStatus: row.occurrence_status, occurredAt: row.occurred_at,
    originalAudioAssetId: row.original_audio_asset_id, playbackAudioAssetId: row.playback_audio_asset_id,
    transcriptResourceId: row.transcript_resource_id, summaryResourceId: row.summary_resource_id,
    presentationResourceId: row.presentation_resource_id };
}

function normalizeMarkdown(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/gu, "\n");
}
function requireMarkdownBytes(value: string, max: number): void {
  if (!value.trim() || new TextEncoder().encode(value).byteLength > max) {
    throw new PortalDataError("INVALID", "Markdown is empty or too large");
  }
}
function safeSlug(value: string): string {
  const slug = value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 120);
  if (!slug) throw new PortalDataError("INVALID", "Slug is invalid");
  return slug;
}
function safeFtsQuery(value: string): string {
  const trimmed = value.trim().slice(0, MAX_SEARCH_QUERY);
  if (!trimmed) return "";
  const terms = trimmed.split(/\s+/u).slice(0, 12).map((term) => `"${term.replace(/"/gu, '""')}"`);
  return terms.join(" AND ");
}
function boundedLimit(limit = 50): number {
  return Number.isFinite(limit) ? Math.max(1, Math.min(MAX_LIST, Math.trunc(limit))) : 50;
}
function blockType(value: string): string {
  if (/^#{1,6}\s/u.test(value)) return "heading";
  if (/^```/u.test(value)) return "code";
  if (/^[-*+]\s/u.test(value)) return "list";
  return "paragraph";
}
function isRole(value: string): value is MembershipSummary["role"] {
  return value === "owner" || value === "editor" || value === "commenter" || value === "viewer";
}
function hiddenNotFound(): PortalDataError { return new PortalDataError("NOT_FOUND", "Not found"); }
function conflict(): PortalDataError { return new PortalDataError("CONFLICT", "The resource changed; reload and retry"); }
