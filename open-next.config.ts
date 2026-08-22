import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * No incremental cache is configured, so ISR revalidation falls back to
 * re-rendering on demand. That is the right trade for now: the only routes
 * with a revalidate window are the agent-surface JSON/Markdown routes and the
 * `md` suffix routes, all of which are cheap to render, and adding a KV cache
 * would put a second source of truth in front of content that lives in MDX.
 * Revisit if the render cost ever shows up in Workers analytics.
 */
export default defineCloudflareConfig();
