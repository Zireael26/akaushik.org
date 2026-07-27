# GPTx blog rewrite

**Date:** 2026-07-27
**Targets:** `content/writing/detection-is-not-continuity.mdx` and
`content/writing/gptx-in-trellis.mdx`
**Publication:** Keep the original post direct-link-only and publish GPTx at
`/writing/gptx-in-trellis`

## Editorial decision

Restore the incident-led post at its original slug and mark it unlisted, so the
existing URL continues to resolve without appearing in collection-backed
discovery surfaces or search indexes. Publish the capability-led GPTx account as
a separate editorial unit at the durable `gptx-in-trellis` slug.

Title: **GPTx in Trellis: one session, two model families**

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

## Discovery contract

`unlisted: true` is a writing-frontmatter contract, not a component exception.
Default collection loaders exclude unlisted posts, which removes the old article
from the writing index, home page, sitemap, JSON API, and agent corpus. Exact-slug
loads remain valid so its HTML, Markdown alternate, and Open Graph image continue
to work.

The HTML metadata and Markdown response both emit `noindex, nofollow`. Detail-route
static parameters explicitly include unlisted posts so direct links are production
artifacts rather than runtime accidents.

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
