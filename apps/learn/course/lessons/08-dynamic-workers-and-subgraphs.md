# Lesson 8: Dynamic Workers and Subgraph Boundaries

## Dynamic work is a scheduling decision

A fixed graph can describe a known pipeline, but some tasks discover their work at runtime. A research request may reveal four independent sources to inspect. A repository change may identify three affected packages. Dynamic dispatch creates worker invocations from those discovered items. It does not remove the need for stable identities, budgets, ownership, and a join policy.

In LangGraph, Send supports dispatching work with per-worker input. Subgraphs package a related state machine and its boundary. These are runtime mechanisms; whether a worker contains an LLM, a deterministic parser, or a conventional function is a separate choice. A large agent count can merely describe many function calls, so explain what independence each worker actually provides.

The course dynamic example creates a bounded list of evidence jobs, dispatches one worker per job, merges records by job ID, and synthesizes only after the required set is accounted for. It has an explicit empty-work path. Empty fan-out is not an exceptional mystery: either the task can finish without workers or it should produce a defined insufficient-evidence result.

## A worker contract

A useful worker request includes task ID, parent ID, scope, input artifact references, permitted tools, budget, expected output schema, and completion condition. A result includes status, evidence, artifact revision, unresolved questions, and resource usage. The coordinator should not infer success solely from a fluent message.

Avoid copying the whole parent transcript into every worker by default. It increases cost, spreads irrelevant assumptions, and weakens context isolation. Supply the relevant contract and evidence, while preserving a way to request additional information. Context minimization is useful only if the worker still has enough information to do its job.

The output contract should be narrow enough to merge and rich enough to preserve uncertainty. For example, a worker can return supported claims with source IDs and an explicit unresolved list. A single unstructured summary makes it difficult to distinguish missing evidence from omitted detail.

## Lifecycle and persistence

A worker's role does not determine its state lifetime. A disposable investigator may need isolated per-invocation state. A continuing customer conversation may need state across turns. A durable business subworkflow may need recovery after process loss. Treat these as different contracts rather than giving every named specialist a permanent conversation history.

Current LangGraph documentation distinguishes subgraph persistence modes and warns about concurrent use of shared persistent namespaces. A parent checkpointer and the chosen child lifetime affect recovery behavior. [Subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs). The practical exercise is to name the ownership and lifetime of each state field before composing graphs.

A shared namespace can create a hidden coupling between otherwise independent workers. Two invocations that were intended to be isolated may update the same history. Conversely, a worker that requires continuity may lose it if every invocation gets a new identity. Stable business and invocation IDs help make this visible.

## Failure and joining

A coordinator must decide whether all workers are required, whether a quorum is sufficient, or whether partial evidence can support a qualified result. This is a task-level decision. Majority voting is not a generic substitute for an evidence requirement. If only one worker has the necessary source, three agreeing workers without it do not make the answer complete.

Define how failures return. A worker can fail because its input is invalid, its tool is unavailable, its budget is exhausted, or its evidence is contradictory. The coordinator may retry, replace the worker, ask for information, or terminate with partial results. An unconditional retry loop can amplify costs and reproduce the same mistake.

The join should account for every dispatched job: completed, failed, cancelled, or still pending. A missing result must not disappear from the denominator. A late result should be checked against the current task revision before it changes accepted output. Otherwise cancelled or superseded work can overwrite newer decisions.

## Worked dynamic fan-out

A request requires inspection of packages A, B, and C. The coordinator assigns revision R to all jobs. A finishes with evidence E-A; B times out; C finishes with E-C. A task requiring all package checks remains incomplete. The coordinator retries B under the remaining budget with the same logical job ID but a new attempt ID.

B then finishes, but a human has revised the task to R+1. The coordinator must decide whether B's evidence is still applicable. Blindly appending it is wrong if the revision changed the affected code. Preserve the result for audit, but accept it only under a compatibility rule. The protocol lab models this as a revision check that rejects stale completion.

If B's response arrives twice, equal duplicate results should not create two accepted jobs. Conflicting duplicates require investigation. This is why the evidence reducer and task-state machine are part of orchestration rather than implementation trivia.

## Parallelism and the critical path

For independent workers with durations t1, t2, and t3, ideal parallel completion time is approximately their maximum, plus dispatch and synthesis overhead. Sequential execution takes approximately their sum. Real systems add queueing, rate limits, tool contention, and communication. A parallel design may be faster while using more total compute.

Amdahl's law expresses the limit imposed by a serial fraction. If fraction f of the original time is inherently serial and the rest parallelizes perfectly across n workers, ideal speedup is 1/[f+(1−f)/n]. This is a model under strong assumptions, not a prediction for an arbitrary agent team. Use it to identify why a coordinator or shared bottleneck limits scaling, then measure the actual system.

## Practice and acceptance

Run Lab 4 with three workers, no workers, a duplicate job ID, and a missing required result. Inspect the scheduled jobs and merged state. Then use the topology visual to compare a fixed workflow and a supervisor under the same worker-call budget.

The additional trace cases ask you to design a join policy for an evidence task and a shared-state mutation task. The solutions differ because the tasks differ. You pass when every dispatched job has an accounted-for terminal status and when a stale or duplicate result cannot silently change the accepted artifact.

## Reading

Read the [Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) and [subgraph guide](https://docs.langchain.com/oss/python/langgraph/use-subgraphs) alongside the executed examples. The course's revision and ownership rules are application-level designs, not guarantees automatically supplied by the framework.
