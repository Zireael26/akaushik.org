"""Show why a checkpoint cannot atomically commit a remote side effect."""

from __future__ import annotations

import argparse
import json
import sqlite3
import tempfile
from pathlib import Path


class InjectedCrash(RuntimeError):
    pass


class System:
    """Two databases model two services with independent transaction boundaries."""

    def __init__(self, directory: Path, *, deduplicate: bool):
        directory.mkdir(parents=True, exist_ok=True)
        self.deduplicate = deduplicate
        self.effects = sqlite3.connect(directory / "effect_service.sqlite")
        self.checkpoints = sqlite3.connect(directory / "orchestrator.sqlite")
        self.effects.execute("""CREATE TABLE IF NOT EXISTS ledger (
            receipt_id INTEGER PRIMARY KEY,
            business_key TEXT,
            amount_cents INTEGER NOT NULL
        )""")
        self.checkpoints.execute("""CREATE TABLE IF NOT EXISTS checkpoints (
            task_id TEXT PRIMARY KEY,
            receipt_id INTEGER NOT NULL
        )""")
        if deduplicate:
            self.effects.execute("CREATE UNIQUE INDEX IF NOT EXISTS effect_key ON ledger(business_key)")
        self.effects.commit()
        self.checkpoints.commit()

    def close(self) -> None:
        self.effects.close()
        self.checkpoints.close()

    def effect(self, business_key: str, amount_cents: int) -> int:
        if not business_key or type(amount_cents) is not int or amount_cents <= 0:
            raise ValueError("effect requires a business key and positive integer amount")
        with self.effects:
            if self.deduplicate:
                # Insertion and dedup lookup are in the effect service's transaction.
                self.effects.execute(
                    "INSERT OR IGNORE INTO ledger(business_key, amount_cents) VALUES (?, ?)",
                    (business_key, amount_cents),
                )
                receipt, previous_amount = self.effects.execute(
                    "SELECT receipt_id, amount_cents FROM ledger WHERE business_key = ?",
                    (business_key,),
                ).fetchone()
                if previous_amount != amount_cents:
                    raise ValueError("idempotency key reused with a different payload")
                return receipt
            cursor = self.effects.execute(
                "INSERT INTO ledger(business_key, amount_cents) VALUES (?, ?)",
                (business_key, amount_cents),
            )
            return cursor.lastrowid

    def run_task(self, task_id: str, *, crash_after_effect: bool = False) -> int:
        row = self.checkpoints.execute(
            "SELECT receipt_id FROM checkpoints WHERE task_id = ?", (task_id,)
        ).fetchone()
        if row:
            return row[0]
        # Same semantic operation has the same key across retries and agent handoffs.
        receipt = self.effect("refund:order-7:v1", 2400)
        if crash_after_effect:
            raise InjectedCrash("effect committed; checkpoint has not been written")
        with self.checkpoints:
            self.checkpoints.execute(
                "INSERT INTO checkpoints(task_id, receipt_id) VALUES (?, ?)",
                (task_id, receipt),
            )
        return receipt

    def summary(self) -> dict:
        count, amount = self.effects.execute(
            "SELECT COUNT(*), COALESCE(SUM(amount_cents), 0) FROM ledger"
        ).fetchone()
        done = self.checkpoints.execute("SELECT COUNT(*) FROM checkpoints").fetchone()[0]
        return {"effect_count": count, "total_cents": amount, "completed_checkpoints": done}


def demonstrate(directory: Path, *, deduplicate: bool) -> dict:
    system = System(directory, deduplicate=deduplicate)
    try:
        try:
            system.run_task("task-7", crash_after_effect=True)
        except InjectedCrash:
            after_crash = system.summary()
    finally:
        # Close and reopen both connections: in-memory flags cannot rescue the replay.
        system.close()
    system = System(directory, deduplicate=deduplicate)
    try:
        receipt = system.run_task("task-7")
        after_retry = system.summary()
        assert system.run_task("task-7") == receipt
        return {"mode": "business_key_dedup" if deduplicate else "unsafe",
                "after_crash": after_crash, "after_retry": after_retry,
                "after_completed_task_replay": system.summary()}
    finally:
        system.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="harness-durability-") as temporary:
        root = Path(temporary)
        result = [demonstrate(root / "unsafe", deduplicate=False),
                  demonstrate(root / "deduplicated", deduplicate=True)]
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
