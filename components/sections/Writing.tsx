import Link from 'next/link';
import { SectionHead } from '@/components/pixel/SectionHead';
import { getAllPostsWithReadingTime } from '@/lib/content';
import { formatMonthYear } from '@/lib/dates';

/**
 * Writing — the home teaser for /writing.
 *
 * The row is gaurijha.com's writing-index row (public-site-v1,
 * src/pages/writing/index.astro): mono date column, then title over a one-line
 * dek, then a coloured mono tag rotating cobalt -> amber -> red.
 *
 * One departure. The prototype's tag is the post's topic, and our writing
 * frontmatter has no topic field. Rather than invent a taxonomy, the tag
 * carries the reading time, which lib/content already derives from the body.
 * Same shape, a fact we actually hold.
 *
 * Posts come from getAllPostsWithReadingTime, which drops drafts and unlisted
 * pieces, so nothing here links at something the index won't show.
 */

/** Tags rotate cobalt -> amber -> red, per design.md § Blog / SEO. */
const TAG_TONES = ['cobalt', 'amber', 'red'] as const;

/** The teaser count the section shipped with. The rest live at /writing. */
const TEASER_COUNT = 3;

export default function Writing() {
  const posts = getAllPostsWithReadingTime('writing')
    .slice()
    .sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1))
    .slice(0, TEASER_COUNT);

  return (
    <section className="px-section px-writing" id="writing" data-screen-label="04 Writing">
      <SectionHead
        heading="First-principles notes on agent systems and AI for traditional businesses."
        label="Writing"
        headingTarget
      />

      <div className="px-writing-rows">
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
      </div>

      <Link className="px-writing-more" href="/writing" data-cursor-target="1">
        All writing
        <span className="px-writing-more-arrow" aria-hidden="true">
          &rarr;
        </span>
      </Link>
    </section>
  );
}
