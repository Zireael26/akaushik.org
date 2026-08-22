import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getAllPosts, getPost, isDraftHidden, type CaseStudyFrontmatter } from '@/lib/content';
import { CaseStudyPage } from '@/components/work/CaseStudyPage';
import { breadcrumbGraph, caseStudyGraph, jsonLdString } from '@/lib/structured-data';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { isReelSlug } from '@/components/work/reels';
import { canonical } from '@/lib/canonical';

export function generateStaticParams() {
  return getAllPosts('case-studies').map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mdx = getPost('case-studies', slug);
  if (!mdx) return {};
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

export default async function WorkDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const mdx = getPost('case-studies', slug);
  if (!mdx || isDraftHidden(mdx.frontmatter as CaseStudyFrontmatter)) {
    notFound();
  }

  const fm = mdx.frontmatter as CaseStudyFrontmatter;

  const ldScripts = (
    <>
      <JsonLdScript
        id={`ld-json-work-${slug}`}
        json={jsonLdString(caseStudyGraph(slug, fm))}
        nonce={nonce}
      />
      <JsonLdScript
        id={`ld-json-breadcrumb-work-${slug}`}
        json={jsonLdString(breadcrumbGraph('work', slug, fm.title))}
        nonce={nonce}
      />
    </>
  );

  const reelSlug = isReelSlug(slug) ? slug : null;

  return (
    <>
      {ldScripts}
      <CaseStudyPage post={mdx} routeSlug={slug} reelSlug={reelSlug} />
    </>
  );
}
