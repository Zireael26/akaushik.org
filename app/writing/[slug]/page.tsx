import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPost, isDraftHidden, type WritingFrontmatter } from '@/lib/content';
import { canonical } from '@/lib/canonical';
import { getReadingTime } from '@/lib/reading-time';
import { MDX_OPTIONS } from '@/lib/mdx-options';
import { formatMonthYear } from '@/lib/dates';
import { articleGraph, breadcrumbGraph, jsonLdString } from '@/lib/structured-data';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { HyperframesLoop, type WritingLoopSlug } from '@/components/media/hyperframes-loop';

const WRITING_LOOPS: Partial<Record<string, WritingLoopSlug>> = {
  'building-this-portfolio': 'building-this-portfolio',
  'micrograd-makemore': 'micrograd-makemore',
  'ai-for-msme': 'ai-for-msme',
  'fastembed-to-tei': 'fastembed-to-tei',
};

export function generateStaticParams() {
  return getAllPosts('writing').map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost('writing', slug);
  if (!post) return {};
  const fm = post.frontmatter as WritingFrontmatter;
  return {
    title: fm.title,
    description: fm.dek,
    alternates: { canonical: `/writing/${slug}` },
    openGraph: {
      url: canonical(`/writing/${slug}`),
      type: 'website',
      siteName: 'akaushik.org',
      title: fm.title,
      description: fm.dek,
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@abhi2601k',
      title: fm.title,
      description: fm.dek,
    },
  };
}

export default async function WritingPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const post = getPost('writing', slug);
  if (!post) notFound();
  const fm = post.frontmatter as WritingFrontmatter;
  if (isDraftHidden(fm)) notFound();
  const readingTime = fm.readingTime ?? getReadingTime(post.content);
  const loopSlug = WRITING_LOOPS[slug];

  return (
    <main id="top" className="writing-detail">
      {/* Article JSON-LD — references the sitewide Person (@id person) +
          Organization (@id organization) declared in app/layout.tsx so
          author/publisher cross-link without duplicating those properties. */}
      <JsonLdScript
        id={`ld-json-article-${slug}`}
        json={jsonLdString(articleGraph(slug, fm))}
        nonce={nonce}
      />
      <JsonLdScript
        id={`ld-json-breadcrumb-writing-${slug}`}
        json={jsonLdString(breadcrumbGraph('writing', slug, fm.title))}
        nonce={nonce}
      />
      <Link href="/writing" className="work-stub-back">
        ← All writing
      </Link>
      <header className="writing-detail-head">
        <div className="writing-detail-meta">
          {fm.date ? <time dateTime={fm.date}>{formatMonthYear(fm.date)}</time> : null}
          <span className="writing-detail-sep">·</span>
          <span>{readingTime}</span>
        </div>
      </header>
      {loopSlug ? (
        <HyperframesLoop kind="writing" slug={loopSlug} className="writing-detail-loop" />
      ) : null}
      <article className="writing-detail-body">
        <MDXRemote source={post.content} options={MDX_OPTIONS} />
      </article>
    </main>
  );
}
