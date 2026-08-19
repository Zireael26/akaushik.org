import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';

// Guards the lastModified fix: per-post entries must reflect the post's own
// date, not the build-time `now` every entry used to share (which meant the
// sitemap never signalled real change dates to crawlers).
describe('sitemap', () => {
  const entries = sitemap();

  it('uses the writing post frontmatter date for its lastModified, not build time', () => {
    const entry = entries.find((e) => e.url === 'https://akaushik.org/writing/ai-for-msme');
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toEqual(new Date('2026-03-20'));
  });

  it('derives a case-study lastModified from the year frontmatter, not build time', () => {
    const entry = entries.find((e) => e.url === 'https://akaushik.org/work/neev');
    expect(entry).toBeDefined();
    // neev's year frontmatter is "2026 — now" — confirm the trailing text
    // doesn't produce an Invalid Date, and that it's anchored to Jan 1 of
    // that year rather than falling back to the (non-January) build time.
    expect(entry?.lastModified).toEqual(new Date('2026-01-01'));
  });

  it('keeps static entries on the build-time now', () => {
    const home = entries.find((e) => e.url === 'https://akaushik.org/');
    expect(home?.lastModified).toBeInstanceOf(Date);
  });

  it('publishes GPTx and omits the unlisted direct-link post', () => {
    expect(entries.some((e) => e.url === 'https://akaushik.org/writing/gptx-in-trellis')).toBe(
      true,
    );
    expect(
      entries.some((e) => e.url === 'https://akaushik.org/writing/detection-is-not-continuity'),
    ).toBe(false);
  });
});
