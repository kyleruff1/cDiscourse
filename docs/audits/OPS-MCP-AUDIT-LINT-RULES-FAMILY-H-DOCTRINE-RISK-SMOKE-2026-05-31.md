# OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK smoke — 2026-05-31

Audit-Lint: v1

## Header

- **Date:** 2026-05-31
- **Operator:** Kyler (via CC autonomous chain — DATA-only card; chain prompt §4 authorizes direct self-author)
- **Card:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK (Card 2 of 3-card H chain)
- **Issue:** #390 (under umbrella #388)
- **Merge:** PR #403 → commit `c5bea3b`
- **Predecessor:** MCP-SERVER-009-FAMILY-H Card 1 (#400 / `3097521`) + Card 1 smoke audit PASS (#402 / `12ec7eb`)
- **Verdict:** **PASS**

This is a DATA-only mechanization card. No runtime code change; no provider spend; no Edge Function deploy. Smoke runs entirely against on-main static state via `node scripts/ops/audit-lint.mjs` invocations + `grep`/`git` confirmation. Per chain prompt §4: data-only cards with no provider spend may have CC author the smoke audit directly.

---

## Phase 1 — Set membership (3 new H entries present on main)

`scripts/ops/audit-lint-rules.cjs` at commit `c5bea3b` contains all 3 H additions in the appended block after Family G:

```
'claim_clarity',
'family_h',
'claim_specificity_low',
```

**Verification:** `grep -E "'(claim_clarity|family_h|claim_specificity_low)'" scripts/ops/audit-lint-rules.cjs` returned all 3 entries. ✅

---

## Phase 2 — Preservation (E + F + G byte-equal; total set size = 11)

The full `DOCTRINE_RISK_FAMILIES` Set on main now contains exactly 11 entries:

```
'argument_scheme'                  (E canonical)
'slippery_slope'                   (E axis-partner)
'critical_question'                (F canonical)
'family_f'                         (F load-bearing alias)
'consequence_probability_unclear'  (F axis-partner)
'resolution_progress'              (G canonical)
'family_g'                         (G load-bearing alias)
'concedes_broader_point'           (G axis-partner)
'claim_clarity'                    (H canonical — NEW)
'family_h'                         (H load-bearing alias — NEW)
'claim_specificity_low'            (H axis-partner — NEW)
```

**Verification:** `grep -c` for the union of all 11 strings returned 11. E + F + G entries byte-equal preserved (pre-merge `git diff origin/main..HEAD` showed only additions after `concedes_broader_point`, no E/F/G line modifications). ✅

---

## Phase 3 — `detectFamily()` → `family_h` for canonical-titled H docs

Audit-lint's family-detect regex (`/MCP-SERVER-\d+-FAMILY-([A-Z])/i`) emits `family_h` for any audit doc whose title matches the canonical `MCP-SERVER-NNN-FAMILY-H-...` form. Verified via:

```
$ node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-h-amendment-PASS.md
  title:       MCP-SERVER-009-FAMILY-H-AMENDMENT — Production-enable completion (representative)
  audit-type:  amendment
  verdict:     PASS
  findings:    0 (PASS)
exit=0
```

The fixture is canonical-titled → detectFamily emits `family_h` → `DOCTRINE_RISK_FAMILIES.has('family_h')` returns true → L5 enforcement applies → fixture contains `evidence_span` SQL block → L5 does NOT fire → 0 findings, exit 0. ✅

---

## Phase 4 — L5 firing (teeth fixture exercises the rule)

The synthetic-improper fixture exercises L5's teeth:

```
$ node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-h-IMPROPER-PASS-no-evidence-span.md
  title:       MCP-SERVER-009-FAMILY-H-AMENDMENT — SYNTHETIC improper PASS (doctrine fixture)
  audit-type:  amendment
  verdict:     PASS
  findings:    1
    [L5] Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).
exit=0
```

**Result:** Findings array contains exactly `['L5']` with the expected `Doctrine-risk audit does not inspect persisted direct output` message. The L5 rule **fires correctly** on the synthetic teeth fixture. The exit code from `audit-lint.mjs` is 0 because the tool emits findings as informational output (it's not a blocking-exit linter); the **binding gate is the findings array**, which the Jest tests assert directly via `expect(findings).toEqual(['L5'])` (per the adversarial verification at audit-authoring time, the Jest assertion confirms the teeth bite). ✅

The negative control (Phase 3 amendment fixture, which has `evidence_span` block) returned 0 findings — confirming L5 fires only when the inspection-pattern language is absent. The teeth are tight, not over-firing.

---

## Phase 5 — Fixture self-validation (3/3 H fixtures lint correctly)

All 3 new H fixtures lint to their expected verdicts:

| Fixture | Expected | Actual | Result |
|---|---|---|---|
| `family-h-original-PASS.md` (byte-copy of Card 1 smoke audit at `12ec7eb`) | exit 0 / `family: null` (title-format trap documented in `__tests__/fixtures/audit-lint/README.md`) | exit 0 / `family: null` / 0 findings | ✅ |
| `family-h-amendment-PASS.md` (hand-authored canonical with `evidence_span` SQL block) | exit 0 / `family: family_h` (Phase 3 above) | exit 0 / 0 findings | ✅ |
| `family-h-IMPROPER-PASS-no-evidence-span.md` (synthetic teeth) | findings array contains `'L5'` (Phase 4 above) | findings == `[L5]` | ✅ |

The full Jest suite `npx jest opsAuditLint` reports **169 tests / 169 passed** (158 baseline + 11 new H tests), exit 0. ✅

---

## Phase 6 — Card 1 on-main audit re-lint (documented limitation)

The on-main Card 1 H smoke audit (`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` at `12ec7eb`) was re-linted now that `family_h` is on main:

```
$ node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md
  title:       MCP-SERVER-009 Family H smoke — 2026-05-31
  audit-type:  unknown
  verdict:     PASS
  findings:    0 (PASS)
exit=0
```

**Result:** `family: null` (title uses space-separated form; doesn't match the canonical regex `/MCP-SERVER-\d+-FAMILY-([A-Z])/i`). L5 doesn't fire because the doctrine-risk gate short-circuits when `parsed.family` is null. This is the documented title-format trap surfaced by the designer + preserved by the byte-copy fixture `family-h-original-PASS.md`.

**Operator follow-up (separate amendment card, out of Card 2 scope):** a small PR can fix the Card 1 audit title to `# MCP-SERVER-009-FAMILY-H-SMOKE — 2026-05-31` (with dashes) to make `detectFamily()` properly emit `family_h` and have L5 fire — at which point this audit would surface an L5 finding because Phase 4b is operator-deferred (no `evidence_span` SQL ran with non-zero results). This is a follow-up consideration, not a Card 2 blocker.

Future H smoke audits authored with canonical titles (Card 3 production-enable, any subsequent H amendment) will properly L5-engage automatically.

---

## Phase 7 — audit-lint marker + verdict line

This document carries `Audit-Lint: v1` on line 3. Self-lint:

```
$ node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-2026-05-31.md
```

Must exit 0 before push.

---

## Final verdict: **PASS**

Card 2 ship goals met:
- ✅ 3 new H entries (`claim_clarity`, `family_h`, `claim_specificity_low`) appended to `DOCTRINE_RISK_FAMILIES` on main
- ✅ E + F + G entries byte-equal preserved (total set size 8 → 11)
- ✅ `detectFamily()` emits `family_h` for canonical-titled H docs
- ✅ L5 fires (findings == `['L5']`) on synthetic teeth fixture missing `evidence_span` inspection
- ✅ L5 does NOT fire on canonical H amendment with `evidence_span` (negative control passes)
- ✅ All 3 H fixtures lint to expected verdicts
- ✅ Full `opsAuditLint` Jest suite 169/169 pass
- ✅ No runtime / Edge / migration / `package.json` change (DATA-only)
- ✅ Documented title-format limitation surfaced + preserved as fixture

### Authorizations granted on PASS

- Card 3 (MCP-021C-EDGE-FAMILY-H-ENABLE, #391) **AUTHORIZED to begin**. Production-enable flip of Family H is the next chain step.

### Operator follow-ups (non-blocking)

- **(Optional)** Separate amendment card to fix the Card 1 smoke audit title from `MCP-SERVER-009 Family H smoke` to `MCP-SERVER-009-FAMILY-H-SMOKE` (with dashes). Currently preserved as a documented limitation; the byte-copy fixture surfaces this behavior. Fixing it would have Card 1 audit retroactively L5-enforce (and likely surface an L5 finding because Phase 4b is operator-deferred).
- Family H production-enable smoke (Card 3) will provide the binding `evidence_span` doctrine scan against production-mode H rows — that is the materially-performed inspection L5 was designed for.

### No HALT triggers fired
HALT 1-18 evaluated; 0 fired.
