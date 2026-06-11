# MCP-SERVER-011-FAMILY-J — sensitive_composer classifier (admin_validation only)

Audit-type: design
Family: sensitive_composer

**Status:** Design draft — GATE-A. Template E1 of the H/I/J program.
**Epic:** Epic 12 / MCP semantic-referee track (MCP-021A family-ship arc)
**Release:** MCP server family-ship suite — Family J build (E1 build → E2 hosted smoke → E3 operator-gated admin-validation smoke). **No production-enable card in this chain** (see §7 + §10a ceiling).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/473
**Branch (design):** `feat/mcp-server-011-family-j-design`
**Predecessor:** `main` at `8de1b46` (post Family-I production-enable + H/I/J scoping-extension merge). Families A–I production + auto-trigger live; **Family J is the last and only held-out family** (`familyRegistry.ts:114-118`, `productionEnabled:false`). J is currently **unsupported on the MCP server** (`classifyArgumentBooleanObservations.ts:52-56`).
**Doctrine basis (binding input — read first):** `docs/designs/MCP-J-001-FAMILY-J-SCOPING-EXTENSION-intent.md` — its §2 key table, §4 disposition rulings, §8 plain-language wordings, and §10a constraints are binding inputs to this build. `cdiscourse-doctrine` §10a is load-bearing for every prompt/guard sentence.
**Structural precedent (mined):** commit `4b9dabd` (PR #546, MCP-SERVER-010-FAMILY-I Card 1).

> `Audit-type: design` on line 3 marks this artifact as a design intent doc, not a smoke audit, so `audit-lint` does not apply the production-enable / family-ship phase machinery to it (precedent: `docs/designs/MCP-J-001-FAMILY-J-SCOPING-EXTENSION-intent.md:3`, `docs/designs/MCP-I-SCOPE-001.md:3`). It carries no operative semantics.

---

## Goal (one paragraph)

Build the server-side `sensitive_composer` (Family J) boolean-observation classifier on the Deno MCP server, mirroring the Family I Card-1 structure (`4b9dabd`), so the hosted server can classify the **5 existing UX-001.5A sensitive keys** at **admin_validation depth only**. Family J stays held out of production: this card makes **no** change to the Edge `familyRegistry.ts` `sensitive_composer` entry (`productionEnabled:false`), adds **no** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry, and touches **no** `src/`, migration, or RLS surface. The build is gated by `cdiscourse-doctrine` §10a (sensitive Observations are composer-only / inspect-only — never on a target's public node) and §1/§3/§4 — this is the **most sensitive prompt in the system**, so the prompt and ban-list are engineered so the model output never characterizes the author: it detects whether the TEXT exhibits a structural feature, and the §8 display COPY (operator-approved, client-layer) stays out of the server entirely. The deployed capability sits idle behind the admin-gated Edge function until E3's operator-driven admin-validation smoke; nothing auto-triggers J. The hard ceiling (E4) is admin-validation only — a future production flip requires a fresh §10a doctrine review and is explicitly out of scope.

---

## 1. Family J source of truth — the 5 keys (verified file:line)

Read verbatim from `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` (HEAD of this branch; this file is a **READ — never modified by this card**, see §15 / RO-16). All five carry `kind: 'machine_observation'`, `source: 'semantic_referee'`, `family: 'sensitive_composer'`, `confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY`.

| # | rawKey | source | disposition | defaultSurface | familyJ.ts | risk profile |
|---|---|---|---|---|---|---|
| 1 | `shifts_to_person_or_intent` | `semantic_referee` | `composer_only` | `composer` | :34-75 | **HIGHEST — axis-partner** (structural sibling of ad_hominem) |
| 2 | `contains_unplayable_insult_only` | `semantic_referee` | `composer_only` | `composer` | :78-119 | HIGH (verdict-adjacent — "insult"/"troll" drift) |
| 3 | `needs_pre_send_pause` | `semantic_referee` | `composer_only` | `composer` | :122-162 | HIGH (verdict-adjacent — emotional-state-label drift) |
| 4 | `uses_popularity_as_evidence` | `semantic_referee` | `inspect_only` | `inspect` | :165-205 | §3 anti-amplification (popularity ≠ evidence) |
| 5 | `uses_satire_as_evidence` | `semantic_referee` | `inspect_only` | `inspect` | :208-247 | HIGH (verdict-adjacent — truth-verdict "fake" drift) |

Three composer-only + two inspect-only. **Doctrine-risk = HIGH** (higher than I's LOW and at least H's level): four of the five keys are verdict-adjacent and three of them are person/intent-directed. This is the inverse of I (whose verdict-adjacent candidate `repeats_prior_point` was pruned upstream); J has **no pruned key** — the sensitive vocabulary IS the family. The prompt + ban-list treatment therefore mirrors **Family H's strongest profile** (`familyHPrompt.ts:35-53`, `familyHBanListScan.ts`), scaled to person/intent risk, with `shifts_to_person_or_intent` as the axis-partner carrying the maximal guard (the J analog of H's `claim_specificity_low`).

### Source-uniformity (the structural difference from D/G/I)

All 5 J keys are `semantic_referee`-sourced — J is **source-uniform**, like Family H (uniform `ai_classifier`). It is **NOT** a mixed-source family. Consequences, all binding:

- The server keys module carries **NO** `FAMILY_J_EXCLUDED_DETERMINISTIC_RAW_KEYS` list (D/G/I carry one because they are mixed; J and H do not). All 5 keys are classified; there is nothing to exclude.
- The Edge request builder has **NO** subset entry for J (§7). Source-uniform → full passthrough; adding an entry would be the **HALT-13-class defect** flagged in #473 / `MCP-J-001 §3`.

---

## 2. Precedent inventory — what `4b9dabd` (PR #546, Family I) established

Exact mirror map. The implementer reproduces this structure with J substitutions.

**New `mcp-server/lib` modules (5):**
- `familyIKeys.ts` (264 lines) — `FAMILY_I_RAW_KEYS`, `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` (mixed-only — **J omits this**), `FAMILY_I_CLASSIFIER_SET_VERSION = 'family-i-v1'`, `FamilyIPromptEntry` interface, `FAMILY_I_PROMPT_ENTRIES`.
- `familyIPrompt.ts` (288 lines) — `FAMILY_I_SYSTEM_PROMPT` (7 absolute rules byte-equal + family-doctrine block), `FAMILY_I_MAX_TOKENS = 1500`, `FAMILY_I_TEMPERATURE = 0`, `FAMILY_I_MAX_BODY_FIELD_LEN = 8000`, `ValidatedFamilyIRequest`, `buildFamilyIUserPrompt`.
- `familyIAnthropic.ts` (53 lines) — `runAnthropicFamilyIClassifier(request, requestId, fetchImpl?)`.
- `familyIBanListScan.ts` (151 lines) — `FAMILY_I_BAN_PATTERNS` + `scanFamilyIBooleanResponseForBanList`.
- `familyIFixtureProvider.ts` (53 lines) — `loadFixtureFamilyIPacket()`.

**Registration:** `familyRegistryInit.ts:178-200` — import block + one `register('thread_topology', { rawKeys: new Set(FAMILY_I_RAW_KEYS), classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION })` call after the H block (top-of-file side-effect import on line 204). Order grows 8→9; `getSupportedFamilies()` returns the A→I list.

**Dispatcher:** `mcp-server/tools/classifyArgumentBooleanObservations.ts` — 3 imports (`runAnthropicFamilyIClassifier`, `loadFixtureFamilyIPacket`, `scanFamilyIBooleanResponseForBanList`) + `ValidatedFamilyIRequest` added to the `FamilyProviders.anthropic` union (lines 344-353) + a `if (family === 'thread_topology')` branch in `pickFamilyProviders` (lines 430-437) + the tool `description` updated (line 175) + the header note updated (J became "the sole unsupported family").

**Deno test suites added (6 dedicated):** `familyIKeys.test.ts` (16), `familyIKeysParity.test.ts` (17), `familyIPrompt.test.ts` (22), `familyIBanListScan.test.ts` (29), `familyIAnthropic.test.ts` (11), `familyIAdversarialDoctrine.test.ts` (28). Dedicated total = **123**. (Counts re-verified by `Deno.test(` grep this branch.)

**Cross-family retarget (existing Deno tests modified):** `familyRegistryInit.test.ts` (+3, 8→9 order), `familyRegistry.test.ts` (+3, 9-way rejection), `familyBooleanRequestSchema.test.ts` (+7, register guard + retarget unsupported example to J), and `familyB/C/D/EDispatch.test.ts` + `classifyArgumentBooleanObservations.test.ts` (retarget "unsupported family I" → "supported family I returns family-i-v1"; `supportedFamilies` envelope 8→9).

**Jest-side touch (1 new file):** `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyI.test.ts` (77 lines, 8 tests `FI-1`…`FI-8`) — locks the Edge entry shape. Plus `docs/core/current-status.md` (+2 lines). The `H` adversarial-doctrine suite (`familyHAdversarialDoctrine.test.ts`, 38 tests) is the model for J's adversarial suite given J's HIGH risk.

**Smoke:** `scripts/mcp-server-001-smoke.sh` — Checks `24-compat-boolean-family-i` + `25-mcp-tools-call-boolean-family-i` (assert `family-i-v1`; `isError:false` on `/mcp`); tally 23→25. **Current smoke tally = 39 checks** (header lines 4, 68; final tally line 1084).

**Doc:** `docs/designs/MCP-SERVER-010-FAMILY-I.md` (the build design, 634 lines) + `docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-template.md` (the E2/E3 smoke skeleton the operator authors, 330 lines).

---

## 3. Data model

No new persisted data model. No schema, no migration, no new `src/` type, no `NodeLabelSurface` / `NodeLabelDisposition` change (the §8 dispositions are already shipped in `familyJ.ts`).

The only new in-memory data is the **server keys module** `mcp-server/lib/familyJKeys.ts`, which carries the 5-key contract plus J-specific **source + disposition metadata** (richer than I's keys module, which carried only rawKey + prompt entry). The metadata is parity-tested against upstream `familyJ.ts`:

```ts
// mcp-server/lib/familyJKeys.ts
export const FAMILY_J_RAW_KEYS: readonly string[] = Object.freeze([
  'shifts_to_person_or_intent',
  'contains_unplayable_insult_only',
  'needs_pre_send_pause',
  'uses_popularity_as_evidence',
  'uses_satire_as_evidence',
]);

// J is SOURCE-UNIFORM (semantic_referee). NO excluded-deterministic list (unlike D/G/I).
export const FAMILY_J_CLASSIFIER_SET_VERSION = 'family-j-v1' as const;

export interface FamilyJPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly source: 'semantic_referee';                       // J-specific metadata
  readonly disposition: 'composer_only' | 'inspect_only';    // J-specific metadata
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_J_PROMPT_ENTRIES: readonly FamilyJPromptEntry[] = Object.freeze([ /* 5 entries */ ]);
```

The `source` and `disposition` fields are documentation/parity anchors only — the server does **not** route by disposition (that is the client presentation layer's job: `nodeLabelPresentationModel.ts:158-183`). The server only classifies whether the text exhibits each feature. Carrying the metadata lets `familyJKeysParity.test.ts` pin the 3-composer-only / 2-inspect-only split + the uniform `semantic_referee` source against upstream `familyJ.ts`, so a future drift fails the build.

`classifierSetVersion` is **`family-j-v1`** (the `family-<letter>-v<n>` pattern; mirrors `family-i-v1`). It is emitted in `modelInfo.classifierSetVersion` and asserted by smoke Checks 40+41.

---

## 4. File changes

### New files — `mcp-server/lib` (5, Deno/TS)

- `mcp-server/lib/familyJKeys.ts` — **~190–230 lines.** `FAMILY_J_RAW_KEYS` (5, frozen, declaration order matching upstream `familyJ.ts`), `FAMILY_J_CLASSIFIER_SET_VERSION = 'family-j-v1'`, `FamilyJPromptEntry` interface (with `source` + `disposition`), `FAMILY_J_PROMPT_ENTRIES` (5 verbose entries, per-key `falsePositiveGuards`; the 4 verdict-adjacent keys carry the strongest guards, `shifts_to_person_or_intent` the maximal). **NO excluded-deterministic list** (source-uniform). Header documents the uniform-`semantic_referee` rationale (mirror H's uniform header, not D/G/I's mixed header).
- `mcp-server/lib/familyJPrompt.ts` — **~240–280 lines.** `FAMILY_J_SYSTEM_PROMPT` (7 absolute rules byte-equal to A–I + the §10a sensitive-composer doctrine block — see §5), `FAMILY_J_MAX_TOKENS = 1500`, `FAMILY_J_TEMPERATURE = 0`, `FAMILY_J_MAX_BODY_FIELD_LEN = 8000`, `ValidatedFamilyJRequest`, `buildFamilyJUserPrompt(request)`. Mirrors `familyHPrompt.ts`.
- `mcp-server/lib/familyJAnthropic.ts` — **~53 lines.** `runAnthropicFamilyJClassifier(request, requestId, fetchImpl?)`. Structural mirror of `familyHAnthropic.ts` / `familyIAnthropic.ts`.
- `mcp-server/lib/familyJBanListScan.ts` — **~150–170 lines.** `FAMILY_J_BAN_PATTERNS` (J-specific person-directed tokens — see §6) + `scanFamilyJBooleanResponseForBanList(response)`. Mirrors `familyHBanListScan.ts`; J's list is the largest family-local list (person-verdict surface is the biggest).
- `mcp-server/lib/familyJFixtureProvider.ts` — **~53 lines.** `loadFixtureFamilyJPacket()`. Mirrors `familyIFixtureProvider.ts`.

### New fixtures — `mcp-server/fixtures` (~10 JSON)

- `…family-j-canonical-response.json` — clean 5-key doctrine-clean response; loaded by smoke Checks 40+41.
- `…family-j-person-shift-request.json` — canonical `shifts_to_person_or_intent` positive (move addresses motive: "you only believe that because you work for an EV company").
- `…family-j-person-shift-adversarial-request.json` — **the EXISTENTIAL**: input move text contains person-slur framing ("troll", "you're toxic"); the expected/clean output evidence_span MUST anchor the structural person-shift WITHOUT echoing the slur (a FAIL here is HALT + revert; J analog of H's Fixture E).
- `…family-j-insult-only-request.json` — `contains_unplayable_insult_only` positive (no playable claim).
- `…family-j-pause-request.json` — `needs_pre_send_pause` positive (reactive/escalatory structural features).
- `…family-j-popularity-request.json` — `uses_popularity_as_evidence` positive (§3 anti-amplification).
- `…family-j-satire-request.json` — `uses_satire_as_evidence` positive (satire cited as factual support).
- `…family-j-no-sensitive-request.json` — all-negative baseline (substantive claim, sharp tone, no sensitive feature → zero positives; guards over-fire).
- `…family-j-ban-list-response.json` — intentionally dirty evidence_span; the scan MUST reject.
- `…family-j-malformed-response.json` — schema violation; the validator MUST reject.

### New Deno test files — `mcp-server/tests` (6 dedicated)

(Forecast counts; see §11 for the full plan. Mirror the I/H pattern; J's HIGH risk inflates the ban-list + adversarial suites toward H's profile.)

- `familyJKeys.test.ts` — **~18 tests.**
- `familyJKeysParity.test.ts` — **~18 tests.**
- `familyJPrompt.test.ts` — **~24 tests.**
- `familyJBanListScan.test.ts` — **~34 tests.**
- `familyJAnthropic.test.ts` — **~11 tests.**
- `familyJAdversarialDoctrine.test.ts` — **~38 tests** (the D4 BINDING file; mirrors `familyHAdversarialDoctrine.test.ts` 38).

Dedicated forecast total: **~143**.

### New Jest test file — `__tests__`

- `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyJ.test.ts` — **~8 tests (`FJ-1`…`FJ-8`).** Mirrors `…FamilyI.test.ts` BUT locks the **held-out** shape (the doctrinal inverse of I): `FJ-2 productionEnabled: false`, `FJ-4 edgeProductionEnabledFamilies()` does NOT include `sensitive_composer`, `FJ-6 edgeFilterFamiliesForMode(['sensitive_composer'], 'production')` returns `[]`, `FJ-7 admin_validation` returns `['sensitive_composer']`, `FJ-8` J is the **10th** entry (index **9**). This is the leak-tripwire that J never silently flips to production.

### Modified files — `mcp-server`

- `mcp-server/lib/familyRegistryInit.ts` — **+~10 lines net.** Import `FAMILY_J_RAW_KEYS`, `FAMILY_J_CLASSIFIER_SET_VERSION` from `./familyJKeys.ts`; add `register('sensitive_composer', { rawKeys: new Set(FAMILY_J_RAW_KEYS), classifierSetVersion: FAMILY_J_CLASSIFIER_SET_VERSION })` **immediately after the I `register('thread_topology', …)` block (after line 200, before the closing `}` on line 201)**, with a comment documenting source-uniform `semantic_referee`, HIGH doctrine-risk, and the **admin_validation-only ceiling** (no Card-3 production flip; cite §10a). Update the function jsdoc (lines 64-78) so the 10-family order list ends `…, 'thread_topology', 'sensitive_composer'`.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — **+~14 lines net.** Add 3 imports + `ValidatedFamilyJRequest` to the `FamilyProviders.anthropic` union (after `ValidatedFamilyIRequest`, line 353) + a `if (family === 'sensitive_composer') { return { anthropic: (req,requestId)=>runAnthropicFamilyJClassifier(req as ValidatedFamilyJRequest, requestId), fixture: loadFixtureFamilyJPacket, banListScan: scanFamilyJBooleanResponseForBanList }; }` branch after the `thread_topology` block (after line 437). Update the header note (lines 52-56) — J is now implemented; **there is no remaining unsupported family** (see §11 retarget note). Update the tool `description` (line 175) to add J's coverage **doctrine-clean** (see §6 caution: the description-scan test bans bare verdict tokens — describe J as composer-only/inspect-only advisory observations that never characterize the author).

### Modified files — `mcp-server/tests` (cross-family retarget — see §11 + §13)

- `familyRegistryInit.test.ts` — **+~3 tests** (9→10 order + idempotency; J register-on-import; 5 rawKeys; `family-j-v1`).
- `familyRegistry.test.ts` — **+~3 tests** (10-family order; 10-way cross-family rejection; 5 rawKeys).
- `familyBooleanRequestSchema.test.ts` — **+~7 tests** (valid J request; J empty-rawKeys → all 5; cross-family A–I rawKey under `sensitive_composer` → unsupported_rawKey; J rawKey under any A–I family → unsupported_rawKey; A–I regression). **Retarget** the "sensitive_composer is the sole remaining unsupported family" block (lines 441-454) — see §13.
- `familyBDispatch.test.ts`, `familyCDispatch.test.ts`, `familyDDispatch.test.ts`, `familyEDispatch.test.ts`, `classifyArgumentBooleanObservations.test.ts` — **retarget** every "unsupported family J (sensitive_composer)" case to "**supported** family J returns `family-j-v1` / `isError:false`", AND switch the unsupported-family example to a **synthetic unregistered family string** (J was the last real family — see §13 HARD finding), AND grow the `supportedFamilies` envelope 9→10. **CAUTION:** preserve every cross-family-leak-prevention assertion (HALT #4).

### Modified files — smoke

- `scripts/mcp-server-001-smoke.sh` — **+~36 lines (2 checks).** Append `[40-compat-boolean-family-j]` + `[41-mcp-tools-call-boolean-family-j]` after Check 39 (assert `family-j-v1`; `isError:false` on `/mcp`). Update the header tally **39 → 41** (lines 4, 68). See §9.

### Modified — docs

- `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-template.md` — **NEW** (the E2/E3 smoke skeleton the operator authors; mirrors I's 330-line template; a template filename → `audit-lint` skips it via `isTemplateFilename`).
- `docs/core/current-status.md` — **+2 lines** (test-count + one-line note).

### NOT modified (verify byte-equal)

- `mcp-server/lib/family{A,B,C,D,E,F,G,H,I}*.ts` — **byte-equal** (HALT 4).
- `mcp-server/lib/doctrineBanList.ts` — **byte-equal** (HALT 5; J adds its OWN scan, shared list unchanged).
- `mcp-server/lib/anthropicCall.ts`, `providerConcurrency.ts`, `mcpBooleanObservationSchemaMirror.ts` — **byte-equal** (HALT 5).
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — **byte-equal** (J entry already `{productionEnabled:false, adminValidationEnabled:true}` at **lines 114-118**; HALT 13).
- `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` — **byte-equal** (NO `sensitive_composer` entry in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`; source-uniform → full passthrough; HALT 14).
- `src/**` — **byte-equal**, especially `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` (the source-of-truth READ). See §15 RO-16.
- `scripts/ops/audit-lint-rules.cjs` — **byte-equal** (the `family_j` L5 entry is a SEPARATE follow-up card — §11 / §14).
- `package.json` / `package-lock.json`, `supabase/migrations/**` — **byte-equal**.

---

## 5. §10a-constrained prompt design — the most sensitive prompt in the system

This is the binding doctrine engineering. The prompt must be built so the model output **detects whether the TEXT exhibits a structural feature** and **never characterizes the author** ("you are…", "this person is…", "the author is…"). Per `MCP-J-001 §8`: the classifier detects; the COPY stays in the client layer. The server emits a boolean + a confidence band + an optional evidence_span that anchors **text features only**.

### 5.1 System prompt

`FAMILY_J_SYSTEM_PROMPT` keeps the **7 absolute rules byte-equal** to the A–I system prompt (`familyHPrompt.ts:85-92` / `familyIPrompt.ts:82-89`). Rule #5 ("You do NOT describe, judge, or label the person — only the move's structure.") is load-bearing for J and must NOT be reworded. Then a J-specific **CRITICAL DOCTRINE — sensitive-composer observations are PRIVATE STRUCTURAL NUDGES, never characterizations of the person** block, which states verbatim:

- A sensitive-composer observation describes a STRUCTURAL FEATURE of the move's own text (its focus, its claim-content, its reactive markers, the form of support it leans on). It is shown only to the author in their own composer (keys 1-3) or to an admin reviewing the text (keys 4-5). It NEVER asserts that the author is a "troll", "bot", "bad actor", "toxic", "hostile", "abusive", "aggressive", "uncivil", acting in bad faith, or any judgment of the person or their intent.
- `shifts_to_person_or_intent` records that the move's CONTENT addresses the parent's poster (motive / character / identity / intent) rather than the substantive claim. It is a structural focus observation, NEVER an "ad hominem" verdict, NEVER a "personal attack" label, NEVER a claim the author is attacking anyone. The evidence_span anchors the move's own verbatim wording that shows the focus-shift (e.g. "because you work for…"), and MUST NOT echo any slur the move itself contains.
- `contains_unplayable_insult_only` records the structural ABSENCE OF A PLAYABLE CLAIM. It NEVER labels the move "an insult", "toxic", or "abusive", and NEVER calls the author a "troll".
- `needs_pre_send_pause` records reactive/escalatory STRUCTURAL MARKERS (all-caps bursts, repeated punctuation, tone-only reply). It NEVER labels the author "angry", "unhinged", "emotional", or "losing it" — it is a private suggestion to pause, not a diagnosis of the writer.
- `uses_satire_as_evidence` records that the text cites a satire/parody source as if it documented a real event. It NEVER calls the claim "false", "fake", "untrue", or the author "gullible" — satire's value as commentary is preserved; only the evidentiary misuse is the structural fact.
- `uses_popularity_as_evidence` records that the text leans on how widely an idea is shared as support (§3). It NEVER credits the engagement, NEVER quantifies/ranks it as if more sharing made the point stronger, and NEVER assigns the claim a truth value (`cdiscourse-doctrine` §3; `src/features/pointStanding/antiAmplification.ts` — engagement credit and factual-standing eligibility are SEPARATE scores).
- A terminal "The output MUST NOT contain the words: …" line enumerating the J ban tokens (§6) — the negation in the system prompt is doctrine-positive (the ban-list scan runs against the model RESPONSE, not the prompt; precedent `familyHPrompt.ts:127-134`).

A **conservative-positives bias** closes the prompt (sensitive features are sparse; when unsure, answer false) — mirrors H/I.

### 5.2 Per-key guards — the 4 verdict-adjacent keys + the §3 key

Mirror H's "4 HIGHEST-risk keys each carry a verbatim per-key DOCTRINE paragraph" (`familyHPrompt.ts:35-53`) with `shifts_to_person_or_intent` as the **axis-partner** carrying the maximal guard:

| rawKey | guard strength | guard essence (server-side, never the §8 copy) |
|---|---|---|
| `shifts_to_person_or_intent` | **MAXIMAL (axis-partner)** | Structural focus observation; never "ad hominem"/"personal attack"/"attacking"; evidence_span anchors the focus-shift wording, never the slur; never "you are"/"this person is" framing. Mirror the upstream `falsePositiveGuards` (`familyJ.ts:63-67`): do NOT fire for SOURCE-credibility critique, for a person named in service of a claim, or when the poster's identity IS the claim's subject. |
| `contains_unplayable_insult_only` | strong | Records absence of playable claim; never "insult"/"toxic"/"troll". Mirror `familyJ.ts:108-112`: a claim + an insult is still playable; short genuine clarifying questions are not this key. |
| `needs_pre_send_pause` | strong | Records reactive structural markers; never "angry"/"unhinged"/emotional-state label. Mirror `familyJ.ts:151-155`: not by word-count, not by tone alone, not for legitimate single-word emphasis. |
| `uses_satire_as_evidence` | strong | Records satire-cited-as-fact; never "false"/"fake"/"gullible". Mirror `familyJ.ts:236-240`: not for satire-acknowledged-as-satire, satire-as-phenomenon, or satire critique. |
| `uses_popularity_as_evidence` | §3 anti-amplification | Records popularity-leaned-on; never credits engagement, never assigns truth value. Mirror `familyJ.ts:194-198`: not for popularity-as-one-fact, popularity-critique, or descriptive engagement observation. The wording must not loop back into engagement-as-evidence (`MCP-J-001 §8` note). |

Each upstream `falsePositiveGuards` array (`familyJ.ts`) is mirrored verbatim into the server prompt entry, then the verdict-adjacent keys gain the additional DOCTRINE line. The user prompt (`buildFamilyJUserPrompt`) follows the H structure exactly: questions block → definitions/examples/guards block → cross-key sensitive-composer-as-structure note → response-shape JSON (with `classifierSetVersion: family-j-v1`) → conservative-positives reminder → the "if the move's own text contains a slur/verdict word, you MAY detect the feature but your evidence_span MUST NOT echo it" instruction → the redacted input.

### 5.3 Why this stays doctrine-safe (§10a)

The classifier output is the **Machine Observation** layer (`modelInfo.provider = 'mcp'`, advisory). It never decides who is right, never blocks posting, never assigns truth, never returns an authoritative flag. Surface routing — composer-only for keys 1-3, inspect-only for keys 4-5 — is enforced **downstream** by the three concentric gates documented in `MCP-J-001 §2` (Edge `productionEnabled:false`; persistence-adapter acceptlist; `isDispositionEligible`), none of which this card touches. The server's only job is detection; the §8 display COPY (operator-approved) lives in the client `gameCopy.toPlainLanguage` mapping and never enters the server. The ban-list scan (§6) is the runtime backstop that a model response which slips into characterization is rejected (`validation_failed / doctrine_ban_list`) rather than returned.

---

## 6. Ban-list scan module — `familyJBanListScan.ts`

`scanFamilyJBooleanResponseForBanList(response)` stacks the shared `DOCTRINE_BAN_PATTERNS` (`doctrineBanList.ts:48-54` — already covers winner/loser/correct/incorrect/truth/untrue/dishonest/liar/manipulative/extremist/propagandist/stupid/idiot/verdict/bad faith/proof of) with **J-specific person-directed patterns** (`FAMILY_J_BAN_PATTERNS`). It scans every `evidenceSpan` string + `modelInfo.serverName` + `modelInfo.classifierSetVersion` (NOT `nodeId`/`schemaVersion`/`checkedRawKeys`/confidence — symbol-constrained). The shared list is **byte-equal preserved** (HALT 5); J adds only its own scan, mirroring the F/G/H/I precedent of family-local scoping.

**Candidate `FAMILY_J_BAN_PATTERNS` (implementer verifies against the `antiAmplification.ts` banned-label list + `moveMetadataLedger.ts:_forbiddenMetadataTokens` and finalizes; tokens NOT already in the shared list):**

Single-word person/intent labels — `troll`, `bot`, `astroturfer` (+ `astroturf`), `toxic`, `hostile`, `abusive` (+ `abuse`), `aggressive`, `uncivil` (+ `incivility`), `gullible`, `unhinged`. Compound phrases — `ad hominem` (+ `ad-hominem`), `personal attack` (+ `attacks the person` / `attacking the person`), `bad actor`, `name calling` (+ `name-calling`), `fake news`, `losing it`.

Boundary strategy mirrors `FAMILY_H_BAN_PATTERNS` (`familyHBanListScan.ts:102-123`): `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for single tokens (recognises word + snake_case breaks; `bot` does NOT match `robot`), `[\s_-]+` for phrase separators.

`liar` / `manipulative` / `extremist` / `propagandist` / `bad faith` (the antiAmplification labels that overlap the shared list) are **not** re-added — the shared list already catches them (F/G/H precedent: family lists carry only the NOT-already-covered tokens).

**CAUTION — the verbatim-quote tension (binding test design):** for `shifts_to_person_or_intent`, a legitimate evidence_span quotes the move's own person-directed wording (e.g. "because you work for an EV company"). The prompt (§5) instructs the model to anchor the **structural** wording, not the slur — so a clean evidence_span passes, while a model that echoes "you're such a troll" is rejected. The adversarial existential fixture (`…person-shift-adversarial-request.json`) proves exactly this: slur in the INPUT, clean OUTPUT. A FAIL is HALT + revert.

**Tool-description scan:** the I card had to reword its tool description to avoid the bare `winner` token because a description doctrine-clean scan bans it (PR #546 commit note). J's description addition (§4) must likewise be doctrine-clean — describe J's keys as composer-only/inspect-only advisory observations without any banned token and without characterizing the author.

---

## 7. Source-model note + reachability / safety statement

### 7.1 J is source-uniform — no Edge subset entry (HALT-14 guard)

All 5 J keys are `semantic_referee`-sourced. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (`booleanObservationRequestBuilder.ts:68-89`) carries entries ONLY for the mixed-source families (D `evidence_source_chain` :71, G `resolution_progress` :81, I `thread_topology` :82-88), each restricting the server to the `ai_classifier` subset. The map's own header (`:60-62`) says future families "add an entry here … when their Stage 2B decision lands; **absence = full registry passthrough**." J is source-uniform → **absence is correct** → all 5 J keys flow through unfiltered. Adding a `sensitive_composer` entry would be the **HALT-13-class defect** (#473 / `MCP-J-001 §3` recital). This card adds none.

### 7.2 admin_validation requests reach the server with 5 keys; production cannot

Verified file:line:

- `familyRegistry.ts:114-118` — `{ family: 'sensitive_composer', productionEnabled: false, adminValidationEnabled: true }`.
- `filterFamiliesForMode` (`familyRegistry.ts:141-156`): mode `'production'` keeps only `productionEnabled:true` → **J is dropped**; mode `'admin_validation'` keeps `adminValidationEnabled:true` → **J is kept**.
- The auto-trigger dispatcher derives its production family list from `productionEnabledFamilies()` (`familyRegistry.ts:162-166`) — J is absent, so **no `run_mode='production'` path can ever request J**.
- `buildBooleanObservationRequestForArgument` (`booleanObservationRequestBuilder.ts:134+`): for an `admin_validation` request naming `sensitive_composer`, `eligibleFamilies` includes J, and with no `MCP_SERVER_SUPPORTED_FAMILY_SOURCES[J]` filter all 5 `semantic_referee` keys are added to `requestedRawKeys` → the server receives the 5 keys.

So post-merge: an admin-validation request for `sensitive_composer` reaches the server carrying the 5 keys; a production-mode request carrying `sensitive_composer` cannot occur (registry filter + the production-mode family filter). This card changes none of these gates.

### 7.3 Reachability / safety statement (binding)

Post-merge, the **only** invocation path is the admin-gated `classify-argument-boolean-observations` Edge function in **admin_validation** mode (operator-driven). **Nothing auto-triggers J.** Merge **IS Deno-deploy-bearing** (the GitHub integration redeploys the MCP server to Deno Deploy: `deploy/civildiscourse/cdiscourse-mcp-server`), but the deployed J capability **sits idle** until E3's operator-gated admin-validation smoke. **E2 (hosted smoke, including the two new J checks) is the next gate after merge**; E3 is the operator-driven admin-validation exercise; E4 is the ceiling (§11).

---

## 8. API / interface contracts

- `runAnthropicFamilyJClassifier(request: ValidatedFamilyJRequest, requestId: string, fetchImpl?: typeof fetch): Promise<AnthropicCallResult>` — wraps `callAnthropic` with `FAMILY_J_SYSTEM_PROMPT`, `buildFamilyJUserPrompt`, `FAMILY_J_MAX_TOKENS=1500`, `FAMILY_J_TEMPERATURE=0`, `toolNameForLogging: 'classify_argument_boolean_observations'`.
- `buildFamilyJUserPrompt(request: ValidatedFamilyJRequest): string` — pure, no I/O.
- `loadFixtureFamilyJPacket(): Promise<{ ok: true; value } | { ok: false; reason: 'fixture_load_failed' }>`.
- `scanFamilyJBooleanResponseForBanList(response): { ok: true } | { ok: false; path: string }`.
- `ValidatedFamilyJRequest` — identical wire shape to `ValidatedFamilyHRequest`/`ValidatedFamilyIRequest` (`schemaVersion`, `nodeId`, `parentNodeId`, `currentText`, `parentText`, `threadContextExcerpt`, `requestedFamilies`, `requestedRawKeys`, `timeoutMs`, `serverName?`).
- Registry: `register('sensitive_composer', { rawKeys: new Set(FAMILY_J_RAW_KEYS), classifierSetVersion: 'family-j-v1' })`.
- Dispatcher branch: `pickFamilyProviders('sensitive_composer')` returns `{ anthropic, fixture: loadFixtureFamilyJPacket, banListScan: scanFamilyJBooleanResponseForBanList }`.
- Wire response unchanged: `McpBooleanObservationResponse` per `src/features/nodeLabels/mcpBooleanObservationSchema.ts`, with `modelInfo.classifierSetVersion = 'family-j-v1'`. No new request/response field.

---

## 9. Smoke additions

Append two checks to `scripts/mcp-server-001-smoke.sh` (current tally **39**, so J gets **40** + **41**), mirroring the I shape at lines 680-721:

- `40-compat-boolean-family-j` — `POST /mcp/adapter-compat`, `requestedFamilies:['sensitive_composer']`, `requestedRawKeys` including the 3 composer-only keys + a benign inspect-only key, benign body that exhibits a sensitive structural feature without containing a slur. Assert response contains `"schemaVersion":"mcp-021.machine-observations.boolean.v1"`, `"observations"`, `"confidence"`, `"modelInfo"`, `"family-j-v1"`.
- `41-mcp-tools-call-boolean-family-j` — same body via `POST /mcp` JSON-RPC `tools/call`. Assert the same five + `"isError":false`.

Update the header tally comments (lines 4, 68) **39 → 41** and add the two check descriptions to the header block. Both run against the fixture provider (`MCP_SERVER_USE_FIXTURE_PROVIDER=true`) loading `…family-j-canonical-response.json` — no Anthropic key needed at smoke time.

---

## 10. Edge cases

- **Empty `requestedRawKeys`** → `buildFamilyJUserPrompt` includes all 5 keys (mirror `familyIPrompt.ts:185-188`).
- **A subset of J keys requested** → only those entries appear in the prompt; the response is validated against the requested set.
- **An A–I rawKey requested under `sensitive_composer`** → `validateFamilyBooleanRequest` returns `unsupported_rawKey` at the registry boundary (no silent false).
- **A J rawKey requested under any A–I family** → `unsupported_rawKey` (cross-family-leak prevention; HALT #4).
- **`sensitive_composer` requested in production mode** → filtered out by `filterFamiliesForMode` before the request is built (§7.2); the server is never reached for production J.
- **Move text contains a slur / person-label in the INPUT** → the model may still detect `shifts_to_person_or_intent` / `contains_unplayable_insult_only`, but the evidence_span MUST anchor the structural feature, not echo the slur; a slur-echoing response is rejected by `scanFamilyJBooleanResponseForBanList` (`validation_failed`). The Edge adapter then falls back to the deterministic layer — posting is never blocked (§4 doctrine).
- **Model returns malformed JSON / non-prose** → `validateMcpBooleanObservationResponse` rejects (`validation_failed`).
- **Anthropic key missing / 429 / 500 / timeout** → typed error envelope from `callAnthropic`; the dispatcher returns `isError:true` and the Edge adapter falls back deterministically.
- **Doctrine edge — does heat / popularity influence anything?** No. `uses_popularity_as_evidence` records the structural fact only; it never credits engagement, never assigns the claim a truth value, and the observation carries no standing delta (engagement credit and factual-standing eligibility stay SEPARATE; `antiAmplification.ts`).
- **Doctrine edge — could a J observation reach a public node?** Not via this card: the server only detects; surface routing is enforced by the three concentric gates downstream (§5.3 / `MCP-J-001 §2`), none touched here.

---

## 11. Test plan

Per `Skill(test-discipline)`: tests are part of the deliverable. Gate verification requires captured exit code 0 (no truncated tails). Deno suites run via `deno test` in `mcp-server/`; the jest suite runs via `npm run test`.

### Deno — dedicated suites (forecast; mirror I, inflated to H's profile for the HIGH-risk suites)

- `familyJKeys.test.ts` — **~18.** `FAMILY_J_RAW_KEYS` length 5; declaration order matches upstream; **no `FAMILY_J_EXCLUDED_DETERMINISTIC_RAW_KEYS` export exists** (source-uniform — assert absence); `FAMILY_J_CLASSIFIER_SET_VERSION === 'family-j-v1'`; `FAMILY_J_PROMPT_ENTRIES` has 5 entries each with all required fields incl. `source` + `disposition`; the 4 verdict-adjacent keys' guards contain the verbatim DOCTRINE lines; `shifts_to_person_or_intent` carries the maximal guard.
- `familyJKeysParity.test.ts` — **~18.** Upstream `familyJ.ts` declares exactly 5 `source: 'semantic_referee'` entries with `family: 'sensitive_composer'`; each rawKey literal matches `FAMILY_J_RAW_KEYS`; the disposition split is exactly 3 `composer_only` + 2 `inspect_only` and matches the server entries' `disposition`; no extra/dropped keys; cross-family A∩J … I∩J all empty.
- `familyJPrompt.test.ts` — **~24.** 7 absolute-rules block byte-equal to A–I; the sensitive-composer CRITICAL-DOCTRINE block present verbatim; per-key DOCTRINE guards for the 4 verdict-adjacent keys verbatim; happy path; subset path; empty-rawKeys → all 5; rawKeys filter rejects non-J keys; banned-token negation present; `FAMILY_J_MAX_TOKENS===1500`; `FAMILY_J_TEMPERATURE===0`; `FAMILY_J_MAX_BODY_FIELD_LEN===8000`; response-shape includes `family-j-v1`.
- `familyJBanListScan.test.ts` — **~34.** Each J-specific single-word pattern detected; each compound phrase detected; each shared `DOCTRINE_BAN_PATTERNS` token detected; near-miss boundary assertions (`robot` does NOT match `bot`; `topical` unaffected; `attacking` inside a clean structural span handled per chosen boundary); null evidence_span skipped; `serverName` + `classifierSetVersion` scanned; `checkedRawKeys` NOT scanned; clean person-shift evidence_span (structural anchor, no slur) passes; the ban-list fixture rejected with correct path; `FAMILY_J_BAN_PATTERNS` frozen + `readonly RegExp[]`.
- `familyJAnthropic.test.ts` — **~11.** Happy; key_missing; 429; 500; TimeoutError; non-JSON; plain prose; API key never in success log; never in failure log; logs tagged `classify_argument_boolean_observations`; MAX_TOKENS=1500 in `callAnthropic` args.
- `familyJAdversarialDoctrine.test.ts` — **~38** (D4 BINDING; mirror `familyHAdversarialDoctrine.test.ts`). Fixtures parse + pass `validateFamilyBooleanRequest`; **the EXISTENTIAL** (`…person-shift-adversarial-request.json`): input contains "troll"/"you're toxic", expected clean output evidence_span does NOT echo — **FAIL = HALT + revert**; insult-only / pause / popularity / satire fixtures produce only their intended positive; the no-sensitive baseline produces zero positives; the scan rejects each J-specific pattern + each shared token; clean structural evidence_spans pass; near-miss words not flagged; canonical fixtures produce no characterization.

Dedicated forecast: **~143** new Deno tests.

### Deno — cross-family retarget (existing suites)

`familyRegistryInit.test.ts` (+~3), `familyRegistry.test.ts` (+~3), `familyBooleanRequestSchema.test.ts` (+~7), and the dispatch suites (`familyB/C/D/EDispatch.test.ts`, `classifyArgumentBooleanObservations.test.ts`) retargeted (net additions where "unsupported J" → "supported J" + a synthetic unsupported example; `supportedFamilies` 9→10). See §13 for the synthetic-family HARD finding. Net cross-family Deno delta: **~+15–20**.

### Jest — delta (minimal)

- **NEW** `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyJ.test.ts` (**~8 tests**, FJ-1…FJ-8) — locks the held-out Edge shape (`productionEnabled:false`, NOT in production list, index 9). Mirrors I's jest-side touch exactly (PR #546 added the analogous I file).
- `docs/core/current-status.md` (+2 lines).
- **RO-16 stays GREEN with no change** (see §13). No other jest file is touched. Jest-side delta: **+8 tests, +1 suite**.

### L5 audit-lint question (VERIFIED — absent → separate follow-up card)

`scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES` (lines 55-109) carries entries for E (`argument_scheme`/`slippery_slope`), F (`critical_question`/`family_f`/`consequence_probability_unclear`), G (`resolution_progress`/`family_g`/`concedes_broader_point`), H (`claim_clarity`/`family_h`/`claim_specificity_low`), and I (`thread_topology`/`family_i`/`compares_options`, ending line 108). **There is NO `family_j` / `sensitive_composer` / `shifts_to_person_or_intent` entry.** H and I each got a dedicated **Card 2** L5-mechanization card (#549). Because J's doctrine-risk is HIGH, the L5 entry is warranted — but it is **OUT OF SCOPE for this card** and is scoped as a separate follow-up:

> **Follow-up card (not this one): MCP-SERVER-011-FAMILY-J Card 2 — L5 doctrine-risk mechanization.** Add `'sensitive_composer'`, `'family_j'`, and the axis-partner `'shifts_to_person_or_intent'` to `DOCTRINE_RISK_FAMILIES` (`audit-lint-rules.cjs`), with the doctrine-risk comment block mirroring the H/I entries. This card does NOT touch `audit-lint-rules.cjs` (byte-equal, §4).

### E4 ceiling (restated, binding)

This card ships J at **admin_validation only**. A production-enable card is **NOT** part of this chain. Any future J production proposal requires a **fresh `cdiscourse-doctrine` §10a doctrine review** + a roadmap-architecture decision (not a normal-card / registry-flip workflow), per `MCP-J-001 §7` and the H-I-J roadmap §7 HARD RULE. Until then, OFF-in-production is the finished state.

---

## 12. Dependencies (cards / docs / files)

- **Assumes complete:** Family I Card 1 (`4b9dabd` / PR #546) — the structural template + the 9-family registry it leaves. The dispatcher / registry / schema scaffolding (A–I) is the substrate J extends.
- **Doctrine ancestor (binding, not a code dep):** `MCP-J-001-FAMILY-J-SCOPING-EXTENSION-intent.md` (§2 keys, §4 dispositions, §8 wordings, §10a). The closed `OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31` (issue #398 / PR #406). `cdiscourse-doctrine` §10a / §1 / §3 / §4.
- **Reads (verification only, never modified):** `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts`; `mcp-server/lib/familyHKeys.ts`/`familyHPrompt.ts`/`familyHBanListScan.ts`/`familyHFixtureProvider.ts`/`familyHAnthropic.ts` (the H mirror); `mcp-server/lib/familyIKeys.ts` … (the I mirror); `mcp-server/lib/familyRegistryInit.ts`; `mcp-server/tools/classifyArgumentBooleanObservations.ts`; `mcp-server/lib/doctrineBanList.ts`; `supabase/functions/_shared/booleanObservations/familyRegistry.ts`; `…/booleanObservationRequestBuilder.ts`; `scripts/mcp-server-001-smoke.sh`; `scripts/ops/audit-lint-rules.cjs`; `__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts`; `src/features/pointStanding/antiAmplification.ts` (for the §6 banned-label cross-check).
- **Blocks:** the J Card-2 L5-mechanization follow-up (§11) and any far-future J production-enable card (which is gated on a fresh §10a review and is not yet filed).

---

## 13. Risks

- **HARD finding (scope-reality audit) — J is the LAST family, so the "unsupported family" test example must be re-homed to a SYNTHETIC string.** `sensitive_composer` is currently the canonical unsupported-family example across **6 Deno test files** (28 occurrences: `classifyArgumentBooleanObservations.test.ts`, `familyBDispatch.test.ts`, `familyCDispatch.test.ts`, `familyDDispatch.test.ts`, `familyEDispatch.test.ts`, `familyBooleanRequestSchema.test.ts`). The I card retargeted "unsupported I" → "unsupported J"; J has **no successor family**, so the implementer MUST introduce a **synthetic unregistered family string** (e.g. `'__unregistered_family_for_test__'`) for the unsupported-family regression assertions, and convert every "unsupported J" assertion to "**supported** J returns `family-j-v1`". Mechanical step: grep `'sensitive_composer'` across `mcp-server/tests/` (and the `supportedFamilies` 9-element array literal) to enumerate ALL retarget sites; dropping a cross-family-leak assertion in the process is a HALT #4 violation.
- **RO-boundary (VERIFIED) — RO-16 stays GREEN; do NOT touch `src/.../familyJ.ts`.** `__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts:281-283` (`RO-16`) asserts `git diff main..HEAD -- src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` is empty (byte-equal). This card adds **NEW** files under `mcp-server/lib/` and does **NOT** modify the `src/` `familyJ.ts`, so RO-16 stays green with no change. The memory rule that "each MCP-BUILD2 family branch must relax its OWN RO-N boundary to the additive `readFileSync` pattern" applies to **vocabulary-expansion cards that grow the `src/` `familyX.ts` definition files** (RO-7…RO-13 were relaxed for exactly that). It does **NOT** apply to this server-side build: the precedent #546 (Family I server card) did **not** touch `mcpOneTwoOneBReadOnlyBoundary.test.ts`, and RO-15 (`familyI.ts unchanged`) stayed green. J mirrors that exactly. **No RO-N boundary needs the additive treatment for this card; the binding requirement is the inverse — RO-16 must remain byte-equal, so the card must not modify `src/.../familyJ.ts`.**
- **Doctrine over-fire on `shifts_to_person_or_intent`.** The single highest false-positive risk: marking a SOURCE-credibility critique or a claim-about-a-public-figure as a person-shift. Mitigated by mirroring the upstream `falsePositiveGuards` verbatim + the maximal axis-partner DOCTRINE line + the no-sensitive baseline fixture + the conservative-positives bias.
- **Ban-list verbatim-quote tension** (§6) — over-aggressive J patterns could reject legitimate structural evidence_spans. Mitigated by scoping the patterns to model-added characterizations (not the input quote) + the strict word-boundary form + the adversarial existential fixture that proves a clean structural anchor passes while a slur echo is rejected. The implementer should finalize the token list against `antiAmplification.ts` + `moveMetadataLedger._forbiddenMetadataTokens` before committing.
- **Tool-description doctrine-clean scan** — the J description addition must avoid every banned token and any author characterization (§6), or the description-scan test fails (the I card hit this with bare `winner`).
- **Deno merge-build transience** — the Deno deploy build can fail transiently at merge (per memory: retry fixes; `deno check main.ts` has 23 pre-existing tolerated errors — not the cause). The N/N hosted smoke is authoritative over the lagging commit-status API.
- **Misread as a production-enable card** — the slot is a *build* at admin-validation depth. Mitigated by the E4 ceiling restatement (§11) and the held-out jest test (FJ-2 `productionEnabled:false`).

---

## 14. Out of scope (explicit)

- Flipping `productionEnabled` for `sensitive_composer` (`familyRegistry.ts:116`) — needs a fresh §10a review (§11).
- Adding `sensitive_composer` to `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (`booleanObservationRequestBuilder.ts:68-89`) — source-uniform; an entry would be HALT-13 (§7.1).
- Any `src/**` change, especially `familyJ.ts` (RO-16); any `supabase/migrations/**`; any RLS change.
- The L5 `audit-lint-rules.cjs` doctrine-risk entry for J — separate Card 2 (§11).
- The DEFERRED-V2 post-hoc personal-observation surface and the inspect-only admin UI home (`MCP-J-001 §4.2 / §5.2`) — client surfaces, not this server build.
- Any UI / composer-rail / Inspect-popout wiring — this card ships server detection only.
- Any AI-from-production-app surface — J's evaluation stays in the Edge → MCP server path, `productionEnabled:false` (`cdiscourse-doctrine` §7).
- Writing the §6 final token list as gospel — it is a candidate set the implementer verifies + finalizes.

---

## 15. Doctrine self-check

- **§10a (Observations vs Allegations) — LOAD-BEARING:** the server detects structural TEXT features and emits Machine Observations (`provider: 'mcp'`, advisory); it never characterizes the author. Composer-only / inspect-only routing is enforced downstream by the three concentric gates (`MCP-J-001 §2`), untouched here. The prompt (§5) + ban-list (§6) + the adversarial existential (§11) jointly guarantee no person-characterization in output. RESPECTED.
- **§1 (no truth/verdict labels):** the 7 absolute rules are byte-equal to A–I; the §6 ban-list (shared + J-specific) rejects any verdict/person token in the response; the tool description is doctrine-clean. RESPECTED.
- **§3 (popularity / satire are not evidence):** `uses_popularity_as_evidence` + `uses_satire_as_evidence` carry the §3 boundary forward as structural information; never credit engagement, never assign truth value, no standing delta (`antiAmplification.ts`). RESPECTED.
- **§4 (AI moderator advisory-only):** J never decides who is right, never blocks posting (the Edge adapter falls back to the deterministic layer on any J error), never returns an authoritative flag. RESPECTED.
- **§5 (rules engine sacred):** no change to `engine.ts`; the classifier is server-side only. RESPECTED.
- **§6 (secrets):** `ANTHROPIC_API_KEY` reaches the network only inside `callAnthropic`; never logged; the `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` invariant is unaffected (no `src/` change). RESPECTED.
- **§7 (no AI from production app):** J's Anthropic call is server-side Deno; `productionEnabled:false`; nothing under `src/`/`app/` calls it. RESPECTED.
- **§8 (RLS + append-only migrations):** no migration, no RLS, no row-mutation surface. RESPECTED.
- **§9 (plain-language mapping):** the §8 display COPY (operator-approved) stays in the client `gameCopy.toPlainLanguage`; no internal rawKey is surfaced to a user by this server card. RESPECTED.
- **v1 scope / score-never-blocks / no service-role:** no voting/search/push/OAuth/public-API; score never blocks posting; no service-role path. RESPECTED.

---

## 16. Operator steps

- **At GATE-A:** approve the build (admin-validation-only ceiling; no production flip) and confirm the §6 J ban-token list (or revise). Confirm the §5 prompt framing.
- **After the implementer commits + the PR merges:** merge is Deno-deploy-bearing — the GitHub integration redeploys `cdiscourse-mcp-server` to Deno Deploy automatically. **No `supabase db push`, no `supabase functions deploy`, no env var, no routing arm** — the Edge `familyRegistry.ts` already carries J admin-only; this card changes no Edge surface.
- **E2 (next gate):** run the hosted MCP smoke (`bash scripts/mcp-server-001-smoke.sh --base-url <hosted .deno.net> --token <bearer>`) and confirm 41/41, including Checks 40+41 (`family-j-v1`).
- **E3:** the operator-driven admin-validation smoke exercises J through the admin-gated Edge function (authored from the §4 SMOKE template).
- **E4 (ceiling):** none — production is not enabled and requires a fresh §10a review before any future card.
