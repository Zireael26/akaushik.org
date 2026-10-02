---
slug: mdx-content-pipeline
purpose: Build-generated MDX bundle, minimal frontmatter parser, and compiled page bodies for case studies and writing posts.
pinned_to: 883e508dd3e7e4c7b3247ebcb575228c6840b5bd
created: 2026-05-15
last_refreshed: 2026-10-03
related_primers: [og-image-generation, agent-readiness-contract]
---

# MDX Content Pipeline

## Purpose

Author case studies and writing posts under `content/`. Build steps produce a raw-content bundle for metadata and Markdown consumers, plus precompiled React modules for HTML pages. Runtime content lookup and page rendering do not read the source tree or compile MDX.

## Entry points

- `lib/content.ts` — `getPostSlugs()`, `getPost()`, `getAllPosts()`, `getAllPostsWithReadingTime()`, and `isDraftHidden()`; defines the case-study and writing frontmatter types and the small frontmatter parser.
- `scripts/build-content-bundle.ts` — reads `content/{case-studies,writing}/*.mdx` and generates `lib/content-bundle.generated.ts`; checks writing-post `art` values against `lib/pixel/topics.ts`.
- `scripts/build-mdx-modules.ts` — compiles each MDX body into generated modules under `lib/mdx/generated/`; strips frontmatter and repeated title/dek chrome before compilation.
- `app/api/case-studies/route.ts` — frontmatter JSON listing in curated order: Neev → VeriCite → Bluehost → curat.money → ClusterBid.
- `app/api/writing/route.ts` — writing JSON listing, newest first by `frontmatter.date`, including derived reading time.
- `lib/reading-time.ts` — derives a reading-time label when frontmatter omits it.

## Data flow

1. `prebuild` runs the content-bundle and MDX-module generators. The bundle generator sorts source filenames and inlines raw MDX (including frontmatter) under `<type>/<slug>` keys in the committed `lib/content-bundle.generated.ts`.
2. `lib/content.ts` sorts bundle keys for `getPostSlugs()`. `getPost()` validates the slug, looks up the bundled string, parses frontmatter, and returns both metadata and raw body. Writing `art` is normalized to the closed `WritingArt` vocabulary.
3. Frontmatter supports quoted or bare scalar values, bare booleans, inline arrays, and YAML lists of scalar items. `getAllPosts()` returns metadata without body; by default it excludes drafts and unlisted writing. `getAllPostsWithReadingTime()` scans posts and derives a label from the body when `readingTime` is absent.
4. The MDX generator uses `@mdx-js/mdx` with GFM, heading slugs, and Shiki-backed pretty-code plugins, then emits a slug-keyed module registry. Work and writing detail pages render `getMdxModule(type, slug)`; Markdown alternates and `/llms-full.txt` use the raw body from `getPost()` instead.
5. The JSON routes expose metadata rather than MDX bodies. The case-study route filters its `ORDER` list against available slugs; the writing route sorts by date. Both declare `force-static` and `revalidate = 300`.

## Dependencies

- Runtime `lib/content.ts` depends on the generated content bundle, `lib/reading-time.ts`, and the writing-art vocabulary. Filesystem reads are in the build scripts, not this loader.
- Build-time MDX compilation uses `@mdx-js/mdx`, `remark-gfm`, `rehype-slug`, `rehype-pretty-code`, and Shiki. `lib/mdx-options.ts` documents a matching plugin stack; the compiler keeps a separate literal plugin list.
- `agent-readiness-contract` — `/work/<slug>.md`, `/writing/<slug>.md`, and `/llms-full.txt` consume raw bodies from the loader.
- `og-image-generation` — case-study OG cards read `title`, `dek`, `year`, `index`, `tag`, `role`, and `stack`; writing OG cards read `title`, `dek`, and `date`.

## Test commands

```bash
# pretest regenerates the bundle and compiled modules before Vitest runs
pnpm test
```

`lib/content.test.ts` exercises the real bundled corpus and uses an isolated mock bundle for a quoted-array edge case. `lib/reading-time.test.ts` covers word-count behavior.

## Gotchas

- **Custom parser, not `gray-matter`.** The parser is a small YAML subset: nested objects, multiline scalars (`|` / `>`), and anchors are not supported as YAML features. Unsupported indented structures can throw `frontmatter parse failure`; scalar-looking syntax may remain a plain string instead of being interpreted. If a new field needs richer YAML, either keep it flat or use a full parser (and accept the bundle cost).
- **`getAllPosts` returns frontmatter only.** It deliberately drops `content` to keep callers honest about cost. Use `getPost()` when you need the body.
- **`getAllPostsWithReadingTime` processes every body.** It walks the in-memory bundle and parses each post; it does not re-read N files from disk. Prefer `getAllPosts()` for metadata-only consumers and avoid repeated full-corpus scans on a hot path.
- **Curated order in `/api/case-studies`.** `ORDER` in `app/api/case-studies/route.ts` is hand-maintained; adding a case study without updating that array silently drops it from the JSON listing. Slugs not in `content/` are silently filtered out by the `available` set, which means a typo fails open.
- **Frontmatter keys are case-sensitive and unquoted-key only.** The regex `^([A-Za-z_][\w-]*)\s*:\s*(.*)$` rejects `"weird key":` style. Stick to lowerCamelCase like `evidenceOf`.
- **`force-static` + `revalidate = 300`** on the JSON routes — content changes propagate on a 5-minute cache window in production, not on every request.
- **Worker boundary is build-time.** Do not move filesystem access, MDX compilation, `new Function`, or Shiki WASM initialization into request-time code. Change MDX plugins in `scripts/build-mdx-modules.ts` and keep the reference stack in `lib/mdx-options.ts` aligned.
- Writing `art` values are a closed vocabulary: the bundle generator warns when absent and fails on unknown values; `getPost()` removes values it cannot normalize.

## Out of scope

- Markdown content negotiation and alternate-route policy — see `agent-readiness-contract`.
- OG-image layout and rendering — see `og-image-generation`.
- Sitemap and `/llms-full.txt` assembly are separate consumers of the same loader.

## Notes

- Frontmatter types live in `lib/content.ts`. They describe the expected shape but are TypeScript casts, not runtime validation; update types and consumers together when the schema changes.
- ADR-0004 documents the original `next-mdx-remote` decision. For the current Worker constraints and build-time replacements, read ADR-0019 and the two generator scripts before changing the loader or compiler API.
