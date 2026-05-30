# ARCH-001 Card 2A — atomic queue finalizer (intent brief)

**Parent design:** `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` (§A.3 finalization; this card CORRECTS §A.3's non-atomic "benign" finalization).
**Branch:** `feat/ARCH-001-card2a-atomic-finalizer` (off `origin/main` 448ff28).
**Trail:** GitHub #373 (umbrella); the Card-2A issue.
**Gate:** migration WRITTEN, NOT applied. Operator applies + verifies. **Card 2 (drainer/enqueue) does NOT resume until Card 2A is merged + applied + verified.**

## Why this card exists (the Stage-2B blocker, confirmed in preflight)
The Card-2 drainer must finalize one claimed job cell — INSERT result rows + flip the run row to terminal — as **one transaction**. The Card-1 substrate cannot do this:
- No finalize function exists (Card 1 made claim/lease/reclaim/release/enqueue only).
- §A.3's plan (`persistResults()` INSERT + a separate `UPDATE runs`) is **two non-atomic PostgREST calls**.
- The queue reuses **one `run_id`** across retries, and `persistResults` (`persistenceWriter.ts:151`) is a **plain INSERT (no ON CONFLICT)** under `UNIQUE (run_id, raw_key)`. So the failure window (results written → run-UPDATE fails → reclaim → retry → re-insert) hits the unique constraint → errors → loops to `dead_letter`, **dead-lettering a genuinely-succeeded cell**.

**Operator decision (Option 1):** atomic DB finalization is a REQUIRED substrate addition. Add a new SQL function in its own migration; leave the existing direct-dispatch `persistRun`/`persistResults` path UNCHANGED.

## Scope — MIGRATION ONLY (one new SQL function + tests)
IN: a new sequenced migration defining `finalize_classifier_job(...)`; tests. OUT: NO drainer code, NO enqueue wiring, NO routing/flag, NO `autoTriggerDispatcher.ts` change, NO MCP-server change, NO Family H, NO prompt/taxonomy/family-key/schema-mirror/Source-6/production-flag/audit-lint/package.json change, NO broad persistence refactor.

## The function — `finalize_classifier_job(...)`
Signature may be adjusted to match columns, but must carry enough to: identify the run row by `run_id`; verify the caller owns the lease (`lease_owner`); insert/upsert result rows for success; set terminal `state`; set compatibility `status`; set `completed_at`; set `failure_reason`/`failure_sub_reason` when applicable; set `dead_letter_reason` when applicable; clear `lease_owner` + `lease_expires_at`; avoid duplicate success rows. Suggested:
```
finalize_classifier_job(
  p_run_id            uuid,
  p_owner             text,    -- caller's lease_owner; MUST match or it's a no-op
  p_terminal_state    text,    -- 'succeeded' | 'failed_terminal' | 'dead_letter'
  p_status            text,    -- 'success' | 'failed' (compatibility status set on terminal)
  p_failure_reason    text,    -- nullable
  p_failure_sub_reason text,   -- nullable
  p_dead_letter_reason text,   -- nullable
  p_observations      jsonb    -- [{raw_key,family,confidence,evidence_span}] for success; [] / null for failure
) RETURNS boolean              -- true = finalized; false = stale/wrong owner (no-op). Implementer may use a record.
LANGUAGE plpgsql SECURITY INVOKER   -- matches Card-1 functions; drainer calls via service-role
```

### Required semantics (the review will verify these)
- **One DB function call** from the drainer; the result-INSERT and run-row UPDATE execute **in one transaction** (a plpgsql function body is one transaction — verify no autonomous-txn/`COMMIT` inside).
- **Ownership guard FIRST:** `SELECT … FROM …runs WHERE id = p_run_id AND lease_owner = p_owner AND state = 'leased' FOR UPDATE`. If NOT FOUND → **RETURN false (no-op)** — insert NO results, update NOTHING. A drainer whose lease expired or was reclaimed (owner changed, or state no longer 'leased') MUST NOT finalize. This is the wrong-owner + stale-owner guard.
- **Success** (`p_terminal_state='succeeded'`): INSERT the result rows, then `UPDATE …runs SET state='succeeded', status='success', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL WHERE id=p_run_id`.
- **Terminal failure** (`'failed_terminal'` or `'dead_letter'`): no result rows required; `UPDATE …runs SET state=p_terminal_state, status='failed' (or the compatible value), completed_at=now(), failure_reason, failure_sub_reason, dead_letter_reason (when dead_letter), lease_owner=NULL, lease_expires_at=NULL`.
- **Retry scheduling is NOT this function** — `retry_scheduled` (run-row-only, no result rows, sets `available_at`/`attempt_count`) stays a separate run-row UPDATE in the drainer (Card 2). This finalizer is ONLY for success + terminal failure.

### Result-row insert (duplicate-safe; mirror `persistResults` exactly)
Use the existing `argument_machine_observation_results` column contract — `run_id, debate_id, argument_id, schema_version, raw_key, family, confidence, evidence_span` — mapped **exactly** as `persistResults` maps it (same columns, same evidence_span handling). Insert must be duplicate-safe: **`ON CONFLICT (run_id, raw_key) DO NOTHING`** (the constraint `amor_unique_run_rawkey` is a NAMED NON-PARTIAL unique constraint, so explicit **column inference** `(run_id, raw_key)` is correct and preferred; do NOT use `ON CONFLICT ON CONSTRAINT` even though it would work here). No duplicate result rows; no unique-constraint failure loop if the function is retried after an uncertain client response. (`debate_id`/`argument_id`/`schema_version`/`family` for the rows can be read from the run row inside the function, so the drainer need only pass the per-rawKey observation payload.)

## Migration mechanics
- New sequenced file after `20260528000021` (next ordinal). Never edit an applied migration.
- The function only — no new table, no column change, no index change (Card 1's indexes #4/#5 already enforce single-success + single-active). OPS-001 ordering is trivial here (one function + a COMMENT).
- WRITTEN, not applied. Operator runs `npx supabase db push --linked` + verification after merge.

## Tests (deterministic; shape now, live cases via operator verify SQL if Docker unavailable)
Follow the Card-1 convention (text-scan shape tests in Jest + a `BEGIN…ROLLBACK` operator verify SQL in `scripts/arch-001-card2a-sql/` — a SIBLING dir, NOT `scripts/ops/`). Required cases:
1. **Success finalization:** leased row owned by `owner-a` → function inserts result rows; run → `state='succeeded'`, `status='success'`; `lease_owner`/`lease_expires_at` cleared; `completed_at` set.
2. **Duplicate-safe:** repeated call (or pre-existing `(run_id, raw_key)`) creates no duplicate rows + no unique-constraint failure loop.
3. **Wrong-owner guard:** row leased by `owner-a`; `owner-b` finalize attempt → no terminal update, no result rows, returns false.
4. **Stale/reclaimed-owner guard:** lease expired or owner changed (state no longer 'leased' by the caller) → old owner cannot finalize.
5. **Terminal failure finalization:** no result rows required; run reaches the correct terminal failure state; failure fields preserved; lease fields cleared.
6. **Direct-dispatch compatibility:** existing `persistRun`/`persistResults` direct path UNCHANGED (assert the writer file is untouched, or that only a pure byte-equivalent shared mapping helper was extracted).

## Hard guardrails
Migration WRITTEN not applied; implementer does NOT run `db push`. NO drainer code. Do NOT modify `autoTriggerDispatcher.ts`, any MCP-server file, prompts/taxonomy/family-keys/schema-mirror/Source-6/production-flags/audit-lint/package.json. No Family H. No broad persistence refactor.

## Process
implementer (this scope) → reviewer (MUST verify the function is genuinely atomic — one txn, no autonomous commit — AND that stale/wrong owners cannot finalize) → PR → operator-gated squash-merge → operator applies + verifies → THEN Card 2 drainer/enqueue resumes.
