# PRD — Abhishek Kaushik, Personal Portfolio

**Status:** Draft v0.1 (review)
**Author:** Abhishek Kaushik (with Claude as drafting partner)
**Last updated:** 2026-04-19

**Companion docs (to be produced after PRD sign-off):**
- `ROADMAP.md` — phased delivery plan
- `ADR-0001-stack.md` — Next.js + TS + Tailwind + shadcn/ui, pinned versions
- `CASE_STUDIES_OUTLINE.md` — problem → approach → outcome skeletons for the four featured projects (draft alongside this doc)
- `DESIGN_DIRECTION.md` — aesthetic principles, motion language, typography & color hypotheses (draft alongside this doc)
- `BIO_DRAFT.md` — hero tagline + About paragraph drafts (draft alongside this doc)
- `AGENT_READINESS.md` — hard requirement spec aligning the site with Cloudflare's isitagentready.com checks across Discoverability / Content / Bot Access Control / Capabilities (draft alongside this doc)

---

## 1. Summary

This is a personal portfolio for Abhishek Kaushik — an AI engineer who ships real agent systems in production — built to do three jobs at once: represent him honestly, open doors with non-technical business owners (primarily Indian MSMEs considering AI for the first time), and hold credibility with senior engineers and AI buyers who would evaluate him for deeper work.

The site is not a CV. It is a sales artifact. The success condition is stated in the owner's own words: *"people look at it and ask me if they can get something like that made for their company or project."* That line sets the bar for design, engineering rigor, and prose. The portfolio itself has to be a case study in what Abhishek builds.

## 2. Goals

- **G1. Open conversations with MSME prospects.** The hero, About, and Services sections must be legible to a textile trader or distributor who has heard of AI but hasn't deployed anything. Jargon is disqualifying in these sections.
- **G2. Pass the senior-technical filter.** Case studies, writing, and the engineering process itself (public PRD/ADR/ROADMAP artifacts) must hold up under scrutiny from a staff engineer or AI product lead.
- **G3. Be a live proof point.** The site is evidence. It is built with the same process (PRD → ADR → ROADMAP → EPM → CHANGELOG, with process-gate scripts) that Abhishek would bring to a client engagement. Visitors can read the artifacts.
- **G4. Establish a publishing surface.** Ship a writing/notes section that can grow without redesign — a place to publish technical reflection and build a compounding search-indexed asset over time.

## 3. Non-Goals

- **NG1. Not an Awwwards maximalist showcase.** No scroll-jacking, no unreadable typography, no motion for its own sake. Motion serves meaning or it doesn't ship.
- **NG2. Not a crypto-speculation portfolio.** Crypto-adjacent work (Evia as prior employer; curat.money as an ongoing product side of the portfolio) gets surfaced as product engineering, not as DeFi hype. No price charts, no trading narrative. curat.money's framing stays at "fair-comparison product for a niche consumer category," per `docs/CASE_STUDIES_OUTLINE.md §4.7`.
- **NG3. Not a feature showcase for third-party libraries.** raw Three.js and HyperFrames are tools. The portfolio does not lead with "look at what the library can do."
- **NG4. Not a recruiter-targeted job-seeking site.** This is aimed at prospective clients and collaborators. There's no "download resume" as the primary CTA. A resume is available on request; the hero CTA is "let's talk about your project."
- **NG5. Not a rebuild of the v1 site at `developerabhishek.live`.** That site was a portfolio. This is a client-acquisition product. Different job, different content architecture. The legacy host is sunset per `docs/adr/0003-domain-and-canonical-url.md`; canonical is `akaushik.org`.

## 4. Audience

### 4.1 Primary — MSME decision-makers (business owners & operators)

The anchor persona. India has roughly 63 million MSMEs, and the overwhelming majority do not yet operate with AI. They operate on WhatsApp, paper ledgers, Tally, and a few spreadsheets. They have buying power, real operational pain, and a short attention span for technical claims they can't evaluate.

What they need from the site: a clear sense that Abhishek has done this *for a business like theirs* (Neev is the proof point), a way to see that what he builds is real and reliable (public process artifacts), and a path to start a conversation without jargon overhead.

### 4.2 Secondary — Senior technical buyers (staff engineers, heads of AI, CTOs)

The credibility filter. They will skim, then click into one case study. If the case study reads thin — buzzwords without systems detail — they leave. If it reads like an ADR or a good postmortem, they engage.

What they need: architecture, trade-offs, what was considered and rejected, what broke and how it was recovered, and a sense that Abhishek treats production systems with respect.

### 4.3 Tertiary — Peers & the AI-engineering community

Readers of the writing section. Not a conversion audience, but the community-facing voice is part of how Abhishek gets found. Writing quality compounds.

## 5. Information Architecture

The site is one navigable surface with a primary top-nav and a deliberate scroll sequence on the home page. Each major section below is both a nav target and a page-or-section.

### 5.1 Hero + About (home)

- Hero tagline (warm, plain-language, business-outcome-oriented; not "AI engineer" — something that says *what he does for you*).
- Live raw-Three.js centerpiece — the agent/graph motif, executed with restraint. One idea, well.
- Short About paragraph up top; longer About further down the page with the Karpathy-origin beat and the MSME thesis.
- Single primary CTA: "Let's talk about your project" → contact.

### 5.2 Featured Projects / Case Studies

Four case studies, ordered deliberately:
1. **Neev** — MSME business operations platform (hero case study; the anchor for the MSME thesis).
2. **VeriCite** — institutional RAG system (proof of AI-systems depth).
3. **Bluehost agents framework backend** — day-job platform work (proof of operating at scale).
4. **curat.money** — crypto-card comparison platform (proof of breadth and consumer-product engineering).

Each case study has a summary card on the index and a full page: problem in the client's words, approach, the key trade-offs, what shipped, the systems detail that makes it credible, and honest scope on what was and wasn't included.

### 5.3 Experience / Career timeline

Chronological, lightweight. Bluehost (current), Evia mention-only one-liner, earlier roles if relevant. No bullet-point resume inflation.

### 5.4 Writing / Blog / Notes

MDX-driven, launch with 2–3 posts that carry the voice (first-principles learning, Karpathy-inspired; practical agent-systems notes; MSME-and-AI observations). Architecture must support growth without redesign.

### 5.5 Services

What Abhishek can build *for you*. Warm, plain-language. Three or four archetypal engagements (e.g., "agent MVP in 4–6 weeks", "AI enablement for an MSME operation", "production-hardening of a proof-of-concept"). Each with what's in scope, what's not, and a realistic timeline.

### 5.6 Contact

Primary conversion surface. Low-friction. Email-first, calendar link optional, no contact-form-from-hell. Links to GitHub, LinkedIn, X.

## 6. Content Principles

- **Dual-voice.** The hero, About, and Services sections speak to a business owner. Case studies and writing unlock technical depth. The voice shift is deliberate, not accidental.
- **Specificity over adjective stacking.** "Migrating from Fastembed ONNX to Hugging Face TEI for `BAAI/bge-reranker-v2-m3`" is worth ten lines of "cutting-edge AI expertise."
- **Honest scope.** Every case study names what Abhishek owned and what he didn't. This is the single fastest way to signal trustworthiness to senior buyers.
- **Light personal touches, once.** One About paragraph that names the Karpathy-inspired, first-principles ethos. Not repeated every section.
- **No buzzword hedges.** "Leveraging synergies" does not appear. "Enterprise-grade" does not appear without a specific claim attached.

## 7. Engineering Principles

- **Process as proof.** PRD (this doc), ROADMAP, ADRs, EPM progress log, CHANGELOG — all public on the site (or linked from a `/process` page). Process-gate scripts enforce doc hygiene (matching tgsc and VeriCite conventions).
- **Stack pin.** Current stack: Next.js 16.2 LTS, React 19.2, TypeScript 6.0, Tailwind 4, raw Three.js, pnpm 11, Node 22 LTS, Vercel. Any architectural divergence goes through ADR.
- **Accessibility is a gate.** WCAG 2.2 AA. Motion respects `prefers-reduced-motion`. Contrast audited. Keyboard-navigable. The 3D scene has a static fallback.
- **Performance budget.** LCP < 2.5s on 4G, CLS < 0.1, INP < 200ms. The raw Three.js scene must stay measured in the bundle budget and never silently redefine the 150 KiB aspiration.
- **SEO as a first-class concern.** Proper metadata, OG images, sitemap, JSON-LD for the Person entity, MDX posts indexed. Canonical is `akaushik.org`; `akaushik.dev` 308-redirects to it and `developerabhishek.live` has lapsed (see ADR-0003). No competing canonicals.
- **Agent readiness as a first-class concern, equal to SEO and a11y.** The site must score high on Cloudflare's `isitagentready.com` across all four dimensions: Discoverability (`robots.txt`, `sitemap.xml`, HTTP `Link` headers, `/.well-known/`), Content (Markdown content negotiation via `Accept: text/markdown`, `/llms.txt`, `/llms-full.txt`, `.md` URL alternates), Bot Access Control (Content Signals policy in `robots.txt`), and Capabilities (API Catalog at `/.well-known/api-catalog`, OpenAPI spec, at least one Agent Skill). A failed check is a ship-blocker. Full implementation contract in `AGENT_READINESS.md`.

## 8. Motion & 3D Strategy

Two pipelines, one aesthetic.

- **Live raw-Three.js scene** (hero). One idea: agents as nodes, edges as message passing, data flowing along the edges. Executed with deliberate restraint — low-poly, soft motion, responsive to cursor but never frantic. Static fallback for reduced-motion and low-power devices.
- **HyperFrames-rendered reels** (case study intros, background loops, writing hero art). Pre-rendered video via HyperFrames' HTML-to-video pipeline. Used where deterministic, cinema-like quality beats real-time. Served as `<video>` with a static poster fallback.
- **CSS and pre-rendered motion** for layout/media micro-interactions. Add a runtime motion library only with an ADR.

The motif is *graphs and agents* — nodes, edges, information flow. It is the same motif everywhere the site uses motion, so it reads as a language, not as decoration.

## 9. Success Metrics

- **M1. Conversations started.** Direct measure: inquiries via contact in the first 90 days post-launch. Target: ≥ 5 qualified MSME or AI-product conversations.
- **M2. Time-to-credibility for senior buyers.** Proxy: case-study dwell time > 90s on at least one case study per session for a meaningful fraction of technical-referral traffic.
- **M3. Writing as compounding surface.** By 180 days: 4+ published posts, one ranking on a niche query, one citable reference point ("I saw your piece on ...").
- **M4. The site itself becomes referenceable.** Qualitative: at least one inbound message of the form "can you build something like your site for us." That's the stated success condition, and we should expect to hear it.

## 10. Open Questions

- **Q1. Domain.** ~~Current decision: stay on `developerabhishek.live` for now and decide later.~~ **Resolved 2026-04-20 by ADR-0003.** Canonical is `akaushik.org`; `akaushik.dev` is registered defensively and as a future developer-audience alias. `developerabhishek.live` will not be renewed.
- **Q2. Bluehost case study confidentiality.** How much of the agents framework can be publicly described? Need a quick sanity check with his manager before finalizing case-study copy.
- **Q3. Writing launch content.** Which 2–3 posts seed the blog? Proposed: (a) "What I learned building micrograd and makemore", (b) "Notes on bringing AI to an MSME", (c) a VeriCite technical piece on embedding model migration.
- **Q4. Case study depth calibration.** How deep on curat.money? Possibly a shorter "product breadth" case study rather than a full technical deep-dive.
- **Q5. Fallback domain strategy.** ~~If/when we move off developerabhishek.live, what's the redirect and canonical plan?~~ **Resolved 2026-04-20 by ADR-0003.** Catch-all 308 from `developerabhishek.live/*` → `https://akaushik.org/$1` via `vercel.json` on the legacy project, kept live until the registration lapses.

## 11. Out of Scope (for v1)

- Interactive demos of the agent framework or live AI experiments on the home page (tempting but scope-creep — revisit in v1.1).
- Multi-language support (Hindi + English) — strong candidate for v1.1 given the MSME audience, but not v1.
- A full CMS. MDX-in-repo is sufficient for launch.
- E-commerce / productized-service purchase flow. Contact form only for now.

## 12. Review Checklist

Before advancing past PRD:

- [ ] Goals and non-goals reflect Abhishek's actual positioning (not a generic portfolio PRD).
- [ ] MSME-first thesis is unambiguous and hero-level.
- [ ] Four case studies are the right four.
- [ ] Motion strategy is restrained enough that it won't read as "AI-agency template."
- [ ] Success metrics are measurable without needing analytics we don't yet have.
- [ ] Open questions Q1–Q5 are acknowledged (not answered) before scaffolding begins.
