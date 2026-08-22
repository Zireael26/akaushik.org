import { PALETTE } from '@/lib/pixel';

/**
 * 16×16 pixel favicon — the hero's shell-prompt exhibit reduced to the cell
 * grid. lib/pixel/sources.ts draws the prompt as a chevron and a block caret;
 * this route re-rasterises that exact geometry into 16 cells (8× supersampled,
 * threshold 0.5, one rect per cell) so the tab mark is byte-identical on every
 * load. The hero frame pads its exhibits generously; at 16px that padding
 * swallows the mark, so the geometry is scaled 1.5× and centred before
 * supersampling. Chevron is PALETTE.cobalt, caret PALETTE.amber — both read on
 * light and dark chrome, and both mirror the hero field's streak palette
 * (lib/pixel/field.ts). No theme: a favicon cannot follow html[data-mode].
 *
 * A plain Response instead of next/og's ImageResponse: at 16×16 the satori
 * rasteriser is the wrong tool and nothing here needs the OpenGraph path.
 * Next emits the <link rel="icon"> from the size and contentType exports and
 * serves this route's response as the icon.
 */
export const size = { width: 16, height: 16 };
export const contentType = 'image/svg+xml';

export default function Icon(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
<rect x="1" y="3" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="1" y="4" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="2" y="4" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="3" y="4" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="3" y="5" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="4" y="5" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="4" y="6" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="5" y="6" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="5" y="7" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="6" y="7" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="7" y="7" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="5" y="8" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="6" y="8" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="7" y="8" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="4" y="9" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="5" y="9" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="3" y="10" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="4" y="10" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="1" y="11" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="2" y="11" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="3" y="11" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="1" y="12" width="1" height="1" fill="${PALETTE.cobalt}"/>
<rect x="10" y="5" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="11" y="5" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="12" y="5" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="13" y="5" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="14" y="5" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="10" y="6" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="11" y="6" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="12" y="6" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="13" y="6" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="14" y="6" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="10" y="7" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="11" y="7" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="12" y="7" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="13" y="7" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="14" y="7" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="10" y="8" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="11" y="8" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="12" y="8" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="13" y="8" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="14" y="8" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="10" y="9" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="11" y="9" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="12" y="9" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="13" y="9" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="14" y="9" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="10" y="10" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="11" y="10" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="12" y="10" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="13" y="10" width="1" height="1" fill="${PALETTE.amber}"/>
<rect x="14" y="10" width="1" height="1" fill="${PALETTE.amber}"/>
</svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}
