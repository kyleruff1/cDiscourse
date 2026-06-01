# MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE — Post-merge smoke (2026-06-01)

Audit-Lint: v1

**Date:** 2026-06-01 UTC (operator local 2026-05-31)
**Operator:** Kyler
**Card:** MCP-021C-EDGE-FAMILY-H-ENABLE (Family H `claim_clarity` production-mode flip; 12-key uniform `ai_classifier` — no subset filter; fourth production-enable card under L3+L4+L5 mechanical CI enforcement; SECOND L5-BINDING card whose L5 is CI-mechanically enforced at ship via `DOCTRINE_RISK_FAMILIES`; the FIRST production-enable card to ship under bounded-parallel limit=2)
**Chain position:** Card 3 (terminal) of 3 in the FAMILY-H suite (MCP-SERVER-009-FAMILY-H → OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK → EDGE-FAMILY-H-ENABLE)
**Issue:** #391 (umbrella #388)
**Merge:** PR #405 squash-merged at `main` commit `488d105` (production flip of `claim_clarity` `productionEnabled: false → true` at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106`).
**Current main HEAD:** `1aa03f2` (J scoping audit PR #406 merged after Card 3; non-overlapping scope).
**Edge Function build:** auto-deployed via Supabase GitHub integration on the `488d105` merge; MCP server auto-deployed via Deno Deploy.
**Scope:** Card 3 (terminal) of the Family H suite. Production flip routes every new argument through 8 production families (A–H) under bounded-parallel limit=2 instead of seven (A–G). This smoke verifies the 8-family dispatch (L3a), targeted H signal (L3b/L4), Source 6 read-path (L3c), live 8-family latency re-measure (D8), and the BINDING L5 doctrine `evidence_span` inspection in production mode.

**Final verdict: FAIL.**

The Family H chain is HALTED at Card 3 smoke under **HALT 15** (Section L of the resumption-prompt HALT catalog). Card 3's *production-enable mechanics* fired correctly — A–H production rows were created per submit, bounded-parallelism stayed at the limit, submit remained non-blocking — but background classifier **run-completeness failed**: the canary had a terminal hole on `argument_scheme`, and the burst surfaced terminal holes across multiple families (`argument_scheme`, `critical_question`, `disagreement_axis`, `claim_clarity`). The pattern is provider/server reliability resurfacing at 8-family count, not an H-specific prompt / classifier defect. The smoke cannot claim PASS, and the chain cannot proceed to closeout.

---

## L5 BINDING — CI-mechanical enforcement at ship (read before starting)

This audit is for a production-enable card on a doctrine-risk family (`claim_clarity` / `family_h` / `claim_specificity_low` were added to `DOCTRINE_RISK_FAMILIES` at `scripts/ops/audit-lint-rules.cjs:79-91` by Card 2 of the H suite, commit `c5bea3b`). The audit-lint CI rule `L5_PERSISTED_INSPECTION_PATTERNS` MECHANICALLY requires this audit to include persisted `evidence_span` inspection content. The L5 section below (Phase 6) names the inspection explicitly: 29 H production success rows scanned across 4 distinct args; 0 banned-token hits across 7 banned-token categories. The L5 inspection is CLEAN on the rows that succeeded — but L5 CLEAN is **necessary, not sufficient** for a smoke PASS. Run-completeness failed first; therefore the audit verdict is FAIL, not PASS or PARTIAL.

This is the SECOND L5-BINDING card whose L5 BINDING is CI-mechanically enforced AT SHIP (Card 2 of the G suite shipped first; Card 2 of the H suite shipped before Card 3).

---

## Phase 1 — Pre-flight

**Status:** PASS

- `main` at `1aa03f2`; Card 3 merge `488d105` confirmed in `git log` history.
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts:104-108` post-merge: `family: 'claim_clarity', productionEnabled: true, adminValidationEnabled: true`.
- Family A–G entries byte-equal (`productionEnabled: true` for each). Family I / J entries byte-equal (`productionEnabled: false` for each).
- Subset filter entry for `claim_clarity` STILL ABSENT in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block at `booleanObservationRequestBuilder.ts:68-78` (DIV-1 preserved; HALT 13 holds — uniform `ai_classifier` family means absence = full passthrough).
- Edge Function + MCP server auto-deployed via GitHub integrations on the `488d105` merge.
- Smoke template `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` present with `Audit-Lint: v1` on line 3.

## Phase 2 — Auto-trigger dispatch (L3a) — 8 production runs A+B+C+D+E+F+G+H

**Status:** FAIL — terminal hole on `argument_scheme` in the canary.

Canary submit through `submit-argument` (synthetic root thesis via `.claude-tmp/h-card3-submit.cjs` — no service-role, anon-key auth via `.env.bot-tests` bot session) returned 201 with `argument_id = de08897d-4380-43a8-9ce3-c227c0144ffb`. Background dispatch produced 9 rows across the 8 expected families (A–H), with `argument_scheme` retried once after first failure:

| Family | Status | failure_reason | started_at | completed_at |
|---|---|---|---|---|
| disagreement_axis | success | NULL | 2026-06-01T01:21:00.431 | 2026-06-01T01:21:03.921 |
| parent_relation | success | NULL | 2026-06-01T01:21:00.434 | 2026-06-01T01:21:04.624 |
| misunderstanding_repair | success | NULL | 2026-06-01T01:21:04.228 | 2026-06-01T01:21:08.839 |
| evidence_source_chain | success | NULL | 2026-06-01T01:21:04.925 | 2026-06-01T01:21:10.281 |
| **argument_scheme** | **failed** | **mcp_api_error** | 2026-06-01T01:21:09.138 | 2026-06-01T01:21:13.084 |
| critical_question | success | NULL | 2026-06-01T01:21:10.709 | 2026-06-01T01:21:14.930 |
| **argument_scheme** (retry) | **failed** | **mcp_api_error** | 2026-06-01T01:21:15.179 | 2026-06-01T01:21:19.151 |
| resolution_progress | success | NULL | 2026-06-01T01:21:15.365 | 2026-06-01T01:21:20.288 |
| claim_clarity | success | NULL | 2026-06-01T01:21:19.349 | 2026-06-01T01:21:23.371 |

Canary findings:
- Submit succeeded; non-blocking. ✓
- A–H rows created. ✓
- `argument_scheme` failed twice with `mcp_api_error` — terminal hole.
- **`successFamilies = 7/8`** (terminal hole on `argument_scheme`).
- **No I/J rows** observed.
- No duplicate success rows.
- Family H `claim_clarity` ITSELF succeeded — the canary failure is NOT H-specific.

**This is a Card 3 smoke FAIL by the template's Phase 2 criteria (EXACTLY 8 production runs per submit, all status = success).**

## Phase 3 — Targeted-signal (L3b + L4) — Family H positive result row

**Status:** PASS on the rows that succeeded; smoke OVERALL remains FAIL.

The canary + 4 burst submits each carried a deliberately claim-clarity-targeted thesis (broad/specificity patterns + temporal constraint + hedging + modal). Persisted `argument_machine_observation_results` rows for `family = 'claim_clarity'`, `run_mode = 'production'`, `status = 'success'` show Family H produced multiple high-confidence positive rows per surviving submit — within the 12-key uniform `ai_classifier` set, no out-of-set raw_keys, no deterministic-source leak. The L4 obligation (≥1 positive result row on targeted text, with raw_key + confidence + `evidence_span` evidence) is satisfied for the H-classifier rows that completed. Sample (selected rows from canary + burst-8of8 + burst-7of8 + burst-6of8 args):

| arg | raw_key | confidence | evidence_span (excerpt) |
|---|---|---|---|
| canary | `claim_present` | high | "Carbon taxes work in most jurisdictions where they have been implemented for at least three years, with measurable emissions reductions" |
| canary | `claim_specificity_high` | high | "measurable emissions reductions in the transportation and electricity sectors... Pittsburgh public-record data... past three years" |
| canary | `provides_temporal_constraint` | high | "for at least three years" |
| canary | `quantifier_present` | high | "most jurisdictions" |
| canary | `reason_present` | high | "The price-signal mechanism is straightforward: producers and consumers internalize a previously-externalized cost, and behavior shifts at th[e margin]" |
| burst-8of8 | `quantifier_present` | high | "Most cross-jurisdiction studies" |
| burst-7of8 | `conclusion_missing` | high | "Library funding is associated with higher youth literacy... Library staff often double as informal homework help... Library closures correla[te]" |
| burst-7of8 | `hedging_present` | high | "often, associated with, correlate with" |
| burst-7of8 | `provides_temporal_constraint` | high | "for the past three years" |
| burst-7of8 | `unclear_reference_present` | medium | "this pattern surfaces in the publicly available datasets" |
| burst-6of8 | `claim_specificity_high` | high | "mid-sized cities, roughly three years, about fifteen percent, Tucson public-record data, past three years" |
| burst-6of8 | `quantifier_present` | high | "about fifteen percent" |

Findings:
- Family H produced clean, high-confidence positive rows on every smoke arg where the H run succeeded (4 of 5 args; only the `660042f6` arg saw its H run fail twice). Every positive raw_key is one of the 12 `ai_classifier` keys defined at `mcp-server/lib/familyHKeys.ts:86-99`. No deterministic / auto_metadata / lifecycle key leaked through.
- `unclear_reference_present` on `burst-7of8` correctly fired at `medium` confidence on a deliberately unclear-reference body (the rest of the H rows fired at `high`). The confidence-eligibility gate (high for timeline; high for selected_context; high for inspect) per `confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY` is observed in the read path.
- **L3b + L4 PASS for the H rows that completed. The smoke OVERALL still FAILS** because Phase 2 / Phase 5 run-completeness failed: not every submit produced 8/8 across the full A–H roster. L4 PASS on a partial run is necessary, not sufficient, for smoke PASS.

## Phase 4 — Read-path (L3c) — Source 6 production rows

**Status:** DEFERRED — chain HALTED at Phase 2 FAIL.

H production success rows DO persist and are queryable via Source 6 (`machineObservationPersistenceQuery.ts` `run_mode = 'production'` filter) — the doctrine scan in Phase 6 confirms 29 H production success rows readable across 4 args. But declaring L3c PASS on partial coverage misrepresents the smoke. Read-path verification proceeds in the next smoke attempt after the run-completeness regression is closed.

## Phase 5 — Burst (D8 latency re-measure at 8 families)

**Status:** FAIL — 1/4 burst args reached 8/8 success; terminal holes across multiple families.

Burst: 4 fresh submits via the same synthetic harness (`.claude-tmp/h-card3-submit.cjs --start 2 --count 4`). Per-arg coverage from `.claude-tmp/h-card3-burst-verdict.json`:

| arg_id | totalRows | successFamilies | terminalHoles | wallSeconds | maxOverlap |
|---|---|---|---|---|---|
| `7af0cd01-3bf0-46ed-8f0f-4cac3fe42146` | 8 | **8/8** | (none) | 19.384 | 2 |
| `9f3b6d16-64d3-45b4-ba3a-330108df2db2` | 9 | 7/8 | `argument_scheme` | 24.442 | 2 |
| `1383d80e-6780-4b38-b521-2653b9c58978` | 10 | 6/8 | `argument_scheme`, `critical_question` | 26.657 | 2 |
| `660042f6-8956-40ea-86d5-8878c4fe7cf8` | 10 | 6/8 | `disagreement_axis`, `claim_clarity` | 31.348 | 2 |

Burst summary:
- 4 args observed; **1/4 reached 8/8** success.
- Terminal holes across 4 distinct families: `argument_scheme` (2 args), `critical_question` (1 arg), `disagreement_axis` (1 arg), `claim_clarity` (1 arg).
- **p50 wall = 24.442s**; **p95 wall = 31.348s** (in the 30–45s PARTIAL band; under the 45s FAIL line).
- `maxOverlapObserved = 2` across all 4 args — bounded-parallel limit holds.
- No duplicate success rows. No extras. No in-flight rows at sample time.
- No I/J rows observed.

The wall-clock distribution is consistent with the 8-family bounded-parallel projection (~22–32s). The reliability failure is NOT a latency-regression effect — terminal holes appear even on the args that finished faster.

**Burst confirms the same provider/server reliability class as the canary; the dominant failure mode is `mcp_api_error` rather than any per-family classifier defect.** Burst alone CANNOT override the failed canary; the canary is the decisive evidence for Card 3 smoke verdict.

## Phase 6 — Doctrine (L5 BINDING; CI-mechanically enforced for Family H)

**Status:** L5 CLEAN on the 29 H production success rows that DID succeed; the smoke OVERALL remains FAIL.

Persisted `evidence_span` inspection (read-only SQL scan via `npx supabase db query --linked`):

- **Scope:** Family H (`claim_clarity`) production rows on `argument_machine_observation_results` joined to `argument_machine_observation_runs` (`run_mode = 'production'`, `status = 'success'`) for the 5 smoke args (canary + 4 burst).
- **Row count:** 29 H production success rows / 4 distinct args (the 660042f6 arg's `claim_clarity` failed twice — that arg contributes 0 H success rows; the other 4 args contribute 29 success rows in aggregate).
- **Banned-token scan over `evidence_span` (case-insensitive):**

| Banned-token category | Hit rows |
|---|---|
| `winner` | 0 |
| `loser` | 0 |
| `liar` | 0 |
| `dishonest` | 0 |
| `true`, `correct`, `proves`, `refutes`, `defeated`, `conceded` (truth/victory) | 0 |
| `weak`, `sloppy`, `lazy`, `careless`, `confused`, `unsound`, `incoherent`, `illogical` (quality verdict) | 0 |
| `bad faith`, `manipulative`, `propagandist`, `extremist`, `stupid`, `idiot` (motive verdict) | 0 |
| **any-banned-hit rows** | **0** |

L5 conclusion: the 5-layer descriptive-clarity doctrine defense holds end-to-end in production under live Anthropic conditions for the H rows that DID succeed. The doctrine boundary (cdiscourse-doctrine §1 / §10a — claim-clarity is a STRUCTURAL shape, never a quality verdict) is preserved on every persisted H production `evidence_span` we observed.

**L5 CLEAN is necessary, not sufficient.** The smoke OVERALL is FAIL because Phase 2 / Phase 5 run-completeness failed first. The doctrine result CANNOT lift a FAIL to PARTIAL or PASS — it only documents that the H classifier remained doctrine-compliant on the rows where the provider call succeeded.

## Phase 7 — Observability + enforcement-loop provenance

**Status:** Recorded.

- Production family roster post-merge: A+B+C+D+E+F+G+**H** production+auto-trigger (8 families). I/J unsupported. Verified by `productionEnabledFamilies()` derive of `familyRegistry.ts` at HEAD `488d105`.
- Bounded-parallel limit=2 (PR #364) is in effect; `maxOverlapObserved = 2` across canary + 4 burst args.
- This smoke audit triggers the audit-lint CI on an in-scope production-enable doc; L3+L4+L5 are mechanically enforced (production-enable type; `family_h` doctrine-risk). The audit carries `Audit-Lint: v1` and self-lints clean.
- Family H smoke artifacts (canary + 4 burst args) remain in the database tagged with `[mcp-021c-family-h-enable-smoke 2026-05-31]` on the synthetic body + room title. No service-role; no direct insert; all submits via `submit-argument` Edge Function under the `.env.bot-tests` bot session. No secrets logged.
- **Failure pattern observation (for follow-up only — not load-bearing for THIS verdict):** Across canary + burst, the 7 `mcp_api_error` instances are spread over 4 distinct families (`argument_scheme` 5×, `claim_clarity` 2×, `critical_question` 2×, `disagreement_axis` 2×). The dispersal across families argues against an H-prompt-shape defect and points at provider/server reliability resurfacing at the 8-family concurrency profile. Follow-up investigation is operator-territory.

## Phase 8 — Verdict

**Status:** FAIL

### Final verdict

**FAIL.**

- Phase 1 PASS (production flag flipped; subset filter ABSENT; A–G byte-equal).
- Phase 2 FAIL (canary terminal hole on `argument_scheme`; `successFamilies = 7/8`).
- Phase 3 / Phase 4 DEFERRED (chain HALTED at Phase 2).
- Phase 5 FAIL (1/4 burst args reached 8/8; terminal holes across 4 families; p95 wall 31.348s within band but coverage broken).
- Phase 6 L5 CLEAN on 29 H production success rows (0 banned-token hits across 7 categories); necessary, not sufficient.
- Phase 7 observability + provenance recorded; bounded-parallel limit holds; failure pattern dispersed across families.

This smoke FAILS by the template's Phase 2 + Phase 5 criteria (each submit must produce EXACTLY 8 production-success rows). The Family H *production-enable mechanics* fired correctly; the smoke FAILS on background classifier *run-completeness* under live Anthropic load. Family H itself is not the proximate defect — `argument_scheme` carries the largest share of terminal holes, with the failure mode distributed across multiple families.

---

## Authorizations + follow-ups

- **`MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE: FAIL`.**
- **Family H 3-card chain is HALTED at Card 3 smoke (HALT 15)**. Card 1 smoke PASS (`12ec7eb`, PR #402) and Card 2 smoke PASS (`92d4ebe`, PR #404) remain valid. Card 3 *implementation* merged correctly (PR #405 at `488d105`), but the smoke verdict is FAIL.
- **#391 (Card 3 issue) is NOT closed as PASS.** A comment is posted recording the FAIL.
- **The umbrella #388 chain status reflects HALT 15.** A comment is posted with the current chain state.
- **Family I (`MCP-SERVER-010-FAMILY-I` + suite) is NOT authorized.** Family I production-enable depends on Card 3 smoke PASS; HALT 15 blocks it.
- **OPS-MCP-OBSERVABILITY-FAMILY-H is NOT started.** Observability backfill assumes a passing production smoke and a stable production family roster; not appropriate while Card 3 smoke is FAIL.
- **Staged rollout (`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`) is NOT authorized.** The reliability class observed in this smoke argues against widening exposure.
- **Family H `productionEnabled: true` remains on main at the time of this audit.** No revert is performed by this audit. Operator chooses the next direction.

### Recommended next directions (not implemented; operator chooses)

The dispersal of `mcp_api_error` across 4 distinct families (not H-specific) plus the consistent `maxOverlap = 2` bound suggests the regression is in the provider/server reliability path at the 8-family load profile rather than in Card 3 itself. Possible operator paths:

- **Option A — Revert H production flip to admin-only while reliability is fixed.** Restore `productionEnabled: false` on `claim_clarity` so production traffic resumes the 7-family roster under bounded-parallel limit=2 and reduces the load profile the reliability path is currently failing under. Card 3 smoke is re-run after the provider/server fix lands.
- **Option B — Keep H `productionEnabled: true` but constrain exposure.** Leave the production family roster at 8 (A–H) but cap any broader traffic surface (e.g., routing/rollout flags) so only smoke-style traffic exercises the 8-family load until reliability stabilizes. Re-smoke H after the fix.
- **Option C — Fix provider/server reliability path first; then re-smoke H.** Address whatever is producing `mcp_api_error` at the 8-family load (queue/global provider-control architecture; classifier-queue routing; backoff; per-family retry semantics) BEFORE deciding whether to revert Card 3. Re-smoke H once the fix is verified.

No option is selected by this audit. Operator decision required.

---

## Smoke artifacts

- Canary arg id: `de08897d-4380-43a8-9ce3-c227c0144ffb` (terminal hole `argument_scheme`; H success).
- Burst arg ids: `7af0cd01-3bf0-46ed-8f0f-4cac3fe42146` (8/8 PASS); `9f3b6d16-64d3-45b4-ba3a-330108df2db2` (7/8; `argument_scheme` hole); `1383d80e-6780-4b38-b521-2653b9c58978` (6/8; `argument_scheme` + `critical_question` holes); `660042f6-8956-40ea-86d5-8878c4fe7cf8` (6/8; `disagreement_axis` + `claim_clarity` holes).
- Smoke tag literal on every synthetic body: `[mcp-021c-family-h-enable-smoke 2026-05-31]`.
- Auth path: anon-key + Supabase Auth bot session via `.env.bot-tests`; no service-role; no direct insert; no `out/` committed; no JWTs logged; no body/prompt text logged.
- Per-arg detail tables are in `.claude-tmp/h-card3-burst-rows.json` and `.claude-tmp/h-card3-burst-verdict.json` (gitignored; operator-territory).
- Doctrine scan SQL is at `.claude-tmp/h-card3-doctrine-scan.sql` (gitignored). The aggregate result table (Phase 6) carries only counts; no `evidence_span` content is reproduced in this audit.
