# Lesson 16: Memory, Retrieval, and Large-Context Computation

## Memory is a set of policies

Persistent storage does not become useful memory merely because an agent can search it. You need separate rules for writing, retaining, retrieving, resolving contradictions, and deleting records. A stored claim must include scope, source, observation time, and validity conditions. Otherwise yesterday's guess can become today's apparently authoritative fact.

Distinguish episodic evidence about a particular run, semantic knowledge about a domain, procedural strategies, and user preferences. They have different lifetimes and authority. A successful debugging tactic can be worth retaining without treating every factual claim in the same transcript as reusable knowledge.

Our `MemoryStore` uses SQLite and explicit tenant, subject, source, observation, expiry, and deletion fields. It is intentionally small. It demonstrates filtering and lifecycle, not semantic search quality, distributed deletion, or enterprise access control.

## Write gates and contamination

A memory write should answer: what was observed, by whom, where, with what confidence, and why should it affect future work? Avoid writing every generated sentence. A mistaken explanation can be more harmful when repeated across many future tasks than when confined to one run.

Treat external instructions as external even after summarization. A reflection that says “the webpage taught me to bypass approval” must not become a procedural rule. Provenance and authority should survive transformation. The harness decides whether a candidate memory is eligible; the model can propose the content.

Procedural updates need evaluation. ACE's evolving playbook is a useful research mechanism to study, but harmful updates remain possible. The research report discusses the tested stress cases and their limits. [ACE paper](https://arxiv.org/html/2510.04618v3).

## Retrieval is scoped computation

Apply tenant and access filters before ranking whenever the storage architecture permits it. Filtering only the final displayed result can still expose unauthorized records to a model or an intermediate ranking service. A similarity score is not an authorization decision.

Then rank for the current objective and preserve enough evidence to inspect the result. Useful signals include relevance, freshness, source quality, and whether the record conflicts with a newer authoritative observation. Avoid collapsing these into an unexplained scalar when the decision has material consequences.

A retrieval miss and absence of a fact are different. If a query returns no record, the system should not claim the fact is false unless the data source and query contract support that conclusion. This distinction matters in product support and compliance-sensitive workflows.

## Expiry, contradiction, and deletion

Our store considers a record active only when it belongs to the tenant, has been observed by the query time, has not expired, and is not tombstoned. At the exact expiry time it is unavailable. Boundary behavior should be explicit and tested.

A tombstone prevents the local example from resurrecting the same identifier through an upsert. In a distributed system, deletion may also need to propagate to indexes, replicas, caches, backups, and derived summaries. A local delete test does not prove global erasure.

For contradictions, avoid selecting whichever statement was written last without inspecting provenance. A newer untrusted comment need not overrule an older authoritative record. Store competing observations and define a resolution policy appropriate to the domain. Sometimes the correct output is uncertainty and a request for fresh evidence.

## Computation over large inputs

When the input exceeds a practical model context, move some work into an external environment. Retrieve relevant subsets, inspect structured data with code, or divide the corpus into bounded subproblems. A summary is useful only if it preserves the information required for the objective.

Recursive Language Models study an approach in which models inspect externalized inputs and make recursive subcalls. [RLM paper](https://arxiv.org/html/2512.24601v3). The course's `bounded_map_reduce` is a deterministic teaching analogue for coverage and budgets. It is not an implementation or reproduction of that paper's model-driven recursion.

For 23 records and batch size 5, full coverage requires 5 classifier calls. A maximum of 4 calls cannot complete the declared task. Reject or renegotiate the coverage requirement before processing, rather than silently returning a partial count as complete. If early stopping is permitted, define what uncertainty or partiality must be reported.

## A worked lifecycle

At time 10, tenant A stores a policy observation expiring at time 30. At time 20, tenant B asks about the same subject and receives nothing. At time 25, tenant A retrieves the observation with its source. At time 30, the observation is expired. A later deletion tombstones it, and a write with the same identifier is rejected by the example.

The lifecycle establishes scope and time semantics. It does not establish that the stored policy was true. Verification of content is a separate step, and the interface should make that distinction visible.

## Practice and acceptance

Lab 8 exercises expiry, future observations, tenant filtering, deletion, and bounded coverage. Propose a contradiction policy for two sources with different authority and dates. Then calculate the minimum call budget for a larger corpus and identify which claims require inspecting every record.

You pass when you can explain why more memory can reduce quality, why deletion is more than removing a row, and which part of a large-context task can be answered exactly with code rather than another model call.
