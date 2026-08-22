import Link from 'next/link';

import { ThemeSwitch } from '@/components/pixel/ThemeSwitch';

/**
 * Site header — wordmark left, nav + theme switch right.
 *
 * Ported from gaurijha.com's Header.astro (tag `public-site-v1`): the same
 * flex-wrap row, the same 16px/var(--wrap-pad) padding, the same 13px/500
 * muted type, the same `(pointer: coarse)` hit-target widening.
 *
 * Two deliberate departures from that source:
 *   - The row is capped at var(--wrap-max) and centred. Gauri's header runs
 *     edge to edge, which puts the wordmark left of the hero title on a wide
 *     screen; design.md § Layout caps content at 1560px and the hero here
 *     already does.
 *   - No `is-current` state. That needs the pathname, which would make this a
 *     client component for a colour change; it stays a server component.
 */
const NAV: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Profile', href: '/#profile' },
  { label: 'Method', href: '/#method' },
  { label: 'Work', href: '/#work' },
  { label: 'Writing', href: '/writing/' },
  { label: 'Services', href: '/#services' },
  { label: 'Contact', href: '/#contact' },
];

export default function SiteNav() {
  return (
    <header className="px-header">
      <Link className="px-wordmark" href="/">
        akaushik.org
      </Link>
      <div className="px-header-end">
        {/* A list, not bare anchors. Screen readers announce "list, 6 items"
            and offer list navigation; a run of loose links announces nothing
            about how many there are or where you are in them. The markers and
            spacing are stripped in CSS, so this is invisible to sighted
            readers and useful to everyone else. */}
        <nav className="px-nav" aria-label="Primary">
          <ul className="px-nav-list">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeSwitch />
      </div>
    </header>
  );
}
