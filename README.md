# akaushik.org

Abhishek Kaushik's personal portfolio — a sales-artifact-grade site for an AI engineer who ships agent systems for production. The thesis: AI systems for businesses that haven't met AI yet.

**Live:** https://akaushik.org · `akaushik.dev` 308-redirects here per [`docs/adr/0003-domain-and-canonical-url.md`](docs/adr/0003-domain-and-canonical-url.md). (Legacy host `developerabhishek.live` registration lapsed 2026-05-19 — see the ADR Outcome addendum.)

The portfolio is itself a case study in the engineering process it advertises. The PRD, ROADMAP, ADRs, and CHANGELOG are public artefacts; every non-trivial change ships with the matching sibling docs. Process-gate scripts enforce the discipline at pre-commit.

## Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Framework | Next.js 16.2 LTS (App Router) | Stable server/client boundary; edge-ready |
| Language | TypeScript 6.0 (strict, `noUncheckedIndexedAccess`) | Catches every shape drift |
| UI | React 19.2 | Server components + Actions |
| Styling | Tailwind 4 (CSS-first, tokens under `@theme` in `app/globals.css`) | No `tailwind.config.ts` |
| 3D | raw `three` | Hero `AgentGraph` scene; wrapper libraries were removed after ADR-0012 |
| Content | MDX via `next-mdx-remote@6` | Case studies + writing |
| Motion (case study cards / writing loops) | HyperFrames-rendered MP4 + webp | Deterministic cinema-grade output |
| Package manager | pnpm 11.9 | Corepack-pinned with explicit release-age policy |
| Runtime | Node 22 LTS | `.nvmrc` |
| Host | Vercel | Next.js `proxy.ts` for Link headers + content negotiation |

## Local development

```bash
# one-time
corepack enable
pnpm install

# run
pnpm dev          # http://localhost:3000 (Turbopack)
pnpm typecheck
pnpm lint
pnpm test         # vitest unit tests
pnpm test:e2e     # Playwright e2e (auto-starts pnpm dev locally)
pnpm build && pnpm start
```

## Repository layout

```
/app                  App Router (layout, pages, route handlers, .well-known/, api/, sitemap)
/components           Section components, raw Three.js scene, media, SEO islands
/content              MDX case studies + writing posts
/lib                  Content loader, structured-data builders, canonical helper, stats reader
/public               Static assets, agent-skills, mcp.json, init-theme.js
/scripts              process-gate, agent-skills index build, fetch-github-stats, HyperFrames render
/docs                 PRD, ROADMAP, AGENT_READINESS, CHANGELOG, ADRs (10+), bundle budget, SEO program
/e2e                  Playwright specs (home, work, theme, canvas, reduced-motion, content-negotiation)
/_reference           Frozen Claude Design prototype (read-only)
/.claude/primers      Claude feature primers for stable subsystems
/.agents/primers      Codex feature-primer mirror
```

## Process gates

Every non-trivial change ships with:

1. An **ADR** under `docs/adr/` if the decision is architectural
2. An updated **ROADMAP.md** if scope shifts
3. A **CHANGELOG.md** entry under `[Unreleased]`
4. A passing **`pnpm process:check`**
5. A Conventional Commit message

Pre-commit (husky) runs the gate; pre-push (husky) blocks direct push to `main` and runs the unit smoke. CI (`.github/workflows/`) runs `verify` (typecheck + lint + build + process-gate) on every PR.

## Agent readiness

The site passes Cloudflare's [isitagentready.com](https://isitagentready.com/) across all four dimensions (Discoverability, Content, Bot Access Control, Capabilities). Implementation contract: [`docs/AGENT_READINESS.md`](docs/AGENT_READINESS.md). Live snapshot directory: [`docs/agent-readiness-snapshots/`](docs/agent-readiness-snapshots/).

The full corpus is also available as Markdown at [`/llms.txt`](https://akaushik.org/llms.txt) and [`/llms-full.txt`](https://akaushik.org/llms-full.txt); every content page responds to `Accept: text/markdown` and has a `.md` suffix alternate.

## Links

- LinkedIn · [abhishek26k](https://linkedin.com/in/abhishek26k)
- GitHub · [Zireael26](https://github.com/Zireael26)
- X · [@abhi2601k](https://x.com/abhi2601k)
- Email · `hello@akaushik.org`

## License

Source code: MIT. Written content and case studies: CC BY-NC 4.0 (learn from them; do not republish as your own).
