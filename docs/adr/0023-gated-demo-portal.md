# ADR-0023: Serve the private demo from a gated `apps/demo`

Status: Accepted, 2026-09-18.

## Context

There is a demonstration worth showing to named individuals and nobody else:
a chat widget over a hosted answer API (VeriCite), with cited sources and
verification verdicts. It must be readable from anywhere by its invited
audience while it is still private — so it must not be public, must not be
indexed, and must never leak upstream internals (model ids, costs, scores,
confidence internals, error detail) to the browser.

The site already has two private, authenticated subdomains built the same
way: the friends portal (ADR-0021) and the course portal (ADR-0022), each
with a qualified authentication stack.

This repository is public. Real client names, identifiers, and data must
never appear in committed files — tests and fixtures use invented material
only.

## Decision

Keep the demo app in `apps/demo`, on the pattern ADR-0021 established and
ADR-0022 repeated: its own package, lockfile, Next.js configuration,
OpenNext build, Worker, and Cloudflare bindings. Production serves
`demo.akaushik.org`; the disposable preview serves
`preview.demo.akaushik.org`.

**Authentication is lifted from `apps/learn`, not rewritten — the third copy
of the auth stack.** better-auth 1.7.3, scrypt at the OWASP-listed tuple
through the documented password hook, session tokens persisted only as
SHA-256, a literal `__Host-demo-session` cookie, an exact Host allowlist and
CSRF origin enforcement at the Worker edge, and no public signup. ADR-0022
already recorded that a security fix owed to one portal is owed to the
others; that obligation now covers three stacks, expected to stay identical
apart from host and cookie name, and nothing in the build enforces it.

**Accounts are separate from both other portals**, in a separate `AUTH_DB`.
Different audience, different blast radius: a demo viewer must not hold a
credential that also opens the client workspace or the course. The cost is
bootstrapping a person once more if they belong to more than one audience,
which is a CLI invocation (`scripts/demo-accounts.mjs`; public signup stays
disabled).

**The browser never talks to the upstream API.** `POST /api/chat` is a
session-first proxy: same-origin check, then the session (401 before any
upstream contact), then body validation, then a D1 sliding-window budget
(20 messages per rolling 5 minutes per account → 429) — only then is a
visitor credential minted and the upstream SSE stream opened. Every upstream
frame passes through `lib/sse-filter.ts`, which re-emits only allowlisted
types, projects sources to `id`/`title`/`page`/`excerpt`/`url` plus a bare
verification `verdict`, and replaces upstream errors with one generic
message. Any upstream failure becomes exactly one generic error event
followed by `[DONE]`; upstream bytes never reach the browser. The
alternative — calling the answer API from the client — would put the API
key and the orchestration detail in the browser, which would defeat the only
thing this application exists to do.

**Upstream wiring is vars plus secrets, never code.** Branding
(`DEMO_TITLE`, `DEMO_SUBTITLE`), the API base (default
`https://api.vericite.ai`), channel id, and source budget are plain
`wrangler.jsonc` vars; `BA_SECRET`, `VERICITE_API_KEY`, and the optional
`DEMO_SUGGESTIONS` starter chips are `wrangler secret put` secrets.
`VERICITE_CHANNEL_ID` ships blank as a deliberate placeholder: until it names
a real channel every question gets the single generic error, so nothing talks
to the wrong upstream.
`DEMO_SUGGESTIONS` is parsed by `lib/demo-config.ts::parseSuggestions`;
invalid JSON renders no chips and never throws.

**No R2 bucket.** The demo serves no private files, so unlike the course
portal there is nothing to put in object storage and no file-serving route
to guard. `DEMO_DB` holds only the rate-limit window and the credential
cache (`migrations/demo/0001_chat.sql`, `0002_visitor_credential.sql`);
`AUTH_DB` holds the better-auth tables (`migrations/auth/0001_auth.sql`).

**The upstream visitor credential lives in D1, one per account.** The answer
API binds a conversation to the visitor id that opened it. A credential held
only in isolate memory would be re-minted under a new visitor id whenever an
isolate recycled, and every follow-up in an open conversation would then be
refused. Persisting it per account, and presenting the previous credential
on refresh, keeps the visitor id stable for the life of a conversation.

The demo is deliberately not linked from the public site navigation: it is
for one audience at a time, and the link is sent to them directly.

## Consequences

- A third Worker and two more D1 databases to operate; no new R2 bucket.
- The authentication stack now exists in three places. A security fix to one
  is a fix owed to the other two.
- The demo depends on the hosted answer API at request time. If the upstream
  is down or unconfigured, signed-in viewers get the single generic error
  (or a 503/429 with no upstream detail), never a leak and never a stack
  trace.
- The upstream event contract is pinned by `test/*.test.mjs` case (a): new
  upstream event types are dropped until the filter explicitly allows them,
  so an upstream addition fails closed rather than rendering unknown frames.
- All committed fixtures and tests use invented data. Any commit introducing
  real client material violates this ADR, not just a convention.
