# Course audit brief — Harness Engineering course

You are the subject-matter reviewer for a 24-lesson course on harness / agent-systems
engineering. The course was drafted by another model. Your job is to **audit it and
improve it in place**, not to rewrite it into your own voice.

## Where things are

Everything is under `apps/learn/course/` in this repo (working dir is the repo root).

- `CURRICULUM.md` — syllabus, module map, learning outcomes
- `MANIFEST.json` — canonical inventory (lesson → module → lab mapping, counts)
- `lessons/01..24-*.md` — 24 lesson texts (~25k words total). These are the spine.
- `assessments/module-assessments.json` — 12 module assessments (prompt + answer)
- `assessments/assignments.json` — 24 assignments
- `assessments/WORKBOOK.md`, `assessments/TRACE-CASES.md`
- `solutions/SOLUTIONS.md`, `solutions/TRACE-KEY.md` — answer keys
- `labs/` — 12 runnable Python labs (`run_lab.py`), `labs/README.md` has expected observations
- `starter-labs/`, `langgraph-example/`, `notebooks/` — supporting executable material
- `templates/` — work-contract / threat-model / evaluation-protocol etc.
- `visuals/*.html` — two interactive atlases
- `RESEARCH.md`, `VERIFICATION.md`, `QUICK-REFERENCE.md`, `START-HERE.md`, `PROGRESS.md`
- `Harness-Engineering-*.pdf` — generated artefacts. **Do not edit the PDFs.** They are
  regenerated from source by `tools/build_books.py`; if your edits make them stale, say so
  in the report rather than trying to rebuild them.

## What to check, in priority order

1. **Technical correctness.** Claims about agent loops, LangGraph semantics, reducers,
   durable execution, idempotency, approvals, evaluation statistics, queueing, sandboxing,
   MCP/A2A protocols. Flag and fix anything wrong, overclaimed, or stated with more
   confidence than the cited evidence supports. Check the statistics lesson especially
   (paired comparison, resampling, multiple-comparison / selection effects) — statistical
   sloppiness is the most common failure mode in material like this.
2. **Assessment quality.** For every module assessment and every assignment:
   - Does the stated answer actually answer the prompt?
   - Is the prompt answerable from the lessons that precede it?
   - Is it testing understanding or recall of a phrase?
   - Are there ambiguities that would let a correct answer be marked wrong?
   Fix bad prompts and bad keys. Where an assessment is too thin for the module it covers,
   strengthen it. Keep the JSON schema exactly as it is (same keys, same shape).
3. **Curriculum coherence.** Does each lesson pay off the outcome `CURRICULUM.md` claims
   for it? Are there forward references to concepts not yet introduced? Are there gaps
   where a lesson assumes a step it never taught? Is the module pairing sensible?
4. **Consistency across artefacts.** Lesson text vs `MANIFEST.json` vs `CURRICULUM.md` vs
   `labs/README.md` vs the solution keys. Lesson numbering, module numbering, lab commands,
   and cross-references must all agree.
5. **Currency.** Research claims are dated 2026-09-12 in `RESEARCH.md`. Flag anything that
   reads as already-stale or that depends on a framework version that has moved.
6. **Prose.** Tighten where it is padded. Do not flatten the register — the writing is
   deliberately plain and technical, and should stay that way. No em dashes.

## Constraints

- **Edit in place.** Real edits to the real files, not a list of suggestions.
- Preserve the JSON schemas in `assessments/*.json` and the structure of `MANIFEST.json`.
  If a count changes (e.g. you add an assessment item), update `MANIFEST.json` to match.
- Do not delete lessons or renumber them. If a lesson must be restructured, restructure it
  in place under its existing number and title.
- Do not add new external links you cannot vouch for. Existing citations: verify the claim
  attributed to each one is actually the kind of claim that source would make; if you
  cannot verify, weaken the claim rather than the citation.
- This content will be published on a website and rendered from the markdown, so keep the
  markdown clean and standard (GFM). Headings must nest properly — a lesson starts at `#`
  and never skips a level.
- Python files: if you change a lab, it must still run. Do not break `tools/verify_all.py`.

## Deliverable

When done, write `apps/learn/course/REVIEW-FABLE.md` containing:

- A verdict paragraph: is this course sound, and what is its actual level?
- **Changes made** — grouped by file, with the reasoning for each substantive one.
- **Errors found and fixed** — the technical mistakes specifically, stated plainly.
- **Left alone deliberately** — things that look wrong but are not, so nobody re-opens them.
- **Open issues** — anything you could not resolve, anything the author must decide, and
  anything that is now stale in the generated PDFs.

Work through the whole course. Do not sample. This is expected to take a while; thoroughness
matters more than speed.
