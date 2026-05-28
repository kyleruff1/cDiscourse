# OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE — Post-merge audit

**Date:** 2026-05-27 (UTC; smoke completed 2026-05-28T03:32 UTC)
**Operator:** Kyler
**Predecessor:** OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE shipped at `e964ac7` (PR #334).
**Audit doctrine:** Verifies the observability report reflects the 4-family operational state. Q11 reframed; Q14 + Q15 added; Q12 byte-equal preserved; default output safety preserved.

---

## Verdict

**PASS.** Report executes cleanly with 16 SQL sections; Q11 reframe surfaces per-family per-mode counts; Q14 density math operational with nullif zero-guard; Q15 confirms zero deterministic-key leaks for Family D. All locked files byte-equal preserved.

- **Live report execution:** `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/c1-smoke` → exit 0; 16/16 SQL sections; markdown + JSON produced
- **Q11:** correctly shows A+B+C in both production AND admin_validation; D admin_validation only; E-J failed attempts visible
- **Q14:** A=0.1875 (production + admin_validation); B=0.2500 (admin); C=0.0882 (admin); D=0.1053 (admin); nullif zero-guard correctly excludes unsupported families
- **Q15:** 2 observed Family D raw_keys (`evidence_gap_present`, `opens_evidence_debt_marker`); both classified as `ai_classifier_subset`; **0 deterministic-key leaks**
- **Q12 byte-equal preserved:** supported_families derivation handles Family D automatically (verified via design A.3)
- **Safety scan:** no secrets / no raw bodies / no verdict tokens in operator-facing labels

**Authorizations granted:**
- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE: PASS`
- Observability reflects 4-family state
- Proceed to **INTER-CARD CHECKPOINT A** (HARD gate; Family D production-flip observation-period decision)

---

## Phase 1 — Re-run report

**Status:** PASS

```
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/c1-smoke
→ [run] q01...q15 (all 16 SQL files executed)
→ [write] /tmp/c1-smoke/report.md + report.json
EXIT: 0
```

16 sections present (was 14 pre-card: 13 unique Q + Q2b; post-card: 14 + Q14 + Q15 — Q11 rename keeps count at 16 including the 2 new queries).

---

## Phase 2 — Verify new sections

**Status:** PASS

### Q11 reframed (per-family per-mode coverage)

```
| requested_family | run_mode | run_count | success_count | failed_count | fallback_count |
| --- | --- | --- | --- | --- | --- |
| argument_scheme | admin_validation | 3 | 0 | 3 | 0 |
| claim_clarity | admin_validation | 2 | 0 | 2 | 0 |
| critical_question | admin_validation | 2 | 0 | 2 | 0 |
| disagreement_axis | admin_validation | 4 | 3 | 1 | 0 |
| disagreement_axis | production | 1 | 1 | 0 | 0 |
| evidence_source_chain | admin_validation | 14 | 3 | 11 | 0 |
| misunderstanding_repair | admin_validation | 4 | 3 | 1 | 0 |
| (etc.)
```

**Verifies:**
- A+B+C present in BOTH production AND admin_validation rows ✓
- D present in admin_validation only (productionEnabled=false; correct pre-Card-2 state) ✓
- E-J failed attempts visible (admin_validation, status=failed; registry rejection) ✓
- Original B+C admin_validation visibility preserved as a subset of the new output ✓

### Q14 per-family-per-mode signal density

```
| family | run_mode | runs | positives | raw_keys_observed | family_key_count | positives_per_run_key_cell |
| --- | --- | --- | --- | --- | --- | --- |
| disagreement_axis | admin_validation | 2 | 7 | 4 | 14 | 0.2500 |
| evidence_source_chain | admin_validation | 2 | 4 | 2 | 19 | 0.1053 |
| misunderstanding_repair | admin_validation | 2 | 3 | 2 | 17 | 0.0882 |
| parent_relation | admin_validation | 4 | 12 | 3 | 16 | 0.1875 |
| parent_relation | production | 4 | 12 | 4 | 16 | 0.1875 |
```

**Verifies:**
- `family_key_count` hardcoded matches `mcp-server/lib/family[ABCD]Keys.ts` (A=16, B=14, C=17, D=19) ✓
- `positives_per_run_key_cell = positives / (runs × family_key_count)` math correct ✓
- nullif zero-guard correctly excludes unsupported families (E-J have no real-provider runs; they're omitted) ✓
- D density 0.1053 is comparable to A/B/C; the 19-key subset produces meaningful signal ✓

### Q15 Family D subset coverage

```
| raw_key | run_mode | positive_count | distinct_arguments | subset_membership |
| --- | --- | --- | --- | --- |
| evidence_gap_present | admin_validation | 2 | 2 | ai_classifier_subset |
| opens_evidence_debt_marker | admin_validation | 2 | 2 | ai_classifier_subset |
```

**Verifies:**
- 2 observed Family D raw_keys (matches Card 2 smoke Phase 4 observation) ✓
- Both classified as `ai_classifier_subset` ✓
- **Zero `deterministic_excluded_leak` rows** ✓ (the binding safety assertion)
- Zero `unknown_key_outside_taxonomy` rows ✓
- Section header documents 19-vs-27 distinction with citation ✓

### supported_families 4-family handling

Per design §5 + Q12 byte-equal preserved (`git diff main..HEAD -- scripts/ops/sql/12-unsupported-family-attempts.sql` empty), Family D is included in supported_families derivation via the data-derived CTE filtering on `provider_key NOT LIKE 'smoke-%'`. Q12 returns 0 unsupported-family attempt rows for Family D in the report (D's failed runs are real-provider failures, not unsupported-family rejections; correctly tracked).

### Safety scan

```
grep -c "BEGIN PRIVATE|service_role|ANTHROPIC_API_KEY|Bearer eyJ|apikey eyJ|sb_secret_" /tmp/c1-smoke/report.md
→ 0 for each
```

```
sed '/^## Appendix B/,$d' /tmp/c1-smoke/report.md | grep -iE "winner|loser|fallacy|bad faith|manipulative|extremist|propagandist|liar"
→ no matches
```

Verdict tokens appear only in Appendix B (the doctrine-scan annotation enumerating tokens checked + confirmed absent). Default output safety preserved.

---

## Phase 3 — Regression sanity

**Status:** PASS

```
npx jest --testPathPattern="opsMcp" --no-coverage
→ Test Suites: 14 passed, 14 total
  Tests:       211 passed, 211 total
EXIT: 0
```

```
npm run typecheck → exit 0
npm run lint → exit 0
```

mcp-server Deno tests untouched (no mcp-server/* file modified; design §5 + reviewer matrix verified locked-file integrity).

---

## Verdict + authorization

### Final verdict

**PASS** — All 3 phases satisfied:
- Phase 1: report executes; 16 sections present
- Phase 2: Q11 reframed correctly; Q14 density math + nullif zero-guard working; Q15 confirms 2 observed D keys with 0 deterministic leaks; safety preserved
- Phase 3: targeted regression clean

### Observations

- **Q11 reframe is operator-readable.** The new 6-column shape (requested_family, run_mode, run_count, success_count, failed_count, fallback_count) is more informative than the prior 3-column shape and surfaces the full 4-family state.
- **Family D density (0.1053) is comparable to A/B/C** (0.0882–0.2500). The 19-key subset produces meaningful signal density; the Stage 2B Subset path was the right call architecturally.
- **Q15 confirms Card 2 fix worked end-to-end.** No deterministic key has leaked into the Family D results table. The Edge subset filter at `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain'] = {'ai_classifier'}` is holding.
- **supported_families derivation is future-proof.** The data-derived CTE (Q12 SEMANTIC TIGHTENING) correctly migrated Family D from unsupported to supported when its first real-provider rows landed, with NO SQL change required.

### Authorizations confirmed on PASS

- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE: PASS`
- Observability reflects 4-family state
- **Proceed to INTER-CARD CHECKPOINT A** (HARD gate; Family D production-flip observation-period decision)

### Operator cleanup

After audit commits, temp artifacts may be deleted:
- `/tmp/c1-smoke/report.md`
- `/tmp/c1-smoke/report.json`
- `/tmp/c1-postmerge-*.log`
- `/tmp/c1-verify/`
- `/tmp/card1-baseline.sql`
- `/tmp/card1-baseline/` (if any)

None contain secrets.
