# OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-SMOKE — Post-merge smoke (2026-05-28)

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Merge:** PR #350 squash-merged to `main` at `a921164`.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/349
**Scope:** Post-merge verification that adding Family F / `critical_question` to the L5 `DOCTRINE_RISK_FAMILIES` set mechanically enforces persisted `evidence_span` inspection for future doctrine-risk Family F audits, with ZERO regression to existing audit-lint behavior. Data-and-tests card; A.2 outcome held as **data-only**.

---

## Summary

The DATA edit added three aliases to `DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs`: `critical_question` (canonical key), `family_f` (the load-bearing alias — the string `detectFamily` actually emits for `MCP-SERVER-NNN-FAMILY-F` titled docs, since `mapFamilyLetterToName` has no `F` case), and `consequence_probability_unclear` (the F doctrinal-axis partner, parallel to E's `slippery_slope`). No logic file was touched. L5 now fires for a doctrine-risk Family F audit that declares PASS without inspecting the persisted `evidence_span` column — the exact `29f30b0` improper-PASS defect class, now mechanically caught for Family F as it already is for Family E.

All 5 phases PASS. The new teeth bite (synthetic F-improper-PASS → exit 1 citing L5 ONLY), legitimate F audits are preserved (the real on-main F amendment and F PARTIAL both lint exit 0; consistent-PARTIAL preserved via the deferred-`evidence_span`-mention mechanism), the 4 existing hardening fixtures are byte-equal and still exit 1/0/0/0, and the corpus census shows the F add introduces ZERO new would-fail across 46 audit docs.

---

## Phase 1 — Existing-fixture regression (no behavior drift)

**Status:** PASS

Direct-invocation of the 4 hardening fixtures (`node scripts/ops/audit-lint.mjs <fixture>`):

| Fixture | Exit | Expected |
| --- | --- | --- |
| `original-family-e-IMPROPER-PASS.md` | 1 | 1 |
| `family-e-amendment-PARTIAL.md` | 0 | 0 |
| `family-e-hosted-completion-PASS.md` | 0 | 0 |
| `family-d-strengthened-amendment-PASS.md` | 0 | 0 |

`1, 0, 0, 0` — unchanged from the pre-card baseline. The 4 existing fixture files are byte-equal on the merged tree (`git diff` against the pre-merge base shows 0 changed lines for these 4 files). The Family E doctrine-risk entries (`argument_scheme`, `slippery_slope`) are preserved verbatim; the F aliases were appended after them.

---

## Phase 2 — Family F enforcement (the new teeth)

**Status:** PASS

| Doc | Exit | Finding | Meaning |
| --- | --- | --- | --- |
| `family-f-IMPROPER-PASS-no-evidence-span.md` (SYNTHETIC) | 1 | `L5` ONLY | TEETH — doctrine-risk F + verdict PASS + no `evidence_span` inspection |
| `family-f-amendment-PASS.md` (static copy of real F amendment) | 0 | (none) | legitimate F amendment with persisted inspection passes |
| `family-f-original-PARTIAL.md` (static copy of real F PARTIAL) | 0 | (none) | consistent-PARTIAL preserved |
| real on-main `MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT-2026-05-28.md` | 0 | (none) | the real amendment still lints clean |
| real on-main `MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md` | 0 | (none) | the real PARTIAL still lints clean |

Synthetic fixture finding (verbatim):

```
  findings:    1
    [L5] Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).
```

The synthetic fixture trips **L5 only** — not L1 (it is `amendment`-typed → empty required-phase set, all phases PASS), not L2 (no indirect-proof phrases), not L6 (full provenance: prior verdict, missing proof, newly-supplied proof all named). This is the F analog of `original-family-e-IMPROPER-PASS`.

**Negative control (proves the teeth are real):** with the F aliases removed from the set, the same synthetic body lints exit 0 (the rule was blind to Family F before this card); with `family_f` added, it lints exit 1 `[L5]`. This confirms `family_f` — not `critical_question` alone — is the load-bearing alias the detector keys on.

---

## Phase 3 — Report-only corpus census (informational; never blocks)

**Status:** PASS

Enforcing census over all 46 markdown docs under `docs/audits/`, comparing the would-fail set with the F aliases present (post-merge state) against the set with the F aliases removed (pre-F rules):

```
docs scanned: 46 | crashes: 0
would-fail WITH F (5):
  MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-2026-05-27.md [L3,L4,L5]
  MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-2026-05-27.md [L4]
  MCP-SERVER-005-FAMILY-D-SMOKE-2026-05-27.md [L1,L2]
  MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md [L1,L2,L5]
  OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE-2026-05-27.md [L5]
would-fail WITHOUT F (5):
  (identical 5 docs)
NEW would-fail introduced by F add: NONE
F amendment in would-fail? false
F PARTIAL in would-fail? false
```

The 5 would-fail docs are pre-existing historical artifacts (the `29f30b0`-era Family E improper-PASS source and several pre-hardening Family D/B-C docs); they are IDENTICAL with and without the F aliases, proving the F add introduces zero new would-fail. They are informational-only: CI scope is new/modified-marked-only (`.github/workflows/audit-lint.yml` untouched), and none of these historical docs carries the `Audit-Lint: v1` marker, so none is CI-enforced on modification.

**Note on the `--report-only docs/audits/` form:** passing a directory to the single-doc runner returns exit 3 (the runner `readFileSync`s the path as a file; a directory throws). This is pre-existing single-doc-only behavior, NOT introduced by this card. The canonical batch form is the shell loop documented in `AUDIT-LINT.md`:

```
for f in docs/audits/*SMOKE*.md; do node scripts/ops/audit-lint.mjs "$f" --report-only; done
```

That loop scanned 36 SMOKE docs with 0 crashes (all exit 0 under `--report-only`).

---

## Phase 4 — Regression

**Status:** PASS

Run on the merged commit `a921164`:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx jest --testPathPattern="opsAuditLint" --no-coverage` | 147 passed / 147 total, exit 0 (137 → 147, +10) |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read` | 871 passed / 0 failed, exit 0 (unchanged — no mcp-server touch) |

The +10 audit-lint tests cover: 3 alias-membership assertions (`critical_question`, `family_f`, `consequence_probability_unclear`) + a Family-E-members-preserved guard, a `detectFamily → family_f` A.1-trap pin, 2 L5 firing tests (fires for `family_f` without `evidence_span`; does not fire with it), and 3 fixture self-validation assertions including the L5-only teeth precision check. Deno 871 is unchanged, confirming this card is mechanically isolated from the MCP runtime.

---

## Phase 5 — Dogfood

**Status:** PASS

This smoke audit doc carries the `Audit-Lint: v1` marker and self-lints clean (exit 0) under the post-merge rules. It is classified `ops` (title starts with `# OPS-`), verdict PASS, with no NOT-RUN phases, full `evidence_span` discussion (so L5's `hasInspection` is satisfied), and no amendment markers (so L6 does not apply). See the pre-push dogfood invocation recorded with this commit.

---

## Final verdict

**PASS** — all 5 phases clean.

PASS criteria (all met):
- Fixture 7 (synthetic improper-F) FAILS on `L5` ONLY — teeth proven, with a verified negative control.
- Fixtures 5 + 6 and the real on-main F amendment + F PARTIAL all lint exit 0 — consistent-PARTIAL and legitimate-PASS preserved (Decision 5).
- The 4 existing hardening fixtures are byte-equal and still exit `1, 0, 0, 0` — no regression (HALT triggers 7/8/9 clear).
- The corpus census introduces zero new would-fail across 46 docs — no broad historical enforcement added.
- A.2 outcome held: **data-only** — the only production-source change is three strings in `DOCTRINE_RISK_FAMILIES`; the `.mjs`/`.cjs` logic files (including `mapFamilyLetterToName`) show 0 changed lines.
- Regression clean (typecheck 0, lint 0, jest 147, deno 871).
- Dogfood + pre-push lint exit 0; CI on PR #350 reported `in_scope=0` (no applicable smoke docs in the implementation diff) and passed.

---

## Authorizations unlocked

- `OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-SMOKE: PASS`.
- L5 now mechanically enforces persisted `evidence_span` inspection for `critical_question` / Family F audits — the Family F doctrine proof is converted from operator-discipline into mechanical CI enforcement.
- `MCP-SERVER-008-FAMILY-G` may proceed. If Family G is doctrine-risk, the `AUDIT-LINT.md` "Adding a doctrine-risk family" how-to (enhanced by this card with the alias-the-detector-needs trap and the consistent-PARTIAL mechanism) makes its doctrine-risk enrollment a documented DATA change: add `family_g` (the detector output) + the canonical G key to `DOCTRINE_RISK_FAMILIES`, then mirror the 3-fixture pattern.
- `MCP-021C-EDGE-FAMILY-G` / other production-enable cards must inherit L5 if their family is doctrine-risk.
- `OPS-MCP-LATENCY-BUDGET` remains recommended before too many more production-enable cards (6 families now fire sequentially per arg; trajectory toward the 45s threshold as G/H/I/J go production).

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration. No Edge Function. No deploy (the Supabase auto-deploy on merge is a no-op for this pure code+docs card).
