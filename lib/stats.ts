import { getCloudflareContext } from '@opennextjs/cloudflare';
import { resolveStats, type StatsKVReader, type StatsView } from './stats-source';

export type { Stats, StatsRepo, StatsView } from './stats-source';

/**
 * The stats snapshot behind "In the open".
 *
 * The numbers used to come straight off the checked-in
 * `public/data/stats.json`, which only moved when a GitHub Actions run landed
 * — and that workflow has been failing for lack of a token, so the page quoted
 * a ten-day-old total as if it were measured today. Now the snapshot is read
 * from the `STATS_KV` namespace that the Worker cron refreshes daily, and the
 * checked-in file is served only when KV holds nothing usable.
 *
 * Cloudflare module Workers put bindings on the handler `env`, not on
 * `globalThis`. OpenNext exposes that env through `getCloudflareContext()`.
 * `globalThis.STATS_KV` is never assigned at runtime; reading it would leave
 * the section on the checked-in file forever.
 *
 * The fallback is never silent. The returned `StatsView` carries a `degraded`
 * flag and a `reason` saying whether the numbers are live, stale (older than
 * ~36h), or from the checked-in file because KV had nothing readable.
 */
export async function readWorkerStatsKv(): Promise<StatsKVReader | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.STATS_KV ?? null;
  } catch {
    return null;
  }
}

export async function getStats(): Promise<StatsView> {
  return resolveStats(await readWorkerStatsKv());
}
