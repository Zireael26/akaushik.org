# ADR-0021: Isolate the authenticated Friends portal

Status: Accepted for the deployed application, 2026-09-09.

## Context

The portfolio needs a private workspace for shared meeting records, research,
questions, and original media. These records must not enter the public MDX
pipeline, public build assets, portfolio search, or public Worker bindings.

## Decision

Keep the portal in `apps/friendsof`, with its own package, lockfile, Next.js
configuration, OpenNext build, Worker, authentication D1, content D1, and private
R2 bucket. Root TypeScript, ESLint, and Vitest exclude this application because
it has independent checks and a different dependency baseline. The public
portfolio continues to use its existing build and deployment paths.

The portal uses explicit production Wrangler configuration and an exact host
allowlist. Private responses use `private, no-store`, no indexing, no referrer,
and a nonce CSP. Only generated static assets and fonts use public caching.
Authentication uses Better Auth with the qualified platform scrypt hook,
database sessions stored as token hashes, a host-only secure cookie, bounded
request bodies, and database-backed sign-in admission. Account creation and
recovery are owner-operated CLI actions; public signup and reset endpoints are
disabled.

Content lives in immutable D1 revisions with explicit revision and asset sharing.
The importer verifies source hashes and commits database state atomically after
media verification. Original recording bytes remain distinct from playback
derivatives. Private source files and operator credentials remain outside this
checkout. Any future public publication requires a separately approved frozen
export; public pages cannot query portal stores.

Question-register rendering changes presentation only: it preserves source
questions and supporting fields while adding topic navigation and filtering.
It does not infer or record a client decision.

## Consequences and evidence

The portal requires its own build, test, deployment, backup, and recovery work.
The deployed runtime, authentication, authorization, Markdown, media, and restore
receipts are tracked separately from the public portfolio checks. An encrypted
populated backup was restored to scratch databases, its search index rebuilt,
and all media bytes verified. This evidence covers the recorded checks; it does
not imply every acceptance criterion in the larger proposal has passed.

See `apps/friendsof/README.md` for commands and `HANDOFF.md` for current local
release state. Client-specific source material is not part of this ADR.
