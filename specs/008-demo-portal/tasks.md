# Tasks 008 — Gated demo portal

## U0 — Scaffold and auth
- [x] T01 Copy `apps/learn` to `apps/demo`; rename package, cookie, workers, hosts
- [x] T02 Remove course content, build scripts and assets
- [x] T03 Extend the edge CSRF check to `/api/chat`; host allowlist test → SC2

## U1 — Proxy
- [x] T04 `lib/sse-filter.ts` strict per-type projection + tests → SC3
- [x] T05 `/api/chat` guard order, streaming, single error/`[DONE]` → SC2, SC4
- [x] T06 D1 sliding-window budget (`chat_rate`) → SC6
- [x] T07 Persist the visitor credential per account (`visitor_credential`) + test → SC5
- [x] T08 Header timeout 60 s, stream ceiling 180 s
- [x] T09 Send `Origin: VERICITE_ORIGIN` on both upstream calls; test asserts it

## U2 — Chat UI
- [x] T10 Line-buffered SSE reader; light markdown rendering
- [x] T11 `[n]` and source cards open `url#page=N`; plain title without url → SC7
- [x] T12 Verdict chips; muted abstain state → SC8
- [x] T13 Suggestion chips (cap 12), persistent row of unasked ones
- [x] T14 Generic public entrance; branding only after sign-in → SC1
- [x] T15 Mobile header, scroll anchor, hydration warning; screenshots → SC9

## U3 — Docs and configuration
- [x] T16 ADR-0023, README deploy checklist, CHANGELOG
- [x] T17 Client-specific values as secrets, never vars → SC11
- [x] T18 Leak grep clean on the committed tree → SC11

## U4 — Provision and preview
- [x] T19 Provision preview and production D1; apply migrations
- [x] T20 Preview custom-domain route; deploy; gate smoke (401/403/400, noindex)
- [x] T21 Preview secrets: BA_SECRET, channel, branding, suggestions, key
- [x] T22 Preview test account; end-to-end run of every suggested question → SC10
- [x] T23 Confirm source frames carry `url` and `#page` opens inline

## U5 — Production (operator-approved)
- [ ] T24 Production secrets; `pnpm deploy:production`
- [ ] T25 Operator-chosen viewer accounts
- [ ] T26 Production end-to-end run → SC10
