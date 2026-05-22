# security-gate baseline — akaushik.org

- generated: `2026-05-22T18:04:23Z`
- profile:   `web-next`
- tools:     semgrep `1.157.0` · osv-scanner `2.3.8` · gitleaks `8.30.1`
- triage:    skipped (no LLM)

## Summary

- raw findings: **8**
- kept after triage: **0**
- dropped (FP): **0**
- no-llm-pass: **8** (raw scanner output, not triaged)

- severity (kept + no-llm-pass): **critical**: 0 · **high**: 0 · **medium**: 8 · **low**: 0

Verdict: **8 raw findings** (no LLM triage performed).

## Findings

### `osv-0001` — medium — osv/GHSA-jxxr-4gwj-5jf2

- location: `pnpm-lock.yaml`
- message: brace-expansion@5.0.5 (npm) — brace-expansion: Large numeric range defeats documented `max` DoS protection
- triage: no-llm-pass — triage skipped

### `osv-0002` — medium — osv/GHSA-qx2v-qp2m-jg93

- location: `pnpm-lock.yaml`
- message: postcss@8.4.31 (npm) — PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
- triage: no-llm-pass — triage skipped

### `semgrep-0001` — medium — semgrep/javascript.browser.security.wildcard-postmessage-configuration.wildcard-postmessage-configuration

- location: `_reference/portfolio/tweaks.js:57`
- message: The target origin of the window.postMessage() API is set to "*". This could allow for information disclosure due to the possibility of any origin allowed to receive the message.
- triage: no-llm-pass — triage skipped

### `semgrep-0002` — medium — semgrep/javascript.browser.security.wildcard-postmessage-configuration.wildcard-postmessage-configuration

- location: `_reference/portfolio/tweaks.js:68`
- message: The target origin of the window.postMessage() API is set to "*". This could allow for information disclosure due to the possibility of any origin allowed to receive the message.
- triage: no-llm-pass — triage skipped

### `semgrep-0003` — medium — semgrep/javascript.browser.security.wildcard-postmessage-configuration.wildcard-postmessage-configuration

- location: `_reference/portfolio/tweaks.js:75`
- message: The target origin of the window.postMessage() API is set to "*". This could allow for information disclosure due to the possibility of any origin allowed to receive the message.
- triage: no-llm-pass — triage skipped

### `semgrep-0004` — medium — semgrep/javascript.browser.security.wildcard-postmessage-configuration.wildcard-postmessage-configuration

- location: `components/dev/TweakBridge.tsx:112`
- message: The target origin of the window.postMessage() API is set to "*". This could allow for information disclosure due to the possibility of any origin allowed to receive the message.
- triage: no-llm-pass — triage skipped

### `semgrep-0005` — medium — semgrep/javascript.browser.security.wildcard-postmessage-configuration.wildcard-postmessage-configuration

- location: `components/dev/TweakBridge.tsx:145`
- message: The target origin of the window.postMessage() API is set to "*". This could allow for information disclosure due to the possibility of any origin allowed to receive the message.
- triage: no-llm-pass — triage skipped

### `semgrep-0006` — medium — semgrep/javascript.browser.security.wildcard-postmessage-configuration.wildcard-postmessage-configuration

- location: `components/dev/TweakBridge.tsx:157`
- message: The target origin of the window.postMessage() API is set to "*". This could allow for information disclosure due to the possibility of any origin allowed to receive the message.
- triage: no-llm-pass — triage skipped
