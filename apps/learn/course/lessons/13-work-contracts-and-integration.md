# Lesson 13: Work Contracts and Artifact Integration

## Why a worker needs a contract

A delegated task is a small distributed job. Its instructions need enough information to determine whether the returned work belongs to the current request and whether it satisfies an acceptance condition. A role description such as “you are the research expert” answers neither question.

Use a task identifier, revision, owner, objective, authorized inputs, allowed actions, resource ceiling, output schema, acceptance rule, and cancellation rule. Include dependencies by artifact identifier or immutable hash. The worker should distinguish evidence it inspected from conclusions it inferred. A coordinator can then validate the output without interpreting a long conversation as a database.

Consider a pricing analysis delegated to worker W2. Task T17 revision 3 concerns the EU catalog dated September 1. The coordinator later updates the task to revision 4 because the catalog changed. A perfectly written revision-3 answer is now stale. Accepting it because W2 sounds confident creates an integration error. Revision checking must occur before synthesis.

## Separate task, attempt, and artifact identities

The task expresses a logical unit of work. An attempt expresses one execution of that task. An artifact expresses a produced result. Retrying a task should create a new attempt identifier while retaining the logical task identity. Content hashes identify exact bytes or canonical structured content; they do not establish who produced it or whether it is correct.

Our `WorkTask` example checks owner and revision, accepts one artifact, treats an identical redelivery as a duplicate, and rejects a conflicting result. This is one deliberately strict policy. A production system might allow several candidate artifacts, but would need an explicit selection record rather than silently replacing the accepted result.

Record acceptance separately from correctness. A message can be well formed, correctly addressed, and current yet contain a wrong claim. Integration checks membership and compatibility; a verifier checks the task's substantive outcome. Both are necessary.

## Ownership and cancellation

A single writer is often simpler than merge logic for a mutable object. Assign a worker ownership of an isolated branch, file set, or evidence partition. The coordinator owns integration. If two workers must modify the same interface, make that dependency explicit before they start.

Cancellation is a state transition, not a suggestion embedded in a chat message. After a task is cancelled, a late artifact must not be accepted as current work. Cancellation cannot reverse an external action that already committed. The runtime therefore needs cooperative checks before expensive calls and the tool service needs an authorization check before effects.

Worker failure should produce a terminal status with evidence: timed out, cancelled, rejected, or failed. Missing output should not become an empty successful result. Decide whether the coordinator can continue with partial coverage and how that limitation appears in the final response.

## Heterogeneous workers

Different models, tools, or execution environments can provide complementary capability. They also create incompatible schemas, error conventions, and trust assumptions. Put an adapter at each boundary. Normalize structured results while preserving raw provenance and the original error.

A specialist with access to a private database must not pass credentials to another agent. It can return a permitted artifact whose scope is enforced by the service. A stronger model acting as coordinator does not automatically make an insecure worker safe. Authority must remain bounded when messages cross the boundary.

Choose worker capability through measured task performance. “Planner,” “critic,” and “researcher” are useful names only if they correspond to distinct information, tools, or tested behavior. Assigning different names to identical prompts does not demonstrate specialization.

## A worked integration trace

Task T17 revision 4 is assigned to W2. W2 returns artifact A with the correct revision and an evidence table. The coordinator validates the envelope and stores hash H. A network retry delivers A again under a second attempt identifier. The coordinator returns `duplicate` and retains one accepted artifact.

Next, the original revision-3 worker finishes. Its artifact is rejected before synthesis. Finally, a different worker claims to have completed T17 revision 4. The owner check rejects the claim. None of these checks determines whether the price table is accurate; the verifier still compares its claims against authorized source records.

This trace gives four separate observations: current work accepted, identical delivery deduplicated, stale work rejected, unauthorized ownership rejected. A single “worker succeeded” counter would hide the distinctions.

## Coding integration

In software tasks, isolate branches or worktrees and agree on interface contracts. Integrate small changes in dependency order. Run acceptance checks after integration, because two individually valid patches can conflict through shared assumptions. A test pass on a worker branch is evidence about that branch, not the integrated repository.

Preserve the diff, base revision, test command, exit status, environment version, and limitations. Do not treat a worker's “all tests passed” sentence as equivalent to an execution record. If a test suite is flaky or incomplete, report that explicitly and improve the acceptance boundary.

## Practice and acceptance

Lab 7 exercises stale revisions, duplicate delivery, conflicting artifacts, and cancellation. Extend its task envelope with a dependency hash and reject a result built against an obsolete dependency. The workbook provides the scenario and the solution book explains the state transitions.

You pass when every accepted artifact can be traced to a current task and its inputs, and you can explain which checks establish transport validity, integration validity, and outcome validity. Related protocol background is in the [A2A specification](https://a2a-protocol.org/latest/specification/); our small local contract is a teaching model, not an A2A implementation.
