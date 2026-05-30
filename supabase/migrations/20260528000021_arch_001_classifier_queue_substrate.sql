-- ============================================================
-- Migration: 20260528000021_arch_001_classifier_queue_substrate
-- Description: ARCH-001 Card 1 — DATABASE SUBSTRATE ONLY for the
--   civil-discourse classifier queue. Extends the existing
--   public.argument_machine_observation_runs table to BE the job row
--   (parent design §A.3 "extend the run table (Option 2)"), adds the
--   single-flight drain lease table + the per-drain audit table, and
--   ships the claim / lease / recovery / enqueue logic as SQL FUNCTIONS
--   (parent design §A.4). NOTHING here is wired yet: no enqueue call
--   site, no drainer Edge Function, no cron.schedule, no feature flag,
--   no submit-path routing. Those are Cards 2-3.
--
-- Card: ARCH-001 Card 1
--   - Intent brief: docs/designs/ARCH-001-CARD1-DB-SUBSTRATE-intent.md
--   - Design (DDL/function source of truth):
--     docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md
--     §A.3 (schema/indexes), §A.4 (TTL lease + claim), §A.9 (state
--     machine / retry cap = 3), §A.10 (audit columns).
-- Predecessor migrations:
--   - 20260526000018_mcp_021b_machine_observation_results.sql
--     (CREATE argument_machine_observation_runs: status text NOT NULL
--      CHECK (status IN ('success','failed','fallback')), schema_version,
--      requested_families, provider_key, started_at, completed_at,
--      created_at).
--   - 20260526000019_mcp_021c_edge_run_mode.sql
--     (run_mode text NOT NULL DEFAULT 'production'
--      CHECK (run_mode IN ('production','admin_validation'))).
--   - 20260527000020_ops_mcp_test_data_cleanup.sql (latest ordinal;
--     this file sorts AFTER it).
--
-- ── OPERATOR GATE ──────────────────────────────────────────────
-- This migration is WRITTEN, NOT APPLIED. The operator applies it via
-- `npx supabase db push --linked` AFTER merge. The two CREATE EXTENSION
-- statements are HALT-class: enabling pg_cron consumes one of the
-- instance's scarce background workers (max_worker_processes = 6 is
-- tight; see intent brief "pg_cron / pg_net"). Card 1 does NOT
-- cron.schedule(...) anything — there is no drainer to invoke until
-- Cards 2-3, so enabling the extension here is inert beyond its worker
-- reservation.
--
-- ── Doctrine encoded by this migration ────────────────────────
--   - cdiscourse-doctrine §6/§7: NO secret literal anywhere. The Vault
--     credential that the future drainer (Card 3) will read to call the
--     classify Edge Function is a RUNBOOK NOTE only (see the note block
--     above the extensions) — it is never written to SQL or git.
--     lease_owner / lock_key / owner columns hold opaque drainer
--     invocation ids, never a secret.
--   - cdiscourse-doctrine §8: every new table has RLS ENABLED with NO
--     client write policy. The drainer writes via service-role (bypasses
--     RLS), exactly as the existing MCP-021C writer does. No existing
--     RLS policy is changed.
--   - cdiscourse-doctrine §1/§10a: these are operational queue/diagnostic
--     columns. failure_sub_reason / dead_letter_reason are TYPED reasons
--     mirroring the existing BooleanObservationFailureSubreason vocabulary
--     — never a raw provider body, prompt, or verdict about a participant.
--
-- ── status / state compatibility (the resolved preflight) ──────
-- A queue row in state pending/leased/retry_scheduled exists BEFORE any
-- terminal outcome, so it has no `status`. `status` is currently
-- NOT NULL → such a row could not be inserted. RESOLUTION (intent brief
-- §"BLOCKING: status nullability"): ALTER COLUMN status DROP NOT NULL.
-- The existing CHECK (status IN ('success','failed','fallback')) is LEFT
-- UNCHANGED — a Postgres CHECK passes when its expression is NULL
-- (NULL IN (...) → NULL → not FALSE → satisfied), so a NULL status is
-- already permitted once NOT NULL is dropped. `status` KEEPS its meaning
-- (the terminal-outcome field) and is simply NULL until a terminal
-- outcome. The new `state` column carries the full queue lifecycle. We
-- do NOT re-mean `status` and do NOT widen its CHECK.
--
-- ── Statement order (OPS-001 §4 four-class ordering) ───────────
--   Class A (extensions)        : CREATE EXTENSION pg_cron, pg_net.
--   Class B (columns)           : ADD COLUMN IF NOT EXISTS ×9 on runs;
--                                 ALTER COLUMN status DROP NOT NULL;
--                                 one-shot backfill of `state`.
--   Class C (CHECK/constraints) : the `state` CHECK ships inline with
--                                 the ADD COLUMN (Class B); the two new
--                                 tables (with their CHECKs + PK) are
--                                 created here, before their indexes.
--   Class D (indexes)           : partial unique/claim/stale indexes
--                                 #4-#7, each predicated `family IS NOT
--                                 NULL`; new-table support indexes.
--   Class E (functions/comments): SQL functions (claim/lease/release/
--                                 reclaim/enqueue) then COMMENTs last.
--
-- OPS-001 §4 four-class posture:
--   Class 1 — Ambiguous column references in subqueries: the claim
--     function's CTE and every UPDATE fully-qualify the target table
--     (alias `r` / explicit `argument_machine_observation_runs.`), and
--     the lease acquire's ON CONFLICT WHERE qualifies
--     `classifier_drain_lock.expires_at` (NOT bare `expires_at`), exactly
--     as the design §A.4 acquire statement does. Defensive against a
--     future maintainer's join.
--   Class 2 — Column type mismatches: `family`, `state`,
--     `failure_sub_reason`, `dead_letter_reason`, `lease_owner` are text
--     (same posture as the existing `status` / `run_mode`).
--     `attempt_count` is int. `available_at` / `lease_expires_at` /
--     `last_attempt_at` are timestamptz (same as started_at/completed_at).
--     The partial indexes key on (argument_id uuid, family text,
--     run_mode text, schema_version text) — every column matches its
--     declared type on the runs table.
--   Class 3 — Implicit ordering dependencies: extensions precede
--     everything; ADD COLUMN precedes the backfill that reads the new
--     `state` column; CREATE TABLE for each new table precedes its
--     CREATE INDEX; ENABLE ROW LEVEL SECURITY precedes any policy posture
--     (there are none); the SQL functions are created AFTER the columns/
--     tables/indexes they reference; COMMENTs come last (descriptive).
--   Class 4 — Function / trigger / extension dependencies:
--     gen_random_uuid() requires pgcrypto (enabled by every prior
--     migration in this repo; same posture as 20260526000018 header
--     lines 50-51). pg_cron / pg_net are enabled by Class A but NOT
--     invoked (no cron.schedule). The claim/lease functions use only
--     core SQL (now(), interval arithmetic, FOR UPDATE SKIP LOCKED,
--     INSERT ON CONFLICT). NO `COMMENT ON … storage.*` statement anywhere
--     (PR-003 SQLSTATE 42501 boundary preserved).
--
-- ── No client write path ───────────────────────────────────────
-- ZERO `CREATE POLICY … FOR (INSERT|UPDATE|DELETE)` in this migration.
-- The reviewer's mechanical check:
--   grep -E "CREATE POLICY .* FOR (INSERT|UPDATE|DELETE)" \
--     supabase/migrations/20260528000021_*.sql
-- must return zero matches.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- Class A — EXTENSIONS (operator-applied; HALT-class)
-- ════════════════════════════════════════════════════════════
-- RUNBOOK NOTE (no secret in SQL): the Card-3 drainer Edge Function will
-- authenticate its self-invocation using a credential stored in Supabase
-- Vault (read at drainer runtime, never embedded here). pg_net is enabled
-- now so the future cron tick can POST to the drainer; pg_cron is enabled
-- now so the future cron.schedule(...) (Card 3) has its extension present.
-- Card 1 issues NEITHER cron.schedule(...) NOR any net.http_post(...).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ════════════════════════════════════════════════════════════
-- Class B — ADDITIVE COLUMNS on argument_machine_observation_runs
-- ════════════════════════════════════════════════════════════
-- All ADD COLUMN IF NOT EXISTS (idempotent; safe on a populated table).
-- `state` carries a DEFAULT 'succeeded' so the column add does not
-- rewrite-fail on existing rows; the backfill below corrects non-success
-- historical rows. `available_at` DEFAULT now() means a freshly inserted
-- pending row is immediately claimable.

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS family text;

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'succeeded'
    CHECK (state IN ('pending', 'leased', 'retry_scheduled',
                     'succeeded', 'failed_terminal', 'dead_letter'));

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0;

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS lease_owner text;

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS failure_sub_reason text;

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS dead_letter_reason text;

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

-- status nullability: a pre-terminal queue row has no terminal outcome.
-- Drop NOT NULL; leave the existing CHECK untouched (NULL satisfies it).
ALTER TABLE public.argument_machine_observation_runs
  ALTER COLUMN status DROP NOT NULL;

-- One-shot backfill: historical rows are completed results, not live
-- jobs. The column DEFAULT already set every existing row to 'succeeded';
-- this corrects the non-success rows to 'failed_terminal' so the claim
-- query never re-runs a historical failure. Idempotent: a re-apply finds
-- rows already in their terminal state and is a harmless no-op for the
-- success rows (the predicate `state = 'succeeded'` re-narrows correctly
-- because a corrected 'failed_terminal' row no longer matches).
UPDATE public.argument_machine_observation_runs
   SET state = CASE
                 WHEN status = 'success' THEN 'succeeded'
                 ELSE 'failed_terminal'
               END
 WHERE state = 'succeeded';


-- ════════════════════════════════════════════════════════════
-- Class C — NEW TABLES (single-flight lease + per-drain audit)
-- ════════════════════════════════════════════════════════════
-- Both tables are service-role-only: RLS is ENABLED and NO client write
-- policy is created (same posture as the MCP-021B runs/results tables —
-- the drainer writes via service-role, which bypasses RLS). No SELECT
-- policy is created either; the client never reads these operational
-- tables. Operator/admin reads them via service-role monitoring SQL
-- (design §A.10), which bypasses RLS.

-- Drain-level single-flight: a single TTL lease row keyed by a constant
-- lock_key. design §A.4 Option B (TTL lease row, NOT advisory locks —
-- advisory locks cannot be proven safe through the PostgREST/Supavisor
-- topology).
CREATE TABLE IF NOT EXISTS public.classifier_drain_lock (
  lock_key     text        PRIMARY KEY,        -- constant 'classifier_drain'
  owner        text        NOT NULL,           -- opaque drainer invocation id (no secret)
  acquired_at  timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

-- Per-drain append-only audit row (design §A.10 query C reads
-- started_at / completed_at / outcome / jobs_processed / jobs_succeeded /
-- stale_leases_recovered). The 'skipped_single_flight' outcome value is
-- load-bearing for the §A.10 monitoring SQL and is fixed here; the rest
-- of the outcome vocabulary is finalized when the drainer is built
-- (Card 3) but the column + CHECK are established now.
CREATE TABLE IF NOT EXISTS public.classifier_drain_audit (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner                   text,               -- drainer invocation id (no secret)
  started_at              timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz,
  outcome                 text        NOT NULL
                            CHECK (outcome IN ('completed', 'partial',
                                               'failed', 'skipped_single_flight')),
  jobs_processed          int         NOT NULL DEFAULT 0,
  jobs_succeeded          int         NOT NULL DEFAULT 0,
  jobs_failed             int         NOT NULL DEFAULT 0,
  stale_leases_recovered  int         NOT NULL DEFAULT 0,
  dead_letters            int         NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classifier_drain_lock  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classifier_drain_audit ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════
-- Class D — PARTIAL INDEXES (#4-#7) + new-table support indexes
-- ════════════════════════════════════════════════════════════
-- Every queue index is predicated `family IS NOT NULL` so the ~thousands
-- of historical rows (which leave family = NULL) are excluded — the
-- indexes can be created without touching legacy data, and a historical
-- row can never collide with a queue job.

-- #4 one-success-per-cell (THE core duplicate-success invariant): two
-- 'succeeded' rows for one (argument_id, family, run_mode, schema_version)
-- cell is a DB error. A failed attempt + a later success is valid (the
-- failed row is outside this partial index). design §A.3 #4.
CREATE UNIQUE INDEX IF NOT EXISTS amor_one_success_per_cell_idx
  ON public.argument_machine_observation_runs
     (argument_id, family, run_mode, schema_version)
  WHERE state = 'succeeded' AND family IS NOT NULL;

-- #5 one-active-job-per-cell (idempotent-enqueue identity): enqueue uses
-- INSERT … ON CONFLICT (these columns) WHERE (this predicate) DO NOTHING
-- (see enqueue_classifier_job below). A second enqueue for an
-- already-active cell is a no-op. design §A.3 #5.
CREATE UNIQUE INDEX IF NOT EXISTS amor_one_active_job_per_cell_idx
  ON public.argument_machine_observation_runs
     (argument_id, family, run_mode, schema_version)
  WHERE state IN ('pending', 'leased', 'retry_scheduled') AND family IS NOT NULL;

-- #6 claim/scan index: supports the drainer's
-- WHERE state IN ('pending','retry_scheduled') AND available_at <= now()
-- ORDER BY available_at. Column order (state, available_at) per design
-- §A.3 #6; predicate gains `family IS NOT NULL` per the intent brief so
-- the index covers queue rows only.
CREATE INDEX IF NOT EXISTS amor_claimable_idx
  ON public.argument_machine_observation_runs
     (state, available_at)
  WHERE state IN ('pending', 'retry_scheduled') AND family IS NOT NULL;

-- #7 lease-recovery index: supports the stale-lease reclaimer's
-- WHERE state = 'leased' AND lease_expires_at < now(). Column order
-- (state, lease_expires_at) per design §A.3 #7; predicate gains
-- `family IS NOT NULL` per the intent brief.
CREATE INDEX IF NOT EXISTS amor_stale_lease_idx
  ON public.argument_machine_observation_runs
     (state, lease_expires_at)
  WHERE state = 'leased' AND family IS NOT NULL;

-- Audit support index: monitoring SQL §A.10 query C filters by
-- completed_at / started_at windows.
CREATE INDEX IF NOT EXISTS classifier_drain_audit_completed_at_idx
  ON public.classifier_drain_audit (completed_at);


-- ════════════════════════════════════════════════════════════
-- Class E — SQL FUNCTIONS (claim / lease / release / reclaim / enqueue)
-- ════════════════════════════════════════════════════════════
-- All FOR UPDATE SKIP LOCKED + lease logic lives in SQL FUNCTIONS (intent
-- brief HARD rule: never PostgREST .from().select() chains). These are
-- called by the service-role drainer (Card 3); SECURITY INVOKER means
-- they run with the caller's (service-role) privileges, which already
-- bypass RLS — no SECURITY DEFINER privilege-escalation surface is
-- introduced. MAX_ATTEMPTS = 3 (design §A.9 proposed cap).

-- ── claim_classifier_jobs ──────────────────────────────────────
-- design §A.3 claim CTE: SELECT due rows FOR UPDATE SKIP LOCKED, UPDATE
-- them to 'leased' (set lease, bump attempt_count + last_attempt_at),
-- RETURNING the claimed rows. One statement = one implicit transaction =
-- pooler-safe (does NOT depend on session advisory locks).
CREATE OR REPLACE FUNCTION public.claim_classifier_jobs(
  batch_size int,
  owner      text,
  lease      interval
)
RETURNS TABLE (
  id          uuid,
  argument_id uuid,
  family      text,
  run_mode    text
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH due AS (
    SELECT r.id
    FROM public.argument_machine_observation_runs r
    WHERE r.state IN ('pending', 'retry_scheduled')
      AND r.available_at <= now()
      AND r.family IS NOT NULL
    ORDER BY r.available_at, r.created_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.argument_machine_observation_runs r
     SET state            = 'leased',
         lease_owner      = claim_classifier_jobs.owner,
         lease_expires_at = now() + claim_classifier_jobs.lease,
         attempt_count    = r.attempt_count + 1,
         last_attempt_at  = now()
    FROM due
   WHERE r.id = due.id
  RETURNING r.id, r.argument_id, r.family, r.run_mode;
$$;

-- ── acquire_drain_lease ─────────────────────────────────────────
-- design §A.4 acquire: atomic conditional INSERT … ON CONFLICT (lock_key)
-- DO UPDATE … WHERE classifier_drain_lock.expires_at < now() RETURNING
-- owner. The ON CONFLICT WHERE fires the steal ONLY for an EXPIRED lease;
-- per-row linearizability means at most one of two concurrent acquirers
-- wins. The function RETURNS the owner of the held lease, or NULL when a
-- live lease is held by someone else (zero rows from the statement → the
-- caller exits = single-flight enforced).
CREATE OR REPLACE FUNCTION public.acquire_drain_lease(
  owner text,
  ttl   interval
)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO public.classifier_drain_lock (lock_key, owner, expires_at)
  VALUES ('classifier_drain', acquire_drain_lease.owner, now() + acquire_drain_lease.ttl)
  ON CONFLICT (lock_key) DO UPDATE
     SET owner       = EXCLUDED.owner,
         acquired_at = now(),
         expires_at  = EXCLUDED.expires_at
   WHERE classifier_drain_lock.expires_at < now()       -- only steal an EXPIRED lease
  RETURNING classifier_drain_lock.owner;                -- the column (qualified to disambiguate from the `owner` parameter)
$$;

-- ── release_drain_lease ─────────────────────────────────────────
-- design §A.4 release: best-effort DELETE of OWN lease only (the TTL is
-- the backstop if release is missed). Returns the number of rows deleted
-- (1 if this owner held the lease, 0 otherwise) so a test can assert that
-- a non-owner release deletes nothing.
CREATE OR REPLACE FUNCTION public.release_drain_lease(
  owner text
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.classifier_drain_lock
   WHERE lock_key = 'classifier_drain'
     AND classifier_drain_lock.owner = release_drain_lease.owner;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ── reclaim_stale_leases ────────────────────────────────────────
-- design §A.3 reconciler / §A.9 lease-expiry edge: a 'leased' row whose
-- lease_expires_at has passed is reset to 'retry_scheduled' (re-claimable
-- after available_at), OR 'dead_letter' once attempt_count has reached
-- the cap (MAX_ATTEMPTS = 3). attempt_count was bumped on claim, so a
-- perpetually-crashing job dead-letters rather than looping forever.
-- Returns the count of rows reclaimed (recovered + dead-lettered) for the
-- per-drain audit (§A.10 stale_leases_recovered).
CREATE OR REPLACE FUNCTION public.reclaim_stale_leases()
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  reclaimed_count int;
  max_attempts CONSTANT int := 3;     -- design §A.9 proposed total-attempt cap
BEGIN
  UPDATE public.argument_machine_observation_runs r
     SET state = CASE
                   WHEN r.attempt_count >= max_attempts THEN 'dead_letter'
                   ELSE 'retry_scheduled'
                 END,
         dead_letter_reason = CASE
                   WHEN r.attempt_count >= max_attempts
                     THEN 'lease_expired_attempt_cap_reached'
                   ELSE r.dead_letter_reason
                 END,
         -- retry_scheduled rows become re-claimable immediately; backoff
         -- on a genuine retry path is set by the drainer's terminal-write
         -- transition (Card 3), not by lease reclamation.
         available_at = CASE
                   WHEN r.attempt_count >= max_attempts THEN r.available_at
                   ELSE now()
                 END,
         lease_owner = NULL,
         lease_expires_at = NULL
   WHERE r.state = 'leased'
     AND r.lease_expires_at < now()
     AND r.family IS NOT NULL;
  GET DIAGNOSTICS reclaimed_count = ROW_COUNT;
  RETURN reclaimed_count;
END;
$$;

-- ── enqueue_classifier_job (DEFINED + TESTED here; WIRED in Card 2) ──
-- THE load-bearing correctness point (intent brief §"ON CONFLICT vs
-- partial indexes"): the idempotent-enqueue form MUST use
-- column-inference + predicate —
--   ON CONFLICT (argument_id, family, run_mode, schema_version)
--   WHERE <index #5 predicate> DO NOTHING
-- — NOT `ON CONFLICT ON CONSTRAINT …`, which CANNOT target a PARTIAL
-- unique index. The ON CONFLICT predicate below is byte-for-byte the
-- index #5 predicate (state IN ('pending','leased','retry_scheduled')
-- AND family IS NOT NULL). A second enqueue for an already-active cell
-- matches the partial index and is a no-op.
--
-- This function only DEFINES the enqueue SQL form so Card 1 can prove +
-- test it. It is NOT a submit-path wiring or cutover — Card 2 wires the
-- call site (replacing the synchronous dispatch). `family` is also
-- mirrored into requested_families (the canonical 1-element array) to
-- keep backward-compat with findExistingRun's requested_families read.
-- Returns the new row id, or NULL when the enqueue was a no-op (an active
-- job already exists for the cell).
CREATE OR REPLACE FUNCTION public.enqueue_classifier_job(
  p_argument_id    uuid,
  p_debate_id      uuid,
  p_family         text,
  p_run_mode       text,
  p_schema_version text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO public.argument_machine_observation_runs
    (argument_id, debate_id, family, run_mode, schema_version,
     requested_families, state, available_at, started_at)
  VALUES
    (p_argument_id, p_debate_id, p_family, p_run_mode, p_schema_version,
     ARRAY[p_family], 'pending', now(), now())
  ON CONFLICT (argument_id, family, run_mode, schema_version)
    WHERE state IN ('pending', 'leased', 'retry_scheduled') AND family IS NOT NULL
  DO NOTHING
  RETURNING id;
$$;


-- ════════════════════════════════════════════════════════════
-- COMMENTs (NO storage.* targets — PR-003 SQLSTATE 42501 boundary)
-- ════════════════════════════════════════════════════════════

COMMENT ON COLUMN public.argument_machine_observation_runs.family IS
  'ARCH-001: scalar family for a queue job (one of the baseline classifier '
  'families). NULL for historical / multi-family rows — every queue partial '
  'index is predicated family IS NOT NULL so those legacy rows are excluded.';

COMMENT ON COLUMN public.argument_machine_observation_runs.state IS
  'ARCH-001: queue lifecycle state (pending/leased/retry_scheduled/succeeded/'
  'failed_terminal/dead_letter). DISTINCT from status (the terminal-outcome '
  'field, success/failed/fallback, NULL until terminal). state is the new '
  'lifecycle field; status keeps its original meaning. cdiscourse-doctrine '
  '§1: an operational state, never a verdict about a participant.';

COMMENT ON COLUMN public.argument_machine_observation_runs.attempt_count IS
  'ARCH-001: number of times this job has been claimed. Bumped by '
  'claim_classifier_jobs. At the cap (3, design §A.9) a lease-expired job '
  'dead-letters instead of retrying forever.';

COMMENT ON COLUMN public.argument_machine_observation_runs.available_at IS
  'ARCH-001: earliest time the job may be claimed (retry backoff). A pending '
  'row defaults to now() (immediately claimable). The claim query excludes '
  'rows with available_at > now().';

COMMENT ON COLUMN public.argument_machine_observation_runs.lease_expires_at IS
  'ARCH-001: when the current lease expires (set on claim; NULL otherwise). '
  'A leased row past this time is reclaimed by reclaim_stale_leases.';

COMMENT ON COLUMN public.argument_machine_observation_runs.lease_owner IS
  'ARCH-001: opaque drainer-invocation id holding the current lease '
  '(diagnostic). cdiscourse-doctrine §6: NEVER a secret.';

COMMENT ON COLUMN public.argument_machine_observation_runs.failure_sub_reason IS
  'ARCH-001: typed failure sub-reason mirroring BooleanObservationFailureSubreason '
  '(e.g. provider_server_error, provider_capacity_exhausted, provider_rate_limited). '
  'cdiscourse-doctrine §6: a typed reason only — NEVER a raw provider body, '
  'prompt, or secret.';

COMMENT ON COLUMN public.argument_machine_observation_runs.dead_letter_reason IS
  'ARCH-001: typed reason a job was dead-lettered (e.g. '
  'lease_expired_attempt_cap_reached). Operational triage signal, never a verdict.';

COMMENT ON COLUMN public.argument_machine_observation_runs.last_attempt_at IS
  'ARCH-001: timestamp of the most recent claim. Feeds the §A.10 failure-class '
  'breakdown window.';

COMMENT ON COLUMN public.argument_machine_observation_runs.status IS
  'MCP-021B terminal-outcome field (success/failed/fallback). ARCH-001 dropped '
  'its NOT NULL so a pre-terminal queue row (state pending/leased/'
  'retry_scheduled) can exist with status NULL; the original CHECK is '
  'unchanged (NULL satisfies it). status is NULL until a terminal outcome.';

COMMENT ON TABLE public.classifier_drain_lock IS
  'ARCH-001: single-flight drain lease (design §A.4 Option B — TTL lease row, '
  'NOT advisory locks). One row keyed lock_key=''classifier_drain''. RLS '
  'enabled; service-role-only (no client policy). owner is an opaque drainer '
  'invocation id, NEVER a secret (cdiscourse-doctrine §6).';

COMMENT ON TABLE public.classifier_drain_audit IS
  'ARCH-001: append-only per-drain audit row feeding the §A.10 liveness '
  'monitoring SQL (queue health, last successful drain, skipped-tick + '
  'stale-lease-recovery counters). RLS enabled; service-role-only. These are '
  'operational counters — cdiscourse-doctrine §1: monitoring never implies a '
  'verdict.';

COMMENT ON FUNCTION public.claim_classifier_jobs(int, text, interval) IS
  'ARCH-001: claim up to batch_size due jobs FOR UPDATE SKIP LOCKED and lease '
  'them to owner for `lease`. design §A.3 claim CTE. Pooler-safe (one '
  'statement; no session advisory lock). SKIP LOCKED guarantees no two '
  'concurrent drainers claim the same row.';

COMMENT ON FUNCTION public.acquire_drain_lease(text, interval) IS
  'ARCH-001: atomic conditional acquire of the single-flight drain lease '
  '(design §A.4). Returns the held owner, or NULL if a live lease is held by '
  'someone else. An EXPIRED lease is stealable via the ON CONFLICT WHERE '
  'expires_at < now() precondition.';

COMMENT ON FUNCTION public.release_drain_lease(text) IS
  'ARCH-001: best-effort release of OWN drain lease (design §A.4). Returns the '
  'rows deleted (0 if the caller did not hold the lease). The TTL is the '
  'backstop if release is missed.';

COMMENT ON FUNCTION public.reclaim_stale_leases() IS
  'ARCH-001: reconciler (design §A.3 / §A.9). Resets lease-expired ''leased'' '
  'rows to ''retry_scheduled'', or ''dead_letter'' at the attempt cap (3). '
  'Returns the count reclaimed for the §A.10 audit.';

COMMENT ON FUNCTION public.enqueue_classifier_job(uuid, uuid, text, text, text) IS
  'ARCH-001: DEFINES the idempotent-enqueue SQL form (column-inference + '
  'index-#5 predicate ON CONFLICT DO NOTHING — NOT ON CONSTRAINT, which cannot '
  'target a partial index). DEFINED + TESTED in Card 1; WIRED into the submit '
  'path in Card 2. A second enqueue for an active cell is a no-op (returns NULL).';
