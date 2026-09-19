"""A deterministic, local harness simulation. No model API or financial service."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any

FIXTURE = Path(__file__).parent / "fixtures" / "harness_policies.json"
INITIAL_STATE = {
    "orders": {"order-7": {"paid_cents": 2400, "status": "paid"}},
    "refunds": [],
}


class Harness:
    """The model proposes actions; this runtime owns authority and execution."""

    def __init__(self, *, approvals: set[str] | None = None,
                 max_turns: int = 8, max_tool_calls: int = 4):
        self.approvals = frozenset(approvals or ())
        self.max_turns = max_turns
        self.max_tool_calls = max_tool_calls
        self.state = copy.deepcopy(INITIAL_STATE)
        self.trace: list[dict[str, Any]] = []
        self.tool_calls = 0

    def record(self, event: str, **details: Any) -> None:
        self.trace.append({"sequence": len(self.trace), "event": event, **details})

    def validate(self, name: Any, args: Any) -> dict[str, Any]:
        contracts = {
            "get_order": {"order_id": str},
            "refund_order": {"order_id": str, "amount_cents": int},
        }
        if not isinstance(name, str) or name not in contracts:
            raise ValueError("unknown tool")
        schema = contracts[name]
        if not isinstance(args, dict) or set(args) != set(schema):
            raise ValueError("tool argument keys must exactly match the contract")
        for key, kind in schema.items():
            # bool is an int subclass: exact typing rejects True as an amount.
            if type(args[key]) is not kind:
                raise ValueError(f"{key} must have type {kind.__name__}")
        if args["order_id"] not in self.state["orders"]:
            raise ValueError("unknown order")
        if name == "refund_order" and args["amount_cents"] <= 0:
            raise ValueError("amount_cents must be positive")
        return args

    def execute(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        order_id = args["order_id"]
        order = self.state["orders"][order_id]
        if name == "get_order":
            return copy.deepcopy(order)
        # Authority comes from the operator, never from the model's arguments.
        if order_id not in self.approvals:
            raise PermissionError("refund requires an operator approval for this order")
        if args["amount_cents"] != order["paid_cents"]:
            raise ValueError("only a full refund is supported")
        if order["status"] != "paid":
            raise ValueError("order is not refundable")
        refund = {"order_id": order_id, "amount_cents": args["amount_cents"]}
        self.state["refunds"].append(refund)
        order["status"] = "refunded"
        return {"status": "refunded", **refund}

    def verify(self) -> bool:
        """Independent task oracle reads state, never the model's final claim."""
        return (
            self.state["orders"]["order-7"]["status"] == "refunded"
            and self.state["refunds"] == [{"order_id": "order-7", "amount_cents": 2400}]
        )

    def run(self, policy: list[dict[str, Any]]) -> dict[str, Any]:
        # A real model adapter would consume the current observations here.
        # This scripted policy deliberately does not perform model inference.
        final = None
        reason = "policy_exhausted"
        for turn, action in enumerate(policy, start=1):
            if turn > self.max_turns:
                reason = "turn_budget_exceeded"
                self.record("budget_exceeded", budget="turns")
                break
            self.record("proposal", turn=turn, action=action)
            if action.get("kind") == "final":
                final = action.get("text", "")
                reason = "final"
                self.record("final_claim", text=final)
                break
            if action.get("kind") != "tool":
                self.record("rejected", reason="unknown action kind")
                continue
            if self.tool_calls >= self.max_tool_calls:
                reason = "tool_budget_exceeded"
                self.record("budget_exceeded", budget="tool_calls")
                break
            # Invalid/blocked attempts consume budget too.
            self.tool_calls += 1
            name = action.get("name")
            try:
                args = self.validate(name, action.get("args"))
                result = self.execute(name, args)
                self.record("observation", tool=name, result=result)
            except (ValueError, PermissionError) as exc:
                self.record("rejected", tool=name, reason=str(exc))
        state_ok = self.verify()
        success = reason == "final" and state_ok
        self.record("verification", state_ok=state_ok, task_success=success)
        return {"task_success": success, "stop_reason": reason,
                "tool_attempts": self.tool_calls, "final_claim": final,
                "state": self.state, "trace": self.trace}


def load_policies() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", choices=sorted(load_policies()), default="happy")
    parser.add_argument("--approve", action="store_true", help="simulate operator approval")
    parser.add_argument("--max-tool-calls", type=int, default=4)
    args = parser.parse_args()
    if args.max_tool_calls < 0:
        parser.error("--max-tool-calls cannot be negative")
    harness = Harness(approvals={"order-7"} if args.approve else set(),
                      max_tool_calls=args.max_tool_calls)
    print(json.dumps(harness.run(load_policies()[args.scenario]), indent=2))


if __name__ == "__main__":
    main()
