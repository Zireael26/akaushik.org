# Lesson 2: State, Control, and Observable Execution

## A state machine with an uncertain policy

The defining property of an agent is not that every step is nondeterministic. Most useful systems mix ordinary state transitions with a model that chooses among permitted actions. Consider a refund assistant. Input validation, tenant resolution, amount arithmetic, audit recording, and database uniqueness can be deterministic. Choosing whether a customer needs clarification might depend on language understanding. The architecture should make that boundary explicit rather than describing the entire application as a single intelligent component.

Write a run as a trajectory of observations, proposals, decisions, and effects. The proposal is what the model requested. The decision is what the executor permitted. The effect is what changed. The observation is what the system learned. These may disagree: a permitted call can fail, a timed-out call can succeed remotely, and a final claim can contradict the authoritative state. A trace that records only prompts and answers cannot resolve those differences.

Use distinct identifiers. A task ID names the business objective. A run ID identifies one execution attempt or invocation. A tool-call ID correlates a request and its result. A business-operation key identifies the effect that must not be duplicated. A graph thread identifies persisted execution state. Reusing a run ID as an idempotency key can be wrong when a run contains several legitimate effects; using a fresh run ID on every retry can be wrong when retries must refer to one effect.

## What belongs in state

A useful state contains a task contract, current status, evidence references, unresolved questions, pending operations, and consumed budget. It may also contain a transcript, but the transcript should not be the only representation of a structured business fact. If the refund amount appears in three messages, the executor must not guess which one is authoritative.

Divide state by ownership. The task contract belongs to the request and authorization layer. The proposed plan belongs to the planning policy. Evidence belongs to the observation pipeline. Actual payment status belongs to the payment service. A verifier produces an assessment; it does not overwrite the external truth to make its assessment correct. This distinction avoids a common design error: letting a model write a field called `verified` and then trusting that field as verification.

In the course runtime, immutable records are represented by frozen dataclasses or freshly constructed values. Mutable database state remains behind service methods. This is not a requirement to use a particular programming style. The purpose is to make accidental authority transfer visible in the interfaces.

## Closed-loop control

An open-loop plan specifies actions and executes them without adjusting to new observations. A closed-loop controller observes results and changes its next action. An agent asked to edit a file, run tests, and repair failures is operating a feedback loop. If it continues with its original plan after a tool reports that the file does not exist, it has stopped using feedback even though it continues producing text.

A practical form of receding-horizon planning commits to a small next step, executes it, and replans from the updated state. This can reduce error propagation, but planning itself consumes budget. Replanning after every trivial read can also be wasteful. Choose the boundary according to uncertainty and consequence. A deterministic file existence check does not require a committee; a changed API contract may invalidate several planned edits.

Let U be the utility of completing the task and C the resource cost. A candidate next action is attractive when its expected improvement in task utility exceeds its cost and risk under the system's constraints. This is a decision model, not a formula that a model's stated confidence automatically supplies. The required probabilities must come from calibrated evidence or conservative assumptions.

## Worked trace

A task requests a 2,400-cent refund of order-7 for tenant-A. The run starts with an approved intent and two tool calls remaining.

| Event | Recorded observation | Required interpretation |
| --- | --- | --- |
| Read order | Paid 2,400 cents; no refund | Mutation may be applicable; authorization remains separate. |
| Request refund | Valid payload; correct tenant | A proposal eligible for executor checks. |
| Backend commits | Receipt R-1 exists | An external effect has happened. |
| Response lost | Client sees timeout | The result is uncertain to the caller; failure is not established. |
| Retry admitted | Same business-operation key | The effect service should reconcile or deduplicate. |
| Final verification | One receipt for 2,400 cents | The required state is established under the fixture's rules. |

The timeout is an observation about communication, not a negative acknowledgment from the backend. This single distinction explains why ordinary retry decorators can be dangerous around mutations. It also explains why an operations trace must correlate backend receipts with attempted tool calls.

## Budget and terminal-state design

A run can stop because it succeeded, because a required fact is missing, because authority was denied, because it exhausted resources, or because its outcome needs reconciliation. These states should be explicit. A model that reaches its token limit should not be rewarded for replacing uncertainty with a completion claim.

The budget owner should count attempts, including rejected or failed calls where they consume resources. If retries are controlled in both the graph and the HTTP adapter, the maximum attempts can multiply. Three graph attempts with three client retries can produce nine remote requests. Document the unit at each level and choose one owner for the overall ceiling.

Cancellation is also a transition. It prevents future work where possible; it cannot erase an already committed effect. A clean cancelled result therefore records what was stopped, what had already happened, and what requires compensation or reconciliation.

## Trace design as an engineering interface

Use structured events with event type, task and run identities, parent span, timestamps, duration, model or tool version, outcome, and evidence pointers. Separate sensitive payloads from metadata so an operational dashboard does not need unrestricted access to customer content. A trace can point to an encrypted artifact whose access is controlled independently.

Elapsed time should use a monotonic clock inside a process. Wall-clock timestamps are useful for correlation but can move and differ across machines. Do not infer causal order solely from timestamps. Parent-child relationships and explicit dependency IDs carry stronger information. A worker may finish earlier but its result may be accepted later after a version check.

A model's hidden internal computation is not available merely because you have a trace. Record observable inputs, outputs, decisions, tools, and results. Avoid presenting generated explanations as an authoritative causal account of why the model chose an action.

## Practice and acceptance

Run the starter harness's successful and false-claim cases. Then implement a trace projection that shows only business status and evidence, excluding internal prompts. Explain why that projection is different from deleting the underlying audit record. Introduce one timeout after an effect and write the exact state transition you expect before executing the durable-effects lab.

The lab is complete when you can reconstruct a run without trusting its final narrative. Your explanation must identify a source of authority, a source of truth, the budget owner, and the policy for an unknown outcome. The solution manual provides a worked trace analysis and the lab suite supplies executable examples; neither depends on a future teaching session.

## Reading

[OpenAI's agent-loop walkthrough](https://openai.com/index/unrolling-the-codex-agent-loop/) provides a concrete implementation account. The state contracts and examples above are original course designs, and their properties are tested in the included labs.
