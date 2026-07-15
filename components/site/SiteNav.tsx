import Link from 'next/link';

import ThemeToggle from './ThemeToggle';

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/#work', label: 'Work' },
  { href: '/#writing', label: 'Writing' },
  { href: '/#services', label: 'Services' },
  { href: '/#process', label: 'Process' },
  { href: '/#open', label: 'Open' },
  { href: '/#contact', label: 'Contact' },
];

export default function SiteNav() {
  return (
    <header className="site-nav" role="banner">
      <Link className="wordmark" href="/#top" aria-label="Abhishek Kaushik, home">
        <span className="wordmark-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <circle cx="5" cy="12" r="2.2" />
            <circle cx="19" cy="6" r="2.2" />
            <circle cx="19" cy="18" r="2.2" />
            <path d="M6.8 11 17 6.8 M6.8 13 17 17.2" stroke="currentColor" strokeWidth="1.1" fill="none" />
          </svg>
        </span>
        <span className="wordmark-text">Abhishek Kaushik</span>
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <ul className="nav-links-list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="nav-meta">
        <span className="status-dot" aria-hidden="true" />
        <span className="nav-status-text">Open to one project this quarter</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
