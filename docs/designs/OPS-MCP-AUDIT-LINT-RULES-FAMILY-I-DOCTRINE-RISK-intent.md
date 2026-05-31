# OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — Intent brief (Card 2 of 3-card suite)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Audit-lint DATA-only — append `family_i` (+ `thread_topology` + the highest-doctrine-risk I classifier key, if any) to `DOCTRINE_RISK_FAMILIES` Set in `scripts/ops/audit-lint-rules.cjs`.
**Suite:** Card 1 (MCP-SERVER-010-FAMILY-I) → Gate A → **Card 2 (this card; CONDITIONAL)** → Gate B → Card 3 (MCP-021C-EDGE-FAMILY-I-ENABLE).
**Predecessor:** Card 1 smoke PASS. `family_i` MCP server family operational in admin_validation mode.
**Trail:** Umbrella issue #388. Card issue #393.

> **CONDITIONAL CARD.** Per Family I server intent §3 + §D11: if Card 1 A.1 finds Family I doctrine-risk = LOW, this card may be SKIPPED (chain reduces to 2 cards). Designer A.1's doctrine-risk verdict drives whether this card ships.

---

## 1. Goal

If doctrine-risk verdict from Card 1 A.1 is MEDIUM or HIGH: mechanize L5 doctrine-risk enforcement for Family I, mirroring the H pattern. Audit docs that mention `family_i` MUST inspect persisted `evidence_span` in Phase 4b.

If doctrine-risk verdict is LOW: SKIP this card; chain becomes 2-card (server → edge-enable).

---

## 2. Scope (IN / OUT) — applies only if shipped

**IN** (same as Family H audit-lint card, with `family_h` → `family_i`, `claim_clarity` → `thread_topology`, highest-risk H classifier key → highest-risk I classifier key)
- DATA edit to `scripts/ops/audit-lint-rules.cjs`: append `family_i`, `thread_topology`, and the highest-risk I classifier key [OPERATOR DECISION NEEDED: select from Card 1 design — likely one of `introduces_new_issue` / `returns_to_prior_issue` if any are MEDIUM+].
- 3 fixtures + ~11 tests per H pattern.
- Smoke template `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE-template.md`.

**OUT**
- Same OUT list as the H audit-lint card.

---

## 3. Binding decisions (D1–D5)

Mirror the H audit-lint card's D1–D5. The only divergence is the 3 set entries (`family_i` / `thread_topology` / classifier-key) and the fixture provenance (drawn from Card 1 I smoke audit).

---

## 4. Test forecast

+10 to +15 net Jest tests; HALT 8 ceiling +30.

---

## 5. HALT triggers

Same numbered HALTs as the H audit-lint card.
- **HALT 11** (chain-binding) — `family_i` alias missing from the added set.

---

## 6. Hard guardrails

DATA-only edit; no logic change; no `.github/workflows/` edit.

---

## 7. Process

Designer → implementer → reviewer → adversarial × 1 (L5 teeth verification for `family_i`) → PR → operator merge → smoke.

---

## 8. Post-merge smoke skeleton

Same 5-phase structure as the H audit-lint smoke. Phase 4 verifies L5 fires (exit 1) on a Family I audit doc that lacks `evidence_span` inspection, and does NOT fire when it includes it.
