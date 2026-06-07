# OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE — Post-merge smoke (TEMPLATE)

Audit-Lint: v1

**Date:** 2026-06-07
**Operator:** Kyler
**Card:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK (Card 2 of 3-card I chain; operator-override ship despite LOW doctrine-risk)
**Predecessor:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK (#403)
**Verdict:** TBD (implementer fills in post-merge)

## Phase 1 — Preflight (Set additions present)

**Status:** TBD

Required:
- DOCTRINE_RISK_FAMILIES.has('thread_topology') → true
- DOCTRINE_RISK_FAMILIES.has('family_i') → true
- DOCTRINE_RISK_FAMILIES.has('compares_options') → true  (3-entry default; omit if 2-entry form elected)

Verification command:

```
node -e "const r = require('./scripts/ops/audit-lint-rules.cjs'); console.log({ thread_topology: r.DOCTRINE_RISK_FAMILIES.has('thread_topology'), family_i: r.DOCTRINE_RISK_FAMILIES.has('family_i'), compares_options: r.DOCTRINE_RISK_FAMILIES.has('compares_options') });"
```

## Phase 2 — Preservation (Family A–H byte-equal)

**Status:** TBD

Required:
- argument_scheme, slippery_slope (E); critical_question, family_f, consequence_probability_unclear (F); resolution_progress, family_g, concedes_broader_point (G); claim_clarity, family_h, claim_specificity_low (H) all present.
- Set size = 14 (was 11 after H; +3 for I = 14). [2-entry form: 13.]

## Phase 3 — detectFamily I → family_i

**Status:** TBD

Required: a canonical MCP-SERVER-010-FAMILY-I-SMOKE title detects as family_i (NOT thread_topology).

Verification command:

```
node -e "const lib = require('./scripts/ops/audit-lint-lib.cjs'); console.log(lib.detectFamily('# MCP-SERVER-010-FAMILY-I-SMOKE - Post-merge audit', 'Phase 4b deferred.'));"
```

## Phase 4 — L5 firing/non-firing (doctrine teeth)

**Status:** TBD

This is the binding doctrine-teeth phase. The persisted direct-output
inspection requirement is the same evidence_span readback obligation L5
enforces on every doctrine-risk family audit: a family_i-titled doc must
inspect the persisted evidence_span column before a PASS verdict is valid.

Required:
- Family-I titled doc WITHOUT evidence_span inspection → exit 1 with L5 finding (the teeth FIRE).
- Family-I titled doc WITH evidence_span inspection → exit 0 (the teeth do NOT fire).
- Family-I titled doc with verdict PASS that names evidence_span → exit 0 (consistent-PASS).

Verification commands:

```
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-i-IMPROPER-PASS-no-evidence-span.md   # expect exit 1, [L5]
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-i-amendment-PASS.md                    # expect exit 0
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-i-consistent-PARTIAL.md                # expect exit 0
```

The teeth-FIRES case proves a careless future canonical-titled I audit that
declares PASS without a persisted evidence_span readback is mechanically
rejected. The teeth-does-NOT-fire case proves a legitimate I audit that
performs the persisted evidence_span inspection passes cleanly.

## Phase 5 — Fixture self-validation (16 fixtures)

**Status:** TBD

Required: 16 fixtures lint to expected outcomes (1,0,0,0,0,0,1,0,0,1,0,0,1,0,0,1).
The 13 existing fixtures keep their outcomes byte-equal; the 3 new I fixtures
exit 0,0,1.

## Phase 6 — Regression

**Status:** TBD

Required: npm run typecheck → 0; npm run lint → 0; npx jest --testPathPattern="opsAuditLint" --no-coverage → 0 (180 tests); npm run test → 0.

## Phase 7 — Dogfood

**Status:** TBD

Required: this smoke audit doc lints itself clean. The title uses the canonical
OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE form (no MCP-SERVER-NNN-FAMILY-I
letter substring), so it detects as audit-type ops (per AUDIT_TYPE_PATTERNS.ops
`/^#\s*OPS-/im`), NOT family_i. Because this doc mentions family_i and names the
persisted evidence_span inspection obligation (Phase 4 above), it satisfies the
L5 inspection-pattern check by construction even if a future detector change
were to classify it as a doctrine-risk family.

## Final verdict: TBD

Smoke verdict authority: PASS (unblocks Card 3) | PARTIAL (chain pauses) | FAIL (chain stops).

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
