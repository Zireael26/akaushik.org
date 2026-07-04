# Design Direction — Portfolio v1

**Status:** Draft v0.1 (review)
**Author:** Claude (first-pass synthesis from interview + audience thesis)
**Last updated:** 2026-04-19

This is the argument for how the site should look, move, and sound — not a style guide. The tokens, type ramps, and component-level decisions come later in a proper design system doc. What follows here is the frame those decisions have to live inside.

---

## 1. North star

> **A quiet, confident craft object that happens to be a portfolio.**

The site should read like something a senior practitioner built for themselves — not like a sales page, not like an agency template, not like a demo reel. A reader should sense the same care on the home page that they find inside a case study. The production value is the pitch.

Three constraints follow from that north star:

1. **Restraint is the differentiator.** The AI-portfolio genre is overcrowded with dark-mode + neon-gradients + particle-field clichés. Doing *less* of that is how this site stands out.
2. **Motion earns its place.** Every motion decision must answer "what does this help the reader understand or feel?" If the answer is "it looks cool," it doesn't ship.
3. **The engineering is part of the design.** Public PRDs, ADRs, a changelog link — these are aesthetic choices as much as structural ones. The site visually acknowledges that it is built in the open.

## 2. What we are not

- **Not Awwwards maximalism.** No scroll-jacking. No 90-viewport-height hero with a single word and a timer. No cursor-trailing particles. No landing page that takes 4 seconds to "load in."
- **Not an AI-agency template.** No glowing orbs, no "next-gen" copy, no futurist chrome. Those exist because they sell; we're opting out because they are now a tell.
- **Not a developer-brag aesthetic.** No terminal overlays, no monospace-everywhere, no "1s ago" fake activity widgets, no "my wakatime" brag bars.
- **Not a consumer startup site.** No hero product shot, no above-the-fold pricing, no social-proof logo carousel pretending the portfolio is a company.

These are all temptations. Naming them now prevents drift later.

## 3. Audience split in the visual language

The dual-voice decision from PRD §6 has a visual analog. The site opens warm and *readable by a non-technical buyer*: generous spacing, editorial typography, a calm hero, a short clean About. As the reader scrolls into case studies and writing, the density and specificity increase — architecture diagrams, embedded code, system traces. The visual grammar earns the right to get technical by starting quiet.

## 4. Aesthetic principles

### 4.1 Editorial, not corporate

Lean on editorial design conventions — serif for a carefully chosen hero or pull-quote beat, generous measure, real hierarchy, restrained color. The portfolio should feel like a well-designed long-form publication with a 3D scene in it, not a SaaS marketing site with a blog bolted on.

### 4.2 The motif is graphs and agents — used once, consistently

The visual motif is **nodes, edges, and flowing information.** It appears in three places, and only three:

1. **The hero** — a live raw-Three.js scene with a small number of agents-as-nodes and information flowing along edges.
2. **Case study intros** — each case study gets a HyperFrames-rendered motion reel that reuses the same node-and-edge vocabulary, tuned to that project's palette.
3. **Section dividers and the section-header micro-graphic** — a still variant of the same language, flat and small.

Used anywhere else, the motif becomes decoration. The discipline of using it *only* in those three slots is what makes it read as a language.

### 4.3 Density gradient

Home page = low density, high confidence. Case studies = higher density, technical specificity. Writing = full density, full voice. The reader learns this gradient on the first scroll and it holds everywhere.

### 4.4 Professional polish, not flash

Polish = consistent spacing, real alignment, careful typography, a color system that doesn't surprise, a site that doesn't jank on resize. Flash = things that wave at the viewer. We want the first.

## 5. Typography hypothesis (to be validated)

Two families, no more. Proposed pairing:

- **Display / editorial:** a contemporary text-serif with opinions — **Newsreader** (Google Fonts, open-licensed, designed for on-screen long-form reading), or **Fraunces** as a more assertive alternative. Used for hero tagline, case study headlines, and pull-quotes. One family only, restrained sizes.
- **UI / body / technical:** **Inter** or **Plus Jakarta Sans** — Plus Jakarta aligns with the typography in Neev and VeriCite, which creates a visual through-line if the portfolio ever links into demos of those systems. Leaning Plus Jakarta for coherence.
- **Monospace:** **JetBrains Mono** or **IBM Plex Mono** for code blocks only. Not used decoratively.

Open questions: does the editorial serif play nicely with Hindi/Devanagari if we add vernacular copy in v1.1? — validate before locking in.

## 6. Color hypothesis (to be validated)

### 6.1 Direction

A **warm, neutral base** — off-white parchment in light mode, deep slate in dark mode — with a single **opinionated accent** that carries the brand signal, and one reserved **node-highlight accent** used only in motion contexts.

This is the opposite of the dark-mode-electric-blue AI-portfolio cliché. Warm neutrals + a confident single accent + restraint reads as editorial craft and de-clichés the aesthetic.

### 6.2 Palette candidates (for review, not locked)

- **Base light:** a warm off-white around `#F7F4EC` (echoing VeriCite's `#f5f1e4` cream), for continuity with the ecosystem of projects.
- **Base dark:** a deep neutral slate around `#121417` — not pure black, not blue.
- **Ink:** a near-black with warmth, e.g. `#1A1A1E` on light; warm off-white on dark.
- **Primary accent (brand signal):** a single considered hue — candidates: Neev's `#13423d` deep forest (ties the portfolio to Neev without being derivative), or a muted terracotta `#C44D2E`, or an opinionated golden-ochre. To be chosen after typography is locked.
- **Motion accent (used only in scene/reel nodes):** a higher-chroma secondary that reads on both bases — tentatively a soft signal-green picked to harmonize with whichever primary we choose.

Principle: **one accent does the work.** Two accents starts looking like a template.

### 6.3 Dark mode

Dark mode is supported because the existing site does it and the technical audience expects it. It is *not* the default. Light mode leads; dark mode is toggle-accessible and respected when the user's system is set to it. `prefers-color-scheme` wired in.

## 7. Motion language

### 7.1 Global rules

- Every animation has a definition of "done" (settles at rest; no infinite idle motion unless deliberately part of the live Three.js hero).
- `prefers-reduced-motion: reduce` is respected everywhere; all reels become static posters, the Three.js scene falls back to a still.
- Layout-level transitions stay under 300ms. Section-entry animations stay under 600ms.
- No parallax outside of a narrow, deliberate set of case-study hero beats.

### 7.2 The three motion pipelines

- **raw Three.js (live)** — the hero scene. Low-poly, soft lighting, node-edge-information language. Lightweight enough to ship with a performance budget (see §9). One idea executed well; not an environment to wander around in.
- **HyperFrames (pre-rendered reels)** — case-study intro loops and, optionally, writing-hero art. Served as `<video>` with a static poster; never block content paint. Use HyperFrames when determinism, cinematic quality, or a specific framing matters more than interactivity.
- **CSS / platform motion (micro-interactions)** — list-item reveals, nav state transitions, card hover states. Micro, not macro. Add a runtime motion library only with an ADR.

### 7.3 Explicit motion no-nos

- No cursor-chasing blobs.
- No text that types itself on first view.
- No 3D scroll-locked cinematics that hijack reading flow.
- No "drawer" or "curtain" transitions between home-page sections. The page scrolls. It doesn't perform.

## 8. Layout & IA behavior

- **Home page is a long, considered scroll** with deliberate section rhythm (PRD §5). The nav is sticky and links to sections; section anchors use `scroll-behavior: smooth` with a reasonable offset.
- **Case-study index** is a grid of four editorial cards with a strong typographic hierarchy — headlines are the hook, imagery supports.
- **Case-study detail** is long-form: prose-forward, with architectural diagrams and code blocks where they earn their place. Sidebars collapse on mobile.
- **Writing** uses the same long-form template as case studies, styled editorially with drop caps permitted sparingly.
- **Services** is a single opinionated page, not a card grid. Three or four engagement archetypes, each described as if it were an ADR.

## 9. Performance budget

The site has a performance budget because a portfolio that brags about systems engineering cannot ship a 4-second LCP.

- **LCP** < 2.5s on slow-4G.
- **CLS** < 0.1.
- **INP** < 200ms.
- **JS on initial route** — aim for < 150KB gzipped; current raw-Three.js scene remains above that aspiration and is tracked in `docs/BUNDLE_BUDGET.md`.
- **Three.js hero** — static SVG fallback holds the space so there is no layout shift; reduced-motion users keep the still surface.
- **Fonts** — at most two variable fonts + one monospace, self-hosted, `font-display: swap`, preloaded for the above-the-fold weight only.
- **Video reels** — AV1/H.265 where supported, with an H.264 fallback. `preload="metadata"`. Never autoplay with sound.
- **Images** — Next.js `<Image>`, responsive `sizes`, AVIF/WebP, no unnecessary blur-up work.

## 10. Accessibility

- WCAG 2.2 AA target, not aspirational.
- Every color pair audited against its background; primary accent passes AA on both base modes.
- Keyboard navigation works end-to-end, including closing modals and moving focus around the Three.js scene sensibly.
- Every decorative motion respects `prefers-reduced-motion: reduce`.
- All videos have a visible static poster and a `<track>` fallback where spoken content exists.
- Screen-reader landmarks match the visual IA; section headings are real headings.
- The Three.js scene has a non-visual description (for the curious screen-reader user) and does not trap focus.

## 11. Iconography & imagery

- **Iconography:** a single coherent system — Lucide or Phosphor — no mix. Stroke-based, aligned to a 24px grid, never filled + stroke mixed.
- **Photography:** minimal; where used, it is deliberate (e.g., one portrait on About). Stock imagery does not ship.
- **Illustration:** the node-and-edge motif is the illustration language, full stop. No second illustrative vocabulary.

## 12. Copy & microcopy tone

- Use the Oxford comma.
- Sentence case for headings everywhere except the site wordmark.
- Numbers: digits for anything greater than nine; written out for small counts when prose flows better ("four featured projects").
- CTAs read as invitations, not commands: "Let's talk about your project" beats "Contact me now."
- No em-dashes in marketing copy. One em-dash maximum per paragraph in long-form.
- No exclamation marks anywhere except in direct quotes.

## 13. Open questions

- **Q1. Primary accent hue.** Neev-forest for family resonance, terracotta for warmth, or golden-ochre? Decide after typography test on real copy.
- **Q2. Default color mode.** Light lead with dark toggle (current recommendation) — confirm Abhishek is okay with this given the existing site defaults to dark.
- **Q3. Hero Three.js scene — fidelity vs. cost.** How much CPU/GPU are we willing to spend on a hero that most visitors view once? Propose a "pretty-but-cheap" baseline with an optional high-fidelity toggle.
- **Q4. Literal node labels in the hero.** Do the nodes carry labels ("agent", "tool", "memory") or stay abstract? Labels are on-thesis but risk looking literal.
- **Q5. Vernacular-language rendering.** If Hindi/Devanagari is in play for v1.1, do both primary families render well? Serif especially. Validate early.

## 14. Review prompts for Abhishek

- Is "quiet, confident craft object" the right north star, or does it under-sell the ambition?
- Plus Jakarta Sans for UI — does matching Neev/VeriCite create the portfolio-as-family effect you want, or does it make the portfolio feel like a sub-site?
- The "three-slot rule" on the graph/agent motif (hero + case reels + section dividers only) — too strict?
- Light-mode default with dark toggle — okay, or do we lead dark given the existing site?
- Any visual reference you already have in mind that we should explicitly aim for *or* explicitly avoid? (If you name one site in each column, it'll sharpen the design fast.)
