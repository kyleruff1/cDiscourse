# MCP-021C-EDGE-FAMILY-E-ENABLE — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Card:** 2 of 3 in chain (Card 1 = MCP-SERVER-007-FAMILY-F PASS at `deff068`; Card 3 = MCP-021C-EDGE-FAMILY-F-ENABLE)
**Family:** E — argument_scheme (16 keys; uniform `source: 'ai_classifier'` per pre-flight)
**Posture this card:** flip `argument_scheme` `productionEnabled: false → true`; keep `adminValidationEnabled: true`
**Predecessors on main (required):**
- `deff068` audit-amend(MCP-SERVER-007-FAMILY-F): PASS (chain HALT lifted; Gate A satisfied)
- `1ee8ab3` MCP-SERVER-007-FAMILY-F ship (PR #344)
- `87a2784` audit(OPS-MCP-SMOKE-LINT-CI-WIRING): PASS (CI live; L3+L4+L5 mechanically enforced)
- All preceding cards

---

## 1. Sequencing chain + role

This is Card 2 of three-card chain. **FIRST production-enable card to ship its smoke audit under L3+L4+L5 mechanical CI enforcement.** The audit must satisfy all three from authoring time or CI fails the PR.

```
Card 1 (MCP-SERVER-007-FAMILY-F) PASS via deff068 (Gate A satisfied) →
Card 2 (this) — Family E production flip → Gate B (HIGH tension; F admin baseline thin) →
Card 3 — Family F production flip (L5 BINDING on production-mode CQ doctrine)
```

---

## 2. Strict scope (binding per operator launch + Gate A response)

**IN:**
- One boolean flip in `supabase/functions/_shared/booleanObservations/familyRegistry.ts`: `argument_scheme` `productionEnabled: false → true`
- Defensive Jest tests (Edge-side; 2-5 tests)
- Smoke template (carries `Audit-Lint: v1`)
- `docs/core/current-status.md` handoff paragraph

**OUT (operator binding):**
- NO Family E prompt, keys, doctrine scan, MCP server code modification
- NO Family F modification
- NO taxonomy / schema change
- NO Source 6 policy change
- NO subset filter entry for E (uniform `ai_classifier` confirmed at pre-flight; T1 NOT FIRED)
- NO auto-trigger dispatcher modification (registry-derived; `productionEnabledFamilies()` already used)
- NO MCP server file changes (mcp-server/lib/familyE*.ts byte-equal preserved)
- NO `package.json` change (RO-36 ratchet)
- NO `scripts/ops/audit-lint*` modification
- Card 3 (F production flip) waits until Card 2 ships AND smokes PASS

---

## 3. Why no internal Stage 2B

The production-flip decision was made at Gate A. Family E uniformity (`ai_classifier`) was verified at pre-flight. No subset filter needed. No architectural complexity surfaces during designer Phase A — this is a one-boolean flip with defensive tests + a smoke audit that satisfies L3+L4+L5.

Stage 2 is CONDITIONAL HALT only (19 triggers below). No Stage 2B operator decision required mid-card.

---

## 4. Binding decisions D1-D8

### D1. Scope: one boolean flip
`supabase/functions/_shared/booleanObservations/familyRegistry.ts` line for `argument_scheme`:
```
productionEnabled: false → true
adminValidationEnabled: true (unchanged)
```

### D2. Auto-trigger inclusion is registry-derived
Designer Phase A.2 VERIFIES (does NOT re-implement). `productionEnabledFamilies()` in `familyRegistry.ts` already drives `autoTriggerDispatcher.ts`. After the flip, E joins A+B+C+D as the 5th production family in the auto-trigger loop.

### D3. No subset filter needed for E
Designer Phase A.3 confirms by reading `src/features/nodeLabels/machineObservationDefinitions/familyE.ts` is uniform `source: 'ai_classifier'`. The Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` constant in `booleanObservationRequestBuilder.ts` MUST NOT receive an entry for `argument_scheme`. Defensive test asserts this.

### D4. Latency: 5-family auto-trigger projected ~22-30s background
Within `EdgeRuntime.waitUntil()` tolerance (no 30s hard cap on background work; the user-facing `submit-argument` response returns immediately). Designer Phase A.4 confirms via projection from Family E observed latency (~16.73s for 16 keys × 3 args).

### D5. Source 6 picks up E production rows automatically
`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` filter is family-agnostic (production rows pass regardless of which family). Defensive test asserts E production rows are visible through the production read path.

### D6. Strengthened proof obligations baked into smoke audit from authoring time
The smoke audit (post-merge) MUST satisfy L3+L4+L5 mechanically:

#### L3 — three success levels distinguished
- **(a) Dispatch success:** new arg via `submit-argument` produces 5 production runs A+B+C+D+E (all `status=success`); F/G/H/I/J do NOT run
- **(b) Targeted classifier-signal success:** deliberately scheme-targeted arg body produces ≥1 E production positive result row (NOT a 0-positive run treated as success); `raw_key` in the 16-key Family E set
- **(c) Read-path success:** production Family E rows are visible through the production read path / Source 6-compatible query; admin_validation rows are NOT used as production proof

#### L4 — targeted-signal requires a positive RESULT ROW
The Phase 3 targeted arg MUST be deliberately crafted to exercise an E scheme (causal/principle/precedent/example/definition text). 0-positives on undirected seeded args is PARTIAL, not PASS. If the first targeted text produces 0 positives, the operator-binding instruction is "use a stronger targeted slippery_slope fixture before accepting PASS."

#### L5 — doctrine-risk live persisted evidence_span inspection
If `slippery_slope_reasoning_present` fires on any production run:
- Pre-check column names (R1)
- Query `argument_machine_observation_results` for the E run_ids
- Inspect persisted `evidence_span` for the 13 banned tokens (fallacy / fallacious / weak / weak argument / invalid / invalid argument / bad reasoning / flawed / flawed reasoning / wrong / proof of / logical error / informal fallacy)
- Verify zero banned tokens
- If `slippery_slope` does NOT fire on the first targeted text, use a stronger targeted slippery_slope fixture before accepting PASS

### D7. Test surface (+25 to +60; HALT +90 per intent §8)
- familyRegistry test: E `productionEnabled=true`
- Auto-trigger 5-family inclusion test (E joins A+B+C+D in the loop)
- Subset filter NOT applied to E (defensive test; no entry in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`)
- Source 6 multi-family production read test (E production rows visible)
- Backward compat (A/B/C/D production behavior unregressed)

### D8. Idempotency unchanged
Per Q9 classification, new auto-trigger runs classify as `audit_or_smoke_rerun`. If `organic_duplicate_candidate` appears during smoke, HALT.

---

## 5. HALT triggers (19)

### Registry + data safety (1-7)
1. `familyRegistry.ts` edit affects any family other than E
2. Family A/B/C/D `productionEnabled` flipped (already true; do NOT touch)
3. Auto-trigger dispatcher hard-codes families (must stay registry-derived)
4. E `adminValidationEnabled` flipped to false (must stay true)
5. Source 6 filter change
6. Persistence schema change
7. Subset filter (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) entry added for E (E is uniform ai_classifier; should NOT need an entry)

### Protocol + security (8-13)
8. New taxonomy keys
9. MCP schema version change
10. Family A/B/C/D/E/F prompt changes (NO change to existing prompts)
11. Hosted MCP server file changes
12. Secret exposure
13. Logs raw body/prompt/response/token/key

### Architecture (14-15)
14. Auto-trigger broken for A/B/C/D (existential)
15. Test forecast > +90

### Enforcement-loop (16-18)
16. Smoke audit lacks `Audit-Lint: v1` marker
17. Smoke audit fails local pre-lint OR CI for an L1-L6 violation (CI failure is the enforcement loop working; fix the audit, do NOT bypass)
18. Smoke audit Phase 3 (targeted-signal) does not include a deliberately-scheme-targeted argument and ≥1 positive result row (L4 mechanical CI fail)

### Working tree (19)
19. Unclassified untracked files at PR creation

---

## 6. Required designer Phase A audits (4)

### A.1 — familyRegistry current state
Read `supabase/functions/_shared/booleanObservations/familyRegistry.ts` verbatim; document the E entry's pre-flip and post-flip shape; confirm all other families (A/B/C/D/F/G/H/I/J) are byte-equal in the diff.

### A.2 — Auto-trigger 5-family inclusion verification
Read `autoTriggerDispatcher.ts`; confirm `productionEnabledFamilies()` from `familyRegistry.ts` drives the loop; project that after the flip the loop iterates A→E (5 sequential families); confirm no hard-coded family list anywhere in the dispatcher.

### A.3 — Subset filter NOT needed verification
Read `src/features/nodeLabels/machineObservationDefinitions/familyE.ts`; confirm uniform `source: 'ai_classifier'` (already verified at pre-flight); inspect `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` constant; confirm it currently has no `argument_scheme` entry; defensive test will assert this.

### A.4 — Latency + dispatcher sequential-loop projection for 5 families
- Family E baseline: 16 keys × 3 args ≈ 16.73s (~5.6s/arg from `29f30b0` Phase 4)
- 5-family sequential per-arg: A+B+C+D+E ≈ 5 × ~5s = ~25s per arg
- 3 args × ~25s = ~75s background per submit-argument (within `EdgeRuntime.waitUntil()` tolerance; user-facing response unaffected)

---

## 7. Test forecast: +25 to +60

HALT ceiling +90. Narrow card; one boolean flip + defensive tests.

Run gates per commit:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(familyRegistry|autoTrigger|booleanObservationRequestBuilder|machineObservationPersistenceQuery)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` (should remain 871 unchanged; no mcp-server change)

---

## 8. Smoke plan (8-phase incl. L3+L4+L5 mechanical CI enforcement)

Audit at `docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-<date>.md` (MUST carry `Audit-Lint: v1` marker per D6).

### Phase 1 — Pre-flight
HEAD; Edge functions deployed; E registry posture (`productionEnabled=true, adminValidationEnabled=true`).

### Phase 2 — Dispatch success (L3a)
Submit new arg via `submit-argument`; verify 5 sequential production runs A+B+C+D+E; all `status=success`; F/G/H/I/J do NOT run. Bonus observation: latency for 5-family background dispatch.

### Phase 3 — Targeted-signal success (L3b + L4)
**Per operator binding instruction:** the new arg MUST be deliberately scheme-targeted text. Verify ≥1 E production positive result row; `raw_key` in 16-key set. **0-positives on targeted text → use a stronger targeted slippery_slope fixture before accepting PASS.** Do NOT accept PASS on 0-positive run rows.

### Phase 4 — Read-path success (L3c)
Source 6 returns E production rows for the new arg; A+B+C+D rows also present; admin_validation rows are NOT counted as production proof. Defensive: no E `deterministic_key` (E has none).

### Phase 4b — DOCTRINE (L5)
If `slippery_slope_reasoning_present` fires on the targeted arg from Phase 3:
- Pre-check column names (R1)
- Query persisted `evidence_span`
- Doctrine ban-list scan over 13 patterns
- Verify zero banned tokens

If `slippery_slope` does NOT fire on first targeted text:
- Submit a STRONGER targeted slippery_slope fixture
- Re-run Phase 4b
- Do NOT accept PASS without ≥1 doctrine-clean live firing

### Phase 5 — Observability
Q11 reframed: E now shows production rows. Q14 density: E production density present (first real data). Q9: no `organic_duplicate_candidate` introduced. Operator binding: rerun the observability report; verify Family E appears in production mode.

### Phase 6 — Regression
A/B/C/D production behavior unregressed; admin_validation still works for E + F. Jest + Deno + typecheck + lint exit 0.

### Phase 7 — OPS observations + enforcement-loop provenance
Required subsection (verbatim):
> "Second-enforcement provenance: first PRODUCTION-ENABLE card linted by audit-lint CI with L3+L4+L5 mechanically enforced. CI workflow run ID: `<id from PR>`; in_scope count: `<n>`; linter exit: 0. L3 satisfied by Phases 2+3+4 (dispatch+targeted-signal+read-path). L4 satisfied by Phase 3 targeted scheme text producing ≥1 positive result row. L5 satisfied by Phase 4b persisted evidence_span doctrine inspection (≥1 clean firing)."

Plus standard 6-family operational state, latency, doctrine-key calibration.

### Phase 8 — Verdict + authorization
- Pre-push audit-lint: `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push
- CI must run on the smoke audit PR and exit 0

### Verdict rules

**PASS:** All phases clean; L3/L4/L5 each satisfied by an explicit phase; local pre-lint + CI both exit 0; A/B/C/D unregressed.

**PARTIAL:** Phase 3 0-positives even on targeted arg (sparse signal; do NOT authorize Card 3); Phase 4b 0-fire on slippery_slope-targeted arg even after fallback fixture.

**FAIL:**
- Phase 3 0-positives on targeted arg AND no PARTIAL marker
- Phase 4b dirty firing (banned token in E production evidence_span)
- A/B/C/D regression
- CI incorrectly passes an L3/L4/L5-missing audit

---

## 9. Authorizations granted on PASS

- `MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE: PASS`
- Family E PRODUCTION + auto-trigger LIVE (5 production families: A+B+C+D+E)
- `MCP-021C-EDGE-FAMILY-F-ENABLE` (Card 3) AUTHORIZED to design under Gate B surface

---

## 10. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/MCP-021C-EDGE-FAMILY-E-ENABLE.md` | Designer plan |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (MODIFIED; 1 boolean) | The flip |
| Defensive Jest tests (2-5; +25 to +60 forecast) | E production registry + auto-trigger 5-family + subset-filter-not-applied + Source 6 multi-family + backward compat |
| `docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-template.md` (NEW) | Smoke template carrying `Audit-Lint: v1` marker |
| `docs/core/current-status.md` (MODIFIED; 1 paragraph) | Handoff |

---

## 11. Execution order

1. Phase 0 pre-flight (DONE)
2. Stage 0 — commit + push intent to main
3. Phase B — create `feat/MCP-021C-EDGE-FAMILY-E-ENABLE` branch + GitHub issue
4. Stage 1 — designer subagent (4 Phase A audits)
5. Stage 2 — conditional HALT eval
6. Stage 3 — implementer subagent
7. Stage 4 — reviewer subagent (16-item matrix)
8. Stage 5 — PR + squash-merge + post-merge gates
9. Post-merge 8-phase smoke (L3+L4+L5 mechanically enforced; Phase 4b with fallback fixture if 0-fire)
10. Local pre-lint + smoke audit PR → CI lints with non-empty in-scope set
11. Audit commit on main
12. Gate B (HARD with observation-period) → operator decides Card 3 path
