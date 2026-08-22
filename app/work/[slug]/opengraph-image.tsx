import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getAllPosts, getPost, isDraftHidden } from '@/lib/content';
import { PALETTE, canvasBg, inkAlpha } from '@/lib/pixel';

// Node runtime so generateStaticParams works (edge runtime forbids pre-
// rendering params). Not edge-latency-critical — OG images are cached
// once per deploy.
export const runtime = 'nodejs';
export const alt = 'Case study — akaushik.org';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;

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
          justifyContent: 'space-between',
          padding: '72px',
          background: canvasBg(false),
          color: inkAlpha(1, false),
          fontFamily: 'General Sans, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 22,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            color: inkAlpha(0.45, false),
          }}
        >
          <span>akaushik.org / work</span>
          <span>{fm.year}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', color: PALETTE.cobalt }}>
            {`${fm.index} · ${fm.tag}`}
          </div>
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.05,
              marginTop: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              fontFamily: 'Cabinet Grotesk, system-ui, sans-serif',
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 20,
            fontFamily: 'JetBrains Mono, monospace',
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
