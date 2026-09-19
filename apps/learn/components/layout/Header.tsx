'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeSwitch } from '@/components/pixel/ThemeSwitch';

export type HeaderSection =
  | 'contents'
  | 'lesson'
  | 'modules'
  | 'labs'
  | 'library'
  | null;

export interface HeaderProps {
  active?: HeaderSection;
  reader?: { name: string } | null;
}

const NAV: ReadonlyArray<{ label: string; href: string; key: HeaderSection }> = [
  { label: 'Contents', href: '/contents', key: 'contents' },
  { label: 'Modules', href: '/contents#modules', key: 'modules' },
  { label: 'Labs', href: '/labs', key: 'labs' },
  { label: 'Library', href: '/library', key: 'library' },
];

export function Header({ active = null, reader = null }: HeaderProps) {
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
        <Link href={reader ? '/contents' : '/'} className="px-wordmark-link">
          <span className="px-wordmark-subdomain">learn.</span>
          <span className="px-wordmark-domain">akaushik.org</span>
        </Link>
      </div>

      <div className="px-header-end">
        {reader && (
          <nav className="px-nav" aria-label="Course">
            <ul className="px-nav-list">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`px-nav-action ${active === item.key ? 'is-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="px-header-auth-status">
          {reader ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink45)' }}>
                {reader.name}
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
            </>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink40)' }}>
              PRIVATE COURSE
            </span>
          )}
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
