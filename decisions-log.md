# Decisions log

Decisions taken on the operator's behalf while running unattended at autonomy
L4. Newest first. Each entry says what was decided, what the alternatives were,
and what would have to be true to revisit it.

## 2026-08-23 — overnight preview-deploy run

### D1 · Preview host is `beta.akaushik.org`, not `dev.`
The operator offered either. `dev.` reads as "someone's machine" and is the
conventional name for a local or per-developer environment; `beta.` reads as
"the real thing, not finished", which is what this is — a shipped build of
unfinished design that other people may be shown. `dev.akaushik.org` stays free
for an actual development environment later.

### D2 · Worker name `akaushik-org-preview`, separate from `akaushik-org`
Two Workers rather than one Worker with two routes. A preview that shares a
Worker with production shares its logs, its analytics, and its rollback
history, and a bad `wrangler deploy` from the wrong shell would take production
with it. The blast radius of a separate Worker is the preview only. Matches the
`gaurijha-com` / `gaurijha-com-preview` pair already on this account.

### D3 · `production` env declared but not routed
`wrangler.jsonc` declares the production environment with no `routes`. Vercel
still serves `akaushik.org` and ADR-0018 keeps it paused-not-deleted for 14 days
after cutover, so pointing the apex at Workers tonight would be the cutover —
which is an operator decision, not a preview decision. Declaring it now means
the cutover is a route addition rather than a new config written under pressure.

### D4 · No incremental cache binding
`open-next.config.ts` calls `defineCloudflareConfig()` with no cache. The routes
carrying a `revalidate` window are the agent-surface JSON/Markdown routes and
the `md` suffix routes; all are cheap renders over MDX already in the bundle.
A KV incremental cache would add a second source of truth in front of content
that lives in files. Revisit if render cost shows up in Workers analytics.

### D5 · Compatibility date `2026-08-15`
Rather than today's date, which the Cloudflare docs suggest. 2026-08-15 is
already proven on this account by the `gaurijha-com` Worker, and a compatibility
date is a behaviour switch — taking the newest one on a first deploy means
debugging the adapter and the runtime semantics at the same time.
