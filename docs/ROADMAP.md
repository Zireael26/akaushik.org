# Roadmap

A living document. Phases are ordered by dependency, not calendar. Each phase is a set of one-PR slices; the site is deployable at every milestone.

## Phase 0 — Scaffold

- [x] Archive SvelteKit at `legacy-v1-final`
- [x] Next.js 16.2 + Tailwind 4.2 scaffold
- [x] Agent-readiness scaffold (`llms.txt`, `/.well-known/*`, Link headers)
- [x] `pnpm install && pnpm typecheck && pnpm lint && pnpm build` run clean
- [x] Process-gate policy codified — ADR-0002 / `scripts/process-gate.mjs`
- [x] EPIC-01 (pixel parity) written — `docs/epm/EPIC-01-pixel-parity.md`
- [x] Vercel preview green

> Phase 1 tracked in `docs/epm/EPIC-01-pixel-parity.md`.

## Phase 1 — Pixel parity

- [x] Hero (01): taglines A/B/C, hero-facts DL, static SVG agent-graph scene, marquee
- [x] About (02) — portrait placeholder + bio + meta rows
- [x] Work (03) — four case cards + stub detail pages
- [x] Writing (04) — post list (replaced with real MDX in Phase 2)
- [x] Services (05) — three engagement shapes
- [x] Process (06) — inverted block + artifact list
- [x] In the open (07) — GitHub stats sparkline + contribution number
- [x] Contact (08) — CTA + link DL
- [x] Wanderer SVG fallback + `#companion` mount wiring (full live-scene port reseq'd to Phase 5.1c)
- [x] TweakBridge dev panel — Claude Design iframe protocol (tagline / accent / mode / density / motion)
- [x] Stats tile wired from `public/data/stats.json`

## Phase 2 — Content fill

- [x] MDX infrastructure (`lib/content.ts`, `next-mdx-remote@6`, Shiki, ADR-0004)
- [x] Neev case study (hero)
- [x] VeriCite case study (AI-systems depth)
- [x] Bluehost agents — permanent stub (confidentiality framing)
- [x] curat.money case study (product-breadth framing)
- [x] About long-form prose in section (full edit pending Abhishek's pass)
- [x] Services + Process copy ported
- [x] Writing seeds × 3 (micrograd, MSME, fastembed → TEI)

## Phase 3 — Engineering polish

- [x] CI pipeline (verify + test + audit workflows on every PR)
- [x] ADRs written for every decision in Phase 0–2
- [x] Axe-core + Lighthouse CI + Playwright smoke tests wired (ADR-0005)
- [x] `pnpm build` under 60s, bundle budget tracked (`docs/BUNDLE_BUDGET.md`)
- [x] Phase 3 review follow-ups — mobile Lighthouse, budget doc alignment, iPhone SE viewport

## Phase 4 — Agent readiness

- [x] `sitemap.ts` + route-handler `robots.txt` (Content-Signal directive) + correct Link headers per RFC 8288
- [x] `/llms-full.txt` route handler (full corpus concatenation)
- [x] `.md` alternates + content negotiation Pattern A + Pattern B (ADR-0006)
- [x] RFC 9727 API Catalog + OpenAPI 3.1 + JSON listings (`/api/writing`, `/api/case-studies`)
- [x] Agent Skills `SKILL.md` + digest prebuild
- [x] Phase 4 review follow-ups — proxy rewrites carry Link header, rel URIs corrected, home Accept negotiation, content-negotiation E2E spec
- [ ] MCP server implementation at `/api/mcp` (deferred to v1.1 per plan default)

## Phase 5 — Launch

- [x] Hero raw-Three.js canvas — agent-graph live scene (4 nodes, rings, labels, edges, packets, pointer parallax; ADR-0012 supersedes the earlier framework bump)
- [~] Wanderer full Three.js port — 8 POSES, IntersectionObserver dispatch, damp lerp, scroll-velocity rotation, accent sync (disabled 2026-05-11 per PR #58; reinstate tracked post-launch — see `docs/wanderer-redesign-brief.md`)
- [x] OG images via `next/og` — home + per case study + per writing post
- [x] Cloudflare Web Analytics beacon (token-gated, cookieless)
- [x] Head `<link>` tags synced to proxy Link header shape
- [x] Launch announcement post (`content/writing/building-this-portfolio.mdx`)
- [x] Canvas + Wanderer Playwright smoke (`e2e/canvas.spec.ts`)
- [x] Phase 5 review follow-ups — ROADMAP ticks, launch-post URLs, runtime reduced-motion gates, theme-toggle flicker fix

## Post-launch (honest open items)

- [~] Calendly / Cal.com URL wired into Contact ghost button — current behavior falls back to `mailto:hello@akaushik.org?subject=20-minute%20call`; replace with a real scheduler URL when available
- [x] Portrait photo swap (`/images/about/abhishek.webp`, 4:5) — shipped 2026-05-11 (CHANGELOG)
- [ ] Wanderer crane redesign + reinstate — see `docs/wanderer-redesign-brief.md`
- [~] Case-study reel MP4s — HyperFrames scaffold + 8 compositions + React integration landed (ADR-0008); remaining work is the render pass (`pnpm render:work && pnpm render:posters`) + committing `public/video/work/*.{mp4,webp}`. Blocked in-sandbox on FFmpeg/Chrome availability; runs cleanly on a local dev box
- [~] `isitagentready.com` scan against prod + dated snapshot in `docs/agent-readiness-snapshots/` — first dated snapshot landed 2026-05-19 (`docs/agent-readiness-snapshots/2026-05-19.md`); PNG from the live UI still pending owner action (curl-based snapshot is in place)
- [~] `pnpm analyze` / Lighthouse bundle audit — first measurement landed 2026-05-19; latest 2026-07-04 audit measured 299,026 bytes of script transfer. `lighthouserc.yml` ceiling remains 400 KiB `warn` to suppress noise; the 150 KiB aspiration is still open.
- [~] Script-bundle overrun (now ~292 KiB > 150 KiB target). **Resolution step (2026-05-19):** ported `components/scene/AgentGraph.tsx` to raw `three.js` (ADR-0012) and removed the prior framework dependencies. The remaining gap is the `three` runtime itself. Further reduction requires either accepting the new practical target in an ADR or porting to a smaller WebGL/static primitive — deferred until the next quarterly gap-analysis cycle.
- [x] WCAG 2.0/2.1 contrast violations on the home page — closed 2026-05-19. `--ink-70` / `--ink-60` / `--ink-40` opacity caps bumped in `app/globals.css`; composited values now clear 4.5:1 against the parchment background. `e2e/home.spec.ts` axe-core gate armed (no more `test.fixme`); axe-core scan returns zero violations.
- [~] Lighthouse category thresholds — 2026-05-19 measurement landed; performance + accessibility + best-practices promoted to `error` severity (desktop 0.95 / 0.95 / 0.95, mobile 0.9 / 0.95 / 0.9). SEO + JS-budget remain `warn` until SEO crosses 1.0 and the bundle overrun resolves
- [x] `/api/docs` human-readable page rendering the OpenAPI spec — shipped 2026-05-19 (gap-analysis PR-5). Server-rendered React reading from `lib/openapi-spec.ts`; same source as `/api/openapi.json`. No client JS.
- [ ] MCP server for v1.1 — `/api/mcp` with `lookup_case_study` + `get_availability` tools
- [ ] Abhishek's edit pass on `About.tsx` prose + case-study honest-scope paragraphs + curat.money framing check
- [x] Directory + repo rename `developerabhishek.live` → `akaushik.org` (2026-04-24); flip repo visibility to public; Cloudflare Email Routing for `hello@akaushik.org`; legacy-domain 308 via `vercel.json`; social-bio sync
