import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'demo.akaushik.org',
    template: '%s · demo.akaushik.org',
  },
  description: 'Private demonstration',
  // Not public. Nothing here should be indexed,
  // cached by an intermediary, or archived, and the Worker sets the matching
  // X-Robots-Tag so this holds for responses a crawler reaches without HTML.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1218' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" data-mode="light" data-motion="on" suppressHydrationWarning>
      <head>
        {/* Same storage key and fallback as akaushik.org, so a reader who set
            dark on the main site lands here in dark too — as far as an origin
            boundary permits, which is to say the preference is read fresh per
            origin but the rule producing it is identical. Sync on purpose:
            deferring this paints light first and then flips. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('abhishek.portfolio.mode');" +
              "var m=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');" +
              "document.documentElement.setAttribute('data-mode',m);}catch(e){}})();",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
