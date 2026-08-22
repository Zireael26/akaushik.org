# Tasks 004 — Pixel transplant

**Spec:** `spec.md` · **Plan:** `plan.md` · **Branch:** `feat/pixel-transplant`

Checked boxes were completed before this triad was authored in-place, per the
mandatory-pipeline gate's remediation path. Each maps to a success criterion.

---

## P0 — Spec

- [x] T01 Author `clarify.md`, `spec.md`, `plan.md`, `tasks.md` on this branch
- [x] T02 ADR-0018: retrofit Next.js on Cloudflare, superseding the framework half of ADR-0001 → SC-all — plus a 2026-08-23 addendum correcting two claims the spike falsified
- [ ] T03 Resolve OQ1 (display face) and OQ3 (hyperframes on case studies). OQ2 closed — the secret entrance was removed outright.

## P1 — Cloudflare spike *(done 2026-08-23 — live at `beta.akaushik.org`)*

- [x] T04 Deploy the site as-is to a preview Worker via `@opennextjs/cloudflare` → SC10
- [x] T05 Verify `next/og` renders all three `opengraph-image` routes under the adapter; if not, pre-render with sharp → SC10 — all twenty cards prerender at build time and serve from the asset store, so satori never runs inside the Worker; the three shapes were downloaded from the preview and inspected
- [x] T06 Verify the ADR-0014 nonce CSP survives the adapter → SC3 — the nonce is minted in `worker/index.ts`, reaches `headers()`, and lands on every script tag
- [x] T07 Verify content-negotiation rewrites work on the Worker → SC3, SC4 — both patterns answer on the deployed host
- [x] T08 ~~Operator: mint a Workers-scoped API token~~ — not needed. Wrangler is already OAuth-authenticated for this account with write scopes; the zone-scoped `CLOUDFLARE_API_TOKEN` in the shell shadows it, so Wrangler calls need `env -u CLOUDFLARE_API_TOKEN`.

### Not in the original plan, discovered by the spike

- [x] T08a Port the agent-readiness contract to `worker/index.ts` — Next 16 removed the edge runtime from `proxy.ts`, and OpenNext supports no other kind. Policy extracted to `lib/agent-proxy.ts` with 57 new unit tests.
- [x] T08b Inline `content/**` into the bundle — Workers have no filesystem, so every content page 404'd.
- [x] T08c Compile MDX at build time — Workers refuse `new Function` and runtime WASM, so `next-mdx-remote` cannot render there.
- [ ] T08d ADR-0019: record the Workers runtime constraints as a standing rule *(dispatched)*

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
- [~] T18 Port the cursor engine; gavel becomes an Enter keycap that depresses on click. In progress on `feat/pixel-cursor` → SC1, SC8

## P4 — Art

- [x] T35 Generalise the heatfield into `lib/pixel/field.ts`: pluggable sources, stages, seeds, cell-size presets → SC1, SC6
- [x] T36 `fromImage` — photographs as live fields, with a luminance stretch; the About portrait uses it → SC1
- [x] T37 Remove the triple-click secret entrance → SC2

- [x] T19 Hero exhibits: agent graph, shell prompt, trellis, "AK." → SC2
- [x] T20 Footer skyline: rack, layered stack, trellis panel → SC2
- [x] T21 Marquee string: "it has to work on a tuesday" → SC2
- [x] T22 Method art: four stage glyphs and a pipeline conduit, replacing the abstract flow band → SC2
- [x] T23 Favicon from the new cursor sprite → SC2 — `app/icon.tsx`, the shell-prompt exhibit reduced to a 16-cell grid
- [x] T38 Per-article pixel headers, seeded from the slug via `seedFrom` → SC1 — `components/pixel/RouteField.tsx`
- [ ] T39 Revisit the hero art itself → SC1

## P5 — Sections and content

- [x] T24 Header, footer, profile, method, experience, work, services, writing, open source → SC1
- [x] T25 `/work` index + `/work/[slug]` detail styling → SC4
- [x] T26 `/writing` index + `/writing/[slug]` article template, short-answer box, FAQ JSON-LD merged with existing structured data → SC3, SC4
- [ ] T27 Fill the Experience section — currently thin, because the repo does not carry enough sourced CV detail and none was invented → SC-constraint
- [ ] T28 Copy pass against `docs/voice.md` across every new section → SC-constraint

## P6 — Gate and cutover

- [ ] T29 Rewrite the 9 Playwright specs against the new markup → SC3, SC4, SC7, SC8 *(dispatched; must assert the response contract, never the mechanism, now that there are two proxy adapters)*
- [x] T30 Sweep dead code: `Contact.tsx`, `Wanderer`, `AgentGraph`, `three`, `ThemeToggle` → SC9 — a follow-up pass on stale *comment* references to those files is dispatched
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
