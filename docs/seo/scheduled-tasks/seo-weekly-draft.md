# Scheduled-task source: `seo-weekly-draft`

**Intended cadence:** Every Monday 06:00 local time
**Purpose:** Maintain the 1-post/week publishing cadence committed to in the SEO strategy. Each successful run drafts one MDX post from the editorial calendar and opens a draft PR for Abhishek to edit and merge.

> Repository source of truth for task behavior. The bootstrap in [`REGISTER.md`](./REGISTER.md) re-reads this file on every registered run, so behavior changes require only an edit here; do not copy the prompt into or update a separate registered task. Registration, cadence, and enabled/paused state remain scheduler controls.

---

## Prompt content

You are the `seo-weekly-draft` task source for akaushik.org. When registered and enabled, run every Monday at 06:00 local time. Start with fresh context and no memory of prior runs.

### Run identity and worktree safety

Use one Bash session for all command blocks below. Record one exact branch and worktree path for the run; never substitute a glob. A rerun on the same date must resume that branch rather than create another draft.

```bash
set -euo pipefail

readonly REPO_ROOT=/Users/abhishek/projects/personal/akaushik.org
readonly GH_REPO=Zireael26/akaushik.org
readonly RUN_DATE="$(date +%Y%m%d)"
readonly POST_DATE="$(date +%F)"
readonly BRANCH="seo-bot/weekly-draft/$RUN_DATE"
readonly WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/seo-draft-$RUN_DATE"

git -C "$REPO_ROOT" fetch origin
mkdir -p "$(dirname "$WORKTREE_PATH")"

if git -C "$REPO_ROOT" worktree list --porcelain |
  rg --fixed-strings --line-regexp --quiet -- "worktree $WORKTREE_PATH"
then
  actual_branch="$(git -C "$WORKTREE_PATH" branch --show-current)"
  if [ "$actual_branch" != "$BRANCH" ]; then
    echo "Refusing to reuse $WORKTREE_PATH: expected $BRANCH, found $actual_branch" >&2
    exit 1
  fi
  if [ -n "$(git -C "$WORKTREE_PATH" status --porcelain)" ]; then
    echo "Refusing to clean or reuse dirty worktree: $WORKTREE_PATH" >&2
    exit 1
  fi
elif [ -e "$WORKTREE_PATH" ]; then
  echo "Refusing to remove unregistered path: $WORKTREE_PATH" >&2
  exit 1
elif git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" "$BRANCH"
elif git -C "$REPO_ROOT" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git -C "$REPO_ROOT" worktree add --track -b "$BRANCH" "$WORKTREE_PATH" "origin/$BRANCH"
else
  git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$WORKTREE_PATH" origin/main
fi

if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git -C "$WORKTREE_PATH" merge --ff-only "origin/$BRANCH"
fi
```

If any preflight command fails, stop and report the exact branch and worktree path. Do not delete a branch, force-remove a worktree, or clean another path.

### Authoritative docs

Read these from `WORKTREE_PATH` before writing:

- `docs/seo/2026-05-18-seo-strategy-design.md` §3 — Phase 1 topic SEO.
- `docs/seo/STATUS.md` — current phase, published pillar pages, cluster-post count, and task registration state.
- `docs/seo/editorial-calendar.md` — the queue. Its live schema is one fixed-width row per slot, not a Markdown table.
- `docs/BIO_DRAFT.md` and `docs/voice.md` — voice guides.
- `content/writing/*.mdx` — recent shipped posts and frontmatter style.
- `lib/content.ts` — `WritingFrontmatter` schema.
- `docs/adr/0011-writing-post-hyperframes-loops.md` — writing-post loop policy to flag in the draft PR.

### First run only: bootstrap the editorial calendar

If `docs/seo/editorial-calendar.md` is absent, generate 50 rows using its current fixed-width grammar:

```text
<NN>  <YYYY-MM-DD>  <status>  <pillar>  <slug>  <one-line angle>
```

Seed plausible `msme`, `agents`, `rag`, `eng`, and `craft` slots from the strategy and `docs/seo/keywords.json` when present. Commit and push the calendar, then create or reuse one draft PR on `BRANCH` for editorial review. Verify that local HEAD equals the remote branch, remove only the recorded clean worktree, and stop; do not draft a post in the same run.

### Weekly run

1. **Resume before selecting.** Inspect the branch diff against `origin/main` and look for changed `content/writing/*.mdx` files. If exactly one exists, derive `SLUG` from that file and resume its calendar row. If more than one exists, or an existing PR cannot be mapped to exactly one row, stop. Only choose a new row when the branch has no draft file and no PR. Never consume a second slot on a same-date rerun.
2. **Select one slot.** Find the first fixed-width calendar row whose status token is `pending`; record its row number, slug, pillar, and angle. If none exists, update `docs/seo/STATUS.md` §7 with `calendar exhausted — replenish before next run`, commit, push, create or reuse one PR for that status-only change, verify local/remote equality, remove only the recorded clean worktree, and stop.
3. **Draft one MDX file.** Write `content/writing/$SLUG.mdx` with a concise title derived from the selected slug and angle, a one-line dek of at most 120 characters, and `date: $POST_DATE`.
4. **Write the body.** Produce 1200–2000 words with:
   - An “Executive summary” paragraph of at most 200 words at the top.
   - 4–7 H2 subheadings phrased as search questions.
   - At least one internal link to the relevant pillar page; for a pillar post, link to three real sibling cluster posts instead.
   - At least one real related case study under `/work/<slug>`.
   - Code blocks only where technically appropriate; never invent APIs, versions, metrics, or case-study claims.
5. **Commit and push the draft before opening the PR.** Leave the calendar row `pending` until a real PR URL exists. Stage only the selected MDX file. The conditional commit makes a clean resumed run a no-op; the explicit push makes the remote branch available before PR creation.

   ```bash
   git -C "$WORKTREE_PATH" add -- "content/writing/$SLUG.mdx"
   if ! git -C "$WORKTREE_PATH" diff --cached --quiet; then
     git -C "$WORKTREE_PATH" commit -m "feat(content): draft $SLUG"
   fi
   git -C "$WORKTREE_PATH" push -u origin "$BRANCH"
   ```

6. **Create or reuse exactly one draft PR.** First query by head branch so a rerun cannot duplicate it:

   ```bash
   PR_URL="$(gh pr view "$BRANCH" --repo "$GH_REPO" --json url --jq .url 2>/dev/null || true)"
   if [ -z "$PR_URL" ]; then
     DRAFT_SHA="$(git -C "$WORKTREE_PATH" rev-parse HEAD)"
     CALENDAR_URL="https://github.com/$GH_REPO/blob/$DRAFT_SHA/docs/seo/editorial-calendar.md"
     gh pr create \
       --repo "$GH_REPO" \
       --base main \
       --head "$BRANCH" \
       --title "seo-bot: draft $SLUG" \
       --body "Draft for editorial review. Calendar source: $CALENDAR_URL. Writing loop is still pending per ADR-0011." \
       --draft \
       --label "seo:automation" \
       --label "seo:draft"
     PR_URL="$(gh pr view "$BRANCH" --repo "$GH_REPO" --json url --jq .url)"
   fi
   test -n "$PR_URL"
   ```

7. **Persist the real PR URL in a second commit and push it.** In the selected fixed-width row, change only the status token from `pending` to `drafted` and append the trailing annotation `<!-- draft-pr: $PR_URL -->` exactly once. On a resumed run, preserve an identical annotation or replace a stale placeholder; never append duplicates. In `docs/seo/STATUS.md` §7, set this task’s last-run timestamp, `Status: green`, and `Notes: drafted $SLUG — $PR_URL`. Do not increment the published cluster count until the PR merges.

   ```bash
   git -C "$WORKTREE_PATH" add -- docs/seo/editorial-calendar.md docs/seo/STATUS.md
   if ! git -C "$WORKTREE_PATH" diff --cached --quiet; then
     git -C "$WORKTREE_PATH" commit -m "docs(seo): record draft PR for $SLUG"
   fi
   git -C "$WORKTREE_PATH" push origin "$BRANCH"
   ```

8. **Verify remote durability.** A successful run ends only after the PR URL annotation is committed and the remote branch matches local HEAD:

   ```bash
   test -z "$(git -C "$WORKTREE_PATH" status --porcelain)"
   rg --fixed-strings --quiet -- "<!-- draft-pr: $PR_URL -->" "$WORKTREE_PATH/docs/seo/editorial-calendar.md"
   git -C "$REPO_ROOT" fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"
   test "$(git -C "$WORKTREE_PATH" rev-parse HEAD)" = \
     "$(git -C "$WORKTREE_PATH" rev-parse "refs/remotes/origin/$BRANCH")"
   gh pr view "$BRANCH" --repo "$GH_REPO" --json url,isDraft,headRefName
   ```

9. **Remove only the recorded clean worktree.** Run cleanup from `REPO_ROOT`, after all commits and pushes. If the exact worktree is dirty, refuse cleanup and leave it for inspection.

   ```bash
   if [ -n "$(git -C "$WORKTREE_PATH" status --porcelain)" ]; then
     echo "Refusing to remove dirty worktree: $WORKTREE_PATH" >&2
     exit 1
   fi
   git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH"
   ```

### Constraints

- Never push to `main`; use only `BRANCH` and its draft PR.
- Never use wildcard worktree paths, `git worktree remove --force`, `git clean`, or destructive reset commands.
- Never invent technical or biographical claims. Write around an unknown or omit it.
- Match existing posts’ direct voice; avoid LLM hedging such as “might be considered” or “it’s worth noting.”
- Stay under 30 minutes of compute. If the draft is incomplete, keep the MDX as a draft with a `## TODO` section, then follow the same two-commit PR durability sequence.
- On any failure, preserve the exact worktree and report `BRANCH`, `WORKTREE_PATH`, the failed command, and whether local HEAD is pushed.
