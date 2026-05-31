# OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31
**Branch:** feat/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE
**Issue:** #395 (umbrella #388)
**Design:** docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md
**HEAD:** 0956290 (8 commits ahead of origin/main)

## Summary

This card lands the 2nd per-family observability backfill (mirroring D's
precedent) for Family G (`resolution_progress`), which production-flipped
on 2026-05-29 under `MCP-021C-EDGE-FAMILY-G-ENABLE`. The implementation
is a textbook DATA-only follow-up: one new SQL file (Q16 — Family G 18-key
subset coverage), two surgical narrative + CASE-branch edits to existing
SQL (Q11 + Q14), and the SECTIONS manifest extended from 16 to 17 entries.
Zero `mcp-server/`, `supabase/`, `src/`, `package.json`, or migration
changes. 30 net new tests (at the lower edge of the +30 to +44 design
forecast band, well under the +60 HALT ceiling). All 7 critical review
lenses pass cleanly; both implementer-flagged deviations are mechanically
minimal and justified by the design's own text.

## Verification

| Check | Result |
| --- | --- |
| typecheck | pass (exit 0) |
| lint | pass (exit 0) |
| test | pass (594/594 suites, 18751/18751 tests; baseline was 593 / 18721) |
| test delta | +30 tests, +1 suite — at the lower edge of design §11 binding band (+30 to +44); well below HALT 8 ceiling of +60 |
| secret scan | clean (only doc strings discussing absence of secrets; no key material, no Bearer/JWT/SERVICE_ROLE in operative code) |
| doctrine scan | clean (verdict tokens appear only in banned-token enumeration arrays inside Jest tests and design doc commentary; Q16 SQL operative regions carry zero verdict tokens) |
| Migration apply | N/A — no migration in this card; document the absence per chain prompt |

The migration-bearing card check is **NOT TRIGGERED**: `git diff
--name-only origin/main..HEAD -- 'supabase/migrations/**'` returns
zero results. Migration count on the branch and on `origin/main` are
both 23. No SQL apply step needed.

## Design conformance

- [x] All design file-changes are present (14 files; matches design §6 binding list exactly)
- [x] No undocumented file-changes (every diff entry traces to a design §)
- [x] Data model matches design — Q16 5-column SELECT contract (`raw_key, run_mode, positive_count, distinct_arguments, subset_membership`) verbatim per §5.3; SECTIONS Q16 entry verbatim per §5.6
- [x] API contracts match design — Q11 SECTIONS question mentions `resolution_progress` (stable canary per §3.3 + test #3); Q14 SECTIONS question contains `'five'` per §4.4 + test #7
- [x] Q11 SQL body is byte-equal (only header narrative + source-of-truth footer modified; SELECT body lines 33-48 unchanged per §3.1)
- [x] Q14 CASE has `when 'resolution_progress' then 18` at line 63 (per §4.1) with A/B/C/D branches preserved; header table line 15 references familyGKeys.ts:99
- [x] Q16 18-key Subset list (Q16 SQL lines 77-94) matches `FAMILY_G_RAW_KEYS` (familyGKeys.ts:99-118) verbatim in declaration order
- [x] Q16 12-key deterministic excluded list (Q16 SQL lines 101-114) matches `FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS` (familyGKeys.ts:136-151) verbatim in declaration order (5 auto_metadata + 7 lifecycle)

## Doctrine self-check (must all be confirmed)

- [x] **No truth/winner/loser language in user-facing strings** — Q16 SECTIONS title "Family G 18-key subset coverage" and question "Q16 — Are all observed Family G raw_keys within the 18-key ai_classifier Subset, with zero deterministic-key leaks?" carry zero verdict tokens. Q16 SQL header includes explicit doctrine note "positive counts NEVER imply who-lost" and "SCORING REPAIRS per point-standing-economy".
- [x] **Score never blocks posting** — N/A; this is ops-tooling, not a posting/scoring path.
- [x] **No service-role in client code** — Zero `SERVICE_ROLE` literal in operative code; doc strings discuss absence only. Enforced by existing `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts` (file-count pin updated to ≥19 / ===17 SQL files).
- [x] **No direct insert into public.arguments** — Q16 is read-only SELECT; no INSERT / UPDATE / DELETE / DDL statements in the diff. `git diff | grep -iE 'insert.*public\.arguments'` returns no matches.
- [x] **No AI calls in production app paths** — Zero new Anthropic/xAI/Claude API call code. The 3 mentions of "Anthropic" in the diff are all in comments discussing what the change does NOT do (e.g., "A future Edge/app-side card will compute the 12 deterministic keys app-side without an Anthropic call").
- [x] **Plain language only (no raw internal codes in UI strings)** — N/A per `cdiscourse-doctrine §9`; this is operator-facing telemetry, not user UI. `gameCopy.toPlainLanguage` does not apply.
- [x] **Epic-specific doctrine** (`cdiscourse-doctrine §1, §3, §6, §10a`; `point-standing-economy`; `supabase-edge-contract`; `evidence-doctrine`):
  - **§1 (no truth labels):** Q16 header carries the explicit note that "Family G's concession / synthesis / settlement keys are SCORING REPAIRS per point-standing-economy; positive counts NEVER imply who-lost (per cdiscourse-doctrine §1)" — this language is enforced by Group C test #19 (`expect(src).toContain('SCORING REPAIR')`).
  - **§3 (no popularity surfacing):** Q14 density remains `positives / (runs × family_key_count)` — a structural ratio, not a ranking. Q16 sorts leak-first, not by popularity.
  - **§6 (no secrets):** Only `npx supabase db query --linked` data path; verified by zero hits on the secret scan grep regex.
  - **§10a (machine taxonomy ≠ verdict):** `narrows_claim`, `concedes_broader_point`, `synthesis_proposed` appear verbatim as data values, never as user labels.
  - **point-standing-economy:** Q16 SQL header doctrine note + runbook §Q16 narrative both explicitly frame concession / synthesis / settlement positives as SCORING REPAIRS, not defeats.
  - **supabase-edge-contract:** No migration, no Edge Function, no RLS change, no service-role. Verified by `git diff --stat supabase/ mcp-server/` = 0 lines.
  - **evidence-doctrine:** Q16 selects only aggregate counts; no `evidence_span` content; no `arguments.body`.

## Critical review lenses (the 7 BLOCKERS from chain prompt)

### Lens 1 — Observability test isolation invariant: PASS

`scripts/ops/sql/` directory count moved cleanly from 16 to 17:

- `opsMcpObservabilitySqlSafety.test.ts:58-59` pin updated from `expect(FILES.length).toBe(16)` to `toBe(17)`. ✓
- `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:74-75,81` pins updated from `≥18` → `≥19` AND `sqlFiles.length === 16` → `=== 17`. ✓
- Filesystem confirms: 17 SQL files under `scripts/ops/sql/` (verified by `find scripts/ops/sql -maxdepth 1 -name "*.sql" -type f | wc -l` = 17).

### Lens 2 — A-F SQL + Q15 byte-equal: PASS

`git diff --stat origin/main..HEAD` against `scripts/ops/sql/0[1-9]-*.sql scripts/ops/sql/10-*.sql scripts/ops/sql/12-*.sql scripts/ops/sql/13-*.sql scripts/ops/sql/15-*.sql` returns **zero output** (no header, no `0 files changed` summary because git emits nothing when there is no diff). Spot-checked: Q15 (`15-family-d-subset-coverage.sql`) is byte-equal. Q08's filename is `08-source-six-safety-row-counts.sql` (not `08-source-six-safety.sql`); confirmed byte-equal.

### Lens 3 — No runtime/Edge/migration changes: PASS

`git diff --stat origin/main..HEAD -- mcp-server/ supabase/ src/ package.json package-lock.json` returns zero output. The migration file count on the branch (23) equals the count on `origin/main` (23). HALT triggers 1, 2, 3, 5, 6, 7 (from design §10) are all NOT TRIGGERED.

### Lens 4 — Q14 CASE correctness: PASS

`scripts/ops/sql/14-per-family-per-mode-signal-density.sql:63` reads `when 'resolution_progress' then 18`. Cross-checked against the upstream source-of-truth `mcp-server/lib/familyGKeys.ts:99-118`: `FAMILY_G_RAW_KEYS` contains exactly 18 entries (counted: `narrows_claim, concedes_narrow_point, ready_for_synthesis, suggests_side_branch, suggests_diagonal_tangent, accepts_partial_with_caveat, concedes_with_new_dispute, proposes_settlement_terms, accepts_settlement_terms, concedes_broader_point, common_ground_identified, unresolved_point_isolated, synthesis_proposed, move_on_requested, issue_closed_by_participant, decision_criterion_proposed, action_item_proposed, followup_question_proposed`). The "18" constant in Q14's CASE matches the upstream count. Header line 15 cites `familyGKeys.ts:99`.

### Lens 5 — Q16 SQL doctrine: PASS

Q16 SQL header carries every required element:

- **Section title** "Family G 18-key subset coverage" — no verdict tokens.
- **Doctrine note** (lines 50-54): "machine-taxonomy raw_key strings only (per cdiscourse-doctrine §10a). Family G concession / synthesis / settlement keys are SCORING REPAIRS per point-standing-economy; positive counts NEVER imply who-lost (per cdiscourse-doctrine §1)."
- **Source-of-truth citations** (lines 40-45): cite `OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §5`, `MCP-SERVER-008-FAMILY-G.md`, `familyGKeys.ts:99-118`, `familyGKeys.ts:136-151`.
- **18 ai_classifier keys** (lines 77-94): byte-equal to `FAMILY_G_RAW_KEYS` declaration order verbatim.
- **12 deterministic excluded keys** (lines 101-114): byte-equal to `FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS` declaration order (5 auto_metadata first, 7 lifecycle second).
- **Disambiguation footnote** (lines 31-38): explicitly distinguishes ai_classifier ↔ lifecycle/auto_metadata name-pairs (narrows_claim/narrowed, concedes_narrow_point/conceded, ready_for_synthesis/synthesis_ready/synthesis_candidate).
- **G-extended verdict-adjacency**: zero occurrences of `won`, `lost`, `defeated`, `prevailed`, `capitulated`, `ahead`, `behind`, `settled in favor` in executable SQL (Group F test #28 enforces this via comment-stripped scan).

### Lens 6 — New Jest test robustness: PASS

Sampled 6 tests across Groups A-F; all are non-tautological and would FAIL if their target implementation regressed:

- **Group A test #1** (file:line `opsMcpObservabilityFamilyGCoverage.test.ts:169-173`) — asserts Q11 SQL header contains `'resolution_progress'` + `'18-key ai_classifier Subset'`. Would FAIL if Q11 narrative was reverted.
- **Group A test #2** (line 175-198) — uses `stripSqlComments` then asserts Q11 SELECT body preserves the 6-column contract, `unnest(requested_families)` family-agnostic path, AND has NO contamination columns `family_key_count` or `subset_membership`. Would FAIL if the SQL body received any column-addition modification.
- **Group B test #5** (line 223-233) — substring assertions for all 5 verbatim CASE branches in Q14, including `"when 'resolution_progress' then 18"`. Would FAIL if any branch regressed.
- **Group C test #14** (line 288-296) — iterates `FAMILY_G_SUBSET_KEYS` (the 18-key array in the test file) and asserts each appears in Q16 SQL with the precise regex `'<key>'\s*[,)]`. Failure message names the missing key.
- **Group D test #20** (line 391-394) — `expect(lib.SECTIONS.length).toBe(17)`. Would FAIL if Q16 SECTIONS entry was removed.
- **Group E test #27** (line 528-544) — integration test invoking `stitchMarkdownReport` against the fixture and asserting (a) output is a non-empty string, (b) no NaN, (c) no `undefined`, (d) `'## Family G 18-key subset coverage'` heading is rendered. Would FAIL if the fixture key, the SECTIONS title, or the runner stitching regressed.

All 30 tests in the new file pass against current HEAD. No tests are skipped, `xit`'d, or vacuous.

### Lens 7 — Deviations sanity-check: PASS

**Deviation 1 (D coverage test pin updates):** The implementer correctly identified that
`opsMcpObservabilityFamilyDCoverage.test.ts` had 3 hardcoded SECTIONS-length pins
(line 429 description + assertion 16→17; line 451 ordered id list — append q16 at end;
line 600 JSON sections length 16→17). These pins are length-coupled — the D card itself
asserted "SECTIONS length is now 16 (was 14 pre-card)" precisely because the count was a
moving target advanced per per-family observability card. The implementer made the minimum
mechanical update (3 lines) to preserve the test's correctness against the new SECTIONS
state, while leaving every D-specific substance assertion (Q11 rename, Q14 CASE for D,
Q15 fixture preservation, etc.) byte-equal. This is the correct interpretation of the
design's `§13 carry-forward` invariant (which says "Q15 byte-equal" and "Q15 fixture
preserved", not "the D-card-tests file byte-equal").

**Deviation 2 (Q11 SECTIONS canary):** The Q11 SECTIONS question string contains
"(resolution_progress)" inline after "G", matching design §3.3's note that the test
uses `resolution_progress` as the most stable canary (and Group A test #3 asserts
exactly `s.question.includes('resolution_progress')`). This aligns canary substring
across both the question text and the test assertion — preferable to the design's
preliminary draft text "A+B+C+G production" which lacked the canary substring.

Both deviations are well-justified, mechanically minimal, and consistent with the
design's stated intent.

## Test coverage

- [x] New public function/SQL has unit tests — Q16 SQL has 12+ tests in Group C; Q11/Q14 changes have 4+3 tests in Groups A/B; SECTIONS additions have 5+5 tests in Groups D/E.
- [x] User-facing strings have ban-list assertion — `BANNED_TOKENS` array in test file enforces no winner/loser/correct/dishonest/etc. in Q16 SQL; `G_VERDICT_ADJACENCY_BANNED_PHRASES` array enforces no won/lost/defeated/prevailed/capitulated in comment-stripped Q16 SQL.
- [x] Edge cases from design § "Edge cases" have tests — fixture preservation (D card's Q15 not regressed) is Group E test #26; cross-section column collision check is Group D test #23.
- [x] Accessibility assertions present — N/A (no UI surface; `accessibility-targets` skill explicitly N/A per design §14).

## Blockers (only if Block)

**None.** Zero HALT triggers fire; zero critical-lens failures; zero secret hits; zero
doctrine violations; zero design-conformance gaps.

## Suggestions (non-blocking)

1. The Q14 CASE expression now lists `parent_relation, disagreement_axis,
   misunderstanding_repair, evidence_source_chain, resolution_progress` in
   chronological-card-ship order (A → B → C → D → G). When the E/F backfill
   cards eventually ship (and they will, per design §13.1), the next card's
   implementer should decide whether to preserve chronological order (B before E even
   though E's letter comes earlier) or migrate to alphabetic. Design §15 R2
   already names this; recommend including a one-line guidance comment in the Q14
   header at that time to lock the convention going forward. **NOT a blocker for
   this card.**

2. The `current-status.md` handoff is a single comment block in the established pattern. It
   does not interleave with the existing Stage 6.4 narrative line in CLAUDE.md (CLAUDE.md
   was untouched in this card, consistent with design §6 estimate of 3-8 lines per the
   R7 recommendation B "keep the handoff focused on G alone"). If/when the multi-family
   observability backfill chain stabilizes (after E/F/H ship), an aggregated Stage 6.x
   handoff updating CLAUDE.md would be worth a follow-up doc-only card. **NOT a blocker.**

3. The implementer-reported test delta is +30 (at the lower edge of the +30 to +44
   binding band). This is below the brief's mid-target but compliant. No action needed;
   the design explicitly permitted landing at +30 by omitting optional cross-section
   enrichment tests. **Informational only.**

## Operator next steps

```bash
# 1. Push the branch
git push -u origin feat/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE

# 2. Open PR
gh pr create --title "OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE: Family G 18-key subset observability backfill" \
  --body-file docs/reviews/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md

# 3. After merge, OPTIONAL post-merge smoke (per design §17.1)
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/g-coverage-smoke

# Inspect /tmp/g-coverage-smoke/report.md:
#   - Q11 section narrative reflects the 5-family carry-forward state
#   - Q14 shows resolution_progress with family_key_count=18 + non-null density
#   - Q16 section present; Family G observed raw_keys all 'ai_classifier_subset'
#   - Zero deterministic_excluded_leak rows (the healthy state)

# 4. No deploys, no env changes, no migrations needed.
#    - npx supabase db push --linked  : NOT REQUIRED (no migration)
#    - npx supabase functions deploy   : NOT REQUIRED (no Edge change)
#    - Audit-lint v1 marker            : NOT REQUIRED (ops-tooling not smoke-audit)
```

### Post-merge worktree cleanup (operator step)

After the PR merges to `main`, run from the main repo root:

```bash
# 1. Identify the worktree path for this card
git worktree list | grep "feat/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE"

# 2. Remove the worktree (double-force required for agent-locked worktrees)
git worktree remove -f -f ".claude/worktrees/agent-<hash>"

# 3. Delete the local auto-branch
git branch -D feat/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE

# 4. Verify cleanup
git worktree list | grep -c "agent-<hash>"   # must print 0
```

On Windows, if `git worktree remove` reports `Filename too long`, use the
UNC long-path workaround from PowerShell per the reviewer charter EC-2
handler:

```powershell
Remove-Item -Path "\\?\C:\Users\kyler\cdiscourse\debate-constitution-app\.claude\worktrees\agent-<hash>" -Recurse -Force
git worktree prune
```
