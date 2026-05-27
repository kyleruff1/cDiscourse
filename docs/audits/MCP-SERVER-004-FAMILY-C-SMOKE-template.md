# MCP-SERVER-004-FAMILY-C-SMOKE — Post-merge 8-phase audit (TEMPLATE)

**Date:** <YYYY-MM-DD> (operator fills in post-merge)
**Operator:** <operator-name>
**Predecessor:** MCP-SERVER-004-FAMILY-C shipped at `<merge-sha>` (PR #<number>).
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

**<PASS | PARTIAL | FAIL>.** <one-line verdict summary; fill in per
the actual smoke outcome>.

* **Local Deno suite:** <N> passed / 0 failed (+<delta> vs Family-B
  baseline of 343; expected within design forecast +95 to +115).
* **Hosted MCP server (Deno Deploy, post-merge auto-deploy):**
  `MCP-SERVER-001 smoke: 13 PASSES, 0 FAILS` (bumped from the 11/11
  Family-B baseline; the 2 new checks
  `[12-compat-boolean-family-c]` + `[13-mcp-tools-call-boolean-family-c]`
  prove Family C is live on the deployed build with `family-c-v1`
  classifier set and 17 raw keys).
* **Edge Function `admin_validation`:** HTTP 200 for 3 seeded args
  with `requestedFamilies: ['misunderstanding_repair']`. <Per
  Decision 9, **0 Family C positives across all 3 args is acceptable
  PARTIAL** — the seeded args were designed for Family A
  (parent_relation) and Family B (disagreement_axis); they were NOT
  designed for repair patterns. Document the actual positive count
  per arg; pipeline verification (HTTP 200 + valid response shape +
  correct raw_keys universe) is the binding PASS gate.>
* **Unsupported D-J rejection regression:** All 7 of
  `evidence_source_chain` / `argument_scheme` / `critical_question` /
  `resolution_progress` / `claim_clarity` / `thread_topology` /
  `sensitive_composer` correctly rejected (status=`failed`,
  `failureReason=mcp_validation_failed`, 0 positives, empty rawKeys;
  no Family A/B/C leakage).
* **Targeted regression suites:** <N> Jest suites / <N> tests / 0
  failed across `mcpOneTwoOneB*`, `mcpOneTwoOneC*`,
  `uxOneOneFiveA*`. Typecheck + lint exit 0.

**Authorization:** `MCP-SERVER-005-FAMILY-D` is **AUTHORIZED to
begin** (with mandatory Stage-2B operator-decision checkpoint per
intent brief §11). `OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED to
ship before D (3 families now operational; per-family telemetry now
justified).

---

## Phase 1 — Pre-flight

**Status:** <PASS | FAIL>

`main` at `<merge-sha>`. Working tree contains only the 10 known
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
<paste health response JSON>
```

Edge Functions ACTIVE:

| Function | Version | Updated |
| --- | --- | --- |
| `semantic-referee` | <N> | <UTC timestamp> |
| `classify-argument-boolean-observations` | <N> | <UTC timestamp> |

<Document Edge Function version delta vs Family B audit snapshot
and auto-deploy timing.>

---

## Phase 2 — Local Deno regression

**Status:** <PASS | FAIL>

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | <N> passed | 0 failed
```

Test delta against the Family-B baseline (343 set by the Family B
smoke): **+<delta> tests**. Design §5 forecast was +95 to +115;
observed +<delta> <lands within the band | exceeds the band — explain why>.
The new tests cover Family C keys (parity + cross-family-collision
HALT #14 guards), prompt (doctrine assertions + 4 doctrine-risk-key
guard verbatim + Schegloff/Sacks vocabulary allowlist), Anthropic
wrapper, ban-list scan, fixtures (8 total — 5 request + 3 response),
response validator, dispatcher (with cross-family rejection), and
doctrine-fixtures content scan.

---

## Phase 3 — Hosted MCP server smoke

**Status:** <PASS | FAIL>

```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected output:

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

<Paste actual output. The 2 new Family C checks specifically verify:
* Check 12: hosted server returns a Family C response whose
  `modelInfo.classifierSetVersion === 'family-c-v1'`.
* Check 13: `tools/call` against `classify_argument_boolean_observations`
  with a Family C request returns a structured response whose
  `modelInfo.classifierSetVersion === 'family-c-v1'`.>

---

## Phase 4 — Edge `admin_validation` smoke (Family C)

**Status:** <PASS | PARTIAL>

Acquired admin JWT via password grant against the bot test user
(per Family B smoke Phase 4 pattern).

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

Result: HTTP <status>. 3 `perArgument` entries.

| Argument | Status | positiveObservationCount | Positive rawKeys |
| --- | --- | --- | --- |
| arg1 (`f41b18b0-…`) | <success/failed> | <N> | <list or "none"> |
| arg2 (`781f8057-…`) | <success/failed> | <N> | <list or "none"> |
| arg3 (`db0de3e0-…`) | <success/failed> | <N> | <list or "none"> |

<Per Decision 9: **0 Family C positives across all 3 args is
acceptable PARTIAL** — the seeded args were designed for Family A
and Family B; they were not designed for repair patterns. Document
the actual outcome here; pipeline verification (HTTP 200 + valid
response shape + correct raw_keys universe) is the binding PASS gate.
If positives are observed, optionally read back the persisted rows:>

```sql
SELECT run_id, raw_key, family, confidence, evidence_span, length(evidence_span)
FROM argument_machine_observation_results
WHERE run_id IN (<3 run-IDs from the response>)
ORDER BY run_id, raw_key;
```

Doctrine assertions per design §10:
- Every row has `family='misunderstanding_repair'`.
- Every rawKey is in the 17-key Family C set.
- Every `evidence_span` length ≤ 240 chars.
- No row contains any doctrine ban-list pattern (no `winner`,
  `loser`, `verdict`, `liar`, `correct`, `incorrect`, `dishonest`,
  `manipulative`, `extremist`, `propagandist`, `bad faith`,
  `proof of`).
- No `rejects_candidate_understanding` row's evidence span contains
  `wrong` / `incorrect` / `not right` framing.
- No `acknowledges_misread` row's evidence span contains `your fault`
  / `you were unclear` / `bad writing` / `you confused me` framing.
- No `flags_term_ambiguity` row's evidence span contains `lazy` /
  `imprecise` / `careless` framing.
- `clarified` rows (if any) have `confidence='low'` and value `false`
  per the lifecycle FALSE-low guard.

---

## Phase 5 — Unsupported D/E/F/G/H/I/J rejection regression

**Status:** <PASS | FAIL>

POSTed to `${SUPABASE_URL}/functions/v1/classify-argument-boolean-observations`
with each of the 7 unsupported families against arg2:

| Family | requestedFamilies value | Expected | Observed |
| --- | --- | --- | --- |
| D | `["evidence_source_chain"]` | HTTP 200; status=`failed`; `failureReason=mcp_validation_failed`; 0 positives; empty rawKeys | <observed> |
| E | `["argument_scheme"]` | same | <observed> |
| F | `["critical_question"]` | same | <observed> |
| G | `["resolution_progress"]` | same | <observed> |
| H | `["claim_clarity"]` | same | <observed> |
| I | `["thread_topology"]` | same | <observed> |
| J | `["sensitive_composer"]` | same | <observed> |

No Family A, B, or C keys leaked into any rejection response.

---

## Phase 6 — Targeted regression suites

**Status:** <PASS | FAIL>

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA)"
→ <output>

cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | <N> passed | 0 failed
```

All targeted regressions exit 0.

---

## Phase 7 — OPS observations

* 3 families now operational on hosted MCP server.
  - Family A: production + auto-trigger live.
  - Family B: `admin_validation` only.
  - Family C: `admin_validation` only.
* `OPS-MCP-OBSERVABILITY` priority: STRONGLY RECOMMENDED as next
  OPS card. 3 families is the threshold where ad-hoc SQL inspection
  becomes painful. Per-family metrics + per-rawKey signal-density
  telemetry would inform: (a) whether the conservative-positives
  bias is calibrated correctly across families, (b) whether the
  Family C `clarified` lifecycle FALSE-low default produces any
  positives in real corpus, (c) whether the Family C token budget
  envelope (1445 / 1500) is hitting truncation in real workloads.
* Family C 4 doctrine-risk-key real-corpus calibration is a
  Phase 7 follow-on item that admin_validation telemetry can answer.

---

## Phase 8 — Verdict + authorization

* **PASS criteria** (all required):
  * Phases 1-2 clean.
  * Phase 3 = 13/13.
  * Phase 4 = HTTP 200; valid Family C response shape; raw_keys ⊆
    Family C 17-key set.
  * Phase 5 = all 7 unsupported families correctly rejected.
  * Phase 6 = all regressions pass.

* **PARTIAL** (acceptable per Decision 9):
  * Phase 4 returns 0 positives across all 3 args (the seeded args
    were not designed for repair patterns; classifier silence on
    non-repair-targeted text is valid; pipeline verification is the
    binding PASS gate).
  * Phase 6 single-suite regression independent of Family C.

* **FAIL** (any one triggers FAIL):
  * Phase 3 < 13 checks pass.
  * Phase 4 returns non-Family-C raw_keys (taxonomy violation).
  * Phase 5 any unsupported family accepted (security adjacent).
  * Phase 6 broad regression (Family A or B byte-equal failure).

* **Authorization after PASS**:
  * `MCP-SERVER-004-FAMILY-C-SMOKE: PASS`.
  * Family C `admin_validation` OPERATIONAL.
  * `MCP-SERVER-005-FAMILY-D` AUTHORIZED to begin — with
    mandatory Stage-2B operator-decision checkpoint for the
    ai_classifier subset filter decision (per inspection report;
    Family D is the design-heavy family with compound-key collision
    question).
  * `OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED to ship before D
    (3 families now operational; per-family telemetry now valuable).

* **If PARTIAL:** File scoped fix card. Do NOT begin Family D until
  smoke clean.

* **If FAIL:** File `MCP-SERVER-004-FAMILY-C-FIX`. Do NOT begin
  Family D until refactor stable. Consider revert if Family A or B
  regression detected.

---

## Operator cleanup

After audit doc is committed, delete temp files:
- `$HOME/mcp-hosted-token.current`
- `%TEMP%/mcp-server-004-family-c-*.json`
- `%TEMP%/family-c-smoke-admin-jwt.txt`
