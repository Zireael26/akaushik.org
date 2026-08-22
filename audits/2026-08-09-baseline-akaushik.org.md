# security-gate baseline — akaushik.org

- generated: `2026-08-09T04:26:19Z`
- profile:   `web-static`
- tools:     semgrep `1.172.0` · osv-scanner `2.4.0` · gitleaks `8.30.1`
- triage:    skipped (no LLM)

## Summary

- current-tree raw findings (gating): **19**
- kept after triage: **0**
- dropped (FP): **0**
- no-llm-pass: **19** (raw scanner output, not triaged)
- historical findings (separate, non-gating): **0**
- historical dispositions: kept **0** · dropped **0** · untriaged **0**

- severity (kept + no-llm-pass): **critical**: 0 · **high**: 0 · **medium**: 19 · **low**: 0
- historical severity (kept + no-llm-pass): **critical**: 0 · **high**: 0 · **medium**: 0 · **low**: 0

Verdict: **19 raw findings** (no LLM triage performed).

## Findings

### `osv-0006` — medium — osv/GHSA-28wg-ghj8-5hjv

- location: `pnpm-lock.yaml`
- message: nanoid@3.3.15 (npm) — nanoid: non-secure generators can loop indefinitely with negative size
- triage: no-llm-pass — triage skipped

### `osv-0007` — medium — osv/GHSA-2v37-7h3g-55p8

- location: `pnpm-lock.yaml`
- message: nanoid@3.3.15 (npm) — nanoid: custom generators can loop indefinitely when size is zero
- triage: no-llm-pass — triage skipped

### `osv-0008` — medium — osv/GHSA-4633-3j49-mh5q

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences
- triage: no-llm-pass — triage skipped

### `osv-0009` — medium — osv/GHSA-4c39-4ccg-62r3

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Unbounded Server Action payload in Edge runtime
- triage: no-llm-pass — triage skipped

### `osv-0005` — medium — osv/GHSA-5p4m-2wfm-xmqj

- location: `pnpm-lock.yaml`
- message: js-yaml@4.3.0 (npm) — JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported
- triage: no-llm-pass — triage skipped

### `osv-0010` — medium — osv/GHSA-68g3-v927-f742

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Cache confusion of response bodies for requests with bodies
- triage: no-llm-pass — triage skipped

### `osv-0011` — medium — osv/GHSA-6gpp-xcg3-4w24

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Middleware / Proxy bypass in App Router applications using Turbopack and single locale
- triage: no-llm-pass — triage skipped

### `osv-0012` — medium — osv/GHSA-89xv-2m56-2m9x

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Server-Side Request Forgery in Server Actions on custom servers
- triage: no-llm-pass — triage skipped

### `osv-0013` — medium — osv/GHSA-955p-x3mx-jcvp

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Unauthenticated disclosure of internal Server Function endpoints
- triage: no-llm-pass — triage skipped

### `osv-0019` — medium — osv/GHSA-f88m-g3jw-g9cj

- location: `pnpm-lock.yaml`
- message: sharp@0.34.5 (npm) — sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591
- triage: no-llm-pass — triage skipped

### `osv-0017` — medium — osv/GHSA-fxqj-rqcc-2cmp

- location: `pnpm-lock.yaml`
- message: postcss@8.5.13 (npm) — PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset
- triage: no-llm-pass — triage skipped

### `osv-0014` — medium — osv/GHSA-m99w-x7hq-7vfj

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Denial of Service in App Router using Server Actions
- triage: no-llm-pass — triage skipped

### `osv-0001` — medium — osv/GHSA-mh99-v99m-4gvg

- location: `pnpm-lock.yaml`
- message: brace-expansion@1.1.16 (npm) — brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash
- triage: no-llm-pass — triage skipped

### `osv-0003` — medium — osv/GHSA-mh99-v99m-4gvg

- location: `pnpm-lock.yaml`
- message: brace-expansion@5.0.7 (npm) — brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash
- triage: no-llm-pass — triage skipped

### `osv-0015` — medium — osv/GHSA-p9j2-gv94-2wf4

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname
- triage: no-llm-pass — triage skipped

### `osv-0016` — medium — osv/GHSA-q8wf-6r8g-63ch

- location: `pnpm-lock.yaml`
- message: next@16.2.10 (npm) — Next.js: Denial of Service in the Image Optimization API using SVGs
- triage: no-llm-pass — triage skipped

### `osv-0018` — medium — osv/GHSA-r28c-9q8g-f849

- location: `pnpm-lock.yaml`
- message: postcss@8.5.13 (npm) — PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure
- triage: no-llm-pass — triage skipped

### `osv-0002` — medium — osv/GHSA-rgw5-rvv9-x895

- location: `pnpm-lock.yaml`
- message: brace-expansion@1.1.16 (npm) — brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation
- triage: no-llm-pass — triage skipped

### `osv-0004` — medium — osv/GHSA-rgw5-rvv9-x895

- location: `pnpm-lock.yaml`
- message: brace-expansion@5.0.7 (npm) — brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation
- triage: no-llm-pass — triage skipped

## Historical findings (separate, non-gating)

Historical credentials retain scanner severity. Their disposition is persisted by Gitleaks fingerprint; they remain visible but do not change the current-tree baseline verdict.

_No history-only findings._
