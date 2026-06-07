# OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK (#393) — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-07
**Branch:** feat/ops-mcp-audit-lint-rules-family-i
**Design:** docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK.md

## Summary
Card 2 of the Family-I chain: a DATA-only append of three strings —
`'thread_topology'`, `'family_i'`, `'compares_options'` — to the
`DOCTRINE_RISK_FAMILIES` Set in `scripts/ops/audit-lint-rules.cjs`, plus three
hand-authored synthetic fixtures, +11 opsAuditLint tests, a README/current-status
update, and a self-consistent smoke template. The change is genuinely DATA-only:
no logic change to `audit-lint-rules.cjs`, and `audit-lint.mjs` /
`audit-lint-lib.cjs` (incl. `mapFamilyLetterToName`) are absent from the diff
(byte-equal). The L5 teeth bind to the `family_i` alias (proved load-bearing by
a negative control) and the three fixtures lint to their intended outcomes. The
implementer's verdict-shape deviation on the consistent-PARTIAL fixture is a
legitimate fix that resolves a self-contradiction inside the design. No retroactive
break, no deploy-bearing path touched. Ready for operator push + PR.

## Verification
- typecheck: pass (exit 0)
- lint: pass (exit 0; worktree clean, no `.claude/worktrees/**` debris)
- test: 169 → 180 opsAuditLint (+11); full suite 693 suites / 21329 passed + 1 pre-existing skip = 21330 total (exit 0)
- secret scan: clean (no real secrets; fixture auth lines all `<… redacted>` placeholders)
- doctrine scan: clean (every "winner" hit is the *protective* "comparing options is **not** picking a winner" doctrine or a ban-list assertion; no truth/verdict labeling of a person/post/claim)
- Migration apply: N/A — no `supabase/migrations/**` in diff (CI/dev tooling only)

## Spec-point verification (against the review brief)
1. **3 Set entries present, only those 3, A–H unchanged/no reorder:** PASS. `audit-lint-rules.cjs` numstat = 17/0; the single hunk appends a comment + the 3 entries after H's block; A–H entries byte-equal.
2. **DATA-only / byte-equal:** PASS. `audit-lint.mjs`, `audit-lint-lib.cjs` (incl. `mapFamilyLetterToName` — confirmed no `I` case, default → `family_i`) NOT in diff. No `.github/workflows/` edit. All 13 pre-existing fixtures byte-equal (numstat empty each). No `.sql` added (scripts/ops .sql count = 17, unchanged).
3. **L5 teeth correctness + bind to family_i (HALT-11):** PASS.
   - `family-i-IMPROPER-PASS-no-evidence-span.md` → exit 1, findings `[L5]` only.
   - `family-i-amendment-PASS.md` → exit 0.
   - `family-i-consistent-PARTIAL.md` → exit 0.
   - Detector on IMPROPER fixture: `family: family_i`, `inDoctrineSet: true`.
   - **Negative control:** deleting the 3 I entries in-memory drops the IMPROPER fixture to exit 0 / no findings — proving the entries are load-bearing, not a silent no-op.
4. **Smoke-template self-consistency:** PASS. The template is skipped by filename (`-template.md` → `[skip] template doc`, exit 0). Force-linted (bypassing the skip) it detects `audit-type: ops`, verdict `null` (`## Final verdict: TBD`), and produces ZERO findings — lints clean by construction; names the persisted `evidence_span` obligation in Phase 4.
5. **No retroactive break:** PASS. Re-linting all 51 on-main `docs/audits/**SMOKE*.md` yields 46 pass / 5 nonzero. All 5 nonzero docs detect as `argument_scheme` / `evidence_source_chain` and were **already nonzero with the I entries removed** (L1/L2/L3/L4/L5 from pre-existing E/D doctrine-risk). None detect as `family_i`/`thread_topology`/`compares_options`. The only on-main `FAMILY-I`-titled doc is `MCP-SERVER-010-FAMILY-I-SMOKE-template.md` (skipped). Body mentions of `thread_topology`/`compares_options` are registry-table prose, not `Family:` declarations, and title-letter detection takes precedence — no flip.
6. **consistent-PARTIAL deviation:** LEGITIMATE FIX (see dedicated section below).
7. **Tests additive, not relaxed:** PASS. +11 real tests (3 membership incl. HALT-11 `family_i` alias, 1 preserves-E+F+G+H with set-size pin = 14, 1 detectFamily A.1-trap → `family_i`, 2 L5 fires/not-fires, 1 consistent-PASS regression, 3 fixture self-validation). FIXTURE_FILES 13→16; count assertion 13→16. No existing test weakened.
8. **Gates:** typecheck 0, lint 0, full jest 0; opsAuditLint 169→180 (+11) confirmed from captured `Tests: 180 passed` line.
9. **Secret scan:** clean.
10. **Branch-context:** `main == origin/main` (`4b9dabd…`); branch ahead 4 of origin/main (design + feat + test + docs commits).

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings — the only "winner" occurrences are the doctrine guard ("comparing options is **not** picking a winner") and ban-list assertions; fixtures carry the `AUDIT-LINT-FIXTURE … exclude from doctrine/verdict scans` marker
- [x] Score never blocks posting — N/A (CI/dev tooling); acceptance path untouched
- [x] No service-role in client code — N/A; no client/Edge/runtime code touched
- [x] No direct insert into public.arguments — N/A
- [x] No AI calls in production app paths — N/A; no runtime code
- [x] Plain language only — N/A (internal CI doc-lint surface, not user-facing)
- [x] Epic-specific doctrine (cdiscourse-doctrine §1, anti-truth-label): the L5 teeth *enforce* the doctrine — a doctrine-risk family audit must inspect the persisted `evidence_span` before a PASS verdict, preventing topology-verdict drift (off-topic/derailing/rehashing/"winner"). This card strengthens, not weakens, that guard.

## Test coverage
- [x] New Set membership has unit tests (3 `.has()` assertions + set-size pin)
- [x] L5-teeth behavior has fires/not-fires tests + 3 static-fixture self-validation tests
- [x] Edge cases from design (consistent-PARTIAL verdict parse, A.1-trap alias, additive preservation) have tests
- [x] Accessibility assertions — N/A (no UI)

## consistent-PARTIAL fixture deviation — LEGITIMATE
The design's fixture-body example (design line 786) used the inline form
`## Final verdict: PARTIAL`, but the design's own test (line 463) asserts
`parsed.verdict === 'PARTIAL'`. These contradict: `parseAuditDoc` extracts
`null` from the inline `## Final verdict: PARTIAL` form (verified empirically),
because the verdict regex requires a `**PARTIAL**` bold tag on a following line.
The shipped fixture uses the two-line `## Final verdict` + `**PARTIAL**` shape
(matching the G/F precedent), which parses to `PARTIAL` (verified: lint shows
`verdict: PARTIAL`, exit 0). This resolves the design's self-contradiction in
favor of the binding test and preserves the fixture's intent (a verdict-PARTIAL
doc that passes L5 because it names `evidence_span`). It is a strengthening, not
a weakening — without it the `parsed.verdict === 'PARTIAL'` assertion would be
vacuous.

## Blockers
None.

## Suggestions (non-blocking)
1. The design doc's fixture-body example for fixture 14 (`## Final verdict: PARTIAL`)
   should be corrected to the two-line form in a future doc-touch so the design
   no longer contradicts its own test. Not blocking — the design is not edited by
   this review and the shipped fixture is correct.

## Operator next steps
- Push the branch: `git push -u origin feat/ops-mcp-audit-lint-rules-family-i`
- Open PR: `gh pr create --title "OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK: enroll Family I in L5 doctrine-risk set (Card 2/3)" --body-file docs/reviews/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK.md`
- Deploy steps: NONE — this card is non-deploy-bearing (CI/dev tooling only; no Edge, no mcp-server, no migration, no workflow edit). Post-merge, the smoke template is filled in per `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE-template.md`.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)")
