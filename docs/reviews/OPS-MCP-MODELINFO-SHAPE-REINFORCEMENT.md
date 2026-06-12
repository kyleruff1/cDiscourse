# OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-11
**Branch:** feat/modelinfo-shape-reinforcement (commit d4b5322, vs main 868e708)
**Design:** docs/designs/OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT.md

## Summary
Prompt-only, Deno-deploy-bearing hardening. A single shared exported constant
`MODEL_INFO_EMISSION_DIRECTIVE` (a RESPONSE-ENVELOPE RULE) is interpolated
verbatim into all ten `family*Prompt.ts` user prompts immediately before the
`The object MUST conform to this shape:` anchor (in J, after the existing FINAL
CHECK block), instructing the model to always emit the literal `modelInfo`
envelope even on hostile/uncertain input. This targets the live dead-letter
class — deterministic `validation_failed` at bare `path:'modelInfo'`
(the validator's `must be plain object`, reproduced as run `3ff1ba04`). The
diff is genuinely additive: one import + one interpolation per family, plus
jsdoc leg-list comment accuracy edits; the response-shape JSON examples are
byte-unchanged. The validator gate is never touched — `mcpBooleanObservation
SchemaMirror.ts` is byte-identical to main; fail-closed remains the guard and
the prompt only reduces how often it fires. The audit amendment honestly
re-types the Phase-5 mechanism and names the prior inference as wrong, with the
PASS verdict and fail-closed conclusion explicitly unchanged. All gates rerun
green. No concerns remain.

## Verification
- typecheck: **pass** (`npm run typecheck` exit 0; tsconfig excludes mcp-server)
- Deno test: **pass** — `cd mcp-server && deno task test` → **1700 passed / 0 failed**, exit 0 (1674 → 1700, +26 = 20 per-family + 6 shared; matches design)
- Deno lint: **pass** — scoped lint of all 22 touched files, exit 0 (the lone "exports field should be specified" line is a pre-existing harmless deno.json metadata warning, not a lint error)
- jest: **pass** — `npx jest --maxWorkers=4` → **715 suites / 29620 passed, 1 skipped (29621 total)**, exit 0 — UNCHANGED vs baseline (no `src/` or root `__tests__/` change)
- audit-lint: **pass** — `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md` → **0 findings (PASS)**, exit 0
- secret scan: **clean** (no ANTHROPIC/XAI/X_BEARER/SERVICE_ROLE/sk-ant/sb_secret/JWT/Bearer/Authorization hits)
- doctrine scan: **clean in substance** — the `\b(true|false|correct)\b` grep hits are all (a) the unchanged classifier boolean-answer instruction ("Answer ... with true or false"), (b) the "false-positive guards" ML term in leg-list comments, (c) the validator's "must be plain object" detail string, and (d) the directive's "answering observations false" (the boolean answer mechanism). None label a person/claim. The authoritative `DOCTRINE_BAN_PATTERNS` scan over the directive passes (dedicated Deno test, green).
- console.log / .only / .skip / xit / xdescribe: **clean**

## Design conformance
- [x] All design file-changes are present — exactly 25 files: new `modelInfoEmissionDirective.ts`, ten `family*Prompt.ts`, new + ten prompt test files, the probe audit amendment, the design doc, current-status. No more, no fewer.
- [x] No undocumented file-changes — protected set byte-unchanged (verified empty diff): `mcpBooleanObservationSchemaMirror.ts`, `family*BanListScan.ts`, `keyLevelFailClosed.ts`, `doctrineBanList.ts`, dispatcher, `mcp-server/main.ts`, `supabase/**`, `src/**`, `app/**`, `package.json`, `supabase/migrations/**`.
- [x] Data model matches design — no schema/wire change; one new exported string constant only.
- [x] API contracts match design — directive text is **byte-for-byte** identical to the design's §"API / interface contracts" block; export contract `export const MODEL_INFO_EMISSION_DIRECTIVE: string` as specified.

### Item-by-item (card checklist)
1. **Boundary:** PASS — `git diff --name-only` is exactly the 25 expected files; zero diff in every named protected file.
2. **Additive-only prompt diffs:** PASS — each of A–I is one import + one interpolation (`${MODEL_INFO_EMISSION_DIRECTIVE}` with a blank line either side) + one jsdoc leg-list comment accuracy edit. Response-shape JSON examples byte-unchanged (grep for `responseShape`/`"provider":`/`"serverName":`/`"classifierSetVersion":` returns zero hits in the prompt diffs). No existing instruction text weakened. For J: directive sits AFTER its FINAL CHECK block and BEFORE the anchor; the leg-comment correctly drops the stale "LAST instruction the model reads" claim (the directive is now last) and re-describes FINAL CHECK as the "doctrine-scan lead-in" with the directive "between this block and the JSON example" — accurate.
3. **Directive content:** PASS — matches the design byte-for-byte; shape-only (no ban-list/slur/person/intent term); single shared constant identical in all ten by construction (one import) and confirmed by interpolated output (each per-family test asserts `prompt.split(MODEL_INFO_EMISSION_DIRECTIVE).length === 2`). Rationale comment for the word-boundary `ban` check exists (lines 52–55).
4. **Tests:** PASS — per-family ×10 ×2 (presence-immediately-before-anchor via `between.trim() === ''`; example-unchanged with correct `family-x-v1` literal + appears-exactly-once); shared-constant suite of 6; J adds the `finalCheckIndex < directiveIndex < anchorIndex` ordering assertion. Assertions are real position checks, not mere presence.
5. **Audit amendment honesty:** PASS — re-types the mechanism (structural omission/malformation, single producer) without softening anything; verdict PASS + fail-closed conclusion explicitly stand; cites the single-producer source line (`mcpBooleanObservationSchemaMirror.ts:279-281`) and run `3ff1ba04`; names the prior inference as **wrong** ("there is no free text in `modelInfo`"). audit-lint rerun = 0 findings.
6. **Gates rerun (authoritative):** PASS — see Verification (1700/0 Deno; 715/29620+1 jest unchanged; typecheck 0; scoped lint 0). `deno check main.ts` correctly NOT run (pre-existing red herring).
7. **Doctrine:** PASS — §1 no verdict tokens in directive or any new string; §4 no authority change (envelope discipline, not verdicts); validator byte-unchanged (confirmed empty diff on `mcpBooleanObservationSchemaMirror.ts`).
8. **Secrets/safety:** PASS — clean secret scan, no console.log, no `.only`/`.skip`.

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings — directive + all new strings are model-facing prompt text; `DOCTRINE_BAN_PATTERNS` scan over the directive is green.
- [x] Score never blocks posting — N/A; no scoring surface touched.
- [x] No service-role in client code — none added; protected paths byte-unchanged.
- [x] No direct insert into public.arguments — none.
- [x] No AI calls in production app paths — `src/` and `app/` untouched; the directive lives in the existing server-side Deno classifier (`mcp-server/`).
- [x] Plain language only — no user-facing string changed; prompt text is model-facing, so no `gameCopy.toPlainLanguage` mapping is implicated.
- [x] Epic-specific (cdiscourse-doctrine §1/§4/§7 + MCP semantic-referee track): the directive constrains only the `modelInfo` envelope (`provider`/`serverName`/`classifierSetVersion`), never `observations`/`confidence`/`evidenceSpan`; adds no capability; runs server-side only. The **validator gate is never relaxed** — `mcpBooleanObservationSchemaMirror.ts` confirmed byte-identical to main.

## Test coverage
- [x] New public symbol has tests — `MODEL_INFO_EMISSION_DIRECTIVE` has a dedicated 6-case Deno suite (load-bearing fragments, zero `DOCTRINE_BAN_PATTERNS`, shape-not-content, no weakening qualifier, family-agnostic / no per-family literal, BINDING-block shape).
- [x] Model-facing strings have ban-list assertion — required doctrine ban-scan present and green.
- [x] Edge cases from design § "Edge cases" have tests — J ordering (`finalCheck < directive < anchor`), directive immediately-before-anchor for all ten, example-unchanged + appears-exactly-once for all ten.
- [x] Accessibility assertions — N/A (no UI card).

## Blockers
None.

## Suggestions (non-blocking)
1. The per-family "immediately before" assertion uses `between.trim() === ''`, which tolerates the inserted blank line — correct and intentional. No change needed; noting only that this is what makes "immediately before" a whitespace-tolerant check rather than an offset-exact one.

## Assessment of the two flagged deviations
1. **Word-boundary `ban` check (shape-not-content test).** SOUND and an improvement. The design's test-plan text listed a bare `'ban'` substring among the forbidden substrings; a literal `includes('ban')` would false-positive on the directive's legitimate "confidence bands". The implementer used `/(^|[^a-z])ban([^a-z]|$)/i` (standalone-word) plus a separate `/ban[\s-]?list/i` check, with an explicit rationale comment. Verified: in "confidence bands", the `d` after `ban` defeats the trailing `([^a-z]|$)` boundary, so no false positive — while a real standalone "ban" would still be caught. This honors the design's intent (prove no content/non-echo language) more correctly than the literal text would have.
2. **Leg-list comment edits (incl. J's).** SOUND. Comment-only jsdoc accuracy edits in each prompt's "Prompt structure" list, changing "Response-shape instruction" → "Shared modelInfo emission directive, then the response-shape instruction" to reflect the new ordering. J's edit additionally removes the now-false claim that FINAL CHECK is "the LAST instruction the model reads before producing the JSON" (the directive is now last) and re-frames FINAL CHECK as the "doctrine-scan lead-in" with the directive "between this block and the JSON example." Accurate to the actual insertion. No production logic changed.

## Operator next steps
- Push the branch: `git push -u origin feat/modelinfo-shape-reinforcement`
- Open PR: `gh pr create --title "OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT: response-envelope emission directive in all ten family prompts [prompt-only / DENO-DEPLOY-BEARING]" --body-file docs/reviews/OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT.md`
- Deploy (Deno-deploy-bearing on merge): merge auto-builds `cdiscourse-mcp-server` on Deno Deploy (GitHub integration `deploy/civildiscourse/cdiscourse-mcp-server`). NO `db push`, NO `functions deploy`, NO env/routing change. Confirm the redeploy went green / new build id on the hosted `*.deno.net`.
- Verify (single-cell hosted re-run): re-run the exact failing cell via Edge `admin_validation` — argument `2c6d9ca1` × family B `disagreement_axis`, **1 classification** (paced one-arg path, NOT a burst). Expect success (no `validation_failed` at `path:'modelInfo'`). If it still fails, record honestly — prompt reinforcement is probabilistic, fail-closed stays correct, and the next escalation (model-side structured-output enforcement) is a separate future card. Do not relax the validator.
- Post-merge worktree cleanup (operator step) per roadmap-reviewer.md § "Post-merge worktree cleanup".
