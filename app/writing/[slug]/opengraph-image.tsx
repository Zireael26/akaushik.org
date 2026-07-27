import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getAllPosts, getPost, isDraftHidden } from '@/lib/content';
import { formatMonthYear } from '@/lib/dates';

// Node runtime so generateStaticParams works.
export const alt = 'Writing — akaushik.org';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts('writing', { includeUnlisted: true }).map((post) => ({
    slug: post.slug,
  }));
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost('writing', slug);
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
          <span>akaushik.org / writing</span>
          <span>{fm.date ? formatMonthYear(fm.date) : ''}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.1,
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            {fm.title}
          </div>
          <div
            style={{
              fontSize: 30,
              marginTop: 32,
              fontStyle: 'italic',
              color: 'rgba(26, 26, 30, 0.72)',
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
            fontSize: 22,
            fontFamily: 'Menlo, monospace',
            color: 'rgba(26, 26, 30, 0.55)',
            borderTop: '1px solid rgba(26, 26, 30, 0.18)',
            paddingTop: 24,
          }}
        >
          <span>Abhishek Kaushik</span>
          <span style={{ color: '#13423D' }}>akaushik.org</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
