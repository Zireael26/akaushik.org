# Workbook: Harness Engineering and Multi-Agent Systems

All 24 assignments and 12 module assessments are available now. Read the lesson, predict the result, run the matching lab, and write an explanation before consulting the solution. Default effort is 15–20 hours per week, or 30–40 hours per two-lesson module, as described in the course schedule; adjust pace freely. Submit code or traces where requested, not only prose.

## Assignment 01: Separate claim from outcome

Lesson 1 • Module 1 • Reference command: `python labs/run_lab.py 1`

A scripted assistant reads order 7, claims “refunded,” and stops without calling the refund tool. The order began paid at 2,400 cents and the ledger is empty. Draw the terminal-state decision and write the exact outcome predicate. Run Lab 1, identify the false-completion scenario, and explain the final trace event. Submit a task contract and a five-event trace that would establish real success. Then remove operator approval from an otherwise successful run and predict both the final text and environmental state before execution.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 02: Diagnose the first actionable boundary

Lesson 2 • Module 1 • Reference command: `python labs/run_lab.py 1`

A run has task T, attempt A1, and operation O. At 09:00 the tool starts; at 09:01 the service commits O; at 09:02 the client times out. The model says to retry with a new operation O2. Identify what is known and unknown, assign the correct identities to a retry, and propose structured events. Set a two-tool-attempt budget in Lab 1 and explain whether malformed attempts count. Submit a state table for pending, verified, denied, cancelled, and uncertain-effect outcomes.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 03: Compile context under a hard budget

Lesson 3 • Module 2 • Reference command: `python labs/run_lab.py 2`

The window is 100 units and output reserve is 20. Mandatory policy costs 30. Tenant-A order evidence costs 25 at priority 9; tenant-A notes cost 40 at priority 5; tenant-B secret data costs 5 at priority 99. Predict selected IDs, omitted in-scope IDs, and unused input capacity. Repeat with window 49. Explain why the highest-priority secret is unavailable and why dropping part of the mandatory policy is invalid. Run Lab 2 and compare its whole-record algorithm with the visual's illustrative allocation model.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 04: Design an honest tool contract

Lesson 4 • Module 2 • Reference command: `python labs/run_lab.py 2`

Define a full-refund tool whose model arguments are order_id and amount_cents. Evaluate inputs with amount 2,400, True, 1.5, -1, and an extra approved field. Explain which checks belong to schema validation and which require service state. Design error envelopes for invalid arguments, denied authority, temporary read failure, and a write timeout with ambiguous commit. Submit a safe pagination contract with an explicit end marker.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 05: Build a layered grader

Lesson 5 • Module 3 • Reference command: `python labs/run_lab.py 3`

Among 100 task outputs, a text judge marks 82 successful. State inspection finds 72 correct outcomes; 15 of the judge-positive outputs are wrong. Construct the confusion matrix using state correctness as truth. Define separate outcome, process, and safety metrics. Propose six calibration examples including a polished false success, a valid alternative, an incomplete result, and insufficient evidence. Explain how you would split near-duplicate customer scenarios.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 06: Calculate repeatability and uncertainty

Lesson 6 • Module 3 • Reference command: `python labs/run_lab.py 3`

A task succeeds in 8 of 10 recorded attempts. Calculate finite-sample pass@3 and pass^3 without using p cubed. Then compare systems on the 16 paired fixtures using task and cluster resampling. Explain why four clusters are weak evidence. Costs for three attempts are 1, 2, and 3 units, with success, failure, success. Calculate cost per success and describe the zero-success case. Submit a result paragraph that preserves uncertainty.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 07: Prove a reducer contract

Lesson 7 • Module 4 • Reference command: `python labs/run_lab.py 4`

Workers return keyed evidence maps. Merge A={a:1}, B={b:2}, and C={a:1}. Test order independence, duplicate delivery, and conflicting C={a:9}. Explain why list concatenation can duplicate evidence and why last-writer-wins can conceal disagreement. Run Lab 4 and write the acceptance rule for complete evidence coverage. State the domain over which your reducer's algebraic claims hold.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 08: Budget dynamic workers

Lesson 8 • Module 4 • Reference command: `python labs/run_lab.py 4`

Three independent workers each make two sequential four-second calls, then a synthesizer makes one four-second call. Calculate total calls and critical path under unlimited slots. Compare with one worker doing the six calls sequentially. Remove one worker's evidence in Lab 4, then submit an empty job set. Explain the correct join behavior and how you would represent a deliberately permitted partial result.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 09: Recover the commit window

Lesson 9 • Module 5 • Reference command: `python labs/run_lab.py 5`

Run the product reference with a crash after the effect service commits but before the controller checkpoint. Inspect both databases and the report. Predict the result of retrying the same intent and of inventing a new operation identity. Explain why a graph checkpoint cannot create a transaction with an arbitrary external API. Submit a reconciliation procedure for a timeout when approval has since expired.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 10: Bind approval and resume safely

Lesson 10 • Module 5 • Reference command: `python labs/run_lab.py 5`

Approve operation O for tenant A, order 7, 2,400 cents, policy v1, expiring at time 40. Evaluate an unchanged execution at 39, execution at 40, amount changed to 1, policy changed to v2, and a forged resume value. Run Lab 5's actual LangGraph interrupt/restart sequence. Identify code that can run again when an interrupted node resumes and propose an upgrade strategy for paused workflows.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 11: Choose a topology from dependencies

Lesson 11 • Module 6 • Reference command: `python labs/run_lab.py 6`

Design systems for: collecting independent evidence from four sources; updating one shared account through three dependent steps; selecting one patch from several candidates; and open-ended review with conflicting source claims. Choose a baseline and one alternative for each. Use Lab 6 to estimate scheduling cost, and state what the simulator cannot decide. Submit a diagram with ownership and the outcome verifier.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 12: Defend a multi-agent result

Lesson 12 • Module 6 • Reference command: `python labs/run_lab.py 6`

A team scores 76% versus 70% for a single agent, costs 2.5 times as much, and reduces median latency from 40 to 24 seconds. Its paired success-difference interval is -2 to +14 percentage points. The team also uses a stronger coordinator and a different verifier. Write a decision memo for a 30-second deadline product and for an overnight batch product. Design an ablation that isolates selection.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 13: Reject stale and conflicting artifacts

Lesson 13 • Module 7 • Reference command: `python labs/run_lab.py 7`

Task T17 revision 4 belongs to W2. Receive: W2/rev4/artifact A; W2/rev4/A again; W2/rev3/B; W3/rev4/A; W2/rev4/conflicting C. Predict every result in order. Then cancel a pending task and deliver its late artifact. Run Lab 7. Extend the written contract with an input dependency hash and describe its validation without implementing a production broker.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 14: Audit a protocol boundary

Lesson 14 • Module 7 • Reference command: `python labs/run_lab.py 7`

Call tools/list and tools/call on the teaching protocol. Try a missing method, malformed params, another tenant's order, and an added tenant override. Identify the layer responsible for each rejection. Explain why this example is not a complete MCP server or A2A service. Write a concrete deployment checklist and distinguish protocol conformance from product acceptance.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 15: Verify a coding change

Lesson 15 • Module 8 • Reference command: `python labs/run_lab.py 8`

Run both coding candidates for all six defects (the coding section of Lab 12). Choose pagination: explain why offset=10,count=10,total=20 must return no next page and why count=0 must not create an infinite cursor loop. Add one user-facing boundary case before editing. Describe recovery after a patch is written but before test completion is recorded. State the execution environment's security limits.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 16: Reason about memory lifecycle

Lesson 16 • Module 8 • Reference command: `python labs/run_lab.py 8`

Store a tenant-A observation at time 10 with expiry 30. Query at 9, 20, and 30, then delete it and attempt resurrection under the same ID. Query from tenant B. For 23 records in batches of 5, calculate calls required for full coverage and explain what happens with a four-call cap. Propose a contradiction policy for a recent forum comment and an older authoritative policy.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 17: Threat-model the product action

Lesson 17 • Module 9 • Reference command: `python labs/run_lab.py 9`

Draw the path from user text through model proposal, worker artifact, tool adapter, approval store, and effect ledger. Place the enforcing boundary for wrong tenant, changed amount, forged approval, stale policy, and duplicate delivery. Run Lab 9 and inspect ledger counts. Explain why an intent hash is not itself authentication and why a worker's approval claim is insufficient.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 18: Measure defense and usefulness

Lesson 18 • Module 9 • Reference command: `python labs/run_lab.py 9`

A detector flags 32 of 40 attacks and 12 of 60 benign messages. Compute precision and recall. Then design five paired attack/benign cases for the refund workflow, including a legitimate document that describes the requested process. Define separate end-to-end utility and violation metrics. Explain why blocking every request is not a successful product defense.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 19: Fence a stale worker and reserve spend

Lesson 19 • Module 10 • Reference command: `python labs/run_lab.py 10`

A claims job J at time 0 with a five-unit lease; B claims at time 6. Both finish at time 7. Predict epoch values and accepted writes. A budget has 100 units; reserve 60, then request 50, then settle the first reservation at actual cost 35. Calculate remaining capacity. Compare four simultaneous ten-second jobs with one and two workers. Run Lab 10.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 20: Recover an incompatible deployment

Lesson 20 • Module 10 • Reference command: `python labs/run_lab.py 10`

A release renames approval_id to decision_id. Four paused tasks resume: A has a committed effect, B has no effect and a valid approval, C has no effect and an expired approval, D has an unknown state version. Write the recovery action for each. Migrate a v1 state with missing status and reject version 99 in Lab 10. Define one release gate and one rollback limitation.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 21: Select a candidate without leaking the holdout

Lesson 21 • Module 11 • Reference command: `python labs/run_lab.py 11`

Run Lab 11's three-policy search. Explain the negation failure of keyword matching and the confirmation policy's recall risk. Record all train/development scores, freeze the development winner, and report holdout once. Inspect the fixture README and explain why distinct IDs do not make this a generalization benchmark. Design a real reflective search with a 30-call proposal/evaluation budget.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 22: Allocate compute by utility

Lesson 22 • Module 11 • Reference command: `python labs/run_lab.py 11`

Two routes have success probabilities 0.65 and 0.90 with costs 0.05 and 0.40. Compute expected success-minus-cost utility. A verifier costs 0.10 and prevents a 0.04 probability of a ten-unit loss. Calculate its expected net value under these assumptions. With 20 seconds left, a 12-second worker plus ten-second synthesis competes with a five-second mandatory check. Explain the choice and the limits of the bandit demo.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 23: Assemble the evidence portfolio

Lesson 23 • Module 12 • Reference command: `python labs/run_lab.py 12`

Run Lab 12 and the full test suite. Submit a product trace covering approval, committed effect, crash, retry, and verification; a rejected-action trace with zero effects; and coding reports for one unchanged and one reference candidate. Name every version and synthetic assumption. Propose a live-model extension that cannot execute generated code automatically. Use the capstone rubric below.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Assignment 24: Defend transfer to an unfamiliar system

Lesson 24 • Module 12 • Reference command: `python labs/run_lab.py 12`

Choose a new domain from your own products. Write its task contract and identify the authoritative outcome source. Analyze three incidents: an API acknowledgment mistaken for completion; a faster team that loses authoritative dissent; and a playbook contaminated by an external instruction. For each, name the earliest actionable boundary, repair, regression test, and independent evaluation. End with a condition that would make you remove an agent or memory rule.

Submission: prediction, observed evidence, explanation of any mismatch, and one counterexample or limitation.

## Module assessment 01: Control and outcome

A tool returns HTTP 202 (accepted for later processing) and the agent reports success. What state should the task enter, what evidence is missing, and which identifier supports later reconciliation? Separately: the run has exhausted its tool budget with the job still pending. Which terminal status is truthful, and what must the final message contain?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 02: Context and contracts

A highly relevant retrieved record belongs to another tenant, and the required policy exceeds the available context budget. Can either be included partially to improve success?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 03: Evaluation

A candidate wins 12 of 16 paired tasks drawn from four templates. The engineer reports 16 independent samples and selects the best of 40 prompt variants on this set. Identify two inferential problems. Then: a task has 3 successes in 4 recorded attempts. Give the finite-sample pass@2 and pass^2 without substituting p=0.75 into the independent-trial formulas, and say which product question each answers.

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 04: Graph semantics

Two workers write the same evidence key with different values. One run chooses A and another chooses B because completion order changes. What reducer policy and acceptance test are needed? Separately: a node returns Command(goto="verify") and the graph also has add_edge from that node to "review". Predict what runs in the pinned LangGraph release and state the repair.

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 05: Durability

An approval expires after an effect commits but before the graph resumes. Does expiry prove the action failed? What can recovery safely do? Separately: a retry policy generates a fresh idempotency key on every attempt. Which guarantee does that silently discard, and what should the key identify instead?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 06: Architecture

A team gets better answers using twice the calls, a stronger coordinator, and a new verifier. What has been established, and how would you isolate coordination?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 07: Coordination and protocols

A valid A2A artifact arrives for revision 2 after task revision 3 is cancelled. Should transport validity allow integration?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 08: Long-horizon state

A memory says tests passed yesterday, but the repository and dependency lock changed overnight. Is the feature verified? Separately: a retrieval over 23 policy records must count how many meet a condition, the classifier handles 5 records per call, and the budget allows 4 calls. What should the system do before making any call?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 09: Security and utility

A defense blocks every external document and records zero attacks. What additional result is required before adoption?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 10: Operations

A worker finishes after its lease expires and a new worker takes ownership. The old worker has already called an external write. Does fencing the queue result solve the whole problem? Separately: two workers each read a shared budget of 100 units, each sees 100 available, and each spends 60. Name the defect and the fix.

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 11: Optimization

A reflective optimizer examines final-test failures, changes its playbook, and reports the improved score on the same test. What is the correct interpretation?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Module assessment 12: Defense

Your reference capstones pass locally. Which claims can you make, and which require additional experiments?

Answer without consulting the key. Include a concrete test or trace that would distinguish your diagnosis from an alternative. Score using the assessment rubric.

## Assessment rubric

Each module assessment is worth 10 points: 4 for correct diagnosis, 3 for an enforceable repair, 2 for a meaningful test, and 1 for stated limitations. A score of 8 or more indicates readiness to continue. Revisit the paired lessons for lower scores. An unsafe authority or false-outcome claim must be corrected regardless of total score.

## Capstone A brief: recoverable product action

Build or explain the supplied refund reference. Required behaviors: scoped resource access, exact intent approval, expiry/revocation, current policy, stable effect identity, crash recovery across separate controller/effect stores, and an authoritative verifier. Submit a happy path, seven rejected boundary cases, the commit-window trace, and a deployment recovery note. The reference is local and simulated; adapting it to a real service requires that service’s actual semantics.

## Capstone B brief: verified coding work

Run the six seeded defects with unchanged and reference candidates. Add one behavioral boundary case and one new defect in a product-relevant domain. Preserve baseline failures, candidate diff, test evidence, environment, and artifact digest. Explain restart after a patch but before verification. A live-model extension is optional and requires an appropriately isolated executor; the supplied runner only executes trusted local fixtures.

## Capstone rubric

Each capstone is worth 100 points: task/outcome contract 15; implementation and invariants 25; meaningful baselines and evaluation 20; recovery and authority 20; reproducibility and evidence 10; clear limitations and design defense 10. Target at least 85 on each. Any unacknowledged unauthorized effect, fabricated verification, or unsupported security claim blocks completion until repaired.

## Final incident defense

Use the three cases in Assignment 24. For each, provide a one-page incident record: trigger, observed state, uncertain facts, containment, earliest actionable boundary, repair, regression, and fresh evaluation. Transfer the design to one of your own products and identify the simplest viable architecture.
