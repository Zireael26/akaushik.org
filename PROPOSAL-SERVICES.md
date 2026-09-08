# PROPOSAL-SERVICES — rethink the engagements section

**Status:** Proposal only. No component written, nothing committed.
**Scope:** Replaces the copy and framing of `components/sections/Services.tsx` ("Three engagement shapes.", `lib/services.ts`). Research basis: `/Users/abhishek/projects/trellis-instance` plus this worktree's own process artifacts.
**Path convention:** paths starting `trellis-instance/` resolve inside `/Users/abhishek/projects/trellis-instance`; every other path resolves inside this worktree (`/Users/abhishek/projects/personal/akaushik.org-worktrees/services`).

---

## 1. The diagnosis

The section currently sells three timed packages: Agent MVP (4–6 weeks), AI enablement for an MSME operation (8–12 weeks), Production-hardening a POC (3–6 weeks), each with In / Out / Fit rows (`lib/services.ts:12-46`). That is freelancer menu language. Everything else on the page argues something much stronger:

- **A method section already exists**, two slots earlier in the scroll (`app/page.tsx:23,26`): Read → Spec → Build → Harden, ending on "The process gate runs before the PR opens. Done means a receipt, not a summary." (`components/sections/Process.tsx:18-43`).
- **The artifacts behind those claims are real and public.** This repository carries twenty numbered ADRs (`docs/adr/0001-*` … `docs/adr/0020-*`), five spec triads (`specs/001-*` … `specs/005-*`), a process gate that runs pre-commit (`scripts/process-gate.mjs`, wired in `.husky/pre-commit`, policy in `docs/adr/0002-process-gate-policy.md`), and a changelog where every shipped change is dated and measured (`docs/CHANGELOG.md`, e.g. the axe-race entry at lines 43–67 with its measured table).
- **The same regime exists fleet-wide and is written down**: the clarify→spec→plan→tasks→analyze pipeline (`trellis-instance/engineering-process.md` §14.7), definition-of-done receipts (`trellis-instance/core-rules/CLAUDE.md` § Definition of done), two hook tiers plus a git-boundary tier (`trellis-instance/core-rules/hooks.md:1-9`), an L1–L5 autonomy slider with bright-line guardrails that never flex (`trellis-instance/core-rules/autonomy.md:15-24`), loop-safety ceilings (`trellis-instance/core-rules/loop-safety.md:22-31`), presets for strict regimes (`trellis-instance/core-rules/presets/compliance-strict.md`), and 30+ numbered spec triads with analyze passes in the instance repo (`trellis-instance/specs/`).
- **The site itself is operated as an engineering artifact**: an agent-discoverability contract (`public/.well-known/agent-skills/hire-me/SKILL.md`, `app/llms-full.txt/route.ts`), e2e assertions over that contract (`e2e/agent-readiness.spec.ts:34-37`), coverage thresholds on the copy modules (`vitest.config.ts:43-44`).

So the failure is not that the services are wrong; it is that the section is the one place on the page where the operator's actual system goes unmentioned. A reader who just scrolled past "done means a receipt, not a summary" reaches a price-tag-style card grid with invented durations. The voice guide calls this exact bluff: strong claims arrive with a number, a path, or a link attached; unproven things are named as unproven (`docs/voice.md` §2). The durations "4 — 6 weeks", "8 — 12 weeks", "3 — 6 weeks" are unsourced in both repos. They are the invented-specificity failure mode the brief warns about.

**Division of labor constraint:** the Method section owns *how* work happens. Services must own *where a client enters* — it should be the commercial twin of Method, not a second description of it. Any new framing that re-explains the pipeline step-by-step duplicates `components/sections/Process.tsx` and should be cut.

---

## 2. What the section should say

Four moves, each fully sourced:

1. **There is one way work happens here, and you can read it before you hire.** Not "trust me" — the gate, the ADRs, the spec triads, and the changelog of this very site are public (`scripts/process-gate.mjs`, `docs/adr/`, `specs/`, `docs/CHANGELOG.md`). The reader can audit the process the way an agent reads the corpus.
2. **Engagements differ along axes that actually matter**, not duration:
   - *Shape of the work* — building new under the full pipeline, hardening something that already runs, or installing the regime itself into a team.
   - *Who decides what* — the client picks where the autonomy slider sits; some controls never flex at any level (`trellis-instance/core-rules/autonomy.md:15-24`).
3. **Every engagement ends in artifacts, not summaries**: a spec triad, ADRs for expensive-to-unwind decisions, changelog entries, DoD receipts (`trellis-instance/engineering-process.md` §8, §14.7; `components/sections/Process.tsx:26-29,37-42`).
4. **Starting is a conversation with a known shape**: email with the problem, a rough timeline, what "good" looks like; answered by the operator himself (`public/.well-known/agent-skills/hire-me/SKILL.md:39-43`).

**What it must stop saying:** fixed week ranges (unsourced anywhere), and the "MSME operation" packaging (the MSME thesis already lives where it is proven: About paragraphs and meta, `lib/about-copy.ts:13,17-20`, and the Neev case study in Work). Nothing about employers, clients, titles, dates, headcounts, or metrics may appear that is not already sourced; the claim-source table in §6 enforces this line by line.

---

## 3. Recommendation (5 sentences)

Rebuild the section as **three entry points into one operating system**, dropping packaged durations entirely: Greenfield (build it under the full pipeline), Hardening (make the thing that works in a demo survivable on a bad Tuesday), and Adoption (install the regime into a client team, tuned via presets and an agreed autonomy level). Each entry point gets the same four-row anatomy — Entry / First moves / You hold / Fit — rendered with the existing MatterRow-plus-RuledRow grammar so the section stays visually native. Add one shared control row stating the autonomy deal: the client sets how much is decided alone, and the guardrails that never flex stay that way at every level. Close the section with a proof pointer into the public trail (ADRs, spec triads, changelog, `/llms-full.txt`) so the offer and the evidence are the same object. This is the only alternative that is simultaneously honest (zero unsourced numbers), differentiated (nobody else shows their gate), voice-compliant (`docs/voice.md` §2, §5), and cheap — it reuses existing components and touches exactly four coupled files listed in §5.

---

## 4. Alternatives

### Alternative A — "Three doors into one system" (RECOMMENDED)

**Says:** You are not buying a package; you are plugging into a working system, and you can read the system first.

**Copy skeleton** (sample lines in the `docs/voice.md` register; final wording is a later pass):

> Head: **Same discipline, three doors in.**
> Label: Engagements (unchanged)
>
> Intro: "The method above is not a display piece. It is how work happens here, and it is how work with you would happen. Pick the door that matches your situation; the first step through any of them is a clarify pass and a spec you are free to reject."
>
> Door 01 · **Greenfield** — An agent system or product surface, built under the full pipeline: clarify, spec, plan, tasks, then phased delivery against a roadmap. Changelog entries and ADRs exist from the first commit, not after.
> - Entry — You know the problem. Nobody has built the thing.
> - First moves — Clarify interview, then a spec triad; nothing load-bearing skips them.
> - You hold — The spec triad, the ADRs, a dated changelog, and a receipt for every done claim.
> - Fit — Teams with a real workflow and real data who want the process as part of the product.
>
> Door 02 · **Hardening** — Something already runs and it is not trustworthy yet. Observability, eval harness, error budgets, a runbook, and the process gate wired before new features land.
> - Entry — It works in demos. You need it to work at 3pm on a Tuesday.
> - First moves — Read the system as it actually is; measure before changing a line.
> - You hold — Measured baselines, a wired gate, a runbook, and tests that fail when the intent breaks.
> - Fit — Whoever lost a night's sleep to their own prototype.
>
> Door 03 · **Adoption** — Install the regime itself: hooks, gates, the spec pipeline, loop ceilings, and an autonomy level chosen for your risk posture. Strict variants exist as shipped presets, not theory.
> - Entry — Your team ships with agents, but nobody trusts the output.
> - First moves — Audit what enforcement you already have; adopt the smallest tier that bites.
> - You hold — Enforced hooks, a spec pipeline your repos share, and decision logs you can read later.
> - Fit — Operators who want discipline that survives contact with a deadline.
>
> Shared control row: **Autonomy is yours to set.** You choose how much gets decided without you, from explain-everything to decide-and-log. Some controls never flex: secrets, destructive operations, and receipts are enforced at every level. (`trellis-instance/core-rules/autonomy.md:15-24`)
>
> Closing row: "Every claim on this page is checkable. Start at the ADRs and the changelog, or take the whole site as one Markdown file." (links: GitHub `docs/adr/`, `docs/CHANGELOG.md`, `/llms-full.txt`)

**Shape on the page:** unchanged skeleton — `SectionHead`, split intro, then per-door `MatterRow` head (title + tone tag; tag rotates cobalt/amber/red as today, carrying the door number instead of a duration) over `RuledRow`s labeled Entry / First moves / You hold / Fit. The In/Out/Fit grammar survives as "you get / you don't" folded into "You hold" and "Fit", so readers lose nothing they use today. The `px-service-num` column and `data-screen-label="05 Services"` stay.

**Costs and risks:** lowest of the three. No new components; `lib/services.ts` grows a `rows` label change and loses `duration`. Sample copy above contains no numbers except sourced ones. Risk: "Adoption" must not oversell consulting scale — it claims only that the regime exists and is installable, which `trellis-instance/README.md:28-41` and `core-rules/presets/` support.

### Alternative B — "Proof ledger first"

**Says:** Lead with the receipts themselves; make the offer almost implicit. Rows become evidence lines — the gate script, twenty ADRs, five spec triads, the changelog, the agent contract — followed by a single short "if you want this applied to your problem" row.

**Shape:** a `RuledRow` ledger of artifacts with links (same grammar as Process's ARTIFACTS list, `components/sections/Process.tsx:53-72`), optionally with counts computed at build time from `glob('docs/adr/*.md')` rather than hardcoded, so the numbers are always true.

**Pros:** maximum differentiation for the agent-audience; hardest to accuse of marketing. **Cons:** reads as a portfolio of process rather than an offer of help — a client with a budget question finds no answer; counts drift toward navel-gazing, the exact "rookie stuff" smell in reverse; the build-time count wiring is new mechanism for one section.

**Verdict:** strong secondary idea, weak primary frame. Fold its best element (the closing proof-pointer row) into Alternative A, as drafted above.

### Alternative C — "Lifecycle stages" (minimal rewrite)

**Says:** keep three cards, rename them to match the system's own verbs — Scope it, Build it, Harden it — delete the week ranges, keep In/Out/Fit verbatim otherwise.

**Pros:** smallest diff, an hour of copyediting. **Cons:** still a card menu; still implies three products instead of one system; leaves the section commercially illiterate next to the new Method story; does nothing about the missing control/autonomy dimension; keeps "AI enablement for an MSME operation" as a standalone SKU even though the MSME thesis is already owned by About and Work.

**Verdict:** acceptable fallback only if the operator wants zero structural change. It fixes the invented durations and nothing else.

---

## 5. Coupled surfaces (for whoever implements — not implemented here)

Any rewrite of the section must migrate every consumer in the same change:

| Surface | Coupling |
|---|---|
| `lib/services.ts` | Source of truth; type change (drop `duration`, relabel rows). Comment at line 2 says "keep in sync with `_reference/portfolio/index.html:1421–1459`" — `_reference/` is archived scratchpad per `CLAUDE.md:57`, so that sync note should be removed with this change, not obeyed. |
| `components/sections/Services.tsx` | Renders the rows; `durationTone` currently keys off `service.duration` (`Services.tsx:6-15`) and must key off the door index instead. Keep `id="services"` — `e2e/home.spec.ts:19,108` anchors and nav by it. |
| `app/llms-full.txt/route.ts` | `renderServices()` hardcodes "Three engagement shapes. In / Out / Fit called out explicitly…" at line 56 and renders `duration` at line 43; both follow the new copy. Keep the `<services>` wrapper — `e2e/agent-readiness.spec.ts:35` asserts it. |
| `public/.well-known/agent-skills/hire-me/SKILL.md` | Line 14 promises agents "(scope, duration, what's in / out of scope)"; update to the new fields so the skill tells the truth. |
| `vitest.config.ts` | `lib/services.ts` stays on the covered-files include list (`vitest.config.ts:44`); unaffected mechanically. |
| `docs/CHANGELOG.md` | Required companion: the process gate's R1 fires on `lib/**` + `components/**` changes (`docs/adr/0002-process-gate-policy.md` D1 table; enforced by `scripts/process-gate.mjs`). The redesign lands through the gate it advertises — which is the point. |

No CI workflow references services copy directly (checked `.github/workflows/*`); lighthouse/e2e run the page as a whole.

---

## 6. Claim-source audit (hard constraint compliance)

Every factual assertion proposed in §3/§4, with its source. Claims without a source here are either voice-register opinions ("it works in demos" is the client's situation, addressed to them) or are excluded.

| Proposed claim | Source |
|---|---|
| Work follows clarify→spec→plan→tasks (+analyze); nothing load-bearing skips them | `trellis-instance/engineering-process.md` §14.7; `trellis-instance/core-rules/skills/{spec,plan,tasks}/` |
| Done = receipt (command, exit code, diff), checked by hooks | `trellis-instance/core-rules/CLAUDE.md` § Definition of done; `trellis-instance/core-rules/hooks.md` stop-verify |
| This site's ADRs, spec triads, changelog, gate are public | `docs/adr/0001…0020`, `specs/001…005`, `docs/CHANGELOG.md`, `scripts/process-gate.mjs`, `.husky/pre-commit` |
| Gate runs before the PR opens / pre-commit | `components/sections/Process.tsx:41`; `docs/adr/0002-process-gate-policy.md` |
| Hardening contents (observability, evals, budgets, runbook) | carried over conceptually from current S/03 `lib/services.ts:36-44` (capability list, not a metric claim) |
| Presets exist as shipped strict variants | `trellis-instance/core-rules/presets/README.md`, `compliance-strict.md` |
| Autonomy is client-settable; secrets/destructive/receipts never flex | `trellis-instance/core-rules/autonomy.md:15-24,33` |
| Decision logs readable after the fact | `trellis-instance/core-rules/autonomy.md:97-109` |
| Loop ceilings exist (adoption tier) | `trellis-instance/core-rules/loop-safety.md:22-31` |
| Contact shape and operator replies himself | `public/.well-known/agent-skills/hire-me/SKILL.md:39-43` |
| Whole-site Markdown at `/llms-full.txt` | `app/llms-full.txt/route.ts`; `public/.well-known/agent-skills/hire-me/SKILL.md:21` |

Explicitly dropped because unsourced in both repos: all three duration ranges; any client names, dates, or headcounts in a services context; any revenue/scale metric. If the operator wants timing back, it should be stated as phases ("spec before code, phases against a roadmap" — sourced §14.7) rather than calendar promises.

**Open questions for the operator (only three, all blocking copy, none blocking direction):**
1. Confirm durations are dead (recommended) or must return in some sourced form.
2. Is team-facing "Adoption" genuinely offered? Nothing in either repo offers or forbids it; if it is not on the table, the third door becomes "Advise" (scoped review of an existing setup) rather than an install engagement.
3. Pricing stays absent (nothing sourced); confirm absence is intentional.

---

## 7. Sources

Trellis instance (`/Users/abhishek/projects/trellis-instance`):

- `engineering-process.md` — §2 principles (receipts over self-reporting), §8 definition of done, §14.4 track sizing, §14.7 pipeline + mandatory-pipeline gate, §14.8 presets, §14.9 autonomy slider
- `core-rules/CLAUDE.md` — parent rules; DoD receipt marker; evidence doctrine
- `core-rules/autonomy.md` — level matrix, bright-line guardrails, decision log, preset ceilings
- `core-rules/hooks.md` — two tiers + git-boundary tier; stop-verify; slop-tripwire
- `core-rules/loop-safety.md` — three ceilings, halt reports
- `core-rules/presets/` — `README.md`, `compliance-strict.md`, `experimental-loose.md`
- `docs/adr/2026-08-12-local-fleets-immutable-releases.md` — multi-fleet registry, immutable releases, ownership boundaries
- `docs/adr/2026-07-07-mandatory-pipeline-and-parity.md`, `2026-05-20-autonomy-slider.md` — supporting decision history
- `specs/` — thirty-plus numbered triads (clarify/spec/plan/tasks/analyze), e.g. `specs/037-anti-slop/`
- `scheduled-tasks/` — operator audit roster (version-drift, test-health, security-baseline, …)
- `README.md` — skills catalog, quick start, release verification flow

This worktree (`akaushik.org-worktrees/services`):

- `components/sections/Services.tsx`, `lib/services.ts` — current section and copy source
- `components/sections/Process.tsx` — existing method claims and artifact list
- `app/page.tsx` — section order; `app/llms-full.txt/route.ts` — corpus renderer
- `docs/adr/0002-process-gate-policy.md`, `scripts/process-gate.mjs`, `.husky/pre-commit` — enforced gate
- `docs/adr/0001…0020`, `specs/001…005`, `docs/CHANGELOG.md` — the public trail
- `public/.well-known/agent-skills/hire-me/SKILL.md`, `e2e/agent-readiness.spec.ts`, `e2e/home.spec.ts` — agent contract and assertions
- `docs/voice.md` — register and vocabulary constraints
- `lib/about-copy.ts` — where the six-year and MSME claims live (services must not duplicate or extend them)
- `audits/2026-08-23-copy-audit.md` — prior copy-pass context; services surfaces were flagged as untouched pending this rethink
