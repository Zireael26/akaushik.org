# akaushik.org

Personal portfolio site. Next.js 16 + React 19 + Tailwind 4 + raw Three.js / HyperFrames for motion work. Domain history: this repo lived under `developerabhishek.live` until 2026-04-20; canonical is now `akaushik.org` (`akaushik.dev` redirects). Decision in `docs/adr/0003-domain-and-canonical-url.md`. Directory + GitHub repo rename landed 2026-04-24; on-disk path and remote are both `akaushik.org` now.

---

## Codebase map

- `_reference/` - Archived portfolio/reference material.
- `app/` - Next.js App Router pages, APIs, metadata routes, and work/writing routes.
- `components/` - Site, section, media, SEO, work, and Three.js scene components.
- `content/` - MDX case studies and writing.
- `lib/` - Shared helpers and tested domain utilities.
- `public/` - Images, videos, well-known files, and static data.
- `docs/` - ADRs, SEO notes, EPMs, RFCs, and readiness snapshots.
- `e2e/` - Playwright end-to-end specs.
- `scripts/` - Build and HyperFrames automation.
- `specs/` - Active spec workspaces.
- `audits/` - Audit outputs.

---

## Scope of this file

This file is self-contained: a fresh clone of this repo carries everything it
needs, and nothing here points at a path outside the checkout. Shared
engineering rules come from whatever agent toolchain is attached to the working
copy — they are not vendored here and no location for them is recorded in the
repo. Where an attached rule set and a rule below disagree, the rule below is
the more specific one; raise the conflict with me instead of working around it.

---

## Project-specific notes

### Stack quirks worth knowing
- Next.js 16 with Turbopack (`next dev --turbo`). Some plugins lag behind.
- React 19 — use the new hooks (`use`, `useOptimistic`) when they fit; don't polyfill.
- Tailwind 4 — config lives in `postcss.config.mjs` + CSS imports, not `tailwind.config.js`.
- Hero `AgentGraph` uses raw `three` via `components/scene/AgentGraph.tsx` (ADR-0012). The disabled Wanderer crane also uses raw `three`.
- No `framer-motion`, no `gsap`, no `lucide-react` in `package.json` — all three were dropped 2026-05-19 (PR-6 of gap-analysis plan, finding D3) because nothing in `app/`, `components/`, or `lib/` imported them. If new motion work needs a library, add it back with an ADR.

### Commands (pnpm — see `pnpm-lock.yaml`)
- `pnpm dev` — dev server with turbo.
- `pnpm typecheck` — `tsc --noEmit`. Stop hook auto-detects and runs this.
- `pnpm lint` — `eslint .`. Also auto-run by Stop hook.
- `pnpm test` — `vitest run`. Five `lib/*.test.ts` files; coverage thresholds in `vitest.config.ts`.
- `pnpm test:coverage` — vitest with v8 coverage; thresholds 75/55/75 lines/branches/functions.
- `pnpm test:e2e` — Playwright. Requires `pnpm start` or `pnpm dev` on `:3000`.
- `pnpm process:check` — project-local process gate (`scripts/process-gate.mjs`). Keep green.

### EPM policy
- EPM artefacts under `docs/epm/` cover Phase-0-style scaffolding only (one file today: `EPIC-01-pixel-parity.md`). Per-phase narrative since Phase 1 lives in `docs/CHANGELOG.md`. **Backfill not required.** New EPMs only when a piece of work spans more than one subsystem and the CHANGELOG alone won't carry the planning shape.

### Working conventions
- Content lives in `content/` as MDX. Don't generate new MDX files without asking — each one is a deliberate editorial unit.
- `_reference/` is scratchpad/archive. Read-only in normal work.
- `HANDOFF.md` at repo root is the session-between-sessions log. If you wrote something there, read it first next session.

### Gotchas and context
- `gotchas.md` — lessons specific to this repo.
- `context-log.md` — session hand-off state written by the attached toolchain. Gitignored; never hand-edit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
