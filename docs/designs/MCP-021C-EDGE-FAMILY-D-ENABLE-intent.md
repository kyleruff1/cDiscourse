# MCP-021C-EDGE-FAMILY-D-ENABLE — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** MCP — production-mode enablement
**Card position:** Card 2 of 3 in the FAMILY-D-COVERAGE → EDGE-FAMILY-D-ENABLE → FAMILY-E chain
**Predecessor chain on main:**
- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE PASS` at `9b040be` (Card 1)
- `MCP-SERVER-005-FAMILY-D-SMOKE PASS` at `0da43f9` + Edge subset filter at `b0fd068`
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE PASS` at `ac66b2e`
- All preceding OPS + family cards
- Inter-Card Checkpoint A: operator approved "chain through"

---

## 1. The flip

Single boolean flip in Edge familyRegistry.ts (lines 83-89):

```diff
   {
     family: 'evidence_source_chain',
-    productionEnabled: false,
+    productionEnabled: true,
     adminValidationEnabled: true,
   },
```

After merge, new arguments fire 4 production runs (A+B+C+D) via the registry-derived auto-trigger refactored in `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` Card 1.

---

## 2. Critical verification: subset filter holds under production-mode (Decision 3)

The Family D Edge subset filter at `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain'] = {'ai_classifier'}` was built for admin_validation. The filter lives in `booleanObservationRequestBuilder.ts` which is **run_mode-agnostic** — the same builder serves both production and admin_validation requests.

**CRITICAL:** designer Phase A.3 must verify that production-mode Family D requests send ONLY the 19 ai_classifier keys, not all 27. If the production path somehow bypasses the request builder OR uses a different code path, HALT.

Test plan must include an explicit production-mode test of the subset filter.

---

## 3. Auto-trigger 4-family latency (Decision 4)

The dispatcher refactor at Card 1 of the prior launch made auto-trigger sequential per-family. Post-Card-2-flip, new arguments fire 4 sequential runs:
- Family A: ~4.5s (per Card 1 prior smoke)
- Family B: ~3.9s
- Family C: ~4.8s
- Family D: ~6.5s/arg single arg (~19.5s for 3 args; 1.03s per key × 3 args reported in Card 2 smoke)

Total 4-family dispatch for a single new arg: ~20-25s. Well within EdgeRuntime.waitUntil() background tolerance (it's fire-and-forget; doesn't block submission).

Designer Phase A.4 confirms the dispatcher's sequential loop handles 4 families without timeout.

---

## 4. Source 6 rendering (Decision 5)

Family D production rows will land in Source 6 reads (run_mode='production'). The 19 Family D raw_keys may surface in node-label rendering. The renderer was designed for multi-family expansion (per Family A/B/C precedent); D's 19 keys are structurally similar.

If the renderer doesn't handle D raw_keys, HALT — file a separate UI card before flipping.

---

## 5. Out of scope

- ANY runtime code change beyond the 1-boolean flip + tests
- ANY mcp-server change (hosted MCP server already supports Family D from Card 2 of prior launch)
- New taxonomy keys
- Schema migration
- Family A/B/C/D prompt or registry changes (only the productionEnabled flag)
- Source 6 filter logic changes
- Persistence schema changes
- UI changes

---

## 6. HALT triggers (18)

Any ONE fires HALT.

### Registry + data safety (1-6):
1. familyRegistry.ts edit affects any family other than D
2. Family A/B/C productionEnabled flipped (already true; do not touch)
3. Auto-trigger dispatcher hard-codes families (must stay registry-derived from prior launch's refactor)
4. Source 6 filter change
5. Persistence schema change
6. The Family D Edge subset filter (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) removed or weakened — production mode must STILL route only the 19 ai_classifier keys, NOT all 27

### Protocol + security (7-12):
7. New taxonomy keys
8. MCP schema version change
9. Family A/B/C/D prompt changes
10. Hosted MCP server file changes
11. Secret exposure
12. Logs raw body/prompt/response/token/key

### Architecture (13-16):
13. Auto-trigger broken for A/B/C (existential)
14. Family D production runs send all 27 keys (subset filter weakened under production mode)
15. Test forecast exceeds +100 (S card; +20 to +50 expected)
16. Family D production runs don't persist to results table

### Doctrine (17):
17. Verdict tokens in user-facing strings

### Working tree (18):
18. Unclassified untracked files at PR creation

---

## 7. Required Phase A audits (4)

### A.1 — familyRegistry current state + flip
- Confirm D entry at lines 83-89; verify only 1 boolean to flip
- Verify A/B/C productionEnabled=true (must remain unchanged)
- Verify other families (E-J) productionEnabled=false (must remain unchanged)

### A.2 — Auto-trigger inclusion verification
- Read `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`
- Confirm it derives production families from registry (via `productionEnabledFamilies()`)
- VERIFY (do not re-implement) that flipping D's flag automatically extends auto-trigger to fire D as a 4th run

### A.3 — Subset filter holds under production-mode (CRITICAL)
- Read `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts`
- Confirm `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain'] = {'ai_classifier'}` applies regardless of run_mode
- Trace the production-mode code path: does it go through buildBooleanObservationRequestForArgument? (it should — the dispatcher uses the same builder for both modes)
- Design a test asserting: production-mode Family D request contains only the 19 ai_classifier keys (mirror SF-1..SF-5 from the admin_validation test but with mode='production')

### A.4 — Latency + dispatcher sequential-loop under 4 families
- Confirm dispatcher iterates sequentially (not concurrently); 4-family dispatch is bounded ~20-25s
- Verify EdgeRuntime.waitUntil() pattern accommodates this (fire-and-forget; no synchronous block)
- Test plan: integration-shaped test that mocks the dispatcher with 4 production-enabled families and asserts ordering + outcome count

---

## 8. Test forecast: +20 to +50

Test surface:
- familyRegistry test: D now productionEnabled=true
- Auto-trigger 4-family inclusion test
- **Subset filter holds under production-mode test** (CRITICAL; mirror SF-1..SF-5 with mode='production')
- Source 6 multi-family read test (4 families)
- Backward compat (A/B/C still fire post-flip; existing TRG-* assertions still hold)

HALT at +100.

---

## 9. Smoke plan (6-phase)

Audit at `docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-<date>.md`:

### Phase 1 — Pre-flight
- HEAD at merge SHA
- Edge functions auto-deployed
- Registry shows D productionEnabled=true
- DB pre-test state captured

### Phase 2 — Auto-trigger 4-family test (PRODUCTION)
- Submit a new argument (fresh; not idempotency-filtered)
- Wait ~25-35s for 4-family dispatch
- Verify 4 production runs created (A+B+C+D)
- Each run_mode='production'; each correct family; each `status='success'`
- **CRITICAL:** Family D production run sends only the 19 ai_classifier keys (verify via subset boundary; 0 deterministic-key positives expected)

### Phase 3 — Family D production subset verification
- Family D production run results ⊆ 19-key subset
- 0 deterministic keys (has_evidence, source_attached, etc.)
- Confirms the subset filter holds under production mode

### Phase 4 — Source 6 multi-family read (4 families)
- Source 6 production read shows A+B+C+D raw_keys (subject to whatever positives fire)
- No D deterministic keys; no E-J keys

### Phase 5 — Observability report (4-family production)
- Q11 (reframed): D now shows production rows
- Q14 (density): D production density present
- Q15 (D subset): all production D keys ∈ 19-key set
- Q9: no organic_duplicate_candidate

### Phase 6 — Regression + audit
- Family A/B/C auto-trigger still fires (the new arg's A/B/C runs)
- Hosted MCP smoke unaffected (the deployed MCP server build unchanged)
- Family D admin_validation still works (both modes coexist)
- Targeted Jest regression exit 0

### Verdict rules

**PASS:** 4 production runs per new arg; D subset holds under production; Source 6 reads 4 families; observability adapts; A/B/C unregressed.

**PARTIAL:** 3/4 families' runs (D's auto-trigger silently dropped) OR D produces 0 production positives (acceptable; sparse signal).

**FAIL:** D sends all 27 keys (subset filter broke under production); A/B/C auto-trigger broke; deterministic key leak; Source 6 broken.

---

## 10. Authorizations granted on PASS

- `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE: PASS`
- Family D production + auto-trigger live (4-family production-capable system)
- Proceed to **INTER-CARD CHECKPOINT B** (SOFT gate; ~2-min window before Card 3)

---

## 11. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/MCP-021C-EDGE-FAMILY-D-ENABLE.md` | Designer's binding plan |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | The single file edited (1-boolean flip) |
| `__tests__/edgeFamilyDProductionEnable.test.ts` (NEW) | Registry assertion |
| `__tests__/mcpFamilyDSubsetFilterProductionMode.test.ts` (NEW) | **The critical production-mode subset filter test** |
| `docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-<date>.md` | Post-merge audit |

---

## 12. Execution order

1. Phase 0 pre-flight (DONE; this brief is the artifact)
2. Stage 0 — commit + push intent brief to main
3. Phase B — create `feat/MCP-021C-EDGE-FAMILY-D-ENABLE` branch + GitHub issue
4. Stage 1 — spawn roadmap-designer subagent (4 Phase A audits)
5. Stage 2 — conditional HALT evaluation
6. Stage 3 — spawn roadmap-implementer subagent
7. Stage 4 — spawn roadmap-reviewer subagent
8. Stage 5 — PR + squash-merge + post-merge gates
9. Post-merge smoke (6-phase)
10. INTER-CARD CHECKPOINT B → Card 3
