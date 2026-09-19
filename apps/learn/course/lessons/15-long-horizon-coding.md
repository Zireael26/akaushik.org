# Lesson 15: Long-Horizon Coding and Environment Restoration

## Progress must survive the session

A long coding task spans many tool calls, context windows, and sometimes process restarts. The system needs a durable account of what changed, what was verified, and what remains uncertain. A narrative summary alone cannot reconstruct the repository state or prove that a feature works.

Treat the repository, dependency lock, task contract, execution record, and checkpoint as distinct artifacts. The repository contains the work. The checkpoint contains controller state. The task contract defines completion. The execution record provides evidence. Restoring only one of these can create an agent that remembers a test pass from a different revision.

Firsthand engineering reports are useful sources of design hypotheses, including environment setup and progress tracking. Their reported productivity does not establish that every project benefits equally. See the course research report's discussion of [effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

## Start with an acceptance boundary

Translate a feature request into observable behavior before generating a patch. For a pagination function, examples should include an exact end boundary, a partial final page, and invalid sizes. A test that merely repeats the implementation formula can reproduce its bug. Use the user-facing behavior as the oracle.

The coding capstone contains six single-file miniature workspaces with seeded defects: invoice arithmetic, inventory limits, tenant access, pagination, integer money validation, and completion status. Each has a broken baseline, independent acceptance assertions, and a reference patch. They run from Lab 12; Lab 8 covers this module's memory material. These are controlled fixtures, not evidence of frontier model coding capability.

Run the baseline first. A passing baseline on a supposed bug may indicate a wrong test, wrong environment, or misunderstood request. Preserve that observation. Then apply a candidate and run the same acceptance boundary plus relevant regression checks.

## Environment is part of the task

A model can propose a correct patch that fails because dependencies are missing or a generated file is stale. It can also appear successful because a cached artifact conceals an error. Record the interpreter, dependency versions, working directory, base revision, and commands.

Our reference runner deletes Python bytecode caches after replacing a tiny source file. This avoids a same-timestamp, same-size cache ambiguity in these fixtures. The broader principle is to know which artifacts your test execution actually consumed. In larger systems, use clean builds where needed and verify that the deployed artifact matches the tested one.

A local subprocess provides process separation and a timeout. It does not provide a security sandbox. The capstone runs trusted bundled fixtures. Do not send arbitrary untrusted generated code into this runner and call it isolated. A production coding service needs a constrained execution environment, controlled network access, scoped credentials, and resource limits.

## Plan as a maintained hypothesis

A plan should express dependencies and current evidence. “Implement backend, implement frontend, test” is often too vague to help recovery. Better steps identify a contract, the component that enforces it, and the acceptance check. Update the plan when a discovery changes the dependency structure.

Keep increments small enough to verify. A single large patch can entangle several hypotheses and make a failure difficult to diagnose. Conversely, excessive tiny tasks can create coordination overhead. Choose boundaries around independently checkable behavior, not arbitrary line counts.

After each increment, record the actual diff and verification status. If a check cannot run, retain an explicit unverified state. Do not promote “code written” to “feature complete.” The same distinction between proposed action and verified outcome applies to software changes.

## Recovery after interruption

Suppose a worker writes a patch and the controller crashes before recording completion. On restart, inspect the repository and task revision before reapplying the patch. A blind replay may duplicate migrations or overwrite a user's intervening edit. Compute the current diff, compare the expected base, and run acceptance checks to determine whether the intended result already exists.

If the environment changed, invalidate affected evidence. A test pass before a dependency upgrade is historical evidence, not a current guarantee. If a checkpoint points to an unavailable workspace, restore the artifact or report that recovery is incomplete. Memory should not fill the gap with an invented successful state.

## Worked capstone interpretation

The unchanged candidate fails all six seeded acceptance suites. The supplied reference patch passes all six after each baseline fails. This establishes that the fixtures distinguish these two deterministic candidates and that the reference implementation repairs their specified behaviors.

It does not establish that an LLM can discover the patches, that the tests cover every relevant defect, or that the same method scales to a large repository. To study model performance, freeze a task set, use an explicit model adapter, preserve every attempt and cost, and evaluate independently generated patches in a real sandbox. Keep that experiment separate from the reference mechanics.

## Practice and acceptance

Run the coding capstone (Lab 12), inspect one baseline failure, and explain why its test is behaviorally meaningful. Introduce a new boundary case before changing the source. Then write a recovery note for a crash after patch application but before the test result is recorded.

You pass when your completion claim names the exact artifact and verification evidence, and when recovery handles existing work without assuming the last model message is the truth. The Capstone B brief in the workbook asks you to add one behavioral boundary case and one new defect; treat the pair as an integration exercise and state where the two changes could interact.
