# UX-IMPASSE-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-20
**Branch:** feat/UX-IMPASSE-002-latent-subtypes (HEAD 5780575)
**Design:** docs/designs/UX-IMPASSE-002.md
**Issue:** kyleruff1/cDiscourse#710

## Summary

This card surfaces two latent mediator-board subtypes — `value_tradeoff →
"Different priorities"` and `key_detail_unavailable → "Key detail unavailable"` —
whose deterministic producers already fire on real data but were previously
folded in the v4 display projection (value-axis → Open, context-limit →
Evidence blocked). The change is a pure display-mapping + copy + next-move-spec
change across exactly four production files (`mediatorBoardTypes.ts`,
`mediatorPlainLanguage.ts`, `nextMovesForState.ts`, `index.ts`).
`deriveMediatorBoardState.ts` is NOT touched; `point.state` and the 13-code
`MediatorStateCode` are unchanged. `accounts_differ` and `no_current_pathway`
stay correctly deferred as dormant constants with no render-path consumer.
All gates green; the only full-suite failure (per the implementer note) is the
documented, unrelated `pointLifecycleModel` wall-clock perf flake, which passes
isolated (76/76). Safe to merge with no deploy.

## Verification
- typecheck: **pass** (exit 0)
- lint (`--max-warnings 0`): **pass** (exit 0)
- targeted jest (11 named patterns → 13 suites): **pass** — 271 tests, exit 0
- web:build: **pass** (exit 0, 773 modules)
- pointLifecycleModel isolated (`--runInBand`): **pass** — 76/76, exit 0; NOT in diff
- secret scan: **clean**
- doctrine scan: **clean** (one grep hit is a meta-comment naming the ban
  discipline — "no 'hiding'/'withheld'/'refused'/'failed'" — not user-facing copy)

## Design conformance
- [x] All design file-changes are present (the §6 four-file set, exactly)
- [x] No undocumented file-changes (src diff = index.ts, mediatorBoardTypes.ts,
      mediatorPlainLanguage.ts, nextMovesForState.ts; plus the new test file, the
      8 inverted suites, and current-status.md)
- [x] Data model matches design (no schema, no persisted field, no derivation;
      display projection + copy + next-move specs only)
- [x] API contracts match design (`V4MediatorStateCode` additive +2; no rename)

## Doctrine self-check
- [x] No truth/winner/loser language in user-facing strings — every surfaced
      string is a point-state structural description ("turns on a value
      tradeoff", "a key detail is not available to test here")
- [x] Score never blocks posting — board is read-only projection; engine remains
      sole gate; no `decidePointState` change
- [x] No service-role in client code (clean grep)
- [x] No direct insert into public.arguments (clean grep)
- [x] No AI calls in production app paths (no provider touched)
- [x] Plain language only — no raw classifier id (`flags_context_limit`,
      `disputes_value_weighting`) reaches the UI; ban-list tests assert no
      snake_case leak
- [x] Epic-specific doctrine — `cdiscourse-doctrine` §1/§9 (point states not
      verdicts; plain language) and §10a (these are machine-derived structural
      states, not Observation/Allegation chips; that boundary untouched).
      `accessibility-targets`: no new interactive element; both states reuse the
      existing `<Pressable>`/`<Text>` rail + distribution surfaces with their
      existing role+label+state and 44×44 targets; only the label text + an
      additional distribution segment appear. `test-discipline`: tests are part
      of done; one new pure-model suite + 8 legitimate inversions; no .skip/.only.

## Checklist (per the card)
1. **Scope = safe-now subset only — PASS.** Only `value_tradeoff` +
   `key_detail_unavailable` flip to identity in `V4_DISPLAY_STATE_BY_CODE`.
   `accounts_differ` keeps its pre-existing display state + pre-existing
   STATE_MOVE_SPECS entry (NOT newly wired by this diff). `no_current_pathway`
   is not a state and gains no chip/marker/spec. `ACCOUNTS_DIFFER_DISPLAY_COPY`
   is exported from index.ts as a dormant constant with a "stays dormant"
   comment and has NO render-path consumer (only defined + re-exported).
2. **No derivation change — PASS.** `deriveMediatorBoardState.ts` NOT in diff;
   `MediatorStateCode` union unmodified (only `V4MediatorStateCode` changes).
3. **v4 map correctness — PASS.** `V4MediatorStateCode` += 2 (eleven members);
   `ALL_V4_MEDIATOR_STATE_CODES` and `V4_PRIMARY_STATE_PRIORITY` are the identical
   11-entry order with `key_detail_unavailable` at index 2 and `value_tradeoff`
   at index 9 (just above `open`); `V4_DISPLAY_STATE_BY_CODE` flips exactly those
   two to identity; `off_point → scope_mismatch` + terminal `resolved_or_settled`
   stay collapsed; map is total over all 13 internal codes (asserted).
4. **Label parity + copy — PASS.** `MEDIATOR_STATE_COPY.value_tradeoff ===
   'Different priorities'`; `key_detail_unavailable === 'Key detail unavailable'`;
   node chip == rail badge == distribution segment proven in the new suite.
   Helper Lead+Help match §4 operator copy. Next-move dominants "Name the
   tradeoff" / "Branch the provable part" using existing `name_tradeoff` /
   `narrow_or_branch` step codes.
5. **evidence_blocked + structured_impasse byte-identical — PASS.** Helper string
   re-asserted byte-for-byte; `MEDIATOR_STATE_COPY.evidence_blocked`,
   `DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath`, `IMPASSE_SUBTYPE_COPY`
   evidence_blocked lead/help unchanged; a TRUE declined-debt point still maps to
   `evidence_blocked` (producer guard `!(hasEvidenceObligation && declined)`
   keeps key_detail_unavailable from stealing it).
6. **Doctrine — PASS.** Ban-list grep over added lines clean; both new states
   describe point structure, never person/intent/credibility/blame; no
   "hiding/withheld/refused"; insufficient signal still falls back to
   open/structured_impasse.
7. **Test inversions legitimate — PASS.** All 8 suites flip OLD deferral/collapse
   proofs to NEW surfaced behavior (deferral → surfacing), retain the
   evidence_blocked byte-identical block, and ADD deferred-subtype dormancy
   assertions. No weakened/deleted coverage; unrelated cases untouched. New file
   (271→ included; 34+ real assertions: mapping, label parity, no chip soup,
   ban-list, evidence_blocked regression, fallback, next-move).
8. **Security/config — PASS.** No secrets; no Supabase/Edge/migration/provider/
   MCP/classifier; no `.env*`/package.json/lockfile/app.json; no route/model/
   type rename; no dependency. (`V4MediatorStateCode` is additive, not a rename.)
9. **Gate exit codes — observed:** typecheck 0 · lint(--max-warnings 0) 0 ·
   targeted jest 0 (13 suites / 271 tests) · web:build 0.
10. **Flake — agreed.** `pointLifecycleModel` passes isolated 76/76 (exit 0) and
    is NOT in this diff. The failure is the documented LIFE-001 wall-clock
    `toBeLessThan(30ms)` perf assertion that flakes under full-suite parallel
    load. I agree it is an unrelated documented flake, not a regression of this
    card.

## Blockers
None.

## Suggestions (non-blocking)
1. The `DisagreementPointsRail` `act(...)` console warning during the targeted
   run is pre-existing (async reduce-motion effect in a file not in this diff).
   Not this card's concern; noting only so a future reader does not attribute it.

## Operator next steps
- Push the branch: `git push -u origin feat/UX-IMPASSE-002-latent-subtypes`
- Open PR: `gh pr create --title "UX-IMPASSE-002: surface latent value_tradeoff + key_detail_unavailable subtypes (display-only)" --body-file docs/reviews/UX-IMPASSE-002.md`
- Deploy steps: **None.** Display/copy/test-scoped, client-side pure projection.
  No migration, no Edge Function, no env var, no secret (design §11).
- Post-merge worktree cleanup: see roadmap-reviewer.md
  § "Post-merge worktree cleanup (operator step)" (worktree
  `.claude/worktrees/agent-impasse002`, branch
  `feat/UX-IMPASSE-002-latent-subtypes`).
