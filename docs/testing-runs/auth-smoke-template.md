# Auth session-flow smoke — run log template

Copy this file to `docs/testing-runs/YYYY-MM-DD-auth-session-smoke.md`, fill in
the run metadata, then check each stage as the operator drives the script.

Source script: `scripts/smoke/authSessionFlowSmoke.ts`
Tracking issue: [COV-006 / #810](https://github.com/kyleruff1/cDiscourse/issues/810)
Audit gap: [gap #6](../audits/COVERAGE-AUDIT-2026-06-30.md#6--no-deployed-end-to-end-auth-smoke-covers-sign-up-through-session-restore)

---

## Run metadata

| field | value |
|---|---|
| date | YYYY-MM-DD |
| operator | (alias) |
| branch | `main` (or branch under verification) |
| commit SHA | `<git rev-parse --short HEAD>` |
| env source file | `.env.bot-tests` (or override path) |
| Supabase URL host | (from script S1 log line; example: `<project>.supabase.co`) |
| admin email domain | (from script S1 log line; the local-part is omitted on purpose) |
| Node version | `node --version` |
| script mode | `live` |

---

## Pre-run checklist

- [ ] `.env.bot-tests` exists at the run cwd (or the `--env <path>` override resolves).
- [ ] The four required keys are present and non-empty:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - [ ] `CDISCOURSE_ADMIN_EMAIL`
  - [ ] `CDISCOURSE_ADMIN_PASSWORD`
- [ ] Supabase URL host is reachable from this machine (`curl -sSI <url>/auth/v1/health` returns HTTP 200; the script does not pre-flight this).
- [ ] No auth-bearing migration or Edge Function deploy is mid-flight (would invalidate this run as a baseline).
- [ ] `npm run typecheck` and `npm run lint` are clean on the working branch.

---

## Stage results

The script prints one START line and one DONE/FAIL line per stage. Copy the
DONE/FAIL detail into the table below.

| # | stage | result | detail | notes |
|---|---|---|---|---|
| S1 | `load-creds` | PASS / FAIL / SKIP | env-source / url-host / admin-email-domain | |
| S2 | `sign-in` | PASS / FAIL / SKIP | session-returned=… | |
| S3 | `capture-session` | PASS / FAIL / SKIP | user.id=… expires_at=… (tokens never printed) | |
| S4 | `restore-via-setSession` | PASS / FAIL / SKIP | restored-client=fresh | |
| S5 | `verify-restore` | PASS / FAIL / SKIP | user.id-match=… expires_at-match=… | |
| S6 | `sign-out` | PASS / FAIL / SKIP | signed-out=true | |
| S7 | `verify-clear` | PASS / FAIL / SKIP | user-clear=… session-clear=… | |

Final summary line (`result: ran=… passed=… failed=…`) and exit code:

```
(paste the last two lines of the script output here)
exit code: 0 | 1 | 2
```

---

## Observations and anomalies

- (anything that surprised the operator: latency, transient errors, retry behavior, ID drift, etc.)
- (any deviation from the deterministic in-memory `--dry` baseline that previously passed)

---

## Verdict

- [ ] GREEN — all 7 stages PASS, exit 0, no anomalies. Deployed auth lane behaves identically to the in-memory contract.
- [ ] YELLOW — every stage PASS but at least one anomaly (slow, retried, unexpected log noise). Follow-up filed.
- [ ] RED — at least one stage FAIL, or exit non-zero. The failing stage and the user-visible blast radius go below.

Follow-up issue / PR (if YELLOW or RED): #____

---

## Boundaries — what this run does NOT cover

This smoke is deliberately scoped to the session-flow half of the auth front
door. The following are **out of scope** and remain follow-up work tied to
the original audit gap #6:

- **Sign-up via Supabase admin API.** This run uses a pre-existing admin
  account from `.env.bot-tests`; it does not create a fresh user.
- **Fresh mailbox + confirmation-link fetch.** No outbound email is sent or
  inspected.
- **Set-password callback follow.** The `/auth/callback` redirect-URL contract
  is not exercised by this script. It IS exercised by the existing OAuth
  callback unit tests (see the 27 dedicated auth test files; the audit calls
  them "thoroughly covered" — the gap is the *deployed* lane).
- **Rate-limit triggering.** A single sign-in attempt cannot probe Supabase
  Auth's rate limiter.
- **Cross-browser / cross-device session migration.** Single Node process.
- **Production app concession lineage / RLS post-restore.** This smoke stops at
  user.id + expires_at parity. Restored-session data-plane reads are covered
  separately by the bot-tests data-plane verify lane (see the `.env.bot-tests`
  memory note).

A follow-up card that adds the sign-up + mailbox + set-password half is
recommended to close gap #6 fully.

---

## Secrets check

- [ ] No raw `access_token`, `refresh_token`, password, anon key, or publishable-key VALUE appears anywhere in this log.
- [ ] No raw `.env.bot-tests` contents were pasted.
- [ ] The admin email's local-part is redacted (only the domain appears, as the script emits).
- [ ] If a stage FAILed with a Supabase error string, the operator confirmed that string carries no token / key material before pasting.

---

## Re-run cadence

The audit catalogs gap #6 as HIGH severity. Re-run this smoke:

- before each deploy that touches `supabase/functions/auth-*` or
  `src/features/auth/` or any auth-config Edge Function;
- after every Auth redirect-URL change (Supabase dashboard);
- after every Google SSO gate flip (the audit names #776 as a prior near-miss);
- monthly as a passive regression check.
