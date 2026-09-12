import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Prose } from '@/components/course/Prose';
import { requireReader } from '@/lib/session';
import { doc } from '@/lib/course';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const entry = doc((await params).key);
  return { title: entry ? entry.title : 'Document' };
}

/** Renders one of the course's standalone documents (syllabus, research, keys). */
export default async function DocPage({ params }: Params) {
  const entry = doc((await params).key);
  if (!entry) notFound();

  const reader = await requireReader();

  return (
    <div>
      <Header active="library" reader={reader} />

      <div className="px-article">
        <div className="px-article-crumb">
          <Link href="/contents">Contents</Link> / <Link href="/library">Library</Link>
        </div>

        <h1 className="px-article-title">{entry.title}</h1>
        <div className="px-article-byline">
          <span>{entry.path}</span>
          <span>{entry.readingMinutes} min read</span>
        </div>

        <Prose html={entry.html} />
      </div>
    </div>
  );
}
