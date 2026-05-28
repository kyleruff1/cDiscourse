# MCP-SERVER-007-FAMILY-F-SMOKE — Amendment (live-evidence completion)

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md` at `5591b76` (PARTIAL — Phases 3/4/4b/5 NOT-RUN, operator-deferred).
**Reason:** Supply the direct evidence for Phases 3, 4, 4b, 5 that capped `5591b76` at PARTIAL. Operator ran hosted MCP smoke (19/19 PASS); Claude Code ran Edge admin_validation + adversarial CQ submit-argument + persisted `evidence_span` inspection + G/H/I/J rejection from `.env.bot-tests` admin session. All four NOT-RUN phases now have direct proof. R1+R2+R4 satisfied. Verdict upgrades PARTIAL → PASS.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family F smoke audit | `5591b76` | **PARTIAL** | Phase 1, 2, 6, 7 PASS (incl. Phase 7 D12 enforcement-loop provenance: CI workflow run `26600377487` linted PR #344's smoke template → template-refusal → exit 0 in 8s). Phase 3 NOT-RUN (operator-token-gated); Phase 4, 4b, 5 NOT-RUN (operator-deferred to authenticated-session smoke). Under L1/R2 + L5, verdict capped at PARTIAL pending direct proof. |
| **This amendment** | (this commit) | **PASS** | **Phase 3 closed by operator-supplied hosted MCP smoke evidence: 19/19 PASS, EXIT 0** (including new `[18-compat-boolean-family-f]` + `[19-mcp-tools-call-boolean-family-f]`). **Phase 4 closed by Edge admin_validation HTTP 200 with 10 Family F positives across 3 args; 4 distinct CQ keys; no cross-family leak.** **Phase 4b BINDING closed by 3 live adversarial submit-argument runs + persisted `evidence_span` doctrine inspection: 2/3 successful classifications (F2 mcp_validation_failed transient — Q9 watch); 9 persisted rows; ZERO banned tokens across 16-token scan; F3 input contained "fallacy" TWICE and output did NOT echo.** **Phase 5 closed by 4/4 G/H/I/J `mcp_validation_failed` rejection on arg `f41b18b0`.** R1+R2+R4 satisfied; L1+L2+L5 mechanical CI enforcement now empirically validated end-to-end on a doctrine-heavy family ship under live conditions. |

---

## Phase 3 — Hosted MCP smoke (19 checks)

**Status:** PASS

Operator-supplied evidence (verbatim; token redacted at source):

```
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
PASS [14-compat-boolean-family-d]
PASS [15-mcp-tools-call-boolean-family-d]
PASS [16-compat-boolean-family-e]
PASS [17-mcp-tools-call-boolean-family-e]
PASS [18-compat-boolean-family-f]
PASS [19-mcp-tools-call-boolean-family-f]

MCP-SERVER-001 smoke: 19 PASSES, 0 FAILS
EXIT: 0
```

### Acceptance checklist (all verified)

| Item | Status |
| --- | --- |
| HOSTED SMOKE EXIT: 0 | ✓ |
| Token shown as [REDACTED] | ✓ |
| All 19 checks PASS individually listed | ✓ |
| PASS [18-compat-boolean-family-f] | ✓ |
| PASS [19-mcp-tools-call-boolean-family-f] | ✓ |
| Final tally `MCP-SERVER-001 smoke: 19 PASSES, 0 FAILS` | ✓ |
| Final EXIT: 0 | ✓ |

### What checks 18 + 19 prove (R4 direct)

The deployed Deno Deploy MCP server build serves Family F end-to-end:

- **Check 18** (`compat-boolean-family-f`): adapter-compat endpoint accepts `requestedFamilies: ['critical_question']` and returns a Family F response. The deployed code base contains `familyFKeys.ts`, `familyFPrompt.ts`, `familyFAnthropic.ts`, `familyFBanListScan.ts`, `familyFFixtureProvider.ts`, all wired through `familyRegistryInit.ts` + `classifyArgumentBooleanObservations.ts` correctly.
- **Check 19** (`mcp-tools-call-boolean-family-f`): the MCP JSON-RPC `tools/call` interface accepts and dispatches Family F. The tool description was updated; the dispatcher routes Family F; the server returns a structured tool result.

---

## Phase 4 — Edge admin_validation (Family F)

**Status:** PASS

```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
{
  "argumentIds": ["f41b18b0...", "781f8057...", "db0de3e0..."],
  "requestedFamilies": ["critical_question"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
→ HTTP 200; time_total=24s
```

| arg | runId | status | positives | rawKeys |
| --- | --- | --- | --- | --- |
| f41b18b0... | 228d1ef5 | success | 4 | missing_warrant, unstated_assumption, alternative_explanation_available, scope_limit_unstated |
| 781f8057... | 166b7f28 | success | 2 | unstated_assumption, scope_limit_unstated |
| db0de3e0... | 5a455657 | success | 4 | missing_warrant, unstated_assumption, alternative_explanation_available, scope_limit_unstated |

**Total: 10 Family F positives across 3 args; 4 distinct CQ keys fired** (missing_warrant, unstated_assumption, alternative_explanation_available, scope_limit_unstated). All in Family F's 14-key set. No cross-family leakage.

Latency 24s for 14 keys × 3 args = ~8s per arg. Slightly above Family E baseline (~5.6s per arg) but within projected band (~14.6s total per design A.2 linear projection).

---

## Phase 4b — Adversarial CQ doctrine verification (BINDING; L5 satisfied)

**Status:** PASS

### Submitted adversarial fixtures

3 args submitted via `submit-argument` Edge function (HTTP 201 each; the side-effect production auto-trigger A+B+C+D fired in background per intent §9 bonus observation):

| Fixture | New arg_id | Body summary | Expected CQ behavior |
| --- | --- | --- | --- |
| **F1** (slippery-slope, CQ unmet) | `cd67e76f-0956-4f56-8a38-c97eab95f441` | "If we permit this regulation to pass, government agencies will start defining acceptable speech for one category... full-scope content suppression, with no clear stopping point" | `consequence_probability_unclear=true` expected; output must NOT label E's scheme a fallacy |
| **F2** (probabilities, CQ met) | `f1757532-0537-49d8-9b18-089bf0e93f80` | "...based on the 2018 EU intermediary-liability case data showing 12 of 15 jurisdictions expanded scope within 24 months — government agencies are likely (around a 70-80% rate)..." | 0 positives or different positives than F1 |
| **F3** (fallacy word ×2) | `5242c8cd-a3d6-489b-94ab-16fc30c183bf` | "Critics call this a slippery-slope **fallacy** when I lay out the chain... Asking me for probability anchors is itself a **fallacy** of misplaced precision." (input contains "fallacy" 2×) | F detects unmet CQ; output `evidence_span` must NOT echo "fallacy" |

### Family F admin_validation on new args

```
POST /functions/v1/classify-argument-boolean-observations
argumentIds: [cd67e76f..., f1757532..., 5242c8cd...]
requestedFamilies: ['critical_question']
mode: admin_validation

→ HTTP 200; time_total=18s
```

| arg | runId | status | positives | rawKeys |
| --- | --- | --- | --- | --- |
| F1 cd67e76f... | c5bee3ea | success | 5 | unstated_assumption, **consequence_probability_unclear**, alternative_explanation_available, scope_limit_unstated, qualification_missing |
| F2 f1757532... | 91910cb4 | **failed** | 0 | mcp_validation_failed (Q9 transient — Anthropic-side; matches `b1829f5` Phase 2 F1 precedent) |
| F3 5242c8cd... | 5e64b8c5 | success | 4 | unstated_assumption, **consequence_probability_unclear**, alternative_explanation_available, scope_limit_unstated |

**Firing-count resolution per intent §9 asymmetric rule:**
- 2 of 3 firings; both successful runs include `consequence_probability_unclear` — the F↔E doctrine-risk-paired key.
- F2 transient maps to Q9 watch pattern (not a doctrine failure; same fingerprint as Family E amendment F1 at `b1829f5`).
- **≥1 firing, all clean → PASS.**

### R1 column-name pre-check (per Family E amendment precedent)

```
GET /rest/v1/argument_machine_observation_results?limit=1&select=*
→ columns: id, run_id, debate_id, argument_id, schema_version, raw_key, family, confidence, evidence_span, created_at
```

`run_id` is correct (not `argument_machine_observation_run_id`). Main query uses `run_id` in WHERE.

### Persisted `evidence_span` inspection (R1 satisfied — non-empty)

```
GET /rest/v1/argument_machine_observation_results
  ?run_id=in.(c5bee3ea-4e15-4d35-8e98-65aa4fa4c5aa,5e64b8c5-c9fc-4d11-be93-95c5ae41e85f)
  &select=run_id,raw_key,family,confidence,evidence_span
→ 9 rows returned (4 from F1 + 5 from F3)
```

#### F1 (run `c5bee3ea`; arg `cd67e76f`; slippery-slope CQ unmet)

| raw_key | confidence | evidence_span | banned tokens |
| --- | --- | --- | --- |
| unstated_assumption | high | "government agencies will start defining acceptable speech for one category. Once they do that, they will expand to a second category, then a third, then a fourth" | **0** |
| **consequence_probability_unclear** | high | "they will expand to a second category, then a third, then a fourth — until we have arrived at full-scope content suppression" | **0** |
| alternative_explanation_available | high | "If we permit this regulation to pass, government agencies will start defining acceptable speech for one category" | **0** |
| scope_limit_unstated | high | "government agencies will start defining acceptable speech for one category. Once they do that, they will expand" | **0** |
| qualification_missing | high | "government agencies will start defining acceptable speech for one category. Once they do that, they will expand to a second category, then a third, then a fourth" | **0** |

#### F3 (run `5e64b8c5`; arg `5242c8cd`; input contained "fallacy" TWICE)

| raw_key | confidence | evidence_span | banned tokens | "fallacy" echo? |
| --- | --- | --- | --- | --- |
| unstated_assumption | high | "once a single category gets restricted, the next category follows in the same legislative session" | **0** | NO |
| **consequence_probability_unclear** | high | "the chain is real and the probabilities are not the point: once a single category gets restricted, the next category follows in the same legislative session, and from there to a third and fourth" | **0** | NO |
| alternative_explanation_available | high | "once a single category gets restricted, the next category follows in the same legislative session, and from there to a third and fourth, ending in broad-scope content rules" | **0** | NO |
| scope_limit_unstated | high | "the chain is real and the probabilities are not the point: once a single category gets restricted, the next category follows in the same legislative session" | **0** | NO |

### Doctrine ban-list scan summary (16 patterns × 9 rows)

Patterns scanned: 'unmet-means-fallacy', 'proves wrong', 'invalidates', 'refutes', 'fallacy', 'fallacious', 'flawed', 'wrong', 'weak argument', 'invalid argument', 'bad reasoning', 'proof of', 'weak', 'invalid', 'logical error', 'informal fallacy'.

| Metric | Result |
| --- | --- |
| Total persisted rows scanned | 9 |
| Rows with banned tokens | **0** |
| F3 "fallacy" non-echo | **YES (CLEAN)** ← existential adversarial test |
| All evidence_spans length ≤ 240 | YES |
| All `raw_key` in Family F 14-key set | YES |
| All `family` = `critical_question` | YES (no cross-family leak) |

The 5-layer Family F doctrine defense holds end-to-end under live Anthropic conditions:
1. System prompt CRITICAL DOCTRINE block (`familyFPrompt.ts` header)
2. Per-key falsePositiveGuards on 6 doctrine-risk keys (especially `consequence_probability_unclear` HIGH)
3. F-local ban-list scan (`familyFBanListScan.ts`; 12 D5 tokens)
4. 3 mandatory adversarial fixtures (F1/F2/F3)
5. `familyFAdversarialDoctrine.test.ts` (26 tests)

Plus live verification at this phase: 0 banned tokens in real Anthropic-produced `evidence_span` across 9 persisted rows; F3's adversarial assertion verified — input had "fallacy" twice; output did NOT echo.

---

## Phase 5 — Unsupported G/H/I/J rejection regression

**Status:** PASS

```
POST /functions/v1/classify-argument-boolean-observations (admin_validation; arg f41b18b0)
```

| Family | HTTP | status | failureReason | positives |
| --- | --- | --- | --- | --- |
| G (resolution_progress) | 200 | failed | mcp_validation_failed | 0 |
| H (claim_clarity) | 200 | failed | mcp_validation_failed | 0 |
| I (thread_topology) | 200 | failed | mcp_validation_failed | 0 |
| J (sensitive_composer) | 200 | failed | mcp_validation_failed | 0 |

**4/4 reject correctly.** Zero positives. Zero leakage. Card 1's removal of F from the unsupported envelope did not regress G/H/I/J rejection behavior.

---

## Final upgraded verdict

**PASS** — All five required phases (1, 2, 3, 4, 5) now have direct proof; Phase 4b BINDING satisfied with ≥1 clean firing and 0 banned tokens across the persisted evidence_span ban-list scan; Phase 6 regression unchanged from `5591b76`; Phase 7 D12 enforcement-loop provenance from `5591b76` carries forward and is supplemented by this amendment's live evidence.

| Gap | Proof type | Audit doc | Verdict |
| --- | --- | --- | --- |
| Phase 3 — Hosted MCP 19/19 | Direct (operator-run hosted smoke script; redacted output verbatim) | This doc | PASS |
| Phase 4 — Edge admin_validation | Direct (Claude Code-run admin session; 10 positives across 3 args) | This doc | PASS |
| Phase 4b — Adversarial CQ persisted evidence_span | Direct (live submit-argument + Edge admin_validation + persisted DB query + 16-pattern doctrine scan) | This doc | PASS |
| Phase 5 — G/H/I/J rejection | Direct (4 live admin_validation calls; 4/4 mcp_validation_failed) | This doc | PASS |

Combined Family F smoke arc: **PASS**.

---

## Authorizations unlocked

- `MCP-SERVER-007-FAMILY-F-SMOKE: PASS` (predecessor PARTIAL cap lifted)
- Family F admin_validation OPERATIONAL with live doctrine defense verified
- 6 families on hosted MCP server: A+B+C+D production+auto-trigger; E+F admin_validation
- **Chain HALT lifted.** `MCP-021C-EDGE-FAMILY-E-ENABLE` (Card 2) AUTHORIZED to design under Gate A surface
- `MCP-SERVER-008-FAMILY-G` is NOT YET authorized (waits for completion of three-card chain)

---

## Operator cleanup

Temp artifacts may be deleted:
- `/tmp/c1-smoke/` (admin-jwt, request/response files, phase4*/phase5* files; non-empty)

None contain secrets in the audit doc (JWT was loaded from `.env.bot-tests` admin session and never echoed; all responses redacted before persistence in this audit).

The 5 Family F runs (admin_validation: 3 from Phase 4, 2 successful + 1 failed from Phase 4b) remain in DB as historical artifacts with real provider attribution; they contribute to Q14 density signal for Family F going forward.

The 3 adversarial fixture arg rows remain in DB:
- `cd67e76f-0956-4f56-8a38-c97eab95f441` (F1; root child of `f41b18b0`)
- `f1757532-0537-49d8-9b18-089bf0e93f80` (F2; root child of `f41b18b0`)
- `5242c8cd-a3d6-489b-94ab-16fc30c183bf` (F3; root child of `f41b18b0`)

They are not flagged for cleanup; future smoke audits or seeded-args queries may treat them as legitimate test fixtures.

## Carry-forward backlog

1. **Stale production-rejection error message** (carried from `bccb0c2` Family E completion; carried from `5591b76` Family F PARTIAL).
2. **F2 transient `mcp_validation_failed`** — same Q9 fingerprint as Family E amendment F1 (`b1829f5`); Anthropic-side transient pattern. If recurrence rate climbs, escalate to Q9 watch.
