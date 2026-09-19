# Spec: a password-protected chat over a client's document pack

**Slug:** `demo-portal`
**Date:** 2026-09-18
**Author:** Abhishek Kaushik (operator), drafted by Claude
**Status:** accepted

---

## 1. Problem statement

A client meeting needs a live demonstration of cited question answering over
that client's own documents. The hosted answer API (VeriCite) has a widget,
but it is embeddable, not private: there is no place to show it to a named
audience without either exposing the API key in a browser or publishing the
client relationship. The site already runs two private subdomains; the demo
needs a third, ready in a day.

## 2. Users + scenario

- **Invited viewer** — opens `demo.akaushik.org`, signs in with credentials
  they were sent, asks questions, clicks a citation and lands on that page of
  the PDF.
- **Presenter** — clicks through suggested questions during the meeting,
  including two that are deliberately outside the documents.

## 3. Success criteria

- [x] Anonymous `GET /` renders only a generic sign-in page; the branded title
  appears only after sign-in.
- [x] `POST /api/chat` returns 401 without a session and makes no upstream
  call (`apps/demo/test/chat-unauth.test.mjs`).
- [x] Only allowlisted event types and fields reach the browser; a new
  upstream field is dropped by construction (`test/sse-filter.test.mjs`).
- [x] Any upstream failure yields exactly one generic error event and
  `[DONE]` (`test/chat-upstream-error.test.mjs`).
- [x] Follow-ups keep one upstream visitor id across isolates
  (`test/visitor-credential.test.mjs`).
- [x] 20 messages per rolling 5 minutes per account, then 429.
- [x] Inline `[n]` markers and source cards open `url#page=N` in a new tab.
- [x] Declined answers render as a muted "Not found in the documents" state.
- [x] Mobile (iPhone 13 width) and desktop show no horizontal overflow.
- [ ] On the production host, with the production upstream, every suggested
  in-scope question answers with correct cited pages and every out-of-scope
  one is declined.
- [x] `git grep` for the client, sponsor and project names returns nothing.

## 4. Non-goals

- Uploading or managing documents; the upstream tenant owns the pack.
- Public signup, password reset by email, or SSO.
- Conversation history across page loads.
- A general-purpose chat product; this serves one audience at a time.

## 5. Constraints

- Public repository: everything client-specific arrives as Worker secrets.
- Auth parity with `apps/learn` (ADR-0022): the stack is copied, not rewritten.
- The browser talks only to its own origin (`connect-src 'self'`).
- The upstream key is a publishable, query-only key bound to one origin.
- Deadline: demo-ready the night before a 19–20 Sep 2026 meeting.

## 6. Open questions

None as of 2026-09-18.

## 7. Risks

- Upstream citation URLs could download rather than display. Mitigation: the
  stored objects are `application/pdf`; verified on preview before
  production.
- A third copy of the auth stack can drift (ADR-0023 records the obligation).
- The upstream's gateway may cache tenant configuration for minutes after a
  change; test after, not during, upstream changes.

## 8. Out of scope (intentional)

- Changes to the VeriCite service itself (owned by that repository).
- Navigation links from the public portfolio to the demo.

Decisions: `docs/adr/0023-gated-demo-portal.md`.
