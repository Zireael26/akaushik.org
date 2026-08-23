import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { PALETTE, canvasBg, h, inkAlpha } from '@/lib/pixel';

// Home-page OG image, in the pixel language: a hash-driven pixel band, label
// chrome, palette accents. No font bytes are embedded: every face this site
// ships is woff2, and the satori build Next bundles accepts only TTF/OTF, so
// ImageResponse renders with its built-in default font — documented as Noto
// Sans Latin Regular in @vercel/og's types — not any site face. The card
// therefore stays far under the 500 KB bundle ceiling. Node runtime matches
// the dynamic OG routes and avoids the Next edge/static-generation warning
// during builds.

export const runtime = 'nodejs';
export const alt = 'Abhishek Kaushik — AI systems for businesses that haven\'t met AI yet';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
/** Card padding on every side; the band spans the content gutters, not the full canvas. */
const PAD = 64;
const BAND_WIDTH = size.width - PAD * 2;

/**
 * A deterministic pixel band: sparse palette cells, one per grid square with
 * the site's 1px gutter. Placement comes from the shared h(x, y) hash, so the
 * art is identical on every load — never Math.random. Satori renders the
 * inline SVG directly; no canvas is involved.
 */
function PixelBand({
  width = BAND_WIDTH,
  height = 56,
  cell = 8,
  density = 0.2,
}: {
  width?: number;
  height?: number;
  cell?: number;
  density?: number;
}) {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const tones = [PALETTE.cobalt, PALETTE.amber, PALETTE.red, PALETTE.lime, PALETTE.navy];
  const rects: ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (h(x * 13 + 7, y * 29 + 3) < density) {
        const tone =
          tones[Math.floor(h(x * 5 + 7, y * 11 + 3) * tones.length) % tones.length];
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * cell}
            y={y * cell}
            width={cell - 1}
            height={cell - 1}
            fill={tone}
          />,
        );
      }
    }
  }
  return (
    <svg width={width} height={height} style={{ display: 'flex', flexShrink: 0 }}>
      {rects}
    </svg>
  );
}

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px',
          background: canvasBg(false),
          color: inkAlpha(1, false),
          fontFamily: 'General Sans, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 20,
            fontFamily: 'JetBrains Mono',
            color: inkAlpha(0.45, false),
          }}
        >
          <span>akaushik.org</span>
          <span>AI engineer · New Delhi</span>
        </div>

        <div style={{ marginTop: 20, display: 'flex' }}>
          <PixelBand />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32 }}>
          <div
            style={{
              fontSize: 22,
              fontFamily: 'JetBrains Mono',
              color: PALETTE.cobalt,
              letterSpacing: '0.1em',
            }}
          >
            AGENT SYSTEMS · RETRIEVAL · OPERATIONAL AI
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 76,
              lineHeight: 1.05,
              marginTop: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              fontFamily: 'Cabinet Grotesk, sans-serif',
            }}
          >
            <div>AI systems for</div>
            <div>businesses that</div>
            <div style={{ display: 'flex' }}>
              <span style={{ color: PALETTE.cobalt }}>haven&apos;t</span>
              <span>&nbsp;met AI yet.</span>
            </div>
          </div>
        </div>

        <div style={{ flexGrow: 1 }} />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 20,
            fontFamily: 'JetBrains Mono',
            color: inkAlpha(0.45, false),
            borderTop: `1px solid ${inkAlpha(0.13, false)}`,
            paddingTop: 24,
          }}
        >
          <span>Neev · VeriCite · Bluehost · curat.money · ClusterBid</span>
          <span style={{ color: PALETTE.cobalt }}>hello@akaushik.org</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
