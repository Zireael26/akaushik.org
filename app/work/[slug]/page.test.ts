import { Children, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import WorkDetail, { generateMetadata } from './page';

// Guards the per-page OpenGraph fix for the MDX-backed branch of
// generateMetadata (the CASE_STUDIES-card fallback branch fires only for a
// card slug with no MDX file, which the current corpus never exercises —
// every CARD_SLUGS entry has a matching content/case-studies/<slug>.mdx).
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

describe('work/[slug] generateMetadata', () => {
  it('emits an openGraph block scoped to the case study, not the homepage', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'neev' }),
    });

    expect(meta.openGraph?.url).toContain('neev');
    expect(meta.openGraph?.title).toBe('Neev · Case study');
    expect(meta.openGraph?.title).not.toBe(HOMEPAGE_TITLE);
    expect(meta.alternates?.canonical).toBe('/work/neev');
  });

  // Next replaces (never deep-merges) a nested openGraph/twitter object
  // wholesale once the page defines one — so siteName/type/card/creator
  // must be re-declared here or they silently vanish from the merged head,
  // even though the layout still sets them sitewide.
  it('re-declares the fields Next would otherwise drop on merge', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'neev' }),
    });

    expect(meta.openGraph?.siteName).toBe('akaushik.org');
    // `type`/`card` aren't on the input `Metadata['openGraph'/'twitter']`
    // shape TS exposes here (they're narrowed on the *resolved* union);
    // read them structurally the same way Next serializes them.
    expect((meta.openGraph as { type?: string } | null)?.type).toBe('website');
    expect((meta.twitter as { card?: string } | null)?.card).toBe('summary_large_image');
    expect(meta.twitter?.creator).toBe('@abhi2601k');
  });

  it('matches the twitter title to the case study title', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'neev' }),
    });

    expect(meta.twitter?.title).toBe('Neev · Case study');
  });

  it('emits page-specific BreadcrumbList JSON-LD', async () => {
    const page = await WorkDetail({ params: Promise.resolve({ slug: 'neev' }) });
    const json = findJsonLd(page, 'ld-json-breadcrumb-work-neev');

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
        name: 'Work',
        item: 'https://akaushik.org/work',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Neev',
        item: 'https://akaushik.org/work/neev',
      },
    ]);
  });
});
