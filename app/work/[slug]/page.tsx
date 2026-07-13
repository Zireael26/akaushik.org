import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts, getPost, isDraftHidden, type CaseStudyFrontmatter } from '@/lib/content';
import { CASE_STUDIES } from '@/components/sections/Work';
import { CaseStudyStub } from '@/components/sections/CaseStudyStub';
import { CaseStudyPage } from '@/components/work/CaseStudyPage';
import { caseStudyGraph, jsonLdString } from '@/lib/structured-data';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import type { ReelSlug } from '@/components/work/reels';
import { canonical } from '@/lib/canonical';

const CARD_SLUGS = CASE_STUDIES.map((c) => c.slug) as ReelSlug[];

function isCardSlug(s: string): s is ReelSlug {
  return (CARD_SLUGS as string[]).includes(s);
}

export function generateStaticParams() {
  const mdxSlugs = getAllPosts('case-studies').map((p) => p.slug);
  const allSlugs = Array.from(new Set<string>([...CARD_SLUGS, ...mdxSlugs]));
  return allSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mdx = getPost('case-studies', slug);
  if (mdx) {
    const fm = mdx.frontmatter as CaseStudyFrontmatter;
    return {
      title: `${fm.title} · Case study`,
      description: fm.dek,
      alternates: { canonical: `/work/${slug}` },
      openGraph: {
        url: canonical(`/work/${slug}`),
        type: 'website',
        siteName: 'akaushik.org',
        title: `${fm.title} · Case study`,
        description: fm.dek,
      },
      twitter: {
        card: 'summary_large_image',
        creator: '@abhi2601k',
        title: `${fm.title} · Case study`,
        description: fm.dek,
      },
    };
  }
  const card = CASE_STUDIES.find((c) => c.slug === slug);
  if (card) {
    return {
      title: `${card.title} · Case study`,
      description: card.dek,
      alternates: { canonical: `/work/${slug}` },
      openGraph: {
        url: canonical(`/work/${slug}`),
        type: 'website',
        siteName: 'akaushik.org',
        title: `${card.title} · Case study`,
        description: card.dek,
      },
      twitter: {
        card: 'summary_large_image',
        creator: '@abhi2601k',
        title: `${card.title} · Case study`,
        description: card.dek,
      },
    };
  }
  return {};
}

export default async function WorkDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const mdx = getPost('case-studies', slug);
  if (mdx && isDraftHidden(mdx.frontmatter as CaseStudyFrontmatter)) {
    notFound();
  }
  // Pre-compute the JSON-LD island. Synthesise a minimal frontmatter shape
  // for stub-only slugs (Bluehost ships permanently as a card without an
  // MDX body) so they still emit an Article graph.
  const fm: CaseStudyFrontmatter | null = mdx
    ? (mdx.frontmatter as CaseStudyFrontmatter)
    : (() => {
        const card = CASE_STUDIES.find((c) => c.slug === slug);
        if (!card) return null;
        return {
          title: card.title,
          dek: card.dek,
          index: '',
          tag: card.tag,
          year: card.year,
          role: '',
          stack: [],
          evidenceOf: card.tag,
        };
      })();

  const ldScript = fm ? (
    <JsonLdScript
      id={`ld-json-work-${slug}`}
      json={jsonLdString(caseStudyGraph(slug, fm))}
    />
  ) : null;

  if (mdx) {
    // An MDX file drives the render. Reuse the CaseStudyPage layout for any
    // slug that also exists as a home-page Work card (so the Reel placeholder
    // is wired up); fall back to a headerless layout for MDX-only entries so
    // `generateStaticParams` doesn't pre-render a route that 404s at request.
    return (
      <>
        {ldScript}
        {isCardSlug(slug) ? (
          <CaseStudyPage post={mdx} slug={slug} />
        ) : (
          <CaseStudyPage post={mdx} slug={null} />
        )}
      </>
    );
  }
  if (isCardSlug(slug)) {
    return (
      <>
        {ldScript}
        <CaseStudyStub slug={slug} />
      </>
    );
  }
  notFound();
}
