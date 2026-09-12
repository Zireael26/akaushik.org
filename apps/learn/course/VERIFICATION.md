# Verification Record: Complete Edition

Originally verified on 12 September 2026 with Python 3.12.14 and LangGraph 1.2.11 on Linux. Re-verified the same day, after the Fable review edits, with Python 3.12.11 and LangGraph 1.2.11 on macOS; the three PDFs, the offline reader, and the records in `output/` were regenerated in that second pass. The exact runtime packages are in `labs/requirements-lock.txt`.

## Executable evidence

- 71 core and graph tests passed, including strict input boundaries, evidence conflicts, stale/cancelled tasks, memory expiry, tenant scope, approval binding, duplicate effects, lease fencing, finite-sample metrics, a local fake-server adapter contract, static-plus-dynamic graph routing, and projected subgraphs.
- 16 original starter tests passed.
- 6 original LangGraph bridge tests passed.
- Total: 93 automated Python tests passed. Full output: `output/all-test-suites.txt` (from the original Linux run; the macOS re-run after the review produced the same 71 + 16 + 6 result and no Python under `labs/`, `starter-labs/`, or `langgraph-example/` changed).
- All 12 module drivers ran. Results and saved artifacts: `output/reference-run/`.
- The actual LangGraph recovery test pauses at an interrupt, resumes with a trusted approval reference, crashes after a service commit, closes and reopens the effect and checkpoint databases, then resumes with one effect and a verified outcome.
- All six seeded coding baselines fail their intended acceptance suites; all six reference patches pass; all six unchanged negative controls remain unverified.
- Three pure-Python computational notebooks executed and contain recorded outputs.

## Reader and visual evidence

Twenty-six browser checks passed with no JavaScript errors or horizontal overflow. The checks were repeated offline with Playwright Chromium against the reader rebuilt after the review; the record in `output/browser-verification.json` and the previews are from that repeat, and its boundary assertions include the text the review added (the cluster-interval warning, the strengthened module assessments). Checks include desktop/mobile reader layouts, lesson navigation, search, solution reveal, local notes/progress, progress import/export roundtrip, both embedded atlases, all seven advanced model panels, and boundary interactions. The standalone foundational atlas was also verified in the preceding edition; the complete reader's embedded foundational loop was exercised in this edition. Browser results: `output/browser-verification.json`. Selected inspected previews: `output/previews/`.

The three PDFs were rebuilt from the edited source and contain 94, 22, and 18 pages respectively, with internal navigation/bookmarks and linked sources. Every page of the rebuilt files was checked for empty output and text outside the page rectangle; the cover and the edited Lesson 6 page were rendered and inspected. No out-of-bounds text or empty pages were found, and text-presence checks confirm the review edits reached each volume. Results: `output/pdf-verification.json`.

## Scope of the claims

These checks establish the covered local software behaviors under the pinned environment. The default model policies are deterministic or simulated, effect services use local synthetic SQLite data, and the coding runner executes trusted miniature fixtures. No paid model calls or live-model capability evaluation were performed. The optional adapter was tested against a local fake HTTP server. The protocol handler is a teaching subset, not MCP/A2A conformance. The subprocess runner is not a security sandbox. Tiny lexical optimization splits do not establish task-family generalization. Research evidence and its limitations are separately documented in `RESEARCH.md`.
