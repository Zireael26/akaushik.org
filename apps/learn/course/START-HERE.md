# Start Here: The Complete Course

This edition contains the entire teaching course. Begin with Lesson 1 in the offline reader or textbook; every later lesson, lab, assignment, answer, and reference capstone is already available. You can study at any pace. The suggested schedule is 24 weeks at 15–20 hours per week, including implementation and experiments.

## Open the materials

- `Harness-Engineering-Reader.html`: a self-contained offline reader with all 24 lessons, assignments, revealable solutions, module assessments, search, progress export/import, and both visual atlases embedded. Open the downloaded file in a browser; no server or account is required. If an in-app preview does not execute HTML, open the file in a regular browser.
- `Harness-Engineering-Course.pdf`: complete textbook, research foundation, syllabus, and quick references.
- `Harness-Engineering-Workbook.pdf`: all assignments, module assessments, lab instructions, and capstone briefs.
- `Harness-Engineering-Solutions.pdf`: worked answers, assessment keys, and capstone explanations.
- `visuals/harness-experiments.html`: five foundational interactive models.
- `visuals/advanced-atlas.html`: seven advanced interactive models.
- `notebooks/`: three executed computational notebooks with reproducible calculations.

## Run the reference labs

The verified interpreter is Python 3.12.14. Create a virtual environment with Python 3.12, activate it, and install the exact lock file. Initial dependency installation requires internet access; normal course labs make no network or paid model calls.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r labs/requirements-lock.txt
python labs/run_lab.py 1
python labs/run_lab.py all --output my-results
python tools/verify_all.py
```

On Windows, activate with `.venv\Scripts\activate` instead. The commands use `python` from the active environment. The standard-library labs also run without LangGraph; Labs 4 and 5 and graph tests require the pinned packages. `requirements.txt` lists the direct runtime dependencies; `requirements-lock.txt` records the full tested environment.

The all-labs command uses a fresh temporary workspace and copies results into your chosen output directory. Choose a new output directory for a distinct experiment so older artifacts cannot be mistaken for current evidence. The reference results in `output/` were generated during the course build. Receipt IDs and temporary paths can vary; invariant results should agree.

## Study sequence

Read a lesson, predict its worked example, complete the assignment, run the corresponding module lab, and compare with the separate answer key. Each module pairs two lessons. Do the module assessment after both. Use the reference implementation when stuck, then explain the boundary without reading the code. Keep your own experiment manifest and decision record.

Module 1 uses Lab 1; Module 2 uses Lab 2; this continues through Module 12 and Lab 12. The `labs/README.md` gives exact expected observations and extensions for all twelve. The original three starter labs and six-test LangGraph bridge remain available for additional practice.

## What the executable evidence establishes

The labs demonstrate local control flow, strict contracts, evidence merging, task/cluster resampling, SQLite persistence, LangGraph interrupt/restart, approval and effect invariants, memory lifecycle, lease fencing, synthetic optimization, and six known coding repairs. All model policies in the default labs are deterministic or explicitly simulated.

No paid provider experiment was run. The optional `labs/live_text.py` makes one explicitly opted-in text call to a compatible endpoint. It does not execute returned code or actions. The adapter was tested against a local fake HTTP server; provider-specific features and model compatibility need separate verification. The coding runner executes trusted bundled fixtures in a subprocess, which is not a security sandbox. The JSON-RPC example is a teaching subset, not a complete MCP or A2A implementation.

The tiny datasets are teaching fixtures, not representative benchmarks. In particular, the optimization splits reuse lexical patterns and do not establish family-level generalization. Research claims and their scope are documented in `RESEARCH.md`, dated 12 September 2026. Future framework/model upgrades require revalidation.

## Continue with your tutor

Bring the assignment, prediction, actual trace, and one question. We can teach, debug, and review at your pace without creating missing future lessons. The progress export records completed lessons and notes; it is a local study aid, not an automatic assessment or a claim of mastery.
