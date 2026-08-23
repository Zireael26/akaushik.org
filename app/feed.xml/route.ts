/**
 * Atom feed for the writing section.
 *
 * Added after the AEO baseline flagged the absence: fourteen dated posts and
 * no way to subscribe to them. Feeds are also the one syndication format
 * aggregators and agent crawlers both still read reliably, which is why the
 * scanner asks for one alongside `sitemap.xml` rather than treating the
 * sitemap as sufficient — a sitemap says a URL exists, a feed says something
 * was published and when.
 *
 * Atom rather than RSS 2.0. It requires the fields that make a feed useful
 * (a stable `id` per entry, an explicit `updated`, a declared content type)
 * where RSS leaves them optional, and its dates are RFC 3339 — the same shape
 * the rest of this codebase already produces.
 *
 * Served as a Route Handler rather than a file in `public/` for the same
 * reason as `llms.txt`: the Content-Type has to be
 * `application/atom+xml; charset=utf-8`, and extension-based static serving
 * will not give that.
 */
import { CANONICAL_ORIGIN } from '@/lib/canonical';
import { getAllPosts } from '@/lib/content';

export const dynamic = 'force-static';
export const revalidate = 3600;

const FEED_PATH = '/feed.xml';
const AUTHOR = 'Abhishek Kaushik';
const TITLE = 'akaushik.org — writing';
const SUBTITLE =
  'First-principles notes on agent systems and AI for traditional businesses.';

/**
 * XML has five predefined entities and no others. Titles and deks here are
 * authored prose containing ampersands, quotes and angle brackets, so every
 * interpolated value goes through this — an unescaped `&` is not a rendering
 * quirk, it makes the document not well-formed and every reader rejects the
 * whole feed rather than the one entry.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * A `YYYY-MM-DD` frontmatter date as RFC 3339, which Atom requires.
 *
 * Anchored to midnight UTC rather than local midnight: `new Date('2026-03-20')`
 * is already parsed as UTC by spec, and constructing it any other way would
 * make the published date drift by a day for readers in negative offsets.
 * Returns null for a missing or unparseable date so the caller can decide,
 * rather than silently emitting an `Invalid Date` that breaks the document.
 */
function rfc3339(date: string | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function GET(): Response {
  // `getAllPosts` excludes drafts and unlisted posts by default, which is the
  // behaviour a public feed wants: `unlisted: true` means reachable by URL but
  // not announced, and a feed is an announcement.
  const posts = getAllPosts('writing')
    .map((post) => ({ ...post, published: rfc3339(post.frontmatter.date) }))
    .filter((post): post is typeof post & { published: string } => post.published !== null)
    .sort((a, b) => b.published.localeCompare(a.published));

  // The feed's own `updated` is the newest entry's date, not the current time.
  // A feed whose timestamp changes on every request tells every reader it has
  // new content on every poll, which is how a feed earns itself a rate limit.
  const updated = posts[0]?.published ?? new Date(0).toISOString();

  const entries = posts
    .map((post) => {
      const url = `${CANONICAL_ORIGIN}/writing/${post.slug}`;
      return [
        '  <entry>',
        `    <title>${xml(post.frontmatter.title)}</title>`,
        `    <link href="${url}" />`,
        // The canonical URL as the id. Atom ids must be permanent and unique;
        // a URL this site already guarantees is both, and it survives a title
        // being rewritten, which a title-derived id would not.
        `    <id>${url}</id>`,
        `    <updated>${post.published}</updated>`,
        `    <published>${post.published}</published>`,
        `    <summary type="text">${xml(post.frontmatter.dek)}</summary>`,
        '  </entry>',
      ].join('\n');
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xml(TITLE)}</title>
  <subtitle>${xml(SUBTITLE)}</subtitle>
  <link href="${CANONICAL_ORIGIN}${FEED_PATH}" rel="self" />
  <link href="${CANONICAL_ORIGIN}/writing" />
  <id>${CANONICAL_ORIGIN}/</id>
  <updated>${updated}</updated>
  <author>
    <name>${xml(AUTHOR)}</name>
    <uri>${CANONICAL_ORIGIN}</uri>
  </author>
${entries}
</feed>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
