# MCP-021A Review — Maximal Boolean Machine Observation Taxonomy

**Card:** MCP-021A
**Branch:** feat/MCP-021A-maximal-boolean-machine-observation-taxonomy
**Reviewer:** roadmap-reviewer subagent
**Date:** 2026-05-25
**Verdict:** **PASS**
**Brief authorship:** operator-authored at b74ec9f
**Design doc:** docs/designs/MCP-021A.md (commit 84a4885, 2,522 lines)
**Audit grounding:** docs/audits/MCP-020-semantic-boolean-observation-inventory.md (commit e1b4e52)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/300

## Summary

MCP-021A ships a maximal-boolean Machine Observation taxonomy of 172
entries (existing 65 retroactively annotated + 107 new) across 10
families, organized via a parallel `MachineObservationDefinition`
registry that leaves `NodeLabelMark` byte-equal. Every entry carries
the 8 new MCP-021A verbose fields (`family`, `booleanQuestion`,
`positiveDefinition`, `negativeDefinition`, `positiveExamples`,
`negativeExamples`, `falsePositiveGuards`, `doctrineNotes`,
`confidenceEligibility`). A new pure-TS MCP wire schema
(`mcpBooleanObservationSchema.ts`) implements all three audit-confirmed
refinements (confidence REQUIRED, per-call timeout, unknown-rawKey
silent discard) plus 7 failure modes. Zero runtime behavior change:
Source 6 adapter still returns `[]` byte-equal; UX-001.5A display caps
unchanged; UX-001.6 cross-device QA matrix passes 2937/2937. Test
delta is exactly +150 / +10 (16,759 → 16,909 / 502 → 512), matching
the implementer's claim. All 12 conditional HALT triggers verified
clean. Verdict: **PASS** — operator may push and open the PR.

## Verdict matrix

| Item | Result | Notes |
|---|---|---|
| A — Doctrine constraints (verdict-token grep) | PASS | All hits in diff are legitimate: ban-list constants in tests, doctrine notes in design doc, jsdoc/comments describing what to ban. Zero user-facing copy hits. |
| B1 — Read-only API boundary (nodeLabels primitives) | PASS | Zero diff on nodeLabelSourceAdapters.ts, userAllegationRegistry.ts, nodeLabelPresentationModel.ts, nodeLabelPriorityModel.ts, NodeLabelStrip.tsx, NodeLabelInspectGroups.tsx, nodeAnnotations/, designTokens.ts. |
| B2 — Read-only API boundary (banner / composer / oneBox / arguments) | PASS | Zero diff on RefereeBannerView.tsx, composer/, oneBox/, ArgumentTimelineMap.tsx, ArgumentScoreTracker.tsx, metadata/, lifecycle/, semanticReferee/, useSemanticReferee.ts. |
| B3 — Read-only API boundary (Supabase) | PASS | Zero diff on supabase/migrations/, supabase/functions/. |
| C — UX-001.2 offset acceptance test | PASS | 11/11 tests passed (0.832s). |
| D — UX-001.3 composer/ zero diff | PASS | Zero bytes on composer/, ArgumentComposer.tsx, ArgumentComposerDock.tsx. |
| E — UX-001.4 menu chassis preservation | PASS | Zero bytes on actPopoutModel.ts, Popout.tsx, PopoutEntry.tsx, PopoutGroup.tsx. |
| F — UX-001.5 primitive set preservation | PASS | Zero bytes on nodeAnnotations/ directory. |
| G — UX-001.5A display cap preservation | PASS | nodeLabelPresentationModel.ts byte-equal per Item B1; dedicated test mcpOneTwoOneADisplayCapPreservation.test.ts passes 4/4 with synthetic 150-positive stress test. |
| H — Source 6 adapter byte-equal (BINDING; Trigger 1) | PASS | Zero bytes on nodeLabelSourceAdapters.ts. Verified by `git diff main..HEAD -- src/features/nodeLabels/nodeLabelSourceAdapters.ts | wc -l` → 0. Dedicated test mcpOneTwoOneASourceSixInvariance.test.ts passes 8/8 confirming the adapter returns [] for all inputs. |
| I — UX-001.6 cross-device QA matrix intact | PASS | Zero bytes on the 5 uxOneOneSix*.test.{ts,tsx} files. All 5 suites pass 2937/2937 (1.972s). |
| J — UX-001.7 token surface preservation | PASS | Zero bytes on designTokens.ts. |
| K — Registry growth correctness | PASS | Implementer chose the design §4 option (b) PARALLEL REGISTRY: the original machineObservationRegistry.ts is byte-equal (zero stat), preserving all 65 existing entries; the new parallel definitions live in machineObservationDefinitions.ts + 10 per-family files (familyA..familyJ.ts). Total 172 entries verified by mcpOneTwoOneARegistrySize.test.ts. Per-family counts: A=16, B=14, C=17, D=27, E=16, F=14, G=30, H=12, I=21, J=5 (G=30 reflects the design §3.7 self-correction noted in the test file — 21 retroactive entries rather than 20). Family breakdown sums to 172. Trigger 11 ceiling (≤200) clean. |
| L — Per-entry definition completeness (Trigger 12) | PASS | mcpOneTwoOneADefinitionCompleteness.test.ts passes 10/10. Every definition has all 8 MCP-021A new fields populated plus the 11 echoed NodeLabelMark fields. |
| M — No duplicate semantic aliases (Decision 5) | PASS | mcpOneTwoOneANoDuplicateAliases.test.ts passes 11/11. Three Decision-5 merge candidates kept as existing #49/#38/#45. Trigger 10 Family J DROPs verified. |
| N — Surface policy (Decision 4) | PASS | mcpOneTwoOneASurfacePolicy.test.ts passes 11/11. Family B umbrella + Inspect-only subtypes verified. Family E/F all inspect. Family J never Timeline. |
| O — MCP schema validation | PASS | mcpBooleanObservationSchema.test.ts passes 36/36. Unknown rawKey discard, malformed JSON → zero chips, low-confidence-Timeline gate all verified. |
| P — Label doctrine | PASS | mcpOneTwoOneALabelDoctrine.test.ts passes 11/11. Scans 172 entries × 13 verdict tokens + 7 quality-verdict phrases + Family E never-fallacy + Family F never-unwarranted + Family J never-Timeline + kind invariant. Zero offenders. |
| Q — Source 6 runtime invariance | PASS | mcpOneTwoOneASourceSixInvariance.test.ts passes 8/8 verifying adaptRawClassifierBinarySource returns [] for an input battery including simulated MCP-021C payloads. |
| R — Family I auto-metadata reclassification documented | PASS | Design doc §12.3 enumerates per-key Decision 7 outcomes: 4 DERIVABLE → auto_metadata (splits_thread, merges_thread, references_sibling_node, references_ancestor_node); 3 NOT DERIVABLE → ai_classifier (returns_to_prior_issue, references_external_context, compares_options); plus operator-deferred review note that operator may choose ai_classifier in 021A and revisit at 021C. |
| S — Family J sensitive entry reconciliation documented | PASS | Design doc §2.4 and §12.5 enumerate: existing 5 preserved verbatim (3 composer_only + 2 inspect_only); 3 brief candidates DUPLICATE existing; 5 brief candidates DROP per Trigger 10. Family J final count: 5 — UNCHANGED. |
| T — Full test suite | PASS | `npm test` exit 0. **Test Suites: 512 passed, 512 total / Tests: 16909 passed, 16909 total (14.911s)**. Test count delta 16759 → 16909 = +150 tests / +10 suites — matches implementer's claim EXACTLY. |
| U — Typecheck + lint | PASS | `npm run typecheck` exit 0. `npm run lint` exit 0 (`--max-warnings 0`). |
| V — No new dependencies | PASS | Zero bytes on package.json + package-lock.json. |
| W — No new AI provider call paths | PASS | Zero matches for invoke.*semantic-referee / @anthropic-ai/sdk / openai / from .anthropic imports across the diff. The new mcpBooleanObservationSchema.ts is pure-TS wire contract types — no `fetch`, no network. The threadTopologyAutoMetadata.ts derivers all return [] (no-op stubs). |
| X — MCP-021A handoff section appended | PASS | docs/core/current-status.md gains a single new `<!-- Latest implementer card: MCP-021A ... -->` comment INSERTED at line 2 (immediately after `# CDiscourse — Current Status` heading), which is the canonical position for the Latest-card stack. Prior UX-001.5A / UX-001.7 / UX-001.6 cards are preserved beneath it. Zero removals from the rest of the file. |
| Y — Ledger items enumerated | PASS | Design doc §12 ledger contains all required subsections: §12.1 per-family count adjustments (Phase A reconciliation); §12.2 Decision 5 outcomes per merge candidate; §12.3 Decision 7 outcomes per Family I key; §12.4 operator-narrative candidates dropped (6 DROPs with rationale); §12.5 Family J overlap reconciliation summary; §12.6 missing source-access-audit skill documentation (matches MCP-020 audit precedent); §12.7 8 items flagged for operator-deferred review at completion report. |

## Critical preconditions verified

1. **Source 6 byte-equal (Item H, Trigger 1).** `git diff main..HEAD -- src/features/nodeLabels/nodeLabelSourceAdapters.ts` returns 0 bytes. `adaptRawClassifierBinarySource` continues to return `[]` unconditionally. mcpOneTwoOneASourceSixInvariance.test.ts (8/8 pass) confirms the runtime contract holds across a battery of inputs.

2. **UX-001.6 cross-device QA matrix preservation (Item I).** All 5 uxOneOneSix*.test.{ts,tsx} files byte-equal vs main. All 5 suites pass 2937/2937 — identical to the UX-001.5A baseline.

3. **UX-001.5A display caps unchanged (Item G).** nodeLabelPresentationModel.ts byte-equal. mcpOneTwoOneADisplayCapPreservation.test.ts (4/4 pass) confirms the synthetic 150-positive stress test still yields Timeline 1 Machine + 1 User + overflow / Selected 3 Machine + 3 User + overflow.

4. **Read-only API boundary clean (Items B/D/E/F/J/V).** Zero diff across 20+ enumerated paths spanning nodeLabels primitives, banner, composer, oneBox, arguments, semantic referee, design tokens, supabase, and dependencies. The only modifications outside the new MCP-021A files are: (a) additive type extensions in `nodeLabelTypes.ts` (153 lines added, zero removals); (b) additive re-exports in `nodeLabels/index.ts` (41 lines added, zero removals); (c) appended handoff comment in `current-status.md` (zero removals from prior content).

5. **Parallel-registry architectural choice (Item K).** The implementer chose design §4 option (b): leaving `MACHINE_OBSERVATION_REGISTRY` (and its `NodeLabelMark` values) byte-equal, exposing the extended `MachineObservationDefinition` shape via a parallel `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY`. This is the option the design explicitly preferred for byte-equal preservation and is the safer choice for downstream consumers. The 10 per-family files (familyA..familyJ.ts) under `machineObservationDefinitions/` total 6,320 lines of definition data covering all 172 entries — a reasonable file-size partition.

## Findings

No blocking findings. Three minor non-blocking observations:

1. **Family G count drift from design forecast (informational).** Design §3.11 forecast 171 total (Family G = 29); shipped 172 total (Family G = 30). The discrepancy is the design's own §3.7 self-correction note ("21 retroactive entries not 20"), which the implementer's Phase A audit confirmed. Both counts respect Trigger 11 (≤200). The mcpOneTwoOneARegistrySize.test.ts file documents the resolution inline. No action needed.

2. **Stale comment in machineObservationRegistry.ts header (informational).** Per the implementer's operator-deferred review item #5 (and design §16 risk #8), the existing header comment at lines 4-5 still says "64 entries — 16 auto + 18 lifecycle + 25 AI classifier + 5 sensitive composer-only" — which was already off-by-one (registry holds 65 with 19 lifecycle) at the UX-001.5A baseline and remains stale. The implementer chose NOT to touch this file to keep the read-only-boundary contract pristine; the parallel-registry approach means the comment is informationally stale rather than wrong about the registry it documents. Could be cleaned up in a future micro-card. No action needed.

3. **`source-access-audit` skill not registered (informational).** Per item §12.6 of the design doc and per the launch prompt's note, the `source-access-audit` skill referenced in the roadmap-designer charter does not exist as a registered Skill. The implementer's Phase A substitution pattern (use the two existing audit documents as exemplar) matches the MCP-020 precedent. An OPS-006-style skill-promotion card is the proper follow-up. No action needed for MCP-021A.

## Recommendation

**PASS — operator can push and open the PR.** No blockers, no changes
requested. The implementer cleanly executed a large taxonomy expansion
(+11,491 net lines across 27 files) with zero runtime behavior change,
zero read-only boundary violations, and exact test-delta accuracy
(+150 / +10 matches the claim). All 12 conditional HALT triggers
verified clean. The doctrine self-check at design §15 holds: every
new entry routes through plain-language fields scanned by
mcpOneTwoOneALabelDoctrine.test.ts, every Family J entry honors
Trigger 10, every Family E entry resists fallacy framing, and the
Machine-Observations-vs-User-Allegations kind invariant is enforced
across all 172 entries.

## Operator next steps

1. Push the branch: `git push -u origin feat/MCP-021A-maximal-boolean-machine-observation-taxonomy`
2. Open the PR via `gh pr create --title "MCP-021A: Maximal Boolean Machine Observation Taxonomy" --body-file docs/reviews/MCP-021A-review.md`
3. Deploy steps from design §13: **NONE** — pure code change. No migration. No Edge Function. No env var. No `npx supabase` command. No dependency install.
4. After merge, run the post-merge worktree cleanup per `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)".

## Test suite snapshot

```
Test Suites: 512 passed, 512 total
Tests:       16909 passed, 16909 total
Snapshots:   0 total
Time:        14.911 s
Ran all test suites.
FULL TEST EXIT: 0
```

```
npm run typecheck → TYPECHECK EXIT: 0
npm run lint      → LINT EXIT: 0
```

```
UX-001.2 offset acceptance:    11/11 PASS (0.832s)
UX-001.6 matrix (5 suites):    2937/2937 PASS (1.972s)
MCP-021A schema test:           36/36  PASS
MCP-021A registry size:         33/33  PASS
MCP-021A definition completeness: 10/10 PASS
MCP-021A no duplicate aliases:  11/11  PASS
MCP-021A surface policy:        11/11  PASS
MCP-021A label doctrine:        11/11  PASS
MCP-021A source 6 invariance:    8/8   PASS
MCP-021A display cap preservation: 4/4 PASS
MCP-021A family contracts:      14/14  PASS
MCP-021A thread topology stubs: 12/12  PASS
```
