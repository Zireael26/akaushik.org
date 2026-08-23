import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * A private repository must never be rendered as a link.
 *
 * The fetch script runs with a `repo`-scoped token, so it reports real commit
 * counts for private work — which is the point of the section. But the GitHub
 * URL it builds from the same name is a 404 for every reader, and four of
 * these five repositories are private. A link-integrity sweep of the preview
 * deployment is how this was found; this test is how it stays found.
 */
vi.mock('@/lib/stats', () => ({
  getStats: () => ({
    generatedAt: '2026-08-13T05:50:08.537Z',
    username: 'Zireael26',
    window: 'last-365-days',
    includesPrivate: true,
    totalContributions: 12434,
    weeks: [1, 2, 3],
    repos: [
      { name: 'open', label: 'OpenOne', url: 'https://github.com/o/open', public: true, commits12mo: 10, lastCommit: '2026-08-12T02:28:30Z' },
      { name: 'closed', label: 'ClosedOne', url: 'https://github.com/o/closed', public: false, commits12mo: 20, lastCommit: '2026-08-12T02:28:30Z' },
      { name: 'legacy', label: 'LegacyOne', url: 'https://github.com/o/legacy', commits12mo: 30, lastCommit: '2026-08-12T02:28:30Z' },
    ],
  }),
}));

// ContributionField is a client component that mounts a canvas; it has nothing
// to do with what this file asserts, so it is stubbed rather than jsdom'd.
vi.mock('@/components/pixel/ContributionField', () => ({
  ContributionField: () => null,
}));

const { default: OpenSource } = await import('./OpenSource');

describe('OpenSource repository rows', () => {
  const html = renderToStaticMarkup(<OpenSource />);

  it('links a repository a reader can actually open', () => {
    expect(html).toContain('href="https://github.com/o/open"');
    expect(html).toContain('OpenOne');
  });

  it('names a private repository without linking it', () => {
    expect(html).toContain('ClosedOne');
    expect(html).not.toContain('https://github.com/o/closed');
  });

  it('treats a missing `public` flag as not linkable, not as public', () => {
    // stats.json predates the field. Absent has to fail closed, or every
    // repository recorded before today goes back to being a 404.
    expect(html).toContain('LegacyOne');
    expect(html).not.toContain('https://github.com/o/legacy');
  });

  it('still reports the commit counts for all of them', () => {
    expect(html).toContain('10 commits');
    expect(html).toContain('20 commits');
    expect(html).toContain('30 commits');
  });
});
