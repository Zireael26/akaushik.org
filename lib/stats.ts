import { resolveStats, type StatsView } from './stats-source';

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
 * That fallback is never silent. The returned `StatsView` carries a `degraded`
 * flag and a `reason` saying whether the numbers are live, stale (older than
 * ~36h), or from the checked-in file because KV had nothing readable, and
 * `OpenSource` renders that state in copy instead of passing an old number off
 * as current.
 *
 * The JSON contract is unchanged: `Stats` / `StatsRepo` are exactly what this
 * module always exported (now owned by `./stats-source`, which both the cron
 * writer and this reader import), so every consumer keeps compiling. Null
 * safety per gotchas.md 2026-05-02 lives in the parser — `commits12mo` /
 * `lastCommit` may be null, and an absent `public` flag means "do not link",
 * never public.
 */
export async function getStats(): Promise<StatsView> {
  // Under vitest and any non-Worker runtime there is no binding, and the
  // checked-in snapshot degraded-labelled is exactly what should be served.
  return resolveStats(globalThis.STATS_KV ?? null);
}
