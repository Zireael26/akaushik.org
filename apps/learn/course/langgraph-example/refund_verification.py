"""Model-free fan-out/fan-in: a final claim is not proof of a refund."""
from __future__ import annotations

import json
from typing import Annotated, Literal, TypedDict

from langgraph.graph import END, START, StateGraph


class Evidence(TypedDict):
    source: str
    order_id: str
    status: str
    amount_cents: int


def merge_evidence(left: dict[str, Evidence], right: dict[str, Evidence]):
    """Duplicate IDs must agree; conflicts fail closed, never last-writer-wins."""
    merged = dict(left)
    for key, value in right.items():
        if key in merged and merged[key] != value:
            raise ValueError(f"conflicting evidence ID: {key}")
        merged[key] = value
    return merged


class State(TypedDict):
    order_id: str
    evidence: Annotated[dict[str, Evidence], merge_evidence]
    final_claim: str
    verified: bool
    terminal_status: Literal["pending", "verified", "needs_review"]


def build_graph(scenario: str):
    # Trusted fixture stands in for an external service, outside graph state.
    refunded = scenario != "false_completion"
    backend = {
        "order": {"status": "refunded" if refunded else "paid", "paid_cents": 2400},
        "receipts": [{"order_id": "order-7", "amount_cents": 2400}] if refunded else [],
    }

    def start(state: State):
        if state["order_id"] != "order-7":
            raise ValueError("unknown order")
        return {"terminal_status": "pending"}

    def retrieve_order(state: State):
        return {"evidence": {"order-service:order-7": {
            "source": "order-service", "order_id": state["order_id"],
            "status": backend["order"]["status"], "amount_cents": 2400,
        }}}

    def retrieve_ledger(state: State):
        if scenario == "missing_evidence":
            return {"evidence": {}}
        return {"evidence": {"ledger:order-7": {
            "source": "ledger", "order_id": state["order_id"],
            "status": "found" if backend["receipts"] else "missing",
            "amount_cents": 2400 if backend["receipts"] else 0,
        }}}

    def propose(_state: State):
        # Deliberately overconfident policy: identical claim in every case.
        return {"final_claim": "The full refund is complete."}

    def verify(state: State):
        expected = {"order-service:order-7", "ledger:order-7"}
        complete_evidence = set(state["evidence"]) == expected
        # Independent oracle rereads authoritative fixture, not the final claim.
        actual_refund = (
            backend["order"]["status"] == "refunded"
            and backend["receipts"] == [{"order_id": "order-7", "amount_cents": 2400}]
        )
        return {"verified": complete_evidence and actual_refund}

    def route(state: State) -> Literal["complete", "review"]:
        return "complete" if state["verified"] else "review"

    builder = StateGraph(State)
    for name, node in [("start", start), ("order", retrieve_order),
                       ("ledger", retrieve_ledger), ("propose", propose), ("verify", verify)]:
        builder.add_node(name, node)
    builder.add_node("complete", lambda _: {"terminal_status": "verified"})
    builder.add_node("review", lambda _: {"terminal_status": "needs_review"})
    builder.add_edge(START, "start")
    builder.add_edge("start", "order")
    builder.add_edge("start", "ledger")
    builder.add_edge(["order", "ledger"], "propose")  # Explicit barrier: wait for both.
    builder.add_edge("propose", "verify")
    builder.add_conditional_edges("verify", route, {"complete": "complete", "review": "review"})
    builder.add_edge("complete", END)
    builder.add_edge("review", END)
    return builder.compile()


def initial_state() -> State:
    return {"order_id": "order-7", "evidence": {}, "final_claim": "",
            "verified": False, "terminal_status": "pending"}


if __name__ == "__main__":
    for scenario, expected in [("verified", "verified"),
                               ("false_completion", "needs_review"),
                               ("missing_evidence", "needs_review")]:
        result = build_graph(scenario).invoke(initial_state())
        assert result["terminal_status"] == expected, result
        print(json.dumps({"scenario": scenario, **result}, sort_keys=True))
