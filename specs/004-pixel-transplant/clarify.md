# Clarify 004 — Pixel transplant

**Spec:** `spec.md` · **Branch:** `feat/pixel-transplant` · **Autonomy:** L3

> Recorded after the fact, alongside the rest of the triad, per the
> mandatory-pipeline gate's remediation path. The interview is not invented: it
> happened in conversation across the session that built this branch, and the
> answers below are the operator's own, condensed. Anything he has not answered
> is marked **OPEN** and is not treated as settled.

---

## 1. Intent — what is actually being built, and why

**Q. Why replace a design that works?**

> "I spent a lot of time making this website for my friend Gauri for her
> birthday. I showed the website to her. She loved it, but she let me know that,
> due to her profession, she cannot have a website like that. I love that design.
> I worked really hard on it, and I believe there are no restrictions for me to
> actually have that redesign for my own personal website."

So the driver is not that the current design is failing. It is that a better
design already exists, was built by him, and has become available because its
intended subject cannot publish it. Bar Council of India advertising rules
constrain what an advocate may put on a website; none of that binds him.

**Q. Is this a re-skin or a transplant?**

A transplant. Confirmed explicitly:

> "those arts would have to be redone to actually be relevant to my career and my
> website."

Every law-specific piece — scales, gavel, section sign, the Delhi legal skyline,
"see you in court" — is re-authored, not recoloured.

**Q. What else is in scope beyond the design?**

Hosting moves from Vercel to Cloudflare, so the site sits with
`evals.akaushik.org` on the same account. (He referred to it as
"evals.caution.org"; the actual Worker route is `evals.akaushik.org`, verified
against `herdr`/wrangler config. Same intent.)

**Q. Later scope, added mid-build:**

> "port over custom cursors done tastefully"; "get rid of the whole triple-click
> exemption"; the process artwork should be "a proper process… each of the
> sections actually shows something useful regarding that step… with some form of
> a pipeline"; "make this whole pixel thing into a whole reusable component of
> various sizes for various use cases, which would also allow stages"; "allowing
> the conversion of regular images into this pixel art that is alive".

That last group is why the hero engine was generalised rather than copied.

## 2. Users affected

Three audiences, in priority order, and they are not the same:

1. **People considering hiring him.** The site is a sales surface. They read the
   work, the services, and the writing.
2. **Agents and crawlers.** The site's thesis is that its author builds agent
   systems, so `docs/AGENT_READINESS.md` treats a failed agent-readiness check
   as a ship-blocker. This audience is the reason the retrofit path was chosen
   over an Astro rewrite.
3. **Him.** It is a personal site and the craft is the point.

Nobody's existing bookmarks may break: every URL keeps its path.

## 3. Success metric

Ten criteria are enumerated in `spec.md` §Success criteria. The ones that decide
whether this was worth doing:

- **SC2** — no law-specific art or copy survives. A site that reads as someone
  else's with his name on it is a failure regardless of how good it looks.
- **SC3** — the agent surface behaves identically. This is the one that would
  make the whole exercise net-negative if broken.
- **SC10** — deployed on Cloudflare with the domain cut over.

Explicitly *not* a metric: bundle size as an end in itself, or Lighthouse as a
score to farm. `three` leaving is a consequence of replacing the hero, not a goal.

## 4. Edge cases and constraints

- **No invented facts.** The site is a real professional record. No employer,
  date, title, or metric may appear unless already sourced in the repo. This bit
  during the build: the Experience section is thin because the repo does not
  carry a full CV and the delegated agent correctly refused to pad it. **OPEN**,
  tracked as T27.
- **Fonts must be licence-clean.** He asked for Instagram Sans; it is a
  proprietary Meta asset commissioned from Colophon Foundry and is not licensed
  for third-party use, so it was refused. He then asked for a legal lookalike —
  **OPEN**, tracked as OQ1.
- **Mono is JetBrains Mono Nerd Font**, by explicit instruction, "if there is any
  use case for any mono-space font".
- **Reduced motion and keyboard users.** Every canvas is decorative; the cursor
  engine must never eat a click or suppress a focus ring.
- **The art must be deterministic.** All randomness through `h(x, y)`; the field
  must draw identically on every load.
- **The sealed wing is not transplanted.** It is Gauri's gift.

## 5. Rollback plan

- The design lives on a branch. `origin/main` is untouched and still deployable.
- The old design is recoverable from history; the last commit carrying it is the
  tip of `origin/main` at the time this branch opened.
- The hosting cutover is DNS-level and reversible in minutes. The Vercel project
  is **paused, not deleted**, for 14 days after cutover (T34).
- Engine work was done in worktrees on their own branches
  (`feat/pixel-engines`, `feat/pixel-cursor`), so a bad port is droppable
  without touching the design work.

---

## Still open

| # | Question | Status |
|---|---|---|
| OQ1 | Display face — keep Cabinet Grotesk, or an Instagram-Sans-adjacent legal alternative? A rendered comparison was offered. | Awaiting operator |
| OQ3 | Do the hyperframes case-study video loops survive alongside the pixel language? | Awaiting operator |
| T27 | Experience section needs real CV detail — employers, date ranges, titles. | Awaiting operator |
| T08 | Cloudflare CI token must be minted in the dashboard by hand. | Awaiting operator |

**OQ2 is closed.** The secret entrance was removed outright on his instruction
("get rid of the whole triple-click exemption"), rather than being rewired to a
destination.
