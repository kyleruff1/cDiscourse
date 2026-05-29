# MCP-021C-EDGE-FAMILY-G-ENABLE — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-29
**Branch:** feat/MCP-021C-EDGE-FAMILY-G-ENABLE
**Design:** docs/designs/MCP-021C-EDGE-FAMILY-G-ENABLE.md
**Intent:** docs/designs/MCP-021C-EDGE-FAMILY-G-ENABLE-intent.md
**Issue:** #360
**Template card:** MCP-021C-EDGE-FAMILY-F-ENABLE (PR #348, shipped 65dbfc3; smoke PASS 6395023)

---

## Summary

This is Card 3 (terminal) of the FAMILY-G suite: a faithful G-replica of the shipped
F-ENABLE card. It flips exactly one boolean character —
`resolution_progress` (Family G) `productionEnabled: false → true` at
`supabase/functions/_shared/booleanObservations/familyRegistry.ts:101` — extending the
registry-derived auto-trigger from 6 to 7 production families (A–G) with **zero dispatcher
edits**. The branch is mechanically clean: registry diff is the single `+1/-1` flip;
`autoTriggerDispatcher.ts`, `booleanObservationRequestBuilder.ts` (the DIV-1 subset filter,
already present from Card 1A), `mcp-server/**`, the schema, Source 6, `audit-lint-rules.cjs`,
and `package.json`/`package-lock.json` are all byte-equal. No `src/` change, no migration.
The new card-scoped binding `__tests__/edgeFamilyGProductionEnable.test.ts` (GGE-1..GGE-17)
locks in the post-flip state and — honoring DIV-1 — asserts the subset filter is PRESENT and
that production-mode Family G yields exactly the 18 ai_classifier keys with no deterministic
leak (the inverse of F's absence assertions). The 7 stale-assertion test updates only bump the
6→7 family count, append `resolution_progress` to the A→F → A→G ordered arrays, and move G out
of the admin-only set into the production set — **no assertion removed or loosened**, and F's
FFE-15/16 uniform-passthrough guards are byte-equal. Full suite green at **18,307 / 576 suites /
0 fail**; typecheck and lint exit 0. No doctrine concern remains: the flip is a gameplay-routing
decision, never a verdict on Family G's resolution-progress quality (cdiscourse-doctrine §1, §10a),
and no secret/service-role/Anthropic/console.log appears in the diff. The L5 BINDING doctrine
check (persisted `evidence_span` scan) is correctly deferred to the post-merge smoke's Phase 6 and
is specified as a binding, CI-mechanically-enforced obligation in both the design and the intent.

---

## Verification (independently re-run)

| Gate | Result |
|---|---|
| `git diff` on `familyRegistry.ts` | **1 file / +1 / -1** — exactly `productionEnabled: false → true` on the `resolution_progress` entry |
| `git diff` on `autoTriggerDispatcher.ts` + `booleanObservationRequestBuilder.ts` | **0 lines** (`wc -l` = 0) |
| `git diff` on `mcp-server/` + `scripts/ops/audit-lint-rules.cjs` + `package.json` + `package-lock.json` | **0 lines** (`wc -l` = 0) |
| `git diff --name-only` `^src/` | **empty** (NO_SRC_CHANGES) |
| Migration files (`supabase/migrations/**`) | **none touched** — migration-bearing verification N/A |
| Targeted Jest (`edgeFamily\|FamilyRegistry\|AutoTrigger\|AdminValidation\|mcpFamilyG\|booleanObservation`) | **18 suites / 354 tests / exit 0** |
| Full Jest suite (`npx jest --no-coverage`) | **576 passed / 576 total; 18,307 passed / 18,307 total; exit 0** |
| `npm run typecheck` (`tsc --noEmit`) | **exit 0** |
| `npm run lint` (`eslint . --max-warnings 0`) | **exit 0** |
| Secret scan (ANTHROPIC/XAI/X_BEARER/SERVICE_ROLE/sb_secret_/sk-ant-/xai-/Bearer/JWT) | **clean** — one design-doc line names the keys to *assert their absence* (doctrine self-check table); no real secret value present |
| Doctrine token scan (winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist) | **clean** — one design-doc line is the smoke's Phase 6 ban-list *definition* (the doctrine guard the smoke enforces), not a UI string |
| `SERVICE_ROLE`/`ANTHROPIC_API_KEY` in `supabase/**.ts`/`app/**.ts`/`src/**.ts` | **none** |
| Direct `public.arguments` insert / `console.log` in diff | **none** |
| Migration apply | N/A — no migration in this card's diff |

---

## Verdict matrix (16 items)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Scope: registry flip + tests + docs only; ZERO dispatch change **[core]** | **PASS** | Changed files = registry (1) + 8 test files + design doc + current-status. Dispatcher diff 0. |
| 2 | familyRegistry: exactly the 1 G flip; A–F/H/I/J byte-equal **[core; FAIL→BLOCK]** | **PASS** | Diff stat 1 file/+1/-1; the only `+/-` lines are `productionEnabled: false → true`. Live file: A–F true, G true, H/I/J false. |
| 3 | `autoTriggerDispatcher.ts` byte-equal (registry-derived) **[FAIL→BLOCK]** | **PASS** | `wc -l` of dispatcher diff = 0. Auto-trigger picks up G via `productionEnabledFamilies()` with no edit. |
| 4 | G adminValidationEnabled stays true | **PASS** | Live `familyRegistry.ts:102` = `adminValidationEnabled: true`; GGE-2 asserts it. |
| 5 | productionEnabledFamilies() = 7 (A–G); H/I/J excluded | **PASS** | GGE-3/4/5 (length 7, A→G order); GGE-7 (H/I/J false). Targeted suite green. |
| 6 | Production-mode G = 18 ai_classifier keys; subset filter PRESENT + no deterministic leak (DIV-1) | **PASS** | GGE-17: `requestedRawKeys.length === 18`, all 18 ai_classifier keys present, all 12 deterministic keys absent, mode-agnostic vs admin_validation. |
| 7 | Subset filter (`booleanObservationRequestBuilder.ts`) byte-equal (Card 1A entry preserved) | **PASS** | Builder diff 0 lines; GGE-16 asserts `resolution_progress` PRESENT in the constant block. |
| 8 | Source 6 unchanged | **PASS** | `machineObservationPersistenceQuery*` not in name-only diff. |
| 9 | `mcp-server/` byte-equal (G classifier shipped Card 1) | **PASS** | `mcp-server/**` name-only diff empty. |
| 10 | No prompt/key/taxonomy/schema/audit-lint/package.json change | **PASS** | `nodeLabelTypes.ts`, `mcpBooleanObservationSchema.ts`, `audit-lint-rules.cjs`, `package.json`, `package-lock.json` all 0-diff. |
| 11 | A–F unregressed (stale-assertion updates only flip count/order; no behavior change) **[FAIL→BLOCK if A–F behavior altered]** | **PASS** | A–F remain `true` in registry; GGE-10..15 assert each A–F still `productionEnabled: true`; stale updates only bump 6→7 + append G. |
| 12 | The 7 stale-assertion updates remove/loosen NO assertion (FFE-15/16 byte-equal) | **PASS** | All updates are count bumps (`6`→`7`), ordered-array appends (`resolution_progress`), G moved from admin-only set to production set, plus NET-NEW G assertions (FE-14, FR-26d, AVM-11d). FFE-15/16 not in the F-file diff (byte-equal). |
| 13 | Intent has L3/L4/L5 obligations + the 8-phase smoke + D8 live latency re-measure | **PASS** | Intent §D6 (L3/L4/L5, L5 BINDING + mechanically enforced) + §7 (8-phase smoke, Phase 5 = D8 N=5 re-measure, Phase 6 = L5 BINDING). |
| 14 | Full suite green (18,307, 0 fail); typecheck/lint 0 | **PASS** | `576/576 suites; 18,307/18,307 tests; exit 0`. typecheck exit 0; lint exit 0. |
| 15 | `edgeFamilyGProductionEnable.test.ts` (GGE-1..17) covers the flip + 7-family + 18-key subset | **PASS** | File present; GGE-1..17 as designed; runs green in targeted + full suite. |
| 16 | No smoke audit authored (post-merge); design doc present | **PASS** | `git log main..HEAD -- docs/audits/**` empty (branch introduces 0 audit files); design + intent docs present. |

**Core items (1/2/3/11): all PASS.** No STOP condition triggered.

> **L5 BINDING note (per reviewer charter):** the binding doctrine check — persisted
> `evidence_span` ban-list scan over a live adversarial resolution_progress firing — is the
> POST-MERGE smoke's Phase 6, NOT part of this PR. Per charter instruction I do not block on its
> absence here; I confirm the design (Phase 6) and the intent (§D6.L5 / §7.6) BOTH specify it as a
> binding, CI-mechanically-enforced obligation (`resolution_progress` / `family_g` /
> `concedes_broader_point` ∈ `DOCTRINE_RISK_FAMILIES`, added by Card 2 `cfc1fd4`). This is the FIRST
> production-enable card whose L5 BINDING is CI-mechanically enforced from the moment of ship.

---

## Design conformance

- [x] All design file-changes are present (registry flip; new GGE test file; 4+3 stale-assertion test updates; design doc; current-status handoff line).
- [x] No undocumented file-changes (the smoke-template `.md` named in the design's NEW-files matrix is an operator-territory post-merge deliverable, not a pre-merge implementer obligation; its absence is consistent with item 16 and does not gate the flip).
- [x] Data model matches design (no schema change; registry shape unchanged except the 1 boolean).
- [x] API contracts match design (no Edge Function contract change; dispatcher + builder byte-equal; subset filter mode-agnostic 18-key result preserved).
- [x] Three G-specific divergences honored: DIV-1 (subset filter PRESENT + 18-key/no-leak, GGE-16/17), DIV-2 (L5 CI-mechanical — deferred to post-merge smoke, specified binding), DIV-3 (latency-at-7 re-measure in smoke Phase 5).

---

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — the diff adds no user-facing string; the only token matches are (a) the design's Phase 6 ban-list *definition* (the guard) and (b) test/registry identifiers. `concedes_broader_point` / `concedes_narrow_point` are structural game-state keys; the test header explicitly frames a concession as a scoring REPAIR, not a "loss" (cdiscourse-doctrine §1, point-standing-economy).
- [x] Score never blocks posting — production enablement is a routing/observation decision; no posting gate added.
- [x] No service-role in client code — no `SERVICE_ROLE` in any `src/`/`app/`/`supabase/**.ts` diff line; AI classification stays inside Edge Functions + hosted MCP server (cdiscourse-doctrine §7).
- [x] No direct insert into public.arguments — none in diff.
- [x] No AI calls in production app paths — no `src/` change at all; the flip is in `supabase/functions/_shared/`.
- [x] Plain language only (no raw internal codes in UI strings) — no UI string touched; internal codes appear only in tests/registry/Edge code.
- [x] Epic-specific doctrine (cdiscourse-doctrine §10a — Machine Observations): Family G rows persist as Machine Observations (`source = 'machine'`); the resolution-progress framing (narrowing / conceding / synthesis-readiness) is structurally distinct from "won/lost". Production enablement is gameplay-routing, never a verdict on the family's quality.

---

## Test coverage

- [x] New public state (post-flip registry) has a dedicated card-scoped binding (`edgeFamilyGProductionEnable.test.ts`, GGE-1..17).
- [x] Subset-filter doctrine (DIV-1) covered: GGE-16 (PRESENT) + GGE-17 (exactly 18 ai_classifier keys, no deterministic leak, mode-agnostic). Cross-checked against the pre-existing Card 1A `mcpFamilyGEdgeMcpSubsetFilter.test.ts` (SFG-1..9), which is byte-equal and green.
- [x] A–F regression guard: GGE-10..15 + FR-* / FE-* / DREG-29 each assert A–F still `productionEnabled: true`.
- [x] No accessibility assertions required — this is a backend registry flip, not a UI card.
- [x] Test count goes UP (full suite at 18,307, matching the implementer's claim; targeted suite 354). No `.skip`/`.only`/`xit`/`xdescribe`; no committed `console.log`.

---

## Blockers

None.

---

## Suggestions (non-blocking)

1. The design's NEW-files matrix lists `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-template.md`. The implementer did not commit a separate template file (the 8-phase skeleton lives verbatim in the design doc + intent §7). This is consistent with the F-ENABLE precedent (the operator authors the dated smoke doc from the in-design skeleton post-merge) and is not a gap — noted only so the operator knows to lift the Phase 1–8 skeleton from the design doc when filling `…-SMOKE-2026-05-29.md`.
2. `docs/core/current-status.md` gained a long HTML-comment handoff block but the canonical "Current stage" line in `CLAUDE.md` is not bumped by this card — correct per test-discipline (bump on stage completion, not per card). The operator may want to refresh the CLAUDE.md stage line once the FAMILY-G suite smoke PASSes, since this card completes the 3-card G suite.

---

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-021C-EDGE-FAMILY-G-ENABLE`
- Open PR: `gh pr create --title "MCP-021C-EDGE-FAMILY-G-ENABLE: Family G production-mode flip (+18 tests; 7-family auto-trigger; terminal card)" --body-file docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-REVIEW-2026-05-29.md`
- Deploy: auto via the Supabase GitHub integration on merge to `main` (registry change is picked up by `submit-argument` + `classify-argument-boolean-observations` auto-redeploy). No manual `supabase db push` (no migration) and no manual function deploy required.
- POST-MERGE smoke (operator binding): author + commit `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-2026-05-29.md` from the design's 8-phase skeleton (`Audit-Lint: v1` on line 3). Phases 2/3/4 = L3a/L3b+L4/L3c (7 production runs A–G; ≥1 G positive on targeted text; Source 6 7-family read). Phase 5 = D8 live latency re-measure at 7 families (N=5, canary-first, gated, no JWTs logged, no `out/` committed; compare to ≈36.3s projection). **Phase 6 = L5 BINDING** — live adversarial resolution text, persisted `evidence_span` doctrine-clean scan; ≥1 clean firing; a resolution-verdict token in any G production `evidence_span` is an IMMEDIATE HALT + FAIL. Pre-push `node scripts/ops/audit-lint.mjs <audit-doc>` exit 0; CI exit 0 (L5 mechanically enforced because `family_g` ∈ `DOCTRINE_RISK_FAMILIES`).
- Post-merge worktree cleanup (operator step, from main repo root — commands in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup"): `git worktree remove -f -f` the agent worktree, `git branch -D feat/MCP-021C-EDGE-FAMILY-G-ENABLE`, then verify with `git worktree list`.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
