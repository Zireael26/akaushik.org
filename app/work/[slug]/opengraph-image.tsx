import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAllPosts, getPost, isDraftHidden } from '@/lib/content';
import { PALETTE, canvasBg, h, inkAlpha } from '@/lib/pixel';

// Node runtime so generateStaticParams works (edge runtime forbids pre-
// rendering params). Not edge-latency-critical — OG images are cached
// once per deploy. No font bytes are embedded: every face this site ships
// is woff2, and the satori build Next bundles accepts only TTF/OTF, so
// ImageResponse renders with its built-in default font — documented as
// Noto Sans Latin Regular in @vercel/og's types — not any site face. The
// card stays far under the 500 KB bundle ceiling.
export const runtime = 'nodejs';
export const alt = 'Case study — akaushik.org';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;
/** Card padding on every side; the band spans the content gutters, not the full canvas. */
const PAD = 64;
const BAND_WIDTH = size.width - PAD * 2;

/** A stable small integer from a slug, so every article gets its own pixel band forever. */
function seedFromSlug(slug: string): number {
  let n = 0;
  for (let i = 0; i < slug.length; i++) n = (n * 31 + slug.charCodeAt(i)) | 0;
  return Math.abs(n) % 1000;
}

/**
 * A deterministic pixel band: sparse palette cells, one per grid square with
 * the site's 1px gutter. Placement comes from the shared h(x, y) hash seeded
 * off the slug, so the art is stable across every load — never Math.random.
 * Satori renders the inline SVG directly; no canvas is involved.
 */
function PixelBand({
  seed,
  width = BAND_WIDTH,
  height = 56,
  cell = 8,
  density = 0.2,
}: {
  seed: number;
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
      if (h(x * 13 + seed, y * 29 + seed * 3) < density) {
        const tone =
          tones[Math.floor(h(x * 5 + seed, y * 11 + seed * 2) * tones.length) % tones.length];
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

export function generateStaticParams() {
  return getAllPosts('case-studies').map((post) => ({ slug: post.slug }));
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost('case-studies', slug);
  if (!post) notFound();
  if (isDraftHidden(post.frontmatter)) notFound();
  const fm = post.frontmatter;

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
          <span>akaushik.org / work</span>
          <span>{fm.year}</span>
        </div>

        <div style={{ marginTop: 20, display: 'flex' }}>
          <PixelBand seed={seedFromSlug(slug)} />
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
            {`${fm.index} · ${fm.tag}`}
          </div>
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.05,
              marginTop: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              fontFamily: 'Cabinet Grotesk, sans-serif',
            }}
          >
            {fm.title}
          </div>
          <div
            style={{
              fontSize: 32,
              marginTop: 28,
              fontStyle: 'italic',
              color: inkAlpha(0.7, false),
              lineHeight: 1.35,
            }}
          >
            {fm.dek}
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
          <span>{fm.role}</span>
          <span style={{ color: PALETTE.cobalt }}>
            {Array.isArray(fm.stack) ? fm.stack.join(' · ') : ''}
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
