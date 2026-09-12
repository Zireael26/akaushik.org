# ADR-0022: Serve the harness-engineering course from a gated `apps/learn`

Status: Accepted, 2026-09-12.

## Context

A 24-lesson course on harness and multi-agent engineering exists as a directory
of markdown lessons, JSON assessments, runnable Python labs, interactive HTML
atlases, notebooks, and three generated PDFs. It was readable only from a local
folder. It should be readable from anywhere, and by a named set of friends,
while it is still being revised — so it must not be public, and it must not be
indexed.

The site already has one private, authenticated subdomain: the friends portal
(ADR-0021), with a qualified authentication stack.

## Decision

Keep the course app in `apps/learn`, on the pattern ADR-0021 established: its
own package, lockfile, Next.js configuration, OpenNext build, Worker, and
Cloudflare bindings. Root TypeScript, ESLint and Vitest continue to exclude
`apps/`. Production serves `learn.akaushik.org`.

**Authentication is lifted from `apps/friendsof`, not rewritten.** better-auth
1.7.3, scrypt at the OWASP-listed tuple through the documented password hook,
session tokens persisted only as SHA-256, a literal `__Host-` cookie, an exact
Host allowlist and CSRF origin enforcement at the Worker edge, and no public
signup. Those properties were qualified once. Re-deriving them for a second
private subdomain would be a fresh opportunity to get one of them wrong, and
would leave two stacks to keep correct instead of one.

**Accounts are separate from the friends portal**, in a separate `AUTH_DB`.
Different audience, different blast radius: a course reader must not hold a
credential that also opens the client workspace. The cost is bootstrapping a
person twice if they belong to both, which is a CLI invocation.

**The course directory is the source of truth.** `scripts/build-course.mjs`
compiles `course/` into one JSON bundle of sanitized HTML that the app imports
statically. There is no filesystem at request time on Workers, so the real
alternative to precompiling is shipping a markdown parser to the edge and
re-running it per request. Compiling once also means the sanitizer runs once,
over content that cannot change between build and render.

**Binary and executable course files go to R2, never to `public/`.** Cloudflare
serves matching static assets before the Worker runs, so a PDF in `public/`
would be downloadable by anyone who guessed the path — which would defeat the
only thing this application exists to do. `/api/course-file/[...path]` resolves
the session first, then checks the key against an allowlist generated from the
same bundle, so the served set and the uploaded set cannot drift.

**The two interactive atlases are framed with `allow-scripts allow-same-origin`.**
They are self-contained pages of inline script that drive the URL hash; an opaque
origin makes `history.replaceState` throw and they render blank. What keeps that
safe is the policy the route sends with them — `default-src 'none'` with no
`connect-src`, so the document cannot reach this app's API despite sharing its
origin — plus the sandbox still withholding top-level navigation and forms. This
is first-party content committed to this repository, not anything a reader can
supply.

**Progress is recorded, achievement is not.** A `LEARN_DB` holds which lessons a
reader marked complete and what they wrote when answering. There is no computed
score, grade, or certificate. The course's own position is that a finite set of
self-marked answers is a study aid rather than evidence of mastery, and a schema
that produced a percentage would contradict the material it serves.

`Learn` and `Friends` appear in the public site navigation. Both are gated: an
uninvited visitor reaches a password form, so listing them discloses nothing
that the DNS record does not.

## Consequences

- A second Worker, two more D1 databases, and one more R2 bucket to operate.
- The authentication stack now exists in two places. They are expected to stay
  identical apart from the host and cookie name; a security fix to one is a fix
  owed to the other, and that obligation is recorded here because nothing in the
  build enforces it.
- `course/` must be recompiled and re-synced after any edit. Both steps read the
  same manifest, so a missed sync shows up as a 404 on a download rather than as
  a silently stale page.
- The generated PDFs and the offline HTML reader are snapshots. They lag the
  lessons until `tools/build_books.py` and `tools/build_reader.py` are re-run,
  and the library page says so rather than implying they are current.
- The public site navigation is now eight items. At phone widths it becomes the
  swipeable strip `header.css` was already written for; the e2e contract was
  narrowed from "the nav never scrolls sideways" to "the page never scrolls
  sideways, and any nav overflow is reachable rather than clipped".
