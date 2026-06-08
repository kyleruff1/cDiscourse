# MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-07
**Branch:** feat/mcp-server-010a-family-i-edge-subset
**Design:** docs/designs/MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET.md

## Summary
The card adds exactly ONE entry to `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` in the Edge
boolean-observation request builder: `thread_topology: Object.freeze(new Set<MachineObservationSource>(['ai_classifier']))`,
placed immediately after the Family-G (`resolution_progress`) entry and byte-mirroring
the Family-D + Family-G entries. This makes the Edge admin_validation request builder
filter Family I to its 6 `ai_classifier` keys and drop the 15 deterministic keys
(8 auto_metadata + 7 lifecycle), aligning the request with the hosted MCP server's scope
(shipped in #392) so Family-I admin_validation requests stop failing closed with
`mcp_validation_failed`. The change is minimal, mirrors a proven pattern, carries a real
non-tautological 11-test suite, and is byte-clean on every invariant the charter names.
All gates pass. No concerns remain.

## Verification
- typecheck: pass (exit 0)
- lint: pass (exit 0; no `.claude/worktrees/**` debris tripped eslint in this worktree)
- test: 693 → 694 suites / 21330 → 21341 tests (+11; 21340 passing + 1 pre-existing skip unchanged), exit 0
- new suite `__tests__/mcpFamilyIEdgeMcpSubsetFilter.test.ts`: 11 passed (SFI-1..SFI-11), exit 0
- secret scan: clean (exit 1)
- doctrine scan: clean — the only `winner` hit is documentation prose in `current-status.md`
  ("comparing options is not picking a winner" doctrine guard description), not a user-facing string
- Migration apply: N/A — no `supabase/migrations/**` in the diff

## Design conformance
- [x] All design file-changes are present (builder entry + test file + test helper export + design doc + current-status)
- [x] No undocumented file-changes (5 files exactly: builder, test, helper, design, current-status)
- [x] Data model matches design (6 ai_classifier present / 15 deterministic absent)
- [x] API contracts match design (admin_validation request emits exactly the 6-key subset; mode-agnostic filter)

## Filter correctness (load-bearing finding)
Confirmed against the ground-truth definitions in
`supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyI.ts`:

- **6 ai_classifier keys PRESENT** in the request: `introduces_new_issue`,
  `references_prior_agreement`, `introduces_sub_axis`, `returns_to_prior_issue`,
  `references_external_context`, `compares_options`.
- **15 deterministic keys ABSENT** — 8 auto_metadata (`has_reply`, `participant_skipped_node`,
  `no_response_after_n_turns`, `repeated_axis_pressure`, `splits_thread`, `merges_thread`,
  `references_sibling_node`, `references_ancestor_node`) + 7 lifecycle (`open`, `answered`,
  `moved_on_by_affirmative`, `moved_on_by_negative`, `ignored_by_affirmative`,
  `ignored_by_negative`, `ignored_by_both`).

Mechanism verified by reading `buildBooleanObservationRequestForArgument`: per-definition,
`MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']` = `{'ai_classifier'}`, so the
`if (allowedSources && !allowedSources.has(def.source)) continue;` line skips every
auto_metadata/lifecycle def, leaving the 6 ai_classifier keys. In `production` mode the
upstream `filterFamiliesForMode` drops `thread_topology` entirely (it is not
`productionEnabled`), so no deterministic key can leak even there (SFI-10).

## Invariant checks
- [x] `familyRegistry.ts` byte-equal to main (`git diff main` empty) — `thread_topology`
      stays `{ productionEnabled: false, adminValidationEnabled: true }`. No flip.
- [x] No `productionEnabled` flip anywhere in the diff — every `productionEnabled` hit is
      a test/doc ASSERTING it stays `false`. No H/I/J production movement.
- [x] `mcp-server/` untouched (`git diff main --name-only -- mcp-server/` empty)
- [x] No migration (`git diff main -- supabase/migrations/**` empty)
- [x] No out-of-scope change — no prompt/boolean/schema-version change, no `engine.ts`,
      no submit-path/routing-flag/provider change, no new dependency
- [x] Test-helper export is test-only plumbing: `edgeGetMcpServerSupportedFamilySources`
      lives in `__tests__/_helpers/booleanObservationEdgeDeno.ts` and re-exposes
      `getMcpServerSupportedFamilySources`, which is ALREADY exported from production on
      `main` (builder line 85). No new production surface.

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings (only doc prose)
- [x] Score never blocks posting — N/A; this is a post-storage admin_validation transport filter
- [x] No service-role in client code (Edge `_shared`, not client; no SERVICE_ROLE in diff)
- [x] No direct insert into public.arguments
- [x] No AI calls in production app paths (the builder constructs a request; it does not call out)
- [x] Plain language only (no raw internal codes in UI strings — no UI touched)
- [x] §10a Observations doctrine: thread_topology keys are structural facts about argument-tree
      shape, never verdicts (cited in the test file header)
- [x] supabase-edge-contract: pure-TS `_shared` builder, no service-role, mode-agnostic filter
      preserves Family A/B/C passthrough

## Acceptance-gate invariant
Confirmed. This is an Edge admin_validation transport filter — it shapes the rawKey set sent
to the hosted MCP server for post-storage observability. It does not block, route, delay, or
reject a user post. The deterministic Constitution engine remains the sole submission gate.

## Test coverage
- [x] Filter behavior has unit tests (SFI-2..SFI-6: exact 6-key count, none of 15 excluded,
      definitions map size/source)
- [x] Regression guards for the mirrored entries (SFI-7 Family D = 19 keys, SFI-8 Family G = 18 keys)
- [x] No-flip invariant pinned (SFI-9 productionEnabled:false / adminValidationEnabled:true)
- [x] Production-mode no-leak (SFI-10) and multi-family composition (SFI-11, I+A = 22 keys)
- [x] Tests are real (call the production builder, assert exact counts), not tautological
- [x] No existing test relaxed, skipped, or removed; no `.skip`/`.only`/`console.log` added

## Blockers
None.

## Suggestions (non-blocking)
1. Test constant `FAMILY_I_AI_CLASSIFIER_KEYS` is hand-mirrored from `familyI.ts`. It is
   pinned by SFI-2's exact-6 count and SFI-5's definitions-map size, so drift would fail a
   test — acceptable. A future hardening could derive the expected set from the family
   registry rather than a hard-coded list, but this matches the existing D/G suite idiom and
   is not worth diverging here.

## Operator next steps
- Push the branch: `git push -u origin feat/mcp-server-010a-family-i-edge-subset`
- Open PR: `gh pr create --title "MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET: Family-I Edge mixed-source admin_validation bridge" --body-file docs/reviews/MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET.md`
- Deploy: none beyond standard merge=deploy. On merge to `main`, the Supabase GitHub
  integration auto-redeploys the affected Edge Functions. No migration, no `--linked` deploy,
  no secret, no env var, no `mcp-server` redeploy required.
- Post-merge: Family-I admin_validation requests stop failing with `mcp_validation_failed`;
  H/I/J stay `productionEnabled:false` (Card 3 / #394 handles production-enable behind Gate A).
- Post-merge worktree cleanup (operator step) per roadmap-reviewer.md § "Post-merge worktree cleanup".
