"""Behavioral invariants for the three local simulations (Python stdlib only)."""

import importlib.util
import itertools
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).parent


def load_module(filename):
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


harness_lab = load_module("01_harness.py")
durable_lab = load_module("02_durable_effects.py")
eval_lab = load_module("03_eval_metrics.py")


class HarnessTests(unittest.TestCase):
    def test_operator_approval_enables_valid_effect(self):
        result = harness_lab.Harness(approvals={"order-7"}).run(harness_lab.load_policies()["happy"])
        self.assertTrue(result["task_success"])
        self.assertEqual(len(result["state"]["refunds"]), 1)

    def test_success_claim_cannot_replace_state_change(self):
        result = harness_lab.Harness(approvals={"order-7"}).run(harness_lab.load_policies()["false_claim"])
        self.assertFalse(result["task_success"])
        self.assertEqual(result["state"]["refunds"], [])

    def test_model_cannot_grant_authority(self):
        result = harness_lab.Harness().run(harness_lab.load_policies()["forged_approval"])
        self.assertFalse(result["task_success"])
        self.assertEqual(result["state"]["refunds"], [])
        self.assertEqual(sum(row["event"] == "rejected" for row in result["trace"]), 2)

    def test_invalid_amounts_cannot_modify_state(self):
        result = harness_lab.Harness(approvals={"order-7"}).run(harness_lab.load_policies()["invalid_args"])
        self.assertFalse(result["task_success"])
        self.assertEqual(result["state"]["refunds"], [])

    def test_budget_bounds_read_loop(self):
        result = harness_lab.Harness(max_tool_calls=2).run(harness_lab.load_policies()["loop"])
        self.assertEqual(result["tool_attempts"], 2)
        self.assertEqual(result["stop_reason"], "tool_budget_exceeded")

    def test_rejected_attempts_consume_budget(self):
        result = harness_lab.Harness(max_tool_calls=1).run(harness_lab.load_policies()["forged_approval"])
        self.assertEqual(result["tool_attempts"], 1)
        self.assertEqual(result["stop_reason"], "tool_budget_exceeded")

    def test_turn_budget_bounds_non_tool_actions(self):
        result = harness_lab.Harness(max_turns=2).run([{"kind": "invented"}] * 3)
        self.assertEqual(result["stop_reason"], "turn_budget_exceeded")
        self.assertEqual(result["tool_attempts"], 0)


class DurabilityTests(unittest.TestCase):
    def test_remote_commit_replay_duplicates_without_dedup(self):
        with tempfile.TemporaryDirectory() as directory:
            result = durable_lab.demonstrate(Path(directory), deduplicate=False)
        self.assertEqual(result["after_crash"]["completed_checkpoints"], 0)
        self.assertEqual(result["after_crash"]["effect_count"], 1)
        self.assertEqual(result["after_retry"]["effect_count"], 2)
        self.assertEqual(result["after_retry"]["total_cents"], 4800)

    def test_business_key_preserves_one_effect_across_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            result = durable_lab.demonstrate(Path(directory), deduplicate=True)
        self.assertEqual(result["after_retry"]["effect_count"], 1)
        self.assertEqual(result["after_retry"], result["after_completed_task_replay"])

    def test_same_key_different_amount_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            system = durable_lab.System(Path(directory), deduplicate=True)
            try:
                receipt = system.effect("refund:7:v1", 2400)
                self.assertEqual(system.effect("refund:7:v1", 2400), receipt)
                with self.assertRaises(ValueError):
                    system.effect("refund:7:v1", 1200)
                self.assertEqual(system.summary()["total_cents"], 2400)
            finally:
                system.close()


class EvaluationTests(unittest.TestCase):
    def test_estimators_match_exhaustive_subsets(self):
        # Independent oracle: enumerate every k-subset, not the closed-form formula.
        for n in range(1, 8):
            for c in range(n + 1):
                outcomes = [True] * c + [False] * (n - c)
                for k in range(1, n + 1):
                    subsets = list(itertools.combinations(outcomes, k))
                    self.assertAlmostEqual(eval_lab.pass_at_k(c, n, k),
                                           sum(any(s) for s in subsets) / len(subsets))
                    self.assertAlmostEqual(eval_lab.pass_power_k(c, n, k),
                                           sum(all(s) for s in subsets) / len(subsets))

    def test_pairing_preserved_and_seed_reproducible(self):
        tasks = json.loads(eval_lab.FIXTURE.read_text())["tasks"]
        first = eval_lab.paired_bootstrap(tasks, "pass@k", 2, replicates=200)
        self.assertEqual(first, eval_lab.paired_bootstrap(tasks, "pass@k", 2, replicates=200))
        identical = [{**task, "candidate": task["baseline"]} for task in tasks]
        result = eval_lab.paired_bootstrap(identical, "pass@k", 2, replicates=200)
        self.assertEqual(result["percentile_95_ci"], [0.0, 0.0])

    def test_cost_denominator_includes_failures(self):
        tasks = json.loads(eval_lab.FIXTURE.read_text())["tasks"]
        result = eval_lab.report(tasks, replicates=100)
        self.assertEqual(result["baseline"]["cost_units_per_successful_attempt"], 2.0)
        self.assertAlmostEqual(result["candidate"]["cost_units_per_successful_attempt"], 48 / 18)

    def test_zero_success_has_no_finite_cost_per_success(self):
        run = {"success": False, "cost_units": 3}
        tasks = [{"task_id": "fails", "baseline": [run, run], "candidate": [run, run]}]
        result = eval_lab.report(tasks, replicates=100)
        self.assertIsNone(result["baseline"]["cost_units_per_successful_attempt"])
        self.assertEqual(result["baseline"]["macro_pass@k"], 0.0)

    def test_invalid_k_rejected(self):
        with self.assertRaises(ValueError):
            eval_lab.pass_at_k(1, 2, 3)

    def test_nonfinite_costs_rejected_in_either_variant(self):
        values = [float("nan"), float("inf"), float("-inf")]
        values += [json.loads(token) for token in ("NaN", "Infinity", "-Infinity", "1e999")]
        for variant, cost in itertools.product(("baseline", "candidate"), values):
            with self.subTest(variant=variant, cost=cost):
                task = {"task_id": "nonfinite", "baseline": [{"success": True, "cost_units": 1}],
                        "candidate": [{"success": True, "cost_units": 1}]}
                task[variant][0]["cost_units"] = cost
                with self.assertRaisesRegex(ValueError, "finite"):
                    eval_lab.report([task], k=1, replicates=100)


if __name__ == "__main__":
    unittest.main(verbosity=2)
