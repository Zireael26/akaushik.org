# P2 copy audit — unchanged surfaces after P1 (2026-08-23)

**Date:** 2026-08-23
**Scope:** Report-only audit of user-facing copy **left unchanged after P1**. Covers the six candidates from `agent://P2-copy-scan` re-checked against the current worktree; `content/**/*.mdx` excluded per brief.
**Baseline:** `e47da1f` (`fix(a11y): meet WCAG AA, and make the e2e suite mean something`) — the committed baseline named in `agent://P2-copy-scan` summary.
**Voice:** `docs/voice.md` (seeded 2026-07-09 from `content/writing/trellis*.mdx`; `§1` Identity + audience, `§2` Register, `§4` Vocabulary). Current worktree `docs/voice.md` is identical to `e47da1f:docs/voice.md` (no diff).
**Current worktree:** `HEAD` `ae4c3fd` + uncommitted P1 copy pass (`components/sections/CaseStudyStub.tsx`, `components/sections/Experience.tsx`, `components/sections/Work.tsx`, `lib/about-copy.ts`, `lib/services.ts`) described in `docs/.changelog-fragments/p1-copy-pass.md`. No copy edits applied by this P2 audit.
**Workstation:** `darwin 27.0.0 / arm64 / ghostty 1.3.1`
**Model (runtimeRoute):** `meta/muse-spark-1.2-contributor:xhigh` — resolved from pane status line; matches required `meta/muse-spark-1.2-contributor:xhigh`, so edits proceed per brief. If mismatched, this report would not have been written.
**Mode:** Report-only. No edits to user-facing copy, `docs/voice.md`, `content/**/*.mdx`, existing changelog fragments, or any other files.

## 1. Scope and baseline

This audit is specifically for copy **left unchanged after P1**. It does not re-litigate strings P1 already changed and does not propose edits to `content/**/*.mdx`.

- **Read:** `docs/voice.md` (verbatim rules), `agent://P2-copy-scan` (6 candidates, each with `file:line` / `currentString` / `ruleQuote` / `proposedRewrite` / `grounding`, `runtimeRoute: google/gemini-3.7-flash:high`), and current worktree diff (`git diff` / `git diff --stat` / `git show e47da1f:<path>`).
- **Panel input:** The 3-vote refutation matrix is unanimous per brief: CAND-01 reject, CAND-02 keep, CAND-03 keep, CAND-04 reject, CAND-05 reject, CAND-06 reject (each 3/3).
- **Overlap rule:** A candidate that passed the panel against baseline but is no longer unchanged in the worktree is excluded from the accepted unchanged-copy table and its disposition is recorded explicitly (CAND-03, see §3). A candidate that remains unchanged after deliberate reversion but failed the panel is recorded as rejected unchanged (CAND-04, see §3).
- **No invented facts:** No new strings, no new rule quotes, no `content/**/*.mdx` findings. All `currentString` / `ruleQuote` / `proposedRewrite` / `grounding` values below are verbatim from `agent://P2-copy-scan`; file contents were verified by `read` at the cited `file:line`.

## 2. Accepted unchanged-copy finding (1)

Exactly one candidate is both (a) kept by the 3/3 panel and (b) still unchanged in the worktree after P1. That is the accepted unchanged-copy finding for this audit. No other candidate qualifies for this table.

| Candidate | File:Line (baseline `e47da1f`; still unchanged in worktree) | Current string (verbatim) | Rule (exact quoted `docs/voice.md` text) | Proposed rewrite (grounded, verbatim from scan) | Grounding (verbatim from scan) |
|---|---|---|---|---|---|
| CAND-02 | `components/sections/Experience.tsx:40` | `<strong>Bluehost &middot; agents framework.</strong> Platform engineer. A hand in maintaining and continuously improving the foundational platform behind Bluehost&rsquo;s agentic AI products. The specifics are under confidentiality.` | `First person singular throughout. Never an editorial "we". Mid-formal, conversational-precise. Complete-thought prose; no slang, no academic hedging.` | `<strong>Bluehost &middot; agents framework.</strong> Platform engineer. I work on maintaining and improving the foundational platform backend behind Bluehost&rsquo;s agentic AI products. The specifics are under confidentiality.` | `docs/voice.md §1 & §2 (first-person singular complete prose rather than resume hedging) and lib/about-copy.ts line 17 ("Now: Bluehost · agents framework backend")` |

Notes on CAND-02:

- **Still unchanged:** `git diff e47da1f -- components/sections/Experience.tsx` shows the only P1 change in that file is the intro paragraph (`Six years … The day work` → `Six years … My day work` at `Experience.tsx:33`); the `RuledRow` at line 40 is identical to `e47da1f:components/sections/Experience.tsx:40-42` and to the `currentString` above (verified by `read` at `components/sections/Experience.tsx:39-43`).
- **Rule anchoring:** `docs/voice.md §1` (“Abhishek Kaushik, writing in first person … The speaker is a solo operator … Not a vendor, not a team blog: one person's machine, one person's receipts.”) and `§2` (“First person singular throughout. Never an editorial "we".” / “Mid-formal, conversational-precise.”) — the `currentString` uses resume hedging (“A hand in maintaining and continuously improving”) rather than first-person complete-thought prose.
- **No edit applied:** Per brief, this P2 audit is report-only. The rewrite is recorded here for a future copy pass; no file was edited.

## 3. Decision record — six-candidate 3-vote refutation matrix (unanimous, 3/3 each)

Compact table of all six candidates with panel vote counts and overlap disposition. “Overlap disposition” states how the P1 worktree affects whether a panel-kept finding counts as an *unchanged-copy* acceptance.

| Candidate | File:Line | Surface | Panel verdict | Votes | Overlap disposition | Detail |
|---|---|---|---|---|---|---|
| CAND-01 | `lib/about-copy.ts:13` | About `paragraphs[0]` (MSME paragraph) | **reject** | 3/3 reject (0 keep / 3 reject) | **rejected — no action** | Panel rejected the hype-adjective / em-dash-rationing claim against `docs/voice.md §4` (“No exclamation marks, no hype adjectives… em-dashes are rationed…”). Stays out of accepted table. Worktree `lib/about-copy.ts:13` was already changed by P1 (em-dashes → periods/commas per `p1-copy-pass.md`), so it is also not an unchanged surface. No invented replacement; scan `proposedRewrite` retained only in scan artifact. |
| CAND-02 | `components/sections/Experience.tsx:40` | Experience `RuledRow` — Bluehost | **keep** | 3/3 keep (3 keep / 0 reject) | **accepted unchanged — sole row in §2** | Unanimous keep; still unchanged after P1 (see §2). The one accepted unchanged-copy finding for this audit. |
| CAND-03 | `components/sections/Work.tsx:67` | Work `CASE_STUDIES[03].lede` — Bluehost agents | **keep** | 3/3 keep (3 keep / 0 reject) | **excluded from accepted unchanged table — P1 overlap** | **Passed the panel against baseline** on the same `§1 & §2` first-person rule as CAND-02, but **must be excluded from the accepted unchanged table because P1 already changes that `Work.tsx` lede.** Baseline `e47da1f:components/sections/Work.tsx:67` was `Where AI agents meet web-hosting reality — customer scale, production uptime, and real users with real bills. A major hand in maintaining and continuously improving the platform.`; current worktree `components/sections/Work.tsx:67` is `Where AI agents meet web-hosting reality: customer scale, production uptime, and real users with real bills. I have a major hand in maintaining and continuously improving the platform.` (em-dash → colon, `A major hand` → `I have a major hand`, per `git diff e47da1f -- components/sections/Work.tsx`). Panel verdict was correct against baseline, but the surface is no longer unchanged, so it does not count as an unchanged-copy acceptance here. Stated explicitly per brief. |
| CAND-04 | `components/sections/Hero.tsx:26` | Hero subtitle | **reject** | 3/3 reject (0 keep / 3 reject) | **rejected — remains unchanged after deliberate reversion** | Panel unanimously rejected the `§1` solo-operator / “receipts in the open” rewrite (`Building agent systems and operational AI in the open`). **Hero remains unchanged after deliberate reversion** — `git diff e47da1f -- components/sections/Hero.tsx` is empty and `components/sections/Hero.tsx:26` is still `An engineer for businesses that haven&rsquo;t met AI yet`, identical to `e47da1f`. The corrected P1 fragment omits Hero and records only the nine copy edits still present in the worktree. Failed 3/3, so no accepted finding despite being unchanged. |
| CAND-05 | `components/sections/CaseStudyStub.tsx:46` | Work stub notice (`full story` line) | **reject** | 3/3 reject (0 keep / 3 reject) | **rejected — no action** | Panel rejected the `§2 & §4` diction claim (`full story` → `full write-up`). Worktree `CaseStudyStub.tsx:46-48` was changed by P1 only for em-dash rationing (`available on request — scope` → `available on request. Scope`); the `full story` wording (the CAND-05 surface) remains as `for the full story.` but the panel rejected the finding, so no accepted finding. |
| CAND-06 | `app/layout.tsx:46` | `metadata.description` (SEO / OG) | **reject** | 3/3 reject (0 keep / 3 reject) | **rejected — no action** | Panel rejected the `§1` “one person's machine, one person's receipts” / “in the open” register claim for the metadata description (`Independent engineer building agent-native software…`). `git diff e47da1f -- app/layout.tsx` is empty; surface is unchanged but panel found no voice violation warranting change. |

Summary counts: 6 candidates reviewed; panel: 2 keep / 4 reject (each 3/3 unanimous); **accepted unchanged-copy findings: 1 (CAND-02)**; excluded due to P1 overlap: 1 (CAND-03); rejected unchanged or otherwise not accepted: 4 (CAND-01, CAND-04, CAND-05, CAND-06).

## 4. Method and constraints

- Compared each candidate’s `currentString` against `e47da1f:<file>` and the current worktree file at that `file:line` (via `read` and `git show`/`git diff`) to determine whether the surface is still unchanged after P1.
- Cross-checked each `ruleQuote` against `docs/voice.md` §§1–6 verbatim; cross-checked each `grounding` against the cited `docs/voice.md` section and sibling file (`lib/about-copy.ts:17`, etc.) without introducing new citations.
- Applied the unanimous 3-vote refutation matrix per brief; no vote was altered, no additional candidate was introduced, and no `content/**/*.mdx` file was read or cited.
- Produced no copy edits. Uncommitted P1 changes were treated as ground truth for “unchanged after P1” (per harness rule: user-reported / worktree-observed state is ground truth).
- No formatters, linters, builds, tests, or servers were run per brief.

## 5. Residuals

- CAND-02 remains the single actionable unchanged-copy item; its grounded rewrite is recorded in §2 for a future copy pass. No other unchanged surface from this scan warrants a change per the unanimous panel.
- CAND-03’s panel-kept rewrite is already satisfied in the worktree by P1’s first-person edit to `Work.tsx:67`; no duplicate edit is needed.
- CAND-04’s Hero subtitle is intentionally left as baseline after reversion; panel found no voice breach, so no change is proposed despite being unchanged.
