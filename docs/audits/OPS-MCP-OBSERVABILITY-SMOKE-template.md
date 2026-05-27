# OPS-MCP-OBSERVABILITY — Post-merge smoke template

**Operator audit template** — fill in by copying this file to
`OPS-MCP-OBSERVABILITY-SMOKE-<YYYY-MM-DD>.md` after the squash-merge
of `feat/OPS-MCP-OBSERVABILITY` to `main` completes.

**Audit doctrine:** This audit verifies the read-only operator
telemetry script runs against the linked Supabase project, surfaces
all 13 telemetry questions for the multi-family MCP classifier, and
preserves all doctrine guarantees (no service-role, no secrets, no
raw body content, no evidence span by default, no banned doctrine
tokens, Source 6 production-only filter intact).

Predecessor chain expected on `main` before this audit:
- `MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE` PASS
- `MCP-SERVER-003-FAMILY-B-SMOKE` PASS
- `MCP-SERVER-004-FAMILY-C-SMOKE` PASS
- `OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE` PASS

## Verdict

**TBD.** Fill in after running all 6 phases below.

## Hard rules honored

The card's HALT triggers require verbatim preservation of:

- No client-side service-role / direct DB access.
- No secrets (Anthropic key, bearer token, service-role key, JWT)
  exposed in script source or report output.
- No raw argument body content in default output.
- No full evidence span content in default output.
- No taxonomy changes (`src/features/nodeLabels/**` byte-equal).
- No classifier prompt changes (`mcp-server/lib/family*Prompt.ts`
  byte-equal).
- No MCP server runtime behavior changes (`mcp-server/**`
  byte-equal).
- No production-mode flip for Family B/C
  (`supabase/functions/_shared/booleanObservations/familyRegistry.ts`
  byte-equal).
- No Source 6 rendering changes
  (`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
  byte-equal).
- No auto-trigger changes.
- No new tables / migrations.
- No UI.
- No third-party observability vendor.
- No doctrine verdict / person-language tokens in any section label.

---

## Phase 1 — Pre-flight

Git state at audit start:

```
HEAD: <fill in merge commit SHA>
Title: feat(OPS-MCP-OBSERVABILITY): ... (#<PR number>)
```

Working tree:

```bash
git status --short
```

Expected: only the 10 known operator-territory untracked files
(testing-runs *.md, mcp021c-edge-smoke-*, netlify-prod.git,
phase5-mcpserver002-*). No staged or modified files.

Predecessor audits present:

```bash
ls docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-*.md
ls docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-*.md
ls docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-*.md
ls docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-*.md
```

Source 6 file byte-equal to pre-merge:

```bash
git diff main -- src/features/nodeLabels/machineObservationPersistenceQuery.ts
```

Expected: no output (zero diff).

Locked-file byte-equal sanity check:

```bash
git diff main -- src/features/nodeLabels/ mcp-server/ supabase/functions/_shared/booleanObservations/ supabase/migrations/
```

Expected: no output.

Supabase Management API reachable via a trivial query:

```bash
npx supabase db query --linked --output json --execute "select 1 as ok"
```

Expected: JSON envelope with `"rows": [{"ok": 1}]`.

**Phase 1 verdict:** ____ (PASS / PARTIAL / FAIL).

---

## Phase 2 — Run the report against linked Supabase

```bash
mkdir -p /tmp/ops-observability-smoke
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/ops-observability-smoke
echo "exit: $?"
```

Expected: `exit: 0`. Two files produced:
- `/tmp/ops-observability-smoke/report.md`
- `/tmp/ops-observability-smoke/report.json`

JSON shape sanity:

```bash
jq -e '.schemaVersion == "ops-mcp-observability.report.v1"' /tmp/ops-observability-smoke/report.json
jq -e '.sections | length == 14' /tmp/ops-observability-smoke/report.json
jq -e '.sourceSixSafety.literalProductionStringPresent == true' /tmp/ops-observability-smoke/report.json
jq -e '.sourceSixSafety.literalAdminValidationStringAbsent == true' /tmp/ops-observability-smoke/report.json
```

Expected: every `jq -e` exits 0.

**Phase 2 verdict:** ____ (PASS / PARTIAL / FAIL).

---

## Phase 3 — Verify each required section is populated

For each section, grep the markdown for the section title and at
least one expected row.

```bash
grep -n "^## Runs by run_mode" /tmp/ops-observability-smoke/report.md
grep -n "^## Runs by family" /tmp/ops-observability-smoke/report.md
grep -n "^## Runs by family and status" /tmp/ops-observability-smoke/report.md
grep -n "^## Top failure reasons by family" /tmp/ops-observability-smoke/report.md
grep -n "^## Positive results by family" /tmp/ops-observability-smoke/report.md
grep -n "^## Top positive raw_keys by family" /tmp/ops-observability-smoke/report.md
grep -n "^## Positive density" /tmp/ops-observability-smoke/report.md
grep -n "^## Source 6 production filter present" /tmp/ops-observability-smoke/report.md
grep -n "^## Duplicate runs" /tmp/ops-observability-smoke/report.md
grep -n "^## Family A auto-trigger recent activity" /tmp/ops-observability-smoke/report.md
grep -n "^## Family B and C admin-validation-only check" /tmp/ops-observability-smoke/report.md
grep -n "^## Unsupported-family attempt visibility" /tmp/ops-observability-smoke/report.md
grep -n "^## Over/under-firing summary" /tmp/ops-observability-smoke/report.md
```

Expected: every grep finds one match.

Per-section verification:

| Section | Expected (binding) |
|---------|--------------------|
| Q1 | Two rows: production + admin_validation; production has `failed_count = 0` |
| Q2a / Q2b | parent_relation appears in both; Q2a count <= Q2b count |
| Q3 | Cross-tab with success + failed rows for each registered family |
| Q4 | `mcp_validation_failed` is the primary failure_reason |
| Q5 | Family A has the highest positive count; B + C have admin_validation rows only |
| Q6 | Top raw_keys are from the registered taxonomy (Family A: 16 keys; B: 14; C: 17) |
| Q7 | Family A production has positive density > 0 in the 7-day window |
| Q8 | "Source 6 production filter present: YES." appears; admin_validation absent confirmed |
| Q9 | **Expected: zero rows** ("Idempotency posture nominal.") |
| Q10 | Family A `production_runs > 0` for at least one day in the window |
| Q11 | All rows have `run_mode = admin_validation` |
| Q12 | Every row has `positives_observed = 0` |
| Q13 | All 3 registered families appear with non-zero `completed_runs` |

If Q9 returns non-zero rows: **partial verdict**; file
`OPS-MCP-IDEMPOTENCY-HARDENING` per intent brief §15.

If Q12 returns any row with `positives_observed > 0`: **fail
verdict**; surface as security-adjacent finding.

**Phase 3 verdict:** ____ (PASS / PARTIAL / FAIL).

---

## Phase 4 — Verify default output safety

Secrets and bearer-token grep:

```bash
grep -E "(BEGIN [A-Z ]+PRIVATE KEY|Bearer |service_role|apikey|ANTHROPIC_API_KEY|sk-ant-|xai-)" /tmp/ops-observability-smoke/report.md
echo "exit: $?"
```

Expected: `exit: 1` (no matches).

Doctrine ban-list grep (excluding Appendix B which enumerates by
name):

```bash
sed '/^## Appendix B/,$d' /tmp/ops-observability-smoke/report.md | \
  grep -iE "(winner|loser|fallacy|bad faith|manipulative|extremist|propagandist|liar|dishonest)"
echo "exit: $?"
```

Expected: `exit: 1` (no matches).

Verdict-token grep:

```bash
sed '/^## Appendix B/,$d' /tmp/ops-observability-smoke/report.md | \
  grep -iwE "(correct|incorrect)"
echo "exit: $?"
```

Expected: `exit: 1` (no matches).

Markdown file size sanity bound:

```bash
wc -c /tmp/ops-observability-smoke/report.md
```

Expected: < 100 KB (13 sections of aggregate rows should not exceed
this).

**Phase 4 verdict:** ____ (PASS / PARTIAL / FAIL).

---

## Phase 5 — Targeted regression

```bash
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage
echo "exit: $?"
```

Expected: `exit: 0`. All test suites pass.

Capture the test counts:

```
Test Suites: X passed, X total
Tests:       Y passed, Y total
```

Fill in: ____.

**Phase 5 verdict:** ____ (PASS / PARTIAL / FAIL).

---

## Phase 6 — OPS observations + verdict + audit doc commit

### Final verdict

**PASS criteria** (all required):
- Phase 1 PASS (clean pre-flight; no locked-file diff).
- Phase 2 PASS (report exit 0; both artifacts produced).
- Phase 3 PASS (every section populated correctly; Q9 zero rows; Q12
  positives_observed = 0 for every unsupported family).
- Phase 4 PASS (no secrets; no banned tokens; size sane).
- Phase 5 PASS (targeted regression all green).

**PARTIAL criteria** (acceptable downgrade):
- Phase 3 PARTIAL: Q9 returns non-zero rows (file
  `OPS-MCP-IDEMPOTENCY-HARDENING`).
- Phase 3 PARTIAL: Family A/B/C has no rows in some section because
  no smoke happened in the recency window.

**FAIL criteria** (any of these blocks):
- Any phase exit code non-zero where exit 0 was expected.
- Report prints raw bodies, evidence span content, or secrets.
- Source 6 production filter absent.
- Q12 positives_observed > 0 for any unsupported family.
- Locked-file diff detected in Phase 1.

### Observations

Free-form notes:

- Run timestamps: ____
- Phase 1: ____
- Phase 2: ____
- Phase 3 (per-section observations): ____
- Phase 4: ____
- Phase 5 (test counts): ____

### Follow-on cards filed (if applicable)

- [ ] `OPS-MCP-IDEMPOTENCY-HARDENING` (if Q9 returned non-zero rows)
- [ ] `OPS-MCP-TOKEN-BUDGET` (if Q5 / Q7 surfaced truncation-suggestive
      density)
- [ ] Security-adjacent finding (if Q12 returned any
      `positives_observed > 0`)

### Authorizations confirmed on PASS

If this audit PASSes:

- `MCP-SERVER-005-FAMILY-D` remains authorized with mandatory
  Stage-2B operator-decision checkpoint.
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` remains authorized to design.
- `OPS-MCP-IDEMPOTENCY-HARDENING` is authorized to file if Q9 was
  non-zero.
- `OPS-MCP-TOKEN-BUDGET` is authorized to file if Q5 / Q7 surfaced
  truncation-suggestive signals.

### Commit the audit

```bash
git add docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-<YYYY-MM-DD>.md
git commit -m "audit(OPS-MCP-OBSERVABILITY): smoke <PASS/PARTIAL/FAIL> — <brief>"
git push origin main
```

---

## Appendix — Why each phase exists

Per the design's §smoke-plan + intent brief §14:

- **Phase 1** prevents auditing an unstable HEAD. Locked-file diff
  detection catches the most expensive regression class early.
- **Phase 2** is the load-bearing reachability test — the script must
  actually run against the linked Supabase project. Failure here is
  the difference between "script is correct" and "script is reachable
  to operators".
- **Phase 3** is the substantive correctness check — does the report
  actually answer the 13 telemetry questions with non-degenerate data?
- **Phase 4** is the safety check — does the report leak ANYTHING it
  must not (secrets, body content, doctrine verdicts)?
- **Phase 5** is the regression wall — do the existing 11 S6F-* tests
  + the 22 mcpOneTwoOneC* / 9 mcpOneTwoOneB* tests still pass after
  the merge?
- **Phase 6** is the verdict + paper trail.

If any phase exits FAIL: HALT, surface to operator, do not commit
the audit doc.
