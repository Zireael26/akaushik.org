# Demo portal

A private demonstration at `https://demo.akaushik.org`, behind a password.
Scaffolded from `apps/learn`; see `docs/adr/0023-gated-demo-portal.md`.

Run commands from this directory:

```sh
pnpm dev           # localhost:3301, with local D1 via miniflare
pnpm typecheck
pnpm lint
pnpm build
pnpm build:worker
pnpm deploy:production
```

Local dev reads `.dev.vars` (gitignored). It needs at least
`CANONICAL_HOST=localhost:3301` (so sign-in trusts the loopback origin),
`BA_SECRET`, and the `VERICITE_*` values, which may point at a local mock.
Apply the migrations with `--local`, then create an account against the local
database with `DEMO_WRANGLER_TARGET=local DEMO_AUTH_DB=demo-preview-auth`.

## Auth

better-auth 1.7.3, lifted from `apps/learn`: username/password, public signup
disabled, scrypt via the qualified password hook, session tokens stored only as
SHA-256, literal `__Host-demo-session` cookie, exact Host allowlist plus CSRF
origin enforcement at the Worker edge. Accounts are created only by
`scripts/demo-accounts.mjs`. A security fix owed to one portal is owed to all three.

## Bindings

- `AUTH_DB` — better-auth tables (see `migrations/auth/0001_auth.sql`).
- `DEMO_DB` — chat rate-limit window and the per-account upstream visitor credential
  (`migrations/demo/`).
- No R2 bucket: the demo serves no private files.

Secrets (via `wrangler secret put`, never committed): `BA_SECRET` and
`VERICITE_API_KEY` (required), `DEMO_SUGGESTIONS` (optional).

## Chat

Signed-in chat at `/` proxies the VeriCite answer stream through
`POST /api/chat`: same-origin gate, session check (401 before any upstream
contact), body validation, D1 sliding-window budget (20 messages per rolling
5 minutes per account → 429), then the upstream SSE stream. Every upstream
frame passes through `lib/sse-filter.ts`, which re-emits only allowlisted
types (`chunk`, `sources`, `revised_answer`, `answer_gated`,
`answer_verification`, `error`) with per-type field projections, projects
sources to `id`/`title`/`page`/`excerpt`/`url` plus a bare verification
`verdict`, and replaces upstream errors with one generic message. Any
upstream failure becomes exactly one generic error event followed by
`[DONE]`; upstream bytes never reach the browser. Starter chips come from
the optional `DEMO_SUGGESTIONS` secret (a JSON array of strings, parsed by
`lib/demo-config.ts::parseSuggestions`); invalid JSON renders no chips and
never throws.

## Tests

```sh
pnpm test            # node --test test/*.test.mjs (no Workers runtime needed)
```

Five cases: (a) SSE filter allowlist/projection, (b) anonymous `POST`
→ 401 with upstream untouched, (c) exact Host allowlist, (d)
`DEMO_SUGGESTIONS` parsing + env getters, (e) upstream failure → one
generic error + `[DONE]`. Route tests run under plain node via
`test/support/` resolution hooks that map `@/*` to the package root and stub
the `server-only` / `next/*` build-time imports; `currentAccount()` resolves
null outside Cloudflare, so the anonymous paths execute for real.

## First deployment

Preview (`demo-preview-worker`, `preview.demo.akaushik.org`) uses the
top-level config; production adds `--env production`. Deploy with
`env -u CLOUDFLARE_API_TOKEN` (see the repo's `gotchas.md`).

```sh
node scripts/provision.mjs --env production      # creates D1s, writes ids
pnpm exec wrangler d1 execute demo-prod-auth --env production --remote \
  --file migrations/auth/0001_auth.sql
pnpm exec wrangler d1 execute demo-prod-chat --env production --remote \
  --file migrations/demo/0001_chat.sql
pnpm exec wrangler d1 execute demo-prod-chat --env production --remote \
  --file migrations/demo/0002_visitor_credential.sql

# Secrets. Pipe or paste them; never write them to a file.
openssl rand -hex 32 | tr -d '\n' | pnpm exec wrangler secret put BA_SECRET --env production
pnpm exec wrangler secret put VERICITE_API_KEY --env production      # operator pastes the key
pnpm exec wrangler secret put VERICITE_CHANNEL_ID --env production
pnpm exec wrangler secret put DEMO_TITLE --env production            # optional
pnpm exec wrangler secret put DEMO_SUBTITLE --env production         # optional
pnpm exec wrangler secret put DEMO_SUGGESTIONS --env production      # optional, JSON array

READER_CREDENTIAL_FILE=~/.demo-credentials.json DEMO_AUTH_DB=demo-prod-auth \
  node scripts/demo-accounts.mjs create   # one entry per viewer
pnpm build:worker && pnpm deploy:production
```

`VERICITE_API_KEY` is expected to be a publishable (`pk_`) key scoped to
querying, whose origin allowlist contains exactly `VERICITE_ORIGIN`
(`https://demo.akaushik.org`). The server sends that Origin on every upstream
call, so the preview uses the same value; a leaked key cannot touch documents
or configuration.

Anything that names the client or the upstream channel is a secret, not a
var, because this repository is public: `VERICITE_CHANNEL_ID`, `DEMO_TITLE`,
`DEMO_SUBTITLE` and `DEMO_SUGGESTIONS` never appear in committed files. Until
`VERICITE_API_KEY` and `VERICITE_CHANNEL_ID` are set, every question gets the
single generic error, so nothing talks to the wrong upstream.

Plain vars in `wrangler.jsonc`: `ENVIRONMENT`, `CANONICAL_HOST`,
`VERICITE_API_BASE`, `VERICITE_ORIGIN`, `VERICITE_MAX_SOURCES`. See
`worker/demo-env.d.ts` for the binding contract.
