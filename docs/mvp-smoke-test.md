# CDiscourse — MVP Smoke Test

_Stage 5.5.4 — created 2026-05-16_

## Purpose

This document defines the minimum set of manually verified behaviors that must pass before calling CDiscourse ready for an MVP demo. It is not a full test suite — it is the fastest path to "safe to show."

---

## Pre-conditions

Before running the smoke test:

1. `npm run typecheck` — must pass (0 errors)
2. `npm run lint` — must pass (0 warnings)
3. `npm run test` — must pass (386 tests)
4. `npm run web -- --clear` — must open http://localhost:8081 without a bundle error
5. `.env` exists with real `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. Supabase project linked, migrations applied, `submit-argument` function deployed

If pre-conditions 5–6 are not met, only the "no .env" path of each section is testable. Record which sections were tested and which were skipped.

---

## Smoke Test Results — 2026-05-16 (partial)

| Section | Status | Notes |
|---|---|---|
| Web server launches | ✅ | http://localhost:8081, 352 modules, 4.1 s |
| Bundle errors | ✅ None | |
| Auth screen renders | 🔲 Pending | Requires browser check |
| Config error notice visible | 🔲 Pending | Expected: yes (no .env) |
| Debate list | 🔲 Pending | Blocked by no .env |
| Argument tree | 🔲 Pending | Blocked by no .env |
| Composer root | 🔲 Pending | Accessible even without .env via Compose tab |
| Composer reply | 🔲 Pending | Requires debate + parent argument |
| Submit flow | 🔲 Pending | Blocked by no .env / no deployed function |
| Session recovery | 🔲 Pending | Requires auth configured |
| Responsive layout | 🔲 Pending | Requires browser |
| Console errors | 🔲 Pending | Requires browser DevTools |

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

---

## Current Status

**Safe for MVP demo: NO** (as of 2026-05-16)

Blockers:
1. No `.env` — Supabase not configured
2. No linked Supabase project — migrations not applied
3. `submit-argument` Edge Function not deployed
4. Docker unavailable — local Supabase stack not validated

None of these are code issues. The app code is complete and passes all static checks. The blockers are infrastructure/configuration tasks.

See `docs/known-blockers.md` for resolution steps.
