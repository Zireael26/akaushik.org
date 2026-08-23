// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { getAllPosts } from '@/lib/content';

/**
 * The feed's failure modes are all-or-nothing, which is why these assertions
 * are heavier than the route's size suggests.
 *
 * A single unescaped `&` in an authored title makes the document not
 * well-formed, and a reader rejects the entire feed rather than the one bad
 * entry — so every post disappears because one had an ampersand. Likewise an
 * `Invalid Date` from a malformed frontmatter date, or a duplicate `id`.
 * None of those surface as an error anywhere in this codebase; they surface as
 * a subscriber quietly receiving nothing.
 *
 * jsdom is here for `DOMParser`, so well-formedness is checked by an actual XML
 * parser rather than by a regex that would agree with whatever the code emits.
 */
function parse(body: string): Document {
  return new DOMParser().parseFromString(body, 'application/xml');
}

async function feed(): Promise<{ body: string; response: Response }> {
  const response = GET();
  return { body: await response.text(), response };
}

describe('GET /feed.xml', () => {
  it('serves the Atom MIME type, not XML or plain text', async () => {
    const { response } = await feed();
    expect(response.headers.get('Content-Type')).toBe('application/atom+xml; charset=utf-8');
  });

  it('is well-formed XML', async () => {
    const { body } = await feed();
    const doc = parse(body);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.nodeName).toBe('feed');
  });

  it('carries one entry per published writing post', async () => {
    const { body } = await feed();
    const entries = parse(body).querySelectorAll('entry');
    expect(entries.length).toBe(getAllPosts('writing').length);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('gives every entry the fields Atom requires', async () => {
    const doc = parse((await feed()).body);
    for (const entry of Array.from(doc.querySelectorAll('entry'))) {
      for (const field of ['title', 'id', 'updated', 'link']) {
        expect(entry.querySelector(field), `entry missing <${field}>`).not.toBeNull();
      }
      expect(entry.querySelector('title')!.textContent!.trim()).not.toBe('');
    }
  });

  it('never emits an Invalid Date', async () => {
    const { body } = await feed();
    expect(body).not.toContain('Invalid Date');
    for (const el of Array.from(parse(body).querySelectorAll('updated, published'))) {
      expect(Number.isNaN(new Date(el.textContent!).getTime())).toBe(false);
    }
  });

  it('gives every entry a distinct, absolute id', async () => {
    const doc = parse((await feed()).body);
    const ids = Array.from(doc.querySelectorAll('entry > id')).map((n) => n.textContent!);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('https://akaushik.org/writing/')).toBe(true);
  });

  it('orders entries newest first', async () => {
    const doc = parse((await feed()).body);
    const dates = Array.from(doc.querySelectorAll('entry > published')).map(
      (n) => new Date(n.textContent!).getTime(),
    );
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  /**
   * The feed's own `updated` must track content, not the clock. A feed that
   * restamps itself every request tells every reader it has new content on
   * every poll, which is how a feed earns a rate limit.
   */
  it('stamps the feed from its newest entry, not from now', async () => {
    const doc = parse((await feed()).body);
    const feedUpdated = doc.querySelector('feed > updated')!.textContent!;
    const newestEntry = doc.querySelector('entry > published')!.textContent!;
    expect(feedUpdated).toBe(newestEntry);
  });

  it('excludes drafts and unlisted posts', async () => {
    const { body } = await feed();
    // `detection-is-not-continuity` is `unlisted: true`; `_test-draft` is a
    // draft. Both are reachable by URL and neither is announced.
    expect(body).not.toContain('/writing/detection-is-not-continuity');
    expect(body).not.toContain('/writing/_test-draft');
  });

  /**
   * A regression guard over the real corpus: no entry may contain a raw `&`.
   * On its own this proves nothing — no title happens to contain one today, so
   * it passes with the escaper deleted. Verified by mutation, which is why the
   * adversarial suite below exists.
   */
  it('emits no raw ampersand for the current corpus', async () => {
    const { body } = await feed();
    const inner = body.slice(body.indexOf('<entry>'));
    expect(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(inner)).toBe(false);
  });

  it('advertises itself with rel="self" so a reader can re-find it', async () => {
    const doc = parse((await feed()).body);
    const self = doc.querySelector('feed > link[rel="self"]');
    expect(self?.getAttribute('href')).toBe('https://akaushik.org/feed.xml');
  });
});

/**
 * Escaping, against content chosen to break it.
 *
 * The corpus-wide check above passes with the escaper removed, because no post
 * is currently titled with an ampersand. That makes it a guard against future
 * content and not a test of the code — so the code is tested here, against a
 * title and dek containing every character XML reserves. One unescaped `&` in
 * one entry makes the whole document not well-formed and every reader drops
 * every post, so this is the highest-consequence line in the route.
 */
describe('GET /feed.xml — escaping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('escapes reserved characters in an authored title and dek', async () => {
    vi.doMock('@/lib/content', () => ({
      getAllPosts: () => [
        {
          slug: 'hostile',
          frontmatter: {
            title: 'Tools & Toys <script> "quoted" \'apostrophe\'',
            dek: 'Ampersands & angle <brackets> in the summary, too',
            date: '2026-01-01',
          },
        },
      ],
    }));

    const { GET: mockedGET } = await import('./route');
    const body = await mockedGET().text();

    const doc = new DOMParser().parseFromString(body, 'application/xml');
    expect(doc.querySelector('parsererror'), 'hostile content must stay well-formed').toBeNull();

    // Round-trips through the parser back to the original string.
    expect(doc.querySelector('entry > title')!.textContent).toBe(
      'Tools & Toys <script> "quoted" \'apostrophe\'',
    );
    expect(doc.querySelector('entry > summary')!.textContent).toBe(
      'Ampersands & angle <brackets> in the summary, too',
    );

    // And the raw bytes really are escaped, not merely parseable.
    expect(body).toContain('Tools &amp; Toys &lt;script&gt;');
  });

  it('drops a post whose date cannot be parsed rather than emitting Invalid Date', async () => {
    vi.doMock('@/lib/content', () => ({
      getAllPosts: () => [
        { slug: 'bad-date', frontmatter: { title: 'T', dek: 'D', date: 'not-a-date' } },
        { slug: 'good-date', frontmatter: { title: 'T2', dek: 'D2', date: '2026-01-01' } },
      ],
    }));

    const { GET: mockedGET } = await import('./route');
    const body = await mockedGET().text();

    expect(body).not.toContain('Invalid Date');
    expect(body).not.toContain('/writing/bad-date');
    expect(body).toContain('/writing/good-date');
  });
});
