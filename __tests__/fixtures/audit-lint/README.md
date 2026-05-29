# Audit-lint fixture directory

These files are INTENTIONAL NEGATIVE FIXTURES — static copies of historical
audit docs at the SHAs that motivated `OPS-MCP-SMOKE-DOCTRINE-HARDENING`.
They contain historical defect language ("covered indirectly", "verified
via unit tests" as sole justification, "fallacy" inside an adversarial
ban-list table, etc.) BY DESIGN. Their purpose is to assert that the
audit-lint linter would have caught the original `29f30b0` improper-PASS
audit at authoring time.

## Doctrine exclusion contract

Doctrine ban-list scanners and verdict-token scanners MUST EXCLUDE this
directory. Each file carries an HTML comment marker on line 1:

```
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
```

The marker is intentionally specific so a broad scanner can use it as a
file-level opt-out signal without needing a directory allow-list.

Jest tests in `__tests__/opsAuditLint.test.ts` assert:
- this `README.md` exists in the directory;
- each fixture file starts with the `<!-- AUDIT-LINT-FIXTURE` marker;
- the fixture count is exactly 10 (the four original Family E/D motivating
  arc docs, the three Family F doctrine-risk-enrollment fixtures added in
  `OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK`, and the three Family G
  doctrine-risk-enrollment fixtures added in
  `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`).

## DO NOT EDIT

DO NOT edit the body content of these files to remove the defect
language — that would defeat the self-validation contract.

DO NOT live-reference the source audit docs under `docs/audits/` — these
files are STATIC COPIES extracted via `git show <sha>:<path>` at the
motivating commit SHAs. The fixtures must remain frozen at those SHAs.

## Re-extraction commands

If a fixture file is accidentally edited or deleted, re-extract via:

```bash
git show 29f30b0:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md \
  > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/original-family-e-IMPROPER-PASS.md

git show b1829f5:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT-2026-05-28.md \
  > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-e-amendment-PARTIAL.md

git show bccb0c2:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-COMPLETION-HOSTED-2026-05-28.md \
  > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-e-hosted-completion-PASS.md

cp docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-AMENDMENT-2026-05-27.md \
   /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-d-strengthened-amendment-PASS.md

git show 6395023:docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md \
  > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-f-original-PARTIAL.md

git show 6395023:docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT-2026-05-28.md \
  > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-f-amendment-PASS.md

git show 1c19d11:docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md \
  > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-g-original-PARTIAL.md
```

`family-f-IMPROPER-PASS-no-evidence-span.md` is **SYNTHETIC** (hand-authored,
not extracted) — its exact construction lives in
`docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK.md`
§ "Synthetic fixture 7 — exact construction". It is the F-amendment shape with
every `evidence_span` inspection trigger stripped, so re-author it from that
design body rather than extracting it from a commit.

`family-g-amendment-PASS.md` and `family-g-IMPROPER-PASS-no-evidence-span.md`
are both **HAND-AUTHORED** (not extracted). The real G hosted-completion
amendment is operator-deferred, so `family-g-amendment-PASS.md` is a
representative shape (carrying a persisted `evidence_span` readback so L5 is
satisfied). `family-g-IMPROPER-PASS-no-evidence-span.md` is the G-amendment
shape with every `evidence_span` inspection trigger stripped. Re-author both
from the bodies in
`docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK.md`
§ "Fixture matrix" (fixtures 9 + 10) rather than extracting them from a commit.

## Expected linter outcomes (existential contract)

| Fixture | Expected exitCode | Rules expected to trip |
| --- | --- | --- |
| `original-family-e-IMPROPER-PASS.md` | 1 (FAILS) | L1 (Phase 3 NOT-RUN + verdict PASS) + L2 (`covered indirectly` indirect-proof phrase) |
| `family-e-amendment-PARTIAL.md` | 0 (PASSES) | (none) — consistent-PARTIAL; R2 satisfied; L6 provenance present |
| `family-e-hosted-completion-PASS.md` | 0 (PASSES) | (none) — Phase 1 hosted smoke ran; L6 provenance present |
| `family-d-strengthened-amendment-PASS.md` | 0 (PASSES) | (none) — model audit; all of L1-L6 satisfied; not a doctrine-risk family |
| `family-f-original-PARTIAL.md` | 0 (PASSES) | (none) — consistent-PARTIAL for Family F; names `evidence_span` as the deferred Phase 4b obligation so `hasInspection` is true and L5 does not fire |
| `family-f-amendment-PASS.md` | 0 (PASSES) | (none) — legitimate F amendment; persisted `evidence_span` inspection present; L5 satisfied |
| `family-f-IMPROPER-PASS-no-evidence-span.md` | 1 (FAILS) | L5 ONLY — doctrine-risk Family F + verdict PASS + ZERO `evidence_span` inspection. The teeth proof (F analog of `original-family-e-IMPROPER-PASS`). Amendment-typed + intact L6 → L1/L2/L6 do NOT fire |
| `family-g-original-PARTIAL.md` | 0 (PASSES) | (none) — consistent-PARTIAL for Family G; names `evidence_span` as the Phase 4b binding obligation so `hasInspection` is true and L5 does not fire (the load-bearing regression guard for the Family G doctrine-risk enrollment) |
| `family-g-amendment-PASS.md` | 0 (PASSES) | (none) — representative G amendment; persisted `evidence_span` inspection present; L5 satisfied |
| `family-g-IMPROPER-PASS-no-evidence-span.md` | 1 (FAILS) | L5 ONLY — doctrine-risk Family G + verdict PASS + ZERO `evidence_span` inspection. The teeth proof (G analog of `original-family-e-IMPROPER-PASS`). Amendment-typed + intact L6 → L1/L2/L6 do NOT fire |

The Jest suite asserts these outcomes. If a future linter change causes a
mismatch, EITHER the linter must be tuned back OR the design's expected
outcomes need an explicit operator-approved revision.

## Source

Designer plan: `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md` §
Phase A.4 + the operator addendum.
