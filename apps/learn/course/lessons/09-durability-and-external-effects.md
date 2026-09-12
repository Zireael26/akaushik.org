# Lesson 9: Durability and External Effects

## There are several different things to persist

A durable event log preserves what was recorded. A checkpoint preserves a runtime's recoverable state. An artifact store preserves files or outputs. A business service preserves its own effects. These are different persistence domains. A checkpoint does not automatically contain a remote payment, and a saved transcript does not automatically recreate a destroyed execution environment.

The important question is not whether the system has persistence. Ask exactly what survives each failure and what may run again. A worker can crash before a request, after a request reaches a service, after the service commits, after receiving a response, or after recording its checkpoint. Each boundary creates a different recovery problem.

LangGraph's persistence mechanisms record graph state and completed work at documented boundaries. The course's actual SQLite-backed graph demonstrates restart and interrupt recovery. External-effect correctness still belongs to the application and the effect service. [Persistence documentation](https://docs.langchain.com/oss/python/langgraph/persistence).

## The uncertainty window

Suppose an effect service commits a refund and the caller crashes before saving its result. After restart, the caller sees a pending operation and no receipt. It cannot infer that the refund failed. Repeating the request with a new operation identity may create a second refund. Declaring success without checking may conceal a failure in a different run where the request never reached the service.

This is a cross-system ambiguity. Adding more confidence to the model's prompt does not resolve it. The system needs a protocol that identifies the operation and supports deduplication or reconciliation. If the remote service offers neither, some outcomes must remain unknown until an external process resolves them.

The course crash lab uses two SQLite stores: one representing the effect service and one representing the orchestrator checkpoint. The separation deliberately preserves the gap. In the unsafe case, replay creates two effects. In the protected case, the effect service atomically binds a stable business-operation key to the effect and returns the existing receipt on an equal repeat.

## Idempotency and payload binding

An idempotency key must represent a logical operation, not an execution attempt. Repeated attempts at that operation reuse the key. Different legitimate operations need different keys. The service also binds the key to a canonical payload digest. Reusing a key with a different amount or target is a conflict, not a request to silently return an unrelated old result.

The operation key is not authorization. A caller who knows a key should not gain permission to perform or inspect the operation. The service checks the principal and resource scope before returning protected information. Similarly, an approval is not an idempotency key: one describes authority and the other identifies effect identity.

A read-then-write check is insufficient under concurrency unless the check and write are protected by an appropriate transaction or atomic constraint. Two workers can both observe that a key is absent and then both apply an effect. The reference service uses a transaction and a uniqueness constraint. Its guarantee is limited to the modeled service transaction; it does not claim a universal exactly-once network execution guarantee.

## At-least-once delivery and exactly-once business meaning

A queue may deliver a message more than once. A worker may execute more than once. A business operation can still have one effective result if the receiving service enforces the correct identity and transaction semantics. Distinguish execution attempts from effective actions in every report.

Exactly-once is especially easy to misuse. A system may mean one committed database row, one delivered event, one handler invocation, or one externally visible action. Those are different claims. State the boundary and assumptions. In this course, the protected refund claim is one effect per stable operation key inside the transactional effect service, with equal retries returning the same receipt.

If a tool invokes another downstream service outside that transaction, a new uncertainty window appears. The same reasoning must be applied again. Nesting a remote call inside a local transaction does not make the remote service participate atomically.

## Outbox, inbox, and reconciliation

An outbox records an intended event in the same transaction as a local business change. A dispatcher later sends it and may retry. An inbox at the consumer records processed event identities to deduplicate handling. Together they can make event propagation robust under duplicate delivery, but they do not eliminate every downstream effect ambiguity.

Reconciliation compares authoritative service state with pending intentions. It can discover that an effect succeeded despite a missing acknowledgment, that a request never applied, or that the state changed in a way requiring human review. A reconciliation status is useful product information. It is preferable to converting every timeout into failure or success.

Compensation is a new business action intended to counter a prior action. It is not a database rollback across arbitrary systems. A refund may not be reversible; a sent message cannot be unsent in the same sense as reverting an uncommitted row. The product must define what corrective actions are allowed and how they are authorized.

## Worked crash matrix

| Failure point | What is known after restart | Appropriate next step |
| --- | --- | --- |
| Before request dispatch | No attempt reached the modeled service | Submit under the same logical operation ID. |
| After dispatch, before result | Effect outcome uncertain | Reuse supported identity or reconcile. |
| After effect commit, before checkpoint | Service changed; caller may not know | Recover the receipt without duplicating the effect. |
| After completed checkpoint | Recorded result available | Restore it; do not repeat completed work unnecessarily. |
| After task revision | Old intent may no longer apply | Check compatibility and authority before action. |

The matrix should be written before a retry policy is added. Otherwise a generic retry decorator often becomes the accidental business protocol.

## Replay discipline

Separate nondeterministic work from deterministic orchestration where the runtime expects replay compatibility. Model calls, time reads, random choices, and external effects can change between attempts. A durable runtime can restore recorded results, but unfinished operations may still run again. Inspect the exact framework semantics rather than assuming that a saved line number behaves like a suspended process.

Keep environment reconstruction separate. A code agent may restore graph state while its temporary filesystem has disappeared. It must recover the correct artifact revision and dependencies before continuing. A progress note naming a file is not proof that the file still exists or contains the same bytes.

## Practice and acceptance

Run the unsafe and protected scenarios in `starter-labs/02_durable_effects.py`, then Lab 5's persisted graph recovery, then change the amount while reusing the operation key. The service must reject the conflict. Restart the actual LangGraph example from a persisted interrupt and verify that it recovers the same intent. Inspect the separate effect and checkpoint databases.

You pass when your failure matrix accounts for every attempted operation and when your guarantee names its transaction boundary. The solution manual includes the expected receipts and explains the remote-service case the local demo cannot guarantee.
