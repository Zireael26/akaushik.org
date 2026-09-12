# Lesson 4: Tool Contracts, Skills, and Engineered Environments

## A tool changes the problem the model solves

Suppose an agent must find an overdue invoice. One interface exposes dozens of low-level database operations with undocumented relationships. Another exposes a bounded search returning invoice ID, tenant, due date, balance, and a continuation cursor. Both may reach the same data, but they impose different planning and interpretation burdens. Tool engineering therefore affects observed capability without changing the model's weights.

The objective is not always fewer tools. A very narrow tool can hide a necessary distinction or prevent a valid task. A single `do_everything` tool may save calls while making effects and failures impossible to inspect. Choose boundaries that correspond to meaningful domain operations and preserve the evidence needed to verify them.

An action contract has several layers. Syntax defines required fields and types. Semantics defines values such as positive amount and known currency. Preconditions define when the operation applies. Authorization defines who may invoke it on which resource. Effect semantics define what changes, how repeats behave, and which outcomes are uncertain. Output semantics define what the returned status actually establishes.

## Validation is not authorization

A request can be valid JSON, pass its schema, and still be forbidden. Conversely, a caller may have general permission but submit an invalid amount. Keep these cases separate so the agent receives useful recovery information and the audit record identifies the violated boundary.

Use exact types when the distinction matters. In Python, `bool` is a subclass of `int`; a loose `isinstance(value, int)` check accepts `True` as an amount. Floating-point NaN and infinity can also bypass ordinary range logic or corrupt cost summaries. The course reference validators reject booleans for integer money fields and require finite numeric costs. These are ordinary programming defects whose consequences become harder to see when a model generates the input.

Reject unexpected fields where a strict contract is intended. An `approved: true` property supplied by the model must not override an operator decision. The trusted adapter obtains the decision independently and binds it to the actual operation. A schema can describe the approval reference, but it cannot make an untrusted reference genuine.

## Error messages are observations

A useful error identifies a recoverable category. Compare `something went wrong` with `unknown order ID; search returned IDs before requesting a refund`. The second can guide recovery without granting new permission. Be careful not to reveal secrets or tenant existence through overly detailed errors.

Distinguish transient infrastructure failure, malformed arguments, semantic rejection, missing information, stale state, and policy denial. Retry transient failures under a bounded policy. Repair malformed input only when the contract is known. Refresh stale observations when allowed. Ask for missing information when it is necessary. Do not encourage a model to keep rephrasing a forbidden request until it slips through.

Pagination and partial results deserve explicit contracts. If a search returns ten records and a cursor, the absence of another record is not proof that it does not exist. Include completeness metadata and stable IDs. The model should not infer a population count from one page of examples.

## Programmatic execution

When a task needs filtering, joining, or aggregation over many records, generated code can operate on data without placing every intermediate value in context. This changes the execution boundary. The code needs a sandbox, bounded resources, controlled dependencies, and an explicit interface to permitted data and tools.

A code interpreter should not inherit all credentials of the orchestration service. A sandbox restricts execution, but a valid call through a privileged tool can still exceed the user's authority. Capability checks belong at the service boundary as well as the process boundary. The reference capstone keeps all generated or fixture-provided edits inside a temporary repository and invokes tests with an explicit working directory.

Programmatic execution also changes observability. Preserve the code artifact, input identifiers, result metadata, and execution status. A summary such as “processed the dataset” is not enough to establish coverage or correctness. The verifier may need the row count, excluded records, and a checksum or query specification.

## Skills as versioned procedures

A skill packages procedural knowledge and supporting resources. Its trigger decides when it enters the context. An overly broad trigger loads unrelated instructions; an overly narrow trigger misses the intended task. Evaluate trigger precision and recall on actual task descriptions, then evaluate the behavior after activation. Correct activation does not prove the skill's instructions are useful.

Use a short entry document that routes to deeper material when needed. Stable deterministic operations can live in scripts with their own tests. Instructions should specify an outcome and important constraints without accumulating every historical workaround. Current model-specific guidance recommends revisiting such accumulated instructions after upgrades, rather than treating them as permanent architecture. [OpenAI, September 2026](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

The exercise in this lesson does not create or install a personal Codex skill. It compares ordinary repository guidance fixtures supplied in the course. This keeps the experiment about context and behavior rather than modifying your development environment.

## Repository design as observation design

A development agent benefits from discoverable entry points, reproducible setup, meaningful tests, clear architectural boundaries, and access to the running application's evidence. If the agent cannot run the service or inspect a failure, a better instruction may not solve the problem. The environment withholds the feedback needed to close the loop.

Create a minimal repository map that identifies where domain rules, adapters, tests, and operational commands live. Turn stable invariants into executable checks. Keep a versioned record of why unusual constraints exist so a cleanup agent does not remove them as apparent redundancy. Avoid requiring every task to read every document; a typo fix and a persistence migration have different information needs.

## Worked tool redesign

The initial tool is `update_order(order_id, fields)`. It accepts arbitrary fields and returns `ok`. The proposed replacement is `propose_refund(order_id, amount_cents)` for a nonmutating intent, followed by an executor-owned `apply_approved_refund(intent_id)`. The split makes the proposed action reviewable and binds execution to a trusted stored intent.

This design adds state and calls. It is justified when a human decision or durable authorization is part of the product requirement. It would be excessive for a read-only formatting task. Compare the actual failure it prevents with the complexity it introduces. In the course product capstone, the intent boundary is necessary because changed amounts must invalidate old approvals.

## Practice and acceptance

Run the strict validator examples and add malformed inputs: unknown fields, booleans as integers, empty IDs, NaN cost, and a fabricated approval. Redesign one raw API into a domain tool while writing down a task that the new interface might make harder. Build an error-recovery table before changing the model prompt.

The solution manual includes a worked contract and counterexample. Completion requires a clear account of syntax, semantics, authority, effects, and verification. A JSON schema alone does not satisfy the assignment.

## Reading

[Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) and [code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) are useful engineering accounts. Their examples motivate experiments; the course does not assume every proposed tool simplification improves every model.
