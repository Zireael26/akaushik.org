# Tasks 006 — Ship It

**Spec:** `spec.md` · **Plan:** `plan.md` · **Branch:** `feat/shipit`

Workers do not commit. The foreman runs receipts and creates local unit
commits. The apex owns visual acceptance and every push, deploy or merge.

---

## U0 — Specification

- [x] T01 Record the binding clarification and IP boundary in `clarify.md`
- [x] T02 Define observable requirements and success criteria in `spec.md`
- [x] T03 Define architecture, sequence, risks and receipts in `plan.md`
- [x] T04 Map every requirement to this executable task list
- [x] T05 Self-review all four files for placeholders and contradictions
- [x] T06 Run the process check and commit U0 before code

## U1 — Layout and targeting

- [ ] T07 Author the 28×31 grammar maze in `lib/shipit/layout.ts` → R1
- [ ] T08 Add pure targeting and exit choice in `lib/shipit/targeting.ts` → R9–R12
- [ ] T09 Tests: grammar, connectivity, wall-mask hash, all four personalities
      including up-overflow and shy 8-tile boundary → SC2, SC3
- [ ] T10 Focused Vitest + typecheck; foreman commits U1

## U2 — Pixel-grid rules

- [ ] T11 `lib/shipit/game.ts`: desired-direction stop-and-hold, cornering,
      tunnel, speeds → R2–R6, SC1
- [ ] T12 Mode timer, reverse-on-change, fright, combo scores, eyes → R7–R8, R13–R14
- [ ] T13 House counters / idle timer, Cruise Elroy → R15–R16
- [ ] T14 Seeded PRNG for frightened wander; no `Math.random()`
- [ ] T15 Focused tests for every U2 invariant; foreman commits U2

## U3 — Runtime and cutover

- [ ] T16 Port oscillator audio to `lib/shipit/audio.ts` with a new storage key → R25
- [ ] T17 Prototype the caret at actual tile size; lock masks only after it
      reads as a cursor, not a bracket → R17, SC6
- [ ] T18 `lib/scenes/shipit.ts` one-loop mount/draw/input/theme/motion/dispose → R22–R24
- [ ] T19 `ShipItGame.tsx` + `ShipIt.tsx` + `shipit.css`; wire `app/page.tsx`
      and layout import before `_mobile.css` → R19–R21, R26–R27
- [ ] T20 Four geometrically distinct bugs; pellets as code chars; energizers
      as commits → R18
- [ ] T21 Delete arcade section modules and update every caller, including
      `e2e/reduced-motion.spec.ts` `#arcade` selectors → R29, SC12
- [ ] T22 CHANGELOG entry in the same unit
- [ ] T23 Focused unit + typecheck; foreman commits U3

## U4 — Browser contract

- [ ] T24 `e2e/shipit.spec.ts`: start, keyboard, buttons, swipe, score, life,
      restart, theme, sound, focus escape → SC7
- [ ] T25 Reduced-motion discrete play for both vetoes → SC8
- [ ] T26 375px no overflow; controls ≥44px; axe zero → SC7, SC11
- [ ] T27 Foreman commits U4

## U5 — Hardening and rendered receipts

- [ ] T28 `pnpm typecheck`
- [ ] T29 `pnpm lint`
- [ ] T30 `pnpm test` (record pass count)
- [ ] T31 `pnpm test:coverage`
- [ ] T32 `pnpm process:check`
- [ ] T33 Playwright matrix + axe
- [ ] T34 Screenshots 1440/375 light/dark; GIF of corner-stuck, eat cycle,
      fright, each targeting personality
- [ ] T35 Ripgrep Survey/Arcade name leaks for this game; no new hex;
      `package.json` unchanged
- [ ] T36 Grok review (implementer is ox-alpha); fix accepted findings
- [ ] T37 Foreman commits fixes; report hashes and artifact paths to apex

## Hard stops

- Do not copy the original maze, characters, or audio.
- Do not add dependencies, a game framework, or shipped media.
- Receipts stay at `/tmp/akaushik-shipit-receipts-20260823/`.
- Do not deploy, merge, push to main, or touch the main checkout.
- Do not set `SKIP_PROCESS_GATE=1`.
- Do not accept visual quality from prose. The GIF is the receipt.
