# Quick Reference and Glossary

## Diagnose by boundary

| Observation | First boundary to inspect | Evidence to collect |
| --- | --- | --- |
| Fluent false success | Outcome contract and verifier | Initial/final state, effect history, acceptance result |
| Repeated external effect | Operation identity and service semantics | Stable key, payload hash, commit record, retry trace |
| Wrong-tenant result | Trusted identity and resource authorization | Principal, scope, lookup predicate, denied/allowed access |
| Worker output disappears | Reducer and join contract | Expected IDs, returned revision, conflicting updates |
| Resume repeats work | Checkpoint and node restart | Thread ID, checkpoint version, replayed node, effect receipt |
| Memory makes quality worse | Write gate, provenance, retrieval | Source, validity, playbook version, ablation |
| Team looks better but costs more | Experimental design | Matched tasks, all calls, coordinator/verifier changes |
| Model calls are fast but task is slow | Queueing and critical path | Queue wait, fan-out, straggler, retry, synthesis |
| Optimizer wins only on development | Selection and leakage | Candidate lineage, split families, holdout exposure |

## Useful equations and their assumptions

- Serial necessary independent stages: P(success)=product of stage probabilities. Correlation, recovery, and heterogeneous stages change the model.
- At least one success in k independent attempts at fixed p: 1-(1-p)^k. Every attempt succeeds: p^k. Neither solves candidate selection.
- Finite-sample pass@k: 1-C(n-c,k)/C(n,k). Finite-sample pass^k: C(c,k)/C(n,k), for k≤n and c observed successes.
- Input budget: window minus reserved output and any provider/runtime overhead. Required context must fit before optional admission.
- Critical path: sum of dependent durations along the longest path; total work alone does not determine latency.
- Amdahl speedup: 1/(f+(1-f)/n) where f is the serial fraction and the remaining 1-f parallelizes perfectly across n workers. Communication and imbalance reduce realized gains.
- Cost per verified success: total included spend divided by verified successes. Undefined if successes are zero.
- Paired effect: mean over tasks of candidate outcome minus baseline outcome. Resample the unit that is plausibly independent.
- Precision: TP/(TP+FP). Recall: TP/(TP+FN). Report undefined denominators explicitly.
- Simple optimization break-even: upfront optimization cost divided by per-task savings, when savings are positive and other effects are ignored.
- Value of an extra action: expected utility after the action minus utility of stopping, including its resource and risk cost. Hard constraints remain mandatory.

## Glossary

| Term | Working meaning |
| --- | --- |
| Harness | Executable system around a model: context, control, tools, authority, state, recovery, stopping, and feedback. |
| Agent | A system in which model output helps choose actions over observations; autonomy is bounded by the runtime. |
| Workflow | Explicit control structure whose transitions and dependencies are primarily specified in code. |
| State | Durable or authoritative facts needed to continue the task; not identical to the current prompt. |
| Context | The serialized observation available for one model invocation. |
| Belief | An uncertain estimate about hidden state; it must not silently replace an authoritative observation. |
| Task contract | Objective, allowed actions, constraints, outcome predicate, terminal states, and evidence requirements. |
| Task ID | Identity of the logical unit of work across attempts. |
| Attempt ID | Identity of one execution attempt, including retries. |
| Operation ID | Stable identity of a logical external effect, preserved across delivery retries. |
| Artifact ID/hash | Identity of a produced result or its exact content; neither proves correctness by itself. |
| Reducer | Function that combines concurrent state updates under an explicit conflict policy. |
| Superstep | A graph execution stage in which scheduled nodes operate and their updates are combined. |
| Join/barrier | Boundary that waits for required branches before integration. |
| Checkpoint | Persisted execution state supporting recovery; not a transaction with every external service. |
| Replay | Reexecution from recorded state; model outputs and external effects require separate handling. |
| Idempotency | Repeated application has the same intended effect as one application under a stated contract. |
| Deduplication | Detecting repeated logical work or messages; scope and retention matter. |
| Outbox | Transactionally recorded intent to publish an event after the local business commit. |
| Inbox | Consumer record used to identify already processed events within a defined boundary. |
| Reconciliation | Querying authoritative state to resolve an uncertain outcome. |
| Compensation | A new action intended to offset a prior effect; not necessarily a perfect inverse. |
| Lease | Time-bounded execution ownership; expiry does not guarantee the old worker stopped. |
| Fencing token | Monotonically changing ownership version checked by the accepting service. |
| Capability | A bounded grant of authority to perform specified actions on specified resources. |
| Approval binding | Associating a trusted decision with exact action, principal, scope, version, and lifetime. |
| Provenance | Recorded origin and transformations of evidence or artifacts. |
| Prompt injection | Untrusted content attempting to redirect agent behavior or cross an authority boundary. |
| Context compaction | Lossy or structured transformation of history into a smaller observation. |
| Memory write gate | Policy deciding what generated or observed information may persist and influence future tasks. |
| Tombstone | Deletion marker preventing a record from being treated as live or silently resurrected. |
| MCP | Protocol family for exposing tools and context capabilities; conformance is separate from task correctness. |
| A2A | Protocol family for interaction between agent services, tasks, and artifacts. |
| Oracle/verifier | Mechanism that evaluates a specified property or outcome using relevant evidence. |
| Grader calibration | Comparing grader judgments with trusted labels and counterexamples. |
| Ablation | Controlled removal or alteration of a mechanism to investigate its contribution. |
| Confound | A simultaneously changed factor that prevents clean attribution to the intended intervention. |
| Paired comparison | Comparing systems on the same task instances to reduce unrelated variation. |
| Cluster bootstrap | Resampling groups together when observations within a group are dependent. |
| Holdout | Data withheld from candidate development/selection for a defined evaluation exposure. |
| Candidate lineage | Recoverable history of configurations, parents, proposals, evaluations, and promotions. |
| Reflection | A generated diagnosis or improvement proposal; it requires validation. |
| Credit assignment | Estimating which actions in a trajectory contributed to an outcome or reward. |
| Reward hacking | Optimizing the measurable reward while violating the intended task objective. |
| Backpressure | Restricting admission or production when downstream capacity is insufficient. |
| SLO | Explicit service objective over a defined population, metric, and time window. |
| Drift | Change in workload, environment, or behavior that can invalidate prior performance estimates. |

## Source and implementation version discipline

The research registry is in `RESEARCH.md`. Preserve exact paper versions, documentation access date, model identifier, harness commit, prompt/tool schemas, dependency lock, dataset split, and evaluator version. A rolling documentation URL is not a publication date. A local passing test is not a benchmark result. A vendor report is a hypothesis source unless its design supports the causal claim being made.
