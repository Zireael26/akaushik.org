# Verified local results

The commands below were executed successfully in the authoring environment. Results are deterministic teaching simulations with synthetic fixtures, not LLM experiments.

| Harness command | Task success | Tool attempts | Refund count | Stop reason |
|---|---:|---:|---:|---|
| `python 01_harness.py --scenario happy --approve` | true | 2 | 1 | final |
| `python 01_harness.py --scenario happy` | false | 2 | 0 | final |
| `python 01_harness.py --scenario false_claim` | false | 0 | 0 | final |
| `python 01_harness.py --scenario forged_approval` | false | 2 | 0 | final |
| `python 01_harness.py --scenario invalid_args --approve` | false | 2 | 0 | final |
| `python 01_harness.py --scenario loop --max-tool-calls 2` | false | 2 | 0 | tool_budget_exceeded |

`python 02_durable_effects.py`: after crash and retry, unsafe mode records 2 effects totaling 4800 simulated cents; business-key dedup records 1 effect totaling 2400. Both record one completed checkpoint after retry. A subsequent replay of the completed task preserves these counts.

`python 03_eval_metrics.py --k 2 --seed 42`: paired candidate-minus-baseline macro pass@2 difference is 0.0416667, with a seeded 5000-replicate task-bootstrap percentile interval of [-0.1666667, 0.2291667]. Macro pass^2 difference is 0.0833333, with interval [-0.0833333, 0.2500000]. Both intervals include zero. Baseline cost per successful attempt is 2 abstract units; candidate is 2.6666667.

`python test_labs.py`: **16 tests passed**. Nonfinite costs are rejected in both variants, including Python float values and JSON-loaded `NaN`, `Infinity`, `-Infinity`, and overflowing numeric literals. Test coverage is described in the README and visible in `test_labs.py`.

These results verify the local demonstration code and arithmetic. They make no empirical claim about a real model, LangGraph, or a deployed agent system.
