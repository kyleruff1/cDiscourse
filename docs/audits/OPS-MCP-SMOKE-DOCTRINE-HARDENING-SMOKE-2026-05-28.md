# OPS-MCP-SMOKE-DOCTRINE-HARDENING — Post-merge smoke audit

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor:** OPS-MCP-SMOKE-DOCTRINE-HARDENING shipped at `91a3664` (PR #340; squash-merge of 5 implementation commits + designer `d1b1b36` + reviewer verdict `d0008f2`).
**Audit doctrine:** Verifies the audit-lint runner mechanically catches the original `29f30b0` Family E improper-PASS defect class; does not false-fail the legitimate `b1829f5` PARTIAL; and the smoke audit itself satisfies the L1-L6 linter (dogfood).

---

## Verdict

**PARTIAL** — All five smoke phases satisfied as designed. Centerpiece self-validation (Phase 1) and dogfood (Phase 5) both green. CI wiring is DEFERRED per operator addendum (`.github/workflows/` does NOT exist; introducing it would be a non-additive shared-workflow change firing HALT trigger 9). The audit-lint enforcement value is fully delivered through the runner + L1-L6 rules + 4 self-validation fixtures + 3 updated smoke templates + `docs/ops/AUDIT-LINT.md` operator reference; operator-run invocation is the v1 mechanism.

The PARTIAL verdict here is by-design and CONSISTENT with the NOT-RUN-by-deferral status of the CI integration step. Under L1, PARTIAL with a NOT-RUN phase is the correct shape (R2-compatible). PASS would have required mechanical CI enforcement, which is deferred to the follow-on card.

**Authorizations granted on PARTIAL:**
- `OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE: PARTIAL` (CI deferred; functional enforcement landed)
- L1-L6 enforced on new/modified post-hardening smoke audits via operator-run invocation
- `MCP-SERVER-007-FAMILY-F` AUTHORIZED — its smoke audit ships under the linter from Phase 1
- `MCP-021C-EDGE-FAMILY-E-ENABLE` AUTHORIZED — its production-enable audit must satisfy L3 + L4 from the start
- `OPS-MCP-SMOKE-LINT-CI-WIRING` AUTHORIZED to file as the follow-on that lifts the PARTIAL cap

---

## Phase 1 — Self-validation against the 4 fixtures (CENTERPIECE)

**Status:** PASS

Direct operator-run invocation of the runner against each fixture matched the expected verdict in §4 of the intent brief.

| Fixture | Expected | Actual outcome | EXIT | Findings |
| --- | --- | --- | --- | --- |
| `original-family-e-IMPROPER-PASS.md` | FAILS (cites L1 + L2) | FAILS | 1 | L1, L2, L5 (bonus: Family E doctrine-risk audit did not inspect persisted evidence_span) |
| `family-e-amendment-PARTIAL.md` | PASSES (consistent-PARTIAL; NOT false-failed) | PASSES | 0 | none |
| `family-e-hosted-completion-PASS.md` | PASSES | PASSES | 0 | none |
| `family-d-strengthened-amendment-PASS.md` | PASSES | PASSES | 0 | none |

The centerpiece proof: the linter catches the exact `29f30b0` defect class that motivated this card. Specifically:

- **L1** fires because Phase 3 (hosted MCP smoke) is NOT-RUN but the verdict is PASS — under R2, NOT-RUN required phases CANNOT support PASS.
- **L2** fires because Phase 3's justification ("Phase 3 covered indirectly via Phase 4 success") substitutes indirect evidence for the direct-proof obligation R4 requires.
- **L5** is a bonus correct finding: Family E is a doctrine-risk family (slippery_slope) and the original audit did not inspect persisted `evidence_span` from the Edge call.

If the runner had existed at `29f30b0`, the verdict line would have been blocked from claiming PASS until the amendment work landed.

---

## Phase 2 — Report-only corpus census (informational; never blocks)

**Status:** PASS

Ran `node scripts/ops/audit-lint.mjs --report-only` against every file under `docs/audits/*SMOKE*.md`.

| Bucket | Count | Notes |
| --- | --- | --- |
| Total scanned | 26 | All `*SMOKE*.md` files under `docs/audits/` |
| Clean / would-pass | 16 | Mix of recent audits that already satisfy L1-L6 by good practice |
| Would-fail under L1-L6 | 5 | Historical pre-hardening audits; exempt by scoping (no marker) — informational only |
| Parse-error / other | 5 | Templates (placeholder verdicts); expected behavior |

Notably, `MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md` appears in the would-fail bucket with 3 findings — confirming the linter would have caught the centerpiece defect at authoring time, not after the b1829f5 + bccb0c2 amendment chain.

This phase NEVER BLOCKS by design. The census is purely informational.

---

## Phase 3 — CI scope verification (simulated; CI wiring deferred)

**Status:** PARTIAL (simulated; CI mechanically deferred)

The marker (`Audit-Lint: v1`) + added-vs-modified scoping is verified by inspection rather than mechanical CI enforcement, because no GitHub Actions infrastructure exists in this repo and introducing it fires HALT trigger 9 (non-additive shared-workflow change). Per operator addendum, this card lands with CI deferred.

| Case | Behavior | Verified |
| --- | --- | --- |
| Added new audit doc (this smoke audit) | ALWAYS lint (added-files rule overrides marker check) | YES — this doc carries the marker AND is added in this commit |
| Modified historical doc without marker | EXEMPT (does not regress historical doctrine) | YES — `MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md` lacks the marker; would be exempt under a modified-without-marker rule |
| Modified doc with marker | ENFORCED | YES — the 3 updated templates carry the marker and would be enforced if modified again |
| Evasion loophole: added doc without marker | CLOSED — added-files-always-lint forces enforcement on new docs regardless of marker | YES — designer §A.3 + this verification |

The marker is present in:
- `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-template.md`
- `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md`
- `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-template.md`
- `docs/ops/AUDIT-LINT.md`
- This audit doc

v1 enforcement vector: smoke-template required final step `node scripts/ops/audit-lint.mjs <this-doc>` must exit 0 before the Verdict line is valid. Operator-invoked at audit authoring time, not via GitHub Actions.

CI deferral is documented in `docs/ops/AUDIT-LINT.md`. Follow-on card: `OPS-MCP-SMOKE-LINT-CI-WIRING`.

---

## Phase 4 — Regression

**Status:** PASS

```
npx jest --testPathPattern="opsAuditLint" --no-coverage
→ Test Suites: 1 passed, 1 total
  Tests:       105 passed, 105 total
EXIT: 0

npx jest --no-coverage
→ Test Suites: 570 passed, 570 total
  Tests:       18121 passed, 18121 total
EXIT: 0

npm run typecheck
→ EXIT: 0

npm run lint
→ EXIT: 0

cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 792 passed | 0 failed (4s)
EXIT: 0
```

Deltas vs baseline at `bccb0c2` (Family E hosted completion):
- Jest: 18,016 → 18,121 (+105 tests in `opsAuditLint.test.ts`; matches reviewer-verified breakdown of 23 L1-L6 + 4 fixtures + 3 directory invariants + 39 parser/detection + 29 CLI/template/determinism + 7 rules-file invariants)
- Deno: 792 → 792 (unchanged; no `mcp-server/*` touched)
- typecheck + lint: clean

---

## Phase 5 — Dogfood: this smoke audit lints itself

**Status:** PASS

```
node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE-2026-05-28.md
→ findings: 0 (PASS)
→ EXIT: 0
```

This phase is intentionally last: if the dogfood call had returned findings, either the linter was wrong about what this audit needs to prove, or this audit was incomplete. Either way the verdict would have been blocked until reconciled.

The actual result is 0 findings, EXIT 0 — the audit-lint runner certifies its own smoke audit conforms to L1-L6.

---

## Final verdict

**PARTIAL** — Centerpiece self-validation (Phase 1) + corpus census (Phase 2) + scoping verification (Phase 3, simulated) + regression (Phase 4) + dogfood (Phase 5) all satisfied. CI wiring is DEFERRED to a follow-on card per operator addendum. The L1-L6 enforcement value is delivered operator-run via the smoke template required final step.

Combined three-document arc (`29f30b0` improper PASS → `b1829f5` PARTIAL → `bccb0c2` PASS) → this card mechanizes the rules so the next member of that class is caught before commit, not after a two-amendment chain.

---

## Authorizations confirmed on PARTIAL

- L1-L6 enforced on new/modified post-hardening smoke audits via operator-run invocation
- `MCP-SERVER-007-FAMILY-F` AUTHORIZED (its smoke audit ships under the linter)
- `MCP-021C-EDGE-FAMILY-E-ENABLE` AUTHORIZED (its production-enable audit must satisfy L3 + L4 from the start)
- `OPS-MCP-SMOKE-LINT-CI-WIRING` AUTHORIZED to file as the follow-on that lifts the PARTIAL cap

## Operator cleanup

No temp artifacts created this phase. No service-role usage. No secrets logged. No `.env*` touched.
