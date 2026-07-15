---
generated_by: human-seed
created: 2026-05-19
schema_version: 1
purpose: 50-slot publishing calendar consumed by the registered `seo-weekly-draft` task. Each row is one post; a run picks the next `status: pending` slot, drafts MDX, and opens a draft PR.
---

# Editorial calendar

When registered and enabled, `seo-weekly-draft` is intended to run Mondays at 06:00, pick the next `status: pending` slot, draft a writing post in MDX, and open a `seo:draft`-labelled PR for Abhishek to edit and merge.

Statuses: `pending` (not started), `drafted` (PR open), `published` (merged), `dropped` (intentionally skipped).

Slot syntax — keep one row per line for simple awk/grep:

```
<NN>  <YYYY-MM-DD>  <status>  <pillar>  <slug>  <one-line angle>
```

Pillars: `msme` (AI for MSMEs), `agents` (agent systems in production), `rag` (RAG / retrieval), `eng` (engineering process / Trellis), `craft` (interface + design notes).

---

01  2026-05-25  pending  msme    voice-first-msme-onboarding         How voice-capture replaces order forms for distributors who never typed at scale
02  2026-06-01  pending  agents  agent-state-without-orchestrators   Modelling agent state in a relational store instead of a workflow engine
03  2026-06-08  pending  rag     reranker-vs-retrieval-curves        When swapping retrievers stops mattering and the reranker eats the gains
04  2026-06-15  pending  craft   parchment-and-forest-tokens         Five token-pair design choices that hold a portfolio together
05  2026-06-22  pending  msme    whatsapp-business-api-anti-patterns Three integrations that look right and aren't
06  2026-06-29  pending  eng     trellis-process-gate-anatomy        Pre-commit doc-hygiene rules that survive AI agent contributors
07  2026-07-06  pending  agents  tool-calling-failure-modes          What "tool error" actually looks like in production agent traffic
08  2026-07-13  pending  rag     hybrid-search-on-postgres           When pg_trgm + pgvector beats a vector DB for ≤10M docs
09  2026-07-20  pending  msme    receipt-photo-pipelines             OCR + reconciliation flows for MSMEs without inventory software
10  2026-07-27  pending  agents  observability-for-agents            Tracing + replay + token-budget dashboards that actually get used
11  2026-08-03  pending  eng     CHANGELOG-as-discipline             Why the changelog is the most underrated engineering artefact
12  2026-08-10  pending  rag     fastembed-to-tei-followup           Twelve months later — what we kept, what we regret
13  2026-08-17  pending  craft   motion-language-for-portfolios      The line between meaning and decoration in scroll-driven motion
14  2026-08-24  pending  msme    bookkeeping-agent-handoff-points    Where the AI hands the work back to the bookkeeper
15  2026-08-31  pending  agents  evaluating-agents-cheaply           Eval harnesses you build in a day, not a quarter
16  2026-09-07  pending  rag     chunking-strategies-postmortem      Three chunkers, six datasets, one honest answer
17  2026-09-14  pending  eng     ADRs-without-process-theatre        Writing decisions in a voice future-you wants to read
18  2026-09-21  pending  msme    inventory-multi-warehouse-msme      Modelling 4 warehouses, 200 SKUs, and 50 outstanding orders simply
19  2026-09-28  pending  craft   typography-clamp-recipe             One font-size formula for headings across phone → desktop
20  2026-10-05  pending  agents  fine-tuning-vs-rag-2026             When neither is right and you actually need a search index
21  2026-10-12  pending  rag     query-reformulation-tradeoffs       Multi-query, HyDE, sub-question — and what they cost
22  2026-10-19  pending  msme    paper-ledger-to-postgres-migration  A six-week migration without losing the bookkeeper
23  2026-10-26  pending  eng     primer-system-postmortem            How feature primers cut session-start exploration in half
24  2026-11-02  pending  agents  long-running-agent-jobs             State machines, idempotency keys, restart semantics
25  2026-11-09  pending  craft   accessibility-for-portfolio-sites   Beyond contrast — keyboard order + reduced motion + skip links
26  2026-11-16  pending  msme    ai-roadmap-for-50-person-businesses Three-quarter plans that survive owner attention spans
27  2026-11-23  pending  rag     embedding-model-shopping-2027       Half-yearly check on what beats bge-base on Indian business text
28  2026-11-30  pending  agents  context-windows-in-practice         When 200k tokens is luxury vs. when it's necessity
29  2026-12-07  pending  eng     gap-analysis-as-routine             Quarterly drift audits + how to make them cheap
30  2026-12-14  pending  msme    pricing-conversations-with-msmes    What a fixed-price engagement looks like for a 30-lakh business
31  2027-01-04  pending  rag     evaluation-sets-for-rag             Building golden sets when your customers can't label
32  2027-01-11  pending  craft   commit-cadence-as-portfolio-signal  What "ship every day" looks like on a personal site
33  2027-01-18  pending  agents  multi-agent-without-frameworks      Just function calls and Postgres, until you can't
34  2027-01-25  pending  msme    udyam-compliance-helpers            Compliance touchpoints AI can quietly automate for MSMEs
35  2027-02-01  pending  eng     test-doctrine-for-ai-contributors   Tests that catch model regressions, not just code regressions
36  2027-02-08  pending  rag     retrieval-latency-budgets           p99s that hold under cold-start, page-load, and degraded networks
37  2027-02-15  pending  agents  agent-recovery-playbooks            What the agent does after it fails — a recovery taxonomy
38  2027-02-22  pending  msme    voice-bots-for-illiterate-users     Designing a chatbot when the user can't read the chat
39  2027-03-01  pending  craft   3d-on-the-web-restraint             When the canvas adds vs. subtracts from the page
40  2027-03-08  pending  rag     RAG-for-private-codebases           Indexing yours without sending it to a vendor
41  2027-03-15  pending  msme    SaaS-vs-MSME-stack                  Why MSMEs run on a different stack and how to meet them
42  2027-03-22  pending  agents  rate-limits-and-back-pressure       How agents survive when the underlying APIs throttle
43  2027-03-29  pending  eng     audit-trails-for-ai-actions         Logging that an investigator (not a debugger) can use
44  2027-04-05  pending  msme    multilingual-support-for-msmes      Hindi + English without machine-translation jank
45  2027-04-12  pending  rag     graph-augmented-retrieval           Trying knowledge graphs on top of vector search
46  2027-04-19  pending  craft   ssg-vs-rsc-for-portfolios           One year on RSC — what I'd do differently
47  2027-04-26  pending  agents  prompt-versioning-in-prod           Treating prompts as code, with diffs and reviews
48  2027-05-03  pending  msme    capacity-planning-for-warehouses    Forecasting from 6 months of paper records
49  2027-05-10  pending  eng     security-baseline-for-portfolios    Threat model and remediation cadence for a one-person site
50  2027-05-17  pending  agents  what-2027-actually-changed          A year-in-review on agent systems shipping to real users

---

## Notes for the scheduled task

- **Picking the next slot.** Find the first row with `status: pending`. If none exists, record `calendar exhausted` in the status PR and stop; replenishment is an editorial action.
- **PR shape.** Branch `seo-bot/weekly-draft/<YYYYMMDD>`; draft MDX in `content/writing/<slug>.mdx`; labels `seo:automation` + `seo:draft`; never push to main.
- **Flipping status.** After the draft PR exists, change to `drafted` and append `<!-- draft-pr: <real URL> -->` to that row in a second committed and pushed update. Change to `published` only when the PR merges, or `dropped` if Abhishek closes it without merging.
- **Editing this file by hand is welcome.** A registered task re-reads the file at every run.
