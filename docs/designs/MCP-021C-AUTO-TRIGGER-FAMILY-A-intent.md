# MCP-021C-AUTO-TRIGGER-FAMILY-A — Intent Brief

**Card:** MCP-021C-AUTO-TRIGGER-FAMILY-A — Automatic Family A
boolean-observation classification for new arguments

**Goal:** convert the already-proven manual production-mode Family A
path into a safe automatic production trigger on newly created arguments,
while preserving safety, idempotency, rate/cost protection, Source 6
rendering discipline, and manual/admin invocation compatibility.

**This card is:**

* The production-trigger card for Family A only.
* M-L effort: load-bearing design phase (idempotency strategy + trigger-
  site decision + retry semantics); small implementation relative to
  design weight.

**This card is NOT:**

* A taxonomy card.
* A prompt-tuning card.
* A Family B-J card.
* A historical-backfill card.

---

## 1. Sequencing chain

```
MCP-021A  taxonomy + parser:                       d6648b4
MCP-021B  persistence + Source 6 adapter:          eaa1aeb (smoke 6feeb08)
MCP-021C-EDGE  runtime spine:                      9a4de95
MCP-SERVER-001  server foundation:                 8a1652c (smoke bae4984)
MCP-SERVER-002  Family A classifier:               27bb837 (smoke fc28605)
MCP-021C-EDGE-SMOKE  end-to-end:                   ebf4482
MCP-021C-EDGE-RESPONSE-SUMMARY-FIX:                c5c6d9b
MCP-021C-FAMILY-A-PROD-SMOKE  PASS:                67fcba5
Current HEAD:                                       67fcba5 or later
```

---

## 2. Proof already established by the predecessor chain

* Family A classifier works (server, edge, persistence, render).
* Manual production-mode invocation produces 3 positives per non-root
  fixture argument; HIGH agreement with admin-mode baseline.
* Source 6 production rendering tested via Tier-1 evidence
  (`S6F-4` + `BND-5` + `MIG-6/7` + invariance tests).
* Admin / production coexistence is benign; Source 6 filter holds at
  `machineObservationPersistenceQuery.ts:127`.
* Response-summary fix is live in deployed Edge Function (`c5c6d9b`,
  function version v19 on `2026-05-27 03:32 UTC`).

---

## 3. Strict scope

**ALLOWED:**

* Add a trigger that invokes `classify-argument-boolean-observations`
  asynchronously when a new argument is created.
* Idempotency strategy per Decision 4.
* Bounded retry per Decision 5.
* Skip-on-disabled-config + skip-on-family-not-enabled rate/cost guards.
* Structured logging per Decision 9.
* Tests for trigger, idempotency, retry, failure, security boundary.
* Optional migration ONLY if Decision 4 chooses Option B AND source
  inspection proves it's the right call.

**DISALLOWED:**

* New families (Family B-J remain scaffolded out of scope).
* New taxonomy keys.
* MCP server prompt changes.
* UI / display cap changes (UX-001.5A caps preserved byte-equal).
* Historical backfill (deferred to MCP-021C-FAMILY-A-BACKFILL).
* Client-side MCP fetch / EXPO_PUBLIC_ MCP credentials.
* Service-role client in app/client code.
* Source 6 filter weakening or admin-row leakage.

---

## 4. Binding decisions (1-10)

### Decision 1 — Trigger mode: asynchronous, non-blocking

Argument submission MUST NOT wait for classifier completion. Preferred
implementation order:

1. Existing post-submit async hook / queue if present.
2. Else server-side fire-and-forget invocation after argument write.
3. Else minimal Edge Function helper called after argument creation.

No client-visible blocking wait. Argument insert succeeds or fails on
its own; classification trigger is a separate concern.

### Decision 2 — Trigger scope: new arguments only

Only newly created arguments after this card ships. No historical
backfill. Backfill is a separate future operator card.

### Decision 3 — Family scope: parent_relation only

Auto-trigger payload (binding):

```json
{
  "argumentIds": ["<new-argument-id>"],
  "requestedFamilies": ["parent_relation"],
  "mode": "production",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

### Decision 4 — Idempotency: explicit strategy required

Designer chooses ONE in Phase A.3:

**OPTION A — Query-before-create with existing columns.**
Pre-INSERT SELECT against `argument_machine_observation_runs` for matching
`(argument_id, schema_version, requested_families, run_mode='production',
provider_key, model_name, classifier_set_version)`. If match exists with
`status='success'`, skip auto-trigger and log `already_classified`. If
match exists with `status='failed'`, allow re-attempt per Decision 5.
**Pro:** no migration. **Con:** race condition possible if two triggers
fire concurrently; acceptable if duplicate-run cost is low.

**OPTION B — New unique index migration.**
Migration adding UNIQUE constraint on `(argument_id, schema_version,
requested_families, run_mode, provider_key, model_name,
classifier_set_version) WHERE status='success'`. Race condition
eliminated by DB constraint. **Pro:** hard guarantee. **Con:** migration
required; if `requested_families` is jsonb, expression index may be
needed.

**OPTION C — Application-level advisory lock + query-before-create.**
Supabase advisory lock on `hash(argument_id, family)` before classifier
invocation; pre-INSERT SELECT as in Option A but under lock. **Pro:** race
condition eliminated without migration. **Con:** more code; lock
acquisition adds latency.

**DEFAULT LEAN:** Option A for v1; file
`MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING` as follow-up if
production traffic surfaces race conditions.

Designer documents choice + rationale + why others ruled out.

### Decision 5 — Retry semantics: bounded retry on transient failure

| Failure mode                                       | Retry?         | Cap        |
| -------------------------------------------------- | -------------- | ---------- |
| network error / timeout                            | Yes            | 2 attempts |
| HTTP 429 rate-limit                                | Yes (backoff)  | 2 attempts |
| HTTP 5xx from MCP server                           | Yes            | 2 attempts |
| HTTP 401 / 403 auth failure                        | No             | 0          |
| Schema validation failure (parser rejection)       | No             | 0          |
| `unsupported_family`                               | No (skip)      | 0          |
| Missing config (MCP URL/token absent)              | No (skip)      | 0          |
| HTTP 200 with `validation_failed` / `parse_failure`| No (failed row)| 0          |

Backoff: 2s, 8s. Retry attempts surfaced in run metadata or structured
logs; no raw prompt/body/response logged.

### Decision 6 — Failure behavior: never block argument submission

Argument submission remains successful even when classification fails.
Failure persists a run row with:

* `status='failed'`
* `failure_reason` (sanitized)
* `run_mode='production'`
* `requested_families=['parent_relation']`
* zero result rows

### Decision 7 — Rate/cost protection: minimal baseline

**IN THIS CARD (binding):**

* Skip auto-trigger if `semantic_referee_runtime_config.enabled=false`.
* Skip if requested family not in runtime-gated family set.
* Structured `family_a_auto_trigger_skipped` log with reason.

**DEFERRED (file as `OPS-MCP-RATE-LIMITING` follow-up):**

* Concurrent / burst invocation caps.
* Per-debate rate limits.
* Cost-budget enforcement.
* Adaptive throttle on Anthropic 429 frequency.

Designer must explicitly state which guards are in scope vs deferred;
document expected production load (`argumentInsertsPerHour`) and
verify idempotency + skip-on-disabled covers v1 needs.

### Decision 8 — Production rendering: preserve current filter

Production rows render through Source 6. Admin-validation rows remain
excluded by the existing run_mode filter
(`machineObservationPersistenceQuery.ts:127`). Do NOT touch that filter
except to preserve or strengthen it.

### Decision 9 — Observability: structured logging

Required event fields:

* `timestamp`
* `argument_id` (UUID)
* `trigger_source` (e.g. `argument_insert_hook`)
* `outcome` ∈ `{triggered, skipped, already_classified, failed}`
* `skip_reason` (if applicable)
* `run_id` (if triggered)
* `failure_reason` (if failed)
* `attempt_number` (if retry)
* `latency_ms`

**Forbidden in logs:**

* Bearer tokens.
* API keys.
* Service-role credentials.
* Raw argument body text.
* Raw prompt text.
* Raw model response text.
* User IDs that aren't already in arg metadata.

### Decision 10 — Manual override: preserved

Existing manual invocation paths remain valid:

* `POST /functions/v1/classify-argument-boolean-observations` with
  `mode='admin_validation'` (operator smoke).
* Same endpoint with `mode='production'` + explicit `argumentIds`
  (manual production run).

Auto-trigger is additive, not replacement.

---

## 5. HALT triggers (25)

Any ONE fires HALT.

**PROTOCOL + SECURITY (1-9):**

1. Proposes client-side MCP call.
2. Proposes `EXPO_PUBLIC_*` MCP credentials in client bundle.
3. Proposes exposing MCP bearer token / Anthropic key / service-role key
   to client.
4. Proposes client-JWT writes to Machine Observation persistence.
5. Proposes disabling or weakening Source 6 `run_mode='production'` filter.
6. Proposes rendering admin_validation rows as production chips.
7. Proposes service-role client invocation from app/client code.
8. Logs raw argument body, raw prompt, raw model response, bearer token,
   or API key (hashes acceptable).
9. Proposes RLS weakening on `argument_machine_observation_runs` or
   `_results`.

**SCOPE (10-17):**

10. Proposes enabling family other than `parent_relation`.
11. Proposes changing MCP-021A schema version.
12. Proposes changing any taxonomy key.
13. Proposes changing the MCP server prompt.
14. Proposes changing UX-001.5A display caps.
15. Proposes new visual primitive or design token.
16. Proposes historical / backfill mode in this card.
17. Proposes modifying Family A classifier behavior on the MCP server
    side.

**ARCHITECTURE (18-23):**

18. Proposes auto-trigger without idempotency strategy.
19. Proposes auto-trigger without retry / failure semantics.
20. Proposes auto-trigger without rate / cost protection (even minimal).
21. Proposes auto-trigger that blocks argument submission on classifier
    completion.
22. Proposes running classifier synchronously in the UI submit path.
23. Test count forecast exceeds +350.

**DOCTRINE + WORKING TREE (24-25):**

24. Verdict / winner / correctness / fallacy / bad-faith language in
    user-facing strings.
25. Working tree contains unclassified untracked files at PR creation
    (operator-territory testing-runs + `netlify-prod.git` are KNOWN
    exclusions; do NOT block on those).

---

## 6. Required designer Phase A audits (A.1 – A.10)

**A.1 — Argument creation path.** Identify the canonical file:line where
new arguments are inserted (client mutation, Edge Function, Supabase
RPC, direct insert with RLS). Document the exact entry point.

**A.2 — Trigger site decision (LOAD-BEARING).** Choose the trigger
location: post-submit client callback, Edge-to-Edge invocation, DB
trigger / Supabase webhook, or existing job system. Document choice +
rationale + tradeoffs vs alternatives. **Operator decision checkpoint at
Stage 2B.**

**A.3 — Idempotency strategy (LOAD-BEARING).** Commit to Option A, B, or
C. Document why the others were ruled out. If Option A: race tolerance
reasoning. If Option B: draft migration SQL (do not run; designer-only).
If Option C: advisory-lock pattern.

**A.4 — Retry classification.** Map every failure mode observed in
predecessor smokes to retryable or non-retryable. Bounded retry policy
binding.

**A.5 — Rate / cost guardrails.** Estimate
`argumentInsertsPerHour` expected production rate. Confirm idempotency
+ skip-on-disabled is sufficient for v1. State which caps ship vs defer.
Scope `OPS-MCP-RATE-LIMITING` follow-up.

**A.6 — Source 6 rendering preservation.** Verify the filter at
`machineObservationPersistenceQuery.ts:127` is unchanged. Verify
admin_validation rows still excluded. Verify auto-triggered production
rows render.

**A.7 — Backfill explicitly out of scope.** Document that historical
arguments will NOT receive auto-trigger. File
`MCP-021C-FAMILY-A-BACKFILL` as separate future card.

**A.8 — Auth / security boundary.** Confirm no client-side MCP secrets;
no service-role surface in app/client; RLS preserved on runs + results;
trigger site doesn't bypass existing auth boundaries.

**A.9 — Test plan.** Forecast test count delta (target +50 to +120;
HALT at +350). Enumerate required tests.

**A.10 — Smoke plan.** Three-phase smoke design (Phase 1: trigger fires
on new arg; Phase 2: idempotency holds on duplicate event; Phase 3:
failure path doesn't block submit).

---

## 7. Required tests (forecast)

Target: **+50 to +120 tests.** HALT if forecast exceeds **+350**.

Required categories (suggested file names per launch brief):

* `mcpOneTwoOneCAutoTriggerFamilyA.test.ts` — trigger fires, payload
  shape, schema version, family scope.
* `mcpOneTwoOneCAutoTriggerIdempotency.test.ts` — duplicate trigger
  skip (per Decision 4 option chosen).
* `mcpOneTwoOneCAutoTriggerFailureMode.test.ts` — each failure class;
  retry policy; submit not blocked.
* `mcpOneTwoOneCAutoTriggerSourceSixRendering.test.ts` — production
  rows render; admin rows still excluded.
* `mcpOneTwoOneCAutoTriggerSecurityBoundary.test.ts` — no client
  secret; no service-role surface; no raw body logging.

Plus regression sweep: full MCP-021B / C family + ux115A family must
remain green.

---

## 8. Smoke plan (3 phases at minimum; full plan in design doc)

**Phase 1 — Trigger fires on new arg.** Create new argument; wait 30s;
query `argument_machine_observation_runs WHERE argument_id=<new>`;
expect 1 row, `run_mode='production'`, `status='success'` (or `failed`
with legitimate reason).

**Phase 2 — Idempotency holds.** Re-fire trigger event (or call
classifier directly with same payload); expect no duplicate run created
(Option A may permit race-condition duplicates; Option B/C must prove
zero duplicates).

**Phase 3 — Failure doesn't block submit.** Create new argument with
MCP config disabled or known failure mode; verify argument was still
inserted; verify failed run row persisted with appropriate
`failure_reason`.

Full 9-phase post-merge smoke audit at
`docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-<date>.md` per
launch brief.

---

## 9. Operator-deferred items (do NOT ship in this card)

* `MCP-021C-FAMILY-A-BACKFILL` — historical argument classification.
* `MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING` — if
  Option A chosen and race conditions surface.
* `OPS-MCP-RATE-LIMITING` — concurrent caps, per-debate limits,
  cost-budget enforcement.
* `OPS-MCP-OBSERVABILITY` — production traffic observability (PROMOTED
  from deferred to PLANNED after this card's smoke PASS).
* `ADMIN-MCP-001` — UI affordance flip (authorized after smoke PASS).
* `MCP-SERVER-003` — Family B template (authorized after smoke PASS).
* `MCP-021C-AUTO-TRIGGER-FAMILY-B` through `…-FAMILY-J` — one per
  family, one at a time per cadence.

---

## 10. Read-only API boundaries

The following files / interfaces are **read-only** for this card except
as explicitly scoped:

* `src/lib/constitution/engine.ts` — pure TS; no network; no React.
* `src/features/nodeLabels/machineObservationPersistenceQuery.ts` —
  Source 6 filter (line 127) must remain byte-equal; the inner-join
  filter is the security boundary.
* `src/features/nodeLabels/` adapter contracts — MCP-021A / 021B
  byte-equal invariants must hold.
* `supabase/migrations/202605*_mcp_021c_edge_*.sql` and earlier — never
  edit existing migrations.
* MCP server source (Deno Deploy) — out of scope; this card touches
  only Supabase + app code.
* UX-001.5A display caps + label primitives — preserve byte-equal.

---

## 11. Brief ledger

| Item                          | Value                                            |
| ----------------------------- | ------------------------------------------------ |
| Card                          | MCP-021C-AUTO-TRIGGER-FAMILY-A                    |
| Effort                        | M-L (design-heavy)                                |
| Predecessor                   | MCP-021C-FAMILY-A-PROD-SMOKE (67fcba5)            |
| HALT triggers                 | 25                                                |
| Binding decisions             | 10                                                |
| Phase A audits                | 10 (A.1 – A.10)                                   |
| Test forecast (target)        | +50 to +120                                       |
| Test forecast HALT threshold  | +350                                              |
| Operator gates                | Stage 2A conditional + Stage 2B mandatory         |
| Post-merge smoke              | 9-phase audit on new test argument                |
| Brief author                  | Operator                                          |
