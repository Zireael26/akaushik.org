# Lesson 5: Outcomes, Datasets, and Graders

## Define success before selecting a harness

An agent evaluation is a statement about a system on a population of tasks under a protocol. The system includes the model, prompts, tools, environment, budgets, retries, and selection procedure. The population includes the kinds of requests, initial states, and failure conditions that the evaluation samples. The protocol determines how a run starts, what it may do, when it ends, and how its outcome is judged.

Changing any of these can change the result. If a new harness is evaluated on easier tasks, its higher score does not establish an improvement. If it receives more retries or a stronger verifier, the comparison measures that complete configuration. Treat an evaluation manifest as part of the result, not administrative paperwork.

Start with the business outcome. For a refund task, the authoritative ledger must contain the correct permitted effect and no prohibited effect. For a coding task, the resulting artifact must satisfy the requested behavior and preserve relevant invariants. For research, each material claim must be supported by appropriate evidence, with uncertainty where sources conflict. A transcript that looks competent can fail all three.

## Outcome checks and process checks

Outcome checks inspect the final state or artifact. Process checks inspect restrictions on execution: no unauthorized mutation, no cross-tenant read, required approval, or a bounded number of calls. Both can matter. A correct final answer produced through a forbidden data access is not an acceptable run.

Avoid specifying an exact tool sequence unless the sequence is itself a requirement. Several valid paths may produce the same acceptable result. Requiring one trajectory can punish useful improvements. Conversely, allowing arbitrary paths does not mean ignoring effects. The evaluator should distinguish legitimate alternative strategies from prohibited behavior.

Use separate metrics for task success, policy compliance, answer fidelity, and unresolved outcomes. Combining them into one number can hide an operationally important trade-off. A model that refuses everything may achieve zero unauthorized effects and zero useful completion. Both facts belong in the report.

## A layered grader

The first layer is deterministic: exact values, schema validity, test results, receipt identity, and forbidden-effect assertions. The second layer assesses properties not captured by exact rules, such as explanatory adequacy or claim support. A model grader can help, but it needs calibration. The final layer is adjudication of ambiguous or high-impact cases by a qualified reviewer.

Do not let the candidate supply the ground truth. If the implementing agent writes `all_checks_passed=true`, the evaluator should inspect actual test output or run the checks independently. If a research agent supplies citations, the grader should check whether the cited text supports the claim rather than merely verify that a URL exists.

A grader can be attacked or optimized against. Keep evaluation instructions separate from candidate-controlled content. Record the grader version and preserve examples of false acceptance and false rejection. A change that makes the grader more permissive can create an apparent agent improvement without changing the agent.

## Construct a useful task set

Begin with a small debugging set to discover obvious defects. Then expand around a task taxonomy: ordinary success, ambiguity, missing data, stale state, tool failure, denied authority, partial success, duplicate delivery, and recovery. Include valid refusals and valid requests for clarification. Otherwise the evaluator may reward unsupported action on tasks that should stop.

Partition related tasks together. If the training set contains an order workflow and the holdout contains the same workflow with only an ID changed, the apparent generalization is weak. For repository tasks, shared code and conventions can make tasks dependent. For operations tasks, scenario templates can create the same issue. Split by meaningful families before tuning, and preserve that grouping during statistical analysis.

The course includes synthetic cases because they make exact outcomes and failure injection inspectable. They are not a representative sample of all production requests. The capstone guide explains how to add sanitized tasks from a domain you know without copying private customer data into a public benchmark.

## Worked example: a misleading success score

Suppose a candidate handles 100 requests. Eighty are ordinary actions, ten lack required information, and ten are forbidden. It completes 72 ordinary actions, invents answers for all missing-information requests, and refuses all forbidden requests. A naive grader that counts any final answer as completion might report 92%. A task-contract grader reports 72 ordinary successes, zero successful information-handling cases, and ten correct refusals.

Whether the overall score is 82% depends on a declared definition that considers a correct refusal a successful handling of that task. That is reasonable for service-level correctness, but it must not be presented as an 82% action-completion rate. Report the strata and the denominator. The same run can have several valid metrics answering different questions.

Now change the candidate to ask appropriate clarifying questions on the ten underspecified tasks. Useful handling improves even though fewer final answers assert completion. This is why the task contract must come before a metric based on textual appearance.

## Calibration and disagreement

To calibrate a binary grader, collect examples labeled by a suitable reference process. Compute true positives, false positives, true negatives, and false negatives for a declared positive class. Precision answers how often accepted cases are truly acceptable; recall answers how many acceptable cases are accepted. A safety-oriented application may care particularly about false acceptance, but suppressing all acceptance is not a useful solution.

Include polished incorrect answers, terse correct answers, valid alternative implementations, missing evidence, and near-boundary cases. Blind the identity of competing systems where practical. Review disagreement by category. A single aggregate agreement rate can hide poor performance on the exact difficult cases that justify using a grader.

The calibration set must also remain separate from a final evaluation if it is used to revise the grader. Once a case influences the system, it becomes development evidence. It can remain a regression test, but it is no longer untouched evidence of generalization.

## Practice and acceptance

Use the supplied product fixtures to write three independent assertions: intended state, forbidden effects, and truthful terminal status. Run the same final message against two different backend states. It must not receive the same correctness label merely because the wording is identical.

In the additional trace cases (`assessments/TRACE-CASES.md`), classify ten deliberately ambiguous evaluation outcomes and justify each denominator. The solution manual provides one defensible rubric and identifies where alternative definitions are acceptable if stated consistently. Completion requires a dataset card, a grader contract, and an example that defeats your initial grader.

## Reading

[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) discusses agent evaluation practice. [τ-bench](https://arxiv.org/abs/2406.12045) supplies a benchmark example based on tool interactions and resulting state. Our fixture labels are course-defined oracles, not published benchmark scores.
