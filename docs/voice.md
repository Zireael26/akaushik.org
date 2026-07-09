# Voice — akaushik.org writing

Voice file per the Trellis writing-skill convention (spec 010,
`core-rules/skills/writing/references/voice.md`). Seeded 2026-07-09 from the
three published Trellis posts: `content/writing/trellis.mdx` (2026-05-11),
`content/writing/trellis-1-0-rc.mdx` (2026-06-03), and
`content/writing/trellis-loop-era.mdx` (2026-07-08). This file is the
author's property — propose edits, never rewrite it as a side effect of a
writing run.

## 1. Identity + audience

Abhishek Kaushik, writing in first person on his personal site. The speaker
is a solo operator who runs a fleet of personal projects on AI coding agents
(Claude Code and Codex) and builds the process infrastructure around them in
the open. Not a vendor, not a team blog: one person's machine, one person's
receipts.

Audience: practitioners who run coding agents at some scale and follow the
agents/loops discourse. Assume they know git, hooks, CI, and the current
model landscape — never gloss the basics. Address the reader directly only
occasionally ("If you fork it, tell me what you changed"); the default mode
is reporting what happened here, not advising.

## 2. Register

- First person singular throughout. Never an editorial "we".
- Mid-formal, conversational-precise. Complete-thought prose; no slang, no
  academic hedging.
- Confidence is earned per sentence: strong claims arrive with a number, a
  file path, or a link attached; unproven things are named as unproven ("a
  routing predicate I have not watched work for a week is a guess, not a
  policy").
- Humor is dry and load-bearing, delivered as understatement or reframe ("a
  liability with a token bill", "a suggestion with extra steps"). Never
  jokey. No exclamation marks.
- Self-criticism is plain and unhedged: mistakes stated as fact, with root
  cause and the class-level fix, not softened ("I taught the wrong resume
  command in my own plan").

## 3. Sentence rhythm

- High variance is the signature: one or two long walk-through sentences,
  then a short verdict sentence. "None of this is clever." "The loop is the
  thing." "Ledger row one."
- Deliberate fragments as punches — roughly one per section, no more. "Not
  new features." "Six cells."
- Paragraphs run 2–5 sentences, one idea each. Sections run 3–6 paragraphs,
  separated by `---` rules.
- Sentence-initial "But", "So", and "And" are normal pivots.
- Enumeration folds into prose, or uses a bolded lead-in phrase followed by
  prose ("**Process is code.** Every rule that can be mechanically
  enforced…") — not nested bullet trees.

## 4. Vocabulary

**Yes — words and phrases the author actually uses:** load-bearing;
receipts; a rule "bites" or "fires"; drift; harness; control plane; fleet;
doctrine; ceilings, halts, trips (loop-safety verbs); canonical;
wiring / wired; surgical; "the honest answer/state/version"; "earns its
keep"; "worth saying out loud"; "the X is the point" / "the X is the
thing"; grounding claims "against the data"; "in the open". Concrete
numbers and dates live in prose ("nine hooks", "eighty lines, one round",
"96 percent at 46 percent" — "percent" spelled out in running text).

**No — author-specific never-list** (complements the universal slop list in
`references/ai-tells.md`; does not restate it):

- The four patterns stripped in the 2026-05-11 voice pass across all posts:
  reflexive rhetorical-pair sentences, em-dash flourishes, principle-naming
  triplets, and summary-moral closers.
- Em-dashes are rationed to genuine appositives and grow rarer with each
  post; prefer commas, periods, and colons.
- No exclamation marks, no emoji, no hype adjectives ("seamless",
  "powerful", "game-changing"), no "excited to", no "In this post I'll…"
  throat-clearing, no rhetorical-question openers.
- The "not X, it is Y" inversion is in-voice but rationed: only when the
  reframe carries real stakes, never as scaffolding.

## 5. Structural habits

- **Receipts over claims.** Every claim of success carries its proof — the
  command, the exit code, the measured number, the link — or an explicit
  admission that proof is pending ("I will know in a few weeks of audits
  whether I got the rest right").
- **"What I got wrong" section.** Recurring near the end of each post,
  usually three items, each a plain confession with root cause and the
  class-level fix. Framed as "receipts over self-congratulation".
- **Dated captures.** Time is always anchored: posts dated, events dated
  inline ("In early June", "five weeks ago", "tagged `1.0.0-rc`"), and
  claims about the model landscape explicitly dated and sourced so they can
  go stale honestly.
- Frontmatter dek repeated as a blockquote directly under the H1.
- H2 headings in sentence case, phrased as plainspoken claims or "The X:
  claim" ("The gate: loops are only as trustworthy as the process under
  them").
- Openers are a concrete scene or felt problem, never a thesis statement.
- Closers are a forward-looking, testable commitment or an invitation —
  never a summary of what was said.
- Prior posts cross-linked on first mention; sources named and credited
  (Steinberger, Cherny, Anthropic), including honestly when the source beat
  him to something.

## 6. Exemplars (verbatim)

From `content/writing/trellis.mdx` (2026-05-11):

> Receipts beat eloquence. I trust the diff and the exit code. I no longer
> trust a trailing summary that says "I've fixed the bug and all tests
> pass."

From `content/writing/trellis-1-0-rc.mdx` (2026-06-03):

> A test that passes is not the same as a thing that works. I shipped a
> rollout tool whose tests were green while the tool itself had a logic
> error that only surfaced on a real merge. The tests were asserting
> against the shape I assumed the behavior would have, not the behavior.

From `content/writing/trellis-loop-era.mdx` (2026-07-08):

> The thing nobody puts in the loop threads: a loop that cannot stop is not
> automation, it is a liability with a token bill. My first loops-adjacent
> work was not about making loops smarter. It was a halting contract.
