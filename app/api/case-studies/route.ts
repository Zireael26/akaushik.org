import { getAllPosts } from '@/lib/content';

// JSON listing of case studies — frontmatter only. Order matches the home
// Work section (curated, not alphabetical) so agents enumerate in the
// intended reading order.

export const dynamic = 'force-static';
export const revalidate = 300;

const ORDER: ReadonlyArray<string> = [
  'neev',
  'vericite',
  'bluehost-agents',
  'curat-money',
  'clusterbid',
];

export function GET() {
  const available = new Set(getAllPosts('case-studies').map((p) => p.slug));
  const studies = ORDER.filter((slug) => available.has(slug))
    .map((slug) => {
      const entry = getAllPosts('case-studies').find((p) => p.slug === slug);
      if (!entry) return null;
      const fm = entry.frontmatter;
      return {
        slug,
        title: fm.title,
        dek: fm.dek,
        index: fm.index,
        tag: fm.tag,
        year: fm.year,
        role: fm.role,
        stack: fm.stack,
        evidenceOf: fm.evidenceOf,
        url: `https://akaushik.org/work/${slug}`,
        markdown: `https://akaushik.org/work/${slug}.md`,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return Response.json(
    { count: studies.length, caseStudies: studies },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
