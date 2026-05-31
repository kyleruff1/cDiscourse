# OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — 5-family observability backfill (Family G)

**Status:** Design draft (authored 2026-05-31)
**Card type:** Observability SQL + manifest backfill — Family G (resolution_progress) data-coverage catch-up.
**Epic:** OPS — Multi-family observability
**Release:** v0.1 (Stage 6.x operational tooling)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/395 (umbrella #388)
**Branch:** `feat/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE` (already created off `origin/main` at HEAD `3097521` — post H Card 1 merge)
**Predecessor (production-enable chain):** MCP-021C-EDGE-FAMILY-G-ENABLE merged on `main` 2026-05-29 (commit `5b6edee`).
**Predecessor (observability template):** OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE merged 2026-05-28 (commit `e964ac7`, PR #334). This card is the **2nd** per-family observability backfill (NOT the 4th — the intent brief's "Replicates D/E/F precedent" line is aspirational; E and F observability cards are still queued as intent-briefs only; see §13).
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE-intent.md` (orchestrator-authored; 3 `[OPERATOR DECISION NEEDED]` markers resolved in §1 below with defaults the operator may revisit at PR review).

---

## 0. Overview

Family G (`resolution_progress`) shipped to production on 2026-05-29 via `MCP-021C-EDGE-FAMILY-G-ENABLE`. The corresponding observability backfill (mirroring what D shipped under `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` against the 4-family state) was deferred and is now overdue.

This card lands the data-coverage layer for G with **zero runtime code change**:

- **Q11** (per-family per-mode coverage) — already family-agnostic via `unnest(requested_families)`; the **SQL body is byte-equal**, only the header **narrative comment** + the SECTIONS **question text** are updated to enumerate G alongside D in the "production + admin_validation" enumeration.
- **Q14** (per-family per-mode signal density) — the **CASE expression** gains one branch: `when 'resolution_progress' then 18` (the 18-key Family G ai_classifier Subset). Header comment table gains one row. SECTIONS entry's `question` string updated.
- **Q16** (NEW — Family G 18-key subset coverage) — a Family-G-scoped mirror of Q15's Family-D subset coverage. Verifies all observed `resolution_progress` raw_keys are within the 18-key Subset; flags any of the 12 deterministic-excluded keys as `deterministic_excluded_leak`.

All other SQL files (Q01..Q10, Q12, Q13, Q15) remain byte-equal. No `mcp-server/**`, `supabase/functions/**`, `supabase/migrations/**`, `src/**`, or `package.json` change.

The doctrine constraints that shape this design: `cdiscourse-doctrine §1` (no verdict labels — counts and density ratios only; Family G's resolution-progress states are descriptive convergence-state, NEVER who-won verdicts); `§3` (no popularity surfacing — density is positives / (runs × key_count), never a "best family" ranking); `§6` (no secrets in output — Phase A verification carried forward from the D card; `npx supabase db query --linked` uses the operator's authenticated Management API session); `§9` (operator-facing telemetry only, not user UI — the `gameCopy.toPlainLanguage` rule does not apply); `§10a` (machine taxonomy values like `concedes_broader_point` appear verbatim as data values, never as verdicts about a user); `point-standing-economy` (Family G's concession / synthesis / settlement keys are SCORING REPAIRS, never defeats; the observability records counts, never standing deltas); `supabase-edge-contract` (no migration, no Edge Function change, no RLS change, no service-role usage); `evidence-doctrine` (evidence_span content remains suppressed by default; no new flag in this card).

---

## 1. Operator intent + Binding decisions (D1..D5)

The intent brief at `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE-intent.md` carries 3 `[OPERATOR DECISION NEEDED]` markers and 2 implicit decisions inherited from the D precedent. All 5 are resolved below with explicit justifications; the operator may revisit any of these at PR review.

### D1 — Resolves intent §2 IN-scope marker: which new Q files to add

**Decision:** Add **1 new SQL file (Q16)** + **1 narrative-only edit to Q11** + **1 CASE-branch edit to Q14**.

| File | Status under this card | Reason |
| --- | --- | --- |
| `scripts/ops/sql/11-per-family-per-mode-coverage.sql` | **Narrative comment edited; SELECT body byte-equal** | Q11 is already family-agnostic via `unnest(requested_families)` (GOBS-4 finding). The query attribution surfaces G's rows automatically; only the header narrative (lines 5-10) needs to gain a G bullet so an operator reading the SQL sees the 5-family state enumerated. |
| `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` | **CASE expression + header comment edited** | Q14's hardcoded family_key_count CASE (lines 56-62) gains `when 'resolution_progress' then 18`. Header comment table gains one row. Without this, Family G's density column renders as `null` (the `else 0` fallback) — the Stage 2B Subset key count must be encoded explicitly. |
| `scripts/ops/sql/16-family-g-subset-coverage.sql` | **NEW** | Family-G-scoped mirror of Q15's Family-D subset coverage. Verifies all observed `resolution_progress` raw_keys ∈ 18-key Subset; flags any of the 12 deterministic-excluded keys as a leak. Same shape as Q15 (5 columns, 3 subset_membership values, leak-first ORDER BY). |

D1 also implicitly answers: **why a new Q16 file, not a Q15-shape modification?** Q15 is Family-D-scoped (`where res.family = 'evidence_source_chain'`). A Family-G variant must run a separate query (different family filter, different verbatim Subset list, different deterministic-excluded list). The D precedent's §4.1 ("separate file (not annotation)") explicitly anticipated this: *"a separate file lets future families (E-J) follow the same pattern — `16-family-e-subset-coverage.sql` etc. — when they ship with subset filters"*. We take Q16 (not 17) because E and F observability cards have not landed yet; their candidate slots (Q16 for E, Q17 for F under a chronological-by-family-letter ordering) will be filled by their own backfill cards. Q16 belongs to G under the **chronological-by-card-ship order** semantics (D-coverage landed Q15; G-coverage lands Q16; E-coverage will land Q17 when it ships; F-coverage will land Q18; etc.). The intent brief OUT scope precludes touching E/F.

**Implicit out-of-scope under D1:** the intent brief explicitly excludes touching A-F or H-related queries. We do NOT add E (16 keys) or F (14 keys) to Q14's CASE under this card, even though they are now production-enabled (commits `9a3d8fe`, `65dbfc3`). Until their backfill cards ship, Family E and F density values will continue rendering as `null` (the `else 0` fallback inside `nullif`). This is a deliberate carry-forward gap, NOT a regression — the existing post-Q14-landed posture for E/F is identical to the pre-card posture. See §13 (Carry-forward invariants) and §15 (Risks).

### D2 — Resolves intent §2 IN-scope marker: test pattern

**Decision:** Add one new test file `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts` that mirrors `__tests__/opsMcpObservabilityFamilyDCoverage.test.ts` structurally. Groups A-E correspond to the D precedent's groups, retargeted to G:

- **Group A** — Q11 narrative regression (4 file/header tests). Smaller than D's Group A because no rename, no schema change; only the header narrative and SECTIONS question gain a G bullet.
- **Group B** — Q14 CASE regression (3 file/header tests). The G branch is added; the existing A/B/C/D branches must remain.
- **Group C** — Q16 new-file content (11 tests, mirroring D's Group C). Verbatim 18-key Subset list, verbatim 12-key deterministic-excluded list, 3 subset_membership values, 5-column SELECT contract, leak-first ORDER BY, banned-token scan.
- **Group D** — Cross-section invariants (4 tests). SECTIONS length now 17; ordered id list; Q11 / Q14 / Q16 cross-check the family-G presence; Q16 column names do not collide with Q11/Q14.
- **Group E** — Fixture compatibility (5 tests). Fixture gains a `q16-family-g-subset-coverage` key; the empty-DB fixture gains the same key; runner stitcher consumes the fixture cleanly with no NaN/undefined; runner JSON artifact has 17 sections.

Test count: **27 new tests in the dedicated file**, plus length-pin updates to **5 existing test files**. See §11 for binding forecast.

### D3 — Resolves intent §3 D2 marker: test delta forecast (+20 to +50 → tighten)

**Decision (BINDING):** **+30 to +44 new tests**, mirroring the D coverage's shipped delta (+30 to +44).

The dedicated test file ships 27 net-new tests (Group A: 4 + Group B: 3 + Group C: 11 + Group D: 4 + Group E: 5). Length-pin updates to existing tests add net 3-17 more tests as fixtures expand to include the G section:

| Existing test file | Modification | Delta |
| --- | --- | --- |
| `opsMcpObservabilityReportShape.test.ts` | SECTIONS length 16 → 17; ordered id list adds q16 | +0 net tests (modify-in-place); +1 test if a new "Q16 fixture rows iterate" test is added |
| `opsMcpObservabilitySqlSafety.test.ts` | File count 16 → 17 | +0 net tests (modify-in-place); the `describe.each(DDL_KEYWORDS)` loop runs once more per file but does not add a new test row |
| `opsMcpObservabilityEmptyDbSafety.test.ts` | Empty fixture gains q16 key; "all 16 section titles" → "all 17" | +0 net tests (modify-in-place) |
| `opsMcpObservabilityMultiFamily.test.ts` | Optional new test: Q16 surfaces Family G rows when fixture has them | +1 to +3 new tests |
| `opsMcpObservabilityDoctrineBanList.test.ts` | Scan now covers the new Q16 section text | +0 (scan path unchanged) |

**Forecast band: +30 to +44.** Within the +20 to +50 brief band the intent specified; mirrors the D shipped delta; safely under the HALT 8 ceiling of +60 tests per chain-prompt §HALT (the orchestrator's binding test-delta cap).

If the implementer wants to consolidate, Group C's 18 Subset rawKey substring assertions are already consolidated into a single test that iterates the list internally (mirror of D's Group C consolidation — see `opsMcpObservabilityFamilyDCoverage.test.ts:336-344`). No further consolidation needed; the forecast already accounts for that.

### D4 — Implicit (carry-forward from D precedent): Q11 SQL body is byte-equal

The D precedent's Q11 file (`11-per-family-per-mode-coverage.sql`) introduced family-agnostic attribution via `unnest(requested_families)` and a 6-column report-parser contract (`requested_family`, `run_mode`, `run_count`, `success_count`, `failed_count`, `fallback_count`). The body needs **no change** for G — the query already groups by `requested_family, run_mode` and `resolution_progress` rows surface automatically.

Only the **narrative-comment region** (lines 5-10 of the current Q11 file) is modified, to expand the Family-by-mode enumeration from 4 families to include G:

```
Current (lines 5-10):
--   - Family A (parent_relation): production + auto-trigger live + admin_validation
--   - Family B (disagreement_axis): production + auto-trigger live + admin_validation
--   - Family C (misunderstanding_repair): production + auto-trigger live + admin_validation
--   - Family D (evidence_source_chain): admin_validation only (19-key ai_classifier Subset)
--   - Families E-J: unsupported (failed attempts only if any)

Updated (lines 5-11):
--   - Family A (parent_relation): production + auto-trigger live + admin_validation
--   - Family B (disagreement_axis): production + auto-trigger live + admin_validation
--   - Family C (misunderstanding_repair): production + auto-trigger live + admin_validation
--   - Family D (evidence_source_chain): admin_validation only (19-key ai_classifier Subset)
--   - Family G (resolution_progress): production + admin_validation (18-key ai_classifier Subset)
--   - Families E, F, H-J: see operator notes (E, F production; H Card-1 admin_validation; I, J unsupported)
```

**Doctrine self-check:** D's narrative implies the "4-family state" is the operative one; G's narrative correctly extends to a "5-family carrier-forward state" without re-litigating E/F/H. The intent brief is explicit that this card does NOT speak to E/F/H beyond noting their status; the narrative reflects that.

### D5 — Implicit (carry-forward from D precedent): no migration, no Edge change, no operator deploy

D shipped with zero operator post-merge action beyond the smoke-audit observability replay. G's card has the same posture: no `npx supabase db push`, no `npx supabase functions deploy`, no env var change, no npm dep change. See §17.

---

## 2. Phase A scope reality (carry-forward from D precedent)

The D precedent's Phase A produced 4 live-DB-verified findings (A.1 Q11 4-family state, A.2 density math, A.3 supported_families derivation, A.4 test/runner manifest plan). G's card inherits the **methodology** but does NOT re-execute live DB queries at design time — the 5-agent Workflow `wf_f0585507-724` (run pre-design) produced the equivalent verification through static file reads and the GOBS-1..GOBS-5 evidence chain.

### 2.1 — GOBS-3 SQL ownership baseline (carried into HALT trigger §10)

The Workflow's GOBS-3 agent confirmed:

- `scripts/ops/sql/` currently contains **16 SQL files** (Q01..Q10, Q11 reframed, Q12, Q13, Q14, Q15).
- `__tests__/opsMcpObservabilitySqlSafety.test.ts:58` pins the count at **16**.
- `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:74,81` asserts the total `scripts/ops/` tree has **≥18 files** with **exactly 16 SQL files**.
- Both ownership tests must update under this card (16 → 17 SQL files, ≥18 → ≥19 total). See §7.

### 2.2 — GOBS-4 manifest ownership (carried into §5 SECTIONS update)

The manifest is the frozen SECTIONS array at `scripts/ops/mcp-observability-report-lib.cjs:124-345` (currently 16 entries). G adds **1 new entry** for Q16. The Q11 entry's `question` string (line 266) gains a one-line update to enumerate G. The Q14 entry's `question` string (line 315) gains a one-line update to include resolution_progress in the "all four supported families" → "five supported families with Subset filters" language.

### 2.3 — GOBS-5 Family G key constants (carried into §4 Q16 SQL + §8 test)

The Workflow's GOBS-5 agent confirmed against `mcp-server/lib/familyGKeys.ts`:

- **18 ai_classifier Subset keys** (`FAMILY_G_RAW_KEYS` at lines 99-118) — these are the binding contract.
- **12 deterministic-excluded keys** (`FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS` at lines 136-151) — 5 auto_metadata + 7 lifecycle.
- Stage 2B operator decision (cited in `docs/designs/MCP-SERVER-008-FAMILY-G.md` §A.1.1): only the 18 ai_classifier keys are routed to the MCP server.
- The Subset/Excluded distinction directly mirrors D (19/27 → 19 routed + 8 excluded). For G: 18 routed + 12 excluded = 30 total upstream taxonomy entries.

The Family G analog of the D "19-vs-27" distinction is **"18-vs-30"**: the upstream taxonomy registry (`src/features/nodeLabels/machineObservationDefinitions/familyG.ts`) has 30 total entries, 18 of which are `source: 'ai_classifier'` (per the file-header note in `familyGKeys.ts:32-36` correcting a stale upstream comment). Q16 will document the **18-vs-30 distinction** in its header, mirroring Q15's 19-vs-27 documentation.

---

## 3. Q11 narrative update (DATA-only edit)

### 3.1 — SQL body posture: BYTE-EQUAL

The Q11 `select … from (select unnest(requested_families) … ) … group by requested_family, run_mode` body remains byte-equal. No new columns. No new filters. The post-Family-G-enable state is already surfaced by the query as-is.

### 3.2 — Header comment patch

```sql
-- BEFORE (lines 5-10 of scripts/ops/sql/11-per-family-per-mode-coverage.sql):
--   - Family A (parent_relation): production + auto-trigger live + admin_validation
--   - Family B (disagreement_axis): production + auto-trigger live + admin_validation
--   - Family C (misunderstanding_repair): production + auto-trigger live + admin_validation
--   - Family D (evidence_source_chain): admin_validation only (19-key ai_classifier Subset)
--   - Families E-J: unsupported (failed attempts only if any)

-- AFTER (lines 5-11):
--   - Family A (parent_relation): production + auto-trigger live + admin_validation
--   - Family B (disagreement_axis): production + auto-trigger live + admin_validation
--   - Family C (misunderstanding_repair): production + auto-trigger live + admin_validation
--   - Family D (evidence_source_chain): admin_validation only (19-key ai_classifier Subset)
--   - Family G (resolution_progress): production + admin_validation (18-key ai_classifier Subset)
--   - Families E, F, H-J: see operator notes (E, F production-enabled; H Card-1 admin_validation; I, J unsupported)
```

**Source-of-truth citation footer note:** the `Source-of-truth:` line (currently `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §2`) gains a second citation: `… §2; OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §3`. This preserves the D blame chain while crediting G's narrative-update.

### 3.3 — SECTIONS entry update (at `scripts/ops/mcp-observability-report-lib.cjs:263-277`)

The Q11 entry's `question` string is the only change to the SECTIONS Q11 block:

```js
// BEFORE (line 265-266):
question:
  'Q11 — How are runs distributed across families and run_modes? (4-family state: A+B+C production + admin_validation; D admin_validation only; E-J failed attempts.)',

// AFTER:
question:
  'Q11 — How are runs distributed across families and run_modes? (5-family carrier-forward state: A+B+C+G production + admin_validation; D admin_validation only with 18-key Subset for G; E, F production; H Card-1 admin_validation; I, J unsupported.)',
```

The `id`, `title`, `sqlFile`, `columns`, and `emptyMessage` are byte-equal. Group A's test will assert (a) the post-rename id is still `q11-per-family-per-mode-coverage`, (b) the 6 columns are unchanged, (c) the new question text contains the substring `resolution_progress` OR `Family G` OR `18-key Subset for G` — the test uses the most stable of these so a future copy-edit doesn't trip the test (we choose `resolution_progress` per §8).

### 3.4 — Preservation property

The D precedent's §2.3 preservation property (Q11's original B+C admin-validation rows are a strict subset of the new query output) **continues to hold under G**. No SQL body change means no preservation regression.

### 3.5 — Live output preview (forecast, NOT live-verified at design time)

Based on the Family G enable smoke from `MCP-021C-EDGE-FAMILY-G-ENABLE.md`, the post-G-enable Q11 output is expected to surface:

| requested_family | run_mode | run_count | success_count | failed_count | fallback_count |
| --- | --- | --- | --- | --- | --- |
| argument_scheme | admin_validation | (carry-forward) | 0 | n | 0 |
| claim_clarity | admin_validation | n | 0 | n | 0 |
| critical_question | admin_validation | n | 0 | n | 0 |
| disagreement_axis | admin_validation | n | n | n | 0 |
| disagreement_axis | production | n | n | 0 | 0 |
| evidence_source_chain | admin_validation | n | n | n | 0 |
| misunderstanding_repair | admin_validation | n | n | n | 0 |
| misunderstanding_repair | production | n | n | 0 | 0 |
| parent_relation | admin_validation | n | n | 0 | 0 |
| parent_relation | production | n | n | 0 | 0 |
| **resolution_progress** | **admin_validation** | **n** | **n** | **n** | **0** |
| **resolution_progress** | **production** | **n** | **n** | **0** | **0** |
| sensitive_composer | admin_validation | n | 0 | n | 0 |
| thread_topology | admin_validation | n | 0 | n | 0 |

The two bold rows are the G presence. Operator validates live in the post-merge smoke (§17).

---

## 4. Q14 CASE branch addition (G family_key_count = 18)

### 4.1 — CASE expression patch

The Q14 CASE expression (currently at `scripts/ops/sql/14-per-family-per-mode-signal-density.sql:56-62`) gains exactly one branch:

```sql
-- BEFORE (lines 56-62):
    case family
      when 'parent_relation' then 16
      when 'disagreement_axis' then 14
      when 'misunderstanding_repair' then 17
      when 'evidence_source_chain' then 19
      else 0
    end as family_key_count

-- AFTER (lines 56-63):
    case family
      when 'parent_relation' then 16
      when 'disagreement_axis' then 14
      when 'misunderstanding_repair' then 17
      when 'evidence_source_chain' then 19
      when 'resolution_progress' then 18
      else 0
    end as family_key_count
```

The G branch lands at the end of the explicit-family list (before `else 0`). Ordering: declaration order follows family-letter ordering A → B → C → D → G (the next ai_classifier Subset family with shipped observability). E and F are NOT added under this card (see §1 D1).

### 4.2 — Header comment patch

```sql
-- BEFORE (lines 11-15):
--   - parent_relation         16   mcp-server/lib/familyAKeys.ts:49
--   - disagreement_axis       14   mcp-server/lib/familyBKeys.ts:53
--   - misunderstanding_repair 17   mcp-server/lib/familyCKeys.ts:61
--   - evidence_source_chain   19   mcp-server/lib/familyDKeys.ts:85 (Subset; 8 deterministic excluded)
--   - others (E-J)             0   no MCP-supported keys

-- AFTER (lines 11-16):
--   - parent_relation         16   mcp-server/lib/familyAKeys.ts:49
--   - disagreement_axis       14   mcp-server/lib/familyBKeys.ts:53
--   - misunderstanding_repair 17   mcp-server/lib/familyCKeys.ts:61
--   - evidence_source_chain   19   mcp-server/lib/familyDKeys.ts:85 (Subset; 8 deterministic excluded)
--   - resolution_progress     18   mcp-server/lib/familyGKeys.ts:99 (Subset; 12 deterministic excluded)
--   - others (E, F, H-J)       0   not yet backfilled (E, F coverage cards queued; H Card-1 landed 2026-05-30; I, J no MCP support)
```

### 4.3 — Source-of-truth citation footer note

The `Source-of-truth:` line (currently `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §3`) gains a second citation: `… §3; OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §4`.

### 4.4 — SECTIONS entry update (at `scripts/ops/mcp-observability-report-lib.cjs:311-328`)

The Q14 entry's `question` string is the only update:

```js
// BEFORE (line 314-315):
question:
  'Q14 — What is the per-(run, possible_key) signal density across all four supported families and both run_modes?',

// AFTER:
question:
  'Q14 — What is the per-(run, possible_key) signal density across all five Subset-backfilled families (A, B, C, D, G) and both run_modes?',
```

Group B's test will assert the question text contains the substring `resolution_progress` OR `five` (we use `five` per §8 — more stable than enumerating family letters which may change as E/F/H backfill cards ship).

### 4.5 — Doctrine self-check (Q14 carry-forward)

The D precedent's §3.5 doctrine constraints (`aggregate ratios only`; `the report does NOT label a family as "over-firing" or "under-firing"`) carry forward unchanged. Family G's resolution_progress states are descriptive convergence-state per `cdiscourse-doctrine §1` + `point-standing-economy`; the density calculation is a structural ratio, never a verdict.

**Specific G concern:** Family G's keys include `concedes_broader_point` (HIGHEST verdict-adjacency per `familyGKeys.ts:51`), `concedes_narrow_point`, `accepts_settlement_terms`. A naive density-narrative reader might infer "high density of `concedes_broader_point` means this side is losing". The Q14 SQL does NOT carry any such narrative; the section title is "Per-family per-mode signal density" with no verdict overlay. The runbook narrative (§9.2) explicitly notes: *"the density value for resolution_progress is structural — high concession-key positives reflect SCORING REPAIRS in the underlying conversation, never defeats."*

### 4.6 — Live output preview (forecast, NOT live-verified at design time)

Density forecast for the G addition (based on the post-G-enable smoke artifact format — actual numbers operator-validated post-merge):

| family | run_mode | runs | positives | raw_keys_observed | family_key_count | positives_per_run_key_cell |
| --- | --- | --- | --- | --- | --- | --- |
| disagreement_axis | admin_validation | (carry) | (carry) | (carry) | 14 | (carry) |
| evidence_source_chain | admin_validation | (carry) | (carry) | (carry) | 19 | (carry) |
| misunderstanding_repair | admin_validation | (carry) | (carry) | (carry) | 17 | (carry) |
| parent_relation | admin_validation | (carry) | (carry) | (carry) | 16 | (carry) |
| parent_relation | production | (carry) | (carry) | (carry) | 16 | (carry) |
| **resolution_progress** | **admin_validation** | **n** | **m** | **k** | **18** | **m/(n*18)** |
| **resolution_progress** | **production** | **n** | **m** | **k** | **18** | **m/(n*18)** |
| (e/f rows render with family_key_count=0; density renders null) | … | … | … | … | 0 | (null) |

Family E and F rows continue to render with `family_key_count=0` (via `else 0`) and `positives_per_run_key_cell=null` (via `nullif`). This is the deliberate carry-forward gap noted in §1 D1.

---

## 5. Q16 Family G subset coverage (NEW SQL file)

### 5.1 — Strategy: mirror Q15 (D precedent §4.1)

Q16 is the Family-G analog of Q15. The D precedent's strategy decision (separate file vs Q6/Q13 annotation) is binding: separate file. Reasoning is identical to D §4.1 — independent replayability via `npx supabase db query --linked --file scripts/ops/sql/16-family-g-subset-coverage.sql`; future E/F/H backfill cards each get their own subset-coverage file (Q17, Q18, …); runner manifest registration is 1 SECTIONS entry either way.

### 5.2 — Q16 design surface (mirror Q15 §4.2)

For each observed Family G raw_key:

1. Verify it ∈ 18-key ai_classifier Subset (`FAMILY_G_RAW_KEYS` from `mcp-server/lib/familyGKeys.ts:99-118`).
2. Flag if any of the 12 deterministic-excluded keys (`FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS` at lines 136-151) appears (expected 0).
3. Document the 18-vs-30 distinction explicitly in the SQL header.

### 5.3 — Q16 SQL shape

```sql
-- OPS-MCP-OBSERVABILITY — Q16: Family G subset coverage.
--
-- ------------------------------------------------------------
-- The 18-vs-30 distinction (binding context)
-- ------------------------------------------------------------
--
-- Family G (resolution_progress) has 30 entries in the upstream Edge
-- taxonomy registry (src/features/nodeLabels/machineObservationDefinitions/familyG.ts):
--   - 18 ai_classifier-source rawKeys (the "Subset")
--   - 12 deterministic rawKeys split across auto_metadata + lifecycle:
--       * auto_metadata (5): branch_suggested, branch_created,
--         point_stalled, point_exhausted, synthesis_candidate
--       * lifecycle (7): narrowed, conceded, confirmed, synthesis_ready,
--         exhausted, branch_recommended, archived_or_resolved
--
-- Per operator Stage 2B decision (MCP-SERVER-008-FAMILY-G), only the 18
-- ai_classifier keys are routed to the MCP server. The 12 deterministic
-- keys are intentionally excluded by the Edge subset filter at
-- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts
-- (MCP_SERVER_SUPPORTED_FAMILY_SOURCES). A future Edge / app-side card
-- will compute the 12 deterministic keys app-side without an Anthropic call.
--
-- Q16 verifies the binding contract holds in the persisted data:
--   1. All observed Family G raw_keys must be ∈ the 18-key ai_classifier Subset.
--   2. If any of the 12 deterministic-key strings appears in result rows,
--      it indicates a leak from somewhere outside the MCP path (which
--      this card does NOT expect to happen — but a non-zero leak count
--      is a security-adjacent finding worth surfacing).
--
-- Disambiguation footnote (from familyGKeys.ts:127-134 upstream Decision 5):
-- there are intentional name-pairs across sources. `narrows_claim`
-- (ai_classifier) ≠ `narrowed` (lifecycle). `concedes_narrow_point`
-- (ai_classifier) ≠ `conceded` (lifecycle). `ready_for_synthesis`
-- (ai_classifier) ≠ `synthesis_ready` (lifecycle) ≠ `synthesis_candidate`
-- (auto_metadata). The MCP subset takes ONLY the ai_classifier member of
-- each pair; this Q16 query asserts the lifecycle / auto_metadata members
-- are absent from the persisted result rows.
--
-- Source-of-truth:
--   - docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §5
--   - docs/designs/MCP-SERVER-008-FAMILY-G.md (Subset path operator decision)
--   - mcp-server/lib/familyGKeys.ts:99-118 (18-key list; FAMILY_G_RAW_KEYS)
--   - mcp-server/lib/familyGKeys.ts:136-151 (deterministic exclusion list;
--     FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS — 12 unique strings)
--
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/16-family-g-subset-coverage.sql
--
-- Doctrine: aggregate counts; no body content; no evidence span;
-- machine-taxonomy raw_key strings only (per cdiscourse-doctrine §10a).
-- Family G concession / synthesis / settlement keys are SCORING REPAIRS
-- per point-standing-economy; positive counts NEVER imply who-lost
-- (per cdiscourse-doctrine §1).
with family_g_observed as (
  select
    res.raw_key,
    r.run_mode,
    count(*) as positive_count,
    count(distinct res.argument_id) as distinct_arguments
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r on r.id = res.run_id
  where res.family = 'resolution_progress'
  group by res.raw_key, r.run_mode
),
classification as (
  select
    raw_key,
    run_mode,
    positive_count,
    distinct_arguments,
    case
      when raw_key in (
        -- 18-key ai_classifier Subset (FAMILY_G_RAW_KEYS at
        -- mcp-server/lib/familyGKeys.ts:99-118). Verbatim, in
        -- declaration order:
        'narrows_claim',
        'concedes_narrow_point',
        'ready_for_synthesis',
        'suggests_side_branch',
        'suggests_diagonal_tangent',
        'accepts_partial_with_caveat',
        'concedes_with_new_dispute',
        'proposes_settlement_terms',
        'accepts_settlement_terms',
        'concedes_broader_point',
        'common_ground_identified',
        'unresolved_point_isolated',
        'synthesis_proposed',
        'move_on_requested',
        'issue_closed_by_participant',
        'decision_criterion_proposed',
        'action_item_proposed',
        'followup_question_proposed'
      ) then 'ai_classifier_subset'
      when raw_key in (
        -- 12 deterministic keys explicitly excluded from the Subset.
        -- A non-zero positive count here is a leak indicator.
        -- FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS at
        -- mcp-server/lib/familyGKeys.ts:136-151.
        -- auto_metadata (5):
        'branch_suggested',
        'branch_created',
        'point_stalled',
        'point_exhausted',
        'synthesis_candidate',
        -- lifecycle (7):
        'narrowed',
        'conceded',
        'confirmed',
        'synthesis_ready',
        'exhausted',
        'branch_recommended',
        'archived_or_resolved'
      ) then 'deterministic_excluded_leak'
      else 'unknown_key_outside_taxonomy'
    end as subset_membership
  from family_g_observed
)
select
  raw_key,
  run_mode,
  positive_count,
  distinct_arguments,
  subset_membership
from classification
order by
  -- Surface leaks first if any (defensive ordering so the operator
  -- sees the most-urgent classification at the top of the section).
  case subset_membership
    when 'deterministic_excluded_leak' then 1
    when 'unknown_key_outside_taxonomy' then 2
    when 'ai_classifier_subset' then 3
    else 4
  end,
  positive_count desc,
  raw_key;
```

### 5.4 — Q15-vs-Q16 byte-equality assertion

Q15 (`scripts/ops/sql/15-family-d-subset-coverage.sql`) is **byte-equal** under this card. Q16 is a new sibling file with the same structural shape but substituting:

| Aspect | Q15 (Family D) | Q16 (Family G) |
| --- | --- | --- |
| Filter | `res.family = 'evidence_source_chain'` | `res.family = 'resolution_progress'` |
| Subset key count | 19 | 18 |
| Subset list source | `familyDKeys.ts:85-105` | `familyGKeys.ts:99-118` |
| Excluded key count (unique strings) | 6 | 12 |
| Excluded list source | `familyDKeys.ts:119-129` | `familyGKeys.ts:136-151` |
| Total upstream taxonomy entries | 27 | 30 |
| 5-column SELECT contract | `raw_key, run_mode, positive_count, distinct_arguments, subset_membership` | same |
| 3 subset_membership values | `ai_classifier_subset, deterministic_excluded_leak, unknown_key_outside_taxonomy` | same |
| Leak-first ORDER BY priority | leak=1, unknown=2, subset=3 | same |

### 5.5 — Live output preview (forecast)

Operator validates post-merge per §17. Expected shape:

| raw_key | run_mode | positive_count | distinct_arguments | subset_membership |
| --- | --- | --- | --- | --- |
| (one row per observed Family G raw_key, e.g.:) | | | | |
| narrows_claim | admin_validation | n | n | ai_classifier_subset |
| concedes_narrow_point | admin_validation | n | n | ai_classifier_subset |
| synthesis_proposed | production | n | n | ai_classifier_subset |
| … | … | … | … | … |

**Zero rows with `subset_membership = 'deterministic_excluded_leak'`** is the healthy state. Any leak row is a security-adjacent finding worthy of operator investigation.

### 5.6 — SECTIONS entry shape (new entry, appended after Q15)

The Q16 SECTIONS entry lands at the **end of the SECTIONS array** (after the existing Q15 entry at `mcp-observability-report-lib.cjs:329-344`). Shape:

```js
{
  id: 'q16-family-g-subset-coverage',
  title: 'Family G 18-key subset coverage',
  question:
    'Q16 — Are all observed Family G raw_keys within the 18-key ai_classifier Subset, with zero deterministic-key leaks?',
  sqlFile: '16-family-g-subset-coverage.sql',
  columns: [
    'raw_key',
    'run_mode',
    'positive_count',
    'distinct_arguments',
    'subset_membership',
  ],
  emptyMessage:
    'No Family G positive results yet. Subset coverage will populate after admin_validation or production runs produce positives.',
},
```

The `emptyMessage` differs from Q15's by mentioning both `admin_validation` and `production` (Family G is production-enabled, unlike D's admin_validation-only state at the time D shipped).

### 5.7 — Doctrine note in the SECTIONS title and question

The title "Family G 18-key subset coverage" avoids any verdict tokens. The question phrase "ai_classifier Subset" is the binding contract name and a machine-taxonomy term per `cdiscourse-doctrine §10a`. No `winner` / `loser` / `concede` / `defeated` / `prevailed` substrings appear in the SECTIONS metadata.

---

## 6. File-change list (binding)

### New files (1)

| Path | Purpose | Size estimate |
| --- | --- | --- |
| `scripts/ops/sql/16-family-g-subset-coverage.sql` | Family G 18-key Subset coverage query (mirror of Q15) | ~135 lines (Q15 is 119; G's Subset list is 1 shorter, Excluded list is 6 longer, header narrative slightly longer for the 18-vs-30 distinction + the disambiguation footnote) |
| `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts` | Card-scoped SQL + manifest safety tests (Groups A-E; 27 net new tests) | ~525 lines (D's test is 609 lines and includes Q11-rename Group A; G has no rename, so Group A is leaner) |

### Modified files (8)

| Path | Modification | Estimated line delta |
| --- | --- | --- |
| `scripts/ops/sql/11-per-family-per-mode-coverage.sql` | Header comment (lines 5-10 → 5-11): add Family G bullet + update "Families E-J" line to "Families E, F, H-J" with status. Source-of-truth citation gains G design ref. | +2 lines (net +1 from the carrier-state expansion + 1 source-of-truth ref) |
| `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` | CASE branch added at line 61: `when 'resolution_progress' then 18`. Header comment table gains 1 row + "others (E-J)" expands to "others (E, F, H-J)". Source-of-truth citation gains G design ref. | +3 lines |
| `scripts/ops/mcp-observability-report-lib.cjs` | Q11 entry's `question` string updated (line 266); Q14 entry's `question` string updated (line 315); new Q16 entry appended (after line 344, before line 345 `]`). | +18 lines (Q16 SECTIONS entry) + 2 lines (Q11+Q14 question rewrite) = +20 lines net |
| `__tests__/fixtures/opsMcpObservabilityFixture.ts` | Add `q16-family-g-subset-coverage` key with 1-2 sample rows; add same key to `FIXTURE_EMPTY_SECTIONS_DATA` with `Object.freeze([])`. Optionally add `resolution_progress` rows to Q11, Q14, Q2b, Q3 etc. fixtures to exercise the new family in cross-section invariants. | +20 to +40 lines |
| `__tests__/opsMcpObservabilityReportShape.test.ts` | Update SECTIONS length pin 16 → 17; add `'q16-family-g-subset-coverage'` to the ordered id list (line 80). | +1 line (length update) + 1 line (id list addition) = +2 lines |
| `__tests__/opsMcpObservabilitySqlSafety.test.ts` | Update file count pin (line 58-59): 16 → 17. | +0 net (1 line modified) |
| `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts` | Update `expect(FILES.length).toBeGreaterThanOrEqual(18)` (line 75) → 19; update `expect(sqlFiles.length).toBe(16)` (line 81) → 17. | +0 net (2 lines modified) |
| `__tests__/opsMcpObservabilityEmptyDbSafety.test.ts` | Test description "all 16 section titles" → "all 17 section titles" (line 50). The `for (const s of SECTIONS)` loop auto-iterates the new section; no logic change. | +0 net (1 line modified) |
| `docs/ops/OPS-MCP-OBSERVABILITY.md` | (a) Line 139: "66 supported raw_keys (Family A=16, B=14, C=17, D=19)" → "84 supported raw_keys (Family A=16, B=14, C=17, D=19, G=18)". (b) Lines 195-200: add Family G bullet to Q11 narrative. (c) Lines 243-247: add Family G row to the Q13 expected-raw_keys list. (d) Lines 264-270: add Family G row to the Q14 family-key-count table. (e) NEW Q16 narrative section after the Q15 section (lines 287-327), mirroring Q15's structure. | +35 to +50 lines (most in the new Q16 section) |
| `docs/core/current-status.md` | Append a Phase framing handoff note for the 5-family observability state (mirroring the D coverage's Stage 6.4 handoff). The Stage 6.x line gains a paragraph mentioning OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE shipped, SECTIONS length 17, new Q16 file. | +3 to +8 lines |

### Deleted files (0)

None.

### Renamed files (0)

None. Unlike the D coverage card (which renamed Q11 from `11-family-bc-admin-validation-check.sql` → `11-per-family-per-mode-coverage.sql`), this card has zero renames — Q11's family-agnostic shape is already in place from the D card.

---

## 7. SECTIONS manifest update (binding)

The Q16 SECTIONS entry is added at the **end of the SECTIONS frozen array**, after the existing Q15 entry. Final ordered id list:

```
q01-runs-by-run-mode
q02-runs-by-family
q02b-runs-by-requested-family
q03-runs-by-family-and-status
q04-failure-reasons-by-family
q05-positive-results-by-family
q06-top-positive-raw-keys-by-family
q07-positive-density-7d
q08-source-six-safety
q09-duplicate-runs
q10-family-a-auto-trigger-recent
q11-per-family-per-mode-coverage
q12-unsupported-family-attempts
q13-over-under-firing-summary
q14-per-family-per-mode-signal-density
q15-family-d-subset-coverage
q16-family-g-subset-coverage          ← NEW
```

SECTIONS array length: **16 → 17**.

The `mcp-observability-report.mjs` entry script iterates SECTIONS and does **not** need any edits.

### 7.1 — Default-output safety scan extension

The default ban-list scan (`scanMarkdownForBannedTokens` at `mcp-observability-report-lib.cjs:446-458`) iterates BANNED_TOKENS over the entire markdown body before Appendix B. Adding one new section does not change the scan path — Q16's rendered content is scanned alongside Q1-Q15. **No code change required to the scan.**

The Q16 SQL file is scanned by `opsMcpObservabilitySqlSafety.test.ts` automatically (it iterates `scripts/ops/sql/*.sql`). The file-count assertion updates from 16 to 17.

### 7.2 — Fixture updates (binding)

`__tests__/fixtures/opsMcpObservabilityFixture.ts` updates:

- **Add key** `q16-family-g-subset-coverage` with sample rows that exercise `ai_classifier_subset` (the only realistic case today; a deterministic_excluded_leak row would be a leak finding). Minimum 1 row; recommend 2 rows mirroring the D fixture pattern:
  ```ts
  'q16-family-g-subset-coverage': Object.freeze([
    Object.freeze({
      raw_key: 'narrows_claim',
      run_mode: 'admin_validation',
      positive_count: 2,
      distinct_arguments: 2,
      subset_membership: 'ai_classifier_subset',
    }),
    Object.freeze({
      raw_key: 'synthesis_proposed',
      run_mode: 'production',
      positive_count: 1,
      distinct_arguments: 1,
      subset_membership: 'ai_classifier_subset',
    }),
  ]),
  ```
- **Add key** to `FIXTURE_EMPTY_SECTIONS_DATA`: `'q16-family-g-subset-coverage': Object.freeze([])`.
- **Optional fixture enrichment**: add `resolution_progress` rows to the existing Q11 fixture (`q11-per-family-per-mode-coverage`) so the `Group D — Cross-section invariants` test can assert Family G presence in Q11 alongside Q16. This is recommended but not strictly required for the test pattern to pass (the existing fixture already exercises Q11 with 4 families).

---

## 8. New Jest test file — `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts`

### 8.1 — Test groups (Groups A-E mirror D §6.1)

**Group A — Q11 narrative regression (4 tests)**

1. `Q11 SQL header references resolution_progress and 18-key Subset` — substring assertion on header comment.
2. `Q11 SQL body is byte-equal (no new SELECT columns, no new filters)` — assert `unnest(requested_families)` substring + assert the 6 columns from the D contract are still present + assert no new column aliases added beyond the D set.
3. `Q11 SECTIONS question text mentions resolution_progress` — load lib, find Q11 by id, assert `s.question.includes('resolution_progress')`.
4. `Q11 SQL still has no verdict tokens after narrative update` — banned-token scan.

**Group B — Q14 CASE regression (3 tests)**

5. `Q14 SQL hardcoded CASE includes the 5 family constants verbatim (A=16, B=14, C=17, D=19, G=18)` — substring assertions: `when 'parent_relation' then 16`, `when 'disagreement_axis' then 14`, `when 'misunderstanding_repair' then 17`, `when 'evidence_source_chain' then 19`, `when 'resolution_progress' then 18`. The `else 0` fallback is preserved.
6. `Q14 SQL header references the 18 family_key_count constant with familyGKeys.ts citation` — header substring assertions for `familyGKeys.ts` + `18`.
7. `Q14 SECTIONS question text reflects the 5-family Subset state` — load lib, find Q14 by id, assert `s.question.includes('five')` OR `s.question.includes('resolution_progress')` (the test uses `five` as the more stable canary).

**Group C — Q16 new file (12 tests, mirror D Group C §6.1)**

8. `Q16 SQL file exists at scripts/ops/sql/16-family-g-subset-coverage.sql` — `fs.existsSync` true.
9. `Q16 SQL header documents the 18-vs-30 distinction explicitly` — header substring assertion: `18` AND `30` AND `ai_classifier` AND `subset` (case-insensitive).
10. `Q16 SQL header cites mcp-server/lib/familyGKeys.ts at lines 99-118 and 136-151` — substring assertions for both line references.
11. `Q16 SQL contains all 18 Subset rawKeys from FAMILY_G_RAW_KEYS verbatim` — single test iterates a const list of the 18 keys (consolidated per D Group C §6.3); failure message names the missing key.
12. `Q16 SQL contains all 12 deterministic-excluded rawKeys from FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS verbatim` — single test iterates a const list of the 12 keys.
13. `Q16 SQL classifies via subset_membership column with the three expected values` — substring assertion that `'ai_classifier_subset'`, `'deterministic_excluded_leak'`, `'unknown_key_outside_taxonomy'` all appear.
14. `Q16 SQL preserves the 5-column report-parser contract` — substring/regex assertions for `raw_key`, `run_mode`, `positive_count`, `distinct_arguments`, `subset_membership` in the final SELECT.
15. `Q16 SQL filters on family = 'resolution_progress'` — substring assertion: `/where\s+res\.family\s*=\s*'resolution_progress'/i`.
16. `Q16 SQL has no verdict tokens (case-insensitive)` — banned-token scan including the G-specific verdict-adjacent tokens (`defeated`, `prevailed`, `capitulated`, `ahead`, `behind`, `settled in favor` — the doctrine notes from `familyGKeys.ts:69-74` are commentary; the SQL itself MUST NOT carry them outside `--` comments).
17. `Q16 ordering prioritizes deterministic_excluded_leak first` — substring assertion: `case subset_membership … when 'deterministic_excluded_leak' then 1 … when 'unknown_key_outside_taxonomy' then 2 … when 'ai_classifier_subset' then 3`.
18. `lib SECTIONS contains q16-family-g-subset-coverage with the 5 expected columns` — load lib, find Q16 by id, assert columns array equals the binding 5-column shape and sqlFile is `16-family-g-subset-coverage.sql`.
19. `Q16 SQL contains a doctrine note that Family G concession / synthesis / settlement keys are SCORING REPAIRS, not verdicts` — header substring assertion: `SCORING REPAIR` (uppercase, matching `point-standing-economy` framing) AND `cdiscourse-doctrine §1`.

**Group D — Cross-section invariants (4 tests)**

20. `SECTIONS length is now 17 (was 16 pre-card)` — `expect(lib.SECTIONS.length).toBe(17)`.
21. `SECTIONS section ids are stable, unique, and ordered (q01..q16 with q02b)` — assert the ordered id list matches the 17-entry sequence (q01..q15 unchanged, q16 appended).
22. `Q11 + Q14 + Q16 SQL headers each reference Family G operational state by name` — for each of `[Q11_PATH, Q14_PATH, Q16_PATH]`, assert the file contains `resolution_progress`.
23. `Q16 column names do not collide with Q11/Q14/Q15 column names in a confusing way` — `subset_membership` is unique to Q15+Q16; `family_key_count` belongs only to Q14; `positives_per_run_key_cell` belongs only to Q14. Assert Q16 column set is exactly the Q15 5-column set (raw_key, run_mode, positive_count, distinct_arguments, subset_membership) — i.e., Q16 mirrors Q15 perfectly column-wise.

**Group E — Fixture compatibility (5 tests, mirror D Group E)**

24. `fixture has q16-family-g-subset-coverage key with at least 1 row` — assert via Object.prototype.hasOwnProperty.
25. `fixture empty-sections data has the q16 key with empty array` — assert via Object.prototype.hasOwnProperty + `expect(rows.length).toBe(0)`.
26. `fixture q15-family-d-subset-coverage key is byte-equal (no regression in D's fixture)` — assert the Q15 fixture rows are unchanged from pre-card. Read post-card and pre-card values via git-diff comparison? Simpler: assert the existing 2 rows (`evidence_gap_present` + `opens_evidence_debt_marker`) are still present and `subset_membership === 'ai_classifier_subset'`.
27. `runner stitcher consumes the new fixture cleanly (no NaN / undefined; Q16 section renders title + rows)` — stitch the fixture; assert `md.includes('## Family G 18-key subset coverage')`; assert no `\bNaN\b`; assert no `undefined`.

**Optional Group F — Doctrine self-check (1 test, not counted in core 27)**

28. `Q16 SQL does NOT contain any of the G verdict-adjacency banned phrases (won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor") in executable SQL` — stripped-of-comments banned-phrase scan, with the G-specific extended phrase set from `familyGKeys.ts:69-74`.

Total: **27 core + 1 optional = 28 tests in the new file** (within the +30 to +44 band when combined with the +3 to +17 from existing-file modifications).

### 8.2 — Test pattern source-of-truth

Pattern modeled directly on `__tests__/opsMcpObservabilityFamilyDCoverage.test.ts`. Pure Jest; no live DB; `fs.readFileSync`; regex / substring assertions; helper `stripSqlComments` carried forward. The implementer copies the D test file as a starting skeleton and substitutes Family D → Family G plus the SECTIONS length and ordering updates.

### 8.3 — Run gates (per intent brief §8)

```bash
npm run typecheck
npm run lint
npx jest --testPathPattern="(opsMcp|opsMcpObservability|opsMcpObservabilityFamilyGCoverage)" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read   # Regression sanity (byte-equal expected)
```

The Deno test regression check must remain `614 passed | 0 failed` (or whatever the post-H Card-1 baseline is at `3097521`) — no `mcp-server/*` file is modified by this card.

---

## 9. Runbook updates — `docs/ops/OPS-MCP-OBSERVABILITY.md`

The 4 lockstep edits identified by GOBS-4:

### 9.1 — Line 139: total supported raw_keys

```
BEFORE:
raw_keys (Family A=16, B=14, C=17, D=19).

AFTER:
raw_keys (Family A=16, B=14, C=17, D=19, G=18).
```

The total computes to 84 supported raw_keys, but rewriting the totaling phrase is optional (the line currently says "the 66 supported raw_keys" implicitly; the implementer updates the count appropriately). **Caveat**: if Family E (16 keys) and F (14 keys) were intended to be counted but E/F observability hasn't shipped, the total under D's scope is 66; under G's scope (G added), the total becomes 84 — the E/F gap remains in the totals until their backfill cards land. This is the deliberate carry-forward gap (§1 D1, §13, §15).

### 9.2 — Lines 195-200: Q11 narrative bullet for Family G

```
BEFORE (lines 195-200):
- Family A (`parent_relation`): production + auto-trigger + admin_validation
- Family B (`disagreement_axis`): production + admin_validation
- Family C (`misunderstanding_repair`): production + admin_validation
- Family D (`evidence_source_chain`): admin_validation only (19-key
  ai_classifier Subset)
- Families E-J: unsupported (failed attempts surface as zero-positive runs)

AFTER:
- Family A (`parent_relation`): production + auto-trigger + admin_validation
- Family B (`disagreement_axis`): production + admin_validation
- Family C (`misunderstanding_repair`): production + admin_validation
- Family D (`evidence_source_chain`): admin_validation only (19-key
  ai_classifier Subset)
- Family G (`resolution_progress`): production + admin_validation (18-key
  ai_classifier Subset)
- Families E, F, H-J: see operator notes (E, F production-enabled;
  H Card-1 admin_validation; I, J unsupported)
```

### 9.3 — Lines 243-247: Q13 expected raw_keys list

```
BEFORE:
- Family A (parent_relation): 16 keys
- Family B (disagreement_axis): 14 keys
- Family C (misunderstanding_repair): 17 keys
- Family D (evidence_source_chain): 19 keys (Subset; 8 deterministic
  excluded)

AFTER:
- Family A (parent_relation): 16 keys
- Family B (disagreement_axis): 14 keys
- Family C (misunderstanding_repair): 17 keys
- Family D (evidence_source_chain): 19 keys (Subset; 8 deterministic
  excluded)
- Family G (resolution_progress): 18 keys (Subset; 12 deterministic
  excluded)
```

### 9.4 — Lines 264-270: Q14 family-key-count table

```
BEFORE:
| Family | Key count | Source file (citation) |
| --- | --- | --- |
| parent_relation | 16 | mcp-server/lib/familyAKeys.ts:49 |
| disagreement_axis | 14 | mcp-server/lib/familyBKeys.ts:53 |
| misunderstanding_repair | 17 | mcp-server/lib/familyCKeys.ts:61 |
| evidence_source_chain | 19 | mcp-server/lib/familyDKeys.ts:85 (Subset; 8 deterministic excluded) |
| others (E-J) | 0 | no MCP-supported keys |

AFTER:
| Family | Key count | Source file (citation) |
| --- | --- | --- |
| parent_relation | 16 | mcp-server/lib/familyAKeys.ts:49 |
| disagreement_axis | 14 | mcp-server/lib/familyBKeys.ts:53 |
| misunderstanding_repair | 17 | mcp-server/lib/familyCKeys.ts:61 |
| evidence_source_chain | 19 | mcp-server/lib/familyDKeys.ts:85 (Subset; 8 deterministic excluded) |
| resolution_progress | 18 | mcp-server/lib/familyGKeys.ts:99 (Subset; 12 deterministic excluded) |
| others (E, F, H-J) | 0 | not yet backfilled (E/F observability cards queued; H Card 1 landed 2026-05-30) |
```

### 9.5 — NEW Q16 narrative section (after the Q15 section at line 327)

Mirror Q15's structure (the "19-vs-27 distinction" doc block at lines 287-327), substituting Family G content:

```markdown
### Q16 — Family G 18-key subset coverage

Added by OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE (sibling card to D-COVERAGE).
Family-G-scoped query that verifies the Stage-2B Subset-path contract
holds in the persisted data for `resolution_progress`.

**The 18-vs-30 distinction (binding context):**

Family G (`resolution_progress`) has 30 entries in the upstream Edge
taxonomy registry (`src/features/nodeLabels/machineObservationDefinitions/familyG.ts`):

- **18 ai_classifier-source rawKeys** (the "Subset") — routed to the
  MCP server per the Stage 2B operator decision.
- **12 deterministic rawKeys** split across `auto_metadata` (5) and
  `lifecycle` (7) — intentionally excluded from the MCP path. A future
  Edge/app-side card will compute these app-side without an Anthropic
  call.

Source-of-truth files:
- 18-key list: `mcp-server/lib/familyGKeys.ts:99-118` (`FAMILY_G_RAW_KEYS`)
- excluded list: `mcp-server/lib/familyGKeys.ts:136-151`
  (`FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS`)

**Disambiguation footnote**: Family G has intentional name-pairs across
sources. `narrows_claim` (ai_classifier, move-intrinsic) is distinct
from `narrowed` (lifecycle, cluster state). `concedes_narrow_point`
(ai_classifier) is distinct from `conceded` (lifecycle).
`ready_for_synthesis` (ai_classifier, move) is distinct from
`synthesis_ready` (lifecycle, cluster) which is distinct from
`synthesis_candidate` (auto_metadata). The MCP subset takes ONLY the
ai_classifier member of each pair.

**`subset_membership` values:** (same 3 values as Q15)

| Value | Meaning |
| --- | --- |
| `ai_classifier_subset` | The observed raw_key is in the 18-key Subset — expected and healthy. |
| `deterministic_excluded_leak` | The observed raw_key is one of the 12 deterministic-excluded strings — would indicate a leak from somewhere outside the MCP path. Expected count: 0. |
| `unknown_key_outside_taxonomy` | The observed raw_key is neither in the Subset nor in the excluded list — would indicate a registry-vs-DB inconsistency or a stale row. |

**ORDER BY** prioritizes `deterministic_excluded_leak` first so any
security-adjacent finding lands at the top of the section.

**Healthy state:** all rows have `subset_membership =
'ai_classifier_subset'`; zero `deterministic_excluded_leak` rows; zero
`unknown_key_outside_taxonomy` rows.

**Doctrine note (Family G specific):** Family G's concession / synthesis /
settlement keys (`concedes_broader_point`, `concedes_narrow_point`,
`accepts_settlement_terms`, `synthesis_proposed`, etc.) are SCORING
REPAIRS per `point-standing-economy`, NEVER defeats. A high positive
count for `concedes_broader_point` is a structural observation of
relinquishment, NOT a verdict that one side lost. The report's section
title and ORDER BY logic carry no verdict overlay; the operator
interprets per `cdiscourse-doctrine §1`.
```

---

## 10. HALT trigger table — all 16 evaluated (mirror D §9)

The 16 HALT triggers below are inherited from the D coverage card's §9. Each is re-evaluated under the Family G context.

### Scope (1-7)

| # | HALT trigger | Status (G context) |
| --- | --- | --- |
| 1 | Any runtime code change | **NOT TRIGGERED** — only SQL files + runner manifest + tests + docs; `mcp-server/**`, `supabase/functions/**`, `src/**` untouched. |
| 2 | Any registry change | **NOT TRIGGERED** — `familyRegistry.ts` on both Edge and MCP sides is read-only reference. |
| 3 | Any production-mode flip | **NOT TRIGGERED** — Family G was production-flipped by `MCP-021C-EDGE-FAMILY-G-ENABLE` on 2026-05-29. This card is the observability backfill, not a state flip. |
| 4 | New taxonomy keys | **NOT TRIGGERED** — Q16 references the existing 18-key Subset and 12 deterministic strings; no new keys; no upstream taxonomy file change. |
| 5 | Schema migration | **NOT TRIGGERED** — no migration file added; no `supabase/migrations/**` change. |
| 6 | Source 6 filter change | **NOT TRIGGERED** — `machineObservationPersistenceQuery.ts` is in the locked boundary list (§11). |
| 7 | New family registration | **NOT TRIGGERED** — no registry edit. |

### Correctness (8-12)

| # | HALT trigger | Status (G context) |
| --- | --- | --- |
| 8 | New per-family-per-mode query mislabels a family's mode | **NOT TRIGGERED** — Q11 + Q14 use `r.run_mode` directly from the runs table; no derived mode. Family G surfaces in both `production` and `admin_validation` rows via `unnest(requested_families)`. |
| 9 | Family G coverage query conflates 30 taxonomy entries with 18 MCP-routed keys | **NOT TRIGGERED** — Q16 header explicitly documents the 18-vs-30 distinction (§5.3 SQL header); the SQL classifies into `ai_classifier_subset` (18) vs `deterministic_excluded_leak` (12 of the 12; all 12 are unique strings unlike D's 8→6 dedupe) vs `unknown_key_outside_taxonomy`. |
| 10 | Q11 narrative drops any prior family's visibility | **NOT TRIGGERED** — §3.2 patch preserves Family A/B/C/D bullets unchanged; only adds a G bullet and reframes the "E-J unsupported" line to reflect post-G state. The Q11 SQL body is byte-equal so all existing rows continue to surface. |
| 11 | supported_families derivation breaks under 5-family state | **NOT TRIGGERED** — Q12's `supported_families` CTE is data-derived (per the Q12 SEMANTIC TIGHTENING fix); Family G's first real-provider rows from the production-enable smoke automatically migrated `resolution_progress` from `unsupported_families` to `supported_families`. Carry-forward from the D card's §5 prediction. Q12 is byte-equal under this card. |
| 12 | Report runner fails to execute any query | **NOT TRIGGERED** — Q16's SQL shape mirrors Q15 (already verified live by the D card). The CASE-branch addition to Q14 is a minimal additive edit; the existing A/B/C/D branches remain. Operator validates with `npx supabase db query --linked --file scripts/ops/sql/16-family-g-subset-coverage.sql` in the post-merge smoke (§17). |

### Doctrine (13-14)

| # | HALT trigger | Status (G context) |
| --- | --- | --- |
| 13 | Report default output exposes evidence_span content, raw bodies, secrets, or tokens | **NOT TRIGGERED** — Q16 selects only `raw_key`, `run_mode`, aggregate `count(*)`, `count(distinct argument_id)`, `subset_membership` (a CASE-derived string). No `evidence_span`; no `arguments.body`. The SQL safety test catches this if regressed. |
| 14 | Verdict tokens in SQL comments or report labels (except negation) | **NOT TRIGGERED** — section title "Family G 18-key subset coverage"; question text uses "subset", "coverage", "Subset" — no winner/loser/correct/dishonest. Q16's header narrative includes a doctrine note that explicitly forbids verdict framing for Family G's concession/synthesis/settlement keys. The G-specific extended ban list (won/lost/defeated/prevailed/capitulated/ahead/behind/"settled in favor") is enforced by Group C test #16 + optional Group F test #28. |

### Working tree (15-16)

| # | HALT trigger | Status (G context) |
| --- | --- | --- |
| 15 | Test forecast exceeds +60 (chain-prompt cap) | **NOT TRIGGERED** — forecast +30 to +44; below +60. Within +20 to +50 intent-brief band. |
| 16 | Unclassified untracked files at PR creation | **NOT TRIGGERED at design time** — the working tree's untracked files (per `git status` at design authoring) are all operator-territory (`.tmp/`, `out/`, `mcp021c-edge-smoke-*`, `phase5-*.log`, `scripts/arch-001-card2-sql/`, etc.); none are introduced by this card. The implementer adds only the new SQL + test files explicitly. |

**Zero HALT triggers fire at design time.**

---

## 11. Test forecast (BINDING)

| Bucket | Count |
| --- | --- |
| New file `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts` (Group A: 4 + Group B: 3 + Group C: 12 + Group D: 4 + Group E: 5) | 28 |
| Optional Group F doctrine self-check (G verdict-adjacency ban) | +1 (recommended; counted) |
| Modifications to existing test files (counted conservatively per §6) | +3 to +17 |
| **BINDING forecast total** | **+30 to +44** |

**Within the +20 to +50 intent-brief band.** Below the +60 HALT 8 ceiling per chain-prompt §HALT 7. Mirrors the D shipped delta (+30 to +44).

If the implementer wants to land closer to +30 (tighter), they MAY omit the optional Group F doctrine self-check (Group C test #16 already covers the base banned-token scan; Group F adds G-specific extended bans). If they want to land at +44 (looser), they MAY add the optional multi-family enrichment tests (Group D additions exercising Q14 density for `resolution_progress` rows in the fixture).

---

## 12. Read-only boundary list (locked files)

The implementer MUST NOT touch:

- `src/features/nodeLabels/**` — taxonomy + Source 6 query module.
- `src/features/nodeLabels/machineObservationPersistenceQuery.ts` — Source 6 binding.
- `mcp-server/lib/family*.ts` — classifier sources (A/B/C/D/E/F/G/H key files); the design **reads** `familyGKeys.ts` as the source of truth for the 18-key constant + 12 deterministic-excluded list but does not modify it.
- `mcp-server/lib/familyRegistry*.ts` — registry.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — dispatcher.
- `supabase/functions/_shared/booleanObservations/**` — Edge gate. The design **reads** `booleanObservationRequestBuilder.ts` as the source of truth for `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`, does not modify it.
- `supabase/functions/classify-argument-boolean-observations/**` — Edge Function source.
- `supabase/migrations/**` — no new migration; no edits.
- `scripts/ops/sql/01-*.sql` through `scripts/ops/sql/10-*.sql`, `scripts/ops/sql/12-*.sql`, `scripts/ops/sql/13-*.sql`, `scripts/ops/sql/15-*.sql` — preserve byte-equal.
- Q11 SQL SELECT BODY (lines 31-46 of `11-per-family-per-mode-coverage.sql`) — only the header comment narrative (lines 5-10) and source-of-truth citation may be edited; the executable SQL is byte-equal.
- Q14 SQL outside the CASE expression — only the header narrative (lines 11-15) and the CASE expression (lines 56-62) may be edited; the CTEs and final SELECT are byte-equal.
- All `__tests__/mcpOneTwoOneB*.test.ts`, `__tests__/mcpOneTwoOneC*.test.ts`, `__tests__/uxOneOneFiveA*.test.ts`, `__tests__/mcpFamilyD*.test.ts`, `__tests__/mcpFamilyG*.test.ts` files — preserve byte-equal.
- The Family D coverage test (`__tests__/opsMcpObservabilityFamilyDCoverage.test.ts`) — preserve byte-equal. Q15 fixture data preserved (Group E test #26 asserts this).
- The 10+ operator-territory untracked files in working tree (`.tmp/`, `out/`, `mcp021c-edge-smoke-*`, `phase5-*.log`, etc.) — implementer does not touch.

The implementer MAY:

- Create `scripts/ops/sql/16-family-g-subset-coverage.sql` (new file, design §5).
- Edit `scripts/ops/sql/11-per-family-per-mode-coverage.sql` — header comment narrative + source-of-truth citation only (design §3).
- Edit `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` — header narrative + CASE expression only (design §4).
- Edit `scripts/ops/mcp-observability-report-lib.cjs` — SECTIONS const only (Q11 question rewrite + Q14 question rewrite + new Q16 entry; design §7).
- Create `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts` (new test file, design §8).
- Edit `__tests__/fixtures/opsMcpObservabilityFixture.ts` — add Q16 key + add Q16 empty-fixture key + optionally add `resolution_progress` rows to existing Q11/Q14/Q2b fixtures (design §7.2).
- Edit `__tests__/opsMcpObservabilityReportShape.test.ts` — update SECTIONS length pin + ordered id list (design §6).
- Edit `__tests__/opsMcpObservabilitySqlSafety.test.ts` — update file-count pin from 16 to 17 (design §6).
- Edit `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts` — update file-count pins (≥18→≥19; ===16→===17) (design §6).
- Edit `__tests__/opsMcpObservabilityEmptyDbSafety.test.ts` — update test description from "16" to "17" (the for-loop auto-iterates new section).
- Edit `docs/ops/OPS-MCP-OBSERVABILITY.md` — 4 lockstep narrative edits + new Q16 narrative section (design §9).
- Edit `docs/core/current-status.md` — 5-family observability handoff note (design §6).

The implementer MUST NOT:

- Add new SQL files outside `scripts/ops/sql/16-*.sql`.
- Modify `package.json` (no new dependencies).
- Run `npx supabase db query` from the unit test suite (only the post-merge smoke audit does).
- Add any runtime code change (`mcp-server/*`, `supabase/functions/*`, `src/*`).
- Modify the original observability design `docs/designs/OPS-MCP-OBSERVABILITY.md` (this card has its own design doc).
- Modify the D coverage design `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md` (preserved as the predecessor anchor).

---

## 13. Carry-forward invariants (preserved; cited in HALT table)

Per the chain prompt's "CARRY-FORWARD INVARIANTS" section, the following must be preserved:

| Invariant | Verification mechanism | Where verified in this design |
| --- | --- | --- |
| `scripts/ops/sql/` recursive count + header ownership invariant | `__tests__/opsMcpObservabilitySqlSafety.test.ts` (file count pin) + `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts` (recursive count + ownership) | §6 file-change list, §10 HALT table, §11 test forecast |
| A-F SQL files byte-equal; only Q11 narrative + Q14 CASE + new Q16 change | §12 read-only boundary list | §12 explicit byte-equal assertion; Group A test #2 |
| `mcp-server/lib/familyG*.ts` byte-equal (read-only reference) | §12 read-only boundary list | §2.3 (read-only); §5.3 (cited as source-of-truth) |
| `supabase/functions/**` byte-equal | §12 read-only boundary list | §1 D5 (no Edge change); §10 HALT #1 + #6 |
| `supabase/migrations/**` no change | §12 read-only boundary list | §1 D5 (no migration); §10 HALT #5 |
| `package.json` byte-equal | §12 read-only boundary list | §1 D5 (no new dep); §17 operator steps (none) |
| Family D Q15 byte-equal (G's subset-coverage is a new Q16, not a modification) | §5.4 Q15-vs-Q16 byte-equality assertion + Group E test #26 (fixture Q15 preserved) | §5.4 + §6 + §11 |

### 13.1 — Inherited known gap (E and F observability not yet shipped)

The current Q14 CASE expression after G's addition (`A=16, B=14, C=17, D=19, G=18`) **does NOT** include E (16 keys) or F (14 keys). Family E and F are production-enabled but their backfill cards (`OPS-MCP-OBSERVABILITY-FAMILY-E-COVERAGE` and `…-F-COVERAGE`) have intent briefs only. Until those ship, Family E and F density values continue to render as `null` (the `else 0` fallback inside `nullif`).

**This is NOT a regression.** Pre-card, E and F density was also `null` (E/F absent from the CASE). Post-card, E and F density is still `null`. The gap is preserved as-is per the intent brief's strict scope (OUT: NO Family A-F change).

**This is NOT a doctrine violation.** Rendering `null` for E/F density is a faithful absence-of-data signal per `cdiscourse-doctrine §1` — the observability acknowledges what it does not yet measure rather than fabricating a value.

The follow-up trail: when the E observability card ships (likely picking Q17 slot), it adds `when 'argument_scheme' then 16` to Q14's CASE. When F's card ships (Q18 slot), it adds `when 'critical_question' then 14`. The gap closes incrementally.

### 13.2 — H Card-1 admin_validation classifier (landed 2026-05-30, 1 day before this card)

Family H (`claim_clarity`) Card-1 (admin_validation classifier) landed yesterday (commit `3097521`, PR #400 — the current HEAD). Card 2 (production enable) and Card 3 (Edge enable smoke) are queued. Family H's 12-key Subset (per `familyHKeys.ts` count) is NOT added to Q14 under this card — H is admin_validation-only and its observability card has only an intent brief (`OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE-intent.md`).

The Q11 narrative update in §3.2 mentions "H Card-1 admin_validation" so an operator reading the SQL knows H exists but is not yet a Q14 first-class family. The narrative is descriptive, NOT prescriptive — it does not imply H's observability is coming under this card.

---

## 14. Doctrine self-check (binding)

Each relevant doctrine skill is asserted against the design:

**`cdiscourse-doctrine §1` (no truth labels):**
- Q16 SECTIONS title "Family G 18-key subset coverage" — no verdict.
- Q11 + Q14 SECTIONS questions reframe "all four families" → "five families" — descriptive, not verdict.
- Family G's concession / synthesis / settlement keys are explicitly framed as SCORING REPAIRS in the Q16 SQL header doctrine note (§5.3) and the runbook §9.5 Q16 narrative. **No** "winner / loser / defeated / prevailed / capitulated / ahead / behind / settled in favor" tokens appear in any SQL, manifest, fixture, or test string under this card. (G-specific extended ban list enforced by Group C test #16 + optional Group F test #28.)

**`cdiscourse-doctrine §3` (no popularity surfacing):**
- Q14 density formula remains `positives / (runs × family_key_count)` — a structural ratio, not a popularity rank.
- Q16 produces no ranking; rows ORDER BY classification severity (leak-first), not popularity.

**`cdiscourse-doctrine §6` (no secrets):**
- Only `npx supabase db query --linked` data path; no Authorization, no Bearer, no `SERVICE_ROLE`, no `ANTHROPIC_API_KEY`. Inherited from D coverage's verified pattern. Enforced by `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts`.

**`cdiscourse-doctrine §9` (operator-facing telemetry, not user UI):**
- This is an ops-tooling card; `gameCopy.toPlainLanguage` does not apply.

**`cdiscourse-doctrine §10a` (machine taxonomy ≠ verdict):**
- `narrows_claim`, `concedes_broader_point`, `synthesis_proposed` appear verbatim in the Q16 SQL as data values + verbatim in test assertions + verbatim in the runbook Q16 narrative. They are NEVER labels applied to a user.

**`point-standing-economy`:**
- Family G's concession / synthesis / settlement positives are SCORING REPAIRS per `point-standing-economy`. Q16's SQL header doctrine note (§5.3) and the runbook §9.5 narrative explicitly state this. No standing delta is computed in observability; that's the production app's territory.

**`supabase-edge-contract`:**
- No migration, no Edge Function change, no RLS change, no service-role usage. §1 D5 + §10 HALT #1/#2/#5/#6/#7.

**`evidence-doctrine`:**
- Evidence-span content remains suppressed by default; Q16 does not select `evidence_span`. The Q16 SQL does not add any flag related to evidence; Family G is distinct from Family D's evidence-source-chain semantics.

**`test-discipline`:**
- 28 new tests in the dedicated test file plus ~3-17 modifications to existing test files; total within +30 to +44 binding band. Tests are pure Jest, no live DB, no environment dependency, deterministic. Pattern mirrors the D coverage shipped pattern.

**`accessibility-targets`, `expo-rn-patterns`, `timeline-grammar`:**
- N/A — this is an ops-tooling card with no UI surface.

**`transcript-lang-min`:**
- N/A — no transcript surfaces.

---

## 15. Risks

The risks the implementer should be aware of:

### R1 — Fixture richness vs cross-section invariant tests

Group D test #22 asserts Q11, Q14, Q16 SQL headers each reference `resolution_progress`. Q11's body is byte-equal; the header narrative gains the G bullet. Q14's body gets the CASE branch; the header gets the table row. Q16 is filtered on `where res.family = 'resolution_progress'` so the literal appears in executable SQL. All 3 assertions pass without fixture changes.

If the implementer adds the optional cross-section fixture enrichment (Q11 fixture gains `resolution_progress` rows; Q14 fixture gains `resolution_progress` rows), the test count rises by 1-3 extra rows-iterating tests. **Recommended but not required.**

### R2 — Q14 CASE branch ordering convention

The D coverage shipped Q14 with families ordered A → B → C → D (i.e., family-letter order). This card preserves that convention and appends G at the end. If a future card adds E or F (alphabetic letter position before G but later card-ship order), the implementer of that card must decide whether to re-order CASE alphabetically (letter-order) or keep the chronological (card-ship) ordering. **This card recommends keeping chronological card-ship ordering** to preserve git blame chain and avoid byte-level churn for unrelated families' code review.

### R3 — Family G verdict-adjacency banned-phrase scan

Family G's domain (concession / synthesis / settlement) carries the highest verdict-adjacency risk in the taxonomy per `familyGKeys.ts:69-79` (the AUDIT-MCP-020 doctrine anchor). The Q16 SQL header doctrine note + the runbook §9.5 narrative both forbid framing G positives as "this side lost". The Group C test #16 + optional Group F test #28 scan the SQL for the extended G-specific ban list. **Implementer must NOT carry doctrine-quoted forbidden phrases (e.g., "settled in favor", "you win", "capitulated") into Q16's executable SQL** — only the `-- comment` regions may quote them as doctrine notes (where the comment-stripper in the safety test allows commentary).

### R4 — Existing test-file modifications and the consolidation discipline

The implementer modifies 4 existing test files (`opsMcpObservabilityReportShape`, `opsMcpObservabilitySqlSafety`, `opsMcpObservabilityNoServiceRoleNoSecrets`, `opsMcpObservabilityEmptyDbSafety`). Each modification is a number-pin update (16 → 17 or 18 → 19). The implementer must NOT regress the existing test assertions beyond the pin updates. The Group D test #20 (`SECTIONS length is now 17`) and Group D test #21 (ordered id list) are the primary consistency anchors.

### R5 — Runbook narrative voice

Q16's runbook narrative (§9.5) uses the same voice/structure as Q15's narrative. The implementer must NOT introduce new doctrine framing in the runbook beyond what's in `cdiscourse-doctrine §1` + `point-standing-economy` for Family G. Specifically: do NOT add subjective adjectives like "important", "noteworthy", "concerning" — keep the doctrine notes structural and observational.

### R6 — Source-of-truth citation hygiene

The Q11 + Q14 SQL footer citations gain a second design ref (`OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §3` and `§4`). The implementer must NOT remove the existing D coverage citation — both designs are valid sources-of-truth in their respective scopes (D for the original reframe; G for the narrative + CASE addition).

### R7 — current-status.md handoff voice

The D coverage's current-status handoff (Stage 6.4 line in CLAUDE.md) does not currently mention OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE explicitly. The implementer of this card may either: (a) append a Stage 6.4 handoff note that mentions both D-COVERAGE and G-COVERAGE as the multi-family observability backfill chain, or (b) keep the handoff focused on G alone. **Recommendation:** (b) — mention G's 17-section SECTIONS state, the new Q16 file, and reference D-COVERAGE as the predecessor pattern without re-litigating its scope. The handoff voice should be terse (3-8 lines per §6 estimate).

---

## 16. Out of scope (explicit non-scope list)

This card does NOT include:

1. **Family E observability backfill** — separate card (`OPS-MCP-OBSERVABILITY-FAMILY-E-COVERAGE`, intent brief at `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-E-COVERAGE-intent.md`). E remains absent from Q14's CASE under this card.
2. **Family F observability backfill** — separate card (`OPS-MCP-OBSERVABILITY-FAMILY-F-COVERAGE`, intent brief queued). F remains absent from Q14's CASE under this card.
3. **Family H observability backfill** — separate card (`OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE`, intent brief at `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE-intent.md`). H is admin_validation-only as of this card.
4. **Family G production-mode flip** — already done via `MCP-021C-EDGE-FAMILY-G-ENABLE` on 2026-05-29.
5. **MCP server runtime changes** — `mcp-server/**` is byte-equal.
6. **Edge Function changes** — `supabase/functions/**` is byte-equal.
7. **Migration files** — `supabase/migrations/**` is byte-equal.
8. **`package.json` changes** — no new dependencies.
9. **Q15 modifications** — Q15's Family D subset coverage is byte-equal; Group E test #26 asserts this.
10. **Q12 modifications** — Q12's data-derived `supported_families` CTE handles G's migration automatically (per §10 HALT #11); no SQL change.
11. **Q13 modifications** — Q13's over/under-firing summary is family-agnostic (groups by `family`); G's rows surface automatically; the runbook §9.3 narrative gains a G bullet but the Q13 SQL is byte-equal.
12. **App-side UI surfaces** — observability is operator-facing telemetry only.
13. **CI/CD pipeline changes** — no workflow file changes.
14. **Audit-lint v1 marker** — the audit-lint v1 marker is only required for smoke-audit cards (per the chain prompt's "audit-lint v1 marker NOT required (this is ops-tooling not smoke audit)" guidance). This card does NOT add or modify the marker.

---

## 17. Operator steps

**None required after implementer commits.** This card adds:

- 1 new SQL file (`scripts/ops/sql/16-family-g-subset-coverage.sql`)
- 1 new test file (`__tests__/opsMcpObservabilityFamilyGCoverage.test.ts`)
- Edits to: `scripts/ops/sql/11-per-family-per-mode-coverage.sql` (header narrative only), `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` (header + CASE branch), `scripts/ops/mcp-observability-report-lib.cjs` (SECTIONS), `__tests__/fixtures/opsMcpObservabilityFixture.ts`, 4 existing observability test files (count pins), `docs/ops/OPS-MCP-OBSERVABILITY.md`, `docs/core/current-status.md`.

No migration. No Edge Function deploy. No environment variable. No npm dependency. No supabase config change. No runtime code change.

### 17.1 — Optional operator action POST-merge for smoke audit

Per the chain prompt's "Post-merge smoke posture" requirement:

```bash
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/g-coverage-smoke
```

Then inspect `/tmp/g-coverage-smoke/report.md` (and any `*.json` JSON artifact):

- Q11 section narrative reflects the 5-family carry-forward state.
- Q14 section shows `resolution_progress` rows with `family_key_count = 18` and `positives_per_run_key_cell` computed (not null).
- Q16 section present; Family G observed raw_keys all `ai_classifier_subset`; no `deterministic_excluded_leak` rows.
- Q12 still returns 0 rows (Family G not flagged as unsupported).
- Default output safety preserved (no evidence_span / secrets / verdict tokens via grep scan).

**Audit-lint v1 marker NOT required** — this is ops-tooling, not a smoke-audit card.

If the operator chooses to file an audit doc, it lives at `docs/audits/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE-SMOKE-<date>.md` (mirror D's audit pattern).

---

## 18. Brief ledger (POSTRUN-UX001 protocol)

This design is orchestrator-authored based on:

| Section | Source | Note |
| --- | --- | --- |
| Header + §0 Overview | Intent brief §1 + GOBS-1..GOBS-5 evidence chain + D precedent §0 | Orchestrator synthesized the "5-family carry-forward state" framing from D's "4-family state" framing. |
| §1 D1-D5 binding decisions | Resolve intent brief's 3 `[OPERATOR DECISION NEEDED]` markers + 2 implicit carry-forward decisions | D1 resolved via GOBS-4 finding (Q11 family-agnostic, Q14 hardcoded CASE) + Q16 placement choice. D2 resolved via D precedent pattern. D3 resolved by binding to D shipped delta. D4 + D5 carry-forward. |
| §2 Phase A reality | GOBS-3, GOBS-4, GOBS-5 evidence outputs | The chain prompt's Workflow `wf_f0585507-724` outputs are the source of truth for current file state. |
| §3 Q11 narrative patch | Operator intent brief §2 IN-scope marker + GOBS-4 finding (Q11 family-agnostic) | Header-comment-only patch; SQL body byte-equal. |
| §4 Q14 CASE patch | Operator intent brief §2 IN-scope marker + GOBS-4 finding (Q14 hardcoded CASE) + GOBS-5 finding (18 keys) | Single-line CASE branch addition + header table row. |
| §5 Q16 new file | D precedent §4 mirror + GOBS-5 finding (18 Subset keys + 12 deterministic-excluded) | Direct mirror of Q15 with Family G content substituted. |
| §6 File-change list | D precedent §6 + §7 mirror + GOBS-3 finding (ownership tests) | All 10 modified files enumerated with estimated line deltas. |
| §7 SECTIONS manifest | Orchestrator design + D precedent §7 mirror | Q16 entry appended; Q11+Q14 question strings updated. |
| §8 Test plan | D precedent §6 mirror + GOBS-5 finding (verbatim 18 + 12 lists) | 28 new tests (Groups A-E + optional F); pattern modeled on D test file. |
| §9 Runbook updates | GOBS-4 finding (4 lockstep narrative carriers) + D precedent §7.4 | 4 in-place patches + new Q16 narrative section. |
| §10 HALT triggers | Intent brief §4 HALT list + D precedent §9 mirror | All 16 evaluated; zero trigger. |
| §11 Test forecast | Intent brief §3 D2 (band-tighten) + D precedent §6.3 shipped delta | Binding band: +30 to +44. |
| §12 Read-only boundary | D precedent §8 + intent brief §2 OUT + chain prompt CARRY-FORWARD INVARIANTS | All locked files enumerated. |
| §13 Carry-forward invariants | Chain prompt CARRY-FORWARD INVARIANTS section verbatim + R7 (current-status handoff) | All inheritance ledgers cross-checked. |
| §14 Doctrine self-check | `cdiscourse-doctrine`, `point-standing-economy`, `supabase-edge-contract`, `evidence-doctrine`, `test-discipline` skills | Each skill walked through; G-specific concerns surfaced (concession/synthesis/settlement is repair, not defeat). |
| §15 Risks | Orchestrator design judgment + D coverage shipped-pattern lessons | 7 risks enumerated with prevention guidance. |
| §16 Out of scope | Intent brief §2 OUT + chain prompt scope guards | 14 explicit non-scope items. |
| §17 Operator steps | D precedent §11 + intent brief §9 | None required; optional smoke replay documented. |
| §18 Brief ledger | POSTRUN-UX001 protocol | This section enumerates source of each interpretation. |

### Operator-deferred decisions (post-ship review optional)

The 3 intent-brief `[OPERATOR DECISION NEEDED]` markers were resolved by orchestrator default per the D precedent. If the operator reviews and prefers a different resolution, the design can be revised:

- **Marker 1 (intent §2 — list of new Q files at the post-G-enable SHA):** Resolved by orchestrator default = **1 new file** (`16-family-g-subset-coverage.sql`) + **2 narrative edits** (Q11 + Q14). Operator may revisit if they want Q16 to span multiple files (unlikely).
- **Marker 2 (intent §2 — test pattern confirmation):** Resolved by orchestrator default = **`__tests__/opsMcpObservabilityFamilyGCoverage.test.ts`** mirroring D's per-card test pattern. Operator may revisit if they want tests embedded in existing shape/safety tests instead (D precedent recommends separate file).
- **Marker 3 (intent §3 D2 — test delta forecast +20 to +50 → bind to a tighter range):** Resolved by orchestrator default = **+30 to +44** (mirrors D's shipped delta). Operator may revisit at PR review.

### Open questions for the operator

**None.** All 3 intent-brief markers are resolved with explicit justifications. All 16 HALT triggers evaluate to NOT TRIGGERED. All 7 carry-forward invariants are preserved with verification mechanisms. The 7 implementer risks (R1-R7) have prevention guidance.

---

End of design.
