# Handoff — finish stream C, then stop (feat/shipit)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
Worktree: `/Users/abhishek/projects/personal/akaushik.org-worktrees/shipit`, branch `feat/shipit`.
**Never touch the main checkout. Never touch a sibling worktree.**

This brief replaces the previous foreman session, which ran on Grok and is out of quota.
You are its successor, not its reviewer. Read `HANDOFF-SHIPIT.md` for the rules of the game —
it is the specification and it has not changed.

## Where the five streams stand

| Stream | Branch | Head | State |
|---|---|---|---|
| A writing | `feat/writing-detail` | `67ffb57` | **done**, apex-verified green, accepted |
| B cursor | `feat/cursor-snap` | `bc642e7` | **done**, apex-reviewed, accepted |
| C ship-it | `feat/shipit` | `374f178` | **yours**, U1–U3 done, U4/U5 open |
| D services | `feat/services` | `50c301b` | **done**, apex-reviewed, accepted |
| E stats | `feat/stats` | `c50b8c9` | **done**, apex-reviewed, accepted |

Only C is open. Do not open, read into, or modify any other branch.

## What is uncommitted in this worktree right now

```
 M components/pixel/ShipItGame.tsx
 M e2e/home.spec.ts
 M lib/scenes/shipit.ts
?? e2e/shipit.spec.ts
```

That is the previous session's in-flight U4. Inherit it. Read it before you extend it —
do not discard it and do not assume it is correct.

## U4 — the browser contract

`e2e/shipit.spec.ts` must assert the behaviours a unit test cannot reach:

1. **Corner-stuck.** Hold a direction into a wall; the player stops and stays stopped, holding
   the desired direction, and turns the instant that direction becomes legal. It must never
   bounce back and never auto-reverse. This is the operator's first-named defect — the test
   must fail if the behaviour regresses.
2. **Cornering asymmetry.** The player may cut a corner before the tile centre; ghosts may not.
3. **Warp tunnel** wraps, and ghosts are slower inside it.
4. **Mount/dispose.** Navigating away and back leaves no stray rAF loop, no stray listener and
   no second canvas.
5. **Reduced motion.** Under `prefers-reduced-motion: reduce` the section renders a still,
   readable state and starts no animation loop. Follow the shape of `e2e/reduced-motion.spec.ts`.

A test you cannot break by inverting the requirement is not a test. Before you call U4 done,
invert one assertion, watch it fail, and put it back.

## U5 — receipts

- `pnpm typecheck`, `pnpm lint`, `pnpm test` — capture the real exit codes. Do not pipe to
  `tail` and read the pipeline's status; that mistake has already been made once on this project.
- `pnpm build && pnpm start`, then `pnpm test:e2e`. Report pass counts, not exit codes alone.
- `pnpm process:check` must be green. A code change under `app/`, `components/`, `lib/`,
  `scripts/` or `content/` requires a `docs/CHANGELOG.md` entry — write a real one that names
  what actually changed. **Never** set `SKIP_PROCESS_GATE=1` and never bypass a hook.
- A short GIF of actual play: eat dots, get chased, use an energizer, die once. Save it under
  the worktree and name the path in your report.

## Commit policy

Commit at every phase boundary, in this worktree, through the hooks. An uncommitted tree on a
dead session is the exact failure this arrangement exists to prevent. Workers do not commit —
you do.

## Hard stops — apex only, no exceptions

No deploy. No merge. No push to `main`. No PR. No secrets, tokens, `.env`, or credential
handling of any kind. No scope change: if you think C needs something outside this brief,
say so in the pane and wait.

## Report

When U4 and U5 are done, post: the commit SHA, each receipt command with its real exit code
and pass count, the GIF path, and anything you could not verify. Do not self-accept — the apex
accepts.
