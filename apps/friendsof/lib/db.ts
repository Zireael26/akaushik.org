import type {
  AuthorizedPrincipal,
  Capability,
  DataErrorCode,
  ResourceId,
  RevisionId,
  WorkspaceRole,
} from "./contracts";

export interface D1Result<T = unknown> {
  success: boolean;
  results?: T[];
  meta?: { changes?: number; last_row_id?: number };
  error?: string;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec?(sql: string): Promise<unknown>;
}

export interface DatabaseErrorShape {
  code: DataErrorCode;
  message: string;
  retryable: boolean;
}

export class PortalDataError extends Error implements DatabaseErrorShape {
  constructor(
    public readonly code: DataErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "PortalDataError";
  }
}

const ROLE_CAPABILITIES: Readonly<Record<WorkspaceRole, readonly Capability[]>> = {
  owner: [
    "workspace.manage", "membership.manage", "grant.manage", "collection.manage",
    "resource.read", "resource.create", "resource.edit", "resource.share",
    "resource.archive", "comment.create", "comment.edit-own", "comment.moderate",
    "question.assign", "question.answer", "import.run", "publication.request",
    "publication.approve", "publication.export", "audit.read", "recovery.restore",
  ],
  editor: [
    "collection.manage", "resource.read", "resource.create", "resource.edit",
    "resource.share", "resource.archive", "comment.create", "comment.edit-own",
    "comment.moderate", "question.assign", "question.answer", "import.run",
    "publication.request",
  ],
  commenter: ["resource.read", "comment.create", "comment.edit-own", "question.answer"],
  viewer: ["resource.read"],
};

export function capabilitiesForRole(role: WorkspaceRole): ReadonlySet<Capability> {
  return new Set(ROLE_CAPABILITIES[role]);
}

export function normalizedHost(host: string): string {
  const value = host.trim().toLowerCase();
  if (!value || value.length > 253 || value.includes("/") || value.includes("\\") || /\s/.test(value)) {
    throw new PortalDataError("UNAUTHENTICATED", "Authentication required");
  }
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

export async function first<T>(db: D1Database, sql: string, ...values: unknown[]): Promise<T | null> {
  return db.prepare(sql).bind(...values).first<T>();
}

export async function all<T>(db: D1Database, sql: string, ...values: unknown[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...values).all<T>();
  if (!result.success) throw new PortalDataError("UNAVAILABLE", "Data store unavailable", true);
  return result.results ?? [];
}

export async function run(db: D1Database, sql: string, ...values: unknown[]): Promise<D1Result> {
  const result = await db.prepare(sql).bind(...values).run();
  if (!result.success) throw new PortalDataError("UNAVAILABLE", "Data store unavailable", true);
  return result;
}

export async function batch(db: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  try {
    const results = await db.batch(statements);
    if (results.some((result) => !result.success)) {
      throw new PortalDataError("INTEGRITY", "Atomic write rejected");
    }
    return results;
  } catch (error) {
    if (error instanceof PortalDataError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    if (/stale-base|unique constraint/i.test(detail)) {
      throw new PortalDataError("CONFLICT", "The resource changed; reload and retry");
    }
    if (/constraint|foreign key|immutable|invalid-resource-head/i.test(detail)) {
      throw new PortalDataError("INTEGRITY", "Atomic write rejected");
    }
    throw new PortalDataError("UNAVAILABLE", "Data store unavailable", true);
  }
}

interface PrincipalRow {
  workspace_id: string;
  membership_id: string;
  role: WorkspaceRole;
}

interface OverrideRow {
  capability: Capability;
  effect: "allow" | "deny";
}

export async function resolvePrincipal(
  db: D1Database,
  context: AuthorizedPrincipal["context"],
): Promise<AuthorizedPrincipal> {
  const row = await first<PrincipalRow>(db, `
    SELECT wh.workspace_id, m.id AS membership_id, m.role
    FROM workspace_hosts wh
    JOIN workspaces w ON w.id = wh.workspace_id AND w.status = 'active'
    JOIN memberships m ON m.workspace_id = w.id
      AND m.account_id = ?2 AND m.status = 'active'
    WHERE wh.host = ?1 AND wh.active = 1
    LIMIT 1
  `, normalizedHost(context.host), context.accountId);
  if (!row) throw new PortalDataError("UNAUTHENTICATED", "Authentication required");

  const capabilities = new Set(capabilitiesForRole(row.role));
  const overrides = await all<OverrideRow>(db, `
    SELECT capability, effect FROM capability_overrides
    WHERE workspace_id = ?1 AND membership_id = ?2 AND revoked_at IS NULL
    ORDER BY CASE effect WHEN 'allow' THEN 0 ELSE 1 END
  `, row.workspace_id, row.membership_id);
  for (const override of overrides) {
    if (override.effect === "deny") capabilities.delete(override.capability);
    else capabilities.add(override.capability);
  }

  return {
    context,
    workspaceId: row.workspace_id,
    membershipId: row.membership_id,
    role: row.role,
    capabilities,
  };
}

export function requireCapability(principal: AuthorizedPrincipal, capability: Capability): void {
  if (!principal.capabilities.has(capability)) {
    throw new PortalDataError("FORBIDDEN", "Operation not permitted");
  }
}

export interface ReadableRevisionRow {
  resource_id: string;
  workspace_id: string;
  collection_id: string | null;
  slug: string;
  kind: string;
  lifecycle: string;
  revision_id: string;
  revision_number: number;
  base_revision_id: string | null;
  title: string;
  markdown: string;
  excerpt: string | null;
  visibility: string;
  evidence_state: string;
  author_account_id: string;
  import_id: string | null;
  source_ref: string | null;
  source_sha256: string | null;
  source_captured_at: string | null;
  provenance_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Resolve the exact readable revision. Owner/editor authoring access is role based.
 * Other roles require (an exact active release) AND (an explicit resource allow OR
 * allowed collection inheritance). Any matching resource deny wins. All joins are
 * constrained to the already host-mapped workspace and active membership.
 */
export async function readableRevision(
  db: D1Database,
  principal: AuthorizedPrincipal,
  resourceId: ResourceId,
  requestedRevisionId?: RevisionId,
): Promise<ReadableRevisionRow | null> {
  const canAuthor = principal.role === "owner" || principal.role === "editor";
  if (canAuthor) {
    return first<ReadableRevisionRow>(db, `
      SELECT r.id AS resource_id, r.workspace_id, r.collection_id, r.slug, r.kind, r.lifecycle,
        rr.id AS revision_id, rr.revision_number, rr.base_revision_id, rr.title,
        rr.markdown, rr.excerpt, rr.visibility, rr.evidence_state, rr.author_account_id,
        rr.import_id, rr.source_ref, rr.source_sha256, rr.source_captured_at,
        rr.provenance_notes, rr.created_at, r.updated_at
      FROM resources r
      JOIN resource_revisions rr ON rr.resource_id = r.id
        AND rr.id = COALESCE(?3, r.current_revision_id)
      WHERE r.workspace_id = ?1 AND r.id = ?2
      LIMIT 1
    `, principal.workspaceId, resourceId, requestedRevisionId ?? null);
  }

  return first<ReadableRevisionRow>(db, `
    SELECT r.id AS resource_id, r.workspace_id, r.collection_id, r.slug, r.kind, r.lifecycle,
      rr.id AS revision_id, rr.revision_number, rr.base_revision_id, rr.title,
      rr.markdown, rr.excerpt, rr.visibility, rr.evidence_state, rr.author_account_id,
      rr.import_id, rr.source_ref, rr.source_sha256, rr.source_captured_at,
      rr.provenance_notes, rr.created_at, r.updated_at
    FROM resources r
    JOIN resource_revisions rr ON rr.resource_id = r.id
    JOIN share_releases sr ON sr.workspace_id = r.workspace_id
      AND sr.resource_id = r.id AND sr.revision_id = rr.id AND sr.status = 'active'
      AND ((sr.audience_type = 'member' AND sr.audience_id = ?3)
        OR (sr.audience_type = 'role' AND sr.audience_id = ?4))
    LEFT JOIN collections c ON c.id = r.collection_id AND c.workspace_id = r.workspace_id
    WHERE r.workspace_id = ?1 AND r.id = ?2 AND r.lifecycle = 'shared'
      AND (?5 IS NULL OR rr.id = ?5)
      AND rr.visibility <> 'owner_only'
      AND (rr.visibility <> 'selected_members' OR EXISTS (
        SELECT 1 FROM revision_selected_members rsm
        WHERE rsm.revision_id = rr.id AND rsm.membership_id = ?3
      ))
      AND NOT EXISTS (
        SELECT 1 FROM resource_grants deny
        WHERE deny.workspace_id = r.workspace_id AND deny.resource_id = r.id
          AND (deny.revision_id IS NULL OR deny.revision_id = rr.id)
          AND deny.permission = 'read' AND deny.effect = 'deny' AND deny.revoked_at IS NULL
          AND ((deny.subject_type = 'member' AND deny.subject_id = ?3)
            OR (deny.subject_type = 'role' AND deny.subject_id = ?4))
      )
      AND NOT EXISTS (
        SELECT 1 FROM collection_grants deny_collection
        WHERE deny_collection.workspace_id = r.workspace_id
          AND deny_collection.collection_id = r.collection_id
          AND deny_collection.permission = 'read' AND deny_collection.effect = 'deny'
          AND deny_collection.inheritable = 1 AND deny_collection.revoked_at IS NULL
          AND ((deny_collection.subject_type = 'member' AND deny_collection.subject_id = ?3)
            OR (deny_collection.subject_type = 'role' AND deny_collection.subject_id = ?4))
      )
      AND (
        EXISTS (
          SELECT 1 FROM resource_grants allow_resource
          WHERE allow_resource.workspace_id = r.workspace_id
            AND allow_resource.resource_id = r.id
            AND (allow_resource.revision_id IS NULL OR allow_resource.revision_id = rr.id)
            AND allow_resource.permission = 'read' AND allow_resource.effect = 'allow'
            AND allow_resource.revoked_at IS NULL
            AND ((allow_resource.subject_type = 'member' AND allow_resource.subject_id = ?3)
              OR (allow_resource.subject_type = 'role' AND allow_resource.subject_id = ?4))
        )
        OR (
          c.grants_inherit = 1 AND EXISTS (
            SELECT 1 FROM collection_grants allow_collection
            WHERE allow_collection.workspace_id = r.workspace_id
              AND allow_collection.collection_id = r.collection_id
              AND allow_collection.permission = 'read' AND allow_collection.effect = 'allow'
              AND allow_collection.inheritable = 1 AND allow_collection.revoked_at IS NULL
              AND ((allow_collection.subject_type = 'member' AND allow_collection.subject_id = ?3)
                OR (allow_collection.subject_type = 'role' AND allow_collection.subject_id = ?4))
          )
        )
      )
    ORDER BY sr.released_at DESC
    LIMIT 1
  `, principal.workspaceId, resourceId, principal.membershipId, principal.role, requestedRevisionId ?? null);
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = new Uint8Array(typeof value === "string" ? new TextEncoder().encode(value) : value);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}
