# Plan: Close the live post-launch backlog

**Slug:** `post-launch-closure`
**Date:** 2026-07-14
**Spec:** `specs/003-post-launch-closure/spec.md`
**Status:** accepted

---

## 1. Technical approach

Close the backlog as six independently reviewable vertical slices, then run one integration/evidence slice. The MCP slice adds a small protocol adapter around existing content functions rather than a second service or mutable session store. It targets the stable MCP `2025-06-18` Streamable HTTP contract: one same-origin JSON-RPC endpoint, `initialize`, `ping`, `tools/list`, `tools/call`, no batch support, no server-sent-event stream, no session identifier, and no write-capable tool. Draft filtering is enforced inside the tool implementation even if a caller knows a draft slug.

The visual/content slices restore only already-designed work. Wanderer mounts through its existing raw-Three.js implementation, but CSS and runtime media-query gates keep the entire companion absent on narrow or reduced-motion presentations; the SVG remains the desktop no-WebGL fallback. ClusterBid is promoted only after reconciling the owner-authored historical draft with the current sibling repository; all unsupported outcome/customer/production claims are removed and the case study uses a static, asset-free reel so publication cannot introduce a broken media request. Mobile navigation becomes a two-row, horizontally scrollable no-JavaScript surface, and detail-page breadcrumbs extend the existing JSON-LD generators.

The platform slice pins Node 22, changes scheduled stats updates from direct pushes to bot pull requests, adds an executable production smoke probe and scheduled workflow, and adds a source-controlled favicon. The Cloudflare email-obfuscation setting and GitHub branch protection are live control-plane changes performed only after repository safeguards are merged. A final documentation/evidence slice reconciles current source-of-truth files, records fresh measurements, and annotates historical artifacts without rewriting old execution history.

## 2. Data model + schema changes

No database or persistent-data schema changes. The only data-file change is the published ClusterBid MDX frontmatter/content and its inclusion in existing curated arrays.

## 3. API surface

| Method | Path | Request body / headers | Response | Status codes |
|---|---|---|---|---|
| POST | `/api/mcp` | JSON-RPC 2.0 object; optional `MCP-Protocol-Version: 2025-06-18`; `Origin`, when present, must be the canonical origin | JSON-RPC response for `initialize`, `ping`, `tools/list`, or `tools/call`; notification acknowledgement has no JSON body | 200, 202, 400, 403, 415 |
| GET | `/api/mcp` | none | Method-not-supported JSON response because this server does not expose an SSE stream | 405 |
| DELETE | `/api/mcp` | none | Method-not-supported JSON response because this server is stateless | 405 |
| OPTIONS | `/api/mcp` | none | Same-origin capability response; no permissive cross-origin CORS policy | 204 |

MCP tool contracts:

- `lookup_case_study({ slug: string })` returns text plus `structuredContent` containing `slug`, `title`, `dek`, `role`, `year`, `stack`, `url`, and `markdown` for a published case study. Unknown or draft-only slugs return an MCP tool result with `isError: true`; they never include frontmatter or body content.
- `get_availability({})` returns text plus `structuredContent` containing `status: "open"`, `capacity: "one project this quarter"`, and the public contact URL/email already rendered by the site.
- Unsupported JSON-RPC methods return `-32601`; malformed envelopes/parameters return `-32600`/`-32602`; internal failures return a redacted `-32603`. Array batches are rejected because the selected protocol revision removed batch support.

Existing `/api/case-studies`, Markdown alternates, `llms.txt`, and `llms-full.txt` gain ClusterBid through their existing published-content paths; their response shapes do not change.

## 4. File-by-file change list

| # | File | Action | Purpose |
|---|---|---|---|
| 1 | `lib/mcp.ts` | new | Define stable protocol constants, JSON-RPC validation, tools, draft-safe lookup, and response helpers. |
| 2 | `lib/mcp.test.ts` | new | Lock initialize, notification, tool-list/call, origin, malformed-input, unknown-method, and draft-denial behavior. |
| 3 | `app/api/mcp/route.ts` | new | Expose the stateless same-origin Streamable HTTP adapter. |
| 4 | `e2e/mcp.spec.ts` | new | Probe the built endpoint through a real HTTP client and assert draft non-disclosure. |
| 5 | `public/.well-known/mcp.json` | modify | Replace the planned card with the live endpoint, protocol, transport, and tool declarations. |
| 6 | `lib/openapi-spec.ts` | modify | Document the MCP endpoint alongside the existing public read-only surfaces. |
| 7 | `app/api/docs/page.tsx` | modify | Render the new MCP operation/tool contract in human-readable API docs. |
| 8 | `app/llms.txt/route.ts` | modify | Advertise the working MCP endpoint and current case-study set. |
| 9 | `docs/AGENT_READINESS.md` | modify | Replace planned-MCP language with the verified contract and probe examples. |
| 10 | `components/scene/Wanderer.tsx` | modify | Align fallback comments and DOM behavior with desktop-only reinstatement. |
| 11 | `components/scene/Wanderer.module.css` | new | Own narrow-viewport and motion-policy visibility without colliding with site chrome styles. |
| 12 | `components/scene/WandererCraneClient.tsx` | modify | Prevent loading/mounting the Three.js crane outside the desktop/motion policy. |
| 13 | `components/scene/WandererCrane.tsx` | modify | Keep runtime guards consistent if viewport or motion policy changes after hydration. |
| 14 | `app/layout.tsx` | modify | Restore the existing Wanderer mount. |
| 14a | `app/globals.css` | modify | Expose mobile nav links as a touch-scroll row. |
| 15 | `e2e/canvas.spec.ts` | modify | Replace disabled skips with desktop mount/fallback/canvas and mobile absence assertions. |
| 16 | `e2e/reduced-motion.spec.ts` | modify | Assert the companion is absent under both motion gates. |
| 17 | `e2e/home.spec.ts` | modify | Exercise primary navigation at mobile and desktop widths without the old skip. |
| 18 | `components/sections/Hero.tsx` | modify | Remove stale Framer Motion/r3f marquee claims and list only live technologies. |
| 19 | `components/site/SiteNav.tsx` | modify | Preserve one semantic primary nav while supporting the mobile row. |
| 20 | `lib/structured-data.ts` | modify | Add a canonical `BreadcrumbList` generator for writing and work detail pages. |
| 21 | `lib/structured-data.test.ts` | modify | Verify breadcrumb item order, names, and canonical URLs. |
| 22 | `app/work/[slug]/page.tsx` | modify | Emit page-specific case-study breadcrumbs. |
| 23 | `app/writing/[slug]/page.tsx` | modify | Emit page-specific writing breadcrumbs. |
| 24 | `app/work/[slug]/page.test.ts` | modify | Verify work detail JSON-LD includes breadcrumbs. |
| 25 | `app/writing/[slug]/page.test.ts` | modify | Verify writing detail JSON-LD includes breadcrumbs. |
| 26 | `content/case-studies/clusterbid.mdx` | modify | Replace placeholders with bounded, corroborated prose and publish only after review. |
| 27 | `components/sections/Work.tsx` | modify | Add ClusterBid to the curated home-page work order. |
| 28 | `components/work/reels.tsx` | modify | Add an asset-free static ClusterBid reel/fallback. |
| 29 | `app/api/case-studies/route.ts` | modify | Add ClusterBid to the explicit API order if the route does not derive it automatically. |
| 30 | `app/llms-full.txt/route.ts` | modify | Keep the full-corpus case-study order explicit and include ClusterBid if needed. |
| 31 | `lib/content.test.ts` | modify | Ratify five published case studies and draft filtering. |
| 32 | `e2e/work.spec.ts` | modify | Verify ClusterBid listing, detail route, Markdown alternate, and no failed media request. |
| 33 | `docs/PRD.md` | modify | Update the accepted public case-study count/portfolio scope. |
| 34 | `docs/CASE_STUDIES_OUTLINE.md` | modify | Replace the ClusterBid placeholder outline with its verified published disposition. |
| 35 | `package.json` | modify | Pin Node to the deployment-compatible 22.x line and expose the production smoke command. |
| 36 | `pnpm-lock.yaml` | modify | Keep package-manager engine metadata in sync if the engine edit changes the lockfile. |
| 37 | `.github/workflows/stats.yml` | modify | Validate generated stats and push only an automation branch/PR, never `main`. |
| 38 | `scripts/check-production.mjs` | new | Check live routing, nonce CSP, contact integrity, agent surfaces, and TTFB thresholds. |
| 39 | `.github/workflows/production-smoke.yml` | new | Run the production probe on a schedule and on demand. |
| 40 | `public/favicon.svg` | new | Store the editable source for the portfolio mark. |
| 41 | `public/favicon.ico` | new/derived | Serve a non-404 legacy favicon generated from the source mark. |
| 42 | `e2e/agent-readiness.spec.ts` | modify | Extend live-surface assertions to MCP discovery; favicon/contact integrity stays in the production smoke script. |
| 43 | `.claude/primers/hyperframes-reels.md` | modify | Replace the literal slug placeholder path with concrete directories. |
| 44 | `.claude/primers/seo-strategy.md` | modify | Replace the literal path glob and align weekly prompt policy with ADR-0011. |
| 45 | `.agents/primers/hyperframes-reels.md` | modify/create | Mirror the corrected canonical primer for the Codex harness. |
| 46 | `.agents/primers/seo-strategy.md` | modify/create | Mirror the corrected SEO primer for the Codex harness. |
| 47 | `.agents/skills/writing/**` | create | Roll out the canonical Trellis writing skill to the Codex harness. |
| 48 | `playwright.config.ts` | modify | Remove stale browser/preview commentary while preserving the configured matrix. |
| 49 | `docs/adr/0005-playwright-over-cypress.md` | modify | Record the actual desktop/mobile engine matrix and localhost CI target. |
| 50 | `docs/adr/0007-r3f-9-bump.md` | modify | Mark the supersession by ADR-0012 without rewriting its historical decision. |
| 51 | `docs/adr/0015-post-launch-runtime-and-bundle-budget.md` | new | Record Node 22, the accepted measured script target, Wanderer delta, and monitor threshold. |
| 52 | `docs/BUNDLE_BUDGET.md` | modify | Replace the unresolved 150 KiB aspiration with the measured accepted ceiling and escalation rule. |
| 53 | `docs/ROADMAP.md` | modify | Close duplicate MCP, Wanderer, reel, browser, and bundle entries against evidence. |
| 54 | `docs/wanderer-redesign-brief.md` | modify | Record the conservative decisions and verified completion evidence. |
| 55 | `docs/seo/STATUS.md` | modify | Reconcile implemented OG/breadcrumb work while retaining owner-only actions as external. |
| 56 | `docs/seo/scheduled-tasks/seo-weekly-draft.md` | modify | Add the ADR-0011 loop-retention policy to the scheduled editorial contract. |
| 57 | `docs/epm/EPIC-01-pixel-parity.md` | modify | Close the shipped epic and point to current evidence. |
| 58 | `specs/001-audit-remediation-parity/{spec,tasks}.md` | modify | Reconcile shipped criteria without claiming superseded historical tasks were newly executed. |
| 59 | `specs/002-audit-remediation-2/{spec,tasks}.md` | modify | Reconcile the merged remediation criteria with current proof. |
| 60 | `audits/2026-07-13-audit.md` | modify | Add a closure annotation linking confirmed findings to the remediation specs/commits. |
| 61 | `docs/agent-readiness-snapshots/2026-07-14.md` | new | Store fresh production routing, discovery, CSP/contact, and API evidence. |
| 62 | `docs/bundle-snapshots/2026-07-14-bundle.md` | new | Store the fresh analyzer/Lighthouse transfer measurements and Wanderer delta. |
| 63 | `docs/CHANGELOG.md` | modify | Summarize the closure slices, proof commands, and external dispositions. |
| 64 | `specs/003-post-launch-closure/tasks.md` | modify during execution | Tick only tasks whose implementation and verification receipts are complete. |

The canonical writing-skill rollout script may generate additional files under `.agents/skills/writing/`; that directory is intentionally treated as one generated file set.

## 5. Sequencing + dependencies

Use a contract-first fan-out. First commit the accepted spec triad. Then run MCP, Wanderer, content, UI/structured-data, platform, and tooling lanes in isolated worktrees with disjoint write sets. Integrate them in this order: platform guardrails; MCP; UI/structured data; Wanderer; ClusterBid publication; tooling/docs/evidence. ClusterBid remains `draft: true` until its lane tests pass. Central ledgers (`docs/ROADMAP.md`, `docs/CHANGELOG.md`, spec checkboxes, snapshots) are owned only by the final integration lane to avoid merge conflicts.

Cloudflare email-obfuscation is disabled only after the repository contact probe exists, and GitHub branch protection is applied only after the bot-PR stats workflow is on the target branch. If either control-plane mutation cannot be authenticated, repository changes still ship, the exact external blocker remains explicit, and completion is not claimed for that criterion.

Every implementation commit is independently buildable. Rollback is subsystem-specific `git revert`; ClusterBid can be reverted to draft without affecting the other slices, and Wanderer can be removed at its single layout mount without deleting its source.

## 6. Test strategy

| Spec success criterion | Test / proof | Level | Fixture |
|---|---|---|---|
| MCP protocol and draft safety | `lib/mcp.test.ts`; `e2e/mcp.spec.ts` | unit + integration | published `neev`; draft `clusterbid` until publication and `_test-draft`-style invalid slug probes |
| MCP discovery/docs parity | discovery/OpenAPI assertions in `e2e/agent-readiness.spec.ts` | integration | built app on localhost |
| Wanderer desktop/motion policy | `e2e/canvas.spec.ts`; `e2e/reduced-motion.spec.ts` | e2e | desktop Chromium/Firefox/WebKit, mobile projects, reduced motion |
| ClusterBid corroborated publication | placeholder grep, `lib/content.test.ts`, `e2e/work.spec.ts`, editorial diff review | unit + e2e + review | current sibling repo plus owner-authored historical draft |
| Full browser/tooling readiness | browser install list; `pnpm test:e2e`; primer checker; writing-skill diff | host + e2e | Playwright Chromium/Firefox/WebKit |
| Bookkeeping truth | targeted `rg` for open/stale markers plus evidence links | static review | current source-of-truth documents |
| Fresh production evidence | `pnpm production:check`; Lighthouse/Axe; routing curls; `pnpm analyze` | production + build | `https://akaushik.org` and production build |
| Cloudflare contact/CSP integrity | smoke script and JavaScript-disabled browser contact test | production + e2e | production homepage, browser console |
| Runtime/stats/favicon safeguards | workflow static review, GitHub settings query, `/favicon.ico` request, deployed runtime log | CI + production | GitHub Actions and Vercel deployment |
| Scheduled nonce/TTFB monitoring | local script unit execution plus successful workflow dispatch | CI + production | canonical origin, explicit 2.5 s TTFB ceiling |
| Marquee/bundle truth | stale-dependency grep, analyzer and Lighthouse snapshots | static + performance | production build and Lighthouse artifacts |
| Mobile nav and BreadcrumbList | `e2e/home.spec.ts`; structured-data unit/page tests | unit + e2e | 375 px and desktop projects; writing/work fixtures |
| Whole-repo quality | `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, `pnpm build`, `pnpm test:e2e`, security gate, `pnpm process:check` | repository gate | integrated branch |

## 7. Rollout plan

Ship as ordered pull requests from isolated `codex/` branches. Keep ClusterBid draft-gated inside its PR until all factual and surface checks pass. Before each repository PR opens, run the process-gate skill against that exact branch and retain its receipt. After repository PRs merge and production is healthy, disable Cloudflare Email Address Obfuscation, purge the relevant cache, apply/verify `main` branch protection, dispatch the production-smoke workflow, and capture production/browser evidence. If production verification regresses, revert only the responsible PR and leave later dependent PRs unmerged until green.

## 8. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MCP adapter diverges from client expectations | medium | high | Target one stable revision, reject unsupported batches, use protocol fixtures and a real endpoint probe. |
| Draft content leaks through MCP | low | high | Resolve slugs only through the published set; explicit negative tests for known drafts. |
| Wanderer increases CPU/bundle cost | medium | medium | Desktop/motion gates before import, shared raw-Three dependency, analyzer/Lighthouse delta, single-mount revert. |
| ClusterBid prose overstates production or outcomes | medium | high | Require two-source corroboration for architecture claims; omit metrics/customer claims; editorial adversarial review before `draft: false`. |
| Bot-created PR does not trigger CI | medium | medium | Use the configured PAT for branch/PR creation, validate inside the stats job, and rely on protected `main` to prevent bypass. |
| Cloudflare transform remains cached | medium | high | Disable setting, purge cache, verify raw HTML plus JavaScript-disabled browser and CSP console. |
| Nonce architecture keeps TTFB variable | high | medium | Preserve ADR-0014, monitor a generous explicit threshold, alert rather than silently regress. |
| Documentation closeout rewrites history | low | medium | Add closure annotations and status pointers; do not tick tasks that were not actually run. |

## 9. Decisions log

- **Decision:** Implement MCP directly against stable `2025-06-18` instead of adding an SDK or targeting the draft protocol.
  - **Why:** Two read-only tools and four methods do not justify another runtime dependency, and the stable revision has a bounded JSON-RPC/HTTP contract.
  - **Rejected:** MCP SDK (more bundle/install surface) and the draft 2026 transport headers (unstable contract).
- **Decision:** Return 405 for MCP GET rather than hold an SSE stream.
  - **Why:** The server emits no unsolicited notifications and is intentionally stateless, which the Streamable HTTP contract permits.
  - **Rejected:** A long-lived SSE endpoint (unneeded lifecycle and deployment complexity).
- **Decision:** Reinstate Wanderer only on desktop with the existing crane and SVG.
  - **Why:** This resolves the recorded redesign follow-up while honoring the PRD's restrained-motion and mobile-density constraints.
  - **Rejected:** New art direction, a new motion library, or mobile animation (all widen scope or cost).
- **Decision:** Publish ClusterBid as an evidence-bounded UAT/pre-production engineering case study with an asset-free reel.
  - **Why:** Owner-authored prose and repository history substantiate the implementation work, but not customer or production outcomes.
  - **Rejected:** Keeping placeholders indefinitely or inventing outcome metrics/media.
- **Decision:** Use a no-JavaScript horizontally scrollable mobile nav instead of a hamburger state machine.
  - **Why:** It preserves semantic links, keyboard access, and source order with minimal bundle and interaction risk.
  - **Rejected:** Hidden links (current defect) and a client-side menu (extra state and hydration).
- **Decision:** Accept a measured script ceiling in ADR-0015 rather than preserve an already-invalid 150 KiB aspiration.
  - **Why:** Raw Three.js is an explicit, measured design dependency under ADR-0012; the useful control is a small regression envelope around the fresh baseline.
  - **Rejected:** Removing the hero scene or leaving the budget permanently red.

## 10. Out of scope (deferred)

- Owner-account GSC, Bing, Wikidata, social-profile, scheduler, and editorial-calendar registrations remain listed as external in `docs/seo/STATUS.md`.
- Long-horizon SEO content, new MDX posts, OSS repository creation, and quarterly flagship work remain governed by the editorial calendar.
- A scheduler-provider link remains deferred until the operator supplies a real URL.

---

## Review checklist

- [x] Every file in the change list has a one-line purpose
- [x] Sequencing leaves the tree buildable at every step (or the broken-window step is named)
- [x] Each spec success criterion has a corresponding test in the strategy section
- [x] Schema changes (if any) list types + migration ordering
- [x] API changes (if any) list status codes + payload shapes
- [x] At least one explicit trade-off appears in the decisions log
- [x] Rollout plan is concrete (flag, phased ramp, or direct ship)
- [x] Out-of-scope items are listed, not silently dropped
- [x] No ADRs are contradicted
