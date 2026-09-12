# Lesson 23: Integrating the Two Capstones

## Capstone A: an authorized product action

The product reference implementation combines typed intent, a trusted actor map, tenant-scoped resource lookup, exact approval binding, a transactional effect ledger, recovery, and an outcome verifier. All effects are simulated in local SQLite. No real refund or external account is involved.

Start with a 2,400-cent paid order for tenant A. Construct a logical operation with a stable identifier. A trusted operator approves the exact intent with an expiry. The controller calls the effect service, which validates current scope and policy, commits the ledger entry and order-state change atomically, and returns a receipt.

The controller's checkpoint lives in a separate database. Inject a crash after the service commits but before the controller records success. On retry with the same valid intent, the service finds the existing operation and returns its receipt without a second effect. The verifier checks the final order state and the exact ledger entry.

## Inspect the uncertainty window

The important result is not that the exception was caught. It is that the first attempt committed one effect, the controller lacked a completion checkpoint, and recovery established the existing result without duplicating it. Inspect all three pieces of evidence.

The real LangGraph version adds an interrupt and SQLite checkpointing. Resume with a trusted approval reference. After an injected execution failure, recreate the graph with the same checkpoint database and thread identity, then resume. The effect service remains the authority for deduplication; the graph checkpoint alone cannot provide atomicity with an external service.

If the approval has expired by recovery time, the example rejects a fresh execution call. Use tenant-scoped reconciliation to inspect whether the operation already committed. A production controller should make this branch explicit. The reference capstone records the result and the solution book explains why fabricating a fresh approval is wrong.

## Attack and boundary cases

Try a wrong tenant, forged approval identifier, revoked approval, expired approval, changed amount, changed policy, and a second logical operation against an already refunded order. Verify the ledger after each attempt. Some cases fail during approval; others fail at execution. Record the boundary that enforces each property.

The supplied tests are a coverage suite, not a statistical estimate of attack resistance. For a real product, replace the deterministic proposal with a versioned model adapter, add representative user tasks, and evaluate utility and violations separately. Keep the same service-side invariants.

## Capstone B: verified software repair

The coding reference runner creates six small isolated temporary workspaces from bundled trusted fixtures. It runs a broken baseline, applies either an unchanged or reference candidate, runs acceptance checks, and stores source, checks, a digest, and a JSON report.

An unchanged candidate is the negative control. A reference patch is the positive control. Both help validate the evaluation mechanism. A benchmark that passes unchanged broken code is not measuring the intended repair. A benchmark that fails a known-correct patch may contain a faulty oracle or environment.

The reference results demonstrate fixture behavior and patch correctness for the specified checks. They do not measure a model's ability to generate the patch. The optional text adapter allows a separate live-model study, but the course does not execute generated code from an external model automatically.

## Compare architectures on the same contract

For the product task, begin with a deterministic workflow and one proposal model. Add a specialist only if it provides missing information or a measurable improvement. Approval, idempotency, and verification remain service responsibilities regardless of the number of agents.

For coding, compare a single worker with bounded independent candidates or a review stage under explicit budgets. Keep the repository, acceptance tests, model configuration, and task split stable for the first causal comparison. A stronger reviewer plus more tokens is a different whole-system configuration, not isolated evidence for coordination.

Use the topology simulator to reason about call counts and critical paths before spending on the experiment. Then measure real outcomes. A simulator can rule out an impossible deadline under its assumptions, but it cannot predict the model's task success rate.

## Deliver the engineering argument

Your capstone submission includes the task contract, architecture, threat model, reproducible commands, dependency manifest, trace samples, evaluation dataset description, baseline comparison, uncertainty, cost, latency, failure taxonomy, and recovery procedure. Include limitations and the conditions under which you would simplify the design.

The supplied reference implementations and worked reports are available immediately. Use them after attempting your own design or when you need to unblock yourself. Graduation requires explaining and extending the mechanisms, not hiding the answer key.

## Practice and acceptance

Run both capstones and the real LangGraph restart test. Trace one successful action, one rejected action, one crash recovery, one failed patch, and one verified patch. Then change a task assumption and explain which component must change.

You pass when your evidence supports the claimed behavior end to end and when you can separate verified local properties from unmeasured claims about live models, large repositories, and production deployment.
