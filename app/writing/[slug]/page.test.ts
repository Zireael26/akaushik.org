import { Children, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import WritingPost, { generateMetadata, generateStaticParams, nextReads } from './page';

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

function collectJsonLd(node: ReactNode): Array<{ id: string; json: string }> {
  const found: Array<{ id: string; json: string }> = [];

  function visit(current: ReactNode) {
    if (!isValidElement<{ children?: ReactNode; id?: string; json?: string }>(current)) return;
    if (current.props.id && current.props.json) {
      found.push({ id: current.props.id, json: current.props.json });
    }
    for (const child of Children.toArray(current.props.children)) visit(child);
  }

  visit(node);
  return found;
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

  it('marks an unlisted direct-link post noindex and nofollow', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'detection-is-not-continuity' }),
    });

    expect(meta.robots).toEqual({ index: false, follow: false });
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

describe('writing/[slug] read next', () => {
  it('locates an unlisted current article without recommending an unlisted post', () => {
    const expected = ['trellis-loop-era', 'trellis-1-0-rc'];

    expect(nextReads('detection-is-not-continuity').map((post) => post.slug)).toEqual(expected);
    expect(nextReads('gptx-in-trellis').map((post) => post.slug)).toEqual(expected);
    expect(nextReads('gptx-in-trellis').map((post) => post.slug)).not.toContain(
      'detection-is-not-continuity',
    );
  });
});

describe('writing/[slug] article structured data', () => {
  it('merges Article and FAQPage into one graph with stable ids', async () => {
    const page = await WritingPost({ params: Promise.resolve({ slug: 'ai-for-msme' }) });
    const scripts = collectJsonLd(page);
    const faqScripts = scripts.filter(({ json }) => {
      const value = JSON.parse(json) as {
        '@type'?: string;
        '@graph'?: Array<{ '@type'?: string }>;
      };
      return (
        value['@type'] === 'FAQPage' ||
        value['@graph']?.some((node) => node['@type'] === 'FAQPage') === true
      );
    });

    expect(faqScripts).toHaveLength(1);
    expect(faqScripts[0]?.id).toBe('ld-json-article-ai-for-msme');

    const merged = JSON.parse(faqScripts[0]?.json ?? '{}') as {
      '@context'?: string;
      '@graph'?: Array<{
        '@type'?: string;
        '@id'?: string;
        mainEntity?: Array<{ '@id'?: string }>;
      }>;
    };
    expect(merged['@context']).toBe('https://schema.org');
    expect(merged['@graph']?.map((node) => node['@type'])).toEqual(['Article', 'FAQPage']);
    expect(merged['@graph']?.map((node) => node['@id'])).toEqual([
      'https://akaushik.org/writing/ai-for-msme#article',
      'https://akaushik.org/writing/ai-for-msme#faq',
    ]);
    expect(merged['@graph']?.[1]?.mainEntity?.map((node) => node['@id'])).toEqual([
      'https://akaushik.org/writing/ai-for-msme#faq-1',
      'https://akaushik.org/writing/ai-for-msme#faq-2',
      'https://akaushik.org/writing/ai-for-msme#faq-3',
    ]);
  });
});

describe('writing/[slug] static params', () => {
  // The unlisted post is hidden from the indexes, not from the web. Its `.md`
  // alternate and its OG card are both generated with `includeUnlisted: true`,
  // so leaving it out here made the HTML page the one member of that triple
  // that fell through to a per-request render.
  it('prerenders the unlisted post alongside the listed ones', () => {
    const slugs = generateStaticParams().map((p) => p.slug);
    expect(slugs).toContain('detection-is-not-continuity');
  });
});
