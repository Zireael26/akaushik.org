# Handoff — the writing/case-study reading surface (feat/writing-detail)

Apex: Claude Code, pane `w4:p1`, main checkout `/Users/abhishek/projects/personal/akaushik.org`.
Worktree: `/Users/abhishek/projects/personal/akaushik.org-worktrees/writing-detail`.
**Never touch the main checkout.** Two other streams run in sibling worktrees.

Branch: `feat/writing-detail`, off `origin/main`.

---

## Five defects, all measured on production, all reported by the operator

### D1 — writing posts still serve HyperFrames video

`/writing/ai-for-msme` requests `writing/ai-for-msme.mp4` **and** `writing/ai-for-msme.webp`, and
renders a 786×443 `<video>`. The case-study videos were removed under ADR-0020; the writing ones
were explicitly deferred at the time and never came back. The operator's objection is the same one
that retired the others: baked pixels on a fixed background, **no dark variant**, while everything
around them repaints from theme tokens.

`app/writing/[slug]/page.tsx:18` imports `HyperframesLoop`;
`components/media/hyperframes-loop.tsx:194` builds `/video/writing/${slug}`. Four posts have
assets: `ai-for-msme`, `building-this-portfolio`, `fastembed-to-tei`, `micrograd-makemore`.

Replace with a pixel field, `git rm` the eight files once nothing references them, and delete
`hyperframes-loop.tsx` only after checking every reference (direct calls, type references, string
literals, dynamic imports, re-exports, barrel files, test mocks). ADR-0020 covers the reasoning;
extend it or add a short successor noting writing is now included.

### D2 — the art at the top is thin, stretched, and above the title

`.px-route-field` renders **788×108** at the very top of a writing post, above the H1. The operator
wants it *larger and better*, not a letterbox strip. It is drawing a per-post topic source at the
`strip` preset; the preset is the problem, not the source.

Make it a proper piece of art. Look at what a case-study `ReelField` does at `hero` and match that
ambition. Consider whether it sits above the title at all or reads better under it — the operator
said it appears "even above the whole blog content", which is a complaint about placement as much
as size.

### D3 — the reading column uses under half the page

Measured at a 1440px viewport: the prose column is **652px** — 45% of the width — inside a
`--wrap-max` of 1560px. The operator: *"the left-hand side is okay with me, but it's taking less
than 40% of the real estate that is available."*

`--prose-max: 70ch` is a defensible measure for body text and should not simply be doubled; long
lines are harder to read, and that is why the token exists. **The editorial answer is to keep the
text column readable and let everything that is not body text break out wider** — the art, figures,
code blocks, tables, pull quotes. The operator asked for exactly this: *"They should also be taking
up a bit more space on the sides."*

So: widen the measure modestly if it genuinely reads better (75–80ch is still comfortable), and
give media and other block elements a wider track. Show me both widths before you settle.

### D4 — the case-study dek renders as a grey bar

On `/work/neev` the dek blockquote has a background wash and **zero padding**, so the text sits
flush against a grey slab. Operator: *"This subtitle looks so terrible."*

Note the asymmetry: `stripTitleChrome` removes the H1 + dek from **writing** bodies because the
template renders them, but case studies keep theirs, so the dek falls through to generic
blockquote styling. Either give the case-study template a real dek treatment — larger, lighter,
no box — or strip it from the body as writing does and render it from frontmatter. The second is
more consistent; your call, with reasoning.

Whatever you do, do not leave a background with no padding. That combination is what makes it
look broken.

### D5 — two shades of white meet with no separation

The operator, on the home page: *"There are two shades of white, which are not properly separated.
If we had different section background colors, they should have been at least correctly spaced
out and separated."*

Find where adjacent sections carry different backgrounds and either commit to the change (enough
padding either side that it reads as a deliberate band) or drop it. A 2% tint with no breathing
room reads as a rendering artifact.

---

## Constraints

- Never hard-code a hex. Palette from `lib/pixel.ts`, theme from `lib/pixel-theme.ts`, tokens from
  `app/styles/tokens.css`.
- Small-screen rules belong in `app/styles/sections/_mobile.css`, which is imported **last**.
  `_shared.css` is imported first and loses the cascade to every section file — that has already
  cost time once.
- The density oracle in `lib/pixel/products.test.ts` applies to any new field art.
- `e2e/reduced-motion.spec.ts` asserts a motion-disabled visitor is sent no media bytes. Removing
  the writing videos changes what that spec should check. Update it to the new truth; do not
  weaken an assertion to make it pass.

## Receipts

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage`, Playwright green, plus
**screenshots** at 1440px and 375px in both themes of: a writing post, a case study, and the home
section boundary from D5. Include a before/after of the reading column with the measured width.

Apex owns the deploy. Do not deploy. Commit at every boundary.
