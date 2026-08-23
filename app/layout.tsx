import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { Cursor } from '@/components/pixel/Cursor';
import { CANONICAL_ORIGIN } from '@/lib/canonical';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { siteGraph, jsonLdString } from '@/lib/structured-data';
import './globals.css';
// Section styles, one file per section. Order matters: _shared defines the
// primitives the rest build on. Imported here rather than @import-chained from
// globals.css, which silently dropped everything past the first few files.
import './styles/sections/_shared.css';
import './styles/sections/header.css';
import './styles/sections/profile.css';
import './styles/sections/method.css';
import './styles/sections/experience.css';
import './styles/sections/work.css';
import './styles/sections/services.css';
import './styles/sections/writing.css';
import './styles/sections/work-detail.css';
import './styles/sections/writing-detail.css';
import './styles/sections/docs.css';
import './styles/sections/status.css';
import './styles/sections/open.css';
import './styles/sections/footer.css';
import './styles/sections/cursor.css';

// Cloudflare Web Analytics beacon — cookieless, no consent banner needed
// (per memory: Cloudflare analytics, not @vercel/analytics). Token read
// from NEXT_PUBLIC_CF_BEACON_TOKEN so it ships nowhere the codebase can
// see. When unset (dev / preview) the script is a no-op.
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

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
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1218' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      data-mode="light"
      data-motion="on"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Pre-hydration theme bootstrap — /public/init-theme.js reads the user's
            stored choice or system preference and sets html[data-mode] before
            first paint. The sync load is deliberate: an async/deferred script
            would paint first, then flip theme, causing FOUC for dark-preference
            users. Matches components/pixel/ThemeSwitch.tsx (storage key + fallback). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script nonce={nonce} src="/init-theme.js" />
        {/* RFC 8288 Link header duplicates — for crawlers that skip HTTP
            headers. Same rels as proxy.ts; types match AGENT_READINESS §3.3. */}
        <link rel="describedby" type="text/markdown" href="/llms.txt" />
        <link rel="describedby" type="text/markdown" href="/llms-full.txt" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        {/* Feed autodiscovery. `rel="alternate"` with a feed MIME type is what
            readers, aggregators and crawlers look for; a feed nothing links to
            is a feed nobody finds. Declared here rather than only on /writing
            so it is discoverable from any page. */}
        <link
          rel="alternate"
          type="application/atom+xml"
          title="akaushik.org — writing"
          href="/feed.xml"
        />
        {/* Schema.org JSON-LD — Person + Organization + WebSite emitted as
            one @graph so the Article/Case-study graphs on detail pages can
            point back at stable @id URIs (https://akaushik.org/#person,
            /#organization) rather than redeclaring the author and publisher.
            Rendered as a literal <script> in the static HTML head via
            JsonLdScript (see that component for why next/script won't do). */}
        <JsonLdScript id="ld-json-site" json={jsonLdString(siteGraph())} nonce={nonce} />
      </head>
      <body>
        <SiteNav />
        {children}
        <SiteFooter />
        {/* Decorative overlay, mounted last. It gates itself to (pointer: fine),
            disables under prefers-reduced-motion, and is pointer-events: none —
            it can never eat a click or suppress a focus ring. */}
        <Cursor />
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
