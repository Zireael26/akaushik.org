# Lesson 6: Statistics and Agent Economics

## The experimental unit

An evaluation may contain thousands of model calls but only twenty independent tasks. Calls within a task share context, environment, and difficulty. Repeated attempts on the same task also share its latent difficulty. Treating every call as an independent success observation produces unjustified precision.

Choose the unit that corresponds to the population you want to generalize over. If tasks are independent draws, resample tasks and retain their repeated attempts together. If tasks share repository or scenario-family effects, resample those clusters. A larger number of repeats can characterize stochastic variability on the observed tasks, but it cannot replace a broader sample of task families.

For two systems, pairing is valuable. Run both on the same tasks and compute within-task differences. A difficult task then affects both systems rather than being mistaken for a treatment effect. Preserve pairing in any bootstrap procedure. Pairing does not fix a biased task population or leakage from development into evaluation.

## At least one success and consistent success

Under a simplified model with fixed success probability p and independent attempts, the probability of at least one success in k tries is 1 − (1 − p)^k. The probability of all k tries succeeding is p^k. At p = 0.8 and k = 5, these are 0.99968 and 0.32768. Neither is intrinsically the correct metric; they describe different product requirements.

With n observed attempts of which c succeed, a finite-sample estimator for pass@k is 1 − choose(n−c,k)/choose(n,k), treating an impossible numerator combination as zero. An estimator for all-k success is choose(c,k)/choose(n,k). These count the proportion of k-subsets with the desired property. They require k no larger than n. They should be computed per task before averaging when task difficulty varies.

The starter metrics lab uses these combinatorial estimators and checks them against exhaustive enumeration of small subsets. This is an independent mathematical oracle, rather than a test that merely repeats the implementation formula. The interactive probability visual instead uses an assumed p. Keep estimated metrics and assumed-probability illustrations distinct.

## Selection is part of the system

A high pass@k means that a successful attempt exists with the stated frequency. It does not mean your deployment can recognize that attempt. A fallible verifier can select an incorrect candidate. Report the performance and cost of the actual selection procedure, including false acceptance and cases where all candidates fail.

Best-of-N also changes resource allocation. If one configuration uses N attempts and another uses one, report both an equal-budget comparison and any latency-constrained comparison relevant to the product. Parallel generation can reduce elapsed time while increasing spend. It cannot remove the cost of verification or the possibility of correlated errors.

Correlation matters even when the marginal per-attempt success rate stays fixed. In the interactive mixture, a fraction q of task batches fail together. In the remaining batches, attempts succeed with probability s = p/(1−q), so the marginal remains p, requiring q ≤ 1−p. Then pass@k is (1−q)[1−(1−s)^k] and all-k success is (1−q)s^k. Positive dependence can reduce diversity benefits while increasing the chance that all attempts share the same result.

## Confidence intervals and decisions

A paired bootstrap samples independent tasks or clusters with replacement, computes the mean paired difference, and repeats this procedure. A percentile interval summarizes the variability under that resampling model. It does not establish that the dataset is representative or that the grader is correct. With few clusters, the interval itself can be unstable, and it can even be narrower than the task-level interval. Lab 3 shows this: the same 16 paired outcomes give a task-level percentile interval that includes zero and a four-family interval that excludes it, because three of the four family means happen to be identical and four clusters allow only 256 distinct resamples. Read the family interval as evidence that four clusters cannot support a population claim, not as a stronger result.

An interval spanning zero does not prove the systems are identical. It says the experiment did not clearly distinguish their difference under its assumptions. An interval excluding zero does not establish practical importance. Define a minimum worthwhile improvement from the product's needs before selecting a configuration.

When many candidates are tried, the best observed score tends to be optimistic: the maximum of several noisy estimates is biased upward even when no candidate is better than the baseline. The more candidates you compare on one set, the larger this selection effect. Use development data for selection and a locked holdout for the final decision. A single evaluation of the frozen winner on that holdout is an honest estimate for that winner only because the holdout played no part in choosing it. Do not repeatedly evaluate the holdout, revise the system, and keep calling it untouched. A new version of the system may require fresh evaluation data or an explicitly sequential testing protocol.

## Worked paired comparison

Imagine task-level improvements of +1, 0, −1, +1, 0, and +1 in binary success between candidate and baseline. The mean improvement is 2/6, but six tasks provide little evidence about an entire production population. If all positive cases come from one template family, the relevant independent evidence may be smaller still.

The supplied synthetic metrics fixture is more instructive than a universally winning example. Its candidate improves the point estimate of pass@2 but costs more per successful attempt, and its bootstrap difference interval includes zero. The correct conclusion is a trade-off with uncertainty. It is not a victory based on the largest number in the table.

## Cost denominators

Cost per successful attempt is total cost of all attempts divided by successful attempts. Include failures. Computing the average cost only among successful runs hides expensive failures and retries. When there are no successes, the ratio is undefined or infinite; report the zero denominator rather than returning a comforting zero cost.

A deployment policy may perform several attempts and select one answer per user task. Its appropriate denominator is successfully handled user tasks, and its numerator includes all generation and selection work. This differs from cost per successful attempt. Label both carefully if you report them together.

Optimization also has an upfront cost. If an experiment costs 100 units and reduces deployment cost by 0.02 units per handled task without harming quality, its simple cost break-even volume is 5,000 tasks. That calculation excludes engineering time, maintenance, and distribution shift; state those omissions. A cheaper per-run policy may still be a poor choice for a low-volume system.

## Latency and throughput

Report the measurement boundary: user request to final verified response, worker execution only, or model generation only. A median hides tail behavior. Include sample counts when presenting p95 or p99; very small samples do not support precise tail estimates. Queueing, retries, tool delays, and synthesis all contribute to end-to-end latency.

The fastest individual call is not necessarily the best system. A cheap model that triggers many retries may be slower and more expensive overall. A slow independent verifier may be appropriate for a consequential action and inappropriate for an interactive typing assistant. The decision belongs to the product's utility and service constraints.

## Practice and acceptance

Run the metrics lab, derive both combinatorial estimators for n=4, c=2, k=2 by enumerating subsets (the case is in `assessments/TRACE-CASES.md`), and explain every cost denominator. Then group related tasks, compare task versus cluster resampling, and explain why the narrower four-family interval is the weaker evidence. The solution manual includes the enumeration and a worked decision memo.

You pass when your report distinguishes uncertainty, practical effect, selection cost, and deployment policy. A well-supported decision to retain the baseline is a successful experiment.

## Reading

[AI Agents That Matter](https://arxiv.org/abs/2407.01502) motivates cost-aware evaluation. [METR's methodology](https://metr.org/time-horizons/) illustrates why a metric's operational definition matters. The mathematical derivations and synthetic examples above are original course instruction.
