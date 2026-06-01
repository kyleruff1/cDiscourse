# REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE — Review

Audit-Lint: v1

**Date:** 2026-05-31
**Reviewer:** roadmap-reviewer (Claude Opus 4.7)
**Branch:** `revert/MCP-021C-EDGE-FAMILY-H-ENABLE-production-rollback`
**Base SHA:** `540bfeb5ff0d9b937fb5ae7fa47e04c9374d4491` (main HEAD; Card 3 FAIL audit merge)
**Verdict:** **APPROVE**

---

## Scope

Safety rollback of the Card 3 production-enable for Family H (`claim_clarity`). The post-merge smoke (PR #407 / `540bfeb`) reported terminal provider holes spread across `argument_scheme`, `critical_question`, `disagreement_axis`, and `claim_clarity` (7 `mcp_api_error` events across 4 distinct families — not H-specific; reads as provider/server reliability resurfacing at the 8-family load profile). HALT 15 fired. The rollback restores the Edge production roster to A–G (7 families) by flipping `claim_clarity` `productionEnabled` from `true` back to `false` at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106`, re-baselines 11 sibling test files to the 7-family A–G production roster, deletes the now-obsolete Card 3 production-enable test file, and adds a rollback-narrative HTML comment to `docs/core/current-status.md` line 2. The H admin_validation path remains intact. Card 1 (server H provider files) and Card 2 (L5 doctrine-risk enforcement) territory is fully preserved. Card 3 design + review + smoke template + FAIL audit + J scoping audit are preserved as record.

---

## Diff inventory + preservation table

### Staged changes (14 files)

| File | Change | Nature |
| --- | --- | --- |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | M | 1-char flip: line 106 `productionEnabled: true → false` |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | M | A→G roster (FE-1 SEVEN; FE-4 length 7; FE-15 H production assertion removed); HJ admin-only describe restored |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | M | FR-* lists drop H; FR-30 productionList[6]=resolution_progress; FR-32 set drops H |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | M | AVM-11e drops single-family H production-filter; AVM-13 mixed-list drops H |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | M | DREG-29 → 7-family A–G; DREG-31 → H–J |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` | M | FH-2 `productionEnabled: false`; FH-4 NOT toContain; FH-6 filter `[]`; Card 1 pre-flip baseline restored |
| `__tests__/edgeFamilyDProductionEnable.test.ts` | M | length 7; A→G list; H/I/J admin-only |
| `__tests__/edgeFamilyEProductionEnable.test.ts` | M | length 7; A→G list; H/I/J admin-only |
| `__tests__/edgeFamilyFProductionEnable.test.ts` | M | length 7; A→G list; H/I/J admin-only |
| `__tests__/edgeFamilyGProductionEnable.test.ts` | M | length 7; A→G list; H/I/J admin-only |
| `__tests__/mcpAutoTriggerBoundedConcurrency.test.ts` | M | D6 A–G; tasks 7; NOT-tasked H/I/J |
| `__tests__/archOneCardTwoRoutingPredicate.test.ts` | M | ENQ-2 7 A–G families enqueued |
| `__tests__/edgeFamilyHProductionEnable.test.ts` | D | Card 3 production-enable binding deleted (file was added by `488d105`; binding no longer applies) |
| `docs/core/current-status.md` | M | +1 HTML comment line 2 (rollback narrative); −1 old Card 3 status section |

### Preservation table (operator-mandated; all verified byte-equal or present)

| Preserved surface | Path | Verified |
| --- | --- | --- |
| H Card 1 server provider | `mcp-server/lib/familyHKeys.ts` + `familyHPrompt.ts` + `familyHAnthropic.ts` + `familyHBanListScan.ts` + `familyHFixtureProvider.ts` | `ls` shows all 5 files; `git diff --staged mcp-server/` = 0 bytes |
| H Card 2 L5 entries | `scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES` lines 89–91 (`claim_clarity` + `family_h` + `claim_specificity_low`) | Inline Read confirms entries at lines 89, 90, 91; `git diff --staged scripts/ops/audit-lint-rules.cjs` = 0 bytes |
| Card 3 design doc | `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md` | Present; staged diff 0 bytes |
| Card 3 review doc | `docs/reviews/MCP-021C-EDGE-FAMILY-H-ENABLE.md` | Present; staged diff 0 bytes |
| Card 3 smoke template | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` | Present; staged diff 0 bytes |
| Card 3 FAIL audit | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` | Present; staged diff 0 bytes |
| J scoping audit | `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` | Present; staged diff 0 bytes |

---

## Verification table

| Check | Result | Evidence |
| --- | --- | --- |
| typecheck | PASS | `npm run typecheck` exit 0 |
| lint | PASS | `npm run lint` exit 0 |
| jest | PASS | `Test Suites: 594 passed, 594 total / Tests: 18762 passed, 18762 total / Ran all test suites. JEST-EXIT: 0` — exact match to pre-Card-3 baseline |
| secret scan | PASS | `git diff --staged | grep -iE 'ANTHROPIC_API_KEY\|XAI_API_KEY\|X_BEARER_TOKEN\|SUPABASE_SERVICE_ROLE_KEY\|sb_secret_\|sk-ant-\|^xai-\|Bearer \|Authorization:\|eyJ[A-Za-z0-9_-]{20,}'` → zero hits |
| doctrine scan (verdict tokens) | PASS | New rollback-narrative line: 0 hits for winner / liar / dishonest / bad faith / manipulative / extremist / propagandist. The single `true\|false\|correct` hit is the legitimate code-state phrase `productionEnabled true → false` (boolean flip description, not a verdict on users/claims). |
| service-role / direct insert into `public.arguments` | PASS | `git diff --staged | grep -iE 'SERVICE_ROLE\|insert.*public\.arguments\|from .public\.arguments'` → zero hits |
| `claim_clarity` registry entry | PASS | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106` `productionEnabled: false`, line 107 `adminValidationEnabled: true` — admin_validation path intact |
| `productionEnabled` family list | PASS | 7 families: A `parent_relation`, B `disagreement_axis`, C `misunderstanding_repair`, D `evidence_source_chain`, E `argument_scheme`, F `critical_question`, G `resolution_progress`. H/I/J `productionEnabled: false` |
| H admin_validation preserved | PASS | FH-3 `adminValidationEnabled: true`; FH-5 `edgeAdminValidationEnabledFamilies()` still includes `claim_clarity` (verified in `mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` diff) |
| L5 doctrine entries preserved | PASS | `DOCTRINE_RISK_FAMILIES` Set retains `claim_clarity` (line 89), `family_h` (line 90), `claim_specificity_low` (line 91); diff = 0 bytes |
| mcp-server / migrations / src / package.json | PASS | `git diff --staged --stat mcp-server/ supabase/migrations/ src/ package.json` → 0 bytes |
| Edge request builder (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) | PASS | `git diff --staged supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` → 0 bytes |
| autoTriggerDispatcher | PASS | `git diff --staged supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` → 0 bytes |
| audit-lint scripts | PASS | `git diff --staged scripts/ops/audit-lint.mjs scripts/ops/audit-lint-lib.cjs scripts/ops/audit-lint-rules.cjs` → 0 bytes |
| Deleted file provenance | PASS | `__tests__/edgeFamilyHProductionEnable.test.ts` was added by Card 3 squash commit `488d105`; deletion correctly removes a no-longer-applicable binding |
| Rollback narrative content | PASS | New HTML comment at `docs/core/current-status.md:2` covers (1) "Card 3 production-enable was merged" reference to PR #405 / `488d105`, (2) "smoke FAILED" reference to PR #407 / `540bfeb` + terminal-hole detail across 4 families, (3) "PRESERVED on main" list naming Card 1 server files + Card 2 L5 entries + Card 3 design/review/smoke template + FAIL audit + J scoping audit, (4) "FROZEN for production" until provider/server reliability fixed, (5) explicit "NO Anthropic / xAI / X API / Supabase write / service-role / migration / Edge Function source edit beyond familyRegistry.ts:106 / MCP server change / package.json change" closure |

---

## Boundary compliance

| Protected surface (per brief + skills) | Status |
| --- | --- |
| `mcp-server/**` (H Card 1 + all family A–J server providers) | UNCHANGED — `git diff --staged --stat mcp-server/` = 0 bytes |
| `mcp-server/lib/familyH*.ts` (5 files) | PRESERVED — all present; admin_validation hosted MCP path intact |
| `scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES` H entries | PRESERVED — `claim_clarity` (line 89) + `family_h` (line 90) + `claim_specificity_low` (line 91) byte-equal |
| `scripts/ops/audit-lint.mjs` + `scripts/ops/audit-lint-lib.cjs` | UNCHANGED — 0 bytes |
| `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) | UNCHANGED — 0 bytes |
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | UNCHANGED — 0 bytes |
| Source 6 + nodeLabels + schema mirror surfaces | UNCHANGED — included in mcp-server/** = 0 bytes |
| `supabase/migrations/**` | UNCHANGED — 0 bytes |
| `src/**` (production app) | UNCHANGED — 0 bytes |
| `package.json` + `package-lock.json` | UNCHANGED — 0 bytes |
| Card 3 design doc `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md` | PRESERVED — staged diff 0 bytes |
| Card 3 review doc `docs/reviews/MCP-021C-EDGE-FAMILY-H-ENABLE.md` | PRESERVED — staged diff 0 bytes |
| Card 3 smoke template `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` | PRESERVED — staged diff 0 bytes |
| Card 3 FAIL audit `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` | PRESERVED — staged diff 0 bytes (FAIL evidence retained) |
| J scoping audit `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` | PRESERVED — staged diff 0 bytes |
| No `submit-argument` / `classify-argument-boolean-observations` invocation by Claude | CONFIRMED — review-only |
| No service-role / Anthropic / xAI / X API call by Claude | CONFIRMED — review-only |

---

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings (rollback narrative is internal status doc; verdict-token scan clean on the new line)
- [x] Score never blocks posting — unchanged; the rollback narrows the production-routing family set only
- [x] No service-role in client code — UNCHANGED; rollback removes a routing flip, not a permission boundary
- [x] No direct insert into `public.arguments` — UNCHANGED
- [x] No AI calls in production app paths — UNCHANGED
- [x] Plain language only (no raw internal codes in UI strings) — UNCHANGED
- [x] Family-H-specific doctrine (`cdiscourse-doctrine` §1, §10a; rollback preserves Family H as Machine Observation `source = 'machine'` — only the production-vs-admin routing boundary moves; `claim_specificity_low` remains a structural marker, never a verdict)
- [x] `supabase-edge-contract` — no migration, no RLS change, no service-role exposure
- [x] `test-discipline` — test count UP not down at the pre-Card-3 baseline (18,762 / 594 suites); 11 sibling tests modified with assertion **changes** (no assertion **removed** or **loosened**: every removed-from-production assertion is paired with a present-in-admin-validation assertion); 1 file deleted because its binding no longer applies (Card 3 production-enable binding was the file's sole purpose, introduced by commit `488d105`)

---

## Final verdict

**APPROVE.** The rollback is a surgical 1-character revert (`familyRegistry.ts:106` `true → false`) plus the mechanical sibling test re-baseline required to land that flip cleanly. The H Card 1 server admin_validation pathway is fully preserved (zero `mcp-server/` diff; all 5 `familyH*.ts` files present). The H Card 2 L5 doctrine-risk enforcement is fully preserved (zero `scripts/ops/audit-lint-rules.cjs` diff; all 3 H entries — `claim_clarity` + `family_h` + `claim_specificity_low` — at lines 89–91). The Card 3 design + review + smoke template + FAIL audit + J scoping audit are preserved as record. The 18,762 / 594-suite jest count is an exact match to the pre-Card-3 baseline (clean rollback signature). No source/prompt/taxonomy/schema/migration/package/MCP server change beyond the single boolean character. The rollback narrative in `docs/core/current-status.md` accurately represents the smoke FAIL (PR #407 / `540bfeb` terminal-hole detail across 4 families) and the precise preservation boundary. Family H is FROZEN for production until provider/server reliability is fixed and Card 3 smoke is re-run cleanly; H remains admin_validation-capable on the hosted MCP server. Doctrine-clean.

## Operator next steps

- Commit the staged rollback (operator), then push the branch: `git push -u origin revert/MCP-021C-EDGE-FAMILY-H-ENABLE-production-rollback`
- Open PR titled `revert(MCP-021C-EDGE-FAMILY-H-ENABLE): production rollback after smoke FAIL` with this review doc as the body
- Deploy: none required by Claude. The Supabase GitHub integration auto-deploys `submit-argument` and `classify-argument-boolean-observations` on merge (~30–90 s); the auto-deploy picks up the `familyRegistry.ts:106` flip and the 8-family auto-trigger dispatch reverts to 7-family (A–G)
- Post-merge sanity: optional one-shot canary submit to confirm `auto_trigger_dispatched` `family_count = 7` and `claim_clarity` no longer appears in production auto-trigger telemetry
- Track follow-up: file or link the provider/server reliability work (treat #371 successor / provider-control architecture as the prerequisite) and a future MCP-021C-EDGE-FAMILY-H-ENABLE re-attempt after that work lands
- Post-merge worktree cleanup: this review was run from the main checkout (not a worktree). No worktree cleanup required.
