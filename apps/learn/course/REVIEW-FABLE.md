# Course review: Harness Engineering and Multi-Agent Systems

Reviewer: Claude Fable 5.1. Scope: every file under `apps/learn/course/` except the three PDFs. Date of review: 12 September 2026. Test baseline before and after edits: 93 Python tests pass under the pinned environment (Python 3.12, LangGraph 1.2.11) and all twelve lab drivers run.

## Verdict

The course is sound. Its technical claims about agent loops, LangGraph semantics (reducers, supersteps, `Send`, `Command` plus static edges, interrupt re-entry, subgraph persistence), idempotency, approvals, leases and fencing, and protocol scope are correct and are stated with appropriate limits. The labs implement what the lessons describe, and the numbers quoted in lessons, solutions, and `labs/README.md` match the code's actual output. The statistics lesson is careful about the experimental unit, pairing, finite-sample estimators, correlated attempts, and cost denominators. The one place it needed help was in the fixture itself: the four-family cluster bootstrap in Lab 3 produces an interval that excludes zero while the task-level interval includes it, and nothing in the course told the learner that this is a small-cluster artifact. That is now stated in the lesson, the lab guide, the solution, and the atlas.

Its actual level is what the syllabus claims: an advanced practitioner course for someone who already ships agent systems. It is not a LangGraph tutorial and not a research course; it is a course in engineering judgment with executable, deterministic evidence. The weakest parts are the single-question module assessments, several of which were thin for the module they gate. Six of them have been strengthened with a second, calculable part.

## Changes made

### `lessons/06-statistics-and-agent-economics.md`

- Added an explicit statement of the selection effect under multiple comparisons: the maximum of several noisy estimates is biased upward even when nothing is better, and a single holdout evaluation of the frozen winner is honest only because the holdout played no part in selection. The original sentence gestured at this without saying why.
- Added the Lab 3 cluster-interval observation to the confidence-interval section and the practice section. Reason: a learner running the lab sees a narrower four-family interval that excludes zero and would otherwise be led to the opposite of the intended conclusion.

### `lessons/10-approvals-and-compatible-change.md`

- Fixed the claim that the migration tests cover an old pending approval, a completed operation, an already migrated record, and an unsupported version. The reference tests cover a missing status and an unsupported version only. The other two are now assigned to the learner.
- Reworded "preserves the intent digest" to say the migration copies every existing field unchanged, which is what the code does.
- Made the forward references to Labs 9 and 10 explicit rather than implicit, since they belong to Modules 9 and 10.
- Typo: "a intended pause".

### `lessons/12-testing-multiagent-claims.md` and `RESEARCH.md`

- The scaling study cited as v1 (December 2025, 180 configurations) has a v2 (8 April 2026, 260 configurations, six benchmarks) that the research snapshot dated September 2026 did not mention. Added the revision to both places. The lesson's numbers are labelled as the December 2025 version.
- The 0.349 to 0.631 Finance-Agent result is an 80.8% relative gain from those decimals; the text said 80.9%. Changed to "about 81%" in `RESEARCH.md`.
- MAST trace count changed from the precise 1,642 to "more than 1,600", which is what the paper's abstract states.

### `lessons/15-long-horizon-coding.md`

- "Six small repositories" overstated the fixtures, which are single-file workspaces. Reworded.
- Pointed the practice section at Lab 12, where the coding runner actually lives, since Module 8's lab is the memory lab.
- Replaced a claim that the workbook contains a two-change integration extension (it does not) with the Capstone B brief's actual requirement.

### `lessons/05`, `08`, `18`

- Three pointers to "the workbook" referred to material that lives in `assessments/TRACE-CASES.md` (the ten evaluation outcomes, the two join policies) or does not exist under that name (an "attack matrix"). Repointed to the trace cases and to the paired-cases section of `templates/threat-model.md`.

### `lessons/07`, `21`

- Lesson 7 told Module 4 learners to run Lab 5's persistence case as if it were part of the module. It is now described as a preview that Module 5 explains.
- Lesson 21 names the third optimization policy "confirmation"; the code calls it `evidence`. Added the code name.

### `QUICK-REFERENCE.md`

- Amdahl's law was written as `1/((1-f)+f/n)` while describing `f` as the serial fraction. With that definition the correct form is `1/(f+(1-f)/n)`, which is what Lesson 8 uses. Fixed.

### `labs/README.md`, `visuals/advanced-atlas.html`

- Lab 3 entry now states both intervals and why the family interval is the weaker evidence. The atlas uncertainty panel carries the same warning in its note. No behaviour changed in the atlas.

### `tools/author_assessments.py` and the four files it generates

The JSON, workbook, and solutions are generated from this script, so edits were made there and the script was rerun. Verified first that the unmodified script reproduced the four checked-in files byte for byte. Schema unchanged.

- Solution 06 now names the cluster-interval artifact.
- Assignment 15 prompt names Lab 12 for the coding runs. The `lab` field stays 8 to keep the lesson-module-lab mapping intact.
- Module assessments 1, 3, 4, 5, 8, 10 gained a second part with a definite answer: budget exhaustion with a pending job; finite-sample pass@2 and pass^2 for 3 of 4; `Command` plus static edge; per-attempt idempotency keys; the 23-record, 4-call coverage preflight; the check-then-spend budget race. Each is answerable from the paired lessons and has a calculable or testable answer rather than a slogan. The other six were already discriminating.

### `MANIFEST.json`, `VERIFICATION.md`

- Recomputed `bytes` and `sha256` for the 19 files changed by this review, and updated `counts.lesson_words` (25,109 to 25,363). Structure unchanged. PDF, reader, and output hashes are untouched because those files were not rebuilt.
- Replaced the em dash in the VERIFICATION heading.

## Errors found and fixed

1. Amdahl's law in the quick reference had the serial and parallel fractions swapped relative to its own definition of `f`.
2. Lesson 10 claimed test coverage for two migration cases that no test exercises.
3. Lesson 15 described the workbook as containing an integration extension that does not exist, and described single-file fixtures as repositories.
4. Lessons 5, 8, and 18 pointed learners at the wrong document for required exercises.
5. The Lab 3 cluster bootstrap was presented without warning that its four-cluster percentile interval is narrower than the task interval and excludes zero. This is not a code bug (the percentile computation is right, and I confirmed the 2.5th percentile by hand from the four family means 0.25, 0, 0.25, 0.25), but it was a statistical trap in teaching material whose explicit purpose is to avoid such traps.
6. The research snapshot cited a superseded paper version as current, and one relative-improvement figure did not follow from the absolute numbers quoted beside it.
7. Lesson 21 and the atlas used a policy name that does not match the code.

## Left alone deliberately

- **`Command` plus a static edge schedules both destinations.** This looks like it might be a course-invented trap. It is documented behaviour in the current Graph API page ("static edges defined with add_edge still execute"), the lab tests it, and the pinned runtime visits both nodes.
- **Lesson 8's statement that the subgraph docs warn about concurrent use of a shared persistent namespace.** I expected this to be an overclaim. The live page does carry that warning for per-thread subgraphs with parallel tool calls.
- **Lab 6's scheduling model gives the supervisor the same 24-second critical path as the sequential single agent.** That follows from the model's own assumptions (dispatch, worker round, review, each one call long, two rounds) and the lesson says it is arithmetic under stated assumptions, not a prediction.
- **Expiry semantics.** Approval validity is strictly before expiry (`now >= expires` rejects) and memory validity is strictly before expiry. Lessons, solutions, tests, and the atlas all agree, including the "execute at 40 with expiry 40" case.
- **Assignment 10's changed-amount case fails on the full-refund policy before it can reach the approval-hash comparison.** The solution says so. The service checks both, and the lesson's point (a changed payload cannot reuse an approval) is still exercised by the hash-bound design and the `changed_amount` case in Lab 9.
- **The `ReadOnlyProtocol` returns permission failures as JSON-RPC errors.** The MCP tools spec puts tool execution errors in the result with `isError: true`. Lesson 14 already states that the handler simplifies this and that a real server must follow the versioned tool-error semantics.
- **Em dashes in two cited titles** (Anthropic's "Writing effective tools for agents — with agents", in Lesson 1 and `RESEARCH.md`). The dash is part of the published title; altering it would misquote the source.
- **Lesson 1 and Lesson 6 both compute 1 − (1 − 0.8)^5 and 0.8^5.** The repetition is deliberate: the first is a motivating illustration, the second introduces the finite-sample estimators that replace it.
- **`OpenAI, September 2026` skills guidance in Lesson 4.** The page exists and says what the lesson attributes to it (shorter triggers, progressive disclosure, reassess accumulated instructions after upgrades).
- **The `lab` field of assignment 15 remains 8.** Changing it to 12 would break the one-lab-per-module invariant that `MANIFEST.json`, `START-HERE.md`, and the reader all rely on. The prompt text now names Lab 12 instead.
- **Prose register.** The writing is plain and dense already. I did not tighten for its own sake; every prose change above corrects a fact or a pointer.

## Open issues

### Now stale in generated artefacts

- `Harness-Engineering-Course.pdf`, `Harness-Engineering-Workbook.pdf`, `Harness-Engineering-Solutions.pdf` contain the old Lesson 6, 10, 12, 15 text, the old quick-reference Amdahl line, the old research paragraph, and the six original module-assessment prompts. Rebuild with `tools/build_books.py` (needs the ReportLab build requirements and a font path adjustment on macOS).
- `Harness-Engineering-Reader.html` embeds all lessons, the workbook, the JSON, `RESEARCH.md`, `QUICK-REFERENCE.md`, `labs/README.md`, and both atlases. It is stale for the same reasons. `tools/build_reader.py` regenerates it offline (needs the `markdown` package). I did not rebuild it because `VERIFICATION.md` and `output/browser-verification.json` describe the previous build; whoever rebuilds should rerun those browser checks or note that they were not repeated.
- `output/all-test-suites.txt` and `output/reference-run/` still describe a run of the previous sources. Test count and lab outputs are unchanged by this review (no Python under `labs/` or `starter-labs/` was modified), so they remain accurate, but their recorded hashes would not match if anyone compares.

### Author decisions

- **Module 5's lab does not exercise the module's own gate.** The curriculum gate for Module 5 is "changed payloads cannot reuse an approval", but Lab 5 tests a matching approval and crash recovery, and the changed-amount, expired, revoked, and wrong-tenant cases are in Lab 9. Lesson 10 now tells the learner to run Lab 9 early. The cleaner fix is to add those four cases to the Lab 5 driver; that changes lab output and the recorded reference run, so I left it as a decision.
- **Module 8 has no lab for its coding lesson.** Lab 8 is memory only; Lesson 15's exercises run from Lab 12. Consider a Lab 8 driver that also invokes one coding fixture, or accept the cross-reference as is.
- **`CURRICULUM.md` names readings that are not in the research registry**: AgentDojo (Module 9), τ²-bench and a "benchmark-audit" source (Module 3). Either add registry entries or drop the names. I did not add links.
- **Module assessment 3's new part uses n=4, c=3**, distinct from the n=4, c=2 enumeration in the trace cases, so the learner cannot copy the key. If you prefer identical numbers across both, change one.
- **The atlas holdout reveal hard-codes "75% for keyword, else 100%".** That is correct for the two winners the freeze logic can produce, but it would be wrong if someone later exposes the `evidence`/`confirmation` policy as a possible winner (its holdout score is 75%). Worth a comment in the source.

### Could not verify

- OpenAI's July 2026 SWE-Bench Pro audit page returned HTTP 403 to the fetcher, so the figures 200, 249, and 731 in `RESEARCH.md` were not checked. The text already frames them as that post's own audit finding; I left them.
- The MCP security best-practices URL under `docs/2025-11-25/tutorials/security/` was not fetched. The tools specification for 2025-11-25 does exist and confirms the isError versus protocol-error split the course relies on.
- Whether a newer MCP specification revision than 2025-11-25 or a newer A2A release than 1.0.0 exists as of the research date. The course pins versions explicitly, which is the right posture; a currency note in `RESEARCH.md` would be appropriate if a newer revision is confirmed.
- LangGraph 1.2.11 is the pinned and locally verified version. Whether newer releases changed any exercised behaviour was not tested.

### Verified as current

- The following sources were fetched and match what the course attributes to them: OpenAI "Rethinking skills and prompts for GPT-6 Astra"; Agent Lightning v1.0 (arXiv 2608.17528, 18 August 2026); "The Cost of Consensus" (2.1 to 3.4 times tokens); AgentDyn v3 (60 tasks, 560 injections, ten defenses); MAST v3 (14 modes, 3 categories, LLM-judge annotation); Anthropic "Harness design for long-running application development" (24 March 2026) and "Scaling Managed Agents" (8 April 2026); the LangGraph Graph API and subgraph pages; the MCP 2025-11-25 tools specification.

## Regenerated artefacts

Done on 12 September 2026, after the edits above, on macOS with Python 3.12.11.

**Rebuilt from source**

- `Harness-Engineering-Course.pdf`, `Harness-Engineering-Workbook.pdf`, `Harness-Engineering-Solutions.pdf` via `tools/build_books.py` in a throwaway venv installed from `tools/requirements-build.txt`. Page counts are unchanged (94, 22, 18). Text-presence checks confirm each volume now carries the review's edits.
- `Harness-Engineering-Reader.html` via `tools/build_reader.py`. It embeds the edited lessons, workbook, JSON, research notes, quick reference, lab guide, and the atlas with the new cluster-interval note.
- `output/pdf-verification.json`: regenerated with a PyMuPDF script that reproduces the original fields (page count, blocks outside the page rectangle, empty pages, outline entries, links, figure pages) and adds the text-presence checks. No empty or out-of-bounds pages.
- `output/browser-verification.json` and `output/previews/*.png`: the 26 named checks were repeated offline against the rebuilt reader with Playwright Chromium (the repository's pinned `playwright@1.61.1`) over `file://`. Zero page or console errors, no horizontal overflow at 1440 or 390 px, all seven atlas panels on desktop and mobile, the seven boundary assertions, the progress import/export roundtrip, the assessment content, and the foundation loop control all pass. The boundary and content assertions now also cover text the review introduced.
- `MANIFEST.json`: bytes and hashes refreshed for every regenerated artefact and for the two tool files changed below.

**Tooling change needed to rebuild**

`tools/pdf_engine.py` hard-coded the Linux DejaVu directory. It now resolves the font directory from `COURSE_FONT_DIR`, then that Linux path, then matplotlib's bundled DejaVu fonts (matplotlib is already in the build requirements). No font was added to the repository and the typeface is identical to the original build. `tools/README.md` describes the new resolution order.

**Could not be repeated exactly**

- The original verification ran on Linux with Python 3.12.14; this pass used macOS and Python 3.12.11 with the same pinned LangGraph 1.2.11. `output/all-test-suites.txt` is still the original Linux transcript; the macOS re-run of `tools/verify_all.py` gave the same 71 + 16 + 6 = 93 passes, and no Python under `labs/`, `starter-labs/`, or `langgraph-example/` was changed by the review.
- `output/reference-run/` was not regenerated. The lab code is unchanged, so its recorded results remain accurate; the receipt UUIDs and temp paths in it would differ on any rerun regardless.
- The original browser-check script was not in the repository, so the repeat is a reimplementation of the 26 checks by name, kept in the review scratchpad rather than added to `tools/`. If the author wants the checks reproducible from the repo, the script should be committed and pointed at the pnpm Playwright path.

**What a reader of `VERIFICATION.md` should now believe**

Everything it states is true of the files currently in the directory: the PDFs and reader match the edited source, the browser and PDF checks were rerun against those rebuilt files and passed, and the Python suites pass under the pinned dependencies. The one carried-over item is the test transcript, which is from the original Linux run and is consistent with the macOS re-run.
