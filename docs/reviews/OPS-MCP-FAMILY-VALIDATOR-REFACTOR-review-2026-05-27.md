# OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-27
**Branch:** feat/OPS-MCP-FAMILY-VALIDATOR-REFACTOR
**Design:** docs/designs/OPS-MCP-FAMILY-VALIDATOR-REFACTOR.md
**Intent brief:** docs/designs/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-intent.md
**Predecessor on main:** e281753 (AUTO-TRIGGER-FAMILY-A-SMOKE PASS)
**Issue:** #314

---

## 1. Verdict

**APPROVE.** The refactor preserves Family A behavior byte-equal across every documented validation rule, error envelope, and tool-handler literal. The registry pattern is correctly scoped to Family A only (no B/C/D/E leakage), the +36 test forecast matches design §7.3 exactly, all 4 BLOCK stop conditions are clear, and the verification battery (Deno 236/0, typecheck 0, lint 0) is clean. Stage 0 prerequisite for MCP-SERVER-003-BATCH-B-C-D-E is met.

---

## 2. 18-item verdict matrix

| Item | Check | Verdict | Justification |
|---|---|---|---|
| A | Scope: validator refactor only; no B/C/D/E support added | PASS | `familyRegistryInit.ts:44` registers exactly `'parent_relation'`. Zero Family B-J rawKey data anywhere in `mcp-server/lib/` or `mcp-server/tools/`. |
| B | `familyABooleanRequestSchema.ts` properly renamed | PASS | `git diff --stat` shows `R` (rename) tracking: `{familyABooleanRequestSchema.ts => familyBooleanRequestSchema.ts}`. Old file absent from `mcp-server/lib/` listing. |
| C | Family A behavior byte-equal | PASS | All 11 validation rules from design §2.4 preserved verbatim in `familyBooleanRequestSchema.ts`: `'must be string'` (lines 72, 104), `'must be string or null'` (line 86), `` `length below ${minLen}` `` (line 75), `` `length above ${maxLen}` `` (lines 78, 89), `'must be array'` (line 96), `'must be a plain object'` (line 138, top-level), `'must be plain object'` (line 270, definitions — note the missing "a" distinction is preserved), `` `expected ${X}; got ${Y}` `` (line 148), `'must be integer'` (line 281), `` `out of range ${MIN_TIMEOUT_MS}..${MAX_TIMEOUT_MS}` `` (line 289). Tool-handler boundary literals at `classifyArgumentBooleanObservations.ts:179` (`'Family A is the only supported family in this server build'`), `:182` (`supportedFamilies: ['parent_relation']`), `:196` (`'One or more requestedRawKeys are not in Family A'`), `:209` (`'Input failed schema validation'`) — all preserved verbatim. |
| D | Error envelope shapes unchanged | PASS | `FamilyRequestValidationFailure` union at `familyBooleanRequestSchema.ts:52-55` retains all three failure shapes byte-equal (`invalid_params` / `unsupported_family` / `unsupported_rawKey`). `FamilyRequestValidationResult` success shape at line 58 retains `value: ValidatedFamilyARequest` — the success-envelope value type was correctly NOT renamed per design §4.5. |
| E | Registry registered Family A correctly | PASS | `familyRegistryInit.ts:44-47` calls `register('parent_relation', { rawKeys: new Set(FAMILY_A_RAW_KEYS), classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION })`. Idempotent guard via `let initialized = false` at line 30 + return-early at line 41. Top-of-file side-effect call at line 51. |
| F | `getSupportedFamilies()` returns exactly `['parent_relation']` | PASS | `familyRegistryInit.test.ts:30-39` `Deno.test('familyRegistryInit-registers-only-family-a', ...)` asserts `assertEquals(families, ['parent_relation'])` and `assertEquals(families.length, 1)`. Independent test run: PASS. |
| G | `tools/list` advertises only Family A | PASS | `classifyArgumentBooleanObservations.ts:48-52` tool description still scopes to "MCP-021A Family A (parent_relation)" with the explicit "Family B through J return an unsupported_family error envelope in this server build" sentence. The `toolsList.test.ts` suite (6 tests) still passes per the Deno run. |
| H | Parity test still works and reads from registry | PASS | `familyAKeysParity.test.ts:13-16` side-effect-imports `familyRegistryInit.ts` and derives `FAMILY_A_RAW_KEYS = Array.from(getRawKeysForFamily('parent_relation'))`. Hardcoded `length !== 16` invariant preserved at lines 53-57 with the binding `expected 16. Drift detected.` message. Both `Deno.test(...)` names unchanged (CI history preserved). |
| I | `classifyArgumentBooleanObservations.ts` dispatcher uses new validator | PASS | Line 39 imports `validateFamilyBooleanRequest` (renamed); line 42 side-effect-imports `'../lib/familyRegistryInit.ts'`; line 167 call site uses `validateFamilyBooleanRequest(args)`. Error mapping at lines 167-213 byte-equal to pre-refactor (4 literal strings + 1 supportedFamilies tail array verified). |
| J | No Family B/C/D/E key data added accidentally | PASS | `grep -E "disagreement_axis\|misunderstanding_repair\|evidence_source_chain\|argument_scheme\|critical_question\|resolution_progress\|claim_clarity\|thread_topology\|sensitive_composer" mcp-server/lib/familyRegistryInit.ts` returns zero matches. All references to `'disagreement_axis'` in `mcp-server/tests/` are negative-path test inputs (assert rejection), not registration. |
| K | No schema version change | PASS | `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` only imported (read), never assigned. The literal `'mcp-021.machine-observations.boolean.v1'` appears only in (a) the schema test file as a read-only test constant, and (b) design doc / current-status documentation. No write context. |
| L | No persistence layer changes | PASS | `git diff main..HEAD --name-only -- 'supabase/migrations/**' '*.sql'` returns zero hits. No `.from('arguments')` / `.from('machine_observations')` calls in the diff. |
| M | No Edge Function changes | PASS | `git diff main..HEAD --name-only -- 'supabase/functions/**'` returns zero hits. |
| N | No UI changes | PASS | `git diff main..HEAD --name-only -- 'src/components/**' 'src/screens/**' 'app/**'` returns zero hits. |
| O | Test forecast met (+30 to +60; not <20 and not >150) | PASS | Independent re-count: `grep -c "^Deno.test"` → `familyRegistry.test.ts:14`, `familyRegistryInit.test.ts:5`, `familyBooleanRequestSchema.test.ts:17`. Total +36 net new tests. Exactly matches design §7.3 forecast. |
| P | All new tests pass | PASS | Independent reviewer run: `cd mcp-server && deno test --allow-net --allow-env --allow-read` → **236 passed / 0 failed (1s)**. Matches orchestrator independent verification and implementer report. |
| Q | All existing tests still pass | PASS | Deno suite is 236/0 (baseline was 200, so all 200 prior tests + 36 new = 236 PASS). Implementer report confirms Jest 17,712 passed / 549 suites / 0 failed unchanged (the validator rename is invisible to Jest because the validator lives in `mcp-server/` not `src/`). |
| R | Doctrine ban-list clean (defensive) | PASS | `git diff main..HEAD -- mcp-server/` produces 5 matches for `verdict`-form tokens, all NEGATION-form doctrine anchors in JSDoc/test docstrings: "encodes no verdict", "never produces verdict tokens", "no family encodes a verdict or judgment", "validator never produces verdict tokens", "groupings, never verdicts". Verified — all 5 are in JSDoc/comments only, none returned to user / API client / log payload. |

**All 18 items PASS.** No FAIL, no WARN.

---

## 3. Notable diff observations

The following are diff observations beyond the 18-item matrix that the reviewer noted but that do not affect the verdict:

1. **`familyBooleanRequestSchema.ts` introduces a `DEFAULT_FAMILY_FOR_RAWKEY_CHECK` constant (line 50).** This constant is the byte-equal-preservation anchor for the case where the caller passes `requestedFamilies: []`. The pre-refactor validator hard-coded Family A's rawKeys for ALL requests; in the multi-family world, the validator routes via the registry, but when no family is named the rawKey check still routes to `'parent_relation'`. The docstring at lines 41-49 explicitly documents this as a deferred concern for the family-B card. This is a tasteful, byte-equal-preservation-first design choice — exactly the right move for this refactor. The constant is correctly NOT exported (private to the module).

2. **The schema-direct test file (`familyBooleanRequestSchema.test.ts`) includes a defensive `if (!isFamilySupported('parent_relation')) { register(...) }` block at lines 32-37.** This guards against the test file being run in isolation without the production singleton having been initialized by `familyRegistryInit.ts`. The implementer's comment at lines 28-31 explains this. The guard is correct — without it, the schema-direct tests would either silently fail (if registry is empty) or accidentally double-register (if registry init runs later in module load order). The implementer chose the right defensive pattern.

3. **The factory `createFamilyRegistry()` pattern (familyRegistry.ts:65-112) plus the singleton pattern (lines 124-148) coexist cleanly.** Tests in `familyRegistry.test.ts` use the factory (per design §5.3); tests in `familyRegistryInit.test.ts` use the singleton (per design intent). No registry state leaks between test files because the factory yields a fully isolated instance.

4. **`current-status.md` handoff section (40 new lines) is well-scoped.** It correctly documents the Stage 0 prerequisite framing, lists the 5 commits, names the smoke phases per intent brief §8, and explicitly does NOT claim PASS for the post-merge smoke (because the smoke is still operator-territory). The "Doctrine + secrets greps clean" claim in the handoff matches reviewer independent verification.

5. **No `console.log` introduced.** All log calls in `classifyArgumentBooleanObservations.ts` use the structured `log()` helper from `mcp-server/lib/logging.ts` and emit only `requestId` / `reason` / `status` / `httpStatus` — no bodies, no bearer tokens, no API keys.

6. **The validator is pure (no fetch, no I/O, no env reads).** This preserves the existing test-friendliness — the validator can be exercised with synthetic inputs in unit tests without any harness setup beyond registry registration.

---

## 4. Implementer's reported deviation — assessment

**Implementer noted:** docstring-only edit in `mcp-server/lib/familyAKeys.ts` (validator function name update in JSDoc comment).

**Diff confirmed:** `git diff main..HEAD -- mcp-server/lib/familyAKeys.ts` shows exactly 2 lines changed inside a JSDoc comment block (lines 41-42 of the file). The 16-key array and `FAMILY_A_CLASSIFIER_SET_VERSION` constant are untouched.

**Reviewer assessment: PASS — within scope.**

Rationale: HALT #13 fires on "changes to Family A's 16 raw keys or `classifierSetVersion`" — these are data mutations. A JSDoc comment update that references the renamed validator function is not a data mutation; it is documentation hygiene that mirrors the rename. The alternative (leaving a stale JSDoc reference to a now-deleted `validateFamilyABooleanRequest` function) would create reader confusion and would itself eventually require a follow-up docs PR. The implementer made the right call by updating the JSDoc in-place during the rename.

The data-layer rule (HALT #13) is preserved; the documentation hygiene is a courtesy. No verdict tokens introduced; no behavior change.

---

## 5. Implementer's noted stale reference left untouched — assessment

**Implementer noted:** `mcp-server/lib/familyAPrompt.ts:75` mentions the old validator file name (`familyABooleanRequestSchema.ts`) in a JSDoc comment, and was left untouched because `familyAPrompt.ts` is on the HALT #4 read-only list (design §8).

**Diff confirmed:** `familyAPrompt.ts:75` reads "Mirror of the wire shape per MCP-021A; see familyABooleanRequestSchema.ts." This file does not appear in the diff (`git diff main..HEAD -- mcp-server/lib/familyAPrompt.ts` is empty).

**Reviewer assessment: PASS — acceptable to defer.**

Rationale: The design explicitly read-only-lists `familyAPrompt.ts` (§8, "HALT #4 if touched beyond import-statement updates [none needed]"). The implementer correctly refused to touch this file even for a one-line JSDoc fix, because the design says no. This is the right discipline — implementers must not exercise judgment to widen the scope mid-card.

**Recommended follow-up (non-blocking):** A trivial docs-hygiene card (`docs: update stale validator file reference in familyAPrompt.ts`) can clean this up in 30 seconds when an operator is next touching `familyAPrompt.ts` for substantive reasons (e.g., MCP-SERVER-003-FAMILY-B will likely need to refactor `ValidatedFamilyARequest` into a discriminated union, at which point this JSDoc fix is a free rider). No standalone hygiene card needed — let it ride.

---

## 6. Recommendations

**Action: APPROVE this PR and push.**

Specific next-step actions for the operator:

1. **Push the branch.** `git push -u origin feat/OPS-MCP-FAMILY-VALIDATOR-REFACTOR`.
2. **Open the PR** against `main`, body per the suggestion in §7 below.
3. **Merge via squash** (standard repo convention) and let the Supabase GitHub integration handle Deno Deploy redeployment automatically (per memory `supabase-merge-autodeploy.md`).
4. **Execute the 5-phase smoke** per intent brief §8 (audit doc at `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md`). The smoke is the operator's verification step; the validator's byte-equal preservation makes a PASS expected, but a Phase 3 (Edge Function `admin_validation` regression) check is the unique cross-system signal that confirms the JSON-RPC contract still holds end-to-end.
5. **After smoke PASS, authorize MCP-SERVER-003-FAMILY-B.** The handoff in `current-status.md` is already framed for this.
6. **Post-merge worktree cleanup** per the reviewer charter's "Post-merge worktree cleanup (operator step)" section. The worktree at this card's path was created with `isolation="worktree"`, so `git worktree remove -f -f <path>` is required (double-force).

No code changes requested. No design changes requested. No follow-up card required beyond the post-merge smoke.

---

## 7. PR-body suggestion

```markdown
## OPS-MCP-FAMILY-VALIDATOR-REFACTOR: Stage 0 prerequisite for MCP-SERVER-003-BATCH-B-C-D-E

**Card:** OPS-MCP-FAMILY-VALIDATOR-REFACTOR
**Issue:** #314
**Predecessor on main:** e281753 (AUTO-TRIGGER-FAMILY-A-SMOKE PASS)
**Design:** docs/designs/OPS-MCP-FAMILY-VALIDATOR-REFACTOR.md
**Review:** docs/reviews/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-review-2026-05-27.md (APPROVE)

## Summary

Server-side internal refactor of the MCP server's boolean-observation request validator. Renames `familyABooleanRequestSchema.ts` → `familyBooleanRequestSchema.ts`, introduces `FamilyValidatorRegistry` (Map-backed, frozen-snapshot semantics, 6 public functions), and adds `familyRegistryInit.ts` so future families (B, C, D, E, F, G, H, I, J) register additively via one-line additions rather than per-family validator files.

Family A behavior preserved byte-equal: every literal error string from the 11 validation rules, every error-envelope shape, every tool-handler boundary message, and every `tools/list` advertisement remain identical.

## Scope discipline

- ALLOWED: registry + init module + validator rename + parity-test re-route.
- DISALLOWED (all enforced): no Family B/C/D/E registration (init registers only `'parent_relation'`); no schema-version change; no Edge Function touches; no UI touches; no migration; no `familyAKeys.ts` data mutation (only a 2-line JSDoc update for the rename); `familyAPrompt.ts` untouched.

## Test delta

+36 Deno tests (200 → 236 passing in `mcp-server/tests/`), matches design §7.3 forecast exactly:
- `familyRegistry.test.ts` (NEW): 14 tests
- `familyRegistryInit.test.ts` (NEW): 5 tests
- `familyBooleanRequestSchema.test.ts` (NEW): 17 tests — byte-equal envelope assertions for every failure path
- `familyAKeysParity.test.ts` (UPDATED in place): re-routed through registry; `length === 16` invariant preserved
- `familyAFixtureParity.test.ts` (UPDATED in place): 3 call-site function-name updates

## Verification (independent reviewer run)

- `deno test --allow-net --allow-env --allow-read`: **236 passed / 0 failed (1s)**
- `npm run typecheck`: EXIT 0
- `npm run lint`: EXIT 0
- Secret scan: clean (zero hits)
- Doctrine scan: clean (5 NEGATION-form anchors in JSDoc only; never in returned strings)

## Post-merge smoke

Operator runs the 5-phase smoke per intent brief §8; audit doc target `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md`. On PASS, MCP-SERVER-003-FAMILY-B is authorized.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## 8. Operator next steps (concise)

- Push the branch: `git push -u origin feat/OPS-MCP-FAMILY-VALIDATOR-REFACTOR`
- Open PR: `gh pr create --title "OPS-MCP-FAMILY-VALIDATOR-REFACTOR: Stage 0 prerequisite (validator → registry; Family A byte-equal)" --body-file docs/reviews/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-review-2026-05-27.md` (or use the §7 body)
- After merge: execute 5-phase post-merge smoke per intent brief §8; write `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md`
- After smoke PASS: authorize MCP-SERVER-003-FAMILY-B
- Worktree cleanup per the reviewer charter's "Post-merge worktree cleanup" section (double-force `git worktree remove -f -f`)
