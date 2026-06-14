# Live branded invite — seed smoke (2026-06-13)

## Header
| Field | Value |
|---|---|
| Run | AUTH-INVITE-LIVE-SEED-2026-06-13 — **SMOKE PASSED: devtest98 full end-to-end success after the hosted URL-config (G4) fix** |
| HEAD SHA | `3c8c499` (`main == origin/main`) |
| Seed target | `kyleruff+devtest99@gmail.com` (sent — **exactly one**) |
| Batch | **NOT attempted** (gated on operator seed confirmation) |
| Credential lane | admin-bot user from `.env.bot-tests` (`CDISCOURSE_ADMIN_EMAIL`/`CDISCOURSE_ADMIN_PASSWORD`) → admin JWT → `admin-users` `invite_user` Edge action. **No service-role.** Creds read into env for the send command only; never printed as values. |

## Preflight gates (all passed before send)
| Gate | Result | Evidence |
|---|---|---|
| HEAD includes #605/#606/#608; #607 closed; READY verdict | ✅ | `git log`; `docs/testing-runs/2026-06-13-auth-callback-consumer.md` = `READY_FOR_SEED_SEND` |
| **Deployed app serves the #608 callback consumer** | ✅ (after operator re-deployed Netlify) | live bundle `index-7c606ecc…js` (2.73 MB) contains `"Save password and continue"` + `"Choose a password so you can sign in"`; the prior stale bundle `index-d7a1ac12…js` (2.63 MB) did NOT — **send was held until the fresh bundle was confirmed** |
| `/auth/callback` route serves (not 404) | ✅ | `https://dev-cdiscourse.netlify.app/auth/callback` → 200 SPA shell |
| Admin-bot lane authenticates + Edge reachable | ✅ | read-only `list_users` probe: signed in, `admin-users` returned |
| Seed does not already exist | ✅ | `list_users search=<seed>` → 0 matches (clean first invite) |
| Redirect URL | ✅ | `https://dev-cdiscourse.netlify.app/auth/callback` — allow-listed host (`config.toml:168`) + `/auth/callback` path; worst case falls back to the same Site-URL origin |
| Authorization | ✅ | operator "live seed / smoke" = one-seed authorization (not batch) |
| SMTP posture | ⚠️ operator-accepted seed-only | hosted SMTP not readable from repo; passed `--smtp-posture custom` per operator's runbook; **delivery is what the operator verifies** |
| Hosted "Invite user" template branded | ⚠️ `HOSTED_TEMPLATE_UNVERIFIED` | can't read the hosted template from here; may have auto-synced from the #605 merge or been pasted by the operator — **operator judges the rendering** |

## Send result
- `node scripts/auth/sendInviteSmoke.js --live --email kyleruff+devtest99@gmail.com --redirect-to https://dev-cdiscourse.netlify.app/auth/callback --smtp-posture custom`
- Plan: `mode: live_single`, `sendArmed: true`, `batchEnabled: false`, `redirectHost: dev-cdiscourse.netlify.app`, credentials present (fingerprints only).
- **Edge response: `{"ok":true,"invited":true,"notification":"sent"}` — exit 0.** No invite link/token printed (the Edge response carries none by design).
- Error classification: none.

## Operator result (first seed — partial PASS, one config blocker)
- ✅ **Received** (SMTP / G2 works on hosted).
- ✅ **Rendered branded** (hosted "Invite user" template / G3 is the branded version).
- ❌ **CTA routed to `http://localhost:8081` instead of the Netlify app** — **G4 blocker.**

**Root cause (G4):** Supabase **ignores a `redirectTo` that is not in the hosted Redirect-URLs allow-list and falls back to the project's Site URL.** The send passed `--redirect-to https://dev-cdiscourse.netlify.app/auth/callback` (plan showed `redirectHost: dev-cdiscourse.netlify.app`), but the hosted project's **Site URL is `http://localhost:8081`** and/or the Netlify origin is not in the hosted **Redirect URLs** list, so Supabase dropped the redirect and used the localhost Site URL. Not a code defect — the local `config.toml` allow-list (`:164-170`) is **not** inherited by the hosted project.

**Fix (operator — Dashboard → Authentication → URL Configuration):**
1. **Site URL** → `https://dev-cdiscourse.netlify.app`
2. **Redirect URLs** → add `https://dev-cdiscourse.netlify.app/**` (covers `/auth/callback`)

I cannot apply this from here: no management token in-session and `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE` is not armed. (To have me do it: `npx supabase login` or put `SUPABASE_ACCESS_TOKEN` in `.env.bot-tests` + arm `CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE=1`, and I'll PATCH the two fields via the Management API.)

**Re-test after the fix:** `kyleruff+devtest99@gmail.com` now exists as a passwordless user and its already-sent email is baked to localhost (unusable). Re-seed with a **fresh alias** (`kyleruff+devtest98@gmail.com`) and verify the CTA lands on `…netlify.app/auth/callback` → "Set a password". (Optionally soft-delete the leftover `devtest99` later.)

## G4 fix — hosted Auth URL config updated (Management API)
- Endpoint: `PATCH https://api.supabase.com/v1/projects/{ref}/config/auth` (token from `.claude-tmp/operator-secrets.env`, never printed; diagnostics show present+length only after the #609 redaction hardening).
- **Before:** `site_url = http://localhost:3000`, `uri_allow_list = (empty)` → root cause confirmed (the local `config.toml` allow-list was never synced to hosted; Supabase fell back to the localhost Site URL).
- **After (PATCH 200, readback VERIFY PASS):** `site_url = https://dev-cdiscourse.netlify.app`; `uri_allow_list = http://localhost:8081/** , https://dev-cdiscourse.netlify.app/**` (localhost preserved, netlify wildcard added).
- Only `site_url` + `uri_allow_list` changed (partial PATCH); SMTP / email templates / providers / JWT / expiry / rate limits untouched.
- Credential-diagnostics hardening merged as **#609** (`fingerprint` → present+length only) before this re-seed.

## devtest98 re-seed (after the G4 fix)
- `node scripts/auth/sendInviteSmoke.js --live --email kyleruff+devtest98@gmail.com --redirect-to https://dev-cdiscourse.netlify.app/auth/callback --smtp-posture custom`
- Plan: `live_single`, batch disabled, redirectHost `dev-cdiscourse.netlify.app`, credentials present (length only, no fragment).
- **Edge response: `{"ok":true,"invited":true,"notification":"sent"}` — exit 0.** No link/token printed.

## Operator receipt/render/callback/account-creation — devtest98 — **FULL SUCCESS (operator-confirmed)**
1. [x] Inbox — email arrived
2. [x] Subject `You're invited to CDiscourse`; From acceptable
3. [x] Branded rendering (CDiscourse header, "Accept invite", fallback link)
4. [x] **Click "Accept invite" → landed on `https://dev-cdiscourse.netlify.app/auth/callback`** (the G4 fix — no longer localhost)
5. [x] Callback "Finishing sign-in…" → "Set a password"
6. [x] Password set → signed in
7. [x] Sign out + sign back in with the new password
8. [x] No wrong-user / duplicate-account state

Read-only confirmation: `devtest98` exists and `lastSignInAt` is set (signed in). The full loop — branded template + `/auth/callback` consumer + hosted URL-config fix + admin-bot send lane — is validated end-to-end in production.

## devtest97 — final alias — **FAILED (rate limit), no user created**
- `node scripts/auth/sendInviteSmoke.js --live --email kyleruff+devtest97@gmail.com --redirect-to … --smtp-posture custom` → Edge `FunctionsHttpError`, exit 0 (no retry, per the no-rate-limit-workaround rule).
- Read-only check: `devtest97` **exists=false** — the failed send created no account (no cleanup needed).
- **Cause:** Supabase Auth email rate limit — 3 invites (devtest99/98/97) within minutes; the project's `email_sent` limit is low (`config.toml:206` shows `2`/hr locally). Not a flow defect — devtest98 had just succeeded.
- **To complete devtest97** (optional — the smoke objective is already met by devtest98): wait for the rate-limit window (≥1 hr), then re-send the single `devtest97` invite. Or raise the hosted Auth email rate limit if more rapid testing is wanted.

## devtest99 — original seed — partial (G4), superseded
Received + rendered, but routed to localhost (the pre-fix Site URL). Now a leftover passwordless account; optionally soft-delete via the admin surface. Its localhost-baked invite link is unusable. Superseded by the devtest98 success.

## Outcome
**SMOKE PASSED.** The branded-invite → callback → account-creation loop works end-to-end on the deployed app, proven by devtest98. The only failure (devtest97) is an expected email rate limit with no side effects.

## Housekeeping follow-ups (non-blocking)
- ✅ Credential-diagnostics redaction tightened to present+length only — merged as **#609**.
- The hosted project previously had **Site URL = localhost:3000 and an empty redirect allow-list**, so password-reset and signup-confirmation emails were also pointing at localhost. The Site-URL + allow-list fix corrects those flows too — worth a quick sanity check on signup-confirm / password-reset.
- Optional: soft-delete the leftover `devtest99` passwordless account.

## devtest100 — 2026-06-14 re-seed — host fix re-confirmed; NEW intermittent setSession hang found

- `sendInviteSmoke.js --live --email kyleruff+devtest100@gmail.com --redirect-to https://dev-cdiscourse.netlify.app/auth/callback --smtp-posture default` → Edge `{ok:true,invited:true,notification:"sent"}`.
- Hosted Auth config readback (Management API GET — **no patch needed**): Site URL `https://dev-cdiscourse.netlify.app` + allow-list `http://localhost:8081/**,https://dev-cdiscourse.netlify.app/**` were **already correct** (the G4 URL-config repair is already in place). `mailer_autoconfirm:false` (confirmations ON → EMAIL-TRANSPORT-002 needs Option B). Custom SMTP **not** configured (built-in email; the seed is Supabase-branded).
- Operator click-through (logged out): email arrived, CTA → `dev-cdiscourse` (correct host — **host fix confirmed**), callback rendered "One moment while we open your account.", then **hung in an infinite load** — the set-password screen never appeared. (Earlier smoke7's failure was the wrong host `cdiscourse.netlify.app`; that is resolved — this is a new, deeper failure.)
- **Root cause (AUTH-CALLBACK-TIMEOUT-001):** `consumeAuthCallback` awaits `supabase.auth.setSession` (default implicit flow → fragment tokens), whose internal `GET /auth/v1/user` uses a **timeout-less, abort-less fetch** (auth-js 2.106.0); the consume path had **no timeout guard**, so a stalled response (or an in-context auth lock held by a concurrent `autoRefreshToken` tick, which bypasses the 5 s lock-steal) pins `AuthCallbackScreen` on `'checking'` forever. Environmental/intermittent — which is why **devtest98 passed and devtest100 hung on the same bundle**.
- **Fix (this change-set):** a timeout race inside `consumeAuthCallback` (default 12 s; injectable `timeoutMs`) → a stall now maps to a recoverable `network` error (the screen's existing "Return to sign in" path) instead of hanging. Affects **all** `/auth/callback` flows — invite + recovery + magic-link. Branch `feat/AUTH-CALLBACK-TIMEOUT-001`; +5 tests; full suite green.
- Optional defense-in-depth (follow-up): a custom `global.fetch` with `AbortSignal.timeout` in `src/lib/supabase.ts` so the hung GoTrue request actually aborts (lets auth-js's own retry path fire).
- `devtest100` account: created (Auth-invited, no password set) — leftover test account; optional soft-delete.
- The signup-confirm / password-reset sanity check noted above: those share this same callback consumer, so the timeout guard protects them too.
