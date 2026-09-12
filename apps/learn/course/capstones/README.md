# Complete Reference Capstones

Both implementations are supplied and run with `python labs/run_lab.py 12 --output my-capstones` from the package root. The driver creates fresh local databases and trusted miniature coding environments. It saves result JSON, SQLite state, repaired source, independent acceptance assertions, and per-task reports.

Product source: `labs/coursekit/product.py`; actual LangGraph integration: `labs/coursekit/graphs.py`; driver: `labs/run_lab.py` (`product_reference` and Lab 5). Run Lab 5 for interrupt and persisted graph restart, Lab 9 for eight service boundary cases, and Lab 12 for the controller/effect-store walkthrough.

Coding source: `labs/coursekit/coding.py`; six known reference patches and six unchanged negative controls are included. These trusted local fixtures are not a live LLM benchmark or a security sandbox. The optional text adapter never executes returned code.

Complete briefs and scoring: `assessments/WORKBOOK.md`. Worked walkthroughs and expected claims: `solutions/SOLUTIONS.md`. Recorded evidence: `output/reference-run/results.json`. Lessons 23–24 explain integration and defense. No capstone reference implementation is deferred to a later teaching session.
