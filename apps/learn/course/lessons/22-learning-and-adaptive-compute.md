# Lesson 22: Learning, Credit Assignment, and Adaptive Compute

## When another action is worth taking

An agent can spend more effort by retrieving another source, generating another candidate, calling a verifier, or delegating work. More compute is useful only when its expected benefit exceeds its cost and risk under the task's constraints.

A simple decision rule compares expected utility after an action with the current best stopping option. If a verifier costs 0.10 units and is expected to prevent 0.04 probability of a 10-unit loss, the expected avoided loss is 0.40 units. Under those assumptions, the verifier has positive expected value before considering latency and other costs.

The assumptions are the hard part. Estimate detection probability on relevant tasks, account for correlated errors, and include the verifier's own false positives. A plausible number is not an empirical estimate. Adaptive control needs calibration and evaluation just like the agent it controls.

## Stopping and uncertainty

A stop policy should distinguish verified completion, safe abstention, insufficient evidence, budget exhaustion, cancellation, and unrecoverable failure. “The model stopped calling tools” is not a complete product status.

For a bounded search, stopping can be justified when a candidate passes a sufficiently strong acceptance test or when remaining actions have low expected value. If the verifier is weak, stopping after one favorable score can reward exploitation of the judge. Consider independent evidence and adversarial tests of the acceptance boundary.

Do not continue simply because unused budget remains. Conversely, do not save a small call cost by skipping a required authorization or outcome check. Hard invariants are constraints, not optional actions in the utility calculation.

## Bandits as a small learning model

The course bandit has two actions with success probabilities 0.65 and 0.90, and costs 0.05 and 0.40. With utility equal to success minus cost, their expected utilities are 0.60 and 0.50. The more accurate action is not the higher-utility action under this chosen objective.

An epsilon-greedy learner sometimes explores and otherwise chooses the action with the highest estimated value. The lab uses a fixed random seed for reproducibility. Finite runs can favor the wrong action temporarily. Changing the reward scale or failure cost can reverse the preferred action.

This is an educational simulator, not LLM reinforcement learning. It teaches exploration, noisy estimates, and objective dependence. It cannot establish that a production router will learn safely from user traffic.

## Credit assignment in trajectories

A final task reward does not directly identify which earlier action helped. A useful retrieval may be followed by a bad synthesis; a flawed plan may succeed because a tool corrected it. Assigning the same positive reward to every step can reinforce unnecessary or harmful behavior.

Post-training systems need a representation of trajectories, policy versions, observations, actions, rewards, and termination. They also need to handle delayed effects, failed tools, variable-length trajectories, and the relationship between deployed behavior and training data.

Agent Lightning's reviewed version explores training with the deployment harness in the loop. [Paper](https://arxiv.org/abs/2608.17528). The course teaches the system questions and a small bandit mechanism; it does not bundle an expensive model-training run or claim to reproduce that paper's results.

## Reward design and evaluator exploitation

A reward for “tests passed” can encourage deleting tests if the environment permits it. A reward for low token count can encourage premature stopping. A reward for user approval can favor persuasive explanations over correct outcomes. Define the allowed action space and verify the real task independently.

Use constraints for unacceptable effects and multiple diagnostic metrics for understanding tradeoffs. A scalar optimization objective can still be useful, but retain the underlying outcomes so its compromises remain visible.

Learning from production introduces selection bias: the current router determines which model sees which tasks. Comparing observed route averages without adjustment can make the harder-task model look worse. Controlled exploration or carefully justified off-policy methods are needed for causal claims.

## A worked allocation decision

You have 20 seconds remaining. Another worker takes 12 seconds and synthesis takes 10, so the sequential dependency cannot meet the deadline. A 5-second deterministic check can still validate the existing candidate. The critical path eliminates the worker option even if its expected accuracy gain is attractive in an unlimited-time experiment.

If the check fails, return the contract's incomplete status with evidence. Do not reinterpret the deadline as permission to claim success. This is where control, evaluation, and product communication meet.

## Practice and acceptance

Run Lab 11's bandit and change the cost objective in a separate experiment. Calculate the verifier's value under two different loss assumptions. Design a stopping policy that preserves mandatory checks and names every terminal status.

You pass when you can distinguish a learning mechanism from a training claim, explain the data needed for credit assignment, and choose compute using explicit constraints and measured uncertainty.
