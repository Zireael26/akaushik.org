---
slug: process-gate-policy
purpose: Pre-commit and CI gate coupling code, structural/config, and EPM changes to documentation; scripts/process-gate.mjs exposes SKIP_PROCESS_GATE as an emergency bypass.
pinned_to: 883e508dd3e7e4c7b3247ebcb575228c6840b5bd
created: 2026-05-15
last_refreshed: 2026-10-03
related_primers: []
---

# Process Gate Policy

## Purpose

Require paired documentation for selected code, structural/configuration, and EPM changes. `.husky/pre-commit` runs the gate locally, and CI runs the same script against the PR base.

## Entry points

- `.husky/pre-commit` — shell hook; runs `pnpm run process:check` when that script exists. It does not run `lint-staged`.
- `scripts/process-gate.mjs` — reads changed paths using `git diff --cached --name-only --diff-filter=ACMRD`, or `${PROCESS_GATE_DIFF_BASE}..HEAD` when the env var is set; applies three rules and exits 0/1/2.
- `package.json` — registers `process:check` as `node scripts/process-gate.mjs`.
- `.github/workflows/ci.yml` — runs the same script against the PR base via `PROCESS_GATE_DIFF_BASE`.
- `docs/adr/0002-process-gate-policy.md` — accepted policy rationale; read before changing rule semantics.
- `docs/adr/0009-se-core-onboarding-husky-vitest.md` — context on Husky adoption and hook migration.
- `.agents/skills/process-gate-local/validate-web-next.sh` and `.claude/skills/process-gate-local/validate-web-next.sh` — project-local checks for proxy wiring, pinned Actions, package-age settings, selected security/stale-pattern checks, and docs/primer indexes.

## Data flow

1. Husky fires `.husky/pre-commit`. `set -e` makes command failures abort the commit; the hook invokes `process:check` when the package script exists.
2. `pnpm run process:check` invokes `scripts/process-gate.mjs`. If `SKIP_PROCESS_GATE=1` is set, the script logs a bypass warning and exits 0 immediately.
3. Local mode reads the staged index paths. In CI, `PROCESS_GATE_DIFF_BASE` selects `${base}..HEAD`, so the same rules run on the PR diff.
4. Rules evaluate the path list:
   - **R1:** any path under `app/`, `components/`, `lib/`, `scripts/`, or `content/` requires `docs/CHANGELOG.md` staged.
   - **R2:** changes to `next.config.*`, `middleware.*`, `proxy.*`, `package.json`, `tsconfig.json`, or `eslint.config.*` require a staged `docs/adr/####-slug.md` file or `docs/CHANGELOG.md`.
   - **R3:** changes under `docs/epm/` require `docs/ROADMAP.md` staged.
5. Violations print `R<n>:` messages and exit 1; invocation errors (for example, a failed `git diff`) exit 2. An empty path set logs `process-gate: no staged changes.`; otherwise success logs `process-gate: N staged file(s) — OK.`.

## Dependencies

- `git` — supplies the path list; local mode reads the index, CI mode diffs the selected base against `HEAD`.
- `node:child_process` (`execFileSync`) — invokes git.
- Husky `^9.1.7` — package `prepare` runs `husky`; `.husky/pre-commit` invokes the gate.

## Test commands

```bash
# Dry-run against the current staged set
pnpm run process:check

# Simulate CI mode (diff a branch against main rather than the index)
PROCESS_GATE_DIFF_BASE=origin/main pnpm run process:check

# Project-local Trellis validator
bash .agents/skills/process-gate-local/validate-web-next.sh

# Emergency bypass — logs a warning, exits 0
SKIP_PROCESS_GATE=1 pnpm run process:check

# Force the hook to run (without committing)
.husky/pre-commit
```

To exercise an end-to-end failure: stage a `.ts` file under `app/` without touching `docs/CHANGELOG.md` and run `pnpm run process:check`. Expect exit 1 and an `R1:` line.

## Gotchas

- **`SKIP_PROCESS_GATE=1` is logged, not silent.** The bypass writes to stderr, so the audit trail captures every emergency commit. Don't try to hide it.
- **R2 accepts CHANGELOG-only.** ADR-0002's rationale is that tiny structural follow-ups (e.g. a `tsconfig` `moduleResolution` tweak) need not force a new ADR if the entry references an existing ADR number. The script checks that a CHANGELOG or ADR path is staged; it does not inspect the CHANGELOG for an ADR reference — that's reviewer discipline.
- **R1 fires on `content/` too.** MDX edits count as code-equivalent because they ship as content. A typo fix in `content/writing/foo.mdx` needs a CHANGELOG line, same as any code edit.
- **The pre-commit hook does not run `lint-staged`.** It invokes `process:check` when the package script exists.
- **Diff filter `ACMRD` excludes type-change-only entries (`T`)** and unmerged paths (`U`). Realistic edge case: a symlink swap won't trigger the gate. Not currently a concern — flag it if symlinks enter `app/`.
- **The hook does not resolve a canonical repo root.** It invokes the package script from the commit's working directory; the gate's local `git diff --cached` reads that worktree's index.
- **Exit code 2 means invocation error**, not a policy violation. If `git diff` itself fails, the gate fails-closed; check `git status`.

## Out of scope

- Push-time policy. This gate runs at pre-commit and in CI; the process-gate script evaluates paths and does not determine server-side push acceptance. There is no local pre-push hook (`.husky/` holds only `pre-commit`); direct pushes to `main` are refused by GitHub branch protection server-side (`docs/seo/scheduled-tasks/seo-redirect-health.md:52`).
- Other CI checks beyond the process gate; `.github/workflows/ci.yml` shows the suite, build, and gate configuration.
- Doc content quality (CHANGELOG style, ADR template adherence) — the gate checks staged paths, not what the documents say.

## Notes

- The policy as written assumes solo-author workflow. Multi-author scenarios (rebases, cherry-picks across branches) might surface friction; revisit when a collaborator joins.
- `CODE_PATHS` (`scripts/process-gate.mjs:52`) covers only `app|components|lib|scripts|content`, and `STRUCTURAL` (`:53-54`) omits `wrangler.jsonc` and `open-next.config.ts`. The existing `worker/` (production Cloudflare adapter) and `workers/akaushik-dev-redirect/` are therefore NOT covered today: the gate fails open on them. Extending either regex is a gate-policy change (CHANGELOG + review).
