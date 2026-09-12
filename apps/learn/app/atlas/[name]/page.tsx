import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { requireReader } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ATLASES: Record<string, { title: string; file: string; blurb: string }> = {
  foundations: {
    title: 'Foundational models',
    file: 'visuals/harness-experiments.html',
    blurb:
      'Five interactive models from the first half of the course. Change the inputs and watch which conclusions survive.',
  },
  advanced: {
    title: 'Advanced atlas',
    file: 'visuals/advanced-atlas.html',
    blurb:
      'Seven models covering queueing, coordination cost, optimization, and the economics of extra agents.',
  },
};

interface Params {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const atlas = ATLASES[(await params).name];
  return { title: atlas ? atlas.title : 'Atlas' };
}

export default async function AtlasPage({ params }: Params) {
  const atlas = ATLASES[(await params).name];
  if (!atlas) notFound();

  const reader = await requireReader();

  return (
    <div>
      <Header active="library" reader={reader} />

      <div className="px-page">
        <div className="px-article-crumb">
          <Link href="/contents">Contents</Link> / <Link href="/library">Library</Link>
        </div>

        <div className="px-page-head">
          <div>
            <div className="px-eyebrow">Interactive</div>
            <h1 className="px-page-title">{atlas.title}</h1>
            <p className="px-page-lede">{atlas.blurb}</p>
          </div>
        </div>

        {/* The atlas is a self-contained page full of inline script, so it
            needs `allow-scripts`, and it drives the URL hash as you switch
            models, so it needs `allow-same-origin` too — an opaque origin makes
            history.replaceState throw and the page renders blank.

            What keeps that safe is the policy the route sends with it:
            `default-src 'none'` with no `connect-src`, so the document cannot
            reach this app's API even though it shares the origin. The sandbox
            still withholds top-level navigation and form submission. This is
            first-party content that ships in this repo, not anything a reader
            can supply. */}
        <iframe
          className="px-atlas-frame"
          src={`/api/course-file/${atlas.file}`}
          title={atlas.title}
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
          style={{ marginTop: '24px' }}
        />

        <p className="px-saved-note" style={{ marginTop: '12px' }}>
          Does not fit?{' '}
          <a href={`/api/course-file/${atlas.file}`} target="_blank" rel="noopener noreferrer">
            Open it in its own tab
          </a>
          .
        </p>
      </div>
    </div>
  );
}
