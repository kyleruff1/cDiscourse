# CDiscourse — MVP Smoke Test

_Stage 5.5.6 — updated 2026-05-16_

## Purpose

This document defines the minimum set of manually verified behaviors that must pass before calling CDiscourse ready for an MVP demo. It is not a full test suite — it is the fastest path to "safe to show."

---

## Pre-conditions

Before running the smoke test:

1. `npm run typecheck` — must pass (0 errors)
2. `npm run lint` — must pass (0 warnings)
3. `npm run test` — must pass (526 tests)
4. `npm run web -- --clear` — must open http://localhost:8081 without a bundle error
5. `.env` exists with real `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. Supabase project linked, migrations applied, `submit-argument` function deployed

If pre-conditions 5–6 are not met, only the "no .env" path of each section is testable. Record which sections were tested and which were skipped.

---

## Smoke Test Results — 2026-05-16 (Stage 5.5.6)

Infrastructure live. `.env` configured, migrations applied, `submit-argument` ACTIVE.
Post-submit refresh (Stage 5.5.5) and account feature (Stage 5.5.6) implemented. Browser walkthrough not yet completed.

| Section | Status | Notes |
|---|---|---|
| Web server launches | ✅ | Verified previously (352 modules) |
| Bundle errors | ✅ None | |
| Hosted backend live | ✅ | qsciikhztvzzohssddrq linked, submit-argument ACTIVE |
| Debates RLS recursion | ✅ Fixed | Migration 0006 — SECURITY DEFINER helpers break the loop |
| Account screen renders | ✅ | `AccountScreen` implemented — email, role, display name edit |
| Auth screen renders | 🔲 Pending browser | Unblocked: .env configured |
| Sign-in / sign-up | 🔲 Pending browser | |
| Debate create/join | 🔲 Pending browser | |
| Argument tree | 🔲 Pending browser | |
| Composer root | 🔲 Pending browser | |
| Submit flow | 🔲 Pending browser | Unblocked: submit-argument deployed |
| Post-submit tree refresh | 🔲 Pending browser | Stage 5.5.5 implemented |
| Server 422 error display | 🔲 Pending browser | |
| Idempotency live | 🔲 Pending browser | |
| Session recovery | 🔲 Pending browser | |
| Console errors | 🔲 Pending browser | |

---

## MVP Demo Prerequisites

The following must be done before a live demo is possible:

### Backend (Supabase)

```bash
# 1. Create a Supabase project at supabase.com
# 2. Link it
npx supabase link --project-ref <your-project-ref>

# 3. Apply all migrations
npx supabase db push --linked

# 4. Deploy the Edge Function
npx supabase functions deploy submit-argument

# 5. Set Edge Function secrets
npx supabase secrets set ANTHROPIC_API_KEY=<your-key>
```

### Client (.env)

```bash
cp .env.example .env
# Edit .env:
# EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
# EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

### Local validation (when Docker available)

```bash
npx supabase start
npx supabase db reset
npx supabase db status
npx supabase db lint
```

---

## Minimum Passing Criteria for "Safe for MVP Demo"

All of these must pass:

- [ ] App loads in browser without crash
- [ ] Auth screen renders; sign-in/sign-up works with test account
- [ ] Sign-out works
- [ ] Debate list loads
- [ ] Can create a debate
- [ ] Can join a side
- [ ] Argument tree renders (empty state or with arguments)
- [ ] Can open Compose tab
- [ ] Composer shows resolution, type picker, side picker, body input
- [ ] Client validation preview shows after required fields filled
- [ ] Can submit a root thesis (submit button enabled, submission goes through)
- [ ] Success clears draft and switches to debate tab
- [ ] Submitted argument appears in tree (after manual refresh)
- [ ] Submit failure (e.g., body too short) shows error and preserves draft
- [ ] Browser refresh does not crash; auth session persists
- [ ] Account tab shows email, masked user ID, role label, editable display name
- [ ] Display name edit saves and shows "Display name saved." notice
- [ ] No role-change UI visible in account screen

---

## Current Status

**Safe for MVP demo: ALMOST** (as of 2026-05-16 Stage 5.5.6.1)

Infrastructure blockers resolved:
- ✅ `.env` configured with real project URL and publishable key
- ✅ Supabase project linked (`qsciikhztvzzohssddrq`)
- ✅ All migrations applied to hosted project
- ✅ `submit-argument` Edge Function deployed and ACTIVE
- ✅ Post-submit tree refresh implemented (Stage 5.5.5)
- ✅ Account/profile feature implemented (Stage 5.5.6)
- ✅ Debates RLS recursion fixed (Stage 5.5.6.1, migration 0006)

Remaining:
1. Run the browser smoke test — `npm run web -- --clear` then walk sections A–K
2. Rotate the ANTHROPIC_API_KEY (exposed in chat) — see `docs/known-blockers.md`

See `docs/browser-visual-test.md` for the full checklist.
