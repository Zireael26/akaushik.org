import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Prose } from '@/components/course/Prose';
import { AnswerForm } from '@/components/course/AnswerForm';
import { requireReader } from '@/lib/session';
import { readProgress } from '@/lib/progress';
import { moduleByNumber, lessonsInModule, modules } from '@/lib/course';
import { saveAssessmentAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ number: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const courseModule = moduleByNumber(Number((await params).number));
  return { title: courseModule ? `Module ${courseModule.number}: ${courseModule.title}` : 'Module' };
}

export default async function ModulePage({ params }: Params) {
  const raw = (await params).number;
  // Reject "01", "1.0" and "1abc" rather than coercing them: a module URL that
  // is not the canonical integer should 404, not silently render module 1.
  const courseModule = /^\d+$/.test(raw) ? moduleByNumber(Number(raw)) : undefined;
  if (!courseModule) notFound();

  const reader = await requireReader();
  const progress = await readProgress(reader.accountId);
  const moduleLessons = lessonsInModule(courseModule.number);
  const prev = modules.find((m) => m.number === courseModule.number - 1);
  const next = modules.find((m) => m.number === courseModule.number + 1);

  return (
    <div>
      <Header active="modules" reader={reader} />

      <div className="px-page">
        <div className="px-article-crumb">
          <Link href="/contents">Contents</Link>
        </div>

        <div className="px-page-head">
          <div>
            <div className="px-eyebrow">
              Module {String(courseModule.number).padStart(2, '0')}
              {courseModule.weeks ? ` · Weeks ${courseModule.weeks}` : ''}
            </div>
            <h1 className="px-page-title">{courseModule.title}</h1>
            {courseModule.artifact && <p className="px-page-lede">{courseModule.artifact}</p>}
          </div>
        </div>

        <div className="px-lesson-rows" style={{ marginTop: '24px' }}>
          {moduleLessons.map((lesson) => {
            const state = progress.lessons[lesson.slug];
            return (
              <Link className="px-lesson-row" key={lesson.slug} href={`/lesson/${lesson.slug}`}>
                <span className="px-lesson-num">{String(lesson.number).padStart(2, '0')}</span>
                <span className="px-lesson-name">{lesson.shortTitle}</span>
                {state && (
                  <span className={`px-state is-${state}`}>
                    {state === 'done' ? 'Done' : 'Reading'}
                  </span>
                )}
                <span className="px-lesson-time">{lesson.readingMinutes} min</span>
              </Link>
            );
          })}
        </div>

        {courseModule.labCommand && (
          <div className="px-panel">
            <h2 className="px-panel-title">Module lab</h2>
            <p className="px-panel-note">
              Run this after both lessons, before the assessment. Setup and expected observations
              are on the <Link href="/labs">labs page</Link>.
            </p>
            <pre className="px-article-body" style={{ margin: 0 }}>
              <code>{courseModule.labCommand}</code>
            </pre>
          </div>
        )}

        <section style={{ marginTop: 'clamp(28px, 4vh, 44px)' }}>
          <h2 className="px-eyebrow">What this module covers</h2>
          <Prose html={courseModule.html} />
        </section>

        {courseModule.assessment && (
          <AnswerForm
            kind="assessment"
            keyValue={courseModule.number}
            prompt={courseModule.assessment.prompt}
            answer={courseModule.assessment.answer}
            saved={progress.assessments[courseModule.number] ?? null}
            action={saveAssessmentAction}
          />
        )}

        <nav className="px-pager" aria-label="Modules">
          {prev && (
            <Link className="px-pager-link" href={`/module/${prev.number}`}>
              <span className="px-pager-dir">← Module {prev.number}</span>
              <span className="px-pager-name">{prev.title}</span>
            </Link>
          )}
          {next && (
            <Link className="px-pager-link is-next" href={`/module/${next.number}`}>
              <span className="px-pager-dir">Module {next.number} →</span>
              <span className="px-pager-name">{next.title}</span>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
