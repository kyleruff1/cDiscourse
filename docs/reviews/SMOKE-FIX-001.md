# Review — SMOKE-FIX-001

**Verdict:** Approve
**Reviewer:** roadmap-reviewer (agent)
**Branch:** feat/SMOKE-FIX-001-actorrole-and-validation-log
**Design:** docs/designs/SMOKE-FIX-001.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/229

**Commits reviewed:**

- `72fab93` feat(SMOKE-FIX-001): widen schema actorRole enum to include moderator
- `c25f40c` test(SMOKE-FIX-001): source-scan parity test for actorRole enum
- `027815c` feat(SMOKE-FIX-001): sanitized diagnostic log line at anthropic validation_failed returns
- `1f9fa11` test(SMOKE-FIX-001): source-scan test for validation_failed log shape
- `748fef5` docs(SMOKE-FIX-001): record validation_failed log format and actorRole enum widening

## Summary

The implementer landed the two narrow additive fixes the design called for and nothing else. Fix A is a single-character widening of `roomContext.actorRole`'s enum to include `'moderator'`; Fix B1 is two `console.warn(JSON.stringify({...}))` lines inserted at the existing `validation_failed` return sites in `anthropicProvider.ts`, carrying only the five allowed keys (`semanticReferee`, `layer`, `path | detail`, `inputHash`) and never the response body, model text, API key, Authorization header, JWT, room/move/parent id, or any participant id. Both fixes are guarded by source-scan unit tests in the same posture as the existing `semanticAnthropicSourceScan` / `semanticAnthropicContentScanParity` suites. The file footprint is exactly the five files the design enumerated; no scope-violating file is touched.

## Doctrine pass

| Check | Result | Reason |
| --- | --- | --- |
| No service-role in production code | Pass | Production diff contains no `SUPABASE_SERVICE_ROLE_KEY` read; only the `ANTHROPIC_API_KEY` read at line 126 already existed pre-card. |
| No secret literal in any diff (key, Bearer, Authorization value, JWT shape, `sk-ant-*`, `xai-*`, `sb_secret_*`) | Pass | The only mentions of `ANTHROPIC_API_KEY` / `Authorization` / `Bearer` / `sk-ant-` / `xai-` / `sb_secret_` are inside the test's fragment-assembled forbidden-substring list; no contiguous banned literal exists in the test file. The production code never references these tokens. |
| New `console.warn` carries no response body, model text, `reasonCode`, `evidenceSpan`, room id, move id, parent id, or user id | Pass | Keys are strictly `{ semanticReferee, layer, path | detail, inputHash }`. `path` is `schemaResult.error.issues[0]?.path ?? []` (zod schema-field-name array, never user value). `detail` is the category-only string emitted by `contentSafetyScan.ts:228-230` (verified at that file). `inputHash` is the deterministic per-request correlator stamped at lines 92-94 of the same file. |
| No widening of `SemanticRefereePacketSchema` | Pass | Diff against `schema.ts` is a single character widening on the INBOUND `ClassifyMoveRequestSchema`'s `actorRole` enum. `SemanticRefereePacketSchema`, `BinarySampleSchema`, `PACKET_VERSION`, and `ClassifyMoveDisabledReason` are byte-identical. |
| Typed `unavailable` outcome shape unchanged | Pass | Both new log calls are inserted BEFORE the existing `return { kind: 'unavailable', reason: 'validation_failed' }` lines; the return shape is byte-identical. |
| No truth / verdict / winner / loser language | Pass | Doctrine scan against the full diff returns zero hits for `winner|loser|liar|correct|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot`. The only `reasonCode` mention is the explicit doc note that `reasonCode` is NEVER logged. |
| No direct insert into `public.arguments` | Pass | Diff touches neither client code nor any function that writes to `public.arguments`. |
| AI moderator hard limits respected | Pass | The provider already returned `authoritative: false` (hard-pinned at line 101 of `stampPacketIdentity`); the new log lines do not change that. No new client-side AI call. No new authoritative path. |

## Design fidelity

| Check | Result | Reason |
| --- | --- | --- |
| Fix A enum addition (§5.1) | Pass | `schema.ts:71` reads `actorRole: z.enum(['initiator', 'primary_opponent', 'chime_in', 'observer', 'moderator']).optional(),` — exactly as specified. Line numbers and surrounding context unchanged. |
| Fix B1 schema-failure log site (§5.2 first block) | Pass | At line 187-203 of `anthropicProvider.ts`: same five-key structure, `path: schemaResult.error.issues[0]?.path ?? []`, `inputHash: typeof stamped.inputHash === 'string' ? stamped.inputHash : null`. Inserted BEFORE the existing return as the design required. |
| Fix B1 content-scan-failure log site (§5.2 second block) | Pass | At line 205-218 of `anthropicProvider.ts`: same five-key structure with `detail: contentResult.detail` and `inputHash` defended the same way. Inserted BEFORE the existing return. |
| `console.warn` not `console.error` (§10 open question) | Pass | Both calls use `console.warn` as recommended. The two `// eslint-disable-next-line no-console` annotations mirror the precedent set in `admin-users/index.ts` and `_shared/adminAudit.ts` for their `console.error` calls. |
| Parity test (§5.3) — source-scan, superset, no zod/Deno import | Pass | `__tests__/semanticRefereeActorRoleParity.test.ts` reads both files via `fs.readFileSync`, extracts enum + union via regex, asserts SUPERSET (not equality) per design §10 recommendation. Adds two helper tests (moderator presence, side-enum sanity) — non-blocking additive coverage. |
| Log-shape test (§5.4) — source-scan posture, allowed-key-only assertion, fragment-assembled forbidden substrings | Pass | `__tests__/semanticAnthropicValidationLogShape.test.ts` uses a brace-balanced scanner (`extractConsoleWarnJsonStringifyBodies`) instead of naive regex, asserts both warn sites are present, the allowed-key set is closed (`{semanticReferee, layer, path, detail, inputHash}`), no `stamped.*` interpolation except `stamped.inputHash`, no `responseJson` / `rawResponse` / `contentText` / `parsed` / `apiKey` / `requestBody` / `request.roomId` / `request.moveId` / `request.parentId`, no `.message` / `.input` / `.received` / `.expected` issue-value leak, no forbidden substrings (assembled from fragments at runtime), and each warn site is followed within 5 lines by the `validation_failed` return. Coverage exceeds the design's required assertions. |
| `docs/current-status.md` 3-line footnote (§5.5) | Pass | Adds a new SMOKE-FIX-001 section ABOVE the existing MCP-018 section, with the 3 line footnote (log format + test delta + operator follow-up). Does NOT modify CLAUDE.md (correctly — this card does not bump the stage line). |
| Out-of-scope file list (§2) — no untouched-files violated | Pass | File-name-only diff shows exactly 5 files. None of these are touched: `src/features/semanticReferee/triggerGates.ts`, `src/features/semanticReferee/semanticTriggerInput.ts`, `src/features/semanticReferee/useSemanticReferee.ts`, `src/lib/edgeFunctions.ts`, `supabase/functions/_shared/semanticReferee/mcpAdapter.ts`, `supabase/functions/process-language-draft/*`, any migration, any `.env*` file. |

## Test analysis

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass — no output (clean) |
| `npm run lint` | Pass — no output (clean) |
| `npm run test` | Pass — `Test Suites: 330 passed, 330 total. Tests: 9068 passed, 9068 total.` |

Baseline before card (from `main`'s `docs/current-status.md` header): **9056 tests / 328 suites**.
After card: **9068 tests / 330 suites**.
Delta: **+12 tests / +2 suites** — matches the implementer's claim exactly, and matches the design's expected coverage (3 new tests in `actorRoleParity` + 9 new tests in `validationLogShape`).

**Flake note:** the implementer's docs/current-status.md note flagged `diagnosticInspectPackage.test.ts` as a known pre-existing flake (1 red expected). This reviewer's full-suite run shows **all 9068 tests passing including `diagnosticInspectPackage`** — the flake did not fire in this run. The implementer's defensive `9067 passing` count in the status doc is therefore a conservative overstatement, not a defect; the suite is in fact fully green right now. The status doc's framing — calling out the pre-existing flake as an unrelated known-red — is appropriate even when this particular run happens to pass. **Not a finding.**

**Test discipline checks:** no `.skip`, `.only`, `xit`, `xdescribe`, or new `console.log` in either test file. Both new tests follow the source-scan posture mandated by the existing `semanticAnthropicSourceScan.test.ts` precedent (because `anthropicProvider.ts` transitively imports `npm:zod@4` via `schema.ts` and is not Jest-importable). The forbidden-substring list in the log-shape test is assembled from fragments (`'ANTHROPIC' + '_API_KEY'`, etc.) so the test file does not commit a banned contiguous literal — design §5.4 explicitly required this and the implementer honored it.

## Edge Function contract checks

| Check | Result |
| --- | --- |
| Function still returns HTTP 200 on every `unavailable` path | Pass — return shape `{ kind: 'unavailable', reason: 'validation_failed' }` is byte-identical; the caller of `runAnthropicClassifier` is `semantic-referee/index.ts` which wraps every `'unavailable'` outcome into a `{ enabled: false }` HTTP 200 envelope. Log lines do not throw (the `typeof stamped.inputHash === 'string' ? ... : null` guard defends against the inputHash field somehow being missing). |
| `console.warn` chosen over `console.error` | Pass — degraded state with HTTP 200 to the caller is correctly a warning, not an error. Matches the design's §10 recommendation. |
| No new service-role client built; no new `SUPABASE_SERVICE_ROLE_KEY` read | Pass — diff contains zero matches. |
| No migration file added | Pass — `supabase/migrations/` not touched. |
| No `npx supabase` command run by the implementer | Pass — no deploy artifacts; the design correctly defers deploy to the operator (§6). |
| No `.env*` file modified | Pass — diff confirms. |

## Findings

None blocking. Two minor optional notes (non-blocking, not requested):

1. **Optional, not a finding.** The log-shape test's negative assertion against `\.issues\b(?!\[0\]\?\.path)` in line 169 uses a JS lookahead — well-formed and intentional, but a future reader may not realize at first glance that the test ALLOWS the literal `issues[0]?.path` substring (which is exactly how the schema-failure log site reads). The comment above the assertion (line 168) does explain this; no action needed.

2. **Optional, not a finding.** The implementer's `eslint-disable-next-line no-console` comments on the two warn calls are consistent with the precedent in `admin-users/index.ts` and `_shared/adminAudit.ts`. No action needed.

## Operator follow-up after merge

The operator runs, in order:

1. `git push -u origin feat/SMOKE-FIX-001-actorrole-and-validation-log`
2. `gh pr create --title "SMOKE-FIX-001: actorRole schema widening + Anthropic validation_failed diagnostic log" --body-file docs/reviews/SMOKE-FIX-001.md`
3. After merge: `npx supabase functions deploy semantic-referee --linked` — picks up both Fix A (schema enum widening) and Fix B1 (the two warn lines).
4. Re-run the smoke test: `node scripts/bot-fixtures/runMcpSmokeTest.js`. Expected outcome per design §8.3:
   - Move 1's two batches each return `ok: true` (inbound schema accepts `actorRole: 'moderator'`).
   - Move 2 + post-flip probe: EITHER also return `ok: true, enabled: true` (live response now passes both walls) OR continue to return `ok: true, enabled: false, disabledReason: 'validation_failed'` AND the Supabase Studio function logs now contain three `console.warn` entries (one per failing call) with shape `{ semanticReferee: 'validation_failed', layer, path|detail, inputHash }`.
5. If `validation_failed` persists in move 2 + probe, the operator captures the new function-log lines (and the smoke-test JSON) as input for SMOKE-FIX-002. That follow-up card is independently scoped per design §11 and does NOT block closing SMOKE-FIX-001.

No secret change, no migration, no admin runtime-config change required. The runtime config stays `providerMode: 'anthropic', enabled: true`. Smoke-test re-run is the operator's acceptance check — not a CI gate.
