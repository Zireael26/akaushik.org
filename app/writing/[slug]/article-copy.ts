/**
 * Per-post copy for the article template: the "The short answer" ruled box
 * and the "Common questions" FAQ.
 *
 * Every row here is grounded in the authored body under `content/writing/` —
 * each lead/rest pair is a claim the post itself makes, quoted or tightened
 * without adding a fact, and each FAQ answer paraphrases the post's own text.
 * That is the sourcing contract for these boxes: nothing is invented, and a
 * claim the post does not make has no row.
 *
 * If a post ever ships without grounded material, leave its entry out of
 * `ARTICLE_COPY`. The page then renders no short-answer box and no FAQ
 * section, and its JSON-LD stays a plain Article graph — no FAQPage node is
 * fabricated to fill the gap.
 */

export type ShortAnswerRow = { lead: string; rest?: string };
export type FaqRow = { q: string; a: string };

export type ArticleCopy = {
  /** Rows for the ruled box titled exactly "The short answer". */
  shortAnswer: ShortAnswerRow[];
  /** Rows for the "Common questions" block. */
  faq: FaqRow[];
};

export const ARTICLE_COPY: Record<string, ArticleCopy> = {
  'ai-for-msme': {
    shortAnswer: [
      {
        lead: 'The paper stack is a deliberate choice.',
        rest: ' The textile distributor I spent time with last year was running his business the way it works, and every part of that stack is a decision that has already worked well enough to survive.',
      },
      {
        lead: 'Do not replace the existing system.',
        rest: ' It is a working equilibrium built on trust, cash-flow timing, and muscle memory; an AI that demands new behaviour in exchange for its benefits will not get adopted.',
      },
      {
        lead: 'Anything that removes typing, removes memory load, or closes the gap between what happened and what got recorded earns its place.',
        rest: ' Three applications clear that bar today: voice and photo order capture, reconciliation across the ledger and the WhatsApp thread, and summarisation over the operator\u2019s own data.',
      },
    ],
    faq: [
      {
        q: 'Should an MSME replace its paper-and-WhatsApp stack with AI?',
        a: 'No. The stack is a working equilibrium built on trust, cash-flow timing, and muscle memory, and the most common mistake is treating it as a problem to be replaced. An AI that demands new behaviour in exchange for its benefits will not get adopted.',
      },
      {
        q: 'Which AI applications earn their place in a distributor\u2019s workflow?',
        a: 'Anything that removes typing, removes memory load, or closes the gap between what happened and what got recorded: voice and photo order capture, reconciliation across the ledger and the WhatsApp thread, and summarisation over the operator\u2019s own data.',
      },
      {
        q: 'What should AI not automate for an MSME?',
        a: 'Autonomous decisioning on anything contested. When a buyer disputes a quantity or a supplier adjusts an invoice, the resolution is relational, not informational, and the operator has to be in that conversation.',
      },
    ],
  },

  'best-practices-into-trellis': {
    shortAnswer: [
      {
        lead: 'The score is \u201cmost of it.\u201d',
        rest: ' Read the way you read a competitor\u2019s deck, Anthropic\u2019s large-codebase guide found Trellis already covering layered CLAUDE.md, hooks, skills, subagent dispatch, and governance. The places it did not are what shipped as v0.3.0.',
      },
      {
        lead: 'The biggest gap was the token-noise filter.',
        rest: ' The canonical claude-settings.json shipped no permissions block at all, so every project\u2019s agent could read node_modules, .next, dist, vendor, and every lockfile, wasting context on every session.',
      },
      {
        lead: 'One PR, not three.',
        rest: ' The bundle was 852 lines against an 800-line cap, and each split PR would land in a state that fails a different audit until the next one landed on top of it. The PR carries a single-page ADR for the carve-out.',
      },
    ],
    faq: [
      {
        q: 'What did Trellis already have when Anthropic\u2019s guide landed?',
        a: 'Most of the stack: layered CLAUDE.md inherited through symlinks, eight canonical hooks, skills loaded on demand, code-review parity on edit-heavy turns, a registry with version pins, and weekly drift audits. For Trellis the score was \u201cmost of it.\u201d',
      },
      {
        q: 'What was the most important gap?',
        a: 'The token-noise filter. Trellis\u2019s canonical claude-settings.json shipped no permissions.deny block, so agents could read generated files, build artifacts, and lockfiles on every session. The shipped baseline now excludes them, and it was the single cheapest change in the bundle.',
      },
      {
        q: 'Why did the work ship as one PR instead of three?',
        a: 'The PR-size cap is 800 lines and the bundle was 852, but the phases share sentinels and rules: each split PR would land in a state that fails a different audit until the next landed. A single-page ADR records the carve-out.',
      },
    ],
  },

  'building-this-portfolio': {
    shortAnswer: [
      {
        lead: 'A portfolio is supposed to show the work.',
        rest: ' The trouble is that showing the work usually means showing the surface. This one is built differently: same process I\u2019d use on a paid client engagement, left in public view, every decision and trade-off legible to anyone who reads the repo.',
      },
      {
        lead: 'The receipts are all in the repo.',
        rest: ' PRD, ROADMAP, ADRs, the agent-readiness contract, CHANGELOG, and a process-gate pre-commit hook that ran on every one of the 30+ PRs that built the site.',
      },
      {
        lead: 'Launch isn\u2019t done. It\u2019s done enough to ship.',
        rest: ' The honest follow-ups live in docs/ROADMAP.md, and none of them are in the \u201cshouldn\u2019t launch without this\u201d pile.',
      },
    ],
    faq: [
      {
        q: 'Where does the process live?',
        a: 'In the public repo: docs/PRD.md for requirements, docs/ROADMAP.md for delivery, docs/adr/ for decisions, docs/AGENT_READINESS.md for the crawler contract, and scripts/process-gate.mjs as the pre-commit hook that refused a commit without a CHANGELOG entry.',
      },
      {
        q: 'Who is the site written for?',
        a: 'Two readers. The MSME owner wants clarity and honest scope on what worked and what didn\u2019t; the senior engineer wants rigour, and reads the repo for how change is handled. Both can get what they came for without the other\u2019s material getting in the way.',
      },
    ],
  },

  'detection-is-not-continuity': {
    shortAnswer: [
      {
        lead: 'The number was accurate. That was the problem.',
        rest: ' A local router reported 1,416 requests with zero errors while agents behind it were losing responses mid-stream.',
      },
      {
        lead: 'A counter is evidence only about its increment condition.',
        rest: ' The router counted an in-band SSE error frame inside a 200 response as success, and blamed the client for the close. The fix starts with naming the real event.',
      },
      {
        lead: 'Crossing a model or quota boundary is a decision, not a transport detail.',
        rest: ' Silent fallback would spend the first-party subscription without telling the caller, the logs, or the operator \u2014 and the accidental version of it had already produced every first-party rate limit in a session.',
      },
    ],
    faq: [
      {
        q: 'What does \u201cdetection is not continuity\u201d mean?',
        a: 'A system that notices it is broken and then stops has only relocated the failure. Each of the three failures could see enough to claim health or recovery, but none could carry the work through without moving the damage somewhere less visible.',
      },
      {
        q: 'How did the router report zero errors during the outage?',
        a: 'Its errors counter incremented only on an HTTP response at 400 or above, or a socket error. The upstream returned 200, started a valid stream, then sent an in-band SSE error frame; the counter defined that as success and assigned the client the blame for the close.',
      },
      {
        q: 'Why is a silent model-lane fallback a problem?',
        a: 'The two lanes exist partly to separate quota pools. A silent fallback spends the first-party subscription without telling anyone, the request appears recovered, and the first visible symptom arrives later as a rate limit in an unrelated session with no trail back to the outage.',
      },
    ],
  },

  'fastembed-to-tei': {
    shortAnswer: [
      {
        lead: 'Fastembed ONNX on CPU is a reasonable starting point.',
        rest: ' Easy to install, and you can have a working embedding pipeline in an afternoon. It stopped being the right call when retrieval quality became the constraint.',
      },
      {
        lead: 'The model catalog was the ceiling.',
        rest: ' It does not include paraphrase-multilingual-MiniLM-L12-v2 at the throughput needed on an institutional corpus, and no cross-encoder reranker like BAAI/bge-reranker-v2-m3 at all.',
      },
      {
        lead: 'Reranking matters disproportionately on this corpus.',
        rest: ' Where lexical overlap between a query and the relevant passage is low, a bi-encoder\u2019s cosine similarity is a noisy signal. TEI adds a real reranker, at the cost of GPU nodes and k8s manifests.',
      },
    ],
    faq: [
      {
        q: 'Why migrate off Fastembed?',
        a: 'Retrieval quality became the constraint, and the catalog Fastembed can practically serve lacks the multilingual MiniLM model at the needed throughput and any cross-encoder reranker. Reranking matters on a corpus where lexical overlap between query and passage is low.',
      },
      {
        q: 'What did the migration cost?',
        a: 'Real infra complexity: GPU nodes to run, batching configuration to manage, and k8s manifests for a TEI sidecar alongside Qdrant. It does not pay for itself unless retrieval quality is actually on the critical path \u2014 in this case it was.',
      },
      {
        q: 'Was it worth it?',
        a: 'Retrieval quality on the institutional corpus improved measurably after the migration, most visibly on queries whose vocabulary diverged from the relevant document\u2019s. Infra overhead is now a fixed cost, and the model options going forward are wide open.',
      },
    ],
  },

  'gptx-in-trellis': {
    shortAnswer: [
      {
        lead: 'Claude stays the main loop.',
        rest: ' GPTx is GPT agents running inside a Claude Code session for a Trellis-managed project: when a unit suits GPT, Claude starts gpt-mid or gpt-sol through the ordinary agent interface.',
      },
      {
        lead: 'The model is selected per agent.',
        rest: ' Claude model ids pass straight through to Anthropic; a closed list of GPT and Codex ids goes to a local Codex proxy; unknown model names stay on the Claude lane.',
      },
      {
        lead: 'The boundary is still private.',
        rest: ' GPTx is instance-private today: its router, agent definitions, doctor, and provider binding do not sync to the public Trellis template. The template carries the generic model-lane contract, not the transport.',
      },
    ],
    faq: [
      {
        q: 'What exactly is GPTx?',
        a: 'GPT agents running inside a Claude Code session for a Trellis-managed project. Claude Code does the coordination; GPTx only decides where a particular agent request goes.',
      },
      {
        q: 'Which GPT models does it run?',
        a: 'Both GPT agents currently run GPT-5.6 Sol, at two effort levels: gpt-mid at medium effort for bounded implementation with a strong oracle, and gpt-sol at xhigh effort for units where several plausible answers survive or a wrong decision is expensive to unwind.',
      },
      {
        q: 'Is GPTx public?',
        a: 'No. The router, agent definitions, doctor, and provider binding are instance-private. The public Trellis template carries the generic model-lane contract: explicit routing, a fail-closed capability probe, visible degradation, and no silent substitution.',
      },
    ],
  },

  'micrograd-makemore': {
    shortAnswer: [
      {
        lead: 'The rebuild was slower, more frustrating, and the only pass that counted.',
      },
      {
        lead: 'Until you\u2019ve traced a gradient through manual backprop yourself, \u201cPyTorch handles broadcasting\u201d stays an abstraction.',
        rest: ' You only own that fact after you\u2019ve been the one handling it.',
      },
      {
        lead: 'The sequencing is the pedagogy.',
        rest: ' Makemore adds one new idea per step \u2014 bigram counts, MLP, BatchNorm, dilated convolutions, a character-level transformer \u2014 and the point is to hold the previous idea in your head while you add the next.',
      },
    ],
    faq: [
      {
        q: 'Why rebuild micrograd and makemore instead of just watching the course?',
        a: 'Watching and rebuilding feel identical in the moment and are not. The rebuild was slower, more frustrating, and the only pass that counted: until you have traced a gradient through manual backprop yourself, the abstractions stay abstractions.',
      },
      {
        q: 'What are micrograd and makemore?',
        a: 'Micrograd is a reverse-mode autodiff engine over scalars, a few hundred lines. Makemore extends the lesson from bigram counts through MLP, BatchNorm, WaveNet-style dilated convolutions, and a character-level transformer, one new idea per step.',
      },
    ],
  },

  'native-git-hooks-for-non-node': {
    shortAnswer: [
      {
        lead: 'Husky wants a package.json.',
        rest: ' With no meaningful root manifest to mount it on, the stack is the wrong answer: a stub manifest buys a dev-dependency lockfile, a node_modules to gitignore, and a Node toolchain you do not otherwise need.',
      },
      {
        lead: 'Git supports this directly.',
        rest: ' Set core.hooksPath to a tracked directory, commit shell scripts into it, and the same enforcement lives in plain sh, visible in repo state, surviving any clone.',
      },
      {
        lead: 'Deferring pre-commit is not skipping discipline.',
        rest: ' Pre-push is the non-negotiable, load-bearing hook; local pre-commit is fast feedback, not enforcement, and n=1 validators wait on the Rule of Three.',
      },
    ],
    faq: [
      {
        q: 'When is husky the wrong tool?',
        a: 'When there is no meaningful root package.json to mount it on. Inventing a stub manifest buys a dev-dependency lockfile to babysit, a node_modules to gitignore, and a Node toolchain you do not otherwise need.',
      },
      {
        q: 'How do you enforce git-boundary hooks without Node?',
        a: 'git config core.hooksPath .githooks, with executable shell scripts named for the hook events committed into the tracked directory. Because they are tracked, enforcement is visible in repo state and survives any clone.',
      },
      {
        q: 'What do you give up?',
        a: 'Two real costs: lint-staged\u2019s \u201conly the files I just touched\u201d filter, which becomes a few lines of shell you write yourself, and the prepare-script auto-install, which becomes one documented core.hooksPath line in the README on a fresh clone.',
      },
    ],
  },

  'process-gate-stack-profiles': {
    shortAnswer: [
      {
        lead: 'The stack profile is the pressure valve.',
        rest: ' The sixth process-gate is the only gate without a fixed implementation: the canonical layer says \u201crun the validators the project declares,\u201d and the project declares them in local.config.sh.',
      },
      {
        lead: 'Both profiles sit at n=1 today.',
        rest: ' Lume is the sole witness of unity; ClusterBid is the sole witness of monorepo-polyglot. Neither promotes validators into the canonical layer until a third project of the same shape shows up.',
      },
      {
        lead: 'The gap between n=2 and n=3 is where the rule earns its keep.',
        rest: ' With two projects, the pattern is statistically indistinguishable from coincidence; with three independent witnesses, whatever is still common is structural, not incidental.',
      },
    ],
    faq: [
      {
        q: 'What is a stack profile?',
        a: 'The sixth gate in the process-gate skill, and the only one without a fixed implementation. The canonical layer says \u201crun the validators the project declares\u201d; the project declares them in local.config.sh \u2014 Unity meta-file checks, a Go workspace vet loop, a design-token validator.',
      },
      {
        q: 'Why do the Unity and polyglot profiles ship without canonical validators?',
        a: 'Rule of Three. Each profile has one witness today, and n=1 is the danger zone; promotion happens at n=3. The validators live inside the projects, with the shape documented in the reference docs so the second adopter does not have to re-derive it.',
      },
    ],
  },

  'renaming-projects': {
    shortAnswer: [
      {
        lead: 'Do the renames in the same order every time, starting with the registry.',
        rest: ' The registry is the single source of truth for what active projects exist, and the scheduled audit iterates over it: the moment the path changed, drift surfaced itself within twenty-four hours.',
      },
      {
        lead: 'The on-disk directory rename was where the day got expensive.',
        rest: ' Every absolute path written into a CLAUDE.md, IDE workspace file, shell alias, or muscle-memory cd broke at once, and the failures surfaced one at a time over the following week.',
      },
      {
        lead: 'A registry that something automated reads is worth more than a registry that only humans read.',
        rest: ' The day you rename half your projects is the day it pays for itself.',
      },
    ],
    faq: [
      {
        q: 'What broke during the mass rename?',
        a: 'Hook configs with hardcoded absolute paths, which failed silently; scheduled-task definitions pinned to the old directory; and primer prose referencing files by old paths. GitHub repo renames were the friendly part: redirects and .git/config auto-rewrites handled them.',
      },
      {
        q: 'What is the lesson for the next rename?',
        a: 'Treat renames as a search-and-replace problem from the first minute: grep the control plane, every registered project, every scheduled-task definition, and every .claude and .codex tree, and treat the hit list as the migration plan.',
      },
    ],
  },

  trellis: {
    shortAnswer: [
      {
        lead: 'Trellis is a parent/child engineering-process regime for Claude Code and Codex.',
        rest: ' One source of truth for cross-cutting rules, nine canonical hooks that make those rules mechanically enforceable, and a fleet of scheduled audits across six projects.',
      },
      {
        lead: 'Process is code.',
        rest: ' Every rule that can be mechanically enforced becomes a hook, and hooks fail closed: rules that depend on good intentions erode in under a month, while rules backed by a hook persist until the hook is deleted.',
      },
      {
        lead: 'Receipts beat eloquence.',
        rest: ' \u201cDone\u201d means the agent attaches the verification command, the exit code, and the diff lines that prove the change.',
      },
    ],
    faq: [
      {
        q: 'What is Trellis?',
        a: 'An engineering process for AI coding agents: one control-plane repo, parent rules inherited by registered projects through symlinks, nine canonical hooks, and ten scheduled audits that run on cron. Some audits run weekly, some daily, and some monthly.',
      },
      {
        q: 'What are the three hook tiers?',
        a: 'Fast-local, which runs every agent turn on a sub-second budget and blocks destructive commands; heavy-gated, which runs on Stop and adjudicates \u201cdone\u201d; and git-boundary \u2014 pre-commit, commit-msg, and pre-push \u2014 as the durable backstop.',
      },
      {
        q: 'Is Trellis free to use?',
        a: 'Yes. It is MIT-licensed and forkable at github.com/Zireael26/trellis, with AGENT_SETUP.md to customise it for your machine in about ten minutes and AGENT_ONBOARD_PROJECT.md to onboard each project after that.',
      },
    ],
  },

  'trellis-1-0-rc': {
    shortAnswer: [
      {
        lead: 'The last gap was not a missing rule.',
        rest: ' It was no guarantee the rules ran the same way in Claude Code and Codex, at every layer, on every project. Thirteen phases closed the distance between a rule that exists and a rule that fires.',
      },
      {
        lead: 'The matrix is complete.',
        rest: ' Every cell is enforced, in both clients, at the right layer \u2014 skills, hooks, and gates across Claude Code and Codex \u2014 and the doctor reports green across all seven projects.',
      },
      {
        lead: 'A test that passes is not the same as a thing that works.',
        rest: ' The rollout tool\u2019s tests were green while the tool had a logic error that only surfaced on a real merge; the fix was rewriting the tests to check what the tool actually did.',
      },
    ],
    faq: [
      {
        q: 'What does the 1.0-rc release add?',
        a: 'A systematic pass over the six-cell enforcement matrix \u2014 skills, hooks, and gates in both Claude Code and Codex \u2014 thirteen phases long, closing the distance between a rule that exists and a rule that fires, in every cell.',
      },
      {
        q: 'Why is it a release candidate and not 1.0?',
        a: 'A release candidate buys soak time. Enforcement code looks correct until the day it blocks something it should have allowed on a project shape not tested against; 1.0 is what gets tagged when weeks of real use across all seven projects produce no enforcement surprise the matrix did not predict.',
      },
      {
        q: 'What was the hardest part?',
        a: 'The rollout, not the build. Five of seven projects were not on a clean main: four were on feature branches, one had a dirty main, and three carried uncommitted changes. Settings reconciliation had to merge rather than copy, preserving project additions; neev\u2019s hand-tuned module-boundary hook was the case where a wrong merge would have cost real work.',
      },
    ],
  },

  'trellis-loop-era': {
    shortAnswer: [
      {
        lead: 'A loop that cannot stop is not automation, it is a liability with a token bill.',
        rest: ' The brakes came first: every Trellis loop declares three ceilings \u2014 a maximum iteration count, a no-progress count, and a dollar budget \u2014 and halts on whichever trips first.',
      },
      {
        lead: 'Selection says which loop. Safety says how it stops.',
        rest: ' rc.6 shipped a four-type loop taxonomy pointing at Trellis primitives, deferring to the existing halting contract rather than restating it; the two documents are deliberately not merged.',
      },
      {
        lead: 'Not every task needs a loop.',
        rest: ' The orchestration-heavy default is a bias, and the counterweight has to be written down or it loses.',
      },
    ],
    faq: [
      {
        q: 'What stops a Trellis loop?',
        a: 'Three ceilings declared up front \u2014 maximum iterations, no-progress count, and a dollar budget converted at the billing engine\u2019s rate \u2014 and the loop hard-stops on whichever trips first, emitting a structured halt report. It never auto-continues past its own ceiling.',
      },
      {
        q: 'Why is the pre-push gate deterministic?',
        a: 'Because the verdict has to have exactly one answer regardless of which agent is driving: a gate that depends on which model reads the rule is not a gate, it is a suggestion with extra steps. The gate is a pure function of git state, byte-identical between Claude Code and Codex.',
      },
      {
        q: 'What did the delegation doctrine decide?',
        a: 'Delegation, not allegiance: bounded work orders route to a cheap executor from any turn, design and review stay home, there is a floor of around twenty changed lines below which delegation loses, and every delegation is a proposal the author approves until a week of ledger rows says otherwise.',
      },
    ],
  },
};
