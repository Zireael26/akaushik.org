# Lesson 20: Deployment, Migration, Routing, and Incidents

## Deploy a system version

An agent's behavior depends on model, prompt, tool schemas, context policy, code, dependencies, memory state, and evaluator. Record these as a deployment manifest. A model alias changing beneath a stable code commit can still change the product.

Promotion should use representative evaluation, relevant invariant checks, and a rollback plan. A candidate that improves average success but breaks approval binding should not pass because its aggregate score is higher. Define hard constraints separately from optimization metrics.

The course pins LangGraph and its checkpoint dependencies for the verified examples. The research date describes the literature snapshot; it does not promise that future installations with arbitrary versions behave identically. Revalidate when upgrading.

## Checkpoint compatibility

A paused task may outlive a deployment. Its stored state can contain old field names, missing values, or references to nodes that no longer exist. Schema migration alone may not repair changed control flow. Decide whether to pin old executions to an old runtime, migrate explicitly, or cancel and restart with user-visible continuity.

Our migration example converts version 1 to version 2 while preserving an explicit status. If status is missing, it defaults to `pending`, never `verified`. Unknown versions and invalid statuses are rejected. This small rule illustrates conservative migration; it does not migrate LangGraph's internal checkpoint format.

Preserve action and approval identity during migration. If the meaning of an action changes, require a new intent and appropriate approval instead of reusing a record under altered semantics. Test a paused workflow before and after deployment, including resume and cancellation.

## Model routing and fallback

Routing can choose a cheaper model for easy tasks, a stronger model for uncertain tasks, or a different provider during an outage. Each route needs a supported tool and output contract. A fallback that cannot follow the same schema can break downstream code even if it produces fluent text.

Measure the router's own errors and overhead. If it sends difficult cases to a weak model, the aggregate cost reduction may conceal a severe failure concentration. Report performance by task family and route, including failed fallback attempts.

Do not silently widen authority during fallback. A provider outage should not cause the system to bypass approval or execute an unverified action. Resource ceilings and tenant scope survive provider changes.

## Release evidence

Use a frozen evaluation set for promotion, then monitor production distributions for drift. Shadow execution can compare proposals without performing duplicate effects, but must still respect privacy and cost. A canary can expose a small authorized traffic segment to the new version with clear rollback triggers.

Choose triggers tied to the product: unauthorized effect, increased duplicate attempts, missing verification, budget overruns, or materially worse task completion. Avoid relying solely on model error rates. The model can return valid responses while the business workflow fails.

A rollback restores executable behavior but may not undo external state. If the new release wrote incompatible memory or performed actions, recovery needs reconciliation and possibly compensation. Treat rollback and data repair as separate operations.

## Worked incident

A deployment renames `approval_id` to `decision_id`. New requests work, but paused tasks resume with the old field and fail after review. The effect ledger shows some tasks committed before the worker crashed, while others never executed.

First, stop automatic retries that could amplify ambiguous effects. Identify affected deployment and task versions. Reconcile each operation against the effect ledger. Completed effects can be verified and their controller state repaired; unexecuted actions need a compatible resume path and valid current approval.

The repair adds explicit migration or version pinning and a paused-task upgrade test. The incident was not solved merely by retrying every task on the new code. The evidence determines which state transition is valid for each task.

## Cost as an operational constraint

Track cost per attempted task, verified successful task, and useful business outcome where measurable. Include human review and cleanup when they materially change the decision. A cheaper model can increase total cost through retries or failures.

Optimization also has an upfront cost. If a harness change costs 500 units to develop and evaluate and saves 0.02 units per task, its simple break-even volume is 25,000 tasks, ignoring discounting and other benefits. Use this arithmetic to decide whether further search is economically justified.

## Practice and acceptance

Lab 10 demonstrates migration rejection and lease recovery. The workbook supplies the paused-task incident above with a mixed ledger. Write a per-task recovery decision and a release gate that would have caught the defect.

You pass when you can deploy a changed harness while preserving the meaning of in-flight work, and when your rollback plan addresses both executable code and external effects.
