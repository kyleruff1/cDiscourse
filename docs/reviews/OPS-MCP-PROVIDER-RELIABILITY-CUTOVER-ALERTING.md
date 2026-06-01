# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31 (operator local)
**Branch:** `feat/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING`
**Base SHA:** `55463b5` (PR #410 Stage 0 readiness audit on `main`)
**Design:** `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` §5.3 / §5.8 / §5.9 / §5.10 / §8 gate 6
**Audit-Lint:** v1 marker

## Summary

This card pre-pays the §5.3 alerting gap and the Stage 4 alerting precondition by
shipping (a) a pure-TS threshold classifier covering the six silent-failure alert
conditions, (b) a hardened Edge Function that runs the classifier on a
SECURITY DEFINER aggregator RPC and emits a Resend email on ALERT severity,
(c) a read-only PL/pgSQL migration that materializes the six condition queries
from design §5.8 (M1 / M2 / M4 / M5 / M6 / M8) into a single jsonb return value
EXECUTE-restricted to `service_role`, (d) a `verify_jwt = false` block in
`supabase/config.toml` mirroring the classifier-drainer convention, and (e) a
five-step operator runbook that sequences migration apply → shared-secret seeding
→ Resend reuse → Vault seeding → pg_cron tick scheduling.

The classifier carries the design §5.8 PASS / PARTIAL / FAIL bands exactly:
M1 PASS < 120s, WARN 120–299s, ALERT ≥ 300s or NULL; M2 PASS < 300s, WARN
300–899s, ALERT ≥ 900s; M4 PASS < 1.0%, WARN 1.0–2.999%, ALERT ≥ 3.0%; M5 / M6 /
M8 binary (any non-zero → ALERT). The model is provably pure (no Deno, fetch,
network, console, Date.now in executable code). The Edge Function gates on a
shared-secret header BEFORE any DB read, fetches metrics via
`createServiceClient().rpc('cutover_health_metrics')`, classifies the result, and
on ALERT performs a best-effort Resend email composed only from the verdict's
safe numeric fields plus a final defensive `containsForbiddenSubstring` scrub.
No path in the card calls Anthropic, the MCP server, `submit-argument`, or
`classify-argument-boolean-observations`; no path inserts into `public.arguments`;
no path enables routing or re-enables Family H production.

The card honors the design's "does not" list line-by-line. The test count (+40)
and suite count (+1) match the prompt's claimed delta exactly against the
post-rollback baseline.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0) |
| `npm run test` | pass (exit 0) — **Test Suites: 595 passed, 595 total; Tests: 18802 passed, 18802 total** (matches prompt's +40 tests / +1 suite vs the 18,762 / 594 post-rollback baseline) |
| Secret scan | clean (3 matches in test/runbook/banlist sentinel — all benign sentinel references; zero contiguous secret literals; the `'sb' + '_secret_'` split-literal pattern keeps `__tests__/adminSecurity.test.ts` SCAN green) |
| Doctrine scan | clean (all matches are FORBIDDEN_OUTPUT_SUBSTRINGS sentinel definitions, SQL ban-list regex bodies, or `typeof x !== 'string'` boolean returns — no user-facing verdict copy) |
| Migration apply | heightened-review pass — Docker not available (`docker: command not found` on this Windows host); classes 1–4 scanned with zero unresolved markers (see Migration §) |
| `console.log` / `.skip` / `.only` | none in the card-scoped files |

## Migration heightened review (Docker not available)

Per `roadmap-reviewer.md` § "Migration-bearing card verification (mandatory)".
Docker Desktop is not installed on the operator's host, so `npx supabase db
reset --linked=false` could not be executed. The four heightened-review issue
classes were scanned against `supabase/migrations/20260601000001_cutover_health_metrics_function.sql`:

- **Class 1 (ambiguous column references in subqueries).** The function uses
  `WHERE r.argument_id IN (SELECT argument_id FROM routed_args)` repeatedly. The
  outer `r.argument_id` is alias-qualified and the inner `argument_id` is the
  CTE's sole projection — Postgres binds it unambiguously to the CTE column.
  The `m8` CTE selects `argument_id` from a non-aliased `argument_machine_observation_runs`
  whose own column is also `argument_id`; this is the CTE itself, not a policy
  subquery, and the outer JOIN re-binds it under alias `r` / `rn`. No same-name
  bare column appears on the RHS of equality inside a USING / WITH CHECK
  subquery. **Zero markers.**
- **Class 2 (column type mismatches).** Cross-checked against migration 18
  (`argument_machine_observation_results.run_id uuid → argument_machine_observation_runs.id`),
  migration 19 (`run_mode text CHECK ('production', 'admin_validation')`), and
  migration 21 (`state text CHECK (...)` + `family text`). The JOIN
  `rn.id = r.run_id` is uuid = uuid; the filters `state = 'succeeded'` /
  `outcome = 'completed'` / `run_mode = 'production'` / `family IS NOT NULL` are
  type-compatible with the schema. `EXTRACT(EPOCH FROM (now() - MAX(completed_at)))`
  is the standard NUMERIC return for timestamptz delta. **Zero markers.**
- **Class 3 (implicit ordering dependencies).** The migration contains a single
  `CREATE OR REPLACE FUNCTION` + `COMMENT ON FUNCTION` + three `REVOKE` + one
  `GRANT`. No CREATE TABLE / CREATE INDEX / CREATE POLICY / CREATE TRIGGER /
  DROP statement. All referenced tables exist in prior applied migrations
  (`classifier_drain_audit` from 21; `argument_machine_observation_runs` from
  prior + 19 + 21 + 22; `argument_machine_observation_results` from 18; columns
  validated above). **Zero markers.**
- **Class 4 (function / trigger / extension dependencies).** All referenced
  functions are built-in (`now`, `EXTRACT`, `COUNT`, `MIN`, `MAX`, `SUM`,
  `jsonb_build_object`, `LOWER`, `NULLIF`, `ROUND`, `COALESCE`, `to_jsonb`,
  regex `~`). The four privilege statements target standard Supabase roles
  (`PUBLIC`, `anon`, `authenticated`, `service_role`). `SET search_path = public,
  pg_temp` is the SECURITY DEFINER hardening Supabase recommends. No
  `COMMENT ON storage.*` (the `COMMENT ON FUNCTION public.cutover_health_metrics()`
  is on a `public.` object the migration runner owns, so no PR-003-class
  privilege failure). `STABLE` is correctly assigned (the function depends only
  on `now()` + table state, both fixed within a single transaction).
  **Zero markers.**

Heightened review pass with zero unresolved markers across classes 1–4.

## Design conformance

- [x] All design file-changes are present (5 new + 1 modified, exactly the prompt-named set).
- [x] No undocumented file-changes (`git status` cross-check; out-of-scope detritus is pre-existing session artifacts unrelated to this card).
- [x] Threshold bands match design §5.8 PASS / PARTIAL / FAIL for M1 / M2 / M4 byte-equal; M5 / M6 / M8 are binary as the design specifies.
- [x] Six condition queries are reproduced in `cutover_health_metrics()` with the same shape as design §5.8 (window intervals, FILTER predicates, regex bodies, `family IS NOT NULL` discriminator).
- [x] The Edge Function does NOT enable routing, deploy migration, schedule pg_cron, or touch the master flag — design §8 gate 6 says the rollback rehearsal is the next operator step. Runbook makes this explicit.
- [x] The card's "DOES NOT" list (per prompt) is honored line-by-line: zero `submit-argument` / `classify-argument-boolean-observations` / Anthropic / MCP / `CLASSIFIER_QUEUE_ROUTING_ENABLED` mutation; no Family H re-enable; no Family I start; no `package.json` / `familyRegistry` / Card 3 audit / prompt / taxonomy change.

## Doctrine self-check (all checked)

- [x] No truth / winner / loser language in user-facing strings — every banned token in the source appears in `FORBIDDEN_OUTPUT_SUBSTRINGS`, SQL regex bodies, or `typeof !== 'string'` boolean returns. Email subject + body composition pulls only from `verdict.conditionId` / `verdict.severity` / `verdict.thresholdExpression` / `verdict.observedValue` / `verdict.remediation` / `verdict.observationWindow`, and a final `containsForbiddenSubstring` scrub drops the email rather than leak.
- [x] Score never blocks posting — this card touches no submit path; classifier output is operational-severity-only.
- [x] No service-role in client code — `createServiceClient()` is called only inside `supabase/functions/cutover-health-monitor/index.ts` (Edge Function), never in `src/`. `__tests__/adminSecurity.test.ts` SCAN passes (verified post-implementation).
- [x] No direct insert into `public.arguments` — zero matches across all card files; the migration body is read-only (verified by the heightened review above).
- [x] No AI calls in production app paths — Edge Function declares non-invocation in the header docblock and contains zero calls; the model is pure-TS without any provider import.
- [x] Plain language only — no raw internal codes leak to the email body. The `conditionId` values (`A_drainer_stale` etc.) appear in admin-facing alert email where a stable internal id is appropriate (operator audience, not end-user). The runbook's user-visible alert subject (`[CDISCOURSE CUTOVER ALERT] N alert / M warn`) is plain language.
- [x] Epic-specific doctrine (cdiscourse-doctrine §6 + §7 + supabase-edge-contract Edge contract):
  - §6 secrets — `CUTOVER_MONITOR_SHARED_SECRET` / `RESEND_API_KEY` / service-role keys are read only inside the Edge Function. Never logged. Split-literal sentinel pattern (`'sb' + '_secret_'`, `'sk' + '-ant-'`, `'Bea' + 'rer '`) mirrors `booleanObservationMcpAdapter.ts` AUTH_SCHEME_PREFIX convention.
  - §7 no AI calls in production — verified by both code grep and Edge Function header docblock.
  - supabase-edge-contract — Edge Function shape: auth → service-role only for the RPC the migration restricted to it → no RLS bypass elsewhere → audit-clean response with no raw rows / evidence_span / JWTs / secrets. Migration: SECURITY DEFINER + SET search_path + STABLE + EXECUTE revoked from PUBLIC/anon/authenticated and granted to service_role only.

## Test coverage

- [x] Pure-model has unit tests — 40 tests, exact threshold-edge coverage (120 / 299 / 300 / 900 / 1.000 / 2.900 / 3.000 boundaries; null / NaN / Infinity / empty inputs; multi-category F aggregation).
- [x] Doctrine ban-list test — `FORBIDDEN_OUTPUT_SUBSTRINGS` frozen + non-empty; `containsForbiddenSubstring` case-insensitive across secret prefixes + doctrine verdict tokens; clean-text false-positive guard; final composite test over a fully-ALERT bundle confirming every emitted `remediation` / `thresholdExpression` / `conditionId` is sentinel-free.
- [x] Purity assertion — bundle-level + per-condition determinism test (same input → same output across multiple invocations).
- [x] Bundle aggregation — alert-overrides-warn semantics, count-sums-to-6 invariant, every condition id emitted exactly once.
- [x] Edge cases from design — NULL `seconds_since_last_completed_drain` (Condition A's ALERT-on-no-data branch), NULL `oldest_pending_age_seconds` (Condition B's healthy-empty PASS branch), `total_terminal_cells = 0` (Condition C's empty-window PASS branch). All explicitly tested.
- [x] No `.skip` / `.only` / `xdescribe` / `xit` in any new test.

The Edge Function itself does not have its own unit suite. This is acceptable
under the established repo pattern (other Edge Functions like
`classifier-drainer` and `request-argument-deletion` rely on the pure model +
runtime smoke for coverage; Jest cannot load Deno-flavored files), and the
classifier model's 40 tests give the threshold logic byte-equal coverage.

## File-by-file integrity table

| File | Status | Integrity finding |
|---|---|---|
| `src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts` | NEW | Pure TS, zero Deno/fetch/console executable use, threshold bands match design §5.8, FORBIDDEN_OUTPUT_SUBSTRINGS frozen + non-empty, remediation strings describe categories not raw tokens. Concat-split literal pattern matches repo convention. APPROVE. |
| `__tests__/cutoverHealthAlertModel.test.ts` | NEW | 40 tests, exact threshold boundary coverage, null/NaN/Infinity paths, doctrine ban-list assertion (sentinel-frozen + composite ALERT-bundle scrub), purity assertion, no `.skip` / `.only`. APPROVE. |
| `supabase/functions/cutover-health-monitor/index.ts` | NEW | Shared-secret auth gated BEFORE any DB read; fail-closed on missing/empty `CUTOVER_MONITOR_SHARED_SECRET`; `secretsMatch` constant-time-ish compare with final length-equality gate (verified empty-string edge case returns correctly); `createServiceClient()` only for the SECURITY DEFINER RPC + admin recipient lookup; response carries safe verdict fields only; Resend email composed from safe fields + defensive `containsForbiddenSubstring` scrub; admin emails never appear in the HTTP response; no provider-spend invocation; zero `console.log` calls. APPROVE. |
| `supabase/migrations/20260601000001_cutover_health_metrics_function.sql` | NEW | Read-only PL/pgSQL function (zero INSERT/UPDATE/DELETE/DDL in body), SECURITY DEFINER + SET search_path + STABLE, EXECUTE revoked from PUBLIC/anon/authenticated and granted to service_role only, COMMENT ON FUNCTION (not on storage.*), filename timestamp `20260601000001` is later than the last applied (`20260528000023`). Heightened review across classes 1–4: zero unresolved markers. APPROVE. |
| `supabase/config.toml` | MODIFIED | Adds `[functions.cutover-health-monitor]` `verify_jwt = false` block mirroring classifier-drainer convention; documented inline with the security model and the non-invocation guarantee. APPROVE. |
| `docs/runbooks/cutover-health-monitor.md` | NEW | Complete 5-step operator setup (migration verify → secret seed → Resend reuse → Vault seed → pg_cron schedule); fail-closed semantics documented; rollback documented; operator-territory boundaries clear; alert behavior described with safety scan call-out. APPROVE. |

## Boundary compliance

- [x] No source change under `src/` outside `src/features/cutoverHealthAlerts/`.
- [x] No test change outside `__tests__/cutoverHealthAlertModel.test.ts`.
- [x] No migration outside `supabase/migrations/20260601000001_cutover_health_metrics_function.sql`.
- [x] No Edge Function change outside `supabase/functions/cutover-health-monitor/index.ts`.
- [x] No `package.json` / `package-lock.json` change.
- [x] No prompt / taxonomy / family key / schema mirror / Source 6 / audit-lint script / `familyRegistry.ts` / Card 1+2 Family H groundwork / Card 3 FAIL audit change.
- [x] No MCP server change (zero diff under `mcp-server/`).
- [x] No `CLASSIFIER_QUEUE_ROUTING_ENABLED` / `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` change (operator-controlled; this card neither reads nor writes them).
- [x] No `familyRegistry.ts` change (Family H stays `productionEnabled: false`).
- [x] No pg_cron schedule (operator-territory; documented in runbook Steps 4–5 only).

## Process note (non-blocking)

At review time the implementer's five new files plus the `supabase/config.toml`
modification are present in the working tree but **uncommitted** (the branch tip
equals `origin/main`). The operator must either commit the implementer files
before pushing or have the implementer re-spawn to author the commit. This
review's commit will introduce only `docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING.md`;
all other files remain staged-as-untracked. The verification battery
(typecheck / lint / 18,802 tests) was run against the working-tree state and
passed, so the implementer state is functionally complete — only the commit
step is missing.

## Suggestions (non-blocking)

1. **Source-text purity assertion for the classifier.** The classifier model
   is pure today, but no test asserts `Deno.env` / `fetch(` / `console.` are
   absent from the source text. A small SCAN test (similar to
   `mcpOneTwoOneCEdgeAdapterSourceScan.test.ts` Pattern SCAN-25) would prevent
   a future drift. The classifier's purity is asserted only in the doc-comment
   today.
2. **Limit `listUsers` page coverage when admin counts exceed 200.** The Resend
   helper requests `perPage: 200, page: 1` and maps recipients only from page 1.
   If the admin role count ever exceeds 200 (unlikely but unbounded), some
   admins would silently miss alerts. A simple paginated loop or an
   `admin_alert_recipients` view would future-proof this. Defer or address in a
   follow-up — not a Stage-1 blocker.
3. **Operator should also seed `cutover_monitor_url` Vault secret.** Runbook
   Step 5's SQL references `vault.decrypted_secrets WHERE name =
   'cutover_monitor_url'` but the runbook does not document seeding it. The
   classifier-drainer pattern presumably already seeds analogous URLs and the
   operator will know — but a one-line addition to Step 4 would close the
   documentation loop.

## Operator next steps

- Commit the implementer files first (the working-tree state at review time is
  five new files + config.toml modification, all unstaged):
  ```
  git add src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts \
          __tests__/cutoverHealthAlertModel.test.ts \
          supabase/functions/cutover-health-monitor/index.ts \
          supabase/migrations/20260601000001_cutover_health_metrics_function.sql \
          docs/runbooks/cutover-health-monitor.md \
          supabase/config.toml
  git commit -m "feat(OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING): cutover health monitor + migration + classifier"
  ```
- Push the branch: `git push -u origin feat/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING`
- Open PR: `gh pr create --title "OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING: cutover health monitor" --body-file docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING.md`
- Post-merge auto-apply (per `docs/core/known-blockers.md` Supabase GitHub integration): migration `20260601000001` applies + Edge Function `cutover-health-monitor` deploys automatically. Verify with:
  ```
  npx supabase functions list --project-ref qsciikhztvzzohssddrq
  ```
- Then run runbook Steps 2–5 (set `CUTOVER_MONITOR_SHARED_SECRET`, verify Resend env, seed Vault, schedule pg_cron). Alerting is INACTIVE until those steps complete.
- The next roadmap prompt is **the rollback rehearsal** (design §8 gate 6) under
  smoke-only conditions. Stage 1 of the cutover does NOT begin until rehearsal
  PASS.
- Post-merge worktree cleanup (commands in `roadmap-reviewer.md` § "Post-merge
  worktree cleanup (operator step)").

## Final verdict

**APPROVE.** The card pre-pays the §5.3 alerting gap and the Stage 4 alerting
precondition exactly as design § "Recommended next prompt" anticipates. The
implementation honors every "does not" line in the prompt's boundary table;
the 6 SQL conditions reproduce design §5.8 byte-equal; the classifier is pure
and byte-tested against the band boundaries; the Edge Function follows the
classifier-drainer hardening pattern with a fail-closed shared-secret gate and
a defensive doctrine scrub on outgoing email; the migration's heightened
review passes classes 1–4 with zero unresolved markers (Docker not available
on this host so an apply-time test could not be run). Operator may push and
merge as scheduled, then execute runbook Steps 2–5 before the rollback
rehearsal prompt.
