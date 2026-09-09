/**
 * Stable, JSON-safe contracts shared by the FriendsOf server and UI.
 *
 * Trust boundary: request callers never provide account, workspace, grant,
 * object-key, publication-approval, or audit identity. The DAL derives those
 * values from getRequestContext() plus persisted content-DB state.
 */

export type ISODateTime = string;
export type AccountId = string;
export type WorkspaceId = string;
export type MembershipId = string;
export type CollectionId = string;
export type ResourceId = string;
export type RevisionId = string;
export type AssetId = string;
export type ThreadId = string;
export type CommentId = string;
export type QuestionId = string;
export type AnswerId = string;
export type DecisionId = string;
export type ImportId = string;
export type PublicationId = string;

export type WorkspaceRole = "owner" | "editor" | "commenter" | "viewer";
export type Capability =
  | "workspace.manage"
  | "membership.manage"
  | "grant.manage"
  | "collection.manage"
  | "resource.read"
  | "resource.create"
  | "resource.edit"
  | "resource.share"
  | "resource.archive"
  | "comment.create"
  | "comment.edit-own"
  | "comment.moderate"
  | "question.assign"
  | "question.answer"
  | "import.run"
  | "publication.request"
  | "publication.approve"
  | "publication.export"
  | "audit.read"
  | "recovery.restore";

export type ResourceKind =
  | "meeting"
  | "research"
  | "presentation"
  | "progress_update"
  | "discussion"
  | "document"
  | "question";
export type ResourceLifecycle = "draft" | "shared" | "archived";
export type RevisionVisibility = "owner_only" | "workspace" | "selected_members";
export type EvidenceState =
  | "source"
  | "derived"
  | "proposal"
  | "question"
  | "corroborated"
  | "superseded"
  | "missing";
export type MeetingOccurrenceStatus =
  | "scheduled"
  | "occurred"
  | "cancelled"
  | "unknown";
export type GrantEffect = "allow" | "deny";
export type GrantSubjectType = "member" | "role";
export type QuestionStatus = "open" | "answered" | "resolved" | "withdrawn";
export type AnswerStatus = "draft" | "submitted" | "accepted" | "superseded";
export type CommentStatus = "active" | "resolved" | "deleted";
export type PublicationStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "exported"
  | "revoked";
export type ImportStatus =
  | "staged"
  | "validated"
  | "committing"
  | "committed"
  | "failed";

/** Returned by Muse's server-only auth adapter; never accepted from a client. */
export interface RequestContext {
  accountId: AccountId;
  sessionId: string;
  host: string;
  authenticatedAt: ISODateTime;
  expiresAt: ISODateTime;
}

export type GetRequestContext = () => Promise<RequestContext | null>;

export interface WorkspaceSummary {
  id: WorkspaceId;
  slug: string;
  name: string;
  role: WorkspaceRole;
}

export interface WorkspaceSession {
  accountId: AccountId;
  membershipId: MembershipId;
  workspace: WorkspaceSummary;
  capabilities: readonly Capability[];
}

export interface MembershipSummary {
  id: MembershipId;
  accountId: AccountId;
  role: WorkspaceRole;
  status: "invited" | "active" | "disabled";
  joinedAt: ISODateTime | null;
}

export interface CollectionSummary {
  id: CollectionId;
  slug: string;
  name: string;
  grantsInherit: boolean;
}

export interface GrantInput {
  targetType: "resource" | "collection";
  targetId: ResourceId | CollectionId;
  revisionId?: RevisionId | null;
  subjectType: GrantSubjectType;
  subjectId: MembershipId | WorkspaceRole;
  permission: "read" | "comment" | "answer";
  effect: GrantEffect;
  inheritable?: boolean;
}

export interface GrantRecord extends GrantInput {
  id: string;
  createdAt: ISODateTime;
  revokedAt: ISODateTime | null;
}

export interface AuditEvent {
  id: string;
  requestId: string;
  actorAccountId: AccountId;
  action: string;
  targetType: string;
  targetId: string;
  outcome: "success" | "denied" | "conflict" | "failure";
  occurredAt: ISODateTime;
}

export interface ResourceSummary {
  id: ResourceId;
  workspaceId: WorkspaceId;
  collectionId: CollectionId | null;
  slug: string;
  kind: ResourceKind;
  lifecycle: ResourceLifecycle;
  title: string;
  excerpt: string | null;
  headRevisionId: RevisionId;
  headRevisionNumber: number;
  visibility: RevisionVisibility;
  updatedAt: ISODateTime;
  unread: boolean;
  pendingQuestionCount: number;
}

export interface ResourceRevision {
  id: RevisionId;
  resourceId: ResourceId;
  revisionNumber: number;
  baseRevisionId: RevisionId | null;
  title: string;
  markdown: string;
  excerpt: string | null;
  visibility: RevisionVisibility;
  evidenceState: EvidenceState;
  provenance: ProvenanceRecord | null;
  authorAccountId: AccountId;
  createdAt: ISODateTime;
}

export interface ResourceDetail extends ResourceSummary {
  revision: ResourceRevision;
  meeting: MeetingRecord | null;
  assets: AssetSummary[];
  links: ResourceLink[];
}

export interface MeetingRecord {
  resourceId: ResourceId;
  startsAt: ISODateTime | null;
  endsAt: ISODateTime | null;
  occurrenceStatus: MeetingOccurrenceStatus;
  occurredAt: ISODateTime | null;
  originalAudioAssetId: AssetId | null;
  playbackAudioAssetId: AssetId | null;
  transcriptResourceId: ResourceId | null;
  summaryResourceId: ResourceId | null;
  presentationResourceId: ResourceId | null;
}

export interface AssetSummary {
  id: AssetId;
  resourceId: ResourceId;
  revisionId: RevisionId;
  filename: string;
  purpose: "original" | "playback" | "presentation" | "attachment" | "waveform" | "other";
  mediaType: string;
  byteLength: number;
  sha256: string;
  parentAssetId: AssetId | null;
  classification: "private" | "guest" | "public_candidate";
  consentState: "pending" | "verified" | "not_required" | "revoked";
  derivation: {
    tool: string;
    version: string;
    reviewStatus: "source" | "pending" | "approved" | "rejected";
  } | null;
  createdAt: ISODateTime;
}

export interface ResourceLink {
  sourceResourceId: ResourceId;
  sourceRevisionId: RevisionId;
  target: string;
  targetResourceId: ResourceId | null;
  status: "resolved" | "broken" | "ambiguous" | "unavailable";
  label: string | null;
}

export interface Backlink {
  sourceResourceId: ResourceId;
  sourceTitle: string;
  sourceRevisionId: RevisionId;
  label: string | null;
}

export interface SearchHit {
  resource: ResourceSummary;
  snippet: string;
  rank: number;
}

export interface CommentRecord {
  id: CommentId;
  threadId: ThreadId;
  resourceId: ResourceId;
  revisionId: RevisionId;
  parentCommentId: CommentId | null;
  authorAccountId: AccountId;
  bodyMarkdown: string;
  status: CommentStatus;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface QuestionRecord {
  id: QuestionId;
  resourceId: ResourceId;
  revisionId: RevisionId;
  promptMarkdown: string;
  status: QuestionStatus;
  assignedAccountId: AccountId | null;
  dueAt: ISODateTime | null;
  answers: AnswerRecord[];
}

export interface AnswerRecord {
  id: AnswerId;
  questionId: QuestionId;
  authorAccountId: AccountId;
  bodyMarkdown: string;
  status: AnswerStatus;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DecisionRecord {
  id: DecisionId;
  resourceId: ResourceId;
  revisionId: RevisionId;
  title: string;
  outcomeMarkdown: string;
  status: "proposed" | "accepted" | "rejected" | "superseded";
  decidedAt: ISODateTime | null;
}

export interface ProvenanceRecord {
  importId: ImportId | null;
  sourceRef: string;
  sourceSha256: string;
  capturedAt: ISODateTime | null;
  notes: string | null;
}

export interface UnreadItem {
  resource: ResourceSummary;
  reason: "new_revision" | "new_comment" | "assigned_question" | "answered_question";
  changedAt: ISODateTime;
}

export interface SaveRevisionInput {
  resourceId: ResourceId;
  baseRevisionId: RevisionId;
  title: string;
  markdown: string;
  excerpt?: string | null;
  visibility: RevisionVisibility;
  selectedMemberIds?: readonly MembershipId[];
  evidenceState: EvidenceState;
  links?: readonly { targetResourceId: ResourceId; label?: string | null }[];
}

export interface CreateResourceInput {
  collectionId?: CollectionId | null;
  slug?: string;
  kind: ResourceKind;
  title: string;
  markdown: string;
  excerpt?: string | null;
  visibility: RevisionVisibility;
  selectedMemberIds?: readonly MembershipId[];
  evidenceState: EvidenceState;
  links?: readonly { targetResourceId: ResourceId; label?: string | null }[];
}

export interface CreateShareInput {
  resourceId: ResourceId;
  revisionId: RevisionId;
  audienceType: GrantSubjectType;
  audienceId: MembershipId | WorkspaceRole;
  assetIds?: readonly AssetId[];
}

export interface ShareReleaseRecord {
  id: string;
  resourceId: ResourceId;
  revisionId: RevisionId;
  audienceType: GrantSubjectType;
  audienceId: string;
  assetIds: readonly AssetId[];
  releasedAt: ISODateTime;
}

export interface CreateCommentInput {
  resourceId: ResourceId;
  revisionId: RevisionId;
  threadId?: ThreadId | null;
  blockId?: string | null;
  parentCommentId?: CommentId | null;
  bodyMarkdown: string;
}

export interface CreateQuestionInput {
  resourceId: ResourceId;
  revisionId: RevisionId;
  promptMarkdown: string;
  assignedMembershipIds: readonly MembershipId[];
  dueAt?: ISODateTime | null;
}

export interface PromoteDecisionInput {
  resourceId: ResourceId;
  revisionId: RevisionId;
  title: string;
  outcomeMarkdown: string;
  sourceThreadId?: ThreadId | null;
  sourceCommentId?: CommentId | null;
  sourceAnswerId?: AnswerId | null;
}

export interface SubmitAnswerInput {
  questionId: QuestionId;
  bodyMarkdown: string;
  baseVersion?: number;
  submit: boolean;
}

export interface ImportManifest {
  schemaVersion: 1;
  manifestId: string;
  workspaceId: WorkspaceId;
  sourceLabel: string;
  createdAt: ISODateTime;
  items: readonly ImportManifestItem[];
}

export interface ImportManifestItem {
  itemId: string;
  sourceRef: string;
  sourceSha256: string;
  resourceId?: ResourceId;
  kind: ResourceKind | "asset";
  title: string;
  visibility: RevisionVisibility;
  mediaType?: string;
  byteLength?: number;
  assetSha256?: string;
  dependsOn?: readonly string[];
}

export interface StagedImport {
  importId: ImportId;
  manifestId: string;
  status: ImportStatus;
  manifestSha256: string;
  itemCount: number;
  stagedAt: ISODateTime;
}

export interface ImportCommitResult {
  importId: ImportId;
  status: "committed";
  createdResourceIds: readonly ResourceId[];
  createdAssetIds: readonly AssetId[];
  replayed: boolean;
}

export interface PublicationRedaction {
  blockId: string;
  reason: string;
}

export interface PublicationItem {
  resourceId: ResourceId;
  revisionId: RevisionId;
  assetIds: readonly AssetId[];
  redactions: readonly PublicationRedaction[];
  consentEvidenceRef: string;
}

export interface CreatePublicationInput {
  items: readonly PublicationItem[];
  purpose: string;
  destination: string;
}

export interface PublicationRequest {
  id: PublicationId;
  workspaceId: WorkspaceId;
  status: PublicationStatus;
  purpose: string;
  requestedByAccountId: AccountId;
  requestedAt: ISODateTime;
  items: readonly PublicationItem[];
  approvedByAccountId: AccountId | null;
  approvedAt: ISODateTime | null;
  approvalDigest: string | null;
}

export interface PublicationExport {
  publicationId: PublicationId;
  approvalDigest: string;
  manifestSha256: string;
  resourceCount: number;
  assetCount: number;
  exportedAt: ISODateTime;
}

export type DataErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID"
  | "INTEGRITY"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export type DataResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: DataErrorCode; message: string; retryable: boolean };

/** Server-only capability result. Never trust a client-supplied equivalent. */
export interface AuthorizedPrincipal {
  context: RequestContext;
  workspaceId: WorkspaceId;
  membershipId: MembershipId;
  role: WorkspaceRole;
  capabilities: ReadonlySet<Capability>;
}

/** Server-only media decision. objectKey must never be serialized to clients. */
export interface MediaAuthorization {
  principal: AuthorizedPrincipal;
  asset: AssetSummary;
  objectKey: string;
  etag: string;
  uploadedAt: ISODateTime;
}
