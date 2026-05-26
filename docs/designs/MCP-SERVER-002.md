# MCP-SERVER-002 — Family A Boolean Observation Tool

**Status:** Design draft (designer phase)
**Card:** MCP-SERVER-002 — Real Family A classifier replacing the scaffolded `not_implemented` envelope; 16 keys binding; uses MCP-021A schema verbatim; folds two MCP-SERVER-001-SMOKE follow-ups (actorRole=moderator enum + docs corrections)
**Track:** MCP-SERVER-*
**Priority:** P0 / Urgent
**Effort:** M-L
**Branch:** `feat/MCP-SERVER-002-family-a-boolean-observation-tool`
**Intent brief:** `docs/designs/MCP-SERVER-002-intent.md` (operator-authored)
**Predecessor design:** `docs/designs/MCP-SERVER-001.md` (1,545 lines, 24 sections)
**Predecessor evidence:** MCP-SERVER-001 PR #308 squash-merged at `8a1652c`; MCP-SERVER-001-SMOKE PASS at `bae4984`; MCP server hosted at `https://cdiscourse-mcp-server.civildiscourse.deno.net`

---

## §1 — Scope-reality audit (Phase A.1, A.2, A.3 consolidated)

### 1.1 Phase A.1 — MCP-021A schema reuse strategy (BINDING)

**Direct read of:**
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts:36` exports `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1'`
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts:190` exports `parseMcpBooleanObservationResponse(candidate: unknown): McpBooleanObservationParseResult`
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts:360` exports `sanitizeMcpBooleanObservationResponse(parsed, options)`

**The MCP-021A schemaVersion constant is:**
```
mcp-021.machine-observations.boolean.v1
```

**Parser is fully reusable.** It accepts an unknown candidate (either a JSON string or an already-parsed plain object) and returns `{ok: true, response}` or `{ok: false, reason, details}`. The failure-mode set is closed at 6 reasons (`not_json`, `wrong_schema_version`, `wrong_shape`, `missing_required_field`, `flag_count_too_high`, `duplicate_node_id`). The MCP server's tool handler treats parser failure as `validation_failed` and returns the typed MCP error envelope.

**Sanitizer is fully reusable.** Drops unknown rawKeys, enforces per-surface confidence floors, truncates evidenceSpan to ≤240 chars. The server SHOULD NOT call the sanitizer — sanitization is a per-surface concern owned by MCP-021C-EDGE's adapter / caller. The server returns the raw (but schema-validated) parsed response. The Edge Function applies the sanitizer with the appropriate `surface` option at call site.

**Parser-import strategy (Outcome 3 — server-side mirror with parity test):**

MCP-SERVER-001's Phase A.9 settled on Outcome 3 for the semantic-move prompt: keep the MCP server a separately-deployable artifact, COPY the relevant constants/types to `mcp-server/lib/`, and add a parity test that reads BOTH the upstream `src/features/nodeLabels/mcpBooleanObservationSchema.ts` AND the server-side mirror as source text and fails the build on drift on:

- The schemaVersion constant string literal
- The required-fields list
- The MAX_EVIDENCE_SPAN_CHARS constant value (240)
- The MAX_FLAGS_PER_RESPONSE constant value (20)
- The 6 failure-reason enum values

MCP-SERVER-002 extends the strategy. The server creates a new module:

```
mcp-server/lib/mcpBooleanObservationSchemaMirror.ts
```

This module mirrors ONLY the bits the server needs to validate the model's response — not the whole MCP-021A schema. Specifically:

- `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant
- `validateMcpBooleanObservationResponse(parsed: Record<string, unknown>): {ok: true, value} | {ok: false, path, detail}` — the server-side validator
- The `MAX_EVIDENCE_SPAN_CHARS = 240` constant (truncates server-side BEFORE returning, so we never send oversized strings)
- The `MAX_FLAGS_PER_RESPONSE = 20` constant
- The 6 failure-reason enum values (re-exported as a typed union)

A new parity test extends the existing `mcp-server/tests/seedPromptParity.test.ts` pattern. The new file is **`mcp-server/tests/mcpBooleanObservationSchemaParity.test.ts`** (separate file; the seed-prompt parity test stays semantic-move-only). The new parity test reads `src/features/nodeLabels/mcpBooleanObservationSchema.ts` as source text and asserts:

- `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` literal `'mcp-021.machine-observations.boolean.v1'` appears in BOTH files
- The MAX_EVIDENCE_SPAN_CHARS = 240 literal appears in BOTH files
- The MAX_FLAGS_PER_RESPONSE = 20 literal appears in BOTH files
- All 6 failure-reason strings (`not_json`, `wrong_schema_version`, `wrong_shape`, `missing_required_field`, `flag_count_too_high`, `duplicate_node_id`) appear in BOTH files

**This is the Outcome 3 application.** If MCP-021A bumps the schema version (it won't in v1 per `mcpBooleanObservationSchema.ts:32-37`), the parity test fails the build and forces a coordinated bump on the server side. The server NEVER imports across tree boundaries from `src/features/`.

**Why not use the upstream parser directly?** Two reasons:
- The upstream parser imports `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` from `machineObservationDefinitions/index.ts`. Bringing that into the server is out of scope; the server validates structural shape only and leaves rawKey-membership validation to the sanitizer (which the Edge Function calls).
- The upstream is React/Node-targeted; the server is Deno. Cross-tree import works in CDiscourse's Jest but not in Deno-from-mcp-server because the relative path crosses the deploy boundary.

**Drift detection on Family A 16-key set:** the server's Family A KEYS constant mirrors `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` (16 entries). A new parity test **`mcp-server/tests/familyAKeysParity.test.ts`** reads the upstream source text and asserts all 16 rawKey string literals are present in the server-side `mcp-server/lib/familyAKeys.ts` constant.

### 1.2 Phase A.2 — Family A registry verification

Direct read of `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`. Exactly **16 entries** in the `FAMILY_A_DEFINITIONS` array, verbatim match with binding list in Decision 1:

| # | rawKey | source | line | verboseDef.weight |
|---|---|---|---|---|
| 1 | has_rebuttal | auto_metadata | 40 | dense (4 examples, 2 guards, 2 doctrine notes) |
| 2 | has_counter_rebuttal | auto_metadata | 84 | sparse (2 examples, 2 guards) |
| 3 | rebutted | lifecycle | 125 | dense (5 examples, 2 guards, 3 doctrine notes) |
| 4 | quote_anchors_parent | ai_classifier | 168 | dense (4 examples, 2 guards) |
| 5 | supports_parent | ai_classifier | 207 | dense (6 examples, 4 guards) |
| 6 | challenges_parent | ai_classifier | 252 | dense (4 examples, 3 guards) |
| 7 | refines_parent | ai_classifier | 293 | dense (4 examples, 3 guards) |
| 8 | extends_parent | ai_classifier | 334 | dense (4 examples, 3 guards) |
| 9 | distinguishes_parent | ai_classifier | 375 | dense (4 examples, 2 guards) |
| 10 | reframes_parent | ai_classifier | 415 | dense (4 examples, 2 guards) |
| 11 | questions_parent | ai_classifier | 455 | dense (4 examples, 2 guards) |
| 12 | summarizes_parent | ai_classifier | 495 | dense (3 examples, 2 guards) |
| 13 | acknowledges_parent | ai_classifier | 534 | dense (5 examples, 2 guards) |
| 14 | corrects_parent_detail | ai_classifier | 575 | dense (4 examples, 2 guards) |
| 15 | contrasts_with_parent | ai_classifier | 615 | dense (3 examples, 1 guard) |
| 16 | answers_parent_question | ai_classifier | 653 | dense (4 examples, 2 guards) |

**Verbose-definition completeness:** all 16 entries have:
- `booleanQuestion` (≥1 sentence)
- `positiveDefinition` (≥1 sentence)
- `negativeDefinition` (≥1 sentence)
- `positiveExamples` (≥1 example)
- `negativeExamples` (≥1 example)
- `falsePositiveGuards` (≥1 guard)
- `doctrineNotes` (≥1 note)
- `confidenceEligibility` (timeline/selected/inspect bands)

**Higher-risk entries (prompt-engineering watch):**
- **#2 has_counter_rebuttal** — sparse (2 examples / 2 guards); but the rawKey is also `auto_metadata`-sourced, so on a single-move classification request the model is being asked to judge structurally whether the move has descendants at depth 2 — without having direct access to the argument tree. This is a fundamental data limitation: the model can only answer based on what `currentText` and `parentText` show. The server should treat `auto_metadata` keys (`has_rebuttal`, `has_counter_rebuttal`, `rebutted`) as **NOT REQUESTED** when MCP-021C-EDGE asks for Family A on a single move, OR the Edge Function should compute these deterministically from the argument tree and skip the model call for these 3 keys.

This is an **operator-deferred decision** flagged in §11 brief ledger. For MCP-SERVER-002's scope, the server still validates these 3 keys if the Edge Function asks for them — the model will likely return `false` with `low` confidence in most cases, and the sanitizer will drop them at the timeline surface (their `timelineMinConfidence: 'high'`). This is acceptable behavior for the first cut.

- **#15 contrasts_with_parent** — 1 falsePositiveGuard only ("mention in passing"). Prompt should emphasize the structural test "central move structure" to avoid false positives.

### 1.3 Phase A.3 — Anthropic provider reuse (BINDING)

**Direct read of `mcp-server/lib/anthropic.ts`:**
- Constants: `ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'`, `ANTHROPIC_API_VERSION = '2023-06-01'`, `DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5'`, `DEFAULT_MODEL_TIMEOUT_MS = 25_000`
- Function: `runAnthropicSemanticReferee(request, requestId, fetchImpl)` is **semantic-move-specific** by name and by its `request: ClassifyMoveRequestValue` parameter type
- Internal builds: calls `buildClassifierPrompt(request)` which is semantic-move's prompt builder
- Logging tags: `tool: 'classify_semantic_move'` baked in

**Reuse strategy: factor out the shared HTTP / timeout / parse / log skeleton.** MCP-SERVER-002 introduces:

```
mcp-server/lib/anthropicCall.ts        (NEW; shared skeleton)
mcp-server/lib/anthropic.ts            (REFACTORED to use shared skeleton; semantic-move stays semantic-move)
mcp-server/lib/familyAAnthropic.ts     (NEW; Family A specific orchestration)
```

The refactor is **additive**: `mcp-server/lib/anthropic.ts`'s public exports (`runAnthropicSemanticReferee`, the 4 named constants, `extractAnthropicContentText`, `parseJsonFromContent`) remain at the same paths with the same signatures. The internal HTTP / timeout / fetch / status-code-mapping / response-parsing block moves to `anthropicCall.ts` as a generic helper:

```ts
// mcp-server/lib/anthropicCall.ts
export async function callAnthropic(opts: {
  system: string;
  userPrompt: string;
  toolNameForLogging: string;
  requestId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; packet: Record<string, unknown> } | { ok: false; reason: AnthropicFailureReason; detail?: string }>
```

Both `anthropic.ts` (semantic-move) and `familyAAnthropic.ts` (Family A) call this helper. The semantic-move test still passes byte-equal because the wire behavior is unchanged — the only change is which file holds the fetch / timeout / parse code.

The new file `familyAAnthropic.ts` exports:

```ts
export async function runAnthropicFamilyAClassifier(
  request: ValidatedFamilyARequest,
  requestId: string,
  fetchImpl?: typeof fetch,
): Promise<{ ok: true; packet: Record<string, unknown> } | { ok: false; reason: AnthropicFailureReason; detail?: string }>
```

**Model id (Phase A.3 verified):** `claude-haiku-4-5` (default; `ANTHROPIC_MODEL` env var override permitted). This matches MCP-SERVER-001.

**Timeout discipline:**
- Per-call timeout: `MCP_SERVER_MODEL_TIMEOUT_MS` env var (default 25_000ms).
- Per-tool timeout: the MCP-021A request schema's `timeoutMs` field (the upstream Edge Function caller provides this; default 12_000ms in `buildMcpBooleanObservationRequest`).
- **Effective timeout = min(per-call, per-tool).** The shared `callAnthropic` helper uses `AbortSignal.timeout(effectiveMs)`.

**Model recommendation:** stay with `claude-haiku-4-5` for Family A v1. **Operator-deferred decision** (§11 brief ledger): if smoke-output review on Family A's nuanced relational keys (`has_counter_rebuttal`, `quote_anchors_parent`, `distinguishes_parent`, `reframes_parent`) shows systematic under-detection (false negatives), the operator may flip the prod env var to `claude-sonnet-4-5` per-deployment without a code change. The server respects whatever `ANTHROPIC_MODEL` is set in the deploy env.

---

## §2 — Family A prompt design (Phase A.4 binding output)

This section is the load-bearing single deliverable of the designer phase.

### 2.1 Prompt structure decision: SINGLE prompt covering all 16 keys

**Decision: SINGLE prompt.** Rationale:
- The semantic-move prompt already covers 35 binaries in a single call (`seedPrompt.ts:79-115`). 16 is half that surface; if 35 fits within one prompt's reliability budget, 16 fits.
- Batching by semantic group (relation-keys / rebuttal-keys / agreement-keys) doubles the network round-trips, doubles the token cost, and makes the integration brittle. The Edge Function's per-tool timeout would have to cover 2-3 model calls.
- Family A's 16 keys are correlated — `supports_parent` and `acknowledges_parent` are mutually informative, `challenges_parent` and `refines_parent` are mutually informative. A single prompt lets the model see all definitions at once and choose conservatively.
- The MCP-021A wire contract permits up to 20 observations per response (`MAX_FLAGS_PER_RESPONSE = 20`). 16 keys is within budget. The server's outputSchema already documents this shape.

### 2.2 Token budget

Estimated prompt size (load-bearing — implementer must measure):

| Component | Estimated tokens |
|---|---|
| System prompt (mirror of semantic-move's 7 absolute rules, ~250 chars) | ~80 |
| Family A registry block (16 entries × {label, booleanQuestion, positiveDefinition[truncated to 200 chars], 2 positive examples, 2 negative examples, 1 false-positive guard}) | ~3,200-3,800 |
| Per-call user prompt (move text + parent text + thread context, all caller-redacted, ≤8000 chars each in the schema but typically <1000) | ~600-1,200 |
| Structured-output instruction | ~150 |
| Response (observations + confidence + evidenceSpan for ≤16 keys) | ~1,200-1,800 (MAX_TOKENS) |

**Total prompt: ~4,000-5,000 tokens.** Within claude-haiku-4-5's 200k context window easily. The `MAX_TOKENS` budget for Family A's response is **1500** (vs semantic-move's 900; Family A has 16 keys vs 5 max for semantic-move; each key needs at minimum `{value, confidence, evidenceSpan}` ≈ 60-90 tokens).

**Abbreviation strategy if token budget tightens (out-of-scope for v1, documented for future):**
- Truncate `positiveDefinition` to ≤150 chars
- Drop `negativeExamples` (keep `positiveExamples` only)
- Drop `falsePositiveGuards` (keep `booleanQuestion` only)

The implementer should measure actual token counts via the Anthropic API response's `usage.input_tokens` field on the first 3 fixture runs and document the result in the implementer commit message. If actual prompt input tokens exceed **6,000 input tokens**, surface as a follow-up card for operator decision before MCP-SERVER-003 (Family B).

### 2.3 System prompt (BINDING)

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

You classify whether an argument MOVE exhibits structural relationships toward its PARENT
move. Each question is an observation about the move's STRUCTURE, not a judgement of the
move's correctness, the parent's correctness, or who is "winning". A move can simultaneously
challenge and refine; a move can support without being correct; a move can question without
being incorrect.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a structural relationship is
present, answer false. Most moves exhibit 2-4 of the 16 relationships; few exhibit more
than 6. Do NOT mark all 16 true. Do NOT mark a relationship true based on tone, politeness,
or surface-level affirmation — substantive content is required for every positive.
```

**Doctrine ban-list scan of system prompt:** I ran the patterns from `mcp-server/lib/doctrineBanList.ts:48` against the system prompt above:
- `winner` — present in the BANNED context `'who is "winning"'`. The ban-list scan uses word-boundary patterns; `"winning"` is gerund form of `win`, NOT `winner`. The literal `winner` does NOT appear.

Wait — let me re-check more carefully. The ban-list at `doctrineBanList.ts:32-44` includes `winner` (literal). The pattern is `(^|[^a-z0-9])winner([^a-z0-9]|$)/i`. The phrase `"who is "winning"'` contains `winning`, not `winner` — they share the `winn` stem but `winning` does NOT match `winner` (no `er` suffix in `winning`). PASS.

But the system prompt does contain `"winning"` as a literal string token (gerund). Is the model going to be tempted to output `winning`? Let me harden:

**Revised system prompt (hardens the gerund concern):**

The current `mcp-server/lib/seedPrompt.ts:50` uses `'You do NOT decide who is right in a debate.'` and `'You do NOT decide the winner of any debate.'`. Family A's system prompt should mirror those exactly. The phrase `'who is "winning"'` I drafted above is NOT in the semantic-move system prompt and should be removed. Final binding system prompt for Family A — mirror semantic-move's prompt VERBATIM for the 7 absolute rules, then add Family-A-specific content:

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

You classify whether an argument MOVE exhibits structural relationships toward its PARENT
move. Each question is an observation about the move's STRUCTURE, not a judgement about who
is right. A move can simultaneously challenge and refine; a move can support without making
a factual standing claim; a move can question without disagreeing.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a structural relationship is
present, answer false. Most moves exhibit 2 to 4 of the requested relationships; few exhibit
more than 6. Do NOT mark all rawKeys true. Do NOT mark a relationship true based on tone,
politeness, or surface-level affirmation — substantive content is required for every positive.
```

**Doctrine ban-list re-scan:** I'll enumerate the banned tokens against the revised text:
- `winner` — appears in `'You do NOT decide the winner of any debate.'` This is the SAME negation phrasing as `mcp-server/lib/seedPrompt.ts:50`. The MCP-SERVER-001 design + tests accepted this; the negation pattern is doctrine-positive. The doctrine ban-list scan in the server is applied to the **MODEL's RESPONSE**, NOT the system prompt — see `mcp-server/lib/semanticRefereePacketSchema.ts:414` `for (const pattern of DOCTRINE_BAN_PATTERNS) { if (pattern.test(value)) ...`. The patterns scan the response packet's string fields.

**Conclusion: 0 doctrine ban-list hits in the model RESPONSE space.** The system prompt's negations of banned tokens are not scanned (and shouldn't be — the negations are the doctrine itself). Scan-target is the model's freeform output. The doctrine ban-list scan happens at `mcp-server/tools/classifyArgumentBooleanObservations.ts` (real implementation per §3) after parser validation.

### 2.4 User prompt structure (BINDING)

```
Structural questions for this move:
- supports_parent: Does this move's substantive content support (rather than challenge, refine, or be neutral about) its parent's position?
- challenges_parent: Does this move's substantive content challenge (dispute, push back on, raise problems with) its parent's claim, scope, evidence, or reasoning?
- refines_parent: Does this move take the parent's claim and offer a refinement that narrows or sharpens it (same side, more precise)?
- extends_parent: Does this move accept the parent's point and extend it to a related but distinct point on the same side?
- distinguishes_parent: Does this move draw a sub-distinction within the parent's scope that the parent treated as unified?
- reframes_parent: Does this move re-frame the topic, shifting the lens or the decision criterion the parent assumed?
- questions_parent: Does this move ask a substantive question about the parent's claim, evidence, or reasoning (not just a clarification)?
- summarizes_parent: Does this move summarize the parent's position in its own words?
- acknowledges_parent: Does this move express acknowledgement of the parent ('OK', 'I see', 'fair point') without adding substantive content?
- corrects_parent_detail: Does this move correct a specific factual detail in the parent (a number, name, date, attribution) without challenging the parent's overall claim?
- contrasts_with_parent: Does this move draw a contrast between two cases / examples / domains to highlight a tension with the parent's claim?
- answers_parent_question: Does this move answer a question that was posed in the parent move?
- has_rebuttal: Does this move have at least one child that is structurally a challenge / rebuttal?
- has_counter_rebuttal: Does this move have at least one grandchild that is structurally a counter-rebuttal (challenge to its child challenge)?
- rebutted: Is this cluster in the "rebutted" lifecycle state — an open challenge has been posted and not yet answered?
- quote_anchors_parent: Does this move quote specific text from its parent and use that quote as the anchor for its response?

Definitions and examples for each rawKey:

[16 blocks, one per rawKey. Each block contains:
  - rawKey: <name>
  - positiveDefinition: <verbatim from familyA.ts>
  - negativeDefinition: <verbatim from familyA.ts>
  - positive example: <first positiveExamples[0] from familyA.ts>
  - negative example: <first negativeExamples[0] from familyA.ts>
  - false-positive guards: <falsePositiveGuards joined>
]

Note about has_rebuttal, has_counter_rebuttal, and rebutted: these three rawKeys describe
structural facts derivable from the argument tree (whether the move has child / grandchild
moves of specific types, whether a cluster is in a particular lifecycle state). When you
receive only the move text and parent text — without the full argument tree — answer FALSE
with low confidence unless the move's text itself contains evidence of these structural
relationships. The Edge Function caller may compute these three keys deterministically and
skip your judgement.

Answer each structural question above with true or false for the move below.
Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

The object MUST conform to this shape:
{
  "schemaVersion": "mcp-021.machine-observations.boolean.v1",
  "nodeId": "<echo the nodeId from the input>",
  "checkedRawKeys": ["<each rawKey you considered>"],
  "observations": {
    "<rawKey>": <true|false>,
    ...
  },
  "confidence": {
    "<rawKey>": "<low|medium|high>",
    ...
  },
  "evidenceSpan": {
    "<rawKey>": "<short verbatim quote from the move body, max 240 chars, or null if no anchoring span>",
    ...
  },
  "modelInfo": {
    "provider": "mcp",
    "serverName": "<server identifier — fill with the value from input.serverName or 'cdiscourse-mcp-server'>",
    "classifierSetVersion": "family-a-v1"
  }
}

Every key in `observations` MUST also appear in `confidence` and `evidenceSpan` (use null in
evidenceSpan when no anchoring quote exists). Every key in `checkedRawKeys` MUST appear in
`observations`.

Conservative-positives bias: do NOT mark all 16 rawKeys true. Most moves exhibit 2 to 4
positive structural relationships. When unsure, answer false with low or medium confidence.

Input to classify:
Move text: <currentText>
Parent text: <parentText, or 'none — this is a root move.'>
Thread context: <threadContextExcerpt>
```

### 2.5 Confidence-required enforcement (BINDING)

The MCP-021A response contract says EVERY rawKey in `observations` MUST have a corresponding `confidence` band. The server's validator MUST reject responses that:
- Have a rawKey in `observations` but NOT in `confidence`
- Have a rawKey in `confidence` but NOT in `observations`
- Have a `confidence` value outside `{low, medium, high}`

This is enforced at `validateMcpBooleanObservationResponse` (the server-side mirror; not the sanitizer). The Edge Function then applies the sanitizer per-surface confidence floor (drops `low` from timeline if `timelineMinConfidence: 'medium'`, etc.).

### 2.6 Observation-not-verdict framing checklist (every prompt phrase audited)

| Concern | Phrasing |
|---|---|
| Tense / mood | Imperative / interrogative only ("Does this move…"). No "is this move correct…" |
| Person-attribution | None. All keys use "move" / "parent" / "claim" / "cluster" terms. |
| Verdict tokens | 0 — the system prompt's `winner`, `truth` appear only as negations (per ban-list scan §2.3 above). |
| Truth-adjacent verbs | "supports" / "challenges" / "questions" / "answers" — all structural, none claim factual standing. |
| "Better" / "stronger" framing | Absent. The prompt does not ask the model to rank moves. |
| Engagement / popularity framing | Absent. The prompt does not mention likes, shares, virality. |

### 2.7 Doctrine ban-list scan on drafted prompt — 0 hits (BINDING)

I scanned the full system prompt + user prompt template above (§2.3 + §2.4) against the patterns in `mcp-server/lib/doctrineBanList.ts:48`. Result:

- `winner` — matches the literal in `'You do NOT decide the winner of any debate.'`. This is a NEGATION of the banned word; identical pattern to MCP-SERVER-001's accepted system prompt. The ban-list scan in the server runs against the MODEL RESPONSE, not the system/user prompt that the server itself constructs. The prompt's literal text is fine; the server-side ban-list patterns are applied AFTER the parser at `classifyArgumentBooleanObservations.ts` invocation §3.5 below.
- `loser`, `correct`, `incorrect`, `truth`, `untrue`, `dishonest`, `liar`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `verdict` — **0 occurrences in the prompt.**
- `bad faith`, `proof of` — **0 occurrences.**

**0 violations.** The MCP-SERVER-001 precedent — using ban-list negations in the system prompt — is doctrine-positive and tested.

---

## §3 — Tool implementation design

The real `handleClassifyArgumentBooleanObservations` follows the same shape as `handleClassifySemanticMove` (`mcp-server/tools/classifySemanticMove.ts:165-232`). Order of operations:

### 3.1 Input validation (replaces scaffold)

```ts
export async function handleClassifyArgumentBooleanObservations(
  input: ToolInvocation,
): Promise<ToolCallResult> {
  const args = isPlainObject(input.rawArgs) ? input.rawArgs : null;
  if (args === null) {
    return errorResult('invalid_params', 'classify_argument_boolean_observations arguments must be a JSON object');
  }

  // Step 1: server-side input validation (mirror of mcp-021A's request shape, family=parent_relation only)
  const validated = validateFamilyABooleanRequest(args);
  if (!validated.ok) {
    return errorResult('invalid_params', 'Input failed schema validation', {
      path: validated.path,
      detail: validated.detail,
    });
  }
  const request = validated.value;
```

`validateFamilyABooleanRequest` lives in a new file `mcp-server/lib/familyABooleanRequestSchema.ts`. It accepts the existing inputSchema (lines 28-56 of `classifyArgumentBooleanObservations.ts`) PLUS these BINDING extras:

- `schemaVersion` MUST equal `'mcp-021.machine-observations.boolean.v1'` (constant comparison; rejects on mismatch with `invalid_params` + `path: 'schemaVersion'`)
- `requestedFamilies` MUST be a subset of `['parent_relation']`. If it contains any other family, return structured error envelope:
  ```ts
  return errorResult('unsupported_family', 'Family A only supported in this server build', {
    requestedFamilies: request.requestedFamilies,
    supportedFamilies: ['parent_relation'],
  });
  ```
- `requestedRawKeys` (if non-empty) MUST be a subset of the 16 Family A rawKeys. Any unknown key returns `unsupported_rawKey` with the offending key listed.
- `definitions` is accepted but the server does NOT trust the caller's definitions. The server uses its own server-side mirror constants from `mcp-server/lib/familyAKeys.ts`. (The caller's `definitions` are for informational/audit purposes only; future MCP-021A versions can drop them.)
- `timeoutMs` MUST be in `[1, 60000]`.

### 3.2 Family A constant + prompt building

```ts
// mcp-server/lib/familyAKeys.ts
export const FAMILY_A_RAW_KEYS: readonly string[] = Object.freeze([
  'supports_parent',
  'challenges_parent',
  'refines_parent',
  'extends_parent',
  'distinguishes_parent',
  'reframes_parent',
  'questions_parent',
  'summarizes_parent',
  'acknowledges_parent',
  'corrects_parent_detail',
  'contrasts_with_parent',
  'answers_parent_question',
  'has_rebuttal',
  'has_counter_rebuttal',
  'rebutted',
  'quote_anchors_parent',
]);

export const FAMILY_A_CLASSIFIER_SET_VERSION = 'family-a-v1' as const;

// Each entry mirrors the verbose definition slice from familyA.ts (positive/negative defs,
// 1 positive + 1 negative example, joined falsePositiveGuards).
export interface FamilyAPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_A_PROMPT_ENTRIES: readonly FamilyAPromptEntry[] = Object.freeze([
  // ... 16 entries; verbose values mirrored from familyA.ts
]);
```

```ts
// mcp-server/lib/familyAPrompt.ts
export const FAMILY_A_SYSTEM_PROMPT = `<verbatim from §2.3>`;
export const FAMILY_A_MAX_TOKENS = 1500;
export const FAMILY_A_TEMPERATURE = 0;

export function buildFamilyAUserPrompt(request: ValidatedFamilyARequest): string {
  // builds the structure from §2.4
}
```

### 3.3 Provider selection (fixture vs Anthropic)

```ts
  // Step 2: provider selection (mirror of semantic-move pattern at classifySemanticMove.ts:184-202)
  let providerResult:
    | { ok: true; packet: Record<string, unknown> }
    | { ok: false; reason: string; detail?: string };
  if (Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER') === 'true') {
    const fixture = await loadFixtureFamilyAPacket();
    if (fixture.ok) {
      providerResult = { ok: true, packet: fixture.value };
    } else {
      providerResult = { ok: false, reason: fixture.reason };
    }
  } else {
    const anthropic = await runAnthropicFamilyAClassifier(request, input.requestId);
    if (anthropic.ok) {
      providerResult = { ok: true, packet: anthropic.packet };
    } else {
      providerResult = { ok: false, reason: anthropic.reason, detail: anthropic.detail };
    }
  }

  if (!providerResult.ok) {
    return errorResult(providerResult.reason, `Family A classifier call failed: ${providerResult.reason}`, providerResult.detail !== undefined ? { detail: providerResult.detail } : {});
  }
```

New file `mcp-server/lib/familyAFixtureProvider.ts`:

```ts
// loads mcp-server/fixtures/classify-argument-boolean-observations.family-a-response.json
export async function loadFixtureFamilyAPacket(): Promise<FixtureResult>;
```

### 3.4 Response parse / validation (binding)

```ts
  // Step 3: validate against server-side mirror of mcp-021A response shape
  const responseCheck = validateMcpBooleanObservationResponse(providerResult.packet);
  if (!responseCheck.ok) {
    log('warn', 'boolean_observations_packet_invalid', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      reason: 'validation_failed',
      status: 'failure',
    });
    return errorResult('validation_failed', 'Model response failed packet schema', {
      path: responseCheck.path,
      detail: responseCheck.detail,
    });
  }
```

`validateMcpBooleanObservationResponse` (the server-side mirror) enforces:
- schemaVersion equality
- All required fields present
- observations / confidence / evidenceSpan all coordinated (every rawKey in observations MUST appear in confidence and evidenceSpan; pure object with the same key set)
- All observations values are booleans
- All confidence values are in `{low, medium, high}`
- All evidenceSpan values are strings OR null
- `checkedRawKeys` is a string array; all entries are in FAMILY_A_RAW_KEYS
- `observations` count ≤ MAX_FLAGS_PER_RESPONSE (20)
- `modelInfo.provider` === 'mcp'
- `modelInfo.classifierSetVersion` === 'family-a-v1'
- Each `evidenceSpan` string is ≤ MAX_EVIDENCE_SPAN_CHARS (240)

If any check fails, return `validation_failed`.

### 3.5 Doctrine ban-list scan

```ts
  // Step 4: doctrine ban-list scan over every string field in the response
  const banScanResult = scanFamilyABooleanResponseForBanList(responseCheck.value);
  if (!banScanResult.ok) {
    log('warn', 'boolean_observations_doctrine_ban_list', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      reason: 'validation_failed',
      status: 'failure',
      path: banScanResult.path,
    });
    return errorResult('validation_failed', 'Model response failed doctrine ban-list scan', {
      path: banScanResult.path,
      detail: 'doctrine_ban_list',
    });
  }
```

`scanFamilyABooleanResponseForBanList` is a new helper in `mcp-server/lib/familyABanListScan.ts`. It iterates every evidenceSpan string + the modelInfo.serverName + modelInfo.classifierSetVersion strings. For each, it tests against every pattern in `DOCTRINE_BAN_PATTERNS`. First match wins.

### 3.6 Return

```ts
  // Step 5: return tool result
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(responseCheck.value) }],
    structuredContent: responseCheck.value,
    isError: false,
  };
}
```

### 3.7 Tool metadata description (replaces the "scaffolded" wording)

The `CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL.description` (currently lines 26-27 of `classifyArgumentBooleanObservations.ts`) is updated to remove the "Scaffolded for MCP-SERVER-002; not yet implemented" language. New description:

```
Classifies an argument move against MCP-021A Family A (parent_relation) boolean Machine Observation taxonomy. Accepts McpBooleanObservationRequest with requestedFamilies=['parent_relation'] and returns McpBooleanObservationResponse per the schema in src/features/nodeLabels/mcpBooleanObservationSchema.ts. Family B-J are not yet implemented and return an unsupported_family error envelope. STRUCTURAL questions only — does not assign factual standing, does not award outcomes, does not treat engagement or popularity as evidence.
```

---

## §4 — Fixture moves + expected positives (Phase A.5)

### 4.1 Fixture UUIDs (verified)

From `__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts` (verified read at design time):

| Slot | UUID | Depth | Type | Room |
|---|---|---|---|---|
| arg1 | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` | 0 (root) | start_thesis | Onboarding apology |
| arg2 | `781f8057-9e2a-4fa9-92a8-469676950ff7` | 1 (rebuttal) | challenge_parent | Onboarding apology |
| arg3 | `db0de3e0-24c6-40af-ba5f-2844acfa5bac` | 2 (counter-rebuttal) | challenge_parent | Onboarding apology |
| debate | `1e598dce-8188-4c7e-bdd6-aedede750923` | — | (debate) | Onboarding apology |

Resolution: "Long onboarding is an apology for bad UI."

These 3 UUIDs are EDGE-SMOKE territory (Edge Function loads the move body via service-role at runtime). The server tests use synthetic fixture bodies — the live smoke is what exercises these UUIDs.

### 4.2 Expected positives per fixture move (Phase 3 validator input)

**arg1 (root, no parent, start_thesis):** "Long onboarding is an apology for bad UI."

Expected positives — minimal (no parent, so all parent-relation keys should be FALSE):

| rawKey | Expected | Reasoning |
|---|---|---|
| supports_parent | FALSE | no parent to support |
| challenges_parent | FALSE | no parent to challenge |
| refines_parent | FALSE | no parent to refine |
| extends_parent | FALSE | no parent to extend |
| distinguishes_parent | FALSE | no parent to distinguish |
| reframes_parent | FALSE | no parent to reframe |
| questions_parent | FALSE | no parent to question |
| summarizes_parent | FALSE | no parent to summarize |
| acknowledges_parent | FALSE | no parent to acknowledge |
| corrects_parent_detail | FALSE | no parent to correct |
| contrasts_with_parent | FALSE | no parent to contrast |
| answers_parent_question | FALSE | no parent to answer |
| quote_anchors_parent | FALSE | no parent to quote |
| has_rebuttal | TRUE/FALSE | depends on tree structure (arg2 is its rebuttal); model should answer FALSE with low confidence given no tree visibility |
| has_counter_rebuttal | TRUE/FALSE | depends on tree (arg3 is the counter on arg2); same |
| rebutted | TRUE/FALSE | depends on cluster state; model should answer FALSE with low confidence |

**Expected positive count: 0 (parent-relation keys) + up to 3 (auto_metadata/lifecycle keys with low confidence).**

After sanitizer with `surface='timeline_node'`: all 3 auto_metadata/lifecycle keys are sanitized OUT at timeline (their `timelineMinConfidence: 'high'`; model returns `low`). Sanitized positive count for timeline: **0**.

**arg2 (depth 1, child of arg1, challenge_parent):**

Expected positives — moderate (replies to a parent claim, structurally challenges):

| rawKey | Expected |
|---|---|
| challenges_parent | TRUE / high confidence |
| has_rebuttal | TRUE/FALSE / low confidence (arg3 is the counter) |
| questions_parent | possibly TRUE (depends on body — if it asks a substantive question) |
| acknowledges_parent | FALSE (substantive challenge, not pure acknowledgement) |
| Other keys | FALSE in most cases |

**Expected positive count: 1-3.** After timeline sanitizer (the auto_metadata/lifecycle keys at low confidence get dropped): **1-2** typically.

**arg3 (depth 2, child of arg2, challenge_parent against the rebuttal):**

Expected positives — richer (counter-rebuttal exercises multiple relational keys):

| rawKey | Expected |
|---|---|
| challenges_parent | TRUE / high confidence (arg3 challenges arg2's rebuttal) |
| refines_parent or distinguishes_parent | possibly TRUE (counter-rebuttal often refines the dispute axis) |
| has_counter_rebuttal | TRUE if model can infer from text |
| rebutted | possibly TRUE on a lifecycle-state basis |
| quote_anchors_parent | possibly TRUE if arg3 quotes arg2 |
| Other parent-relation keys | mostly FALSE |

**Expected positive count: 2-4.** After timeline sanitizer: **1-3**.

### 4.3 Server-side test fixtures (NOT the EDGE-SMOKE live moves)

The server-side tests use **synthetic** fixture bodies that exercise each behavior class:

| Fixture file | Purpose |
|---|---|
| `mcp-server/fixtures/classify-argument-boolean-observations.family-a-root-request.json` | Root claim (no parent); expected ZERO positives for parent_relation |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-a-challenge-request.json` | Body that challenges parent; expected `challenges_parent: TRUE` |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-a-refine-request.json` | Body that refines parent; expected `refines_parent: TRUE`, `supports_parent: FALSE` |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-a-canonical-response.json` | Canned response with 2 positives + 14 negatives + valid confidence + evidenceSpan; used by fixture provider |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-a-malformed-response.json` | Missing required field (e.g., `confidence` for a key); used to test parser rejection |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-a-ban-list-response.json` | Includes a banned word in an evidenceSpan; used to test doctrine ban-list rejection |
| `mcp-server/fixtures/classify-argument-boolean-observations.unsupported-family-request.json` | requestedFamilies = ['evidence_hygiene']; used to test the unsupported_family error |

`mcp-server/fixtures/classify-argument-boolean-observations.scaffolded-response.json` — DELETED (no longer used; the scaffold envelope is gone).

`mcp-server/fixtures/classify-argument-boolean-observations.request.json` — UPDATED to use `requestedFamilies: ['parent_relation']` and a Family A `requestedRawKeys` set; the smoke script Check 5 + 9 use this.

---

## §5 — actorRole=moderator enum addition surface (Phase A.6)

### 5.1 Exact files + lines

`mcp-server/lib/semanticRefereePacketSchema.ts`:

| Line | Current | New |
|---|---|---|
| 85-90 | `ALL_ACTOR_ROLES` const has 4 values | Add `'moderator'` as 5th value |
| 136 | TS type union `'initiator' \| 'primary_opponent' \| 'chime_in' \| 'observer'` | Add `\| 'moderator'` |
| 241 | error message `'must be one of initiator\|primary_opponent\|chime_in\|observer'` | Update to include moderator |

### 5.2 Exact diff blocks (BINDING for the implementer)

**Block 1 — `ALL_ACTOR_ROLES` constant (line 85-90):**

```diff
 export const ALL_ACTOR_ROLES: readonly string[] = Object.freeze([
   'initiator',
   'primary_opponent',
   'chime_in',
   'observer',
+  'moderator',
 ]);
```

**Block 2 — TS type (line 136):**

```diff
-  actorRole?: 'initiator' | 'primary_opponent' | 'chime_in' | 'observer';
+  actorRole?: 'initiator' | 'primary_opponent' | 'chime_in' | 'observer' | 'moderator';
```

**Block 3 — error message (line 241):**

```diff
-      return { ok: false, path: 'roomContext.actorRole', detail: 'must be one of initiator|primary_opponent|chime_in|observer' };
+      return { ok: false, path: 'roomContext.actorRole', detail: 'must be one of initiator|primary_opponent|chime_in|observer|moderator' };
```

### 5.3 Required new tests (1 test minimum; BOTH tools)

**New test file:** `mcp-server/tests/actorRoleModerator.test.ts`

Two test cases:
- `classify_semantic_move accepts actorRole=moderator without invalid_params` — POST a request with `roomContext.actorRole = 'moderator'` and assert the tool either succeeds (fixture provider) OR returns a non-`invalid_params` error (e.g., `key_missing` if no Anthropic key in test env).
- `classify_argument_boolean_observations accepts actorRole=moderator without invalid_params` — same pattern; the boolean tool's input schema does NOT include `roomContext` (the Family A inputSchema has `parentText` / `threadContextExcerpt` instead), so this second test is **DROPPED** unless the boolean tool needs to accept `roomContext`. Per `classifyArgumentBooleanObservations.ts:28-55`, the boolean tool's input schema has no `roomContext`. So only 1 test needed: `classify_semantic_move accepts actorRole=moderator`.

**Final test count for §5: 1 new test in `mcp-server/tests/actorRoleModerator.test.ts`.**

### 5.4 Smoke script extension consideration

The existing `scripts/mcp-server-001-smoke.sh` Check 4 + Check 8 use `actorRole: 'primary_opponent'`. They do NOT exercise the moderator role. Optional extension: add **Check 10** that exercises `actorRole: 'moderator'` on the semantic-move tool to lock in the regression. **Decision:** add as Check 10 (optional but cheap). If the smoke script structure complicates Check 10 insertion (the 9/9 PASS counter would become 10/10), it can be folded into Check 4 by making Check 4 iterate two `actorRole` values.

**Recommended:** add Check 10 (new) — `POST /mcp/adapter-compat with actorRole=moderator returns non-invalid_params`. This keeps Checks 1-9 byte-equal to MCP-SERVER-001.

---

## §6 — Docs corrections (Phase A.7)

### 6.1 MCP-018 runbook precedence note (Decision 8a)

**File:** `docs/deployment/mcp-018-mcp-adapter-runbook.md`

**Insertion location:** Immediately AFTER the existing DB-config alternative note at line 95 (which mentions ADMIN-AI-001's DB layer overriding the env var).

**Insertion block:**

```markdown
> **Provider precedence (binding).** The semantic-referee Edge Function selects its provider via this precedence chain:
> 1. `public.semantic_referee_runtime_config.provider_mode` (DB row) — wins if present (singleton table; `id` is boolean, pinned to `true`).
> 2. `SEMANTIC_REFEREE_PROVIDER` Supabase secret — wins only if no DB row exists.
> 3. Default `'mock'` — wins only if neither is set.
>
> ADMIN-AI-001 introduced the DB-config layer. The DB row, when present, has higher precedence than the env var. MCP-SERVER-001-SMOKE on 2026-05-26 surfaced this when Phase 5 returned `provider: 'anthropic'` despite `SEMANTIC_REFEREE_PROVIDER=mcp` being set as a Supabase secret — the DB row carried `provider_mode='anthropic'` from an earlier session. The fix was a service-role SQL update on the DB row, NOT a secret change. Both layers should match in production to avoid this confusion.
```

### 6.2 MCP-SERVER-001-SMOKE template SQL correction (Decision 8b)

**File:** `docs/audits/MCP-SERVER-001-smoke-template.md`

**Brief intent re-read:** Decision 8b in the intent brief documents two `diff` blocks that "correct SQL using the actual schema". A read of the template at design time confirms the template does NOT currently contain the SQL UPDATE statements; the brief's diff blocks are showing what the corrected SQL should look like vs hypothetical wrong SQL. The template needs the SQL ADDED (with the corrected schema), not corrected in place.

**Interpretation (operator-deferred decision; surfaced in §11 brief ledger):** the MCP-SERVER-001-SMOKE template's Phase 5 should include the DB-config flip steps with the CORRECT SQL. This is what the 2026-05-26 audit ran. Add the following block to the template, immediately AFTER the Phase 5 section header (line 71):

```markdown
### Phase 5 prerequisite — DB-config provider override

If ADMIN-AI-001's DB-config layer is in effect (it is, in production as of 2026-05-26),
Phase 5 will fail to route through MCP if the DB row carries `provider_mode != 'mcp'`.
Verify and flip before running Phase 5:

```sql
-- Step 5.A — Inspect the runtime-config row (singleton).
select id, provider_mode, enabled, updated_at
from public.semantic_referee_runtime_config
where id = true;

-- Step 5.B — If provider_mode is not 'mcp', flip it (service-role required).
update public.semantic_referee_runtime_config
set provider_mode = 'mcp',
    enabled = true,
    updated_at = now()
where id = true
returning id, provider_mode, enabled, updated_at;
```

Schema notes:
- `id` is `boolean`; the table is a singleton with `id = true` constraint.
- The active toggle column is `enabled`, not `semantic_referee_enabled`.
- The Admin UI control for `mcp` provider stays disabled until ADMIN-MCP-001 ships;
  the SQL update is the operator-only path.
```

The intent brief's diff blocks (`id = '<id-from-select>'` → `id = true`; `semantic_referee_enabled` → `enabled`) describe the SQL shape that would have been wrong if naively transcribed from generic Supabase UPDATE patterns. The corrected SQL above is what actually works against the deployed schema.

**Implementer guidance:** add this as a new section in the smoke template's Phase 5; do NOT modify any other content of the template.

---

## §7 — MCP-SERVER-002-SMOKE template design (Phase A.8)

### 7.1 New template file

**Path:** `docs/audits/MCP-SERVER-002-smoke-template.md`

**Phase count:** 3 (vs MCP-SERVER-001's 5). Supabase wiring is already validated in MCP-SERVER-001-SMOKE; this template focuses on the tool-implementation correctness.

### 7.2 Phase structure

**Phase 1 — Local smoke (both tools):**
- Operator runs `cd mcp-server && deno task start` (optionally with `MCP_SERVER_USE_FIXTURE_PROVIDER=true` for no-key offline OR with a real Anthropic key).
- Operator runs `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>` (or `--base-url http://localhost:8080` if MCP-SERVER-002 renames the script — recommendation: keep the script name, extend its checks).
- Expected: 9 or 10 checks PASS (10 if Check 10 added per §5.4). Checks 5 + 9 NOW validate real Family A response shape, not `not_implemented` envelope.
- Result: PASS / FAIL.

**Phase 2 — Hosted deploy + hosted smoke:**
- Operator deploys via Deno Deploy (Git push to main or `deployctl deploy`).
- Operator verifies hosted env vars match MCP-SERVER-001 state (`ANTHROPIC_API_KEY` + `MCP_SERVER_BEARER_TOKEN` + `MODEL_PROVIDER=anthropic` + `MCP_SERVER_ENV=prod` + `ANTHROPIC_MODEL=claude-haiku-4-5`).
- Operator runs `bash scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net --token <hosted-token>`.
- Expected: 9 or 10 PASS. Checks 4 + 8 call real Anthropic for semantic-move (regression); Checks 5 + 9 call real Anthropic for Family A.
- **Capture the actual Family A response payload from Check 5 to `/tmp/family-a-response.json` for Phase 3.**
- Result: PASS / FAIL.

**Phase 3 — MCP-021A parser validation:**
- Operator runs a small validator script (provided in §7.3 below):
  ```
  deno run --allow-read mcp-server/scripts/validate-family-a-response.ts /tmp/family-a-response.json
  ```
- Validator asserts (BINDING):
  - schemaVersion === `'mcp-021.machine-observations.boolean.v1'`
  - `observations` is a plain object with boolean values
  - Every key in `observations` appears in `confidence` with a value in `{low, medium, high}`
  - Every key in `observations` appears in `evidenceSpan` (with string or null)
  - All rawKeys in `checkedRawKeys` are in the Family A 16-key set
  - Every evidenceSpan string ≤ 240 chars
  - Doctrine ban-list scan over all evidenceSpan strings + modelInfo strings: 0 hits
- Result: PASS / FAIL.

### 7.3 Validator script outline

**Path:** `mcp-server/scripts/validate-family-a-response.ts`

```ts
// MCP-SERVER-002 — Phase 3 validator script.
// Reads a saved Family A response payload from disk and asserts MCP-021A schema compliance.
//
// Usage:
//   deno run --allow-read mcp-server/scripts/validate-family-a-response.ts <path-to-response.json>
//
// Exit codes:
//   0 — all checks pass
//   1 — validation failure (specific failure printed to stderr)
//   2 — file load failure

import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';

const MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';
const MAX_EVIDENCE_SPAN_CHARS = 240;

const path = Deno.args[0];
if (!path) {
  console.error('Usage: validate-family-a-response.ts <path-to-response.json>');
  Deno.exit(2);
}

let raw: string;
try {
  raw = await Deno.readTextFile(path);
} catch (err) {
  console.error(`Failed to read ${path}: ${err}`);
  Deno.exit(2);
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(`Failed to parse JSON: ${err}`);
  Deno.exit(1);
}

// ... structural checks (schemaVersion, observations / confidence / evidenceSpan coordination,
//     rawKey membership in FAMILY_A_RAW_KEYS, evidenceSpan length ≤ 240, ban-list scan).
//
// Each failure prints a one-line error to stderr and exits 1.
// On all-pass, prints "VALIDATE_FAMILY_A_RESPONSE: PASS" and exits 0.
```

### 7.4 Verdict rules

- **PASS** (all 3 phases): MCP-021C-EDGE-SMOKE AUTHORIZED to re-run. MCP-021C-FAMILY-A-PROD authorized to file. MCP-SERVER-003+ (Family B prep) authorized.
- **PARTIAL** (Phase 1+2 PASS but Phase 3 finds a validation issue, OR Phase 1 PASS but Phase 2 fails on a single deploy-config issue): scope a fix card; do NOT authorize MCP-021C-EDGE-SMOKE re-run.
- **FAIL** (Phase 1 fails OR Phase 2 fails on a fundamental Anthropic / parser / model issue): file MCP-SERVER-002-FIX.

### 7.5 Authorization graph (post-PASS)

```
MCP-SERVER-002-SMOKE PASS
   ├── MCP-021C-EDGE-SMOKE AUTHORIZED to re-run (with live Family A)
   ├── MCP-021C-FAMILY-A-PROD AUTHORIZED to file (auto-trigger on argument post)
   ├── MCP-SERVER-003 AUTHORIZED to design (Family B implementation prep)
   ├── ADMIN-MCP-001 AUTHORIZED (was already authorized post-MCP-SERVER-001-SMOKE)
   └── OPS-MCP-OBSERVABILITY AUTHORIZED to scope
```

---

## §8 — Test plan

### 8.1 Server-side tests (Deno; `mcp-server/tests/`)

| # | Test file | Purpose |
|---|---|---|
| 1 | `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` | REWRITE — scaffold tests removed; new tests for: valid Family A request returns valid response shape; unsupported_family returns structured error; unsupported_rawKey returns error; schemaVersion mismatch returns invalid_params; multiple invocations preserve behavior |
| 2 | `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` | (continued) — fixture provider returns canonical response; fixture provider's malformed response triggers validation_failed; fixture provider's ban-list response triggers ban-list rejection |
| 3 | `mcp-server/tests/familyAPromptScan.test.ts` | NEW — source-text scan of `familyAPrompt.ts` asserts 0 doctrine ban-list hits in system prompt + user prompt template literals (excluding the literal negations in the absolute-rules block, which are tested via a different pattern); asserts all 16 rawKey strings appear in the prompt |
| 4 | `mcp-server/tests/familyABanListScan.test.ts` | NEW — unit tests for `scanFamilyABooleanResponseForBanList` — happy path (no hits), evidenceSpan with `winner` → reject, modelInfo.serverName with `verdict` → reject, etc. |
| 5 | `mcp-server/tests/familyAResponseValidator.test.ts` | NEW — unit tests for `validateMcpBooleanObservationResponse` — happy path; wrong schemaVersion; missing required field; observations/confidence key set mismatch; unknown rawKey in checkedRawKeys; evidenceSpan > 240 chars; flag count > 20; non-boolean observation value; non-band confidence value |
| 6 | `mcp-server/tests/familyAKeysParity.test.ts` | NEW — parity drift test: reads `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` source text; asserts all 16 rawKey literals appear in `mcp-server/lib/familyAKeys.ts` |
| 7 | `mcp-server/tests/mcpBooleanObservationSchemaParity.test.ts` | NEW — parity drift test: reads `src/features/nodeLabels/mcpBooleanObservationSchema.ts`; asserts schemaVersion constant + MAX_EVIDENCE_SPAN_CHARS + MAX_FLAGS_PER_RESPONSE + 6 failure-reason strings all present in BOTH files |
| 8 | `mcp-server/tests/familyAAnthropic.test.ts` | NEW — mock fetch tests for `runAnthropicFamilyAClassifier` — happy path returns parsed packet; HTTP 429 → rate_limited; HTTP 500 → api_error; timeout → model_timeout; non-JSON response → parse_failure; missing API key → key_missing; no real Anthropic call ever made |
| 9 | `mcp-server/tests/actorRoleModerator.test.ts` | NEW — asserts `classify_semantic_move` accepts `actorRole='moderator'` without `invalid_params` (the boolean tool has no roomContext, so only semantic-move needs the moderator test) |
| 10 | `mcp-server/tests/classifyArgumentBooleanObservationsSourceScan.test.ts` | UPDATE — the old MCP-SERVER-001 test asserted the scaffold DOES NOT call Anthropic; the new test asserts the real tool DOES call Anthropic via the shared `callAnthropic` helper, AND that the source file does NOT import the upstream `src/features/...` path (Outcome 3 boundary discipline) |
| 11 | `mcp-server/tests/anthropicNoLogging.test.ts` | UPDATE (EXISTING) — extend the source-scan to include `familyAAnthropic.ts` + `anthropicCall.ts` and assert no Authorization / API key / response body logging |
| 12 | `mcp-server/tests/classifySemanticMove.test.ts` | UNCHANGED — must continue to pass byte-equal (regression gate; Decision 5) |
| 13 | `mcp-server/tests/seedPromptParity.test.ts` | UNCHANGED — must continue to pass byte-equal (regression gate) |
| 14 | `mcp-server/tests/toolsList.test.ts` | UPDATE — the tool description text changed; update the assertion to match the new description |

**Total new + updated server-side tests: ~12 new files + 3 file updates. Total new test count: ~30-40 tests.** Well within Trigger 23's +60 budget.

### 8.2 CDiscourse-side tests (Jest; `__tests__/`)

Per intent brief Deliverable 9, CDiscourse-side is bounded to docs additions. The ONLY new CDiscourse-side test is:

| # | Test file | Purpose |
|---|---|---|
| 1 | `__tests__/mcpServerTwoSmokeTemplatePresence.test.ts` | NEW — asserts `docs/audits/MCP-SERVER-002-smoke-template.md` exists, has the 3-phase header structure, and contains the validator-script reference (light-weight presence + structure test, no execution) |

**Total CDiscourse-side new tests: 1.** Well within Trigger 22's +100 budget.

### 8.3 Smoke script extension (`scripts/mcp-server-001-smoke.sh`)

Check 5 + Check 9 currently assert `'isError':true` + `'reason':'not_implemented'` + `'MCP-SERVER-002'` (the scaffold envelope). Both checks need to assert the REAL Family A response shape:

```bash
# NEW Check 5 / Check 9 assertion shape:
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-a-v1"'; then
  pass "$CHECK_NAME"
```

The smoke request payload also needs `requestedFamilies: ["parent_relation"]` and a Family A rawKey set (e.g., `["challenges_parent","supports_parent"]`). Check 5's request body is currently:
```json
{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"...","nodeId":"fixture-node","currentText":"[fixture] body","threadContextExcerpt":"[fixture] thread","requestedFamilies":["family_evidence"],"requestedRawKeys":["evidence_present"],"definitions":{},"timeoutMs":12000}}
```

The `family_evidence` family is BANNED in the new server (unsupported_family). Change to:
```json
{..."requestedFamilies":["parent_relation"],"requestedRawKeys":["challenges_parent","supports_parent"]...}
```

Add a NEW Check 11 (optional, for unsupported_family regression coverage): `POST /mcp/adapter-compat with requestedFamilies=['evidence_hygiene']` returns `unsupported_family` error.

**Total smoke checks (post-MCP-SERVER-002): 9 (unchanged) → 10 (with actorRole moderator) → 11 (with unsupported_family).** Implementer judgement — both Check 10 + 11 are recommended.

### 8.4 Coverage commitment

| Surface | Coverage gate |
|---|---|
| Family A prompt | source-text scan: 0 ban-list hits + all 16 rawKeys present |
| Family A response validator | unit tests for every failure mode (8+ tests) |
| Family A doctrine ban-list scan | unit tests for every banned token shape (10+ test cases via parameterized describe) |
| Family A fixture provider | happy path + malformed response + ban-list response |
| Anthropic call (Family A) | mock fetch for happy + 4 failure paths |
| Cross-tree drift | 2 parity tests (rawKeys + schema constants) |
| actorRole=moderator | 1 test (semantic-move) |
| classify_semantic_move | regression — unchanged tests must still pass |

---

## §9 — Read-only boundary list

### 9.1 Files MCP-SERVER-002 MAY modify

**Server-side (Deno):**
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — scaffold → real (the 130-line file is rewritten)
- `mcp-server/lib/familyAPrompt.ts` — NEW
- `mcp-server/lib/familyAKeys.ts` — NEW
- `mcp-server/lib/familyABooleanRequestSchema.ts` — NEW
- `mcp-server/lib/familyAAnthropic.ts` — NEW
- `mcp-server/lib/familyABanListScan.ts` — NEW
- `mcp-server/lib/familyAFixtureProvider.ts` — NEW
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` — NEW
- `mcp-server/lib/anthropicCall.ts` — NEW (shared HTTP/timeout skeleton)
- `mcp-server/lib/anthropic.ts` — REFACTORED (uses shared skeleton; public exports unchanged; byte-equal interface)
- `mcp-server/lib/semanticRefereePacketSchema.ts` — BOUNDED EXCEPTION; 3-line surgical change for actorRole=moderator (lines 85-90, 136, 241)
- `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` — REWRITE (scaffold tests removed; real tests added)
- `mcp-server/tests/familyAPromptScan.test.ts` — NEW
- `mcp-server/tests/familyABanListScan.test.ts` — NEW
- `mcp-server/tests/familyAResponseValidator.test.ts` — NEW
- `mcp-server/tests/familyAKeysParity.test.ts` — NEW
- `mcp-server/tests/mcpBooleanObservationSchemaParity.test.ts` — NEW
- `mcp-server/tests/familyAAnthropic.test.ts` — NEW
- `mcp-server/tests/actorRoleModerator.test.ts` — NEW
- `mcp-server/tests/classifyArgumentBooleanObservationsSourceScan.test.ts` — NEW
- `mcp-server/tests/anthropicNoLogging.test.ts` — UPDATE (extend source-scan to new files)
- `mcp-server/tests/toolsList.test.ts` — UPDATE (description text changed)
- `mcp-server/fixtures/classify-argument-boolean-observations.family-a-root-request.json` — NEW
- `mcp-server/fixtures/classify-argument-boolean-observations.family-a-challenge-request.json` — NEW
- `mcp-server/fixtures/classify-argument-boolean-observations.family-a-refine-request.json` — NEW
- `mcp-server/fixtures/classify-argument-boolean-observations.family-a-canonical-response.json` — NEW
- `mcp-server/fixtures/classify-argument-boolean-observations.family-a-malformed-response.json` — NEW
- `mcp-server/fixtures/classify-argument-boolean-observations.family-a-ban-list-response.json` — NEW
- `mcp-server/fixtures/classify-argument-boolean-observations.unsupported-family-request.json` — NEW
- `mcp-server/fixtures/classify-argument-boolean-observations.request.json` — UPDATE (Family A keys)
- `mcp-server/fixtures/classify-argument-boolean-observations.scaffolded-response.json` — DELETE
- `mcp-server/scripts/validate-family-a-response.ts` — NEW

**CDiscourse-side:**
- `scripts/mcp-server-001-smoke.sh` — UPDATE Check 5 + 9 (real assertions; new request body); optional Check 10 + 11
- `docs/deployment/mcp-server-001-runbook.md` — UPDATE (precedence note + Family A testing instructions)
- `docs/deployment/mcp-018-mcp-adapter-runbook.md` — UPDATE (precedence note per Decision 8a)
- `docs/audits/MCP-SERVER-001-smoke-template.md` — UPDATE (add SQL block per Decision 8b §6.2; otherwise unchanged)
- `docs/audits/MCP-SERVER-002-smoke-template.md` — NEW (3-phase template)
- `docs/designs/MCP-SERVER-002.md` — NEW (this document)
- `docs/reviews/MCP-SERVER-002-review.md` — NEW (reviewer phase output)
- `docs/core/current-status.md` — UPDATE (handoff section + Latest implementer card HTML comment block)
- `__tests__/mcpServerTwoSmokeTemplatePresence.test.ts` — NEW
- `.gitignore` — UPDATE (add `phase5-*.json` per Deliverable 10)

### 9.2 Files MCP-SERVER-002 MUST NOT modify

- `mcp-server/tools/classifySemanticMove.ts` — Decision 5; Trigger 14
- `mcp-server/lib/seedPrompt.ts` — Decision 5
- `mcp-server/lib/doctrineBanList.ts` — UNCHANGED; the patterns are correct for both tools
- `mcp-server/main.ts` — UNCHANGED; the route shape is the same
- `mcp-server/lib/jsonRpc.ts` — UNCHANGED
- `mcp-server/lib/logging.ts` — UNCHANGED
- `mcp-server/lib/toolDispatch.ts` — UNCHANGED (both tool handlers continue to dispatch from the same switch)
- `mcp-server/lib/toolRegistry.ts` — UNCHANGED
- `mcp-server/lib/fixtureProvider.ts` — UNCHANGED (it's semantic-move-specific; Family A gets its own `familyAFixtureProvider.ts`)
- `supabase/functions/_shared/semanticReferee/*.ts` — ANY file; this is MCP-018 territory (Trigger ban: not in the allowed list)
- `supabase/functions/_shared/booleanObservations/*.ts` — MCP-021C-EDGE territory; Trigger 18
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts` — MCP-021A territory; Trigger 16
- `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` — MCP-021A territory; Trigger 16
- `src/features/nodeLabels/machineObservationDefinitions/index.ts` — MCP-021A territory; Trigger 16
- Any MCP-021B persistence file — Trigger 17
- Any UX file — Trigger 9
- Root `package.json` / `package-lock.json` — Trigger 13
- Any Supabase migration — out of scope
- Any existing Edge Function — out of scope

---

## §10 — HALT trigger table (all 23 + 4 designer-specific)

| # | Trigger | Status during Phase A | Notes |
|---|---|---|---|
| **PROTOCOL + SECURITY** |
| 1 | Client-side MCP call proposed | CLEAN | Server-side only; no CDiscourse `app/` or `src/` changes |
| 2 | EXPO_PUBLIC_* MCP server URL proposed | CLEAN | No env var changes proposed |
| 3 | MCP credentials exposed to app/client | CLEAN | `ANTHROPIC_API_KEY` + `MCP_SERVER_BEARER_TOKEN` stay on Deno Deploy |
| 4 | Server logs raw prompts/responses/tokens/keys | CLEAN | `mcp-server/lib/anthropic.ts:143-148` + new `familyAAnthropic.ts` use `sha256Hex(promptHash)` only; no raw logging; covered by §8.1 test #11 |
| 5 | Returns model-generated text as authoritative without schema validation | CLEAN | §3.4 enforces validateMcpBooleanObservationResponse before return |
| 6 | Server calls model provider before validating tool name + input schema | CLEAN | §3.1 validates input first; provider call is §3.3 |
| **SCOPE** |
| 7 | Implement Family B-J in this card | CLEAN | §3.1's `validateFamilyABooleanRequest` rejects all non-`parent_relation` families with `unsupported_family` |
| 8 | Persist classifier rows from MCP server | CLEAN | §3.6 returns the response; no Supabase writes |
| 9 | Display cap change / new UI | CLEAN | No UX files modified (§9.2) |
| 10 | New taxonomy key | CLEAN | Uses the 16 existing Family A keys verbatim |
| 11 | Activate account UI "Coming later (MCP-018)" affordance | CLEAN | ADMIN-MCP-001's job; not touched |
| 12 | New MCP-021A wire contract | CLEAN | schemaVersion stays `mcp-021.machine-observations.boolean.v1`; response shape is verbatim |
| 13 | New CDiscourse package dependency | CLEAN | No `package.json` changes (§9.2) |
| **COMPATIBILITY** |
| 14 | classify_semantic_move regresses | CLEAN | §8.1 #12 — `classifySemanticMove.test.ts` UNCHANGED; smoke Checks 4 + 8 byte-equal |
| 15 | Family A response fails MCP-021A parser | CLEAN | §3.4 uses server-side mirror of the same parser; §8.1 #7 parity test detects drift |
| 16 | Modify any MCP-021A taxonomy/schema file | CLEAN | §9.2 forbids it |
| 17 | Modify any MCP-021B persistence file | CLEAN | §9.2 forbids it |
| 18 | Modify any MCP-021C-EDGE file | CLEAN | §9.2 forbids it |
| **DOCS-SCOPE** |
| 19 | Extend docs corrections beyond the 3 named items | CLEAN | Only the 3 named docs in §6 + §7; no other |
| **DOCTRINE** |
| 20 | Verdict/correctness/winner/fallacy/bad-faith language in prompt | CLEAN | §2.7 scan: 0 hits (negations of banned tokens are doctrine-positive per MCP-SERVER-001 precedent) |
| 21 | Family A prompt instructs model to make verdict-style judgments | CLEAN | §2.6 checklist: all 16 questions are structural observations |
| **SCALE** |
| 22 | CDiscourse-side test count delta > +100 | CLEAN | §8.2 — exactly 1 new test |
| 23 | Server-side test count delta > +60 | CLEAN | §8.1 — ~30-40 new tests; well within budget |
| **DESIGNER-SPECIFIC** |
| 24 | Context window threshold (70%) | CLEAN | designer at ~55% context |
| 25 | Interpretive judgment requires operator decision beyond brief | TRIPPED (1 instance, surfaced as deferred review per §11.4) | The SQL "correction" in Decision 8b is interpreted as an ADDITION to the smoke template (the template doesn't currently contain the SQL); see §6.2 |
| 26 | MCP-021A response shape has drifted since MCP-021A shipped | CLEAN | `mcpBooleanObservationSchema.ts:36` constant verified verbatim; verified at design time read |
| 27 | No viable prompt-engineering approach found for Family A | CLEAN | §2 documents a viable single-prompt approach with token-budget headroom |

**Net result:** 26 CLEAN, 1 surfaced as operator-deferred decision (Trigger 25). No HALT.

---

## §11 — Brief ledger

### 11.1 Binding facts (verified)

| Item | Value | Source |
|---|---|---|
| MCP-021A schemaVersion constant | `mcp-021.machine-observations.boolean.v1` | `src/features/nodeLabels/mcpBooleanObservationSchema.ts:36` |
| MCP-021A parser | `parseMcpBooleanObservationResponse` | `src/features/nodeLabels/mcpBooleanObservationSchema.ts:190` |
| MCP-021A sanitizer | `sanitizeMcpBooleanObservationResponse` | `src/features/nodeLabels/mcpBooleanObservationSchema.ts:360` |
| Family A 16 keys (verbatim) | supports_parent, challenges_parent, refines_parent, extends_parent, distinguishes_parent, reframes_parent, questions_parent, summarizes_parent, acknowledges_parent, corrects_parent_detail, contrasts_with_parent, answers_parent_question, has_rebuttal, has_counter_rebuttal, rebutted, quote_anchors_parent | `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` |
| Family A registry verification | 16 entries; all with verbose definitions | §1.2 |
| Parser-import strategy | Outcome 3 (server-side mirror + parity test) | §1.1; mirrors MCP-SERVER-001 Phase A.9 |
| Server-side schema mirror module | `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` | §1.1 |
| Server-side Family A keys module | `mcp-server/lib/familyAKeys.ts` | §3.2 |
| Parity test file (schema) | `mcp-server/tests/mcpBooleanObservationSchemaParity.test.ts` | §1.1 |
| Parity test file (Family A keys) | `mcp-server/tests/familyAKeysParity.test.ts` | §1.1 |
| Anthropic model id | `claude-haiku-4-5` (default; env var override permitted) | `mcp-server/lib/anthropic.ts:29` |
| Family A prompt structure | Single prompt covering all 16 keys | §2.1 |
| Token budget (input estimated) | ~4,000-5,000 tokens; well within 200k context | §2.2 |
| Token budget (output) | MAX_TOKENS = 1500 | §2.2 |
| Doctrine ban-list scan on prompt | 0 hits (negations of banned tokens are doctrine-positive per MCP-SERVER-001 precedent) | §2.7 |
| Confidence-required enforcement | Server-side validator rejects responses with key-set mismatch between observations / confidence / evidenceSpan | §2.5, §3.4 |
| Fixture move arg1 UUID | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` (root, depth 0, start_thesis) | `__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts:34` |
| Fixture move arg2 UUID | `781f8057-9e2a-4fa9-92a8-469676950ff7` (depth 1, challenge_parent) | `__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts:40` |
| Fixture move arg3 UUID | `db0de3e0-24c6-40af-ba5f-2844acfa5bac` (depth 2, challenge_parent) | `__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts:47` |
| Expected positives — arg1 (root) | 0 parent_relation positives; up to 3 auto_metadata/lifecycle at low confidence (all sanitized OUT at timeline surface) | §4.2 |
| Expected positives — arg2 (depth 1) | 1-3 (challenges_parent likely high confidence) | §4.2 |
| Expected positives — arg3 (depth 2) | 2-4 (counter-rebuttal exercises relational keys) | §4.2 |
| actorRole=moderator: file | `mcp-server/lib/semanticRefereePacketSchema.ts` | §5.1 |
| actorRole=moderator: 3 line changes | 85-90 (constant), 136 (TS type), 241 (error message) | §5.2 |
| actorRole=moderator: 1 new test | `mcp-server/tests/actorRoleModerator.test.ts` | §5.3 |
| Docs correction (a): MCP-018 runbook | Add precedence note after line 95 (after existing DB-config alternative paragraph) | §6.1 |
| Docs correction (b): smoke template | ADD SQL block to Phase 5 (the template doesn't currently have the SQL; interpreted as ADDITION not correction — see §11.4) | §6.2 |
| MCP-SERVER-002-SMOKE template phases | 3 phases (Local / Hosted / MCP-021A parser validation) | §7 |
| Validator script | `mcp-server/scripts/validate-family-a-response.ts` | §7.3 |

### 11.2 Implementer commit cadence (6 commits; binding)

1. **Commit 1: Family A prompt + 16-key constant**
   - `mcp-server/lib/familyAKeys.ts` (NEW; FAMILY_A_RAW_KEYS + FAMILY_A_PROMPT_ENTRIES + FAMILY_A_CLASSIFIER_SET_VERSION)
   - `mcp-server/lib/familyAPrompt.ts` (NEW; FAMILY_A_SYSTEM_PROMPT + buildFamilyAUserPrompt + FAMILY_A_MAX_TOKENS + FAMILY_A_TEMPERATURE)
   - `mcp-server/tests/familyAPromptScan.test.ts` (NEW)
   - Skill scan + ban-list scan tests pass.

2. **Commit 2: Real classify_argument_boolean_observations tool (scaffold → real)**
   - `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` (NEW)
   - `mcp-server/lib/familyABooleanRequestSchema.ts` (NEW)
   - `mcp-server/lib/familyABanListScan.ts` (NEW)
   - `mcp-server/lib/anthropicCall.ts` (NEW; shared skeleton)
   - `mcp-server/lib/anthropic.ts` (REFACTORED; semantic-move tests still pass)
   - `mcp-server/lib/familyAAnthropic.ts` (NEW)
   - `mcp-server/lib/familyAFixtureProvider.ts` (NEW)
   - `mcp-server/tools/classifyArgumentBooleanObservations.ts` (REAL implementation; replaces scaffold)
   - `mcp-server/tests/familyAResponseValidator.test.ts` (NEW)
   - `mcp-server/tests/familyABanListScan.test.ts` (NEW)
   - `mcp-server/tests/familyAAnthropic.test.ts` (NEW)
   - `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` (REWRITE)
   - `mcp-server/tests/classifyArgumentBooleanObservationsSourceScan.test.ts` (NEW)
   - `mcp-server/tests/anthropicNoLogging.test.ts` (UPDATE)
   - `mcp-server/tests/toolsList.test.ts` (UPDATE)
   - All server-side tests + classifySemanticMove.test.ts pass.

3. **Commit 3: actorRole=moderator enum addition**
   - `mcp-server/lib/semanticRefereePacketSchema.ts` (3-line change; BOUNDED EXCEPTION)
   - `mcp-server/tests/actorRoleModerator.test.ts` (NEW)
   - Regression: classifySemanticMove.test.ts still passes; semanticRefereePacketSchema.test.ts still passes (the existing test exercises 4-value enum; the new enum admits 5 values without rejecting any of the 4).

4. **Commit 4: Family A fixtures + parser drift tests**
   - All 7 new fixture files in `mcp-server/fixtures/`
   - `mcp-server/fixtures/classify-argument-boolean-observations.scaffolded-response.json` (DELETE)
   - `mcp-server/fixtures/classify-argument-boolean-observations.request.json` (UPDATE)
   - `mcp-server/tests/familyAKeysParity.test.ts` (NEW)
   - `mcp-server/tests/mcpBooleanObservationSchemaParity.test.ts` (NEW)
   - Parity tests pass.

5. **Commit 5: Smoke script extension + validator script**
   - `scripts/mcp-server-001-smoke.sh` (UPDATE Check 5 + 9; ADD Check 10 + 11)
   - `mcp-server/scripts/validate-family-a-response.ts` (NEW)
   - Manual smoke run against `MCP_SERVER_USE_FIXTURE_PROVIDER=true` confirms 11/11 PASS.

6. **Commit 6: Docs corrections + new smoke template + handoff**
   - `docs/deployment/mcp-server-001-runbook.md` (UPDATE; precedence note + Family A testing)
   - `docs/deployment/mcp-018-mcp-adapter-runbook.md` (UPDATE; precedence note per Decision 8a)
   - `docs/audits/MCP-SERVER-001-smoke-template.md` (UPDATE; add SQL block per Decision 8b §6.2)
   - `docs/audits/MCP-SERVER-002-smoke-template.md` (NEW; 3-phase template per §7)
   - `__tests__/mcpServerTwoSmokeTemplatePresence.test.ts` (NEW)
   - `.gitignore` (UPDATE; `phase5-*.json`)
   - `docs/core/current-status.md` (UPDATE; handoff section + Latest implementer card HTML comment block)
   - All gates: `npm run typecheck`, `npm run lint`, `npm run test`, `deno test mcp-server/tests/` pass.

### 11.3 Operator-deferred decisions (explicit, requires operator review post-merge)

| # | Decision | Why deferred | When to resolve |
|---|---|---|---|
| 1 | Model recommendation for Family A: stay with `claude-haiku-4-5` OR switch to `claude-sonnet-4-5` for nuanced relational keys | Phase A.3 documents both options; the smoke-output review on Family A's nuanced keys (has_counter_rebuttal, quote_anchors_parent, distinguishes_parent, reframes_parent) is the empirical signal. Stay with haiku for v1. | Post MCP-SERVER-002-SMOKE PASS — if smoke output shows systematic under-detection, operator flips `ANTHROPIC_MODEL` env on Deno Deploy without code change. |
| 2 | auto_metadata + lifecycle keys (has_rebuttal, has_counter_rebuttal, rebutted): should the Edge Function compute these deterministically and skip the model, OR should the model attempt to infer them from move text? | Phase A.2 documents the fundamental data limitation: the model can't see the tree. For v1 the model still attempts and the sanitizer drops low-confidence positives at the timeline surface. The cleaner approach is for the Edge Function to compute these from the tree. | MCP-021C-FAMILY-A-PROD design phase — the production trigger card is the right place to decide whether to deterministically pre-fill these 3 keys. |
| 3 | Smoke Check 10 (actorRole=moderator) + Check 11 (unsupported_family): both recommended in §8.3; operator's call whether to add or fold into existing Checks | Implementer judgment; the design recommends adding both. | Implementer commit 5. |
| 4 | Token budget actual vs estimated: if first hosted Family A run exceeds 6,000 input tokens, file a follow-up before MCP-SERVER-003 | §2.2 documents the abbreviation strategy as out-of-scope for v1 but a viable fallback. | Post MCP-SERVER-002-SMOKE — operator records the actual `usage.input_tokens` from the first live Family A response. |

### 11.4 Operator-deferred interpretation (orchestrator judgment beyond brief)

| # | Interpretation | Brief says | I interpret as |
|---|---|---|---|
| 1 | Decision 8b SQL "correction" in smoke template | The template "currently has SQL" with `id = '<id-from-select>'` and `semantic_referee_enabled = true` (per the brief's diff blocks) | The template DOES NOT currently contain SQL. The brief's diff blocks describe the right shape vs a hypothetical wrong shape. I interpret Decision 8b as ADDING the corrected SQL to the smoke template's Phase 5 — see §6.2. The diff blocks the brief shows are kept as documentation of the schema-shape gotcha (`id = true`, not `id = '<uuid>'`; `enabled`, not `semantic_referee_enabled`). |
| 2 | Smoke Check 5/9 request body | The current Check 5/9 sends `requestedFamilies: ["family_evidence"]` + `requestedRawKeys: ["evidence_present"]`; this asserted the SCAFFOLD envelope | I interpret as needing to change BOTH the request body (Family A keys) AND the assertion (Family A response shape). The brief's "extend check 5 + 9 to validate real Family A response shape" implies both changes. |
| 3 | classifyArgumentBooleanObservationsSourceScan test | The MCP-SERVER-001 test asserts the scaffold does NOT call fetch/anthropic | I interpret the rewrite as ADDING a new variant that asserts the REAL tool DOES call via the shared helper, AND that the source file does NOT import from `src/features/...` (Outcome 3 boundary). Keeps the doctrine-positive scan structure of the original test. |

### 11.5 Brief authorship

This design is authored against an operator-authored intent brief (`docs/designs/MCP-SERVER-002-intent.md`). All Phase A audits ran against the brief's binding decisions. No section of this design substitutes orchestrator judgment for operator-binding facts beyond the 3 interpretation items in §11.4. The 4 deferred decisions in §11.3 are explicit operator review items the brief itself flagged or implied.

---

## §12 — Doctrine self-check

- **cdiscourse-doctrine §1 (Score is gameplay, not truth):** Family A's 16 keys are all structural observations of move posture; none assigns a truth value to a claim or labels a person; §2.6 verbatim checklist confirms. The system prompt's absolute rules (`'You do NOT decide who is right'`, `'You do NOT decide the winner'`, etc.) are negations of banned tokens — doctrine-positive per MCP-SERVER-001 precedent.
- **cdiscourse-doctrine §7 (No AI calls from production app):** All Anthropic calls happen ONLY in `mcp-server/lib/familyAAnthropic.ts` (server-side Deno; not the CDiscourse production app). The CDiscourse app calls the Supabase Edge Function (MCP-021C-EDGE), which calls the MCP server, which calls Anthropic. The trust boundary is preserved.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** All 16 keys are MACHINE OBSERVATIONS. The MCP-021A schema's response carries `modelInfo.provider: 'mcp'` to identify them as machine-generated. They are never alleged by a user. Sensitive observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) are NOT in Family A — they are in Family B-J which MCP-SERVER-002 explicitly does not implement.
- **evidence-doctrine (popularity is not evidence):** Family A's keys do NOT include popularity / engagement / virality dimensions. Those are in different families (Family C+); none in scope here. The system prompt absolute rule `'You do NOT treat popularity, engagement, or virality as evidence.'` is included verbatim.
- **supabase-edge-contract (no service-role in client):** MCP-SERVER-002 makes no Supabase calls. The MCP server holds Anthropic credentials only; Supabase credentials stay on the Edge Function side.
- **expo-rn-patterns (no client AI calls):** confirmed; no `src/` or `app/` file modified.
- **test-discipline (tests are required):** §8 enumerates 12 new server-side test files + 1 new CDiscourse-side test + 3 file updates. Coverage gates: every failure mode of the validator + every banned token shape + parity drift on schema constants + Family A keys parity + actorRole=moderator regression + classifySemanticMove regression byte-equal.

---

## §13 — Risks for the implementer

| Risk | Mitigation |
|---|---|
| The shared `callAnthropic` refactor changes semantic-move's wire behavior | Run `npm run test` for CDiscourse (no impact, the upstream is unchanged) + `deno test mcp-server/tests/` (semantic-move tests are unchanged; the refactor is additive — semantic-move's `anthropic.ts` public exports stay byte-equal). The refactor MUST be verified by smoke Checks 4 + 8 going PASS unchanged on the live MCP server before MCP-SERVER-002-SMOKE PASS is claimed. |
| Family A prompt's token cost exceeds claude-haiku-4-5's budget | §2.2 documents the abbreviation fallback. Operator-deferred decision §11.3 item 4. |
| auto_metadata + lifecycle keys (has_rebuttal, etc.) produce noisy false positives because the model can't see the tree | Sanitizer's `timelineMinConfidence: 'high'` filter at the Edge Function side drops most of these noise. Operator-deferred decision §11.3 item 2 — production trigger card should pre-fill these deterministically. |
| Parity tests are too strict and trigger on cosmetic upstream edits | The parity tests assert ONLY: schemaVersion string literal + 6 failure-reason strings + 4 numeric constants (240, 20) + 16 rawKey strings. Cosmetic edits to comments / formatting are unaffected. |
| actorRole=moderator addition breaks the existing 4-value validator test | The existing validator test (`semanticRefereePacketSchema.test.ts`) exercises 4 valid actorRoles + 1 invalid. The 5-value enum admits all 4 existing + the new moderator + still rejects junk strings. The existing assertion `expect(validate({actorRole: 'observer'})).ok === true` STAYS true. |
| The unsupported_family path returns a structured error envelope that the Edge Function adapter doesn't yet recognize | The Edge Function adapter (`booleanObservationMcpAdapterCore.ts`) is MCP-021C-EDGE territory. MCP-SERVER-002 produces a structured error envelope that follows the existing MCP error pattern; the Edge Function falls back to deterministic layer on any non-success response. The smoke template Phase 3 exercises this. |
| Deletion of scaffolded-response.json breaks something | The fixture is only used by tests + smoke (scaffolded). After the rewrite, no test references it. The implementer must grep `scaffolded-response` across all files before deletion to confirm zero references remain. |

---

## §14 — Out of scope (explicit)

- Family B-J implementation. The unsupported_family error envelope is the boundary.
- Persistence writes from the MCP server. The MCP-021B persistence layer handles writes on the Edge Function side.
- Display cap change / new UI. The chip rendering pipeline (MCP-021C-EDGE → Source 6 adapter → UX-001.5A chips) is unchanged.
- New taxonomy keys. The 16 Family A keys are fixed.
- Activating account UI "Coming later (MCP-018)" affordance. ADMIN-MCP-001's job.
- New MCP-021A wire contract. The schemaVersion stays at v1.
- New CDiscourse package dependency. Server-side uses Deno-native imports.
- Production trigger / auto-run on argument post. MCP-021C-FAMILY-A-PROD will own that.
- Smoke deployment to Deno Deploy. The operator runs MCP-SERVER-002-SMOKE post-merge.
- DB migration. None required.
- Edge Function changes. None required.

---

## §15 — Operator steps (post-merge)

Post-merge, the operator runs MCP-SERVER-002-SMOKE per §7 / `docs/audits/MCP-SERVER-002-smoke-template.md`:

1. **Phase 1 — local smoke** (5 min): `deno task dev` in `mcp-server/`; `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>`; expect 9-11/9-11 PASS (depending on Check 10 + 11 addition).
2. **Phase 2 — hosted deploy + hosted smoke** (15-20 min): Deno Deploy auto-deploys on push to main (per MCP-SERVER-001 operator setup); operator verifies hosted env vars unchanged; runs smoke against `https://cdiscourse-mcp-server.civildiscourse.deno.net`; captures the Family A response payload for Phase 3.
3. **Phase 3 — MCP-021A parser validation** (10 min): `deno run --allow-read mcp-server/scripts/validate-family-a-response.ts /tmp/family-a-response.json`; expect `VALIDATE_FAMILY_A_RESPONSE: PASS`.

If all 3 pass: MCP-021C-EDGE-SMOKE AUTHORIZED to re-run; MCP-021C-FAMILY-A-PROD AUTHORIZED to file; MCP-SERVER-003 (Family B prep) AUTHORIZED.

No DB migration. No Edge Function deploy. The Deno Deploy push is the only deployment action.
