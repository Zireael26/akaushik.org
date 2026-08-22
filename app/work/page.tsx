import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts, type CaseStudyFrontmatter } from '@/lib/content';
import { canonical } from '@/lib/canonical';
import { SectionHead } from '@/components/pixel/SectionHead';
import { MatterRow, RuledRow } from '@/components/pixel/RuledRow';

const DESCRIPTION =
  'Five case studies — Neev, VeriCite, Bluehost agents framework, curat.money, and ClusterBid — ordered by strategic weight.';

export const metadata: Metadata = {
  title: 'Selected work',
  description: DESCRIPTION,
  alternates: { canonical: '/work' },
  openGraph: {
    url: canonical('/work'),
    type: 'website',
    siteName: 'akaushik.org',
    title: 'Selected work',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@abhi2601k',
    title: 'Selected work',
    description: DESCRIPTION,
  },
};

const TAG_TONES = ['cobalt', 'amber', 'red', 'ink'] as const;

function tagTone(i: number): (typeof TAG_TONES)[number] {
  switch (i % 4) {
    case 0:
      return 'cobalt';
    case 1:
      return 'amber';
    case 2:
      return 'red';
    default:
      return 'ink';
  }
}

export default function WorkIndex() {
  const studies = getAllPosts('case-studies')
    .slice()
    .sort((a, b) => a.frontmatter.index.localeCompare(b.frontmatter.index));

  return (
    <main id="top" className="px-work-index">
      <Link href="/" className="px-work-back">
        ← Back to home
      </Link>
      <SectionHead as="h1" heading="Selected work." label="2025 — present" id="work-head" />
      <p className="px-work-index-lede">
        Each case study is a problem in the client&apos;s words, an approach, what shipped, and
        honest scope on what was and wasn&apos;t included.
      </p>
      <ol className="px-work-index-list" role="list">
        {studies.map((post, i) => {
          const fm = post.frontmatter as CaseStudyFrontmatter;
          const isLast = i === studies.length - 1;
          return (
            <li key={post.slug} className={`px-work-index-item${isLast ? ' is-last' : ''}`}>
              <div className="px-work-index-item-head">
                <span className="px-work-index-index">{fm.index}</span>
                <div className="px-work-index-main">
                  <MatterRow
                    title={fm.title}
                    tag={fm.tag}
                    tagTone={tagTone(i)}
                    href={`/work/${post.slug}`}
                    titleAs="h2"
                  />
                  <p className="px-work-index-dek">{fm.dek}</p>
                  <div className="px-work-index-spec">
                    <RuledRow tag="Role">{fm.role}</RuledRow>
                    <RuledRow tag="Stack">{fm.stack.join(' · ')}</RuledRow>
                    <RuledRow tag="Evidence" last>
                      {fm.evidenceOf}
                    </RuledRow>
                  </div>
                  <div className="px-work-index-year">{fm.year}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
