-- Reader progress for learn.akaushik.org.
--
-- Deliberately small. This records where a reader got to and what they wrote
-- when answering, nothing else: no scores computed by the system, no
-- completion certificates. The course's own position is that a finite set of
-- self-marked answers is a study aid, not evidence of mastery, and the schema
-- should not imply otherwise.
--
-- account_id is the better-auth user id from AUTH_DB. There is no foreign key
-- across databases; a deleted account leaves rows here, which the owner
-- bootstrap script is responsible for clearing.

CREATE TABLE IF NOT EXISTS lesson_progress (
  account_id   TEXT NOT NULL,
  lesson_slug  TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('reading', 'done')),
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (account_id, lesson_slug)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_account
  ON lesson_progress (account_id, updated_at DESC);

-- One saved answer per reader per assignment. Rewriting an answer replaces it;
-- there is no attempt history, because a reader re-reading their own earlier
-- wrong answer is the point of the exercise, not an audit trail.
CREATE TABLE IF NOT EXISTS assignment_answer (
  account_id     TEXT NOT NULL,
  lesson_number  INTEGER NOT NULL,
  response       TEXT NOT NULL,
  revealed       INTEGER NOT NULL DEFAULT 0,
  self_grade     TEXT CHECK (self_grade IS NULL OR self_grade IN ('confident', 'partial', 'missed')),
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (account_id, lesson_number)
);

CREATE TABLE IF NOT EXISTS assessment_answer (
  account_id     TEXT NOT NULL,
  module_number  INTEGER NOT NULL,
  response       TEXT NOT NULL,
  revealed       INTEGER NOT NULL DEFAULT 0,
  self_grade     TEXT CHECK (self_grade IS NULL OR self_grade IN ('confident', 'partial', 'missed')),
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (account_id, module_number)
);
