import next from 'eslint-config-next';

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    // eslint-config-next ignores `.next/**` relative to the project root only —
    // worktree copies under `.claude/worktrees/*/.next/` were not covered and
    // contaminated `pnpm lint` with 700+ false-positive errors from stale build
    // artefacts. `_reference/` is the frozen Claude Design prototype and is
    // intentionally outside the lint surface.
    ignores: [
      '.claude/worktrees/**',
      '_reference/**',
      '.next/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  ...next,
  {
    rules: {
      // Portfolio-specific overrides go here. Keep the list tight — every override
      // has a reason. Empty is fine.
    },
  },
];

export default config;
