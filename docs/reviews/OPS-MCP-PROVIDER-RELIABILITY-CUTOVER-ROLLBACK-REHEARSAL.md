# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL — Review

Audit-Lint: v1

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31 / 2026-06-01 UTC
**Branch:** feat/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL
**Base SHA:** `e03dbaa` (origin/main, PR #411 alerting card merge)
**Predecessors merged:** PR #408 (`722f17b` H rollback) / PR #409 (`7560826` cutover design) / PR #410 (`55463b5` Stage 0 readiness) / PR #411 (`e03dbaa` alerting wired)
**Design:** `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL.md`

## Summary

This card ships a docs-only, executable runbook for the rollback rehearsal that sits at cutover design §8 gate 6 — the gate between alerting wired (PR #411) and Stage 1 routing. The 8 artifacts (design, audit skeleton, harness, 4 SQL queries, read-only assertion) cleanly separate operator/CC work, hold the constitutional invariant that AI/MCP classifiers never gate submission, and stay within the boundary contract: zero `src/`, `app/`, `mcp-server/`, `supabase/functions/`, `scripts/`, `supabase/migrations/`, `package.json`, or `familyRegistry.ts` diff against `origin/main`. The percentage 0 vs 100 reconciliation from the parent design §8 gate 6 is correctly flagged with the safer default (= 0 + smoke-tag override path); production traffic is provably untouched. The harness inherits the Card 3 boundary pattern (anon-key + `signInBot`; no service-role; no Anthropic/xAI/X direct call; no routing-env mutation; safe-metadata-only stdout). The 4 queries are verbatim from their cited source-of-truth sections (cutover §5.8 lines 268-322 for M1/M2/M3; cutover-health-monitor runbook lines 135-151 for the watchdog Layer 1). The audit skeleton's `Audit-Lint: v1` marker is recognized by `scripts/ops/audit-lint.mjs` (verdict `<none>` / findings 0 / exit 0; PENDING is correctly NOT a fabricated verdict). The read-only assertion correctly detects both planted UPDATE keywords and planted `evidence_span` substrings (verified by reviewer's tamper test). One non-blocking cosmetic finding (typo `failure_invocations` in a comment of `watchdog-cron-freshness.sql`); the executable SQL itself is verbatim and correct.

## Verification

| Check | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0) |
| test | not re-run (this card adds zero source/test files; pre-existing baseline holds) |
| secret scan (harness + queries + design + audit) | clean (only negative assertions in doctrine-checklist tables; no secret-shaped values) |
| doctrine scan (truth labels in user-facing strings) | clean (`true`/`false` only as boolean env values; no winner/loser/liar in any user-facing string) |
| read-only assertion against clean pack | exit 0 (verified by reviewer) |
| read-only assertion tamper test — UPDATE planted | exit 1 (verified by reviewer; planted `UPDATE cron.job SET active = false ...` detected by `\bUPDATE\b` regex) |
| read-only assertion tamper test — `evidence_span` planted | exit 1 (verified by reviewer; planted `SELECT id, evidence_span FROM ...` detected by substring scan) |
| audit-lint v1 against skeleton | exit 0 (`title: OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL — audit skeleton (2026-06-01)` / `audit-type: ops` / `verdict: <none>` / `findings: 0 (PASS)` — PENDING verdict correctly suppressed) |
| **Migration apply** | **n/a — heightened-review pass; zero migrations in this card (`git diff origin/main..HEAD -- supabase/migrations/` empty). Mandatory check satisfied.** |

## Mandatory migration check

`git diff origin/main..HEAD -- supabase/migrations/` returns empty. This card adds NO migration. The four heightened-review issue classes (ambiguous column refs, type mismatches, ordering deps, function/trigger/extension deps) are not applicable because there is no SQL DDL in this card; the four `.sql` files are pure read-only `SELECT` queries against existing tables (`classifier_drain_audit`, `argument_machine_observation_runs`, `cron.job`, `cron.job_run_details`). The mandatory migration check is satisfied.

## Design conformance

- [x] Per-step operator/CC split is correct + complete: Preflight + (a) + (b) + (c) + (d) + (e) + (f) + Close audit — 8 rows in design §3 table.
- [x] Each step states (i) WHO, (ii) exact command/SQL, (iii) PASS/PARTIAL/FAIL threshold, (iv) abort/rollback action — all 4 columns present in §3 table.
- [x] Percentage 0 vs 100 reconciliation explicit in §2 with recommended default `0` and the cutover design §8 gate 6 source cited (lines 577-584 of `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md`).
- [x] §0 "Cannot proceed preconditions" gate lists 10 preconditions including (#4) Layer 3 Resend pre-flight; (#3) watchdog cron freshness via Q-W1; (#5) production family roster A–G; (#6) routing master flag currently OFF.
- [x] Source citations are precise: M1/M2/M3 → cutover §5.8 lines 268-322; M6 → cutover §5.8 lines 364-377; Q-W1 → cutover-health-monitor runbook lines 135-151.
- [x] §6 doctrine self-check walks all 10 cdiscourse-doctrine rules + edge-contract conventions; no doctrine conflict found.
- [x] §7 risks section names 9 specific risks including watchdog silent-death, Resend pre-flight unverifiability, env propagation lag, cron-disable-must-be-reversed.
- [x] §10 boundary statement explicit on what CC does NOT do in this phase (zero provider-spend, zero writes) AND in the drill phase (CC stays read-only).

## File-by-file integrity

| # | Path | Status | Evidence |
|---|---|---|---|
| 1 | `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL.md` | PASS | 392 lines (matches designer report). Sections 0-10 + Appendix A/B present. Constitutional invariant repeated in line 11. Per-step table in §3 with 8 rows; ALL rows include all 4 columns (Who/Action/PASS-PARTIAL-FAIL/Abort). |
| 2 | `.claude-tmp/rollback-rehearsal-submit.cjs` | PASS | 192 lines. Header (lines 5-10) explicit "OPERATOR-RUN ONLY. Claude Code does NOT execute this script." Uses `createBotClient(supabaseUrl, supabasePublishableKey)` (anon-key path, line 102); `signInBot(client, email, password)` (line 103). Zero `service_role` references; zero direct `public.arguments` insert (insert is into `public.debates` + `public.debate_participants` only, then `submit-argument` Edge call via `invokeSubmitArgument`). Smoke tag literal `[arch-001-queue-smoke]` (line 61) matches `CLASSIFIER_QUEUE_SMOKE_TAG` in `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts:51`. Zero reads/writes of `CLASSIFIER_QUEUE_ROUTING_ENABLED` or `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`. Output allowlist (`emit` fn, lines 74-84) restricts stdout to safe metadata: `alias / idx / submitMs / argId / debateId / status / errorCode / detail / posted / failed / message`. No JWT, no body text, no provider payload in any output path. |
| 3 | `.claude-tmp/rehearsal-queries/m1-drainer-freshness.sql` | PASS | 14 lines. Verbatim against cutover §5.8 lines 268-274 (SELECT body + WHERE clause). PASS/PARTIAL/FAIL header comments preserved. Pure SELECT. Zero `evidence_span`. |
| 4 | `.claude-tmp/rehearsal-queries/m2-queue-depth.sql` | PASS | 17 lines. Verbatim against cutover §5.8 lines 282-291. PASS/PARTIAL/FAIL header comments preserved. Pure SELECT. Zero `evidence_span`. |
| 5 | `.claude-tmp/rehearsal-queries/m3-cell-completeness.sql` | PASS | 27 lines. Verbatim against cutover §5.8 lines 299-318 (CTE + SELECT). PASS/PARTIAL/FAIL header comments preserved. Pure SELECT. Zero `evidence_span`. |
| 6 | `.claude-tmp/rehearsal-queries/watchdog-cron-freshness.sql` | PASS (with non-blocking comment typo) | 18 lines. Verbatim against `docs/runbooks/cutover-health-monitor.md` lines 136-145. PASS/WARN/FAIL header comments preserved. Pure SELECT. Zero `evidence_span`. **Non-blocking suggestion:** line 5 comment says `failure_invocations = 0` (the column is actually `failed_invocations`; line 12 declares it correctly + line 8 uses the correct name in the FAIL comment). The executable SQL is unaffected; only the line-5 PASS comment is cosmetically misspelled. |
| 7 | `.claude-tmp/rehearsal-queries/assert-read-only.cjs` | PASS | 79 lines. Forbidden keyword list (lines 20-23): INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE/MERGE/COPY. Forbidden substring (line 24): `evidence_span`. SQL-comment stripper (lines 26-31) handles both `--` line comments and `/* */` block comments so doctrine-safety text in headers is ignored. **Reviewer-verified behavior:** (i) clean pack → exit 0 with `event: clean` per file; (ii) planted `UPDATE cron.job SET active = false ...` in a probe file → exit 1 with `event: violation, kind: write_keyword, token: UPDATE`; (iii) planted `SELECT id, evidence_span FROM ...` in a probe file → exit 1 with `event: violation, kind: forbidden_substring, token: evidence_span`; (iv) probe deleted → exit 0 restored. |
| 8 | `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL-2026-06-01.md` | PASS | 258 lines. `Audit-Lint: v1` marker (line 3) + `Audit-type: ops` (line 4) at top. Format mirrors `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` (Date / Operator / Card / Predecessors / Scope / Final verdict / per-phase tables). `Final verdict: PENDING` (line 19) — no fabricated PASS. One phase per drill step (Phase 0 Preflight + (a) + (b) + (c) + (d) + (e) + (f) + Final verdict). Each phase has an evidence table with `_<fill>_` placeholders and explicit PASS/PARTIAL/FAIL verdict line. Gate criterion (lines 21-25) states `fault < 5 min AND rollback < 5 min` AND `zero production traffic affected`. Provenance/boundary section (lines 215-222) states `CC provider-spend invocations: 0 / CC writes: 0`. `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL-2026-06-01.md` exits 0 (verified by reviewer: `verdict: <none> / findings: 0 (PASS)`). |

## Boundary compliance

| Check | Path | Result |
|---|---|---|
| Migration | `supabase/migrations/` | empty diff vs `origin/main` |
| Production source | `src/` | empty diff vs `origin/main` |
| App | `app/` | empty diff vs `origin/main` |
| MCP server | `mcp-server/` | empty diff vs `origin/main` |
| Edge Functions | `supabase/functions/` | empty diff vs `origin/main` |
| Scripts | `scripts/` | empty diff vs `origin/main` |
| Package manifests | `package.json`, `package-lock.json` | empty diff vs `origin/main` |
| Family registry | `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | empty diff vs `origin/main` |

CC performed: zero provider-spend (no `submit-argument`, no `classify-argument-boolean-observations`, no MCP, no Anthropic/xAI/X). CC writes: zero production tables; zero env mutation; zero `cron.job` mutation. The only writes CC made were: the design doc, the audit skeleton, the 4 SQL files + assertion script under `.claude-tmp/` (gitignored), and (next) this review doc. All within the docs-only + gitignored-tooling scope of this card.

## Doctrine self-check (all PASS)

- [x] No truth/winner/loser language in user-facing strings — only `true`/`false` as boolean env values for the routing master flag; doctrine truth-label scan clean.
- [x] Score never blocks posting — drill exercises queue path; the deterministic rules engine remains the sole acceptance gate; constitutional invariant repeated in design line 11.
- [x] No service-role in client code — harness uses `supabasePublishableKey` (anon-key) + `signInBot` (password); zero `SERVICE_ROLE` references anywhere in card artifacts.
- [x] No direct insert into `public.arguments` — harness inserts to `public.debates` + `public.debate_participants` then routes the argument through `submit-argument` Edge Function via `invokeSubmitArgument` → `sb.functions.invoke('submit-argument', body)`.
- [x] No AI calls in production app paths — the harness does not call any AI provider directly; the ≈ 7 Anthropic calls happen downstream inside the `classifier-drainer` Edge → MCP server when the drainer ticks; that is the architectural Edge-only boundary.
- [x] Plain language only — no raw internal codes in user-facing strings; all internal codes (M1, M2, M3, M6, Q-W1, Q-Pre1) appear only in operator/reviewer-facing docs.
- [x] **Epic-specific doctrine: supabase-edge-contract.** (i) No service-role in client (confirmed; harness uses anon-key path). (ii) No direct insert into `public.arguments` (confirmed; uses `submit-argument` Edge). (iii) RLS untouched (no migration; queries are pure SELECT against existing RLS-enabled tables). (iv) Read-only query discipline (verified by `assert-read-only.cjs` + reviewer tamper test). (v) Migration-bearing card check satisfied: zero migrations.
- [x] **Epic-specific doctrine: evidence-doctrine.** No `evidence_span` text appears in any query output of the rehearsal pack; M8 (doctrine ban-list scan on `evidence_span`) is correctly excluded from the rehearsal pack per design §4 closing note and re-asserted at the SQL layer by `assert-read-only.cjs` line 24.

## Blockers

None.

## Suggestions (non-blocking)

1. **Cosmetic typo in `.claude-tmp/rehearsal-queries/watchdog-cron-freshness.sql` line 5.** The PASS comment reads `failure_invocations = 0` but the column declared on line 12 (and used in the FAIL comment on line 8) is `failed_invocations`. The executable SQL is unaffected (the comment is documentation only). The runbook source-of-truth (`docs/runbooks/cutover-health-monitor.md` line 149) uses `failed_invocations` consistently. Fix at operator's discretion before drill day; not a blocker.

2. **Optional: include `Q-Pre1` in `.claude-tmp/rehearsal-queries/`.** Design §6 names a 6-file query pack (Q-Pre1, Q-W1, M1, M2, M3, M6 — Appendix lines 264-267). The shipped pack has 4 files (M1 + M2 + M3 + watchdog Layer 1). Q-Pre1 (cron-row introspection) is inlined verbatim in design §4 and is a trivial 6-line SELECT; M6 (direct-dispatch leakage absence) is inlined verbatim in design §4 lines 236-253 and used in Phase (f) of the audit skeleton. Operator transcribes them at drill time per design line 102 ("the 4 query files live at `.claude-tmp/rehearsal-queries/*.sql`") OR per §5 line 267 ("Operator transcribes from this doc OR CC writes via a separate prompt"). The design itself acknowledges this seam — file-count drift is a documented choice, not an omission. Non-blocking; operator may either pre-transcribe the missing two queries before drill or transcribe at drill time.

## Operator next steps

- Stage the 3 docs-territory artifacts: `git add docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL.md docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL-2026-06-01.md docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL.md`.
- Commit with: `docs(OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL): rollback rehearsal runbook + audit skeleton + review (APPROVE)`.
- Push the branch: `git push -u origin feat/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL`.
- Open PR: `gh pr create --title "OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL: drill runbook (docs-only)" --body-file docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL.md`.
- This card has NO deploy step — design + audit skeleton + review are docs-only; the harness + query pack live under gitignored `.claude-tmp/`. The drill itself (Phase 4 execution) is a separate operator-authorized prompt that walks design §3 + fills audit skeleton.
- Post-merge worktree cleanup: standard procedure in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)".

## Final verdict

**APPROVE.** All 8 artifacts integrity-pass. Read-only assertion verified by reviewer with both planted-UPDATE and planted-`evidence_span` tamper tests (exit 1 on both; exit 0 on clean pack). Audit-lint v1 exits 0 on the skeleton with verdict correctly PENDING. Constitutional invariant (classifiers never gate submission) preserved. Boundary compliance verified across all forbidden paths (zero diff vs `origin/main` on migrations / src / app / mcp-server / functions / scripts / package / familyRegistry). Alerting card precondition verified active in tree (`supabase/functions/cutover-health-monitor/index.ts` + `supabase/migrations/20260601000001_cutover_health_metrics_function.sql` + `src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts` + `docs/runbooks/cutover-health-monitor.md` all present at the cited base SHA). Two non-blocking suggestions (cosmetic comment typo; optional pre-transcription of Q-Pre1 + M6) recorded; neither affects the drill's executability.
