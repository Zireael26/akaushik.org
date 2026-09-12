# Lesson 7: LangGraph State and Reducers

## Translate the mechanism, not the vocabulary

A framework should make an execution contract easier to express and inspect. Begin by identifying the contract in the direct loop: which state is supplied to each step, which updates it returns, which steps follow, and which conditions terminate the run. Then map those concepts into LangGraph. If the explanation relies only on names such as node and edge, the underlying behavior remains unclear.

LangGraph's StateGraph expresses stateful computation through nodes and transitions. Nodes return updates rather than requiring every node to reconstruct all state. Reducers define how updates to individual fields combine. The official Graph API documents these mechanisms; the course example verifies the selected behavior against its pinned installed release. [Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api).

The existing bridge example gathers an order observation and a ledger observation in parallel. It then proposes a final claim, verifies the actual fixture state, and routes to verified or needs-review. The same confident claim appears in every scenario. Different authoritative states produce different outcomes. That preserves the first lesson's central boundary inside a real framework.

## State schema as an interface

A transcript is not sufficient domain state. Use fields for order identity, evidence, proposed claim, verification result, and terminal status. The schema communicates what each node may read or update. It does not itself enforce all domain invariants. A valid string in `order_id` can still name the wrong tenant's record.

Keep authoritative business state outside model-controlled updates. In the bridge, the verifier reads an independent fixture representing the service. In the complete runtime, the product verifier reads SQLite service state. The model or scripted policy can propose an operation, but it cannot make a refund true by writing `refunded=true` into graph state.

Input and output projections deserve separate thought. Internal graph state can contain sensitive tool observations, prompts, and routing details. A user-facing stream should deliberately expose the appropriate subset. Defining a private field is not an excuse to assume every streaming mode will redact it automatically; inspect the actual emitted values in the pinned implementation.

## Reducers encode merge semantics

Suppose two workers return evidence dictionaries. An ordinary replacement rule can discard one worker's result. An append rule can retain both but duplicate records on replay. A keyed merge can deduplicate equal observations and reject conflicting values for the same identity. None of these is universally correct; choose the semantics of the field.

Three algebraic properties help. Associativity means regrouping merges does not change the result. Commutativity means merge order does not change the result. Idempotence means merging the same update again has no additional effect. A set union has all three properties. List concatenation is associative but neither commutative nor idempotent. A last-writer-wins register requires a trustworthy ordering policy if the result must be independent of arrival order.

The course reducer uses stable evidence IDs and rejects unequal values sharing one ID. For valid nonconflicting observations it behaves like a union. A conflict is deliberately an error rather than an arbitrary overwrite. This is a conservative teaching policy. A real evidence system may preserve both claims with distinct observation identities and ask a resolver to compare timestamps or provenance.

## Worked merge

Worker A returns `{order: paid}` and worker B returns `{ledger: empty}`. Their keys differ, so either merge order produces both observations. A repeated A result adds nothing. If A later returns `{order: refunded}` under the same immutable evidence ID, the reducer rejects the conflict. The correct repair is to represent a new observation revision, not to make the reducer silently choose whichever arrives last.

Notice that conflicting observations can both be legitimate if the external state changed between reads. Evidence identity should therefore include enough provenance to distinguish observation versions. The simplistic label `order` is useful for a classroom conflict example but insufficient for a long-running production evidence store.

The reducer workbench lets you reorder and duplicate updates under append, replacement, keyed union, and conflict rejection. Predict the result before pressing merge. The lesson is the relationship between field meaning and merge rule, not an aesthetic preference for dictionaries.

## Supersteps and barriers

Parallel execution creates a scheduling question: when may downstream work observe merged results? An explicit fan-in barrier states that both named branches must finish before the next node runs. Without the intended dependency, a proposal node may see incomplete evidence or run more often than expected.

The bridge uses an edge from both order and ledger readers to the proposal. Its test checks that proposal receives both evidence keys. That test captures an application requirement. A screenshot showing converging arrows would not establish that the actual code has the intended barrier.

When a branch returns no evidence, completion of the branch and completeness of evidence are different facts. The missing-evidence scenario completes its scheduling work but fails the evidence requirement. The terminal outcome is needs-review. This distinction helps avoid treating successful function execution as successful task completion.

## Routing and termination

Conditional routing should have an explicit set of outcomes. An unknown route is a programming error or a controlled failure, not permission to choose an arbitrary node. The course routes verified outcomes to a terminal success node and everything else to review. A more complete product may include denied, clarification, cancelled, and reconciliation states.

Dynamic routing commands and static edges can both schedule work. Do not add a static edge and assume a returned routing command automatically suppresses it. Lab 4 includes a prediction case for combined routing. Check the installed release's behavior and record the trace rather than relying on an intuitive drawing.

## Practice and acceptance

Run the six bridge tests, then run Lab 4's dynamic, combined-routing, and projected-subgraph cases. Lab 5's persistence case can be previewed now; Module 5 explains its checkpointer and interrupt semantics. Remove the evidence reducer and observe the parallel-write behavior. Restore it and introduce conflicting evidence. Reorder worker completion and confirm that nonconflicting output is stable.

Submit an ownership table for each field, the expected merged state, and a trace proving the barrier. The solution manual explains why append-only chat history is not a universal state model. You pass when you can predict state transitions before execution and explain any deviation using the actual code and runtime version.

## Reading

Use the [official Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) and the included pinned requirements. The reducer algebra, evidence contracts, and failure examples are original teaching designs, verified by the supplied tests.
