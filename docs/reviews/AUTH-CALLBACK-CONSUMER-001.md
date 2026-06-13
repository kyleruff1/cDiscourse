# AUTH-CALLBACK-CONSUMER-001 — Review

**Verdict:** Approve (GATE-C — merge stays operator-gated regardless of verdict)
**Reviewer agent run:** 2026-06-13
**Branch:** feat/AUTH-CALLBACK-CONSUMER-001-invite-callback
**Design:** docs/designs/AUTH-CALLBACK-CONSUMER-001.md (base commit `9ca7a43`)
**Reviewed range:** `9ca7a43..b03b6e5` (5 impl commits)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/607

## Summary

This card builds the missing `/auth/callback` consumer: a pure parser
(`parseAuthCallbackUrl`), an injected-client consumer (`consumeAuthCallback`), a
plain-language copy bundle, a six-state screen with an invited-user set-password
form, two additive `authApi` wrappers, and a synchronous web-only capture branch
in `App.tsx`. The implementation matches the design precisely and the auth-safety
posture that makes this a GATE-C card is clean on every axis: `detectSessionInUrl`
stays `false`, there is no `supabase/**` change of any kind, no migration, no
second auth client, no service-role/Anthropic key, no direct SQL, no hosted config
change, and no provider call. Tokens are redacted in diagnostics, the password is
sent only into `updateUser` and never logged/persisted/returned, and all copy is
link-state language (no winner/loser/truth/verdict). Test coverage is excellent
(+147 tests / +7 suites, full branch coverage on both pure modules including a
13-item garbage fuzz proving the parser never throws). Gates re-run green. The
only full-suite failure is the pre-existing, documented flaky perf test
`pointLifecycleModel` LIFE-001 — not in this diff, passes isolated. The
`READY_FOR_SEED_SEND` verdict in the testing-run doc is justified. Approve; the
operator performs the gated merge.

## Verification (reviewer re-run)

| Gate | Result |
|---|---|
| typecheck (`tsc --noEmit -p tsconfig.json`) | **pass** — exit 0 |
| lint (scoped eslint, 6 src + 7 test, `--max-warnings 0`) | **pass** — exit 0 |
| test — full `jest --silent --ci` | **753/754 suites green**; 1 failure = flaky LIFE-001 perf (not in diff) |
| test — flaky file isolated (`pointLifecycleModel.test.ts`) | **pass** — 76/76, exit 0 |
| test — 7 new auth suites together | **pass** — 147/147 tests, 7/7 suites, exit 0 |
| test count | 747 → **754 suites**; 30290 → **30437 total** (30436 pass + 1 skip); **+7 suites / +147 tests**, nondecreasing |
| secret scan (diff) | **clean** — only hits are test assertions + status-doc prose |
| doctrine scan (diff) | **clean** — only hits are doctrine comments + JS boolean literals |
| `.skip`/`.only`/`xit`/`fdescribe` | **none** (grep exit 1) |
| Migration apply | **N/A** — no `supabase/migrations/**` in diff (no migration-bearing trigger) |

The full-suite exit-1 is **not a regression**: the single failure is
`__tests__/pointLifecycleModel.test.ts › LIFE-001 performance › 250-node fixture
builds in < 30 ms` (39ms vs a 30ms wall-clock budget). This file is absent from
the branch diff and is the known flake documented in
`memory/flaky-life001-perf-test-fullsuite.md` ("flakes under full-suite parallel
load but passes isolated; pre-existing, not a regression"). Re-run isolated it
passes 76/76. The implementer's captured `754 / 30436 passed, exit 0` is the
non-flaky-load result; the +147 new tests are independently confirmed green.

## Auth-safety attestation (GATE-C core — §a, each proven)

| # | Assertion | Proven? | Evidence |
|---|---|---|---|
| 1 | `detectSessionInUrl` stays `false` | **YES** | `src/lib/supabase.ts` absent from `--name-only`; pinned in `__tests__/authCallbackRouting.test.ts:86-94` (`toContain('detectSessionInUrl: false')` + `not.toContain('detectSessionInUrl: true')`) |
| 2 | NO migration / NO `supabase/**` change | **YES** | `git diff --name-only` grep `supabase/\|migration\|\.sql\|config.toml\|netlify.toml` → exit 1 (no match) |
| 3 | NO service-role / admin key in any client file | **YES** | added-line grep `SERVICE_ROLE\|service_role\|ANTHROPIC_API_KEY` → only test assertions + status-doc prose; `authApi.ts` no-secret scan `authCallbackSetPassword.test.ts:132-141`; 4 new files scanned `authCallbackRouting.test.ts:96-109` |
| 4 | NO direct SQL to `auth.users` / `public.*` | **YES** | added-line grep `auth.users\|from public.\|insert public.\|.rpc(` → exit 1; `consumeAuthCallback.ts` calls only injected `getSession/setSession/exchangeCodeForSession` |
| 5 | NO second auth client (reuses `src/lib/supabase.ts`) | **YES** | added-line grep `createClient` → exit 1; `AuthCallbackScreen.tsx:8` imports the existing `supabase` singleton; consumer takes `supabase.auth` injected |
| 6 | NO hosted config change | **YES** | no `config.toml` / `netlify.toml` / `supabase/` in `--name-only`; no `.env*` touched (grep exit 1) |
| 7 | NO provider call (Anthropic/xAI/X/fetch) | **YES** | added production-line grep `fetch(\|anthropic\|xai\|api.x.ai\|openai` → exit 1; parser imports nothing, consumer imports only a type |

## Design conformance

- [x] All design file-changes present — 4 new src + 2 modified src + 7 tests + 2 docs = exactly 15 files, matching the design's "File changes" section.
- [x] No undocumented file-changes — `--name-status` matches the design's enumerated set 1:1.
- [x] Data model matches design — the two pure types (`AuthCallbackParsed` 5-variant union, `AuthCallbackOutcome` 4-variant) are implemented as specified; precedence error > tokens > code > token_hash(unsupported) > empty.
- [x] API contracts match design — `parseAuthCallbackUrl` / `isAuthCallbackPath` / `redactAuthCallbackUrl` / `describeAuthCallbackForDiagnostics`; `consumeAuthCallback({client, parsed})`; `validateNewPassword` / `setInvitedUserPassword`; `AuthCallbackScreen({capturedUrl, onDone})`; App.tsx synchronous capture. All signatures match.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — ban-list over every `AUTH_CALLBACK_COPY` value (`authCallbackCopy.test.ts:32-57`), incl. winner/loser/true/false/correct/liar/dishonest/bad faith/verdict/guilty/wrong/stupid.
- [x] Score never blocks posting — N/A; this card never touches the rules engine, `arguments`, `flags`, or any score (auth/session only).
- [x] No service-role in client code — attestation #3.
- [x] No direct insert into public.arguments — attestation #4; no DB write at all.
- [x] No AI calls in production app paths — attestation #7.
- [x] Plain language only (no raw internal codes in UI strings) — `plainLanguageForSetPasswordError` degrades unknown codes to a generic line and never echoes the code (`authCallbackCopy.test.ts:96-99`); rendered-tree leak scan asserts no `needs_password`/`link_invalid`/`access_token` in the DOM (`AuthCallbackScreen.test.tsx:253-265`).
- [x] Epic-specific doctrine — `supabase-edge-contract` (no service-role in client; the only network is the public-anon Supabase auth client; no Edge/RLS/migration) and `cdiscourse-doctrine §10` (email+password only, no OAuth). Both upheld.

## Test coverage

- [x] New public functions have unit tests — parser (4 fns) + consumer + both `authApi` wrappers each have dedicated suites with happy + failure cases; pure modules get full branch coverage incl. a 13-item garbage fuzz (`parseAuthCallbackUrl.test.ts:269-295`) proving the parser never throws.
- [x] User-facing strings have ban-list assertion — `authCallbackCopy.test.ts` (verdict vocab + snake_case + raw-error/code/stack tokens).
- [x] Edge cases from design § "Edge cases" have tests — empty+session→already_session; empty+no-session→link_invalid; error in fragment vs query; otp_expired→recoverable; setSession failure mapping (expired/network/unknown); both code+tokens→tokens win (precedence); malformed→unsupported; double-consume guarded (`ranRef`, consume-once test); config_missing short-circuit; token_hash→unsupported. All present.
- [x] Accessibility assertions present (UI card) — secure + labelled input, submit `accessibilityState.disabled` toggle (`AuthCallbackScreen.test.tsx:93-115`); shared `Button` (role=button, minHeight 48), `TextInputField` (accessibilityLabel, minHeight 44), `ErrorNotice` (`accessibilityRole="alert"`) reused; state conveyed by text + role + state, not color alone.

## Blockers

None.

## Suggestions (non-blocking)

1. `authCallbackRouting.test.ts:70-79` pins the callback branch above `unconfigured`
   and `signed_out` but not explicitly above `pendingInviteIntent` (the QOL-038 invite
   gate). The source IS ordered above it (verified by reading the App.tsx hunk), so this
   is a test-completeness nit only — adding `pendingInviteIntent`'s index to the ordering
   assertion would fully pin the design's "above the invite gate" claim.
2. `expiresIn` is parsed into the `tokens` variant but never consumed (the consumer hands
   the two tokens to `setSession`). Carried for completeness per the design; harmless.
3. `mapConsumeError` buckets a genuinely malformed-token `setSession` failure (message
   containing "invalid") into the `expired` → "link may have expired" copy. This is the
   more recoverable, link-state message and is doctrine-safe (never user-blaming); the
   design explicitly accepts this bucketing. No change needed.
4. The worktree carries one untracked, pre-existing artifact
   `docs/testing-runs/2026-06-13-xai-adversarial-bot-corpus-dry.md` that is NOT in the
   commit range. Operator should not `git add` it as part of this PR.

## Operator next steps

- This is **GATE-C**: stop at PR, **no automerge**. The merge decision is the operator's.
- Push the branch: `git push -u origin feat/AUTH-CALLBACK-CONSUMER-001-invite-callback`
- Open PR: `gh pr create --title "AUTH-CALLBACK-CONSUMER-001: Supabase invite callback + password-set flow" --body-file docs/reviews/AUTH-CALLBACK-CONSUMER-001.md`
- **Deploy steps for this card's code: NONE.** Pure client change — no `db push`, no
  `functions deploy`, no hosted config, no secret, no env var, no new dependency.
- **Still gated downstream (NOT part of this merge)** — the live G1 seed invite smoke
  requires the operator Dashboard preconditions before any send: **G4** deployed origin in
  Supabase Auth → URL Configuration → Redirect URLs (reconcile the `config.toml`
  `dev-cdiscourse.netlify.app` vs `HOSTED_FALLBACK_ORIGIN` `dev.cdiscourse.com`
  discrepancy to whichever host serves the SPA); **G2** custom SMTP; **G3** branded
  `invite.html` template paste (`CDISCOURSE_ALLOW_AUTH_TEMPLATE_UPDATE`); then **G1**
  armed `CDISCOURSE_ALLOW_INVITE_SEND_SMOKE=1` +
  `node scripts/auth/sendInviteSmoke.js --live …`.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree
  cleanup (operator step)").
