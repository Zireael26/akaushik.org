'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log privately without exposing details to client DOM
    console.error('[demo-error]', error);
  }, [error]);

  return (
    <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--px-amber-ink)', marginBottom: '12px' }}>
        Service Notice
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 500, margin: '0 0 12px' }}>
        503 &middot; Service Unavailable
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--ink70)', lineHeight: 1.6, marginBottom: '24px' }}>
        The workspace database or authentication service is temporarily unavailable. Please verify configuration or retry shortly.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          background: 'var(--panel)',
          color: 'var(--panelInk)',
          border: '1px solid var(--line)',
          padding: '8px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Retry Connection
      </button>
    </div>
  );
}
