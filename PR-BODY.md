# Daily GitHub stats via Cloudflare cron + KV

## Why

The "In the open" section has been quoting a stale number as if it were
measured today. `public/data/stats.json` is frozen at its 2026-08-13 snapshot
(12,434 contributions; the real count is over 13,000) because the daily GitHub
Actions workflow (`.github/workflows/stats.yml`, `17 4 * * *`) fails on every
run: `GH_STATS_TOKEN` was never set, and the workflow's first step — correctly —
refuses to run without it. The workflow was fine; its input was missing.

The site already runs as a Cloudflare Worker (`@opennextjs/cloudflare`). The
free plan includes Cron Triggers and KV, so the refresh moves onto the same
Worker that serves the site: no second platform, no Actions runner minutes,
and the token lives in the Worker's secret store instead of a repo setting.

## What changed

- **`wrangler.jsonc`** — cron trigger `17 4 * * *` (the old Actions slot) at
  top level and in both `env.preview` and `env.production`; `STATS_KV`
  namespace bindings for each environment with `<STATS_KV_*_NAMESPACE_ID>`
  placeholders to fill after the one-time create.
- **`worker/index.ts`** — adds `scheduled` to the default export. It reads only
  env bindings (`GH_STATS_TOKEN` secret, `STATS_KV` binding) and writes KV only
  after a complete successful fetch, so a failed run leaves the previous good
  snapshot in place.
- **`lib/stats-source.ts`** (new) — the pure pipeline: GitHub fetch +
  normalization to the existing `Stats` contract, contract-checked `parseStats`,
  the 36-hour staleness line, and `resolveStats` (KV-first, checked-in-file
  fallback). No `fs`, no `process.exit`, injectable clock/fetch — the same
  pure-module/thin-adapter doctrine as `lib/agent-proxy.ts`.
- **`lib/stats.ts`** — `getStats()` returns a `StatsView` (`stats`, `degraded`,
  `reason`) resolved from KV via OpenNext's `getCloudflareContext().env`.
  An earlier version read `globalThis.STATS_KV`, which a module Worker never
  assigns. Cross-family grok review caught that while 669 tests were green.
- **`components/sections/OpenSource.tsx`** — renders the degraded state
  honestly: label becomes "In the open · data stale", an amber intro paragraph
  names what happened ("the daily refresh has been failing" / "Live refresh not
  connected yet"), the heading says "as of the last good snapshot", and the
  provenance line reads "Last good N days ago" instead of "Refreshed".
- **`app/styles/sections/open.css`** — `.px-open-degraded` /
  `.px-open-meta--degraded`: amber token colours only (`--px-amber-ink` text,
  `--px-amber` 7px square marker), no new palette entries, plus a 24-line pure
  addition; nothing else about the section's CSS moved.
- **Tests** — `lib/stats-source.test.ts` (normalize, includesPrivate from the
  actual token's scopes, null-safe repos, cron success/missing-secret/
  missing-binding/mid-run-failure against fake fetch + fake KV, parse fail-closed,
  staleness boundary at exactly 36h), `components/sections/OpenSource.test.tsx`
  (live vs stale vs fallback labelling), `lib/dates.test.ts`
  (`formatRelativeAge`).
- **`docs/.changelog-fragments/e1-stats-kv-cron.md`** — Unreleased entry.

## What did not change

- `.github/workflows/stats.yml` is retained untouched. Removing it is a
  separate commit after the Worker path has proven itself in production.
- `scripts/fetch-github-stats.mjs` still works unchanged for local runs
  (`pnpm stats:fetch`). The REPOS list and GraphQL query now exist in both it
  and `lib/stats-source.ts`; they are deliberate twins and must move together.
- The public JSON contract (`Stats`) is byte-compatible; consumers of
  `getStats()` that ignore the new `degraded`/`reason` fields keep working.

## The one operator command

```
wrangler secret put GH_STATS_TOKEN
```

(A classic PAT with `repo` + `read:user` scopes, so private contributions are
counted and honestly claimed. Set it once per environment with `--env preview`
/ `--env production` if you want them to differ.)

One-time, per environment, if the namespaces do not exist yet:

```
wrangler kv namespace create STATS_KV --env preview
wrangler kv namespace create STATS_KV --env production
```

…then paste each printed namespace id into the matching
`<STATS_KV_*_NAMESPACE_ID>` placeholder in `wrangler.jsonc`.

No token value appears anywhere in this diff.

## Test plan

- `pnpm test` — new suites in `lib/stats-source.test.ts`,
  `components/sections/OpenSource.test.tsx`, `lib/dates.test.ts`; all
  network-free (fake `fetch`, plain-object KV).
- Existing suites untouched and expected green: the `OpenSource` link-integrity
  tests keep passing against live fixtures.
- After deploy: `wrangler triggers deploy --dry-run` shows the cron; the next
  04:17 UTC invocation writes `github-stats:v1`; the section renders unlabelled;
  deleting the KV value flips it to the visibly-degraded state.

## Rollout / rollback

Deploy the Worker with the namespaces bound and the secret set; the first cron
fill makes KV authoritative. Rollback is reverting the deploy: the checked-in
snapshot remains in the repo and the section degrades visibly rather than
silently.

## Agent review

Cross-family grok review rejected HEAD `4b05f80`: cron wrote KV, the UI
labelled stale correctly, and the suite was green, but `getStats()` never
saw the Worker binding. Fixed in `ba40f50`. That is the services-section
argument in miniature: a passing suite is not a receipt that the feature
works.

Degraded-state copy follows ADR-0013 public-data truthfulness.
