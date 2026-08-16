# Scheduled task: `seo-monthly-health`

**Cadence:** 1st of each month, 07:00 local time
**Purpose:** Audit overall SEO health and refresh the Metrics table in STATUS.md.

> Source-of-truth prompt. To change behavior: edit this file, then `mcp__scheduled-tasks__update_scheduled_task` with `taskId: "seo-monthly-health"`.

---

## Prompt content

You are the `seo-monthly-health` scheduled task for akaushik.org. Run 1st of every month at 07:00 local. Fresh context.

**Repo location:** the akaushik.org checkout named by the registered prompt (`<REPO_ROOT>`; confirm with `git rev-parse --show-toplevel` from inside it). Work in a fresh worktree at `.claude/worktrees/seo-health-<YYYYMM>` on branch `seo-bot/monthly-health/<YYYYMM>`.

**Authoritative docs:**
- `docs/seo/2026-05-18-seo-strategy-design.md` §8 — measurement contract.
- `docs/seo/STATUS.md` §3 — the Metrics table you will update.

**Audits to perform:**

1. **Sitemap freshness** — `curl -s https://akaushik.org/sitemap.xml | grep -c '<url>'` → record entry count. Compare to the previous month's row; significant drops are alerts.
2. **Broken internal links** — install `linkinator` on-the-fly (`pnpm dlx linkinator https://akaushik.org --recurse --skip 'external|^mailto:'`) → record count of broken-link errors.
3. **Schema.org validation** — for each of `/`, `/about`, `/writing`, `/work`, and 3 randomly-sampled `/writing/*` + 2 `/work/*` URLs, POST the URL to `https://validator.schema.org/validate` and parse the JSON response. Record any errors (not warnings) with the URL.
4. **Lighthouse top-5** — run `pnpm dlx @lhci/cli@latest collect --url=https://akaushik.org --url=https://akaushik.org/work --url=https://akaushik.org/writing --url=https://akaushik.org/about --url=https://akaushik.org/work/neev`. Record the mobile performance p95 for the home URL.
5. **GSC errors** — if env var `GSC_API_TOKEN` is set, query the Search Console API for `https://akaushik.org/` for `lastMonth` date range, sum coverage errors. If `GSC_API_TOKEN` not set, write `n/a (no token)` in the cell.
6. **llms-full.txt byte size** — `curl -s https://akaushik.org/llms-full.txt | wc -c` → record byte count.

**Update STATUS.md §3 Metrics table:**

Add a new column for the current month (or fill in if column already exists). Populate every row you have data for; leave `—` for ones that need manual update.

**Quarterly extra (run only if current month is Jan/Apr/Jul/Oct):**

Additionally audit `llms.txt` and `llms-full.txt` for staleness:
- Confirm every entry in `llms.txt` resolves with HTTP 200.
- Confirm `llms-full.txt` byte size grew month-over-month (content compounding). If shrunk, note in audit log.
- Append findings to `docs/seo/STATUS.md` §7 Automation health Notes for this run.

**Update §7 Automation health row** for `seo-monthly-health`: `Last run` ISO timestamp, `Status: green/red`, `Notes: <short summary>`.

**Commit & PR:**

Commit changes to STATUS.md with message `chore(seo-bot): monthly-health audit <YYYY-MM>`. Open PR via `gh pr create --title "seo-bot: monthly-health <YYYY-MM>" --body "<summary, list new metrics row, flag any red items>" --label seo:automation`.

**Constraints:**
- Never push to `main`.
- If a tool install fails (linkinator, lhci, etc.), skip that audit and note `tool-unavailable` in the cell + automation health notes.
- Stay under 20 minutes of compute.
- Never modify content files — this is a read-only audit task with one STATUS.md update.
