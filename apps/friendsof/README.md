# Friends portal

An independently built private workspace. Architecture: ADR-0021 in the root
`docs/adr` directory. Production serves `https://friendsof.akaushik.org`.

Run commands from this directory:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:contracts
pnpm test:markdown
pnpm build:worker
pnpm deploy:production
```

`test` runs the original runtime qualification harness. `test:contracts` runs
the product data, authorization, question-register, and source-link tests.
`test:markdown` runs the portable Markdown, importer, and rollback checks directly
against application modules. Source-specific import rehearsals remain private.

For a fresh installation, apply `migrations/0001_core.sql` to CONTENT_DB and
`migrations/auth/0001_auth.sql` to AUTH_DB. These are separate databases; never
apply both schemas to one store. Provision bindings and secrets explicitly.

Production deployment must use the explicit `production` environment. The
default Wrangler configuration is the disposable qualification environment.
Do not put private content, credential files, D1 exports, or media backups in
this package. Do not point qualification bindings at production stores.

`scripts/owner-bootstrap.mjs` supports `create`, `reset-password`, and
`revoke-sessions`. It requires an external mode-0600 credential JSON file via
`OWNER_CREDENTIAL_FILE`, plus `CF_API_TOKEN`, `CF_ACCOUNT_ID`, and `AUTH_D1_ID`.
Password reset atomically changes the password and revokes that user's sessions.
Workspace membership is a separate explicit content-database operation.

`scripts/import-private.mts` accepts an external source catalog and owner
approval. Rehearse with `--dry-run` before a live `--commit`, verifying the exact
target workspace, D1 database, bucket, source hashes, and approved sharing set.
Never edit imported immutable revisions directly to repair presentation.

Private operator release helpers provide encrypted canonical D1/R2 backup and
scratch restore. They require external private output and key custody; helpers
and actual verification receipts are retained in the local ignored spec archive.
Restoration must target scratch stores before any production recovery decision.

Public exports are separate owner-approved operations. A private share does not
authorize publication in the portfolio.
