PRAGMA foreign_keys = ON;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE workspace_hosts (
  host TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX workspace_hosts_workspace_idx ON workspace_hosts(workspace_id, active);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'disabled')),
  joined_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, account_id)
) STRICT;
CREATE INDEX memberships_account_idx ON memberships(account_id, workspace_id, status);

CREATE TABLE capability_overrides (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
  capability TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(membership_id, capability, effect, created_at)
) STRICT;
CREATE INDEX capability_overrides_active_idx
  ON capability_overrides(workspace_id, membership_id, capability, effect)
  WHERE revoked_at IS NULL;

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  grants_inherit INTEGER NOT NULL DEFAULT 0 CHECK (grants_inherit IN (0, 1)),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, slug)
) STRICT;

CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  collection_id TEXT REFERENCES collections(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('meeting', 'research', 'presentation', 'progress_update', 'discussion', 'document', 'question')),
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'shared', 'archived')),
  current_revision_id TEXT,
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK ((lifecycle = 'archived') = (archived_at IS NOT NULL)),
  UNIQUE(workspace_id, slug)
) STRICT;
CREATE INDEX resources_workspace_idx ON resources(workspace_id, lifecycle, updated_at DESC);
CREATE INDEX resources_collection_idx ON resources(workspace_id, collection_id, lifecycle);

CREATE TABLE resource_revisions (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
  base_revision_id TEXT REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  restored_from_revision_id TEXT REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  markdown TEXT NOT NULL CHECK (length(CAST(markdown AS BLOB)) <= 524288),
  excerpt TEXT,
  content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
  visibility TEXT NOT NULL CHECK (visibility IN ('owner_only', 'workspace', 'selected_members')),
  evidence_state TEXT NOT NULL CHECK (evidence_state IN ('source', 'derived', 'proposal', 'question', 'corroborated', 'superseded', 'missing')),
  parser_contract_version INTEGER NOT NULL DEFAULT 1,
  author_account_id TEXT NOT NULL,
  import_id TEXT,
  source_ref TEXT,
  source_sha256 TEXT,
  source_captured_at TEXT,
  provenance_notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(resource_id, revision_number)
) STRICT;
CREATE INDEX revisions_workspace_resource_idx
  ON resource_revisions(workspace_id, resource_id, revision_number DESC);

CREATE TABLE revision_selected_members (
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
  PRIMARY KEY(revision_id, membership_id)
) WITHOUT ROWID;

CREATE TABLE revision_blocks (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  block_type TEXT NOT NULL,
  body_sha256 TEXT NOT NULL CHECK (length(body_sha256) = 64),
  UNIQUE(revision_id, ordinal),
  UNIQUE(revision_id, id)
) STRICT;

CREATE TABLE revision_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  source_resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  source_revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  target_key TEXT NOT NULL,
  target_resource_id TEXT REFERENCES resources(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('resolved', 'broken', 'ambiguous')),
  label TEXT,
  occurrence INTEGER NOT NULL CHECK (occurrence >= 1),
  created_at TEXT NOT NULL,
  UNIQUE(source_revision_id, occurrence),
  CHECK ((status = 'resolved') = (target_resource_id IS NOT NULL))
) STRICT;
CREATE INDEX revision_links_target_idx
  ON revision_links(workspace_id, target_resource_id, source_revision_id);

CREATE TABLE collection_grants (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('member', 'role')),
  subject_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'comment', 'answer')),
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  inheritable INTEGER NOT NULL DEFAULT 1 CHECK (inheritable IN (0, 1)),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
) STRICT;
CREATE INDEX collection_grants_effective_idx
  ON collection_grants(workspace_id, collection_id, subject_type, subject_id, permission, effect)
  WHERE revoked_at IS NULL;

CREATE TABLE resource_grants (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('member', 'role')),
  subject_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'comment', 'answer')),
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
) STRICT;
CREATE INDEX resource_grants_effective_idx
  ON resource_grants(workspace_id, resource_id, revision_id, subject_type, subject_id, permission, effect)
  WHERE revoked_at IS NULL;

CREATE TABLE share_releases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  grant_id TEXT NOT NULL REFERENCES resource_grants(id) ON DELETE RESTRICT,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('member', 'role')),
  audience_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  released_by_account_id TEXT NOT NULL,
  released_at TEXT NOT NULL,
  revoked_by_account_id TEXT,
  revoked_at TEXT
) STRICT;
CREATE INDEX share_releases_active_idx
  ON share_releases(workspace_id, resource_id, revision_id, audience_type, audience_id)
  WHERE status = 'active';

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  current_version_id TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('original', 'playback', 'presentation', 'attachment', 'waveform', 'other')),
  parent_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
  classification TEXT NOT NULL DEFAULT 'private' CHECK (classification IN ('private', 'guest', 'public_candidate')),
  consent_state TEXT NOT NULL DEFAULT 'pending' CHECK (consent_state IN ('pending', 'verified', 'not_required', 'revoked')),
  consent_evidence_ref TEXT,
  state TEXT NOT NULL CHECK (state IN ('staging', 'ready', 'orphan', 'quarantined')),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (consent_state NOT IN ('verified', 'not_required') OR consent_evidence_ref IS NOT NULL)
) STRICT;
CREATE INDEX assets_resource_idx ON assets(workspace_id, resource_id, revision_id, state);

CREATE TABLE asset_versions (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  parent_version_id TEXT REFERENCES asset_versions(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  etag TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  derivation_tool TEXT,
  derivation_version TEXT,
  review_status TEXT NOT NULL DEFAULT 'source' CHECK (review_status IN ('source', 'pending', 'approved', 'rejected')),
  reviewed_by_account_id TEXT,
  reviewed_at TEXT,
  UNIQUE(asset_id, version_number)
) STRICT;

CREATE TABLE share_release_assets (
  share_release_id TEXT NOT NULL REFERENCES share_releases(id) ON DELETE RESTRICT,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  asset_version_id TEXT NOT NULL REFERENCES asset_versions(id) ON DELETE RESTRICT,
  PRIMARY KEY(share_release_id, asset_id)
) WITHOUT ROWID;

CREATE TABLE meetings (
  resource_id TEXT PRIMARY KEY REFERENCES resources(id) ON DELETE RESTRICT,
  starts_at TEXT,
  ends_at TEXT,
  occurrence_status TEXT NOT NULL CHECK (occurrence_status IN ('scheduled', 'occurred', 'cancelled', 'unknown')),
  occurred_at TEXT,
  original_audio_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
  playback_audio_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
  transcript_resource_id TEXT REFERENCES resources(id) ON DELETE RESTRICT,
  summary_resource_id TEXT REFERENCES resources(id) ON DELETE RESTRICT,
  presentation_resource_id TEXT REFERENCES resources(id) ON DELETE RESTRICT,
  CHECK (occurrence_status = 'occurred' OR occurred_at IS NULL)
) STRICT;

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  block_id TEXT,
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
) STRICT;
CREATE INDEX threads_resource_idx ON threads(workspace_id, resource_id, revision_id);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE RESTRICT,
  parent_comment_id TEXT REFERENCES comments(id) ON DELETE RESTRICT,
  author_account_id TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE comment_versions (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  body_markdown TEXT NOT NULL CHECK (length(CAST(body_markdown AS BLOB)) <= 16384),
  editor_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(comment_id, version)
) WITHOUT ROWID;

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  prompt_markdown TEXT NOT NULL CHECK (length(CAST(prompt_markdown AS BLOB)) <= 16384),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'resolved', 'withdrawn')),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE question_assignments (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
  assigned_by_account_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  due_at TEXT,
  PRIMARY KEY(question_id, membership_id)
) WITHOUT ROWID;

CREATE TABLE question_answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  author_account_id TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'superseded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(question_id, author_account_id)
) STRICT;

CREATE TABLE question_answer_versions (
  answer_id TEXT NOT NULL REFERENCES question_answers(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  body_markdown TEXT NOT NULL CHECK (length(CAST(body_markdown AS BLOB)) <= 16384),
  editor_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(answer_id, version)
) WITHOUT ROWID;

CREATE TABLE decision_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  source_thread_id TEXT REFERENCES threads(id) ON DELETE RESTRICT,
  source_comment_id TEXT REFERENCES comments(id) ON DELETE RESTRICT,
  source_answer_id TEXT REFERENCES question_answers(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  outcome_markdown TEXT NOT NULL CHECK (length(CAST(outcome_markdown AS BLOB)) <= 16384),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'rejected', 'superseded')),
  promoted_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT
) STRICT;

CREATE TABLE member_resource_state (
  membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  last_read_revision_id TEXT REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  last_read_at TEXT NOT NULL,
  PRIMARY KEY(membership_id, resource_id)
) WITHOUT ROWID;

CREATE TABLE publication_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'exported', 'revoked')),
  purpose TEXT NOT NULL,
  destination TEXT NOT NULL,
  requested_by_account_id TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  submitted_at TEXT,
  revoked_at TEXT
) STRICT;

CREATE TABLE publication_items (
  publication_id TEXT NOT NULL REFERENCES publication_requests(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  redactions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(redactions_json)),
  consent_evidence_ref TEXT NOT NULL,
  PRIMARY KEY(publication_id, resource_id, revision_id)
) WITHOUT ROWID;

CREATE TABLE publication_item_assets (
  publication_id TEXT NOT NULL REFERENCES publication_requests(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  asset_version_id TEXT NOT NULL REFERENCES asset_versions(id) ON DELETE RESTRICT,
  PRIMARY KEY(publication_id, asset_id),
  FOREIGN KEY(publication_id, resource_id, revision_id)
    REFERENCES publication_items(publication_id, resource_id, revision_id) ON DELETE RESTRICT
) WITHOUT ROWID;

CREATE TABLE publication_approvals (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES publication_requests(id) ON DELETE RESTRICT,
  approval_digest TEXT NOT NULL CHECK (length(approval_digest) = 64),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  approver_account_id TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  UNIQUE(publication_id, approval_digest)
) STRICT;

CREATE TABLE publication_exports (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES publication_requests(id) ON DELETE RESTRICT,
  approval_id TEXT NOT NULL REFERENCES publication_approvals(id) ON DELETE RESTRICT,
  approval_digest TEXT NOT NULL CHECK (length(approval_digest) = 64),
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64),
  destination TEXT NOT NULL,
  resource_count INTEGER NOT NULL CHECK (resource_count >= 0),
  asset_count INTEGER NOT NULL CHECK (asset_count >= 0),
  exported_by_account_id TEXT NOT NULL,
  exported_at TEXT NOT NULL,
  UNIQUE(publication_id, manifest_sha256)
) STRICT;

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  manifest_id TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64),
  source_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('staged', 'validated', 'committing', 'committed', 'failed')),
  initiated_by_account_id TEXT NOT NULL,
  staged_at TEXT NOT NULL,
  committed_at TEXT,
  safe_error_code TEXT,
  UNIQUE(workspace_id, manifest_id, manifest_sha256)
) STRICT;

CREATE TABLE import_items (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE RESTRICT,
  manifest_item_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
  kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('staged', 'validated', 'committing', 'ready', 'failed', 'orphan')),
  staging_object_key TEXT,
  resource_id TEXT REFERENCES resources(id) ON DELETE RESTRICT,
  revision_id TEXT REFERENCES resource_revisions(id) ON DELETE RESTRICT,
  asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
  asset_version_id TEXT REFERENCES asset_versions(id) ON DELETE RESTRICT,
  safe_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(import_id, manifest_item_id, source_sha256)
) STRICT;
CREATE INDEX import_items_state_idx ON import_items(import_id, state);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'conflict', 'failure')),
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json))
) STRICT;
CREATE INDEX audit_events_workspace_idx ON audit_events(workspace_id, occurred_at DESC);

CREATE TABLE recovery_checkpoints (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  source_export_sha256 TEXT NOT NULL CHECK (length(source_export_sha256) = 64),
  object_inventory_sha256 TEXT NOT NULL CHECK (length(object_inventory_sha256) = 64),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  restored_at TEXT,
  restore_receipt_sha256 TEXT
) STRICT;

CREATE VIRTUAL TABLE resource_fts USING fts5(
  revision_id UNINDEXED,
  workspace_id UNINDEXED,
  resource_id UNINDEXED,
  title,
  body,
  tokenize = 'unicode61'
);

CREATE TRIGGER revision_requires_current_base
BEFORE INSERT ON resource_revisions
WHEN NOT EXISTS (
  SELECT 1 FROM resources
  WHERE id = NEW.resource_id
    AND workspace_id = NEW.workspace_id
    AND current_revision_id IS NEW.base_revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'stale-base');
END;

CREATE TRIGGER resource_revision_immutable_update
BEFORE UPDATE ON resource_revisions BEGIN
  SELECT RAISE(ABORT, 'immutable-revision');
END;
CREATE TRIGGER resource_revision_immutable_delete
BEFORE DELETE ON resource_revisions BEGIN
  SELECT RAISE(ABORT, 'immutable-revision');
END;
CREATE TRIGGER revision_block_immutable_update
BEFORE UPDATE ON revision_blocks BEGIN
  SELECT RAISE(ABORT, 'immutable-revision-block');
END;
CREATE TRIGGER revision_block_immutable_delete
BEFORE DELETE ON revision_blocks BEGIN
  SELECT RAISE(ABORT, 'immutable-revision-block');
END;
CREATE TRIGGER revision_link_immutable_update
BEFORE UPDATE ON revision_links BEGIN
  SELECT RAISE(ABORT, 'immutable-revision-link');
END;
CREATE TRIGGER revision_link_immutable_delete
BEFORE DELETE ON revision_links BEGIN
  SELECT RAISE(ABORT, 'immutable-revision-link');
END;
CREATE TRIGGER asset_version_immutable_update
BEFORE UPDATE ON asset_versions BEGIN
  SELECT RAISE(ABORT, 'immutable-asset-version');
END;
CREATE TRIGGER asset_version_immutable_delete
BEFORE DELETE ON asset_versions BEGIN
  SELECT RAISE(ABORT, 'immutable-asset-version');
END;
CREATE TRIGGER comment_version_immutable_update
BEFORE UPDATE ON comment_versions BEGIN
  SELECT RAISE(ABORT, 'immutable-comment-version');
END;
CREATE TRIGGER comment_version_immutable_delete
BEFORE DELETE ON comment_versions BEGIN
  SELECT RAISE(ABORT, 'immutable-comment-version');
END;
CREATE TRIGGER answer_version_immutable_update
BEFORE UPDATE ON question_answer_versions BEGIN
  SELECT RAISE(ABORT, 'immutable-answer-version');
END;
CREATE TRIGGER answer_version_immutable_delete
BEFORE DELETE ON question_answer_versions BEGIN
  SELECT RAISE(ABORT, 'immutable-answer-version');
END;

CREATE TRIGGER publication_item_immutable_update
BEFORE UPDATE ON publication_items BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-item');
END;
CREATE TRIGGER publication_item_immutable_delete
BEFORE DELETE ON publication_items BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-item');
END;
CREATE TRIGGER publication_asset_immutable_update
BEFORE UPDATE ON publication_item_assets BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-asset');
END;
CREATE TRIGGER publication_asset_immutable_delete
BEFORE DELETE ON publication_item_assets BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-asset');
END;
CREATE TRIGGER publication_approval_immutable_update
BEFORE UPDATE ON publication_approvals BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-approval');
END;
CREATE TRIGGER publication_approval_immutable_delete
BEFORE DELETE ON publication_approvals BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-approval');
END;
CREATE TRIGGER publication_export_immutable_update
BEFORE UPDATE ON publication_exports BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-export');
END;
CREATE TRIGGER publication_export_immutable_delete
BEFORE DELETE ON publication_exports BEGIN
  SELECT RAISE(ABORT, 'immutable-publication-export');
END;
CREATE TRIGGER audit_event_immutable_update
BEFORE UPDATE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'immutable-audit-event');
END;
CREATE TRIGGER audit_event_immutable_delete
BEFORE DELETE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'immutable-audit-event');
END;

CREATE TRIGGER resource_head_workspace_guard
BEFORE UPDATE OF current_revision_id ON resources
WHEN NEW.current_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM resource_revisions rr
  WHERE rr.id = NEW.current_revision_id
    AND rr.resource_id = NEW.id
    AND rr.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid-resource-head');
END;
