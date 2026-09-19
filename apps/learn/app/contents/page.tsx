import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Prose } from '@/components/course/Prose';
import { requireReader } from '@/lib/session';
import { readProgress, completedCount } from '@/lib/progress';
import { course, lessons, modules, lessonsInModule } from '@/lib/course';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Contents' };

export default async function ContentsPage() {
  const reader = await requireReader();
  const progress = await readProgress(reader.accountId);
  const done = completedCount(progress);

  return (
    <div>
      <Header active="contents" reader={reader} />

      <div className="px-page">
        <div className="px-page-head">
          <div>
            <div className="px-eyebrow">Harness engineering and multi-agent systems</div>
            <h1 className="px-page-title">The course</h1>
            <p className="px-page-lede">
              Twelve modules, two lessons each. Every module pairs its lessons with one runnable
              lab and one assessment. The suggested pace is 24 weeks; nothing here enforces it,
              and the whole course is available from the first day.
            </p>
          </div>

          <div className="px-meter">
            <div className="px-meter-count">
              {done}
              <span>/{lessons.length}</span>
            </div>
            <div className="px-meter-label">Lessons complete</div>
            {/* One tick per lesson, in order, so the shape of a reader's
                progress through the course is legible at a glance. */}
            <div className="px-meter-ticks" aria-hidden="true">
              {lessons.map((lesson) => (
                <span
                  key={lesson.slug}
                  className={`px-tick ${
                    progress.lessons[lesson.slug] === 'done'
                      ? 'is-done'
                      : progress.lessons[lesson.slug]
                        ? 'is-reading'
                        : ''
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-cards">
          <Link className="px-card" href="/doc/start">
            <span className="px-card-kicker">Read first</span>
            <span className="px-card-title">How to work through this</span>
            <span className="px-card-body">
              The study sequence, what the labs establish, and what they deliberately do not.
            </span>
          </Link>
          <Link className="px-card" href="/doc/curriculum">
            <span className="px-card-kicker">Syllabus</span>
            <span className="px-card-title">Course contract</span>
            <span className="px-card-body">
              Outcomes, the theoretical spine, the two project tracks, and the rubric.
            </span>
          </Link>
          <Link className="px-card" href="/labs">
            <span className="px-card-kicker">Executable</span>
            <span className="px-card-title">Labs and notebooks</span>
            <span className="px-card-body">
              {String(course.counts.module_labs)} module labs, {String(course.counts.notebooks)}{' '}
              notebooks, and the reference implementations.
            </span>
          </Link>
          <Link className="px-card" href="/library">
            <span className="px-card-kicker">Reference</span>
            <span className="px-card-title">Library</span>
            <span className="px-card-body">
              Quick reference, research foundation, templates, atlases, and the PDF editions.
            </span>
          </Link>
        </div>

        <section id="modules" style={{ marginTop: 'clamp(32px, 5vh, 56px)' }}>
          <h2 className="px-eyebrow" style={{ marginBottom: '4px' }}>
            Modules
          </h2>

          {modules.map((module) => {
            const moduleLessons = lessonsInModule(module.number);
            const assessed = progress.assessments[module.number];

            return (
              <article className="px-module" key={module.number}>
                <div className="px-module-head">
                  <span className="px-module-index">
                    {String(module.number).padStart(2, '0')}
                  </span>
                  <h3 className="px-module-title">
                    <Link href={`/module/${module.number}`}>{module.title}</Link>
                  </h3>
                  <span className="px-module-meta">
                    {module.weeks ? `Weeks ${module.weeks}` : null}
                    {assessed?.selfGrade ? ` · Assessed: ${assessed.selfGrade}` : null}
                  </span>
                </div>

                {module.artifact && <p className="px-module-artifact">{module.artifact}</p>}

                <div className="px-lesson-rows">
                  {moduleLessons.map((lesson) => {
                    const state = progress.lessons[lesson.slug];
                    return (
                      <Link
                        className="px-lesson-row"
                        key={lesson.slug}
                        href={`/lesson/${lesson.slug}`}
                      >
                        <span className="px-lesson-num">
                          {String(lesson.number).padStart(2, '0')}
                        </span>
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
              </article>
            );
          })}
        </section>

        <section style={{ marginTop: 'clamp(40px, 6vh, 72px)' }}>
          <h2 className="px-eyebrow">Course contract</h2>
          <Prose html={course.curriculumIntroHtml} />
        </section>
      </div>
    </div>
  );
}
