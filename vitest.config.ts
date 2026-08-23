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
      // `.trellis/runtime` is a symlink to the shared immutable Trellis release
      // (~/.trellis/releases/<version>/payload), added by the portable-manifest
      // migration in 4585ec6. The include glob follows it and runs the
      // toolchain's own hook tests as if they were this project's — they fail
      // here because the hook subprocesses don't find `jq` on their PATH, and
      // the suite reports zero tests. Those tests belong to the release, not to
      // akaushik.org, and nothing in this repo can fix them: the payload is
      // immutable and shared by every attached project.
      '**/.trellis/**',
    ],
    coverage: {
      provider: 'v8',
      // The production monitor's validation/request core and full CLI contract
      // are coverage-gated through an injected in-process transport.
      include: ['lib/**/*.ts', 'scripts/check-production-lib.mjs', 'scripts/check-production.mjs'],
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

        // Generated. `lib/mdx/generated/**` is emitted by
        // scripts/build-mdx-modules.ts on every prebuild/pretest and is not
        // checked in; measuring coverage of a file this repo does not author
        // says nothing about this repo.
        'lib/mdx/generated/**',

        // The canvas mount engines. Each one is `mount(canvas) => dispose`:
        // it reads element geometry and devicePixelRatio, attaches listeners,
        // opens a requestAnimationFrame loop and paints. There is no return
        // value to assert on and no seam that is not the DOM itself, so a
        // vitest "test" of these would be a test of a jsdom canvas stub —
        // green regardless of whether the real thing draws anything.
        //
        // They are covered, and by the only thing that can cover them:
        // e2e/canvas.spec.ts asserts each field mounts and is sized by the
        // engine rather than left at the 300x150 HTML default, and
        // e2e/reduced-motion.spec.ts samples the canvas twice a second apart
        // to prove it moves when motion is allowed and holds still when it is
        // not. That is a stronger claim than any unit test here could make.
        //
        // Deliberately narrow: this excludes the mount engines and NOT the
        // pure drawing functions beside them. `lib/pixel/sources.ts`,
        // `stages.ts` and `neural.ts` are ordinary functions over a 2D context
        // and stay in scope — they are undertested today, and the fix for that
        // is tests, not a wider exclusion.
        'lib/scenes/**',
        'lib/pixel/field.ts',
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
