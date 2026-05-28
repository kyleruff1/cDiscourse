# OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** OPS — Multi-family observability
**Card position:** Card 1 of 3 in the FAMILY-D-COVERAGE → EDGE-FAMILY-D-ENABLE → FAMILY-E chain
**Predecessor chain on main:**
- `MCP-SERVER-005-FAMILY-D-SMOKE PASS` at `0da43f9`
- `fix(MCP-SERVER-005-FAMILY-D)` Edge→MCP subset filter at `b0fd068`
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE PASS` at `ac66b2e`
- All preceding observability cards (Q12-SEMANTIC-TIGHTENING, TEST-DATA-CLEANUP, IDEMPOTENCY-HARDENING)

---

## 1. The 4-family state (Phase 0 inventory)

Phase 0 live DB query confirms the 4-family operational state:

| Family | admin_validation | production | Notes |
| --- | --- | --- | --- |
| `parent_relation` | 6 success / 0 fail | 6 success / 0 fail | A: production + auto-trigger live |
| `disagreement_axis` | (run counts in full inventory) | (B production rows live from Card 1 of prior launch) | B: production + auto-trigger live |
| `misunderstanding_repair` | 3 success / 1 fail | 1 success / 0 fail | C: production + auto-trigger live |
| `evidence_source_chain` | 3 success / 11 fail | 0 | D: admin_validation only; 11 failures = 3 pre-fix Phase 4 + 8 from unsupported-family regression smokes |
| `argument_scheme` (E) | failed attempts only | 0 | unsupported |
| `critical_question` (F) | failed attempts only | 0 | unsupported |
| `resolution_progress` (G) | 2 failed | 0 | unsupported |
| `claim_clarity` (H) | failed attempts only | 0 | unsupported |
| `thread_topology` (I) | 2 failed | 0 | unsupported |
| `sensitive_composer` (J) | 2 failed | 0 | unsupported |

The observability report's Q1-Q13 were designed for the 3-family world (A+B+C + Q12 unsupported-family-attempts). They run cleanly in the 4-family world but their interpretation is stale:
- Q11 was "Family B and C admin-validation-only check" — but B+C are now production AND admin_validation; the title and binding assertion are stale
- No query surfaces Family D's MCP-routed subset (19) vs taxonomy surface (27) distinction
- No per-family-per-mode signal density query exists

This card updates the report to match the 4-family system state.

---

## 2. The three deliverables

### Q11 reframe (Decision 1)

Current Q11 (`scripts/ops/sql/11-family-bc-admin-validation-check.sql`) groups requested_families by (family, run_mode) for B+C. Post-prior-launches, B+C are production AND admin_validation. The reframe:
- Rename query to "per-family run-mode coverage" (or equivalent)
- Show ALL registered families' run counts split by run_mode
- Preserve the original B+C visibility (still see admin_validation activity)
- Add production visibility per family
- Make NO assumption that any family is mode-restricted; report actual state

The query may be renamed (e.g., `11-per-family-per-mode-coverage.sql`) to better describe its post-reframe semantics. Designer Phase A decides.

### Q14: per-family-per-mode signal density (Decision 2)

Add a new query (`scripts/ops/sql/14-per-family-per-mode-signal-density.sql`):
- For each (family, run_mode) pair:
  * run count
  * total positive observations
  * signal density (positives / (runs × family_key_count))
  * distinct raw_keys observed
- Lets operator compare Family D's 19-key subset density to A/B/C; lets operator compare production vs admin_validation density per family

The `family_key_count` denominator is the number of MCP-routed keys per family:
- A: 16
- B: 14
- C: 17
- D: 19 (subset; NOT 27 taxonomy surface)
- E-J: 0 (unsupported)

Designer Phase A.2 picks the exact density math (positives / runs, OR positives / (runs × key_count), OR positive_keys / key_count) and justifies the choice.

### Q15: Family D subset coverage (Decision 3)

Add a new query (`scripts/ops/sql/15-family-d-subset-coverage.sql`) OR section annotation that:
- Reports which Family D raw_keys have appeared in results
- Confirms all observed Family D raw_keys ∈ the 19-key ai_classifier subset
- Flags if any deterministic key appears (would indicate a leak; should be 0)
- Documents the 19-vs-27 distinction explicitly in the section header/comment

Family D-specific because D is the first family with a Stage-2B subset filter. Future families (likely E/F/G/H/I/J if they have similar patterns) would get their own coverage queries; this card only covers D.

---

## 3. supported_families derivation: 4-family edge case (Decision 4)

The Q12 SEMANTIC TIGHTENING fix derives supported_families from real-provider rows (`provider_key NOT LIKE 'smoke-%'`). With Family D's first real-provider rows now landing in admin_validation, Family D should now appear in supported_families. Designer Phase A.3 verifies:
- Family D appears in supported_families (the derivation correctly picks it up from `provider_key='mcp:classify_argument_boolean_observations'` results rows)
- Family D is NOT flagged as an unsupported-family attempt in Q12
- The derivation correctly handles a family that's MCP-supported but production-disabled (D is admin_validation-only)

Family D is the first family that's MCP-supported-but-not-production; the observability queries must handle this state correctly. The Q12 fix's data-derived CTE handles this naturally (the CTE doesn't gate on run_mode), but verify.

---

## 4. Report runner manifest update (Decision 5)

`scripts/ops/mcp-observability-report.mjs` + `mcp-observability-report-lib.cjs` iterate a SECTIONS const. Adding Q14 + Q15 requires extending SECTIONS. Verify:
- New queries registered in the runner
- Report markdown + JSON include the new sections
- Existing queries (Q1-Q13) unchanged
- Section ordering: Q14 + Q15 land after Q13; insertion is additive

---

## 5. Out of scope

- ANY runtime code change (`mcp-server/*`, `supabase/functions/*` logic)
- ANY registry change (`familyRegistry.ts` on either side)
- ANY production-mode flip (that's Card 2 of this chain)
- New taxonomy keys
- Schema migration
- Source 6 filter change
- New family registration
- The MCP server's MAX_TOKENS or prompt changes
- Family E observability (deferred; E may get its own coverage query when E ships in Card 3, or Card 1's queries may already generalize)

---

## 6. HALT triggers (16)

Any ONE fires HALT.

### Scope (1-7):
1. Any runtime code change
2. Any registry change
3. Any production-mode flip
4. New taxonomy keys
5. Schema migration
6. Source 6 filter change
7. New family registration

### Correctness (8-12):
8. New per-family-per-mode query mislabels a family's mode
9. Family D coverage query conflates 27 taxonomy entries with 19 MCP-routed keys (must distinguish them explicitly)
10. Q11 reframe drops the original B+C visibility (must preserve + extend, not replace)
11. supported_families derivation breaks under 4-family state
12. Report runner fails to execute any query

### Doctrine (13-14):
13. Report default output exposes evidence_span content, raw bodies, secrets, or tokens
14. Verdict tokens in SQL comments or report labels (except negation)

### Working tree (15-16):
15. Test forecast exceeds +80 (S card; +15 to +40 expected)
16. Unclassified untracked files at PR creation

---

## 7. Required Phase A audits (4)

### A.1 — Current Q11 semantics + reframe design
- Read `scripts/ops/sql/11-family-bc-admin-validation-check.sql`
- Document current shape + output
- Design reframe: file rename (if appropriate); new SQL shape; new section title; preserved + extended semantics
- Verify reframe surfaces B+C admin_validation rows (preservation) AND production rows (extension)

### A.2 — Per-family-per-mode signal density math
- Pick density formula and justify
- Decide where `family_key_count` denominator comes from:
  - Hardcode per family (with citation to source-of-truth file)
  - Derive from supported_families CTE + a lookup
  - Static map in SQL comment
- Verify the math handles zero-runs and zero-positives gracefully

### A.3 — Family D subset coverage + supported_families 4-family verification
- Live DB query: does Family D appear in supported_families derivation?
- Does Q12 NOT flag Family D as unsupported-family attempt?
- Design Q15: list observed Family D raw_keys; verify subset membership; flag deterministic-key leaks (should be 0)

### A.4 — Test plan + report-runner manifest update
- Test cases enumeration
- Report-runner manifest insertion point + format
- Default output safety scan extension

---

## 8. Test forecast: +15 to +40

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(opsMcp|opsMcpObservability|opsMcpObservabilityFamilyDCoverage)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` (regression sanity; byte-equal)

HALT at +80.

---

## 9. Smoke plan (3-phase)

Audit at `docs/audits/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE-<date>.md`:

### Phase 1 — Re-run report
- `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/card1-smoke`
- Exit 0; all queries (Q1-Q15) execute

### Phase 2 — Verify new sections
- Q11 reframed: shows per-family per-mode; B+C show both modes; D shows admin_validation only; A+B+C show production + admin_validation
- Q14: per-family-per-mode density present; correct math
- Q15: Family D subset coverage shows observed keys ∈ 19-key subset; 0 deterministic-key leaks
- supported_families: D included; not flagged as unsupported attempt
- Default output safety preserved (no evidence_span/secrets/tokens; grep scan)

### Phase 3 — Regression
- `npx jest --testPathPattern="opsMcp" --no-coverage` → exit 0
- `cd mcp-server && deno test` → exit 0

### Verdict rules

**PASS:**
- Report executes cleanly
- New sections present + correct
- D distinction visible
- Safety preserved
- Regression clean

**PARTIAL:**
- Report executes but one new section incomplete (e.g., density math edge case); document; file scoped fix

**FAIL:**
- Report fails to execute
- Safety violation
- Q11 reframe drops original signal
- D distinction wrong

---

## 10. Authorizations granted on PASS

- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE: PASS`
- Observability reflects 4-family state
- Proceed to **INTER-CARD CHECKPOINT A** (HARD gate; observation-period decision)

---

## 11. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md` | Designer's binding plan |
| `scripts/ops/sql/11-*.sql` | Q11 reframed |
| `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` (NEW) | Q14 |
| `scripts/ops/sql/15-family-d-subset-coverage.sql` (NEW) | Q15 |
| `scripts/ops/mcp-observability-report.mjs` + `.cjs` | Runner manifest update |
| `__tests__/opsMcpObservabilityFamilyDCoverage.test.ts` (NEW) | Coverage |
| `docs/ops/OPS-MCP-OBSERVABILITY.md` | Operator doc update for Q14 + Q15 |
| `docs/audits/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE-<date>.md` | Post-merge audit |

---

## 12. Execution order

1. Phase 0 pre-flight (DONE; this brief is the artifact)
2. Stage 0 — commit + push this intent brief to `main`
3. Phase B — create `feat/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` branch + GitHub issue
4. Stage 1 — spawn roadmap-designer subagent (4 Phase A audits)
5. Stage 2 — conditional HALT evaluation (auto-proceed if clean)
6. Stage 3 — spawn roadmap-implementer subagent
7. Stage 4 — spawn roadmap-reviewer subagent
8. Stage 5 — PR + squash-merge + post-merge gates
9. Post-merge smoke (3-phase)
10. INTER-CARD CHECKPOINT A → Card 2
