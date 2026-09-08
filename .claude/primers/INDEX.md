# Primers Index

This file lists every feature primer in this project. It is loaded by Trellis at session start so agents can see available context without reading any primer in full.

**One line per primer. Alphabetical by slug. Keep entries short.**

Format:

```
- [<slug>](./<slug>.md) — <one-line description>
```

---

- [agent-readiness-contract](./agent-readiness-contract.md) — Content-negotiation, API catalog, OpenAPI 3.1, and llms-full.txt surfaces so the portfolio passes isitagentready.com checks.
- [hyperframes-reels](./hyperframes-reels.md) — HTML/GSAP compositions rendered to deterministic MP4 reels for case-study cards and hero bands via the HyperFrames CLI; artifacts are committed.
- [mdx-content-pipeline](./mdx-content-pipeline.md) — Custom YAML frontmatter parser + filesystem loader feeding case studies and writing posts, with reading-time calc and agent-facing JSON listings.
- [og-image-generation](./og-image-generation.md) — Next.js ImageResponse handlers rendering parchment-and-forest Open Graph previews for home, case-study, and writing pages from MDX frontmatter.
- [process-gate-policy](./process-gate-policy.md) — Pre-commit hook enforcing CHANGELOG / ADR / ROADMAP coupling for code, structural, and EPM changes; bypassed only via SKIP_PROCESS_GATE.
- [seo-strategy](./seo-strategy.md) — SEO + AIO program for akaushik.org — three-goal plan, per-page canonical + JSON-LD wiring, five repository task sources with separate registration, live status doc, human-required handoff queue.
- [wanderer-crane-scene](./wanderer-crane-scene.md) — Home-only desktop paper-crane Three.js companion with SVG fallback and route/motion gates.
