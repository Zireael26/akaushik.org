# GPTx blog rewrite

**Date:** 2026-07-27
**Target:** `content/writing/detection-is-not-continuity.mdx`
**Publication:** Replace in place at `/writing/detection-is-not-continuity`

## Editorial decision

Replace the incident-led post with a capability-led account of GPTx in Trellis.
Keep the existing slug so published links continue to resolve. Change the title,
dek, date, and body.

Working title: **One session, two model families: GPTx in Trellis**

The originally proposed word `harness` is replaced with `session` because the
repository writing validator treats it as generic AI-era vocabulary. `Session`
also describes the user-visible boundary more accurately.

## Reader promise

By the end, a Trellis practitioner should understand:

1. why GPTx exists;
2. how selective routing keeps Claude and GPT inside one Claude Code session;
3. which GPT agents Trellis supplies and how effort is chosen;
4. how named teammates, dynamic workflows, structured output, nested advice, and
   cross-model review work;
5. how certification, monitoring, context limits, failure isolation, and escape
   hatches keep the setup operable; and
6. what remains instance-private and unofficial.

## Shape

Open with the verified mixed-agent session: Claude dispatches one GPT worker and
one Claude worker, then resumes the same GPT worker with its context intact.

The middle follows the feature from operator experience down to implementation:

- selective routing rather than a whole-session model switch;
- ordinary GPT subagents with the same tools, permissions, and worktree;
- the medium/xhigh effort ladder, selected by oracle strength;
- cross-model review and the read-only Opus advisor path;
- context compaction, doctor, statusline, dashboard, upgrade tripwire, and direct
  escape;
- explicit failure isolation with no silent quota-pool substitution.

One short section records the post-rollout fixes to streaming accounting and
transport behavior. It should stay below roughly 15 percent of the article.

Close on a testable boundary: GPTx remains private until its unofficial transport
surface becomes stable enough to publish without handing template users a brittle
machine-specific setup.

## Voice and quality gates

Use first person singular, concrete receipts, uneven paragraph rhythm, and plain
technical language. Avoid generic transitions, balanced rhetorical pairs,
repeated triads, tidy summary endings, and claims without a measured receipt.

Required verification:

- manual read against `docs/voice.md`;
- manual read against the writing skill's `references/ai-tells.md`;
- `check-writing.sh --blog`;
- repository typecheck, lint, test, build, and process gate;
- generated-route inspection and a visual browser check;
- live URL and Markdown-alternate verification after merge.
