# Lesson 11: Choosing a Multi-Agent Topology

## Define the independence you want

Another agent can provide a separate context, a different model capability, access to a specialized tool, parallel work, or an independent attempt at a problem. Those benefits are distinct. A second conversational persona with the same evidence and the same assumptions may provide little useful independence while adding cost.

Start with the task dependency graph. Which pieces can proceed without waiting for each other? Which share mutable state? Which produce artifacts that must be integrated? Which require one actor to own the final decision? A topology should follow these properties rather than a preference for a large team.

A sequential shared-state task often begins with one agent and structured tools. Independent evidence gathering may justify bounded workers and one synthesis owner. Multiple candidate solutions may justify independent sampling followed by selection. A fixed pipeline may be best represented by deterministic routing with local model calls. These are starting hypotheses to evaluate, not universal rules.

## Supervisor and workers

A supervisor decomposes work, dispatches workers, monitors results, and synthesizes or integrates them. Its value comes from those functions. Its costs include planning calls, repeated context, scheduling delay, and mistakes in decomposition. If the work can be partitioned deterministically, an LLM supervisor may be unnecessary.

The supervisor should own the integration contract. Workers own bounded artifacts or evidence collection. Shared mutable files require explicit coordination or isolated workspaces. If every worker can modify every file, parallelism can create merge conflicts and invalidate other workers' observations.

A worker that discovers a dependency should report it rather than silently expanding scope. The supervisor can update the work graph under the global budget. Unbounded recursive delegation turns a local decision into uncontrolled resource allocation.

## Independent proposals and selection

Independent attempts can improve the chance that one candidate is useful. To preserve diversity, do not expose every worker to the first answer before it produces its own. Early sharing can anchor all candidates on the same mistake. Later comparison may still help if it introduces evidence or identifies a verifiable discrepancy.

Selection needs a credible verifier. Majority agreement is useful only under assumptions about error patterns and task structure. If all models repeat the same false source, voting amplifies confidence rather than truth. A deterministic test or new observation can be more valuable than another round of discussion.

Measure candidate diversity in terms relevant to the task: distinct evidence, different failure modes, different solution strategies, or different verified outcomes. Surface wording diversity is not enough. Two differently phrased answers can depend on the same incorrect premise.

## Pipelines, handoffs, and blackboards

A pipeline passes a typed artifact through specialized stages. It is useful when each stage has a clear input and output contract. A handoff transfers responsibility for an ongoing interaction. A worker call returns responsibility to the caller. Confusing the two can create multiple agents that each believe they own the user's final answer.

A blackboard is shared structured state where components contribute observations or partial results. It can reduce repeated message broadcasting, but it requires ownership, versioning, and conflict rules. Shared state is not automatically shared understanding. Workers may read stale versions or interpret fields differently.

The course work-contract lab uses explicit task IDs, revisions, statuses, and artifact hashes. It rejects stale results and conflicting duplicate completions. These mechanisms are useful across frameworks because they express business coordination rather than a library-specific chat format.

## Critical-path arithmetic

Suppose four independent worker tasks each take 8 seconds. A supervisor requires 3 seconds to dispatch and 5 seconds to synthesize. Ideal parallel elapsed time is 3+8+5=16 seconds. Sequential worker execution with the same overhead takes 40 seconds. Total worker compute remains 32 seconds, and the supervisor adds its own cost.

Now suppose the workers all call one rate-limited service that serializes requests. The apparent parallel graph may not reduce elapsed time. Or suppose each worker needs the previous worker's output. The task is sequential even if four agents are named. A visual fan-out is not evidence of independent work.

Communication can grow rapidly. An all-to-all round among n workers creates n(n−1) directed message copies under a simple broadcast model. A coordinator pattern creates a different number and size of messages. These are topology calculations, not token-cost predictions until message sizes and model calls are specified.

## Worked architecture choice

Task A asks for evidence about four unrelated product incidents. Workers can inspect different logs independently and return evidence IDs. A bounded fan-out with deterministic deduplication and one synthesis owner is a reasonable candidate.

Task B asks for a sequence of inventory transfers where each action changes the feasibility of the next. Independent workers proposing transfers from stale shared state can conflict. Start with a sequential controller and an authoritative inventory tool. Parallelize read-only investigation only where it does not invalidate the action sequence.

Task C asks for a code patch. Independent workers can investigate separate hypotheses or propose isolated patches. One integration owner selects or combines them against the same repository revision and independent tests. Uncoordinated edits to one working tree are not the necessary price of using multiple agents.

## Practice and acceptance

Use Lab 6 to compare sequential, parallel, supervisor, and debate scheduling under explicit assumptions. Then use the capstone fixtures to choose one topology for a decomposable evidence task and another for a shared-state task. Write the expected benefit before measuring.

The workbook requires a strong simple baseline and a failure case for your preferred topology. The solution shows why a valid result can favor fewer agents. You pass when agent count follows a defensible task and resource model.

## Reading

[How Anthropic built a multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) provides a production account. [Towards a Science of Scaling Agent Systems](https://arxiv.org/html/2512.08296v1) supplies task-dependent empirical comparisons. Their results motivate experiments; they do not certify a universal topology.
