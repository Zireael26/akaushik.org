import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REEL_SLUGS, Reel } from './reels';

/**
 * ADR-0020: a reel is the case study's own product source mounted as a
 * pixel field. These assert the shipping surface: field markup for every
 * slug, and none of the HyperFrames-era media anywhere in it.
 */
describe('Reel', () => {
  it('renders its pixel field for every slug at both variants', () => {
    for (const slug of REEL_SLUGS) {
      for (const variant of ['card', 'hero'] as const) {
        const html = renderToStaticMarkup(<Reel slug={slug} variant={variant} />);
        expect(html, `${slug}/${variant}`).toContain('px-reel-field');
        expect(html, `${slug}/${variant}`).toContain('aria-hidden="true"');
      }
    }
  });

  it('never emits video or a media URL', () => {
    for (const slug of REEL_SLUGS) {
      const html = renderToStaticMarkup(<Reel slug={slug} variant="hero" />);
      expect(html, slug).not.toContain('<video');
      expect(html, slug).not.toContain('<svg');
      expect(html, slug).not.toContain('/video/');
    }
  });
});
