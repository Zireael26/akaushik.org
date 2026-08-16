# Scheduled task: `seo-monthly-profile-drift`

**Cadence:** 1st of each month, 08:00 local time
**Purpose:** Detect drift between canonical NAP (name / tagline / photo / sameAs) and what the live profiles on each linked platform actually display. Identity-SEO integrity depends on consistency.

> Source-of-truth prompt. To change: edit this file + `mcp__scheduled-tasks__update_scheduled_task` with `taskId: "seo-monthly-profile-drift"`.

---

## Prompt content

You are the `seo-monthly-profile-drift` scheduled task for akaushik.org. Run 1st of every month at 08:00 local. Fresh context.

**Repo location:** the akaushik.org checkout named by the registered prompt (`<REPO_ROOT>`; confirm with `git rev-parse --show-toplevel` from inside it). Read-only check + STATUS.md append on drift only. No worktree needed unless you commit.

**Authoritative docs:**
- `docs/seo/STATUS.md` §2 — Canonical NAP block. This is the source of truth you compare AGAINST.
- `docs/seo/2026-05-18-seo-strategy-design.md` §4.5 — Phase 2 identity SEO scope.

**Procedure:**

1. Parse the YAML in `docs/seo/STATUS.md` §2 to extract: `name`, `tagline`, `photo_url`, `sameAs[]`. If any field is the placeholder `<handle>` or `Q<id>` or has a `TODO` comment, skip that field's check.
2. For each non-skipped `sameAs` URL, fetch the public profile and extract: display name, bio/headline, profile photo URL (or hash). Methods:
   - **LinkedIn:** `curl` works only intermittently due to login walls; if blocked, log `auth-required, manual check needed` for the LinkedIn entry. Do not abort the run.
   - **GitHub:** `gh api users/<handle>` → fields: `name`, `bio`, `avatar_url`, `blog`.
   - **X:** scrape the profile page; if blocked, fall back to `auth-required` log.
   - **Bluesky:** public AT-Proto endpoint at `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=<handle>` → `displayName`, `description`, `avatar`.
   - **dev.to / Hashnode:** public profile API (`https://dev.to/api/users/by_username?url=<handle>`, Hashnode GraphQL).
   - **Wikidata:** `curl -s "https://www.wikidata.org/wiki/Special:EntityData/Q<id>.json"` → English label, description, P856 (official website).
3. For each profile, diff the fetched name + bio against the canonical NAP block:
   - Name must match exactly (`Abhishek Kaushik`).
   - Bio/tagline must contain the canonical tagline as substring (case-insensitive). Stricter match optional.
   - `blog` / `official website` / `description URL` must be `https://akaushik.org` exactly.
   - Photo: if `photo_url` is reachable, compute SHA-1 of the bytes from canonical and from each profile's avatar URL. If hashes differ, flag drift.

**On any drift detected:**

Append to `docs/seo/STATUS.md` §5 Drift log:

```
### <YYYY-MM-DD> profile drift detected
- <platform>: <field> = "<actual>" (canonical: "<expected>")
- <platform>: <field> = "<actual>" (canonical: "<expected>")
Action: Abhishek to sync on each flagged platform; update STATUS.md §2 if the canonical itself changed.
```

Commit on branch `seo-bot/profile-drift/<YYYYMM>` with message `chore(seo-bot): profile drift detected <YYYY-MM>`. Open PR via `gh pr create --title "seo-bot: profile drift <YYYY-MM>" --body "<one-line summary, link to Drift log entry>" --label "seo:automation,seo:alert"`.

**On no drift:**

Do NOT commit or open a PR. Only update §7 Automation health: `Last run`, `Status: green`, `Notes: no drift across N profiles`. To do this you do still need a tiny commit — use branch `seo-bot/profile-drift-status/<YYYYMM>` with title prefix `seo-bot: profile drift OK <YYYY-MM>`.

**Constraints:**
- Never push to `main`.
- Never edit §2 Canonical NAP block automatically — drift means a human (Abhishek) needs to decide whether the canonical changed or the platform drifted.
- Stay under 10 minutes of compute.
- If every profile field in the canonical block is a placeholder, exit early with §7 note: `awaiting canonical NAP fill-in (see Human handoff queue H8)`.
