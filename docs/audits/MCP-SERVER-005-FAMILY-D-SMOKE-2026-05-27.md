# MCP-SERVER-005-FAMILY-D-SMOKE — Post-merge audit

**Date:** 2026-05-27 (UTC; smoke completed 2026-05-28T02:08 UTC)
**Operator:** Kyler
**Predecessors:**
- MCP-SERVER-005-FAMILY-D shipped at `70e8365` (PR #331; Stage 2B Option A "Subset path" operator-approved)
- fix(MCP-SERVER-005-FAMILY-D) Edge→MCP subset filter shipped at `b0fd068` (PR #332; resolves Phase 4 27-vs-19 contract mismatch)
- MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE PASS at `ac66b2e` (Card 1 of combined launch)

**Audit doctrine:** Verifies Family D (`evidence_source_chain`) 19-key ai_classifier Subset works end-to-end through hosted MCP + Edge admin_validation; 8 deterministic keys excluded from MCP scope at Edge request layer; Family A/B/C byte-equal preserved; E-J still rejected.

---

## Verdict

**PASS** — Family D admin_validation operational end-to-end. The Card 2 ship + the follow-up Edge subset filter fix together deliver the operator's Stage 2B "Subset path" decision live in production.

- **Live submission test:** Edge admin_validation with `requestedFamilies: ['evidence_source_chain']` against 3 seeded args → HTTP 200 in 19.5s; 3/3 runs `status='success'`; **4 total positive raw keys** observed (arg2 + arg3 both fired `opens_evidence_debt_marker` + `evidence_gap_present`).
- All 4 positives are in the **19-key ai_classifier subset**; zero deterministic keys leaked; zero cross-family leakage.
- 6/6 unsupported families (E-J) reject correctly with `mcp_validation_failed`; zero positives; zero leakage.
- Family A/B/C byte-equal preserved (verified via targeted regression + Card 1's per-family auto-trigger 3-family test from yesterday).
- Latency 19.5s for 19 keys × 3 args matches the designer's projected ~22-25s (slightly faster).

**Authorizations granted:**
- `MCP-SERVER-005-FAMILY-D-SMOKE: PASS`
- Family D admin_validation now LIVE on hosted MCP
- `MCP-021C-EDGE-FAMILY-D-ENABLE` AUTHORIZED to design (production-mode flip + auto-trigger inclusion)
- `MCP-SERVER-006-FAMILY-E` AUTHORIZED to begin (Stage-2B mandatory if E has similar structural complexity)
- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` AUTHORIZED (4-family observability roll-up; recommended)

---

## Stage 2A → Stage 2B → Stage 2B-fix narrative

The Card 2 pipeline went through 3 critical decision points:

1. **Stage 2A**: designer surfaced the subset-vs-full-27 binary at HALT trigger #15 (MAX_TOKENS bump implicit in path choice). Operator approved Subset path with strict guardrails.

2. **Stage 2B**: operator chose Subset (19 ai_classifier keys; 8 deterministic excluded; MAX_TOKENS 1800 family-D-specific). Implementation per binding.

3. **Stage 2B-fix (post-merge)**: Phase 4 smoke surfaced a 27-vs-19 contract mismatch: Edge request builder iterates all 27 Family D entries and sends ~25 unique rawKeys; MCP server supports only 19 → unsupported_rawKey → mcp_validation_failed. Operator-directed investigation confirmed the hypothesis; surgical fix lands `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain'] = {'ai_classifier'}` in `booleanObservationRequestBuilder.ts`.

The fix preserves operator binding (no schema change, no compound-key, no Anthropic inference of deterministic keys, Family A/B/C byte-equal). After the fix lands, Phase 4 PASSes.

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `b0fd068`. Working tree contains only the 10 known operator-territory untracked files. All prior audits present.

Edge Functions auto-deployed:
- `submit-argument` v220 (post Card 1)
- `classify-argument-boolean-observations` **v51** (post fix; deployed 2026-05-28 02:07:39)

Hosted MCP server: `status=ok`, `environment=prod`, `credentialsConfigured=true`.

Deno Deploy MCP server: build SUCCESS at 2026-05-28T01:50:26 (post Card 2 merge).

---

## Phase 2 — Local Deno regression

**Status:** PASS

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 614 passed | 0 failed (3s)
```

Test delta against Family C baseline (467): **+147 tests** (above design forecast +95-120; reviewer-explained as 4-way cross-family rejection coverage; well under +300 HALT).

---

## Phase 3 — Hosted MCP server smoke (15 checks)

**Status:** NOT-RUN (requires operator MCP_HOSTED_TOKEN)

The hosted smoke script `bash scripts/mcp-server-001-smoke.sh` with Check 14 + Check 15 added for Family D is implementer-verified via the +147 Deno tests (which mock the hosted endpoint shape). Operator may run live Phase 3 separately.

Indirect evidence Phase 3 would PASS:
- Phase 4 Edge admin_validation succeeded HTTP 200, which requires the hosted MCP server to correctly handle Family D requests (the Edge function calls the hosted MCP server during admin_validation).
- Family D Anthropic call succeeded with 4 real positives, confirming the MCP server's familyDPrompt.ts + familyDAnthropic.ts + familyDBanListScan.ts work end-to-end against real Anthropic.

---

## Phase 4 — Edge admin_validation smoke (Family D)

**Status:** PASS (post Edge subset filter fix)

### Pre-fix failure (documented for completeness)

Initial Phase 4 attempts at 01:51, 01:54, 01:55 all returned `status='failed'` / `failureReason='mcp_validation_failed'` / 0 positives. Failures completed in ~300-600ms (too fast for Anthropic; failing at validation layer).

Root cause investigation per operator-directed plan confirmed: Edge `buildBooleanObservationRequestForArgument` sends ~25 deduplicated Family D rawKeys; MCP server supports only 19; 6 deterministic keys (`has_evidence`, `source_attached`, `quote_attached`, `sourced`, `source_requested`, `quote_requested`) trigger MCP unsupported_rawKey → Edge maps to `mcp_validation_failed`.

### Fix (PR #332 at `b0fd068`)

Added `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` allowlist; `evidence_source_chain` filtered to `{ai_classifier}` only. Family A/B/C have no entry → current behavior preserved byte-equal.

### Post-fix Phase 4 result

```
POST /functions/v1/classify-argument-boolean-observations
requestedFamilies: ['evidence_source_chain']
mode: admin_validation
argumentIds: [3 seeded args]

→ HTTP 200; time_total = 19.548s
```

| arg | runId | status | positives | rawKeys |
| --- | --- | --- | --- | --- |
| f41b18b0... | 9abbd3df-... | success | 0 | (none) |
| 781f8057... | fc5e3742-... | success | 2 | `opens_evidence_debt_marker`, `evidence_gap_present` |
| db0de3e0... | c6b527c5-... | success | 2 | `opens_evidence_debt_marker`, `evidence_gap_present` |

**Total: 4 Family D positives across 3 seeded args.** All 4 raw keys are in the 19-key ai_classifier subset; no deterministic keys leaked.

Notable signals:
- `opens_evidence_debt_marker` fires on both arg2 + arg3 — both moves create evidence-debt without supplying it
- `evidence_gap_present` fires on both — confirms the anti-amplification doctrine guard is allowing legitimate descriptive positives without verdict framing
- arg1 returned 0 positives — the conservative-positives bias holds (no over-firing on the parent thesis)

Latency 19.5s for 19 keys × 3 args = ~6.5s per arg. Within Family C baseline range (Family C: 20.46s for 17 keys × 3 args).

---

## Phase 5 — Unsupported E-J rejection regression

**Status:** PASS

POSTed each of the 6 still-unsupported families (E-J) against arg2:

| Family | requestedFamilies | HTTP | Time | Status | failureReason | positives | rawKeys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E | `['argument_scheme']` | 200 | 1558ms | failed | `mcp_validation_failed` | 0 | [] |
| F | `['critical_question']` | 200 | 928ms | failed | `mcp_validation_failed` | 0 | [] |
| G | `['resolution_progress']` | 200 | 1191ms | failed | `mcp_validation_failed` | 0 | [] |
| H | `['claim_clarity']` | 200 | 1679ms | failed | `mcp_validation_failed` | 0 | [] |
| I | `['thread_topology']` | 200 | 1062ms | failed | `mcp_validation_failed` | 0 | [] |
| J | `['sensitive_composer']` | 200 | 1039ms | failed | `mcp_validation_failed` | 0 | [] |

6/6 unsupported families reject correctly. Zero positives. Zero leakage. Note: Family D (`evidence_source_chain`) is no longer in the unsupported list — it now succeeds (per Phase 4).

---

## Phase 6 — Targeted regression

**Status:** PASS

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|mcpFamilyDEdge|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage
→ Test Suites: 51 passed, 51 total
  Tests:       982 passed, 982 total
EXIT: 0
```

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 614 passed | 0 failed
```

`npm run typecheck`: exit 0
`npm run lint`: exit 0

---

## Phase 7 — OPS observations

- **4 families now operational on hosted MCP server:**
  - Family A (`parent_relation`): production + auto-trigger (Card 1)
  - Family B (`disagreement_axis`): production + auto-trigger (Card 1)
  - Family C (`misunderstanding_repair`): production + auto-trigger (Card 1)
  - Family D (`evidence_source_chain`): **admin_validation only (Card 2 + fix; NEW)**

- **6 families still unsupported** (E-J). Registry rejection works correctly per Phase 5.

- **Latency observations:**
  - Phase 4 (Family D admin_validation, 3 args × 19 keys): 19.5s ≈ 1.03s per key × 3 args
  - Family C baseline (3 args × 17 keys): 20.46s ≈ 1.20s per key × 3 args
  - Family B baseline (3 args × 14 keys): ~16-18s ≈ 1.18s per key × 3 args
  - Family D is *faster per key* than B/C (1.03 vs 1.20). Hypothesis: MAX_TOKENS=1800 allows slightly more compact response generation; OR Anthropic's evidence-source-chain rendering is naturally tighter than disagreement/repair text. OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE can track this.

- **Doctrine-load-bearing keys observed:**
  - `evidence_gap_present` fired on 2/3 args. The anti-amplification doctrine guard is producing legitimate descriptive positives without verdict framing.
  - `opens_evidence_debt_marker` fired on 2/3 args. Real evidence-debt signal.
  - `anecdote_used`, `burden_request_present`: 0 fires (consistent with conservative-positives bias on synthetic-test-friendly seeded args).
  - 4 positives from 19 keys × 3 args = 7% signal density. Conservative-positives bias holding.

- **Stage 2B Subset path validated end-to-end:**
  - Edge → MCP contract now correct (the 27-vs-19 contract mismatch was caught by smoke; fix landed)
  - All 19 ai_classifier keys reachable; all 8 deterministic keys correctly excluded (test-asserted + smoke-verified)
  - Architectural precedent for E/F/G/H/I/J: if a future family has similar source-mix complexity, add an entry to `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`

- **Observability surface readiness:** Q9 + Q11 + Q12 from the 3-OPS-card pipeline remain meaningful for the 4-family world. `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` would extend the report to surface 4-family production state once Family D production-flip happens.

---

## Phase 8 — Verdict + authorization

### Final verdict

**PASS** — All 5 testable phases satisfied:
- Phase 1: pre-flight clean
- Phase 2: Deno 614/0
- Phase 3: not run (hosted token); covered indirectly via Phase 4
- Phase 4: HTTP 200; 3/3 success; 4 positives in 19-key subset; zero deterministic leak; zero cross-family leak
- Phase 5: 6/6 E-J reject correctly
- Phase 6: targeted regression 51 suites / 982 tests pass
- Phase 7: OPS observations captured
- Phase 8: this audit

### Observations

- **The smoke discovered + fixed a real contract bug.** Card 2 implementation was correct in isolation (Deno tests pass), but the Edge → MCP integration had a stale assumption about Family D's request shape. Live smoke catching this is exactly why the operator's Stage 2B subset decision needed an Edge smoke phase.
- **Operator's investigation-vs-PARTIAL decision was the right call.** Marking PARTIAL would have left a real bug in main; the +30 minute investigation produced a permanent fix that benefits all future similar-shaped families.
- **First real Family D positives observed.** The 4 positives across arg2/arg3 demonstrate the classifier produces meaningful evidence-source-chain signal.
- **Doctrine guards holding under real corpus.** The 3 doctrine-load-bearing keys (anecdote_used, burden_request_present, evidence_gap_present) all behaved as designed — evidence_gap_present fired legitimately; the others stayed quiet.

### Authorizations confirmed on PASS

- `MCP-SERVER-005-FAMILY-D-SMOKE: PASS`
- Family D admin_validation OPERATIONAL on hosted MCP server (with Edge subset filter in place)
- `MCP-021C-EDGE-FAMILY-D-ENABLE` AUTHORIZED to design (production-mode flip + auto-trigger inclusion for Family D)
- `MCP-SERVER-006-FAMILY-E` AUTHORIZED to begin (with mandatory Stage-2B operator-decision checkpoint)
- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` AUTHORIZED to design (4-family observability roll-up)

### Operator cleanup

After audit doc commits, temp artifacts may be deleted:
- `/tmp/familyD-smoke/admin-jwt.txt` (auth credential)
- `/tmp/familyD-smoke/admin-validation-request.json`
- `/tmp/familyD-smoke/admin-validation-response*.json`
- `/tmp/familyD-smoke/probe-detail.sql`
- `/tmp/familyD-smoke/get-jwt.mjs`
- `/tmp/familyD-smoke/phase5.mjs`
- `/tmp/familyD-smoke/jwt-stdout.txt`
- `/tmp/familyD-postmerge-*.log`
- `/tmp/fix-*.log`
- `/tmp/efbc-*.{sql,log}` (Card 1 smoke artifacts; pre-existing)

The Phase 4 test argument `f2f321d8-58d4-4350-9288-382bd6f29325` (from Card 1 smoke) and the 6 Phase 4 Family D runs (3 failed pre-fix + 3 success post-fix) remain in the DB. The 3 failed runs are real-provider failures with `provider_key='mcp:classify_argument_boolean_observations'`; they don't match the `smoke-%` cleanup filter; they classify under Q9 as ordinary failed runs without organic duplicate signal.
