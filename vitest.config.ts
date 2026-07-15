import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's `@/*` -> `./*` so app/ + lib/ modules that
    // import via the `@/` alias (e.g. app/sitemap.ts -> @/lib/content)
    // resolve under vitest the same way they do under Next's bundler.
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    include: ['**/*.test.{ts,tsx,mjs}'],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/e2e/**',
      '**/*.spec.{ts,tsx}',
      '**/.claude/worktrees/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      // about-copy + services are pure data constants; stats reads JSON at
      // module load; mdx-options + structured-data fall back to defaults
      // that fire only inside RSC rendering. Skip the data-shaped modules
      // so coverage thresholds reflect real branching logic rather than
      // const literals + config plumbing.
      exclude: [
        'lib/**/*.test.ts',
        'lib/about-copy.ts',
        'lib/services.ts',
        'lib/stats.ts',
        'lib/mdx-options.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 75,
        // content.ts has a YAML bullet-list path the current corpus does
        // not exercise (every case-study uses inline arrays). Branches
        // floor set at the natural coverage from the corpus + a small
        // margin; raise to 75 once a bullet-list test lands.
        branches: 55,
        functions: 75,
      },
    },
  },
});
