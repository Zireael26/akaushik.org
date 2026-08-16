# Scheduled task: `seo-quarterly-flagship`

**Cadence:** 1st of January / April / July / October, 06:00 local time
**Purpose:** Propose a flagship-post topic for the new quarter — long-form (≥3000 words), original data or case-study depth, designed to be the inbound-link magnet that lifts the surrounding topic cluster.

> Source-of-truth prompt. To change: edit this file + `mcp__scheduled-tasks__update_scheduled_task` with `taskId: "seo-quarterly-flagship"`.

---

## Prompt content

You are the `seo-quarterly-flagship` scheduled task for akaushik.org. Run 1st of Jan/Apr/Jul/Oct at 06:00 local. Fresh context.

**Repo location:** the akaushik.org checkout named by the registered prompt (`<REPO_ROOT>`; confirm with `git rev-parse --show-toplevel` from inside it). Work in a fresh worktree at `.claude/worktrees/seo-flagship-<YYYYQN>` on branch `seo-bot/flagship/<YYYYQN>`.

**Authoritative docs:**
- `docs/seo/2026-05-18-seo-strategy-design.md` §3.3 — flagship cadence table (candidates by quarter).
- `docs/seo/STATUS.md` §3 — current metrics; look for movement in top-10-ranking-queries count, llms-full.txt byte growth, etc.
- `docs/seo/editorial-calendar.md` — see which clusters have been published recently.
- `content/case-studies/*.mdx` — source material for case-study-driven flagships.
- `content/writing/*.mdx` — existing posts; a flagship may be the "extended deep-dive" version of an existing post.

**Procedure:**

1. Determine current quarter (e.g., 2026-Q3 if it's July 2026).
2. Read §3.3 of the spec; find the row for the current quarter. That's the proposed flagship title.
3. Cross-reference with `STATUS.md` Metrics: if a different cluster is showing momentum (more top-10 queries), propose THAT cluster's flagship instead — note your reasoning.
4. Draft a flagship brief at `docs/seo/flagships/<YYYYQN>-<slug>.md` containing:
   - **Working title** (sharpened from the spec's candidate)
   - **Target queries** (5–10 problem-shaped queries this flagship will rank for)
   - **Target audience** (which buyer persona from `docs/PRD.md`)
   - **Outline** (8–12 H2 sections, each with one sentence of intent)
   - **Required source material** (which case study, ADRs, MDX posts, external papers)
   - **Open questions for Abhishek** (decisions only he can make — e.g., what production numbers can be shared)
   - **Estimated word count** (≥3000)
   - **Ship-by date** (last week of the quarter)
5. Update `docs/seo/STATUS.md` §1 Phase 1 row for the relevant flagship: change `[ ]` to `[~]` (in-progress), add link to the brief.
6. Update §7 Automation health row for `seo-quarterly-flagship`: `Last run` ISO, `Status: green`, `Notes: proposed <slug>`.

**Commit & PR:**

Commit on `seo-bot/flagship/<YYYYQN>` with message `docs(seo): propose <YYYYQN> flagship — <slug>`. Open PR via `gh pr create --title "seo-bot: <YYYYQN> flagship proposal — <slug>" --body "<summary of the brief; link to docs/seo/flagships/<YYYYQN>-<slug>.md; list of open questions for Abhishek>" --label "seo:automation,seo:flagship"`.

**Constraints:**
- Never push to `main`.
- Never invent production data. If the brief needs a specific number (latency, cost, traffic) Abhishek hasn't published, list it under "Open questions" rather than guess.
- Stay under 15 minutes of compute.
- This task proposes; it does not write the flagship post itself. The actual writing happens via PR Abhishek opens (optionally seeded by `seo-weekly-draft` for the slot that overlaps the flagship's ship-by date).
