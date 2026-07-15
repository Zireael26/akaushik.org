import { Children, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import WritingPost, { generateMetadata } from './page';

// Guards the per-page OpenGraph fix: under Next's shallow metadata merge,
// omitting `openGraph` here means every writing post inherited the homepage's
// og:title/og:url from app/layout.tsx verbatim, contradicting its own
// alternates.canonical.
const HOMEPAGE_TITLE = 'Abhishek Kaushik — AI systems for businesses that haven’t met AI yet';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-nonce': 'test-nonce' })),
}));

function findJsonLd(node: ReactNode, id: string): string | undefined {
  if (!isValidElement<{ children?: ReactNode; id?: string; json?: string }>(node)) return undefined;
  if (node.props.id === id) return node.props.json;

  for (const child of Children.toArray(node.props.children)) {
    const json = findJsonLd(child, id);
    if (json) return json;
  }

  return undefined;
}

describe('writing/[slug] generateMetadata', () => {
  it('emits an openGraph block scoped to the post, not the homepage', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'ai-for-msme' }),
    });

    expect(meta.openGraph?.url).toContain('ai-for-msme');
    expect(meta.openGraph?.title).toBe('Notes on bringing AI to an MSME');
    expect(meta.openGraph?.title).not.toBe(HOMEPAGE_TITLE);
    expect(meta.alternates?.canonical).toBe('/writing/ai-for-msme');
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

  it('emits page-specific BreadcrumbList JSON-LD', async () => {
    const page = await WritingPost({ params: Promise.resolve({ slug: 'ai-for-msme' }) });
    const json = findJsonLd(page, 'ld-json-breadcrumb-writing-ai-for-msme');

    expect(json).toBeDefined();
    const breadcrumbs = JSON.parse(json ?? '{}') as Record<string, unknown>;
    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
    expect(breadcrumbs['itemListElement']).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://akaushik.org/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Writing',
        item: 'https://akaushik.org/writing',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Notes on bringing AI to an MSME',
        item: 'https://akaushik.org/writing/ai-for-msme',
      },
    ]);
  });
});
