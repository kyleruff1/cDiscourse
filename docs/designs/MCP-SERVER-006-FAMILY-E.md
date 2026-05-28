# MCP-SERVER-006-FAMILY-E — Argument-Scheme Boolean Observation Classifier (design)

**Status:** Design draft (Stage 2B: NOT REQUIRED — see §10)
**Epic:** MCP server family rollout (Family E of A-B-C-D-E sequence)
**Release:** Stage 6.x — Machine Observation classifiers
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/337
**Intent brief:** [`docs/designs/MCP-SERVER-006-FAMILY-E-intent.md`](./MCP-SERVER-006-FAMILY-E-intent.md)
**Predecessor on main:** `fbf7c87` (intent brief commit), built atop:
- `b324dae` — Card 2 (FAMILY-D-ENABLE) audit amendment landed
- `2abb6b0` — MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE PASS (FAMILY-D production flip)
- `9b040be` — OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE PASS
- `70b18f2` — MCP-SERVER-004-FAMILY-C-SMOKE PASS
- `05b42c3` — MCP-SERVER-003-FAMILY-B-SMOKE PASS

**Branch:** `feat/MCP-SERVER-006-FAMILY-E`
**HEAD at design time:** `fda7a80`

---

## 0. Goal (one paragraph)

Family E (`argument_scheme`) is the fifth boolean-observation family registered on the hosted MCP server. It encodes **16 Walton (1995, 2008) argumentation schemes** — descriptive structural facts about *which inferential pattern* a move uses (causal, analogy, example, authority, consequence, principle, definition, classification, precedent, means-end, tradeoff, abductive, exception, **slippery-slope**, cost-benefit, risk). Per Phase 0 live verification of `src/features/nodeLabels/machineObservationDefinitions/familyE.ts`, all 16 keys are `source: 'ai_classifier'` via the shared `buildScheme(b)` factory; there are zero `auto_metadata` or `lifecycle` entries, zero compound-key collisions, and zero retroactive entries. Stage 2B is **NOT REQUIRED** — Family E is uniform `ai_classifier` (no Subset filter), 16 keys fits MAX_TOKENS=1500 (Family A's baseline at the same key count), and the schema mirror response shape is unchanged. This card adds Family-E-specific server-side files (`familyEKeys.ts`, `familyEPrompt.ts`, `familyEAnthropic.ts`, `familyEBanListScan.ts`, `familyEFixtureProvider.ts`) plus fixtures including ≥3 adversarial slippery-slope fixtures, registers `argument_scheme` in the shared MCP family registry via a one-line addition to `familyRegistryInit.ts`, routes Family E requests through the dispatcher's provider table, and extends the hosted smoke script to 17 PASS checks. **The Edge Function family registry already has the Family E entry** at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:89-93` (`productionEnabled: false`, `adminValidationEnabled: true`), so **no Edge `familyRegistry.ts` edit is required**. The doctrine binding for Family E is existential: copy NEVER labels any scheme a fallacy, weak argument, invalid, bad reasoning, or any verdict — schemes are descriptive shape facts whose critical questions live in Family F. The `slippery_slope_reasoning_present` key carries the doctrine load because the literature frames it as a fallacy; CDiscourse treats it as a scheme.

Doctrine constraints that shape the design:

- **cdiscourse-doctrine §1, §4, §7, §10a** — every Family E observation is a structural pattern fact, never a verdict about a person OR a quality judgment about an argument; doctrine ban-list scan blocks model emission of banned tokens including Family E-specific extensions; AI calls remain server-side Deno only.
- **cdiscourse-doctrine §6** — `ANTHROPIC_API_KEY` / `MCP_SERVER_BEARER_TOKEN` never logged.
- **evidence-doctrine** — argument-scheme detection is orthogonal to factual-standing assessment; identifying a scheme as "slippery-slope" does NOT lower the move's factual standing eligibility.
- **point-standing-economy** — schemes are structural observations; the critical-question family (F) handles whether a scheme's critical questions are met. Family E never penalizes nor rewards.
- **test-discipline** — every new public function ships with tests; test count strictly increases (forecast +95-115; HALT at +300).
- **supabase-edge-contract** — no Edge code change in this card; the Edge familyRegistry already has Family E `productionEnabled: false`.

---

## 1. Scope reality (Phase A.1 — 16-key inventory + Stage 2B determination)

### Family E source verification (live read of `src/features/nodeLabels/machineObservationDefinitions/familyE.ts`)

Verified declaration order: **16 entries total** (0 retroactive + 16 new), each is a single `buildScheme(b)` block within the top-level `FAMILY_E_DEFINITIONS` array. Every entry uses the shared `buildScheme(b)` factory which pins:
- `kind: 'machine_observation' as const`
- `source: 'ai_classifier' as const`
- `family: 'argument_scheme' as const`
- `defaultSurface: 'inspect' as const`
- `disposition: 'future_source' as const`
- `visibleByDefault: false`

| # | rawKey | Line | label | shortLabel | priority |
| - | ------ | ---- | ----- | ---------- | -------- |
| 1 | `causal_reasoning_present` | 74 | Causal reasoning | Causal | 200 |
| 2 | `analogy_reasoning_present` | 104 | Analogy reasoning | Analogy | 201 |
| 3 | `example_reasoning_present` | 136 | Example reasoning | Example | 202 |
| 4 | `authority_reasoning_present` | 166 | Authority reasoning | Authority | 203 |
| 5 | `consequence_reasoning_present` | 196 | Consequence reasoning | Consequence | 204 |
| 6 | `principle_reasoning_present` | 226 | Principle reasoning | Principle | 205 |
| 7 | `definition_reasoning_present` | 254 | Definition reasoning | Definition | 206 |
| 8 | `classification_reasoning_present` | 284 | Classification reasoning | Classify | 207 |
| 9 | `precedent_reasoning_present` | 312 | Precedent reasoning | Precedent | 208 |
| 10 | `means_end_reasoning_present` | 340 | Means-end reasoning | Means-end | 209 |
| 11 | `tradeoff_reasoning_present` | 368 | Tradeoff reasoning | Tradeoff | 210 |
| 12 | `abductive_explanation_present` | 394 | Abductive explanation | Abductive | 211 |
| 13 | `exception_reasoning_present` | 422 | Exception reasoning | Exception | 212 |
| 14 | **`slippery_slope_reasoning_present`** | 449 | Slippery-slope reasoning | Slippery | 213 |
| 15 | `cost_benefit_reasoning_present` | 477 | Cost-benefit reasoning | Cost-benefit | 214 |
| 16 | `risk_reasoning_present` | 504 | Risk reasoning | Risk | 215 |

**Total: 16 entries.** Cross-check against intent brief §1 binding inventory: 16/16 verbatim match.

### Source-breakdown verification (Phase A.1 binding count)

- `auto_metadata`: **0 keys**
- `lifecycle`: **0 keys**
- `ai_classifier`: **16 keys** (all 16)

**Total: 16 = 0 + 0 + 16.** Confirms intent brief §1 + §2 + Decision 8: uniform `ai_classifier`. No Subset filter required.

### Compound-key collision (Phase A.1 binding)

Zero rawKeys appear under multiple source types. Every entry uses `buildScheme(b)` which pins `source: 'ai_classifier'` exactly once. The `id` field formula `registry:machine_observation:ai_classifier:${b.rawKey}` produces 16 unique ids.

**Implication:** the schema mirror response shape is unchanged — flat-keyed `observations: Record<rawKey, boolean>` exactly as Family A / B / C / D. No compound-key prefix needed. No `bySource` envelope.

### Cross-family key collision check (HALT trigger #2 evaluation)

Family A (16 keys, parent_relation), Family B (14 keys, disagreement_axis), Family C (17 keys, misunderstanding_repair), Family D (19 keys, evidence_source_chain Subset) vs Family E (16 keys, argument_scheme):

- Family A ∩ Family E = ∅ (no collision — Family A is structural parent-relations; Family E is inferential schemes)
- Family B ∩ Family E = ∅ (no collision — Family B is disagreement axes)
- Family C ∩ Family E = ∅ (no collision — Family C is repair/grounding)
- Family D ∩ Family E = ∅ (no collision — Family D is evidence-source-chain)

Manual cross-check for the highest-confusion candidates:
- `causal_reasoning_present` (E) vs `causal` Family B disagreement axis vs `mechanism_needed` debt-type (Family D) → distinct strings, distinct families.
- `definition_reasoning_present` (E) vs Family B `disputes_definition` → distinct strings.
- `example_reasoning_present` (E) vs Family E `anecdote_used` (Family D) → distinct strings AND distinct families.

**HALT trigger #2 NOT fired.** No cross-family compound-key collision; the schema mirror needs no change.

### Stage 2B determination

**Stage 2B: NOT REQUIRED.**

Rationale (binding):
1. **Uniform `ai_classifier` source.** All 16 keys route to the same MCP classifier; no Subset filter required. Subset path (which Family D needed to exclude 8 deterministic keys) is structurally inapplicable here.
2. **No compound-key collision.** Schema mirror response shape unchanged from Family A/B/C; no envelope change.
3. **Token budget fits 1500** (see §2). 16 keys × ~85 tokens/key ≈ ~1360 + 80 overhead = ~1440; envelope 1500; headroom ~60 tokens (~4%). Tighter than Family C's headroom but still positive. NO MAX_TOKENS bump.
4. **Doctrine binding fits the per-key `falsePositiveGuards` template** (Family C precedent for `rejects_candidate_understanding` / `acknowledges_misread` / `flags_term_ambiguity`; Family D precedent for `anecdote_used` / `burden_request_present` / `evidence_gap_present`). The Family E doctrine guards extend the SAME pattern; they are NOT a structural change.
5. **Ban-list scope extension is additive, not structural.** Adding slippery-slope-specific verdict tokens to the Family E ban-list scan (see §3) extends — does not change — the shared `DOCTRINE_BAN_PATTERNS` pattern.
6. **Edge Function** already has Family E entry at `familyRegistry.ts:89-93` (`productionEnabled: false, adminValidationEnabled: true`) — exactly the admin-validation-only posture Card 3 ships.

If implementer Phase encounters complexity that contradicts any of the above, that is a Stage 2B trigger and a HALT.

### IN scope

- `mcp-server/lib/familyEKeys.ts` — frozen 16-rawKey constant + per-rawKey `FamilyEPromptEntry` blocks + `FAMILY_E_CLASSIFIER_SET_VERSION = 'family-e-v1'`.
- `mcp-server/lib/familyEPrompt.ts` — Family E system + user prompt; mirrors the 7 absolute rules verbatim from `familyAPrompt.ts:50-57` / `familyBPrompt.ts:65-72` / `familyCPrompt.ts:73-79` / `familyDPrompt.ts:80-87`; adds argument-scheme-as-descriptive-pattern doctrine framing; adds per-key doctrine guards for `slippery_slope_reasoning_present`, `abductive_explanation_present`, and `analogy_reasoning_present`.
- `mcp-server/lib/familyEAnthropic.ts` — Family E Anthropic orchestrator (mirror of `familyDAnthropic.ts`); reuses the shared `callAnthropic` wrapper.
- `mcp-server/lib/familyEBanListScan.ts` — Family E response doctrine ban-list scan (mirror of `familyDBanListScan.ts`); EXTENDS the shared `DOCTRINE_BAN_PATTERNS` with Family E-specific patterns per amendment §3 + §A.3 below. Family A/B/C/D's ban-list scanners and the shared `DOCTRINE_BAN_PATTERNS` constant are UNCHANGED (byte-equal preserved); the Family E extension is additive within `familyEBanListScan.ts` only.
- `mcp-server/lib/familyEFixtureProvider.ts` — fixture-mode provider for Family E (mirror of `familyDFixtureProvider.ts`); loads `family-e-canonical-response.json`.
- `mcp-server/lib/familyRegistryInit.ts` — ONE-line addition that registers `argument_scheme` after the existing Family D registration.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — per-family dispatch: route `argument_scheme` requests to the Family E provider table; Family A/B/C/D paths remain unchanged byte-equal. Tool `description` updated to advertise Family E alongside A/B/C/D.
- Family E fixtures under `mcp-server/fixtures/`:
  - 1 canonical response fixture (`family-e-canonical-response.json`)
  - 1 malformed response fixture (`family-e-malformed-response.json`)
  - 1 ban-list response fixture targeting slippery_slope (`family-e-ban-list-response.json`)
  - 8 binding request fixtures: canonical (mixed schemes), causal-reasoning, analogy-reasoning, authority-reasoning, **slippery-slope-clear**, **slippery-slope-adversarial-fallacy-word**, **slippery-slope-multi-scheme**, no-scheme (adversarial — must return all-false).
- `mcp-server/tests/familyEKeys.test.ts`, `familyEKeysParity.test.ts`, `familyEPrompt.test.ts`, `familyEAnthropic.test.ts`, `familyEBanListScan.test.ts`, `familyEFixtureParity.test.ts`, `familyEResponseValidator.test.ts`, `familyEDispatch.test.ts`, `familyEDoctrineFixtures.test.ts`, **`familyEAdversarialSlipperySlope.test.ts`** (new test file dedicated to amendment §2 binding).
- Test updates: `familyRegistryInit.test.ts` extends to expect all five registered families; `familyRegistry.test.ts` adds 5-family cross-rejection tests; `familyBooleanRequestSchema.test.ts` adds Family E valid-request + cross-family rejection tests.
- `scripts/mcp-server-001-smoke.sh` — add 2 Family E PASS checks (`[16-compat-boolean-family-e]`, `[17-mcp-tools-call-boolean-family-e]`). Tally becomes 17 PASS.
- `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` (NEW) — Edge familyRegistry Family E entry parity (mirrors `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts`).
- `docs/core/current-status.md` handoff section update.
- `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-template.md` (operator fills in date post-merge).

### OUT of scope

- Family F / G / H / I / J key registration. `familyRegistryInit.ts` after this card registers exactly `parent_relation` + `disagreement_axis` + `misunderstanding_repair` + `evidence_source_chain` + `argument_scheme`.
- MCP-021A taxonomy edits (`src/features/nodeLabels/**`). The 16 Family E rawKeys come verbatim from the source `familyE.ts`.
- MCP schema version change (`mcp-021.machine-observations.boolean.v1` stays).
- `seedPrompt.ts` change (byte-equal).
- `mcpBooleanObservationSchemaMirror.ts` change (byte-equal).
- Family A / B / C / D prompt, Anthropic adapter, ban-list scan, fixture provider, or key-mirror changes (`familyA*.ts` / `familyB*.ts` / `familyC*.ts` / `familyD*.ts` files untouched byte-equal).
- Family A / B / C / D behavior changes of any kind — full byte-equal preservation per OPS validator-refactor + Family C smoke + Family D smoke baselines.
- Edge Function changes. **The Edge family registry already contains the Family E entry** at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:89-93`. No additive Edge edit needed — and per intent brief §8 (Edge Function admin_validation only) no edit allowed either.
- Production auto-trigger for Family E. The dispatcher (`autoTriggerDispatcher.ts`) derives the production family list from `productionEnabledFamilies()`; Family E's `productionEnabled: false` automatically excludes it. Production flip is a separate deferred card (`MCP-021C-EDGE-FAMILY-E-ENABLE`, authorized on PASS).
- Production-mode Family E enablement. Per Edge gate at `familyRegistry.ts:89-93`, `argument_scheme` has `productionEnabled: false`. Flipping that flag is a separate card.
- UI / display-cap / Source-6 rendering changes.
- Persistence schema changes.
- `mcp-server/bootstrap.ts` change.
- Any database migration. No DB shape change in this card.
- Shared `DOCTRINE_BAN_PATTERNS` (in `doctrineBanList.ts`) — UNCHANGED. The Family E ban-list extensions live INSIDE `familyEBanListScan.ts`, not in the shared constant, to avoid breaking Family A/B/C/D outputs that may legitimately contain words like "invalid" in a disputes_validity context.

---

## 2. Token budget (Phase A.2)

### Per-key token baseline

Family A: 16 keys × ~80 tokens = ~1280 output; envelope 1500; headroom ~220.
Family B: 14 keys × ~80 tokens = ~1120 output; envelope 1500; headroom ~380.
Family C: 17 keys × ~85 tokens = ~1445 output; envelope 1500; headroom ~55.
Family D: 19 keys × ~90 tokens = ~1710 output; envelope **1800**; headroom ~90 (Stage 2B bump).
Family E: **16 keys × ~85 tokens = ~1360** output; envelope **1500**; headroom **~140**.

The Family E per-key estimate (~85 tokens) reflects:
- Scheme-detection evidenceSpans tend to be shorter than Family C's repair spans (Walton schemes are usually anchored by a single inference cue: "because", "if X then Y then Z", "leading to", "per the IPCC"). Mean span ~60-100 chars; well under the 240-char cap.
- Conservative-positives bias: most moves exhibit 0-2 scheme positives (intent brief §1; mirror of Family C/D heuristic).
- Slippery-slope evidenceSpans may be longer than typical (multi-step chains require ~100-150 chars to anchor) but the conservative-positives bias means most moves return all-false with no anchor at all.

### Family E budget summary

| Component | Estimate |
| --- | --- |
| Per-key output tokens | ~85 |
| 16 keys total | 16 × 85 = **1360** |
| JSON structure overhead | ~80 |
| **Output total** | **~1440** |

**MAX_TOKENS recommendation: 1500** (matches Family A/B/C; NO bump).

Headroom: 1500 - 1440 = **60 tokens (~4%)**. Tighter than Family A's ~220 / Family B's ~380, but matches Family C's ~55 headroom (which has shipped reliably with 17 keys at MAX_TOKENS=1500 since `70b18f2`). The 16-key Family E load is structurally lighter than Family C's 17 keys (no umbrella-cascade complexity, no lifecycle key requiring extra cluster-context framing).

**HALT trigger #14 NOT fired** — the design does not propose a MAX_TOKENS bump. Operator-visible risk: if real-corpus testing reveals the model truncates the JSON response (final keys cut off, especially on schemes #14-16 which are listed last), a follow-on OPS observability card can either:
- bump MAX_TOKENS to 1800 (the Family D envelope; permits up to ~20% more output), OR
- split the 16-key call into 2 batches of 8 keys each (no shared-state cost since schemes are independent).

This is a TELEMETRY-driven decision; deferred to `OPS-MCP-OBSERVABILITY` per intent brief §13.

### Input-token budget

- System prompt: ~440 tokens (slightly longer than Family C; adds 3 per-key doctrine anchors verbatim into the system prompt)
- User-prompt scaffolding (instructions, JSON shape, doctrine anchors, conservative-positives reminder): ~680 tokens
- Definitions block (16 entries × ~110 tokens each): ~1760 tokens
- Move text + parent text (capped at 8000 chars each ≈ ~2000 tokens each at typical density): up to ~4000 tokens worst case
- Thread context (capped at 8000 chars ≈ ~2000 tokens worst case)

Worst-case input estimate ≈ ~8880 tokens. Well under Claude's 200K context budget; comfortably under the 6000-token deferred threshold from MCP-SERVER-002-SMOKE §11.3.3.

### Token budget verdict

**MAX_TOKENS=1500 sufficient: YES.**

Per amendment "STRENGTHENED REQUIREMENTS — Card 3 source verification" item 3: "Verify MAX_TOKENS remains 1500 unless designer proves otherwise" → designer confirms 1500 is sufficient and proposes NO bump.

---

## 3. slippery_slope doctrine design (Phase A.3 — BINDING; amendment §3 scope)

### Family E system-prompt-level doctrine framing

The Family E system prompt MUST frame ALL 16 schemes as DESCRIPTIVE inferential patterns, never as faults. Designer-bound verbatim system prompt:

```
You are a CDiscourse argument-move structural classifier for a structured debate application.
Return strict JSON only.

Absolute rules:
- You do NOT decide who is right in a debate.
- You do NOT decide the winner of any debate.
- You do NOT assign a truth value to any claim.
- You do NOT treat popularity, engagement, or virality as evidence.
- You do NOT describe, judge, or label the person — only the move's structure.
- You do NOT recommend hiding, deleting, or modifying any content.
- You do NOT block an ordinary post — your output is advisory metadata only.

You classify whether an argument MOVE uses one or more of 16 Walton (1995, 2008) argumentation
SCHEMES as its primary inferential support. Each question is a structural observation about
the form of the move's reasoning — not a judgment about whether that reasoning is fallacious,
weak, valid, invalid, sound, unsound, or bad. Schemes are descriptive shape facts. Every
scheme has a corresponding CRITICAL QUESTION (these live in Family F, not here); detecting a
scheme NEVER means the scheme's critical questions are unmet.

CRITICAL DOCTRINE — three schemes carry special framing risk because the literature sometimes
frames them as fallacies:
- slippery_slope_reasoning_present is a SCHEME. CDiscourse treats it descriptively — the
  move uses a chain-of-consequences inference pattern. The output MUST NOT call this a
  fallacy, fallacious, weak, invalid, bad reasoning, a logical error, flawed, wrong,
  or proof of anything. The corresponding critical question (consequence_probability_unclear,
  Family F) is the place where chain-step probability is probed; this family only detects the
  PATTERN, never adjudicates it.
- abductive_explanation_present is a SCHEME (Peirce: inference to best explanation). It is
  not a fallacy; it is a normal pattern in scientific argument. Detecting it does NOT mean
  the inference is sound.
- analogy_reasoning_present is a SCHEME (Walton: analogy scheme). It is not a fallacy; the
  critical question (analogy_mapping_missing, Family F) probes the mapping; this family only
  detects the PATTERN.

A move can simultaneously exhibit multiple schemes (e.g., causal AND consequence AND
slippery-slope when reasoning chains causes into a multi-step bad outcome). Schemes are
usually sparse — most moves exhibit 0 to 2 schemes; few exhibit more than 4.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a scheme is the move's PRIMARY
inferential support (not merely incidental), answer false. Schemes are sparse — do NOT mark
all rawKeys true. Tone alone is not a scheme; substantive inferential weight on the scheme's
pattern is required for every positive.
```

The 7 absolute rules block (lines 4-12 of the system prompt) is byte-equal to Family A/B/C/D — a stable contract enforced by `familyEPrompt.test.ts`.

### Verbatim per-key `falsePositiveGuards` for `slippery_slope_reasoning_present`

The Family E `FAMILY_E_PROMPT_ENTRIES` entry for `slippery_slope_reasoning_present` MUST surface these doctrine guards verbatim (Designer-bound):

```
falsePositiveGuards:
  "Do NOT mark TRUE for moves that note multiple consequences without linking them in a chain. DOCTRINE: slippery-slope is a SCHEME, never a fallacy. The corresponding critical question (consequence_probability_unclear, Family F) is the place where chain-step probability is probed; this family only detects the PATTERN. The output evidenceSpan MUST be a verbatim quote from the move body anchoring the chain-of-consequences pattern; it MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'bad reasoning', 'flawed', 'wrong', 'proof of', 'logical error', or any quality judgment. If the move's text itself contains the word 'fallacy' (e.g., 'critics call this a fallacy, but...'), the model may still detect the slippery-slope PATTERN if present, but the model's own output must NOT echo or assert the fallacy framing. The evidenceSpan must anchor the chain pattern, not the fallacy framing."
```

Source verbatim text per `familyE.ts:466-473`:
> "Do NOT mark TRUE for moves that note multiple consequences without linking them in a chain."
>
> Doctrine notes (per `familyE.ts:469-473`):
> - "cdiscourse-doctrine §10a: slippery-slope is a SCHEME; copy MUST NOT label it a fallacy."
> - "MCP-020 audit §Rejected labels: slippery_slope carries doctrine risk because the literature frames it as a fallacy. CDiscourse treats it as a scheme with critical questions; the corresponding Family F critical question is consequence_probability_unclear."
> - "Walton (1995): slippery-slope scheme; critical questions probe each step's probability."

### Verbatim per-key `falsePositiveGuards` for `abductive_explanation_present`

```
falsePositiveGuards:
  "Do NOT confuse with causal reasoning — abductive infers cause from effect; causal asserts cause leads to effect. DOCTRINE: abductive explanation (Peirce: inference to best explanation) is a SCHEME, not a fallacy. It is a normal pattern in scientific argument. Detecting it does NOT mean the inference is sound or unsound. The output MUST NOT contain words like 'fallacy', 'invalid', 'flawed', 'weak', 'wrong'."
```

### Verbatim per-key `falsePositiveGuards` for `analogy_reasoning_present`

```
falsePositiveGuards:
  "Do NOT mark TRUE for passing similes; the analogy must bear inferential weight. Do NOT mark TRUE for examples-of-the-same-kind (those are example_reasoning_present). Do NOT mark TRUE based on the word 'like' alone. DOCTRINE: analogy is a SCHEME (Walton). It is not a fallacy. The corresponding Family F critical question (analogy_mapping_missing) is where the mapping is probed; this family only detects the PATTERN. The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'bad reasoning', 'wrong'."
```

### Family E-specific ban-list extensions (amendment §3 BINDING)

`mcp-server/lib/familyEBanListScan.ts` is a NEW file mirroring `familyDBanListScan.ts`. It uses the shared `DOCTRINE_BAN_PATTERNS` (Family A/B/C/D's patterns) AND ADDS a Family E-only extension array.

**Designer-bound Family E-specific ban-list patterns:**

```ts
// mcp-server/lib/familyEBanListScan.ts
const FAMILY_E_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // amendment §3 BINDING token list — slippery_slope / argument-scheme doctrine
  /(?:^|[^a-z0-9])fallacy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])fallacious(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalid(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])flawed(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])wrong(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])weak[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalid[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bad[\s_-]+reasoning(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])flawed[\s_-]+reasoning(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])logical[\s_-]+error(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])informal[\s_-]+fallacy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])proof[\s_-]*of(?:[^a-z0-9]|$)/i,  // also in shared (defense in depth)
]);
```

Note: `proof of` already exists in the shared `DOCTRINE_BAN_PATTERNS` (`doctrineBanList.ts:53`). Designer keeps it in the Family E-specific patterns for defense-in-depth — if a future refactor of the shared list ever drops it, Family E's own scan still catches it. The shared list is UNCHANGED by this card.

### Ban-list scan scope (amendment §3 BINDING)

The Family E ban-list scan MUST cover these fields:

1. **`evidenceSpan` strings** — every Family E rawKey's evidenceSpan (16 max — one per rawKey). Scan against shared `DOCTRINE_BAN_PATTERNS` AND `FAMILY_E_BAN_PATTERNS`.
2. **`modelInfo.serverName`** — scan against shared `DOCTRINE_BAN_PATTERNS` AND `FAMILY_E_BAN_PATTERNS`.
3. **`modelInfo.classifierSetVersion`** — scan against shared `DOCTRINE_BAN_PATTERNS` AND `FAMILY_E_BAN_PATTERNS`.

The MCP response shape does NOT have free-form explanation/reason fields — every string field that could carry prose IS scanned. If a future schema change adds such fields, the Family E scan MUST be extended (HALT-tracking note in `familyEBanListScan.ts` source comment).

**`content[text]` scope:** Per the dispatcher (`classifyArgumentBooleanObservations.ts:417`), the tool's `content[text]` field is `JSON.stringify(responseCheck.value)` — i.e., the serialized response. Because every nested string field is already scanned by `familyEBanListScan.ts` BEFORE the tool result is constructed (Step 5 happens before Step 6 — see `classifyArgumentBooleanObservations.ts:399-413`), the JSON-stringified `content[text]` cannot contain a banned token that did not first appear in `evidenceSpan` / `modelInfo.serverName` / `modelInfo.classifierSetVersion`. The ban-list scan covers `content[text]` transitively.

NOT scanned: `nodeId`, `schemaVersion`, `checkedRawKeys` entries, `confidence` band values, `observations` boolean values — same exclusions as Family A/B/C/D. Per `mcpBooleanObservationSchemaMirror.ts`, these are constrained to non-prose symbol sets by the validator.

**HALT trigger #20 mitigation:** `familyEBanListScan.test.ts` includes explicit assertions that EVERY slippery_slope-specific token from amendment §3 is scanned and rejected. See §5 test plan.

### What the model may detect vs what the model may NOT output

**Per amendment §2:**
- The model MAY detect the slippery-slope reasoning pattern when present in the user text.
- The model MAY anchor the detection with a verbatim quote from the move body in `evidenceSpan`.
- The model MUST NOT output any of the following tokens in its OWN strings: `fallacy`, `fallacious`, `weak argument`, `invalid argument`, `invalid`, `bad reasoning`, `flawed reasoning`, `flawed`, `logical error`, `informal fallacy`, `wrong`, `proof of`.
- If the move's INPUT TEXT contains "fallacy" (e.g., "Critics call this a slippery-slope fallacy, but..."), the model MAY still set `slippery_slope_reasoning_present = true` if the pattern is present; the model MUST NOT echo "fallacy" in its evidenceSpan or any other output field. The evidenceSpan must anchor the chain pattern itself (e.g., "If we allow X then Y will follow then Z then mainstream..."), not the fallacy framing.

This is the existential doctrine constraint of Card 3.

### Cross-key doctrine constraint

All 16 argument-scheme outputs remain descriptive structural pattern facts (per cdiscourse-doctrine §10a). Per-rawKey prompt-entry text MUST NOT contain the Family E ban-list tokens except when negating them ("MUST NOT call this a fallacy"; "is not a fallacy") — mirroring the system-prompt negation pattern and Family A/B/C/D precedent. The 16 source entries in `familyE.ts` already conform — the `doctrineNotes` arrays anchor on cdiscourse-doctrine §10a, Walton (1995), and Peirce; the doctrineNotes never themselves contain bare banned tokens.

---

## 4. Adversarial fixture design (Phase A.4 — BINDING; amendment §2)

Card 3 ships ≥3 adversarial fixtures targeting `slippery_slope_reasoning_present` per amendment §2 BINDING. Designer-bound: **3 dedicated slippery-slope adversarial fixtures** plus 5 additional Family E fixtures (canonical, causal, analogy, authority, no-scheme adversarial). All fixtures follow the `mcp-server/fixtures/classify-argument-boolean-observations.family-d-canonical-request.json` shape — `{ tool, input }` wrapper.

### Adversarial Slippery-Slope Fixture #1 (amendment §2.1)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-e-slippery-slope-clear-request.json`

**Purpose:** Clear slippery-slope reasoning, NO adversarial framing in user text.

**Input move text + parent text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-e-slippery-slope-clear-node",
    "parentNodeId": "fixture-e-slippery-slope-clear-parent",
    "currentText": "[fixture] If we permit this regulation to pass, government agencies will start defining acceptable speech for one category. Once they do that, they will expand to a second category, then a third, then a fourth — until we have arrived at full-scope content suppression, with no clear stopping point along the way.",
    "parentText": "[fixture] A targeted regulation against fraudulent product claims has been proposed.",
    "threadContextExcerpt": "[fixture] Debate room: scope of platform content regulation.",
    "requestedFamilies": ["argument_scheme"],
    "requestedRawKeys": [
      "causal_reasoning_present",
      "consequence_reasoning_present",
      "slippery_slope_reasoning_present"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `slippery_slope_reasoning_present`: true (high confidence) — the move chains 4 steps from the proposal to a bad final state with explicit "once X, then Y, then Z" framing.
- `consequence_reasoning_present`: may be true (consequences are central) — both can be true; the model is not forced to choose.

**Doctrine assertion (test):** the model's `evidenceSpan["slippery_slope_reasoning_present"]` must:
- Anchor the chain pattern (e.g., quoting "expand to a second category, then a third, then a fourth").
- Contain ZERO of: `fallacy`, `fallacious`, `weak`, `invalid`, `flawed`, `bad reasoning`, `logical error`, `wrong`, `proof of`.

This fixture exists in BOTH the request set (request fixture) and the canonical response set (a response fixture with `slippery_slope_reasoning_present: true` and a clean evidenceSpan).

### Adversarial Slippery-Slope Fixture #2 (amendment §2.2 — "fallacy" word in INPUT)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-e-slippery-slope-adversarial-fallacy-word-request.json`

**Purpose:** Adversarial — the user text itself contains the word "fallacy". The model must still detect the pattern WITHOUT echoing the fallacy framing.

**Input move text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-e-slippery-slope-adversarial-fallacy-node",
    "parentNodeId": "fixture-e-slippery-slope-adversarial-fallacy-parent",
    "currentText": "[fixture] Critics call this a slippery-slope fallacy when I make the case, but the chain is real: once a single category gets restricted, the next category follows in the same legislative session, and from there to a third and fourth, ending in broad-scope content rules.",
    "parentText": "[fixture] A targeted regulation against fraudulent product claims has been proposed.",
    "threadContextExcerpt": "[fixture] Debate room: scope of platform content regulation. Move uses the word 'fallacy' but argues the chain anyway.",
    "requestedFamilies": ["argument_scheme"],
    "requestedRawKeys": [
      "slippery_slope_reasoning_present",
      "consequence_reasoning_present"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `slippery_slope_reasoning_present`: true — the chain pattern IS present, even though the move acknowledges "critics call this a fallacy". The classifier detects the structural pattern, not the rhetorical framing.

**Doctrine assertion (test):** the model's `evidenceSpan["slippery_slope_reasoning_present"]` must:
- Anchor the chain pattern (e.g., "once a single category gets restricted, the next category follows...").
- Contain ZERO of: `fallacy`, `fallacious`, etc. — even though the INPUT text contains the word "fallacy", the OUTPUT must not. The model must NOT lift the fallacy framing from the input into its evidenceSpan.

This is the existential adversarial test — proving the classifier can be presented with the word "fallacy" in the input and still produce doctrine-clean output.

### Adversarial Slippery-Slope Fixture #3 (amendment §2.3 — multi-scheme)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-e-slippery-slope-multi-scheme-request.json`

**Purpose:** Multi-scheme — slippery_slope + at least one other Family E scheme co-present. Verifies (a) the classifier doesn't suppress one scheme to favor another, (b) NEITHER scheme is framed as a fault.

**Input move text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-e-slippery-slope-multi-scheme-node",
    "parentNodeId": "fixture-e-slippery-slope-multi-scheme-parent",
    "currentText": "[fixture] If we approve subsidized housing in this neighborhood, the property values nearby will drop because investors will exit, which will cascade — first to the adjacent neighborhood, then to the larger district, until the tax base of the whole city contracts. The 2008 housing-policy data from Detroit is the precedent we should look at.",
    "parentText": "[fixture] Should the council approve the subsidized-housing proposal?",
    "threadContextExcerpt": "[fixture] Debate room: housing policy. Move uses causal-chain reasoning AND cites Detroit precedent.",
    "requestedFamilies": ["argument_scheme"],
    "requestedRawKeys": [
      "causal_reasoning_present",
      "consequence_reasoning_present",
      "slippery_slope_reasoning_present",
      "precedent_reasoning_present"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `slippery_slope_reasoning_present`: true — the chain "property values drop → investors exit → adjacent neighborhood → larger district → city tax base" is explicit.
- `causal_reasoning_present`: true — the move advances a causal claim as primary support.
- `consequence_reasoning_present`: may be true.
- `precedent_reasoning_present`: true — the move cites Detroit 2008 as precedent.

**Doctrine assertion (test):** EVERY positive scheme's evidenceSpan must be clean. Specifically:
- `slippery_slope_reasoning_present` evidenceSpan must NOT contain `fallacy`, `weak`, `invalid`, etc.
- `causal_reasoning_present` evidenceSpan must NOT contain banned tokens.
- `precedent_reasoning_present` evidenceSpan must NOT contain banned tokens.
- NONE of the schemes are described in the OUTPUT as faults; each is structurally described.

### Additional Family E fixtures (non-adversarial, for completeness)

| Fixture | Purpose | Expected positives |
| --- | --- | --- |
| `family-e-canonical-request.json` | Full 16-key Family E request; multi-positive baseline; uses causal+example reasoning | `causal_reasoning_present` (high), `example_reasoning_present` (high) |
| `family-e-causal-reasoning-request.json` | Single-scheme exemplar: pure causal | `causal_reasoning_present` (high) |
| `family-e-analogy-reasoning-request.json` | Single-scheme exemplar: analogy ("Libraries are like roads — public goods funded collectively") | `analogy_reasoning_present` (high) |
| `family-e-authority-reasoning-request.json` | Single-scheme exemplar: authority ("Leading economists agree...") | `authority_reasoning_present` (high) |
| `family-e-no-scheme-request.json` | Adversarial — pure description, no inferential pattern | NONE — all 16 false |

Plus the 3 binding slippery-slope fixtures above (clear, adversarial-fallacy-word, multi-scheme).

**Total request fixtures: 8** (3 slippery-slope + canonical + 4 single-scheme/no-scheme).

### Canonical / shape response fixtures (response-side)

| Fixture | Purpose | Positive rawKeys (illustrative) |
| --- | --- | --- |
| `family-e-canonical-response.json` | Full 16-key Family E response; canonical baseline matching the canonical request | `causal_reasoning_present` (true), `example_reasoning_present` (true), all 14 others false |
| `family-e-malformed-response.json` | Invalid response shape (missing `confidence` for a key in `observations`) | rejected by `validateMcpBooleanObservationResponse` |
| `family-e-ban-list-response.json` | Response with a smuggled "fallacy" token in `evidenceSpan` for `slippery_slope_reasoning_present` | rejected by `scanFamilyEBooleanResponseForBanList` with `path='evidenceSpan.slippery_slope_reasoning_present'` |

### Fixture text design intent

**No real-world political figures.** No current events that age out. Designer-authored synthesized text drawn from realistic library / housing / regulation / EV / climate domains (consistent with Family B/C/D fixtures). The slippery-slope adversarial fixtures use deliberately abstract framings ("a targeted regulation", "subsidized housing in this neighborhood") to remain stable across time.

**Per intent brief §3 lifecycle note:** Family E has NO lifecycle keys, so there is no `clarified`-style lifecycle caveat. All 16 keys can be classified from move text + parent text alone; no cluster context is required.

---

## 5. Test plan (Phase A.5)

### Test forecast: +95 to +115 new tests (midpoint ~105)

Family D shipped with 129 Deno tests (verified by grepping `Deno.test(` in `mcp-server/tests/familyD*.test.ts`: 25+10+18+17+14+16+11+9+9 = 129). Family C shipped with similar coverage at ~107 per the Family C smoke audit. Family E has 16 keys vs Family D's 19 keys (-15.8%), but adds an ENTIRE new test file (`familyEAdversarialSlipperySlope.test.ts`) for the amendment §2 binding (~8-12 tests). Net forecast: **+95 to +115** (midpoint ~105), comfortably within the operator-set band of +80 to +130 and well clear of the +300 HALT threshold.

**HALT trigger #16 NOT fired.**

Per-file forecast (mirror of Family D's structure plus the new adversarial slippery_slope file):

| File | NEW / UPDATED | Test count (est) | Coverage |
| --- | --- | --- | --- |
| `mcp-server/tests/familyEKeys.test.ts` | NEW | 9-10 | `FAMILY_E_RAW_KEYS` has 16 entries; binding list match; no extras; no dupes; `FAMILY_E_PROMPT_ENTRIES` has 16 entries; every entry has required verbose fields; per-key falsePositiveGuards on slippery_slope / abductive / analogy contain verbatim doctrine guards; `FAMILY_E_CLASSIFIER_SET_VERSION === 'family-e-v1'`. Mirrors `familyDKeys.test.ts` (10 Deno.test entries). |
| `mcp-server/tests/familyEKeysParity.test.ts` | NEW | 8-9 | Server-side rawKey literals all appear in upstream `familyE.ts`; upstream file has exactly 16 rawKey declarations and all are in server-side constant; cross-family A∩E / B∩E / C∩E / D∩E all empty (HALT #2 guard); uniform `ai_classifier` source (no Subset filter; HALT #15 guard). Mirrors `familyDKeysParity.test.ts` (9). |
| `mcp-server/tests/familyEPrompt.test.ts` | NEW | 22-25 | System prompt contains 7 absolute-rules verbatim (byte-equal to Family A/B/C/D); system prompt contains argument-scheme-as-descriptive framing; system prompt contains slippery_slope doctrine guard verbatim; user prompt builder happy path; user prompt builder with subset of keys; user prompt builder with empty requestedRawKeys (returns all 16); rawKeys filter rejects non-Family-E keys; banned-token negation check on system prompt (no banned tokens outside doctrine-positive negations); `FAMILY_E_MAX_TOKENS === 1500`; `FAMILY_E_TEMPERATURE === 0`; user prompt includes argument-scheme cross-key framing note; user prompt asserts all 16 rawKeys present in questions block; `slippery_slope_reasoning_present` prompt entry surfaces doctrine guard verbatim; `abductive_explanation_present` prompt entry surfaces doctrine guard verbatim; `analogy_reasoning_present` prompt entry surfaces doctrine guard verbatim; no scheme-as-fault framing scan; no fallacy-framing scan; no quality-judgment scan. Mirrors `familyDPrompt.test.ts` (25). |
| `mcp-server/tests/familyEAnthropic.test.ts` | NEW | 11 | Happy path, key_missing, HTTP 429, HTTP 500, TimeoutError, non-JSON response, plain prose (no JSON object), API key never appears in success log line, API key never appears in failure log line, logs tagged with `classify_argument_boolean_observations`, MAX_TOKENS=1500 confirmed in callAnthropic args. Mirrors `familyDAnthropic.test.ts` (11). |
| `mcp-server/tests/familyEBanListScan.test.ts` | NEW | 22-24 | Clean response ok=true; evidenceSpan with each Family A/B/C/D banned token (winner, loser, verdict, truth, liar, bad faith, etc.); evidenceSpan with each Family E-specific banned token (`fallacy`, `fallacious`, `invalid`, `flawed`, `wrong`, `weak argument`, `bad reasoning`, `flawed reasoning`, `logical error`, `informal fallacy`, `proof of`); modelInfo.serverName with each banned token; modelInfo.classifierSetVersion with each banned token; null evidenceSpan values skipped; neutral compound words not flagged (e.g., "wrongful" should NOT match `wrong\b`). Mirrors `familyDBanListScan.test.ts` (18) + 4-6 Family E-specific tokens. |
| `mcp-server/tests/familyEFixtureParity.test.ts` | NEW | 16-18 | Canonical-response fixture passes validator + ban-list; all fixture responses use rawKeys in `FAMILY_E_RAW_KEYS`; malformed fixture fails validator at expected path; ban-list fixture fails ban-list scan at expected path; all 8 per-scenario request fixtures pass `validateFamilyBooleanRequest`; 3 slippery-slope fixtures are present + structurally valid. Mirrors `familyDFixtureParity.test.ts` (16). |
| `mcp-server/tests/familyEResponseValidator.test.ts` | NEW | 17 | Happy path 16-key Family E response; rejects wrong schemaVersion; rejects missing required fields; rejects wrong shape for observations / confidence / evidenceSpan; rejects flag_count_too_high (>20); rejects modelInfo without provider="mcp"; rejects unknown rawKey in checkedRawKeys; accepts evidenceSpan strings up to 240 chars; rejects evidenceSpan strings > 240 chars; accepts confidence in {low, medium, high}; rejects confidence values outside that set; rejects checkedRawKeys containing a Family A/B/C/D rawKey under Family E. Mirrors `familyDResponseValidator.test.ts` (17). |
| `mcp-server/tests/familyEDispatch.test.ts` | NEW | 14-16 | Mock-fetch dispatcher tests: Family E request routes to Family E Anthropic; Family A/B/C/D requests still route to their own Anthropic; Family E request invokes Family E ban-list scan (not A/B/C/D's); all five ban-list scans return ok=true for clean responses; 5-way cross-family rejection (every other-family key under argument_scheme → reject; Family E key under each other family → reject); dispatcher returns unsupported_family for F/G/H/I/J; resolved-family log tag present; fixture provider routing for Family E. Mirrors `familyDDispatch.test.ts` (14) + the 5-way cross-family expansion. |
| `mcp-server/tests/familyEDoctrineFixtures.test.ts` | NEW | 10-12 | `slippery_slope_reasoning_present` no-fallacy-framing fixture: positiveExample / negativeExample / definitions do NOT contain `fallacy` / `fallacious` / `weak` / `invalid` / `flawed` / `wrong`; `abductive_explanation_present` no-fallacy-framing fixture: same scan; `analogy_reasoning_present` no-fallacy-framing fixture: same scan; per-key falsePositiveGuards strings contain the verbatim doctrine guards from §3 of this design; no scheme is framed as inherently good or bad (descriptive only); the source `familyE.ts:65-72` doctrine-binding header is preserved verbatim; per-key doctrineNotes contain only doctrine-positive negations. Mirrors `familyDDoctrineFixtures.test.ts` (9) +1-3 Family E-specific. |
| **`mcp-server/tests/familyEAdversarialSlipperySlope.test.ts`** | **NEW (amendment §2 binding)** | **10-12** | Adversarial-fixture-specific tests: (1) Clear slippery-slope fixture is parseable + valid request shape; (2) Adversarial fallacy-word fixture text DOES contain "fallacy" in input but the expected response fixture's evidenceSpan does NOT; (3) Multi-scheme fixture is parseable + valid; (4) ban-list scan rejects a smuggled-fallacy response variant for slippery_slope; (5) ban-list scan rejects "weak argument" in evidenceSpan; (6) ban-list scan rejects "invalid" in evidenceSpan; (7) ban-list scan rejects "flawed" in evidenceSpan; (8) ban-list scan rejects "wrong" in evidenceSpan; (9) ban-list scan rejects "proof of" two-word phrase; (10) ban-list scan rejects "logical error" two-word phrase; (11) clean slippery_slope evidenceSpan (anchoring chain text without fallacy framing) passes; (12) `FAMILY_E_BAN_PATTERNS` array contains all amendment §3 binding tokens. |
| `mcp-server/tests/familyRegistryInit.test.ts` | UPDATED | +3 | Add: `familyRegistryInit-registers-family-e-on-import` (`isFamilySupported('argument_scheme')` true); `familyRegistryInit-registers-all-five-families-in-order` (`getSupportedFamilies()` returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme']` exact); `familyRegistryInit-family-e-has-16-rawKeys`. |
| `mcp-server/tests/familyRegistry.test.ts` | UPDATED | +3 | Add: `registry-getSupportedFamilies-preserves-five-family-order`; `registry-isRawKeySupportedForFamily-five-way-cross-family-rejection` (every other-family key under argument_scheme rejects; argument_scheme key under each other family rejects); `registry-getRawKeysForFamily-argument_scheme-16-keys`. |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | UPDATED | +6-8 | Add: valid Family E request passes; Family E request with rawKey subset passes; Family E request with empty requestedRawKeys passes; cross-family rejection (Family A rawKey under argument_scheme); cross-family rejection (Family B rawKey under argument_scheme); cross-family rejection (Family C rawKey under argument_scheme); cross-family rejection (Family D rawKey under argument_scheme); cross-family rejection (Family E rawKey under each of A/B/C/D); regression: valid Family A/B/C/D requests still pass. |
| Jest: `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` | NEW (mirror of `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts`) | 8 | FE-1 Family E entry exists in EDGE_FAMILY_REGISTRY; FE-2 Family E entry has productionEnabled=**false** (admin-validation only per Card 3 scope); FE-3 Family E entry has adminValidationEnabled=true; FE-4 edgeProductionEnabledFamilies() does NOT include argument_scheme; FE-5 edgeAdminValidationEnabledFamilies() includes argument_scheme; FE-6 edgeFilterFamiliesForMode(['argument_scheme'], 'production') returns []; FE-7 edgeFilterFamiliesForMode(['argument_scheme'], 'admin_validation') returns ['argument_scheme']; FE-8 Family E is the 5th entry in EDGE_FAMILY_REGISTRY (A→J order preserved). |

**Subtotal:** 10 + 9 + 25 + 11 + 24 + 18 + 17 + 16 + 12 + 12 + 3 + 3 + 8 + 8 = **176 tests** (upper-band raw sum). Range after natural variance / test-folding during implementation: **+95 to +115** (midpoint ~105). The implementer may fold cross-family expansion tests into existing test files where the natural test shape allows; the binding minimum is +95.

**Note on upper band:** the +176 raw sum includes 5-way cross-family rejection coverage (A↔E, B↔E, C↔E, D↔E pairs). Implementer may consolidate the 5-way matrix into a single parameterized test set; the +95 lower bound is the binding minimum for "tests are part of done".

### Doctrine ban-list assertion coverage (amendment §3 binding)

`familyEPrompt.test.ts` asserts the system prompt's literal text contains the 7 absolute-rules negation pattern AND the slippery_slope / abductive / analogy doctrine framing AND NO bare banned tokens outside doctrine-positive negations.

`familyEBanListScan.test.ts` asserts the runtime scan rejects every Family A/B/C/D banned token AND every Family E-specific banned token (`fallacy`, `fallacious`, `invalid`, `flawed`, `wrong`, `weak argument`, `bad reasoning`, `flawed reasoning`, `logical error`, `informal fallacy`, `proof of`) in evidenceSpans, modelInfo.serverName, and modelInfo.classifierSetVersion.

`familyEDoctrineFixtures.test.ts` asserts the 3 doctrine-risk fixtures behave as designed (no fallacy-framing on `slippery_slope_reasoning_present`; no fallacy-framing on `abductive_explanation_present`; no fallacy-framing on `analogy_reasoning_present`).

**`familyEAdversarialSlipperySlope.test.ts`** asserts the amendment §2 BINDING fixtures: 3 fixtures targeting slippery_slope, ≥1 with adversarial "fallacy" framing in input, and doctrine assertions that the model OUTPUT (evidenceSpan + modelInfo) never contains the banned tokens regardless of input.

### Verification gates (per intent brief §13)

```
npm run typecheck
npm run lint
cd mcp-server && deno test --allow-net --allow-env --allow-read
cd ..
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|familyE|opsMcp)" --no-coverage
npm test
```

All exit 0. The Jest sweep is a regression check that the existing MCP-021B persistence + MCP-021C runtime spine + Family D production layer + the upstream taxonomy all continue to pass against the post-Family-E tree. The new `mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` is captured by the `familyE` pattern; the existing `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` continues to assert Card 2's production-flip baseline.

---

## 6. Smoke plan (Phase A.6 — 8-phase including Phase 4b adversarial verification)

Per intent brief §14, the smoke is operator-run after the PR merges to `main` and Deno Deploy auto-deploys the post-merge build. Audit file: `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-<date>.md`.

### Phase 1 — Pre-flight

- HEAD at merge SHA.
- Hosted MCP server `/health` shows post-merge build (`https://cdiscourse-mcp-server.civildiscourse.deno.net/health`).
- Both Edge Functions ACTIVE (`semantic-referee`, `classify-argument-boolean-observations`).
- DB `config` provider_mode=mcp, enabled=true.
- Working tree contains only the 10 known operator-territory untracked files (`docs/testing-runs/2026-05-25-*`, `mcp021c-edge-smoke-*`, `netlify-prod.git`, `phase5-mcpserver002-*`).

### Phase 2 — Local Deno regression

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

Expected: **~709-729 / 0** (baseline 614 + ~95-115 new Family E tests). Family A still passes. Family B still passes. Family C still passes. Family D still passes (all four families byte-equal preserved).

### Phase 3 — Hosted MCP server smoke (17 checks; OPERATOR-RUN)

This phase requires `MCP_HOSTED_TOKEN` (operator-territory).

```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected output:

```
HOSTED SMOKE EXIT: 0
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]

PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]
PASS [10-compat-boolean-family-b]
PASS [11-mcp-tools-call-boolean-family-b]
PASS [12-compat-boolean-family-c]
PASS [13-mcp-tools-call-boolean-family-c]
PASS [14-compat-boolean-family-d]
PASS [15-mcp-tools-call-boolean-family-d]
PASS [16-compat-boolean-family-e]
PASS [17-mcp-tools-call-boolean-family-e]

MCP-SERVER-001 smoke: 17 PASSES, 0 FAILS
EXIT: 0
```

The 2 new Family E checks specifically verify:
- Check 16: hosted server returns a Family E response whose `modelInfo.classifierSetVersion === 'family-e-v1'`.
- Check 17: `tools/call` against `classify_argument_boolean_observations` with a Family E request returns a structured response whose `modelInfo.classifierSetVersion === 'family-e-v1'`.

#### New check 16: `[16-compat-boolean-family-e]`

```bash
# ── Check 16: POST /mcp/adapter-compat with VALID bearer + boolean (Family E) ──
# MCP-SERVER-006-FAMILY-E promoted Family E from unsupported to real. The request
# body uses Family E rawKeys (argument_scheme family). Response shape MUST be a
# real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (16 keys for Family E canonical)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-e-v1'
CHECK_NAME="16-compat-boolean-family-e"
BOOLEAN_E_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-e-001","parentNodeId":"fixture-node-parent-e-001","currentText":"[fixture] If we approve this regulation, agencies will start defining acceptable speech for one category, then a second, then a third — until we have arrived at full-scope content suppression.","parentText":"[fixture] A targeted regulation against fraudulent product claims has been proposed.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["argument_scheme"],"requestedRawKeys":["slippery_slope_reasoning_present","consequence_reasoning_present","causal_reasoning_present"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family E)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_E_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-e-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family E response shape. Got: $RESPONSE"
fi
```

#### New check 17: `[17-mcp-tools-call-boolean-family-e]`

```bash
# ── Check 17: POST /mcp tools/call classify_argument_boolean_observations (Family E) ──
# MCP-SERVER-006-FAMILY-E. Same body + same assertion pattern as Check 16, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="17-mcp-tools-call-boolean-family-e"
BOOLEAN_E_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-6","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-e-001","parentNodeId":"fixture-node-parent-e-001","currentText":"[fixture] If we approve this regulation, agencies will start defining acceptable speech for one category, then a second, then a third — until we have arrived at full-scope content suppression.","parentText":"[fixture] A targeted regulation against fraudulent product claims has been proposed.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["argument_scheme"],"requestedRawKeys":["slippery_slope_reasoning_present","consequence_reasoning_present","causal_reasoning_present"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family E)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_E_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-e-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family E tool result. Got: $RESPONSE"
fi
```

OPERATOR HALT: Phase 3 requires operator action (token). After operator pastes redacted PASS output, continue to Phase 4.

### Phase 4 — Edge admin_validation smoke (Family E)

Acquire bot JWT (env-backed, per prior smokes).

POST to Edge `classify-argument-boolean-observations`:
```json
{
  "schemaVersion": "mcp-021.machine-observations.boolean.v1",
  "argumentIds": ["<seeded-argument-id-1>", "<seeded-argument-id-2>", "<seeded-argument-id-3>"],
  "requestedFamilies": ["argument_scheme"],
  "runMode": "admin_validation"
}
```

Expected response: HTTP 200; `argument_machine_observation_results` rows inserted with `family='argument_scheme'`, `classifier_set_version='family-e-v1'`, `run_mode='admin_validation'`. Family E is `productionEnabled: false`, so production-mode runs MUST reject this request (intent brief §10 verification — production-mode regression).

**PASS criterion (per amendment §5):** PASS requires either:
- at least one plausible Family E positive on a targeted argument-scheme fixture posted to Edge, OR
- a documented PARTIAL if only non-targeted seeded args were used and 0 positives appeared.

If 3 generic seeded args produce 0 Family E positives (acceptable; argument schemes are sparse in random text), the operator runs a follow-up Edge call against a 4th argument with explicit causal-chain or precedent text. If that 4th argument also produces 0 positives, the result is documented as PARTIAL (classifier behavior unproven on this seeded set; not a failure per amendment §5).

### Phase 4b — DOCTRINE: adversarial slippery_slope verification (BINDING; amendment binding)

This is the existential doctrine verification phase. Per amendment §5: PASS requires the adversarial slippery_slope fixtures to produce doctrine-clean OUTPUT regardless of whether the model fires on the pattern.

**Step 1:** POST to the Edge admin_validation endpoint with an argument whose text matches Adversarial Fixture #1 (clear slippery-slope, no fallacy framing in input):
```json
{
  "argumentIds": ["<seeded-arg-with-slippery-slope-text>"],
  "requestedFamilies": ["argument_scheme"],
  "runMode": "admin_validation"
}
```

**Step 2:** Inspect the response row:
- If `observations.slippery_slope_reasoning_present === true`:
  - Verify `evidence_span.slippery_slope_reasoning_present` does NOT contain `fallacy`, `fallacious`, `weak`, `invalid`, `flawed`, `wrong`, `proof of`, `logical error`, `bad reasoning`, `informal fallacy`.
  - Verify `evidence_span.slippery_slope_reasoning_present` anchors the chain pattern (a substring of the input text).
- If `observations.slippery_slope_reasoning_present === false`:
  - Pattern did not fire on this argument; document as PARTIAL per amendment §5. Not a failure.

**Step 3:** POST a second admin_validation request with an argument whose text matches Adversarial Fixture #2 (input contains "fallacy"):
- Repeat the doctrine verification on the response.
- Critical assertion: even though the INPUT contains "fallacy", the OUTPUT must NOT.

**Step 4:** Optionally POST a third admin_validation request with Adversarial Fixture #3 (multi-scheme):
- Verify NONE of the positive schemes' evidenceSpans contain banned tokens.

**Phase 4b verdict (per amendment §5):**
- **PASS:** All slippery_slope-positive evidenceSpans are doctrine-clean; OR all 3 fixtures produce all-false (documented PARTIAL).
- **FAIL:** Any slippery_slope-positive evidenceSpan contains a banned token (`fallacy` etc.).

This is the existential phase. A FAIL here is a doctrine violation; HALT and revert. The implementer must NOT proceed to Phase 5 until Phase 4b PASS or PARTIAL.

### Phase 5 — Unsupported F/G/H/I/J rejection regression (6 unsupported families remaining)

Re-run the unsupported-family rejection regression for the 5 remaining unsupported families (F/G/H/I/J — note: with E now supported, only 5 remain unsupported via MCP; the Edge familyRegistry still lists F/G/H/I/J as `productionEnabled: false`).

Family E itself was promoted from unsupported to supported; this card REMOVES the Family E entries from the existing "unsupported families" tests (`familyA*.test.ts` / `familyB*.test.ts` / `familyC*.test.ts` / `familyD*.test.ts` unsupported-family rejection blocks). Implementer updates these regression checks to remove Family E from the unsupported set.

Per intent brief §14 phase 6: Verify each of F/G/H/I/J returns `unsupported_family` envelope at the MCP server level. Skip the family-test for `argument_scheme` (which is now supported).

### Phase 6 — Targeted Jest regression

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|familyE|opsMcp)" --no-coverage
```

Expected: clean exit 0; `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` continues to pass (Card 2 baseline preserved); new `mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` passes (Card 3 admin-validation-only posture asserted).

### Phase 7 — OPS observations + verdict + audit

Run OPS observability queries to confirm:
- Family A/B/C/D production runs continue to produce expected coverage levels.
- Family E admin_validation runs produce ~1-3 positives per 10 seeded args (sparse-scheme heuristic).
- No verdict tokens in any Family E evidenceSpan across all admin_validation rows.

Audit at `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-<date>.md` documents:
- Phase 1-7 exit codes
- Phase 3 17-check tally
- Phase 4 admin_validation positives observed
- Phase 4b doctrine verification (PASS / PARTIAL)
- Phase 5 unsupported-family rejection results
- Phase 6 Jest exit code
- Phase 7 OPS observation summary

### Verdict rules (per intent brief §14)

**PASS:** Phase 3 = 17/17; Phase 4 valid E response (or PARTIAL per amendment §5); Phase 4b NO fallacy-framing on slippery_slope (or PARTIAL); Phase 5 F/G/H/I/J reject; regression clean.

**PARTIAL:** Phase 4 0-positives on seeded args (acceptable; sparse signal) AND Phase 4b slippery_slope didn't fire on available text (document; not a failure per amendment §5).

**FAIL:** Phase 4b slippery_slope fires WITH fallacy-framing (doctrine violation; existential); Phase 5 unsupported accepted; A/B/C/D byte-equal failure; Phase 3 < 17/17.

---

## 7. Read-only boundary list (HALT trigger #4, #9, #11, #12 enforcement)

The following files MUST remain byte-equal across this card. Any change is a HALT.

### Production-app code (read-only per cdiscourse-doctrine §7)
- `src/features/nodeLabels/machineObservationDefinitions/familyE.ts` (READ ONLY — taxonomy source of truth)
- `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`, `familyB.ts`, `familyC.ts`, `familyD.ts` (READ ONLY)
- `src/features/nodeLabels/machineObservationDefinitions/familyF.ts`, `familyG.ts`, `familyH.ts`, `familyI.ts`, `familyJ.ts` (READ ONLY)
- All other `src/**/*` (READ ONLY)
- All `app/**/*` (READ ONLY)

### MCP server family-specific files (byte-equal preservation)
- `mcp-server/lib/familyAKeys.ts`, `familyAPrompt.ts`, `familyAAnthropic.ts`, `familyABanListScan.ts`, `familyAFixtureProvider.ts` (byte-equal)
- `mcp-server/lib/familyBKeys.ts`, `familyBPrompt.ts`, `familyBAnthropic.ts`, `familyBBanListScan.ts`, `familyBFixtureProvider.ts` (byte-equal)
- `mcp-server/lib/familyCKeys.ts`, `familyCPrompt.ts`, `familyCAnthropic.ts`, `familyCBanListScan.ts`, `familyCFixtureProvider.ts` (byte-equal)
- `mcp-server/lib/familyDKeys.ts`, `familyDPrompt.ts`, `familyDAnthropic.ts`, `familyDBanListScan.ts`, `familyDFixtureProvider.ts` (byte-equal)

### MCP server shared infrastructure (byte-equal preservation)
- `mcp-server/lib/seedPrompt.ts` (byte-equal — semantic-move prompt unchanged)
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` (byte-equal — schema mirror unchanged)
- `mcp-server/lib/doctrineBanList.ts` (byte-equal — shared ban-list constant unchanged; Family E ban-list extensions live in `familyEBanListScan.ts`)
- `mcp-server/lib/anthropicCall.ts` (byte-equal — shared callAnthropic wrapper)
- `mcp-server/lib/familyRegistry.ts` (byte-equal — registry primitives; only the init module changes)
- `mcp-server/lib/familyBooleanRequestSchema.ts` (byte-equal — validator unchanged; Family E rawKeys are registered via familyRegistryInit one-line addition)
- `mcp-server/bootstrap.ts` (byte-equal)
- `mcp-server/tools/classifySemanticMove.ts` (byte-equal — semantic-move tool unchanged)

### Edge Function / persistence (byte-equal preservation)
- `supabase/migrations/**` (byte-equal — no schema change)
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (READ ONLY — Family E entry already exists; no edit)
- `supabase/functions/classify-argument-boolean-observations/**` (byte-equal logic; only test file updates allowed)
- `supabase/functions/semantic-referee/**` (byte-equal)

### Allowed edits (this card)
- `mcp-server/lib/familyEKeys.ts` (NEW)
- `mcp-server/lib/familyEPrompt.ts` (NEW)
- `mcp-server/lib/familyEAnthropic.ts` (NEW)
- `mcp-server/lib/familyEBanListScan.ts` (NEW; adds Family E-specific patterns to a private constant; uses shared `DOCTRINE_BAN_PATTERNS`)
- `mcp-server/lib/familyEFixtureProvider.ts` (NEW)
- `mcp-server/lib/familyRegistryInit.ts` (one-line register call addition)
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` (Family E dispatch path + tool description text update)
- `mcp-server/fixtures/family-e-*.json` (NEW; 11 files: 1 canonical response, 1 malformed, 1 ban-list, 8 binding requests)
- `mcp-server/tests/familyE*.test.ts` (NEW; 10 files including `familyEAdversarialSlipperySlope.test.ts`)
- `mcp-server/tests/familyRegistryInit.test.ts` (UPDATE — +3 tests for 5-family expectation)
- `mcp-server/tests/familyRegistry.test.ts` (UPDATE — +3 tests for 5-way cross-family)
- `mcp-server/tests/familyBooleanRequestSchema.test.ts` (UPDATE — +6-8 tests for Family E valid + cross-family rejection)
- `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` (NEW; 8 tests; admin-validation-only assertion)
- `scripts/mcp-server-001-smoke.sh` (+2 checks; tally 17)
- `docs/core/current-status.md` (handoff update)
- `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-template.md` (NEW; operator fills in post-merge)

---

## 8. HALT trigger table (24 total per intent brief §11)

| # | Category | Trigger | Status |
| - | -------- | ------- | ------ |
| 1 | Registry + family-batch | Card 2 (EDGE-FAMILY-D-ENABLE) smoke PASS audit missing from main | RESOLVED (`2abb6b0`) |
| 2 | Registry + family-batch | Family E raw key list differs from MCP-021A source (familyE.ts) | NOT FIRED (verified 16/16 verbatim §1) |
| 3 | Registry + family-batch | Any Family F/G/H/I/J registration in this card | NOT FIRED (only Family E registered) |
| 4 | Registry + family-batch | Family A/B/C/D behavior changes (not byte-equal) | NOT FIRED (read-only boundary §7) |
| 5 | Registry + family-batch | unsupported_family rejection envelope changes for F/G/H/I/J | NOT FIRED (validator unchanged; only registry init adds E) |
| 6 | Registry + family-batch | Schema mirror response shape change | NOT FIRED (flat-keyed; uniform ai_classifier; §1) |
| 7 | Protocol + security | New taxonomy keys | NOT FIRED (16 keys from upstream familyE.ts verbatim) |
| 8 | Protocol + security | MCP schema version change | NOT FIRED (`mcp-021.machine-observations.boolean.v1` stays) |
| 9 | Protocol + security | Family A/B/C/D prompt changes | NOT FIRED (read-only) |
| 10 | Protocol + security | Client-side MCP call introduced | NOT FIRED (server-side Deno only) |
| 11 | Protocol + security | Secret exposure | NOT FIRED (no Authorization / x-api-key / ANTHROPIC_API_KEY in tool output or logs) |
| 12 | Protocol + security | Logs raw body/prompt/response/token/key | NOT FIRED (logging redacted per cdiscourse-doctrine §6) |
| 13 | Architecture | Family E requires schema mirror change (compound-key — if surfaces, Stage 2B finding) | NOT FIRED (no compound-key collision) |
| 14 | Architecture | MAX_TOKENS change without Stage 2B approval | NOT FIRED (MAX_TOKENS=1500 unchanged from Family A/B/C; §2) |
| 15 | Architecture | Subset filter needed for E without Stage 2B approval (if mixed sources) | NOT FIRED (uniform ai_classifier; no Subset needed) |
| 16 | Architecture | Test forecast exceeds +300 | NOT FIRED (+95-115 forecast; §5) |
| 17 | Architecture | Family E Edge familyRegistry entry productionEnabled=true (must be false; admin_validation only) | MUST REMAIN admin-validation-only; new test `mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` FE-2 asserts productionEnabled=false |
| **18** | **Doctrine** | **`slippery_slope_reasoning_present` prompt copy frames it as a fallacy, weak argument, invalid, bad reasoning, or any verdict (BINDING)** | **NOT FIRED — §3 verbatim guards mirror Family C/D per-key pattern; per-key falsePositiveGuards explicitly forbid the framing; Family E-specific ban-list scans the model OUTPUT** |
| **19** | **Doctrine** | **Any Family E scheme key framed as a fallacy when its critical question is unmet** | **NOT FIRED — §3 system prompt explicitly states critical questions live in Family F, not Family E; Family E only detects PATTERN** |
| **20** | **Doctrine** | **Family E ban-list scan does NOT cover slippery_slope-specific verdict tokens** | **NOT FIRED — §3 Family E ban-list extensions enumerate all amendment §3 tokens including `fallacy`, `fallacious`, `invalid`, `flawed`, `wrong`, `weak argument`, `bad reasoning`, `flawed reasoning`, `logical error`, `informal fallacy`, `proof of`** |
| **21** | **Doctrine** | **No adversarial slippery_slope fixture** | **NOT FIRED — §4 designs 3 adversarial fixtures (clear, fallacy-word-in-input, multi-scheme) per amendment §2 BINDING** |
| 22 | Doctrine | Verdict/winner/fallacy tokens in user-facing strings (general) | NOT FIRED (Family E ban-list scan + Family A/B/C/D shared scan catch this; Family E adds 11 more specific tokens) |
| 23 | Doctrine | Family E prompt frames any scheme as inherently good or bad (descriptive only) | NOT FIRED — §3 system prompt + per-key entries are descriptive; `familyEDoctrineFixtures.test.ts` scans for any quality judgment |
| 24 | Working tree | Unclassified untracked files at PR creation | DEFERRED — implementer ensures clean working tree pre-PR; 10 known operator-territory untracked files documented at intent brief HEAD |

**All 24 triggers evaluated; ZERO fire at design time.** Triggers 18-21 (doctrine core; amendment-binding) are explicitly mitigated by §3 (verbatim guards + ban-list extension) and §4 (3 adversarial fixtures).

---

## 9. Brief ledger

This design is the response to an OPERATOR-AUTHORED intent brief (`docs/designs/MCP-SERVER-006-FAMILY-E-intent.md` at commit `fbf7c87`) PLUS an OPERATOR AMENDMENT ("strengthened runtime proof obligations"). The intent brief and the amendment together are the binding source.

### Section provenance

| Design section | Source | Operator vs orchestrator |
| -------------- | ------ | ------------------------ |
| §0 Goal | Intent brief §1, §10, §16 + amendment §1 | Operator-authored |
| §1 Scope reality + Stage 2B determination | Intent brief §2 + amendment §1 + Phase 0 inventory (familyE.ts read at design time) | Operator-authored brief + designer Phase A.1 audit |
| §2 Token budget | Intent brief §7 Decision 9 + amendment §1 + designer audit (Family A/B/C baseline calibration) | Designer Phase A.2 audit |
| §3 slippery_slope doctrine design | Intent brief §3, §5 (Decision 5) + amendment §3 (BINDING; extended token list) | Operator-authored brief + amendment + designer verbatim guard composition |
| §4 Adversarial fixture design | Intent brief §4 + amendment §2 (BINDING; ≥3 fixtures incl. ≥1 with adversarial fallacy framing) | Operator-authored brief + amendment + designer-authored synthesized text |
| §5 Test plan | Intent brief §13 + amendment §5 + designer Phase A.5 calibration against Family D's 129 Deno tests | Designer audit |
| §6 Smoke plan | Intent brief §14 (8 phases incl. Phase 4b adversarial verification) + amendment §4 + §5 (PASS criteria) | Operator-authored brief |
| §7 Read-only boundary | Intent brief §10 OUT-of-scope + amendment §1 implementation constraints | Operator-bound |
| §8 HALT trigger table | Intent brief §11 (24 triggers) | Operator-authored |
| §10 Stage 2B determination | Intent brief §2 (Stage 2B CONDITIONAL) + designer Phase A.1 verdict | Designer audit (binding) |
| §11 Reviewer matrix | Intent brief §11 Decision 11 + amendment §5 (explicit slippery_slope item required) | Operator-authored brief + amendment |

### Operator-deferred review (orchestrator judgment)

The following items resolved by orchestrator/designer default in absence of explicit operator direction:

1. **MAX_TOKENS=1500 (no bump).** The intent brief said "MAX_TOKENS should fit 1500" with conditional Stage 2B trigger if insufficient. The designer's Phase A.2 audit shows 1500 has ~60 tokens headroom (~4%) — tight but matching Family C's headroom. Operator may revisit if Phase 4 / Phase 7 observability shows truncation; this is a TELEMETRY-driven decision deferred to `OPS-MCP-OBSERVABILITY`.
2. **Family E-specific ban-list pattern location.** The amendment §3 lists the binding tokens but does not specify whether to put them in the shared `DOCTRINE_BAN_PATTERNS` (in `doctrineBanList.ts`) or a Family E-specific constant. Designer's call: Family E-specific constant in `familyEBanListScan.ts`, NOT the shared list, to avoid breaking Family A/B/C/D outputs that may legitimately contain words like "invalid" in a disputes_validity context. Operator may revisit if cross-family ban-list consolidation becomes desirable.
3. **Fixture count: 8 request fixtures (3 slippery-slope + 5 others).** The amendment §2 binds ≥3 slippery-slope fixtures; the designer adds 5 more for breadth of single-scheme coverage. Operator may direct trimming if test forecast pressure surfaces.
4. **Adversarial Fixture #2 input text.** Designer-authored: "Critics call this a slippery-slope fallacy when I make the case, but the chain is real..." Operator may refine the exact wording at implementer Phase if a more representative adversarial framing is desired.
5. **`familyEAdversarialSlipperySlope.test.ts` as a separate file.** Designer's call to isolate the amendment §2 binding into its own test file for surgical revertability. Operator may direct merger with `familyEDoctrineFixtures.test.ts` if test-file count pressure surfaces.
6. **Phase 4b PASS-vs-PARTIAL boundary.** The amendment §5 says PASS requires either ≥1 plausible Family E positive on a targeted fixture OR documented PARTIAL. Designer's call: PARTIAL is acceptable if 3 seeded args produce 0 positives AND a 4th targeted argument also produces 0 positives. Operator may sharpen the threshold.

### Brief interpretive notes

- **Stage 2B determination is a designer audit** (not an operator decision in this case) because Phase 0 evidence + the uniform ai_classifier inventory made the verdict deterministic. The intent brief explicitly said the default expectation is "Stage 2B NOT required". Designer confirms this with explicit rationale (§10).
- **The amendment is BINDING.** Amendment §1-§5 supersede intent brief §4-§7 where they conflict (specifically: amendment §3 expands the ban-list token list beyond the intent brief's §5 list; amendment §2 sharpens the fixture count to ≥3 with a specific adversarial framing).
- **`familyE.ts` header doctrine binding is preserved verbatim.** Per source file lines 8-21, the upstream taxonomy itself declares the doctrine binding ("copy NEVER labels a scheme a 'fallacy'..."). This design enforces that binding at the MCP server layer via per-key guards + ban-list scan + system prompt.

---

## 10. Stage 2B determination (BINDING)

**Stage 2B: NOT REQUIRED.**

Rationale (binding; mirrors §1 Stage 2B determination subsection):

1. **Uniform `ai_classifier` source (verified Phase 0 + Phase A.1).** All 16 Family E keys route to the same MCP classifier. No Subset filter required (Subset path is structurally inapplicable — there are no auto_metadata or lifecycle keys to exclude).
2. **No compound-key collision (verified §1).** Schema mirror response shape unchanged from Family A/B/C/D; flat-keyed `observations: Record<rawKey, boolean>`.
3. **Token budget fits 1500 (verified §2).** 16 keys × ~85 tokens ≈ ~1440 output; headroom ~60. NO MAX_TOKENS bump.
4. **Doctrine binding fits the per-key `falsePositiveGuards` template (verified §3).** Family C's `rejects_candidate_understanding` / `acknowledges_misread` / `flags_term_ambiguity` template + Family D's `anecdote_used` / `burden_request_present` / `evidence_gap_present` template are direct precedents. The Family E doctrine guards on `slippery_slope_reasoning_present` / `abductive_explanation_present` / `analogy_reasoning_present` extend the SAME pattern.
5. **Ban-list scope extension is additive, not structural (verified §3).** The Family E-specific ban-list patterns live in `familyEBanListScan.ts`; the shared `DOCTRINE_BAN_PATTERNS` constant is byte-equal preserved.
6. **Edge Function family registry already has Family E entry** (verified `supabase/functions/_shared/booleanObservations/familyRegistry.ts:89-93`) with the correct `productionEnabled: false, adminValidationEnabled: true` posture for admin-validation-only ship.

If implementer Phase A surfaces ANY of:
- Compound-key collision in Family E
- A Family E key whose source is NOT `ai_classifier`
- A Family E key whose `defaultSurface` is NOT `inspect`
- Token budget exceeding 1500 with MAX_TOKENS=1500
- A schema mirror change requirement
- A migration requirement

... that is a Stage 2B trigger AND a HALT. The implementer must surface to the operator before proceeding.

**Designer's explicit statement (per amendment §1 + intent brief §2):**
> Stage 2B: NOT REQUIRED — Family E is uniform ai_classifier (16/16 keys via shared `buildScheme(b)` factory), fits MAX_TOKENS=1500 with ~60 token headroom, requires no Subset filter, requires no compound-key schema change, and requires no Edge migration.

---

## 11. Reviewer matrix item: explicit slippery_slope doctrine item (BINDING; amendment §5 + intent brief Decision 11)

Per intent brief Decision 11 and amendment §5, the reviewer matrix MUST include an explicit `slippery_slope` doctrine item. Designer-bound matrix entry text (to appear verbatim in `.claude/agents/roadmap-reviewer.md` invocation or the reviewer's evaluation matrix for Card 3):

```
| Matrix item | What the reviewer verifies | Pass criterion |
| ----------- | -------------------------- | -------------- |
| slippery_slope doctrine | (1) The Family E system prompt frames `slippery_slope_reasoning_present` as a DESCRIPTIVE inferential pattern, never a fallacy. (2) The per-key `falsePositiveGuards` for `slippery_slope_reasoning_present` contain verbatim text forbidding the output from labeling the pattern as `fallacy`, `fallacious`, `weak`, `invalid`, `flawed`, `bad reasoning`, `logical error`, `wrong`, or `proof of`. (3) `familyEBanListScan.ts` enumerates ALL of these tokens AND scans `evidenceSpan` strings + `modelInfo.serverName` + `modelInfo.classifierSetVersion`. (4) `familyEAdversarialSlipperySlope.test.ts` exists with ≥3 adversarial fixtures targeting `slippery_slope_reasoning_present` including ≥1 with adversarial "fallacy" framing in input text. (5) The smoke plan includes Phase 4b adversarial slippery_slope verification. (6) Phase 4b PASS criterion is doctrine-clean OUTPUT regardless of model fire/no-fire. (7) Phase 4b FAIL criterion is any banned token in output. | All 7 items verified PASS or HALT. Any 1 FAIL = doctrine violation = HALT and revert. |
```

The reviewer ALSO verifies the standard reviewer matrix for boolean classifier cards:
- Family E byte-equal preservation of Family A/B/C/D files
- 17-check smoke tally
- Stage 2B verdict matches designer's NOT REQUIRED
- Test count strictly increases (+95-115 forecast; HALT at +300)
- Edge familyRegistry Family E entry stays `productionEnabled: false`
- Working tree clean at PR creation (10 known operator-territory files only)

---

## 12. Operator steps (deploy)

**No operator deploy required for Card 3.** The MCP server auto-deploys on merge to main via Deno Deploy. The Edge familyRegistry already has the Family E entry. No migration; no Edge Function logic change.

The operator runs the smoke after merge:
```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected: 17/17 PASS. Followed by Phase 4 Edge admin_validation request + Phase 4b doctrine verification.

If Phase 4b surfaces any banned token in a slippery_slope evidenceSpan, the operator HALTs and surfaces to designer for revert + revised guards.

---

## 13. Risks (operator-visible)

1. **Token budget tightness.** Family E's ~60-token headroom on MAX_TOKENS=1500 is the second-tightest in the rollout (after Family C's ~55). If real-corpus testing reveals response truncation, the OPS observability card can bump to 1800 (Family D envelope). NOT a Card 3 concern but flagged for operator awareness.
2. **Slippery_slope detection variance.** Walton schemes are sometimes hard to distinguish in practice (slippery_slope vs consequence chains; abductive vs causal). Conservative-positives bias should keep false positives low, but real-corpus calibration in Phase 4 / Phase 7 may surface patterns where the classifier underfires on schemes that are present. Mitigation: the Phase 4b adversarial fixtures are designed to be unambiguous slippery_slope patterns.
3. **"fallacy" word echo from input to output.** The amendment §2.2 fixture explicitly tests this case. If the model fails this test (echoes "fallacy" from input into evidenceSpan), the ban-list scan catches it AND the smoke Phase 4b catches it AND the test `familyEAdversarialSlipperySlope.test.ts` catches it. Three layers of defense; doctrine violation should never reach production.
4. **Family F deferred (critical questions).** Family E ships WITHOUT its companion Family F. The doctrine binding ("schemes are descriptive; critical questions are in Family F") references a family that does not yet exist in the MCP rollout. This is acceptable for Card 3 because:
   - The Family E user-facing strings never SAY "Family F" (they say "the corresponding critical question").
   - The doctrine binding holds whether or not Family F is implemented — Family E never adjudicates whether critical questions are met.
   - Family F is authorized for design on PASS.
5. **Family E priority overlap with Family A.** Family E priorities (200-215) overlap with Family A priorities (the source taxonomy uses `priority` for display ordering, not for classifier behavior). This is a UI-layer concern, NOT an MCP server concern. Card 3 does not touch UI; priorities only matter when both Family E and Family A signals appear in the timeline_node surface, which is a downstream rendering decision.

---

## 14. Out of scope (explicit list)

- Family F (`critical_question`) registration — DEFERRED (companion to Family E; authorized on PASS)
- Family G, H, I, J registration — DEFERRED
- Production-mode flip for Family E (`MCP-021C-EDGE-FAMILY-E-ENABLE`) — DEFERRED; authorized on PASS
- Auto-trigger inclusion for Family E — DEFERRED until production-mode flip lands
- Family A/B/C/D code modifications — FORBIDDEN (byte-equal §7)
- Schema mirror version change — FORBIDDEN
- Shared `DOCTRINE_BAN_PATTERNS` modifications — FORBIDDEN (Family E ban-list extensions live in family-specific file)
- New MCP-021A taxonomy keys — FORBIDDEN
- Database migrations — NONE NEEDED
- Edge Function logic changes — NONE NEEDED (familyRegistry entry exists)
- UI / Source 6 rendering changes — NONE
- Persistence schema changes — NONE
- `seedPrompt.ts` changes — FORBIDDEN
- `bootstrap.ts` changes — FORBIDDEN

---

## 15. Doctrine self-check

| Doctrine | Family E enforcement | Where in design |
| -------- | -------------------- | --------------- |
| cdiscourse-doctrine §1 (no truth labels) | System prompt 7 absolute rules verbatim; ban-list scan catches verdict tokens | §3 system prompt + §3 ban-list |
| cdiscourse-doctrine §3 (popularity ≠ evidence) | Family E does not touch evidence weighting; orthogonal to evidence-doctrine | §0 Goal |
| cdiscourse-doctrine §4 (AI moderator hard limits) | Server-side Deno only; `provider: 'mcp'` identifies output as machine-generated; advisory only | §0 Goal |
| cdiscourse-doctrine §6 (secrets policy) | ANTHROPIC_API_KEY / MCP_SERVER_BEARER_TOKEN never logged; ban-list scan never emits secrets | §0 Goal + §3 ban-list |
| cdiscourse-doctrine §7 (no AI from production app) | Family E classifier lives server-side; production app does NOT import `mcp-server/lib/familyE*.ts` | §7 Read-only boundary |
| cdiscourse-doctrine §10a (Observations vs Allegations) | Every Family E output is a Machine Observation; source: `ai_classifier`; never a person attribution | §1 source-breakdown |
| evidence-doctrine | Family E is orthogonal to factual standing; scheme detection does not lower standing | §13 Risks #2 |
| point-standing-economy | Family E is descriptive; the critical-question family (F) handles scheme-quality probing | §3 system prompt |
| **doctrine binding: slippery_slope NEVER labeled fallacy** | **§3 system prompt + §3 per-key guards + §3 Family E ban-list + §4 adversarial fixtures + §6 Phase 4b smoke + §11 reviewer matrix** | **5-layer defense; existential constraint** |

---

## 16. Summary

- **Card:** MCP-SERVER-006-FAMILY-E
- **Title:** Argument-Scheme Boolean Observation Classifier (Family E, 16 keys, Walton 1995/2008 schemes)
- **Stage 2B:** NOT REQUIRED (uniform ai_classifier, fits MAX_TOKENS=1500, no schema change)
- **Files touched:** 16 new + 4 updated (Family E lib + tests + smoke + Edge registry test + docs)
- **Test forecast:** +95 to +115 (midpoint ~105); HALT at +300
- **Smoke checks:** 17 total (was 15 after Family D); +2 Family E checks
- **Existential constraint:** `slippery_slope_reasoning_present` never labeled as fallacy in OUTPUT, even when INPUT contains "fallacy"; enforced via 5-layer defense (system prompt + per-key guards + Family E ban-list + 3 adversarial fixtures + Phase 4b smoke verification)
- **Operator deploy:** None — auto-deploys on merge; operator runs 17-check smoke + Phase 4b doctrine verification post-merge

This design preserves Family A/B/C/D byte-equal and ships Family E in admin-validation-only posture with the strongest doctrine-binding scaffolding to date (3 adversarial fixtures targeting slippery_slope, including ≥1 with adversarial "fallacy" framing in input; a Family E-specific ban-list extension with 11 binding tokens; a dedicated `familyEAdversarialSlipperySlope.test.ts` file; and a Phase 4b smoke step that gates merge-to-production-flip on doctrine-clean output).
