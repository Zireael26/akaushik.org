- 2026-08-23 — Moved the daily GitHub-stats refresh from GitHub Actions onto
  the site's own Cloudflare Worker. `public/data/stats.json` had sat at its
  2026-08-13 snapshot — 12,434 contributions against a real count north of
  13,000 — because `.github/workflows/stats.yml` has no `GH_STATS_TOKEN` to run
  with; every daily trigger failed at the require-secret gate and the page kept
  quoting a ten-day-old total as if it were measured today. The Worker path:
  `wrangler.jsonc` gains cron triggers (`17 4 * * *`, the Actions schedule's old
  slot) at top level and in both `env.preview` / `env.production`, plus
  `STATS_KV` namespace bindings; `worker/index.ts` gains a `scheduled` handler
  on the default export that fetches the contribution snapshot from the GitHub
  GraphQL API with the `GH_STATS_TOKEN` wrangler secret and publishes it to KV;
  the new pure module `lib/stats-source.ts` (no `fs`, no `process.exit`,
  injectable fetch/clock, same layering doctrine as `lib/agent-proxy.ts`)
  owns fetch/normalize/staleness/fallback for both the cron and the site.
  `lib/stats.ts` keeps its `Stats` contract exactly and now serves KV-first,
  falling back to the checked-in file **only as a visibly-degraded path**: a
  snapshot older than ~36h or missing `generatedAt` renders "data stale" in the
  section label, an amber (`--px-amber-ink`, token-only) intro paragraph naming
  the failure, and a provenance line reading "Last good N days ago" instead of
  "Refreshed" — an old number is never presented as current. Null-safe
  `commits12mo` / `lastCommit` and absent-means-do-not-link `public` are
  enforced by the parser (gotchas 2026-05-02). `scripts/fetch-github-stats.mjs`
  still works unchanged for local runs; the Actions workflow is retained until
  the Worker path is proven in production, then removed separately. Tests:
  `lib/stats-source.test.ts` covers normalize, staleness boundaries, parse
  fail-closed, and the cron handler against fake fetch + fake KV (no network);
  `components/sections/OpenSource.test.tsx` pins the degraded labelling;
  `lib/dates.test.ts` covers the shared `formatRelativeAge`. Operator action
  remains one command: `wrangler secret put GH_STATS_TOKEN`.
