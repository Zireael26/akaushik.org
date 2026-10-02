---
slug: og-image-generation
purpose: Three Next.js ImageResponse routes render 1200×630 PNG share cards for home, case-study, and writing pages; the slug routes draw from a generated content bundle.
pinned_to: 883e508dd3e7e4c7b3247ebcb575228c6840b5bd
created: 2026-05-15
last_refreshed: 2026-10-03
related_primers: [mdx-content-pipeline, hyperframes-reels]
---

# Open Graph Image Generation

## Purpose

Three App Router `opengraph-image.tsx` handlers return `next/og` `ImageResponse` PNGs at 1200×630. They share the pixel palette, a deterministic SVG pixel band, and a flex-based card layout.

## Entry points

- `app/opengraph-image.tsx` — home card with hard-coded copy and no content lookup. Exports its alt text, dimensions, and PNG type.
- `app/work/[slug]/opengraph-image.tsx` — case-study card: year, index/tag, title, dek, role, and stack.
- `app/writing/[slug]/opengraph-image.tsx` — writing card: title, dek, and date formatted by `lib/dates.ts:formatMonthYear`.

All three handlers declare the Node.js runtime and 1200×630 image/png output. The two slug routes set dynamicParams = false and export generateStaticParams().

## Data flow

- Work params come from `getAllPosts('case-studies')`; writing params come from `getAllPosts('writing', { includeUnlisted: true })`. Both route handlers load each requested slug through `getPost()` and call `notFound()` for absent posts or production-hidden drafts.
- `lib/content.ts` reads the generated `CONTENT_BUNDLE`, not MDX files at request time. `package.json`'s `prebuild` regenerates it with `scripts/build-content-bundle.ts`.
- Case-study cards display `year`, `index`, `tag`, `title`, `dek`, `role`, and `stack`; the stack footer still guards with `Array.isArray()` before joining. Writing cards display `formatMonthYear(date)` when a date exists, otherwise an empty date label.
- The date helper formats in UTC. Case-study and writing pixel bands seed from the slug; the home band uses fixed hash coordinates. All use `h`, `PALETTE`, `canvasBg(false)`, and `inkAlpha` from `lib/pixel.ts`.

## Dependencies

- `next/og` — `ImageResponse` and Satori rendering.
- `lib/content.ts` — frontmatter and slug data from the generated MDX bundle.
- `lib/dates.ts:formatMonthYear` — writing-card date label.
- Page title/description metadata is separate from the image JSX; see `app/layout.tsx` and the page `generateMetadata()` functions.

## Manual verification

`pnpm dev` serves on port 3100. Open these image routes and inspect the raster output:

```bash
open http://localhost:3100/opengraph-image
open http://localhost:3100/work/neev/opengraph-image
open http://localhost:3100/writing/ai-for-msme/opengraph-image
```

For a production-mode render, `pnpm build && pnpm start` starts the app on port 3100.

## Gotchas

- **Node runtime, not edge.** All three handlers declare `runtime = 'nodejs'`; the slug routes use `generateStaticParams`, and their comments note that Edge cannot pre-render those params. The content loader is a generated bundle, not request-time `node:fs`.
- **No font bytes are embedded.** The handlers set `fontFamily` stacks, but their comments say the bundled Satori build accepts TTF/OTF rather than the site's WOFF2 files, so `ImageResponse` uses its built-in default font. Do not assume the named site faces are actually loaded.
- **Satori's CSS subset is restrictive.** Flexbox only: `display: grid` throws at render time; `gap`/`rowGap`/`columnGap` are supported. `border-bottom`/`border-top` are supported, but shorthand `border` is finicky. Unknown properties are silently ignored (only invalid values for fixed-choice properties throw), so verify visually after edits.
- **Stack shape.** `CaseStudyFrontmatter.stack` is typed `string[]`, but the frontmatter parser casts parsed values without runtime validation; a malformed scalar can still be a string. The work-card handler checks `Array.isArray(fm.stack)` before joining. Keep the guard.
- **Accent colors come from shared tokens.** The handlers use `PALETTE.cobalt` and the other `PALETTE` entries in `lib/pixel.ts`, not duplicated `#13423D` literals.
- **Generated params, not on-demand slugs.** `getAllPosts()` excludes drafts by default; case studies also exclude unlisted posts, while writing explicitly includes unlisted posts. With `dynamicParams = false`, only generated slugs are admitted. A new eligible post needs the content bundle/build refreshed; neither OG handler configures `revalidate`.
- **Missing or production-hidden posts call `notFound()`.** Edge unfurlers occasionally probe non-existent paths; the 404 response is fine for them. Don't switch to a placeholder image — empty OG is better than a misleading one.

## Out of scope

- Twitter Card / `twitter:image` metadata — Next.js wires this from the same OG image file unless overridden in `metadata`.
- Favicon — separate concern: `app/icon.tsx` plus `public/favicon.{ico,svg}` (there is no apple-touch-icon).
- Case-study reels — canvas pixel fields in `components/work/reels.tsx` (ADR-0020), not OG images. See `hyperframes-reels` primer.
- Open Graph metadata strings (`title`, `description`) — owned by each page's `generateMetadata`, not by the OG handler.

## Notes

- The home OG declares `alt = "Abhishek Kaushik — AI systems for businesses that haven't met AI yet"` — that string surfaces in screen-reader contexts on share previews. Keep it in sync with the home headline if copy changes.
- ADR-0003 covers the canonical domain (`akaushik.org`) the OG handlers hard-code in their visible chrome (`akaushik.org / work`). If the canonical changes, those strings need touching even though they're decorative.
