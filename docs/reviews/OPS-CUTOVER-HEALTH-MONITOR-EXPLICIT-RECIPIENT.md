# OPS-CUTOVER-HEALTH-MONITOR-EXPLICIT-RECIPIENT — Review

**Audit-Lint: v1**

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-01
**Branch:** `feat/OPS-CUTOVER-HEALTH-MONITOR-EXPLICIT-RECIPIENT`
**Base:** `main @ 84809b0`
**Files in scope (3):**
- `supabase/functions/cutover-health-monitor/index.ts` (+130 / -36)
- `docs/runbooks/cutover-health-monitor.md` (+30 / -2)
- `__tests__/cutoverHealthMonitorSourceScan.test.ts` (NEW, 23 tests / 1 suite)

## Summary

The patch replaces PR #411's opaque `emailStatus: 'not_configured'` (which collapsed three separate configuration failure modes into one return value, and additionally collapsed `failed_recipient_lookup` into the `catch { return 'failed_sanitized' }` block) with a granular 8-value `EmailStatus` type union AND an explicit-recipient code path keyed off the new `ADMIN_NOTIFICATION_TO` env var. The explicit path runs FIRST; the legacy admin-profile + `auth.users.email` fallback runs ONLY when `ADMIN_NOTIFICATION_TO` parses to zero entries. The runbook documents the new env, the granular `emailStatus` table, and the operator-discipline rule that recipient values must never be committed or pasted. No recipient value is ever returned in the response, logged, or echoed in any error envelope. No provider-spend path is introduced; the function's only outbound HTTP target remains `https://api.resend.com/emails`. No routing-flag runtime read; no migration; no new RPC. Verification battery (typecheck / lint / 596-suite jest) is green at 18,825 / 596 (baseline 18,802 / 595; +23 tests / +1 suite). Boundary held: exactly 3 files touched, all on the allowlist from the operator prompt.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0, `--max-warnings 0`) |
| `npm run test --silent` | pass — 18,825 / 596 (baseline 18,802 / 595; +23 / +1) |
| New `cutoverHealthMonitorSourceScan` suite in isolation | 23 / 23 pass (0.884 s) |
| Secret-shape scan (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_`, `sk-ant-`, `eyJ…` JWT-shape) on touched files | clean |
| Runbook `Bearer ` literals | pre-existing PR #411 placeholders (lines 27, 122, 136, 181, 185) — no new occurrences |
| Doctrine/verdict-token scan (`winner|loser|liar|dishonest|bad faith|manipulative|extremist|propagandist`) on touched files | clean |
| Mutation scan (`cron.job UPDATE`, `cron.schedule`, `cron.unschedule`, `SET CLASSIFIER_QUEUE_ROUTING_*`) on touched files | clean |
| Provider-endpoint allowlist (only `https://api.resend.com/emails`) | confirmed at index.ts:270; SCAN-3 test enforces |
| Routing-flag runtime READ (`Deno.env.get('CLASSIFIER_QUEUE_ROUTING_*')`) | none; the string appears only in the email-body remediation line (index.ts:256), which is operator-instruction text and not a runtime knob read |
| Boundary (3 allowed files only — no `familyRegistry`, no migrations, no MCP server, no source mirror, no taxonomy, no Source 6) | confirmed via `git status --short` |

## Per-section integrity table (against operator prompt review scope 1–10)

| # | Review-scope item | Evidence (file:line or test name) | Verdict |
|---|---|---|---|
| 1 | EmailStatus type union — 8 values, no `'not_configured'` literal, every return inside `maybeSendAlertEmail` emits one of the 8 | Type declared `index.ts:149–157` (8 union members). Tests `EmailStatus granularity (8 values)` → 3 assertions: (a) every required literal present in source; (b) `match(/return\s+['"]not_configured['"]/g)` is `null`; (c) every `return '<literal>'` inside `maybeSendAlertEmail` is in the allowlist | PASS |
| 2 | `parseExplicitRecipients` semantics — `split(/[,;]/)`, trim, drop empty, returns `[]` on null/undef/empty/whitespace | Function at `index.ts:165–171` — `if (typeof raw !== 'string') return [];` then `.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0)`. Tests assert the literal `split(/[,;]/)`, the `.map(s => s.trim())` shape, the `.filter(s => s.length > 0)` shape. Whitespace-only input falls out via the `filter` (any trimmed-to-empty entry is dropped before the array escapes) | PASS |
| 3 | Recipient-resolution order — explicit FIRST, fallback ONLY when explicit returns `[]` | `index.ts:193` reads `ADMIN_NOTIFICATION_TO` into `explicitRecipients`. `index.ts:196` — `if (explicitRecipients.length > 0) { recipients = explicitRecipients; }`. `index.ts:198–228` is the `else` branch (the fallback service-role profile + auth.users path). The fallback is structurally unreachable when `ADMIN_NOTIFICATION_TO` has any non-empty entry | PASS |
| 4 | Branch mapping per operator prompt | `index.ts:185` missing `RESEND_API_KEY` → `'not_configured_missing_resend'` ✓ · `index.ts:188` missing `ADMIN_NOTIFICATION_FROM` → `'not_configured_missing_from'` ✓ · `index.ts:210` profile-list empty → `'not_configured_no_recipients'` ✓ · `index.ts:226` post-mapping recipients empty (defense-in-depth — admin profiles exist but none had a usable email) → `'not_configured_no_recipients'` ✓ · `index.ts:217` + `index.ts:223` (try/catch) auth.admin error or thrown lookup → `'failed_recipient_lookup'` ✓ · `index.ts:266` body scrub trips → `'failed_sanitized'` ✓ · `index.ts:285` Resend non-2xx → `'failed_resend'` ✓ · `index.ts:289` fetch throws → `'failed_resend'` ✓ | PASS |
| 5 | No recipient leak in response payload, subject line, or anywhere outside the `to:` field of the outbound Resend POST | `index.ts:129–136` — `ok({ overallSeverity, alertCount, warnCount, passCount, conditionVerdicts, emailStatus })` — zero recipient-shaped keys. Subject line constructed at `index.ts:231` is templated from `verdict.alertCount` / `verdict.warnCount` only. Test `does NOT log or return recipient values` walks every `ok({...})` call and asserts none of the keys match `/recipients?:/i`, `/\bto\s*:/`, `/admin_?emails?:/i`. The Resend POST body at `index.ts:276–281` is the only place `to: recipients` appears, and that body is fetched outbound (not logged, not returned) | PASS |
| 6 | Preserved invariants: fail-closed auth gate, Resend response drain without logging, AUTH_SCHEME_PREFIX split-literal | Auth gate at `index.ts:91–99`: missing `CUTOVER_MONITOR_SHARED_SECRET` → `unauthorized()` before any DB read. Test `fail-closed auth gate` asserts the early-return pattern via regex. Resend response drain at `index.ts:283–285`: `try { await res.text(); } catch { /* swallow */ }` — result never assigned, never passed to a logger; test confirms there is no `console.{log,warn,error}(body|text)` in the resend block. `AUTH_SCHEME_PREFIX = 'Bea' + 'rer '` at `index.ts:70`; test confirms the split-literal and that the comment-stripped source contains no contiguous `'Bearer '` literal | PASS |
| 7 | No provider-spend path added — no classifier-drainer, MCP, Anthropic, xAI imports; only outbound HTTP is `https://api.resend.com/emails`; only RPC is `cutover_health_metrics` | Test `does NOT import any MCP / Anthropic / classifier-drainer module` covers `classifyArgumentCore`, `booleanObservationMcpAdapter`, `classifierDrainer`, `classifierQueueRouting`, `autoTriggerDispatcher`, `anthropic` — all `expect(SOURCE).not.toMatch`. Test `RPC call is the read-only cutover_health_metrics aggregator` extracts every `.rpc('...')` and asserts exactly one call to `'cutover_health_metrics'`. Test `does NOT call any provider endpoint other than api.resend.com` extracts every `https://…` literal and asserts each equals `https://api.resend.com` | PASS |
| 8 | No routing-flag mutation, no routing-flag runtime READ (remediation strings naming the env var are fine) | Grep of touched index.ts for `Deno.env.get('CLASSIFIER_QUEUE_ROUTING_*')` — zero hits. The string `CLASSIFIER_QUEUE_ROUTING_ENABLED` appears once at `index.ts:256` inside the email-body `lines` array as the literal operator-instruction `'Recommended immediate action on ALERT: roll back routing by unsetting CLASSIFIER_QUEUE_ROUTING_ENABLED.'` — this is plain text emitted to the operator's mailbox, not a runtime read. Test `forbidden pattern` regexes for `Deno.env.get(...'CLASSIFIER_QUEUE_ROUTING_ENABLED'...)` and `..._PERCENTAGE` are both negative on the comment-stripped source | PASS |
| 9 | Runbook documents granular `emailStatus` table AND operator-discipline note that recipient values must never be committed/pasted | Runbook §"Step 3 — Ensure Resend env is configured" gains the `ADMIN_NOTIFICATION_TO` bullet documenting comma-OR-semicolon split, trim, drop-empty semantics. The "Recipient-value handling — operator discipline (mandatory)" subsection states recipients MUST NEVER be committed/pasted/logged and points to the Supabase Dashboard / `supabase secrets set` workflows. The granular `emailStatus` table enumerates all 8 values with meaning + operator action. The closing sentence makes the design intent explicit: "each failure mode is now distinguishable from the operator's side without exposing recipient values" | PASS |
| 10 | Boundary — only the 3 allowed files, no `familyRegistry`, no migrations, no MCP server, no source mirror, no `package.json`, no taxonomy, no Source 6 | `git diff main..HEAD --stat` would show only the 2 modified tracked files (the test file is untracked but is the new file the prompt describes). `git status --short` confirms `M docs/runbooks/cutover-health-monitor.md`, `M supabase/functions/cutover-health-monitor/index.ts`, and `?? __tests__/cutoverHealthMonitorSourceScan.test.ts`. No other in-scope files modified. The unrelated untracked diagnostic files in working tree (`out/`, `*.tmp` etc.) pre-date this card and are not part of the patch | PASS |

## Doctrine self-check

- [x] No truth/winner/loser language in any patch artefact (3 touched files clean per scan)
- [x] No service-role surfaced to client — the only service-role usage (`createServiceClient()` for the admin fallback) lives inside `supabase/functions/`
- [x] No direct insert into `public.arguments` (this function is alert-only; no DB writes at all)
- [x] No AI calls in production app paths — Resend is alerting-only; no Anthropic/xAI/MCP/classifier-drainer reachable from this surface
- [x] Plain language in operator-facing copy — the granular status names are English ops terms, not internal codes
- [x] No secret-shape literals introduced anywhere in the patch
- [x] Fail-closed auth gate preserved (missing `CUTOVER_MONITOR_SHARED_SECRET` → 401 before any work)
- [x] Recipient values never logged, never returned, never echoed (verified by SCAN-5 test walking `ok({...})` calls + explicit response-shape inspection)
- [x] Resend response body drained but never logged
- [x] AUTH_SCHEME_PREFIX split-literal convention preserved

## Test-discipline self-check

- [x] New behavior has matching new tests (`cutoverHealthMonitorSourceScan.test.ts`, 23 cases)
- [x] Tests are structural (source-scan against the Deno file), not provider-network — appropriate because the Edge Function uses `Deno.env` / `Deno.serve` which Jest cannot module-load
- [x] Tests cover all 8 EmailStatus values explicitly (`REQUIRED_EMAIL_STATUS_VALUES` array drives parameterized assertions)
- [x] Tests cover absence of the previous opaque return literal (`return 'not_configured'`)
- [x] Tests cover parser semantics: split regex, trim, filter
- [x] Tests cover boundary discipline: no recipient leak via `ok(...)`, no provider endpoint other than `api.resend.com`, no MCP/Anthropic/classifier-drainer imports
- [x] Tests cover preserved invariants: fail-closed auth gate, Resend body drain without logging, split-literal AUTH_SCHEME_PREFIX
- [x] Test suite runs in 0.884 s — pure source-scan, no I/O, no network

## Edge-case spot-checks

- **Empty admin profile list with `ADMIN_NOTIFICATION_TO` unset:** the operator prompt's case — admin profiles exist in DB but the fallback returns zero usable emails. The code now returns `'not_configured_no_recipients'` at `index.ts:226` after the profile/auth lookup if `recipients.length === 0`. This is the case the operator originally hit when PR #411 returned `'not_configured'` despite `admin_profiles=4` / `admin_auth_user_matches=4`. The new return value tells the operator exactly which knob to set (`ADMIN_NOTIFICATION_TO`).
- **Whitespace-only `ADMIN_NOTIFICATION_TO`:** `parseExplicitRecipients(' , ; ')` → split yields `[' ', ' ', ' ']` → `.map(trim)` yields `['', '', '']` → `.filter(s.length>0)` yields `[]`. The code then falls through to the admin-profile branch. Verified by the parser semantics tests.
- **Mixed separators:** `'a@ex.com, b@ex.com; c@ex.com'` → `['a@ex.com', 'b@ex.com', 'c@ex.com']`. Single regex `/[,;]/` handles both.
- **Resend 2xx but Resend response body contains a recipient echo:** the response body is drained via `await res.text()` inside a try/catch with no assignment, so even a malicious Resend response body cannot leak via this code path.
- **Body-scrub trigger:** if a future remediation string introduces a forbidden substring, `containsForbiddenSubstring(bodyText)` returns `true` at `index.ts:265` and the email is dropped, returning `'failed_sanitized'`. The Resend POST never executes in that case, so no recipient ever crosses the network boundary either.

## Blockers

None.

## Suggestions (non-blocking)

1. **Future hardening — recipient-count cardinality cap.** The current code accepts any number of recipients from `ADMIN_NOTIFICATION_TO`. A misconfiguration (e.g. a 100-address paste) would deliver alerts to 100 mailboxes. Consider capping at 20 with a new return value `'failed_too_many_recipients'` in a follow-up card. Non-blocking for this patch because the operator-discipline note in the runbook already steers toward an ops-distribution address.
2. **Future hardening — email-shape validation on the explicit list.** `parseExplicitRecipients` does NOT validate that each entry is RFC-5321-shape (`a@b`). An operator misconfiguration could pass an obvious-typo address to Resend, which would bounce. Returning `'failed_recipient_lookup'` on a fully-bogus list would help diagnostics. Non-blocking because Resend's bounce report is itself an operator-visible signal.
3. **Future telemetry — per-status counters in `cutover_health_metrics`.** Tracking which `emailStatus` values fired most often over time would let the operator notice silent regressions (e.g. a rotating `RESEND_API_KEY` would show as a `'failed_resend'` spike). Out of scope for this card.

## Operator next steps

1. Push the branch: `git add supabase/functions/cutover-health-monitor/index.ts docs/runbooks/cutover-health-monitor.md __tests__/cutoverHealthMonitorSourceScan.test.ts && git commit -m "feat(OPS-CUTOVER-HEALTH-MONITOR-EXPLICIT-RECIPIENT): explicit recipient env + granular emailStatus" && git push -u origin feat/OPS-CUTOVER-HEALTH-MONITOR-EXPLICIT-RECIPIENT`
2. Open PR: `gh pr create --title "OPS-CUTOVER-HEALTH-MONITOR-EXPLICIT-RECIPIENT: ADMIN_NOTIFICATION_TO + 8-value emailStatus" --body-file docs/reviews/OPS-CUTOVER-HEALTH-MONITOR-EXPLICIT-RECIPIENT.md`
3. After merge, the Supabase GitHub integration auto-redeploys `cutover-health-monitor`. Operator MUST then:
   - `npx supabase secrets set ADMIN_NOTIFICATION_TO=<ops-distribution-address>` (do NOT paste in chat / commit / shell-history-persistent)
   - Re-invoke the function manually with the existing CUTOVER_MONITOR_SHARED_SECRET; confirm response carries `emailStatus: 'sent'` (or, if no current alert, `'not_required'`)
   - If `emailStatus` is `'not_configured_no_recipients'` or any `'failed_*'` value, consult the runbook §"Step 3" table for the precise remediation.
4. Post-merge worktree cleanup per `roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)".

## Final verdict

**APPROVE — ship.** The patch precisely implements the operator prompt's review scope (8 granular email statuses, explicit-first recipient resolution with bracketed `[,;]` split, fallback preserved with discrete error mapping, no recipient leak, no provider-spend path, no routing-flag mutation, runbook + tests aligned). Boundary held (3 files). Verification battery green at 18,825 / 596 (+23 / +1). No blockers, no doctrine concerns.
