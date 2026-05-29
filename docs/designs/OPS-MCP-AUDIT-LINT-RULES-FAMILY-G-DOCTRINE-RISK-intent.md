# OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — Intent brief (Card 2 of the Family G suite)

**Operator:** Kyler
**Date:** 2026-05-29
**Card type:** audit-lint RULES — **data-and-tests**, NOT logic/runtime. The documented F data-change path applied to Family G.
**Predecessor (Phase 0 verified):** main at `1c19d11`. Card 1 (`MCP-SERVER-008-FAMILY-G`) shipped (`2640bf9`); Card 1A Edge subset fix (`3f395f8`); Card 1 smoke PARTIAL (`1c19d11`, CI-linted in-scope clean). Doctrine-risk = YES (Card 1 Phase 4b existential PASSED live).

## 1. Motivation

Family G (`resolution_progress`) doctrine was proven LIVE by Card 1 Phase 4b (Fixture C's "won/lost/beat" input → `concedes_broader_point` evidence_span anchored "I withdraw the broad claim…", zero verdict echo). But L5 does NOT yet classify `resolution_progress` as doctrine-risk, so a future G smoke audit could claim PASS without persisted `evidence_span` inspection and the linter would not catch it. This card mechanizes L5 for G **before** any production flip (Card 3) — closing the gap the same way the F doctrine-risk card did for `critical_question`.

## 2. Scope (STRICT — mirror the F doctrine-risk card)

Allowed: `scripts/ops/audit-lint-rules.cjs` (the `DOCTRINE_RISK_FAMILIES` DATA list ONLY); `__tests__/opsAuditLint.test.ts`; `__tests__/fixtures/audit-lint/*.md` (3 NEW G fixtures + the README count update); `docs/ops/AUDIT-LINT.md`; `docs/core/current-status.md`; this card's design/audit docs.
Forbidden: `audit-lint.mjs`/`-lib.cjs` LOGIC (data-only; if logic needed → HALT-surface); all runtime (mcp-server/**, supabase/functions/**); production flags; prompts/keys/taxonomy/schema; Source 6; `package.json`; the 4 hardening fixtures + the 3 F fixtures (byte-equal); generated artifacts; **do not start Card 3**.

## 3. A.1 — detector alias (data-only; Phase 0 confirmed)

`detectFamily` emits **`family_g`** for `MCP-SERVER-008-FAMILY-G-SMOKE` titled docs (`mapFamilyLetterToName` has no G case → default → `family_g`). **`family_g` is the load-bearing alias** (adding `resolution_progress` alone is a no-op for the real docs). Add all three: `resolution_progress` (canonical / `Family:` declaration path), `family_g` (detector output — load-bearing), `concedes_broader_point` (the doctrinal-axis partner — G's analog to E's `slippery_slope` / F's `consequence_probability_unclear`; the highest-risk verdict-adjacent key, reachable via a `Family:` declaration). `mapFamilyLetterToName` is NOT touched.

## 4. A.2 — data-only (Phase 0 simulation confirmed)

`applyL5` is verdict-blind, but the real G PARTIAL smoke names `evidence_span` 7× → `hasInspection` true → it stays exit 0 (consistent-PARTIAL) after `family_g` is added. The 7 existing fixtures stay `1,0,0,0,0,0,1`. **A.2 outcome = data-only.** (Designer reproduces the simulation.)

## 5. Fixture matrix (7 existing → 10)

Existing 7 (byte-equal, unchanged): the 4 hardening (E-improper FAIL; E-partial/E-completion/D-amendment pass) + the 3 F (F-partial pass; F-amendment pass; F-improper FAIL-L5).
New 3 G fixtures:
- `family-g-original-PARTIAL.md` — static copy of Card 1's G PARTIAL smoke (on main `1c19d11`) → pass-as-PARTIAL (exit 0). Proves consistent-PARTIAL for G.
- `family-g-amendment-PASS.md` — hand-authored representative G hosted-completion amendment (verdict PASS + persisted `evidence_span` inspection) → exit 0. Proves a legitimate G amendment passes L5 ("the future hosted-completion amendment can pass when supplied"). (Card 1's real amendment doesn't exist yet — operator-deferred; this fixture is the representative shape, mirroring `family-f-amendment-PASS`.)
- `family-g-IMPROPER-PASS-no-evidence-span.md` — SYNTHETIC: a G amendment shape (so L1 doesn't fire — amendment has empty required-phases), verdict PASS, L6 provenance intact, every `evidence_span`/persisted-inspection trigger stripped → FAIL exit 1 citing **L5 ONLY** (the teeth; the G analog of `family-f-IMPROPER-PASS-no-evidence-span`). Negative control: passes without `family_g`, fails with it.
Each new fixture carries the `<!-- AUDIT-LINT-FIXTURE: … -->` marker on line 1. `opsAuditLint.test.ts` `FIXTURE_FILES` + count assertion: 7 → 10.

## 6. Test forecast

+8 to +25 (HALT +45). Membership tests (resolution_progress/family_g/concedes_broader_point) + detectFamily→family_g pin + 3 fixture assertions + consistent-PARTIAL-for-G regression + the 7 existing fixtures re-asserted + count 7→10.

## 7. HALT triggers (12, mirror F)

Runtime/logic change; taxonomy/prompt/key; production flag; package.json; broad-historical-enforcement; weaken-existing; remove-E-or-F-rule; **no-G-enforcement-regression (synthetic-G must FAIL L5)**; **4+3 existing fixtures drift from 1,0,0,0,0,0,1**; **A.2=logic-change (surface)**; **G-PARTIAL-newly-fails (consistent-PARTIAL broken)**; forecast > +45. Triggers 8/9/11 are the correctness core.

## 8. Smoke plan (5-phase, post-merge)

Audit `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-SMOKE-2026-05-29.md` (`Audit-Lint: v1`; self-lints clean). Phase 1 existing-fixture regression (4+3 unchanged); Phase 2 G enforcement teeth (synthetic-G → exit 1 L5; g-amendment → 0; g-partial → 0; real on-main G smoke → 0); Phase 3 report-only census (no new would-fail); Phase 4 regression (typecheck/lint/jest/deno); Phase 5 dogfood. Verdict PASS if teeth + consistent-PARTIAL + no E/F drift + census clean + dogfood exit 0.

## 9. Ledger

| Item | Value |
| --- | --- |
| Card | OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK (Card 2 of 3) |
| A.2 outcome | data-only (Phase 0 confirmed) |
| Aliases | `resolution_progress` + `family_g` (load-bearing) + `concedes_broader_point` |
| Fixtures | 7 → 10 (3 new G) |
| Forecast | +8 to +25 (HALT +45) |
| Runtime/logic change | NONE |
| Anthropic spend | NONE |
| Gate after | Gate B (production-flip + latency), then Card 3 — gated on Card 1 hosted-amendment-PASS + this Card 2 PASS |

Mirrors `OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK` exactly, applied to Family G.
