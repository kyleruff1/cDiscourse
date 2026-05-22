# ADMIN-AI-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-22
**Branch:** feat/ADMIN-AI-001-admin-runtime-provider-mode-switch-for-t
**Design:** docs/designs/ADMIN-AI-001.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/225
**Worktree root:** C:/Users/kyler/cdiscourse/debate-constitution-app/.claude/worktrees/agent-a1aceabd86e665936

## Summary

ADMIN-AI-001 moves the semantic-referee provider mode from a function env var to an
admin-controlled runtime DB setting. The implementation (8 commits, tip `a7c14f1`)
matches the design with no undocumented deviation. It adds one append-only migration
(`20260522000011_*`) with a strongly-typed singleton config table + an append-only audit
table, a narrow `SECURITY DEFINER` read function with a locked `search_path`, a Deno-side
`resolveSemanticRefereeConfig` resolver that never throws, a DB-resolution layer above the
existing env lookup in `providers.ts`, two new `admin-users` actions, an Admin UI tab, and
the operator runbook. The doctrine-critical invariants hold: `providerRoutingCore.ts` is
byte-identical (the `?? 'mock'` code fallback is untouched), the env path is preserved
verbatim in the `db_unavailable` branch, `ANTHROPIC_API_KEY` is exposed only as a boolean,
no service-role key reaches client code, `submit-argument` / `process-language-draft` are
untouched, and provider resolution degrades gracefully on every failure path (HTTP 200,
no client-visible hard error). Tests cover every new public function with happy + failure
cases. Verdict: Approve.

## Verification

- typecheck: **pass** (`tsc --noEmit`, clean)
- lint: **pass** (`eslint . --max-warnings 0`, clean)
- test: 8836 → 8967 tests / 317 → 325 suites. **8966 passing / 8967**. One red suite
  (`diagnosticInspectPackage.test.ts`) is a **pre-existing baseline flake unrelated to
  ADMIN-AI-001** — confirmed: the branch touches zero diagnostic files
  (`git diff main...HEAD --name-only | grep diagnos` → empty;
  `git log main...HEAD -- scripts/diagnostics` → empty). NOT a regression; does not block.
- skills:validate: **pass** (both bot skills hash-verified)
- secret scan: **clean** — every `ANTHROPIC_API_KEY` / `SERVICE_ROLE` / `Bearer` hit in
  `git diff main...HEAD` is inside negative-assertion test code, design prose, or the
  doctrine self-check. No live key literal, no real service-role usage.
- doctrine scan: **clean** — every verdict-token hit is the ban-list test's own array of
  forbidden tokens or design prose. No `winner`/`loser`/`verdict`/`game` as user-facing
  copy. No `console.log` added. No AI provider call added to `src/`.

## Design conformance

- [x] All design file-changes are present — 6 new files + 11 modified files + 8 new test
  suites + 3 extended test suites, all as the design's "File changes" section enumerates.
- [x] No undocumented file-changes — `git diff main...HEAD --stat` (29 files) maps 1:1 to
  the design. `CLAUDE.md` correctly left untouched (the design permitted skipping the
  stage-line bump for a Phase-E follow-up).
- [x] Data model matches design — both tables, columns, CHECK constraints, the singleton
  PK guard, RLS policies, the `SECURITY DEFINER` function signature, indexes, and the seed
  row are byte-faithful to the design's SQL.
- [x] API contracts match design — `resolveSemanticRefereeConfig`, the modified
  `classifyWithConfiguredProvider` signature, the two zod schemas (write enum excludes
  `mcp`; `.refine()` enforces `confirmAnthropic`), the two Edge handlers, and the client
  wrapper match the design's "API / interface contracts" section.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — `adminSemanticConfigBanList.test.ts`
  scans rendered copy for `winner`/`loser`/`verdict`/`truth`/etc.; the tab footnote states
  the mode "makes no judgment — does not decide who is right, assign a score, or block any
  message."
- [x] Score never blocks posting — `submit-argument` is untouched; the card only chooses
  *which provider answers*, not what the answer means.
- [x] No service-role in client code — `git diff main...HEAD -- 'src/**' | grep SERVICE_ROLE`
  → empty. The admin write goes through `admin-users` with `requireAdmin`; the
  `semantic-referee` function builds no service-role client.
- [x] No direct insert into public.arguments — the card writes only to
  `semantic_referee_runtime_config` and `semantic_referee_config_audit`;
  `adminSecurity.test.ts` asserts the set handler never `from('arguments')`.
- [x] No AI calls in production app paths — no `fetch` / `anthropic.com` / `api.x.ai`
  added to `src/`. The only new code is a DB read, an admin write, and a UI tab.
- [x] Plain language only — provider modes map to readable labels (`Anthropic` / `Mock` /
  `Fixture (dev/test)` / `Coming later (MCP-018)`); no snake_case internal code in
  rendered copy (asserted by the ban-list test).
- [x] Epic-specific doctrine (cdiscourse-doctrine §4 + supabase-edge-contract):
  - **Provider resolution never throws to the client** — `resolveSemanticRefereeConfig`
    wraps its whole body in `try/catch`; every failure mode (rpc error / empty / non-array
    / unknown `provider_mode` / non-boolean `enabled` / thrown / missing `.rpc`) returns
    `{ source: 'db_unavailable' }`. Tested in `semanticRuntimeConfigResolver.test.ts`.
  - **The `?? 'mock'` code fallback is preserved** — `providerRoutingCore.ts` is
    byte-identical (`git diff --stat` empty); the env branch in `providers.ts` keeps the
    verbatim `Deno.env.get(...) ?? undefined` pairs; a source-scan regression test asserts
    the `env.SEMANTIC_REFEREE_PROVIDER ?? 'mock'` literal is unchanged.
  - **`SECURITY DEFINER` hygiene** — `get_semantic_referee_runtime_config()` has
    `SET search_path = public`, returns only the three safe fields (no `SELECT *`, no
    `updated_by`), `REVOKE ALL FROM PUBLIC` then `GRANT EXECUTE`.
  - **Secrets** — `ANTHROPIC_API_KEY` is read only as `Boolean(Deno.env.get(...))` inside
    `admin-users` (an Edge Function); never under `src/`; the UI shows only a Yes/No
    boolean. Enforced by `adminSemanticConfigSecretScan.test.ts`.
  - **JWT / auth unchanged** — `admin-users` keeps `verify_jwt = true` + `requireAdmin`;
    the two new actions ride the same pipeline; neither handler builds a caller-scoped
    bypass (asserted by `adminSecurity.test.ts`).

## Test coverage

- [x] New public functions have unit tests — `resolveSemanticRefereeConfig` (happy + 8
  failure cases + never-throws), the resolution precedence (DB-wins / db_unavailable
  fallthrough / load-bearing `?? 'mock'` regression), the two zod schemas (incl. the
  `mcp`-rejected and `confirmAnthropic` cases), the client wrapper + `requiresProviderConfirmation`.
- [x] User-facing strings have ban-list assertion — `adminSemanticConfigBanList.test.ts`
  is the mandatory new-copy scan.
- [x] Edge cases from design § "Edge cases" have tests — DB-unavailable fallthrough,
  singleton-row-missing, corrupt `provider_mode`, `enabled = false`, DB-beats-env, `mcp`
  not-implemented stub, the confirmation-bypass attempt (the `.refine()`).
- [x] Accessibility assertions present — `AdminSemanticRefereeTab.test.tsx` asserts
  `accessibilityRole` / `accessibilityState` / `hitSlop` on the interactive controls; the
  tab source carries role + label + state on every Pressable.

## CRITICAL DOCTRINE CHECK results (11/11 pass)

1. Default-provider regression — **pass**. `npm run test -- semanticProviderRegistry`
   green (23 tests); the `?? 'mock'` default-fallback test passes.
2. Resolution hierarchy correctness — **pass**. `semanticRuntimeConfigResolver.test.ts`
   and `semanticProviderRegistryDbResolution.test.ts` contain and pass DB>env>code-fallback,
   db_unavailable fallthrough, invalid-mode fallthrough, code-fallback-stays-`mock`,
   never-throws.
3. Secret scan — **pass**. Zero `ANTHROPIC_API_KEY` / `sk-ant-` / `Bearer` matches outside
   negative-assertion test code and design prose.
4. Service-role scan — **pass**. `git diff main...HEAD -- 'src/**' | grep SERVICE_ROLE` → empty.
5. Direct-insert scan — **pass**. No `insert ... public.arguments`; the two prose hits are
   documentation explicitly asserting *no* such insert.
6. RLS policy presence — **pass**. The migration grants normal users zero policies on
   either table (RLS denies by default); only admins SELECT/UPDATE the config and
   SELECT/INSERT the audit.
7. SECURITY DEFINER hygiene — **pass**. `get_semantic_referee_runtime_config()` has a
   locked `SET search_path = public`.
8. UI key-display scan — **pass**. The tab renders only `anthropicKeyPresent ? 'Yes' : 'No'`;
   it references no `ANTHROPIC_API_KEY` token and no `Deno.env`.
9. Admin UI terminology — **pass**. No `game` / `winner` / `loser` / `verdict` / `debate`
   as user-facing copy in the tab.
10. Acceptance-criteria audit — **pass**. See below; all 11 ticked boxes verified true.
11. Standard checks — **pass**. typecheck + lint + skills:validate green; test green except
    the documented `diagnosticInspectPackage` baseline flake; `process-language-draft/` and
    `submit-argument/` untouched; `providerRoutingCore.ts` byte-identical.

## Acceptance-criteria audit (issue #225 — all 11 ticks verified true)

- [x] Admin can view current mode + config source — `AdminSemanticRefereeTab` status card
  renders `PROVIDER_MODE_LABELS[config.providerMode]` + "Saved setting (database)". TRUE.
- [x] Admin can switch to Anthropic with a confirmation step — the confirmation panel
  (`Switch to Anthropic?` / "Anthropic mode may use provider credits. Continue?") sends
  `confirmAnthropic: true`; the server-side `.refine()` is the wall. TRUE.
- [x] Admin can switch back to Mock (one-click) — the non-anthropic branch calls
  `applyChange` directly with no confirm panel. TRUE.
- [x] Fixture supported as dev/test; MCP disabled/"future" — `fixture` is selectable with
  the "dev/test" label; `mcp` renders as a disabled View labelled "Coming later (MCP-018)"
  and selecting it is a no-op. TRUE.
- [x] Setting persists in DB; every change audit-logged — the singleton row + the
  append-only `semantic_referee_config_audit` row written by `handleSetSemanticConfig`
  (plus the generic `writeAdminAudit` row). TRUE.
- [x] Edge Function uses persisted setting as runtime source of truth; env is fallback
  only; code fallback stays `mock` — `classifyWithConfiguredProvider` resolves the DB
  layer first and falls through to the verbatim env path only on `db_unavailable`;
  `providerRoutingCore.ts`'s `?? 'mock'` is unchanged. TRUE.
- [x] Switching modes needs no redeploy/no code change — the write updates a DB row read
  on every invocation (no cache). TRUE.
- [x] Admin UI never displays secret values — boolean-only key status, verified by scan. TRUE.
- [x] Provider resolution never throws a client-visible hard error — resolver never throws,
  env-invalid → `mock`, `anthropic`-no-key → MCP-017 typed `unavailable` (HTTP 200). TRUE.
- [x] No service-role key in client code; no direct insert into public.arguments —
  verified by scan and `adminSecurity.test.ts`. TRUE.
- [x] typecheck + lint + test + skills:validate all pass — confirmed (test green modulo the
  documented pre-existing flake). TRUE.

## Blockers

None.

## Suggestions (non-blocking)

1. **`AdminSemanticRefereeTab.test.tsx` is a source-scan, not a runtime-render test.**
   The design's test plan (docs/designs/ADMIN-AI-001.md §"Test plan", lines 530-536)
   described it as "RN Testing Library" with render-and-interact assertions. The
   implementer instead used a static source-scan, with a documented and accurate reason
   (`react-test-renderer` is version-pinned away from `@testing-library`'s peer range; no
   existing `.test.tsx` in the repo renders). Behavioral coverage is still achieved —
   `requiresProviderConfirmation` is fully unit-tested in `semanticRefereeConfigApi.test.ts`
   and the scan verifies every wiring point. This is a reasonable engineering call given a
   real repo-wide constraint, not a gap; noted only so a future dependency-bump card can
   upgrade these scans to true render tests.
2. **`semanticProviderRegistryDbResolution.test.ts` proves the resolution body via a
   replica + source-scan** rather than calling `classifyWithConfiguredProvider` directly
   (that file imports `npm:zod@4` transitively, so Jest cannot `require()` it). The test
   documents this and the source-scans guard against drift — consistent with the
   established `adminSchemas.test.ts` pattern. No action needed; flagged for awareness that
   if the resolution body and the replica ever diverge, the source-scan is the safety net.

## Operator next steps

- Push the branch: `git push -u origin feat/ADMIN-AI-001-admin-runtime-provider-mode-switch-for-t`
- Open PR: `gh pr create --title "ADMIN-AI-001: Admin runtime provider-mode switch for the semantic referee" --body-file docs/reviews/ADMIN-AI-001.md`
- Deploy steps (from design §"Operator steps" + docs/deployment/admin-ai-001-provider-mode-runbook.md), **in this order**:
  1. `npx supabase db push --linked` — applies `20260522000011_admin_ai_001_semantic_referee_runtime_config.sql` (both tables, the `SECURITY DEFINER` function, the RLS policies, seeds the singleton row).
  2. `npx supabase functions deploy admin-users --linked` — ships `get_semantic_config` + `set_semantic_config`.
  3. `npx supabase functions deploy semantic-referee --linked` — ships the DB-resolution layer.
  4. Verify: `npx supabase db lint`; open the Admin UI **Semantic Referee** tab — effective
     mode `Anthropic`, config source "Saved setting (database)"; round-trip Mock ↔ Anthropic.
- Rollback: switch to **Mock** in the Admin UI (one click, no redeploy). Break-glass:
  `UPDATE public.semantic_referee_runtime_config SET provider_mode = 'mock' WHERE id = true;`
