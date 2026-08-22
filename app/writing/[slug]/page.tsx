import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  getAllPosts,
  getAllPostsWithReadingTime,
  getPost,
  isDraftHidden,
  type WritingFrontmatter,
} from '@/lib/content';
import { canonical } from '@/lib/canonical';
import { getReadingTime } from '@/lib/reading-time';
import { MDX_OPTIONS } from '@/lib/mdx-options';
import { articleGraph, breadcrumbGraph, jsonLdString } from '@/lib/structured-data';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { HyperframesLoop, type WritingLoopSlug } from '@/components/media/hyperframes-loop';
import { RouteField } from '@/components/pixel/RouteField';
import { MatterRow, RuledRow } from '@/components/pixel/RuledRow';
import { ARTICLE_COPY, type FaqRow } from './article-copy';

const WRITING_LOOPS: Partial<Record<string, WritingLoopSlug>> = {
  'building-this-portfolio': 'building-this-portfolio',
  'micrograd-makemore': 'micrograd-makemore',
  'ai-for-msme': 'ai-for-msme',
  'fastembed-to-tei': 'fastembed-to-tei',
};

/** Byline date, e.g. "11 May 2026" — the reference article's shape. Parsed in
    UTC like formatMonthYear so a bare ISO date cannot regress west of UTC. */
const BYLINE_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatBylineDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return BYLINE_DATE.format(d);
}

/**
 * The authored bodies under content/writing/ open with an H1 and a blockquote
 * dek that mirror the frontmatter title and dek. The article template renders
 * the H1 and the dek from frontmatter (the design's chrome: breadcrumb, H1,
 * dek, byline, short answer), so that leading pair is stripped from the
 * rendered body rather than duplicated. Everything from the first H2 on
 * renders verbatim — this is presentation only; the MDX files are untouched.
 */
function stripTitleChrome(body: string): string {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === '') i += 1;
  if (i < lines.length && lines[i]!.startsWith('# ')) {
    i += 1;
    while (i < lines.length && lines[i]!.trim() === '') i += 1;
  }
  if (i < lines.length && /^>\s?/.test(lines[i]!)) {
    while (i < lines.length && /^>\s?/.test(lines[i]!)) i += 1;
  }
  return lines.slice(i).join('\n').trim();
}

/**
 * Article + FAQPage as one @graph value. The Article node is articleGraph's
 * (stable @id ...#article, cross-linked to the sitewide Person/Organization),
 * with its top-level @context dropped into the graph envelope; the FAQPage
 * node carries stable @id URIs of its own (...#faq, ...#faq-N) so the two
 * shapes reference the same page without a second competing graph.
 */
export function articleGraphWithFaq(
  slug: string,
  fm: WritingFrontmatter,
  faq: FaqRow[],
): Record<string, unknown> {
  const article = articleGraph(slug, fm);
  const url = canonical(`/writing/${slug}`);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      Object.fromEntries(Object.entries(article).filter(([key]) => key !== '@context')),
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faq.map((row, i) => ({
          '@type': 'Question',
          '@id': `${url}#faq-${i + 1}`,
          name: row.q,
          acceptedAnswer: { '@type': 'Answer', text: row.a },
        })),
      },
    ],
  };
}

/** Read-next rows follow the complete published chronology so an unlisted
    current article can still find its position. Unlisted entries participate
    only as the current position: they are removed from candidates before the
    first two recommendations are selected. Drafts remain excluded by the
    content helper's default. */
export function nextReads(
  slug: string,
): Array<{ slug: string; title: string; readingTime: string }> {
  const all = getAllPostsWithReadingTime('writing', { includeUnlisted: true })
    .slice()
    .sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1));
  const index = all.findIndex((post) => post.slug === slug);
  if (index === -1) return [];
  return all
    .slice(index + 1)
    .filter((post) => post.frontmatter.unlisted !== true)
    .slice(0, 2)
    .map((post) => ({
      slug: post.slug,
      title: post.frontmatter.title,
      readingTime: post.readingTime,
    }));
}

export function generateStaticParams() {
  return getAllPosts('writing', { includeUnlisted: true }).map((post) => ({
    slug: post.slug,
  }));
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
    robots: fm.unlisted === true ? { index: false, follow: false } : undefined,
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

  // Grounded per-post copy. When a post has none, the short-answer box and the
  // FAQ block are omitted and the JSON-LD stays a plain Article graph — no
  // FAQPage node is fabricated to fill the gap.
  const copy = ARTICLE_COPY[slug];
  const shortAnswer = copy?.shortAnswer ?? [];
  const faq = copy?.faq ?? [];
  const articleLd = faq.length > 0 ? articleGraphWithFaq(slug, fm, faq) : articleGraph(slug, fm);

  const next = nextReads(slug);

  return (
    <main id="top" className="writing-detail">
      {/* Article JSON-LD — references the sitewide Person (@id person) +
          Organization (@id organization) declared in app/layout.tsx so
          author/publisher cross-link without duplicating those properties.
          Posts with grounded FAQ material emit Article + FAQPage merged into
          one @graph; posts without emit the Article graph alone. */}
      <JsonLdScript id={`ld-json-article-${slug}`} json={jsonLdString(articleLd)} nonce={nonce} />
      <JsonLdScript
        id={`ld-json-breadcrumb-writing-${slug}`}
        json={jsonLdString(breadcrumbGraph('writing', slug, fm.title))}
        nonce={nonce}
      />

      <article className="px-article">
        <header>
          <RouteField slug={slug} />

          <nav className="px-article-crumb" aria-label="Breadcrumb">
            <Link href="/writing">Writing</Link>
          </nav>

          <h1 className="px-article-title">{fm.title}</h1>
          <p className="px-article-dek">{fm.dek}</p>

          <div className="px-article-byline">
            <Link href="/">Abhishek Kaushik</Link>
            <span aria-hidden="true">·</span>
            <span>AI Engineer</span>
            <span aria-hidden="true">·</span>
            <time dateTime={fm.date}>{formatBylineDate(fm.date)}</time>
            <span aria-hidden="true">·</span>
            <span>{readingTime}</span>
          </div>
        </header>

        {shortAnswer.length > 0 ? (
          <section className="px-article-short" aria-labelledby={`short-answer-${slug}`}>
            <div className="px-article-kicker" id={`short-answer-${slug}`}>
              The short answer
            </div>
            {shortAnswer.map((row, i) => (
              <RuledRow
                key={i}
                tag={String(i + 1).padStart(2, '0')}
                last={i === shortAnswer.length - 1}
              >
                <strong>{row.lead}</strong>
                {row.rest}
              </RuledRow>
            ))}
          </section>
        ) : null}

        {loopSlug ? (
          <HyperframesLoop kind="writing" slug={loopSlug} className="px-article-loop" />
        ) : null}

        <div className="px-article-body">
          <MDXRemote source={stripTitleChrome(post.content)} options={MDX_OPTIONS} />
        </div>
        {faq.length > 0 ? (
          <section className="px-article-faq" aria-labelledby={`faq-${slug}`}>
            <div className="px-article-kicker" id={`faq-${slug}`}>
              Common questions
            </div>
            {faq.map((row, i) => (
              <div className="px-article-faq-row" key={i}>
                <div className="px-article-faq-q">{row.q}</div>
                <p className="px-article-faq-a">{row.a}</p>
              </div>
            ))}
          </section>
        ) : null}
        {next.length > 0 ? (
          <section className="px-article-next" aria-labelledby={`read-next-${slug}`}>
            <div className="px-article-kicker" id={`read-next-${slug}`}>
              Read next
            </div>
            {next.map((entry, i) => (
              <MatterRow
                key={entry.slug}
                title={entry.title}
                tag={entry.readingTime.toUpperCase()}
                tagTone={nextTone(i)}
                href={`/writing/${entry.slug}`}
              />
            ))}
          </section>
        ) : null}
      </article>
    </main>
  );
}

/** Read-next tags rotate cobalt, amber, red, like the index rows. */
const NEXT_TONES = ['cobalt', 'amber', 'red'] as const;

function nextTone(i: number): (typeof NEXT_TONES)[number] {
  switch (i % NEXT_TONES.length) {
    case 0:
      return 'cobalt';
    case 1:
      return 'amber';
    default:
      return 'red';
  }
}
