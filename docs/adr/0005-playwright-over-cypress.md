# ADR 0005 — Playwright for E2E smoke tests (over Cypress and Vitest/happy-dom)

**Status:** Accepted · 2026-04-20

## Context

Phase 3 calls for an end-to-end smoke suite that catches regressions in user-visible behaviour — sections visible, nav anchor scroll, theme toggle, `prefers-reduced-motion` respected, MDX detail pages routing correctly. The plan picks one tool and wires it into CI.

Three real options were on the table:

1. **Playwright (`@playwright/test`).** Multi-browser (Chromium / Firefox / WebKit), ships its own test runner, first-class TypeScript, first-party GitHub Action, widely used inside Next.js + Vercel toolchains.
2. **Cypress.** Single-browser core (Chromium-family; Firefox + WebKit behind experimental flags or a paid runner in late 2025). Strong local DX. Historically bottlenecked tests into a single-tab, same-origin architecture — a recurring friction with the modern web.
3. **Vitest + happy-dom (or jsdom).** Runs in Node with a simulated DOM. Much faster per test, but isn't an end-to-end test — it doesn't exercise the rendered HTML that Vercel serves, doesn't exercise Shiki's server-rendered highlights, and doesn't flush `prefers-reduced-motion` through the actual browser layer.

## Decision

Use **Playwright** as the end-to-end runner.

Install footprint:

- `@playwright/test@^1.61.1` — runner + assertion library.
- `@axe-core/playwright@^4.12.1` — axe-core integration, for the accessibility assertion in `e2e/home.spec.ts`.

Suite layout (`e2e/*.spec.ts`):

- `home.spec.ts` — eight sections present, primary nav anchor scroll, axe-core clean on the home page.
- `work.spec.ts` — home card grid lists all five published slugs; case-study detail and Markdown alternates render without broken media.
- `theme.spec.ts` — `html[data-mode]` flips, `localStorage['abhishek.portfolio.mode']` persists, flip-back is idempotent.
- `reduced-motion.spec.ts` — marquee `animation-name` or `animation-play-state` resolves to a no-op under `reducedMotion: 'reduce'`.

Browser matrix (`playwright.config.ts`): Chromium / Firefox / WebKit on desktop (1440×900), Chromium on tablet (768×1024), and Mobile Safari emulation with an explicit 375×667 viewport matching the PRD contract. Playwright's `iPhone SE` descriptor supplies the touch/browser behavior but defaults to 320×568, so the config overrides only its viewport. The full Cartesian product is overkill for a static content site — three desktop browsers cover cross-engine rendering, Chromium covers the tablet breakpoint, and mobile WebKit covers the narrow touch layout in Safari's engine.

CI wiring (`.github/workflows/e2e.yml`): on `pull_request`, install dependencies and Playwright browsers, run `pnpm build`, start the production server with `pnpm start`, and wait for `http://localhost:3000`. The suite receives `PLAYWRIGHT_BASE_URL=http://localhost:3000`; reports and failure logs are uploaded as artefacts. This runner-local flow deliberately has no Vercel preview dependency.

## Consequences

**Positive**

- Multi-engine coverage surfaces cross-browser regressions that matter on a content site (Newsreader variable-font rendering, `animation-play-state` semantics, WebGL fallbacks).
- `@playwright/test` runs the tests; no marriage to Mocha/Jasmine/Jest + runner wiring.
- `@axe-core/playwright` means the accessibility gate runs inside the browser the user is using — catches violations that server-side axe-core misses.
- `PLAYWRIGHT_BASE_URL` indirection lets the same suite run locally (`pnpm dev` via `webServer`) and in CI against the runner-local production server without conditional test code.

**Negative**

- Playwright's browser bundles add ~200MB on first install; CI pays the install cost once per run. `pnpm test:e2e:install` script is wired for this. Locally, `pnpm test:e2e:install` runs once per machine.
- CI wall-time: ~5–8 minutes for the full matrix. Mitigated by `fullyParallel: true` + `workers: 2` in CI config, and concurrency-cancel on stale runs.
- Playwright's trace viewer is its own format (not a browser devtools export) — engineers unfamiliar with it need a short ramp. Artefact upload + README note in `e2e/` covers this.

**Neutral**

- Playwright's API surface is close enough to Cypress's that a team familiar with Cypress transitions in a day.
- `webServer` block in config auto-starts `pnpm dev` for local runs; CI skips it by checking `process.env.CI`.

## Alternatives considered

- **Cypress.** Rejected primarily on cross-engine coverage. Cypress's multi-browser story in 2025 still requires the paid Cloud runner or experimental flags; Playwright's is first-class and free. For a portfolio meant to demonstrate engineering discipline, shipping a test suite that only runs on one browser sends the wrong signal.
- **Vitest + happy-dom.** Rejected as a scope mismatch. Vitest is the right tool for component / unit tests (a future addition when the portfolio grows a component system beyond the current static shell), but it doesn't exercise the Vercel-served HTML and can't prove that `prefers-reduced-motion` or `data-mode` toggles cascade through real CSS.
- **WebdriverIO.** Rejected — solid tool, but Playwright's ergonomics and first-party action for GitHub are materially better for a solo-maintained project.
- **Next.js `@testing-library/react` + `vitest`.** Same rejection as Vitest + happy-dom — right for component tests, wrong for this tier.

## Follow-ups

- `canvas.spec.ts` now covers the AgentGraph and desktop-only Wanderer canvas/fallback policies, including mobile and motion-off absence.
- Phase 5 Slice 5.3 ships the launch post and the real analytics. Add a `launch.spec.ts` that confirms the Calendly CTA wires to the expected URL and that `@vercel/analytics` is loaded.
- If CI wall-time grows past 10 minutes as the suite expands, evaluate sharding (`--shard=1/4` across four jobs in a matrix) before considering smaller browser coverage.
