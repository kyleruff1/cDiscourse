# OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-02
**Branch:** feat/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE
**Design:** docs/designs/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE.md

## Summary

The card persists a leak-safe `failure_detail jsonb` on `public.argument_machine_observation_runs`
so failure triage stops requiring Deno log pulls. It is **write-only diagnostics** — nothing reads
the column. The implementation matches the design exactly: one additive nullable column (no
backfill), a `DROP`+`CREATE OR REPLACE` of `finalize_classifier_job` to a 9-arg signature with a
trailing `p_failure_detail jsonb DEFAULT NULL` (so the 8-arg verifier caller still resolves), and a
structural allow-list helper `buildRunRowFailureDetail(...)` threaded into the drainer's three
failure branches (retry / terminal / argument_missing+defensive-catch). The success path is provably
byte-equal (passes no `failureDetail`; the finalizer success branch never assigns the column). The
deny-list is enforced **by construction** — the helper has seven named inputs and no free-text entry
point — backed by a secret-shape scrub, per-field/whole-object caps, and a hostile-fixture
convergence gate that has real teeth. All gates green (typecheck/lint/test exit 0; 18,923 tests /
601 suites). No secret literal in committed source or the migration; no verdict token reachable in
any field. No `mcp-server/` edit; the client Source-6 mirror is untouched. Docker was unavailable, so
the migration-bearing check used the **heightened textual review** path — all four issue classes plus
the atomicity contract pass. No blockers, no changes requested.

## Verification

- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, `--max-warnings 0`)
- test: 18,153 → **18,923 tests** / 570 → **601 suites** (all pass, exit 0). The three new suites
  contribute 16+26+15 = **57 `it()` blocks** (matches the prompt's "+57"). Absolute count went UP.
- secret scan: **clean** (every hit is design-doc prose or a test `.not.toMatch` ban-list assertion;
  no contiguous secret literal in the committed helper or migration — both confirmed `exit 1`)
- doctrine scan: **clean** (only hits are ban-list token arrays inside test/comment context)
- **Migration apply | heightened-review pass — Docker not available (`docker info` exit 127, binary
  not found); classes 1–4 + atomicity contract scanned with zero unresolved markers**

## Design conformance

- [x] All design file-changes are present (migration, helper, drainer mod, 4 tests + bridge, design)
- [x] No undocumented file-changes (diff is exactly the 8 declared files; no `mcp-server/` edit)
- [x] Data model matches design (one additive nullable `jsonb` column; no index/RLS/table/backfill)
- [x] API contracts match design (`RunRowFailureDetail` + 7-field `RunRowFailureDetailInput`;
  `FinalizeJobInput`/`ScheduleRetryInput` gain `failureDetail?`; 9-arg SQL signature; RPC passes
  `p_failure_detail`, retry `.update` passes `failure_detail`)

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — `failure_detail` is never rendered;
  the helper emits no constant field values; the dynamic `reason` is sourced from
  `drainerUnavailableReasonToFailureReason(...)`, a fixed `mcp_*` transport-string set (verified
  verdict-free at `classifierDrainerRetryPolicy.ts:123-146`)
- [x] Score never blocks posting — N/A; this is post-storage diagnostic metadata downstream of every
  decision, read by nothing
- [x] No service-role in client code — the writer is the Edge drainer (already service-role
  server-side); diff touches no `src/`/`app/` path
- [x] No direct insert into public.arguments — none (touches only the queue run row + finalizer)
- [x] No AI calls in production app paths — none (Edge/DB only; no provider call; no `mcp-server/`)
- [x] Plain language only — no raw internal codes added to any UI string (no UI surface at all)
- [x] Epic-specific doctrine (cdiscourse-doctrine §6 secrets; §10a observations): the column is a
  secret-surface closed **structurally** — `buildRunRowFailureDetail` accepts seven named allow-listed
  inputs with no free-text/`extra`/`message`/`payload`/`body`/`prompt` entry point, plus a secret-shape
  scrub. §10a: this is operational metadata one level below a Machine Observation, never rendered, so
  it cannot read as an allegation.

## Card-specific adversarial checks (all answered)

1. **Body/prompt/evidenceSpan-value/payload ever captured? NO (pass).** The helper input
   (`classifierRunRowFailureDetail.ts:60-75`) has seven named structural inputs only; the sole
   adapter-sourced input at the drainer build (`classifierDrainerCore.ts:351`) is
   `classify.adapterResult.detail?.path` — the structural PATH string, not span text. FDP-12/13/14 +
   WR-15 lock the absence of any free-text key/identifier.
2. **Secret/JWT/Bearer/Authorization/email reachable? NO (pass).** `safeString`
   (`classifierRunRowFailureDetail.ts:114-119`) runs `looksSecret` on **every** string field before
   storing; matchers cover `sk-ant-`, `xai-`, `sb_secret_`, JWT triple, `Bearer …`, `Authorization`,
   `SERVICE_ROLE` (lines 88-99). Convergence gate FDP-7/8/9 proves every banned shape is dropped and
   the serialized output trips none of the matchers.
3. **Banned verdict token reachable? NO (pass).** Helper emits no constant field values; `reason` is
   the fixed `mcp_*` set (`classifierDrainerRetryPolicy.ts:123-146`), verdict-free. FDP-16 asserts no
   verdict literal in the helper source (`classifierRunRowFailureDetail.test.ts:244-255`).
4. **Migration backward-compatible? YES (pass).** `ADD COLUMN IF NOT EXISTS failure_detail jsonb`
   (migration line 113-114) — no `NOT NULL` (MIG-6), no backfill `UPDATE` (MIG-7), no
   table/index/RLS/policy/extension (MIG-8). The trailing `p_failure_detail jsonb DEFAULT NULL` + the
   8-arg `DROP FUNCTION` keep 8-arg callers resolving to the 9-arg function with NULL. Old/success/
   pre-terminal/reclaim rows stay NULL.
5. **Success path / gate / routing / retry / C=3 / backoff / MAX_ATTEMPTS untouched? YES (pass).**
   Success `finalizeJob` call (`classifierDrainerCore.ts:298-307`) passes no `failureDetail`; the
   finalizer success branch (migration 180-206) never assigns `failure_detail` (MIG-19). RPC/retry
   default to `null` (lines 507, 561). `classifierDrainerRetryPolicy.ts` is byte-equal (0 diff lines);
   WR-13/14 lock the decision call + constants (C=3, 90s, lease 130s/120s).
6. **Deployment ordering documented + correct? YES (pass).** Migration header (lines 40-48) +
   design "Deployment ordering (MANDATORY)" both state: apply migration FIRST via `db push --linked`
   from the branch BEFORE merge, with the WHY (Edge auto-deploys on merge; a drainer calling the 9-arg
   RPC before the column/function exists would throw on every failing cell). MIG-3 asserts the gate
   text.
7. **Correlation id safe? YES (pass).** `correlationId: job.id` — the run-row uuid (WR-8 asserts
   `job.id` and asserts NO token/secret/bearer/authorization source). Helper doc line 67 documents it
   as "a safe id; never a token/secret".
8. **Migration-bearing heightened review: pass.** Docker unavailable → heightened textual review.
   - **Class 1 (ambiguous column refs):** only new element is `SET failure_detail = p_failure_detail`
     in the single-table terminal UPDATE (`WHERE id = p_run_id`); `p_failure_detail` is a parameter,
     not a column. Guard SELECT fully qualifies via alias `r`. No subquery. **Pass.**
   - **Class 2 (type mismatches):** `p_failure_detail jsonb` matches the `failure_detail jsonb` column;
     other 8 params byte-equal to Card 2A. **Pass.**
   - **Class 3 (ordering deps):** `ADD COLUMN` (114) → `DROP FUNCTION` (124) → `CREATE OR REPLACE`
     (128) → `COMMENT ON COLUMN/FUNCTION` (238/249). Column exists before the body references it and
     before the COMMENT; DROP precedes CREATE. **Pass.**
   - **Class 4 (function/extension/role deps):** no `gen_random_uuid`/`uuid-ossp`, no `GRANT`/role
     refs, `SECURITY INVOKER` (not DEFINER), no `COMMENT ON … storage.*`. Core SQL only. All written
     columns created by predecessors `20260526000018`/`20260528000021`. **Pass.**
   - **Atomicity contract:** function body has no `COMMIT`/`ROLLBACK`/`SAVEPOINT`/autonomous/dblink/
     `pg_background`/`EXCEPTION WHEN` (verified directly; MIG-14/15). Ownership guard
     (`lease_owner = p_owner AND state = 'leased' FOR UPDATE`, lines 158-174) runs FIRST, before both
     UPDATEs (MIG-16). **Pass.**
9. **Test teeth: pass.** The leak-safety gate fuzzes real banned shapes through every entry point and
   asserts they are dropped (FDP-7/8/9), would catch a free-text key regression (FDP-13 scans the
   input interface for `extra`/`message`/`details`/`payload`/`body`/`prompt`/`evidenceSpan`; FDP-14
   scans for identifier use). Migration-shape scans are real: MIG-19 window-scans the success branch
   for any `failure_detail` reference (catches a success-path leak), MIG-10 asserts the 8-arg
   `DROP FUNCTION` is present (catches a missing DROP / overload trap). Count up +770 (suites +31;
   the three new suites = 57 `it()` blocks).

## Boundary verified (NO … by this card)

- No migration APPLY/deploy by Claude (header marks WRITTEN-NOT-APPLIED); no provider call; no
  success-path change; no acceptance-gate/routing/retry/concurrency/backoff/MAX_ATTEMPTS change; no
  prompt/validator/schema-mirror/key/ban-list/familyRegistry edit; **no `mcp-server/` edit** (diff
  `--name-only -- 'mcp-server/**'` is empty); no body/prompt/evidenceSpan/payload/secret/email
  persisted; client mirror `src/features/nodeLabels/machineObservationPersistenceTypes.ts` **not
  changed** (0 diff lines).
- Byte-equal confirmed (0 diff lines each): `20260528000022_…finalizer.sql`,
  `classifierDrainerRetryPolicy.ts`, `booleanObservationFailureSubreason.ts`, `classifyArgumentCore.ts`,
  `persistenceWriter.ts`.

## Test coverage

- [x] New public function (`buildRunRowFailureDetail`) has unit tests — happy path, attempt_count
  typing, caps, structural deny-list, doctrine (16 `it()` blocks, run against the real Deno module
  via the require bridge, not a copy)
- [x] User-facing strings ban-list assertion — FDP-16 + MIG (no verdict token); N/A for UI (no UI)
- [x] Edge cases from design § "Edge cases" tested — empty input → undefined (FDP-2), empty strings
  dropped (FDP-4), hostile/oversized → scrubbed+capped (FDP-7..11), argument_missing +
  defensive-catch minimal detail (WR-11/12), success → NULL (WR-10)
- [x] Accessibility assertions — N/A (no UI card)

## Blockers

None.

## Suggestions (non-blocking)

1. The design's Open Question #4 flags `scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql`
   (the operator post-merge verifier). It is **not** edited by this card and does not need to be — the
   `DEFAULT NULL` 9th param means the 8-arg call still resolves. If the operator wants the verifier to
   exercise the new param explicitly, that is a separate low-risk tooling tweak, not a gate on this PR.
2. The design baseline figure ("18,153 tests") is a snapshot estimate; the absolute count is the
   contract and it went up (+770). No action — noted so the count discrepancy is not mistaken for a
   regression.

## Operator next steps

- Apply the migration FIRST, from the branch, BEFORE merge (deploy-ordering is non-negotiable —
  Edge auto-deploys the drainer on merge):
  `npx supabase db push --linked`
- Verify the column + 9-arg overload exist (and the 8-arg overload is gone):
  - `SELECT 1 FROM information_schema.columns WHERE table_name = 'argument_machine_observation_runs' AND column_name = 'failure_detail';`
  - `\df public.finalize_classifier_job` (shows the 9-arg signature only)
- Push the branch: `git push -u origin feat/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE`
- Open PR: `gh pr create --title "OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE: leak-safe failure_detail jsonb on the classifier-queue run row" --body-file docs/reviews/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE.md`
- Merge (Supabase integration auto-redeploys the `classifier-drainer` Edge Function — Phase 5). No
  `mcp-server/` deploy. Leave routing DISARMED; nothing else to run.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup
  (operator step)").
