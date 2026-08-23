# ADR-0019 — Cloudflare Workers runtime constraints

**Status:** Accepted
**Date:** 2026-08-23
**Supersedes:** nothing — this ADR constrains future work

## Context

Three Cloudflare Workers runtime incompatibilities were observed after the retrofit in ADR-0018. Each was a hard runtime refusal, not a preference.

1. **Proxy runtime.** Next 16 runs `proxy.ts` (renamed from `middleware.ts`) in the Node runtime and rejects `runtime: 'edge'` with “Proxy does not support Edge runtime”. `@opennextjs/cloudflare` supports edge middleware only and aborts the build with “Node.js middleware is not currently supported” when it finds a proxy. There is no version of either that satisfies the other.

2. **Filesystem.** `lib/content.ts` read MDX from disk at request time with `readFileSync`. On Workers `node:fs` is an empty per-request scratch space, so every `/work/<slug>` and `/writing/<slug>` returned 404 while prerendered index pages appeared healthy. Prerendering around the problem is not available because `app/layout.tsx` reads `headers()` for the ADR-0014 nonce CSP, which makes the route tree dynamic.

3. **Runtime MDX and WASM.** With content reachable, the same pages returned 500. `next-mdx-remote` compiles MDX per request and evaluates it with `new Function`; Workers refuse that with “EvalError: Code generation from strings disallowed for this context”. Shiki’s oniguruma grammar engine is a second refusal for the same reason — it instantiates WebAssembly from bytes — with “Wasm code generation disallowed by embedder”. A Worker runs only code that existed at deploy time.

## Decision

Adopt build-time generation for each refusal and keep a single pure policy for the agent-readiness contract.

- **Proxy policy.** The agent-readiness contract (RFC 8288 `Link` headers, both Markdown negotiation patterns, the ADR-0014 nonce CSP, and preview-host handling) is pure functions in `lib/agent-proxy.ts`. `proxy.ts` is the local adapter for `next dev` and `worker/index.ts` is the Cloudflare adapter; both adapters decide nothing and contain no policy. `scripts/cf-build.mjs` parks `proxy.ts` (and `proxy.test.ts`) for the duration of the Cloudflare build and restores it in a `finally`, because the two runtimes cannot coexist in one build.

- **Content bundle.** Runtime filesystem reads that produced content 404s are replaced by `scripts/build-content-bundle.ts`, which inlines the nineteen MDX files into a committed module. `lib/content-bundle.generated.ts` is committed so a fresh clone typechecks before any build step; `prebuild` regenerates it and a stale bundle appears as a dirty `git status`.

- **MDX modules.** Runtime `next-mdx-remote`/`new Function` and Shiki WASM that produced 500s are replaced by `scripts/build-mdx-modules.ts`, which compiles the MDX bodies to plain ESM during the build where `new Function` and `WebAssembly` are ordinary. Highlighting and MDX parsing then cost nothing per request. `stripTitleChrome` lives in `lib/strip-title-chrome.ts` so the generator and the article template share one implementation.

## Consequences

These are load-bearing constraints on future work:

- No runtime code may compile templates, instantiate WebAssembly from bytes, call `new Function`/`eval`, or read the filesystem. Anything needing those capabilities moves into a build step that emits committed or generated modules before deploy.

- MDX plugin changes belong in `scripts/build-mdx-modules.ts`, not `lib/mdx-options.ts`. `lib/mdx-options.ts` documents the shared plugin stack for reference; the build-time compiler keeps its own literal list against `@mdx-js/mdx` because the option shapes differ. Changing one without the other is a divergence.

- The adapter boundary remains thin: policy stays in `lib/agent-proxy.ts`. A rule implemented in only one of `proxy.ts` or `worker/index.ts` ships to one runtime and not the other and is a bug by construction.

## Alternatives considered

**Run `proxy.ts` on edge via `runtime: 'edge'`.** Rejected — Next 16 rejects it with “Proxy does not support Edge runtime”.

**Support Node middleware in `@opennextjs/cloudflare`.** Rejected — the adapter aborts with “Node.js middleware is not currently supported” and lists Node middleware as unsupported.

**Compile MDX per request with `next-mdx-remote` or instantiate Shiki WASM at runtime.** Rejected — Workers refuse both with “EvalError: Code generation from strings disallowed for this context” and “Wasm code generation disallowed by embedder”.

**Prerender content pages to avoid `node:fs` or keep `stripTitleChrome` in the page.** Rejected — the `headers()` nonce makes the route tree dynamic, and build-time MDX compilation requires the strip to happen in the generator, so one copy in `lib/strip-title-chrome.ts` is the single source of truth.
