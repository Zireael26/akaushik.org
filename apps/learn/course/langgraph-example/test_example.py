"""Deterministic checks for substantive graph and evidence invariants."""
import unittest

from refund_verification import build_graph, initial_state, merge_evidence


class GraphSemanticsTests(unittest.TestCase):
    def test_parallel_readers_join_before_proposal_and_verification(self):
        updates = list(build_graph("verified").stream(initial_state(), stream_mode="updates"))
        names = [name for update in updates for name in update]
        self.assertEqual(set(names[1:3]), {"order", "ledger"})
        self.assertEqual(names[0], "start")
        self.assertEqual(names[3:], ["propose", "verify", "complete"])

    def test_identical_claim_does_not_override_failed_verification(self):
        good = build_graph("verified").invoke(initial_state())
        bad = build_graph("false_completion").invoke(initial_state())
        self.assertEqual(good["final_claim"], bad["final_claim"])
        self.assertEqual(good["terminal_status"], "verified")
        self.assertEqual(bad["terminal_status"], "needs_review")

    def test_incomplete_observations_do_not_qualify_for_completion(self):
        result = build_graph("missing_evidence").invoke(initial_state())
        self.assertEqual(result["terminal_status"], "needs_review")
        self.assertEqual(len(result["evidence"]), 1)

    def test_duplicate_result_is_idempotent_but_conflict_is_rejected(self):
        a = {"source": "order-service", "order_id": "order-7", "status": "paid", "amount_cents": 2400}
        b = {**a, "status": "refunded"}
        self.assertEqual(merge_evidence({"a": a}, {"a": a}), {"a": a})
        with self.assertRaisesRegex(ValueError, "conflicting evidence"):
            merge_evidence({"a": a}, {"a": b})

    def test_independent_ids_merge_without_dependence_on_order(self):
        a = {"source": "x", "order_id": "order-7", "status": "paid", "amount_cents": 2400}
        b = {**a, "source": "y"}
        left, right = {"a": a}, {"b": b}
        self.assertEqual(merge_evidence(left, right), merge_evidence(right, left))
        self.assertEqual(left, {"a": a})

    def test_unknown_order_fails_before_readers(self):
        state = initial_state()
        state["order_id"] = "unrecognized"
        with self.assertRaisesRegex(ValueError, "unknown order"):
            build_graph("verified").invoke(state)


if __name__ == "__main__":
    unittest.main()
