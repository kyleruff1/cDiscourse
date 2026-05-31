# OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31
**Branch:** feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK
**Design:** docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK.md
**Card type:** DATA-only (no logic, no migration, no Edge Function, no deploy)

## Summary

Family H L5 doctrine-risk mechanization shipped clean as a faithful DATA-only
replica of the Family G template byte-for-byte. The 3-string set addition
(`claim_clarity` + `family_h` + `claim_specificity_low`) lands after G's block
with a parallel 10-line comment; 3 new fixtures (byte-copy original-PASS +
hand-authored amendment-PASS + synthetic improper-PASS-teeth) prove the L5
mechanization bites only on the negative control; the synthetic teeth fixture
trips findings `['L5']` ONLY (L1/L2/L6 do not fire). Empirical probe in the
design's Evidence section confirmed the `family_h` alias is load-bearing — the
synthetic improper-PASS wrongly exits 0 without it and correctly exits 1
`['L5']` with it. The Card 1 H smoke title-format quirk
(`# MCP-SERVER-009 Family H smoke — 2026-05-31` — space-separated, lower-case)
is preserved verbatim in the byte-copy fixture as documented limitation, not a
regression. All carry-forward invariants byte-equal. Test suite 18751 → 18762
(+11; matches design forecast exactly; HALT 8 +30 ceiling not approached).
Operator can push and open the PR.

## Verification

| Check | Result |
| --- | --- |
| typecheck | pass (exit 0) |
| lint | pass (exit 0) |
| test | pass — 18762/18762 tests, 594/594 suites (delta 18751 → 18762 = +11) |
| focused audit-lint suite | 169 tests pass (delta 158 → 169 = +11) |
| secret scan | clean — only `<admin JWT redacted>` literal placeholders in fixtures (mirrors F/G amendment-PASS shape; opt-out marker present) |
| doctrine scan | clean — `true`/`false` hits are `.toBe(true)` / `.toBe(false)` Jest boolean assertions and L5 verdict-blind documentation, not user-facing copy |
| service-role / direct arguments insert | none found |
| Migration apply | N/A — no migration in this card (documented absence per chain prompt) |

## Design conformance

- [x] All design file-changes present (9 files match the diff exactly)
- [x] No undocumented file-changes
- [x] Data model matches design (Set additions in exact order; comment block parallel to G)
- [x] API contracts match design (no callable surface change; pure DATA edit)
- [x] Implementer's 1 declared deviation (`docs/ops/AUDIT-LINT.md` not touched) is justifiable — the brief's ALLOWED-list excludes `docs/ops/AUDIT-LINT.md`, and the test-asserted self-validation contract (`__tests__/fixtures/audit-lint/README.md`) IS updated with H rows + title-format-trap note. The ops-doc would be cosmetic and non-load-bearing.

## Doctrine self-check (all confirmed)

- [x] No truth/winner/loser language in user-facing strings — N/A; the linter is operator-facing process gate, not user surface
- [x] Score never blocks posting — N/A; no scoring touched
- [x] No service-role in client code — none added; pure DATA module
- [x] No direct insert into public.arguments — none
- [x] No AI calls in production app paths — pure regex + text, no fetch, no LLM
- [x] Plain language only — N/A; internal codes (`family_h`, `claim_clarity`, `claim_specificity_low`) live in operator rules file only, never surfaced to end users
- [x] Epic 12 / audit-lint doctrine (`cdiscourse-doctrine` §3 evidence-doctrine): L5 mechanizes "factual standing requires persisted evidence" inspection for doctrine-risk families; extending to H is the canonical use of this gate
- [x] Observations vs Allegations (§10a): N/A — no node label, no AnnotationChipDescriptor, no UI surface

## Test coverage (against critical review lenses)

### Lens 1 — `family_h` alias present (HALT 5 binding)

**PASS.** Confirmed at `scripts/ops/audit-lint-rules.cjs:90` — `'family_h'`
is the second of three additions in the appended block. Membership test pins
`DOCTRINE_RISK_FAMILIES.has('family_h')`; detectFamily A.1-trap pin asserts
`# MCP-SERVER-009-FAMILY-H-SMOKE` title detects as `'family_h'` (not
`'claim_clarity'`); set-size pin to 11 catches any silent drop.

### Lens 2 — Synthetic H L5 teeth fixture (HALT 6 binding)

**PASS.** `family-h-IMPROPER-PASS-no-evidence-span.md` confirmed zero matches
for all 5 L5 inspection patterns (`evidence_span` bare / SELECT-prefix /
table-pipe / `persisted evidence` / `direct-output inspection`). Test asserts
`exitCode === 1`, `ruleIds.toContain('L5')` AND
`not.toContain('L1'|'L2'|'L6')` (teeth precision). Synthetic is `AMENDMENT`-
typed → empty required-phase set → no L1; no L2 phrases; L6 provenance
intact → only L5 fires. Empirical probe in design §"Teeth proof" confirms
load-bearing: without `family_h`, synthetic wrongly exits 0; with
`family_h`, fails `['L5']` only.

### Lens 3 — E/F/G fixtures unchanged (HALT 7 binding)

**PASS.** `git diff origin/main..HEAD -- __tests__/fixtures/audit-lint/` shows
only 4 entries: 3 NEW H fixtures + README modified. All 10 prior fixtures
byte-equal. `preserves the existing Family E + F + G doctrine-risk members`
test enumerates all 8 prior members + pins set size at exactly 11.

### Lens 4 — No runtime / Edge / migration / package.json change

**PASS.** Verified `git diff --stat` is empty for `scripts/ops/audit-lint.mjs`,
`scripts/ops/audit-lint-lib.cjs`, `.github/workflows/audit-lint.yml`,
`package.json`, `package-lock.json`, `mcp-server/`, `supabase/`, `src/`.
`mapFamilyLetterToName` not touched.

### Lens 5 — Real-PASS regression (Card 1 byte-copy preserves on-main behavior)

**PASS.** `family-h-original-PASS.md` line 2 title `# MCP-SERVER-009 Family H
smoke — 2026-05-31` matches the on-main `12ec7eb` audit byte-for-byte
(verified via `git show 12ec7eb:…`). Test asserts `exitCode === 0`,
`findings.toHaveLength(0)`, `parsed.family === null`,
`parsed.auditType === 'unknown'`. Test description explicitly names the
title-format reason for `family: null`. README under `__tests__/fixtures/
audit-lint/` carries the "H title-format trap" note + extraction recipe.
This is the load-bearing on-main-preservation guard.

### Lens 6 — `claim_specificity_low` axis-partner correctness

**PASS.** Per Card 1 H design `docs/designs/MCP-SERVER-009-FAMILY-H.md`
§ A.1.4 the H axis-partner key is `claim_specificity_low` — the HIGHEST
verdict-adjacency among the 4 HIGHEST-risk keys (a broad claim is most
likely to be mis-framed as "weak/vague/lazy/sloppy"). This is the canonical
H analog of E's `slippery_slope` / F's `consequence_probability_unclear` /
G's `concedes_broader_point`. The other 3 HIGHEST-risk keys
(`conclusion_missing`, `reason_missing`, `unclear_reference_present`) are
correctly NOT added per G precedent (add only the single canonical
axis-partner).

## Test count

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Total tests | 18751 | 18762 | +11 |
| Suites | 593 | 594 | +1 (the 3 new H fixture files affect existing suite; new tests in opsAuditLint.test.ts) |
| opsAuditLint suite | 158 | 169 | +11 |

Delta matches design forecast (+11) exactly. HALT 8 ceiling (+30) not
approached.

## Carry-forward invariants verified byte-equal

- `scripts/ops/audit-lint.mjs` — 0 lines
- `scripts/ops/audit-lint-lib.cjs` (incl. `mapFamilyLetterToName`) — 0 lines
- `.github/workflows/audit-lint.yml` — 0 lines
- `package.json` / `package-lock.json` — 0 lines
- `mcp-server/` — 0 lines
- `supabase/` — 0 lines
- `src/` — 0 lines
- 10 existing E/F/G fixtures — 0 lines
- E/F/G entries in `DOCTRINE_RISK_FAMILIES` — preserved byte-equal (only 13
  lines appended after `'concedes_broader_point',`)

## Blockers

None.

## Suggestions (non-blocking)

1. The amendment-PASS fixture (line 28) contains the literal string
   `Authorization: Bearer <admin JWT redacted>` inside a fenced code block.
   This is a redacted placeholder, not a secret, and mirrors F/G amendment-
   PASS shape exactly. If a future hardening pass extends `scripts/ops/
   audit-lint-lib.cjs` to also flag `Bearer ` literals (regardless of
   `<redacted>`), F/G/H amendment-PASS fixtures would all need to be edited
   in lockstep. Out of scope for this card; noted for future doctrine-
   hardening cards.
2. The Card 1 H smoke title-format trap could be retroactively closed by
   amending the on-main `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-
   2026-05-31.md` to use the canonical `MCP-SERVER-009-FAMILY-H-SMOKE` /
   `-FAMILY-H-AMENDMENT` title format. This is operator-deferred per the
   design's "Out of scope" §; recommended for Card 3 production-enable
   smoke to use the canonical format (the design explicitly flags this).
3. Test count delta could potentially have been published one round larger
   by also pinning the post-state `findings.length` for the synthetic
   teeth case (currently asserts only `not.toContain`). Non-load-bearing;
   the existing precision is sufficient.

## Operator next steps

1. Push the branch:
   ```
   git push -u origin feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK
   ```
2. Open PR:
   ```
   gh pr create --title "OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK: Family H L5 doctrine-risk mechanization (DATA-only)" --body-file docs/reviews/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK.md
   ```
3. Deploy: **none required.** Pure code+docs+tests; no DB, no Edge Function,
   no env var. The Supabase GitHub integration auto-deploys on merge but is
   a no-op for this card.
4. Post-merge smoke (operator/implementer): run the 5-phase smoke per
   `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-template.md`
   and author `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-2026-05-31.md`
   carrying `Audit-Lint: v1` (self-lints clean exit 0).
5. Post-merge worktree cleanup (commands in
   `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup
   (operator step)").
6. Card 3 of the 3-card H chain (`MCP-021C-EDGE-FAMILY-H-ENABLE` —
   production-enable smoke + Edge family flip) is unblocked by this card's
   smoke PASS. Card 3 MUST use the canonical
   `MCP-SERVER-NNN-FAMILY-H-SMOKE` / `-AMENDMENT` title format to be
   L5-protected (the Card 1 title-format trap is a one-time documented
   limitation; do not repeat it).

## Chain prompt §HALT 11 status

CHANGES-REQUESTED / BLOCK = none. Card proceeds to operator push + PR + smoke.
