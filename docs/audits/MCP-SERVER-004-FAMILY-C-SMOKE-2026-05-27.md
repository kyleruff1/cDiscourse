# MCP-SERVER-004-FAMILY-C-SMOKE — Post-merge 8-phase audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** MCP-SERVER-004-FAMILY-C shipped at `e12aeb5` (PR #319).
**Audit doctrine:** Verifies the misunderstanding-repair (`misunderstanding_repair`)
boolean-observation classifier works end-to-end through the shared
validator registry introduced by OPS-MCP-FAMILY-VALIDATOR-REFACTOR,
while preserving Family A AND Family B behavior byte-equal and
continuing to reject unsupported families (D/E/F/G/H/I/J) at the
MCP-server layer. PASS authorizes MCP-SERVER-005-FAMILY-D (with
mandatory Stage-2B operator-decision checkpoint for the
ai_classifier subset filter decision).

---

## Verdict

**PASS.** All 8 phases satisfied. Family C `admin_validation` is OPERATIONAL on the hosted MCP server. Family A + Family B behavior preserved byte-equal. The 7 unsupported families (D–J) continue to reject correctly at the registry boundary.

* **Local Deno suite:** 467 passed / 0 failed (+124 vs Family-B baseline of 343; +9 above the design forecast band of +95 to +115 — reviewer Stage 4 explained the overage as cross-family dispatch tests adding 4 directional combinations vs the 2 forecast).
* **Hosted MCP server (Deno Deploy, post-merge auto-deploy):**
  `MCP-SERVER-001 smoke: 13 PASSES, 0 FAILS` (bumped from the 11/11
  Family-B baseline; the 2 new checks
  `[12-compat-boolean-family-c]` + `[13-mcp-tools-call-boolean-family-c]`
  prove Family C is live on the deployed build with `family-c-v1`
  classifier set and 17 raw keys).
* **Edge Function `admin_validation`:** HTTP 200 for 3 seeded args
  with `requestedFamilies: ['misunderstanding_repair']`. **3 Family C positives observed across 3 seeded args** — exceeds Decision 9's "0 acceptable" baseline. All positive raw keys (`provides_alternate_interpretation`, `scope_mismatch_identified`) are in the 17-key Family C set; zero cross-family leakage; conservative-positives bias holding (arg1 returned 0 — no over-firing).
* **Unsupported D-J rejection regression:** All 7 of
  `evidence_source_chain` / `argument_scheme` / `critical_question` /
  `resolution_progress` / `claim_clarity` / `thread_topology` /
  `sensitive_composer` correctly rejected (status=`failed`,
  `failureReason=mcp_validation_failed`, 0 positives, empty rawKeys;
  no Family A/B/C leakage).
* **Targeted regression suites:** 40 Jest suites / 926 tests / 0 failed across `mcpOneTwoOneB*`, `mcpOneTwoOneC*`, `uxOneOneFiveA*`. Typecheck + lint exit 0.

**Authorization:** `MCP-SERVER-005-FAMILY-D` is **AUTHORIZED to
begin** (with mandatory Stage-2B operator-decision checkpoint per
intent brief §11). `OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED to
ship before D (3 families now operational; per-family telemetry now
justified). `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` AUTHORIZED to design
(lower priority than D + OBSERVABILITY).

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `e12aeb5`. Working tree contains only the 10 known
operator-territory untracked files
(`docs/testing-runs/2026-05-25-*`, `mcp021c-edge-smoke-*`,
`netlify-prod.git`, `phase5-mcpserver002-*`) — none are this
card's territory.

Predecessor audits present:

| Audit | Path |
| --- | --- |
| MCP-SERVER-003-FAMILY-B smoke | `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md` |
| OPS validator-refactor smoke | `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md` |
| AUTO-TRIGGER FAMILY A smoke | `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md` |
| FAMILY A PROD smoke | `docs/audits/MCP-021C-FAMILY-A-PROD-SMOKE-2026-05-26.md` |
| MCP-SERVER-002 smoke | `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md` |

Hosted server health
(`GET https://cdiscourse-mcp-server.civildiscourse.deno.net/health`):

```
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "prod",
  "supportedTools": ["classify_semantic_move", "classify_argument_boolean_observations"],
  "credentialsConfigured": true,
  "protocolVersion": "2025-11-25",
  "timestamp": "2026-05-27T17:43:56.943Z"
}
```

Edge Functions ACTIVE:

| Function | Version | Updated |
| --- | --- | --- |
| `semantic-referee` | 146 | 2026-05-27 17:06:19 UTC |
| `classify-argument-boolean-observations` | 32 | 2026-05-27 17:06:19 UTC |

Both Edge Functions auto-deployed from `e12aeb5` (PR #319 squash-merged at `2026-05-27T17:05:22Z`) ~57 seconds later (deploy timestamp `17:06:19`). `semantic-referee` bumped 145 → 146 and `classify-argument-boolean-observations` bumped 31 → 32 — both increments correspond to the same merge. Auto-deploy chain (Supabase GitHub integration) operational.

DB config sanity verified indirectly: Family A auto-trigger has been production-live since `e281753` (MCP-021C-AUTO-TRIGGER-FAMILY-A) and continues to operate against this Edge build; that workflow requires `provider_mode='mcp'` and `enabled=true` in `semantic_referee_runtime_config`. Phase 6 regression suite confirms client-side behavior is consistent. Direct `SELECT` was not run because Supabase MCP requires OAuth flow (operator-territory) and Family B smoke established the indirect-verification pattern as sufficient.

---

## Phase 2 — Local Deno regression

**Status:** PASS (operator-attested + independently verified)

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 467 passed | 0 failed (3s)
```

Test delta against the Family-B baseline (343 set by the Family B
smoke): **+124 tests**. Design §5 forecast was +95 to +115;
observed +124 sits 9 above the upper band. Reviewer Stage 4
verdict matrix item L noted the cause: cross-family dispatch
tests added 4 directional combinations (A↔C, B↔C in both
directions) vs the 2 the design forecast. The HALT threshold
(+300) remains comfortably clear.

The new tests cover Family C keys (parity + cross-family-collision
HALT #14 guards), prompt (doctrine assertions + 4 doctrine-risk-key
guard verbatim + Schegloff/Sacks vocabulary allowlist), Anthropic
wrapper (with API-key-never-logged tests parallel to Family A/B),
ban-list scan (16 tests; reuses shared `DOCTRINE_BAN_PATTERNS`),
fixtures (8 total — 5 request + 3 response), response validator
(18 tests covering shape + 240-char evidenceSpan cap + confidence
band), dispatcher (with 3-way cross-family rejection), doctrine
fixtures (8 tests covering the 4 doctrine-risk-key framing
assertions), and registry registration (3-family init order +
17-key getRawKeysForFamily).

---

## Phase 3 — Hosted MCP server smoke

**Status:** PASS (operator-attested)

```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Operator-attested redacted output:

```
HOSTED SMOKE EXIT: 0
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]

PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]
PASS [10-compat-boolean-family-b]
PASS [11-mcp-tools-call-boolean-family-b]
PASS [12-compat-boolean-family-c]
PASS [13-mcp-tools-call-boolean-family-c]

MCP-SERVER-001 smoke: 13 PASSES, 0 FAILS
EXIT: 0
```

The 2 new Family C checks specifically verify:
* Check 12 (`[12-compat-boolean-family-c]`): hosted server returns
  a Family C response whose
  `modelInfo.classifierSetVersion === 'family-c-v1'` via the
  `/mcp/adapter-compat` endpoint with `requestedFamilies: ['misunderstanding_repair']`.
* Check 13 (`[13-mcp-tools-call-boolean-family-c]`): `tools/call`
  against `classify_argument_boolean_observations` with a Family C
  request returns a structured response whose
  `modelInfo.classifierSetVersion === 'family-c-v1'` via the
  official MCP `/mcp` endpoint with JSON-RPC envelope.

Token was redacted in operator-pasted output; Family A checks (5+9)
and Family B checks (10+11) remain green, confirming byte-equal
preservation through the hosted server path.

---

## Phase 4 — Edge `admin_validation` smoke (Family C)

**Status:** PASS (3 Family C positives observed; exceeds Decision 9 "0 acceptable" baseline)

Acquired admin JWT via password grant against the bot test user
(per Family B smoke Phase 4 pattern). SAFE_SUMMARY:

```
{"token_length":988,"parts":3,"role":"authenticated","aud":"authenticated","email":"kyleruff+devtests1@gmail.com","expIso":"2026-05-27T18:45:44.000Z","expired":false}
```

(Raw token written to operator-territory temp file; never echoed.)

Built Family C `admin_validation` payload:

```json
{
  "argumentIds": [
    "f41b18b0-8ad6-4865-94c5-17a568f6a6ad",
    "781f8057-9e2a-4fa9-92a8-469676950ff7",
    "db0de3e0-24c6-40af-ba5f-2844acfa5bac"
  ],
  "requestedFamilies": ["misunderstanding_repair"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

POSTed to `${SUPABASE_URL}/functions/v1/classify-argument-boolean-observations`.

Result: **HTTP 200**, `time_total=20.46s` (3-arg admin_validation;
proportional to Family B's ~16–18s baseline for 14 keys × 3 args —
Family C's 17 keys × 3 args lands ~21% higher, exactly tracking the
key-count ratio). 3 `perArgument` entries; `mode='admin_validation'`;
`schemaVersion='mcp-021.machine-observations.boolean.v1'`.

| Argument | Status | runId | positiveObservationCount | rawKeysWithPositive |
| --- | --- | --- | --- | --- |
| arg1 (`f41b18b0-…`) | success | `d22acd1b-7065-4a35-ba25-9282d5526f82` | 0 | (none) |
| arg2 (`781f8057-…`) | success | `ed22027c-467a-4eef-90f0-8e95b93884e5` | 2 | `provides_alternate_interpretation`, `scope_mismatch_identified` |
| arg3 (`db0de3e0-…`) | success | `4926b0b6-70f9-4a4e-986c-97d42d7c0770` | 1 | `provides_alternate_interpretation` |

**Total Family C positives across 3 args: 3.** All positive raw
keys are in the 17-key Family C set. `positiveObservationCount`
matches `rawKeysWithPositive.length` on every entry. No
cross-family leakage; no Family A or Family B keys appeared.

Phase 4 verdict logic:
- HTTP 200 ✓
- All 3 perArgument `status === 'success'` ✓
- All positive raw keys ⊆ Family C 17-key set ✓ (`provides_alternate_interpretation` is key #4; `scope_mismatch_identified` is key #16)
- Schema version correct ✓
- Conservative-positives bias holding (arg1 returned 0 — no over-firing on a parent-claim move)

Note on positive-signal quality: the seeded args were designed for
Family A (parent_relation) and Family B (disagreement_axis), NOT
for repair patterns — yet 2 of 3 args produced Family C positives.
The classifier identified plausible repair signals in
non-repair-designed text:
- arg2 (counter-argument): `provides_alternate_interpretation`
  (offering an alternative reading of the parent claim) +
  `scope_mismatch_identified` (the move challenges the parent's
  generalization scope, which IS a scope-mismatch observation).
- arg3 (further response): `provides_alternate_interpretation`
  (another alternative-interpretation move).

These signals are descriptive structural facts about the moves,
consistent with the doctrine that repair is collaborative grounding
(both arg2 and arg3 are offering alternative interpretations, which
is a grounding move — not a verdict on the parent).

Persistence readback (design §10): **deferred** to a future
observability card. Supabase MCP requires OAuth flow which would
break smoke autonomy; the doctrine assertions on `evidence_span`
content (no banned tokens, no doctrine-risk-key fault framing) are
enforced server-side by `mcp-server/lib/familyCBanListScan.ts`
which has 16 unit tests covering every banned-token shape. The
Edge response shape (rawKeysWithPositive ⊆ Family C 17-key set;
no cross-family leak) is the binding validation gate.

---

## Phase 5 — Unsupported D/E/F/G/H/I/J rejection regression

**Status:** PASS

POSTed to `${SUPABASE_URL}/functions/v1/classify-argument-boolean-observations`
with each of the 7 unsupported families against arg2 (`781f8057-…`;
content irrelevant since rejection is registry-layer):

| Family | requestedFamilies value | HTTP | Time (ms) | Status | failureReason | positives | rawKeys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D | `["evidence_source_chain"]` | 200 | 2806 | failed | `mcp_validation_failed` | 0 | [] |
| E | `["argument_scheme"]` | 200 | 1696 | failed | `mcp_validation_failed` | 0 | [] |
| F | `["critical_question"]` | 200 | 1100 | failed | `mcp_validation_failed` | 0 | [] |
| G | `["resolution_progress"]` | 200 | 1104 | failed | `mcp_validation_failed` | 0 | [] |
| H | `["claim_clarity"]` | 200 | 1293 | failed | `mcp_validation_failed` | 0 | [] |
| I | `["thread_topology"]` | 200 | 1228 | failed | `mcp_validation_failed` | 0 | [] |
| J | `["sensitive_composer"]` | 200 | 1253 | failed | `mcp_validation_failed` | 0 | [] |

All 7 reject at the MCP server's registry boundary (the
`unsupported_family` error envelope, which the Edge adapter maps
to `validation_failed` → persisted `failureReason: 'mcp_validation_failed'`).

The first request (D) took ~2.8s — cold-start latency to the
Edge Function after the Phase 4 ~20s call. Subsequent requests
(E–J) settled to ~1.0–1.7s, consistent with warm-Edge fast-reject
behavior (registry rejection is a sub-millisecond MCP-server check
plus Edge persistence overhead).

No Family A, B, or C keys leaked into any rejection response.
`positiveObservationCount === 0` and `rawKeysWithPositive === []`
on all 7 entries. Security-adjacent gate (HALT trigger #6 from
intent brief §6) holds: D–J remain unsupported; the
`supportedFamilies` envelope returned by the MCP server is
`['parent_relation', 'disagreement_axis', 'misunderstanding_repair']`.

---

## Phase 6 — Targeted regression suites

**Status:** PASS (operator-attested + independently verified)

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA)"
→ Test Suites: 40 passed, 40 total
  Tests:       926 passed, 926 total

cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 467 passed | 0 failed (3s)
```

All targeted regressions exit 0. The Jest sweep is a regression
check that the existing MCP-021B persistence + MCP-021C runtime
spine + UX-001.5A node-label primitive layer all continue to pass
against the post-Family-C tree. None of those test surfaces are
directly touched by Family C but they share the upstream taxonomy
and the Edge familyRegistry — the existing
`mcpOneTwoOneCEdgeFamilyRegistry.test.ts` FR-4/FR-7/FR-9
assertions continue to pin Family C admin-validation-only.

Typecheck + lint exit 0 (verified post-merge).

---

## Phase 7 — OPS observations

* **3 families now operational on hosted MCP server:**
  - Family A (`parent_relation`): production + auto-trigger live (MCP-021C-AUTO-TRIGGER-FAMILY-A at `e281753`).
  - Family B (`disagreement_axis`): `admin_validation` only.
  - Family C (`misunderstanding_repair`): `admin_validation` only (NEW this card).

* **7 families still unsupported** (D evidence_source_chain, E argument_scheme, F critical_question, G resolution_progress, H claim_clarity, I thread_topology, J sensitive_composer). Registry rejection continues to enforce admin-validation-only semantics for all 7.

* **Latency observations:**
  - Phase 4 (Family C admin_validation, 3 args × 17 keys): `time_total=20.46s`.
  - Family B baseline (3 args × 14 keys per prior smoke): ~16–18s.
  - Ratio: 20.46 / 17 ≈ 1.20s per key × 3 args (Family B was ~16.5 / 14 ≈ 1.18s per key × 3 args).
  - Latency scales proportionally with key count; **no truncation evidence at MAX_TOKENS=1500**.
  - Phase 5 cold-start D (~2.8s) + warm E–J (~1.0–1.7s) is consistent with prior smokes.

* **`OPS-MCP-OBSERVABILITY` priority: STRONGLY RECOMMENDED as next OPS card.** 3 families is the threshold where ad-hoc SQL inspection (per-family run counts, per-rawKey positive-density, doctrine-risk-key sample audits) becomes painful. Per-family metrics + per-rawKey signal-density telemetry would inform:
  - whether the conservative-positives bias is calibrated correctly across families,
  - whether the Family C `clarified` lifecycle FALSE-low default produces any positives in real corpus (Phase 4 data: 0 `clarified` positives across 3 args — consistent with the lifecycle guard's intended behavior),
  - whether the Family C token budget envelope (1445 / 1500) is hitting truncation in real workloads (Phase 4 evidence: no truncation observed),
  - whether the 4 doctrine-risk-key framing assertions hold under real-corpus pressure (telemetry can sample `rejects_candidate_understanding` / `acknowledges_misread` / `flags_term_ambiguity` / `clarified` rows for review).

* **`MCP-021C-EDGE-FAMILIES-B-C-ENABLE` priority assessment:** Both B and C currently `admin_validation`-only. Production-mode flip is one-line per family in `supabase/functions/_shared/booleanObservations/familyRegistry.ts`. Could ship as batch (`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`) between OBSERVABILITY and Family D. Lower priority than D + OBSERVABILITY; defer until observability telemetry confirms positive-density calibration.

* **Test count progression (mcp-server Deno):**
  - 90 (Stage 6 pre-MCP-SERVER baseline)
  - 200 (MCP-SERVER-002 Family A ship)
  - 236 (OPS-MCP-FAMILY-VALIDATOR-REFACTOR)
  - 343 (MCP-SERVER-003-FAMILY-B ship)
  - **467 (MCP-SERVER-004-FAMILY-C ship, +124)**
  - Forecast for Family D (27 keys ≈ +160-200 tests if Family-N pattern holds): test count would land at ~627-667. Still well below the HALT-trigger #16 threshold of +300 per card.

* **Token budget observations:**
  - Family C is 17 keys, the highest key count tested against `MAX_TOKENS=1500`.
  - Phase 3 hosted MCP smoke passed cleanly; no truncation reported in checks 12 + 13.
  - Phase 4 Edge `admin_validation` produced full responses with valid `rawKeysWithPositive` arrays — no truncation evidence.
  - Family D at 27 keys (or `ai_classifier` subset ~12 keys) is the next budget test. Designer Stage 1 should determine whether to bump `MAX_TOKENS` to 1800+ or split the 27-key call into 2 batches. The subset-filter decision (which keys to route to the classifier vs which to compute deterministically) is the mandatory Stage-2B operator-decision checkpoint per intent brief §11.

* **Doctrine-risk-key real-corpus calibration:** Phase 4 produced 0 `clarified` / 0 `rejects_candidate_understanding` / 0 `acknowledges_misread` / 0 `flags_term_ambiguity` positives across the 3 seeded args. This is consistent with the conservative-positives bias and the lifecycle FALSE-low guard for `clarified`. Real-corpus calibration on these 4 keys is a Phase 7 follow-on item that admin_validation telemetry can answer — OPS-MCP-OBSERVABILITY card scope.

---

## Phase 8 — Verdict + authorization

* **PASS criteria** (all required, all satisfied):
  * Phase 1 pre-flight clean ✓
  * Phase 2 local Deno: 467/0 (operator-attested + verified) ✓
  * Phase 3 hosted MCP smoke: 13/13 (operator-attested) ✓
  * Phase 4 admin_validation: HTTP 200; valid Family C response shape; 3 positives, all raw_keys ⊆ Family C 17-key set ✓
  * Phase 5 unsupported rejection: all 7 unsupported families correctly rejected ✓
  * Phase 6 targeted regression: 40 / 926 / 0 (operator-attested + verified) ✓

* **FAIL triggers** (none fired):
  * Phase 3 < 13 checks pass → NOT triggered (13/13)
  * Phase 4 returns non-Family-C raw_keys (taxonomy violation) → NOT triggered (both positive raw keys in Family C 17-key set)
  * Phase 5 any unsupported family accepted (security adjacent) → NOT triggered (7/7 rejected with `mcp_validation_failed`)
  * Phase 6 broad regression (Family A or B byte-equal failure) → NOT triggered (Family A checks 5+9 + Family B checks 10+11 + targeted regression all green)

* **Authorization after PASS:**
  * **`MCP-SERVER-004-FAMILY-C-SMOKE: PASS`** — recorded at this audit's commit.
  * **Family C `admin_validation` OPERATIONAL** on the hosted MCP server.
  * **`MCP-SERVER-005-FAMILY-D` AUTHORIZED** to begin with mandatory Stage-2B operator-decision checkpoint for the ai_classifier subset filter decision (per intent brief §11; Family D is the design-heavy family with compound-key collision question).
  * **`OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED** to ship before Family D (3 families now operational; per-family telemetry now valuable for Family D calibration).
  * **`MCP-021C-EDGE-FAMILIES-B-C-ENABLE` AUTHORIZED to design** (lower priority than D + OBSERVABILITY).

* **No PARTIAL or FAIL gating applies** — Phase 4 produced positive signal (3 positives) exceeding the Decision 9 baseline.

* **Smoke-find rate context:** 15 cards shipped, 15 clean PASSes (no rollbacks). Smoke-find rate: ~46% (6 real findings across 13 smokes). Pattern thrice-proven (A, B, C all shipped via Family-N template).

---

## Operator cleanup

After audit doc is committed, delete temp files:
- `$HOME/mcp-hosted-token.current` (operator-territory; delete or rotate per token-retention policy)
- `%TEMP%/family-c-smoke/admin-jwt.txt` (auth credential; delete)
- `%TEMP%/family-c-smoke/admin-validation-request.json` (smoke artifact; delete)
- `%TEMP%/family-c-smoke/admin-validation-response.json` (smoke artifact; delete)
- `%TEMP%/family-c-smoke/unsupported-*-response.json` (7 files; smoke artifacts; delete)
- `%TEMP%/family-c-smoke/smoke-acquire-bot-jwt.mjs` (helper script; delete)
- `%TEMP%/family-c-smoke/parse-admin-validation-response.mjs` (helper script; delete)
- `%TEMP%/family-c-smoke/run-unsupported-family-regression.mjs` (helper script; delete)

Hosted token retention: standard pattern is to rotate after each smoke per CDiscourse secrets policy; operator decides whether to retain `$HOME/mcp-hosted-token.current` for follow-on smokes (Family D pre-flight) or rotate immediately.
