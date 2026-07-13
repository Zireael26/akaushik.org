import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/content';
import { formatMonthYear } from '@/lib/dates';
import { canonical } from '@/lib/canonical';

const DESCRIPTION =
  'First-principles notes on agent systems and AI for traditional businesses.';

export const metadata: Metadata = {
  title: 'Writing',
  description: DESCRIPTION,
  alternates: { canonical: '/writing' },
  openGraph: {
    url: canonical('/writing'),
    type: 'website',
    siteName: 'akaushik.org',
    title: 'Writing',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@abhi2601k',
    title: 'Writing',
    description: DESCRIPTION,
  },
};

export default function WritingIndex() {
  const posts = getAllPosts('writing')
    .slice()
    .sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1));

  return (
    <main id="top" className="writing-index">
      <div className="writing-index-inner">
        <Link href="/" className="work-stub-back">
          ← Back to home
        </Link>
        <h1 className="writing-index-title">Writing</h1>
        <p className="writing-index-lede">
          First-principles notes on agent systems and AI for traditional
          businesses. New posts land here without a redesign.
        </p>
        <ul className="writing-index-list" role="list">
          {posts.map((p) => (
            <li key={p.slug} className="writing-index-item">
              <span className="writing-index-date">{formatMonthYear(p.frontmatter.date)}</span>
              <h2 className="writing-index-item-title">
                <Link href={`/writing/${p.slug}`}>{p.frontmatter.title}</Link>
              </h2>
              <p className="writing-index-item-dek">{p.frontmatter.dek}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
