# Lesson 21: Reflective Optimization and Honest Holdouts

## Choose the optimization surface

Prompt optimization changes instructions. Context adaptation changes retained information or strategies. Harness optimization changes routing, tools, stopping, or verification. Post-training changes model weights. These interventions can interact, but their costs and evidence should remain distinguishable.

Before optimizing, identify a repeatable failure and a measurable objective. “Make the agent smarter” is not an experiment. “Reduce missed negation on these development tasks without increasing unauthorized actions” identifies a target and a constraint.

GEPA uses trajectory feedback to propose and evaluate changes, while ACE studies an evolving context playbook. These are research mechanisms with specific experiments, not universal prescriptions. Read the versioned [GEPA paper](https://arxiv.org/abs/2507.19457v2) and [ACE paper](https://arxiv.org/html/2510.04618v3) alongside the research report's limitations.

## Preserve candidate lineage

Each candidate needs an identifier, parent, exact configuration, proposal rationale, evaluation set version, resource usage, and results. A promising result without a recoverable candidate is not reproducible. A candidate selected after seeing holdout failures has consumed that holdout as development information.

Keep training or proposal data separate from development selection and final evaluation. Split by scenario family when near-duplicates share structure. Randomly splitting paraphrases of the same task can leak the answer pattern across sets even when identifiers differ.

The local optimization lab uses three fixed deterministic policies: keyword matching, negation handling, and a confirmation requirement (named `evidence` in the code). It selects on development examples and reports holdout performance once. It is a small model of selection mechanics, not a GEPA implementation, an ACE implementation, or an LLM quality benchmark.

## Work through a candidate change

The keyword policy labels “urgent” as positive even in “not urgent.” The negation policy fixes that failure. A confirmation policy may improve precision for one dataset while missing legitimate urgent requests that lack the word “confirmed.” Improvement depends on the task definition and distribution.

Inspect false positives and false negatives separately. A single aggregate score can hide a tradeoff that matters to the product. If a candidate improves development accuracy from 70% to 85% but violates a hard safety invariant, it is ineligible regardless of the score gain.

Selection itself creates optimism. Trying many candidates and reporting the best development score overstates expected generalization. A held-out evaluation helps estimate transfer, but repeated reuse eventually turns it into another selection set. Keep a ledger of every evaluation exposure.

## Reflection is a proposal generator

A model-generated critique can identify a useful hypothesis, invent a causal story, or recommend an overfit rule. Treat it as a candidate proposal. Validate the proposed change against evidence and independent cases.

Do not write every reflection into persistent memory. A playbook should retain bounded, inspectable rules with provenance and a rollback path. If a new rule harms unrelated tasks, remove or scope it. If several rules conflict, define precedence rather than hoping the next model call resolves the ambiguity consistently.

An optimization loop needs a stopping condition: exhausted budget, no material improvement, insufficient evidence, or unacceptable regressions. Without one, the optimizer can spend more than the deployment savings justify.

## A reproducible experiment

Freeze the baseline, task-family split, primary metric, hard constraints, candidate budget, and selection rule. Evaluate the baseline and all eligible candidates on the same development tasks. Preserve failures and timeouts. Select by the declared rule, then evaluate the selected candidate on the untouched holdout.

Report the full search cost and the baseline comparison, not only the winning score. Include uncertainty when the sample supports it and state when the sample is too small for a strong conclusion. A null result can reveal that the failure is elsewhere, such as a tool contract or missing evidence.

The interactive optimization panel lets you see how candidate selection changes with development observations. Its values are illustrative. The lab's deterministic fixtures make the selection path inspectable; a real-model reproduction needs recorded model identifiers, prompts, calls, and costs.

## Practice and acceptance

Run Lab 11. Explain why the keyword candidate fails its negation cases, inspect which candidate development selection chooses, and report the holdout without revising the winner. Then propose an actual reflective loop with a fixed call budget and a candidate lineage table.

You pass when another engineer can reproduce the selected configuration and tell which evidence influenced it. Expertise includes rejecting an attractive optimization result when its holdout was repeatedly consulted or its gains come from a changed evaluator.
