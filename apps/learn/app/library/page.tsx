import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { requireReader } from '@/lib/session';
import { course, doc, formatBytes } from '@/lib/course';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Library' };

/**
 * Card titles are written here rather than taken from each document's own `#`
 * heading: those headings repeat the course name in full, which makes a grid of
 * ten cards unreadable.
 */
const DOCS: ReadonlyArray<{ key: string; kicker: string; title: string; blurb: string }> = [
  { key: 'start', kicker: 'Orientation', title: 'Start here', blurb: 'How to work through the course, and what the executable evidence does and does not establish.' },
  { key: 'curriculum', kicker: 'Syllabus', title: 'Course contract', blurb: 'Outcomes, the theoretical spine, the two project tracks, and the rubric.' },
  { key: 'reference', kicker: 'Cheatsheet', title: 'Quick reference', blurb: 'The compressed version. Useful once the lessons are behind you.' },
  { key: 'research', kicker: 'Foundation', title: 'Research foundation', blurb: 'The claims the course rests on, each with its scope and date.' },
  { key: 'workbook', kicker: 'Practice', title: 'Workbook', blurb: 'Every assignment and assessment collected in one place.' },
  { key: 'solutions', kicker: 'Keys', title: 'Worked solutions', blurb: 'The answer key. Write yours first.' },
  { key: 'traceCases', kicker: 'Drills', title: 'Trace cases', blurb: 'Trace-reading exercises for the evaluation and durability modules.' },
  { key: 'traceKey', kicker: 'Keys', title: 'Trace key', blurb: 'Answers to the trace cases.' },
  { key: 'capstones', kicker: 'Projects', title: 'Capstone briefs', blurb: 'The two reference capstones and their acceptance contracts.' },
  { key: 'verification', kicker: 'Provenance', title: 'Verification record', blurb: 'What was actually run and checked when the course was built.' },
];

const ATLASES: ReadonlyArray<{ slug: string; title: string; blurb: string }> = [
  { slug: 'foundations', title: 'Foundational models', blurb: 'Five interactive models covering reliability, control, and evidence.' },
  { slug: 'advanced', title: 'Advanced atlas', blurb: 'Seven models: queueing, coordination, optimization, and economics.' },
];

const EDITIONS = [
  'Harness-Engineering-Course.pdf',
  'Harness-Engineering-Workbook.pdf',
  'Harness-Engineering-Solutions.pdf',
  'Harness-Engineering-Reader.html',
];

export default async function LibraryPage() {
  const reader = await requireReader();
  const templates = course.assets.filter((asset) => asset.path.startsWith('templates/'));

  return (
    <div>
      <Header active="library" reader={reader} />

      <div className="px-page">
        <div className="px-page-head">
          <div>
            <div className="px-eyebrow">Edition {course.edition}</div>
            <h1 className="px-page-title">Library</h1>
            <p className="px-page-lede">
              Everything that is not a lesson: the syllabus, the research foundation, the
              answer keys, the interactive atlases, working templates, and the offline editions.
            </p>
          </div>
        </div>

        <section style={{ marginTop: 'clamp(24px, 4vh, 40px)' }}>
          <h2 className="px-eyebrow">Documents</h2>
          <div className="px-cards">
            {DOCS.filter((entry) => doc(entry.key)).map((entry) => (
              <Link className="px-card" key={entry.key} href={`/doc/${entry.key}`}>
                <span className="px-card-kicker">{entry.kicker}</span>
                <span className="px-card-title">{entry.title}</span>
                <span className="px-card-body">{entry.blurb}</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 'clamp(28px, 4vh, 48px)' }}>
          <h2 className="px-eyebrow">Interactive models</h2>
          <div className="px-cards">
            {ATLASES.map((atlas) => (
              <Link className="px-card" key={atlas.slug} href={`/atlas/${atlas.slug}`}>
                <span className="px-card-kicker">Atlas</span>
                <span className="px-card-title">{atlas.title}</span>
                <span className="px-card-body">{atlas.blurb}</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 'clamp(28px, 4vh, 48px)' }}>
          <h2 className="px-eyebrow">Offline editions</h2>
          <p className="px-page-lede" style={{ marginBottom: '14px' }}>
            The PDFs and the self-contained HTML reader were generated from this same source.
            They are point-in-time snapshots: when the lessons change, these lag until they are
            rebuilt.
          </p>
          <div className="px-files">
            {EDITIONS.filter((path) => course.assets.some((a) => a.path === path)).map((path) => (
              <a className="px-file" key={path} href={`/api/course-file/${path}`}>
                <span className="px-file-name">{path}</span>
                <span className="px-file-size">
                  {formatBytes(course.assets.find((a) => a.path === path)!.bytes)}
                </span>
              </a>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 'clamp(28px, 4vh, 48px)' }}>
          <h2 className="px-eyebrow">Templates</h2>
          <p className="px-page-lede" style={{ marginBottom: '14px' }}>
            The artefacts the assignments ask you to produce: work contracts, threat models,
            experiment manifests, decision and incident records.
          </p>
          <div className="px-files">
            {templates.map((asset) => (
              <a className="px-file" key={asset.path} href={`/api/course-file/${asset.path}`}>
                <span className="px-file-name">{asset.path.replace('templates/', '')}</span>
                <span className="px-file-size">{formatBytes(asset.bytes)}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
