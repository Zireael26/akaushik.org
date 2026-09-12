'use server';

import { revalidatePath } from 'next/cache';
import { requireReader } from '@/lib/session';
import {
  saveAssessmentAnswer,
  saveAssignmentAnswer,
  setLessonStatus,
  SELF_GRADES,
  type LessonStatus,
  type SelfGrade,
} from '@/lib/progress';
import { LESSON_SLUGS, MODULE_NUMBERS, lessons } from '@/lib/course';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const LESSON_NUMBERS = new Set(lessons.map((lesson) => lesson.number));

/**
 * Server actions are a public endpoint, so each one re-resolves the reader and
 * validates its arguments against the compiled course rather than trusting the
 * form that called it. `requireReader` redirects an unauthenticated caller.
 */

function grade(value: unknown): SelfGrade | null {
  return SELF_GRADES.includes(value as SelfGrade) ? (value as SelfGrade) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function setLessonStatusAction(slug: string, status: LessonStatus | null): Promise<ActionResult> {
  const reader = await requireReader();
  if (!LESSON_SLUGS.has(slug)) return { ok: false, error: 'Unknown lesson' };
  if (status !== null && status !== 'reading' && status !== 'done') {
    return { ok: false, error: 'Unknown status' };
  }

  await setLessonStatus(reader.accountId, slug, status);
  revalidatePath('/lesson/[slug]', 'page');
  revalidatePath('/contents');
  return { ok: true };
}

export async function saveAssignmentAction(formData: FormData): Promise<ActionResult> {
  const reader = await requireReader();
  const lessonNumber = Number(formData.get('lessonNumber'));
  if (!LESSON_NUMBERS.has(lessonNumber)) return { ok: false, error: 'Unknown lesson' };

  await saveAssignmentAnswer(reader.accountId, lessonNumber, {
    response: text(formData.get('response')),
    revealed: formData.get('revealed') === 'true',
    selfGrade: grade(formData.get('selfGrade')),
  });

  revalidatePath('/lesson/[slug]', 'page');
  return { ok: true };
}

export async function saveAssessmentAction(formData: FormData): Promise<ActionResult> {
  const reader = await requireReader();
  const moduleNumber = Number(formData.get('moduleNumber'));
  if (!MODULE_NUMBERS.has(moduleNumber)) return { ok: false, error: 'Unknown module' };

  await saveAssessmentAnswer(reader.accountId, moduleNumber, {
    response: text(formData.get('response')),
    revealed: formData.get('revealed') === 'true',
    selfGrade: grade(formData.get('selfGrade')),
  });

  revalidatePath('/module/[number]', 'page');
  revalidatePath('/contents');
  return { ok: true };
}
