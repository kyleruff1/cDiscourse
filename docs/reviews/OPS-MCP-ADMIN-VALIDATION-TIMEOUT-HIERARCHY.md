# OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-11
**Branch:** feat/admin-validation-timeout-hierarchy (HEAD ee36e63)
**Design:** docs/designs/OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY.md

## Summary
This card raises the `admin_validation`-mode caller-side abort deadline on the
ADMIN-gated `classify-argument-boolean-observations` Edge handler from the 15s
default to a new `ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS = 30_000` constant,
correcting an inverted timeout hierarchy (15s caller abort < 25s server model
budget) that killed valid 16-25s slow calls on the Family-J E3 existential
input. The diff is exactly what the design promises: one new constant next to
the drainer's, one mode-gated injection-site wrap, a Jest-bridge re-export, a
12-test suite, and two docs (+402/-1, 6 files). The blast radius is exact —
the wrap is gated on `body.mode === 'admin_validation'`; the submit/auto-trigger
and production-HTTP paths keep the bare 1-arg adapter (15s); the drainer,
`autoTriggerDispatcher.ts`, and the 15s/30s constant declarations are untouched.
All gates green; doctrine clean. Residual concerns are documentation-level
(non-blocking): the 30s constant is hardcoded rather than derived from the
server's env-overridable budget, and the worst-case wall-clock figure is stated
imprecisely. Neither is a defect; both mirror the already-merged ARCH-001 Card 2
precedent this card was asked to mirror.

## Verification
- typecheck: pass (exit 0)
- lint: pass (per-file eslint on all 4 changed code files, exit 0)
- test: 710 suites / 29529 → **711 suites / 29541** passed (+1 suite / +12 tests); 1 pre-existing skip; full `npx jest --maxWorkers=4` exit 0 (matches implementer claim 711/29541)
- targeted: new + 5 adjacent source-scan suites = 6 suites / 143 tests, exit 0
- secret scan: clean
- doctrine scan: clean (all grep hits are false positives — Jest `.toBe(true)` assertions, design-prose "only correct when"/"already correct", and a pre-existing Family-J status context line describing classifier machinery; none are user-facing labels)
- Migration apply: N/A — no `supabase/migrations/**` files in the diff; this card is Edge-redeploy-bearing only

## Design conformance
- [x] All design file-changes are present (new constant, injection wrap, Jest bridge re-export, 12-test suite, design doc, current-status entry)
- [x] No undocumented file-changes (6 files exactly match design + status narrative)
- [x] Data model matches design (no data-model change; transport-timing only)
- [x] API contracts match design (request/response shapes unchanged; `MAX_ARGUMENTS_PER_CALL` unchanged at 10)

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings (diff adds no UI strings)
- [x] Score never blocks posting (no scoring/acceptance-gating touched)
- [x] No service-role in client code (service-role usage is inside the Edge Function and pre-existing/unchanged; `src/`+`app/` scan clean)
- [x] No direct insert into public.arguments (scan clean)
- [x] No AI calls in production app paths (the only AI invocation is the Edge→MCP fetch, server-side, unchanged)
- [x] Plain language only (no raw internal codes introduced into UI strings)
- [x] Epic-specific doctrine — cdiscourse-doctrine §10a (Observations advisory) preserved; Family J remains admin-validation-only (production-mode family gate at index.ts:226-240 unchanged; no `productionEnabled` flip)

## Test coverage
- [x] New public function/constant has unit tests (AVTH-1..5 pin the constant value + hierarchy; AVTH-6..9 pin the import + wrap + gate + core injection; AVTH-10..12 pin the byte-unchanged invariants)
- [x] Edge cases covered: hierarchy assertion vs 25s server budget (AVTH-2), 15s-still-tighter-by-design (AVTH-4), admin matches drainer 30s (AVTH-3), dispatcher/drainer/default untouched (AVTH-10/11/12)
- [x] Source-scan assertions are NON-VACUOUS — verified independently: AVTH-7 regex returns false on a wrap-removed (bare-adapter) handler; AVTH-8 regex returns false on both `!==`-inverted and `=== 'production'`-flipped gates; both return true on the current code
- [x] Accessibility assertions: N/A (no UI surface)

## Adversarial dimensions (as charged)
1. **Blast-radius exactness — PASS.** Gate is exactly `body.mode === 'admin_validation'` (index.ts:261). `body.mode` is validated to the two-value union `'production' | 'admin_validation'` (validateRequestBody / isMachineObservationRunMode), so the ternary's else branch is reachable only for `production`, which keeps the bare reference. No third mode and no production-mode admin-handler call can accidentally get 30s. `classifyArgumentCore.ts:208,268` invokes the adapter as a strict 1-arg function (`adapter(batchRequest)`), so the pre-bound `{ timeoutMs: 30000 }` closure is honored and cannot be overridden by the core. `autoTriggerDispatcher.ts` and `classifierDrainerClassify.ts` are absent from the diff (untouched); the 15s + drainer-30s declarations are unchanged (diff only ADDS the new constant after the drainer's).
2. **Hierarchy correctness — PASS with documented residual.** Verified `mcp-server/lib/anthropicCall.ts:32` is literally `DEFAULT_MODEL_TIMEOUT_MS = 25_000` and the env override path `readEnvTimeoutMs()` at :97-103 reads `MCP_SERVER_MODEL_TIMEOUT_MS`. The fix hardcodes 30_000 rather than deriving from the env, so raising `MCP_SERVER_MODEL_TIMEOUT_MS` above 30000 via env would silently re-invert the hierarchy. This risk is NOT explicitly documented (code comment and design table cite the 25000 default + env path but do not warn about the re-inversion). It is, however, an inherited property of the merged ARCH-001 Card 2 drainer constant this card mirrors — not a new defect. See Suggestion 1.
3. **Wall-clock interaction honesty — PASS (assessed, not redesigned).** The per-argument 30s abort is per-batch-fetch inside the sequential loop, so `10 args × 30s = 300s` is the correct worst-case math (and could exceed it for >20-key families that split into multiple batches/arg, e.g. D/G — though Family J at 5 keys is single-batch). "No enforcement change" is a defensible call: the path is operator-driven, off the user hot path, fail-closed (a wall-clock kill drops un-processed args; completed args already persisted their run rows; nothing dirty), and the ≤5-arg operator recommendation is the real safeguard. The comment's claim that 300s "would approach the Edge wall clock" is imprecise — the card never states the actual Supabase Edge wall-clock number, and 300s exceeds (rather than approaches) a 150s limit. Honesty refinement, not a defect. See Suggestion 2.
4. **Test reality — PASS.** All targeted + adjacent suites green; full suite matches the claimed 711/29541 exit 0. Source-scan teeth proven by mutation testing of the regexes (above). Residual: the test's `SERVER_MODEL_TIMEOUT_MS = 25_000` is a hardcoded mirror (the `mcp-server/` tree is Deno-only, excluded from Jest), so the hierarchy assertion cannot detect cross-tree drift if the Deno-side default changes — acknowledged in the test's own header comment (lines 35-43). The mcp-server Deno suite is expected to pin its own default.
5. **Doctrine — PASS.** No acceptance gating, no J posture change, no family flag flipped, no routing arm. The widening affects ONLY authenticated-admin `admin_validation`-mode calls (both modes are admin-gated; production keeps 15s). Docs are honest: EDGE-BEARING-on-merge stated, `[functions.classify-argument-boolean-observations]` confirmed registered in `config.toml:452` (so the auto-redeploy claim holds), and "J stays admin-validation-only / no production-enable implied" stated.

## Blockers
None.

## Suggestions (non-blocking)
1. **Document the env-coupling re-inversion.** A one-line note in the
   `ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS` comment (and ideally the design's
   hierarchy table) stating "if an operator raises `MCP_SERVER_MODEL_TIMEOUT_MS`
   above 30000 via env, this hardcoded 30s caller abort re-inverts the
   hierarchy" would close the only silent-footgun in the change. Applies equally
   to the sibling `DRAINER_MCP_REQUEST_TIMEOUT_MS`; could be a shared follow-up.
2. **Tighten the wall-clock prose.** The comment's "300s would approach the Edge
   wall clock" is imprecise (the actual limit is unstated; 300s exceeds a 150s
   ceiling). Either name the platform wall-clock number or soften to "could
   exceed the Edge wall clock for large sensitive-family batches — keep batches
   ≤5." The multi-batch families (D/G) push the worst case above 300s, which the
   single-batch 300s figure understates.
3. **Cross-tree drift guard (optional).** Consider a comment pointer (or a
   mcp-server Deno test cross-reference) reminding that the Jest-side
   `SERVER_MODEL_TIMEOUT_MS = 25_000` mirror must be updated in lockstep if the
   Deno `DEFAULT_MODEL_TIMEOUT_MS` ever changes.

## Operator next steps
- Push the branch: `git push -u origin feat/admin-validation-timeout-hierarchy`
- Open PR: `gh pr create --title "OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY: admin_validation caller patience 15s→30s" --body-file docs/reviews/OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY.md`
- Deploy (EDGE-BEARING, automatic): merge auto-redeploys `classify-argument-boolean-observations` via the Supabase GitHub integration (registered in `config.toml`). No migration, no Vault, no routing arm, no `mcp-server/` redeploy. NOT deployed by Claude.
- Post-merge smoke (from design): re-run the Family-J E3 admin_validation smoke on the existential person-shift input; confirm it classifies at the Edge boundary within the 30s ceiling (no `mcp_api_error`). No production-enable implied — Family J stays admin-validation-only.
- Post-merge worktree cleanup: per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".
