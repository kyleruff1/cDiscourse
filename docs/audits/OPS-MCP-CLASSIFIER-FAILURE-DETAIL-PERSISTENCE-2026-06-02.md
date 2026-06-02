# OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — implementation audit (2026-06-02) — PASS

Audit-Lint: v1
Audit-type: ops
Doctrine-risk: false

> **L5 override note.** This is an OPS diagnostics-persistence audit. It names production family keys (`argument_scheme`, `critical_question`) only as the failing-family EXAMPLES from the motivating investigations (PR #419/#420/#429) — it does NOT inspect classifier `evidence_span` output for doctrine compliance (this card explicitly forbids persisting `evidence_span` and reads no result rows). The `Doctrine-risk: false` override tells `audit-lint` to skip the L5 persisted-output-inspection requirement, which does not apply to a write-only diagnostics column.

**Date:** 2026-06-02 UTC (the card anticipated a 2026-06-03 filename; execution landed 2026-06-02 — same day as the migration ordinal `20260602000001`).
**Operator:** Kyler
**Card:** OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE (human-orchestrated; design → main-thread build → review; NOT a workflow)
**Issue / trail:** the recurring failure-investigation pain — PR #419, PR #420, and the lone Family-F `provider_server_error` dead-letter adjudicated in PR #429 — each required a manual Deno Deploy log pull because the run row lacked the validator path / structured reason / correlation id.
**Base HEAD at execution:** `6bc648d` (post Stage-1 closeout).
**Branch:** `feat/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE` (3 implementer slices + 1 reviewer doc commit).
**Deploy-hygiene state:** Stage 1 is CLOSED and routing is DISARMED to baseline (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false` / `PERCENTAGE=0`, disarmed `2026-06-02T18:32:26Z`), so the live blast radius of this drainer change is zero organic cells.

**Scope:** Persist a leak-safe `failure_detail jsonb` on `public.argument_machine_observation_runs` so failure triage stops needing Deno log pulls. **WRITE-ONLY diagnostics** — nothing reads it. Docs (design) + one migration + the drainer failure-write path + a pure-TS allow-list helper + tests. **No runtime deployed by this card.**

## Verdict

**PASS** — the implementation is complete, leak-safe, and verified. `typecheck` + `lint` + `test` all exit 0 (**601 suites / 18,923 tests**, +57 / +3 vs the 18,866 baseline); the leak-safety convergence gate holds; the migration is additive-nullable with no backfill and a backward-compatible 9-arg finalizer; the `roadmap-reviewer` returned **Approve** with all 9 adversarial checks passing and the migration-bearing heightened review passed. **No runtime was deployed by this card** — the operator applies the migration (before merge) and merges (= deploys the drainer) under the ordered gate in §9.

---

## Phase 1 — Preflight (PASS)

**Status:** PASS

- Baseline green at `6bc648d`: `tsc --noEmit` exit 0, full Jest suite green (18,866 / 598).
- Stage 1 CLOSED, routing DISARMED to baseline (`disarm-stage1.sh`, `UTC_DISARMED_TIMESTAMP=2026-06-02T18:32:26Z`) — the deploy-hygiene gate (routing off during the drainer deploy) is satisfied. No time-window wait (zero-traffic pre-launch).
- H/I/J gated (`familyRegistry.ts:106/111/116` `productionEnabled:false`). Clean tree.

## 2. The leak-safe field set (the contract)

`failure_detail` (jsonb, nullable) contains ONLY these seven allow-listed keys: `validator_path`, `reason`, `family`, `correlation_id`, `attempt_count`, `run_mode`, `schema_version`.

**Deny-list — NEVER persisted, EVER:** argument body / `currentText` / `parentText` / `threadContextExcerpt`, prompt text, `evidenceSpan` / `evidence_span` VALUES (the path STRING `evidenceSpan.<rawKey>` is allowed; the span text is not), raw provider payload / response body, any secret (`SERVICE_ROLE`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, JWT, `Bearer …`, `Authorization`, PAT/MCP token), recipient emails, any free-text the model produced.

The deny-list is **STRUCTURAL**: `buildRunRowFailureDetail(input)` (`classifierRunRowFailureDetail.ts`) accepts only the seven named inputs — there is NO `extra` / `message` / `details` / `payload` / `body` / `prompt` field, so unsafe content has no entry point. Defense-in-depth: each string field is dropped if it trips a fragment-assembled secret-shape matcher (re-derived from `booleanObservationFailureSubreason.ts`'s proven set, so that module stays byte-equal), capped at 200 chars; the object is capped at 2000 serialized chars; the helper returns `undefined` (→ column NULL) when no safe field survives.

## 3. The migration (additive nullable + 9-arg finalizer)

`supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql`:
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS failure_detail jsonb` — nullable, default NULL, **no backfill**. Historical rows, success rows, and pre-terminal (`pending`/`leased`) rows all stay NULL.
- `DROP FUNCTION` the old 8-arg `finalize_classifier_job` + `CREATE OR REPLACE` it 9-arg with a trailing `p_failure_detail jsonb **DEFAULT NULL**`. The terminal-failure UPDATE gains exactly one assignment (`failure_detail = p_failure_detail`); the SUCCESS branch is byte-equal (never references the column → succeeded rows stay NULL). The `DEFAULT NULL` + the 8-arg DROP keep the existing 8-arg caller (`scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql`) working **without edits** (it resolves to the 9-arg function with the new param defaulting to NULL) — so no out-of-scope operator-tooling edit was needed.
- Atomicity + ownership guard preserved byte-equal from Card 2A (no `COMMIT`/`ROLLBACK`/`SAVEPOINT`/autonomous/`EXCEPTION WHEN`; `FOR UPDATE` ownership guard FIRST; false hard no-op for a stale/wrong owner — so `failure_detail` is written iff the existing failure columns are). One `COMMENT ON COLUMN` + an updated `COMMENT ON FUNCTION` (9-arg).
- The lease-expiry reclaim path (`reclaim_stale_leases`, migration `…21`) is unchanged and legitimately leaves `failure_detail` NULL on a reclaim-dead-letter (no adapter detail exists; out of scope to edit an applied migration).

## 4. Write-path touch-set (drainer) + success byte-equal

`supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts` (all additive, ≈49 lines):
- `FinalizeJobInput` + `ScheduleRetryInput` gain optional `failureDetail?: RunRowFailureDetail | null`; `finalizeJob`'s RPC passes `p_failure_detail: input.failureDetail ?? null`; `scheduleRetry`'s `.update({...})` writes `failure_detail: input.failureDetail ?? null`.
- The detail is built ONCE from the allow-list helper after the `classifyDrainerFailure(...)` decision (inputs: `validatorPath: classify.adapterResult.detail?.path` — the structural path already allow-listed upstream by the adapter; `reason: decision.failureReason`; `family: job.family`; `correlationId: job.id` — the safe run-row uuid; `attemptCount`; `runMode: job.run_mode`; `schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`) and threaded into BOTH the retry and terminal branches. The `argument_missing` + defensive-catch terminals build a minimal detail (`reason`/`family`/`correlation_id`/`run_mode`).
- **Success path byte-equal:** the success `finalizeJob` call passes no `failureDetail` → the RPC receives NULL and the success branch never assigns the column. No-behavior-change for success.

## 5. MCP emitter — NOT changed (single deploy surface)

The design proved the structured `path` + `reason` the card wants ALREADY flow from the MCP server's error envelope (`mcp-server/tools/classifyArgumentBooleanObservations.ts`) → the Edge adapter (`booleanObservationMcpAdapter.ts` → `detail.path`/`subReason`) → the drainer's failure branch (`classifierDrainerCore.ts`, where `classify.adapterResult.detail` was present but unused). **No `mcp-server/` edit → no separate Deno Deploy push.** The reviewer confirmed the diff's `mcp-server/` name-only set is empty. (The MCP server's internal `requestId` does not reach the Edge side; the correlation id is the run-row `id`, not the MCP `requestId` — a future card could thread the latter, out of scope.)

## 6. Preservation manifest (byte-equal — verified)

Success path; acceptance gate (the rules engine); routing predicate + `CLASSIFIER_QUEUE_ROUTING_*`; retry policy (`classifierDrainerRetryPolicy.ts` — `classifyDrainerFailure` + `DRAINER_MAX_ATTEMPTS` + backoff); drainer constants (`C=3`, `T=90s`, lease TTL 130s, batch/job caps); every prompt / validator / schema-mirror / key / ban-list; `familyRegistry` (H/I/J still `false`); `booleanObservationFailureSubreason.ts` (the new helper re-derives its scrub rather than importing); the prior finalizer migration `20260528000022` + its 8-arg shape test; the **client Source-6 read mirror** `src/features/nodeLabels/machineObservationPersistenceTypes.ts` (write-only card → no read-contract change); RLS / policies / indexes / env / cron / Vault. The reviewer confirmed all five declared-unchanged files are 0-diff and the diff is exactly the 9 expected files (8 card files + design + review doc).

## 7. Tests + the leak-safety convergence gate

**+57 tests / +3 suites** (18,866 → 18,923; 598 → 601 suites). All green; `typecheck` + `lint` exit 0.
- `__tests__/classifierRunRowFailureDetail.test.ts` (16) — **the leak-safety convergence gate (centerpiece)**: allow-only round-trip; deny-never (every banned shape — `sk-ant-`/`xai-`/`sb_secret_`/JWT/`Bearer`/`Authorization` + body/prompt/payload via `as any` — dropped; serialized output trips no matcher); structural deny-list source-scan (no free-text input key); caps; `attempt_count` typing; doctrine (no verdict token emitted by the helper). Secret-shaped literals in the test are fragment-assembled (SCAN-17).
- `__tests__/opsMcpClassifierFailureDetailMigration.test.ts` (26) — additive-nullable, no backfill, no other schema change; DROP 8-arg + CREATE 9-arg `DEFAULT NULL`; terminal UPDATE assigns `failure_detail`; **success branch never references it**; atomicity + ownership guard preserved; secret-safety; prior migration not edited.
- `__tests__/classifierDrainerFailureDetailWrite.test.ts` (15) — write-path source scan: RPC + retry UPDATE persist it; failure-branch build inputs; `correlation_id = job.id`; **success call passes no `failureDetail`**; no-behavior-change guard (decision + constants byte-equal); no body/prompt/evidenceSpan/payload in the build inputs.

Leak scans: no contiguous secret-shaped literal in the migration / helper / drainer; the helper has no executable `.evidenceSpan` / `.body` / payload reference; `failure_detail` is assigned only from `p_failure_detail`.

## 8. Review verdict

`roadmap-reviewer` → **Approve** (`docs/reviews/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE.md`, commit `c0865e1`). All 9 adversarial checks pass with `file:line` citations (no body/prompt/evidenceSpan/payload capture; no secret/JWT/email reachable; no verdict token; migration backward-compatible; success/gate/routing/retry/concurrency untouched; deploy-ordering correct; `correlation_id = job.id` safe; migration-bearing heightened review passed — Docker unavailable, so all four issue classes + the atomicity contract were scanned textually; leak-safety gate has teeth). Two non-blocking suggestions (optional verifier-script tweak; the reviewer's `+770` test figure is off a stale baseline — the accurate delta is **+57** vs the measured 18,866). No blockers.

## 9. No runtime deployed by this card + operator deploy-ordering (MANDATORY, routing disarmed)

**Claude deployed nothing.** Operator steps, ordered (routing stays DISARMED throughout):
1. **Apply the migration FIRST**, from the branch, BEFORE the PR merges: `npx supabase db push --linked`. (Edge auto-deploys the drainer on merge; the new drainer calls the 9-arg finalizer + writes `failure_detail`, so the column + 9-arg function MUST exist first or every failing cell's terminal write throws.) Either land a migration-only PR first, or apply from the feature branch then merge.
2. **Verify** the column + 9-arg overload exist (`information_schema.columns` for `failure_detail`; `\df public.finalize_classifier_job` shows the 9-arg overload, 8-arg gone).
3. **Merge the PR** → Edge auto-redeploys the `classifier-drainer`. No `mcp-server/` deploy (no MCP change).
4. (Optional, operator-gated spend) a small synthetic burst to confirm `failure_detail` populates leak-safe on a failure — a separate live drill, not this card.

## 10. Boundaries honored (binding)

- ✅ No migration APPLY / deploy / provider call / `submit-argument` / `classify-…` invocation / Supabase write / service-role / env-Vault-cron-routing mutation by Claude.
- ✅ No success-path / acceptance-gate / routing / retry-policy / concurrency / backoff / `MAX_ATTEMPTS` change; no prompt / validator / schema-mirror / key / ban-list / `familyRegistry` edit; no `mcp-server/` change; no Source-6 mirror change.
- ✅ No body / prompt / `evidenceSpan` value / raw payload / secret / JWT / Bearer / email persisted into `failure_detail` — proven structurally + by the convergence gate.
- ✅ `correlation_id` is the run-row uuid (`job.id`), never a secret.
- ✅ This audit names fields, never values, and reproduces no real `failure_detail` payload.
- ✅ Merging is operator-gated (migration applied first + routing disarmed + explicit authorization) — NOT auto-merged by Claude, unlike the docs-only cards.
