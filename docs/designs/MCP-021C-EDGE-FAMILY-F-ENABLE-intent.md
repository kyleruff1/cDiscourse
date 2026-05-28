# MCP-021C-EDGE-FAMILY-F-ENABLE — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Card:** 3 of 3 in chain (Card 1 = MCP-SERVER-007-FAMILY-F PASS at `deff068`; Card 2 = MCP-021C-EDGE-FAMILY-E-ENABLE PASS at `1ca701a`)
**Family:** F — critical_question (14 keys; uniform `source: 'ai_classifier'` per Card 1 designer Phase A.1 verification)
**Posture this card:** flip `critical_question` `productionEnabled: false → true`; keep `adminValidationEnabled: true`
**Predecessors on main (required):**
- `1ca701a` audit(MCP-021C-EDGE-FAMILY-E-ENABLE): PASS (Gate B satisfied)
- `9a3d8fe` Card 2 ship (PR #346)
- `deff068` audit-amend(MCP-SERVER-007-FAMILY-F): PASS (chain HALT lifted at Gate A)
- All preceding cards

---

## 1. Sequencing chain + role

This is Card 3 of three-card chain — the chain's terminal card. Family F production flip extends auto-trigger from 5 → 6 production families.

```
Card 1 (Family F admin ship) PASS via deff068 →
Card 2 (Family E production flip) PASS via 1ca701a (Gate B satisfied with operator data review) →
Card 3 (this) — Family F production flip; L5 BINDING under PRODUCTION mode
```

This card's smoke audit will be the **second production-enable audit** linted under L3+L4+L5 mechanical CI enforcement. The L5 obligation is **binding** because F is doctrine-risk-by-construction.

---

## 2. Strict scope (operator binding from Gate B)

**IN:**
- One boolean flip in `supabase/functions/_shared/booleanObservations/familyRegistry.ts`: `critical_question` `productionEnabled: false → true`
- Defensive Jest tests (2-5)
- Smoke template (carries `Audit-Lint: v1`)
- `docs/core/current-status.md` handoff paragraph

**OUT (operator binding):**
- NO Family F prompt / keys / doctrine scan / MCP server code modification
- NO Family A/B/C/D/E modification
- NO Family G work (next card)
- NO taxonomy / schema / Source 6 policy change
- NO subset filter entry for F (uniform `ai_classifier` confirmed by Card 1 designer Phase A.1)
- NO auto-trigger dispatcher modification
- NO MCP server file changes
- NO `package.json` change (RO-36 ratchet)
- NO `scripts/ops/audit-lint*` modification

---

## 3. Family F production-readiness profile (Gate B review baseline)

Captured from Gate B data review (operator-approved chain-through):
- Family F admin_validation: 9 runs (5 success, 4 failed `mcp_validation_failed`)
- 19 persisted result rows from 5 successful runs; 6 of 14 keys observed
- Q14 density: 27.1% per-(run,key) (above Family E baseline 14.6%)
- Doctrine scan over 19 rows × 16 patterns: **0 dirty rows; 0 fallacy echoes**
- `consequence_probability_unclear` fired 2× on production-doctrine-paired key; doctrine-clean
- Failure pattern: 3 failures on arg `781f8057`; 1 on arg `f1757532`; PROPORTIONATE to cross-family `mcp_validation_failed` baseline (not F-specific)
- 6-family latency projection: ~27-28s (38% margin under 45s threshold)

---

## 4. Why no internal Stage 2B

Same shape as Card 2: production-flip decision was made at Gate B (with explicit data review). Family F uniformity confirmed in Card 1. No subset filter needed. Stage 2 is CONDITIONAL HALT only (20 triggers below). No Stage 2B operator decision required mid-card.

---

## 5. Binding decisions D1-D8

### D1. Scope: one boolean flip
`supabase/functions/_shared/booleanObservations/familyRegistry.ts` line for `critical_question`:
```
productionEnabled: false → true
adminValidationEnabled: true (unchanged)
```

### D2. Auto-trigger inclusion is registry-derived
Designer Phase A.2 VERIFIES (does NOT re-implement). After flip, loop iterates A→F (6 sequential families).

### D3. No subset filter needed for F
Card 1 designer Phase A.1 verified F is uniform `source: 'ai_classifier'`. The Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` constant MUST NOT receive an entry for `critical_question`. Defensive test asserts no entry.

### D4. Latency
6-family sequential: ~27-28s background per Gate B data review. Within `EdgeRuntime.waitUntil()` tolerance (~150s budget; 38% margin under 45s partial threshold).

### D5. Source 6 picks up F production rows automatically
Source 6 filter is family-agnostic. Defensive test asserts F production rows are visible through the production read path.

### D6. Strengthened proof obligations baked into smoke audit from authoring time
The smoke audit (post-merge) MUST satisfy L3+L4+L5 mechanically:

#### L3 — three success levels distinguished
- **(a) Dispatch success:** new arg via `submit-argument` produces 6 production runs A+B+C+D+E+F (all `status=success`); G/H/I/J do NOT run
- **(b) Targeted classifier-signal success:** deliberately critical-question-targeted text produces ≥1 F production positive result row; `raw_key` in the 14-key Family F set
- **(c) Read-path success:** production Family F rows visible through Source 6-compatible query; admin_validation rows NOT counted as production proof

#### L4 — targeted-signal requires positive RESULT ROW
The Phase 3 targeted arg MUST be deliberately crafted to exercise a critical-question pattern (causal mechanism implied without explanation; analogy without mapping; consequence without probability anchor; warrant assumed but unstated; etc.).

**Operator binding from Gate B:**
- **Do NOT use `781f8057` as the targeted-signal argument** (known 3/3 mcp_validation_failed pattern)
- **Do NOT use prior known-failing fixtures as the primary production proof**

**Fallback rules (operator binding from Gate B):**
- If first targeted F production fixture returns `mcp_validation_failed`: do NOT mark PASS; retry once with stronger, clearer critical-question fixture; if still fails, HALT and file scoped fix card

#### L5 — doctrine-risk live persisted evidence_span inspection (BINDING)
F is doctrine-risk-by-construction. If `consequence_probability_unclear` or any E-paired critical-question key fires on the production-mode targeted arg:
- Pre-check column names (R1)
- Query `argument_machine_observation_results` for the F production run_ids
- Inspect persisted `evidence_span` for the 16-pattern doctrine ban-list (same set as Card 1 amendment)
- Verify zero banned tokens
- Verify no echo of adversarial "fallacy" language if targeted input contains it

**Operator binding from Gate B:**
- If production F fires but produces banned doctrine language in persisted `evidence_span` → **HALT IMMEDIATELY** and file fix card

### D7. Test surface (+25 to +70; HALT +100 per intent §10)
Slightly wider band than Card 2 because Card 1 surfaced no subset/source-mix complexity but the F-specific defensive tests need to assert the 14-key surface explicitly. Card 1 designer noted this band.

Test naming pattern (mirror Card 2 FEE-N):
- FFE-1: F `productionEnabled=true`
- FFE-2: F `adminValidationEnabled=true` (unchanged)
- FFE-3..5: `productionEnabledFamilies()` returns 6 families in registry order
- FFE-6: filter-for-mode includes F in production
- FFE-7:G..J × 4: G/H/I/J remain `productionEnabled=false`
- FFE-8/9: registry order preserved
- FFE-10..14: A/B/C/D/E production posture unchanged (HALT #2 defense)
- FFE-15: `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` has NO `critical_question` entry (HALT #7 defense)
- FFE-16: production-mode Family F request contains all 14 ai_classifier rawKeys

### D8. Idempotency unchanged
Per Q9 classification, new auto-trigger runs classify as `audit_or_smoke_rerun`. If `organic_duplicate_candidate` appears during smoke, HALT.

---

## 6. HALT triggers (20)

### Registry + data safety (1-7)
1. `familyRegistry.ts` edit affects any family other than F
2. Family A/B/C/D/E `productionEnabled` flipped (already true)
3. Auto-trigger dispatcher hard-codes families (must stay registry-derived)
4. F `adminValidationEnabled` flipped to false
5. Source 6 filter change
6. Persistence schema change
7. Subset filter present/absent for F mismatches Card 1's T1 outcome (T1 NOT FIRED in Card 1 → NO entry for F should exist)

### Protocol + security (8-13)
8. New taxonomy keys
9. MCP schema version change
10. Family A/B/C/D/E/F prompt changes
11. Hosted MCP server file changes
12. Secret exposure
13. Logs raw body/prompt/response/token/key

### Architecture (14-15)
14. Auto-trigger broken for A/B/C/D/E
15. Test forecast > +100

### Doctrine — F-specific (16-17)
16. Production-mode smoke missing live adversarial critical-question evidence_span inspection (L5 BINDING; existential)
17. Any F production output evidence_span contains a banned verdict token (BINDING DOCTRINE FAIL; HALT immediately + file fix card)

### Enforcement-loop (18-19)
18. Smoke audit lacks `Audit-Lint: v1` marker
19. Smoke audit fails local pre-lint OR fails CI

### Working tree (20)
20. Unclassified untracked files at PR creation

---

## 7. Required designer Phase A audits (4)

### A.1 — familyRegistry current state
Read `familyRegistry.ts`; document F entry pre-flip + post-flip shape; confirm A/B/C/D/E + G/H/I/J entries byte-equal in the diff; verify `productionEnabledFamilies()` function shape.

### A.2 — Auto-trigger 6-family inclusion verification
Read `autoTriggerDispatcher.ts`; confirm `productionEnabledFamilies()` from registry drives the loop; project: after flip, loop iterates A→F (6 sequential families); confirm no hard-coded family list.

### A.3 — Subset filter NOT needed verification
Read `booleanObservationRequestBuilder.ts` `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`; confirm no `critical_question` entry exists; specify defensive test asserting this (FFE-15).

### A.4 — Latency + dispatcher sequential-loop projection for 6 families
- Card 2 Phase 2 observed 5-family sequential: 22s (~5s/family)
- Family F per-family from Card 1 Phase 4 amendment: ~24s for 3 args = ~8s/arg (but per-family per single-arg auto-trigger ~5-6s)
- 6-family projected: ~27-28s
- Within `EdgeRuntime.waitUntil()` budget; 38% margin under 45s partial threshold

---

## 8. Test forecast: +25 to +70

HALT ceiling +100.

Run gates per commit:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(familyRegistry|autoTrigger|edgeFamily|AdminValidation)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` (expect 871 unchanged)

---

## 9. Smoke plan (8-phase under L3+L4+L5 + L5 BINDING)

Audit at `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<date>.md` (MUST carry `Audit-Lint: v1` marker per D6).

### Phase 1 — Pre-flight
HEAD; Edge functions deployed; F registry posture (`productionEnabled=true, adminValidationEnabled=true`).

### Phase 2 — Dispatch success (L3a)
Submit new arg via `submit-argument`; verify 6 sequential production runs A+B+C+D+E+F; all `status=success`; G/H/I/J do NOT run.

**Operator binding:** the targeted body MUST be a NEW critical-question-targeted text that's NOT `781f8057` and NOT a prior known-failing fixture.

### Phase 3 — Targeted-signal success (L3b + L4)
Verify ≥1 F production positive result row; `raw_key` in 14-key set.

**Fallback rules:**
- If `mcp_validation_failed` on first targeted: do NOT mark PASS; retry once with stronger fixture; if still fails, HALT.
- If 0 positives on a successful run: PARTIAL; do NOT authorize Family G card.

### Phase 4 — Read-path success (L3c)
Source 6 returns F production rows for the new arg; A+B+C+D+E rows also present; admin_validation rows NOT counted as production proof.

### Phase 4b — DOCTRINE (L5 BINDING)
If `consequence_probability_unclear` or any E-paired critical-question key fires:
- Pre-check column names (R1)
- Query persisted `evidence_span` from the F production run
- 16-pattern doctrine ban-list scan (same patterns as Card 1 amendment)
- Verify zero banned tokens
- If targeted input contained "fallacy" or similar verdict bait, verify NO ECHO in output

**HALT condition:** if production F fires but produces banned doctrine language in persisted `evidence_span` → IMMEDIATE HALT + file fix card. This is the existential test for Card 3.

### Phase 5 — Observability
Q11 reframed: F now shows production rows. Q14 density: F production density present (first real production data). Q9: no `organic_duplicate_candidate`. Operator binding: rerun observability report; verify Family F appears in production mode.

### Phase 6 — Regression
A/B/C/D/E production behavior unregressed; admin_validation still works for F. Jest + Deno + typecheck + lint exit 0.

### Phase 7 — OPS observations + enforcement-loop provenance
Required subsection (verbatim):
> "Third-enforcement provenance: second PRODUCTION-ENABLE card linted by audit-lint CI; first card under L5 BINDING enforcement. CI workflow run ID: `<id>`; in_scope count: `<n>`; linter exit: 0. L3 satisfied by Phases 2+3+4 (dispatch+targeted-signal+read-path). L4 satisfied by Phase 3 targeted critical-question text producing ≥1 positive result row. L5 BINDING satisfied by Phase 4b persisted evidence_span doctrine inspection (≥1 clean firing under production mode)."

Plus standard 6-family operational state, latency, doctrine-key calibration. **Chain completion note**: 3-card chain complete; all 6 families production+auto-trigger; G/H/I/J unsupported.

### Phase 8 — Verdict + authorization
- Pre-push audit-lint: `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push
- CI on the smoke audit PR MUST exit 0

### Verdict rules

**PASS:** All phases clean; L3/L4/L5 each satisfied by an explicit phase; Phase 4b ≥1 clean firing (doctrine-clean); pre-lint + CI both exit 0; A/B/C/D/E unregressed.

**PARTIAL:** Phase 3 0-positives even on targeted arg (sparse signal); Phase 4b 0-fire even after fallback fixture. Card 3 PASS is required to fully close the 3-card chain.

**FAIL:**
- Phase 4b dirty firing (banned token in F production evidence_span) → IMMEDIATE HALT + fix card
- Phase 3 mcp_validation_failed on first AND fallback targeted → HALT + fix card
- Any non-Family-F rawKey on F run
- Family A/B/C/D/E byte-equal failure
- CI passes an L3/L4/L5-missing audit

---

## 10. Authorizations granted on PASS

- `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE: PASS`
- Family F PRODUCTION + auto-trigger LIVE (6 production families: A+B+C+D+E+F)
- 3-card chain COMPLETE
- `MCP-SERVER-008-FAMILY-G` AUTHORIZED to begin (G/H/I/J still unsupported)

---

## 11. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/MCP-021C-EDGE-FAMILY-F-ENABLE.md` | Designer plan |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (MODIFIED; 1 boolean) | The flip |
| Defensive Jest tests (2-5; FFE-1..16 per D7) | F production registry + auto-trigger 6-family + subset-filter-not-applied + backward compat |
| `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md` (NEW) | Smoke template carrying `Audit-Lint: v1` marker |
| `docs/core/current-status.md` (MODIFIED; 1 paragraph) | Handoff |

---

## 12. Execution order

1. Phase 0 pre-flight (DONE)
2. Stage 0 — commit + push intent to main
3. Phase B — create `feat/MCP-021C-EDGE-FAMILY-F-ENABLE` branch + GitHub issue
4. Stage 1 — designer subagent (4 Phase A audits)
5. Stage 2 — conditional HALT eval
6. Stage 3 — implementer subagent
7. Stage 4 — reviewer subagent (20-item matrix incl. doctrine 16-17 existential)
8. Stage 5 — PR + squash-merge + post-merge gates
9. Post-merge 8-phase smoke (L3+L4+L5 mechanically enforced; Phase 4b L5 BINDING)
10. Local pre-lint + smoke audit PR → CI lints
11. Audit commit on main
12. Chain completion report
