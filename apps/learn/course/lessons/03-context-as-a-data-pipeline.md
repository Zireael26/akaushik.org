# Lesson 3: Context as a Data Pipeline

## The next call has an information requirement

A context window is a capacity limit. It does not tell you which facts are useful, which facts are trusted, or whether a model will use them correctly. Start with the next decision: what information would allow an appropriate action? An agent deciding whether to refund an order needs the relevant order, current policy, exact proposed remedy, and authority. It probably does not need every earlier customer conversation or the full schema of an unrelated warehouse.

Treat context construction as a compiler. The input is a collection of typed records with provenance, scope, freshness, and priority. The output is the observation for one model call. The compiler must either produce a valid observation or refuse to construct one under the current constraints. Silently dropping an essential restriction to fit a limit is a compilation failure disguised as success.

The compiler analogy is useful because it separates policies from formatting. Selection decides which records enter. Transformation may summarize or project them. Serialization decides how they appear. Validation checks that the required obligations remain represented. Logging records which evidence was supplied so an evaluator can later distinguish a retrieval failure from a reasoning failure.

## An explicit budget

Let W be the allowed context size, O the output reserve, and M mandatory input. Optional evidence has available capacity W minus O minus M. If that is negative, the call cannot be admitted under the stated rules. The appropriate response is to change the plan, retrieve a smaller validated projection, choose a different supported limit, or ask for clarification. It is not to pretend the missing obligations are unimportant.

In the interactive allocator, W is 32,768, O is 4,096, and mandatory policies, task, and tool facts total 7,500 tokens. The remaining optional capacity is 21,172. These are illustrative token counts, not tokenizer measurements. In a real adapter, count the actual serialization, including messages and tool schemas, and leave room for the provider's accounting behavior.

A deterministic priority order is a useful baseline. It is not necessarily the best policy. Evidence can be complementary: two records together establish an answer while either alone is misleading. A greedy ranking by individual relevance may omit the second record. The appropriate evaluation includes evidence coverage and task outcomes, not just the average relevance score of retrieved chunks.

## Mandatory does not mean trusted

A tool result may be mandatory because the task cannot be answered without considering it. Its free text is still untrusted input. Preserving a malicious instruction in a document for analysis must not promote it into governing authority. Store trust labels outside the text that the source can edit.

A useful record contains an ID, source, tenant, observation time, content hash, retrieval reason, and trust category. The exact categories depend on the application. A policy record approved by your service and a webpage claiming to be that policy must remain distinguishable even if their text is identical. A worker summary should preserve the distinction rather than laundering the webpage into a coordinator instruction.

The compiler can serialize evidence under clearly identified boundaries, but text boundaries are not security enforcement. The executor must still check resource scope. If a retrieved record persuades the model to request another tenant's data, the request should fail outside the model.

## Retrieval, full context, and dense aggregation

Sparse retrieval works well when a small subset of records answers a question. Dense aggregation requires examining much or all of a dataset. Asking for the latest policy clause is different from asking how many of ten thousand incidents meet a semantic condition. A top-k retrieval system can return excellent examples and still give a biased count because it did not inspect the population.

For a sparse task, measure whether the necessary evidence was retrieved and whether the answer uses it correctly. For a dense task, define coverage: which records were processed, which were omitted, and whether partial results can be combined. Programmatic batching and structured intermediate results often make coverage easier to inspect than placing the entire corpus in one conversation.

The course memory and recursive-processing labs deliberately distinguish these tasks. A retrieval index answers an evidence-location question. A batch map/reduce pipeline answers a coverage question. The model can participate in both, but the system needs different acceptance checks.

## Compaction as a lossy transformation

Compaction is useful when most prior detail is no longer relevant. It is dangerous when an apparently minor early fact becomes a later dependency. An agent fixing a parser may discover late that backward compatibility with one obscure input form is required. A summary that retained the main goal but dropped that exception changes the problem.

Use structured compaction with explicit fields: established facts and evidence IDs, unresolved questions, current artifact revision, pending actions, constraints, and next verification. Preserve recoverable references rather than trying to reproduce every detail. The summary is an index into evidence, not an infallible replacement for it.

Evaluate compaction with delayed-dependency cases. Place an important fact early, introduce a long distractor sequence, and require that fact later. Measure retention separately from final task success. A failed task may retain the fact but reason incorrectly; a successful answer might guess correctly despite losing it. Those cases imply different repairs.

## Worked selection example

Assume mandatory input consumes 30 units of a 100-unit budget, and output reserves 20. Optional evidence consists of A costing 30, B costing 25, and C costing 20. A and C together establish the answer, while B is a high-similarity distractor. Ranking by similarity might admit B and C, leaving A out. A dependency-aware policy admits A and C exactly.

This does not prove that dependency-aware retrieval is generally superior: the dependency signal could be expensive or wrong. It gives a falsifiable hypothesis. Compare both policies on tasks where dependencies are known, record their selection cost, and include cases where the dependency detector fails. The lab's simple priority selector is intentionally inspectable so you can see what a more sophisticated policy must earn.

## Cache stability and changing evidence

A stable instruction prefix can improve cache reuse, while frequently changing user evidence belongs later in the constructed input where supported. But cache optimization must preserve correctness. A cached business result keyed only by the question can leak across tenants or return stale state. A model prompt cache and an application answer cache are different mechanisms with different invalidation requirements.

Record the context-policy version and selected evidence IDs for each run. When a model changes, rerun the same evidence-selection experiments; the best trade-off between upfront context and tool-based discovery may change. Avoid treating a model's larger advertised window as proof that all old context policies should be removed.

## Practice and acceptance

Run Lab 2 with the default budget, then lower it below mandatory capacity. Confirm that the compiler rejects the call rather than truncating mandatory inputs. Add two evidence records that must be admitted together and implement a grouped selection policy. Compare it with greedy priority on the supplied cases. The solution explains both the benefit and a counterexample.

You pass when you can account for every admitted and omitted record, preserve provenance, and distinguish memory, authoritative state, and active context. Use the context visual to predict the admitted records before running the code.

## Reading

[Anthropic's context-engineering account](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) motivates the selection problem. [Recursive Language Models](https://arxiv.org/html/2512.24601v3) provides a research treatment of programmatic access to long inputs. The compiler and numerical examples here are original teaching constructions.
