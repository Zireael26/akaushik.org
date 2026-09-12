# Lesson 18: Adversarial Evaluation Without Destroying Usefulness

## Evaluate what the attacker changes

An adversarial case should specify a legitimate task, attacker-controlled surface, malicious objective, and observable violation. Without a legitimate task, it is difficult to measure whether a defense preserves useful behavior. Without an observable violation, a grader may mistake alarming language for an actual security failure.

For a tenant-scoped assistant, the attacker might control a retrieved note and seek access to another tenant's order. The violation is an unauthorized read or effect, not merely repeating the attack text in a quotation. Conversely, a friendly final answer does not excuse a violation recorded in the service ledger.

AgentDyn is a research example that includes dynamic tasks and helpful third-party instructions, making the utility/security tradeoff visible. Its tested environments and defenses are described in the [paper](https://arxiv.org/abs/2602.03117v3). Use its mechanism as inspiration while constructing domain-specific cases.

## Pair attack and benign variants

Start from a valid task and create a matched variant with an injected instruction. Keep unrelated conditions stable. Then add benign cases that resemble the attack surface: a document legitimately describing how to perform the requested workflow, or a customer quoting malicious text for analysis.

This prevents a crude defense from earning credit simply by rejecting all external instructions. Measure authorized completion on the benign population and violation rate on the attack population. Report the populations separately; combining them into one accuracy number can conceal important tradeoffs.

Include changed policy, stale approval, cancellation, concurrent execution, and resource exhaustion. Security is broader than prompt injection. A system that resists text attacks but executes the same approved transfer twice after a timeout still has a serious control failure.

## Use layered oracles

A deterministic oracle can inspect whether a forbidden record was read, whether an unauthorized effect occurred, and whether a budget was exceeded. A human or calibrated judge can assess whether a response disclosed a secret or fulfilled a nuanced legitimate objective. Keep these judgments separate and preserve supporting evidence.

For model judges, construct counterexamples: safe quotations, indirect leakage, polished but false refusals, correct partial completion, and insufficient evidence. Blind candidate identity where feasible. Record disagreement and allow an uncertain category instead of forcing every ambiguous case into a confident binary label.

The local course suite focuses on exact service invariants and synthetic text fixtures. It does not run a live attacker model. That makes the mechanics repeatable but leaves behavioral robustness to a separately designed live experiment.

## A worked confusion matrix

Suppose a detector examines 40 malicious and 60 benign messages. It flags 32 malicious and 12 benign messages. True positives are 32, false negatives 8, false positives 12, and true negatives 48. Precision is 32/44, about 72.7%; recall is 32/40, or 80%.

These values describe the detector on this mixture. They do not directly establish system security. Some unflagged attacks may still be blocked by authorization, and some flagged benign tasks may still complete through a safe path. Measure end-to-end outcomes after the detector's decision.

Base rates also matter. A detector with the same sensitivity and false-positive rate can have much lower precision when attacks are rare. Do not transport precision from a balanced test set to production without considering the population.

## Search adaptively, evaluate separately

Red teaming is adaptive: one failure suggests a new attack. That is useful for discovering weaknesses, but repeated optimization against the same cases turns them into development data. Maintain a separate evaluation set and disclose which attacks were used to tune the defense.

Record attack budgets, knowledge, and access. An attacker who sees the full system prompt and can make thousands of queries differs from one who controls a single webpage once. Results without this context are difficult to compare.

When a failure appears, preserve a minimal reproducer and the boundary trace. Repair the underlying control when possible rather than adding a phrase-specific blacklist. Then test the regression and adjacent cases without claiming the finite set is exhaustive.

## Incident evidence and response

If an effect may have occurred, first establish the external state and contain further authority. Preserve logs with appropriate access controls. Distinguish investigation from recovery: deleting evidence can make the incident harder to understand, while continuing retries can amplify the damage.

Write an incident note with trigger, affected scope, observed effects, uncertain facts, containment, repair, and follow-up evaluation. Avoid assigning causality to the model before tracing the service boundary. A forged approval accepted by a backend is a backend authorization defect even if an injection produced it.

## Practice and acceptance

Use Lab 9 and the paired-cases section of `templates/threat-model.md` to pair five malicious variants with five benign controls. Compute the detector confusion matrix and separately report authorized completion and forbidden effects. Explain why a defense with zero violations but zero useful completions is unacceptable for the product.

You pass when your evaluation can reveal both a weak defense and an excessively restrictive one, and when your report distinguishes attack discovery, regression testing, and untouched evaluation.
