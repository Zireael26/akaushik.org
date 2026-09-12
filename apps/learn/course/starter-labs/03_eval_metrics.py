"""Paired evaluation on synthetic fixtures; this is not an LLM benchmark."""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path
from statistics import mean

FIXTURE = Path(__file__).parent / "fixtures" / "paired_eval.json"


def pass_at_k(successes: int, attempts: int, k: int) -> float:
    if not 0 <= successes <= attempts or not 1 <= k <= attempts:
        raise ValueError("require 0 <= successes <= attempts and 1 <= k <= attempts")
    failures = attempts - successes
    return 1.0 - (math.comb(failures, k) / math.comb(attempts, k) if failures >= k else 0.0)


def pass_power_k(successes: int, attempts: int, k: int) -> float:
    if not 0 <= successes <= attempts or not 1 <= k <= attempts:
        raise ValueError("require 0 <= successes <= attempts and 1 <= k <= attempts")
    return math.comb(successes, k) / math.comb(attempts, k) if successes >= k else 0.0


def validate_tasks(tasks: list[dict]) -> None:
    if not tasks or len({task["task_id"] for task in tasks}) != len(tasks):
        raise ValueError("require nonempty tasks with unique task IDs")
    for task in tasks:
        for variant in ("baseline", "candidate"):
            runs = task[variant]
            if not runs:
                raise ValueError("every task/variant needs at least one attempt")
            for run in runs:
                if type(run["success"]) is not bool:
                    raise ValueError("success must be boolean")
                cost = run["cost_units"]
                if (type(cost) not in (int, float) or cost < 0
                        or (type(cost) is float and not math.isfinite(cost))):
                    raise ValueError("cost_units must be finite, nonnegative numeric")


def task_score(task: dict, variant: str, metric: str, k: int) -> float:
    runs = task[variant]
    n, c = len(runs), sum(run["success"] for run in runs)
    if metric == "pass@k":
        return pass_at_k(c, n, k)
    if metric == "pass^k":
        return pass_power_k(c, n, k)
    raise ValueError(f"unknown metric: {metric}")


def quantile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def paired_bootstrap(tasks: list[dict], metric: str, k: int, *,
                     replicates: int = 5000, seed: int = 42) -> dict:
    """Assume independent task units; related tasks require cluster resampling."""
    if replicates < 100:
        raise ValueError("use at least 100 bootstrap replicates")
    # Each task's two variants and all its repeated attempts remain together.
    deltas = [task_score(task, "candidate", metric, k)
              - task_score(task, "baseline", metric, k) for task in tasks]
    rng = random.Random(seed)
    samples = [mean(deltas[rng.randrange(len(deltas))] for _ in deltas)
               for _ in range(replicates)]
    return {"candidate_minus_baseline": mean(deltas),
            "percentile_95_ci": [quantile(samples, 0.025), quantile(samples, 0.975)],
            "bootstrap_unit": "paired_task", "replicates": replicates, "seed": seed}


def variant_summary(tasks: list[dict], variant: str, k: int) -> dict:
    runs = [run for task in tasks for run in task[variant]]
    total_cost = sum(run["cost_units"] for run in runs)
    successes = sum(run["success"] for run in runs)
    # Cost/success includes the cost of failures; it is not cost on successful runs.
    return {"task_count": len(tasks), "attempt_count": len(runs),
            "successful_attempt_count": successes,
            "macro_pass@k": mean(task_score(task, variant, "pass@k", k) for task in tasks),
            "macro_pass^k": mean(task_score(task, variant, "pass^k", k) for task in tasks),
            "micro_success_rate": successes / len(runs),
            "total_cost_units": total_cost,
            "cost_units_per_attempt": total_cost / len(runs),
            "cost_units_per_successful_attempt": total_cost / successes if successes else None}


def report(tasks: list[dict], k: int = 2, replicates: int = 5000, seed: int = 42) -> dict:
    validate_tasks(tasks)
    return {"data_kind": "hand-authored synthetic outcomes; not model measurements", "k": k,
            "baseline": variant_summary(tasks, "baseline", k),
            "candidate": variant_summary(tasks, "candidate", k),
            "paired_comparison": {metric: paired_bootstrap(tasks, metric, k,
                replicates=replicates, seed=seed) for metric in ("pass@k", "pass^k")}}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, default=FIXTURE)
    parser.add_argument("--k", type=int, default=2)
    parser.add_argument("--replicates", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    tasks = json.loads(args.fixture.read_text())["tasks"]
    print(json.dumps(report(tasks, args.k, args.replicates, args.seed), indent=2))


if __name__ == "__main__":
    main()
