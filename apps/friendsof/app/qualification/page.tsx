import { headers, cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { setTestSessionCookie, clearTestSessionCookie } from './actions';

export const dynamic = 'force-dynamic';

export default async function QualificationDashboard() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUALIFICATION_ENDPOINTS !== 'true') {
    notFound();
  }

  const headerList = await headers();
  const cookieStore = await cookies();

  const nonceReceived = Boolean(headerList.get('x-nonce'));
  const cspActive = headerList.get('content-security-policy') !== null;
  const hostVerified = headerList.get('host') !== null;
  const hasSessionCookie = Boolean(cookieStore.get('__Host-qual-session')?.value);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--line)', paddingBottom: '16px' }}>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink60)',
          }}
        >
          &larr; Back to Portal Home
        </Link>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '12px 0 6px',
          }}
        >
          P1 Runtime Qualification Dashboard
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--ink70)', margin: 0 }}>
          Synthetic verification receipts for OpenNext adaptation, nonce CSP, async cookies, and streaming.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {/* Security & Headers Card */}
        <div style={{ border: '1px solid var(--line)', padding: '16px', background: 'color-mix(in srgb, var(--line) 3%, transparent)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--px-cobalt-ink)', marginBottom: '8px' }}>
            Headers &amp; CSP Isolation
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            <div><strong>Host verified:</strong> {hostVerified ? 'true' : 'false'}</div>
            <div style={{ marginTop: '6px' }}><strong>x-nonce received:</strong> {nonceReceived ? 'true' : 'false'}</div>
            <div style={{ marginTop: '6px' }}><strong>CSP header present:</strong> {cspActive ? 'true' : 'false'}</div>
          </div>
        </div>

        {/* Server Actions & Async Cookies Card */}
        <div style={{ border: '1px solid var(--line)', padding: '16px', background: 'color-mix(in srgb, var(--line) 3%, transparent)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--px-amber-ink)', marginBottom: '8px' }}>
            Server Actions &amp; Cookies
          </div>
          <div style={{ fontSize: '13px', marginBottom: '12px' }}>
            <strong>Session cookie present:</strong> {hasSessionCookie ? 'true' : 'false'}
          </div>
          <form
            action={async () => {
              'use server';
              await setTestSessionCookie(`synth-${Date.now().toString(36)}`);
            }}
            style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
          >
            <button
              type="submit"
              style={{
                background: 'var(--panel)',
                color: 'var(--panelInk)',
                border: '1px solid var(--line)',
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Test Async Cookie Action
            </button>
          </form>
          {hasSessionCookie && (
            <form
              action={async () => {
                'use server';
                await clearTestSessionCookie();
              }}
              style={{ marginTop: '8px' }}
            >
              <button
                type="submit"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  color: 'var(--ink60)',
                  cursor: 'pointer',
                }}
              >
                Clear Cookie
              </button>
            </form>
          )}
        </div>

        {/* Route Handlers & Streaming Probes */}
        <div style={{ border: '1px solid var(--line)', padding: '16px', background: 'color-mix(in srgb, var(--line) 3%, transparent)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--px-lime-ink)', marginBottom: '8px' }}>
            Endpoint Probes
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>
              <a href="/api/qualification/health" style={{ textDecoration: 'underline', color: 'var(--px-cobalt-ink)' }}>
                GET /api/qualification/health &rarr;
              </a>{' '}
              <span style={{ color: 'var(--ink45)', fontSize: '11px' }}>(JSON status)</span>
            </li>
            <li>
              <a href="/api/qualification/stream" style={{ textDecoration: 'underline', color: 'var(--px-cobalt-ink)' }}>
                GET /api/qualification/stream &rarr;
              </a>{' '}
              <span style={{ color: 'var(--ink45)', fontSize: '11px' }}>(Chunked stream)</span>
            </li>
            <li>
              <a href="/api/qualification/media" style={{ textDecoration: 'underline', color: 'var(--px-cobalt-ink)' }}>
                GET /api/qualification/media &rarr;
              </a>{' '}
              <span style={{ color: 'var(--ink45)', fontSize: '11px' }}>(Ranged media)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
