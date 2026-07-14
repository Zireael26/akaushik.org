# Spec: Close the live post-launch backlog

**Slug:** `post-launch-closure`
**Date:** 2026-07-14
**Author:** Codex, for Abhishek Kaushik
**Status:** accepted

---

## 1. Problem statement

The portfolio is live and its last two remediation passes are green, but the remaining post-launch backlog is fragmented across ROADMAP, release notes, primers, specs, browser caches, and production snapshots. Real features (MCP and the disabled Wanderer) sit beside shipped-but-stale tasks (reels and prior remediation criteria), a deliberately gated ClusterBid draft, and owner-only external actions. That mix makes “done” hard to trust and causes future agents to re-audit or re-litigate settled work.

## 2. Users + scenario

- **Abhishek** — wants one final engineering pass that closes executable post-launch work without inventing claims or creating another permanent backlog.
- **Portfolio visitors** — need accurate case studies, stable motion, current technology claims, and truthful availability.
- **Agents and crawlers** — need a working read-only MCP surface and current discovery metadata.
- **Future contributors** — need primers, specs, ROADMAP, and follow-up ledgers to agree with the live implementation.

## 3. Success criteria

- [ ] The portfolio exposes a stateless, read-only MCP endpoint that completes initialization, lists tools, executes case-study lookup and availability requests, rejects malformed/unknown calls, and never returns draft content.
- [ ] MCP discovery advertises the live endpoint and tools; API/agent-readiness docs and tests describe the same contract.
- [ ] The Wanderer is reinstated conservatively without small-viewport visual noise, remains absent under reduced-motion and motion-off policies, retains its SVG fallback and accent sync, and passes browser checks.
- [ ] The ClusterBid case study contains no placeholders, publishes only claims corroborated by the owner-authored historical draft and current repository evidence, is wired through every listing/discovery surface, and has no broken media request.
- [ ] Firefox and WebKit are installed for Playwright and the full configured E2E matrix completes; primer entry points no longer produce placeholder/glob false positives and both harnesses expose the writing skill.
- [ ] Reel, remediation, browser, and follow-up bookkeeping reflects actual shipped state; historical/superseded plans remain historical rather than being falsely ticked.
- [ ] A fresh production evidence set records canonical/legacy routing, agent-readiness surfaces, nonce CSP hydration, Lighthouse/Axe results, and current bundle measurements.
- [ ] Cloudflare no longer rewrites the contact email or injects an unnonced decoder; the source `mailto:` works with JavaScript disabled and the production browser reports no CSP violation.
- [ ] The declared Node runtime matches the deployed runtime; scheduled stats changes cannot bypass CI or protected `main`; `/favicon.ico` returns a real icon.
- [ ] A scheduled synthetic check records nonce-SSR availability, CSP/contact integrity, and TTFB against an explicit threshold without changing the accepted ADR-0014 architecture.
- [ ] The public technology marquee and docs contain no stale dependency claims; the bundle budget has an explicit measured target and disposition rather than a perpetual aspiration.
- [ ] Primary navigation remains keyboard- and touch-accessible below 861px, and published detail pages emit page-specific `BreadcrumbList` structured data without changing canonical URLs.
- [ ] Typecheck, lint, coverage, build, full E2E, security gate, and process gate pass; all implementation PRs merge in dependency order and `main` ends clean.

## 4. Non-goals

- Running the year-long SEO editorial calendar or generating its planned MDX posts.
- Creating or modifying GSC, Bing, Wikidata, social-profile, calendar-provider, or other owner-account state.
- Publishing customer/revenue/adoption metrics that are not present in an approved source.
- Replacing Three.js or redesigning the hero AgentGraph.

## 5. Constraints

- Preserve `_reference/` as read-only and follow the content/editorial rules in `AGENTS.md` and `HANDOFF.md`.
- ClusterBid remains draft-gated until its claims and every consumer surface pass review; no inferred outcome claims.
- MCP is read-only, stateless, same-origin, and deploys with the existing Next.js/Vercel application; do not add a second deployment target.
- The nonce CSP and its per-request dynamic-rendering trade-off from ADR-0014 remain intact.
- Wanderer ships desktop-only, keeps the existing paper-crane motif and SVG fallback, adds no new motion dependency, and does not widen the bundle without measurement.
- Above-floor changes follow the mandatory spec pipeline; agents work in isolated branches/worktrees and do not merge.

## 6. Open questions

None as of 2026-07-14. The operator delegated all current follow-ups for autonomous completion. Conservative defaults are recorded in `clarify.md`; any claim that cannot be corroborated is omitted or explicitly bounded.

## 7. Risks

- A hand-written MCP transport can drift from protocol clients; mitigate with JSON-RPC fixtures and a real client/probe where available.
- Reinstating a second Three.js scene can increase CPU/bundle cost or reintroduce mobile visual noise; mitigate with desktop/motion gates and measured browser evidence.
- ClusterBid’s historical prose may no longer match the current repository; adversarially fact-check every paragraph and keep “pre-production/UAT” scope explicit.
- Browser installation and HyperFrames rendering can fail at host-tool boundaries; record exact tool evidence and do not claim completion from partial downloads.
- Closing stale checkboxes can rewrite history; update only current source-of-truth artifacts and leave superseded plans unchanged.

## 8. Out of scope (intentional)

- A scheduler-provider integration without a real operator URL.
- Long-horizon SEO pillar pages, cluster posts, OSS repositories, and quarterly flagships.
- A new CMS, admin panel, newsletter, comments, authentication, or mutable MCP tool.
- External production-account changes that require Abhishek’s logged-in approval.

---

## Review checklist

- [x] Problem statement names a real pain, not a solution
- [x] Every success criterion is testable
- [x] At least one non-goal is listed
- [x] Constraints cite governing project artifacts
- [x] Open questions are resolved or explicitly delegated
- [x] Implementation detail is deferred to `plan.md`
- [x] Spec is readable in under 5 minutes

## Follow-ups

| # | Priority | Item | Disposition | Status |
|---|---|---|---|---|
| 1 | P0 | Execute the spec-003 task list and merge green PRs in dependency order. | This work item. | open |
| 2 | External | Owner-account SEO/social/calendar actions. | Keep in `docs/seo/STATUS.md`; no autonomous mutation. | external |
