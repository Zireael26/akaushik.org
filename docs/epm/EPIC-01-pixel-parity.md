# EPIC-01 — Pixel parity with the Claude Design reference

**Status:** Closed as a historical Phase-0/Phase-1 execution brief · 2026-07-14
**Owner:** Claude Code (build engineer)
**PRD:** `docs/PRD.md` · **Design:** `docs/DESIGN_DIRECTION.md` · **Reference:** `_reference/portfolio/`
**Roadmap phase:** Phase 1 — Pixel parity with the Claude Design reference

> Closure note (2026-07-14): this file preserves the Phase-0/Phase-1 plan as authored; it is not retrofitted into a post-launch ledger. Later phase history lives in `docs/CHANGELOG.md`, while current state lives in `docs/ROADMAP.md` and accepted specs. The four-card wording below is the original baseline; the current spec-003 implementation exposes five published case studies. Completion criteria remain historical acceptance language, not newly claimed command receipts.

## 1. Goal

Port the frozen Claude Design reference (`_reference/portfolio/index.html` +
`styles.css` + `companion.js` + `tweaks.js`, 3,301 LOC total) into the
Next.js 16.2 scaffold so the live build matches the reference at 1440px /
768px / 375px across all eight sections. No visual decisions are relitigated
— the reference wins on visuals (HANDOFF §0).

## 2. Shape of the work

The reference is an eight-section single-page scroll. Each section ships as
a **vertical slice**: a server component rendering the section, a client
companion where interactivity is needed, the section's copy pulled from
`BIO_DRAFT.md` / `CASE_STUDIES_OUTLINE.md`, and a smoke test against the
reference at three breakpoints. No section is "done" before it matches.

Sections, in the order the reference walks the eye:

1. **Hero** (`#hero`) — Newsreader 88px headline with tagline A/B/C wired to
   `data-tagline-*`, `hero-facts` DL, SVG agent-graph scene (the live
   Three.js canvas port is reseq'd to Phase 5 — see §4 and ROADMAP),
   sticky marquee. HANDOFF §4.01.
2. **About** (`#about`) — long-form copy from `BIO_DRAFT.md §2` (desktop),
   shorter variant on mobile, one pull-quote in Newsreader italic, mono
   meta line. HANDOFF §4.02.
3. **Work** (`#work`) — four case-study cards (Neev → Bluehost Agents →
   VeriCite → curat.money). Placeholder reels ported verbatim as
   SVG-`<rect>` animations, upgradeable to MP4/WebM when real reels land.
   HANDOFF §4.03.
4. **Writing** (`#writing`) — empty-state-first: "Drafting in the open."
   Three category headers, date for next post. Grows to a list when MDX
   lands in `content/writing/`. HANDOFF §4.04.
5. **Services** (`#services`) — three cards from the reference, each with
   a one-line "what you get". No public prices. HANDOFF §4.05.
6. **Process** (`#process`) — numbered five-step, each with title +
   two-sentence desc + mono artifact caption. HANDOFF §4.06.
7. **In the open** (`#open`) — stats tile fed from `public/data/stats.json`
   (import at build time in a server component). 52-cell SVG heatmap, three
   repo cards, "refreshed N ago" caption. HANDOFF §4.07, §7.
8. **Contact** (`#contact`) — Newsreader headline, email `btn-primary`,
   ghost buttons, footer with build notes + `VERCEL_GIT_COMMIT_SHA`.
   HANDOFF §4.08.

Cross-cutting work that doesn't belong to one section:

- **The Wanderer** — Phase 1 ships the SVG fallback + `#companion` mount
  wiring only (`components/scene/Wanderer.tsx`, reference
  `companion.js:211–219`). The full r3f port — 8 POSES,
  IntersectionObserver-driven lerp, pointer parallax, accent sync via
  `data-accent` observer — is **reseq'd to Phase 5** alongside the R3F 9
  + drei 10 peer-dep bump (ADR pending). Rationale: decouple pixel
  parity from the peer-dep upgrade so a regression in one doesn't block
  the other, and keep the Phase 1 bundle under budget until the
  content-polish phases settle. HANDOFF §5.
- **TweakBridge** (`components/dev/TweakBridge.tsx`) — dev/iframe-only
  iframe protocol port of `tweaks.js`: `tagline / accent / mode / density
  / motion`, postMessage contract per HANDOFF §6, `localStorage` key
  `dl-tweaks-v1`, backtick toggles panel.
- **Shared chrome** — sticky nav (links to `#hero..#contact`), footer,
  the marquee, section-header micro-graphic.
- **Design tokens audit** — `app/globals.css` already carries the full
  token set from the reference's `:root`; diff the full stylesheet into
  component-scoped CSS files or Tailwind utility layers without
  re-inventing values.

## 3. Build order

Ship one section per PR. Each PR: section component + copy + reference
smoke test at 3 viewports + CHANGELOG entry. Order below is dependency-
driven, not calendar-driven.

1. **Chrome** (nav + footer + marquee + theme/motion bootstrap) — unlocks
   every section.
2. **Hero** — establishes type ramp and the hero-canvas pattern other
   animated beats reuse.
3. **About** — exercises the long-form prose grid used by writing + case
   studies later.
4. **Services**, **Process** — both editorial card grids; batch if the
   grid abstraction lands cleanly.
5. **Work** — depends on the editorial grid; reels are their own beat.
6. **In the open** — depends on `stats.json`; wire `GH_STATS_TOKEN`
   secret with Abhishek before merging.
7. **Writing** — empty-state-first; trivial until MDX posts arrive.
8. **Contact** — small; land last so the footer final-polish happens
   after every other section is settled.
9. **The Wanderer (SVG fallback only)** — orthogonal to section order;
   ship after all section bodies land so every `[data-companion-pose]`
   anchor exists. The full r3f port (with POSES, parallax, accent sync)
   moves to Phase 5 per §4.
10. **TweakBridge** — ship once any two tokens (accent, mode) actually
    affect the visual surface.

## 4. Known drag / Phase-1 ADRs expected

Each of these surfaces during the port. Write the ADR when the call is
made, not before.

- **Middleware → proxy rename.** Next 16.2 deprecates `middleware.ts` in
  favor of `proxy.ts`. HANDOFF §8 names `middleware.ts`; if we stay on it
  for v1, document why. If we migrate, ADR-0003 explains the move.
- **R3F / drei peer-dep vs. React 19.** `@react-three/fiber@8.x` and
  `@react-three/drei@9.x` declare `react@^18` peer deps. Pinned R3F 8 +
  React 19 installs but emits unmet-peer warnings. Bump to R3F 9 + drei
  10 during Wanderer work; ADR if any behavioral regression.
- **Fonts via `<link>` vs. `next/font`.** Scaffold uses `<link>` to
  Google Fonts for parity with the reference; `next/font` is
  lint-preferred. Decide in Phase 1 when measuring CLS/LCP — if `<link>`
  costs budget, switch.
- **Tailwind vs. plain CSS.** Tokens live in `@theme`, but the reference
  ships a 898-line stylesheet. Per-component CSS files under
  `components/*.module.css` are closer to the reference's structure than
  Tailwind utility sprays. Decide per section; document in the section's
  PR.

## 5. Completion criteria

- All eight sections render at 1440/768/375 matching the reference
  screenshot diff (manual visual diff — no snapshot infra in v1).
- The Wanderer renders (or falls back) across Safari / Chrome / Firefox.
- TweakBridge round-trips the five keys against the iframe protocol
  described in HANDOFF §6 without code changes.
- `pnpm typecheck && pnpm lint && pnpm build` clean, build < 60s.
- Lighthouse mobile + desktop ≥ 95 P / 100 A11y / ≥ 95 BP / 100 SEO
  (measured on Vercel preview; deferred to Phase 3 if blocked).
- `prefers-reduced-motion: reduce` disables every motion surface.
- `[data-motion="off"]` via TweakBridge does the same.
- ROADMAP Phase 1 checklist all ticked.

## 6. What this epic does **not** cover

- MDX content authoring (Phase 2).
- Agent-readiness completion — `llms-full.txt`, MCP route, SKILL.md
  digest, api-catalog (Phase 4; tracked separately).
- CI quality-gate enforcement (Phase 3).
- Custom domain, analytics, OG images (Phase 5).
- **Hero Three.js canvas** (agent-graph live scene) — reseq'd to Phase 5
  Slice 5.1b. Phase 1 Hero ships the SVG fallback only.
- **Wanderer r3f full port** — reseq'd to Phase 5 Slice 5.1c. Phase 1
  ships the SVG-only fallback and mount wiring (Slice 1.9) so the
  `#companion` anchor is live.

## 7. Dependencies / asks of Abhishek

- `GH_STATS_TOKEN` repo secret before section 07 ships.
- Decision on hero tagline A/B/C default (`BIO_DRAFT.md §5` Q is open).
- Bluehost case-study copy sign-off (`CASE_STUDIES_OUTLINE.md §3`, NDA).
- Confirm `ai-train=no` vs. `yes` in `robots.txt` (`AGENT_READINESS.md §11 Q1`).
