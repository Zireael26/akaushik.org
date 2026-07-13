import { describe, expect, it } from 'vitest';
import { generateMetadata } from './page';

// Guards the per-page OpenGraph fix: under Next's shallow metadata merge,
// omitting `openGraph` here means every writing post inherited the homepage's
// og:title/og:url from app/layout.tsx verbatim, contradicting its own
// alternates.canonical.
const HOMEPAGE_TITLE = 'Abhishek Kaushik — AI systems for businesses that haven’t met AI yet';

describe('writing/[slug] generateMetadata', () => {
  it('emits an openGraph block scoped to the post, not the homepage', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'ai-for-msme' }),
    });

    expect(meta.openGraph?.url).toContain('ai-for-msme');
    expect(meta.openGraph?.title).toBe('Notes on bringing AI to an MSME');
    expect(meta.openGraph?.title).not.toBe(HOMEPAGE_TITLE);
  });

  // Next replaces (never deep-merges) a nested openGraph/twitter object
  // wholesale once the page defines one — so siteName/type/card/creator
  // must be re-declared here or they silently vanish from the merged head,
  // even though the layout still sets them sitewide.
  it('re-declares the fields Next would otherwise drop on merge', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'ai-for-msme' }),
    });

    expect(meta.openGraph?.siteName).toBe('akaushik.org');
    // `type`/`card` aren't on the input `Metadata['openGraph'/'twitter']`
    // shape TS exposes here (they're narrowed on the *resolved* union);
    // read them structurally the same way Next serializes them.
    expect((meta.openGraph as { type?: string } | null)?.type).toBe('website');
    expect((meta.twitter as { card?: string } | null)?.card).toBe('summary_large_image');
    expect(meta.twitter?.creator).toBe('@abhi2601k');
  });

  it('matches the twitter title to the post title', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'ai-for-msme' }),
    });

    expect(meta.twitter?.title).toBe('Notes on bringing AI to an MSME');
  });
});
