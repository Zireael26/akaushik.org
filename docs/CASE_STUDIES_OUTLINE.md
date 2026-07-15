# Case Studies — Outline

**Status:** Draft v0.1 (review)
**Author:** Claude (structural skeleton from interview + repo context; Abhishek to fill technical gaps and confirm scope)
**Last updated:** 2026-07-14

Five featured case studies, ordered by strategic weight: Neev first (the MSME thesis anchor), VeriCite second (the AI-systems depth proof), Bluehost agents framework third (the operating-at-scale proof), curat.money fourth (the breadth proof), ClusterBid fifth (the UAT platform-engineering proof).

Each case study uses the same five-beat structure so a reader who has read one knows how to read the others: **Context → Problem → Approach → What shipped → Honest scope.** Two optional beats — **Trade-offs** and **What I'd do next** — appear where they have content.

---

## 1. Neev — hero case study

**Headline:** *Bringing AI to an industry that still runs on WhatsApp.*
**Sub-headline:** A modular operations platform for Indian textile distributors — built to be boring where boring matters, and quietly smart where it counts.

### 1.1 Context

India has roughly 63 million MSMEs. Most of them — textile traders, regional distributors, small manufacturing units — operate on WhatsApp conversations, paper ledgers, a Tally install, and a few shared spreadsheets. This isn't backwardness; it's a pragmatic equilibrium built on trust relationships, cash-flow timing, and a low tolerance for software that doesn't survive contact with the day.

Any AI product aimed at this audience has to earn its place *under* that daily reality, not above it.

### 1.2 Problem

Distributors in the textile supply chain lose time and money at very specific seams: order capture (still mostly over WhatsApp), ledger reconciliation (still mostly by hand), GST-compliant invoicing (patchy), and memory of who owes whom what (fragile, relationship-dependent). Generic ERPs don't fit because they assume a workflow that doesn't exist in this business yet. Pure chatbot layers don't fit because they solve a symptom, not the operations below it.

The problem is: build a platform with enough structural honesty that a real MSME can adopt it incrementally, and layer AI in where it removes friction rather than demanding new behavior.

### 1.3 Approach

- **Modular monolith with multi-tenant discipline.** One deployable, clean module boundaries, `tenant_id` enforced at every persistence boundary. This trades early micro-service flexibility for operational sanity at the scale MSMEs actually operate.
- **Textile distribution as beachhead, not as a limit.** The data models and UX are designed so that the platform generalizes to adjacent MSME verticals; the first release narrows to where Abhishek has direct operator input.
- **AI where it reduces typing and memory load, not where it replaces judgment.** Order capture, reconciliation assistance, and narrative summarization over the operator's own ledger — not autonomous decisioning.
- **Same engineering process discipline as a mature product.** PRD, ADRs, roadmap, changelog, process-gate scripts. Not process theatre — process that earns trust from any future technical buyer who looks under the hood.

### 1.4 What shipped

- First deployable version of the Neev platform (link to live deploy / repo as available).
- Multi-tenant foundation with strict `tenant_id` invariants.
- Core domain models for the textile distribution workflow (orders, ledger, parties, items).
- First AI-assisted surfaces in the operator workflow.
- Public engineering artifacts: README, PRD, architectural decision record(s).

*(Abhishek: fill in specific milestones, first tenant onboarded if any, measured effect on at least one workflow.)*

### 1.5 Trade-offs

- **Monolith over microservices.** Deliberately. The cost of the wrong distributed architecture on a team this size is far higher than the cost of modularizing later.
- **Vertical-first over horizontal-first.** Textile distribution is the wedge. A horizontal "MSME platform" would have drifted into genericism.
- **Owner-operator UX over admin-console UX.** The primary user sits on a chair in a shop. Desktop-dense dashboards aren't the frame.

### 1.6 Honest scope

*(Abhishek: name what's live vs. what's in progress, and where real operators are vs. aren't using it yet. Resist the urge to overstate — understated + true beats polished + inflated for this audience.)*

### 1.7 What I'd do next

*(Placeholder — fill after v1 stabilizes. Candidates: vernacular-language input for WhatsApp order capture; offline-first mobile operator app; reconciliation assistant as the first full "agent" surface.)*

---

## 2. VeriCite — institutional RAG

**Headline:** *A retrieval stack an institution can actually trust with its own words.*
**Sub-headline:** Multi-tenant institutional RAG, migrating from Fastembed ONNX to Hugging Face TEI for `paraphrase-multilingual-MiniLM-L12-v2` + `BAAI/bge-reranker-v2-m3`. Qdrant as the backbone. Ory for identity.

### 2.1 Context

Institutional RAG is a different animal from consumer RAG. The retrieval has to be defensible — the institution will be asked *why* a given passage surfaced — and the pipeline has to survive audit-grade scrutiny. The embedding model, the reranker, the chunking strategy, the tenancy model: all of them are load-bearing.

### 2.2 Problem

- The original serving path used Fastembed (ONNX on CPU), which is fine for a proof of concept but constrains the embedding-model catalog and the serving throughput curve.
- The target models — `paraphrase-multilingual-MiniLM-L12-v2` as the embedder and `BAAI/bge-reranker-v2-m3` as the cross-encoder reranker — are worth the extra infra; they measurably change retrieval quality on the institution's corpus.
- The system has to stay multi-tenant by default, with identity-enforced at the query path, deployed in a repeatable way (monorepo, apps + packages + infra + k8s), and shipped on Vercel for the web surface.

### 2.3 Approach

- **Move to Hugging Face Text Embeddings Inference (TEI)** — purpose-built serving for embedders and rerankers, with batching and GPU support that Fastembed on CPU can't match.
- **Separate the embedding and reranking paths so each can scale and evolve on its own cadence.** The embedder answers "is this chunk plausibly relevant"; the reranker answers "of the plausibly relevant, which actually are."
- **Qdrant** as the vector store — with per-tenant filtering baked in at the retrieval layer, not bolted on after.
- **Ory** for identity — because institutional tenants come in with non-trivial auth requirements.
- **Monorepo discipline** — `apps/`, `packages/`, `infra/`, `k8s/` — so the serving infra, the retrieval library, and the product surface evolve independently without drift.

### 2.4 What shipped

- Production-ready institutional RAG stack with the target embedder + reranker pair.
- Multi-tenant retrieval with tenant-scoped vector collections or filters.
- Monorepo with CI/CD, k8s manifests, and Vercel-deployed product surface.
- Migration in-flight (or completed) from Fastembed to HF TEI — *Abhishek to confirm current state at time of publish.*

### 2.5 Trade-offs

- **TEI over Fastembed.** More infra complexity; meaningfully better retrieval quality and a wider model catalog. Worth it for an institutional customer.
- **Qdrant over a Postgres extension.** Chose a purpose-built vector store for the operational profile; accepted the extra service to operate.
- **Ory over a lightweight auth library.** Institutions want real identity. The extra surface area is paid for by what it enables.

### 2.6 Honest scope

*(Abhishek: confirm how much of this is your individual design/implementation vs. team/contracted work; list explicitly what's yours to claim.)*

---

## 3. Bluehost agents framework backend — day-job platform

**Headline:** *The foundational platform behind the majority of Bluehost's agentic AI products.*
**Sub-headline:** Where AI agents meet web-hosting reality — customer scale, production uptime, and real users with real bills.

### 3.1 Context

Bluehost runs a large web-hosting and site-building business with a meaningful stake in AI-assisted products for its customers. Under those customer-facing surfaces sits a shared agents framework backend — the platform that lets individual AI products ship quickly without re-inventing the agent runtime, tool-calling surface, or operational plumbing each time.

### 3.2 Problem

- Multiple AI product teams at Bluehost need to ship agent-powered features against overlapping requirements: tool use, structured outputs, conversation memory, safety and rate-limiting, observability, and a reliable serving layer.
- Each team reinventing the runtime would guarantee fragmentation, security drift, and inconsistent customer experience.
- The platform has to hold up under real Bluehost-scale production traffic, with real SLOs, against customers who notice when something slows down or falls over.

### 3.3 Approach

*(At the public-shareable altitude — Abhishek to confirm exact level of detail permitted before finalizing copy.)*

- **Shared runtime, pluggable surfaces.** Teams consume the framework rather than reimplement the agent loop.
- **Production-grade observability.** Agent traces, tool-call inspection, latency and error budgets as first-class concerns.
- **Reliability discipline.** The framework is the thing that cannot page at 2 a.m. because a product team shipped a bad prompt. Careful boundaries between what the framework enforces and what individual products own.
- **Continuous improvement, not a big-bang rewrite.** Incremental evolution under live customer load.

### 3.4 What Abhishek's role is

A major hand in maintaining and continuously improving this platform — ongoing. This is the work that keeps the rest of Bluehost's AI surface honest. *(Exact scope statements to be confirmed with his manager before publishing.)*

### 3.5 Trade-offs

- **Shared framework over per-team runtimes.** Pays down fragmentation risk; costs coordination overhead, which is the correct trade at this scale.
- **Incremental evolution over rewrite.** Live traffic doesn't wait; the framework improves while serving.

### 3.6 Honest scope / confidentiality note

*(Placeholder: insert the "what I can share publicly" boundary statement. The case study's credibility with senior buyers increases, not decreases, when confidentiality is named plainly instead of fudged. A short paragraph acknowledging "this is employer work; what follows is the subset that can be shared" reads as professional, not defensive.)*

---

## 4. curat.money — crypto-card comparison platform

**Headline:** *A fair-comparison tool for crypto cards, built like a real product.*
**Sub-headline:** Custody checks, provider coverage, multi-environment deploys — the boring-but-important scaffolding that most crypto product sites skip.

### 4.1 Context

The crypto card market — cards that let holders spend crypto or spend against crypto collateral — is fragmented, and consumers evaluating these cards are under-served by marketing-heavy comparison sites. The product thesis of curat.money is that a rigorous, source-checked comparison platform — with custody status made explicit, country coverage reflected honestly, and data refreshed on a real schedule — is worth more than yet another affiliate-aggregator.

### 4.2 Problem

- Card data is scattered across provider sites, each with its own vocabulary and its own willingness to obscure the trade-offs.
- Users need to filter by country availability, custody model, supported crypto, fees, and rewards — and they need to trust the filter.
- The product has to be operationally real: scraped and normalized data, multi-environment (local / production) hygiene, a K8s production deployment, and a build pipeline that doesn't rot.

### 4.3 Approach

- **Scrape → normalize → verify** as the data spine. Custody status checks are first-class, not a footnote. `custody_scrape_results_local.json`, `match_cards.py`, `scrape_and_update_prod.py` — the pipeline is repeatable and re-runnable.
- **Multi-role RBAC** so internal operators, external contributors, and end-users each see the right surface.
- **K8s in production** with a real CI/CD build (`cloudbuild-web.yaml`), not a weekend deploy.
- **Make-based DX** — the kind of developer-ergonomics choice that pays off over months.

### 4.4 What shipped

- Data pipeline producing normalized, verified card records.
- Multi-environment web product with role-based access.
- Production K8s deployment with observable build pipeline.

### 4.5 Trade-offs

- **Product rigor over content-farm velocity.** Fewer listings, each defensible, over a thousand shallow entries.
- **K8s over simpler hosting.** Overkill for a v0; correct for where the product is heading.

### 4.6 Honest scope

*(Abhishek: confirm current live status, your ownership boundaries, and whether to publish product metrics. Some crypto readers will be hostile; the portfolio framing can focus on product engineering rather than on the asset class.)*

### 4.7 Framing note for the portfolio

On the portfolio, this case study is framed as *product engineering for a niche consumer category*, not as "look at my crypto work." The engineering is the story. The asset class is incidental.

---

## 5. ClusterBid — UAT platform engineering

**Headline:** _From monorepo checks to a real-host k3s UAT, with every mock and boundary named._
**Sub-headline:** A Go-and-Next.js inference-cloud platform taken through repository-wide validation, Helm deployment, and a mock-inference metering-to-billing smoke — pre-production proof, not a production outcome.

### 5.1 Context

ClusterBid is a pre-production, region-pinned inference-cloud platform. Go services and shared packages, Next.js clients, TypeScript packages, Helm charts, and infrastructure code live under one review surface. Abhishek's role is bounded to engineering advisor across process and platform.

### 5.2 Problem

- A Go workspace needs module-aware vet, lint, race-test, and coverage loops; one root `go vet ./...` cannot honestly cover it.
- The Next.js clients and TypeScript packages keep separate build, lint, and test contracts that still need one repository-level entry point.
- Local tests and rendered charts do not prove a real deployment. UAT exposed stateful-container capability, isolated image-build, and browser-origin assumptions that had to be fixed in source.

### 5.3 Approach

- **Makefile as routing layer.** Enumerate workspace modules, route each subtree to its native checks, and compose them through `quality-gate-local` with repository linting.
- **Native git-boundary checks.** Keep conventional-commit and process-gate policy in `.githooks/commit-msg` and `.githooks/pre-push`, independent of any nested Next.js client.
- **UAT as an explicit contract.** Use a dedicated single-VM k3s overlay and runbook with one-node NATS settings, environment-specific URLs, mock inference, local Stripe, and named secret requirements.
- **Persist deployment findings.** Move live-proven chart, image-build, and runtime-origin corrections back into tracked source rather than retaining imperative cluster patches.

### 5.4 What reached UAT

- Real-host UAT surfaces for the marketing site, console, and API gateway over publicly valid TLS.
- A mock-inference request path through gateway, metering, and billing, with spend and reconciliation checked in UAT.
- Durable repository fixes for the chart, isolated service builds, and console runtime-origin configuration.
- An asset-free static portfolio reel, so publishing the case study introduces no ClusterBid media request.

### 5.5 Trade-offs

- **One repository over service-by-service repositories.** Cross-surface changes stay reviewable together, but validation needs an explicit routing layer.
- **Mock providers inside UAT.** Service topology and billing contracts can be exercised without presenting GPU or payment-provider readiness as complete.
- **Single-node UAT over high availability.** The environment is an economical integration boundary, not a production topology recommendation.

### 5.6 Honest scope

This case study claims UAT and pre-production engineering only. It does not claim customer traffic, adoption, revenue, a production deployment, live GPU inference, or live Stripe processing. Technical statements are limited to the current repository and its recorded UAT evidence; the owner-authored role is **Engineering advisor · process & platform**.

---

## 6. Cross-cutting notes

### 6.1 What each case study is evidence of

| Case study                | Primary evidence of…                                            |
| ------------------------- | --------------------------------------------------------------- |
| Neev                      | MSME-thesis depth; systems + product discipline; solo ownership |
| VeriCite                  | Institutional AI-systems depth; retrieval-stack sophistication  |
| Bluehost agents framework | Scale; production responsibility; team context                  |
| curat.money               | Product breadth; data-pipeline-to-web-product operational chops |
| ClusterBid                | UAT delivery; platform and repository discipline                |

### 6.2 Case-study page template

Every case study page uses the same scaffold:

1. Hero image or reel (HyperFrames-rendered background loop where an asset exists; static fallback always; ClusterBid is deliberately asset-free).
2. Headline + sub-headline.
3. Context.
4. Problem.
5. Approach.
6. What shipped.
7. Trade-offs.
8. Honest scope.
9. What I'd do next (optional).
10. Links — repo (if public), live site (if public), relevant ADRs/PRDs.

### 6.3 Writing voice

- Present tense for what the system *does*; past tense for what *I did*.
- Short paragraphs. No bulleted dumps for their own sake.
- Every number has a source. If a number can't be sourced publicly, it isn't cited.
- Named models, named services, named trade-offs. Specificity is the whole trick.

---

## 7. Review prompts for Abhishek

- Neev — the "WhatsApp + paper ledgers" framing is load-bearing. Keep, soften, or replace?
- VeriCite — are we clear on what's yours to claim as individual design/implementation?
- Bluehost — confirm the "publicly shareable altitude" with your manager before we finalize copy. Flagging now because this is the one case study that needs outside sign-off.
- curat.money — how hard do we lean into the crypto framing vs. positioning this as consumer product engineering?
- ClusterBid — retain the UAT/pre-production boundary until real-provider and production evidence exists.
- Missing anything? Is there work you'd rather feature than curat.money?
