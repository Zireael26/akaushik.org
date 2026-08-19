# GPTx positioning correction and X thread

**Date:** 2026-07-27
**Article:** `content/writing/gptx-in-trellis.mdx`
**Publication URL:** `/writing/gptx-in-trellis`
**X account:** `@abhi2601k`

## Approved editorial decision

Rewrite the article around the reason GPTx exists: Claude Code is the primary
harness because its agent surface is the one the operator wants to use. GPTx
keeps Claude in the main loop while selected GPT workers participate through
Claude Code's ordinary agent interface.

Trellis must be described at the correct layer. It is the control plane and
inherited engineering-process framework around registered projects. Claude Code
and Codex sessions run inside those projects; there is no "Trellis session."

Approved title: **GPTx: putting GPT agents inside Claude Code**

## Reader promise

By the end, a practitioner should understand:

1. why keeping Claude Code as the harness matters;
2. how GPTx selects a model per agent without replacing the main loop;
3. what a GPT worker can do through Claude Code, including named-teammate
   continuity, workflows, structured output, review, and nested advice;
4. what Trellis contributes: adoption policy, effort selection, project rules,
   gates, degradation, and receipts;
5. how context limits, certification, monitoring, and the direct escape hatch
   keep the private setup operable; and
6. which transport failures appeared after rollout and how they were fixed.

## Article shape

Open with the unwanted choice between Claude Code's stronger harness surface
and the additional GPT quota and model family. Establish GPTx as the removal of
that choice.

Define the boundaries before implementation detail:

- Claude Code owns the session and main loop.
- GPTx supplies selective per-agent model routing inside that session.
- Trellis governs how project sessions use the capability.

Follow the operator path: start ordinary `claude` in a registered project,
dispatch `gpt-mid` or `gpt-sol`, resume a named worker, use GPT in a
schema-bound workflow, cross the model boundary for review or advice, and keep
quota-pool substitution explicit.

Retain one short section about the streaming and observability failures. Do not
let the incident become the article's premise.

Close on the private boundary and a testable next step, not a summary.

## X thread

Publish six posts in the existing account voice:

1. the unwanted harness-versus-model choice;
2. selective routing with Claude still in charge;
3. ordinary agent capabilities and named-worker continuity;
4. Trellis as the project-wide control plane;
5. cross-model review and explicit degradation;
6. the article link and the operational proof covered there.

No hashtags, launch language, numerical ranking folklore, or engagement bait.
The final post carries the article URL, as explicitly requested.

The May 2026 open-source X ranker predicts several viewer actions and negative
signals, but its production weights are runtime parameters absent from the
repository. Optimisation therefore means concrete, self-contained posts that
earn reading and response, not invented multipliers.

## Verification and publication

- manual pass against `docs/voice.md`;
- manual pass against the writing skill's `references/ai-tells.md`;
- `check-writing.sh --blog` and `check-writing.sh --thread`;
- repository typecheck, lint, tests, build, and process gate;
- merge through a reviewed pull request;
- production HTML, Markdown, metadata, and discovery checks;
- publish from the signed-in `@abhi2601k` Chrome session;
- verify the six-post order and the final article link.
