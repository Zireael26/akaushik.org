import type { Metadata, Viewport } from 'next';
import { Newsreader, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import Script from 'next/script';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { Wanderer } from '@/components/scene/Wanderer';
import { TweakBridge } from '@/components/dev/TweakBridge';
import { CANONICAL_ORIGIN } from '@/lib/canonical';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { siteGraph, jsonLdString } from '@/lib/structured-data';
import './globals.css';

// Cloudflare Web Analytics beacon — cookieless, no consent banner needed
// (per memory: Cloudflare analytics, not @vercel/analytics). Token read
// from NEXT_PUBLIC_CF_BEACON_TOKEN so it ships nowhere the codebase can
// see. When unset (dev / preview) the script is a no-op.
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['300', '400', '500', '600', '700'],
});
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
  // Per-page metadata can override `alternates.canonical` with a deeper
  // path. Root falls back to the canonical origin.
  alternates: { canonical: '/' },
  title: {
    default: 'Abhishek Kaushik — AI systems for businesses that haven’t met AI yet',
    template: '%s · Abhishek Kaushik',
  },
  description:
    'Independent engineer building agent-native software. Modular monoliths, retrieval systems, and operational AI for teams that care about how things feel.',
  applicationName: 'akaushik.org',
  authors: [{ name: 'Abhishek Kaushik', url: CANONICAL_ORIGIN }],
  creator: 'Abhishek Kaushik',
  openGraph: {
    type: 'website',
    url: CANONICAL_ORIGIN,
    siteName: 'akaushik.org',
    title: 'Abhishek Kaushik — AI systems for businesses that haven’t met AI yet',
    description:
      'Independent engineer building agent-native software. Case studies: Neev, VeriCite, Bluehost Agents, curat.money, ClusterBid.',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@abhi2601k',
  },
  other: {
    'link-llms': '</llms.txt>; rel="llms-txt"; type="text/markdown"',
    'link-agent-skills': '</.well-known/agent-skills/index.json>; rel="agent-skills"',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F1E8' },
    { media: '(prefers-color-scheme: dark)', color: '#121417' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      data-mode="light"
      data-accent="forest"
      data-density="airy"
      data-motion="on"
      data-tagline="a"
      data-scroll-behavior="smooth"
      className={`${newsreader.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Pre-hydration theme bootstrap — /public/init-theme.js reads the user's
            stored choice or system preference and sets html[data-mode] before
            first paint. The sync load is deliberate: an async/deferred script
            would paint first, then flip theme, causing FOUC for dark-preference
            users. Matches components/site/ThemeToggle.tsx (storage key + fallback). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script nonce={nonce} src="/init-theme.js" />
        {/* RFC 8288 Link header duplicates — for crawlers that skip HTTP
            headers. Same rels as proxy.ts; types match AGENT_READINESS §3.3. */}
        <link rel="describedby" type="text/markdown" href="/llms.txt" />
        <link rel="describedby" type="text/markdown" href="/llms-full.txt" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        {/* Schema.org JSON-LD — Person + Organization + WebSite emitted as
            one @graph so the Article/Case-study graphs on detail pages can
            point back at stable @id URIs (https://akaushik.org/#person,
            /#organization) rather than redeclaring the author and publisher.
            Rendered as a literal <script> in the static HTML head via
            JsonLdScript (see that component for why next/script won't do). */}
        <JsonLdScript id="ld-json-site" json={jsonLdString(siteGraph())} nonce={nonce} />
      </head>
      <body>
        <Wanderer />
        <SiteNav />
        {children}
        <SiteFooter />
        <TweakBridge />
        {CF_BEACON_TOKEN ? (
          <Script
            nonce={nonce}
            strategy="afterInteractive"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
          />
        ) : null}
      </body>
    </html>
  );
}
