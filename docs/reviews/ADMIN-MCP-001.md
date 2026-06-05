# ADMIN-MCP-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-05
**Branch:** feat/admin-mcp-001 (HEAD `777afeb`)
**Base:** merge-base `8278390`; current `origin/main` `db97296` (branch is behind only by unrelated merged cards — no conflict surface)
**Design / spec:** GitHub issue #477; deliverable `docs/audits/ADMIN-MCP-001-WRITE-PATH-AUDIT.md`

## Summary

ADMIN-MCP-001 is an **audit card**. Its deliverable is a 7-layer write-path audit
of the semantic-referee `mcp` provider door, a new client leak-scan test, an
operator-run smoke skeleton, and a 2-line current-status note — **no production
source was edited**. I spot-checked every cited `file:line` in the audit against
the live code; all citations are accurate and the all-7-PASS verdict is justified.
The crux (Layer 6) is confirmed: `providerMode === 'mcp'` routes to the live
`deps.runMcp` adapter (MCP-018), **not** the `not_implemented` stub, so the
issue's HALT condition is correctly **not triggered** and the card ships green.
The diff is strictly `__tests__/` + `docs/audits/` + `docs/core/`; zero
`supabase/**` bytes changed, so the `deploy-gated` label may be removed and the
merge class is autonomous src-only green. No concerns remain.

## Verification

- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, `--max-warnings 0`)
- test: 647 → **648 suites**, 19559 → **19571 tests** passed (1 skipped, pre-existing/unrelated), exit 0 — delta +1 suite / +12 tests, matching the new `adminMcpClientLeakScan.test.ts`
- new suite in isolation: **pass** (12/12, exit 0) — no flake
- secret scan: **clean** (sole match is the SMOKE.md prose hard-rule "No secrets / JWTs / bearer tokens …" — a statement of the rule, not a secret)
- doctrine scan: **clean** (matches are the doctrine check itself in SMOKE Phase 3, the word "correct" describing source accuracy, and `SERVICE_ROLE` only in unchanged pre-existing current-status context lines — zero in added lines)
- Migration apply: **n/a** — no `supabase/migrations/**` byte changed (heightened migration review does not apply)

## Design conformance

- [x] All deliverables present (audit doc, leak-scan test, smoke skeleton, status note)
- [x] No undocumented file changes — diff is exactly the 4 expected files
- [x] Audit layer findings match the code (see Audit accuracy below)
- [x] src-only scope honored — no Edge / migration / app-source byte changed

### Audit accuracy (spot-check of cited file:line)

| Layer | Claim | Verified at |
|---|---|---|
| 1 | `PROVIDER_MODE_LABELS.mcp === 'CD - MCP Server'` | `semanticRefereeConfigApi.ts:31` ✓ |
| 2 | `SELECTABLE_MODES` includes `mcp`; no disabled row / stub copy; removed-row comment | `AdminSemanticRefereeTab.tsx:41-46`, `:273` ✓ |
| 3 | Selectable row (role=button, a11y state, hitSlop); both `providerMode` unions include `mcp` | `AdminSemanticRefereeTab.tsx:250-272`; `edgeFunctions.ts:355,374` ✓ |
| 4 | Edge enum includes `mcp`; `.refine()` gates only `anthropic` | `adminSemanticConfigSchemas.ts:37,54,59-65` ✓ (read-only) |
| 5 | Handler persists `providerMode`, dual audit, never returns URL/token | `admin-users/index.ts:746-796` ✓ (read-only) |
| 6 | **`mcp` → `deps.runMcp` (live MCP-018), NOT `not_implemented` stub** | `providerRoutingCore.ts:141-150`; dep wired `providerRouting.ts:52 runMcp: runMcpAdapter` ✓ (read-only) — **HALT NOT triggered** |
| 7 | Leak/labelling/type-union tests present | `adminMcpClientLeakScan.test.ts` (+12), `AdminSemanticRefereeTab.test.tsx`, `semanticRefereeConfigApi.test.ts:141` ✓ |

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings (the `mcp` label/description name a mechanism, not a verdict; smoke Phase 3 asserts the *absence* of verdict language)
- [x] Score never blocks posting (audit + smoke explicitly reaffirm: provider mode never grants truth authority; validation, not the referee, is the only blocker)
- [x] No service-role in client code (no added `SERVICE_ROLE`; the audit reconfirms the URL/token live only Edge-side)
- [x] No direct insert into `public.arguments` (no DB write of any kind in this card)
- [x] No AI calls in production app paths (no provider call by Claude; the `mcp` path is operator-smoke only)
- [x] Plain language only (label `CD - MCP Server`; leak-scan asserts no snake_case in the label)
- [x] Epic-specific (supabase-edge-contract): no Edge byte changed; the Layer 5 doctrine-comment "nicety" is correctly deferred as operator-gated rather than edited in this autonomous run

## Test coverage

- [x] New leak-scan covers the two shapes #477 names (route path `/mcp/adapter-compat`, MCP hostname literals) across `src/**` + `app/**`, complementing the pre-existing `semanticMcpSourceScan.test.ts`
- [x] Type-union regression wall (both `providerMode` unions accept `'mcp'` at compile level)
- [x] Label + one-click-confirmation rule asserted (Layer 1 + Layer 7)
- [x] No `.skip` / `.only` introduced; the single skipped test is pre-existing and unrelated

## Blockers

None.

## Suggestions (non-blocking)

1. Minor audit-prose nuance: Layer 3 describes the row as "a 44×44 hit target via `hitSlop`," but the literal is `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` (8px expansion around the row, not a fixed 44×44). The row is selectable and accessible and the matching test (`AdminSemanticRefereeTab.test.tsx:162`) only asserts `hitSlop` presence, so this is a wording polish, not a correctness gap. No change required.

## Operator next steps

- This is **src-only / autonomous green** — push + auto-merge (no GATE C Edge redeploy needed). The `deploy-gated` label can be removed (no `supabase/functions/**` or `supabase/migrations/**` byte changed).
- Push the branch: `git push -u origin feat/admin-mcp-001`
- Open PR: `gh pr create --title "ADMIN-MCP-001: autonomous Layers 1-3+7 audit + leak-scan test + smoke skeleton (#477)" --body-file docs/reviews/ADMIN-MCP-001.md`
- **Operator-smoke handoff (Layers 5/6 live path):** run `docs/audits/ADMIN-MCP-001-SMOKE.md` — four phases (flip to `mcp` persists → one call reaches `/mcp/adapter-compat` → packet is advisory-only `authoritative:false` → client leak re-check + restore). The card correctly HALTED before the live provider smoke; Claude made no provider call. PASS requires Phases 1+2+3 PASS and Phase 4 no-leak. If Phase 3 fails (packet not advisory), STOP — doctrine breach, file a P0 and flip `provider_mode` off `mcp`.
- No migration / Edge deploy step (no such byte changed).
- Post-merge worktree cleanup (operator step) per roadmap-reviewer.md § "Post-merge worktree cleanup".
