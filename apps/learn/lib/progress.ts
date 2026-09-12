/**
 * Reader progress, stored in D1 so it follows the reader between devices.
 *
 * Every function takes the account id from the resolved session. Nothing here
 * accepts an account id from a request body, which is the whole reason these
 * queries can be this short.
 */
import "server-only";
import { learnEnv, type D1Like } from "./session";

export type LessonStatus = "reading" | "done";
export type SelfGrade = "confident" | "partial" | "missed";

export const SELF_GRADES: readonly SelfGrade[] = ["confident", "partial", "missed"];

export interface SavedAnswer {
  response: string;
  revealed: boolean;
  selfGrade: SelfGrade | null;
  updatedAt: string;
}

export interface ProgressSnapshot {
  lessons: Record<string, LessonStatus>;
  assignments: Record<number, SavedAnswer>;
  assessments: Record<number, SavedAnswer>;
}

export const EMPTY_PROGRESS: ProgressSnapshot = { lessons: {}, assignments: {}, assessments: {} };

function db(): D1Like | null {
  try {
    return learnEnv().LEARN_DB ?? null;
  } catch {
    return null;
  }
}

function toAnswer(row: {
  response: string;
  revealed: number;
  self_grade: string | null;
  updated_at: string;
}): SavedAnswer {
  return {
    response: row.response,
    revealed: row.revealed === 1,
    selfGrade: (row.self_grade as SelfGrade | null) ?? null,
    updatedAt: row.updated_at,
  };
}

/**
 * One snapshot per page render. Three small reads beat lazily fetching each
 * row as a component needs it: the progress database is the only per-reader
 * state on these pages, and a page either shows it or does not.
 */
export async function readProgress(accountId: string): Promise<ProgressSnapshot> {
  const store = db();
  if (!store) return EMPTY_PROGRESS;

  try {
    const [lessonRows, assignmentRows, assessmentRows] = await Promise.all([
      store
        .prepare(`SELECT lesson_slug, status FROM lesson_progress WHERE account_id = ?1`)
        .bind(accountId)
        .all<{ lesson_slug: string; status: LessonStatus }>(),
      store
        .prepare(
          `SELECT lesson_number, response, revealed, self_grade, updated_at
             FROM assignment_answer WHERE account_id = ?1`,
        )
        .bind(accountId)
        .all<{
          lesson_number: number;
          response: string;
          revealed: number;
          self_grade: string | null;
          updated_at: string;
        }>(),
      store
        .prepare(
          `SELECT module_number, response, revealed, self_grade, updated_at
             FROM assessment_answer WHERE account_id = ?1`,
        )
        .bind(accountId)
        .all<{
          module_number: number;
          response: string;
          revealed: number;
          self_grade: string | null;
          updated_at: string;
        }>(),
    ]);

    const snapshot: ProgressSnapshot = { lessons: {}, assignments: {}, assessments: {} };
    for (const row of lessonRows.results ?? []) snapshot.lessons[row.lesson_slug] = row.status;
    for (const row of assignmentRows.results ?? []) snapshot.assignments[row.lesson_number] = toAnswer(row);
    for (const row of assessmentRows.results ?? []) snapshot.assessments[row.module_number] = toAnswer(row);
    return snapshot;
  } catch {
    // Progress is an aid, not the content. A reader whose progress database is
    // briefly unavailable should still be able to read the course.
    return EMPTY_PROGRESS;
  }
}

export async function setLessonStatus(
  accountId: string,
  slug: string,
  status: LessonStatus | null,
): Promise<void> {
  const store = db();
  if (!store) return;

  if (status === null) {
    await store
      .prepare(`DELETE FROM lesson_progress WHERE account_id = ?1 AND lesson_slug = ?2`)
      .bind(accountId, slug)
      .run();
    return;
  }

  await store
    .prepare(
      `INSERT INTO lesson_progress (account_id, lesson_slug, status, updated_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (account_id, lesson_slug)
       DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
    )
    .bind(accountId, slug, status, new Date().toISOString())
    .run();
}

interface AnswerInput {
  response: string;
  revealed: boolean;
  selfGrade: SelfGrade | null;
}

async function saveAnswer(
  table: "assignment_answer" | "assessment_answer",
  keyColumn: "lesson_number" | "module_number",
  accountId: string,
  key: number,
  input: AnswerInput,
): Promise<void> {
  const store = db();
  if (!store) return;

  // Table and column are literals chosen by the two call sites below, never
  // interpolated from a request. Every value is bound.
  await store
    .prepare(
      `INSERT INTO ${table} (account_id, ${keyColumn}, response, revealed, self_grade, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (account_id, ${keyColumn})
       DO UPDATE SET response = excluded.response,
                     revealed = MAX(${table}.revealed, excluded.revealed),
                     self_grade = excluded.self_grade,
                     updated_at = excluded.updated_at`,
    )
    .bind(
      accountId,
      key,
      input.response.slice(0, 20_000),
      input.revealed ? 1 : 0,
      input.selfGrade,
      new Date().toISOString(),
    )
    .run();
}

export function saveAssignmentAnswer(accountId: string, lessonNumber: number, input: AnswerInput) {
  return saveAnswer("assignment_answer", "lesson_number", accountId, lessonNumber, input);
}

export function saveAssessmentAnswer(accountId: string, moduleNumber: number, input: AnswerInput) {
  return saveAnswer("assessment_answer", "module_number", accountId, moduleNumber, input);
}

/** Lessons marked done, for the header meter and the contents page. */
export function completedCount(snapshot: ProgressSnapshot): number {
  return Object.values(snapshot.lessons).filter((status) => status === "done").length;
}
