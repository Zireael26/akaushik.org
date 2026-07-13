# Editorial backlog — drafts batch 1

The original May 2026 publication cadence for PR [#81](https://github.com/Zireael26/akaushik.org/pull/81) has elapsed. Treat this file as the current backlog, not a calendar. The three writing pieces have shipped; the ClusterBid case study remains draft-only and invisible to production.

This file is disposable — delete it once every row below is shipped or dropped.

## Current backlog

| Status | Slot | Piece | Next action |
|---|---|---|---|
| done | infra | [PR #80](https://github.com/Zireael26/akaushik.org/pull/80) — commits widget fix + draft system | No action |
| needs prose | case study | `content/case-studies/clusterbid.mdx` + `components/sections/Work.tsx` | Finish prose, fill role, add Work row, and ship the matching reel entry |

The `Refresh GitHub stats` workflow daily cron is on the same calendar; no action needed there.

## ClusterBid case study — extra work to do at flip time

The skeleton in `content/case-studies/clusterbid.mdx` carries section headers + italic prompts only. Before flipping `draft: true` → `draft: false`:

1. Write prose under each section (Context / Problem / Approach / What shipped / Scope).
2. Fill the `role:` frontmatter field with the real role (placeholder today).
3. Extend `ReelSlug` in `components/work/reels.tsx` to include `'clusterbid'` and add a matching reel component + entry in the reels map.
4. Replace the TODO comment in `components/sections/Work.tsx` with the actual `CASE_STUDIES` entry (template in the TODO comment).
5. Optional: produce a HyperFrames reel under `scripts/hyperframes/` for `clusterbid` (ADR-0011 policy — non-visual posts can defer).

## Why drafts in the repo at all

Two reasons. First, every piece passes typecheck/lint/test against the production toolchain — there's no "preview branch" or staging site to keep in sync. Second, the drafts are searchable, diffable, and reviewable by future-me through plain `git log`; an external draft service (Notion, Drafts.app) loses that.

The cost: a `_test-draft.mdx` fixture lives in `content/writing/` to exercise the filter, and the slug `_test-draft` appears in `getAllPosts(..., { includeDrafts: true })` results. Both are intentional.
