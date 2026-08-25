# Master handoff — five streams on akaushik.org

Apex: Claude Code, pane `w4:p1`. Main checkout `/Users/abhishek/projects/personal/akaushik.org` —
**never touch it.** You are the foreman for all five streams below. Dispatch workers into the named
worktrees; each has its own branch off `origin/main` (4e5082a) and its own detailed brief on disk.

Repo context: Next.js 16 + React 19 + Tailwind 4, deployed to **Cloudflare Workers** via
`@opennextjs/cloudflare`. Production is `akaushik.org`; `beta.akaushik.org` is the staging worker.
`pnpm` only. Read the worktree's `CLAUDE.md` and `gotchas.md` before writing anything.

---

## Streams

| # | Worktree | Branch | Brief on disk |
|---|---|---|---|
| A | `…-worktrees/writing-detail` | `feat/writing-detail` | `HANDOFF-WRITING.md` |
| B | `…-worktrees/cursor-snap` | `feat/cursor-snap` | `HANDOFF-CURSOR-SNAP.md` |
| C | `…-worktrees/shipit` | `feat/shipit` | `HANDOFF-SHIPIT.md` (this dir) |
| D | `…-worktrees/shipit` → **create a new worktree** `services` off main | `feat/services` | below |
| E | `…-worktrees/shipit` → **create a new worktree** `stats` off main | `feat/stats` | below |

All worktrees live under `/Users/abhishek/projects/personal/akaushik.org-worktrees/`. Create D and E
with `git worktree add` from the main checkout's git dir — but run the command from an existing
worktree, not from the main checkout working tree.

A, B and C are independent and should run in parallel. D and E are independent of everything.

**Every other `HANDOFF-*.md` in these worktrees is stale** — they are tracked leftovers from earlier
rounds that already shipped (`HANDOFF-ARCADE.md`, `HANDOFF-ART.md`, `HANDOFF-CURSOR.md`,
`HANDOFF-DEDUPE.md`, `HANDOFF-ENGINES.md`, `HANDOFF-GLYPHS.md`, `HANDOFF-PAGES.md`,
`HANDOFF-ROUTES.md`, `HANDOFF.md`). Read only the five briefs named in the table above.

---

## Stream D — rethink the services section

Operator, verbatim:

> We also need to rethink the whole three engagement shapes. I believe you can go to the Trellis
> instance repo and see:
> - the kind of things that we actually work with every day
> - how we follow the process that we have with our very strict and amazing quality software
>   engineering process
> - how we manage everything
>
> This looks like some rookie stuff, while the work that we actually do is a lot better in quality.
> We need to redo this section. We need to completely rethink this and come up with a new thing.

The current section is `components/sections/` — find the "Three engagement shapes" block. The
complaint is that it reads as generic freelancer packaging while the actual work is an unusually
disciplined engineering system.

**Research first, at `/Users/abhishek/projects/trellis-instance`.** Read for real; do not skim.
Look at `engineering-process.md`, the `specs/` triads, `core-rules/`, the hook tiers, the
mandatory-pipeline gate, the autonomy slider, the DoD-receipt contract, the multi-fleet registry.
Then look at how a managed project actually uses it — `akaushik.org`'s own `docs/adr/`, `specs/`,
`docs/CHANGELOG.md` are a live example.

Then **propose, do not build**. Write a short proposal to `PROPOSAL-SERVICES.md` on `feat/services`
covering: what the section should say, what shape it takes on the page, and two or three concrete
alternatives with a recommendation. The apex takes it to the operator for approval before any
implementation. Do not write the component until that approval comes back.

**Hard constraint on content**: never assert a fact about Abhishek that is not already sourced in
one of these repos — no employer, date, title, client, headcount, or metric you cannot point at.
If a claim would be stronger with a number and you do not have the number, write it without the
number. Invented specificity is the failure mode here.

---

## Stream E — daily contribution stats without GitHub Actions

Operator, verbatim:

> The data here is 10 days old at least. Right now, we have way over 13,000 commits, and this
> should be refreshing every day. If you want to use some cloudflare feature to get this data, of
> course, if it's available for free, then let's switch to that instead of doing it through GitHub
> Actions.

**Root cause, already diagnosed — do not re-investigate.** `public/data/stats.json` has
`generatedAt = 2026-08-13T05:50:08.537Z`. A daily workflow exists (`17 4 * * *`) and every one of
the last eight runs failed with:

```
::error::GH_STATS_TOKEN is not configured; it must read the contribution sources and
create the data-only automation PR.
```

The secret was never set. The workflow is fine; its input is missing.

**Build the Cloudflare replacement.** The site already runs as a Worker, and the Workers free plan
includes Cron Triggers and KV. So:

- Add a cron trigger (daily) to the existing worker config in `wrangler.jsonc`.
- On the cron, fetch the contribution data from GitHub's GraphQL API and write the normalized blob
  to KV.
- Serve the stats from KV, falling back to the checked-in `public/data/stats.json` **only as a
  visibly-degraded path** — per the house rule, a fallback must be distinguishable from success.
  If KV is empty or stale, the UI must say the data is stale and when it was last good, not
  silently render an old number as if it were measured. This matters: the operator noticed the
  staleness precisely because nothing told them.
- Keep the GitHub Actions workflow removal as a **separate final commit**, after the Worker path
  is proven, so rollback is one revert.

**Secrets are not yours.** A GitHub token is still required — GitHub's GraphQL API needs auth even
for public contribution counts. Write the code to read it from the Worker's environment binding,
document the exact `wrangler secret put` command in the PR body, and **stop there**. Do not create,
read, guess, or place a token in any file. Do not touch `.env*`, `local.env`, tfvars, or
`wrangler.jsonc` secret values. The apex and the operator handle that step together.

Deliverable: the Worker code, the KV binding config, the degraded-state UI, tests, and a PR body
naming the one operator command needed to finish it.

---

## Rules that bind every stream

- **Never** `SKIP_PROCESS_GATE=1`. If a gate blocks you, fix the cause or escalate to the apex.
- **Never hard-code a hex.** Palette from `lib/pixel.ts`, theme from `lib/pixel-theme.ts`, tokens
  from `app/styles/tokens.css`.
- Small-screen CSS goes in `app/styles/sections/_mobile.css`, imported **last**. `_shared.css` is
  imported first and loses the cascade to every section file — this has already cost a day once.
- Commit at every phase boundary. An uncommitted multi-thousand-line tree on a dead session is the
  failure this whole arrangement exists to prevent.
- Repo commit voice: terse, lowercase scope, no `Co-authored-by`, no generated-with footers.
- **Do not deploy, do not merge, do not push to `main`.** The apex owns git boundaries. Push your
  feature branch; that is the handoff.
- Receipts are executed commands with output, not self-report. For anything visible, attach a
  screenshot or GIF — the operator has rejected visual work twice by looking at it.

## Reporting

Checkpoint to the apex at each stream's phase boundaries: what shipped, the receipt output, and
anything you could not do and why. Flag blocked-on-operator items immediately rather than
parking them.
