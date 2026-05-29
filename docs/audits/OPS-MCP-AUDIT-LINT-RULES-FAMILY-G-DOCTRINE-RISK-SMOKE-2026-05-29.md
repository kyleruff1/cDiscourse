# OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-SMOKE — Post-merge smoke (2026-05-29)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Merge:** PR #359 squash-merged to `main` at `128e1b4`.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/357
**Scope:** Card 2 of the Family G suite. Mechanizes L5 doctrine-risk enforcement for Family G (`resolution_progress`) by adding three aliases to `DOCTRINE_RISK_FAMILIES`. Data-and-tests only; no runtime/logic change. This smoke proves the new G teeth bite, consistent-PARTIAL is preserved, and Family E/F enforcement is unchanged.

**Verdict: PASS** — all 5 phases clean.

---

## Summary

L5 now mechanically requires persisted `evidence_span` inspection for future doctrine-risk Family G audits, the same way it does for Family E and F. The load-bearing alias is `family_g` (the string `detectFamily` emits for `MCP-SERVER-008-FAMILY-G-*` titles; `mapFamilyLetterToName` has no G case → `family_g`); `resolution_progress` (canonical) and `concedes_broader_point` (doctrinal-axis partner) are added alongside. Card 1's real G PARTIAL smoke is the consistent-PARTIAL regression guard; a synthetic improper-G PASS is the teeth proof.

---

## Phase 1 — Existing-fixture regression

**Status:** PASS

Direct-invoke the 7 existing fixtures (4 hardening + 3 Family F): exits `1, 0, 0, 0, 0, 0, 1` — unchanged. The 4 hardening + 3 F fixtures are byte-equal on the merged tree (0-diff). Family E (`argument_scheme`/`slippery_slope`) and Family F (`critical_question`/`family_f`/`consequence_probability_unclear`) doctrine-risk entries are preserved verbatim; the 3 G aliases were appended after them.

---

## Phase 2 — Family G enforcement (the new teeth)

**Status:** PASS

| Doc | Exit | Finding | Meaning |
| --- | --- | --- | --- |
| `family-g-IMPROPER-PASS-no-evidence-span.md` (SYNTHETIC) | 1 | `L5` ONLY | TEETH — doctrine-risk G + verdict PASS + no `evidence_span` inspection |
| `family-g-amendment-PASS.md` (representative G amendment) | 0 | (none) | legitimate G amendment with persisted inspection passes |
| `family-g-original-PARTIAL.md` (static copy of Card 1's G PARTIAL smoke) | 0 | (none) | consistent-PARTIAL preserved |
| real on-main `MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` | 0 | (none) | the real Card 1 G smoke still lints clean |

Synthetic-G finding (verbatim): `[L5] Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).` — trips **L5 only** (not L1/L2/L6; it is an amendment-shaped doc → empty required-phase set → no L1; full L6 provenance → no L6). Negative control (per the design's evidence section): without `family_g` in the set, the synthetic wrongly passes (exit 0); with it, it fails exit 1 `[L5]` — confirming `family_g` is the load-bearing alias, not `resolution_progress` alone.

The 10-fixture matrix is `1, 0, 0, 0, 0, 0, 1, 0, 0, 1`.

---

## Phase 3 — Report-only corpus census (informational; never blocks)

**Status:** PASS

Enforcing census over all 52 markdown docs under `docs/audits/`, comparing the would-fail set WITH the 3 G aliases (post-merge) vs WITHOUT them:

```
docs scanned: 52 | crashes: 0
would-fail WITH G:    5
would-fail WITHOUT G: 5  (identical set)
NEW would-fail from the G add: NONE
G smoke in would-fail? false
```

The 5 would-fail docs are pre-existing historical artifacts (unchanged from the prior F-card census + the new docs). Adding Family G introduces **zero** new would-fail. The real Card 1 G PARTIAL smoke is NOT in would-fail (it names `evidence_span` 7× → consistent-PARTIAL). Informational-only; CI scope is new/modified-marked-only.

---

## Phase 4 — Regression

**Status:** PASS

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx jest --testPathPattern="opsAuditLint" --no-coverage` | 158 passed / 158 total, exit 0 (147 → 158, +11) |
| `mcp-server` Deno | unchanged (Card 2 touches no mcp-server file; 1022 from Card 1 stands) |

The +11 audit-lint tests cover: 3 alias-membership assertions (`resolution_progress`/`family_g`/`concedes_broader_point`) + a Family-E/F-members-preserved guard, a `detectFamily → family_g` A.1-trap pin, L5 firing/non-firing for `family_g`, and 3 G fixture self-validation assertions including the synthetic L5-only teeth.

---

## Phase 5 — Dogfood

**Status:** PASS

This smoke audit carries the `Audit-Lint: v1` marker and self-lints clean (exit 0): `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-SMOKE-2026-05-29.md` → 0 findings.

---

## Final verdict

**PASS** — all 5 phases clean.

- Synthetic improper-G FAILS on `L5` ONLY (teeth proven, negative control verified).
- The real Card 1 G PARTIAL smoke + the representative G amendment fixture pass (consistent-PARTIAL + legitimate-PASS preserved).
- The 7 existing E/F + hardening fixtures are byte-equal and still exit `1,0,0,0,0,0,1`.
- Census introduces zero new would-fail across 52 docs.
- A.2 outcome held: data-only — three strings in `DOCTRINE_RISK_FAMILIES`; `.mjs`/`-lib.cjs` logic 0-diff (`mapFamilyLetterToName` untouched).
- Regression + dogfood clean.

---

## Authorizations + gating

- `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-SMOKE: PASS`.
- L5 now mechanically enforces persisted `evidence_span` inspection for `resolution_progress` / Family G audits — the Family G doctrine proof (Card 1 Phase 4b existential) is converted from operator-discipline into mechanical CI enforcement, **before** any production flip.
- **Gate B (production-flip + latency) is next.** **Card 3 (`MCP-021C-EDGE-FAMILY-G-ENABLE`) remains gated on BOTH (1) Card 1 hosted Phase 3 amendment → PASS AND (2) this Card 2 PASS.** Card 2 is now PASS; Card 1's hosted-amendment remains operator-pending.
