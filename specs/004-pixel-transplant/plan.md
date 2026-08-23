# Plan 004 — Pixel transplant

**Spec:** `spec.md` · **Branch:** `feat/pixel-transplant`

---

## 1. Stack decision: retrofit Next.js, do not rewrite in Astro

The design was authored as Astro with vanilla-TS canvas islands, so an Astro
rewrite was the obvious first instinct. It was investigated and rejected.

`@opennextjs/cloudflare` supports all minor and patch versions of Next.js 16,
including Turbopack builds, edge middleware, ISR and image optimization, and
Next 16.2 shipped a stable Adapter API built with Cloudflare. Cloudflare's own
guidance is that Workers now has parity with Pages for static assets, SSR and
custom domains.

That matters because of one file. `proxy.ts` — Next 16's renamed middleware — is
the backbone of the agent-readiness contract: RFC 8288 `Link` headers on every
response, both Markdown content-negotiation patterns, and the ADR-0014 nonce
CSP. It is edge middleware, which OpenNext supports. Under Astro it would have
to be rebuilt as Worker logic, and the nonce CSP would need an HTMLRewriter pass
over every HTML response or a move to hash-based CSP.

Retrofitting keeps ~2,000 lines of machinery and ~3,950 lines of tests exactly
where they are. The design layer costs the same on either path. The difference
is entirely in what is put at risk, and the thing at risk is the site's thesis.

**Recorded as ADR-0018** (to be written; supersedes the framework half of
ADR-0001).

## 2. What moves, what stays

| Pile | Contents | Handling |
|---|---|---|
| Untouched | MCP server, `proxy.ts`, llms.txt / llms-full.txt, OpenAPI, api-catalog, `.well-known/*`, agent-skills index, sitemap, robots, structured data, MDX pipeline, all vitest suites | Not one line changes |
| Verbatim | 13 writing posts, 5 case studies, `docs/`, ADRs, `voice.md` | Copied; every URL keeps its path |
| Deleted | `globals.css`, eight section components, `Wanderer`, `AgentGraph`, `three`, Tailwind + `@theme` bridge, `TweakBridge`, `vercel.json` | Gone; recoverable from history |
| Re-authored | Hero exhibits, cursor sprite, skyline, marquee string, method icons, home copy | New canvas code on ported engines |
| Rewritten | 9 Playwright specs | Selector-coupled to markup being replaced |

## 3. Architecture

**Canvas islands.** Each engine is `lib/scenes/<name>.ts` exporting
`mount<Name>(canvas): () => void`. The React wrapper in `components/pixel/` is a
ref, an effect, and a disposer — nothing more.

Two deliberate deviations from the Astro originals, both forced by React:

1. **Mounts return a teardown.** The originals mount once for the document's
   lifetime. Under React that leaks a rAF loop and listeners on every remount,
   and StrictMode double-mounts in dev. Listeners go through an
   `AbortController`; the disposer cancels the frame.
2. **Theme reads the attribute, not a setter.** The original routed every theme
   change through its own `setDark()`. This site already has two writers of
   `html[data-mode]` — `public/init-theme.js` before first paint and the theme
   toggle on click — and neither knows about canvases. `lib/pixel-theme.ts`
   observes the attribute with a `MutationObserver`, so any writer works.

**Styling.** `app/styles/tokens.css` holds every colour and font.
`app/styles/sections/` holds one file per section, imported from
`app/layout.tsx`. They are **not** `@import`-chained from `globals.css`: a
12-deep chain silently dropped every file after the first few under Turbopack —
20 KB on disk served as 7.5 KB, taking the nav and the method grid with it.

**Art contract.** Exhibits are silhouettes rendered into an offscreen canvas at
cell resolution and folded into streak noise. Re-authoring a piece is one
drawing function; the engine and every constant beneath it are untouched. This
is what made the four exhibits, the skyline and the marquee swappable without
touching the heatfield.

## 4. Risks

| Risk | Mitigation |
|---|---|
| `next/og` is undocumented under OpenNext, and `ImageResponse` has a 500 KB bundle ceiling. Three `opengraph-image.tsx` routes depend on it. | Spike it on a preview Worker **before** anything depends on it. Fallback: pre-render OG cards at build with sharp. |
| Nonce CSP behaves differently through the adapter | `security-reviewer` pass on headers; verify against ADR-0014 on the preview |
| Cloudflare credentials: the shell `CLOUDFLARE_API_TOKEN` is zone-scoped only and wrangler prefers it over OAuth, failing with a misleading account-lookup error | Locally `env -u CLOUDFLARE_API_TOKEN`. CI needs a dashboard-minted Workers-scoped token — operator action, cannot be automated |
| Losing Vercel's per-PR previews | `wrangler versions upload` per version in CI; accepted ergonomic downgrade |
| Parallel agents colliding in one working tree | Disjoint file ownership; one CSS file per section; engine work isolated in a worktree |

## 5. Sequence

**P0** spec triad + ADR · **P1** OpenNext spike on a preview Worker · **P2**
token foundation, Tailwind out · **P3** engine ports, art unchanged · **P4** art
re-draw · **P5** sections, writing template, copy · **P6** Playwright rewrite,
Lighthouse, agent-readiness scan, DNS cutover.

P1 is deliberately before P2: it answers the only open technical risk while the
old design is still there as a reference.
