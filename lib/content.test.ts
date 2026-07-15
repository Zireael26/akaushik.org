import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getPost,
  getPostSlugs,
  getAllPosts,
  getAllPostsWithReadingTime,
  isDraftHidden,
} from './content';

const DRAFT_FIXTURE_SLUG = '_test-draft';
const PUBLISHED_CASE_STUDY_SLUGS = [
  'neev',
  'vericite',
  'bluehost-agents',
  'curat-money',
  'clusterbid',
] as const;

// These tests exercise the real `content/` directory rather than mocking the
// filesystem — the parser's job is to handle the real frontmatter shapes the
// project ships, and pinning the assertions to the real corpus catches drift
// (a new mandatory frontmatter field, a malformed file) at unit-test time.

describe('content — getPostSlugs', () => {
  it('returns case-study slugs in sorted order', () => {
    const slugs = getPostSlugs('case-studies');
    expect(slugs.length).toBeGreaterThanOrEqual(4);
    expect(slugs).toEqual([...slugs].sort());
  });

  it('returns writing slugs in sorted order', () => {
    const slugs = getPostSlugs('writing');
    expect(slugs.length).toBeGreaterThanOrEqual(3);
    expect(slugs).toEqual([...slugs].sort());
  });

  it('strips the .mdx extension', () => {
    const slugs = getPostSlugs('writing');
    for (const s of slugs) {
      expect(s).not.toMatch(/\.mdx$/);
    }
  });
});

describe('content — getPost', () => {
  it('returns null for an unknown slug', () => {
    expect(getPost('case-studies', 'does-not-exist')).toBeNull();
    expect(getPost('writing', 'no-such-post')).toBeNull();
  });

  it('parses the four required case-study frontmatter fields', () => {
    const post = getPost('case-studies', 'neev');
    expect(post).not.toBeNull();
    if (!post) return;
    expect(post.slug).toBe('neev');
    expect(post.frontmatter.title).toBeTruthy();
    expect(post.frontmatter.dek).toBeTruthy();
    expect(post.frontmatter.index).toBeTruthy();
    expect(post.frontmatter.tag).toBeTruthy();
    expect(post.frontmatter.year).toBeTruthy();
    expect(post.frontmatter.role).toBeTruthy();
    expect(post.frontmatter.evidenceOf).toBeTruthy();
  });

  it('parses inline-array stack values', () => {
    const post = getPost('case-studies', 'neev');
    if (!post) throw new Error('expected neev case study');
    expect(Array.isArray(post.frontmatter.stack)).toBe(true);
    expect(post.frontmatter.stack.length).toBeGreaterThan(0);
  });

  it('publishes ClusterBid with bounded copy and no authoring placeholders', () => {
    const post = getPost('case-studies', 'clusterbid');
    if (!post) throw new Error('expected clusterbid case study');

    expect(post.frontmatter.draft).toBe(false);
    expect(post.frontmatter.role).toBe('Engineering advisor · process & platform');
    expect(post.content).toContain('UAT');
    expect(post.content).toContain('pre-production');
    expect(`${JSON.stringify(post.frontmatter)}\n${post.content}`).not.toMatch(
      /placeholder|Abhishek to confirm|TODO\(clusterbid\)/i,
    );
  });

  it('keeps commas inside quoted inline-array values', async () => {
    const root = mkdtempSync(join(tmpdir(), 'akaushik-content-'));
    const caseStudies = join(root, 'content', 'case-studies');
    mkdirSync(caseStudies, { recursive: true });
    writeFileSync(join(caseStudies, 'inline-array.mdx'), '---\nstack: ["a, b", c]\n---\nBody\n');

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.resetModules();
    try {
      const { getPost: getIsolatedPost } = await import('./content');
      const post = getIsolatedPost('case-studies', 'inline-array');
      expect(post?.frontmatter.stack).toEqual(['a, b', 'c']);
    } finally {
      cwdSpy.mockRestore();
      vi.resetModules();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('parses writing frontmatter', () => {
    const post = getPost('writing', 'micrograd-makemore');
    expect(post).not.toBeNull();
    if (!post) return;
    expect(post.frontmatter.title).toBeTruthy();
    expect(post.frontmatter.dek).toBeTruthy();
    expect(post.frontmatter.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('separates frontmatter from the body content', () => {
    const post = getPost('writing', 'micrograd-makemore');
    if (!post) throw new Error('expected micrograd post');
    expect(post.content).not.toContain('---\ntitle:');
    expect(post.content.trim().length).toBeGreaterThan(0);
  });
});

describe('content — getPost slug sanitization', () => {
  it('rejects a traversal slug that escapes the content-type directory (../case-studies/clusterbid)', () => {
    // Regression check: prior to sanitization this slug resolved into the
    // case-studies directory and returned the clusterbid post.
    expect(getPost('writing', '../case-studies/clusterbid')).toBeNull();
  });

  it('rejects slugs containing a path separator', () => {
    expect(getPost('writing', 'foo/bar')).toBeNull();
    expect(getPost('case-studies', 'foo/bar')).toBeNull();
  });

  it('rejects slugs containing ".."', () => {
    expect(getPost('writing', '..')).toBeNull();
    expect(getPost('writing', '../../etc/passwd')).toBeNull();
  });

  it('still returns a real post for a valid slug', () => {
    // micrograd-makemore is confirmed present in content/writing/ (also used
    // by the parsing tests above).
    expect(getPostSlugs('writing')).toContain('micrograd-makemore');
    const post = getPost('writing', 'micrograd-makemore');
    expect(post).not.toBeNull();
  });
});

describe('content — getAllPosts', () => {
  it('returns one entry per slug, frontmatter only', () => {
    const posts = getAllPosts('case-studies');
    expect(posts.length).toBeGreaterThanOrEqual(4);
    for (const p of posts) {
      expect(p).toHaveProperty('slug');
      expect(p).toHaveProperty('frontmatter');
      expect(p).not.toHaveProperty('content');
    }
  });

  it('matches getPostSlugs in length and order when drafts are included', () => {
    const posts = getAllPosts('writing', { includeDrafts: true });
    const slugs = getPostSlugs('writing');
    expect(posts.map((p) => p.slug)).toEqual(slugs);
  });

  it('returns exactly the five published case studies', () => {
    const slugs = getAllPosts('case-studies').map((post) => post.slug);
    expect(slugs.sort()).toEqual([...PUBLISHED_CASE_STUDY_SLUGS].sort());
  });
});

describe('content — drafts', () => {
  it('getAllPosts(writing) excludes draft posts by default', () => {
    const posts = getAllPosts('writing');
    expect(posts.some((p) => p.slug === DRAFT_FIXTURE_SLUG)).toBe(false);
  });

  it('getAllPosts(writing, { includeDrafts: true }) includes draft posts', () => {
    const posts = getAllPosts('writing', { includeDrafts: true });
    expect(posts.some((p) => p.slug === DRAFT_FIXTURE_SLUG)).toBe(true);
  });

  it('getAllPostsWithReadingTime(writing) excludes drafts by default', () => {
    const posts = getAllPostsWithReadingTime('writing');
    expect(posts.some((p) => p.slug === DRAFT_FIXTURE_SLUG)).toBe(false);
  });

  it('getAllPostsWithReadingTime(writing, { includeDrafts: true }) includes drafts', () => {
    const posts = getAllPostsWithReadingTime('writing', { includeDrafts: true });
    expect(posts.some((p) => p.slug === DRAFT_FIXTURE_SLUG)).toBe(true);
  });

  it('getPost returns drafts as-is (filtering happens at the listing layer)', () => {
    const post = getPost('writing', DRAFT_FIXTURE_SLUG);
    expect(post).not.toBeNull();
    if (!post) return;
    expect((post.frontmatter as { draft?: boolean }).draft).toBe(true);
  });

  it('parses bare `true` / `false` as JS booleans', () => {
    const post = getPost('writing', DRAFT_FIXTURE_SLUG);
    if (!post) throw new Error('expected draft fixture');
    expect((post.frontmatter as { draft?: unknown }).draft).toBe(true);
    expect(typeof (post.frontmatter as { draft?: unknown }).draft).toBe('boolean');
  });
});

describe('content — isDraftHidden', () => {
  // NODE_ENV is typed read-only (Next.js narrows it to a literal union), so
  // tests go through vi.stubEnv rather than direct assignment. unstubAllEnvs
  // in afterEach restores the original value for every other test file.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides drafts in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDraftHidden({ draft: true })).toBe(true);
  });

  it('does not hide published posts in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDraftHidden({ draft: false })).toBe(false);
    expect(isDraftHidden({})).toBe(false);
  });

  it('does not hide drafts outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDraftHidden({ draft: true })).toBe(false);
  });
});

describe('content — getAllPostsWithReadingTime', () => {
  it('adds a readingTime field shaped "N min read"', () => {
    const posts = getAllPostsWithReadingTime('writing');
    expect(posts.length).toBeGreaterThanOrEqual(3);
    for (const p of posts) {
      expect(p.readingTime).toMatch(/^\d+ min read$/);
    }
  });

  it('preserves explicit frontmatter readingTime when present (none of the current posts set it, so this asserts the fallback runs)', () => {
    const posts = getAllPostsWithReadingTime('writing');
    for (const p of posts) {
      expect(p.readingTime).toBeTruthy();
    }
  });
});
