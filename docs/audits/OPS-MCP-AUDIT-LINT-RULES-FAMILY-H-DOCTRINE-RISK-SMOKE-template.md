# OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE — Post-merge smoke (TEMPLATE)

Audit-Lint: v1

**Date:** 2026-05-31
**Operator:** Kyler
**Card:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK (Card 2 of 3-card H chain)
**Predecessor:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK (2026-05-29)
**Verdict:** TBD (implementer fills in post-merge)

---

## Phase 1 — Preflight (Set additions present)

**Status:** TBD

Required:
- `DOCTRINE_RISK_FAMILIES.has('claim_clarity')` → true
- `DOCTRINE_RISK_FAMILIES.has('family_h')` → true
- `DOCTRINE_RISK_FAMILIES.has('claim_specificity_low')` → true

Verification command:

```
node -e "const r = require('./scripts/ops/audit-lint-rules.cjs'); console.log({ claim_clarity: r.DOCTRINE_RISK_FAMILIES.has('claim_clarity'), family_h: r.DOCTRINE_RISK_FAMILIES.has('family_h'), claim_specificity_low: r.DOCTRINE_RISK_FAMILIES.has('claim_specificity_low') });"
```

---

## Phase 2 — Preservation (Family A–G byte-equal)

**Status:** TBD

Required:
- `argument_scheme`, `slippery_slope` present (E)
- `critical_question`, `family_f`, `consequence_probability_unclear` present (F)
- `resolution_progress`, `family_g`, `concedes_broader_point` present (G)
- Set size = 11 (was 8 after G; +3 for H = 11)

---

## Phase 3 — detectFamily H → family_h

**Status:** TBD

Required: a canonical `MCP-SERVER-009-FAMILY-H-SMOKE` title detects as `family_h` (NOT `claim_clarity`).

Verification command:

```
node -e "const lib = require('./scripts/ops/audit-lint-lib.cjs'); console.log(lib.detectFamily('# MCP-SERVER-009-FAMILY-H-SMOKE - Post-merge audit', 'Phase 4b deferred.'));"
```

---

## Phase 4 — L5 firing/non-firing

**Status:** TBD

Required:
- Family-H titled doc WITHOUT `evidence_span` inspection → exit 1 with `L5` finding
- Family-H titled doc WITH `evidence_span` inspection → exit 0
- Family-H titled doc with verdict PASS that names `evidence_span` → exit 0 (consistent-PASS)

Verification: see the L5-firing tests in
`__tests__/opsAuditLint.test.ts` § "OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — L5 fires for family_h".

---

## Phase 5 — Fixture self-validation

**Status:** TBD

Required: 13 fixtures lint to expected outcomes (`1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1`):

| # | Fixture | Expected exit | Expected family | Notes |
| --- | --- | --- | --- | --- |
| 1 | `original-family-e-IMPROPER-PASS.md` | 1 | `argument_scheme` | UNCHANGED |
| 2 | `family-e-amendment-PARTIAL.md` | 0 | `argument_scheme` | UNCHANGED |
| 3 | `family-e-hosted-completion-PASS.md` | 0 | `argument_scheme` | UNCHANGED |
| 4 | `family-d-strengthened-amendment-PASS.md` | 0 | (none) | UNCHANGED |
| 5 | `family-f-original-PARTIAL.md` | 0 | `family_f` | UNCHANGED |
| 6 | `family-f-amendment-PASS.md` | 0 | `family_f` | UNCHANGED |
| 7 | `family-f-IMPROPER-PASS-no-evidence-span.md` | 1 | `family_f` | UNCHANGED (`[L5]` only) |
| 8 | `family-g-original-PARTIAL.md` | 0 | `family_g` | UNCHANGED |
| 9 | `family-g-amendment-PASS.md` | 0 | `family_g` | UNCHANGED |
| 10 | `family-g-IMPROPER-PASS-no-evidence-span.md` | 1 | `family_g` | UNCHANGED (`[L5]` only) |
| 11 | `family-h-original-PASS.md` | 0 | `null` | NEW (Card 1 H smoke baseline; title-format quirk) |
| 12 | `family-h-amendment-PASS.md` | 0 | `family_h` | NEW (representative amendment with persisted inspection) |
| 13 | `family-h-IMPROPER-PASS-no-evidence-span.md` | 1 | `family_h` | NEW (teeth: `[L5]` only) |

---

## Phase 6 — Regression

**Status:** TBD

Required:
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `npx jest --testPathPattern="opsAuditLint" --no-coverage` → exit 0
- `npm run test` → exit 0; full suite passes

---

## Phase 7 — Dogfood

**Status:** TBD

Required: this smoke audit doc lints itself clean (`Audit-Lint: v1` marker; exit 0).

NB: the smoke audit doc title uses the canonical
`OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE` form (no `-FAMILY-H`
letter substring), so it does NOT trigger family-detect; it detects as
audit-type `ops` per the existing `AUDIT_TYPE_PATTERNS.ops` `/^#\s*OPS-/im`
pattern — same behavior as the G smoke audit doc.

---

## Final verdict: TBD

Smoke verdict authority: PASS (unblocks Card 3) | PARTIAL (chain pauses) |
FAIL (chain stops).

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
