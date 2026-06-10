# MCP-H-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-10
**Branch:** feat/mcp-h-002-family-h-production-enable (commit `60ea534`)
**Design:** docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md (original enable) + docs/designs/MCP-H-001-FAMILY-H-CLAIM-CLARITY-RETRY-SCOPING.md (#472-owned E#7 retry gate)
**Class:** PRODUCTION-BEARING / MERGE-AS-DEPLOY (Supabase integration redeploys Edge functions on merge)

## Summary

This is the operator-approved (E#7(b), 2026-06-10) revert-of-revert that re-applies the Family H (`claim_clarity`) production-mode flip after the #472 reproduction PASS (64/64 admin cells terminal-zero at the 8-family profile) fixed the provider/server burst-reliability cause that triggered the original PR #408 rollback. The entire production-code delta is a single boolean: `claim_clarity.productionEnabled false→true` in `familyRegistry.ts:106`. Everything else in the 18-file diff is the supporting test re-baseline (7→8 production roster, N=56→N=64 burst proof, restored H binding suite) and two doc updates. Blast radius is exact, I/J stay frozen, no bar was weakened, the burst proof was tightened to the real roster rather than relaxed, and both ledger doc-guards were strengthened (an H-true drift guard was *added*). Doctrine is clean: classifier outputs stay advisory machine Observations, no engine.ts touch, no client-surfacing change, no secret-shaped strings. Ready to push.

## Verification
- typecheck: **pass** (exit 0)
- lint (scoped to the 16 changed code files): **pass** (exit 0)
- lint (`npm run lint`, whole tree): exit 1 — **environmental only**; all 10 errors live in 5 orphan sibling worktrees under `.claude/worktrees/*/mcp-server/tests/` (the documented "eslint recurses the whole tree" + orphan-worktree pollution). Zero failing paths are in this branch's diff. Non-blocking; operator-hygiene item below.
- test (spot-run, 4 named suites): **74 passed / 4 suites, exit 0** (`edgeFamilyHProductionEnable`, `archOneCardThreeBurstConcurrency`, `mcpHijReadinessLedgerCitations`, `mcpHijReadinessLedgerBanList`)
- test (11 sibling re-baselines + adjacent registry guards): **251 passed / 14 suites, exit 0**
- secret scan: **clean**
- doctrine scan (verdict tokens / service-role in client / direct public.arguments insert): **clean**

## Design conformance
- [x] All design file-changes present (the single registry boolean + test re-baseline + doc updates)
- [x] No undocumented file-changes (1 prod file, 2 docs, 15 tests — all accounted for)
- [x] Data model matches design (registry posture: A–H true, I/J false)
- [x] API contracts match design (H is uniform-source 12-key ai_classifier; no subset-filter entry — HHE-17/18 enforce)

### Blast-radius findings (adversarial, dimension-by-dimension)
1. **Exactness:** `familyRegistry.ts` diff is exactly one hunk — line 106 `false→true`, nothing else in the file. No other `supabase/functions/**` change; zero migrations; zero `mcp-server/**`; zero `src/**`/`app/**` production. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (`booleanObservationRequestBuilder.ts:68-89`) untouched and holds D/G/I only — **no `claim_clarity` entry (HALT-13 clear)**, correct because H is uniform-source.
2. **I/J freeze:** `thread_topology` (line 111) + `sensitive_composer` (line 116) remain `productionEnabled: false`. Every re-baselined sibling test renamed `HJ_ADMIN_ONLY → IJ_ADMIN_ONLY` (D/E/F/G/H suites); green runs prove H was dropped from the frozen guards (a leftover `claim_clarity` in any `productionEnabled).toBe(false)` would now fail).
3. **No weakened bars:** `archOneCardThreeBurstConcurrency.test.ts` preserves the C value-pin (`drainerProviderConcurrency()).toBe(3)` line 249), `MCP_CAP ≤ 5` (line 255), `maxObserved <= C`, and `everExceeded === false`. Only the *modeled* burst N moved 56→64 to match the real 8-family roster (tightening, not relaxing). BAN-4's external PASS-LOAD bar stays `N=56` (line 610, unchanged) — correctly left to ARCH-001. Both ledger guards strengthened: §1 verdict ban-list untouched; advancement-adjacency guard narrowed to I/J; **a NEW `familyRegistry.ts:106 productionEnabled: true` drift guard was added** (citations test) to catch an accidental re-freeze of H.
4. **Restored binding fidelity:** `edgeFamilyHProductionEnable.test.ts` is byte-identical to `488d105` (empty diff). Asserts the 8-family A→H roster (HHE-4/5), I/J false (HHE-7), index-7 = `claim_clarity` (HHE-8), A–G drift guards (HHE-10..16), HALT-13 absence + 12-key passthrough (HHE-17/18).
5. **Client surfacing gates:** `argumentDetailModel.ts` and `deployedAgRawKeys.ts` **not modified**; no test forces H to surface. H stays un-surfaced in UI (separate gated decision).
6. **Docs honesty:** `current-status.md` + `MCP-HIJ-READINESS-LEDGER.md` state the flip accurately — E#7(b) approved, post-#472, "burst cause fixed and re-proven," operator runs the smoke after merge. **No "H stable/proven in production" overstatement** (smoke explicitly pending). Ledger preserves the failure history and frames the thaw as the operator's, not the ledger's. Zero banned verdict tokens (ledger ban-list doc-guard passes).
7. **Doctrine:** registry comment reaffirms production enablement is gameplay-routing not a verdict (§1/§4); no `engine.ts` change; outputs remain advisory machine Observations persisted post-storage; no secret-shaped strings.

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings (diff verdict-token scan clean; ledger ban-list guard passes)
- [x] Score never blocks posting (no acceptance-gate change; `engine.ts` untouched)
- [x] No service-role in client code (no `src/**`/`app/**` change; scan clean)
- [x] No direct insert into public.arguments (scan clean)
- [x] No AI calls in production app paths (registry boolean only; classifier path is Edge-only and advisory)
- [x] Plain language only (no raw internal codes added to UI strings; H stays un-surfaced)
- [x] Epic-specific doctrine (supabase-edge-contract): no service-role/RLS/migration change; the flip routes a family through the existing Edge classifier dispatcher; `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` invariant respected (no H entry)

## Test coverage
- [x] New/restored public binding has unit tests (HHE-1..HHE-18, restored verbatim from `488d105`)
- [x] Doctrine ban-list assertion present and passing (ledger ban-list doc-guard; verdict-token-free)
- [x] Edge cases covered: HALT-13 (HHE-17), uniform-source 12-key passthrough mode-agnostic byte-equality (HHE-18), A–G drift (HHE-10..16), I/J freeze (HHE-7), burst bound under N=64 (BC-3..BC-8), H-true drift guard (citations test)
- [x] N/A — no UI card (accessibility assertions not applicable)

## Blockers
None.

## Suggestions (non-blocking)
1. **Operator hygiene:** `npm run lint` exits 1 solely because eslint recurses into 5 stale orphan worktrees under `.claude/worktrees/` (`determined-khayyam-5d7cd4`, `intelligent-austin-4e62d2`, `sad-chandrasekhar-29e400`, `silly-heyrovsky-fdb7ce`, `suspicious-chandrasekhar-c4c271`). None are in this diff. Run the EC-3 filesystem-orphan sweep from `roadmap-reviewer.md` to restore a green whole-tree lint; this is unrelated to MCP-H-002 and exists on `main` as well.

## Operator next steps
- Push the branch: `git push -u origin feat/mcp-h-002-family-h-production-enable`
- Open PR: `gh pr create --title "MCP-H-002: re-enable Family H claim_clarity production mode [E#7(b)]" --body-file docs/reviews/MCP-H-002.md`
- **Deploy = merge.** Merging to `main` triggers the Supabase GitHub integration to redeploy the registered Edge functions; the registry boolean takes effect at that redeploy. No separate `functions deploy` command — but confirm the redeploy lands.
- Post-merge: run the H production-enable smoke (`docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md`, canary→burst, PASS-LOAD = 0 terminal dead-letters) before relying on H production output.
- Post-merge worktree cleanup (operator step, per roadmap-reviewer.md § "Post-merge worktree cleanup"); also clear the 5 orphan worktrees noted in Suggestions.

## Merge-risk statement
The moment this merges, the Supabase integration redeploys the Edge functions and Family H (`claim_clarity`, 12 ai_classifier keys) begins receiving production-mode classifier traffic via the auto-trigger dispatcher (which derives its production family list from this registry at runtime) — expanding the live production roster from 7 families (A–G) to 8 (A–H). H output persists as advisory machine Observations but stays **un-surfaced in the UI** (`argumentDetailModel` + `deployedAgRawKeys` untouched), so no new user-facing surface appears; I/J remain dormant.
