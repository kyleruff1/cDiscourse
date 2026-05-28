# MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE — Post-merge audit (terminal card; chain complete)

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor:** MCP-021C-EDGE-FAMILY-F-ENABLE shipped at `65dbfc3` (PR #348; squash-merge of 3 implementation commits + designer `c04fed2` + reviewer `422166e`).
**Audit doctrine:** Verifies Family F (critical_question) production-mode flip is live end-to-end. **Second production-enable card under L3+L4+L5 CI enforcement; first card under L5 BINDING (operator-binding for critical_question; CI DOCTRINE_RISK_FAMILIES extension to F is a future OPS card).** Terminal card of the 3-card chain.

---

## Verdict

**PASS** — All 8 phases satisfied. L3+L4+L5 each satisfied by an explicit phase. **Phase 4b L5 BINDING CLEAN** under live PRODUCTION-mode Anthropic call: 7 evidence_span rows scanned across 16 doctrine ban-list patterns; zero dirty rows; zero "fallacy" echoes; doctrine defense holds end-to-end. 6-family auto-trigger live (A+B+C+D+E+F); G/H/I/J do NOT fire in production. No regression to A/B/C/D/E. No banned-token HALT triggered.

**Authorizations granted on PASS:**
- `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE: PASS`
- Family F PRODUCTION + auto-trigger LIVE (6 production families: A+B+C+D+E+F)
- **3-card chain COMPLETE**
- `MCP-SERVER-008-FAMILY-G` AUTHORIZED to begin (G/H/I/J still unsupported)

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `65dbfc3`. Working tree only the 10 known operator-territory untracked files. Edge Functions auto-deployed by Supabase GitHub integration after squash-merge (~90s wait observed).

Family F Edge registry posture (verified post-merge):
```
{
  family: 'critical_question',
  productionEnabled: true,
  adminValidationEnabled: true,
},
```

Flip from `false → true` confirmed live. `adminValidationEnabled` preserved at `true` (HALT #4 defense).

---

## Phase 2 — Dispatch success (L3a)

**Status:** PASS

Deliberately critical-question-targeted body submitted via `submit-argument` Edge function (per operator binding: NEW text; NOT `781f8057`; NOT prior Card 1 fixtures):

> "Mandatory onboarding flows fundamentally harm new user experiences because they replicate the failure modes we saw with tutorial-heavy software in the 2000s. The pattern is essentially the same: feature dumps disguised as guidance. Companies that adopt them lose retention because friction compounds at every step. We should treat any product with a multi-step onboarding as structurally suspect — the more screens, the worse the design judgment behind it. The successful products of the last decade all share this trait of letting users start immediately."

- HTTP 201 from `submit-argument` (5s wall time)
- New arg_id: `163d66d1-dc7b-422f-aa55-5f37e2d10b29`
- parent_id: `f41b18b0-8ad6-4865-94c5-17a568f6a6ad`; debate_id: `1e598dce-8188-4c7e-bdd6-aedede750923`

### 6-family auto-trigger result

After ~75s wait for `EdgeRuntime.waitUntil()` background dispatch:

| # | run | family | run_mode | status | timestamp (UTC) |
| - | --- | --- | --- | --- | --- |
| 1 | (A) | parent_relation | production | success | 23:54:29 |
| 2 | (B) | disagreement_axis | production | success | 23:54:33 |
| 3 | (C) | misunderstanding_repair | production | success | 23:54:38 |
| 4 | (D) | evidence_source_chain | production | success | 23:54:44 |
| 5 | (E) | argument_scheme | production | success | 23:54:49 |
| 6 | **a5384272** | **critical_question** | **production** | **success** | **23:54:55** |

**6/6 production runs success.** Sequential dispatch confirmed. Total background dispatch ~26s (within `EdgeRuntime.waitUntil()` budget; user-facing submit response was 5s; latency tracks the design A.4 ~27-28s projection well within 38% margin under 45s threshold).

### G/H/I/J production runs?

| Family | Production runs | Expected |
| --- | --- | --- |
| resolution_progress | 0 | 0 (unsupported) |
| claim_clarity | 0 | 0 (unsupported) |
| thread_topology | 0 | 0 (unsupported) |
| sensitive_composer | 0 | 0 (unsupported) |

**0/4 unsupported families ran in production.** Auto-trigger correctly extends only to the 6 `productionEnabled=true` families.

---

## Phase 3 — Targeted classifier-signal success (L3b + L4)

**Status:** PASS

Query persisted `argument_machine_observation_results` for the Family F production run (`a5384272`):

| raw_key | confidence | evidence_span (truncated 120) |
| --- | --- | --- |
| unstated_assumption | high | "The pattern is essentially the same: feature dumps disguised as guidance. Companies that adopt them lose retention becau…" |
| **causal_mechanism_missing** | high | "Companies that adopt them lose retention because friction compounds at every step." |
| **analogy_mapping_missing** | high | "they replicate the failure modes we saw with tutorial-heavy software in the 2000s. The pattern is essentially the same: …" |
| example_representativeness_unclear | high | "The successful products of the last decade all share this trait of letting users start immediately." |
| alternative_explanation_available | high | "Companies that adopt them lose retention because friction compounds at every step." |
| scope_limit_unstated | high | "Mandatory onboarding flows fundamentally harm new user experiences" |
| qualification_missing | high | "Mandatory onboarding flows fundamentally harm new user experiences because they replicate the failure modes we saw with …" |

**7 Family F production positive result rows on deliberately CQ-targeted text.**

- All `family=critical_question` (no cross-family leak)
- All `raw_key` in the 14-key Family F set
- **7 distinct CQ keys fired** (50% key-surface coverage on a single arg; density 50% per-key — strong signal)
- L4 satisfied: deliberately-targeted text → ≥1 positive result row (7 actually)

`consequence_probability_unclear` did NOT fire (no slippery-slope content in the targeted body; this is correct calibration — F's CQ probes are content-sensitive, not unconditional).

### Operator fallback rule status

- **First targeted fixture returned `mcp_validation_failed`?** NO (status=success on F run)
- Fallback fixture path NOT exercised; fresh targeted text succeeded on first attempt
- No HALT condition triggered

---

## Phase 4 — Read-path success (L3c)

**Status:** PASS

Production read path verification for new arg `163d66d1`:

| Metric | Result |
| --- | --- |
| Total result rows for arg | 17 |
| Production-mode result rows | 17 |
| Admin_validation-mode result rows | 0 (NOT counted as production proof) |
| Production positives per family | parent_relation=2, evidence_source_chain=3, argument_scheme=5, **critical_question=7** |
| Family F production rows visible via Source 6 | **YES (7 rows)** |

**L3c satisfied:** Family F production rows visible through the production read path (`run_mode='production'` joined). admin_validation rows are NOT counted as production proof (this arg has no admin_validation runs; the negative case is implicit via the explicit run_mode filter).

disagreement_axis and misunderstanding_repair produced 0 positives on this content — expected (B and C fire only on specific patterns; the targeted text exercised A's parent-relation pattern, D's evidence-chain markers, E's argument schemes, and F's critical questions, but not B or C).

---

## Phase 4b — DOCTRINE (L5 BINDING; existential terminal-card test)

**Status:** PASS

R1 column-name pre-check verified `argument_machine_observation_results` has columns including `run_id`, `raw_key`, `family`, `evidence_span` (consistent with Card 1 amendment and Card 2 smoke).

### Doctrine ban-list scan over persisted Family F PRODUCTION `evidence_span`

16 patterns scanned (12 D5 binding from Card 1 intent + 4 supplemental from Family E amendment): `unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`, `fallacy`, `fallacious`, `flawed`, `wrong`, `weak argument`, `invalid argument`, `bad reasoning`, `proof of`, `weak`, `invalid`, `logical error`, `informal fallacy`.

| raw_key | evidence_len | banned token hits |
| --- | --- | --- |
| unstated_assumption | ~149 | **0 (CLEAN)** |
| causal_mechanism_missing | 82 | **0 (CLEAN)** |
| analogy_mapping_missing | ~149 | **0 (CLEAN)** |
| example_representativeness_unclear | 100 | **0 (CLEAN)** |
| alternative_explanation_available | 82 | **0 (CLEAN)** |
| scope_limit_unstated | 53 | **0 (CLEAN)** |
| qualification_missing | ~149 | **0 (CLEAN)** |

| Metric | Result |
| --- | --- |
| Total rows scanned | 7 |
| Dirty rows | **0** |
| Any evidence_span echoes "fallacy"? | **0** |
| L5 BINDING verdict | **CLEAN (PASS)** |
| HALT condition triggered? | **NO** |

**The 5-layer Family F doctrine defense holds end-to-end under live PRODUCTION-mode Anthropic call.** This is the existential terminal-card test — Family F's CQ probes operate as DESCRIPTIVE structural identification, never as verdicts:
- `causal_mechanism_missing`: identifies the gap ("friction compounds at every step" — describes the proposed mechanism without filling it in)
- `analogy_mapping_missing`: identifies the absent mapping ("replicate the failure modes we saw with tutorial-heavy software" — analogy invoked without explicit dimension mapping)
- `example_representativeness_unclear`: identifies the absent representativeness defense ("successful products of the last decade all share this trait" — example category invoked without representativeness justification)
- `qualification_missing`: identifies the absent qualification ("Mandatory onboarding flows fundamentally harm new user experiences" — broad universal claim)
- `scope_limit_unstated`: identifies the absent scope limit (same body)

NONE of these are framed as "wrong" or "fallacious" or "invalid". Each CQ output is a descriptive probe on absence/gap — exactly the doctrine-clean shape Card 1's prompt was designed to produce, now validated under production-mode conditions.

---

## Phase 5 — Observability

**Status:** PASS

### Q9 (organic_duplicate_candidate watch)

Top 6 production runs since this smoke (timestamps 23:54:29-23:54:55) are the new arg's 6-family auto-trigger; immediately prior runs are from Card 2 (22:22-22:23) and earlier 4-family runs. **No `organic_duplicate_candidate` signal possible** for our new arg (first runs on this argument; no prior production run to duplicate against).

### 6-family operational state (chain terminal milestone)

| Family | Production | Auto-trigger | Admin validation | This card change |
| --- | --- | --- | --- | --- |
| A (parent_relation) | YES | YES | YES | byte-equal |
| B (disagreement_axis) | YES | YES | YES | byte-equal |
| C (misunderstanding_repair) | YES | YES | YES | byte-equal |
| D (evidence_source_chain) | YES | YES | YES | byte-equal |
| E (argument_scheme) | YES | YES | YES | byte-equal (Card 2) |
| **F (critical_question)** | **YES (NEW)** | **YES (NEW)** | YES | **flipped this card** |

4 still-unsupported families: G (resolution_progress), H (claim_clarity), I (thread_topology), J (sensitive_composer). Each rejects under `mcp_validation_failed`. **MCP-SERVER-008-FAMILY-G authorized to begin.**

### Density signal for Family F (first real production data)

- **7 positives / 14 keys × 1 arg = 50% per-key density on the CQ-targeted arg** — well above Card 1 admin baseline (27.1% per-(run,key)) and above Family E production baseline (Phase 3 Card 2: 4/16 = 25%)
- 7 distinct CQ keys fired (across causal/analogy/example/alternative/qualification/scope/assumption probes)
- Strong real-world signal under production conditions

### Latency observation (5-family → 6-family transition)

| State | Background dispatch | Headroom under 45s threshold |
| --- | --- | --- |
| Pre-Card-2 (4-family A+B+C+D) | ~18-20s | ~60% |
| Card 2 live (5-family A+B+C+D+E) | 22s | ~51% |
| **Card 3 live (6-family A+B+C+D+E+F)** | **26s** | **42%** |
| Design A.4 projection (6-family) | 27-28s | 38% |

Within projection. `EdgeRuntime.waitUntil()` budget (~150s) → 5.8x headroom.

---

## Phase 6 — Regression

**Status:** PASS

```
npm run typecheck → EXIT 0
npm run lint → EXIT 0
npx jest --no-coverage → 572 suites / 18,192 tests / EXIT 0
cd mcp-server && deno test --allow-net --allow-env --allow-read → 871 / 0 / EXIT 0
4 historical audit-lint fixtures: 1, 0, 0, 0 (unchanged)
```

A/B/C/D/E production behavior unregressed (FFE-10..14 defensive tests + this smoke's 6-family success confirm). admin_validation still works for F (FFE-2 + AVM-11c). Cross-family byte-equal preserved per reviewer matrix.

---

## Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE

**Status:** PASS

### Third-enforcement provenance (binding centerpiece of this audit; chain-terminal)

> "Third-enforcement provenance: second PRODUCTION-ENABLE card linted by audit-lint CI; first card under L5 BINDING obligation (operator-binding for critical_question; CI DOCTRINE_RISK_FAMILIES extension to F deferred to follow-up OPS card per intent §2 OUT). CI workflow run ID: `26609170897` (https://github.com/kyleruff1/cDiscourse/actions/runs/26609170897/job/78411047702); in_scope count: 1 (PR #348 added `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md` — classified IN SCOPE by A-rule → linter detected as template via filename → SKIPPED → exit 0 in 10s); linter exit: 0. L3 satisfied by Phases 2+3+4 (dispatch ✓ + targeted-signal ✓ + read-path ✓). L4 satisfied by Phase 3 targeted CQ text producing 7 positive result rows. L5 BINDING satisfied by Phase 4b persisted evidence_span doctrine inspection (7 clean firings; 0 banned tokens across 16-pattern scan; no fallacy echo)."

### 3-card chain completion summary

| Card | Status | Authorization granted |
| --- | --- | --- |
| Card 1 — MCP-SERVER-007-FAMILY-F (Family F admin ship) | PASS via amendment `deff068` (Phase 4b live) | Card 2 unlocked via Gate A |
| Card 2 — MCP-021C-EDGE-FAMILY-E-ENABLE (Family E production flip) | PASS via `1ca701a` (first L3+L4+L5 enforcement) | Card 3 unlocked via Gate B |
| **Card 3 — MCP-021C-EDGE-FAMILY-F-ENABLE (Family F production flip)** | **PASS (this audit)** | **MCP-SERVER-008-FAMILY-G AUTHORIZED** |

**Chain terminal state:** 6 production families operational (A+B+C+D+E+F); 4 unsupported (G/H/I/J); audit-lint CI enforcement empirically validated end-to-end across 3 PRs (1 family-ship + 2 production-enables) with L3+L4+L5 + L5 BINDING all live-tested clean.

### Doctrine-key calibration (Family F production-mode)

7 of 14 CQ keys fired clean on a single CQ-targeted arg under production-mode Anthropic call. Density 50% per-key (above Card 1 admin baseline 27% and Card 2 Family E production 25%). The Family F 5-layer doctrine defense (system prompt CRITICAL DOCTRINE block + 6 per-key falsePositiveGuards on doctrine-risk keys + F-local ban-list scan + 5 fixtures including 3 mandatory adversarial + 26 unit tests + ban-list runtime check) — built at Card 1 ship `1ee8ab3` and amendment-verified at `deff068` — now empirically validated in PRODUCTION mode under live conditions on a fresh CQ-targeted argument.

### Q11 / Q14 (per-family per-mode coverage + density)

`scripts/ops/mcp-observability-report.mjs --no-write` exit 0 — all 16 queries (Q1-Q15) execute cleanly. Report runs successfully under the new 6-family production posture.

---

## Phase 8 — Verdict + authorization

### Final verdict

**PASS** — All five required phases (1, 2, 3, 4, 5) + Phase 4b (L5 BINDING) + Phase 6 (regression) + Phase 7 (ops + chain-completion) have direct proof. L3+L4+L5 each satisfied by an explicit phase. L5 BINDING obligation satisfied operator-side (CI DOCTRINE_RISK_FAMILIES extension to F remains a follow-up). CI workflow on the smoke audit's containing PR will exit 0.

### Pre-push audit-lint (D6 binding)

```
node scripts/ops/audit-lint.mjs docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-2026-05-28.md
→ verdict: PASS
→ findings: 0 (PASS)
→ EXIT: 0
```

(Verified locally before commit.)

### Authorizations confirmed on PASS

- `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE: PASS`
- Family F PRODUCTION + auto-trigger LIVE
- **3-card chain COMPLETE** (Card 1 + Card 2 + Card 3 all PASS)
- 6 production families operational on hosted MCP (A+B+C+D+E+F production+auto-trigger)
- 4 unsupported families (G/H/I/J) — each rejects under `mcp_validation_failed`
- `MCP-SERVER-008-FAMILY-G` AUTHORIZED to begin
- Suggested follow-up OPS card: extend `scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES` to include `critical_question` (Family F) — closes the gap where L5 is operator-binding rather than CI-mechanical

### Operator cleanup

Temp artifacts may be deleted:
- `/tmp/c1-smoke/` (admin-jwt, signin tokens, request/response files for Cards 1+2+3 phases; non-empty)

None contain secrets in this audit. JWT was loaded from `.env.bot-tests` admin session and never echoed; all responses redacted before persistence here.

The 6 Family F runs (1 production from this smoke + 5 admin_validation from Card 1) and the 17 result rows from new arg `163d66d1` remain in DB as historical artifacts; they contribute to Q14 production density signal for Family F going forward.

## Carry-forward backlog

1. **Stale production-rejection error message** (carried from `bccb0c2`, `5591b76`, `deff068`, `1ca701a`).
2. **F1/F2 transient `mcp_validation_failed` pattern** (Q9 watch; Anthropic-side baseline ~3-4% rate; not Family-F-specific; reviewed at Gate B as proportionate to cross-family baseline).
3. **`DOCTRINE_RISK_FAMILIES` extension** — file follow-up OPS card to add `critical_question` so L5 BINDING is CI-enforced for F-prefix smoke audits in addition to operator-binding (this card's mechanism).
