# Plan 008 — Gated demo portal

## 1. Decision

Copy `apps/learn` to `apps/demo` (fourth app under `apps/`, excluded from root
TS/ESLint/Vitest), strip the course, and add one page and one route: a chat
page at `/` and a streaming proxy at `POST /api/chat`. Rationale and the
alternatives rejected are in ADR-0023.

## 2. Boundaries

### Auth (`lib/auth.ts`, `lib/session.ts`, `worker/index.ts`, `lib/demo-security.ts`)
Unchanged from learn apart from host, cookie name (`__Host-demo-session`) and
the edge CSRF check extended to `/api/chat`. Accounts come only from
`scripts/demo-accounts.mjs`; its wrangler transport takes
`DEMO_WRANGLER_TARGET` (production | preview | local).

### Proxy (`app/api/chat/route.ts`)
Guard order: session → origin → body → D1 budget → upstream. Streams through
without buffering; one generic error and one `[DONE]` at most.

### Upstream client (`lib/vericite.ts`)
Mints a visitor credential, stores it per account in `DEMO_DB`
(`visitor_credential`), refreshes by presenting the previous one. Sends
`X-API-Key`, the credential, the visitor id and `Origin: VERICITE_ORIGIN`.
60 s header timeout, 180 s stream ceiling.

### Filter (`lib/sse-filter.ts`)
Pure. Per-type projection: chunk, sources (id/title/page/excerpt/url +
verdict), revised_answer, answer_gated (presence only), answer_verification
(verdict only), error (generic). Everything else dropped.

### UI (`components/chat/Chat.tsx`, `chat.css`, `app/page.tsx`)
Line-buffered SSE reader; light markdown (paragraphs, lists, bold); `[n]`
links to the cited page; source cards; verdict chips; up to 12 suggestion
chips, with unasked ones kept above the composer after the first question.

### Data (`migrations/`)
`AUTH_DB`: better-auth tables. `DEMO_DB`: `chat_rate`, `visitor_credential`.

### Configuration
Vars: `ENVIRONMENT`, `CANONICAL_HOST`, `VERICITE_API_BASE`, `VERICITE_ORIGIN`,
`VERICITE_MAX_SOURCES`. Secrets: `BA_SECRET`, `VERICITE_API_KEY`,
`VERICITE_CHANNEL_ID`, `DEMO_TITLE`, `DEMO_SUBTITLE`, `DEMO_SUGGESTIONS`.

## 3. Sequence

1. Scaffold + auth (commit 1). 2. Proxy + filter + tests (commit 2).
3. Chat UI (commit 3). 4. Docs (commit 4). 5. Provision D1, preview route,
origin-bound key, secrets-not-vars (commits 5–6). 6. Suggestions and generic
entrance (commit 7). 7. This triad. 8. Preview end to end against the
production upstream. 9. Production deploy and accounts on operator approval.

## 4. Risks and receipts

Receipts per unit: `pnpm typecheck && pnpm lint && pnpm test && pnpm build &&
pnpm build:worker` in `apps/demo`, and the leak grep. Visual receipts:
Playwright screenshots of every state at desktop and iPhone 13 width, against a
local mock upstream (kept outside the repository). Risks as in `spec.md` §7.
