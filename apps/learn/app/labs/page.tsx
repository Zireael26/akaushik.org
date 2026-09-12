import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Prose } from '@/components/course/Prose';
import { requireReader } from '@/lib/session';
import { course, doc, modules, formatBytes } from '@/lib/course';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Labs' };

/** Directories whose files are shown as a downloadable listing on this page. */
const CODE_PREFIXES = ['labs/', 'starter-labs/', 'langgraph-example/', 'notebooks/'];

export default async function LabsPage() {
  const reader = await requireReader();
  const labsDoc = doc('labs');

  const files = course.assets.filter((asset) =>
    CODE_PREFIXES.some((prefix) => asset.path.startsWith(prefix)),
  );

  return (
    <div>
      <Header active="labs" reader={reader} />

      <div className="px-page">
        <div className="px-page-head">
          <div>
            <div className="px-eyebrow">Executable material</div>
            <h1 className="px-page-title">Labs</h1>
            <p className="px-page-lede">
              {String(course.counts.module_labs)} module labs, one per module, plus the starter
              harness, the LangGraph bridge, and {String(course.counts.notebooks)} executed
              notebooks. They run locally on Python 3.12 and make no paid model calls.
            </p>
          </div>
        </div>

        <div className="px-panel">
          <h2 className="px-panel-title">Setup</h2>
          <p className="px-panel-note">
            Take the lab files from the listing below, then create a virtual environment and
            install the exact lock file. Only the initial install needs network access.
          </p>
          <div className="px-article-body">
            <pre>
              <code>{`python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r labs/requirements-lock.txt
python labs/run_lab.py 1`}</code>
            </pre>
          </div>
        </div>

        <section style={{ marginTop: 'clamp(28px, 4vh, 44px)' }}>
          <h2 className="px-eyebrow">Which lab goes with which module</h2>
          <div className="px-lesson-rows">
            {modules.map((module) => (
              <Link className="px-lesson-row" key={module.number} href={`/module/${module.number}`}>
                <span className="px-lesson-num">{String(module.number).padStart(2, '0')}</span>
                <span className="px-lesson-name">{module.title}</span>
                <span className="px-lesson-time">{module.labCommand ?? '—'}</span>
              </Link>
            ))}
          </div>
        </section>

        {labsDoc && (
          <section style={{ marginTop: 'clamp(32px, 5vh, 56px)' }}>
            <h2 className="px-eyebrow">Expected observations</h2>
            <Prose html={labsDoc.html} />
          </section>
        )}

        <section style={{ marginTop: 'clamp(32px, 5vh, 56px)' }}>
          <h2 className="px-eyebrow">Files</h2>
          <div className="px-files">
            {files.map((asset) => (
              <a className="px-file" key={asset.path} href={`/api/course-file/${asset.path}`}>
                <span className="px-file-name">{asset.path}</span>
                <span className="px-file-size">{formatBytes(asset.bytes)}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
