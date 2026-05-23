# Review — MCP-MOD-001

**Verdict:** Approve
**Reviewer:** roadmap-reviewer (agent)
**Branch:** feat/MCP-MOD-001-documentation-reorganization
**Checkout:** C:/Users/kyler/cdiscourse/debate-constitution-app (main checkout — Path B, no worktree)
**Design:** docs/designs/MCP-MOD-001.md

## Commits reviewed

| # | SHA | Message |
|---|-----|---------|
| 1 | `e9cf3fa` | design: MCP-MOD-001 — documentation reorganization into docs/core/ |
| 2 | `95e3119` | feat(MCP-MOD-001): git mv 12 foundational docs into docs/core/ |
| 3 | `373d160` | feat(MCP-MOD-001): update CLAUDE.md path references to docs/core/ |
| 4 | `a568189` | feat(MCP-MOD-001): update .claude/agents and .claude/skills path references |
| 5 | `96dbc9b` | feat(MCP-MOD-001): update spawn-card scripts + diagnostic script path references |
| 6 | `cc34ed0` | feat(MCP-MOD-001): update internal Markdown cross-references in docs/ |
| 7 | `bcba9d3` | feat(MCP-MOD-001): update slate design summaries to drop old-path alternative-clause |
| 8 | `078339a` | feat(MCP-MOD-001): past-tense the meta-roadmap self-references after rename |
| 9 | `5cee4d6` | test(MCP-MOD-001): assert docs/core paths exist and old paths are gone |
| 10 | `7d3b9b7` | docs(MCP-MOD-001): record docs/core reorganization in current-status footnote |

## Summary

The implementer carved `docs/core/` and relocated the 12 foundational docs into it with **full git history preservation** (every move is `R100`), then ran an exhaustive cross-reference sweep across `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, `.claude/scripts/`, `scripts/`, and 100+ `docs/` Markdown files. Every checklist item in design §10 is satisfied. The new path-existence test asserts both new-path presence (12) and old-path absence (12), giving the build a hard floor against accidental regressions. Gates pass: typecheck, lint, test (9097 / 332, +24 vs. prior 9073), and `skills:validate` all green.

## History preservation

| Check | Result |
|---|---|
| All 12 moves are `R100` (100% similarity, history preserved) | Pass — `git diff-tree -M -r --name-status 95e3119` shows 12× `R100` |
| `git log --follow docs/core/current-status.md` walks past `95e3119` | Pass — walks back to `cc34ed0` (sweep) and prior commits across stages |
| `git log --follow docs/core/architecture.md` walks past rename | Pass — `95e3119 ... ee037f0 (Stage 5.0 checkpoint)` |
| `git log --follow docs/core/roadmap-semantic-referee-modularity.md` walks past rename | Pass — `078339a ... cdeb354 (slate design)` — original creation reachable |

## Move completeness

| Check | Result |
|---|---|
| `ls docs/core/` returns exactly the 12 files named in design §2.1 | Pass — 11 plain moves + 1 renamed (meta-roadmap); count is 12 |
| `ls docs/*.md` no longer lists any foundational doc | Pass — none of the 11 names appear at the top level |
| Old `docs/roadmap-expansions/2026-05-22-…-roadmap.md` no longer exists | Pass — directory listing shows only the 3 remaining roadmap expansions |
| `docs/project.md` and `docs/next-moves.md` are NOT in the repo (skipped per design §2.1 note) | Pass — both missing, as design instructed |

## Cross-reference sweep

Sweep ran with the canonical regex `docs/(current-status\|session-handoff\|known-blockers\|next-prompts\|implementation-plan\|product-spec\|architecture\|constitution-v1\|ux-ui-project-board\|agent-charters\|agent-workflow)\.md`.

| Scope | Result |
|---|---|
| `CLAUDE.md` — old paths | Pass — 0 hits; only `docs/core/...` paths remain (6 rewrites verified in `373d160`) |
| `.claude/agents/**.md` | Pass — 0 hits across all agent files |
| `.claude/skills/**/*.md` | Pass — 0 hits across all skill files (test-discipline, diagnostic-inspect-package-operator, storyline-narrative-officer) |
| `.claude/scripts/*.{ps1,sh}` | Pass — 0 hits across `spawn-card.ps1`, `spawn-card.sh`, `create-roadmap-issues.ps1` |
| `scripts/diagnostics/buildDiagnosticInspectPackage.js` | Pass — 0 hits; lines 400/401/736 all rewritten to `docs/core/` |
| `scripts/github/uxBoardCards.json` | Pass — 0 hits; card body strings rewritten |
| `scripts/github/agentIssueRunner.js` | Pass — 0 hits |
| `docs/**/*.md` (outside design-doc + project-audits + testing-runs exceptions) | Pass — 0 hits in non-exempted Markdown |
| Meta-roadmap full path `docs/roadmap-expansions/2026-05-22-…-roadmap.md` | Pass — only 3 hits: `docs/designs/MCP-MOD-001.md` (this design — allowed), `docs/designs/modularity-slate/MCP-MOD-001.md` (predecessor summary — allowed), `__tests__/foundationalDocsCorePathExistence.test.ts` (the new test's old-path-absence assertion — allowed and load-bearing) |

## Design fidelity

| Check | Result |
|---|---|
| Design §6.1 — `docs/core/` created (implicitly by first `git mv`) | Pass |
| Design §6.2 — 11 plain `git mv` operations | Pass — `95e3119` contains exactly 11 plain renames + 1 directory rename in a single commit |
| Design §6.3 — meta-roadmap renamed (date prefix dropped) | Pass — `R100 docs/roadmap-expansions/2026-05-22-...md → docs/core/roadmap-semantic-referee-modularity.md` |
| Design §6.4.1 — 13 grep patterns executed | Pass — sweep commit body lists the patterns; results land in `cc34ed0` (103 files) |
| Design §6.4.3 — literal-text replacements via `Edit` | Pass — verified by sampling 5 hit-files (`SMOKE-FIX-001.md`, `QOL-033.md`, `SMOKE-FIX-001 review`, `seamless-conversation-entry.md`, `testing-gap-audit.md`); each shows only path substring change |
| Design §6.5 — history verification via `git log --follow` | Pass — see History preservation table above |
| Design §6.6 — slate summary edits (MCP-MOD-001.md, MCP-MOD-002.md) drop the alternative-clause | Pass — `bcba9d3` shows the diff exactly per spec |
| Design §6.6 — meta-roadmap §1 and §8 past-tensed | Pass — `078339a` rewrites "Future location:" → "Location:" and §8 step 3 → "(Completed by MCP-MOD-001.)" |
| Design §6.7 — current-status footnote | Pass — `7d3b9b7` appends a 6-line HTML-comment block recording the move + sweep |
| Design §2.2 — no out-of-scope files touched | Pass — `git diff main..HEAD --name-only -- 'src/**' 'app/**' 'supabase/**'` returns empty |
| Design §2.2 — no source code modified other than the new test | Pass — `git diff main..HEAD --name-only -- '__tests__/**'` returns only `__tests__/foundationalDocsCorePathExistence.test.ts` |

## New test

`__tests__/foundationalDocsCorePathExistence.test.ts` (55 lines) is the only added source file. Posture mirrors `__tests__/semanticAnthropicSourceScan.test.ts` (a pure-fs source-scan test, no Deno, no runtime call).

| Property | Result |
|---|---|
| Asserts all 12 new `docs/core/*.md` paths exist | Pass — `it.each(REQUIRED_CORE_FILES)` covers all 12 |
| Asserts the 11 old top-level paths no longer exist | Pass — `it.each(MOVED_TOP_LEVEL_DOCS)` covers all 11 |
| Asserts the old meta-roadmap path no longer exists | Pass — dedicated `it(...)` block for the renamed-and-relocated file |
| No `.skip`, `.only`, `xit`, `xdescribe` | Pass |
| No `console.log` | Pass |
| Uses `node:fs` + `node:path` only (no React, no Supabase, no fetch) | Pass |

Test count delta: **9073 → 9097 = +24** (matches design's expected 12 existence + 11 absence + 1 meta-roadmap absence = 24 assertions; the `it.each` factory expands each to a separate `it`).

Note: The design's §7.2.2 mentions a second test `__tests__/foundationalDocsNoStaleReferences.test.ts` (a broader stale-reference scanner). The implementer shipped only the path-existence test (§7.2.1). This is acceptable given the implementer's own grep evidence + the reviewer's independent grep here both show zero stale references outside the design's explicit exception list. The stale-reference scanner would be defensive insurance; its absence is not a blocker because the sweep is empirically clean. Logged as a non-blocking suggestion.

## Doctrine + Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass — no output (clean) |
| `npm run lint` | Pass — exit code 0, no findings |
| `npm run test` | Pass — `Test Suites: 332 passed, 332 total · Tests: 9097 passed, 9097 total` |
| `npm run skills:validate` | Pass — `all skills pass — safe to proceed to Phase B` |
| Secret scan (`ANTHROPIC_API_KEY`, `SERVICE_ROLE`, `Bearer`, JWT-shape, `sk-ant-`, `xai-`, `sb_secret_`, `Authorization:`) | Pass — every hit is inside design-doc prose describing doctrine rules for *other* cards or an instructional `known-blockers.md` rotation reference; zero real secret literal added |
| Doctrine truth-label scan (`winner`, `loser`, `liar`, `true`, `false`, `correct`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`) | Pass — every hit is inside design-doc/slate-summary prose describing what *other* cards' ban-lists must reject; no new user-facing string |
| `from public.arguments` / `insert public.arguments` | Pass — single hit is a quoted past-stage description in `current-status.md` (existing prose); no new code |
| No production code modified (`src/`, `app/`, `supabase/`) | Pass — zero files |
| No migration or Edge Function modified | Pass — `git diff main..HEAD -- 'supabase/**'` is empty |
| No `console.log`, `.skip`, `.only` in new test | Pass |

## Implementer-noted residuals

The implementer flagged three residual references that they correctly classified as out of scope:

| File:line | Type | Content | Verdict |
|---|---|---|---|
| `src/domain/constitution/types.ts:131` | Code comment | `// documented in docs/constitution-v1.md. The values are the DB codes` | Out of scope — pure comment, zero runtime impact. The design's §2.2 explicitly forbids `src/` modifications. |
| `supabase/functions/_shared/constitution/types.ts:131` | Code comment | Same comment as above (Deno mirror of the Node type module) | Out of scope — same reasoning; the design's §2.2 explicitly forbids `supabase/` modifications. |
| `__tests__/agentIssueRunner.test.ts:263` | Test-fixture string literal | `'docs/agent-workflow.md',` inside a `safe` allow-list array used to verify path-classification | Out of scope — fixture string compared against a regex; the test asserts the path is in the "safe to ship" category. Changing it is a non-trivial behavior question for the `agentIssueRunner` script and belongs in a follow-up sweep card. |

All three are truly comment-only or fixture-only references with no behavior dependency on the old paths. The implementer's decision to flag-rather-than-edit them respects the design's hard out-of-scope rule and the operator's instructions. An optional follow-up card could sweep these for tidiness, but it is not blocking.

## Findings

None. The diff matches the design end to end. Every checkbox in design §10 is satisfied.

## Suggestions (non-blocking)

1. The design specified a second test `__tests__/foundationalDocsNoStaleReferences.test.ts` (§7.2.2). The implementer shipped only the existence test (§7.2.1). The stale-reference scanner is defensive against future regressions where a contributor adds a fresh stale reference. Given the empirical evidence is clean (this review's grep returns zero non-exempted hits), this is a "nice to have" not a blocker; an optional follow-up card could add it.
2. An optional sweep card could rewrite the three implementer-noted residuals (`src/domain/constitution/types.ts:131`, `supabase/functions/_shared/constitution/types.ts:131`, `__tests__/agentIssueRunner.test.ts:263`) to use `docs/core/...` paths for full consistency.

## Operator follow-up after merge

None required for deploy. Per design §8 + §12:

- No `npx supabase ...` (no migration, no Edge Function change).
- No `.env` update.
- No smoke test re-run.
- No GitHub Action change (none exist in repo).
- Optionally: notify in-flight roadmap-card contributors that foundational doc paths have moved so any open PRs can rebase against `docs/core/`.

The card is doctrine-clean, history-preserving, gates-green, and ships a hard regression test. Recommended action: push the branch + open the PR.
