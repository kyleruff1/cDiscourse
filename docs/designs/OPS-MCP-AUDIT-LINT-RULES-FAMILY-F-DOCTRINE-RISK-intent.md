# OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — Intent brief

**Operator:** Kyler
**Date:** 2026-05-28
**Card type:** audit-lint RULES card — **data-and-tests**, not logic-and-runtime.
**Predecessor chain state (verified Phase 0):**
- `MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT` PASS at `deff068`
- `MCP-SERVER-007-FAMILY-F-SMOKE` PARTIAL at `5591b76`
- `MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE` PASS at `1ca701a`
- `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE` PASS at `6395023` (F now production)
- `OPS-MCP-SMOKE-DOCTRINE-HARDENING` shipped at `91a3664`; audit-lint CI live and green.

> This brief is the operator framing for the card. It includes operator
> pre-flight findings (§3, §5, §6) that the designer subagent MUST
> independently re-confirm in Stage 1's four Phase A audits — they are
> guidance to de-risk the card, not a substitute for the designer's own
> reading of `audit-lint-lib.cjs`.

---

## 1. Motivation

Family F (`critical_question`) doctrine was proven **live** by operator
smoke — `MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT` (`deff068`), Phase 4b:
3 live adversarial submit-argument runs, 9 persisted rows, ≥1 clean
firing, **0 banned tokens across a 16-pattern ban-list scan**, and the
existential adversarial test (F3 input contained "fallacy" twice; the
persisted `evidence_span` output did NOT echo it). That proof lifted the
predecessor PARTIAL cap to PASS.

But that proof lives in **operator discipline**, not in the linter. The
audit-lint L5 rule currently classifies only Family E
(`argument_scheme` / `slippery_slope`) as doctrine-risk. It does **not**
classify Family F. So a *future* F-prefix smoke audit could mark verdict
PASS without any persisted `evidence_span` inspection and the linter
would let it through — exactly the class of defect L5 exists to catch
(the `29f30b0` Family E improper-PASS that motivated
`OPS-MCP-SMOKE-DOCTRINE-HARDENING`).

This card converts the Family F doctrine proof from operator-discipline
into **mechanical L5 enforcement**: add Family F / `critical_question`
to the doctrine-risk family set so L5 mechanically requires persisted
direct-output (`evidence_span`) inspection for any future doctrine-risk
F audit, the same way it already does for Family E.

---

## 2. Exact scope (STRICT SCOPE)

**Allowed edits:**
- `scripts/ops/audit-lint-rules.cjs` — the doctrine-risk family **DATA**
  list (`DOCTRINE_RISK_FAMILIES`) only.
- `__tests__/opsAuditLint.test.ts` — new rule + fixture tests; the
  `FIXTURE_FILES` array and the fixture-count assertion necessarily
  change (4 → 7).
- `__tests__/fixtures/audit-lint/*.md` — 3 NEW fixtures (2 static
  copies + 1 synthetic). The fixture `README.md`'s "exactly 4 / four
  motivating arc docs" prose + expected-outcomes table become stale on
  3-fixture add; updating them keeps the self-validation contract
  coherent (designer §A.3 to rule on whether this falls inside the
  `*.md` allowance or is a documented scope clarification).
- `docs/ops/AUDIT-LINT.md` — enhance the existing "Adding a
  doctrine-risk family" section (lines ~192–214) with the Family F
  lessons (the alias-the-detector-needs trap; the consistent-PARTIAL
  mechanism).
- `docs/core/current-status.md` — handoff.
- `docs/designs/` + `docs/audits/` docs for this card.

**Do NOT touch:**
- `scripts/ops/audit-lint.mjs` LOGIC or `scripts/ops/audit-lint-lib.cjs`
  LOGIC. (If the designer proves a data-only change is impossible, that
  is a HALT-and-surface per §8 trigger 10 — NOT a silent edit.)
- `mcp-server/**`, `supabase/functions/**` runtime files.
- `src/features/nodeLabels` taxonomy files.
- Family A–F prompts or keys.
- Production registry flags. Source 6 policy.
- `package.json` / `package-lock.json` (RO-36 ratchet).
- `.github/workflows/audit-lint.yml` (CI wiring is correct; no change).
- The 4 existing audit-lint fixtures (must remain byte-equal and keep
  producing exits 1, 0, 0, 0).

---

## 3. No runtime changes (Decision 3 — data-only)

The `.mjs` runner and the `.cjs` LOGIC library are **untouched**. The
only production-source change is adding entries to the
`DOCTRINE_RISK_FAMILIES` `Set` in `audit-lint-rules.cjs` (pure data).

**Operator pre-flight finding (designer to confirm in A.1 + A.2):**

- **A.1 — detection mechanism.** `applyL5` decides doctrine-risk via
  `parsed.family` ∈ `DOCTRINE_RISK_FAMILIES` (or a doc-level
  `Doctrine-risk: true` override). `parsed.family` comes from
  `detectFamily(title, body)`, which for a `MCP-SERVER-NNN-FAMILY-X`
  title maps the letter via `mapFamilyLetterToName`. **That mapper has
  no `F` case** — letter F hits the `default` branch and returns
  **`family_f`**, NOT `critical_question`. Empirically confirmed: both
  real F audit docs parse to `family: family_f`. Therefore the
  load-bearing alias to add is **`family_f`** (the string the detector
  actually emits). Adding `critical_question` alone would be a **no-op**
  for the real F docs. The card's stated intent ("add
  `critical_question`") is satisfied by adding BOTH `critical_question`
  (the canonical key name; also covers any doc that declares
  `Family: critical_question`) AND `family_f` (the detector's real
  output). The F doctrinal-axis partner key
  `consequence_probability_unclear` is the exact parallel of
  `slippery_slope` for E (only reachable via a `Family:` declaration);
  designer to decide whether to include it for parallelism. **Do NOT add
  an alias the detector cannot emit and do NOT touch
  `mapFamilyLetterToName` (logic).**

- **A.2 — L5 firing semantics.** `applyL5` is **verdict-BLIND**: it
  fires on `(isDoctrineRisk && !hasInspection)` with no `verdict` check.
  The card's A.2 binary ("verdict-blind ⇒ breaks the F PARTIAL audit ⇒
  needs a logic change") rests on a hidden assumption that is **false
  here**: the real F PARTIAL audit (`5591b76`) names `evidence_span`
  four times (as the deferred / BINDING Phase 4b obligation), so
  `hasInspection` is true and L5 does NOT fire on it — exactly like the
  existing `family-e-amendment-PARTIAL` fixture (9 `evidence_span`
  mentions, passes). **Consistent-PARTIAL is preserved by the
  inspection-pattern MENTION, not by verdict-awareness.** Therefore the
  A.2 outcome is **data-only**; no logic change is needed. The designer
  must reach this conclusion by the empirical check (lint the real F
  PARTIAL audit with `family_f` added), not by abstract reasoning from
  the verdict-blind code.

**Operator simulation (already run; designer to reproduce):** monkey-
patching `family_f` + `critical_question` (+ `consequence_probability_unclear`)
into the set and re-linting yields:

| Doc | exit | rules | meaning |
| --- | --- | --- | --- |
| real F PARTIAL (`5591b76`) | 0 | — | consistent-PARTIAL preserved |
| real F AMENDMENT (`deff068`) | 0 | — | legitimate PASS preserved |
| `original-family-e-IMPROPER-PASS` | 1 | L1,L2,L5 | unchanged |
| `family-e-amendment-PARTIAL` | 0 | — | unchanged |
| `family-e-hosted-completion-PASS` | 0 | — | unchanged |
| `family-d-strengthened-amendment-PASS` | 0 | — | unchanged |
| synthetic F-improper (evidence_span stripped, verdict PASS) | 1 | **L5** | TEETH |

Zero HALT triggers fire under this outcome.

---

## 4. Source files to inspect (designer reading list)

1. This intent brief.
2. `scripts/ops/audit-lint-rules.cjs` — `DOCTRINE_RISK_FAMILIES`
   (lines 55–58) + `MARKER_STRING` export. **This is the DATA file to
   change.**
3. `scripts/ops/audit-lint.mjs` — READ ONLY. Entry / CLI / classifier.
4. `scripts/ops/audit-lint-lib.cjs` — READ ONLY. Confirm A.1
   (`detectFamily` / `mapFamilyLetterToName`, ~lines 384–439) and A.2
   (`applyL5`, ~lines 967–998 — verdict-blind?).
5. `__tests__/opsAuditLint.test.ts` — the existing L5 + doctrine-risk
   tests; the "4-fixture self-validation" block (lines ~1064–1106); the
   "fixture-directory invariants" block (lines ~1112–1145, incl.
   `FIXTURE_FILES` array + `fixture count is exactly 4`).
6. `__tests__/fixtures/audit-lint/` — the 4 existing fixtures + the
   `README.md` self-validation contract (count "exactly 4", marker on
   line 1, "DO NOT live-reference the source audit docs", re-extraction
   commands).
7. `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md` — the F
   PARTIAL audit (becomes fixture 5).
8. `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT-2026-05-28.md` —
   the F amendment PASS (becomes fixture 6).
9. `docs/ops/AUDIT-LINT.md` — the operator doc to enhance.

---

## 5. Required fixture behavior (the 7-fixture matrix — Decision 4)

**EXISTING (byte-equal; must still produce exits 1, 0, 0, 0):**

1. `original-family-e-IMPROPER-PASS.md` → **FAIL (exit 1)**, trips L1+L2(+L5)
2. `family-e-amendment-PARTIAL.md` → **pass-as-PARTIAL (exit 0)**
3. `family-e-hosted-completion-PASS.md` → **PASS (exit 0)**
4. `family-d-strengthened-amendment-PASS.md` → **PASS (exit 0)**

**NEW (static copies + 1 synthetic):**

5. `family-f-original-PARTIAL.md` ← static copy of the on-main F PARTIAL
   audit. **Expected: pass-as-PARTIAL (exit 0).** Proves adding F to
   doctrine-risk does NOT break consistent-PARTIAL (the load-bearing
   Decision 5 invariant). Must be a STATIC COPY with the
   `<!-- AUDIT-LINT-FIXTURE: ... -->` marker on line 1 (per fixture
   README contract), NOT a live-reference.
6. `family-f-amendment-PASS.md` ← static copy of the on-main F amendment
   PASS audit. **Expected: PASS (exit 0).** Proves a legitimate F
   amendment with persisted `evidence_span` inspection passes L5. Same
   static-copy + marker contract.
7. `family-f-IMPROPER-PASS-no-evidence-span.md` ← **SYNTHETIC**,
   hand-authored. Take the F-amendment shape, **STRIP every persisted
   `evidence_span` inspection** (the Phase 4b doctrine section + any
   `persisted evidence` / `direct-output inspection` / `| evidence_span |`
   phrasing — i.e. every `L5_PERSISTED_INSPECTION_PATTERNS` trigger),
   KEEP verdict PASS, KEEP L6 provenance intact (so only L5 trips, not
   L6). **Expected: FAIL (exit 1), citing L5.** This is the TEETH PROOF
   — the F analog of `original-family-e-IMPROPER-PASS`. Without F in the
   doctrine-risk list this fixture would wrongly PASS; with F added it
   must FAIL on L5. Operator simulation confirms a clean `[L5]`-only
   failure is achievable. Carries the fixture marker on line 1.

Designer A.3 specifies the exact synthetic construction and the expected
finding codes for each fixture. Because adding fixtures changes the
directory count, the `FIXTURE_FILES` array and `fixture count is exactly
4` assertion in `opsAuditLint.test.ts` must move to **7**; the 4
existing `it()` fixture assertions stay byte-identical.

---

## 6. The consistent-PARTIAL-for-F invariant (Decision 5 — load-bearing)

A doctrine-risk Family F audit that is **PARTIAL** with Phase 4b NOT-RUN
is **CONSISTENT** and must NOT fail. Fixture 5 (the real on-main F
PARTIAL) is the regression guard for this.

The mechanism (designer to document precisely): L5 is verdict-blind, but
a PARTIAL F audit still passes L5 because it **names** the `evidence_span`
inspection as a deferred / BINDING obligation, so `hasInspection` is
true. This is identical to how the existing E PARTIAL fixture passes. It
is a faithful extension of the existing system, not a new mechanism.

If — contrary to the operator finding — the designer's empirical check
shows the real F PARTIAL audit would newly FAIL after adding `family_f`
(HALT trigger 11), that means consistent-PARTIAL is broken and the card
must HALT-and-surface rather than ship.

---

## 7. Test forecast

**+8 to +25** (HALT ceiling **+45**). Expected decomposition:
- 1–2 doctrine-risk detection unit tests (`critical_question` +
  `family_f` membership; `applyL5` fires for a `family_f` doc lacking
  `evidence_span`).
- 3 new fixture assertions (5 → exit 0; 6 → exit 0; 7 → exit 1 citing L5).
- 1 consistent-PARTIAL-for-F regression (fixture 5 must not false-fail;
  may be the fixture-5 assertion itself or a dedicated test).
- The 4 existing fixtures re-asserted unchanged (already present; the
  `FIXTURE_FILES` array + count assertion edit to 7).

---

## 8. HALT triggers (12)

1. Designer proposes any runtime code change (`mcp-server/**`,
   `supabase/functions/**`, `src/**` non-test).
2. Designer proposes taxonomy / prompt / key changes.
3. Designer proposes production flag changes.
4. Designer proposes `package.json` / `package-lock.json` changes.
5. Designer proposes broad historical-corpus enforcement changes
   (census stays informational; CI scope stays new/modified-marked-only).
6. Designer proposes weakening ANY existing audit-lint behavior.
7. Designer proposes removing or altering any existing Family E
   doctrine-risk rule.
8. The change does NOT add a regression proving Family F L5 enforcement
   (fixture 7 must FAIL L5). **[correctness core]**
9. The 4 existing fixtures would no longer produce exits 1, 0, 0, 0.
   **[correctness core]**
10. **A.2 outcome is "requires logic change"** — surface to operator
    before implementing. A logic change to L5 firing semantics is a real
    scope expansion; the operator decides whether to take it here or
    split it. **[most-likely-to-fire; SURFACE, not auto-proceed]**
11. The F-doctrine-risk addition would cause the real Family F PARTIAL
    audit (fixture 5) to newly FAIL (breaks consistent-PARTIAL).
    **[correctness core]**
12. Test forecast exceeds +45.

Any ONE fires HALT. Per the operator pre-flight (§3), the A.2 outcome is
expected to be **data-only** and triggers 8/9/11 are expected to clear;
the designer must independently confirm.

---

## 9. Smoke plan (5-phase, post-merge)

Audit doc: `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-SMOKE-2026-05-28.md`
(MUST carry the `Audit-Lint: v1` marker; MUST self-lint clean — exit 0).

- **Phase 1 — Existing-fixture regression.** Direct-invoke the 4
  hardening fixtures; confirm exits 1, 0, 0, 0 unchanged.
- **Phase 2 — Family F enforcement (the new teeth).** Synthetic
  F-improper → exit 1 citing L5; F-amendment fixture → exit 0; F PARTIAL
  fixture → exit 0; real on-main F amendment → exit 0; real on-main F
  PARTIAL → exit 0.
- **Phase 3 — Report-only corpus census (informational; never blocks).**
  `node scripts/ops/audit-lint.mjs --report-only docs/audits/` — no
  crash; F amendment NOT in would-fail; F PARTIAL NOT newly would-fail;
  no NEW unexpected would-fail introduced by the F doctrine-risk add.
- **Phase 4 — Regression.** typecheck; lint; `jest opsAuditLint`; deno
  test (mcp-server 871 unchanged — no mcp-server touch). All exit 0.
- **Phase 5 — Dogfood.** The smoke audit doc lints itself clean (exit 0).

Verdict rules: PASS requires all 5 phases clean, fixture 7 FAILS L5
(teeth), fixtures 5+6 and the real F docs pass (consistent-PARTIAL +
legitimate-PASS preserved), 4 existing fixtures unchanged, census
introduces no new unexpected would-fail, regression clean, dogfood +
pre-lint + CI all exit 0.

---

## 10. Brief ledger

| Item | Value |
| --- | --- |
| Card | OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK |
| Type | audit-lint RULES (data-and-tests) |
| Phase 0 | PASS — F amendment L6 provenance complete (linter exit 0; all 4 elements present); predecessor SHAs resolve |
| A.2 expected outcome | **data-only** (designer to confirm) |
| Load-bearing alias | `family_f` (detector output) + `critical_question` (canonical / declared-name) |
| Fixtures | 4 existing (1,0,0,0) + 3 new (5→0, 6→0, 7→1 citing L5) |
| Decision 5 | consistent-PARTIAL preserved via `evidence_span` mention in the PARTIAL audit |
| Test forecast | +8 to +25 (HALT +45) |
| Runtime change | NONE |
| Logic-file change | NONE (data-only) |
| Migration | NONE |
| Anthropic / xAI / X API call | NONE |
| Supabase write / service-role | NONE |

This card is data-and-tests only. It mechanically enforces, for Family
F / `critical_question`, the same persisted `evidence_span` inspection
discipline that L5 already enforces for Family E.
