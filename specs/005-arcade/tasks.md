# Tasks 005 — Arcade field

**Spec:** `spec.md` · **Plan:** `plan.md` · **Branch:** `feat/arcade`

Every implementation unit ends in a focused receipt and a commit. Workers do not
commit. The foreman runs receipts, reviews and creates local unit commits; the
apex owns final visual acceptance and every push, deploy or merge.

---

## U0 — Specification

- [x] T01 Record the binding clarification and IP boundary in `clarify.md`
- [x] T02 Define observable requirements and success criteria in `spec.md`
- [x] T03 Define architecture, sequence, risks and receipts in `plan.md`
- [x] T04 Map every requirement to this executable task list
- [x] T05 Self-review all four files for placeholders, contradictions, ambiguous
  acceptance language and accidental scope expansion
- [x] T06 Run the mandatory process check and commit U0 before code

## U1 — Deterministic field engine

- [x] T07 Add the asymmetric fixed board, topology bans, minimum spawn distance
  and typed tile grid in `lib/arcade/layout.ts` → SC2, SC9
- [x] T08 Add pure state, fixed live periods, phases, buffered movement and
  discrete/live clocks in `lib/arcade/game.ts` → SC1, SC7
- [x] T09 Add Direct and three-cell Cutline distance routing with reused typed
  scratch buffers → SC3
- [x] T10 Add deterministic non-reversing Drift routing through `h(x, y)`, with
  dead-end reversal → SC3
- [x] T11 Add reading score, same-cell/swap collisions, 900ms live respawn,
  immediate discrete reset, final-reading precedence, win, loss and restart →
  SC1
- [x] T12 Add focused layout and game tests for every U1 invariant → SC1–SC3,
  SC7
- [x] T13 Run focused Vitest and typecheck receipts; commit U1

## U2 — Runtime oscillator audio

- [x] T14 Add the standalone square/triangle event scheduler in
  `lib/arcade/audio.ts` → SC8, SC9
- [x] T15 Add lazy gesture-gated audio ownership, exact
  `abhishek.portfolio.arcade.sound` persistence, active-source cleanup and
  disposal → SC8
- [x] T16 Add fake-WebAudio tests for default-off, gesture, persistence,
  scheduling, mute, teardown and non-melodic jitter bounds → SC8
- [ ] T17 Render a WAV from the production scheduler; inspect duration, peak and
  waveform and listen for harshness or recognizable patterns → SC8
- [x] T18 Run focused audio and typecheck receipts; commit U2

## U3 — Playable home-page section

- [x] T19 Read the installed Next.js 16 client-component guide before writing the
  wrapper
- [x] T20 Add one-loop canvas mounting, drawing, input, theme, motion and disposal
  in `lib/scenes/arcade.ts` → SC4, SC6, SC7, SC10
- [x] T21 Add accessible HUD, live state, fallback text, sound, start/restart and
  direction controls in `components/pixel/ArcadeGame.tsx` → SC4, SC5, SC8
- [x] T22 Add the server section shell in `components/sections/Arcade.tsx` and
  place it immediately after `<OpenSource />` in `app/page.tsx` → SC11
- [x] T23 Add token-only responsive rules in `app/styles/sections/arcade.css` and
  import them before `_mobile.css` → SC5, SC11
- [x] T24 Add the arcade CHANGELOG entry in the same implementation unit → SC12
- [x] T25 Smoke-play the actual section at 1440px and 375px, both themes and both
  motion states; fix visual/audio failures before tests → SC6–SC8, SC11
- [x] T26 Run focused unit, typecheck and process receipts; commit U3

## U4 — Observable browser contract

- [ ] T27 Add `e2e/arcade.spec.ts` for start, keyboard, buttons, swipe, score,
  life presentation, restart, theme persistence, sound control and focus escape
  → SC1, SC4–SC6, SC8
- [ ] T28 Extend reduced-motion coverage for site and OS vetoes, round-robin
  one-turn input, blocked input and immediate collision reset → SC7
- [ ] T29 Add a focused one-rAF/disposal scene test and extend browser remount
  coverage → SC10
- [ ] T30 Prove 375px has no horizontal overflow and coarse-pointer controls are
  at least 44×44 → SC5, SC11
- [ ] T31 Run focused Playwright on Chromium desktop and WebKit mobile; keep axe
  violations at zero → SC4–SC6, SC10–SC12
- [ ] T32 Commit U4 with focused browser receipts

## U5 — Hardening and rendered receipts

- [ ] T33 Run `pnpm typecheck` and record the result → SC12
- [ ] T34 Run `pnpm lint` and record the result → SC12
- [ ] T35 Run `pnpm test` and record pass count → SC12
- [ ] T36 Run `pnpm test:coverage` and record thresholds/pass count → SC12
- [ ] T37 Run `pnpm process:check` against the complete branch → SC12
- [ ] T38 Run the full local Playwright matrix and record pass/skip counts → SC12
- [ ] T39 Confirm landing-page axe reports zero violations → SC5
- [ ] T40 Capture 1440×900 light-theme play screenshot → SC11
- [ ] T41 Capture 1440×900 dark-theme play screenshot → SC11
- [ ] T42 Capture 375×667 light-theme play screenshot → SC11
- [ ] T43 Capture 375×667 dark-theme play screenshot → SC11
- [ ] T44 Record a short GIF of real responsive play → SC11
- [ ] T45 Render final audio from the production scheduler; inspect and record
  WAV duration, peak and waveform, then listen for harshness or recognizable
  patterns → SC8
- [ ] T46 Run the production build; confirm `package.json` and `pnpm-lock.yaml`
  are unchanged; scan changed files for shipped media, base64, hard-coded
  colours, `Math.random()` and third-party arcade vocabulary → SC9, SC12
- [ ] T47 Run the deciding Grok review and independent Muse/free non-OpenAI
  refuter votes; fix accepted findings and rerun affected receipts
- [ ] T48 Commit final fixes, confirm a clean worktree and report hashes, receipts
  and artifact paths to the apex pane

## Hard stops

- Do not add a third-party title, character, pursuer design, maze, sprite, audio
  pattern, recording or downloaded asset.
- Do not add dependencies, a game framework, or shipped audio/image assets.
- Generated screenshot, GIF and WAV receipts stay outside the worktree at
  `/tmp/akaushik-arcade-receipts-20260823/`.
- Do not deploy, merge, push to main or touch the main checkout.
- Do not accept visual or sound quality from prose review. The deciding evidence
  is the rendered browser and audio artifact.
