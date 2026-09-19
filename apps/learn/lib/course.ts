/**
 * Typed access to the compiled course bundle.
 *
 * The bundle is produced by scripts/build-course.mjs from apps/learn/course/
 * and imported statically, so there is no filesystem read at request time and
 * no markdown parser in the Worker. Everything here is pure lookup over data
 * that was already sanitized at build time.
 */
import bundle from "./generated/course.json";

export interface Heading {
  id: string;
  text: string;
  level: number;
}

export interface Assignment {
  title: string;
  prompt: string;
  solution: string;
}

export interface Lesson {
  number: number;
  slug: string;
  /** "Lesson 4: Tool Contracts, Skills, and Engineered Environments" */
  title: string;
  /** The same title without the "Lesson N: " prefix. */
  shortTitle: string;
  module: number;
  labCommand: string | null;
  html: string;
  headings: Heading[];
  wordCount: number;
  readingMinutes: number;
  assignment: Assignment | null;
}

export interface ModuleAssessment {
  title: string;
  prompt: string;
  answer: string;
}

export interface CourseModule {
  number: number;
  title: string;
  weeks: string | null;
  artifact: string | null;
  html: string;
  lessons: number[];
  labCommand: string | null;
  assessment: ModuleAssessment | null;
}

export interface CourseDoc {
  path: string;
  title: string;
  html: string;
  headings: Heading[];
  readingMinutes: number;
}

export interface CourseAsset {
  path: string;
  bytes: number;
}

export interface CourseBundle {
  builtAt: string;
  edition: string;
  researchAsOf: string;
  counts: Record<string, unknown> & {
    lessons: number;
    lesson_words: number;
    module_labs: number;
    interactive_models: number;
    notebooks: number;
  };
  curriculumIntroHtml: string;
  modules: CourseModule[];
  lessons: Lesson[];
  docs: Record<string, CourseDoc>;
  assets: CourseAsset[];
}

export const course = bundle as unknown as CourseBundle;

export const lessons = course.lessons;
export const modules = course.modules;

export function lessonBySlug(slug: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.slug === slug);
}

export function moduleByNumber(n: number): CourseModule | undefined {
  return modules.find((m) => m.number === n);
}

export function lessonsInModule(n: number): Lesson[] {
  return lessons.filter((lesson) => lesson.module === n);
}

/** Previous and next lesson in reading order, for the footer pager. */
export function lessonNeighbours(slug: string): { prev: Lesson | null; next: Lesson | null } {
  const index = lessons.findIndex((lesson) => lesson.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? lessons[index - 1]! : null,
    next: index < lessons.length - 1 ? lessons[index + 1]! : null,
  };
}

export function doc(key: string): CourseDoc | undefined {
  return course.docs[key];
}

/** Every slug that `progress` may legitimately record, for input validation. */
export const LESSON_SLUGS: ReadonlySet<string> = new Set(lessons.map((lesson) => lesson.slug));

export const MODULE_NUMBERS: ReadonlySet<number> = new Set(modules.map((m) => m.number));

/**
 * Files the gated download route will serve. An allowlist rather than a path
 * check: the route can then never be argued into reading something outside the
 * course directory, whatever a path looks like after normalization.
 */
export const DOWNLOADABLE: ReadonlySet<string> = new Set(course.assets.map((a) => a.path));

export function assetBytes(path: string): number | null {
  return course.assets.find((a) => a.path === path)?.bytes ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
