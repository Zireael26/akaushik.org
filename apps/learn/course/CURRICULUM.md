# Harness Engineering and Multi-Agent Systems

## Course contract

This is an advanced, practice-driven course for an engineer already building AI products and using coding agents. It develops the ability to design an agent system, explain its behavior, measure whether a change helped, recover it after failures, and operate it under real constraints. Expertise means being able to diagnose unfamiliar systems and make defensible trade-offs. There is no credible certificate or universal benchmark for being in the top 1% of AI engineers; this course uses observable engineering and research standards instead.

The default schedule is 24 weeks at 15–20 hours per week: 360–480 hours. The complete edition supplies all 24 written lessons, 24 assignments with worked solutions, 12 module assessments with keys, 12 executable module labs, two capstone reference implementations, 12 interactive models, three computational notebooks, and the research foundation. All teaching materials are ready independently of your pace. The reference implementations use local synthetic environments; learner projects and optional live-model experiments apply the methods to new tasks.

The two project tracks reinforce one another. The development track builds a bounded software-maintenance agent that can inspect a repository, propose a change, run checks, and leave a reviewable result. The product track builds an operations assistant that gathers evidence, proposes an action, receives a decision, and executes an authorized change reliably. Both use the same experiment discipline, trace contract, effect ledger, and evaluation methodology. Existing production repositories can supply sanitized task descriptions; a disposable training repository and synthetic tenant data provide the execution environment.

Python is the reference implementation language because it makes the research and LangGraph work convenient. A few boundary components can be ported to TypeScript to test whether the architecture, rather than library habits, has been learned. This is not a beginner Python, web development, or introductory RAG course. Postgres, Redis, queues, and Kubernetes become useful when the problem warrants them, rather than being prerequisites for the first experiment.

## How teaching works

Every module follows six steps: predict a system's behavior; develop the model behind it; inspect a worked example; implement a small version; inject a meaningful failure; defend an experimental conclusion. In our teaching sessions, I will explain the mechanisms in full, ask you to reason through traces, review your implementation and experiment results, and adjust the next exercise to the misconceptions that remain. Readings support the instruction; they do not replace it.

A normal 18-hour week allocates about 3 hours to instruction and source reading, 7 hours to implementation, 4 hours to experiments and failure analysis, 2 hours to design review, and 2 hours to a written explanation or reproduction note. A 15-hour week trims optional reading and stretch experiments. A 20-hour week adds a carefully chosen extension. Do not compensate for weak measurement by writing more infrastructure.

The default teaching session is a 60–90 minute guided discussion of the written lesson, a worked trace, a 20-minute prediction exercise, a substantial lab, and a review. During implementation, AI coding assistance is allowed. You must still explain every trust boundary, predict the effect of changes before running them, and defend why the measured outcome follows. A generated answer that you cannot explain is unfinished work.

At the end of each module, submit the code diff, the experiment manifest, a short result table, two representative traces, the strongest counterexample to your conclusion, and a one-page decision record. A checkpoint file records completed modules, misconceptions, results, and the next lesson so that instruction can resume without relying on conversational memory.

## What mastery looks like

| Competency | Demonstration required |
| --- | --- |
| Harness design | Implement a bounded model–tool loop, identify all state and authority boundaries, and explain termination and verification. |
| Context and memory | Compare retrieval, full context, compaction, structured memory, and delegation on the same tasks; inspect what information is lost. |
| Runtime correctness | Recover from injected crashes, duplicate messages, stale approvals, and partial tool success without making false exactly-once claims. |
| Orchestration | Select a topology using task dependencies and measured trade-offs; demonstrate a case where extra agents hurt. |
| Evaluation | Produce a held-out, task-level analysis with repeat trials, cost and latency accounting, uncertainty, and calibrated graders. |
| Security | Enforce authority outside model text; demonstrate isolation between tenants, tools, memory, and agent identities. |
| Production engineering | Diagnose a failing run from telemetry, handle backpressure and cancellation, migrate state, and roll back a change. |
| Research judgment | Reproduce a narrow result, report negative findings, and propose an experiment that could falsify the claimed mechanism. |

The course rubric assigns 25 points to task correctness and verification, 20 to runtime and authority correctness, 20 to experimental validity, 15 to cost and latency engineering, 10 to maintainability, and 10 to explanation. A suggested graduation threshold is 85/100 with no unresolved critical authority or duplicate-effect defect in the defined assessment suite. These are instructional standards, not claims that a finite test suite establishes production safety or global percentile rank.

## Curriculum at a glance

| Weeks | Module | Principal artifact |
| --- | --- | --- |
| 1–2 | 1. The agent as a controlled system | Minimal harness and task-based baseline |
| 3–4 | 2. Context, tools, and environment design | Context compiler and tool-contract benchmark |
| 5–6 | 3. Evaluation and causal diagnosis | Repeated-run evaluation workbench |
| 7–8 | 4. LangGraph execution semantics | Stateful graph with explicit reducers and routing |
| 9–10 | 5. Durable actions and human decisions | Crash-safe action workflow and approval ledger |
| 11–12 | 6. Multi-agent architecture | Equal-budget topology comparison |
| 13–14 | 7. Coordination and agent interoperability | Contract-driven heterogeneous worker system |
| 15–16 | 8. Long-horizon work and memory | Resumable development agent and memory ablations |
| 17–18 | 9. Security and adversarial environments | Attack corpus and enforced authority boundaries |
| 19–20 | 10. Production operations and economics | Instrumented service, load model, and incident drill |
| 21–22 | 11. System optimization and research | Reproduction and one controlled novel extension |
| 23–24 | 12. Capstone and engineering defense | Two completed systems and evidence portfolio |

The dependency structure matters. Evaluations precede complicated orchestration. Runtime semantics precede durable effects. Single-agent baselines precede agent teams. Frontier optimization follows trustworthy feedback. Research reading can begin early, but implementing every fashionable technique at once prevents attribution.

## The theoretical spine

The course develops enough theory to explain system behavior and design experiments. These topics are integrated into the practical modules; they are not a detached mathematics prerequisite.

| Lens | Concepts to learn | Engineering use |
| --- | --- | --- |
| Decision theory | Partial observability, belief state, value of information, expected utility, constrained decisions | Decide when to observe, act, delegate, ask, or stop. |
| Control and planning | State transitions, feedback, open-loop versus closed-loop plans, receding-horizon replanning, terminal conditions | Explain why a plan must respond to new tool observations. |
| Information and context | Lossy compression, retrieval precision/recall, evidence coverage, provenance, cache behavior | Identify what a summary discards and what a context policy must preserve. |
| Distributed systems | Atomicity, idempotency, delivery semantics, leases, fencing, replay, causal ordering | Handle concurrent workers and uncertain external outcomes. |
| Statistics and experimental design | Dependence, paired estimates, confidence intervals, calibration, selection bias, multiple comparisons | Distinguish an improvement from noise, leakage, and extra compute. |
| Optimization and learning | Search, exploration/exploitation, reward design, credit assignment, policy shift, off-policy data | Evaluate adaptive harnesses and understand when training is warranted. |

Three derivations anchor the practical work. First, calculate end-to-end reliability under explicit stage and retry assumptions, then identify how common-cause failure invalidates independence. Second, derive the critical path and theoretical parallel speedup of a work graph before adding worker calls. Third, formulate a deployment decision using task utility subject to a cost, latency, and authority constraint. There is no universal numerical weighting: choose it from the product's actual failure costs and service requirements.

At the expert level, be able to distinguish model confidence from calibrated probability, agreement from independent evidence, a retrieved document from a supported claim, and a passed test from a complete specification. These distinctions help explain why voting, self-critique, more context, and more calls sometimes improve outcomes and sometimes preserve the same underlying error.

## Module 1: The agent as a controlled system

**Weeks 1–2. Essential question: what, precisely, makes a model useful as an acting system?**

We distinguish the model policy, the harness, the environment, and the evaluator. A model proposes a next action from a partial observation. The harness constructs that observation, restricts available actions, validates the proposal, executes or denies it, records the result, and decides whether to continue. A workflow fixes some of the transition structure; an agent chooses some actions at runtime. These concepts overlap rather than forming a binary taxonomy.

The mathematical vocabulary includes trajectories, partial observability, a state transition function, admissible action sets, budgets, termination predicates, and outcome utility. We will use probability only where it clarifies decisions. A model's confident narrative is an observation, not proof of an external state transition. The same model can perform very differently under a different tool interface or verifier.

**Week 1.** Read the first lesson and run the harness starter lab. Draw the state machine for a repository issue that ends in either a verified patch, a request for information, a bounded failure, or a handoff. Define a stable task ID, run ID, tool-call ID, effect ID, and trace schema. Implement malformed-tool-response and false-completion cases. Establish a deterministic workflow baseline before introducing model choice.

**Week 2.** Replace the scripted policy with an adapter to an available model in your own environment. Preserve the exact input/output contract and record the resolved model identifier and API behavior. Evaluate at least 20 small development or operations tasks for debugging, with at least three runs per task where affordable. This pilot discovers failure classes; it is not adequate evidence for small performance differences. Group failures by observation, decision, execution, verification, and termination.

**Deliverable and gate.** Produce a minimal harness, task fixtures, one execution trace, and an architectural decision explaining which steps are deterministic. Pass when the verifier rejects an unsupported success claim, a denied action never reaches the executor, and exhaustion leads to a truthful terminal result. Explain how a crash changes the analysis; you do not need durable recovery yet.

**Visual and reading.** Experiment 1 shows the loop step by step. Read the OpenAI agent-loop engineering source and Anthropic long-running harness sources in the research notes. The stretch task is to model an ambiguous user request as a missing observation rather than solving it with a larger prompt.

## Module 2: Context, tools, and environment design

**Weeks 3–4. Essential question: what information and affordances does the next action require?**

Context construction is a data pipeline with selection, provenance, trust level, formatting, versioning, and a token budget. Separate governing instructions, current goals, environment facts, tool schemas, retrieved evidence, recent observations, and memory. Keep a durable event log distinct from the subset visible to the model. Compaction is a lossy transformation; a useful summary must preserve unresolved obligations and pointers to inspectable evidence.

Tool design includes typed inputs, preconditions, meaningful error classes, bounded output, pagination, timestamps, authorization scope, and mutation semantics. A model-friendly interface can expose a useful domain action instead of a raw implementation API, provided the interface still exposes the evidence and controls needed to reason correctly. File search, repository maps, tests, lint output, and reproducible environment setup are part of the harness's observation design.

**Week 3.** Implement a context compiler with a clear priority order and reserved output budget. Compare full history, a recent-message window, structured compaction, and retrieval of evidence by ID. Test cases where a detail is irrelevant, relevant only later, contradicted by a newer observation, or malicious. Measure evidence retention and task outcomes separately. Do not infer quality from the percentage of a context window used.

**Week 4.** Compare two tool designs for the same operation: a low-level collection of calls and a bounded domain-level operation. Add precise validation failures and recovery hints without granting new authority. Introduce a small repository instruction file that routes the agent toward more specific documentation. Remove an instruction, a tool, and an automatically loaded document in separate ablations. Track quality, wrong-tool choices, tokens, and latency.

**Deliverable and gate.** Produce the compiler, six tool contracts, an evidence-provenance schema, and the ablation report. Pass when a tool result containing an instruction is treated as data, an old memory can be superseded, and every final factual claim points to evidence available at decision time. Explain what cannot be compressed safely.

**Visual and reading.** Experiment 2 is a budget allocator, deliberately without a fabricated quality score. Read the context-engineering, skills, and tool-engineering references. Stretch: compare code execution over a large structured result with serial retrieval of individual records.

## Module 3: Evaluation and causal diagnosis

**Weeks 5–6. Essential question: how do we know that a harness change improved the system?**

Define task success against an external outcome whenever possible: the correct record changed, an acceptable patch passed the relevant checks, or the answer's claims are supported. Process checks capture restrictions and recovery behavior; they should not require one particular trace if several valid paths exist. A grader is itself a system with errors. Separate deterministic assertions, model-based judgments, and human adjudication.

We develop pass@k, repeated-run reliability, task-level bootstrap intervals, paired comparisons, stratified error analysis, practical effect size, and cost per verified success. Repeated attempts on one task are not interchangeable with independent tasks. Selecting a winner from many experiments and reporting its development score exaggerates confidence. A locked holdout, a recorded experimental budget, and one planned final comparison address different parts of this problem.

**Week 5.** Expand the pilot into roughly 60–100 tasks if feasible, deliberately including ambiguity, failed tools, stale state, denied actions, and recovery. Partition by task or repository family before experimentation; near-duplicate tasks stay together. Keep a small development set for debugging and a separately controlled holdout. Use repeat trials to characterize stochastic variation. The sample size is a starting plan, not a guarantee of statistical power.

**Week 6.** Run the metrics starter lab, then evaluate a single meaningful harness change with paired tasks and matched budgets. Bootstrap independent tasks, preserving within-task repeats; use repository or scenario clusters instead when they are the independent sampling units. Report the uncertainty interval, cost of failures, retry counts, all latency samples, and the outcome on difficult strata. Calibrate a model grader on a human-labeled subset that includes plausible but wrong outputs, and inspect disagreement rather than averaging it away.

**Deliverable and gate.** Produce an experiment manifest, dataset card, grader specification, confidence interval, failure taxonomy, and a decision. Pass if someone else can reconstruct the denominator of every metric and if the analysis can determine whether an apparent gain survives control of its confounds. A well-supported negative result passes.

**Visual and reading.** Experiment 5 exposes the difference between finding one success and succeeding consistently. Read the agent evaluation guidance, τ-bench/τ²-bench, benchmark-audit, and METR methodology sources. Stretch: derive a power or precision target from a minimum worthwhile improvement before collecting more runs.

## Module 4: LangGraph execution semantics

**Weeks 7–8. Essential question: how does a graph execution model change the way we reason about an agent?**

We translate the minimal harness into LangGraph while keeping the domain contracts and evaluation cases. Learn state schemas, nodes, edges, conditional routing, state updates, reducers, supersteps, parallel branches, subgraphs, and execution configuration. A message transcript is one possible state component, not the entire application state. Reducers determine how concurrent updates combine; choosing an append reducer does not make duplication harmless.

Study StateGraph, START/END, Send for dynamic dispatch, and Command for state update plus routing or resumption. Treat official documentation as the source of truth for the installed release. A routing command and a static edge can both affect execution; the course includes an explicit prediction exercise for this trap. A deterministic test of graph behavior is more useful than a screenshot of a graph that looks plausible.

**Week 7.** Build a retrieve–propose–verify graph and express why each component is a node. Use typed domain state, a separate transcript, and a terminal status enum. Write down the expected execution order and merge outcome before running a fan-out/fan-in example. Force two branches to write the same field and inspect the result. Use an appropriate reducer or redesign state ownership.

**Week 8.** Add bounded dynamic workers, a subgraph, conditional termination, and cancellation behavior. Compare a static workflow with a supervisor-controlled graph on identical tasks. Test an empty worker list, duplicate task IDs, a failed branch, and an out-of-order worker result. Preserve evidence provenance during aggregation. Use an in-memory checkpointer only for local process-scoped demonstrations; do not describe it as crash-durable storage.

**Deliverable and gate.** Produce the graph, predicted-versus-observed execution traces, and a version manifest. Pass when state ownership is explicit, duplicate worker output cannot silently alter the result, and the learner can explain where a new step is scheduled and when merged state becomes visible.

**Visual and reading.** Use Experiment 3 for topology and scheduling intuition. Read the official graph API, persistence, and subgraph documentation. LangChain Academy's Introduction to LangGraph is an optional implementation companion, not the complete course. Stretch: port one graph boundary to TypeScript and document semantic differences.

## Module 5: Durable actions and human decisions

**Weeks 9–10. Essential question: what actually happens if the process dies between an external effect and its checkpoint?**

Separate logical intent, execution attempts, recorded results, and effects in external systems. A checkpoint of graph state is not a transaction across the graph runtime and every tool. Requests may be repeated after timeouts or recovery. Use a stable business operation key where the target system supports idempotency; otherwise use explicit reconciliation and clearly state the remaining ambiguity. A local deduplication table alone cannot make an arbitrary remote effect exactly once.

An approval is an authorization artifact bound to an actor, tenant, operation, normalized payload, policy version, and expiry or revocation condition. The human's decision authorizes a particular action, not whatever payload happens to be present after a resume. Interrupts, resumed node execution, side effects before interrupts, and changed state between approval and action are central cases.

**Week 9.** Run the SQLite crash/retry lab. Reproduce a duplicate effect and repair the modeled transactional case. Then draw the remote API ambiguity window that this repair does not solve. Add a persistent checkpointer to the LangGraph system, kill the worker at selected points, and recover by run ID. Exercise provider timeouts, partial results, and exhausted retries.

**Week 10.** Implement approve/reject/revise flows with a pending intent record. Bind approval to a payload digest and reject modified or stale intents. Move side effects out of replay-prone pre-approval code, or give them independently safe semantics. Practice re-entrant handlers, optimistic concurrency, leases with fencing where appropriate, cancellation, and compensation. Compare the responsibilities of LangGraph and a durable workflow runtime such as Temporal.

**Deliverable and gate.** Produce a failure-state matrix and executable recovery scenarios. Pass when duplicate deliveries do not duplicate the protected effect under the stated assumptions; changed payloads cannot reuse an approval; and unknown remote outcomes are recorded as unknown pending reconciliation, rather than fabricated success or failure.

**Visual and reading.** Experiment 4 traces the crash window and approval sequence. Read current LangGraph fault-tolerance and interrupt documentation and Temporal's workflow/activity semantics. Stretch: demonstrate an outbox/inbox pattern and explicitly delimit its transaction boundaries.

## Module 6: Multi-agent architecture

**Weeks 11–12. Essential question: what useful independence does another agent create?**

We distinguish extra calls, parallel tool execution, multiple isolated contexts, multiple policies, and a true coordination problem. Study supervisor–worker, parallel independent proposals, routing to specialists, pipelines, blackboard state, debate, and decentralized coordination. Use a task dependency graph to expose available parallelism and shared resources. More context windows can increase usable evidence capacity but also increase duplication, integration work, and disagreement.

The central experiment controls the comparison budget. Hold the task set, environment, model family where possible, success criteria, and maximum spend constant. Compare a strong single agent given equivalent total opportunity with a team. Also report a latency-constrained comparison, because an equal-spend result does not answer a latency question. Heterogeneous teams introduce a model-quality confound unless explicitly controlled.

**Week 11.** Build single-agent, supervisor–worker, and parallel-propose–verify variants. Use one decomposable evidence task and one tightly sequential shared-state task. Give each worker a contract containing goal, scope, input evidence, allowed tools, budget, output schema, and completion condition. Do not broadcast the entire parent transcript by default. Instrument worker creation, duplicate work, supervisor calls, and synthesis losses.

**Week 12.** Run the variants under a shared cost ceiling and then a shared wall-clock ceiling. Vary fan-out and the integration strategy. Add a failure where multiple workers confidently repeat the same bad evidence. Identify a regime where additional workers help and a regime where they hurt. Evaluate whether a deterministic reducer or an independent verifier replaces an extra conversational agent.

**Deliverable and gate.** Produce a topology decision record with quality, variance, cost, latency, and failure analysis. Pass when the conclusion distinguishes task decomposition from raw additional compute, and the single-agent baseline is credible. There is no requirement to make the team win.

**Visual and reading.** Experiment 3 shows explicit call and critical-path assumptions. Read the multi-agent scaling study, Anthropic's research-system report, and the failure-taxonomy paper. Stretch: compare a homogeneous team with a heterogeneous team while measuring the capability and cost differences separately.

## Module 7: Coordination and agent interoperability

**Weeks 13–14. Essential question: how can separately executing agents cooperate without relying on a conversation to keep the system correct?**

Design typed work requests, artifacts, statuses, evidence references, and cancellation signals. Separate durable shared facts from private scratch context. Assign ownership to state and files. Every task has a stable identifier, a responsible worker, a deadline or budget, a completion contract, and a reconciliation path. Workers report observations; the coordinator checks that the desired artifact and invariants exist.

MCP and A2A solve different interoperability problems. Study tool/resource access and agent-to-agent task/artifact coordination using the specifications pinned for the lesson. Protocol compatibility does not supply authorization, trust, or a good scheduling policy. Long-running tasks also need backpressure, queueing, retries, version negotiation, cancellation, and explicit handling of unknown status.

**Week 13.** Split the maintenance workflow across isolated workspaces. Have one worker inspect, one implement a bounded patch, and one independently verify the result, only where the dependency structure permits. Merge artifacts by explicit revision or content identity. Introduce conflicting edits, a late worker, a duplicate completion message, and a coordinator restart. The integration step has one clear owner.

**Week 14.** Inspect the supplied JSON-RPC tool-contract teaching subset and design the missing lifecycle and authentication boundaries. As an optional deployment extension, expose a read-only tool through the official MCP SDK and sketch or implement an A2A task boundary. Record supported versions and capabilities. Demonstrate that discovering a capability does not authorize its use. Connect two different model adapters through the same work contract. Add a cancellation path that stops future work and documents effects already committed.

**Deliverable and gate.** Produce protocol contracts, ownership rules, a concurrency limit, and recovery traces. Pass if a worker cannot expand its authority by asking another worker; a late or duplicate result cannot overwrite a newer accepted artifact; and cancellation has defined semantics.

**Visual and reading.** The topology explorer supplies the comparison model; the actual service traces supply evidence. Read current MCP security guidance, A2A versioning/security sections, and the multi-agent failure taxonomy. Stretch: implement a capability-bound artifact handoff with provenance across model providers.

## Module 8: Long-horizon work and memory

**Weeks 15–16. Essential question: what must survive when context, workers, and assumptions change?**

Study durable plans, explicit work queues, artifact-based handoffs, environment restoration, progress evidence, resumable verification, and completion criteria. Distinguish episodic history, semantic knowledge, procedural memory, working context, and authoritative business state. A memory item needs a source, scope, version or timestamp, relevance criteria, and a deletion or invalidation rule. Memory that is merely persistent can preserve mistakes as efficiently as useful knowledge.

Repository harness design includes discoverable documentation, constrained tasks, reproducible setup, executable invariants, targeted tests, reviewable changes, and a stable integration process. Long-running engineering should be evaluated by accepted artifacts and preserved intent. A progress note saying a feature works cannot substitute for an observable check.

**Week 15.** Extend the development agent across several short sessions with deliberate context resets. Persist task state and evidence pointers, reconstruct the environment, and resume from completed artifacts. Compare transcript compaction, structured work records, and narrow subagent contexts. Ask a fresh worker to continue without the previous conversation and measure what it reconstructs incorrectly.

**Week 16.** Implement memory write, retrieval, contradiction, expiry, and deletion policies. Compare no persistent memory with curated memory on repeated but nonidentical tasks. Keep evaluation tenants isolated and prevent test answers from entering later runs. Study ACE and recursive language models as alternative context strategies, then reproduce a small long-context task with explicit recursion and call limits.

**Deliverable and gate.** Produce the resumable agent, memory schema, provenance rules, and ablations. Pass when a poisoned or outdated memory can be traced and removed; fresh workers recover the remaining obligations; and completion is demonstrated through artifacts and independent checks.

**Visual and reading.** Experiments 1 and 2 expose state/context separation. Read the long-running harness articles, ACE, and the versioned RLM paper. Stretch: compare dense aggregation with sparse retrieval to explain why one context strategy does not dominate every task.

## Module 9: Security and adversarial environments

**Weeks 17–18. Essential question: how do we preserve intended authority when the model consumes hostile content?**

Threat-model users, retrieved pages, documents, tool results, repository files, packages, worker messages, and persisted memory. Distinguish untrusted instructions from governing authority, but do not mistake textual delimiters for an access-control boundary. The executor enforces allowed actions and resource scopes. Sandboxing contains execution; it does not by itself decide whether a legitimate tool call is authorized for this user and task.

Study capability scoping, per-tenant retrieval filtering, secret isolation, egress control, filesystem boundaries, tool confirmation semantics, audit trails, and agent-mediated confused-deputy problems. Measure both attack success and legitimate task success. A defense that blocks every task can look perfect on an attack-only metric.

**Week 17.** Build a local attack corpus containing tool-result injection, repository instruction poisoning, cross-tenant retrieval attempts, fabricated approvals, and malicious worker handoffs. Use synthetic secrets and inert targets. Add negative controls to distinguish a model following malicious content from an executor that improperly grants authority.

**Week 18.** Enforce authorization in the tool executor, separate read and mutation capabilities, bind operations to tenant and resource scope, and keep secrets out of general context. Repeat the corpus after defense changes, report utility loss, and add adaptive variants rather than testing only memorized strings. Use adversarial traces to identify the earliest boundary that should have stopped each attack.

**Deliverable and gate.** Produce a threat model, attack/utility report, and enforcement tests. Pass when the unauthorized effect is blocked outside the model, evidence remains inspectable, and the limitations of the attack coverage are stated. Passing this course suite does not establish general prompt-injection resistance.

**Visual and reading.** Use the loop experiment to locate enforcement before execution. Read AgentDojo, AgentDyn, and MCP security guidance. Stretch: design an independent policy-decision service with a narrow contract and test stale authorization.

## Module 10: Production operations and economics

**Weeks 19–20. Essential question: what makes this system observable, affordable, and recoverable under real demand?**

Instrument the business task, run, graph step, model request, tool call, worker handoff, verification, and external effect. Correlate them by stable IDs. Record model/configuration versions and prompt/template hashes where useful, while controlling access to sensitive inputs and traces. A trace is an operational artifact; it is not a window into all internal model computation.

Learn service objectives, queueing and backpressure, concurrency budgets, rate limits, cancellation, retry amplification, circuit breakers, streaming semantics, cache correctness, and multi-tenant quotas. Cost includes failed runs, retries, orchestration, evaluation, and environment execution. Cost per verified success is total spend divided by verified successes over the same population; if there are no successes, report it as undefined or infinite with the denominator shown.

**Week 19.** Deploy a bounded version into a development environment using persistent storage and a task queue where necessary. Record p50 and p95 latency with sample counts, error categories, and per-tenant spend. Run a small workload with slow tools and provider throttling. Make the system reject, queue, or degrade predictably rather than spawning unlimited workers.

**Week 20.** Perform an incident drill: a tool schema changes, a model update changes behavior, a checkpoint schema evolves, or a worker pool is interrupted. Restore an old run, migrate compatible state, and explain the policy for incompatible state. Test rollback and the treatment of in-flight tasks. Use the traces to identify whether a latency regression is in inference, tools, queueing, or coordination.

**Deliverable and gate.** Produce a dashboard specification, actual trace examples, cost ledger, runbook, and incident report. Pass when a teammate can follow one task across services, explain its final state, and stop runaway spend without corrupting committed actions.

**Visual and reading.** The topology experiment connects critical path and coordination overhead; actual load results replace its illustrative assumptions. Read runtime observability and persistence sources. Stretch: compare routing to a cheaper model with selective escalation, using a held-out acceptance test rather than model self-confidence alone.

## Module 11: System optimization and research

**Weeks 21–22. Essential question: how do we improve a compound agent system without teaching it to exploit our measurement?**

Study inference-time search, best-of-N with verifiers, adaptive stopping, model routing, prompt and tool optimization, memory adaptation, and post-training. Search over harness policies changes the system under evaluation, even when model weights stay fixed. Include candidate generation cost, failed candidates, selection bias, and verifier fallibility. Treat automated harness edits as proposed code changes that must pass isolated checks and held-out evaluation.

Use GEPA, including its 2026 optimize_anything interface, as a concrete example of feedback-driven program/prompt optimization, ACE for context adaptation, RLMs for programmatic context decomposition, and harnessed agentic RL for the training/deployment boundary. Read enough reinforcement learning to understand trajectories, rewards, credit assignment, distribution shift, and reward hacking. Training a frontier model is outside the core course; designing a valid small experiment is within scope.

**Week 21.** Reproduce one narrow claim on a manageable task family: structured memory versus repeated rewriting; reflective optimization versus a fixed prompt; recursive decomposition versus compaction; or adaptive worker count versus fixed fan-out. Pin the source version, document deviations, and hold out task families where possible. A reproduction may target a mechanism rather than published absolute scores.

**Week 22.** Propose one original extension with a falsifiable hypothesis and fixed budget. Choose one variable, such as evidence-aware worker stopping or memory writes conditioned on independently verified outcomes. Record why it might fail. Evaluate only after freezing the design and grader. If results are inconclusive, calculate what additional evidence would resolve the uncertainty.

**Deliverable and gate.** Produce a concise research report with hypothesis, prior work, setup, differences from the source, uncertainty, cost, negative results, and reproducibility instructions. Pass if the conclusion survives a skeptical review and the claim does not exceed the experiment.

**Visual and reading.** Experiment 5 provides only a probability model; your research must measure actual dependence. Read GEPA, ACE, RLM, and the August 2026 Agent Lightning v1.0 paper. Stretch: implement a tiny trainable policy or study credit assignment in traces without committing to expensive model training.

## Module 12: Capstone and engineering defense

**Weeks 23–24. Essential question: can you explain and defend the whole system?**

Complete the two systems developed throughout the course. The development agent must take a bounded issue in a disposable repository through inspection, patch generation, verification, and a reviewable artifact. The product assistant must resolve an evidence-backed operational task through a durable, authorized workflow. They share a testable foundation but may use different orchestration topologies. Choosing the same architecture for both requires evidence.

**Week 23.** Freeze a candidate configuration and evaluation protocol. Run the locked holdout, then a separate adversarial and failure-injection suite. Compare with the initial baseline and the strongest simple alternative. Produce the cost–quality–latency trade-off rather than selecting only the most flattering metric. Inspect all major regressions and a sample of apparent successes.

**Week 24.** Present an architecture walkthrough, a live recovery demonstration, a failed-run diagnosis, and a defense of the experimental conclusion. Explain what you would remove if the next model became substantially more capable. Explain how you would migrate to a different framework without losing the domain contracts, evidence, or effect history. Propose the next high-value experiment and identify what remains unknown.

**Portfolio.** Include two repositories or clearly separated project directories, evaluation datasets with appropriate provenance, reproducible manifests, six strong design decisions, a security report, an incident report, a research reproduction, and a short technical article. Public release is optional and should use only material you are entitled to share. Portfolio quality comes from inspectable evidence and judgment, not agent count or framework count.

**Final gate.** The reviewer introduces a new failure scenario and asks you to predict the result before execution. You must locate the relevant state and authority boundary, implement or explain a correction, and show how to verify it without overfitting the original case. This transfer test is the course's most important assessment.

## Projects and acceptance contracts

### Development agent

Use a small service with a real test suite, local data, and a handful of intentionally seeded defects. Tasks include fixing an API validation error, changing a persistence invariant, tracing a race, and updating a bounded feature across layers. Begin with the six supplied seeded defects and their positive/negative controls. For a live-model research extension, expand to about 20 distinct debugging tasks, then partition by family for evaluation. Tests are not automatically sufficient: include behavioral assertions that capture the requested outcome, unchanged invariants, and incomplete-but-test-passing patches.

The final task record includes the original request, repository revision, permitted files and tools, plan or work queue, artifact revision, verification evidence, known limitations, and terminal status. Independent verification must inspect the produced artifact and the environment. It cannot rely on the implementing worker's statement that checks passed. Parallel workers use isolated workspaces and a single integration owner.

### Product operations assistant

Use a synthetic multi-tenant operations domain, such as support-case resolution or inventory exceptions. A task might require retrieving order evidence, identifying a permitted remedy, presenting an exact proposed change, obtaining a decision, applying it once under modeled assumptions, and returning a verifiable result. Start with read-only actions and a deterministic tool backend. Introduce mutation, concurrency, and approvals as the relevant modules arrive.

The final system records intent, authorization, effect attempts, observed results, and reconciliation status separately. The task grader reads the authoritative final state and the prohibited-effect ledger. A correct explanation with a wrong external change fails. A correct external change made without required authority also fails. The system can legitimately finish as needs-information, denied, cancelled, or unknown-pending-reconciliation; success is not the only honest outcome.

## Experiment discipline

Each experiment records: hypothesis; intervention; controlled variables; task population and splits; exact model and harness versions; tool/environment versions; concurrency and budget limits; seeds where applicable; grader version; primary metric; secondary metrics; stopping rule; and known exclusions. Seeds aid reproducibility but do not guarantee deterministic behavior from external model providers.

Every result table includes number of independent tasks, attempts per task, total attempts, successes, spend across all attempts, and wall-clock measurement boundaries. If comparing two systems, use the same tasks and preserve pairing during analysis. Bootstrap independent tasks rather than individual trace events; where related tasks share a repository or scenario, resample the independent clusters. Keep selection data separate from final evaluation data. Do not repeatedly peek at the holdout and still call it untouched.

When a result improves, inspect the mechanism. Did the worker actually use independent evidence? Did the verifier reject bad candidates? Did a tool description remove ambiguity? Did a larger budget explain the gain? When a result worsens, distinguish a faulty implementation from a valid negative finding. Both teach useful lessons, but they support different conclusions.

## Reading strategy and source refresh

The companion research notes organize sources by what they establish and what they do not. Read one mechanism source and one skeptical or limiting source for each major topic. Official Academy materials are useful for API practice. Papers are useful for testable ideas. Engineering reports reveal system choices but often do not isolate causality. Documentation establishes behavior of particular versions, not comparative superiority.

Before a framework-intensive module, recheck the official docs and installed release, record dependency versions, and run a small contract test. Before a research module, check whether the paper has a newer version, a correction, or an independent reproduction. Before a model comparison, resolve the actual model snapshot and tool availability. The course's stable core is the method of reasoning; APIs and frontier results are refreshed at the point of use.

A monthly reading review can ask four questions: what new result changes an architectural decision; what older scaffolding should now be ablated; what benchmark or grader has become less credible; and what capability now makes an earlier experiment feasible. This is a study habit, not a scheduled automation.

## Start here

Read `lessons/01-agent-system.md` and run `python labs/run_lab.py 1` from the package root. The first lab requires no model key or paid service. Open `visuals/harness-experiments.html` or the complete offline reader in a browser and step through the false-completion and crash cases. The simulated policies make control flow inspectable; their outputs are not evidence about a real LLM's capability.

Your first submission is deliberately small: define one task from a product you understand, its authoritative success condition, three ways an agent could falsely claim success, and the state that must survive a restart. Then bring the first lab trace. We will use that to begin the first teaching session and calibrate the depth of the next one.
