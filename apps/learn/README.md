# Learn portal

The harness-engineering course, behind a password, at `https://learn.akaushik.org`.
Architecture: ADR-0022 in the root `docs/adr` directory.

The course itself lives in `course/`. It is the source of truth: lessons as
markdown, assessments as JSON, labs as runnable Python. Nothing in `app/` edits
it, and nothing generated from it is authored by hand.

Run commands from this directory:

```sh
pnpm course        # compile course/ -> lib/generated/course.json
pnpm dev           # localhost:3300, with local D1 and R2 via miniflare
pnpm typecheck
pnpm lint
pnpm build
pnpm build:worker
pnpm deploy:production
```

## How the course reaches the page

`scripts/build-course.mjs` reads `course/`, renders every lesson and document to
sanitized HTML, and writes one JSON bundle that `lib/course.ts` imports. It runs
automatically before `dev`, `build` and `typecheck`.

Precompiling is not an optimization. The app runs on Workers through OpenNext,
where there is no filesystem at request time — so the alternative is not "read
the markdown lazily", it is "ship a markdown parser to the edge and re-run it on
every request". Doing it once at build time also means the sanitizer runs once,
over content that cannot change between build and render.

Binary and executable course files (PDFs, notebooks, labs, atlases, templates)
are **not** in the bundle and **not** in `public/`. Cloudflare serves static
assets before the Worker runs, so anything in `public/` would be downloadable by
anyone who guessed the path. They live in R2 and are served by
`/api/course-file/[...path]`, which resolves the reader's session first and then
checks the requested key against the allowlist compiled from the same bundle.

## Access

There is no signup. `disableSignUp` is set in `lib/auth.ts`, and accounts exist
only because `scripts/reader-accounts.mjs` created them:

```sh
READER_CREDENTIAL_FILE=/path/to/readers.json \
CF_API_TOKEN=... CF_ACCOUNT_ID=... AUTH_D1_ID=... \
  node scripts/reader-accounts.mjs create
```

The credential file must be mode 0600 and holds one reader object or an array of
them (`email`, `username`, `password`, optional `name`). `reset-password` rotates
the password and revokes that reader's sessions in one atomic batch.
`remove` additionally needs `PROGRESS_D1_ID` so it can clear their progress rows.
`list` needs no credential file.

Auth is lifted from `apps/friendsof` — better-auth 1.7.3, scrypt at the OWASP
tuple, session tokens persisted only as SHA-256, a `__Host-` cookie, and Worker
level host and CSRF-origin enforcement. It was lifted rather than rewritten
because those properties were qualified once and re-deriving them for a second
private subdomain is only a chance to get one of them wrong. The cookie name and
canonical host differ; nothing else does.

**Accounts are separate from the friends portal.** Different audience, different
blast radius. A reader here cannot reach `friendsof.akaushik.org` with these
credentials, and the two `AUTH_DB` bindings are different databases.

## First deployment

```sh
node scripts/provision.mjs --env production      # creates D1 + R2, writes ids
pnpm exec wrangler d1 execute learn-prod-auth --env production --remote \
  --file migrations/auth/0001_auth.sql
pnpm exec wrangler d1 execute learn-prod-progress --env production --remote \
  --file migrations/learn/0001_progress.sql
pnpm exec wrangler secret put BA_SECRET --env production
pnpm course && pnpm assets:sync -- --env production
pnpm build:worker && pnpm deploy:production
```

`wrangler.jsonc` ships with `PROVISION_ME_*` placeholders for the database ids,
so a deploy against an unprovisioned config fails loudly rather than quietly
binding the wrong store. Production must use the explicit `production`
environment; the default configuration is the disposable preview one.

Re-run `pnpm course && pnpm assets:sync -- --env production` whenever `course/`
changes. The bundle and the R2 keys are generated from the same list, so a file
that is not in one is not in the other.

## What is deliberately not here

- No progress score, grade, or certificate. The course's own position is that a
  finite set of self-marked answers is a study aid, not evidence of mastery, and
  the schema in `migrations/learn/0001_progress.sql` does not imply otherwise.
- No public index. Every page is `noindex, nofollow, noarchive` and the Worker
  sets the matching header, because the course is unfinished by intent.
