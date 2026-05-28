# OPS-MCP-SMOKE-DOCTRINE-HARDENING — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** OPS — process / audit-integrity tooling
**Predecessor chain on main:**
- `audit(MCP-SERVER-006-FAMILY-E)` hosted smoke completion PASS at `bccb0c2`
- `audit(MCP-SERVER-006-FAMILY-E)` smoke amendment PARTIAL at `b1829f5`
- `audit(MCP-SERVER-006-FAMILY-E)` original smoke (improper PASS) at `29f30b0`
- `audit-amend(MCP-021C-EDGE-FAMILY-D-ENABLE)` strengthened proof obligations 9/9 at `b324dae`
- All preceding cards

---

## 1. Why this card exists (motivating three-document arc)

Three audit docs across the Family E + Family D arc proved a class of defect that doc-only template enforcement does not catch:

| Commit | Audit | Verdict at audit time | Defect class |
| --- | --- | --- | --- |
| `29f30b0` | Family E original smoke | **PASS (improper)** | Phase 3 hosted MCP marked "NOT-RUN, covered indirectly via Phase 4 success." Under R1-R4 this should have been PARTIAL. Hand-review missed it. |
| `b1829f5` | Family E smoke amendment | **PARTIAL (correct)** | Gap 2 (adversarial slippery_slope persisted evidence_span) closed live; Gap 1 (hosted 17/17) still NOT-RUN. Operator R2 explicit cap held. |
| `bccb0c2` | Family E hosted completion | **PASS (correct)** | Operator-supplied 17/17 hosted smoke evidence closed Gap 1. R2 cap lifted with full provenance. |

Plus the Family D strengthened amendment (`b324dae` predecessor: `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-AMENDMENT-2026-05-27.md`) is the model of a complete audit — all three success levels distinguished, persisted-row inspection, named-mechanism rejection.

**This card converts the audit-integrity rules R1-R4 from prose into a mechanical linter** so the original `29f30b0` improper-PASS class of defect is caught at authoring time, not via two amendments after the fact.

---

## 2. The six rules the linter enforces (L1-L6)

### L1 (R1/R2) — NOT-RUN caps the verdict
A required phase marked NOT-RUN means the verdict CANNOT be PASS. If an audit has any required phase = NOT-RUN AND verdict = PASS → lint FAIL. Exemption: a phase explicitly tagged optional (in the doc OR the rules file's per-audit-type optional list) does not trip this.

### L2 (R2/R4) — Indirect proof cannot satisfy a direct-proof obligation
Phrases such as "covered indirectly", "indirect evidence", "verified via unit tests" (as the SOLE justification), "would pass" appearing as the justification for a phase the rules file marks direct-proof-required → lint FAIL. Unit tests as a SUPPLEMENT to a direct proof are fine; as the substitute for a required direct phase, they are not.

### L3 — Production-enable audits distinguish three success levels
An audit for a production-enable card (title/filename matches `EDGE-FAMILY-*-ENABLE`, OR doc declares card-type=production-enable) MUST contain distinct, present assertions for:
- (a) dispatch success (run row status=success)
- (b) targeted classifier-signal success (≥1 positive result row)
- (c) read-path / Source 6 success

Missing any of the three → lint FAIL.

### L4 — Targeted-signal requires a positive RESULT ROW on targeted text
For production-enable audits, the classifier-signal assertion must claim ≥1 positive result row produced by DELIBERATELY TARGETED text — not a bare successful run row, and not a 0-positive run treated as signal proof. A run-row-only claim → lint FAIL.

### L5 — Doctrine-risk audits inspect persisted direct output
An audit flagged doctrine-risk (doc declares doctrine-risk=true, OR the family is in the rules file's doctrine-risk list — currently Family E / argument_scheme / slippery_slope) MUST reference a persisted `evidence_span` (or equivalent direct-output) inspection. Unit tests alone, with no persisted-row inspection section → lint FAIL.

### L6 — Verdict upgrades carry provenance
An amendment/upgrade/completion audit (title contains AMENDMENT / COMPLETION / upgrade, OR doc declares a prior-verdict) MUST name all three of:
- (a) the prior verdict
- (b) the specific missing proof that capped it
- (c) the specific newly-supplied proof that lifts the cap

Missing any one → lint FAIL.

---

## 3. Artifacts (Decision 1; the only files this card touches)

- `scripts/ops/audit-lint.mjs` (NEW) — runner; parses + applies rules; mirrors `mcp-observability-report.mjs` runner pattern
- `scripts/ops/audit-lint-rules.cjs` (NEW) — rule definitions; pure DATA (phrase lists, patterns, per-audit-type required/optional phase lists, doctrine-risk family list, marker string). Mirrors `mcp-observability-report-lib.cjs` library pattern
- `__tests__/opsAuditLint.test.ts` (NEW) — rule unit tests + the 4 fixtures' expected verdicts
- `__tests__/fixtures/audit-lint/*.md` (NEW; STATIC COPIES extracted via `git show` at the motivating SHAs)
- `docs/ops/AUDIT-LINT.md` (NEW) — operator doc: rules, how to run, how to add a doctrine-risk family, marker mechanics
- Smoke-template updates (Decision 6; additive only)
- CI wiring (Decision 7; **likely deferred to PARTIAL per operator addendum**)
- `docs/core/current-status.md` handoff

No runtime code touched. No existing audit doc edited or deleted.

---

## 4. Self-validation: the four fixtures (Decision 4; BINDING centerpiece)

The Jest tests MUST assert these exact linter outcomes against COPIES of the historical docs:

| Fixture (filename) | Extracted from | Expected linter outcome | Why |
| --- | --- | --- | --- |
| `original-family-e-IMPROPER-PASS.md` | `git show 29f30b0:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md` | **FAILS** | L1: Phase 3 hosted MCP NOT-RUN + verdict PASS. L2: "covered indirectly" justifies a direct-required phase. Centerpiece proof — the linter catches the exact defect that motivated this card. |
| `family-e-amendment-PARTIAL.md` | `git show b1829f5:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT-2026-05-28.md` | **PASSES** (graded consistent-PARTIAL) | NOT-RUN Phase 1 + verdict PARTIAL is CONSISTENT (R2). L6 provenance present. Must NOT false-fail. |
| `family-e-hosted-completion-PASS.md` | `git show bccb0c2:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-COMPLETION-HOSTED-2026-05-28.md` | **PASSES** | All phases run; L6 full provenance present. |
| `family-d-strengthened-amendment-PASS.md` | `docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-AMENDMENT-2026-05-27.md` (current main) | **PASSES** | Model of complete audit; all of L1-L6 satisfied. |

If any fixture's actual outcome ≠ expected → HALT (trigger 8). The implementer tunes the linter until all four match.

---

## 5. CI scope (Decision 5) + marker mechanism

**Scoping rule (closes evasion loophole, trigger 10):**
- A post-hardening MARKER line in the audit doc (default: `Audit-Lint: v1`). The smoke-template update adds this marker to all new audits going forward.
- A newly-ADDED file matching `docs/audits/*SMOKE*.md` (git status A) is ALWAYS linted, marker or not (new docs must conform).
- A MODIFIED existing file is linted ONLY if it carries the marker (so pre-hardening historical edits stay exempt; post-hardening edits are enforced).
- The linter NEVER runs over the full corpus in CI by default (trigger 4).

**CI wiring (Decision 7; LIKELY DEFERRED PARTIAL):**

Phase 0 inspection found **`.github/workflows/` does NOT exist** — the repo has no GitHub Actions CI configured. Introducing it would be a non-additive shared-workflow change, which fires HALT trigger 9.

Per operator addendum: if trigger 9 fires, land the linter + rules + fixtures + tests + docs + template-update, and mark only CI wiring as PARTIAL/deferred. The linter remains operator-run until a follow-up wires CI.

**The card lands regardless of CI mechanism.** The enforcement value comes from the linter, the fixtures, the smoke-template update, and the documentation; the CI mechanism is a delivery vector that can be added later (Netlify deploy preview, GitHub Action introduced later, pre-commit hook, etc.).

---

## 6. Smoke-template additive update (Decision 6)

Update existing smoke-template doc(s) under `docs/audits/MCP-SERVER-NNN-FAMILY-X-SMOKE-template.md` to ADD:
- The `Audit-Lint: v1` marker line near the top
- A required final step: "Run `node scripts/ops/audit-lint.mjs <this-doc>`; it MUST exit 0 before the Verdict line is valid."
- For production-enable templates: an explicit three-level section (dispatch / targeted classifier-signal / read-path) so L3 + L4 have a home to land in

**Do NOT change the substance of existing required phases (trigger 14).** Additive only.

---

## 7. Operator addendum (binding)

Two implementation cautions from the operator:

1. **Fixture files contain historical defect language by design.** Files under `__tests__/fixtures/audit-lint/` will contain phrases like "covered indirectly", "verified via unit tests", and verdict-token-adjacent text from the original Family E audit. Any broad doctrine/verdict-token scan (in the Jest suite, in a CI hook, etc.) MUST EITHER exclude these fixture files OR classify them as intentional negative fixtures. **Do not let fixture contents trigger a false HALT.**

2. **CI fallback.** If trigger 9 fires (likely per Phase 0 — no GitHub Actions infrastructure), land the linter + rules + fixtures + tests + docs + smoke-template update and mark only CI wiring as PARTIAL/deferred. Otherwise, proceed through the full card.

---

## 8. Out of scope

- ANY runtime code change (mcp-server/* logic, supabase/functions/* logic, src/* except tests/fixtures)
- ANY registry / prompt / taxonomy change
- ANY existing audit doc under `docs/audits/` modified or deleted (the linter is READ-ONLY over the corpus; fixtures are COPIES)
- Linting the FULL historical audit corpus by default in CI (trigger 4)
- Structured front-matter audit schema (deferred to v2; `OPS-MCP-AUDIT-SCHEMA-V2`)
- Globally enforcing L1-L6 on pre-hardening docs (out of scope by design)
- New family registration or family behavior change
- Schema migration

---

## 9. HALT triggers (16)

### Scope (1-6):
1. Any runtime code change
2. Any registry / prompt / taxonomy change
3. Any existing audit doc under `docs/audits/` modified or deleted
4. The linter is wired to run over the FULL historical audit corpus by default
5. New family registration or family behavior change
6. Schema migration

### Linter correctness (7-12):
7. Fixtures are live-referenced (not static copies)
8. Any of the 4 fixtures does NOT produce its expected verdict — the existential self-validation; tune until matched
9. CI integration requires touching shared CI config beyond a clean additive (likely fires per Phase 0 finding; per addendum → defer CI to PARTIAL)
10. Marker / added-file scoping creates an evasion loophole
11. Linter produces non-deterministic output
12. Linter false-FAILs a legitimate PARTIAL audit (the `b1829f5` fixture must pass-as-PARTIAL)

### Process (13-14):
13. Test forecast exceeds +100 (M card; +25 to +60 expected)
14. Smoke-template update changes existing required-phase substance (rather than adding the marker + audit-lint final step + L3 three-level section)

### Working tree (15-16):
15. Verdict tokens / doctrine ban-list violations in any shipped string (excluding fixture files per operator addendum)
16. Unclassified untracked files at PR creation

Trigger 8 is existential for this card. Trigger 9 is the conditional-checkpoint trigger; per operator addendum the card lands with CI deferred.

---

## 10. Required designer Phase A audits (4)

### A.1 — Audit-format parse model
Read 6-8 real smoke audit docs (the four motivating + 2-4 others). Document the consistent structure the linter parses:
- Phase table rows (each phase has `Status: PASS|PARTIAL|FAIL|NOT-RUN`)
- The "Audit doctrine" header
- The "Verdict" line / section
- Amendment markers (filename pattern; doc body)

Identify format variance the linter must tolerate.

### A.2 — Rule formalization
For each of L1-L6, specify the exact parse → predicate → finding. Define the rules-file data shape (in `audit-lint-rules.cjs`). Define audit-type detection patterns (production-enable vs family-ship vs OPS vs amendment vs hosted-completion).

### A.3 — CI scope + marker mechanism
Finalize the marker format (default `Audit-Lint: v1`) and the added-vs-modified scoping. Prove the evasion loophole is closed. Confirm `.github/workflows/` absence → trigger 9 fires → CI wiring DEFERRED to PARTIAL per operator addendum (land everything else).

### A.4 — Self-validation design + test plan
Specify how each of the four fixtures is extracted (`git show <SHA>:<path>`) and what assertion proves its expected verdict. Forecast +25 to +60.

---

## 11. Test forecast: +25 to +60

HALT at +100.

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="opsAuditLint" --no-coverage`
- `cd mcp-server && deno test` (unchanged; this card touches no mcp-server)

---

## 12. Smoke plan (5-phase)

Audit at `docs/audits/OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE-<date>.md` (carries `Audit-Lint: v1` marker; must itself pass the linter — dogfood Phase 5).

### Phase 1 — Self-validation against the 4 fixtures (CENTERPIECE)
```
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/original-family-e-IMPROPER-PASS.md
→ expect non-zero exit; findings cite L1 + L2
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-e-amendment-PARTIAL.md
→ expect exit 0; graded consistent-PARTIAL
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-e-hosted-completion-PASS.md
→ expect exit 0; PASS
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-d-strengthened-amendment-PASS.md
→ expect exit 0; PASS
```
ALL FOUR must match expected. This is the proof the linter would have caught the original Family E defect.

### Phase 2 — Report-only corpus census (informational; never blocks)
```
node scripts/ops/audit-lint.mjs --report-only docs/audits/
→ prints N scanned, M would-fail, with reasons
```
Confirm `29f30b0`'s original audit appears in would-fail (historical, exempt, info only). Confirm the count is plausible and the linter doesn't crash at scale.

### Phase 3 — CI scope verification (simulated, not via GitHub Actions)
Simulate the scoping logic:
- A newly-ADDED smoke audit doc IS linted (marker or not)
- A MODIFIED historical doc WITHOUT the marker is NOT linted
- A MODIFIED doc WITH the marker IS linted

Prove the evasion loophole is closed (a new doc without the marker is still linted because added-files-always-lint).

### Phase 4 — Regression
```
npx jest --testPathPattern="opsAuditLint" --no-coverage
npm run typecheck && npm run lint
cd mcp-server && deno test --allow-net --allow-env --allow-read && cd ..
```
Deno unchanged; this card touches no mcp-server code.

### Phase 5 — Dogfood: the smoke audit lints itself
```
node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE-<date>.md
→ expect exit 0
```
If the smoke audit can't pass its own linter, either the linter is wrong or the audit is incomplete — either way, fix before the verdict is valid.

### Verdict rules

**PASS:** all 4 fixtures match expected (Phase 1); census runs clean (Phase 2); CI scoping logic verified (Phase 3); regression clean (Phase 4); smoke audit lints itself green (Phase 5).

**PARTIAL:** linter works on fixtures but CI wiring deferred per trigger 9 (operator addendum default; the most likely outcome given Phase 0). Enforcement is then operator-run until a follow-up wires CI.

**FAIL:** any fixture mismatch (esp. original-family-e not failing); corpus globally linted; loophole open; smoke audit can't pass its own linter; regression breaks.

---

## 13. Authorizations granted on PASS (or PARTIAL with CI deferred)

- `OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE: PASS` (or PARTIAL with CI deferred)
- L1-L6 mechanically enforced on new/modified post-hardening smoke audits (operator-run until CI lands)
- `MCP-SERVER-007-FAMILY-F` AUTHORIZED — its smoke audit now ships under the linter from Phase 1
- `MCP-021C-EDGE-FAMILY-E-ENABLE` AUTHORIZED — its production-enable audit must satisfy L3 + L4 from the start
- `OPS-MCP-AUDIT-SCHEMA-V2` deferred; file only if linter heuristics accumulate too many special cases
- `OPS-MCP-SMOKE-LINT-CI-WIRING` AUTHORIZED to file as a follow-on (if CI deferred this card)

---

## 14. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md` | Designer plan |
| `scripts/ops/audit-lint.mjs` (NEW) | Runner |
| `scripts/ops/audit-lint-rules.cjs` (NEW) | Rule data |
| `__tests__/opsAuditLint.test.ts` (NEW) | Unit + fixtures |
| `__tests__/fixtures/audit-lint/*.md` (NEW; 4 files) | Self-validation centerpiece |
| `docs/ops/AUDIT-LINT.md` (NEW) | Operator doc |
| Smoke-template additive update | Adds marker + final lint step + L3 section |
| CI wiring (likely deferred PARTIAL) | Follow-on if trigger 9 fires |
| `docs/audits/OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE-<date>.md` | Post-merge audit (dogfooded) |

---

## 15. Execution order

1. Phase 0 pre-flight (DONE; this brief is the artifact)
2. Stage 0 — commit + push intent brief to main
3. Phase B — create `feat/OPS-MCP-SMOKE-DOCTRINE-HARDENING` branch + GitHub issue
4. Stage 1 — designer subagent (4 Phase A audits)
5. Stage 2 — conditional HALT eval (auto-proceed; surface only on trigger 9 → expected fire → defer CI)
6. Stage 3 — implementer subagent (5-commit cadence; TUNE fixtures to expected)
7. Stage 4 — reviewer subagent (16-item; H-K fixtures existential)
8. Stage 5 — PR + squash-merge + post-merge gates
9. Post-merge smoke (5-phase incl. Phase 1 fixture centerpiece + Phase 5 dogfood)
10. INTER-CARD authorizations (Family F + EDGE-FAMILY-E-ENABLE + future CI-wiring follow-on)
