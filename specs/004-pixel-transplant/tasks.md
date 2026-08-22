# Tasks 004 — Pixel transplant

**Spec:** `spec.md` · **Plan:** `plan.md` · **Branch:** `feat/pixel-transplant`

Checked boxes were completed before this triad was authored in-place, per the
mandatory-pipeline gate's remediation path. Each maps to a success criterion.

---

## P0 — Spec

- [x] T01 Author `spec.md`, `plan.md`, `tasks.md` on this branch
- [ ] T02 ADR-0018: retrofit Next.js on Cloudflare, superseding the framework half of ADR-0001 → SC-all
- [ ] T03 Resolve OQ1 (display face), OQ2 (secret entrance destination), OQ3 (hyperframes on case studies)

## P1 — Cloudflare spike *(blocked: needs operator OAuth)*

- [ ] T04 Deploy the site as-is to a preview Worker via `@opennextjs/cloudflare` → SC10
- [ ] T05 Verify `next/og` renders all three `opengraph-image` routes under the adapter; if not, pre-render with sharp → SC10
- [ ] T06 Verify the ADR-0014 nonce CSP survives the adapter → SC3
- [ ] T07 Verify `proxy.ts` content-negotiation rewrites work on the Worker → SC3, SC4
- [ ] T08 Operator: mint a Workers-scoped API token in the Cloudflare dashboard for CI

## P2 — Foundation

- [x] T09 `app/styles/tokens.css` + `fonts.css`; four self-hosted faces → SC1
- [x] T10 Remove Tailwind and the `@theme` bridge; rewrite `globals.css` to the foundation → SC1
- [x] T11 `lib/pixel.ts` primitives; `lib/pixel-theme.ts` on `html[data-mode]` → SC7
- [x] T12 JetBrains Mono Nerd Font subset + `scripts/build-fonts.sh` → SC1
- [x] T13 Shared primitives: `SectionHead`, `RuledRow`, `MatterRow`, `_shared.css` → SC1
- [x] T14 Section CSS split, one file per section, imported from `layout.tsx` → SC1

## P3 — Engines

- [x] T15 Port heatfield with a disposer → SC1, SC6
- [x] T16 Port marquee, skyline, method-band, pixel-band, theme-switch → SC1, SC6
- [x] T17 `ThemeSwitch` writes `html[data-mode]`, persists `abhishek.portfolio.mode` → SC7
- [ ] T18 Port the cursor engine (520 lines); gavel becomes an Enter keycap that depresses on click → SC1, SC8

## P4 — Art

- [x] T19 Hero exhibits: agent graph, shell prompt, trellis, "AK." → SC2
- [x] T20 Footer skyline: rack, layered stack, trellis panel → SC2
- [x] T21 Marquee string: "it has to work on a tuesday" → SC2
- [ ] T22 Four method icons — `data-icon` canvases mount but nothing draws → SC2
- [ ] T23 Favicon from the new cursor sprite → SC2

## P5 — Sections and content

- [x] T24 Header, footer, profile, method, experience, work, services, writing, open source → SC1
- [ ] T25 `/work` index + `/work/[slug]` detail styling → SC4
- [ ] T26 `/writing` index + `/writing/[slug]` article template, short-answer box, FAQ JSON-LD merged with existing structured data → SC3, SC4
- [ ] T27 Fill the Experience section — currently thin, because the repo does not carry enough sourced CV detail and none was invented → SC-constraint
- [ ] T28 Copy pass against `docs/voice.md` across every new section → SC-constraint

## P6 — Gate and cutover

- [ ] T29 Rewrite the 9 Playwright specs against the new markup → SC3, SC4, SC7, SC8
- [ ] T30 Sweep dead code: `Contact.tsx`, `Wanderer`, `AgentGraph`, `three`, `ThemeToggle` → SC9
- [ ] T31 Lighthouse against `lighthouserc.yml` and `lighthouserc.mobile.yml` → SC9
- [ ] T32 `isitagentready.com` scan of the preview, reconciled with `docs/AGENT_READINESS.md` → SC3
- [ ] T33 Link-integrity sweep over every pre-existing URL → SC4
- [ ] T34 DNS cutover; pause the Vercel project for 14 days → SC10

---

## Notes

- **T27 is a content gap, not a bug.** The Experience section is deliberately
  thin: the delegated agent was instructed never to invent an employer, date or
  title, and the repo does not carry a full CV. Filling it needs operator input.
- **T18 and T22 are the visible remaining art gaps.** The method icons mount as
  empty canvases today.
