# MCP-021C-EDGE-FAMILIES-B-C-ENABLE — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** MCP — production-mode enablement for shipped families
**Predecessor chain on main:**
- `OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE PASS` at `1624f6b`
- `OPS-MCP-TEST-DATA-CLEANUP-SMOKE PASS` at `b8ce07b`
- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE PASS` at `19b8d8a`
- `MCP-SERVER-004-FAMILY-C-SMOKE PASS` at `70b18f2`
- `MCP-SERVER-003-FAMILY-B-SMOKE PASS` at `05b42c3`
- `MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE PASS` at `e281753`

---

## 1. The flip (Decision 1)

Two boolean flips in one file:

```
supabase/functions/_shared/booleanObservations/familyRegistry.ts
```

```diff
   {
     family: 'disagreement_axis',
-    productionEnabled: false,
+    productionEnabled: true,
     adminValidationEnabled: true,
   },
   {
     family: 'misunderstanding_repair',
-    productionEnabled: false,
+    productionEnabled: true,
     adminValidationEnabled: true,
   },
```

Both flips happen in the same commit. `adminValidationEnabled` remains `true` for both (no need to disable; both modes coexist). All other families' entries remain byte-equal.

---

## 2. Auto-trigger inclusion (Decision 2)

The auto-trigger dispatcher at
`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`
derives families from the Edge family registry (verified at Phase 0). If
the auto-trigger is registry-derived, the production flip automatically
extends auto-trigger to Families B + C.

**Designer Phase A.2 MUST verify** this assumption by reading
`autoTriggerDispatcher.ts` and `submit-argument/index.ts`. If the
auto-trigger is hard-coded to Family A only, designer surfaces as
HALT trigger 4 (auto-trigger dispatcher change beyond registry-derived
path).

Default assumption (from `MCP-021C-AUTO-TRIGGER-FAMILY-A`'s
implementation pattern): auto-trigger derives from registry. The flip
extends naturally.

---

## 3. Source 6 rendering preservation (Decision 3)

Source 6 filter at
`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
reads `.eq('argument_machine_observation_runs.run_mode', 'production')`.

After this card ships:
- Production-mode runs from B + C land in the results table.
- Source 6 reads those rows automatically; the filter doesn't need
  changes.
- Family B + C raw_keys may surface in node-label rendering.

The renderer was designed for multi-family expansion (per Family A's
ship pattern). Designer Phase A.3 verifies the NodeLabel rendering
pipeline gracefully handles B + C raw_keys.

If the renderer does NOT gracefully handle B + C raw_keys, HALT — file
a separate UI card before flipping production.

---

## 4. Backward compatibility (Decision 4)

Family A production rows already exist (`run_mode='production'`,
`family='parent_relation'`). Post-card, B + C production rows appear
alongside A. The persistence query union must continue working.

Designer Phase A.4 verifies:
- Existing Family A production rows still readable
- New B + C production rows write to same table with correct
  `family` column value
- No UNIQUE constraint conflicts
- No schema mismatch

---

## 5. Smoke verification scope (Decision 5)

5-phase post-merge smoke verifies 3 families produce production rows:
- Trigger a new argument that fires auto-trigger.
- Confirm 3 runs are created (one per family).
- Confirm each run's results are persisted with correct family value.
- Confirm Q11 still shows clean state (post-flip; B + C
  admin_validation rows still exist alongside new production rows).
- Confirm Q9 still shows zero `organic_duplicate_candidate`.

---

## 6. Idempotency observability (Decision 6)

Per `OPS-MCP-IDEMPOTENCY-HARDENING` (Card 3 of prior trio), duplicates
are observability-detected, not prevented by runtime. Card 1 may
produce new duplicate-run pairs if smoke pattern involves re-firing
arguments. These should classify as `audit_or_smoke_rerun`.

If Card 1 smoke produces an `organic_duplicate_candidate`, that's a
finding worth surfacing — it would mean the B+C production flip
introduced an idempotency gap that didn't exist for Family A alone.
HALT and surface.

---

## 7. Out of scope

- Family D/E/F/G/H/I/J registration (Family D is the next card in
  sequence)
- New taxonomy keys
- Prompt changes for Family A/B/C
- Hosted MCP server changes (`mcp-server/**`)
- Persistence schema changes
- Auto-trigger dispatcher logic changes (only registry-derived
  inclusion)
- UI / Source 6 filter changes
- New Edge Function endpoints

---

## 8. HALT triggers (18)

Any ONE fires a HALT.

### Registry + data safety (1-6):
1. familyRegistry.ts edit affects any family other than B + C.
2. familyRegistry.ts productionEnabled flip affects Family A
   (A is already production; do not flip false).
3. Any non-Edge-Function family registry change
   (`mcp-server/lib/familyRegistryInit.ts` is OUT of scope; mcp-server's
   registry already includes B + C as supported families).
4. Auto-trigger dispatcher change beyond the registry-derived path.
5. Source 6 filter change.
6. Persistence schema change.

### Protocol + security (7-12):
7. New taxonomy keys.
8. MCP schema version change.
9. Family A/B/C prompt changes.
10. Hosted MCP server file changes.
11. New Edge Function endpoint.
12. Logs raw argument body, raw prompt, raw model response, bearer
    token, or API key.

### Architecture (13-15):
13. Auto-trigger logic broken (Family A auto-trigger still works
    post-merge is existential).
14. Test forecast exceeds +100 (S card; +20 to +50 expected).
15. Production-mode runs from B + C don't persist to results table.

### Doctrine (16-17):
16. Verdict tokens in user-facing strings.
17. Family C `clarified` lifecycle FALSE-low guard breaks under
    production-mode.

### Working tree (18):
18. Unclassified untracked files at PR creation.

---

## 9. Required Phase A audits (5)

### A.1 — Edge familyRegistry current state
- Open the file; verify the 3-line-block for B and C.
- Document exact line numbers.
- Confirm only 2 booleans need flipping.

### A.2 — Auto-trigger pattern verification
- Identify which file holds the auto-trigger dispatcher
  (`autoTriggerDispatcher.ts` confirmed at Phase 0).
- Confirm it derives families from registry (read the code; confirm
  it iterates `FAMILY_REGISTRY` and filters by `productionEnabled`).
- If hard-coded to Family A only, document as HALT.

### A.3 — Source 6 rendering compatibility
- Confirm Source 6 filter doesn't filter by family.
- Confirm node-label renderer handles multi-family raw_keys gracefully
  (read relevant rendering code; sanity check that Family A's 16 keys
  already render multi-family-ly).

### A.4 — Persistence path verification
- Verify INSERT path for production-mode runs handles 3 families in
  parallel.
- Confirm no UNIQUE constraint that would block 3-family writes.
- Confirm `family` column accepts the 3 family strings.

### A.5 — Test plan
- Forecast +20 to +50.
- Enumerate test cases per Decision 5.

---

## 10. Test forecast: +20 to +50

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(edgeFamilyRegistry|mcpOneTwoOneB|mcpOneTwoOneC|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` (regression sanity; byte-equal)

HALT trigger 14 at +100.

---

## 11. Smoke plan (5-phase)

Post-merge audit at `docs/audits/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-2026-05-27.md`:

### Phase 1 — Pre-flight
- HEAD at Card 1 merge SHA.
- Edge Functions auto-deployed post-merge.
- familyRegistry.ts reflects post-flip state.

### Phase 2 — Auto-trigger new argument test (PRODUCTION)
- Submit a new argument via API (not one of the seeded args).
- Wait ~15-30s for auto-trigger to complete (~5s per family × 3
  families).
- Query DB: 3 new runs (one per family) for the new argument_id,
  all run_mode='production', all status='success'.
- Confirm each run's results have correct `family` column value;
  no cross-family contamination.

### Phase 3 — Source 6 multi-family read verification
- Query Source 6 path; confirm new B + C raw_keys appear; Family A
  raw_keys still appear; no D-J raw_keys.

### Phase 4 — Observability report verification
- Run `scripts/ops/mcp-observability-report.mjs`.
- Q9 should not show new `organic_duplicate_candidate` rows.
- Q11 should now show production-mode for B + C as expected (the
  post-flip state).
- Q12 should still report "no unsupported-family attempts".

### Phase 5 — Regression sanity check
- Family A auto-trigger still works.
- Family B + C admin_validation still works.
- Hosted MCP smoke unaffected.

### Verdict rules

**PASS:**
- All 5 phases clean.
- 3 families produce production runs for new arguments.
- Source 6 reads multi-family production data.
- Observability surface adapts cleanly.
- No regression in admin_validation paths.

**PARTIAL:**
- Phase 2 produces 2/3 families' runs.
- Phase 3 surfaces unknown raw_keys.

**FAIL:**
- Phase 2 fails.
- Phase 4 shows `organic_duplicate_candidate`.
- Phase 5 broad regression.

---

## 12. Authorizations granted on PASS

- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE: PASS`.
- Family B + C now production + auto-trigger live.
- **`MCP-SERVER-005-FAMILY-D`** is the NEXT card per the combined
  launch's binding sequence — with mandatory Stage-2B operator-decision
  checkpoint for subset (~12-key) vs full-27-key paths.
- `OPS-MCP-OBSERVABILITY-FAMILY-B-C-PRODUCTION-COVERAGE` (optional)
  may be filed if observability surfaces gaps in 3-family rendering.

---

## 13. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/MCP-021C-EDGE-FAMILIES-B-C-ENABLE.md` | Designer's binding plan |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | The single file edited (2 boolean flips) |
| `__tests__/edgeFamilyRegistry*.test.ts` | Coverage |
| `docs/audits/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-2026-05-27.md` | Post-merge audit |

---

## 14. Execution order

1. Phase 0 pre-flight (DONE; this brief is the artifact).
2. Stage 0 — commit + push this intent brief to `main`.
3. Phase B — create `feat/MCP-021C-EDGE-FAMILIES-B-C-ENABLE` branch + GitHub issue.
4. Stage 1 — spawn roadmap-designer subagent.
5. Stage 2 — conditional HALT evaluation.
6. Stage 3 — spawn roadmap-implementer subagent.
7. Stage 4 — spawn roadmap-reviewer subagent.
8. Stage 5 — PR + squash-merge + post-merge gates.
9. Post-merge smoke (5-phase).
10. Inter-card checkpoint → Card 2 (Family D).
