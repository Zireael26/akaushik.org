# Lesson 10: Approvals and Compatible Change

## An approval authorizes a particular action

A boolean called approved is rarely an adequate authorization artifact. What was approved, by whom, for which tenant, under which policy, and for how long? If an agent changes the amount after receiving a decision, the original approval should not automatically apply. If a user loses authority before execution, an old positive decision may no longer be sufficient.

Represent a proposed operation as a canonical intent. Include the operation type, resource identity, tenant, normalized arguments, and relevant policy version. Compute a digest over this canonical representation. Store the decision against that digest with the actor, decision time, expiry, and revocation state. The executor compares the proposed operation with the approved one and rechecks current authority.

Canonicalization matters. If semantically identical payloads serialize differently, their digests may differ. If semantically different payloads are normalized incorrectly into the same representation, the binding is unsafe. The course uses integer cents and sorted JSON for a deliberately narrow schema. A production schema needs explicit treatment of optional fields, currencies, timestamps, and semantic equivalence.

## Interrupts and re-entry

A LangGraph interrupt pauses for external input, but resuming restarts the containing node. Code before the interrupt can run again. This is documented behavior and is exercised in the course's SQLite-backed example. [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts).

Put effectful work behind the authorization boundary and give it independently correct replay semantics. Moving an effect after the interrupt prevents execution before a decision, but it does not protect against a later crash after the effect. The effect service still needs idempotency or reconciliation.

Avoid broad exception handling around runtime control-flow exceptions unless you understand what the runtime raises. Swallowing an interrupt can turn an intended pause into unexpected continuation or failure. Multiple interrupts also require stable matching semantics. The lesson's basic graph uses one approval decision per intent so the control flow is easy to inspect.

## A decision is not a model suggestion

The model may draft an intent and explain its rationale. It may not write its own trusted approval record. The human-facing decision service validates the actor and stores the decision. In offline labs, a deterministic operator fixture performs that role. This simulates authority; it does not pretend to authenticate a real person.

A forged tool argument such as `approved=true` is rejected by strict input validation. A forged approval ID is rejected because no valid stored decision matches it. A real stored approval for a different tenant or payload is also rejected. These cases test different boundaries and should not be collapsed into one generic invalid-input example.

Rejection and revision are legitimate transitions. A rejected intent can terminate as denied. A revised intent gets a new digest and requires a matching decision. The old decision remains in the audit record; it does not become an approval of the revision.

## Worked approval race

At time 10, Alice approves a 2,400-cent refund for order-7 under policy revision 3, expiring at time 30. At time 12, the agent revises the amount to 3,000 cents. At time 13, the executor receives the old approval reference. The digest mismatch prevents execution before the payment service changes.

Now keep the original amount but execute at time 31. The decision has expired. The effect should not occur merely because the model says Alice already approved it. Finally, keep time 20 but revoke Alice's authority. Whether execution is allowed depends on the explicit current-authorization policy; the reference service rechecks and denies it.

These are not prompts to persuade the model to behave better. They are service invariants. The model can still make useful proposals, but the correctness of the boundary does not depend on its compliance.

## Checkpoint compatibility

An unfinished run may resume after new code is deployed. A renamed pending node, a newly required state field, or a changed interpretation of an old field can break recovery. Distinguish schema compatibility from behavioral compatibility. Successfully deserializing old state does not establish that executing it under new business rules is appropriate.

Use explicit state and policy versions. Prefer additive schema changes with defaults when they preserve meaning. For incompatible behavior, retain a compatibility path, migrate with a documented transformation, or terminate old work with a clear status. Do not silently reinterpret an old approval under a broader new policy.

LangGraph's backward-compatibility guidance describes these deployment concerns. The course migration workbench models them using old state fixtures and candidate transformations. [Backward compatibility](https://docs.langchain.com/oss/python/langgraph/backward-compatibility). The application-specific tests determine whether the old intended business behavior survives.

## Migration as a tested function

A migration should have a defined input version, output version, invariants, and failure policy. It should be idempotent or reject repeated application clearly. Preserve provenance about the original version. A migration that fills a missing permission field with `allow_all` may make every old record load successfully while violating the security contract.

The reference migration adds a status field with a conservative default and copies every existing field unchanged, including any intent digest. It rejects unknown future versions rather than guessing. The reference tests cover a version-1 record with a missing status and an unsupported version; an already migrated record and a completed operation are left for you to add. Fixtures like these are part of release evidence.

## Approval user experience

The review surface should show the exact action, target, amount, relevant evidence, and consequences that help the decision maker. It should not bury the important mutation among internal framework details. A clear refusal or request for a revised proposal is useful interaction, not an agent failure.

After execution, show the actual result and receipt. If the outcome is uncertain, state that and expose the reconciliation status. A user who approved a proposal should not have to infer whether it actually occurred from a generic completion message.

## Practice and acceptance

Run Lab 5 for a matching approval and duplicate delivery after restart. The changed-amount, expired, wrong-tenant, and revocation cases live in Lab 9 and the migration cases in Lab 10; both belong to later modules but need nothing you have not met yet, so run them now. Then resume the real LangGraph interrupt after closing and reopening the checkpoint database.

You pass when an old decision cannot authorize a changed action and when you can explain which code reruns after resumption. The solution manual includes a complete state transition table and the reference implementations are present in the package.
