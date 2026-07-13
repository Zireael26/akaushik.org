import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  turbopack: {
    root: process.cwd(),
  },
  // Sets the parchment-on-ink frame for image / static assets.
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Agent-readiness: set discoverability headers in proxy.ts; this is the build-time
  // declaration for the static .well-known/* routes that are served from /public.
  async headers() {
    return [
      {
        source: '/.well-known/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
