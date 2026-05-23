# Semantic-referee prompt template (current — `mcp-semantic-referee-prompt-v1`)

**Card:** MCP-MOD-003 (Rules UX · P2 · S · Release 6.9 · Movement A).
**System-prompt source-of-truth:** `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` — the `SEMANTIC_REFEREE_SYSTEM_PROMPT` exported constant.
**User-message source-of-truth:** `supabase/functions/_shared/semanticReferee/seedPrompt.ts` — the `buildClassifierPrompt(request)` function and its three internal blocks (per-id question list, strict-JSON instruction, worked example).
**Per-id question source-of-truth:** `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts` — `SEMANTIC_CLASSIFIER_CATALOG[].structuralQuestion` (23 entries, parity-locked to `ALL_SEMANTIC_CLASSIFIER_IDS`). Post-MCP-MOD-005 `buildClassifierPrompt` iterates this catalog directly; there is no per-id lookup table in `seedPrompt.ts`.
**Redacted-input source-of-truth:** `supabase/functions/_shared/semanticReferee/seedPrompt.ts` — the `buildInputBlock(request)` private helper; the input that reaches it has already been double-redacted on the client and at the Edge boundary by `redaction.ts`.

This document inventories the structure of the semantic-referee seed prompt as it is built today (the
`mcp-semantic-referee-prompt-v1` version stamp). It walks through six layered pieces: the system prompt
shipped on every call, the user-message instruction wall, the per-id structural question selection,
the redacted input block, the source-file map, and the prompt-version stamping convention. Every
quoted string is byte-faithful to the source.

The card is documentation-only. No production code is changed by MCP-MOD-003. Findings are surfaced in
the closing `## Findings` section and forwarded to the modularity-slate refactor cards (MCP-MOD-004 /
MCP-MOD-005); they are not fixed here.

## How to read each section

- Verbatim quoted strings are rendered inside a fenced code block immediately under a
  `<!-- prompt-block:<section-id> -->` HTML comment marker. The parity test
  (`__tests__/semanticRefereePromptTemplateParity.test.ts`) extracts the block content via the marker
  and asserts equality with the live source.
- "Doctrine clause" annotations name which doctrine line a system-prompt clause enforces. The
  references are to `cdiscourse-doctrine` (the universal product doctrine skill) and `docs/designs/MCP-001.md`
  (the semantic-referee architecture design). They are documentation aids; the system prompt itself is
  the authoritative wording.
- Source-file references are absolute paths from the repo root. The line numbers reflect the source as
  of MCP-MOD-003 and may drift; the marker-extracted parity test makes drift in the QUOTED text fail
  loudly, the line numbers in prose are descriptive.

---

## 1. System prompt

The system prompt is shipped on every call as the `system` field of the Anthropic Messages API
request body (`buildAnthropicRequestBody` in `anthropicClassifierCore.ts`). It frames the model as a
structural classifier whose entire purpose is to answer bounded yes/no questions about an argument
move's structure — never about its truth, popularity, person, or outcome.

The constant name in the source is `SEMANTIC_REFEREE_SYSTEM_PROMPT`. It is exported and stable; a
wording change to any clause is a `SEED_PROMPT_VERSION` bump (see §6).

<!-- prompt-block:system-prompt -->
```
You are a CDiscourse semantic classifier for a structured debate application.
Return strict JSON only.

Absolute rules:
- You do NOT decide who is right in a debate.
- You do NOT decide the winner of any debate.
- You do NOT assign a truth value to any claim.
- You do NOT treat popularity, engagement, or virality as evidence.
- You do NOT describe, judge, or label the person — only the move's structure.
- You do NOT recommend hiding, deleting, or modifying any content.
- You do NOT block an ordinary post — your output is advisory metadata only.

You classify whether an argument MOVE has bounded structural properties of game
play: parent continuity, evidence hygiene, branch hygiene, constructive
movement, debate-mode fit, and friction. For each requested classifier you
answer 0 or 1 with a short confidence and a lowercase snake_case reason code.

Every value you return must be 0 or 1. Never include a blocking field, a truth
field, a verdict field, or a winner field. Return ONLY the JSON object the user
prompt describes — no prose, no markdown, no chain-of-thought.
```

### Annotations — doctrine clause coverage

- `You are a CDiscourse semantic classifier for a structured debate application.` — Framing line. Tells
  the model the response context.
- `Return strict JSON only.` — The contract wall. Reinforced by the user-message instruction
  (`Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.`) and
  by the parser (`parseJsonFromContent` extracts the first `{...}` block and rejects anything else).
- `You do NOT decide who is right in a debate.` — Doctrine clause: `cdiscourse-doctrine §1` (score is
  gameplay analysis, never truth). Also `MCP-001 §10` (no truth verdict).
- `You do NOT decide the winner of any debate.` — Doctrine clause: `cdiscourse-doctrine §1` (no
  "winner / loser" label). Also `MCP-001 §10` (no winner / outcome).
- `You do NOT assign a truth value to any claim.` — Doctrine clause: `cdiscourse-doctrine §4` (AI must
  not assign a truth value). Also `MCP-001 §10` (no truth verdict).
- `You do NOT treat popularity, engagement, or virality as evidence.` — Doctrine clause:
  `cdiscourse-doctrine §3` (popularity is not evidence). The structural classifier
  `uses_popularity_as_evidence` exists to FLAG this pattern in a move, not to grant it weight.
- `You do NOT describe, judge, or label the person — only the move's structure.` — Doctrine clause:
  `cdiscourse-doctrine §1` (no "liar / dishonest / bad faith / manipulative / extremist /
  propagandist / stupid / idiot" labels). All classifier questions ask about the MOVE, never the
  participant.
- `You do NOT recommend hiding, deleting, or modifying any content.` — Doctrine clause:
  `cdiscourse-doctrine §4` (AI moderator must not delete / hide / modify content automatically).
- `You do NOT block an ordinary post — your output is advisory metadata only.` — Doctrine clause:
  `cdiscourse-doctrine §1` (validation can block, score cannot) and `cdiscourse-doctrine §4`
  (`authoritative` always `false` for AI-sourced flags). The packet's `authoritative` field is
  hard-pinned `false` by the boundary regardless of model output.
- `You classify whether an argument MOVE has bounded structural properties of game play: parent
  continuity, evidence hygiene, branch hygiene, constructive movement, debate-mode fit, and
  friction.` — Names the six families that span the 23-id catalog v0 (`MCP-001 §8`; see also the
  classifier-catalog inventory at `docs/architecture/semantic-referee-classifier-catalog.md` §A/§C/§D/
  §E/§B-§G). This sentence is the structural mandate.
- `For each requested classifier you answer 0 or 1 with a short confidence and a lowercase
  snake_case reason code.` — The per-classifier answer shape. The full output contract (`binaries`
  array, `routeSuggestion`, `frictionSuggestion`, `scoreHints`) is detailed in the user message.
- `Every value you return must be 0 or 1.` — Binary-only requirement. Doctrine clause:
  `MCP-001 §3` (bounded binary classifier output, no continuous scores).
- `Never include a blocking field, a truth field, a verdict field, or a winner field.` — Defensive
  carve-out. The `.strict()` outbound schema already drops unknown keys; the content-safety scanner
  rejects verdict tokens nested inside otherwise-valid strings. This sentence tells the model not to
  emit them in the first place.
- `Return ONLY the JSON object the user prompt describes — no prose, no markdown, no
  chain-of-thought.` — Strict-JSON contract reinforcement. Aligned with the user-message
  `Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.`

---

## 2. User-message instruction (strict-JSON contract)

The user message is a single string assembled by `buildClassifierPrompt(request)` in
`seedPrompt.ts`. Its structure is fixed: a per-id question header → the strict-JSON instruction
paragraph → a worked example → the redacted input block. The "instruction paragraph" below is the
strict-JSON contract wall — the parser depends on the model emitting a single `{...}` object that
conforms to the named contract.

In the source, the instruction is an array of strings joined with a single space (`.join(' ')`), so
the rendered text is a single paragraph. The block below is byte-faithful to the rendered output.

<!-- prompt-block:user-message-instruction -->
```
Answer each structural question above with 0 or 1 for the move below. Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought. The object must conform to the semantic-referee packet contract: a `binaries` array (one entry per requested classifier, each with `classifierId`, `value` 0 or 1, `confidence` low/medium/high, and a lowercase snake_case `reasonCode`), a `routeSuggestion`, a `frictionSuggestion`, and a `scoreHints` object of six integers 0..3. `routeSuggestion` MUST be exactly one of: "mainline", "vertical_chime_branch", "diagonal_tangent", "outer_realm", "cards_detail", "synthesis_lane", "no_route_change". `frictionSuggestion` MUST be exactly one of: "none", "soft_chip", "pre_send_pause", "ask_for_quote", "ask_for_source", "suggest_branch", "suggest_narrow", "cooldown_notice". Do not include any blocking, verdict, truth, or winner field.
```

### Annotations — the contract this paragraph encodes

- `Answer each structural question above with 0 or 1 for the move below.` — Binds the answers to the
  per-id question list emitted just above (see §3). Each requested classifier id gets one binary
  answer.
- `Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.` —
  The contract wall. `parseJsonFromContent` extracts the first `{...}` from the model text; this
  instruction tells the model not to wrap it in a Markdown fence, prefix with reasoning, or add a
  closing remark.
- `The object must conform to the semantic-referee packet contract: a 'binaries' array (one entry per
  requested classifier, each with 'classifierId', 'value' 0 or 1, 'confidence' low/medium/high, and a
  lowercase snake_case 'reasonCode'), a 'routeSuggestion', a 'frictionSuggestion', and a
  'scoreHints' object of six integers 0..3.` — Names the four top-level fields the outbound
  `SemanticRefereePacketSchema` requires from the model. The boundary itself stamps `packetVersion`,
  `promptVersion`, `modelVersion`, `provider`, `authoritative`, `inputHash`, `contentHash`, `roomId`,
  and the optional `moveId` / `parentId` / `selectedAction` / `selectedMoveType` / `debateMode`
  (`stampPacketIdentity` in `anthropicProvider.ts`).
- `'routeSuggestion' MUST be exactly one of: "mainline", "vertical_chime_branch", "diagonal_tangent",
  "outer_realm", "cards_detail", "synthesis_lane", "no_route_change".` — Enumerates the seven
  allowed values. Matches `ALL_ROUTE_SUGGESTIONS` in `types.ts`. SMOKE-FIX-002 added this enumeration
  inline (the prior `mcp-semantic-referee-prompt-v0` did not) so the model is told the enum
  directly instead of being asked to infer it.
- `'frictionSuggestion' MUST be exactly one of: "none", "soft_chip", "pre_send_pause", "ask_for_quote",
  "ask_for_source", "suggest_branch", "suggest_narrow", "cooldown_notice".` — Enumerates the eight
  allowed values. Matches `ALL_FRICTION_SUGGESTIONS` in `types.ts`. Same SMOKE-FIX-002 addition.
- `Do not include any blocking, verdict, truth, or winner field.` — Reinforces the system prompt's
  "Never include a blocking field…" clause at the contract level. A model that includes such a field
  fails the `.strict()` outbound schema (unknown-key drop) AND the `scanPacketContent` content wall.

The instruction paragraph is followed by a one-shot worked example showing the packet shape with
illustrative-only values, then a blank line, then the redacted input block (§4). The worked example
is not the contract wall — the contract wall is the paragraph above.

---

## 3. Per-id question list

`buildClassifierPrompt(request)` emits one question line per requested classifier id. The selection
mechanism is mechanical:

1. The caller passes `request.requestedClassifiers` — a list of `SemanticClassifierId` values. In
   today's wired path (`useSemanticReferee` → `submit-argument` → `semantic-referee` Edge Function),
   the list is the 9-id `POST_SUBMIT_CLASSIFIER_SET` from `src/features/semanticReferee/semanticTriggerInput.ts`
   batched into ≤ 2 calls of ≤ 5 classifiers each by MCP-012's batching logic.
2. `buildClassifierPrompt` iterates `SEMANTIC_CLASSIFIER_CATALOG` directly (post-MCP-MOD-005),
   filters by the request's `requestedClassifiers` (treated as a set for membership), de-duplicates,
   and emits `- <id>: <entry.structuralQuestion>` on its own line. Iteration order is the catalog's
   declaration order — same as `ALL_SEMANTIC_CLASSIFIER_IDS` — which matches the order the pre-refactor
   per-id lookup produced for the typical wired-path call (the request lists ids in catalog order).
   An unknown / non-catalog id in the request is silently absent from the output (catalog-iteration
   simply does not match it); the inbound `ClassifyMoveRequestSchema` already rejects requests that
   carry one before the provider runs.
3. The line list is prepended with the literal header `Structural questions for this move:` and
   joined with `\n`. The header and the question list are then joined with the strict-JSON
   instruction (§2), the worked example, and the redacted input block (§4) by single-newline
   separators (and one blank line between each subsection).

The per-id question text is the source-of-truth — a wording change is a one-line edit in
`SEMANTIC_CLASSIFIER_CATALOG` (the `structuralQuestion` field of the relevant entry) and a
`SEED_PROMPT_VERSION` bump. The classifier-catalog inventory
(`docs/architecture/semantic-referee-classifier-catalog.md`) renders every question byte-for-byte
under its own per-id marker; this document only inventories the assembly mechanism plus one
deterministic sample.

### Deterministic sample — first three catalog ids

The sample below shows the FULL `buildClassifierPrompt` output for a fixed input:

- `request.requestedClassifiers = ['responds_to_parent', 'introduces_new_issue', 'asks_for_evidence']`
  (the first three ids in `ALL_SEMANTIC_CLASSIFIER_IDS`).
- `request.roomContext = { debateMode: 'standard' }`.
- `request.moveBodyRedacted = '[MOVE_BODY]'`, `request.parentBodyRedacted = '[PARENT_BODY]'`.
- `request.roomId = 'room-doc-sample'`, `request.contentHash = 'h0'`.

The parity test invokes `buildClassifierPrompt` with these exact inputs and asserts the rendered
output equals the block below byte-for-byte. Drift in any of the four blocks (system prompt, user
instruction, per-id questions, redacted input frame) makes this assertion fail.

<!-- prompt-block:per-id-question-sample -->
````
Structural questions for this move:
- responds_to_parent: Does this move directly engage the parent's claim, mechanism, question, evidence, or requested clarification?
- introduces_new_issue: Does this move raise a new issue that could be debated separately from the parent?
- asks_for_evidence: Does this move request a source, citation, primary source, receipt, or exact quote?

Answer each structural question above with 0 or 1 for the move below. Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought. The object must conform to the semantic-referee packet contract: a `binaries` array (one entry per requested classifier, each with `classifierId`, `value` 0 or 1, `confidence` low/medium/high, and a lowercase snake_case `reasonCode`), a `routeSuggestion`, a `frictionSuggestion`, and a `scoreHints` object of six integers 0..3. `routeSuggestion` MUST be exactly one of: "mainline", "vertical_chime_branch", "diagonal_tangent", "outer_realm", "cards_detail", "synthesis_lane", "no_route_change". `frictionSuggestion` MUST be exactly one of: "none", "soft_chip", "pre_send_pause", "ask_for_quote", "ask_for_source", "suggest_branch", "suggest_narrow", "cooldown_notice". Do not include any blocking, verdict, truth, or winner field.

Worked example of the packet shape (the values below are illustrative —
choose your own values based on the structural questions; do not copy these
verbatim):
```json
{
  "binaries": [
    {
      "classifierId": "responds_to_parent",
      "value": 1,
      "confidence": "high",
      "reasonCode": "parent_continuity_engaged"
    }
  ],
  "routeSuggestion": "mainline",
  "frictionSuggestion": "none",
  "scoreHints": {
    "continuityCredit": 2,
    "evidencePressure": 1,
    "branchHygiene": 1,
    "synthesisReadiness": 0,
    "sourceChainDebt": 0,
    "unresolvedRedirectRisk": 0
  }
}
```

Input to classify:
Room debate mode: standard
Parent move (the move being replied to):
[PARENT_BODY]
Move to classify:
[MOVE_BODY]
````

The fenced JSON block inside the sample is the literal source-text — note that the outer block above
uses a QUADRUPLE-backtick fence (` ```` `) so the inner ` ```json ` … ` ``` ` triple-backtick fence
(part of the worked example) is preserved as literal text rather than terminating the outer block.
The parity test extracts the outer fenced block by its `<!-- prompt-block:per-id-question-sample -->`
marker and compares to the live function output. The inner triple-backtick fences are preserved as
literal text inside the comparison.

---

## 4. Redacted input block

The redacted input block is the SECOND-to-LAST section of the user message (the worked example sits
between it and the strict-JSON instruction). It frames the room context, the parent body, and the
move body for the model to classify. The bodies arrive ALREADY redacted by two passes:

1. **Client-side first pass** — `src/features/semanticReferee/clientRedaction.ts` (`redactBodyForReferee`)
   strips `@handle`, URL, email, long-digit, and provider-key shapes before the body leaves the
   device.
2. **Edge boundary second pass** — `supabase/functions/_shared/semanticReferee/redaction.ts`
   (`redactClassifyMoveRequest`) re-runs the same shape patterns at the Edge Function boundary
   inside `semantic-referee/index.ts:92` (the only call site). This is belt-and-suspenders: if the
   client redaction was bypassed (a future provider, a misbehaving caller), the boundary catches it.

`seedPrompt.ts`'s private `buildInputBlock(request)` function consumes the already-redacted bodies
and formats the input block for the prompt. It does NOT itself redact — by the time the body reaches
it, the two upstream passes have already run. The block layout is:

```
Input to classify:
[Optional: Room debate mode: <debateMode>]
[Optional: Selected action: <selectedAction>]
[Optional: Declared move type: <selectedMoveType>]
[Optional: Participant side: <side>]
[Optional: Participant role: <actorRole>]
[Parent line: either "Parent move (the move being replied to):\n<parentBodyRedacted>" or "Parent move: none — this is a root move."]
Move to classify:
<moveBodyRedacted>
```

The "Optional" room-context lines render only when the corresponding `roomContext` field is present
on the request. The parent-line branch is unconditional: if `parentBodyRedacted` is `undefined`, the
literal `Parent move: none — this is a root move.` line is emitted instead. The move-body line is
unconditional — `moveBodyRedacted` is a required field on `ClassifyMoveRequest`.

The redaction pipeline:

| Step | File | Function | When it runs |
| --- | --- | --- | --- |
| 1. Client first pass | `src/features/semanticReferee/clientRedaction.ts` | `redactBodyForReferee` | Before `useSemanticReferee` calls the `classifyMove` Edge wrapper. |
| 2. Edge boundary second pass | `supabase/functions/_shared/semanticReferee/redaction.ts` | `redactClassifyMoveRequest` | Inside `semantic-referee/index.ts` before any provider runs. Belt-and-suspenders. |
| 3. Prompt assembly | `supabase/functions/_shared/semanticReferee/seedPrompt.ts` | `buildInputBlock` (private) | Inside `buildClassifierPrompt`. Does NOT redact; only frames the already-redacted input. |

The Edge boundary redactor (`redaction.ts`) is the authoritative pass — its pattern set covers
secret prefixes (assembled from regex fragments so the repo secret-literal scan stays green: an
`sk-ant-` body, an `xai-` body, an `sb_secret_` body, a JWT-shape, `Bearer <token>`,
`Authorization: <value>`), emails, URLs, bare-host X / Twitter / t.co links, `@handle` (1-15 word
chars), and long numeric run post ids (15-20 digits). The order is significant: secrets first, then
emails (before the URL pass can swallow an email host), then URLs, then bare hosts, then handles,
then long numeric ids.

---

## 5. Source-file map

Which file owns which piece of the prompt:

| Piece | File | Symbol | Role |
| --- | --- | --- | --- |
| System prompt constant | `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` | `SEMANTIC_REFEREE_SYSTEM_PROMPT` | Shipped on every call as the `system` field of the Anthropic Messages API request body. |
| Anthropic request body builder | `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` | `buildAnthropicRequestBody(request, model)` | Pure builder; outputs `{ model, max_tokens, temperature, system, messages: [{ role: 'user', content: buildClassifierPrompt(request) }] }`. |
| Anthropic content extraction | `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` | `extractAnthropicContentText(responseJson)` | Pulls the first `content[].type === 'text'` text from the Anthropic response. |
| JSON-from-content parse | `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` | `parseJsonFromContent(text)` | Extracts the first `{...}` JSON object from the model text. Returns `null` on any parse failure; never throws. |
| Default model id | `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` | `DEFAULT_SEMANTIC_REFEREE_MODEL` | The default Haiku-class model alias (`claude-haiku-4-5`). Overridable by `SEMANTIC_REFEREE_MODEL` env. |
| Output token bound | `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` | `MAX_TOKENS` | `900`. |
| Decoding temperature | `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` | `TEMPERATURE` | `0` — deterministic, no sampling. |
| Per-id question text | `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts` | `SEMANTIC_CLASSIFIER_CATALOG[].structuralQuestion` | The 23-entry catalog of `SemanticClassifierId` → structural yes/no question. Post-MCP-MOD-005 `seedPrompt.ts` reads this directly; no lookup table. |
| Prompt assembly | `supabase/functions/_shared/semanticReferee/seedPrompt.ts` | `buildClassifierPrompt(request)` | Iterates `SEMANTIC_CLASSIFIER_CATALOG`, filters by `request.requestedClassifiers`, then joins the per-id question list with the strict-JSON instruction, the worked example, and the redacted input block into a single user-message string. |
| Redacted input frame | `supabase/functions/_shared/semanticReferee/seedPrompt.ts` | `buildInputBlock(request)` (private) | Frames the already-redacted room context, parent body, and move body for the prompt. Does not redact. |
| Prompt-version stamp | `supabase/functions/_shared/semanticReferee/seedPrompt.ts` | `SEED_PROMPT_VERSION` | `mcp-semantic-referee-prompt-v1` — bumped whenever the wording of any question, instruction, or worked example changes. |
| Catalog-id list re-export | `supabase/functions/_shared/semanticReferee/seedPrompt.ts` | `SEED_PROMPT_CLASSIFIER_IDS` | Re-exports `ALL_SEMANTIC_CLASSIFIER_IDS` from `types.ts` so tests do not re-import `types.ts` solely for this. |
| Catalog id source-of-truth | `supabase/functions/_shared/semanticReferee/types.ts` | `ALL_SEMANTIC_CLASSIFIER_IDS` | The 23 frozen catalog-v0 ids. The mirror test fails the build if `SEMANTIC_CLASSIFIER_CATALOG` has an extra entry or a missing id. |
| Route / friction enums | `supabase/functions/_shared/semanticReferee/types.ts` | `ALL_ROUTE_SUGGESTIONS`, `ALL_FRICTION_SUGGESTIONS` | The 7 + 8 allowed values. The user-message instruction enumerates them inline. |
| Client-side redaction | `src/features/semanticReferee/clientRedaction.ts` | `redactBodyForReferee` | First-pass body redaction on the device, before `useSemanticReferee` posts. |
| Edge-boundary redaction | `supabase/functions/_shared/semanticReferee/redaction.ts` | `redactClassifyMoveRequest`, `redactString` | Second-pass body redaction at the Edge Function boundary. The authoritative pass. |
| Edge-boundary redaction call site | `supabase/functions/semantic-referee/index.ts` | `const redactedInput = redactClassifyMoveRequest(input);` | The only call site for `redactClassifyMoveRequest`. Runs unconditionally regardless of provider mode. |
| Live provider orchestrator | `supabase/functions/_shared/semanticReferee/anthropicProvider.ts` | `runAnthropicClassifier(request)` | Deno-only; the only file that reads `ANTHROPIC_API_KEY` and `fetch`es `api.anthropic.com`. Stamps the contract identity fields (`packetVersion`, `provider`, `authoritative: false`, the hashes, the room / move ids) onto the model's output via `stampPacketIdentity`. |
| Content-safety scanner | `supabase/functions/_shared/semanticReferee/contentSafetyScan.ts` | `scanPacketContent(packet)` | The Deno mirror of `semanticRefereeValidator.ts`'s ban-list scan. Rejects verdict / person / popularity / secret / PII tokens nested in otherwise-valid strings. Runs on every provider's output (including the live `anthropic` response) before the packet returns. |
| Inbound request validation | `supabase/functions/_shared/semanticReferee/schema.ts` | `ClassifyMoveRequestSchema` | Validates the request shape before the prompt is built. A request that fails here never reaches `buildClassifierPrompt`. |
| Outbound packet validation | `supabase/functions/_shared/semanticReferee/schema.ts` | `SemanticRefereePacketSchema` (`.strict()`) | Validates the packet shape after the provider answers. A smuggled key fails here; the registry substitutes a deterministic fallback. |
| Seed-prompt ban-list parity test | `__tests__/semanticAnthropicSeedPromptBanList.test.ts` | (test file) | Asserts the system prompt names verdict concepts only inside `do NOT ...` prohibitions, every structural question is free of banned tokens / phrases / shapes, and `buildClassifierPrompt` emits exactly the requested classifier ids. |
| Inventory parity test (this card) | `__tests__/semanticRefereePromptTemplateParity.test.ts` | (test file) | Asserts the system-prompt block in THIS document matches `SEMANTIC_REFEREE_SYSTEM_PROMPT` byte-for-byte, the user-message instruction block matches the live source byte-for-byte, and the per-id-question sample matches `buildClassifierPrompt`'s deterministic output for the fixed sample request. |

The prompt is assembled top-down: `runAnthropicClassifier` calls `buildAnthropicRequestBody`, which
calls `buildClassifierPrompt`, which calls the private `buildInputBlock`. The system prompt is the
constant `SEMANTIC_REFEREE_SYSTEM_PROMPT`. The user message is the `content` of the single
`{ role: 'user' }` entry in `messages[]`.

---

## 6. Prompt version stamping

`SEED_PROMPT_VERSION` is a string constant exported from `seedPrompt.ts`. Its current value is
`mcp-semantic-referee-prompt-v1`. It is the authoritative version stamp for the prompt as a whole —
every piece (system prompt, user instruction, per-id questions, worked example, input block frame)
shares one version.

`stampPacketIdentity` in `anthropicProvider.ts` stamps each outbound packet with this version (via
`request.promptVersionHint ?? SEED_PROMPT_VERSION`), and the version contributes to the deterministic
`inputHash` (`fnv1a("${roomId}|${contentHash}|${promptVersion}|${model}")`) so a cache key changes
the instant the prompt wording changes.

A wording change of ANY classifier question, the system prompt, the strict-JSON instruction, the
enumerated route / friction values, or the worked example MUST bump `SEED_PROMPT_VERSION`. The bump
invalidates upstream caches (the in-memory `SemanticPacketCache` keys partly on `promptVersion` via
`MCP-012`'s `useSemanticReferee` hook) and marks the prior cache entries as belonging to a prior
prompt generation.

The ban-list test `__tests__/semanticAnthropicSeedPromptBanList.test.ts` is the second wall: it
enforces three structural invariants on the prompt at every change. A wording change that introduces
a verdict / person / popularity token fails the test immediately:

- Invariant 1 — `SEMANTIC_CLASSIFIER_CATALOG` has one entry for each of the 23
  `ALL_SEMANTIC_CLASSIFIER_IDS` and no extra ids (id-coverage parity).
- Invariant 2 — every structural question is free of the doctrine ban-list vocabulary (`winner`,
  `loser`, `won`, `lost`, `right`, `wrong`, `true`, `false`, `correct`, `incorrect`, `verdict`,
  `proven`, `disproven`, `defeated`, `popular`, `unpopular`, `liar`, `lying`, `dishonest`, and the
  `bad faith` phrase, plus secret / handle / URL / email shapes); the system prompt names verdict
  concepts only inside a `do NOT ...` prohibition.
- Invariant 3 — `buildClassifierPrompt` emits exactly the requested classifier ids and no others.

The MCP-MOD-003 parity test (`__tests__/semanticRefereePromptTemplateParity.test.ts`) is the third
wall: it asserts the QUOTED text in this inventory document matches the live source. A wording
change in `seedPrompt.ts` or `anthropicClassifierCore.ts` without an inventory update fails this
test. The intent is that a future change is forced to update the inventory in lockstep, so the
document never silently rots.

---

## Invariants

A future change to the prompt MUST preserve these properties. Breaking any of them is a doctrine
violation and a roadmap-level decision, not a routine refactor.

1. **System-prompt "Absolute rules" list is doctrine.** The seven `You do NOT ...` clauses encode
   `cdiscourse-doctrine §1` / §3 / §4 and `MCP-001 §10`. Removing a rule, weakening a rule
   (`should not` instead of `do not`), or moving a rule out of the prohibition form requires a
   roadmap-level decision. New rules may be ADDED to the list without a decision; existing rules may
   not be removed or softened.

2. **The user-message strict-JSON contract wall is permanent.** The line `Return ONLY a single JSON
   object — no prose, no markdown, no code fence, no chain-of-thought.` is the parser's contract.
   `parseJsonFromContent` extracts the first `{...}` from the model text; if the model emits a
   Markdown fence around the JSON, prefixes with reasoning, or wraps the object in prose, the parser
   takes the first balanced-brace span it finds and may parse something other than the intended
   object. The line MUST stay verbatim or in a logically equivalent form that still names: "return
   ONLY a single JSON object", "no prose", "no markdown", "no code fence", "no chain-of-thought".

3. **Per-id questions are STRUCTURAL only.** Every `structuralQuestion` in
   `SEMANTIC_CLASSIFIER_CATALOG` asks about the move's structure — continuity, evidence presence /
   shape / source-chain, branch placement, constructive movement (narrowing / concession /
   synthesis-readiness), pacing, mode fit, friction. No question asks the model whether anything is
   true, correct, right, wrong, factual, proven, popular, or who is winning. The ban-list test
   enforces this automatically; a future addition must pass it.

4. **The enumerated route / friction lists must match `ALL_ROUTE_SUGGESTIONS` and
   `ALL_FRICTION_SUGGESTIONS` in `types.ts`.** SMOKE-FIX-002 added inline enumeration to the
   user-message instruction so the model is told the enum directly. Adding a new route or friction
   value to `types.ts` requires the same value be added to the instruction enumeration, and
   `SEED_PROMPT_VERSION` bumped. The `__tests__/semanticRefereeSeedPromptEnumCoverage.test.ts` test
   asserts the inline enumeration matches the constants.

5. **`authoritative` is hard-pinned `false` at the boundary.** The model cannot mark its output
   authoritative; the boundary's `stampPacketIdentity` always emits `authoritative: false`. The
   system prompt instructs the model not to emit blocking / verdict / truth / winner fields; the
   `.strict()` outbound schema drops them as unknown keys; `scanPacketContent` rejects verdict
   tokens nested in otherwise-valid strings. Three independent walls.

6. **Per-call selection emits ONLY the requested classifiers.** `buildClassifierPrompt` iterates
   `SEMANTIC_CLASSIFIER_CATALOG` and filters by `request.requestedClassifiers` (membership-checked
   via a `Set`), de-duplicates, and skips an unknown id silently. The output's iteration order is
   the catalog's declaration order (post-MCP-MOD-005), not the caller's order. A future change must
   keep this contract — the live provider is charged per token and the per-call ≤ 5 batching limit
   is doctrine.

7. **The redaction pipeline runs UNCONDITIONALLY before any provider sees a body.** The client-side
   first pass (`clientRedaction.ts`) is the early defence; the Edge-boundary second pass
   (`redaction.ts`, called from `semantic-referee/index.ts:92` BEFORE
   `classifyWithConfiguredProvider`) is the authoritative one. `seedPrompt.ts`'s `buildInputBlock`
   does NOT redact — by the time the body reaches it, the two upstream passes have run. A future
   change that moves the input block ahead of the boundary redaction is a doctrine violation.

8. **`SEED_PROMPT_VERSION` bumps on EVERY wording change.** A change to any clause of the system
   prompt, the strict-JSON instruction, the route / friction enumerations, a per-id question, or the
   worked example bumps `SEED_PROMPT_VERSION`. The bump invalidates upstream caches and is the
   contract for downstream consumers (MCP-012 cache, smoke-test framework, the documented
   inventory). A wording change without a bump is a doctrine violation.

---

## Findings

These findings are **informational** — the design (MCP-MOD-003 §5) names them as inputs to
MCP-MOD-005 (the prompt refactor). They are not fixed here.

### Drift between the system prompt's "Absolute rules" list and the ban-list test's enforced tokens (one observation)

The ban-list test (`__tests__/semanticAnthropicSeedPromptBanList.test.ts`) enforces a token-level
ban-list on every structural question: `winner`, `loser`, `won`, `lost`, `right`, `wrong`, `true`,
`false`, `correct`, `incorrect`, `verdict`, `proven`, `disproven`, `defeated`, `popular`,
`unpopular`, `liar`, `lying`, `dishonest`, plus the `bad faith` phrase. The system prompt names
some of these concepts in its prohibitions (`right`, `truth`, `winner`, `popularity`,
`engagement`, `virality`) but the ban-list test's full token list is broader than the prohibition
list — it covers tokens the system prompt does NOT explicitly forbid (`loser`, `won`, `lost`,
`wrong`, `incorrect`, `verdict`, `proven`, `disproven`, `defeated`, `popular`, `unpopular`,
`liar`, `lying`, `dishonest`, `bad faith`).

This is not a contradiction — the ban-list test enforces the SUPERSET of what the system prompt
explicitly names, on the assumption that a model trained to refuse `winner / right / truth /
popularity` will also generalize to refuse `loser / won / wrong / popular`. The test is the safety
net for the generalization. MCP-MOD-005 should consider whether the system prompt should
explicitly enumerate the full superset (lower risk of model-side generalization failure) or
whether the current narrower list is the correct cognitive load for the model (the model may
overweight a long list of negatives).

### Per-id questions that do not start with "Does this move..." or equivalent structural phrasing (two observations)

Of the 23 entries in `CLASSIFIER_QUESTION_TEXT`, 21 start with `Does this move ...` or
`Does the attached evidence ...`. Two are exceptions:

- `ready_for_synthesis` — `Is there clear shared ground in the thread plus only limited unresolved
  debt?` — asks about the THREAD, not the move. This is intentional: synthesis-readiness is a
  property of the thread state at the moment of this move's submission, not a property of the move
  in isolation. The question is still structural — it asks whether a thread-level structural
  property holds — but the subject differs from the other 22.
- `needs_pre_send_pause` — `Could this move be tightened by its author before it is sent?` — uses
  `Could` rather than `Does`, and asks about a structural improvement (the move could be tightened
  before send). This is intentional: pacing is the only nudge that targets the AUTHOR rather than
  the move's classification properties. The question is still structural — it asks whether the
  move admits a pre-send tightening — but the grammatical mood differs from the other 22.

Both exceptions are doctrine-clean (no truth / popularity / person tokens) and pass the ban-list
test. MCP-MOD-005 may consider whether to normalize them to `Does this move...` form or to keep the
two distinct forms as intentional signal-shape markers. The current source-of-truth has no metadata
for "subject-of-the-question" — adding a `subject: 'move' | 'thread' | 'author'` field in MCP-MOD-004
would let the prompt-template generator emit the right grammar per id.

### Duplication between the system prompt and the user-message instruction (two observations)

Two prohibitions are stated in BOTH the system prompt and the user-message instruction:

- **Strict-JSON contract:** the system prompt says `Return ONLY the JSON object the user prompt
  describes — no prose, no markdown, no chain-of-thought.` The user-message instruction says
  `Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.`
  The two are NOT byte-identical: the system prompt says "the JSON object the user prompt
  describes" (deferring the contract details to the user message) while the user message says "a
  single JSON object" and adds "no code fence". The duplication is intentional — the system prompt
  sets the high-level rule and the user message sets the specific contract. A model that reads only
  the system prompt still knows to emit JSON only. MCP-MOD-005 should consider whether the slight
  wording divergence is a feature (defense in depth — two ways to say the same thing, the model
  generalizes) or a maintenance hazard (two strings to keep in sync).
- **No blocking / verdict / truth / winner field:** the system prompt says `Never include a
  blocking field, a truth field, a verdict field, or a winner field.` The user-message instruction
  says `Do not include any blocking, verdict, truth, or winner field.` These two are
  near-byte-identical (the user-message variant omits `field` after `blocking` and uses a
  comma-separated list). The system prompt covers the structural rule; the user message reinforces
  it at the contract level. Same maintenance question as above.

A non-duplication observation: the strict-JSON contract includes ONE element that lives ONLY in the
user message — the inline enumeration of the seven `routeSuggestion` values and the eight
`frictionSuggestion` values. SMOKE-FIX-002 deliberately added the enumeration to the user message
(not the system prompt) because the enum values are bound to the per-call contract; the system
prompt is the general doctrine. MCP-MOD-005's source-of-truth refactor (per MCP-MOD-004) will let
the prompt template generator pull these enums from `types.ts` directly, removing the manual
maintenance burden on the inline enumeration.
