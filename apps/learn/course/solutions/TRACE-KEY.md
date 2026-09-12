# Additional Trace and Design Keys

## Lesson 3: grouped evidence

Ordinary greedy selects A and then cannot fit B or C, spending 30 units on an unusable half-pair. Group-aware selection sees the 60-unit pair cannot fit and selects C for 45, preserving an independently useful result. The compiler needs explicit dependency/group membership, scoped identities, combined size, priority/value policy, and rules for mandatory groups. Do not infer dependencies from adjacent text alone. A counterexample is two actually independent 30-unit records incorrectly grouped into a 60-unit candidate under a 50-unit budget: grouping excludes both, while ordinary selection can retain one useful record. Group awareness fixes a declared dependency problem; it is not universally superior to every greedy policy.

## Lesson 5: ten outcomes

| Case | Defensible classification | Metric treatment |
| --- | --- | --- |
| 1 | False completion; requested state absent | Failure in valid-task completion denominator |
| 2 | Pending acknowledgment, not yet terminal | Keep pending until deadline; do not label success early |
| 3 | Verified authorized outcome | Success in valid-task completion denominator |
| 4 | Duplicate effect violates the task invariant | Failure plus separate duplicate-effect violation |
| 5 | Correct denial of an invalid scoped request | Success for appropriate handling; separate from valid-refund completion |
| 6 | Business effect correct; communication failed | Outcome success and response-delivery failure reported separately; overall product contract may require both |
| 7 | Unnecessary refusal | Valid-task completion failure; utility loss |
| 8 | Late unauthorized continuation after cancellation | Deadline failure and cancellation/effect violation |
| 9 | Evaluation infrastructure failure; truth unknown | Report ungraded count and coverage; investigate or rerun under a declared policy, never silently drop it |
| 10 | Correct read-only confirmation if evidence is current | Success under the actual query contract; no new effect required |

The rubric must be fixed before comparing systems. Case 6 can be overall failure if reliable response delivery is part of the task; retain the separate outcome dimension so the cause remains visible. Case 9 should not make a system look better by disappearing from the report. Case 10 shows why a preexisting state can satisfy a query but does not establish that a requested new mutation was performed. A dataset card should state task types, validity strata, initial state, deadlines, grading coverage, and the split unit.

## Lesson 6: subset enumeration

The six subsets are {S1,S2}, {S1,F1}, {S1,F2}, {S2,F1}, {S2,F2}, and {F1,F2}. Five have at least one success, so pass@2=5/6. Only the first has all successes, so pass^2=1/6. Plugging p=0.5 into an independent replacement model yields 0.75 and 0.25. The finite-sample estimator samples distinct recorded attempts without replacement; the plug-in model assumes independent new trials at an estimated fixed probability. State which question you are answering.

## Lesson 7: combined routing

Both `static` and `dynamic` execute in the tested pinned runtime. The returned command schedules its destination; the explicit static edge also schedules work. The reference test compares the set of visited names, not an arbitrary sibling completion order. Remove the static edge if the dynamic command is intended to be the only route. This is a concrete example of why an intuitive graph sketch is insufficient without execution semantics.

## Lesson 8: join policies

For full evidence coverage, A and C alone are incomplete because B is missing. Either fail the full-success predicate or return an explicitly permitted partial status with expected/completed/missing IDs and limitations. For the mutation task, reading version 7 is a dependency of the calculated update, and the commit must compare the current resource version with 7. If another writer changed it, reject/recompute under the current state rather than merging stale mutations. A fan-in barrier cannot make a stale precondition valid. The compiled-child example in Lab 4 projects only evidence back to the parent and keeps its private scratch field outside the parent result; this is an interface projection, not a proof that every streaming mode is redacted.

## Lesson 10: approval transitions

| State | Appropriate control |
| --- | --- |
| No approval | Pause or deny according to the product contract; no effect |
| Matching current approval | Execute only after current resource and policy checks |
| Revoked approval | Deny new execution; inspect existing effects through an authorized read if needed |
| Expired approval | Deny new execution; obtain a current decision if work remains |
| Changed intent | Revalidate and obtain a decision bound to the changed action |
| Duplicate committed delivery, valid approval | Return the existing receipt under service deduplication semantics |
| Committed effect, expired approval | Reconcile and verify the existing effect; do not invent a new grant |
| Unknown state version | Reject automatic resume; use supported migration or versioned/manual recovery |

The table separates authority for a new action from knowledge of a past effect. The local service's simulated clock is supplied by the driver; a deployed service must own a trusted current clock rather than accept a model-selected or stale timestamp.

## Lesson 12: architecture memos

Transactional memo: choose an explicit workflow for the fixed refund contract because the steps have a shared-state dependency and the service can enforce exact invariants. Compare a single proposal model with any proposed specialist under the same task/evaluator/budget. Additional agents must demonstrate useful capability beyond the deterministic reference, while approval and effect checks remain in the service. Reverse the decision if a measured specialist materially improves valid-task understanding without violating resource or authority constraints.

Evidence memo: test bounded workers when source inspections are independent and a deadline makes serial execution unsuitable. Reserve synthesis budget, preserve source identity, reject missing/conflicting output, and compare a strong single worker and independent-candidate baseline. The schedule suggests possible latency reduction under equal-duration assumptions; measure actual task success, tail latency, total spend, and source coverage in a paired live experiment. Reverse the decision if workers share redundant evidence, lose authoritative dissent, or fail to meet the deadline after integration overhead.
