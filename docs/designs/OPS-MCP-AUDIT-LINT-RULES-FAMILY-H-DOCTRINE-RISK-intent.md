# OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — Intent brief (Card 2 of 3-card suite)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Audit-lint DATA-only — append `family_h` (+ `claim_clarity` + the highest-doctrine-risk H classifier key) to `DOCTRINE_RISK_FAMILIES` Set in `scripts/ops/audit-lint-rules.cjs` so L5 enforcement fires on every Family H smoke audit doc going forward.
**Suite:** Card 1 (MCP-SERVER-009-FAMILY-H, admin ship) → Gate A (smoke PASS) → **Card 2 (this card, L5 mechanization)** → Gate B (smoke PASS) → Card 3 (MCP-021C-EDGE-FAMILY-H-ENABLE, production-enable).
**Predecessor:** Card 1 smoke PASS on main; `family_h` MCP server family operational in admin_validation mode.
**Trail:** Umbrella issue #388. Card issue #390.

---

## 1. Goal

Mechanize L5 doctrine-risk enforcement for Family H. After this card lands on main, every audit doc that carries an `Audit-Lint: v1` marker AND mentions `family_h` (or `claim_clarity` or the highest-doctrine-risk H classifier key) MUST inspect persisted `evidence_span` rows in its Phase 4b. Audit docs that fail to do so exit 1 at `node scripts/ops/audit-lint.mjs` (CI-mechanical for Family H from this point forward).

The card is structurally identical to OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK (G's audit-lint card). DATA-only — no logic change in `scripts/ops/audit-lint.mjs` or `audit-lint-lib.cjs`.

---

## 2. Scope (IN / OUT)

**IN**
- One DATA edit to `scripts/ops/audit-lint-rules.cjs`: append `'family_h'`, `'claim_clarity'`, and the highest-doctrine-risk H classifier key [OPERATOR DECISION NEEDED: select from Card A design — likely one of `conclusion_missing`, `reason_missing`, `claim_specificity_low`, `unclear_reference_present`] to the `DOCTRINE_RISK_FAMILIES` Set.
- HALT 11 (chain-binding): `family_h` MUST be in the appended set; adding only `claim_clarity` is a silent no-op for real H docs.
- 3 NEW fixtures under `__tests__/fixtures/auditLintFixtures/` per the E/F/G precedent: (a) original-PARTIAL byte-copy of Card A's smoke audit if consistent-PARTIAL; (b) amendment-PASS hand-authored; (c) IMPROPER-PASS-no-evidence-span synthetic teeth.
- ~11 new tests in `__tests__/opsAuditLint.test.ts`: 3 membership (each of the 3 new entries), 1 preservation (Family A–G entries still present), 1 `detectFamily()` → `family_h` trap, 3 L5 firing/non-firing for `family_h`, 3 fixture self-validation including L5-only teeth.
- Operator follow-up smoke template: `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-template.md`.

**OUT**
- NO logic change in `scripts/ops/audit-lint.mjs` or `scripts/ops/audit-lint-lib.cjs` (DATA-ONLY).
- NO `mapFamilyLetterToName` change.
- NO change to `.github/workflows/audit-lint.yml` (CI workflow already covers L1-L6 uniformly).
- NO Family A–G test fixture modification.
- NO new dependency.
- NO change to `docs/ops/AUDIT-LINT.md` beyond adding H to the "Adding a doctrine-risk family" example list.

---

## 3. Binding decisions (D1–D5)

**D1 — Three set entries added.** `family_h` (load-bearing alias for `detectFamily()`) + `claim_clarity` (canonical Edge name) + ONE highest-doctrine-risk classifier key [OPERATOR DECISION NEEDED: confirm choice].

**D2 — Family-A/B/C/D/E/F/G entries byte-equal preserved.** Set preservation test pins this (one of the 11 new tests).

**D3 — Fixture provenance.** Original-PARTIAL fixture is a byte-equal copy of Card A's smoke audit IF the smoke verdict was PARTIAL; otherwise hand-authored to match the IMPROPER-PASS-no-evidence-span structure. [OPERATOR DECISION NEEDED: confirm fixture origin after Card A smoke completes].

**D4 — Test forecast: +10 to +15 net tests** (HALT 8 ceiling +30; G shipped +11; H mirrors).

**D5 — Smoke template carries `Audit-Lint: v1` marker AND must self-lint clean** (5-phase smoke per the audit-lint pattern: membership + preservation + detectFamily + L5 firing + fixture self-validation).

---

## 4. Test forecast

[OPERATOR DECISION NEEDED: confirm — designer produces binding number]
- Forecast: +10 to +15 net Jest tests in `__tests__/opsAuditLint.test.ts`.
- HALT 8 ceiling: > +30.

---

## 5. HALT triggers (numbered, binding)

1. **HALT 1** — Required-reading missing.
2. **HALT 2** — Standard preflight not green.
3. **HALT 6** — roadmap-reviewer returns BLOCK.
4. **HALT 7** — Adversarial Explore (L5 teeth verification) finds blocking refutation.
5. **HALT 8** — Test delta > +30.
6. **HALT 9** — Card A smoke was FAIL or PARTIAL-with-no-evidence-span-claim (Card B's L5 enforcement would then have nothing to enforce against; chain pauses).
7. **HALT 11** (chain-binding) — `family_h` alias missing from the added set.

---

## 6. Hard guardrails

- DATA-only edit (`scripts/ops/audit-lint-rules.cjs`). NO logic change.
- NO `.github/workflows/` edit.
- NO `docs/ops/AUDIT-LINT.md` substantive rewrite (additive example only).
- NO Family A–G fixture touch.
- NO new dependency; `package.json` byte-equal.

---

## 7. Process

1. **Designer** writes `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK.md` (faithful G replica with H substitutions).
2. **Implementer** on `feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK`.
3. **Reviewer** writes `docs/reviews/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK.md`.
4. Adversarial Explore × 1 (L5 teeth verification) after APPROVE.
5. **PR open + HARD STOP at operator merge gate.**
6. Operator merges, runs 5-phase audit-lint smoke, authors `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-<date>.md` with PASS.
7. Smoke PASS unblocks Card 3 (production-enable).

---

## 8. Post-merge smoke skeleton

- **Phase 1** — membership: `family_h` + `claim_clarity` + classifier-key entries present in Set.
- **Phase 2** — preservation: Family A–G entries byte-equal.
- **Phase 3** — `detectFamily()` returns `family_h` for a Family H titled doc.
- **Phase 4** — L5 fires (exit 1) on a Family H audit doc that lacks `evidence_span` inspection language; L5 does NOT fire on a doc that includes it.
- **Phase 5** — 3 fixture self-validation: original-PARTIAL fixture → exits as the fixture's encoded verdict; amendment-PASS → exit 0; IMPROPER-PASS-no-evidence-span teeth → exit 1.

Smoke verdict authority: PASS (unblocks Card 3) | PARTIAL (chain pauses) | FAIL (chain stops).
