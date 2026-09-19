# Harness engineering: executable starter labs

These are **deterministic teaching simulations**, not measured LLM results or production components. Everything runs offline with Python 3.10+ and its standard library. No account, API key, paid service, package installation, or network is needed. Monetary amounts and cost units are simulated; no money moves.

Run commands from this `labs` directory:

```bash
python 01_harness.py --scenario happy --approve
python 01_harness.py --scenario false_claim
python 01_harness.py --scenario forged_approval
python 01_harness.py --scenario loop --max-tool-calls 2
python 02_durable_effects.py
python 03_eval_metrics.py --k 2 --seed 42
python test_labs.py
```

## Lab 1 — The harness owns the consequences

`01_harness.py` executes a scripted model policy from `fixtures/harness_policies.json`. The policy proposes tools and final answers. The harness validates tool names and exact argument contracts, checks operator authority, bounds attempts and turns, executes effects, records observations, and independently verifies the task against external application state.

“External state” here means application state outside the model's proposed messages. It is held in a local Python dictionary to keep the example small. It is neither an actual remote service nor a durable store.

The task is a full refund of `order-7`, exactly once. The `--approve` switch simulates an operator granting authority for that order before execution. The model cannot supply its own approval.

| Command/scenario | Expected result | Lesson |
|---|---|---|
| `happy --approve` | `task_success: true`; one 2400-cent refund | Success requires an authorized effect and state verification |
| `happy` | `task_success: false`; zero refunds | A well-formed tool call can still be unauthorized |
| `false_claim` | `task_success: false`; zero refunds | Fluent completion text proves nothing about application state |
| `forged_approval` | Two rejections; zero refunds | An extra `approved` argument cannot confer authority |
| `invalid_args --approve` | Two rejections; zero refunds | Schema and semantic validation are separate from permission |
| `loop --max-tool-calls 2` | Two attempts, then `tool_budget_exceeded` | Repeated reads still consume budget |

Trace events distinguish proposals, successful observations, rejections, termination, and verification. The `task_success` field describes the refund objective and normal completion; it is **not** a comprehensive safety/compliance score. A production evaluator should separately report policy violations, refusal correctness, final-answer fidelity, and task success. The verifier here checks the intended order only.

Exercises:

1. Add a policy that announces success after a permission rejection. Predict every state transition before running it.
2. Insert a second `refund_order` call. Verify there is one ledger row and that the second call is rejected. Explain why this local state check does not solve cross-process retry races.
3. Temporarily replace `verify()` with a check for the word “completed” in the final answer. Identify the false positive and restore state verification.
4. Add a `partial_refund` contract and a task oracle for total refunded amount. Decide what the approval authorizes: order, maximum amount, recipient, expiry, or a specific operation.
5. Add one fixture with a malicious instruction in an order's free-text note. Demonstrate that it does not grant runtime capability. This only tests capability separation; it does not establish resistance to arbitrary prompt injection.
6. Replace the scripted policy with an adapter to a model only after defining the adapter's action schema. Preserve the same authorization and verification boundary. Record model/version, settings, prompts, observations, cost, and failures separately.

Limitations: no real inference, wall-clock/cost budget, credential handling, tenant isolation, sandbox, concurrency control, content filtering, or durable trace sink. The scripted policy does not adapt to observations. Authorization is intentionally simple; tool-level permission alone is insufficient for real systems.

## Lab 2 — Crash between the effect and the checkpoint

`02_durable_effects.py` creates two temporary SQLite databases: an effect service ledger and an orchestrator checkpoint store. It commits the effect, injects a crash before recording the checkpoint, closes both databases, then reopens them and retries the task.

| Mode | Effects after crash | Effects after retry | Total after retry |
|---|---:|---:|---:|
| Unsafe append | 1 | 2 | 4800 cents |
| Service-side business-key deduplication | 1 | 1 | 2400 cents |

Both modes have zero completed checkpoints immediately after the crash and one after the retry. Replaying a *completed* task adds no further effects in this demonstration. This does not fix the first unsafe duplicate, which occurred before the checkpoint existed.

The safe variant gives the effect service a unique key, `refund:order-7:v1`, whose identity survives retries and agent handoffs. The service atomically records the effect and key, returns the stored receipt on repeat, and rejects reuse with a different amount. The key denotes the business operation, not an attempt ID or an agent execution ID.

This demonstrates an **effectively-once business effect under the modeled service contract**, not a universal exactly-once guarantee. LangGraph checkpoints or any other durable orchestrator cannot independently make an unrelated external write atomic. Real services may expire keys, retain dedup records for limited periods, time out after committing, or lack idempotency support. A local dedup table that is separate from the actual remote effect recreates the same gap unless the remote service cooperates.

Exercises:

1. Move the crash before the effect and then after the checkpoint. Predict ledger and checkpoint counts for all three boundaries.
2. Generate a fresh key on every retry. Observe why deduplication no longer protects the business operation.
3. Reuse one key with a different amount. Confirm that it fails rather than silently accepting a mismatched request.
4. Give the same business operation a second orchestrator task ID. Compare service-side dedup with task-level checkpoint reuse.
5. Model a service with no idempotency API. Design reconciliation using a durable operation record, remote lookup, and a human exception queue. Explain which ambiguous outcomes remain.
6. Port the orchestration to a LangGraph task/node. Keep the two independent transaction boundaries explicit. Inject the same crash and require the same business invariant.

Limitations: simulated exception, not abrupt process termination or network failure; sequential runs, no concurrent worker test; no distributed transaction, outbox relay, compensation, leases, fencing, or real payment API. SQLite files are removed when the command exits normally.

## Lab 3 — Measure the unit you mean

`03_eval_metrics.py` consumes eight paired tasks with four hand-authored attempts per variant. The labels describe hypothetical tasks; no agents were run. Candidate attempts cost 1.5 abstract units, and baseline attempts cost 1 unit. These costs are **not dollars or tokens**.

For a task with `n` attempts and `c` successes:

- **pass@k** estimates the probability that at least one of `k` attempts succeeds: `1 − C(n−c,k)/C(n,k)`.
- **pass^k** estimates the probability that all `k` attempts succeed: `C(c,k)/C(n,k)`.

These are the exact success proportions over uniformly selected size-`k` subsets of observed attempts. Under independent, identically distributed attempts for a fixed task, they are unbiased estimators of `1−(1−p)^k` and `p^k`. Interdependent retries, shared state, changing policies, or selection bias break that interpretation. Neither metric alone measures a deployed best-of-k selection strategy: that also requires an available verifier/selector and accounting for every attempted run.

At `k=2`, expected fixture arithmetic is:

| Metric | Baseline | Candidate |
|---|---:|---:|
| Macro pass@2 (equal task weight) | 0.708333 | 0.750000 |
| Macro pass^2 (equal task weight) | 0.291667 | 0.375000 |
| Successful attempts / all attempts | 16 / 32 | 18 / 32 |
| Micro success rate | 0.500000 | 0.562500 |
| Total cost units | 32 | 48 |
| Total cost / successful attempts | 2.000000 | 2.666667 |

Cost per successful attempt includes spending on failures in its numerator. With zero successes it is reported as `null` because there is no finite observed cost per success. Cost on *successful runs only* answers a different question. These are attempt-level costs; do not call them costs per completed user task or per successful best-of-k batch.

The paired bootstrap resamples **tasks with replacement**, keeping a task's baseline, candidate, and repeated runs together. It assumes tasks are independent sampling units. For related tasks, resample independent repository or scenario clusters and retain every related task and paired variant within its cluster. It computes a deterministic, seeded percentile interval for the mean candidate-minus-baseline task score. It does not resample every rollout as if all 64 outcomes were unrelated. This task bootstrap captures variability over the observed task sample; it does not separately propagate uncertainty from only four attempts estimating each task's underlying probability. The tiny synthetic sample cannot support a product-quality claim. An interval spanning zero is inconclusive, not proof of equivalence.

Exercises:

1. Run with `--k 1`, `--k 2`, and `--k 4`. Explain why pass@k rises while pass^k falls.
2. Find the two tasks on which the candidate has fewer successes. Explain what an aggregate gain hides.
3. Add a high-cost failure. Verify the cost-per-success denominator and numerator.
4. Change one task to have more attempts. Explain the difference between equal-task macro scores and attempt-weighted micro success rate.
5. Ablate candidate changes one at a time on a frozen task set. Keep task identities and evaluation rules fixed; create a held-out suite before selecting a winner.
6. Extend each rollout with latency, unsafe-action attempted, unsafe-action executed, and verifier disagreement fields. Define denominators before writing aggregates.
7. Specify a sequential stopping or adaptive retry policy. Simulate its actual attempt costs and success outcomes instead of treating pass@k as its achieved deployment performance.

## Verification

`python test_labs.py` runs 16 behavioral tests. The tests check authorization cannot be self-granted, false completion cannot satisfy the oracle, budgets bound blocked and repeated attempts, retry crashes create unsafe duplicates, service-side keys prevent modeled duplicates, payload conflicts fail, and the evaluation formulas agree with exhaustive subset enumeration. Bootstrap pairing, deterministic seeds, failure-inclusive costs, zero-success handling, rejection of nonfinite costs (including JSON-loaded values), and invalid `k` are checked too.

These tests establish properties of the teaching code. They do not establish model capability, framework correctness, production security, real-world business safety, or distributed exactly-once semantics.
