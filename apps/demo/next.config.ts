import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
};

// Gives `next dev` the same bindings the Worker gets, backed by local
// miniflare state in .wrangler/. Without it getCloudflareContext() throws in
// dev and every gated page silently behaves as if nobody is signed in, which
// is the least useful way to develop this app.
initOpenNextCloudflareForDev();

export default nextConfig;
