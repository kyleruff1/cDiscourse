# OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — A–J prompt-side `modelInfo` emission-shape reinforcement

**Status:** Implemented — 2026-06-11. Shared `MODEL_INFO_EMISSION_DIRECTIVE` added to all ten `family*Prompt.ts` user prompts (one import + one interpolation each, immediately before the response-shape anchor; J after its FINAL CHECK), plus the audit amendment. **Actual test delta: mcp-server Deno 1674 → 1700 / 0 (+26 = 20 per-family + 6 shared — matches the ~26 estimate.)** `deno lint` clean (22 files); scoped `deno check` on all touched files clean; root `npm run typecheck` exit 0 (tsconfig excludes `mcp-server`); full `npx jest` 715 suites / 29620 passed + 1 skip — UNCHANGED. `audit-lint` 0 findings. Prompt-only / DENO-DEPLOY-BEARING. (Estimates below retained.)
**Epic:** Epic 12 / MCP semantic-referee track (mcp-server, Deno Deploy)
**Release:** Ongoing MCP hardening / OPS lane (prompt-only, Deno-deploy-bearing on merge)
**Issue:** Not yet filed — orchestrator-authored follow-up named in `docs/audits/OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md` Phase 5 + Disposition (c) ("A–I `modelInfo` prompt-side reinforcement"). Re-scoped here from "non-echo" to "emission-shape" per the corrected mechanism below.

---

## Goal (one paragraph)

The 2026-06-11 live A–I adversarial probe recorded one dead-letter: family B's `disagreement_axis` classification on the motive-bait input (`2c6d9ca1`) failed `mcp_api_error` ×4 (retry-immune) with `validator_path: 'modelInfo'`, persisting nothing. The probe's Phase-5 sentence inferred this was a ban-listed characterization picked up in `modelInfo` free-text. **Source verification + a fresh reproduction (Edge admin_validation run `3ff1ba04`, the 5th consecutive deterministic failure on this stored input) correct that inference:** `modelInfo` is NOT free text — it is the fixed envelope `{ provider: 'mcp', serverName: string, classifierSetVersion: string }`, and the bare path `'modelInfo'` (no subfield) has exactly ONE producer: the structural validator return `{ ok:false, path:'modelInfo', detail:'must be plain object' }` at `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:279-281`. The true mechanism is that under this hostile input the family-B model output **omits `modelInfo` entirely or emits it as a non-object**, deterministically; packet-level fail-closed correctly refuses (nothing dirty persists), at the cost of one lost classification for that family on that input. This card applies the J FINAL-CHECK / STRICT-shape precedent to the **response envelope**: add one shared, identically-worded, additive prompt block to all ten family prompts (A–J, for uniformity) that instructs the model to always emit the literal `modelInfo` object exactly as the response-shape example shows, even on hostile / incoherent / long / fully-uncertain input — pushing uncertainty into `confidence` / false observations, never into altering or dropping the envelope. **The validator gate is never relaxed; fail-closed stays the guard. The prompt only reduces how often the guard must fire.** This is a doctrine-neutral shape change: it touches no truth/heat/popularity surface (cdiscourse-doctrine §1–§3), adds no AI capability, runs only server-side in the Deno classifier (§4, §7), and changes no user-facing string (§9).

---

## Data model

**No new data model. No schema change. No wire-shape change.** The `modelInfo` schema, validator, and ban-list scans are all untouched.

One new exported **string constant** (prompt text, not data):

```ts
// mcp-server/lib/modelInfoEmissionDirective.ts
/** Shared, family-agnostic response-envelope reinforcement block. Inserted
 *  verbatim into every family*Prompt.ts user prompt immediately before the
 *  response-shape JSON example. Prompt text only — the validator gate is
 *  never relaxed. Contains no doctrine ban-list tokens (shape, not content). */
export const MODEL_INFO_EMISSION_DIRECTIVE: string = `...`; // exact text in §"API / interface contracts"
```

The directive references the response-shape example rather than embedding any per-family literal (e.g. `family-b-v1`), so a single shared constant is correct for all ten families — see the shared-constant decision in §"File changes".

---

## File changes

### New files
- `mcp-server/lib/modelInfoEmissionDirective.ts` — exports the single shared `MODEL_INFO_EMISSION_DIRECTIVE` constant (Deno/TS, header + frozen string). **~18-22 lines.**
- `mcp-server/tests/modelInfoEmissionDirective.test.ts` — shared-constant content + doctrine ban-scan + shape-not-content tests. **~5-6 `Deno.test` cases, ~90-120 lines.**

### Modified files (production-prompt side — all `mcp-server/lib`, Deno-deploy-bearing)
- `mcp-server/lib/familyAPrompt.ts` … `familyJPrompt.ts` (**all ten**) — each gains:
  1. one import: `import { MODEL_INFO_EMISSION_DIRECTIVE } from './modelInfoEmissionDirective.ts';`
  2. one interpolation in the return template, **immediately before** the literal anchor `The object MUST conform to this shape:\n${responseShape}` (inserting `${MODEL_INFO_EMISSION_DIRECTIVE}` + a blank line).
  - **Net diff ~3-4 lines each** (1 import, 1 blank, 1 interpolation line, possibly 1 jsdoc note). The system prompts, the per-key questions/definitions blocks, and the `responseShape` template (including each `classifierSetVersion: "family-X-v1"`) are **unchanged**.
  - In **family J only**, the insertion lands after the existing `FINAL CHECK (BINDING)` block and before the response-shape anchor — both BINDING rules then sit adjacent to the JSON example (FINAL CHECK = span content; this directive = envelope shape). No existing J text is removed or reworded.

### Modified files (tests)
- `mcp-server/tests/familyAPrompt.test.ts` … `familyJPrompt.test.ts` (**all ten**) — each gains **2 `Deno.test` cases** (see test plan). **~25-35 added lines each.**

### Modified files (docs — same PR)
- `docs/audits/OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md` — append one `## Amendment (...)` section (verdict + fail-closed conclusion unchanged; Phase-5 mechanism re-typed). **~10-14 lines.** Exact text in §"Operator steps / amendment text".
- `docs/designs/OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT.md` — this design doc.

### Deleted files
- None.

### Explicitly NOT touched
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` (validator) — no change.
- `mcp-server/lib/family*BanListScan.ts` (ban scans) — no change.
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts` and any `src/` / `app/` file — no change.
- `supabase/functions/**` (Edge) — no change.
- `mcp-server/lib/seedPrompt.ts`, `supabase/functions/_shared/semanticReferee/*` — no change (the parity test in `mcp-server/tests/seedPromptParity.test.ts` only pins the **system-prompt absolute rules**, which we do not touch — see §Risks).

### Shared-constant vs per-file decision — DECIDED: shared constant
- **Decision:** ONE shared exported constant in a new small lib file (`modelInfoEmissionDirective.ts`), imported by all ten prompt builders.
- **Why (not duplicated literals):** the directive carries **zero per-family variation** — it instructs "emit `modelInfo` exactly as shown in the example" and "leave `classifierSetVersion` as the family constant already shown", so it never embeds `family-b-v1` etc. The existing duplicated text in the codebase (the 7 absolute rules in each `FAMILY_X_SYSTEM_PROMPT`) is duplicated **only because** each system prompt appends per-family framing after the shared rules — it cannot be a pure shared constant. This directive has no such per-family tail, so a shared constant guarantees identical wording **by construction** (the prompt's "ONE shared, identically-worded block" requirement), eliminates drift risk, and makes each family diff a clean 1-import + 1-interpolation additive change. There is no pre-existing shared prompt-fragment module to extend (confirmed: `mcp-server/lib/*Prompt*.ts` are `seedPrompt.ts` + the ten `family*Prompt.ts`; the absolute rules are duplicated literals, not a shared export).

---

## API / interface contracts

### Exact directive block text (the deliverable)

```
RESPONSE-ENVELOPE RULE (BINDING): always emit the modelInfo object exactly as shown in the response-shape example below — provider set to "mcp", a non-empty serverName, and classifierSetVersion left as the family constant already shown in the example. Include this modelInfo object on EVERY response, even when the move text is hostile, incoherent, empty, or very long, and even when you are uncertain about every observation. Uncertainty belongs in the confidence bands and in answering observations false — it NEVER changes, omits, renames, or moves any field of the response envelope. modelInfo is always a JSON object, never a string and never null. A response whose modelInfo is missing or is not a plain object is rejected whole, so the move loses its classification for this family.
```

Properties of this text (each is a test assertion):
- **Additive only** — does not contradict or weaken any existing instruction; contains no "optional", "may omit", "if convenient" language.
- **Shape, not content** — mentions no ban list, no slur, no person/intent term, no doctrine token. ("rejected whole" describes the structural validator's whole-packet refusal, not a content scan.)
- **Plain declarative**, mirrors the J `FINAL CHECK (BINDING)` register and the "rejected whole" phrasing.
- **No per-family literal** — references "the family constant already shown in the example", so identical across A–J.

### Export contract

```ts
// mcp-server/lib/modelInfoEmissionDirective.ts
export const MODEL_INFO_EMISSION_DIRECTIVE: string;
```

### Insertion contract (identical for all ten builders)

Each `buildFamily*UserPrompt` return template changes from:

```
...Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

The object MUST conform to this shape:
${responseShape}
...
```

to:

```
...Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

${MODEL_INFO_EMISSION_DIRECTIVE}

The object MUST conform to this shape:
${responseShape}
...
```

The anchor `The object MUST conform to this shape:\n${responseShape}` is byte-identical across all ten files (verified: `familyAPrompt.ts:180`, `familyBPrompt.ts:211`, `familyCPrompt.ts:226`, `familyDPrompt.ts:261`, `familyEPrompt.ts:228`, `familyFPrompt.ts:278`, `familyGPrompt.ts:252`, `familyHPrompt.ts:266`, `familyIPrompt.ts:264`, `familyJPrompt.ts:330`), each preceded by a blank line after the "Return ONLY a single JSON object" instruction — so the insertion is uniform and clean. The directive is **static template text outside the per-key loop**, so it appears for every request regardless of `requestedRawKeys` (subset, empty, or full).

---

## Edge cases

- **Subset / empty `requestedRawKeys`** — the directive is static template text, not inside the `requestedEntries.map(...)` loop, so it appears unconditionally. A test asserts presence on both a full (`[]`) and subset request.
- **Family J ordering** — J already has `FINAL CHECK (BINDING)` immediately before the response shape. The new directive is inserted between FINAL CHECK and the anchor, so FINAL CHECK still precedes the JSON example and the new directive becomes the last instruction before it. Tests assert: FINAL CHECK index < directive index < response-shape index, and the questions block is still exactly 5 lines, and the SPAN-SELECTION RULE block still follows (unchanged).
- **Very long / hostile / empty move text** — the directive sits before the response-shape example, which itself precedes the appended input body, identical to the established structure; long bodies do not displace it from "immediately before the example".
- **Model fills `serverName` as empty / `classifierSetVersion` drifts** — out of this card's reach: those produce subfield-path failures (`modelInfo.serverName` / `modelInfo.classifierSetVersion`), not the bare `modelInfo` structural failure this card targets. The directive's "non-empty serverName" / "leave classifierSetVersion as the family constant" clauses incidentally reduce those too, but the success criterion is the bare-`modelInfo` cell.
- **Prompt reinforcement is probabilistic** — if the hosted re-run still fails, fail-closed remains correct and nothing dirty persists; the design records that honestly and names the next escalation (out of scope here).
- **Doctrine-constraint edge case** — "could this directive let the model emit a truth/verdict label to satisfy the envelope?" No: it constrains the `modelInfo` envelope only (provider/serverName/classifierSetVersion), never `observations`/`confidence`/`evidenceSpan` content; the doctrine ban-list scan (unchanged) still runs over the response, and a test scans the directive text itself for ban tokens.

---

## Test plan

All tests are **Deno** tests (mcp-server uses `Deno.test` + `std/assert`; jest does not run `mcp-server/`).

### New shared-constant test file — `mcp-server/tests/modelInfoEmissionDirective.test.ts` (~5-6 tests)
- `modelInfoEmissionDirective: contains the load-bearing fragments` — asserts the constant includes `modelInfo`, `exactly as shown`, `EVERY response`, `hostile`, `uncertain`, `confidence`, `NEVER changes, omits, renames, or moves`, `never a string and never null`, `rejected whole`.
- `modelInfoEmissionDirective: carries ZERO doctrine ban-list tokens` — scans the constant against `DOCTRINE_BAN_PATTERNS` (imported from `../lib/doctrineBanList.ts`); expects no match (the doctrine ban-list safety test required by test-discipline).
- `modelInfoEmissionDirective: mentions no ban list / no content scan (shape, not content)` — asserts the constant does NOT contain `ban`, `ban-list`, `slur`, `person-directed`, `troll`, `evidenceSpan` (proves it is envelope-shape text, not content/non-echo text).
- `modelInfoEmissionDirective: is additive — contains no weakening qualifier` — asserts it does NOT contain `optional`, `may omit`, `if convenient`, `when possible`.
- `modelInfoEmissionDirective: references the family constant, embeds no per-family literal` — asserts it does NOT contain `family-a-v1` … `family-j-v1` (so it is genuinely family-agnostic) but DOES contain `classifierSetVersion`.

### Per-family additions — each of `family{A..J}Prompt.test.ts` (+2 tests × 10 = 20 tests)
- `MODELINFO-SHAPE: Family X user prompt carries the modelInfo emission directive immediately before the response-shape example` — builds the prompt (default request); asserts `prompt.includes(MODEL_INFO_EMISSION_DIRECTIVE)` and `directiveIndex > definitionsBlockEnd` and `directiveIndex < prompt.indexOf('The object MUST conform to this shape:')`. (Mirrors the J `ORDER-ROBUSTNESS: ... before the response shape` positioning test at `familyJPrompt.test.ts:641`.) For J, additionally assert `finalCheckIndex < directiveIndex`.
- `MODELINFO-SHAPE: Family X response-shape JSON example is unchanged by the directive` — asserts the prompt still contains `"provider": "mcp"`, `"classifierSetVersion": "family-x-v1"`, and `"serverName": "<server identifier>"` (the directive must not alter the example) and that the directive appears exactly once.

### Doctrine ban-list assertion (card touches model-facing strings)
- Covered by the shared-constant ban-scan test above; the directive changes no user-facing string (prompts are model-facing), so no `gameCopy.toPlainLanguage` mapping is involved.

### Estimated new Deno test count
- ~**26 new Deno tests** (20 per-family + ~6 shared). Deno baseline **1674/0 → ~1700/0**. Jest baseline **715 suites / 29620 (+1 skip) — unchanged** (no `src/` or root `__tests__/` file changes).

---

## Dependencies (cards / docs / files)

- Assumes **#576 key-level fail-closed (J)**, **#577 A–J widening**, **#578 fixture corpus**, and the **OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE** probe are complete — this card is the named Phase-5/Disposition-(c) follow-up; it does not change any of their guards.
- Reads (does not modify) `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:277-305` (the `modelInfo` structural validator — the single producer of bare `path:'modelInfo'`) and `mcp-server/lib/family*BanListScan.ts:46-61` (which report subfield paths only, confirming bare `modelInfo` is not a ban-scan path).
- Reads existing prompt structure from all ten `mcp-server/lib/family*Prompt.ts` (`responseShape` template + the `The object MUST conform to this shape:` anchor) and the test precedent in `mcp-server/tests/familyJPrompt.test.ts` (FINAL CHECK positioning + per-key reminder tests).
- Mirrors the amendment-section shape in `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` §"Amendment (2026-06-11 …)".
- Does not block any other card; it is a standalone hardening follow-up. Future escalation (model-side/structured-output enforcement) is out of scope and not yet a card.

---

## Risks

- **Deno-deploy-bearing on merge.** `mcp-server/` deploys to Deno Deploy (GitHub integration `deploy/civildiscourse/cdiscourse-mcp-server`), NOT a Supabase Edge Function — merge auto-builds and the prompt goes live. This is GATE-C in spirit, but lighter than the boolean-family deploys: **no new rawKey, no manifest/registry change, no Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry** — pure prompt text. Verification is the single-cell hosted re-run (below), not a full family fixture pass.
- **`seedPromptParity.test.ts` proximity.** That test pins the **7 absolute rules** + structured-output keywords of the **system prompt** byte-equal to the upstream Edge `_shared/semanticReferee` files. We touch **user prompts only** (the `buildFamily*UserPrompt` return template), not the system prompts, so the parity test is unaffected. The implementer must NOT add the directive to any `FAMILY_X_SYSTEM_PROMPT`.
- **Prompt reinforcement is probabilistic, not a guarantee.** A temperature-0 model can still, on some adversarial input, drop the envelope; fail-closed remains the correct backstop. The card's success bar is "the previously-failing cell now succeeds", with an honest record if it does not.
- **Deno merge-build can fail transiently** (known: retry fixes; the N/N hosted smoke is authoritative over the lagging commit-status API). `deno check main.ts` has ~23 pre-existing `CommonResponseHeaders` errors the deploy tolerates — not introduced here, do not chase.
- **Existing tests that might need updating:** none expected to break. The per-family prompt tests assert presence/positioning of existing blocks; adding text before the response-shape anchor does not remove or reorder any asserted fragment. The J `ORDER-ROBUSTNESS` test asserting FINAL CHECK sits before `The object MUST conform to this shape:` still holds (the directive goes between them). Implementer should re-run the full `mcp-server` Deno suite to confirm 1674 + ~26 / 0.

---

## Out of scope

- **No validator / schema / ban-scan / wire-shape change.** The `modelInfo` structural check at `mcpBooleanObservationSchemaMirror.ts:279-281` stays exactly as-is. Fail-closed is preserved, not relaxed.
- **No `keyLevelFailClosed` change** — the bare-`modelInfo` failure is a whole-packet structural failure, correctly *outside* the key-level branch (the key-level path is for `evidenceSpan.<key>` doctrine residuals). This card does not extend key-level handling to `modelInfo`.
- **No Edge / Supabase / migration / RLS / service-role change.**
- **Not a non-echo / span-content card.** The corrected mechanism is envelope emission shape, not ban-listed free text (modelInfo has no free text). The cross-family verbatim-quote residual and the unicode/leet evasion follow-ups (named in the probe Disposition) are separate cards.
- **No model-side or structured-output (response_format / tool-forced JSON) enforcement** — that would be the next escalation if the prompt reinforcement proves insufficient; it is explicitly not built here.
- **No production-app change** — `src/` and `app/` are untouched; no AI call is added anywhere (mcp-server is the existing server-side Deno classifier).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (score is gameplay, never truth):** the directive governs only the `modelInfo` envelope (`provider`/`serverName`/`classifierSetVersion`); it never instructs the model to label a person/claim or emit a verdict. A test scans the directive text against `DOCTRINE_BAN_PATTERNS` and expects zero hits.
- **cdiscourse-doctrine §2–§3 (heat / popularity):** not touched — no scoring, ranking, or engagement surface is involved.
- **cdiscourse-doctrine §4 (AI moderator limits):** the classifier still only detects structure; this card adds no capability and runs only server-side (Deno classifier), never on the client. `authoritative` semantics unchanged.
- **cdiscourse-doctrine §5 (engine sacred):** `src/lib/constitution/engine.ts` untouched.
- **cdiscourse-doctrine §7 (no AI calls from the production app):** unchanged — the directive lives in `mcp-server/` (the existing server-side classifier prompts); no new provider call, and `src/`/`app/` are untouched.
- **cdiscourse-doctrine §9 (plain language for users):** no user-facing string changes; prompt text is model-facing, so no `gameCopy.toPlainLanguage` mapping is implicated.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** unchanged — the directive does not alter what is classified or how labels are sourced, only that the response envelope is emitted.
- **Fail-closed invariant:** the validator gate is **never relaxed** in this design; the prompt reduces how often it must fire. Stated explicitly in Goal, File changes, and Out of scope.
- **supabase-edge-contract / test-discipline:** no DB/Edge/RLS/service-role surface; tests (Deno) are part of the deliverable, including the required doctrine ban-list scan.

---

## Operator steps / amendment text

### Operator steps (after the implementer commits & the PR is green + merged)

1. **Merge → Deno Deploy auto-build.** No manual deploy command for the prompt — the `deploy/civildiscourse/cdiscourse-mcp-server` GitHub integration redeploys on merge to `main`. Confirm the redeploy completed (deployment status green / new build id on the hosted `*.deno.net`).
2. **Single-cell hosted re-run (the verification).** Re-run the exact failing cell via Edge `admin_validation`: argument `2c6d9ca1` × family B `disagreement_axis`, **1 classification** (the paced one-arg admin_validation path, not a burst). Expect **success** — `serverReason` no longer `validation_failed` at `path: 'modelInfo'`, packet persists.
3. **If it still fails:** record honestly in the PR / a short audit note — prompt reinforcement is probabilistic, fail-closed remains correct (nothing dirty persisted), and the next escalation would be model-side structured-output enforcement (a separate, future card — NOT this one). Do not relax the validator.
4. **No `.env` / secrets / routing change.** Queue routing posture is unchanged.

### Amendment text to append to `docs/audits/OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md`

Mirrors the established `MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` §Amendment shape (Prior typing / Corrected typing / Mechanism / Verdict impact / Scoped follow-up):

```markdown
---

## Amendment (2026-06-11, post-source-verification) — the Phase-5 dead-letter mechanism RE-TYPED

**Prior typing (Phase 5):** the model's own `modelInfo` *free-text* picked up a ban-listed characterization. **Corrected typing: structural `must be plain object` failure (single producer), not a ban-scan hit** — `modelInfo` is NOT free text. Its schema is `{ provider: 'mcp', serverName: string, classifierSetVersion: string }` (`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:277-305`); doctrine ban-scan hits on `modelInfo` report SUBFIELD paths (`modelInfo.serverName` / `modelInfo.classifierSetVersion`, `family*BanListScan.ts:49-61`). The bare path `'modelInfo'` recorded for this dead-letter has exactly ONE producer: the structural validator return `{ ok:false, path:'modelInfo', detail:'must be plain object' }` (`mcpBooleanObservationSchemaMirror.ts:279-281`).

**Reproduction:** a fresh Edge `admin_validation` re-run today (run `3ff1ba04`) reproduced it — `serverReason: 'validation_failed'`, `path: 'modelInfo'` — the 5th consecutive deterministic failure on this exact stored input (`2c6d9ca1` × `disagreement_axis`, family B). NOT transport, NOT a ban-scan hit.

**Mechanism:** under this adversarial input, family B's model output omits `modelInfo` entirely or emits it as a non-object, deterministically. Packet-level fail-closed correctly refuses (nothing persists); the cost is one lost classification for that family on that input.

**Verdict impact: none.** The PASS verdict and the fail-closed conclusion stand unchanged — the guard worked exactly as designed. The "ban-listed characterization in `modelInfo` free-text" inference was wrong (there is no free text in `modelInfo`).

**Scoped follow-up (its own card — OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT, the J FINAL-CHECK / STRICT-shape precedent):** prompt-side `modelInfo` EMISSION-SHAPE reinforcement for A–J (always emit the literal `modelInfo` envelope, even under hostile/uncertain input) — an `mcp-server` prompt change, Deno-deploy-bearing. The substance is response-envelope **shape**, not non-echo. **The validator gate is never relaxed.**
```
