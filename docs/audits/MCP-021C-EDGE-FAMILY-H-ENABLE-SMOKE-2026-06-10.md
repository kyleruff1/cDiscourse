# MCP-021C-EDGE-FAMILY-H-ENABLE — production-enable smoke, Stage-2 re-attempt (2026-06-10)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-10
**Operator:** Kyler (E#7(b) approved for the MCP-H-002 flip; canary + burst run immediately post-merge)
**Merge under test:** PR #559 → main `580f197` (MCP-H-002: `claim_clarity` `productionEnabled false → true`, the revert-of-revert of #408; reviewer verdict APPROVE in `docs/reviews/MCP-H-002.md`). Edge redeploy confirmed by version readback (`submit-argument` v457 → v461) before any submit.
**Prior verdict: FAIL** — `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md:15` (HALT 15; 7 terminal `mcp_api_error` across 4 families at the 8-family load). The newly supplied proof that caps-and-clears the prior FAIL: the provider-reliability fix track landed (ARCH-001 queue + bounded-concurrency drainer, PASS-LOAD + PASS-LOAD-CONFIRM 2026-06-10) and the #472 reproduction card demonstrated 64/64 admin_validation cells terminal-zero at the same 8-family profile before this flip was attempted.
**Preconditions consumed (all recorded on #552/#472):** E#7(a) non-H PASS-LOAD + PASS-LOAD-CONFIRM satisfied; #523 stale-H-rows cleanup complete (tripwire-equivalent 7→0 pre-flip); E#7(b) operator decision given for this card; E#7(c) evidenced by the #472 Stage-4 burst.

**Final verdict: PASS.** Canary 8/8 and burst 64/64 terminal success at the live 8-family production roster; 0 dead-letters; 0 `mcp_api_error`; 0 retries anywhere (`max attempt_count = 1` across all 72 cells); Family H produced 47 persisted positive observations across 9 distinct raw keys with 0 doctrine violations in the persisted `evidence_span` direct output.

---

## Phase A — canary (1 smoke-tagged submit; routing-path gate at the 8-family roster)

**Status:** PASS

One synthetic `[arch-001-queue-smoke]` thesis via production `submit-argument` (admin bot lane, `.env.bot-tests`; no service-role; no direct insert). `submit_response_latency_ms = 3326` (cold-start after the merge redeploy; same shape as prior canaries).

| Check | Observed |
|---|---|
| Queue cells | **8/8** — A–G plus exactly one `claim_clarity` cell, all `run_mode='production'` |
| Terminal state | 8/8 `succeeded`, `attempt_count = 1` |
| `family=NULL` rows | 0 |
| I/J rows | 0 (`thread_topology`, `sensitive_composer` both still `productionEnabled:false`) |
| Settle | terminal on the first 5 s poll cycle |

## Phase B — burst (8 smoke-tagged args × 8 families = 64 cells)

**Status:** PASS

8 synthetic theses in a 16.0 s submit window (07:03:03–07:03:19 UTC); 8/8 HTTP 201; submit latency min/max = 1407/3978 ms — all under the 5000 ms nonblocking line, and every submit returned long before its slowest cell (architecturally nonblocking; the acceptance decision remained `engine.ts` validation pre-fork).

Poll-to-settle at ~13 s cadence; settled 07:05:48 UTC (~165 s from first submit):

| Gate | Observed |
|---|---|
| Cells | **64/64** present (8 args × 8 families) |
| Terminal success | **64/64 `succeeded`** — 0 `dead_letter`, 0 `failed_terminal` |
| `claim_clarity` cells | **8/8 `succeeded`** |
| Retries | 0 (`max attempt_count = 1` — the #407 signature did not appear at all) |
| `family=NULL` / I/J / duplicate-success | 0 / 0 / 0 |
| Organic routing | 0 non-smoke routed rows (re-checked post-burst; PCT=1 bucket untouched by the smoke) |

Contrast with the prior attempt at the same profile: 2026-06-01 saw 7 terminal `mcp_api_error` events across 4 families and 1/4 args reaching 8/8; this run had zero terminal holes and zero retries on 72 cells.

## Phase C — L5 persisted direct-output inspection (`family_h` / `claim_clarity` / `claim_specificity_low`)

**Status:** PASS

The persisted `evidence_span` column on every post-merge `claim_clarity` result row was inspected directly by SQL (`SELECT … evidence_span` scan over the canary + burst window):

| Check | Observed |
|---|---|
| Persisted H result rows (positive observations) | **47** across **9 distinct raw keys** |
| Banned verdict tokens in persisted `evidence_span` (the §1 ban-list plus the H-specific mis-framing terms for `claim_specificity_low`, e.g. "vague person"/"sloppy"/"lazy") | **0 hits** — falsePositiveGuards held on direct output |
| Secret-shape strings (`Bearer `/`sk-ant`/`sb_secret`/JWT) in the 155 burst-window result rows | 0 |

## Phase D — boundary + posture checks

**Status:** PASS

- I/J production-success tripwire-equivalent (now scoped to the two still-frozen families): **0 rows** for `thread_topology` / `sensitive_composer`.
- `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` untouched — `claim_clarity` correctly absent (uniform `ai_classifier`; HALT-13 boundary held).
- Client UI surfacing gates (`argumentDetailModel.ts`, `deployedAgRawKeys.ts`) untouched — H output persists but is not yet surfaced on nodes; surfacing is a separate gated card.
- **Known follow-up (recorded, not patched in this card):** the Admin → Classifier Health client tripwire constant (`FROZEN_NON_PRODUCTION_FAMILIES` in `src/features/adminClassifierHealth/`) still lists `claim_clarity`, so the admin banner will count the now-legitimate H production-success rows until a small client card re-scopes it to I/J. Advisory-only by doctrine; it gates nothing.

## Disposition

- **PASS** at the canonical terminal-zero bar; the Stage-2 H re-attempt is live: production roster = **A–H (8 families)**.
- Rollback lever unchanged: the #408 single-boolean revert pattern returns H to admin-only at any time.
- Queue/routing posture at audit close: `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `PERCENTAGE=1` (unchanged by this card).
- Now unblocked downstream (each its own operator card): #396 Family-H observability backfill; the I-chain (#394) remains gated on an H-stable observation window per Template C4/D0.
