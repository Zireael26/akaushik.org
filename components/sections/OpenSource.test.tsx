import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * A private repository must never be rendered as a link.
 *
 * The stats pipeline runs with a `repo`-scoped token, so it reports real commit
 * counts for private work — which is the point of the section. But the GitHub
 * URL it builds from the same name is a 404 for every reader, and four of
 * these five repositories are private. A link-integrity sweep of the preview
 * deployment is how this was found; this test is how it stays found.
 *
 * The same file now pins the degraded-state contract: whatever `getStats`
 * returns must be labelled honestly. A stale or fallback total presented as if
 * it were measured today is the one thing this section must never do.
 */

const LIVE = {
  generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  username: 'Zireael26',
  window: 'last-365-days',
  includesPrivate: true,
  totalContributions: 13012,
  weeks: [1, 2, 3],
  repos: [
    {
      name: 'open',
      label: 'OpenOne',
      url: 'https://github.com/o/open',
      public: true,
      commits12mo: 10,
      lastCommit: '2026-08-12T02:28:30Z',
    },
    {
      name: 'closed',
      label: 'ClosedOne',
      url: 'https://github.com/o/closed',
      public: false,
      commits12mo: 20,
      lastCommit: '2026-08-12T02:28:30Z',
    },
    {
      name: 'legacy',
      label: 'LegacyOne',
      url: 'https://github.com/o/legacy',
      commits12mo: 30,
      lastCommit: '2026-08-12T02:28:30Z',
    },
  ],
};

const getStatsMock = vi.hoisted(() => ({ current: vi.fn() }));

vi.mock('@/lib/stats', () => ({
  getStats: () => getStatsMock.current(),
}));

// ContributionField is a client component that mounts a canvas; it has nothing
// to do with what this file asserts, so it is stubbed rather than jsdom'd.
vi.mock('@/components/pixel/ContributionField', () => ({
  ContributionField: () => null,
}));

const { default: OpenSource } = await import('./OpenSource');

function render(): string {
  return renderToStaticMarkup(<OpenSource />);
}

describe('OpenSource repository rows (live data)', () => {
  getStatsMock.current.mockReturnValue({
    stats: LIVE,
    degraded: false,
    reason: 'live',
  });
  const html = render();

  it('links a repository a reader can actually open', () => {
    expect(html).toContain('href="https://github.com/o/open"');
    expect(html).toContain('OpenOne');
  });

  it('names a private repository without linking it', () => {
    expect(html).toContain('ClosedOne');
    expect(html).not.toContain('https://github.com/o/closed');
  });

  it('treats a missing `public` flag as not linkable, not as public', () => {
    // The payload predating the field must fail closed, or every repository
    // recorded before today goes back to being a 404.
    expect(html).toContain('LegacyOne');
    expect(html).not.toContain('https://github.com/o/legacy');
  });

  it('still reports the commit counts for all of them', () => {
    expect(html).toContain('10 commits');
    expect(html).toContain('20 commits');
    expect(html).toContain('30 commits');
  });

  it('carries no degraded marking when the snapshot is live', () => {
    expect(html).not.toContain('px-open-degraded');
    expect(html).not.toContain('px-open-meta--degraded');
    expect(html).toContain('Refreshed');
    expect(html).not.toContain('Last good');
    expect(html).toContain('>In the open<');
  });
});

describe('OpenSource degraded states', () => {
  it('says the numbers are stale instead of quoting them as current', () => {
    const stale = {
      ...LIVE,
      generatedAt: '2026-08-13T05:50:08.537Z',
      totalContributions: 12434,
    };
    getStatsMock.current.mockReturnValue({ stats: stale, degraded: true, reason: 'stale' });
    const html = render();
    expect(html).toContain('px-open-degraded');
    expect(html).toContain('px-open-meta--degraded');
    expect(html).toContain('the daily refresh has been failing');
    expect(html).toContain('last measured');
    expect(html).toContain('Last good');
    // The heading may quote the old total, but only while saying so.
    expect(html).toContain('as of the last good snapshot');
  });

  it('says the numbers come from the checked-in fallback when KV has nothing', () => {
    getStatsMock.current.mockReturnValue({ stats: LIVE, degraded: true, reason: 'missing' });
    const html = render();
    expect(html).toContain('Live refresh not connected yet');
    expect(html).toContain('snapshot checked into this repo');
    // The age is folded into the sentence — one line, one claim.
    expect(html).toMatch(/last measured (today|yesterday|\d+ days ago)/);
  });

  it('never renders a degraded state without an age for the last good data', () => {
    const stale = { ...LIVE, generatedAt: '2026-08-13T05:50:08.537Z' };
    getStatsMock.current.mockReturnValue({ stats: stale, degraded: true, reason: 'stale' });
    const html = render();
    // "2 days ago" — the age of the fixture's generatedAt from Date.now().
    expect(html).toMatch(/Last good \d+ days? ago|Last good yesterday|Last good today/);
  });
});
