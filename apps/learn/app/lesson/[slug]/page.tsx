import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Prose } from '@/components/course/Prose';
import { AnswerForm } from '@/components/course/AnswerForm';
import { LessonStatusToggle } from '@/components/course/LessonStatus';
import { requireReader } from '@/lib/session';
import { readProgress } from '@/lib/progress';
import { lessonBySlug, lessonNeighbours, moduleByNumber } from '@/lib/course';
import { saveAssignmentAction, setLessonStatusAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lesson = lessonBySlug((await params).slug);
  return { title: lesson ? lesson.shortTitle : 'Lesson' };
}

export default async function LessonPage({ params }: Params) {
  const { slug } = await params;
  const lesson = lessonBySlug(slug);
  if (!lesson) notFound();

  const reader = await requireReader();
  const progress = await readProgress(reader.accountId);
  const courseModule = moduleByNumber(lesson.module);
  const { prev, next } = lessonNeighbours(slug);

  return (
    <div>
      <Header active="lesson" reader={reader} />

      <div className="px-lesson-layout">
        <article>
          <div className="px-article-crumb">
            <Link href="/contents">Contents</Link>
            {courseModule && (
              <>
                {' / '}
                <Link href={`/module/${courseModule.number}`}>
                  Module {courseModule.number}: {courseModule.title}
                </Link>
              </>
            )}
          </div>

          <h1 className="px-article-title">{lesson.shortTitle}</h1>

          <div className="px-article-byline">
            <span>Lesson {String(lesson.number).padStart(2, '0')}</span>
            <span>{lesson.readingMinutes} min read</span>
            {lesson.labCommand && <span>Lab: {lesson.labCommand}</span>}
            <span style={{ marginLeft: 'auto' }}>
              <LessonStatusToggle
                slug={lesson.slug}
                initial={progress.lessons[lesson.slug] ?? null}
                action={setLessonStatusAction}
              />
            </span>
          </div>

          <Prose html={lesson.html} />

          {lesson.assignment && (
            <AnswerForm
              kind="assignment"
              keyValue={lesson.number}
              prompt={lesson.assignment.prompt}
              answer={lesson.assignment.solution}
              saved={progress.assignments[lesson.number] ?? null}
              action={saveAssignmentAction}
            />
          )}

          <nav className="px-pager" aria-label="Lessons">
            {prev && (
              <Link className="px-pager-link" href={`/lesson/${prev.slug}`}>
                <span className="px-pager-dir">← Lesson {prev.number}</span>
                <span className="px-pager-name">{prev.shortTitle}</span>
              </Link>
            )}
            {next && (
              <Link className="px-pager-link is-next" href={`/lesson/${next.slug}`}>
                <span className="px-pager-dir">Lesson {next.number} →</span>
                <span className="px-pager-name">{next.shortTitle}</span>
              </Link>
            )}
          </nav>
        </article>

        {lesson.headings.length > 1 && (
          <aside className="px-toc">
            <div className="px-toc-title">In this lesson</div>
            <ol>
              {lesson.headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}
