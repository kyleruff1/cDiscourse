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
- the fixture count is exactly 16 (the four original Family E/D motivating
  arc docs, the three Family F doctrine-risk-enrollment fixtures added in
  `OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK`, the three Family G
  doctrine-risk-enrollment fixtures added in
  `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`, the three Family H
  doctrine-risk-enrollment fixtures added in
  `OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK`, and the three Family I
  doctrine-risk-enrollment fixtures added in
  `OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK`).

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

git show 12ec7eb:docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md \
  > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-h-original-PASS.md
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

`family-h-amendment-PASS.md` and `family-h-IMPROPER-PASS-no-evidence-span.md`
are both **HAND-AUTHORED** (not extracted). Card 3's real production-enable
smoke does not exist yet (Card 3 is gated by this Card 2 smoke PASS), so
`family-h-amendment-PASS.md` is a representative shape with the canonical
`MCP-SERVER-009-FAMILY-H-AMENDMENT` title and a persisted `evidence_span`
readback so L5 is satisfied. `family-h-IMPROPER-PASS-no-evidence-span.md` is
the H-amendment shape with every `evidence_span` inspection trigger stripped.
Re-author both from the bodies in
`docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK.md`
§ "Fixture matrix" (fixtures 12 + 13) rather than extracting them from a
commit.

All three Family I fixtures (`family-i-consistent-PARTIAL.md`,
`family-i-amendment-PASS.md`, `family-i-IMPROPER-PASS-no-evidence-span.md`)
are **HAND-AUTHORED** (not extracted). Unlike Family H, there is **no on-main
Card-1 I smoke audit** to byte-copy — `docs/audits/` carries only
`MCP-SERVER-010-FAMILY-I-SMOKE-template.md` (a template), because Card 1's
hosted Phase 3 + Edge Phase 4/4b are operator-post-merge and have not run. So
there is NO `git show` re-extraction recipe for any I fixture.
`family-i-consistent-PARTIAL.md` is the representative substitute for the
missing "original" (the consistent-PARTIAL role; it names `evidence_span` as
the deferred Phase 4b obligation so L5 is satisfied).
`family-i-amendment-PASS.md` is a representative production-enable shape with
the canonical `MCP-SERVER-010-FAMILY-I-AMENDMENT` title and a persisted
`evidence_span` readback. `family-i-IMPROPER-PASS-no-evidence-span.md` is the
I-amendment shape with every `evidence_span` inspection trigger stripped.
Re-author all three from the bodies in
`docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK.md`
§ "Fixture matrix" (fixtures 14 + 15 + 16) rather than extracting them from a
commit.

### Documented limitation — H title-format trap

`family-h-original-PASS.md` is a byte-copy of the Card 1 H smoke audit at
`12ec7eb`. Its title is `# MCP-SERVER-009 Family H smoke — 2026-05-31`
(space-separated, lower-case "Family H smoke"), which does NOT match the
audit-lint family-letter regex `/MCP-SERVER-\d+-FAMILY-([A-Z])/i`.
Consequence: this fixture lints as `family: null` / `auditType: unknown` /
exit 0 — pinning the on-main behavior verbatim. This is intentional: the
fixture's role is "Card 1 smoke baseline preservation", and the lint
outcome is preserved even though L5 would semantically apply to a
canonical-titled H amendment. A future H amendment / production-enable
audit MUST use the canonical `MCP-SERVER-NNN-FAMILY-H-SMOKE` /
`-FAMILY-H-AMENDMENT` title format to be L5-protected.

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
| `family-h-original-PASS.md` | 0 (PASSES) | (none) — Card 1 H smoke baseline; title format `# MCP-SERVER-009 Family H smoke — 2026-05-31` does NOT match the family-letter regex, so `family: null` / `auditType: unknown` → L5 unreachable; exit 0 preserves the on-main outcome (this is NOT a doctrine satisfaction — see "H title-format trap" note above) |
| `family-h-amendment-PASS.md` | 0 (PASSES) | (none) — representative H amendment with canonical `MCP-SERVER-009-FAMILY-H-AMENDMENT` title; persisted `evidence_span` inspection present; L5 satisfied |
| `family-h-IMPROPER-PASS-no-evidence-span.md` | 1 (FAILS) | L5 ONLY — doctrine-risk Family H + verdict PASS + ZERO `evidence_span` inspection. The teeth proof (H analog of `original-family-e-IMPROPER-PASS`). Amendment-typed + intact L6 → L1/L2/L6 do NOT fire |
| `family-i-consistent-PARTIAL.md` | 0 (PASSES) | (none) — representative consistent-PARTIAL for Family I; names `evidence_span` as the deferred Phase 4b obligation so `hasInspection` is true and L5 does not fire. The substitute for H's byte-copy "original" (no on-main Card-1 I smoke exists) |
| `family-i-amendment-PASS.md` | 0 (PASSES) | (none) — representative I amendment / production-enable shape with canonical `MCP-SERVER-010-FAMILY-I-AMENDMENT` title; persisted `evidence_span` inspection present; L5 satisfied |
| `family-i-IMPROPER-PASS-no-evidence-span.md` | 1 (FAILS) | L5 ONLY — doctrine-risk Family I + verdict PASS + ZERO `evidence_span` inspection. The teeth proof (I analog of `original-family-e-IMPROPER-PASS`). Amendment-typed + intact L6 → L1/L2/L6 do NOT fire |

The Jest suite asserts these outcomes. If a future linter change causes a
mismatch, EITHER the linter must be tuned back OR the design's expected
outcomes need an explicit operator-approved revision.

## Source

Designer plan: `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md` §
Phase A.4 + the operator addendum.
