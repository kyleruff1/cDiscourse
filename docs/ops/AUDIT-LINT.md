# Audit-lint — operator reference

`scripts/ops/audit-lint.mjs` is a read-only, deterministic linter for
MCP smoke audit docs. It encodes the operator-stated audit-integrity
rules R1-R4 into six mechanical checks (L1-L6) so the class of defect
that produced the `29f30b0` Family E improper-PASS audit (Phase 3
hosted MCP marked "NOT-RUN, covered indirectly via Phase 4 success";
verdict PASS) is caught at authoring time rather than via amendment
after the fact.

The linter is the enforcement layer. CI wiring landed in
`OPS-MCP-SMOKE-LINT-CI-WIRING` (see § "CI enforcement (GitHub
Actions)" below); the linter is now mechanically enforced on every PR
that touches a smoke audit doc OR the linter source / fixtures, and
remains operator-runnable via direct node invocation for local checks.

## Usage

```
node scripts/ops/audit-lint.mjs <doc-path>
node scripts/ops/audit-lint.mjs <doc-path> --report-only
node scripts/ops/audit-lint.mjs --help
```

Single-doc invocation only. Batch operation is a shell loop:

```bash
for f in docs/audits/*SMOKE*.md; do
  node scripts/ops/audit-lint.mjs "$f" --report-only
done
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | No findings (or `--report-only` was set) |
| 1 | One or more rule violations |
| 2 | Parse error (verdict not extractable; malformed doc) |
| 3 | File not found or unreadable |
| 5 | CLI argument error |

## The six rules

| Rule | Origin | What it checks |
| --- | --- | --- |
| **L1** | R1/R2 | Required-phase NOT-RUN + verdict PASS fails (under R1/R2 the verdict CANNOT exceed PARTIAL when a required phase did not run) |
| **L2** | R2/R4 | Indirect-proof phrase ("covered indirectly", "would pass", "verified via unit tests" as sole justification, etc.) in a NOT-RUN direct-proof phase fails (R4 forbids substitution) |
| **L3** | — | Production-enable audits must distinguish three success levels: dispatch + targeted classifier-signal + read-path (Source 6) |
| **L4** | — | Production-enable targeted-signal must include at least one positive RESULT row on deliberately targeted text; a successful RUN row alone is not signal proof |
| **L5** | — | Doctrine-risk audits (Family E `argument_scheme` / `slippery_slope`) must cite persisted direct output (the `evidence_span` column of `argument_machine_observation_results`) |
| **L6** | — | Amendment / hosted-completion / verdict-upgrade docs must name all three of: prior verdict, the specific missing proof that capped it, and the specific newly-supplied proof that lifts the cap |

The rules are pure DATA in `scripts/ops/audit-lint-rules.cjs`. Adding
a new doctrine-risk family, a new indirect-proof phrase, or a new
provenance pattern is a one-line edit.

## Audit-type detection

The linter classifies each doc into one of six audit types based on
the title (line 1) and body declarations:

| Type | How it's detected |
| --- | --- |
| `production-enable` | Title contains `-ENABLE-SMOKE` |
| `family-ship` | Title matches `MCP-SERVER-NNN-FAMILY-X-SMOKE` |
| `amendment` | Title contains `AMENDMENT` (takes precedence over `family-ship` and `hosted-completion`) |
| `hosted-completion` | Title contains `COMPLETION` or `upgrade` |
| `ops` | Title starts with `OPS-` |
| `unknown` | None of the above |

Body-level `Audit-type: <type>` override on its own line wins over
title-based detection.

## Phase-id normalization

The linter normalizes phase headers like
`## Phase 3 — Hosted MCP server smoke (15 checks)` into kebab-case
phase IDs like `phase-3-hosted-mcp-smoke`. The canonicalizer collapses
header variants (`Hosted MCP`, `Hosted MCP smoke`, `Hosted MCP
server smoke`) to a single canonical key so the rules-file
required-phase set lookups stay simple.

If you introduce a NEW phase variant in a smoke template, run the
linter against your new audit doc and confirm the phase id matches
the canonical key. If not, extend `canonicalizePhaseSlug` in
`scripts/ops/audit-lint-lib.cjs`.

## Marker mechanism

Each post-hardening smoke template carries an `Audit-Lint: v1` marker
line near the top. The marker exists so a future CI scoping policy
can distinguish:

- **ADDED** smoke audit docs (git status `A`) — always linted, marker
  or not. This closes the evasion loophole; a bad actor cannot submit
  a new smoke audit without the marker.
- **MODIFIED** smoke audit docs (git status `M`) — linted only if the
  file carries the marker. This exempts pre-hardening historical
  edits from the linter while enforcing post-hardening edits.

The marker string is exact (`Audit-Lint: v1`) and is defined in
`scripts/ops/audit-lint-rules.cjs` as `MARKER_STRING`.

## CI enforcement (GitHub Actions)

CI wiring landed in `OPS-MCP-SMOKE-LINT-CI-WIRING` (issue
[#341](https://github.com/kyleruff1/cDiscourse/issues/341)). The
workflow lives at `.github/workflows/audit-lint.yml` and runs on
every PR that touches one of these path patterns:

- `docs/audits/**SMOKE*.md` — any smoke audit doc
- `scripts/ops/audit-lint.mjs` — the runner
- `scripts/ops/audit-lint-lib.cjs` — the pure helpers
- `scripts/ops/audit-lint-rules.cjs` — the rule data
- `__tests__/fixtures/audit-lint/**` — fixture changes

Why the linter source files are in the trigger set: changing the
linter without re-running self-validation would silently break
enforcement. That's the same evasion path the marker scoping closes
for new audit docs.

### What the workflow does

1. Checks out the PR head with `fetch-depth: 0` so the PR base SHA's
   tree is fetchable for `git diff`.
2. Pins Node 20.x via `actions/setup-node@v4`.
3. Resolves `BASE_SHA=${{ github.event.pull_request.base.sha }}` and
   `HEAD_SHA=${{ github.event.pull_request.head.sha }}`.
4. Shells out to the shared classifier:

   ```
   node scripts/ops/audit-lint.mjs --classify-changed \
     --base "$BASE_SHA" --head "$HEAD_SHA"
   ```

   This is the single source of in-scope decisions — CI and the
   runner cannot disagree.
5. For each in-scope path, runs `node scripts/ops/audit-lint.mjs
   <path>` and aggregates exit codes. Any non-zero exit fails the
   workflow.
6. If no applicable files → the workflow exits 0 (the lint step is
   skipped via step-condition).

### Single-source scoping rule

The in-scope set is computed entirely inside the classifier:

| Status | Marker at HEAD? | In-scope? |
| --- | --- | --- |
| `A` (added smoke audit doc) | not needed | YES — always linted (closes the "submit new audit without marker" evasion) |
| `M` (modified smoke audit doc) | YES (`Audit-Lint: v1` present) | YES |
| `M` (modified smoke audit doc) | NO | NO — historical, exempt |
| `D` / `R` / `C` | n/a | NO — out of scope |
| Any other path | n/a | NO — out of scope |
| `-template.md` (any status) | n/a | NO — templates refused |

The marker string lives in `scripts/ops/audit-lint-rules.cjs` as
`MARKER_STRING`. The classifier sources it from there via `require()`;
the workflow YAML never contains the literal string.

### Diff base mechanics

The workflow uses the GitHub-provided PR base SHA, NEVER `HEAD~1` or
`origin/main`. Under force-push / stale-base / squash, the guessed
bases go wrong precisely when enforcement matters; the PR event's
`base.sha` is the only stable reference.

### Operator-run local checks

The direct-node invocation remains the canonical operator surface:

```
node scripts/ops/audit-lint.mjs <doc-path>
```

CI is the mechanical safety net; the operator pre-checks the doc
locally during authoring. The smoke templates (Family C / D / E) each
carry an "Audit-lint required final step" section that points the
operator at the local invocation.

### Historical note: CI was deferred in the predecessor card

`OPS-MCP-SMOKE-DOCTRINE-HARDENING` (PR #340) landed with PARTIAL
verdict because `.github/workflows/` did not exist in the repo;
introducing it inside that card would have been a non-additive
shared-workflow change firing HALT trigger 9. The PARTIAL cap was
explicitly tied to "CI wiring deferred to follow-on
`OPS-MCP-SMOKE-LINT-CI-WIRING`." This card created the workflow file
and lifted the cap.

## Adding a doctrine-risk family

Doctrine-risk families are listed in
`scripts/ops/audit-lint-rules.cjs` as `DOCTRINE_RISK_FAMILIES`. To
add a new family:

1. Open `scripts/ops/audit-lint-rules.cjs`.
2. Add the family name to the `DOCTRINE_RISK_FAMILIES` set:
   ```js
   const DOCTRINE_RISK_FAMILIES = new Set([
     'argument_scheme',
     'slippery_slope',
     'your_new_family_name',   // <-- add here
   ]);
   ```
3. If the family has a doctrinal-axis alias, add that too.
4. Add a unit test in `__tests__/opsAuditLint.test.ts` confirming the
   new family trips L5 when persisted inspection is absent.
5. Update the fixture self-validation expectations if any fixture is
   in the new family.

A future audit doc for the new family that lacks `evidence_span`
inspection will trigger L5.

## Adding an indirect-proof phrase

Indirect-proof phrases are in
`scripts/ops/audit-lint-rules.cjs` as `L2_INDIRECT_PHRASES`. To add
a new phrase:

1. Open `scripts/ops/audit-lint-rules.cjs`.
2. Add a regex to the `L2_INDIRECT_PHRASES` array. Use the
   case-insensitive `/i` flag.
3. If the phrase has a legitimate supplement form (like "verified via
   unit tests plus direct hosted smoke"), add a negative-lookahead
   matching the supplement keywords (see existing
   `verified\s+via\s+unit\s+tests\b(?!\s+(plus|and|as\s+a\s+supplement))`).
4. Add a unit test confirming the new phrase trips L2 when it appears
   in a NOT-RUN direct-proof phase justification with verdict PASS,
   AND that the supplement form does NOT trip.

## The fixture directory

`__tests__/fixtures/audit-lint/` contains 4 STATIC copies of
historical audit docs:

- `original-family-e-IMPROPER-PASS.md` (29f30b0) — the centerpiece
  defect; L1 + L2 + L5 trip
- `family-e-amendment-PARTIAL.md` (b1829f5) — consistent-PARTIAL
  amendment; must NOT false-fail
- `family-e-hosted-completion-PASS.md` (bccb0c2) — gap closed by
  operator-supplied direct proof
- `family-d-strengthened-amendment-PASS.md` — model amendment with
  all 9 strengthened criteria satisfied

Each fixture starts with an `<!-- AUDIT-LINT-FIXTURE: ... -->` HTML
comment marker. The fixture directory carries a `README.md`
documenting the intentional-negative-fixture contract — these files
contain historical defect language by design, and doctrine ban-list
scanners MUST exclude them.

The Jest suite asserts every fixture starts with the marker, the
README is present, and the fixture count is exactly 4.

## Updating a smoke template

If you add a new smoke template (e.g., Family F at
`MCP-SERVER-007-FAMILY-F-SMOKE-template.md`), include:

1. `Audit-Lint: v1` near the top (within the first 50 lines).
2. The "Audit-lint required final step" section at the bottom, with
   the doc-path placeholder updated to match the new template.
3. For production-enable templates, an explicit three-level section
   (dispatch / targeted classifier-signal / read-path) so L3 + L4
   have a home to land in.

This is the post-hardening default for all new smoke audits.

## What the linter is NOT

- **Not a semantic-correctness checker.** L6 verifies STRUCTURAL
  presence of provenance components (prior verdict + missing proof +
  newly-supplied proof); it does NOT verify that the named
  predecessor is correct or that the newly-supplied proof is real.
  Operator review remains the source of correctness truth.
- **Not a verdict-token doctrine scanner.** The linter does not scan
  for "winner", "loser", "liar", etc. inside audit docs — that's the
  cdiscourse-doctrine concern handled by
  `mcp-observability-report.mjs`'s `scanMarkdownForBannedTokens` for
  Source 6 output, and is orthogonal to L1-L6.
- **Not a test-count validator.** The linter does not parse "1805
  tests" claims; that's a separate regression-gate concern.
- **Not an AI-call.** No LLM, no network. Pure regex + text parsing.

## Source

- Design: `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md`
- Intent brief: `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING-intent.md`
- Runner: `scripts/ops/audit-lint.mjs`
- Library: `scripts/ops/audit-lint-lib.cjs`
- Rules data: `scripts/ops/audit-lint-rules.cjs`
- Tests: `__tests__/opsAuditLint.test.ts`
- Fixtures: `__tests__/fixtures/audit-lint/`
