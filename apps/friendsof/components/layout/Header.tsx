'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeSwitch } from '@/components/pixel/ThemeSwitch';

export type HeaderProps = {
  activeNav?: 'overview' | 'meetings' | 'research' | 'presentations' | 'progress' | 'discussions' | 'search' | 'editor';
  user?: { name: string; role: string } | null;
};

export function Header({ activeNav, user }: HeaderProps) {
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
        setSignOutError('Sign out failed. Please retry.');
      }
    } catch {
      setSignOutError('Network error. Please retry.');
    }
  }

  return (
    <header className="px-header">
      <div className="px-wordmark">
        <Link href="/" className="px-wordmark-link">
          <span className="px-wordmark-subdomain">friendsof.</span>
          <span className="px-wordmark-domain">akaushik.org</span>
        </Link>
      </div>

      <div className="px-header-end">
        {user && (
          <nav className="px-nav" aria-label="Portal Navigation">
            <ul className="px-nav-list">
              <li>
                <Link href="/overview" className={`px-nav-action ${activeNav === 'overview' ? 'is-active' : ''}`}>
                  Overview
                </Link>
              </li>
              <li>
                <Link href="/meetings" className={`px-nav-action ${activeNav === 'meetings' ? 'is-active' : ''}`}>
                  Meetings
                </Link>
              </li>
              <li>
                <Link href="/research" className={`px-nav-action ${activeNav === 'research' ? 'is-active' : ''}`}>
                  Research
                </Link>
              </li>
              <li>
                <Link href="/presentations" className={`px-nav-action ${activeNav === 'presentations' ? 'is-active' : ''}`}>
                  Decks
                </Link>
              </li>
              <li>
                <Link href="/progress" className={`px-nav-action ${activeNav === 'progress' ? 'is-active' : ''}`}>
                  Progress
                </Link>
              </li>
              <li>
                <Link href="/discussions" className={`px-nav-action ${activeNav === 'discussions' ? 'is-active' : ''}`}>
                  Inquiries
                </Link>
              </li>
              <li>
                <Link href="/search" className={`px-nav-action ${activeNav === 'search' ? 'is-active' : ''}`}>
                  Search
                </Link>
              </li>
              {user.role === 'owner' && (
                <li>
                  <Link href="/editor" className={`px-nav-action ${activeNav === 'editor' ? 'is-active' : ''}`} style={{ color: 'var(--px-amber-ink)' }}>
                    Editor
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        )}

        <div className="px-header-auth-status">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink45)' }}>
                {user.name}
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
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink40)' }}>
              PRIVATE WORKSPACE
            </span>
          )}
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
