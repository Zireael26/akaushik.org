# LangGraph week 7 example

Tested on 12 September 2026 with Python 3.12.14, LangGraph 1.2.11, Linux x86_64. This is real LangGraph execution with deterministic local fixtures. No model, credentials, provider calls, or refund mutation is involved.

See `../LANGGRAPH-LAB.md` for the bridge lesson and expected execution. The complete persistence/approval companion is implemented in `../labs/coursekit/graphs.py` and `product.py`, exercised by Lab 5, and tested in `../labs/tests/test_graphs.py`. This original bridge remains a separate six-test example.

From this directory:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
LANGSMITH_TRACING=false LANGCHAIN_TRACING_V2=false .venv/bin/python refund_verification.py
LANGSMITH_TRACING=false LANGCHAIN_TRACING_V2=false .venv/bin/python -m unittest -v test_example.py
```

`requirements.txt` pins the direct dependency. `requirements-lock.txt` records the exact dependency versions of the executed environment; it is not a hash lock or a promise of cross-platform equivalence.

Verified results:

| Scenario | Terminal status | Verification |
|---|---|---|
| verified | verified | true |
| false_completion | needs_review | false |
| missing_evidence | needs_review | false |

All scenarios emit the same confident claim. Six unittest checks passed: parallel readers join before proposal; identical final claims cannot override verification; incomplete evidence is rejected; duplicate evidence is harmless while conflicts are rejected; independent IDs merge in either order; unknown orders fail before readers execute.

The evidence requirement and independent fixture oracle are deliberately separate. The example verifies a preexisting simulated refund; later course work adds permission-bound mutation, durable state, and replay handling.
