import { describe, expect, it } from 'vitest';
import { ABOUT_COPY } from './about-copy';

// Only the [text](url) subset renderInline() in components/sections/About.tsx
// supports — no nesting, so a citation cannot hide inside **bold**.
const MARKDOWN_LINK = /\[[^\]]+\]\([^)]+\)/;
const OFF_SITE_LINK = /\[[^\]]+\]\(https?:\/\/(?!akaushik\.org)[^)]+\)/;

function paragraphContaining(needle: string): string {
  const paragraph = ABOUT_COPY.paragraphs.find((p) => p.includes(needle));
  if (!paragraph) throw new Error(`no About paragraph contains "${needle}"`);
  return paragraph;
}

describe('ABOUT_COPY citations', () => {
  // The 63 million figure is the site's most consequential factual claim.
  // Its paragraph already carries an internal Neev link, so assert on an
  // off-site link specifically — an internal one must not satisfy this.
  it('attributes the 63 million figure to a named organization, off-site and dated', () => {
    const paragraph = paragraphContaining('63 million');

    expect(paragraph).toMatch(OFF_SITE_LINK);
    expect(paragraph).toContain('National Sample Survey Office');
    expect(paragraph).toMatch(/\b(?:19|20)\d{2}\b/);
  });

  it('links the Zero to Hero course and names its author inline', () => {
    const paragraph = paragraphContaining('Zero to Hero');

    expect(paragraph).toMatch(MARKDOWN_LINK);
    expect(paragraph).toContain('Andrej Karpathy');
  });
});
