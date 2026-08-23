import { CONTENT_BUNDLE } from './content-bundle.generated';
import { asWritingArt, type WritingArt } from './pixel/topics';
import { getReadingTime } from './reading-time';

export type ContentType = 'case-studies' | 'writing';

export type CaseStudyFrontmatter = {
  title: string;
  dek: string;
  index: string;
  tag: string;
  year: string;
  role: string;
  stack: string[];
  evidenceOf: string;
  draft?: boolean;
};

export type WritingFrontmatter = {
  title: string;
  dek: string;
  date: string;
  readingTime?: string;
  draft?: boolean;
  unlisted?: boolean;
  /**
   * Topic art for the route strip, from the closed vocabulary in
   * `lib/pixel/topics.ts`. Optional: an absent value renders the trellis
   * fallback and the content-bundle build warns about it; an unknown value
   * is a typo and fails the content-bundle build.
   */
  art?: WritingArt;
};

export type FrontmatterFor<T extends ContentType> = T extends 'case-studies'
  ? CaseStudyFrontmatter
  : WritingFrontmatter;

export type Post<T extends ContentType> = {
  slug: string;
  frontmatter: FrontmatterFor<T>;
  content: string;
};

/**
 * Content comes from a generated module, not from disk.
 *
 * This used to `readFileSync` out of `content/` at request time, which is fine
 * on a Node server and impossible on Cloudflare Workers — `node:fs` there is an
 * empty per-request scratch space, so every content page 404'd. The pages
 * cannot be prerendered around the problem either: `app/layout.tsx` reads
 * `headers()` for the CSP nonce (ADR-0014), which makes the whole route tree
 * dynamic. `scripts/build-content-bundle.ts` inlines the MDX instead, and runs
 * in `prebuild`.
 *
 * The path-traversal guard that used to live in `getPost` is gone with the
 * filesystem: a key either is in the bundle or is not, and `..` is not a key.
 */
function bundleKey(type: ContentType, slug: string): string {
  return `${type}/${slug}`;
}

// Minimal YAML-front-matter parser. Supports the scalar + array shapes our
// case-study / writing frontmatter actually uses. Intentionally small — pulling
// gray-matter or js-yaml for this would ship bytes we don't need.
//
//   ---
//   title: Neev
//   stack: [Next.js, Postgres, multi-tenant monolith]
//   ---
//
// Strings may be quoted or bare. Arrays may be inline `[a, b]` or YAML-list
// ("- item" per line). Anything more complex gets a clear error.
function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const fenced = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!fenced) return { data: {}, content: raw };

  const yaml = fenced[1] ?? '';
  const body = fenced[2] ?? '';
  const data: Record<string, unknown> = {};

  const lines = yaml.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim() || line.trim().startsWith('#')) {
      i += 1;
      continue;
    }
    const scalar = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!scalar) {
      throw new Error(`lib/content: frontmatter parse failure at line ${i + 1}: "${line}"`);
    }
    const key = scalar[1] as string;
    const value = (scalar[2] ?? '').trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner.length
        ? splitInlineArray(inner).map((s) => stripQuotes(s.trim()))
        : [];
      i += 1;
      continue;
    }
    if (value === '') {
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j] ?? '')) {
        items.push(stripQuotes((lines[j] ?? '').replace(/^\s+-\s+/, '').trim()));
        j += 1;
      }
      if (items.length) {
        data[key] = items;
        i = j;
        continue;
      }
      data[key] = '';
      i += 1;
      continue;
    }
    // Bare booleans get coerced; quoted "true"/"false" stay strings (stripQuotes
    // unwraps the quotes but the value never enters this branch in that case
    // because the equality check fires before stripQuotes).
    if (value === 'true') {
      data[key] = true;
      i += 1;
      continue;
    }
    if (value === 'false') {
      data[key] = false;
      i += 1;
      continue;
    }
    data[key] = stripQuotes(value);
    i += 1;
  }

  return { data, content: body };
}

function splitInlineArray(inner: string): string[] {
  const items: string[] = [];
  let start = 0;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (quote !== null) {
      if (char === quote && inner[i - 1] !== '\\') quote = null;
      continue;
    }
    if ((char === '"' || char === "'") && inner.slice(start, i).trim() === '') {
      quote = char;
      continue;
    }
    if (char === ',') {
      items.push(inner.slice(start, i));
      start = i + 1;
    }
  }

  items.push(inner.slice(start));
  return items;
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

export function isDraftHidden(fm: { draft?: boolean }): boolean {
  return fm.draft === true && process.env.NODE_ENV === 'production';
}

export function getPostSlugs(type: ContentType): string[] {
  const prefix = `${type}/`;
  return Object.keys(CONTENT_BUNDLE)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .sort();
}

export function getPost<T extends ContentType>(
  type: T,
  slug: string,
): Post<T> | null {
  if (!/^[a-z0-9_-]+$/.test(slug)) return null;
  const raw = CONTENT_BUNDLE[bundleKey(type, slug)];
  if (raw === undefined) return null;
  const { data, content } = parseFrontmatter(raw);
  const frontmatter = data as FrontmatterFor<T>;
  if (type === 'writing') {
    // `art` is a closed vocabulary, not a free string: normalise it here so
    // every consumer sees WritingArt | undefined, never an arbitrary value.
    const fm = frontmatter as WritingFrontmatter;
    const art = asWritingArt(fm.art);
    if (art) {
      fm.art = art;
    } else {
      delete fm.art;
    }
  }
  return {
    slug,
    frontmatter,
    content,
  };
}

export function getAllPosts<T extends ContentType>(
  type: T,
  options?: { includeDrafts?: boolean; includeUnlisted?: boolean },
): Array<Omit<Post<T>, 'content'>> {
  const includeDrafts = options?.includeDrafts ?? false;
  const includeUnlisted = options?.includeUnlisted ?? false;
  return getPostSlugs(type)
    .map((slug) => {
      const post = getPost(type, slug);
      if (!post) return null;
      return { slug: post.slug, frontmatter: post.frontmatter };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .filter((p) => {
      const fm = p.frontmatter as { draft?: boolean; unlisted?: boolean };
      return (includeDrafts || fm.draft !== true) && (includeUnlisted || fm.unlisted !== true);
    });
}

// Index-with-reading-time variant for the home Writing list + writing index.
// Reads every body to derive reading time when frontmatter doesn't specify one,
// which is more expensive than getAllPosts — keep that around for callers that
// only need frontmatter (sitemap, /api/writing, llms.txt).
export function getAllPostsWithReadingTime<T extends ContentType>(
  type: T,
  options?: { includeDrafts?: boolean; includeUnlisted?: boolean },
): Array<Omit<Post<T>, 'content'> & { readingTime: string }> {
  const includeDrafts = options?.includeDrafts ?? false;
  const includeUnlisted = options?.includeUnlisted ?? false;
  return getPostSlugs(type)
    .map((slug) => {
      const post = getPost(type, slug);
      if (!post) return null;
      const fm = post.frontmatter as { readingTime?: string };
      const readingTime = fm.readingTime ?? getReadingTime(post.content);
      return { slug: post.slug, frontmatter: post.frontmatter, readingTime };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .filter((p) => {
      const fm = p.frontmatter as { draft?: boolean; unlisted?: boolean };
      return (includeDrafts || fm.draft !== true) && (includeUnlisted || fm.unlisted !== true);
    });
}
