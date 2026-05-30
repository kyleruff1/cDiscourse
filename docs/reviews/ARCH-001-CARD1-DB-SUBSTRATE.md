# ARCH-001 Card 1 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-30
**Branch:** feat/ARCH-001-card1-db-substrate
**Design:** docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md §A.3/§A.4/§A.9/§A.10
**Intent brief:** docs/designs/ARCH-001-CARD1-DB-SUBSTRATE-intent.md

## Summary
This card ships the DATABASE SUBSTRATE ONLY for the civil-discourse classifier
queue: one new sequenced migration that extends `argument_machine_observation_runs`
to BE the job row (design §A.3 Option 2), adds the two service-role-only operational
tables (`classifier_drain_lock`, `classifier_drain_audit`), and defines the
claim/lease/recovery/enqueue logic as SQL functions. It is migration-bearing, so it
received the heightened TEXTUAL review (Docker unavailable here — `npx supabase db reset`
could not run). The four OPS-001 issue classes were scanned against every executable
statement; all four are clean. The two load-bearing correctness points the operator
flagged — the `ON CONFLICT`-against-a-partial-index form and the `status` nullability —
are both implemented correctly and each is pinned by a test. Nothing is wired (no
enqueue call site, no drainer, no `cron.schedule`, no feature flag, no submit-path
routing), the two reader files (`autoTriggerDispatcher.ts`, `machineObservationPersistenceQuery.ts`)
are untouched, and the migration is WRITTEN not applied. The only operator-facing
caution is the apply-step lock posture, addressed below — it is benign at the stated
table scale and is NOT a blocker. Ready for PR.

## Verification
- typecheck: pass (exit 0)
- lint: pass (exit 0, `--max-warnings 0`)
- test: full suite 18490 / 583 suites pass (exit 0); ARCH-001 subset 77 / 3 suites pass (exit 0). Implementer's +77 claim confirmed against a captured `Tests: 77 passed` line.
- secret scan: clean (the only grep hits are negative-assertion test lines `expect(...).not.toMatch(/sk-ant-/)` and the doctrine NOTE — no literal secret)
- doctrine scan: clean (the single "winner" hit is `release_drain_lease(<the winner>)` in the verify-SQL Section-F cleanup comment — the lease-race winner, an operational term, not a debate verdict)
- migration apply: heightened-review pass — Docker not available (`docker info` not runnable in this reviewer environment; `npx supabase db reset` skipped on factual grounds); classes 1–4 scanned with zero unresolved markers
- target Postgres: 17 (`supabase/config.toml major_version = 17`) — informs the rewrite analysis below

## Design conformance
- [x] All design file-changes are present (the §A.3 columns + indexes + two tables, §A.4 lease/claim/release functions, §A.9 retry cap=3, §A.10 audit columns)
- [x] No undocumented file-changes (7 files exactly: migration, verify SQL, 3 tests, current-status.md, intent brief)
- [x] Data model matches design — index #4/#5 column order `(argument_id, family, run_mode, schema_version)` and predicates are byte-identical to §A.3 #4/#5; index #6 `(state, available_at)` and #7 `(state, lease_expires_at)` match §A.3 #6/#7, each correctly hardened with `AND family IS NOT NULL` per the intent brief
- [x] API contracts match design — the five SQL functions match §A.4 signatures and bodies

### Index correctness (focus #1) — CONFIRMED
- #4 `amor_one_success_per_cell_idx`: UNIQUE `(argument_id, family, run_mode, schema_version) WHERE state = 'succeeded' AND family IS NOT NULL` — exact §A.3 #4. (migration L256-259; pinned by MIG-19)
- #5 `amor_one_active_job_per_cell_idx`: UNIQUE same cols `WHERE state IN ('pending','leased','retry_scheduled') AND family IS NOT NULL` — exact §A.3 #5. (L265-268; pinned by MIG-20)
- #6 `amor_claimable_idx`: `(state, available_at) WHERE state IN ('pending','retry_scheduled') AND family IS NOT NULL`. Design §A.3 #6 omits `AND family IS NOT NULL`; the intent brief adds it; the migration follows the brief. Correct hardening. (L275-278; pinned by MIG-21)
- #7 `amor_stale_lease_idx`: `(state, lease_expires_at) WHERE state = 'leased' AND family IS NOT NULL`. Same brief-driven hardening over §A.3 #7. (L284-287; pinned by MIG-22)
- Every queue index predicate carries `AND family IS NOT NULL` so the ~thousands of historical NULL-family rows are excluded — pinned mechanically by MIG-23, which slices each index statement body and asserts the token. CONFIRMED.

### `ON CONFLICT` vs PARTIAL index (focus #2) — CONFIRMED CORRECT
`enqueue_classifier_job` (migration L468-477) uses the column-inference + predicate form:
`ON CONFLICT (argument_id, family, run_mode, schema_version) WHERE state IN ('pending','leased','retry_scheduled') AND family IS NOT NULL DO NOTHING`.
It is NOT `ON CONFLICT ON CONSTRAINT` (which cannot target a partial unique index). The
predicate is byte-identical to index #5's predicate. Note: design §A.3 L293 shows the
loose pseudo-SQL `ON CONFLICT (amor_one_active_job_per_cell_idx)` (naming an index inside
the column-inference parens is itself invalid Postgres) — the implementer correctly
followed the intent brief's corrected column-inference+predicate guidance instead. The
predicate equivalence is pinned two ways: FN-18 asserts the literal predicate + `DO NOTHING`;
FN-19 extracts index #5's predicate and the enqueue predicate independently, normalizes
whitespace, and asserts both equal `state IN ('pending', 'leased', 'retry_scheduled')`.

### `status`/`state` compatibility (focus #3) — CONFIRMED SAFE
- The predecessor table def (`20260526000018` L89-90) is `status text NOT NULL CHECK (status IN ('success','failed','fallback'))`. The migration's `ALTER COLUMN status DROP NOT NULL` (L179-180) matches this reality.
- The existing CHECK is left UNCHANGED — a Postgres CHECK is satisfied when its expression evaluates to NULL (`NULL IN (...) → NULL → not FALSE → satisfied`), so a NULL `status` is permitted once NOT NULL is dropped. MIG-17 mechanically asserts no `DROP CONSTRAINT … status` and no re-added `CHECK (status IN …)`.
- `status` keeps its terminal-outcome meaning; `state` carries the new lifecycle (documented in the COMMENTs L490-495, L529-533).
- A `state='pending'`, `status` NULL row insert is proven by verify-SQL CASE 6 (asserted FIRST, before the cases that depend on substrate sanity) and by FN-16. The `enqueue_classifier_job` INSERT supplies every NOT NULL column (`debate_id`, `argument_id`, `schema_version`, `requested_families`, `run_mode` via caller, `state`, `available_at`, `started_at`) or relies on a default (`attempt_count` 0, `created_at` now()); `status` is omitted and now legitimately NULL; `provider_key` is nullable. The insert is complete.

### Reader-audit holds (focus #4) — CONFIRMED
`git diff main..HEAD --name-only` over `supabase/functions/**`, `machineObservationPersistenceQuery.ts`,
and `autoTriggerDispatcher.ts` returns EMPTY. No reader is changed. The `findExistingRun`
fix is correctly LOGGED for Card 2 (intent brief §"Reader audit" L52-58), not done here.
The new pre-execution rows do not exist yet (Card 1 writes none), so no reader can be
mis-fed by them. CONFIRMED.

### RLS on the two new tables (focus #5) — CONFIRMED
Both `classifier_drain_lock` and `classifier_drain_audit` have RLS ENABLED (L240-241,
pinned by MIG-27) and ZERO policies of any kind — no client write policy AND no SELECT
policy (service-role-only; operator reads via service-role monitoring SQL). MIG-28/29/30
assert no `CREATE POLICY … FOR INSERT/UPDATE/DELETE`; MIG-31 asserts ZERO `CREATE POLICY`
of any kind in the whole migration. No existing RLS policy is altered. No overly-permissive
policy leaked. CONFIRMED.

### Migration WRITTEN, not applied (focus #6) — CONFIRMED
New sequenced file `20260528000021_…` is the latest ordinal (sorts after the prior latest
`20260527000020`; the directory listing confirms no gap and no edit to an applied file).
No `db push` / apply ran. The header + current-status.md both record WRITTEN-NOT-APPLIED.
MIG-2/MIG-6 pin this. CONFIRMED.

### No out-of-scope leak (focus #7) — CONFIRMED
Executable SQL contains no `cron.schedule`, no `net.http_post`/`http_get`, no feature-flag
DDL, no submit-path routing, no MCP-server/Family-H/prompt/taxonomy/family-key/schema-mirror/
Source-6/audit-lint change, no `package.json` change. The grep hits for these tokens are all
in comments, negative-guard test assertions, and the intent-brief scope text. MIG-9/10/35/36
pin the executable-SQL absence. The two `CREATE EXTENSION` statements (pg_cron, pg_net) are
in scope per the brief and inert (no `cron.schedule`, no `net.http_post`). CONFIRMED.

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings — none; these are operational queue/diagnostic columns. `failure_sub_reason`/`dead_letter_reason` are TYPED reasons mirroring `BooleanObservationFailureSubreason`, never a verdict (COMMENTs L515-523). The lone "winner" token is the lease-race winner in an operator comment.
- [x] Score never blocks posting — N/A; no scoring or submit-gating touched.
- [x] No service-role in client code — N/A; pure SQL migration. Functions are `SECURITY INVOKER` (FN-2 asserts no `SECURITY DEFINER`), so they run with the service-role caller's privileges and introduce no privilege-escalation surface.
- [x] No direct insert into public.arguments — confirmed; the only INSERTs target `argument_machine_observation_runs` (the queue/run table) and `classifier_drain_lock`. The verify SQL fabricates no `public.arguments`/`debates`/`profiles` rows (VER-12).
- [x] No AI calls in production app paths — N/A; no app code touched.
- [x] Plain language only (no raw internal codes in UI strings) — N/A; no UI strings. The internal state/reason codes live only in DB columns + comments, never surfaced to a user by this card.
- [x] Epic-specific doctrine — supabase-edge-contract (no client write path; RLS enabled on every new table; migration discipline — new sequenced file, never edits an applied one) and cdiscourse-doctrine §6 (no secret literal; Vault drainer credential is a runbook NOTE only — MIG-38 asserts "Vault" appears only in comments, never in executable SQL) and §8 (RLS never disabled). All satisfied.

## Test coverage
- [x] New SQL functions have tests — all five functions (claim/acquire/release/reclaim/enqueue) have shape tests (FN-1..21) plus behavioral cases in the operator verify SQL (CASE 1-6 + Section-F two-session procedure).
- [x] Doctrine ban-list — the secret-safety scan (MIG-37/38, VER-13) and the verdict-free posture are covered.
- [x] Edge cases from design have tests — index #4 second-success block + failed-then-success allowed; index #5 second-active block + ON CONFLICT no-op; claim due-vs-future + attempt bump; lease acquire/expire-steal/own-only-release; reclaim below-cap→retry vs at-cap→dead_letter; pending-row NULL-status compatibility. All six intent-brief cases are present (VER-4..9).
- [x] Accessibility assertions — N/A (no UI).

### Shape-test convention assessment (test-discipline focus)
The text-scan + function-body-extract Jest convention is the RIGHT call here. Docker was
unavailable in the implementer environment, so a live-DB Jest harness was not possible, and
the repo has no existing live-Postgres Jest harness for migrations. The genuinely runtime
behaviors — partial-index unique violations, `FOR UPDATE SKIP LOCKED` isolation, the lease
`ON CONFLICT` race — cannot be proven in JSDOM. The implementer split the proof correctly:
the Jest suites lock the migration TEXT/SHAPE + function definitions + the load-bearing
`ON CONFLICT` form (so a regression fails CI before ship), and the operator verify SQL
(`scripts/arch-001-card1-sql/verify-classifier-queue-substrate.sql`) asserts the RUNTIME
behavior post-merge inside a `BEGIN … ROLLBACK` that mutates nothing. The two-session cases
(SKIP-LOCKED isolation, the two-acquirer race) are correctly documented as a manual Section-F
procedure because they need two concurrent backends. This is adequate for a Card-1
WRITTEN-not-applied substrate: the behavioral coverage is deferred to the operator's gated
apply + verify step, which is the explicit Card-1 process. NOT a coverage gap.

## Operator next steps
- Push the branch: `git push -u origin feat/ARCH-001-card1-db-substrate`
- Open PR: `gh pr create --title "ARCH-001 Card 1: classifier queue DB substrate (WRITTEN, not applied)" --body-file docs/reviews/ARCH-001-CARD1-DB-SUBSTRATE.md`
- Apply step (GATED, after merge): `npx supabase db push --linked`, then run
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/arch-001-card1-sql/verify-classifier-queue-substrate.sql`
  and confirm it ends with `ALL ASSERTIONS PASSED (rolled back)`. Then run the Section-F
  two-session concurrency procedure once.
- Apply-step lock posture (informational, NOT a blocker — all benign at the stated
  ~thousands-of-rows scale on the live runs table; confirmed target is Postgres 17):
  - The three `ADD COLUMN … NOT NULL DEFAULT` statements do NOT force a table rewrite on
    PG 17. Constant defaults (`'succeeded'`, `0`) use the fast catalog-stored-default path;
    `available_at … DEFAULT now()` uses `now()`, which is STABLE (one value per transaction),
    so it also stores a single missing-value with no full rewrite. (`clock_timestamp()`
    would be volatile and rewrite — `now()` is not.) Each takes a brief catalog-only
    `ACCESS EXCLUSIVE` lock.
  - The one-shot backfill UPDATE rewrites the non-success historical rows (the column DEFAULT
    set every existing row to `'succeeded'`, so the UPDATE re-touches them via `WHERE state =
    'succeeded'`). At ~thousands of rows this is sub-second; if the table is unexpectedly
    large (millions), batch it. Take a quick `SELECT count(*)` before applying as a sanity check.
  - The four partial `CREATE INDEX` (non-CONCURRENTLY, inside the migration txn) each take a
    `SHARE` lock blocking writes to the runs table for the build. Because every queue index is
    predicated `family IS NOT NULL` and all historical rows have NULL family, the indexes build
    over zero matching rows initially → near-instant. The write-block window is negligible here.
    CONCURRENTLY is not usable inside a migration transaction in any case.
  - HALT-class reminder (from the migration header + brief): `CREATE EXTENSION pg_cron`
    consumes one of the instance's scarce background workers (`max_worker_processes=6` is
    tight). Card 1 issues no `cron.schedule`, so the extension is inert beyond its worker
    reservation — but the operator should be aware.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup").

## Suggestions (non-blocking)
1. (Card 2 / future, already logged) The `findExistingRun` reader in
   `autoTriggerDispatcher.ts:189` orders by `started_at DESC LIMIT 1` and treats only
   `status==='success'` as already-classified. Once enqueue writes `pending` rows (Card 2),
   a non-terminal row could sort first and be mis-read as not-classified → re-dispatch. The
   intent brief already LOGS this for Card 2 and index #5 is the DB backstop; just flagging
   that Card 2 must land that reader/route awareness. No action in Card 1.
2. (Cosmetic, future) The `classifier_drain_audit.outcome` CHECK currently fixes four values
   (`completed`/`partial`/`failed`/`skipped_single_flight`); the migration comment notes the
   rest of the vocabulary is finalized when the drainer is built (Card 3). If Card 3 needs
   additional outcome values, that is a new migration (never edit this applied one) — already
   the correct posture, noted only so it isn't a surprise.
