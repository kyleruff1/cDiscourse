# Admin email validation plan

Tracking issues: **#39 QOL-015** (admin notification path) ·
**#40 QOL-016** (Supabase Auth + redirect audit).

This plan exists so the cdiscourse.com/dev public deployment never
sends a real email to an unprepared inbox, and so the
`request-argument-deletion` admin notification path is provably correct
before any live recipient receives anything.

**Default mode: mock-first.** No live email send happens until every
checklist below is green AND the operator explicitly authorizes a
single test recipient.

---

## What must be validated

### Path A — admin notification on argument deletion request

`supabase/functions/request-argument-deletion/index.ts` notifies admins
when a user requests their own argument be deleted. The function:

- Verifies the JWT and confirms the caller is the argument author.
- Inserts one row into `argument_deletion_requests` with
  `status='open'` and the user's reason.
- Optionally posts a Resend email to admins listed in
  `ADMIN_NOTIFICATION_EMAILS` (Supabase secret).
- Returns a sanitized response: `{ ok: true, notification: '<status>' }`.
  The response **never** echoes admin email addresses to the client.
- Returns `notification: 'not_configured'` when Resend is missing —
  this is an allowed graceful path, not an error.

### Path B — Supabase Auth emails (signup / reset / magic link / invite / email-change)

These are configured in the Supabase dashboard under **Auth → URL
Configuration** and **Auth → Email Templates**. Each template has:

- a sender address,
- a subject,
- a confirmation/reset/invite URL the user is redirected to after the
  click,
- an allow-list of valid redirect URLs.

For cdiscourse.com/dev we need all redirect URLs to land on the dev
host and none to leak local development URLs into production email.

---

## Mock-first test plan (do these in order)

### M1 — unit-level: payload assembly

- [ ] Add tests in `__tests__/` that import the request-argument-deletion
      payload builder (extract a pure helper if needed) and assert:
  - admin email list is read from `Deno.env.get('ADMIN_NOTIFICATION_EMAILS')`,
  - email body contains argument id, debate id, requester id, and reason,
  - email body **does not** contain `Authorization` header, JWT,
    `SERVICE_ROLE_KEY`, or `RESEND_API_KEY`,
  - response payload to the client contains `{ ok, notification }` only
    — no admin addresses, no secrets.

### M2 — function-level: not_configured fallback

- [ ] With `RESEND_API_KEY` and `ADMIN_NOTIFICATION_EMAILS` both unset,
      `npx supabase functions serve request-argument-deletion --no-verify-jwt`
      locally and `curl` the endpoint with a synthetic JWT.
- [ ] Assert response: `{ ok: true, notification: 'not_configured' }`.
- [ ] Assert no outbound HTTPS request was attempted (mock `fetch` /
      use offline test harness).

### M3 — function-level: Resend error path

- [ ] With `RESEND_API_KEY=sk_test_invalid` and a real-looking admin
      list, hit the endpoint.
- [ ] Resend returns 401; function returns
      `{ ok: true, notification: 'send_failed' }`.
- [ ] No 401 detail, no key fragment, and no admin address leak to
      stdout, stderr, response body, or test snapshot.

### M4 — RLS round-trip

- [ ] `npx supabase db reset` to apply migrations.
- [ ] Sign in as a synthetic user, request deletion of own argument:
      one row in `argument_deletion_requests`.
- [ ] Sign in as a different non-admin user: cannot select that row.
- [ ] Sign in as `is_moderator_or_admin()=true`: can select; can update
      `status='reviewed'` and set `reviewed_by`, `reviewed_at`.

### M5 — Auth template inventory (read-only)

Document what is configured in the Supabase dashboard. Capture in this
doc, NOT in the repo:

- [ ] List every email template currently enabled.
- [ ] List every redirect URL on the allow-list.
- [ ] Note any template still pointing at `http://localhost`,
      `expo://`, or a non-cdiscourse domain.
- [ ] Note the sender address — confirm it is a domain the operator
      controls (not `noreply@supabase.co`).

---

## Operator-only steps (live email)

Once M1 – M5 are green AND the operator types an explicit "send a real
test email to <my address>" sentence in a session:

### L1 — one self-test recipient
- [ ] **Operator** sets `ADMIN_NOTIFICATION_EMAILS` to their own
      inbox in the Supabase secrets (`npx supabase secrets set ...`).
- [ ] **Operator** sets `RESEND_API_KEY` to the real Resend API key.
- [ ] **Operator** deploys: `npx supabase functions deploy request-argument-deletion --linked`.
- [ ] A session is allowed to trigger one deletion request from a
      dev account; operator confirms the email arrived; redact the
      received email's headers before pasting any of it back.

### L2 — Auth email smoke
- [ ] **Operator** triggers a signup confirmation, password reset,
      magic-link, and invite to their own email.
- [ ] **Operator** clicks each link and confirms the redirect lands on
      cdiscourse.com/dev (or the URL HOST-001 finalises) with no
      query-string leak of tokens.

### L3 — production allow-list
- [ ] **Operator** removes any localhost/dev-only redirect URLs from
      the production allow-list before public dev hosting opens.

---

## Supabase / Auth settings checklist

These belong in the Supabase dashboard, not in the repo. Tick when
verified:

- [ ] **Project URL** matches the live Supabase project (`qsciikhztvzzohssddrq`
      currently).
- [ ] **Site URL** points at the chosen dev host (see HOST-001).
- [ ] **Redirect URLs** allow-list includes only the dev host + any
      necessary local dev origins for testing.
- [ ] **Email Auth → Confirm email** is enabled.
- [ ] **Email Auth → Secure email change** is enabled.
- [ ] **Email templates** sender domain is operator-controlled.
- [ ] **Email templates** body copy uses plain language; no internal
      validation codes; no debate / argument content quoted in subject.
- [ ] **Secrets** — `RESEND_API_KEY` and `ADMIN_NOTIFICATION_EMAILS` set
      via `npx supabase secrets set …`. Never committed.

---

## What Claude must never do here

- Call `npx supabase functions deploy`.
- Call `npx supabase secrets set`.
- Send any real email.
- Print `ADMIN_NOTIFICATION_EMAILS`, `RESEND_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, JWT tokens, or any `Authorization:`
  header value in logs, fixtures, snapshots, or commit messages.
- Add a third email provider without explicit operator approval.
- Auto-merge any PR that changes email behaviour.

If a future session is unsure whether a step crosses the line, default
to running the mock path and reporting back rather than acting.
