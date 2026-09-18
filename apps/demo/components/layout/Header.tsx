'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeSwitch } from '@/components/pixel/ThemeSwitch';

export type HeaderSection = 'demo' | null;

export interface HeaderProps {
  active?: HeaderSection;
  account?: { name: string } | null;
}

// The demo is a single page, so the header carries no navigation list;
// `active` is kept so the call sites read the same as the other portals.
export function Header({ account = null }: HeaderProps) {
  const router = useRouter();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      const res = await fetch('/api/auth/sign-out', { method: 'POST' });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setSignOutError('Sign out failed.');
      }
    } catch {
      setSignOutError('Network error.');
    }
  }

  return (
    <header className="px-header">
      <div className="px-wordmark">
        <Link href="/" className="px-wordmark-link">
          <span className="px-wordmark-subdomain">demo.</span>
          <span className="px-wordmark-domain">akaushik.org</span>
        </Link>
      </div>

      <div className="px-header-end">
        <div className="px-header-auth-status">
          {account ? (
            <>
              <span
                className="px-header-name"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink45)' }}
              >
                {account.name}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: '2px 6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  color: 'var(--ink40)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Sign out
              </button>
              {signOutError && (
                <span role="alert" style={{ fontSize: '10px', color: 'var(--px-red-ink)' }}>
                  {signOutError}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink40)' }}>
              PRIVATE DEMO
            </span>
          )}
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
