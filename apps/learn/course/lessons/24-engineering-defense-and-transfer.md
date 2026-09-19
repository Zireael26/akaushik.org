# Lesson 24: Engineering Defense, Research Judgment, and Transfer

## Expertise is demonstrated judgment

The course's goal is the ability to build, diagnose, compare, and defend agent systems under changing conditions. No course can certify that someone belongs to a literal global top percentile. A useful standard is observable competence: another engineer can inspect your work, reproduce its evidence, and trust your explanation of its limits.

You should be able to identify whether a failure began in the task contract, context, model proposal, tool interface, authority boundary, state transition, recovery, or evaluator. The most valuable repair may be a clearer tool or stronger acceptance check rather than a larger model or another agent.

The final defense uses unfamiliar variations of familiar mechanisms. It tests transfer, not recall of one graph API. Framework details can change; the distinction between a proposed action and a verified effect remains.

## Defense case 1: the persuasive false success

A support agent reports that an account change succeeded. Its trace contains a successful tool response, but the authoritative database shows no change. The tool response actually acknowledged a queued job.

The correct diagnosis is a mismatch between acknowledgment and outcome semantics. Add a job identity and a terminal-state observation or callback. The task remains pending until the outcome criterion is met. A more persuasive final response or another judge of the same text cannot establish the missing state transition.

Your repair must preserve timeout behavior. If the job remains pending at the deadline, return the contract's pending or incomplete status and a retrieval mechanism. Do not turn uncertainty into a false binary success.

## Defense case 2: the faster team with worse evidence

A four-worker system cuts median latency but produces duplicate evidence and loses a dissenting authoritative source. A single agent is slower but better calibrated. The team also uses three times the spend.

Separate the benefits and failures. Parallel evidence gathering may explain the latency gain. Shared sources and poor synthesis may explain correlated errors. Test deduplicated evidence partitions, preserve provenance, and compare selectors over a fixed candidate pool. Measure tail latency and cost, not only the median.

A valid decision may retain parallel retrieval while removing discussion, or return to a single agent when the deadline allows it. The architecture should follow the measured task constraints, not the desire to use every pattern learned in the course.

## Defense case 3: a learning system that gets worse

An optimizer writes reflections into a persistent playbook after every failed task. Development performance rises, but a fresh task family regresses. Inspection shows a rule derived from an attacker-controlled document.

Contain the update path, restore a known version, and preserve the candidate lineage. Reevaluate the memory write gate, provenance, and selection split. The failure combines contamination and overfitting; removing one malicious phrase does not repair the general policy of trusting every reflection.

Require bounded candidate proposals, development evaluation, hard invariant checks, and independent promotion evidence. Keep the ability to attribute a deployed behavior to the exact playbook version that produced it.

## Read a new SOTA claim

Identify the question, task population, model versions, baselines, budgets, evaluator, uncertainty, and excluded cases. Determine which evidence is experimental and which is an engineering report or hypothesis. Check whether the claimed mechanism was isolated or several variables changed together.

Look for negative controls, ablations, contamination risks, and reproducibility artifacts. A result can be valuable without being universal. Write a transfer hypothesis for your product and specify the smallest experiment that could disprove it.

The research report is a dated snapshot. When you encounter a new framework release or paper, update the relevant claim and rerun affected examples. Preserve historical results with their versions instead of rewriting the record as though the new system was always tested.

## Build a continuing practice

Maintain a small set of representative tasks, a library of failure traces, and a reproducible baseline. Add discovered failures to regression coverage while keeping a separate evaluation population for generalization. Review cost, latency, and human cleanup alongside success.

Periodically remove complexity. Ask whether a worker, memory rule, retry, or framework layer still earns its maintenance cost. An intervention that helped an older model may become unnecessary after an upgrade; a new model may also introduce different failure modes.

Use design reviews to expose assumptions before implementation. Ask a colleague to propose a counterexample to the task contract or recovery claim. A clear counterexample is useful evidence, not an attack on the architecture.

## Final acceptance

Complete the twelve module assessments, defend both capstones, and perform the three incident analyses in the workbook. The solution book gives expected reasoning and common mistakes. The rubric requires correctness, measurement, recovery, authority, and clear communication; an aggregate score cannot compensate for a severe unsupported effect claim.

You finish when you can reproduce the reference mechanics, extend them to a new domain, design a fair live-model comparison, and explain what evidence would make you change your mind. Our teaching sessions can now proceed at your pace because every lesson, assignment, reference implementation, and answer key is already available.
