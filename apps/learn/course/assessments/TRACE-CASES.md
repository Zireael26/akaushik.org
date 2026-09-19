# Additional Trace and Design Cases

These cases complete the prediction exercises referenced inside the lessons. Use the corresponding key in `solutions/TRACE-KEY.md` after answering. The 24 primary assignments remain the main sequence.

## Lesson 3: grouped evidence selection

Input capacity after mandatory policy is 50 units. Evidence A costs 30 at priority 9, B costs 30 at priority 8, and C costs 45 at priority 7. A and B are useful only together; C is independently useful. Predict ordinary whole-record greedy selection and group-aware selection that treats {A,B} as an indivisible candidate with priority 9. Give a counterexample in which incorrectly grouping independent records makes selection worse. State what metadata a grouped compiler needs.

## Lesson 5: ten evaluation outcomes

For each case, classify outcome correctness, completion status, and any separate safety/process failure. Define which denominator it belongs in before computing aggregate success. The task requires an authorized full refund with a verified state transition before the deadline, unless the request itself is invalid.

1. Final text says refunded; ledger empty; deadline reached.
2. HTTP 202 acknowledges the job; ledger empty; deadline not yet reached.
3. Exact authorized refund exists once; final response accurately reports it before deadline.
4. Exact refund exists twice; final response says success.
5. Requested refund belongs to another tenant; service denies it and explains the limit.
6. Authorized refund commits before deadline; response transmission fails afterward.
7. No refund commits; model refuses a valid authorized request without explanation.
8. Refund commits after the task's hard deadline, despite cancellation.
9. Test infrastructure loses access to the ledger, so the final state cannot be inspected.
10. The order was already refunded before the run; the user asked whether it had been refunded, not to perform a new refund.

## Lesson 6: enumerate finite samples

Label two successes S1,S2 and two failures F1,F2. Enumerate all six unordered two-attempt subsets. Which satisfy at least one success and which satisfy all successes? Explain why these fractions differ from substituting p=0.5 into independent-trial formulas.

## Lesson 7: static edge plus dynamic command

A route node returns `Command(goto='dynamic')` and also has a static edge to `static`. Both destination nodes append their name to a reducer-backed visited list and then terminate. Predict the set of visited nodes in the pinned LangGraph version, then inspect Lab 4. Does the command replace the static edge?

## Lesson 8: two joins

An evidence task expects A, B, and C, but only A and C return. A separate mutation task must read version 7, calculate a permitted update, and conditionally commit against version 7. Propose a join/completion policy for each. Explain how a shared-state dependency differs from missing independent evidence.

## Lesson 10: approval transition table

For an exact intent I, classify: no approval; matching current approval; revoked approval; expired approval; changed intent; duplicate delivery after a committed effect with still-valid approval; committed effect with expired approval; and unknown state version. State whether execution, reconciliation, new approval, or manual/versioned recovery is appropriate.

## Lesson 12: two architecture memos

Write one memo favoring a deterministic workflow for an exact transactional action, and one favoring bounded parallel workers for independent evidence under a deadline. Include the strongest alternative, expected mechanism, budgets, verifier, uncertainty, and a condition that would reverse the decision. Use the synthetic schedule only for arithmetic, not model-quality claims.
