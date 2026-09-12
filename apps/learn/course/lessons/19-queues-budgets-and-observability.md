# Lesson 19: Queues, Budgets, and Operational Evidence

## A graph needs an operating system around it

The graph describes logical transitions. Production also needs admission control, scheduling, cancellation, tenancy, resource accounting, and recovery from worker loss. A correct graph can still overload a service if every request launches an unbounded number of workers.

Separate the task's logical state from the queue's execution lease. A task may remain pending while several attempts fail. The queue should prevent stale attempts from overwriting a newer result, and the task contract should prevent duplicate external effects even when an attempt is retried.

The course's `JobQueue` is a small SQLite example with leases and monotonically increasing fencing epochs. It demonstrates stale-worker rejection under a single local database. It does not implement a distributed broker or guarantee that arbitrary external services honor fencing.

## Leases and fencing

A lease gives a worker temporary ownership. If it expires, another worker can claim the job. The old worker may still be running because a pause or network partition prevented it from observing expiry. Therefore ownership cannot be enforced only by the worker's local belief.

Each claim increments an epoch. The result write must match the current owner and epoch and occur before lease expiry. A stale worker holding epoch 1 cannot complete a job now owned under epoch 2. External effects need their own idempotency or fencing enforcement; rejecting a queue result cannot undo an already committed write elsewhere.

Worked trace: A claims at time 0 with expiry 5 and epoch 1. At time 6, B claims with epoch 2. A's completion at time 7 is rejected. B's completion at time 7 is accepted. The job has one accepted result. This proves the local completion rule, not universal exactly-once execution.

## Budget reservation

If workers independently check a shared remaining budget and then spend, they can oversubscribe it. Reserve before dispatching. Settle actual usage afterward and release unused reservation. Track coordinator, worker, verifier, retry, and environment costs.

The teaching `Budget` assumes one trusted owner serializes reservation and settlement. A production concurrent implementation needs atomic accounting and reservation identities so one worker cannot settle another worker's allocation. Explain this limitation before transferring the example into a service.

For a budget of 100 units, reserve 60 for worker A. A concurrent request for 50 must be denied or reduced because only 40 remain available. If A spends 35, settlement releases 25 and leaves 65 available. Do not confuse reserved capacity with actual spend.

## Queueing and tail behavior

When arrivals exceed service capacity, the queue grows even if individual model calls are fast. Parallel workers can reduce a task's critical path while increasing system-wide load. Capacity planning needs the distribution of task fan-out, retries, and long-running outliers.

Lab 10 uses deterministic FIFO scheduling with fixed service time. Four jobs arriving at time 0, each requiring 10 seconds, have latencies 10, 20, 30, and 40 with one worker. With two workers they have latencies 10, 10, 20, and 20. This is a transparent scheduling example, not a stochastic queueing forecast.

Real systems need measured arrival and service distributions, dependency bottlenecks, rate limits, and cancellation behavior. Report p50 and tail latency for complete tasks, including queue time. A model-call latency dashboard alone can miss the delay users experience.

## Trace the task, not just the API call

Use task, run, attempt, operation, and artifact identifiers consistently. Record transition decisions, tool arguments after safe redaction, result categories, budget changes, and verification evidence. Link model calls to the state and context version that produced them.

Observability should help answer a causal question: why did the system take this action, which evidence was available, what boundary permitted it, and what actually happened? A long transcript is useful raw material but not a substitute for structured events.

Metrics reveal rates; traces explain instances. Keep counters for outcome categories, duplicate suppression, stale-write rejection, approval denial, budget exhaustion, and reconciliation. Sample or redact content deliberately rather than collecting secrets by default.

## Practice and acceptance

Run Lab 10, recreate the lease trace, and change the worker count in the queue visual. Then explain why queue-level deduplication cannot replace effect-level idempotency. Add a proposed event schema for the crash window from Lesson 9.

You pass when an operator can reconstruct a failed task from your evidence, and when budget and cancellation policies remain valid under concurrent work rather than only in a sequential happy path.
