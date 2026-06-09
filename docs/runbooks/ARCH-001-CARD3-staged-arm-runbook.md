# ARCH-001 Card 3 — staged-arm + Vault-seed + smoke runbook (OPERATOR)

**Status:** OPERATOR runbook. Every step below is an operator action (GATE-C). The
implementation card (GATE-B) wrote the cron migration, the burst regression
test, this runbook, and the smoke harness; it **applied nothing, armed nothing,
seeded no secret, ran no smoke**. Do not execute any step here as part of CI.

**Reads:**
- Design: `docs/designs/ARCH-001-CARD3-PRODUCTION-SMOKE-STAGED-ROLLOUT.md` (§1 Vault, §2 arm, §3 smoke).
- Canonical gates: `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (PASS-LOAD = 0 terminal dead-letters at N=56; PASS-LOAD-CONFIRM; §F bar-integrity).
- Governance: `docs/core/pipeline-governance-contract.md` (the smoke-routing master-flag procedure; never-self-approve).
- Migration: `supabase/migrations/20260608000001_arch_001_card3_cron_drain_tick.sql`.
- Smoke harness: `scripts/arch-001-card3-smoke/`.

**No secret value appears anywhere in this file.** The `<…>` placeholders are
SHAPE ONLY (cdiscourse-doctrine §6). Never paste a real URL/secret into a
committed artifact.

---

## 0. Preconditions (confirm before touching anything)

1. The 4-card chain substrate is applied: migrations `20260528000021/022/023`
   plus the failure-detail follow-up are live (queue columns, finalizer,
   enqueue-kick, retry calibration).
2. The `classifier-drainer` Edge Function is deployed (auto on merge — it is
   `config.toml`-registered with `verify_jwt = false`) and its function secret
   `CLASSIFIER_DRAIN_SHARED_SECRET` is set.
3. Routing ships DEFAULT-DISABLED: `CLASSIFIER_QUEUE_ROUTING_ENABLED` is unset
   (or not exactly `true`). Confirm no env arms it yet.
4. The 3 decision points are resolved (see §5 of the design): DP-1 Anthropic
   tier (recommended: assume Tier 1, ship C=3), DP-2 Edge plan (ship T=90s
   against the 150s floor), DP-3 pg_cron granularity (60s `* * * * *`, one job).

---

## 1. Apply the cron-tick migration

```
npx supabase db push --linked
```

This installs `cron.schedule('arch-001-classifier-drain-tick', '* * * * *', …)`.
Migration-bearing → heightened reviewer verification (OPS-001). Because the tick
body has a **null-URL guard**, applying this BEFORE Vault is seeded is harmless:
each tick is a silent no-op until §2 completes.

Confirm exactly one job, no duplicate:

```sql
SELECT jobid, jobname, schedule
  FROM cron.job
 WHERE jobname = 'arch-001-classifier-drain-tick';   -- expect exactly 1 row
```

If `cron.job` shows more than one launcher-plus-this-one footprint, STOP
(`max_worker_processes = 6` is tight — design Risk R1). Do not add a second
cron job; reclaim runs inside each drain.

---

## 2. Seed the two Vault secrets (call SHAPE only — never commit real values)

Run via the Supabase SQL editor / psql. The `<shared-secret>` value **must
equal** the drainer function secret `CLASSIFIER_DRAIN_SHARED_SECRET` (same
string, two homes: Vault for the cron/kick caller; function env for the
validator). A mismatch → every tick/kick gets a 401 and the queue silently
never drains (caught by the §3 "no successful drain" alert).

```sql
SELECT vault.create_secret(
  '<https-drainer-url>',  'arch_001_classifier_drainer_url',
  'ARCH-001 classifier drainer Edge Function URL');
SELECT vault.create_secret(
  '<shared-secret>',      'arch_001_classifier_drainer_secret',
  'ARCH-001 classifier drainer shared secret (Bearer)');
```

Verify the tick fires after the seed (one manual tick produces an audit row):

```sql
-- Force one tick body now (same body the cron runs):
SELECT net.http_post(
  url     := (SELECT decrypted_secret FROM vault.decrypted_secrets
               WHERE name = 'arch_001_classifier_drainer_url' LIMIT 1),
  body    := jsonb_build_object('source', 'manual_verify'),
  headers := jsonb_build_object('Content-Type','application/json',
               'Authorization','Bearer ' || (
                 SELECT decrypted_secret FROM vault.decrypted_secrets
                  WHERE name = 'arch_001_classifier_drainer_secret' LIMIT 1)));
-- Within ~1 tick a classifier_drain_audit row should appear:
SELECT owner, outcome, jobs_processed FROM classifier_drain_audit
 ORDER BY started_at DESC LIMIT 3;
```

---

## 3. Staged-arm protocol (each transition is an independent operator decision)

Arming is governed by `pipeline-governance-contract.md`. **Never** advance a
percentage on a PARTIAL / PLUMBING / target-mitigation pass. The percentage
sequence is an allowed operator order, NOT an automatic ladder — each ≥1%
organic step is its own operator card.

| Step | Env on `submit-argument` | Effect | Gate to proceed |
|---|---|---|---|
| 0. Pre-arm | (none) | Drainer live, cron scheduled, Vault seeded. Routing OFF. | §1+§2 confirmed; `cron.job` shows the one tick; both Vault secrets present. |
| 1. Smoke arm | `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` | Smoke-tagged rooms only route; **0% organic** (every non-smoke submit stays byte-unchanged on direct dispatch). | Run the §4 smoke (canary → N=56). |
| 2. PASS-LOAD | (unchanged) | — | §4 PASS-LOAD achieved (0 terminal dead-letters at N=56 + structural gates). |
| 3. PASS-LOAD-CONFIRM | (unchanged) | — | A SECOND consecutive independent N=56 drill meeting all 15 gates. |
| 4. Organic 1% | `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1` (separate operator card) | A hash-bucketed 1% of organic args route. | Requires an organic Stage-1 pass (real non-smoke routed cells handled within budget). A PLUMBING/INSUFFICIENT-ORGANIC-VOLUME close does NOT advance. |
| 5. 5→25→50→100 | `PERCENTAGE=5,25,50,100` (one card per step) | Each step widens the bucket. | Each step needs real organic evidence at the prior percentage + a separate operator authorization card. No audit/doc/timer auto-advances. |
| Disarm (any time) | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` | Instant revert to direct dispatch for all new submits. In-flight queue jobs drain to terminal; optionally `cron.unschedule` the tick. | — |

Predicate semantics (the contract, `classifierQueueRouting.ts`):
- `enabled !== true` → false for everything (the ship state).
- `enabled === true` + title starts with `[arch-001-queue-smoke]` → true (smoke-tag override, even at `PERCENTAGE=0`).
- `enabled === true` + non-smoke title + `stableHashArgumentId(id) % 100 < pct` → true.
- `PERCENTAGE>0` with the master flag off is INERT.

---

## 4. The production smoke (synthetic only; leak-safe; poll-to-settle)

Run AFTER Step-1 smoke arm. Synthetic smoke-tagged rooms only; no organic user
text; no secrets in logs; H/I/J never run. Use the harness in
`scripts/arch-001-card3-smoke/` — it polls to ACTUAL settle (no fixed sleep).

1. **Canary (routing-path gate, NOT load evidence).** One
   `[arch-001-queue-smoke]…` submit → expect 7 A–G rows in
   `argument_machine_observation_runs` with `family IS NOT NULL`,
   `run_mode='production'`, **0 H/I/J rows**, all reaching `state='succeeded'`.
   HALT on any `family=NULL` queue row. A clean canary is a precondition for the
   burst (run `canary-completeness.sql`).
2. **N=56 burst** = 8 synthetic args × 7 families, posted in a tight window into
   smoke-tagged rooms. Poll `snapshot-a-queue-health.sql` every ~5s (bounded by
   a generous max wall, e.g. 10 min) until the settle predicate holds:
   `pending=0 AND due retry_scheduled=0 AND leased=0 AND stale leases=0 AND
   (drain lease not held OR last_drain_completed > final-submit-ts)`. Only THEN
   read completeness via `burst-completeness.sql`.

**PASS-LOAD = ALL of (bar NOT lowered):**
- **0 terminal dead-letters** across all 56 cells (`state='dead_letter'` = 0).
  `1/56 = 1.79% > 1%`, so "0 preferred" and "≤1%" reconcile to **0**.
- Structural gates green: dup=0 (index #4), overlap=0, `family=NULL` queue rows=0,
  0 H/I/J rows, every expected cell `succeeded` OR an explicit terminal with the
  correct typed reason, monitor healthy (oldest-pending ≤5min during burst).
- Submit nonblocking throughout (submit returns 201 before the dispatch fork).
- Leak-safe: re-scan every positive row's `evidence_span` + every `failure_*`
  field for verdict tokens (zero) and for `Bearer`/`sk-ant`/`sb_secret`/JWT in
  any drain-audit row or log line (zero).

**PASS-LOAD-CONFIRM = a second consecutive independent N=56 drill** meeting all
15 gates.

**PARTIAL** (completeness reached but async SLO band missed, or all dead-letters
were tunable `provider_*`): re-tune C/pacer and re-smoke. PARTIAL does NOT
advance the percentage.

**FAIL** (any terminal hole, duplicate success rows, submit blocked, H/I/J ran,
secret/raw leak, a classifier acceptance gate observed, OR a single-family
provider/server cluster ≥2 `provider_*` terminal failures): stop, triage via
`snapshot-b-failure-class.sql`.

Record the verdict in `docs/audits/ARCH-001-CARD3-SMOKE-<date>.md` AFTER running.

---

## 5. Disarm / rollback

- **Instant revert:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` → every new submit
  takes the unchanged direct-dispatch branch (still in the tree). No code
  redeploy, no migration rollback.
- **In-flight jobs:** continue draining to terminal via the cron tick + drainer.
- **Pause the tick:** `SELECT cron.unschedule('arch-001-classifier-drain-tick');`.
- The queue columns/rows are additive + inert when off — nothing to migrate back.

The "isolated provider dead_letter tolerated / `distinct_dead_letter_families=1`"
rule governs the **disarm (rollback)** decision for an already-armed organic
window ONLY — it NEVER admits a nonzero-dead-letter run to PASS-LOAD (gate doc
§F item 1, ratified).

---

## 6. Relationship to the Family-H gate (precondition, not the gate)

A clean N=56 PASS-LOAD (+ PASS-LOAD-CONFIRM) is a **precondition** for the
Family-H re-attempt, not Family-H itself. H/I/J stay `productionEnabled:false`;
the smoke asserts 0 H/I/J rows. The Family-H re-attempt is a separate later card
that consumes this clean smoke as input.
