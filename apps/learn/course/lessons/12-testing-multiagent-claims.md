# Lesson 12: Testing Multi-Agent Claims

## What does the comparison actually change?

A multi-agent experiment can change model quality, number of calls, total tokens, context capacity, tool availability, parallelism, and the verifier simultaneously. If the team wins, the experiment establishes the performance of that whole configuration. It does not automatically identify coordination as the cause.

Write the causal question before selecting the baseline. If the question is whether isolated contexts help, keep the model, tools, and total opportunity comparable while varying context partitioning. If the question is whether parallelism meets a latency deadline, a fixed-spend comparison alone is insufficient. If a heterogeneous team uses a stronger coordinator, compare that model's contribution separately.

Ablation removes or changes one mechanism at a time. It is useful but not magical: components can interact. A verifier may help only when several candidates exist, and a supervisor may help only when task decomposition is uncertain. A small factorial experiment can reveal such interactions more clearly than a long sequence of unrelated changes.

## Evidence from current studies

The reviewed scaling study (December 2025 version) reports 180 configurations and substantial task dependence. Its centralized Finance-Agent result improves from 0.349 to 0.631, while tested multi-agent variants degrade on PlanCraft. An April 2026 revision expands the study to 260 configurations across six benchmarks and reports the same direction of results. The research report preserves the relative and absolute denominators and the study's scope. [Study](https://arxiv.org/html/2512.08296v1).

The lesson is not that finance always needs teams or that planning never does. Task decomposition, shared state, model capability, and budget determine the tested regime. A result on a particular benchmark and model family must be reestablished for a different product.

Vendor engineering reports can reveal useful architecture and failures, but often do not offer equal-compute causal comparisons. Read them as hypothesis sources. Ask which variables changed, which tasks were selected, how failures were graded, and whether the simple baseline received comparable engineering effort.

## A fair experimental matrix

Use two task families: independent evidence gathering and sequential state manipulation. Compare a strong single agent, independent candidates with selection, supervisor-workers, and a fixed workflow where applicable. Hold the task split, tool backend, success oracle, and model configuration constant for the first comparison.

Run one experiment with equal maximum spend and another with equal wall-clock deadlines if both constraints matter. Record actual spend, not only the ceiling. A system may use less of its allowed budget. Include coordinator, synthesis, verifier, retry, and failed-worker costs. Count tasks that time out; excluding them can reward a slow system by removing its worst cases.

Choose the primary metric in advance. For evidence tasks, verified claim coverage may be more informative than answer length. For mutation tasks, correct authorized final state matters. Report negative effects separately, especially unauthorized actions and duplicate effects. A gain in average task success does not compensate automatically for a new severe failure mode.

## Measuring communication value

Communication is useful when it changes decisions through valid evidence, resolves dependencies, or prevents conflicting work. Measure those mechanisms. Did a worker discover a source that no other worker found? Did the coordinator remove duplicate work? Did a review detect a seeded defect? Did a message alter an action for a verifiable reason?

A transcript with many messages can look collaborative without producing useful information. Count repeated evidence and unsupported assertions. Compare communication with an equal-budget baseline that gives workers additional independent attempts or a stronger deterministic verifier. This tests whether discussion itself earns its cost.

One useful experiment holds the candidate pool fixed. Generate independent proposals once, then compare majority selection, deterministic verification, and a discussion-based selector over the same pool. This isolates selection more cleanly than regenerating different candidates for each method. It still needs fresh task-level evaluation because the selector can overfit the development pool.

## Correlated errors

Models can share training data, instructions, retrieved sources, and reasoning habits. Heterogeneous providers do not guarantee independent errors. Independent context does not guarantee independent evidence. A team may agree because every member used the same mistaken policy document.

Test common-cause failures deliberately. Give all workers a misleading source and one worker access to contradictory authoritative evidence. Inspect whether the system preserves the dissent and resolves it through provenance, or suppresses it through majority agreement. The correct result depends on evidence quality, not the number of supporters.

The reliability visual demonstrates one mathematical model of shared failures. It is not an empirical estimate of your team. Actual dependence must be measured through repeated outcomes and error categories. Avoid substituting pairwise text similarity for a full model of correlated correctness.

## Worked result interpretation

A team improves success from 70% to 76%, uses 2.5 times the spend, and reduces median latency from 40 to 24 seconds. Its paired uncertainty interval for success difference is −2 to +14 percentage points. A defensible conclusion is that the observed configuration trades higher cost for lower median latency, while the success improvement remains uncertain in this sample.

If the product has a hard 30-second deadline, the latency change may matter even without a proven accuracy gain. If the product runs asynchronously overnight, the extra spend may be unattractive. If p95 latency worsens because occasional workers hang, the median improvement may not meet the service objective. The architecture decision requires the product's actual constraints.

Do not phrase the conclusion as “multi-agent is better.” Name the configuration, task population, budgets, metrics, uncertainty, and decision. That level of specificity makes the finding reusable when conditions change.

## Failure taxonomy as a diagnostic aid

A taxonomy helps organize observations: poor decomposition, lost context, conflicting ownership, stale state, redundant work, failed integration, or weak verification. It does not prove causality. A run labeled coordination failure may actually begin with an ambiguous tool contract. Trace the earliest actionable boundary rather than stopping at a broad label.

MAST's failure categories provide a useful research starting point, with annotation-method limitations described in the research report. [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/html/2503.13657v3). Add domain-specific categories only when they support a different repair or experiment.

## Practice and acceptance

Complete the topology comparison worksheet with the synthetic scheduling results, then design a real-model experiment using the optional adapter contract. Do not claim the synthetic policy measures LLM quality. The answer key includes a result memo that favors a simple workflow and another that justifies bounded workers under a deadline.

You pass when you can identify the confounds in a flattering result and design a comparison that could overturn your preferred architecture. The final decision may be inconclusive; a valid experiment is still progress.
