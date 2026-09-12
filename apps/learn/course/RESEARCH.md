# Harness Engineering and Multi-Agent Systems: Research Foundation

This report consolidates a targeted review of primary research, official runtime documentation, protocol specifications, and firsthand engineering reports available on **12 September 2026**. It supports an advanced course for an engineer already building AI products. The newest directly inspected engineering article is dated 11 September 2026. This is a research-informed design judgment, not an exhaustive systematic review or a ranking of every available agent framework.

The central conclusion is that advanced agent engineering requires control over the **whole system**: information, actions, durable state, verification, resources, and authority. Multi-agent orchestration is one possible intervention within that system. LangGraph is a useful implementation substrate because it makes state and transitions explicit; framework fluency becomes expert competence only when paired with experiments and reasoning about failures.

## How to interpret the evidence

The sources answer different questions. Official documentation establishes intended mechanisms, such as how an interrupt resumes. Controlled papers estimate comparative effects under specified experimental conditions. Vendor case studies describe working systems but often change several variables simultaneously. Recent optimization papers identify promising mechanisms whose generality remains uncertain. Protocol specifications define requirements; they do not prove that an implementation is secure.

| Evidence type | Reasonable use | Inference to avoid |
|---|---|---|
| Runtime documentation | Implement and test a documented contract | The framework guarantees business correctness |
| Controlled benchmark study | Reproduce a comparison within its conditions | The winning architecture wins every task |
| Firsthand production report | Extract architectural hypotheses and failure lessons | The reported productivity gain is causal or universal |
| Recent research method | Investigate a mechanism with explicit baselines | A new paper supersedes all established practice |
| Security specification | Implement enforceable boundaries | Compliance eliminates prompt injection |

Rolling documentation is cited with its access date, not an invented publication date. Executable lessons must pin dependencies and model identifiers. Findings from a 2025 model remain useful historical evidence, but cannot silently become September 2026 performance claims. Numbers below retain their original denominators and experimental scope.

## An operational definition

For this course, a **harness** is the executable system surrounding a model that turns proposed actions into controlled, observable progress: context construction, the inference loop, tools, permissions, state, recovery, stopping, and feedback. **Harness engineering** is the design, measurement, and maintenance of that system and its environment. This is our working synthesis rather than an official universal definition.

| Concern | Engineering question | Concrete artifact |
|---|---|---|
| Model | Which capabilities and failure tendencies are available? | Versioned baseline |
| Prompt | What result and constraints are requested? | Task contract |
| Context | What should this inference call know? | Context construction policy |
| Harness | What can execute, persist, recover, or stop? | Runtime and enforcement code |
| Orchestration | Who owns work, evidence, state, and integration? | Graph and delegation contracts |
| Environment | Can the agent inspect and verify reality? | Tools, fixtures, repository, sandbox |

These concerns overlap. A business workflow can contain model-controlled loops inside deterministic transitions. A coding agent can delegate bounded investigation without transferring ownership of the change. “Agent,” “workflow,” and “framework” should therefore be treated as architectural descriptions that require operational detail.

OpenAI's Codex walkthrough provides an inspectable example: inference proposes tools, the runtime executes them, results reenter context, and the cycle terminates with an assistant response. It also shows why stable prompt prefixes and tool ordering matter for caching. The shell's sandbox does not automatically constrain external MCP tools. [1](https://openai.com/index/unrolling-the-codex-agent-loop/)

## What the current practice supports

**Make the environment legible and feedback executable.** OpenAI's February 2026 repository case study uses discoverable knowledge, architectural checks, isolated worktrees, and agent-accessible application observations. Its estimated tenfold speedup is a selected internal case, not a controlled productivity result. The useful lesson is to investigate missing evidence and enforcement when an agent repeatedly fails. [2](https://openai.com/index/harness-engineering/)

**Manage context as a changing selection problem.** Anthropic describes hybrid retrieval, just-in-time exploration, compaction, and external notes. Each exchanges one cost for another: retrieval adds exploration, summaries risk losing details, and retained history consumes context. These are policies to evaluate against task outcomes, not interchangeable ways of “adding memory.” [3](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**Evaluate tool interfaces behaviorally.** Anthropic's tool-engineering report measures realistic tasks using held-out evaluations, including calls, tokens, errors, latency, and success. Clear descriptions and useful outputs matter beyond schema validity. Requiring a single prescribed trajectory can incorrectly penalize another successful strategy. [4](https://www.anthropic.com/engineering/writing-tools-for-agents)

**Verify independently, then test whether the extra machinery earns its cost.** Anthropic's March 2026 application harness separates planning, generation, and evaluation. The evaluator still required tuning and missed defects. Removing components individually showed that newer model capabilities could make earlier scaffolding unnecessary. This supports ablation, not a mandatory three-agent architecture. [5](https://www.anthropic.com/engineering/harness-design-long-running-apps)

**Separate durable history, control, and execution.** Anthropic's Managed Agents architecture gives sessions, harnesses, and sandboxes independent interfaces. Durable events remain recoverable after context transformation or worker failure; generated code does not share the credential store. These separations improve recovery design but do not themselves guarantee exactly-once external effects. [6](https://www.anthropic.com/engineering/managed-agents)

**Treat model upgrades as harness migrations.** OpenAI's 11 September 2026 guidance recommends narrower skill triggers, progressive disclosure, contextual repository instructions, and explicit completion boundaries. Instructions that helped one model can overconstrain another. Preserve genuine business and security requirements while retesting procedural workarounds. [7](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

Our resulting design rule is to assign every significant harness component a reason for existence, an observable failure it addresses, and a removal test. This turns an expanding collection of prompts and agents into a maintainable system. It also makes the course relevant to both AI product development and the learner's coding workflows.

## LangGraph and the runtime choices

The comparison below concerns documented responsibilities, not benchmark superiority. The recommended teaching sequence is a small direct loop, explicit LangGraph implementations, an opinionated harness comparison, and finally durable business orchestration where requirements justify it.

| Choice | Useful control surface | What the engineer must still establish |
|---|---|---|
| Direct application loop | Every inference, context update, and action | Persistence, cancellation, scheduling, instrumentation |
| LangGraph | Explicit state transitions and graph composition | State invariants, effect semantics, operational ownership |
| Deep Agents | Configurable higher-level harness on LangGraph | Whether built-in policies suit the task |
| OpenAI Agents SDK | Agent execution, tools, delegation, handoffs | Integration with durable operational requirements |
| Temporal | Durable workflow commands and Activities | Workflow compatibility and external-effect correctness |

**State is an interface.** LangGraph nodes return updates to named fields, with reducers determining how updates combine. `Send` creates dynamic work; `Command` can update state and route execution. Dynamic routing does not cancel an existing static edge. These details matter when a diagram appears to imply one next step but the runtime schedules several. [8](https://docs.langchain.com/oss/python/langgraph/graph-api)

For each shared field, the course should require a statement of merge behavior under simultaneous writes, reordered completion, and duplicate delivery. An evidence set keyed by stable IDs behaves differently from a list of chat messages. Conflicting observations may require preserving both claims for adjudication rather than overwriting whichever arrived first. This is an application design decision, not something a generic reducer can infer.

**Checkpointing has a granularity.** LangGraph makes full checkpoints at superstep boundaries. Pending writes preserve successful sibling results when another task in that step fails; these are distinct from full checkpoints. A persistent backend and thread identity are required for recovery across process loss. [9](https://docs.langchain.com/oss/python/langgraph/checkpointers)

**Replay is not continuation from an arbitrary source line.** The Functional API reruns an entrypoint and restores recorded task results. Side effects and nondeterministic operations should be isolated in tasks; unfinished tasks may execute again. [10](https://docs.langchain.com/oss/python/langgraph/functional-api) Likewise, resuming `interrupt()` restarts its containing node. Effects before it can repeat, and positional matching of multiple interrupts makes unstable ordering dangerous. [11](https://docs.langchain.com/oss/python/langgraph/interrupts)

Consider an agent recording billable usage. The ledger commits, the network drops the response, and the agent's checkpoint is never written. Recovery cannot infer from the missing response that the transaction failed. The executor needs a stable operation identity accepted atomically by the ledger, or a reconciliation path. Changing the idempotency key on retry defeats the protection. The same reasoning applies to sending a message, granting access, and creating a refund.

**Agent lifetime is separate from agent role.** LangGraph subgraphs support different state lifetimes, including per-invocation and accumulated per-thread state. Parallel use of the same persistent namespace requires care. [12](https://docs.langchain.com/oss/python/langgraph/use-subgraphs) A disposable investigator, a continuing conversation owner, and a long-lived workflow component should therefore not receive identical persistence by default.

**Deployment changes affect unfinished work.** New graph code normally runs against existing saved state. Renaming pending nodes or changing required state fields can break resumption; technical compatibility also differs from preserving the original business behavior. [13](https://docs.langchain.com/oss/python/langgraph/backward-compatibility) The course should preserve old checkpoints as migration fixtures, including outstanding approvals and partially completed work.

**Memory storage does not establish memory quality.** LangGraph stores provide namespaced items independent of thread checkpoints and can support semantic retrieval. [14](https://docs.langchain.com/oss/python/langgraph/stores) Our proposed memory record includes the claim, subject, evidence reference, observation time, scope, and deletion state. Separate the write policy from retrieval and authorization. A plausible recalled preference can still be stale, misattributed, or inappropriate for the current tenant.

**Higher-level harnesses package policy choices.** Deep Agents includes planning, delegation, context management, filesystem abstractions, skills, and configurable execution capabilities on LangGraph. [15](https://docs.langchain.com/oss/python/deepagents/overview) Inspect these mechanisms before reproducing them in custom graph code. Compare equivalent tasks and budgets, then disable individual capabilities to understand their contribution.

**Delegation and handoff have different ownership.** In the OpenAI Agents SDK, agents-as-tools allow a manager to retain the conversation, whereas handoffs transfer the active agent. [16](https://openai.github.io/openai-agents-python/multi_agent/) Its running guide separately addresses conversation state and integrations for durable orchestration. Session history alone does not define recovery of an in-flight business action. [17](https://openai.github.io/openai-agents-python/running_agents/)

**Temporal makes another boundary explicit.** Workflow commands must remain replay-compatible; external operations and model calls belong in Activities. Versioning or patching is needed when running workflows evolve incompatibly. [18](https://docs.temporal.io/workflow-definition) LangGraph and Temporal can be layered, but the design must name one owner for retry policy, cancellation, operation identity, and waiting. Duplicated ownership produces difficult failure cases.

For the learner's Postgres, Redis, and Kubernetes environment, the worthwhile question is where these contracts fit into existing services. Introduce infrastructure when it supplies a required guarantee or simplifies a demonstrated operational problem. A deployment diagram with more components is not evidence of a stronger harness.

## What multi-agent evidence actually demonstrates

A controlled study of 180 configurations (the December 2025 version) reports substantial task dependence. On Finance-Agent, centralized coordination scored 0.631 against 0.349 for the single-agent baseline: **28.2 percentage points**, or about **81% relative improvement**. On PlanCraft, tested multi-agent designs lost **39–70% relatively**. The April 2026 revision (v2) expands the study to 260 configurations across six benchmarks and reports a range from +80.8% on decomposable financial reasoning to −70.0% on sequential planning; the direction of the finding is unchanged. The tasks and architectures differ in their dependence on shared, sequential state. These are results of that study, not universal thresholds for choosing agent count. [19](https://arxiv.org/html/2512.08296v1)

Anthropic reports a **90.2% improvement** on its internal research evaluation using an Opus 4 lead and Sonnet 4 workers compared with a single Opus 4. The report also estimates multi-agent token usage around **15 times chat**, with single-agent usage around **four times chat**. The fifteenfold denominator is chat, not single-agent execution. This was not a public equal-compute causal comparison. [21](https://www.anthropic.com/engineering/multi-agent-research-system)

More communication can make selection worse. In *The Cost of Consensus*, ten homogeneous agents using 7–8B models over three rounds spent **2.1–3.4 times** the tokens of isolated self-correction with comparable or worse accuracy on two reasoning benchmarks. The finding is about unguided homogeneous debate in that setup, not every specialist team or frontier model. [22](https://arxiv.org/html/2605.00914v1)

Failures also have structure. MAST organizes 14 failure modes into design, inter-agent misalignment, and verification categories. Its expanded dataset contains more than 1,600 traces; the larger annotation pipeline uses an LLM judge, so these should not be described as entirely human-labeled. A taxonomy helps investigation but is not a causal diagnosis of a new failure. [20](https://arxiv.org/html/2503.13657v3)

Our synthesis is to separate three choices: **divide work, transfer information, commit results**. A named team answers none of them by itself.

| Task shape | Candidate starting design | Experiment that can justify more agents |
|---|---|---|
| Sequential changes to one state | One agent with structured tools | Better outcomes after controlling for extra compute |
| Independent evidence collection | Bounded workers and one synthesis owner | More distinct, correct evidence at acceptable cost |
| Multiple candidate answers | Independent sampling and selection | Communication improves on the same candidate pool |
| Specialized stages | Typed handoffs | Clearer ownership without losing relevant context |
| Shared mutable artifacts | Isolated proposals and controlled integration | Parallel progress exceeds conflict and merge cost |

A delegation contract should identify the objective, inputs, allowed effects, output schema, evidence references, dependencies, deadline, and budget. Worker results need status and unresolved questions, not simply a confident narrative. Measure whether specialists contribute new information and whether the coordinator preserves it.

Heterogeneous providers are particularly interesting for the learner's current workflow, but diversity of branding does not establish independent errors. Measure candidate coverage before communication, pairwise error correlation, and final selection accuracy. If one candidate was correct and the team discarded it, the problem is aggregation. If every candidate missed the evidence, changing the voting rule cannot repair information that was never obtained.

## Evaluation: the permanent experimental spine

Anthropic's evaluation guidance distinguishes tasks, trials, transcripts, and actual outcomes, and combines deterministic, model, and human graders. It emphasizes calibration and trace inspection. A successful-looking final response is insufficient evidence of the intended environmental result. [23](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

The course should maintain four separate measurements: final-state correctness, prohibited effects, artifact quality, and operational performance. A transaction agent may produce correct prose while touching the wrong tenant. A coding agent may pass a narrow test while breaking the user's actual workflow. A research agent may cite real sources that do not support its conclusion.

The distinction between capability and repeatability is central. τ-bench evaluates tool–agent–user interactions against resulting database states and introduces `pass^k` for repeated success. [24](https://arxiv.org/abs/2406.12045) Under a simplified independent model with per-task success probability p, at-least-one success in k attempts is `1 − (1 − p)^k`, while success on every attempt is `p^k`. At p = 0.8 and k = 5, these are approximately 99.968% and 32.768%. These are illustrative calculations, not measured benchmark scores. Correlated retries and heterogeneous task difficulty require more careful estimation.

Even the benchmark needs evaluation. OpenAI's July 2026 SWE-Bench Pro audit identified 200 broken tasks through its pipeline and 249 through human review, against a 731-task public split. The deeper reviews focused on a flagged subset. OpenAI withdrew its earlier recommendation; this remains its audit finding, not independent consensus that all benchmark results are useless. [25](https://openai.com/index/separating-signal-from-noise-coding-evaluations/)

METR's time horizon estimates the human-duration difficulty at which an agent reaches a specified success probability. It is not the time the agent remains autonomously active. The task distribution is predominantly well-specified software, ML, and cybersecurity work; METR explicitly warns against equating a horizon with replacing an experienced professional's workday. [26](https://metr.org/time-horizons/)

*AI Agents That Matter* argues for evaluating accuracy and cost together and scrutinizes holdouts and reproducibility. Its historical results are not current model rankings. [29](https://arxiv.org/abs/2407.01502) For this course, count coordinator, worker, verifier, retry, environment, and failed-run costs. Also report latency tails and human cleanup. A small average improvement can be unattractive if its rare failures are operationally expensive.

The proposed experimental record contains task family, initial state, model, harness commit, prompt and tool versions, budget, grader version, event trace, and final environmental state. Use paired comparisons on the same tasks, preserving failed and timed-out attempts. Separate agent failure from infrastructure and grader failure. Estimate uncertainty at the task or scenario level rather than treating every call as independent evidence.

Calibrate model judges against deliberately varied examples: polished failures, valid alternatives, incomplete results, and insufficient evidence. Blind candidate identity where possible. Freeze the final holdout before optimization. A regression test discovered during improvement is useful, but it is no longer an untouched generalization test. The evaluator itself needs adversarial cases and version history.

## Security and authority across agent boundaries

AgentDyn includes dynamic tasks and helpful third-party instructions, exposing the tension between resisting injection and blocking legitimate work. Its May 2026 version evaluates 60 tasks, 560 injection cases, and ten defenses. The results concern those environments; the practical implication is to measure both security and useful completion. [27](https://arxiv.org/abs/2602.03117v3)

MCP's versioned security guidance prohibits token passthrough without proper audience validation and warns that sessions are not authentication. Authorization requirements survive routing, proxies, and distributed state. [28](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices) A2A defines discovery, task and artifact exchange, and asynchronous interaction between agent services; it does not decide whether delegation is justified or an action is authorized. [35](https://a2a-protocol.org/latest/specification/)

Our proposed system boundary is straightforward: the model proposes; trusted services authorize and execute. Bind approval to the actual action, principal, tenant, resource, arguments, and validity period. Revalidate changes before execution. An approval boolean or worker sentence does not establish this contract.

Preserve provenance through summaries. A malicious instruction retrieved by a worker must not gain authority simply because it appears in the coordinator's trusted-looking message. Exercise this failure in tools, documents, skill files, memory, and handoffs using synthetic data. Separately test cancellation, stale permissions, and concurrent writes. Passing these finite tests demonstrates their covered properties, not universal attack immunity.

## Optimization and the research frontier

Optimization now spans several distinct surfaces. **Prompt search** changes instructions. **Context adaptation** changes retained strategies or evidence. **Harness search** changes routing and tool policy. **Inference-time allocation** changes work performed per task. **Post-training** changes weights. Combining them is possible, but their costs, data access, and generalization claims must remain separable.

GEPA reflects on trajectories to propose and test prompt changes while retaining complementary candidates. Its comparisons against particular optimization and RL baselines do not establish universal superiority. [30](https://arxiv.org/abs/2507.19457v2) The project's February 2026 `optimize_anything` interface extends candidate optimization to text-described code and configurations; availability of that interface is not proof that every architecture benefits. [31](https://gepa-ai.github.io/gepa/blog/2026/02/18/introducing-optimize-anything/)

ACE treats context as an evolving playbook updated through generation, reflection, and curation. The March 2026 revision includes harmful-reflection stress tests: moderate corruption was tolerated in that experiment, but continuously harmful updates could make performance worse than the baseline. Persistent lessons must therefore be tested, not automatically trusted as learning. [32](https://arxiv.org/html/2510.04618v3)

Recursive Language Models place long inputs in an external environment that the model can inspect programmatically and process through recursive subcalls. The May 2026 revision evaluates four long-context tasks. Strong average results coexist with expensive outlier trajectories and potentially excessive subcalling, so recursion needs explicit budgets and stopping. [33](https://arxiv.org/html/2512.24601v3)

Agent Lightning v1.0, submitted in August 2026, makes the deployment harness participate in post-training while a trainer observes model request–response pairs. Its technical challenges include retokenization, sample merging, credit assignment, loss normalization, and scheduling. This is a significant research direction, not an off-the-shelf guarantee that an arbitrary production agent can be improved cheaply. [34](https://arxiv.org/abs/2608.17528)

An advanced course should reproduce mechanisms at small scale before attempting a large training run. Compare manual iteration with bounded automatic search. Preserve immutable evaluators, candidate lineage, holdouts, and resource ceilings. Promote only improvements that survive end-to-end checks. Calculate how much deployment volume is required to repay optimization cost; otherwise a cheaper per-run system can still be the more expensive engineering project.

## Open questions and course implications

Five questions connect the research to expert practice:

1. **When should control adapt?** Can a controller estimate whether another retrieval, verifier, worker, or retry is worth its cost on this task? It must account for its own overhead and selection errors.
2. **What constitutes trustworthy verification?** How do we validate subjective quality, delayed effects, and hidden state when generation and judgment share blind spots?
3. **How should memory evolve?** Retention, retrieval, contradiction resolution, deletion, and provenance need separate policies. Larger storage does not answer these questions.
4. **How can a changing harness remain auditable?** Automated optimization and model upgrades change the system being measured. Promotion, rollback, and historical checkpoint compatibility become part of learning.
5. **What transfers between models and domains?** A mechanism that succeeds on coding or static reasoning may fail in interactive products. Stable interfaces help portability, but behavioral competence must be reestablished.

These questions imply a course built around two persistent environments: a transactional product agent with exact state checks and a software-evolution repository with meaningful user-facing acceptance. The same environments should reappear as the learner adds context policies, delegation, durability, security, and optimization. This makes improvements comparable and reveals regressions introduced by sophistication.

Each module should produce something inspectable: a trace explanation, reducer contract, recovery timeline, calibrated grader, topology comparison, or measured harness change. Interactive aids should let the learner predict a transition before revealing it, inject a failure, change a budget, and inspect consequences. Synthetic demonstrations must be labeled; simulations explain mechanics but cannot substantiate empirical performance.

Three official courses are useful optional companions: **Foundation: Introduction to LangGraph – Python**, **Foundation: Introduction to Agent Observability & Evaluations**, and **Foundation: Introduction to Deep Agents**. They support implementation familiarity; the advanced course adds controlled comparisons, failure injection, and design defenses. [36](https://academy.langchain.com/courses/intro-to-langgraph) [37](https://academy.langchain.com/courses/intro-to-langsmith) [38](https://academy.langchain.com/courses/foundation-introduction-to-deepagents)

The graduation standard is demonstrated engineering judgment: defend a system against a strong baseline, explain where its gains come from, recover from relevant failures, and identify what would make you remove part of it. A justified decision to use fewer agents can meet that standard. The ambition is to develop expertise that remains useful when today's models, libraries, and fashionable architectures change.

## Sources

Research papers are identified by the exact version where relevant. “Accessed” denotes rolling documentation inspected on 12 September 2026. Registry entries provide titles, publishers or research authors, dates, and direct source links.

1. OpenAI. *Unrolling the Codex agent loop*. 23 January 2026. [Source](https://openai.com/index/unrolling-the-codex-agent-loop/)
2. OpenAI. *Harness engineering: leveraging Codex in an agent-first world*. 11 February 2026. [Source](https://openai.com/index/harness-engineering/)
3. Anthropic. *Effective context engineering for AI agents*. 29 September 2025. [Source](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
4. Anthropic. *Writing effective tools for agents — with agents*. 11 September 2025. [Source](https://www.anthropic.com/engineering/writing-tools-for-agents)
5. Anthropic. *Harness design for long-running application development*. 24 March 2026. [Source](https://www.anthropic.com/engineering/harness-design-long-running-apps)
6. Anthropic. *Scaling Managed Agents: Decoupling the brain from the hands*. 8 April 2026. [Source](https://www.anthropic.com/engineering/managed-agents)
7. OpenAI. *Rethinking skills and prompts for GPT-6 Astra*. 11 September 2026. [Source](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
8. LangChain. *Graph API overview*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/langgraph/graph-api)
9. LangChain. *Checkpointers*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/langgraph/checkpointers)
10. LangChain. *Functional API overview*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/langgraph/functional-api)
11. LangChain. *Interrupts*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/langgraph/interrupts)
12. LangChain. *Subgraphs*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
13. LangChain. *Backward compatibility*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/langgraph/backward-compatibility)
14. LangChain. *Stores*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/langgraph/stores)
15. LangChain. *Deep Agents overview*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.langchain.com/oss/python/deepagents/overview)
16. OpenAI Agents SDK. *Agent orchestration*. Rolling documentation; accessed 12 September 2026. [Source](https://openai.github.io/openai-agents-python/multi_agent/)
17. OpenAI Agents SDK. *Running agents*. Rolling documentation; accessed 12 September 2026. [Source](https://openai.github.io/openai-agents-python/running_agents/)
18. Temporal. *Temporal Workflow Definition*. Rolling documentation; accessed 12 September 2026. [Source](https://docs.temporal.io/workflow-definition)
19. Kim et al. *Towards a Science of Scaling Agent Systems*. arXiv v1, 9 December 2025; revised v2, 8 April 2026, expands to 260 configurations. [Source](https://arxiv.org/html/2512.08296v1)
20. Cemri et al. *Why Do Multi-Agent LLM Systems Fail?* arXiv v3, 26 October 2025. [Source](https://arxiv.org/html/2503.13657v3)
21. Anthropic. *How we built our multi-agent research system*. 13 June 2025. [Source](https://www.anthropic.com/engineering/multi-agent-research-system)
22. Bertalanič and Fortuna. *The Cost of Consensus: Isolated Self-Correction Prevails Over Unguided Homogeneous Multi-Agent Debate*. arXiv v1, 29 April 2026. [Source](https://arxiv.org/html/2605.00914v1)
23. Anthropic. *Demystifying evals for AI agents*. 9 January 2026. [Source](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
24. Yao et al. *τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains*. arXiv, 17 June 2024. [Source](https://arxiv.org/abs/2406.12045)
25. OpenAI. *Separating signal from noise in coding evaluations*. 8 July 2026. [Source](https://openai.com/index/separating-signal-from-noise-coding-evaluations/)
26. METR. *Task-Completion Time Horizons of Frontier AI Models*. Page last updated 8 May 2026; accessed 12 September 2026. [Source](https://metr.org/time-horizons/)
27. Li et al. *AgentDyn: Are Your Agent Security Defenses Deployable in Real-World Dynamic Environments?* arXiv v3, 7 May 2026. [Source](https://arxiv.org/abs/2602.03117v3)
28. Model Context Protocol. *Security Best Practices*. Versioned 2025-11-25 documentation; accessed 12 September 2026. [Source](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices)
29. Kapoor et al. *AI Agents That Matter*. arXiv, 1 July 2024. [Source](https://arxiv.org/abs/2407.01502)
30. Agrawal et al. *GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning*. arXiv v2, 14 February 2026; ICLR 2026. [Source](https://arxiv.org/abs/2507.19457v2)
31. GEPA project. *optimize_anything: A Universal API for Optimizing any Text Parameter*. 18 February 2026. [Source](https://gepa-ai.github.io/gepa/blog/2026/02/18/introducing-optimize-anything/)
32. Qizheng Zhang et al. *Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models*. arXiv v3, 29 March 2026; ICLR 2026. [Source](https://arxiv.org/html/2510.04618v3)
33. Alex L. Zhang, Tim Kraska, and Omar Khattab. *Recursive Language Models*. arXiv v3, 11 May 2026. [Source](https://arxiv.org/html/2512.24601v3)
34. Zhiyuan He et al. *Agent Lightning v1.0: Towards Harnessed Agentic RL*. arXiv v1, 18 August 2026. [Source](https://arxiv.org/abs/2608.17528)
35. A2A Project. *Agent2Agent Protocol Specification*. Latest release displayed as 1.0.0; accessed 12 September 2026. [Source](https://a2a-protocol.org/latest/specification/)
36. LangChain Academy. *Foundation: Introduction to LangGraph – Python*. Course page; accessed 12 September 2026. [Source](https://academy.langchain.com/courses/intro-to-langgraph)
37. LangChain Academy. *Foundation: Introduction to Agent Observability & Evaluations*. Course page; accessed 12 September 2026. [Source](https://academy.langchain.com/courses/intro-to-langsmith)
38. LangChain Academy. *Foundation: Introduction to Deep Agents*. Course page; accessed 12 September 2026. [Source](https://academy.langchain.com/courses/foundation-introduction-to-deepagents)
