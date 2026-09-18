# Clarify 008 — Gated demo portal

**Date:** 2026-09-18
**Mode:** remediation. The code on `feat/demo-portal` was written from an
operator work order before this triad existed; the triad is authored in place
on the same branch per the spec skill's remediation note. Answers below come
from that work order and from the operator's decisions during the session.

## 1. Intent

A prospective client is shown a hosted answer API working over their own
document pack. They need to ask questions in a browser and see answers whose
citations open the source PDF at the cited page. The page must be private, and
it must look finished enough to put in front of a client.

## 2. Users affected

- **Invited viewer** (client sponsor and colleagues): signs in with an account
  created for them, asks questions, opens cited pages.
- **Presenter** (operator): walks the viewer through suggested questions live,
  on a laptop or a phone.
- **Nobody else.** Unauthenticated visitors reach a sign-in form and learn
  nothing about the client from it.

## 3. Success metric

The presenter can run the suggested questions end to end on the production
host: every in-scope question streams an answer with page-level citations
that open the right PDF page, and every out-of-scope question is declined
plainly, without looking like an error.

## 4. Edge cases

- Upstream down, slow or misconfigured → one generic error, never upstream
  detail.
- Follow-up questions after the Worker isolate recycles → the conversation
  must continue (the upstream binds a conversation to a visitor id).
- A source without a URL or page → the card renders without a broken link.
- Quota: a runaway client loop must not burn the upstream tenant's budget.
- Public repository: no client, project or document name, tender text, or
  upstream channel/tenant identifier may land in a committed file.

## 5. Rollback plan

The demo is its own Worker on its own host with its own databases. Rollback is
`wrangler rollback` on `demo-prod-worker`, or deleting its custom domain; the
portfolio, the course and the friends portal are untouched. Revoking the
publishable upstream key disables all answers immediately.

## Open questions

None as of 2026-09-18. Account usernames and passwords are the operator's
call at deploy time and are deliberately not recorded here.
