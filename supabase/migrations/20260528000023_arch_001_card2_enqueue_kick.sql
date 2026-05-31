-- ============================================================
-- Migration: 20260528000023_arch_001_card2_enqueue_kick
-- Description: ARCH-001 Card 2 — the two-channel drainer invocation
--   (parent design §A.2):
--     (a) the enqueue-KICK: a statement-level AFTER INSERT trigger on
--         public.argument_machine_observation_runs that fires
--         net.http_post to the drainer URL ONCE per statement (a batch
--         enqueue = one multi-row INSERT = one kick), guarded by
--         pg_try_advisory_xact_lock so concurrent submits coalesce; and
--     (b) the periodic SAFETY TICK: a pg_cron job at the LOCKED 60s
--         interval that net.http_posts the same drainer URL.
--   Both read the drainer URL + the shared service secret from Supabase
--   Vault (vault.decrypted_secrets) — NEVER hardcoded (cdiscourse-doctrine
--   §6). NOTHING here makes a provider call; the kick/tick only POST to the
--   drainer Edge Function, which is single-flight (design §A.4) so duplicate
--   tick+kick collapse to one drain.
--
-- Card: ARCH-001 Card 2
--   - Intent brief (authoritative scope + the 6 LOCKED carry-forward +
--     LOCKED defaults + operator prerequisites + guardrails + tests):
--     docs/designs/ARCH-001-CARD2-DRAINER-ENQUEUE-intent.md
--   - Parent design (the kick/tick mechanism source of truth):
--     docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md
--     §A.2 ("Decision: statement-level AFTER INSERT trigger calling
--     net.http_post once per statement, guarded by an advisory
--     pg_try_advisory_xact_lock on a kick key"), §A.11 step 1 (the cron
--     tick is applied AFTER the drainer is deployed + the Vault secret is
--     seeded — scheduling it before would net.http_post a null URL).
-- Predecessor migrations:
--   - 20260528000021_arch_001_classifier_queue_substrate.sql (Card 1:
--     enabled pg_cron + pg_net, added the queue lifecycle columns
--     state/family/available_at, and the enqueue/claim/lease/reclaim/
--     release SQL functions. THIS migration's kick trigger fires on the
--     queue rows enqueue_classifier_job INSERTs.)
--   - 20260528000022_arch_001_card2a_atomic_finalizer.sql (Card 2A:
--     finalize_classifier_job — the atomic terminal-write the drainer
--     calls. THIS file sorts AFTER it.)
--
-- ── OPERATOR GATE ──────────────────────────────────────────────
-- This migration is WRITTEN, NOT APPLIED. The operator applies it via
-- `npx supabase db push --linked` AFTER merge. Applying it installs the
-- enqueue-kick trigger; because the Card-2 routing flag ships DISABLED
-- (shouldRouteToQueue returns false for everything except the smoke tag),
-- no ordinary submit enqueues a queue row, so the trigger is INERT for
-- ordinary traffic until the operator enables smoke routing.
--
-- The kick trigger reads the drainer URL + secret from Vault. If the Vault
-- secret has NOT been seeded yet (the operator seeds it AFTER deploying the
-- drainer), the trigger DOES NOT fail the INSERT — it skips the kick
-- silently (see the function body) and the periodic tick is the safety net.
-- This is the OPS-001 ordering requirement (§A.11 step 1): applying this
-- migration before the Vault secret + the drainer exist must NOT break
-- enqueue. The periodic cron tick (Channel 1) is therefore NOT scheduled by
-- this migration — it is a clearly-commented operator step at the bottom of
-- this file, applied AFTER drainer-deploy + Vault-seed.
--
-- ── Doctrine encoded ───────────────────────────────────────────
--   - cdiscourse-doctrine §6/§7: NO secret literal anywhere. The drainer
--     URL + service secret are read from Vault at trigger/cron runtime via
--     vault.decrypted_secrets — never embedded in this SQL, never logged.
--     The trigger NEVER RAISEs/LOGs the URL, the secret, the Authorization
--     header value, or any net.http_post response body. No argument body,
--     prompt, or model output is read or sent (the kick POST body is a tiny
--     constant trigger marker JSON, not user content).
--   - cdiscourse-doctrine §1/§10a: the kick is pure transport scheduling —
--     no verdict, no truth value, no popularity/heat/engagement input. It
--     fires on the FACT that a queue row was inserted, never on any score.
--   - cdiscourse-doctrine §8: RLS on the runs table is UNCHANGED. No new
--     table, no column change, no index change, no policy. ZERO
--     `CREATE POLICY` / `CREATE TABLE` / `ALTER TABLE … ENABLE ROW LEVEL
--     SECURITY` / `ADD COLUMN` / `ALTER COLUMN` here.
--
-- ── OPS-001 §4 four-class posture ──────────────────────────────
--   Class A (extensions)   : none — pg_cron + pg_net were enabled by Card 1
--                            (20260528000021). This file CREATEs neither.
--   Class B (columns)      : none — no column change.
--   Class C (constraints)  : none — no new table / CHECK / constraint.
--   Class D (indexes)      : none.
--   Class E (functions/    : the trigger function + the CREATE TRIGGER +
--            triggers/        the COMMENTs. Created AFTER the columns
--            comments)        (state/family) and the table the trigger
--                             attaches to (all from predecessors).
--   Class 1 (ambiguous refs): the trigger function reads the transition
--     table `inserted_rows` with a fully-qualified column reference and
--     reads Vault via `vault.decrypted_secrets` with explicit column names;
--     no bare ambiguous reference.
--   Class 2 (type mismatches): the advisory-lock key is a bigint literal;
--     net.http_post is called with (url text, body jsonb, headers jsonb) —
--     the documented pg_net signature.
--   Class 3 (ordering): the trigger FUNCTION is created before the
--     CREATE TRIGGER that binds it; the COMMENTs come last.
--   Class 4 (function/extension deps): net.http_post requires pg_net (Card
--     1 enabled it WITH SCHEMA extensions); vault.decrypted_secrets requires
--     the Vault extension (verified installed — design I5). NO
--     `COMMENT ON … storage.*` (PR-003 SQLSTATE 42501 boundary preserved).
--
-- ── No client write path ───────────────────────────────────────
-- ZERO `CREATE POLICY … FOR (INSERT|UPDATE|DELETE)` in this migration. The
-- reviewer's mechanical check:
--   grep -E "CREATE POLICY .* FOR (INSERT|UPDATE|DELETE)" \
--     supabase/migrations/20260528000023_*.sql
-- must return zero matches.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- Class E — KICK TRIGGER FUNCTION (Channel 2: the latency path)
-- ════════════════════════════════════════════════════════════
-- A STATEMENT-level AFTER INSERT trigger fires this function ONCE per
-- INSERT statement (design §A.2 "once per statement"). enqueue_classifier_job
-- INSERTs the 7 family-jobs for one submit as one multi-row INSERT, so a
-- whole submit's enqueue → exactly ONE kick (not 7). The function:
--
--   1. Confirms the statement actually inserted at least one QUEUE row
--      (a pending row with family IS NOT NULL). The direct-dispatch writer
--      (persistenceWriter.persistRun) also INSERTs into this table but with
--      state defaulting to 'succeeded' and family NULL — those rows must NOT
--      trigger a kick. The transition table `inserted_rows` lets the
--      statement-level trigger inspect what was inserted.
--   2. Coalesces concurrent submits via pg_try_advisory_xact_lock(<kick_key>):
--      a submit transaction that fails to grab the transient kick-lock skips
--      its own kick (the in-flight drain — or the next tick — will pick up
--      its freshly-INSERTed jobs). Worst case: a burst of N simultaneous
--      submits → 1 kick (design §A.2 "Bounded: at most one in-flight kick
--      per short window"). Even if the debounce fails open and N kicks fire,
--      single-flight (design §A.4) collapses them to one drain.
--   3. Reads the drainer URL + the shared service secret from Supabase
--      Vault. If EITHER is absent (Vault not yet seeded — the OPS-001
--      ordering window), the function RETURNS without kicking and WITHOUT
--      raising — the periodic tick is the safety net. Enqueue is never
--      broken by a missing Vault secret.
--   4. Fires net.http_post(url, body, headers) fire-and-forget (pg_net is
--      async — it queues the request and returns immediately; the INSERT
--      transaction does NOT wait on the drainer). The Authorization header
--      carries the Vault secret; NEITHER the URL, the secret, the header,
--      nor any response is ever logged.
--
-- Vault secret names (operator seeds these; NOT secrets-in-git — these are
-- just the KEY NAMES the function looks up):
--   'arch_001_classifier_drainer_url'    → the drainer Edge Function URL.
--   'arch_001_classifier_drainer_secret' → the shared secret the drainer
--                                           validates on its apikey/Authorization
--                                           header (verify_jwt=false posture).
--
-- The kick key (advisory lock) is a fixed bigint constant; it lives only in
-- the transaction's lock space (pg_try_advisory_xact_lock auto-releases at
-- COMMIT) so it never persists and never collides with row data.
CREATE OR REPLACE FUNCTION public.arch_001_kick_classifier_drainer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  -- Fixed advisory-lock key for the kick debounce. Transaction-scoped
  -- (pg_try_advisory_xact_lock) so it auto-releases at COMMIT. A constant
  -- shared by every submit so concurrent submits contend on the SAME key
  -- and coalesce to one kick.
  kick_key      CONSTANT bigint := 7700100023;   -- arbitrary fixed ARCH-001 kick namespace
  v_has_queue_row boolean;
  v_url         text;
  v_secret      text;
BEGIN
  -- 1. Did this statement insert any QUEUE row? (pending + family NOT NULL).
  --    Direct-dispatch run rows (state='succeeded' default, family NULL) are
  --    excluded — they must not kick the drainer.
  SELECT EXISTS (
    SELECT 1
    FROM inserted_rows ir
    WHERE ir.state = 'pending'
      AND ir.family IS NOT NULL
  ) INTO v_has_queue_row;

  IF NOT v_has_queue_row THEN
    RETURN NULL;   -- AFTER trigger: return value is ignored; NULL is conventional.
  END IF;

  -- 2. Debounce: only the first concurrent submit in this window kicks.
  IF NOT pg_try_advisory_xact_lock(kick_key) THEN
    RETURN NULL;   -- another submit already holds the kick-lock; it will kick.
  END IF;

  -- 3. Read the drainer URL + secret from Vault. Absent → skip silently
  --    (Vault not seeded yet; the periodic tick covers liveness). NEVER
  --    raise on a missing secret — enqueue must not break.
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
   WHERE name = 'arch_001_classifier_drainer_url'
   LIMIT 1;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'arch_001_classifier_drainer_secret'
   LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL OR length(v_url) = 0 OR length(v_secret) = 0 THEN
    RETURN NULL;   -- Vault not seeded → no kick; the cron tick is the safety net.
  END IF;

  -- 4. Fire the kick (fire-and-forget; pg_net queues + returns immediately).
  --    The body is a tiny constant trigger marker — NOT user content. The
  --    secret rides ONLY the Authorization header. Nothing here is logged.
  --    A pg_net failure must not break the INSERT, so the call is wrapped:
  --    on any error the function swallows it (the tick is the backstop).
  BEGIN
    PERFORM net.http_post(
      url     := v_url,
      body    := jsonb_build_object('source', 'enqueue_kick'),
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_secret
                 )
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net unavailable / transient → rely on the periodic tick. NEVER
    -- surface SQLERRM (it could echo the URL/host); swallow silently.
    RETURN NULL;
  END;

  RETURN NULL;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- Class E — THE STATEMENT-LEVEL AFTER INSERT TRIGGER
-- ════════════════════════════════════════════════════════════
-- REFERENCING NEW TABLE AS inserted_rows gives the statement-level trigger
-- function a transition table to inspect what the statement inserted
-- (Postgres 10+; required to fire ONCE per statement yet still tell a queue
-- INSERT from a direct-dispatch INSERT). FOR EACH STATEMENT (NOT FOR EACH
-- ROW) is what makes a 7-row enqueue fire exactly one kick.
DROP TRIGGER IF EXISTS arch_001_kick_classifier_drainer_trg
  ON public.argument_machine_observation_runs;

CREATE TRIGGER arch_001_kick_classifier_drainer_trg
  AFTER INSERT ON public.argument_machine_observation_runs
  REFERENCING NEW TABLE AS inserted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.arch_001_kick_classifier_drainer();


-- ════════════════════════════════════════════════════════════
-- COMMENTs (NO storage.* targets — PR-003 SQLSTATE 42501 boundary)
-- ════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.arch_001_kick_classifier_drainer() IS
  'ARCH-001 Card 2: enqueue-kick (design §A.2 Channel 2 / latency path). '
  'Statement-level AFTER INSERT trigger function — fires ONE net.http_post '
  'to the drainer per INSERT statement that inserted >=1 queue row '
  '(state=pending, family NOT NULL), guarded by pg_try_advisory_xact_lock so '
  'concurrent submits coalesce to one kick. Reads the drainer URL + service '
  'secret from Supabase Vault (vault.decrypted_secrets); a missing/unseeded '
  'secret SKIPS the kick silently (the periodic tick is the safety net) and '
  'NEVER fails the INSERT. cdiscourse-doctrine §6: NEVER logs the URL, the '
  'secret, the Authorization header, or any net.http_post response.';


-- ════════════════════════════════════════════════════════════
-- OPERATOR-APPLIED (NOT APPLIED BY THIS MIGRATION): the periodic tick
-- ════════════════════════════════════════════════════════════
-- design §A.2 Channel 1 (safety net) + §A.11 step 1 (sequencing): the
-- periodic pg_cron tick is INTENTIONALLY NOT scheduled in this migration.
-- Scheduling it before the drainer is deployed + the Vault secret is seeded
-- would net.http_post a null/unauthenticated URL. The operator runs the
-- block below AS A SEPARATE STEP, AFTER:
--   (1) `npx supabase functions deploy classifier-drainer --linked` (or the
--       Supabase GitHub integration auto-deploy on merge), confirming the
--       drainer is live, and
--   (2) seeding the two Vault secrets (URL + shared secret), e.g.:
--         SELECT vault.create_secret(
--           '<https-drainer-url>', 'arch_001_classifier_drainer_url',
--           'ARCH-001 classifier drainer Edge Function URL');
--         SELECT vault.create_secret(
--           '<shared-secret>',     'arch_001_classifier_drainer_secret',
--           'ARCH-001 classifier drainer shared secret (Bearer)');
--       (Run via the Supabase SQL editor / psql; NEVER commit the secret.)
--
-- THEN schedule the 60s safety tick (LOCKED 60s interval — design §A.5; the
-- enqueue-kick gives sub-second latency on the happy path, so the tick need
-- not be sub-minute). The cron command reads the SAME Vault secrets at run
-- time, so no secret appears in cron.job either:
--
--   SELECT cron.schedule(
--     'arch-001-classifier-drain-tick',
--     '60 seconds',
--     $CRON$
--       SELECT net.http_post(
--         url     := (SELECT decrypted_secret FROM vault.decrypted_secrets
--                      WHERE name = 'arch_001_classifier_drainer_url' LIMIT 1),
--         body    := jsonb_build_object('source', 'cron_tick'),
--         headers := jsonb_build_object(
--                      'Content-Type', 'application/json',
--                      'Authorization', 'Bearer ' || (
--                        SELECT decrypted_secret FROM vault.decrypted_secrets
--                         WHERE name = 'arch_001_classifier_drainer_secret' LIMIT 1))
--       );
--     $CRON$
--   );
--
-- To pause the tick during a rollback:
--   SELECT cron.unschedule('arch-001-classifier-drain-tick');
--
-- Duplicate tick+kick are harmless: the drainer is single-flight (design
-- §A.4) so they collapse to one drain. Keep the cron footprint to this ONE
-- job (design Risk: max_worker_processes=6 is tight).
-- ════════════════════════════════════════════════════════════
