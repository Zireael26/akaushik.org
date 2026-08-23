import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Reel } from './reels';

describe('Reel', () => {
  it('renders only the SVG floor when a case study has no motion assets', () => {
    const html = renderToStaticMarkup(<Reel slug="clusterbid" />);

    expect(html).toContain('<svg');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('/video/work/clusterbid');
  });
});
