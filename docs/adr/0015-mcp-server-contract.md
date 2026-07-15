# ADR-0015 — Stateless portfolio MCP server

**Status:** Accepted, 2026-07-14; transport clarifications amended 2026-07-15
**Author:** Codex, for Abhishek Kaushik

## Context

The portfolio already publishes Markdown alternates, JSON listings, OpenAPI, and
agent discovery documents. Its MCP discovery file previously advertised only a
planned capability. The post-launch audit called for a real, narrow MCP surface
without adding another deployment target, mutable state, or a runtime SDK.

The server needs to interoperate with current clients while preserving the
production draft boundary. It also needs an explicit transport contract so a
future client or documentation edit cannot silently widen the surface.

## Decision

Implement `/api/mcp` as a same-origin, stateless Streamable HTTP endpoint inside
the existing Next.js application.

- The current protocol revision is `2025-11-25`.
- The bounded method subset is also compatible with `2025-06-18`.
- A later request without `MCP-Protocol-Version` uses the required
  `2025-03-26` compatibility fallback.
- Supported methods are `initialize`, `ping`, `notifications/initialized`,
  `tools/list`, and `tools/call`.
- POST requests require JSON content and an `Accept` header listing both
  `application/json` and `text/event-stream`. Responses use JSON; valid
  notifications receive HTTP 202 with no body. Request bodies are capped at
  1 MiB before JSON parsing.
- GET, HEAD, PUT, PATCH, and DELETE return 405 after the same protocol and origin
  validation. The server emits no unsolicited messages, opens no SSE stream, and
  issues no session identifier.
- A supplied `Origin` must equal the canonical origin. Server clients may omit
  it.
- JSON-RPC array batches are accepted only on the `2025-03-26` compatibility
  path, where the transport revision permits them, and are capped at 32 calls
  before dispatch. Empty batches remain invalid, notification-only batches receive
  HTTP 202, and later protocol revisions reject arrays. Every no-id call is
  dispatched as a notification where applicable, including request-shaped
  methods, and produces no JSON-RPC response. Numeric request IDs must be
  integers. Protocol failures use the standard `-32700`, `-32600`, `-32601`,
  `-32602`, and `-32603` codes.

Expose exactly two read-only, idempotent, closed-world tools:

1. `lookup_case_study({ slug })` returns one published case study as structured
   data and Markdown.
2. `get_availability({})` returns the public availability and contact contract.

The tool implementation obtains case studies through the draft-filtered listing
before loading a slug, so knowing an unpublished slug cannot bypass the
production gate.

The runtime implementation remains dependency-free. The official MCP Inspector
is pinned as a verification client, not added to production dependencies.

The adapter uses a Pages API route with body parsing disabled. `/api/mcp` is
excluded from `proxy.ts`, because the Fetch `Request` constructor used by the
App Router/proxy path rejects raw methods such as `TRACE` before application
code can validate `Origin`. The Node request boundary accepts those methods,
applies the same Origin/protocol checks, and returns 403 or 405 instead of a
framework 500. It reproduces the site's discovery and security response headers
directly so the matcher exclusion does not weaken the public response contract.

## Discovery and documentation

`/.well-known/mcp.json` is site/scanner-specific metadata, not a protocol
standard server-card schema. It advertises the endpoint, supported revisions,
transport policy, and exact tool schemas. OpenAPI, `/api/docs`, `/llms.txt`, and
agent-readiness documentation must describe the same contract.

## Security and operations

The application layer is read-only and same-origin. Production abuse protection
requires a separate per-source WAF control at 60 `/api/mcp` requests per minute
with a 60-second block. That control-plane mutation is explicitly held until the
operator authorizes it; this ADR does not claim it is active.

No authentication, cookies, database, durable session, write-capable tool, or
second deployment target is introduced.

## Consequences

- Agents can discover and call a real portfolio capability with current-client
  interoperability.
- The public contract stays intentionally small enough to test exhaustively.
- Stateless handling avoids session affinity and SSE lifecycle costs.
- Bounding batches to the fallback revision and rejecting unsolicited streams
  keeps later revisions deliberately narrow without violating compatibility.
- A future protocol revision, write-capable tool, authentication layer, or
  separate runtime requires a superseding ADR.

## Alternatives considered

**Add the MCP SDK as a runtime dependency.** Rejected. Two tools and five methods
do not justify the additional install and bundle surface.

**Target only one protocol revision.** Rejected. The current revision plus the
bounded prior and missing-header fallback behavior gives materially better
client compatibility at low complexity.

**Deploy a separate Worker or long-lived SSE service.** Rejected. The server has
no unsolicited messages or session state, and a second target would create
operational complexity without user value.

**Expose the raw content loader directly.** Rejected. It would make the draft
boundary depend on every caller remembering to filter unpublished slugs.
