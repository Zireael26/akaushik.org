import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPostsWithReadingTime } from '@/lib/content';
import { formatMonthYear } from '@/lib/dates';
import { canonical } from '@/lib/canonical';
import { PixelBand } from '@/components/pixel/PixelBand';
import { SectionHead } from '@/components/pixel/SectionHead';

const DESCRIPTION = 'First-principles notes on agent systems and AI for traditional businesses.';

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

/** Tags rotate cobalt -> amber -> red, per design.md § Blog / SEO. */
const TAG_TONES = ['cobalt', 'amber', 'red'] as const;

/**
 * Writing — the /writing index, in the pixel language.
 *
 * Head follows the reference index (public-site-v1, Writing.dc.html): a
 * statement heading with the mono "Writing" label under it, the intro in the
 * right column of a split-editorial, the pixel band beneath, then the ruled
 * rows. Rows reuse the home section's row classes (app/styles/sections/
 * writing.css) so the teaser and the index read as the same list.
 *
 * Posts come from getAllPostsWithReadingTime, which drops drafts and unlisted
 * pieces, so _test-draft.mdx can never appear here and the index links only
 * at posts the detail pages actually serve. Like the home section, the row
 * tag carries the reading time — the frontmatter has no topic field, and
 * inventing a taxonomy would violate the no-invented-facts rule.
 */
export default function WritingIndex() {
  const posts = getAllPostsWithReadingTime('writing')
    .slice()
    .sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1));

  return (
    <main id="top" className="writing-index">
      <div className="px-writing-index">
        <section className="px-split px-writing-index-head">
          <SectionHead
            as="h1"
            heading="First-principles notes on agent systems and AI for traditional businesses."
            headingMax={26}
            label="Writing"
            variant="column"
          />
          <div className="px-split-body">
            <p className="px-split-intro">
              Dated, first-person reports on the agent systems I run and build, with the receipts
              inline. New posts land here without a redesign.
            </p>
          </div>
        </section>

        <PixelBand />

        <section className="px-writing-index-rows" aria-label="All posts">
          {posts.map((post, i) => (
            <Link
              /* Whole class strings per branch, not `px-writing-row${' is-last'}`:
                 prettier-plugin-tailwindcss trims the leading space inside a class
                 template literal and silently welds the two names together. */
              className={i === posts.length - 1 ? 'px-writing-row is-last' : 'px-writing-row'}
              href={`/writing/${post.slug}`}
              key={post.slug}
            >
              <span className="px-writing-date">
                {formatMonthYear(post.frontmatter.date).toUpperCase()}
              </span>
              <span className="px-writing-main">
                <span className="px-writing-title">{post.frontmatter.title}</span>
                <span className="px-writing-dek">{post.frontmatter.dek}</span>
              </span>
              <span className={`px-writing-tag is-${TAG_TONES[i % TAG_TONES.length]}`}>
                {post.readingTime.toUpperCase()}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
