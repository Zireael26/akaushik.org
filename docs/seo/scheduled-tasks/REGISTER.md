# Registering the 5 SEO scheduled tasks in Cowork

Cowork's `create_scheduled_task` MCP tool requires an interactive approval dialog per task — it can't be done unattended by a scheduled or autonomous agent. To register them once, paste each block below into a Cowork session and approve when prompted.

Each task's _behavior_ is defined by the file at `docs/seo/scheduled-tasks/<task-id>.md` (committed to the repo). The registered prompt is a short bootstrap that re-reads the file every run, so editing the file is enough — no need to re-register after a prompt change. To change a registered task's schedule or pause it, call `mcp__scheduled-tasks__update_scheduled_task`.

This file is registration source, not evidence that any task is currently registered or enabled. Confirm active state in the scheduler before relying on a cadence.

**`<REPO_ROOT>` in the blocks below is a placeholder, not a literal.** Registration is the one step that needs a machine-specific location, so the repo does not record one. Before pasting a block, get the value on the machine you are registering from and substitute it everywhere it appears:

```bash
# Derives from the git COMMON directory, not the working tree: --show-toplevel
# returns the WORKTREE root when run inside a worktree, while --git-common-dir
# points at the owning checkout's .git from anywhere in the repo. --path-format=absolute
# is load-bearing: without it git prints a bare relative `.git` when the path is the
# repo root, which would then resolve against the caller's cwd instead.
dirname "$(git -C <any-path-inside-akaushik.org> rev-parse --path-format=absolute --git-common-dir)"
```

The derivation, not the operator, decides the root — the same command is correct
run from the canonical checkout and from one of its worktrees, so there is nothing
to remember. This matches how `seo-weekly-draft.md` derives `REPO_ROOT` at run time;
keep the two in step if either changes.

**All cron times are LOCAL** (Cowork evaluates cron in the user's timezone — for Abhishek that's IST / UTC+05:30).

---

## 1. `seo-redirect-health` — daily 07:00

```
mcp__scheduled-tasks__create_scheduled_task
  taskId:            seo-redirect-health
  description:       Daily akaushik.org redirect health check — Phase 0 hygiene guard.
  cronExpression:    0 7 * * *
  notifyOnCompletion: true
  prompt: |
    You are the `seo-redirect-health` scheduled task for akaushik.org.

    Read the full task contract from `<REPO_ROOT>/docs/seo/scheduled-tasks/seo-redirect-health.md` and follow its "Prompt content" section verbatim. The file is the source of truth — re-read each run.

    Operate against the canonical repo at `<REPO_ROOT>/`. Read-only redirect checks; only write target is `docs/seo/STATUS.md`. Never push to main; PR flow only.
```

## 2. `seo-weekly-draft` — Monday 06:00

```
mcp__scheduled-tasks__create_scheduled_task
  taskId:            seo-weekly-draft
  description:       Weekly MDX draft for akaushik.org from editorial calendar — Phase 1 publishing cadence.
  cronExpression:    0 6 * * 1
  notifyOnCompletion: true
  prompt: |
    You are the `seo-weekly-draft` scheduled task for akaushik.org.

    Read the full task contract from `<REPO_ROOT>/docs/seo/scheduled-tasks/seo-weekly-draft.md` and follow its "Prompt content" section verbatim.

    Operate against `<REPO_ROOT>/`. Use only the exact dated branch and worktree path recorded by the source contract. Never wildcard or force-remove worktrees; refuse cleanup when that exact worktree is dirty. Open a DRAFT PR (labels `seo:automation` and `seo:draft`) for editorial review. Never push to main.

    If `docs/seo/editorial-calendar.md` does not exist, this is the first run: bootstrap it per the contract before drafting a post.
```

## 3. `seo-monthly-health` — 1st of month 07:00

```
mcp__scheduled-tasks__create_scheduled_task
  taskId:            seo-monthly-health
  description:       Monthly SEO health audit for akaushik.org — sitemap, broken links, schema, lighthouse, GSC.
  cronExpression:    0 7 1 * *
  notifyOnCompletion: true
  prompt: |
    You are the `seo-monthly-health` scheduled task for akaushik.org.

    Read the full task contract from `<REPO_ROOT>/docs/seo/scheduled-tasks/seo-monthly-health.md` and follow its "Prompt content" section verbatim.

    Operate against `<REPO_ROOT>/`. Create a worktree at `.claude/worktrees/seo-health-<YYYYMM>` on branch `seo-bot/monthly-health/<YYYYMM>`. Refresh `docs/seo/STATUS.md §3 Metrics` for the current month + update §7. Open PR (label `seo:automation`). Never push to main.

    If a tool is unavailable (linkinator, lhci, GSC API), record `tool-unavailable` and continue.
```

## 4. `seo-monthly-profile-drift` — 1st of month 08:00

```
mcp__scheduled-tasks__create_scheduled_task
  taskId:            seo-monthly-profile-drift
  description:       Monthly NAP drift check — diff live profile bios + photos against akaushik.org STATUS.md canonical NAP.
  cronExpression:    0 8 1 * *
  notifyOnCompletion: true
  prompt: |
    You are the `seo-monthly-profile-drift` scheduled task for akaushik.org.

    Read the full task contract from `<REPO_ROOT>/docs/seo/scheduled-tasks/seo-monthly-profile-drift.md` and follow its "Prompt content" section verbatim.

    Operate against `<REPO_ROOT>/`. Parse the canonical NAP block from `docs/seo/STATUS.md §2`. For each non-placeholder `sameAs` URL, fetch the public profile, diff name/bio/photo. On drift, append to §5 + PR (label `seo:automation,seo:alert`). On no drift, tiny §7 update + PR. Never push to main. Never auto-edit §2.

    If every NAP field is a placeholder/TODO, exit early with note `awaiting canonical NAP fill-in (Human handoff queue H8)`.
```

## 5. `seo-quarterly-flagship` — 1st of Jan/Apr/Jul/Oct 06:00

```
mcp__scheduled-tasks__create_scheduled_task
  taskId:            seo-quarterly-flagship
  description:       Quarterly flagship-post proposal for akaushik.org — long-form deep-dive that anchors a topic cluster.
  cronExpression:    0 6 1 1,4,7,10 *
  notifyOnCompletion: true
  prompt: |
    You are the `seo-quarterly-flagship` scheduled task for akaushik.org.

    Read the full task contract from `<REPO_ROOT>/docs/seo/scheduled-tasks/seo-quarterly-flagship.md` and follow its "Prompt content" section verbatim.

    Operate against `<REPO_ROOT>/`. Create a worktree at `.claude/worktrees/seo-flagship-<YYYYQN>` on branch `seo-bot/flagship/<YYYYQN>`. Draft a flagship brief at `docs/seo/flagships/<YYYYQN>-<slug>.md`. Update STATUS.md §1 Phase 1 row + §7. Open PR (label `seo:automation,seo:flagship`). Never push to main.

    This task PROPOSES the flagship; it does not write the post itself.
```

---

## After registering

Verify with:

```
mcp__scheduled-tasks__list_scheduled_tasks
```

You should see all five with `enabled: true` and a `nextRunAt`. Update `docs/seo/STATUS.md` row H10 to "complete" once all five show in the list.
