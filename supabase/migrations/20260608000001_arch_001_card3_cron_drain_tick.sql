-- ============================================================
-- Migration: 20260608000001_arch_001_card3_cron_drain_tick
-- Description: ARCH-001 Card 3 — schedule the periodic SAFETY TICK
--   (parent design §A.2 Channel 1 / the liveness backstop). Card 2 left the
--   cron tick as a COMMENTED operator runbook step at the bottom of
--   20260528000023; the ARCH-001 Card-3 issue (#552) directs Card 3 to ship
--   it as a version-controlled, reviewable, idempotent, rollback-documented
--   migration. This file adds EXACTLY ONE thing: a single
--   `cron.schedule('arch-001-classifier-drain-tick', '* * * * *', …)` whose
--   command reads the drainer URL + shared secret from Supabase Vault
--   (vault.decrypted_secrets) AT EACH TICK'S RUNTIME and net.http_posts the
--   drainer. NOTHING here makes a provider call; the tick only POSTs to the
--   drainer Edge Function, which is single-flight (design §A.4) so a duplicate
--   tick+kick collapses to one drain.
--
--   The one improvement over Card 2's bare commented example: the tick body
--   is wrapped in a DO block with a NULL-URL GUARD, so a tick that fires
--   BEFORE the operator has seeded Vault is a SILENT no-op (RETURN), never a
--   noisy failed net.http_post against a NULL url. This is the OPS-001
--   ordering safety: the migration may be applied before Vault is seeded
--   without generating cron.job_run_details error noise; the tick simply
--   starts draining once Vault is seeded + the drainer is live.
--
-- Card: ARCH-001 Card 3 (the final card of the 4-card chain: Card 1
--   substrate / Card 2 drainer+enqueue / Card 2A atomic finalizer — all
--   shipped + applied; Card 3 = the cron tick + staged-arm protocol + smoke).
--   - Design (the source of truth for this migration's shape):
--     docs/designs/ARCH-001-CARD3-PRODUCTION-SMOKE-STAGED-ROLLOUT.md §1(a)
--   - Parent design (the kick/tick mechanism source of truth):
--     docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md
--     §A.2 (Channel 1 safety tick), §A.11 step 1 (the tick is scheduled
--     AFTER the drainer is deployed + the Vault secret is seeded — the
--     null-URL guard makes a pre-seed apply harmless).
-- Predecessor migrations:
--   - 20260528000021_arch_001_classifier_queue_substrate.sql (Card 1:
--     enabled pg_cron + pg_net via CREATE EXTENSION, added the queue
--     lifecycle columns + the enqueue/claim/lease/reclaim/release SQL
--     functions. THIS migration relies on pg_cron + pg_net already being
--     installed and does NOT re-CREATE EXTENSION them.)
--   - 20260528000023_arch_001_card2_enqueue_kick.sql (Card 2: the
--     statement-level enqueue-kick trigger + the COMMENTED cron-tick runbook
--     block this migration promotes to a real cron.schedule. Same Vault
--     secret names; same silent-skip-on-unseeded posture.)
--
-- ── OPERATOR GATE ──────────────────────────────────────────────
-- This migration is WRITTEN, NOT APPLIED. The operator applies it via
-- `npx supabase db push --linked` AFTER merge, AFTER:
--   (1) the classifier-drainer Edge Function is live (auto-deployed on merge
--       via the Supabase GitHub integration — it is config.toml-registered),
--       and
--   (2) the two Vault secrets are seeded (URL + shared secret). The seed is
--       an OPERATOR runbook step (vault.create_secret), NEVER committed to
--       git, NEVER embedded in this migration — only its call SHAPE is shown
--       in the commented runbook block at the bottom.
-- Because the tick body has a NULL-URL guard, applying this migration BEFORE
-- step (2) is harmless: each tick is a silent no-op until Vault is seeded.
-- Routing still ships DEFAULT-DISABLED (shouldRouteToQueue returns false for
-- everything except the smoke tag, and only when the master flag is on), so
-- an applied tick on an unarmed system simply finds an empty queue and exits.
--
-- ── Doctrine encoded (cdiscourse-doctrine) ─────────────────────
--   - §6/§7: NO secret literal anywhere. The drainer URL + shared secret are
--     read from Vault at CRON RUNTIME via vault.decrypted_secrets — never
--     embedded in this SQL, never logged. The tick body NEVER RAISEs/LOGs the
--     URL, the secret, the Authorization header value, or any net.http_post
--     response. The POST body is a tiny constant marker JSON, not user
--     content. No argument body, prompt, or model output is read or sent.
--   - §1/§10a: the tick is pure transport scheduling — no verdict, no truth
--     value, no popularity/heat/engagement input. It fires on a fixed clock,
--     never on any score. The drainer it pokes claims jobs in arrival FIFO
--     order (Card-1 claim SQL); the tick adds no ordering signal.
--   - §8: RLS on every table is UNCHANGED. No new table, no column change, no
--     index change, no policy. The cron job is a row in the pg_cron `cron.job`
--     catalog, NOT an application table. ZERO `CREATE POLICY` /
--     `CREATE TABLE` / `ALTER TABLE … ENABLE ROW LEVEL SECURITY` /
--     `ADD COLUMN` / `ALTER COLUMN` / `CREATE INDEX` here.
--
-- ── OPS-001 §4 four-class posture ──────────────────────────────
--   Class A (extensions)   : NONE — pg_cron + pg_net were enabled by Card 1
--                            (20260528000021). This file CREATEs NEITHER.
--   Class B (columns)      : NONE — no column change.
--   Class C (constraints)  : NONE — no new table / CHECK / constraint.
--   Class D (indexes)      : NONE.
--   Class E (functions/    : the single cron.schedule(...) call. Created
--            triggers/cron)   AFTER all objects it references (the drainer
--                             URL/secret are RUNTIME Vault reads, not
--                             compile-time deps; net.http_post / pg_cron /
--                             vault.decrypted_secrets all pre-exist). NO
--                             `COMMENT ON … storage.*` (PR-003 SQLSTATE 42501
--                             boundary preserved).
--   Class 1 (ambiguous refs): the tick body reads vault.decrypted_secrets
--     with explicit column names (decrypted_secret, name); no bare ambiguous
--     reference.
--   Class 2 (type mismatches): net.http_post is called with
--     (url text, body jsonb, headers jsonb) — the documented pg_net signature.
--   Class 3 (ordering): a single statement; no intra-file ordering hazard.
--   Class 4 (function/extension deps): net.http_post requires pg_net,
--     cron.schedule requires pg_cron, vault.decrypted_secrets requires the
--     Vault extension — ALL pre-installed (Card 1 + design I5).
--
-- ── No client write path ───────────────────────────────────────
-- ZERO `CREATE POLICY … FOR (INSERT|UPDATE|DELETE)` in this migration. The
-- reviewer's mechanical check:
--   grep -E "CREATE POLICY .* FOR (INSERT|UPDATE|DELETE)" \
--     supabase/migrations/20260608000001_*.sql
-- must return zero matches.
--
-- ── One cron job only (H8 worker headroom) ─────────────────────
-- max_worker_processes = 6 is tight (design Risk R1 / DP-3). The footprint
-- stays at EXACTLY ONE cron job. A separate reclaim cron is NOT added —
-- reclaim_stale_leases runs INSIDE every drain (classifierDrainerCore.ts).
-- Do NOT schedule a sub-minute tick: the pg_cron interval form '[1-59]
-- seconds' reliability is unconfirmed (design I2 PARTIAL), and the
-- enqueue-kick is the sub-second latency path, so the tick need only be the
-- 60s safety net.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- Class E — SCHEDULE THE 60s DRAIN SAFETY TICK (Channel 1)
-- ════════════════════════════════════════════════════════════
-- cron.schedule(jobname, schedule, command) UPSERTs by jobname: re-applying
-- this migration updates the existing 'arch-001-classifier-drain-tick' job in
-- place rather than creating a duplicate (idempotent re-apply).
--
-- Schedule '* * * * *' = standard 5-field cron = once per minute (60s
-- cadence). The pg_cron *interval* form '60 seconds' is REJECTED with
-- 22023 invalid_schedule (only '[1-59] seconds' is valid); the standard cron
-- form gives the same 60s cadence and is the LOCKED choice (design §1).
--
-- The command is a DO block (not a bare SELECT net.http_post(...)) so the
-- NULL-URL GUARD can RETURN silently when Vault is not yet seeded — mirroring
-- the enqueue-kick's silent-skip posture (20260528000023). The drainer URL +
-- shared secret are read from Vault AT RUNTIME; no secret literal sits in
-- this SQL or in the cron.job catalog row.
--
-- Vault secret names (operator seeds these AS A SEPARATE STEP — see the
-- runbook block below; these are just the KEY NAMES the tick looks up, not
-- secrets):
--   'arch_001_classifier_drainer_url'    → the drainer Edge Function URL.
--   'arch_001_classifier_drainer_secret' → the shared secret the drainer
--                                           validates on its Authorization
--                                           header (must equal the function
--                                           secret CLASSIFIER_DRAIN_SHARED_SECRET).
SELECT cron.schedule(
  'arch-001-classifier-drain-tick',
  '* * * * *',
  $CRON$
    DO $tick$
    DECLARE
      v_url    text;
      v_secret text;
    BEGIN
      -- Read the drainer URL + shared secret from Vault at tick runtime.
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets
       WHERE name = 'arch_001_classifier_drainer_url'
       LIMIT 1;

      SELECT decrypted_secret INTO v_secret
        FROM vault.decrypted_secrets
       WHERE name = 'arch_001_classifier_drainer_secret'
       LIMIT 1;

      -- NULL-URL GUARD: Vault not seeded yet (the OPS-001 ordering window) →
      -- silent no-op. The NEXT tick retries. NEVER net.http_post a NULL url
      -- (which would log a failed request every minute during the seed
      -- window), NEVER RAISE (which would noise up cron.job_run_details).
      IF v_url IS NULL OR v_secret IS NULL
         OR length(v_url) = 0 OR length(v_secret) = 0 THEN
        RETURN;
      END IF;

      -- Fire the drain poke (fire-and-forget; pg_net queues + returns
      -- immediately). The secret rides ONLY the Authorization header. The
      -- body is a tiny constant marker — NOT user content. Nothing is logged.
      PERFORM net.http_post(
        url     := v_url,
        body    := jsonb_build_object('source', 'cron_tick'),
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'Authorization', 'Bearer ' || v_secret
                   )
      );
    END
    $tick$;
  $CRON$
);


-- ════════════════════════════════════════════════════════════
-- OPERATOR RUNBOOK (NOT executed by this migration): seed Vault + rollback
-- ════════════════════════════════════════════════════════════
-- Seed the two Vault secrets the tick (and the Card-2 enqueue-kick) read.
-- Run via the Supabase SQL editor / psql — NEVER commit the real values; the
-- '<…>' placeholders below are SHAPE ONLY and are NEVER real values in any
-- committed artifact (cdiscourse-doctrine §6). The <shared-secret> value MUST
-- EQUAL the drainer's function secret CLASSIFIER_DRAIN_SHARED_SECRET (same
-- string, two homes: Vault for the caller; function env for the validator).
--
--   SELECT vault.create_secret(
--     '<https-drainer-url>',  'arch_001_classifier_drainer_url',
--     'ARCH-001 classifier drainer Edge Function URL');
--   SELECT vault.create_secret(
--     '<shared-secret>',      'arch_001_classifier_drainer_secret',
--     'ARCH-001 classifier drainer shared secret (Bearer)');
--
-- Verify the tick after apply (design DP-3):
--   SELECT jobid, jobname, schedule FROM cron.job
--    WHERE jobname = 'arch-001-classifier-drain-tick';   -- exactly one row
--   -- After Vault seed, one tick should produce a classifier_drain_audit row.
--
-- Rollback (pause the tick during a disarm):
--   SELECT cron.unschedule('arch-001-classifier-drain-tick');
-- The enqueue-kick continues to drive the drainer for any still-routed args;
-- combined with the master-flag disarm (CLASSIFIER_QUEUE_ROUTING_ENABLED=false)
-- the queue goes fully dormant. No data migration to roll back — the queue
-- columns/rows are additive + inert when off.
-- ════════════════════════════════════════════════════════════
