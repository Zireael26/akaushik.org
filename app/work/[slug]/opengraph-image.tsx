import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getAllPosts, getPost, isDraftHidden } from '@/lib/content';

// Node runtime so generateStaticParams works (edge runtime forbids pre-
// rendering params). Not edge-latency-critical — OG images are cached
// once per deploy.
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
          background: '#F5F1E8',
          color: '#1A1A1E',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 22,
            fontFamily: 'Menlo, monospace',
            color: 'rgba(26, 26, 30, 0.55)',
          }}
        >
          <span>akaushik.org / work</span>
          <span>{fm.year}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, fontFamily: 'Menlo, monospace', color: '#13423D' }}>
            {`${fm.index} · ${fm.tag}`}
          </div>
          <div
            style={{
              fontSize: 88,
              lineHeight: 1.05,
              marginTop: 24,
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            {fm.title}
          </div>
          <div
            style={{
              fontSize: 34,
              marginTop: 32,
              fontStyle: 'italic',
              color: 'rgba(26, 26, 30, 0.72)',
              lineHeight: 1.3,
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
            fontFamily: 'Menlo, monospace',
            color: 'rgba(26, 26, 30, 0.55)',
            borderTop: '1px solid rgba(26, 26, 30, 0.18)',
            paddingTop: 24,
          }}
        >
          <span>{fm.role}</span>
          <span style={{ color: '#13423D' }}>
            {Array.isArray(fm.stack) ? fm.stack.join(' · ') : ''}
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
