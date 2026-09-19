# Executable Module Labs

Run commands from the package root with the pinned environment active. Each lab is a complete runnable reference, and each has a learner task in the workbook. Predict first, run second, inspect the solution last. Use a fresh output directory for each experiment.

## Lab 1: Model proposal versus outcome

Command: `python labs/run_lab.py 1`

Inspect the scripted happy path, malformed proposals, false completion, repeated actions, and injected instructions from the original fixture. The authoritative verifier reads order and refund state. A final claim without the required state is false. Run `python starter-labs/01_harness.py --scenario happy` without approval to inspect denial; add `--approve` for the eligible action. Use `--max-tool-calls 1` to see budget termination. Extension: add one fixture and predict its trace. Solutions 1–2 explain the identity and control boundaries.

## Lab 2: Context compilation and tool typing

Command: `python labs/run_lab.py 2`

Expected: selected policy and own-tenant order use 55 of 80 available input units; notes are omitted; the other-tenant record is excluded. Boolean money is rejected. Change the window and reserve in a copied driver, preserving mandatory policy. Extension: add provenance-aware contradiction handling without allowing relevance to override scope. Solutions 3–4 cover exact arithmetic and error semantics.

## Lab 3: Paired evaluation and economics

Command: `python labs/run_lab.py 3`

Expected: pass@3=1 and pass^3=56/120 for 8 successes in 10 attempts. Total cost 6 over two successes gives cost per success 3. The paired mean difference is 3/16=0.1875; task and family resampling use 16 and 4 units respectively. The task interval is [-0.125, 0.5] and the family interval is [0.0625, 0.25]: the family interval is narrower and excludes zero because three of the four family means coincide and four clusters permit only 256 distinct resamples. That is a small-cluster artifact, not stronger evidence. Only four synthetic families are present. Extension: create a family-separated dataset and justify its sampling unit. Solutions 5–6 discuss grader calibration and uncertainty.

## Lab 4: Actual LangGraph fan-out and reducers

Command: `python labs/run_lab.py 4`

Expected: three `Send` workers merge distinct keyed evidence and join with verified=True. Omitting source-b returns verified=False. A conflicting reducer update is rejected. Empty work stays unverified and duplicate job IDs fail. The combined-routing case visits both the static and Command destinations. The compiled-child example projects evidence into the parent without returning its private scratch field. Inspect `coursekit/graphs.py` and `coordination.py`; the graph uses actual pinned LangGraph APIs. Extension: add a dependency revision to evidence and reject stale results. Solutions 7–8 explain reducer algebra and critical paths.

## Lab 5: Interrupt, effect commit, crash, and disk-backed resume

Command: `python labs/run_lab.py 5`

Expected: one review interrupt, zero effects before trusted approval, one effect after the injected execution failure, and one effect after reopening both databases and resuming the same thread. The recovered receipt is marked duplicate and the outcome verifies. The driver deliberately supplies a simulated clock; a deployed service must use trusted current time on each execution. Extension: design the reconciliation branch when approval expires after commit. Solutions 9–10 cover the uncertainty window and node restart.

## Lab 6: Architecture scheduling model

Command: `python labs/run_lab.py 6`

Expected with n=3,r=2,t=4: single 6 calls/24 seconds; parallel 7/12; supervisor 10/24; workflow 6/8; debate 7/12. These models assume unlimited worker slots and equal call time; the foundational visual additionally allows message-hop delay, so set that delay to zero when comparing. They do not predict quality. Extension: compare a fixed candidate pool under several selectors using a declared real experiment. Solutions 11–12 explain appropriate conclusions.

## Lab 7: Work contracts and a protocol teaching subset

Command: `python labs/run_lab.py 7`

Expected: current artifact accepted, identical delivery deduplicated, stale revision rejected, conflicting completion rejected, own-tenant lookup succeeds, other-tenant lookup fails. The small JSON-RPC handler is not a complete MCP/A2A server. Extension: add dependency identity and list the official SDK lifecycle/authentication work needed for deployment. Solutions 13–14 distinguish envelope, lifecycle, authority, and outcome validity.

## Lab 8: Memory and bounded corpus coverage

Command: `python labs/run_lab.py 8`

Expected: active scoped memory at time 20; no other-tenant result; expiry at 30; no result after deletion. Twenty-three integers in batches of five require five calls and produce twelve even labels. A four-call cap fails before processing. Extension: model conflicting source authority and document distributed deletion requirements. Solutions 15–16 also connect these rules to coding environment restoration.

## Lab 9: Service boundary attack cases

Command: `python labs/run_lab.py 9`

Expected: the valid case creates one simulated effect; wrong tenant, forged approval, expiry, revocation, changed amount, stale policy, and injected cross-tenant proposal create zero. These are eight fixed coverage cases, not a live prompt-injection benchmark. Extension: pair malicious and benign user tasks and evaluate useful completion separately from violations. Solutions 17–18 provide the threat model and detector arithmetic.

## Lab 10: Leases, admission, queueing, and migration

Command: `python labs/run_lab.py 10`

Expected: epochs 1 then 2; old worker completion rejected; new worker accepted. Reserve 60 succeeds, reserve 50 fails, settle at 35 leaves 65 available. Four simultaneous ten-second jobs finish at 10/20/30/40 with one worker and 10/10/20/20 with two. Missing v1 status migrates to pending; unknown version fails. The budget object assumes one serialized owner and has no per-reservation identity. Extension: design atomic reservation records and an external-effect fencing contract. Solutions 19–20 explain deployment and recovery.

## Lab 11: Selection and adaptive-compute analogues

Command: `python labs/run_lab.py 11`

Expected: development selection chooses the negation policy from a fixed menu, then evaluates its tiny holdout once. Read the fixture scope: distinct IDs still share lexical structures. The seeded bandit has expected success-minus-cost utilities 0.60 and 0.50. Its observed estimates vary with seed; there is no LLM training. Extension: design a bounded reflective search with family-separated data and candidate lineage. Solutions 21–22 separate mechanics from research claims.

## Lab 12: Both reference capstones

Command: `python labs/run_lab.py 12 --output my-capstones`

Expected: the product commits one effect, recovers via duplicate receipt, restores its checkpoint, and verifies. Each of six coding baselines fails; all six reference patches pass; all six unchanged negative controls remain unverified. Inspect saved source, acceptance scripts, hashes, and JSON reports. The runner only executes trusted bundled Python and is not a security sandbox. Extension: add a new product-specific defect and a meaningful independent oracle. Solutions 23–24 and the capstone keys cover the engineering defense.

## Optional live text collection

```bash
python labs/live_text.py --live --base-url https://YOUR-COMPATIBLE-ENDPOINT/v1 --model YOUR-MODEL --prompt "Explain this task contract" --max-tokens 256
```

Set `COURSE_API_KEY` securely in your environment if the endpoint requires it; do not paste credentials into source or traces. This performs one potentially billable call and prints text/usage. It supports a small Chat Completions-style text contract, not every provider or model feature. The default exercises do not require it. Returned text is never executed. For a quality experiment, add a representative dataset, versioned prompts, all-attempt accounting, and an independent evaluator.
