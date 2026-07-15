import { ImageResponse } from 'next/og';

// Home-page OG image. Parchment background + forest-accent tagline A,
// rendered at 1200×630 (Open Graph default). Node runtime matches the dynamic
// OG routes and avoids the Next edge/static-generation warning during builds.

export const runtime = 'nodejs';
export const alt = 'Abhishek Kaushik — AI systems for businesses that haven\'t met AI yet';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
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
          <span>akaushik.org</span>
          <span>AI engineer · India</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, fontFamily: 'Menlo, monospace', color: '#13423D' }}>
            01 — AI engineer · six years shipping software
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 90,
              lineHeight: 1.05,
              marginTop: 28,
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            <div>AI systems for</div>
            <div style={{ display: 'flex' }}>
              <span>businesses that&nbsp;</span>
              <span style={{ fontStyle: 'italic', color: '#13423D' }}>haven&apos;t</span>
            </div>
            <div>met AI yet.</div>
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
          <span>Neev · VeriCite · Bluehost · curat.money · ClusterBid</span>
          <span style={{ color: '#13423D' }}>hello@akaushik.org</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
