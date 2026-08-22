# Handoff — canvas engine port (feat/pixel-engines)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
You are in the worktree `/Users/abhishek/projects/personal/akaushik.org-worktrees/engines`.
**Never touch the main checkout.** Everything below happens here.

## What this is

akaushik.org is being re-skinned with the pixel-art design built for
`/Users/abhishek/projects/personal/gaurijha.com`. The hero heatfield is already ported and
working. Your job is the remaining five canvas engines.

## The source

The design lives in the sibling repo `gaurijha.com`. Its public site is taken down at HEAD —
**read the source from the git tag `public-site-v1`**:

```sh
cd /Users/abhishek/projects/personal/gaurijha.com
git show public-site-v1:src/scripts/marquee.ts
git show public-site-v1:src/scripts/skyline.ts
git show public-site-v1:src/scripts/method-band.ts
git show public-site-v1:src/scripts/pixel-band.ts
git show public-site-v1:src/scripts/theme-switch.ts
```

`design-refs/design.md` at HEAD is the binding design system. Read it first.

## The pattern to follow — read this before writing anything

`lib/scenes/heatfield.ts` + `components/pixel/Heatfield.tsx` in THIS worktree are the already-done
reference. Match them exactly. Specifically:

1. **The engine is `lib/scenes/<name>.ts`** and exports `mount<Name>(canvas: HTMLCanvasElement): () => void`.
   It takes the canvas as an argument — it does NOT query the document for a data attribute the way
   the Astro original does. The React wrapper owns the ref; re-querying would be a second source of truth.
2. **It returns a teardown.** The Astro originals mount once for the document's lifetime and never
   clean up. Under React that leaks a rAF loop and listeners on every remount. Use an
   `AbortController` and pass `{ signal }` to every `addEventListener`; `cancelAnimationFrame` in the
   disposer; unsubscribe the theme listener.
3. **Theme comes from `lib/pixel-theme.ts`** — `isDark()` reads `html[data-mode]`, `onThemeChange()`
   is a MutationObserver on that attribute. Do NOT port gaurijha's `body.gj-dark` / `gj-theme`
   localStorage logic; this site already has its own theme mechanism and two writers of it.
4. **Palette and primitives come from `lib/pixel.ts`** — `h()`, `PALETTE`, `navy()`, `deepBlue()`,
   `canvasBg()`, `inkAlpha()`, `cellRect()`, `fitCanvas()`, `prefersReducedMotion()`,
   `isFinePointer()`. Never hard-code a hex.
5. **Every constant in the source is load-bearing.** Cell sizes, scroll speeds, hash offsets,
   re-hash intervals, colour-mix ratios: copy them exactly. This is a fidelity port, not a rewrite.
   Where you must deviate (React lifecycle, the two points above), say so in a comment explaining why.
6. **Keep the art as-is.** The subject matter is law-themed (a Delhi legal skyline, "see you in
   court" marquee text) and is being re-drawn by the apex afterwards. Port it faithfully first so
   that any later bug is attributable to the new drawing code and not to the port. Do not
   substitute new art.

## Deliverables

Each engine ships as a pair, and the React wrapper for four of them **already exists as a stub** —
replace the stub body, keep the exported name, the className, and the props shape:

| Engine source (at tag) | New engine file | React wrapper | Wrapper status |
|---|---|---|---|
| `src/scripts/method-band.ts` | `lib/scenes/method-band.ts` | `components/pixel/MethodBand.tsx` | stub exists |
| `src/scripts/marquee.ts` | `lib/scenes/marquee.ts` | `components/pixel/Marquee.tsx` | stub exists |
| `src/scripts/skyline.ts` | `lib/scenes/skyline.ts` | `components/pixel/Skyline.tsx` | stub exists |
| `src/scripts/pixel-band.ts` | `lib/scenes/pixel-band.ts` | `components/pixel/PixelBand.tsx` | stub exists |
| `src/scripts/theme-switch.ts` | `lib/scenes/theme-switch.ts` | `components/pixel/ThemeSwitch.tsx` | **create it** |

`ThemeSwitch` is the one with real behaviour rather than pure decoration: it is a 52×26 outlined
pixel track with an amber sun / lime moon knob that slides on toggle. It must
**write `html[data-mode]` and persist to `localStorage` under the key `abhishek.portfolio.mode`** —
that is the existing key, set by `public/init-theme.js` and `components/site/ThemeToggle.tsx`. Do
not invent a second key. It replaces the old `ThemeToggle` button, so it needs a real
`<button>` wrapper with `aria-label`, keyboard operability, and a visible focus ring. Decorative
canvases stay `aria-hidden`.

**Do not port `cursor.ts`.** It is 520 lines and the apex is handling it with the art re-draw.

## Method band, one extra note

The band highlights a column on hover via `[data-mstep]` attributes on the step elements. Those
elements are rendered by a section component the apex is building in parallel, in the main
checkout. Keep the same attribute contract (`data-mstep="0".."3"`) and query them from the
document at mount — that one is a genuine cross-component contract, not a second source of truth.
If they are absent, degrade quietly: draw the band with no highlight, never throw.

## Gates — run these yourself, receipts required

```sh
pnpm typecheck   # tsc --noEmit, must exit 0
pnpm lint        # eslint ., must exit 0
pnpm test        # vitest, 178 tests must still pass
```

Note `pnpm dev` binds port 3100 and the apex already has a dev server there. **Do not start a dev
server.** If you need to see something render, say so in the pane and the apex will screenshot it.

Do not run `pnpm build`.

## Hard stops — stop and ask in the pane

- Anything that would touch the main checkout.
- Any change to `app/styles/**`, `app/globals.css`, or any `components/sections/**` file. Those are
  being rewritten in parallel and you will collide. Engines and wrappers only.
- Any new dependency. The port needs none.
- Any change to `lib/pixel.ts` or `lib/pixel-theme.ts` beyond *adding* an export. If you think an
  existing helper is wrong, say so rather than changing it — the heatfield depends on it.

## Commit discipline

Commit at each engine boundary on `feat/pixel-engines` — one commit per engine, message in the
repo's voice (terse, lowercase scope, no `Co-authored-by` and no generated-with footers; see
`CLAUDE.md`). An uncommitted multi-thousand-line tree on a dead session is the failure this brief
exists to prevent. Do not merge, do not push, do not open a PR.

Report per engine: the file pair, the gate output, and anything in the source you could not port
faithfully and why.
