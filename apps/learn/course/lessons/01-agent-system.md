# Lesson 1: The Model Is One Component of the Agent

## The system we are engineering

Suppose you ask an agent to fix a bug in a service. It reads the issue, opens files, edits a function, runs a test, and says the bug is fixed. The visible conversation looks like reasoning followed by action. As an engineer, however, you need to explain several distinct events. Which repository revision did it inspect? Was the test relevant? Did the test actually run to completion? Were changes made outside the permitted scope? If the process stopped halfway through, which facts and effects would remain?

The model alone answers none of those operational questions. The system around it decides which observations it receives, which tools it can request, how requests are validated, what executes, what survives interruption, and what counts as completion. We will call that executable system the harness. The term is used with different boundaries in practice; our working definition deliberately includes the control loop and its interfaces to context, tools, policy, state, and verification. Repository and sandbox design are closely related environment engineering. OpenAI's loop walkthrough and Anthropic's harness accounts supply concrete examples of this surrounding machinery.[1](https://openai.com/index/unrolling-the-codex-agent-loop/) [2](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

This definition immediately changes the optimization target. We are not trying to produce the most sophisticated-looking conversation. We are trying to produce verified outcomes under constraints, repeatedly. Sometimes the right change is a different model. Sometimes it is a better tool error, a shorter observation, a deterministic validation step, an extra source of evidence, or removing a planning phase that no longer helps.

The first skill is therefore decomposition: identify what each component owns and what evidence tells you that it worked. The second is experimentation: change one mechanism and measure the resulting system. Those two skills remain useful when frameworks and models change.

## A compact formal model

Let x_t denote the relevant external world at time t: files, records, processes, permissions, and other facts. The agent generally does not observe all of x_t. Let s_t denote the harness's recorded state, such as the goal, history, remaining budget, pending operations, and known evidence. These are different objects. A database can change while the harness's last observation remains stale.

The context builder C constructs an observation c_t from recorded state, selected external observations, instructions, tool contracts, and memory. The model policy proposes action a_t conditional on c_t. The executor checks whether that proposal is structurally valid and authorized, then may apply it to the environment. It returns observation o_(t+1), which the state updater incorporates into s_(t+1).

In compact notation:

```text
c_t = C(s_t, observations_t, task, policy)
a_t ~ model(c_t)
if allowed(a_t, task, actor, current_policy):
    o_(t+1) = execute(a_t)
else:
    o_(t+1) = denial(a_t)
s_(t+1) = update(s_t, a_t, o_(t+1))
```

This is conceptual pseudocode, not a claim that tool execution and state recording occur atomically. That gap becomes a central topic in durable execution. Also notice that allowed is a function owned by the system. A model may be asked to avoid forbidden actions, but a generated promise is not access control.

Termination is another system decision. The agent can propose that it is finished. The harness must classify the run using a completion predicate, a verifier, or an explicit handoff. Legitimate terminal states include verified success, denied, needs information, exhausted, cancelled, failed, and unknown pending reconciliation. Compressing all of these into a success boolean loses operational information.

In a partially observed environment, additional observation is itself a useful action. If an order might already have been refunded, reading the authoritative refund state can be more valuable than generating a longer plan. If a test process timed out, reading the process status can be more valuable than launching a second copy. The skill is not merely choosing actions; it is choosing observations that resolve consequential uncertainty.

## State is not context

Consider a task with 2,000 tool events. The durable record may contain all of them. The model context may contain the task contract, the current work queue, the last two tool results, a summary, and references to earlier artifacts. Memory may contain a reusable fact learned in a prior task. External state may contain the actual repository and database. These have different purposes and different correctness requirements.

| Object | Purpose | Typical failure |
| --- | --- | --- |
| External state | What actually exists or happened | Changed since the last read |
| Durable execution record | What the system recorded about the run | Missing an acknowledgment after an effect |
| Active context | What the next model call can see | Omits a late-relevant constraint |
| Long-term memory | Information selected for reuse | Stale, ungrounded, or scoped to the wrong tenant |
| Task contract | What outcome and authority apply | Ambiguous or silently changed |

A context summary is not a source of truth merely because it is persistent. It is a transformation of observations that can omit or misstate them. A robust design preserves pointers to important evidence so the model or verifier can inspect the underlying artifact when uncertainty matters. Context engineering literature emphasizes retrieval, compaction, and external notes as different strategies with trade-offs, rather than a single universal recipe.[3](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

This separation also makes model upgrades easier. You can change how a context is assembled without changing the business record. You can change a model adapter without changing the task verifier. You can rebuild an execution environment from an artifact without replaying every sentence of the previous conversation.

## A worked example: the refund that never happened

Use a synthetic operations task: an operator asks the agent to refund a specific eligible order. The authority is supplied by the environment, outside the model response. The backend contains the order, its eligibility, and its refund state. The desired result is an authorized refund for the correct order and amount, with no duplicate or unrelated effect.

An unsafe system considers the run successful when the final answer contains a completion message. A scripted policy can exploit this accidentally by returning “Refund completed” immediately. The user sees a confident message, but the authoritative state remains unchanged. Nothing about the wording establishes that the refund exists.

The corrected system separates the model's final claim from the verifier's decision. The verifier inspects the authoritative state and the effect record. If the refund does not exist, success is false even if the answer is fluent. If a refund exists but the operator did not authorize it, the task also fails. Correctness includes both the requested outcome and the constraints on how it may be achieved.

The starter harness demonstrates exactly these cases with deterministic scripted policies. It does not make network calls or real refunds. Run the scenarios in labs/README.md and compare the accepted and rejected transitions. The scripted model is useful here because we are isolating control-flow correctness from model capability.

Now imagine a stronger model that usually follows the instructions. The authorization and verifier remain necessary because the system must handle both model mistakes and software failures. Conversely, if the model never selects the right read tool, perfect authorization cannot solve the task. Different boundaries solve different problems.

## What a tool contract needs

A tool is not just a function name plus JSON. It is an action interface. For a mutation, specify the target, argument types, preconditions, caller scope, authority source, idempotency semantics, output meaning, and possible errors. For a read, specify the scope, freshness, pagination, completeness, and provenance of the returned data.

Suppose a tool returns an empty list. Does that mean there are no matches, the caller lacks access, the request failed, or only the first page was empty? If these cases are indistinguishable, the model must guess. Improving the contract can improve behavior without changing the model. Anthropic's tool engineering guidance explicitly treats realistic end-to-end task outcomes as the evaluation target.[4](https://www.anthropic.com/engineering/writing-tools-for-agents)

For the starter lab, inspect the schema validation before execution. Try a wrong argument name, a boolean where an integer is expected, an extra field, and a fabricated approval value. Ask whether each failure is a malformed request, a policy denial, or an execution error. These distinctions determine the recovery action. Retrying a policy denial with the same arguments should not be treated like retrying a transient timeout.

The model should see enough error information to recover within its authority. It should not be allowed to write its own authorization evidence. A tool result can say that a backend requires approval, but the system must obtain the actual decision from a trusted channel and bind it to the action.

## Budgets are control rules

A loop that can keep calling tools indefinitely is incomplete. At minimum, decide the maximum number of model turns, tool executions, elapsed time, and spend. A practical system also limits concurrency, recursion, output volume, and retries. These limits are related but not interchangeable: a small number of calls can still return huge payloads or spend a long time in a tool.

Budget exhaustion should produce a truthful state. It may return the work completed so far, unresolved questions, and inspectable artifacts. It must not convert “no budget remains” into “the task is complete.” Retry budgets should consider whether the next attempt can change the outcome. Repeating an invalid request without new information consumes budget without resolving uncertainty.

Later, we will optimize budget allocation using measured marginal value. An extra verifier call may be worthwhile for a high-impact mutation and wasteful for a simple formatting task. A second agent may improve parallel evidence collection and make a sequential shared-state problem worse. For now, explicit boundedness is the objective.

## Why agent teams are not our starting point

Suppose one worker retrieves evidence, another writes a proposed answer, and another reviews it. This division may create useful context separation and independent work. It also creates handoff contracts, additional failure modes, and an integration problem. If all three workers inherit the same false premise, more discussion can reinforce an error.

Before introducing a team, specify the benefit you expect. Is it lower wall-clock latency from independent tasks? More evidence capacity through isolated contexts? A different capability or tool scope? An independent source of verification? Those are testable mechanisms. “More agents reason better” is not a sufficiently precise hypothesis.

The comparison baseline matters. If a team gets ten times the model calls of a single agent, a higher success rate does not establish that coordination caused the gain. Give the simple system a comparable budget, then also evaluate under a fixed latency deadline when parallelism matters. We will return to this experimentally in Module 6.

## Reliability: an intentionally simplified calculation

Assume a task requires ten necessary stages, every stage succeeds independently with probability 0.95, and any stage failure makes the task fail. The total success probability is 0.95^10, approximately 0.599. This is a mathematical illustration, not an estimate of any agent. Real failures are often correlated, stages differ in difficulty, and recovery can change the outcome.

The example shows why a locally impressive success rate does not automatically produce reliable long tasks. It also shows why the assumptions matter. If a single stale permission can invalidate every stage, independence is wrong. If a verifier catches a failed stage and a safe retry repairs it, the one-shot product is incomplete.

For k independent attempts at a task with fixed success probability p, the probability of at least one success is 1 − (1 − p)^k. The probability that all k attempts succeed is p^k. At p = 0.8 and k = 5, these are 99.968% and 32.768%. Both calculations can be correct while answering very different questions. Finding one working patch in several tries is different from an operations assistant reliably completing every requested action.

Across tasks of unequal difficulty, compute the relevant probability per task before averaging; substituting the average p into a nonlinear formula generally changes the result. With empirical samples, the metrics lab uses combinatorial estimators rather than pretending that a small sample identifies a task's true p. The interactive calculator instead presents an explicitly assumed probability model.

Neither multiple attempts nor a high pass@k solves selection. Someone or something must identify the successful attempt. A fallible verifier can select an attractive wrong answer. Its false-accept and false-reject rates belong in the system evaluation.

## The first experimental question

Choose one intervention: require authoritative state verification before declaring success. Hold the scripted policies, task fixtures, execution backend, and budgets constant. Compare acceptance based on final text with acceptance based on actual state. The expected result is that the corrected verifier rejects false completion. This experiment establishes a software invariant in a simulation. It does not measure how often a real model makes that error.

Next replace the scripted policy with a real model while preserving the contracts. Now you can measure how often the error occurs, whether the model recovers after feedback, and how much the correction costs. These are separate claims. Keeping them separate prevents a passing unit test from being reported as evidence of model reliability.

Your experiment record should state the task, intervention, baseline, model or scripted policy, version, dataset, trial count, outcome criteria, and cost boundary. Record failed attempts as well as successful ones. If an apparently correct final state might have existed before the run, compare the initial and final states and inspect the effect history. Outcome verification needs to establish the requested transition or acceptable final condition, not merely find a convenient artifact.

## Exercises and worked reasoning

**Exercise A: the test transcript.** An agent returns a message saying all tests passed, plus a tool result from a test command. The tool result indicates the command timed out. Should the task pass?

**Worked reasoning.** The final message conflicts with the observed command state. The command outcome is incomplete. A verifier should inspect process completion or rerun a justified bounded check; it cannot infer success from the agent's summary. It must also establish that the chosen tests are relevant to the requested change. A completed irrelevant test suite still does not prove the feature works.

**Exercise B: the repeated effect.** A remote API applies a mutation, but the process dies before recording the response. A checkpoint contains the pending request. Is retry safe?

**Worked reasoning.** Not in general. The harness does not know whether the effect happened. A stable idempotency key supported by the effect service can make a repeated request refer to the same operation. Alternatively, an authoritative query may reconcile the outcome. A new random key for each attempt makes the repeated request a new operation. A local checkpoint alone cannot close the cross-system uncertainty window. The durable-effects lab demonstrates one modeled service-side repair; the later runtime module handles broader cases.

**Exercise C: the old restriction.** Context compaction preserves the goal but removes an earlier constraint that only one tenant's records may be read. The model subsequently requests another tenant's record. What failed?

**Worked reasoning.** The context transformation lost a consequential instruction, but access control must still deny the request. There are two separate findings: the observation pipeline became less useful, and an unauthorized effect must remain impossible through the executor. Fixing only the summary does not establish the authorization boundary.

**Exercise D: the impressive team.** A four-agent system beats one agent by eight percentage points, but uses six times the spend and a different stronger coordinator model. What can you conclude?

**Worked reasoning.** The tested team configuration performed better under its tested resource and model configuration. You cannot attribute the difference specifically to multi-agent coordination. Compare matched models and budgets, then report the cost–quality and latency trade-offs. Do not remove the stronger model or extra budget from the description of the result.

## Your first assignment

Choose one task you understand well from an AI product or development workflow. Write its task contract in at most one page. Include the authoritative outcome, allowed actions, authority source, important constraints, verifier, bounded failure states, and evidence needed to continue after interruption. Name three plausible false-success cases.

Run the first starter lab, inspect the trace, and explain which checks must live outside the model. Then change exactly one fixture or scripted action to create a new failure. Predict the terminal status before running it. Bring the prediction, observed trace, and explanation to the next teaching session.

You have completed this lesson when you can identify what the model proposed, what the system permitted, what actually happened, and what the verifier established as four separate facts. That distinction will carry through every framework, team topology, and research technique in the course.

## Sources

1. OpenAI. [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/). 23 January 2026. Implementation account.
2. Anthropic. [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents). 26 November 2025. Engineering case study.
3. Anthropic. [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). 29 September 2025. Engineering guidance.
4. Anthropic. [Writing effective tools for agents — with agents](https://www.anthropic.com/engineering/writing-tools-for-agents). 11 September 2025. Tool design and evaluation guidance.

The worked tasks, probability calculations, exercises, and proposed system contracts are original instructional examples. They are not reported empirical model results. Research and documentation were checked for the course as of 12 September 2026; implementation-sensitive behavior should be rechecked against the installed version.
