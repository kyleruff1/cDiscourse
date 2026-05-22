# MCP semantic-referee smoke-test — verification scans

**Date:** 2026-05-22
**Mode:** Read-only verification pass (no AI calls, no posting, no provider flip, no working-tree modifications outside this report).
**Repo state at scan:** `main` at `3bc375a` (MCP-018 squash); the working tree carries the 6 long-running pre-existing files plus 2 session-dirty `SKILL.md` files queued behind the validator decision in Scan 1.

---

## Summary

**Recommendation: AMBER.** Six scans complete. **Scans 1, 3, 4, 5 returned clean.** **Scans 2 and 6 returned ambiguous** results that require an operator decision before the smoke test runs. None of the ambiguities are blocking; all have well-defined options.

| # | Scan | Status | Decision needed |
|---|---|---|---|
| 1 | Validator regex | **Clean** | None — `***` substitution validates |
| 2 | Bot fixture runner | **Ambiguous** | Pick `runScenario.js` (deterministic) OR `runAiDrivenCorpus.js` (Anthropic-gated) |
| 3 | `submit-argument` payload | **Clean** | None |
| 4 | `semantic-referee` payload from the room hook | **Clean** | None (one nuance: client-side body redaction + per-call classifier batching) |
| 5 | Room creation path | **Clean** | None — direct `.from('debates').insert(...)` is the only path (no `create-debate` Edge Function exists) |
| 6 | Classifier id catalog | **Ambiguous** | 5 of 22 predicted names have no real-catalog match; the scenario needs substitutions or revision |

---

## Scan 1 — Validator regex

**Status: CLEAN.** `***` substitution is verified safe.

`scripts/skills/validateBotSkills.js`:

- **Line 117** (opening frontmatter detector): `text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/)` — matches the opening `---\n…\n---\n` block and consumes it. The opening `---` on line 1 is **not** subject to the duplicate-delimiter check.
- **Line 125** (duplicate-delimiter check): `if (/^---\s*$/m.test(rest))` — on the `rest` of the file (everything after the frontmatter), flags **any line that is exactly three dashes followed by optional whitespace**.

Behavior table:

| Line content | Matched by line 125 regex? | Notes |
|---|---|---|
| `---` | **YES** | Triggers `more than one frontmatter delimiter detected` |
| `---   ` (trailing whitespace) | **YES** | `\s*` permits trailing spaces |
| `***` | **NO** | Asterisks not in the character class |
| `***   ` | **NO** | Same |
| `___` | **NO** | Underscores not in the character class |
| `------` (six dashes) | **NO** | Only `^---` followed by `\s*$` matches; six dashes have `---` then `---` not whitespace |

**Verdict:** Substituting `***` (the alternate markdown horizontal-rule form) for `---` in the appended section is doctrine-safe and validator-clean. The visual separator intent is preserved.

---

## Scan 2 — Bot fixture runner

**Status: AMBIGUOUS.** 11 files reference the bot skills under `scripts/bot-fixtures/`. Multiple competing runners with different patterns. The operator must pick one.

### Files matching `bot-provocateur|bot-revocateur`

| File | Role | Calls Anthropic? |
|---|---|---|
| `runScenario.js` | Top-level: deterministic scenario runner | **NO** |
| `runStressBatch.js` | Top-level: stress-batch runner over generated scenarios | **NO** |
| `runAiDrivenCorpus.js` | Top-level: AI-driven corpus orchestrator | **YES** (via `aiMoveRenderer` → `claudeMessagesClient`) |
| `runXaiAdversarialBotCorpus.js` | Top-level: xAI-adversarial corpus | **YES** (xAI + Anthropic) |
| `runXaiAdversarialThreadCorpus.js` | Top-level: xAI thread-corpus | **YES** |
| `runOpenRoomEngagementBots.js` | Top-level: engages existing open rooms (does NOT create rooms) | depends on renderer |
| `engageExistingRooms.js` | Top-level: engages existing rooms | YES (via `claudeMessagesClient`) |
| `aiBotPersonas.js` | Helper: persona prompt builder | No (helper) |
| `xaiAdversarialMoveRenderer.js` | Helper | No (helper) |
| `xaiAdversarialSceneBuilder.js` | Helper | No (helper) |
| `xaiAdversarialReport.js` | Helper | No (helper) |
| `openRoomEngagementMoveRenderer.js` | Helper | No (helper) |
| `openRoomHeatModel.js` | Helper | No (helper) |
| `skillFileLoader.js` | Helper: loads `SKILL.md` content for prompts | No (helper) |

(13 entries — the original grep returned 11 distinct top-level files, listed above; helper files are included for transparency.)

### The two candidates that fit the smoke-test scenario shape

**Candidate A: `runScenario.js` (deterministic, no Anthropic)**

- **CLI:** `node scripts/bot-fixtures/runScenario.js <scenarioId>`
- **Env:** `.env.bot-tests` only (admin + bot Supabase auth).
- **Flow:** Sign in admin → `ensureBotUser` (calls `admin-users` Edge Function with `action: create_bot_user`) → sign in each bot → look up active constitution → `from('debates').insert(...)` → `from('debate_participants').insert(...)` → for each move: `buildSubmitArgumentBody` → `invokeSubmitArgument` (which calls `sb.functions.invoke('submit-argument', { body })`).
- **Move bodies:** Loaded verbatim from a scenario JSON spec via `loadScenario(scenarioId)`. The runner does NOT generate bodies; the spec author provides them.
- **Fit:** Matches **option (b)** from the operator's Q1 — author the 16 moves manually (8 × 2 rooms) as scenario JSON specs, the runner posts them deterministically. No Anthropic call required (or possible) from the runner.

**Candidate B: `runAiDrivenCorpus.js` (Anthropic-gated, generates bodies)**

- **CLI:** `node scripts/bot-fixtures/runAiDrivenCorpus.js [--pilot] [--rooms N] [--seeds synthetic|xai_live|both] [--annotate] …`
- **Env:** ALL of: `.env.engagement-intelligence` present, `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true`, `ANTHROPIC_API_KEY` populated, `.env.bot-tests` filled, `--pilot` on the CLI.
- **Flow:** As above, plus `renderMoveBody` (in `aiMoveRenderer.js`) → `claudeMessagesClient` (direct Anthropic API call) → returns the body string → posted via the same `submit-argument` path.
- **Move bodies:** Anthropic-generated from `aiBotPersonas` prompts (which bake in the `SKILL.md` content).
- **Scenarios:** Currently driven by `stressScenarioTemplates` (templated room shapes), NOT free-form 8-move specs. Adapting to the smoke-test scenario would require adding a new template or a `--scenario-spec` CLI flag — a small extension, not a rewrite.
- **Fit:** Matches **option (a)** from the operator's Q1 — interpreting the "no direct AI calls from your shell" prohibition as "no curl/fetch to AI APIs from a Bash tool call directly; a script's internal Anthropic call via `claudeMessagesClient` is acceptable."

### Recommendation

For the smoke test specifically — which requires **exactly the 8 scenario moves with the exact intent table** — Candidate A (`runScenario.js`) is the cleaner fit:

- The scenario's intent table is precise; deterministic posting from a hand-authored scenario spec guarantees the moves are exactly as specified, with no model variance to confound the classifier comparison.
- The "anthropic vs mock" comparison the smoke test wants is **about the referee, not the bot**. Posting identical bodies under both providers requires deterministic bodies — which `runScenario.js` provides natively.
- No Anthropic gate to negotiate; the prompt's "no direct AI calls" constraint is honored trivially.
- The bot persona is honored by **the author** (me, reading both `SKILL.md` files as the behavioral spec) when writing the scenario JSON, not by a runtime AI call.

`runAiDrivenCorpus.js` is the better runner for **calibration corpus** work (generating many varied rooms), not for **scenario calibration** work (verifying a specific structural sequence against the referee).

---

## Scan 3 — `submit-argument` payload

**Status: CLEAN.** Single consistent payload shape across all runners. Defined verbatim in `scripts/bot-fixtures/submitMove.js`.

### Payload shape (from `buildSubmitArgumentBody`, snake_case as `submit-argument` expects)

```javascript
{
  debate_id: <uuid>,                // required
  parent_id: <uuid> | null,          // null for the root move
  argument_type: <ArgumentType>,     // declared move type
  side: <ArgumentSide>,              // 'affirmative' | 'negative' | 'neutral' | 'moderator' | 'observer'
  body: <string>,                    // the message body
  selected_tag_codes: <string[]>,    // [] if none
  client_submission_id: <uuid>,      // idempotency key
  target: {                          // optional; omit if both fields absent
    target_excerpt?: <string>,
    disagreement_axis?: <DisagreementAxis>,
  },
  attached_evidence: [                // optional
    {
      url?: <string>,
      label?: <string>,
      source_text?: <string>,
    },
  ],
}
```

### Forbidden fields (would fail `isAllowedSubmitBody`)

`author_id`, `depth`, `status`, `server_validation`, `created_at`, `id` — these are server-derived and the runner must NOT supply them.

### Invocation

```javascript
const { data, error } = await sb.functions.invoke('submit-argument', { body });
```

`sb` is the authenticated Supabase client (the bot's, returned by `signInBot(client, email, password)`). The JWT is carried implicitly by the supabase-js client.

The client-side wrapper in `src/lib/edgeFunctions.ts` (`submitArgumentDraft`) uses the **same wire shape** with the same field names — the wrapper just adds TypeScript typing on top.

---

## Scan 4 — `semantic-referee` payload from the room hook

**Status: CLEAN.** Single clear payload construction in `src/features/arguments/useSemanticReferee.ts` (lines 405–446), which calls `classifyMove(...)` from `src/lib/edgeFunctions.ts` (lines 480–509), which invokes `supabase.functions.invoke('semantic-referee', { body: payload })`.

### Verbatim payload shape (the `ClassifyMoveRequest` interface, `src/lib/edgeFunctions.ts:418-434`)

```typescript
interface ClassifyMoveRequest {
  // RLS-checked: the caller must be able to see this room.
  roomId: string;

  // The just-posted move id. Omitted for a pre-send draft;
  // the smoke test will ALWAYS pass it (post-submit invocation).
  moveId?: string;

  // The parent argument id, if any. Undefined for the root move.
  parentId?: string;

  // The move body — REDACTED CLIENT-SIDE before this call. 1..8000 chars.
  moveBodyRedacted: string;

  // The parent body, REDACTED CLIENT-SIDE. <=8000 chars. Absent for root.
  parentBodyRedacted?: string;

  // Room/context fields the boundary needs to interpret the move.
  roomContext: {
    debateMode?: string;          // GAME-003 room mode code
    selectedAction?: string;      // user's quick-action preset
    selectedMoveType?: string;    // declared argumentType
    side?: 'affirmative' | 'negative' | 'observer' | 'moderator';
    actorRole?: 'initiator' | 'primary_opponent' | 'chime_in' | 'observer';
  };

  // 1..5 entries per call, each a SemanticClassifierId from the 23-id catalog.
  // The hook BATCHES classifiers — <=2 batches per move, <=5 ids per batch.
  requestedClassifiers: string[];

  // Defaults to 'mcp-semantic-referee-prompt-v0' (PROMPT_VERSION_DEFAULT).
  promptVersionHint?: string;

  // Content hash; non-empty. The hook builds: `c:${moveId}:${redactedBody.length}`.
  contentHash: string;
}
```

### Invocation (verbatim from `useSemanticReferee.ts:421-431`)

```typescript
result = await classifyMove({
  roomId,
  moveId,
  parentId,
  moveBodyRedacted,
  parentBodyRedacted,
  roomContext: args.roomContext ?? {},
  requestedClassifiers: batch as string[],   // one of <=2 batches
  promptVersionHint: promptVersion,           // 'mcp-semantic-referee-prompt-v0'
  contentHash,                                // `c:${moveId}:${redactedBody.length}`
});
```

### Three non-obvious details the smoke-test runner MUST mimic

1. **Client-side redaction is mandatory.** Bodies pass through `redactBody(body)` from `'../semanticReferee/clientRedaction'` BEFORE leaving the device. The Edge Function runs a defensive second-pass redaction, but supplying an unredacted body is doctrine-violating. The smoke-test runner must import and apply `redactBody` (Node-compatible) or the equivalent.
2. **Classifier batching.** The hook calls `planClassifierBatches(POST_SUBMIT_CLASSIFIER_SET)` (from `'../semanticReferee/classifierBatching'`) and issues **one `classifyMove` call per batch**, each carrying ≤ 5 ids. The hook then merges the per-batch `binaries` arrays via `mergePacketBinaries` (lines 217–230 of the hook). The smoke test will issue 1–2 calls per posted move and merge the same way.
3. **`{ enabled: false }` is normal.** Per the hook's doctrine block (lines 26–39), ANY of `{ enabled: false }`, `ok: false`, or a thrown rejection collapses to `'fallback'` state. The smoke test's stop condition for `{ enabled: false }` must inspect the `reason` field to distinguish the routine `disabled` from a configuration issue.

### Classifier set used per post-submit call

The classifier set is `POST_SUBMIT_CLASSIFIER_SET` exported from `src/features/semanticReferee/semanticTriggerInput.ts`. The runner should import it as a constant rather than hardcoding the list — keeps the smoke test aligned with whatever set MCP-019 currently uses.

---

## Scan 5 — Room creation path

**Status: CLEAN.** Direct authenticated insert into the `debates` table. No dedicated Edge Function exists.

### Edge Function listing

```
_shared
admin-users
annotate-evidence
apply-manual-tag
process-language-draft
request-argument-deletion
semantic-referee
submit-argument
```

**No `create-debate`, `new-debate`, `create_argument_room`, or similar function exists.** Room creation is not behind an Edge Function.

### The pattern (consistent across all runners that create rooms)

```javascript
// 1. Look up the active constitution version.
const constitutionRes = await botA.client
  .from('constitution_versions')
  .select('id')
  .eq('active', true)
  .single();

// 2. Insert the room as the authenticated creator.
const debateInsert = await botA.client
  .from('debates')
  .insert({
    created_by: botA.userId,
    title: roomTitle,                  // e.g. 'smoke-test-MCP-2026-05-22-remote-work-productivity'
    resolution: scenario.resolution,    // the root claim
    description: '',                    // optional; '' is safe (scenario.notes pollutes topic-satisfaction)
    status: 'open',
    constitution_id: constitutionRes.data.id,
  })
  .select('id')
  .single();

const debateId = debateInsert.data.id;

// 3. Auto-join the creator as 'moderator'.
await botA.client
  .from('debate_participants')
  .insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });

// 4. Other bots join with their persona side.
for (const bot of otherBots) {
  await bot.client
    .from('debate_participants')
    .insert({ debate_id: debateId, user_id: bot.userId, side: <'affirmative'|'negative'|'observer'> });
}
```

### Direct-insert authorization

The user's prompt explicitly permitted direct insert into the `debates` table (and rejected direct insert into `public.arguments`). This pattern is doctrine-compliant: `public.arguments` writes route through `submit-argument`; `debates` row creation does not.

### Note on `scenario.notes`

`runScenario.js:108-112` includes a guard: *"Never forward `scenario.notes` — those are test-author metadata describing what the fixture exercises, and they pollute the topic-satisfaction reference set so child moves score off-topic."* The smoke test's scenario JSON must NOT include a `notes` field, OR the runner must drop it before insert. The existing runner already handles this — keep using `runScenario.js`'s discipline.

---

## Scan 6 — Classifier id catalog

**Status: AMBIGUOUS.** The real catalog has 23 ids (matches the smoke test's design assumption). **17 of 22 predicted names map cleanly; 5 have no real-catalog match.** Per the operator's threshold ("more than four predictions with no match" = ambiguous), this is over the line.

### The full real-id catalog — `src/features/semanticReferee/semanticRefereeTypes.ts:131-155`, verbatim

```
 1.  responds_to_parent
 2.  introduces_new_issue
 3.  asks_for_evidence
 4.  provides_evidence
 5.  evidence_supports_claim
 6.  quote_anchors_parent
 7.  narrows_claim
 8.  concedes_narrow_point
 9.  requests_clarification
10.  answers_clarification
11.  shifts_to_person_or_intent
12.  uses_popularity_as_evidence
13.  contains_playable_hot_take
14.  contains_unplayable_insult_only
15.  is_satire_or_parody
16.  uses_satire_as_evidence
17.  cites_retraction
18.  creates_source_chain_gap
19.  suggests_side_branch
20.  suggests_diagonal_tangent
21.  fits_selected_debate_mode
22.  needs_pre_send_pause
23.  ready_for_synthesis
```

(23 ids — matches the smoke test's design assumption.)

### Per-prediction match table

| # | Predicted name (from scenario spec) | Status | Real id substitution | Note |
|---|---|---|---|---|
| 1 | `assertion` | **No match** | — | The catalog tracks structural properties (binary signals on the move text), not move-type labels. Drop from prediction. |
| 2 | `evidence_debt_opened` | **No match** | — (compound) | Closest compound: `introduces_new_issue=1` AND `provides_evidence=0`. The catalog has no single "debt opened" id. Recommend dropping or recasting as a derived signal. |
| 3 | `causal_mechanism_named` | **No match** | — | Catalog has no causal-mechanism id. Drop. |
| 4 | `evidence_request` | Mapped | `asks_for_evidence` | Clean structural map. |
| 5 | `source_chain_pressure` | Mapped | `creates_source_chain_gap` (+ `asks_for_evidence`) | Real id is speaker-relative ("the speaker leaves a gap"); the predicted name is opponent-relative ("the speaker pressures the opponent's source"). The structural signal is the same. |
| 6 | `source_provided_unverified` | Mapped | `provides_evidence=1` + `evidence_supports_claim=0` | A compound: provides something, but it doesn't support the claim. |
| 7 | `source_chain_unresolved` | Mapped | `creates_source_chain_gap` | Same id as #5; the scenario distinguishes "pressuring" vs "unresolved" but the catalog has one signal. |
| 8 | `evidence_debt_continuing` | Mapped | `creates_source_chain_gap` (continuing) | A repeated `creates_source_chain_gap=1` across consecutive moves is the de-facto "debt continuing" signal. |
| 9 | `definition_request` | Mapped | `requests_clarification` | The catalog folds definition + clarification + scope requests into one id. |
| 10 | `scope_pressure` | Mapped | `requests_clarification` | See #9. |
| 11 | `popularity_appeal` | Mapped | `uses_popularity_as_evidence` | Clean. |
| 12 | `amplification_attempt` | Mapped | `uses_popularity_as_evidence` | Same id as #11. |
| 13 | `anti_amplification_warning` | **No match** | — | The catalog has speaker-side `uses_popularity_as_evidence`; no opponent-side "challenges amplification" id. The structural signal of Move 6 in the scenario would show up as `asks_for_evidence=1` (with the prior move's `uses_popularity_as_evidence=1` as the context). Drop or recast. |
| 14 | `anti_amplification_challenge` | **No match** | — | Same as #13. |
| 15 | `quote_request` | Mapped | `requests_clarification` | Asking for a specific quote = clarification request. If the response provides one, `quote_anchors_parent=1` lights up. |
| 16 | `evidence_request_renewed` | Mapped | `asks_for_evidence` | The catalog has no "renewed" suffix — a repeat across moves is the signal. |
| 17 | `narrowing_concession` | Mapped | `narrows_claim` + `concedes_narrow_point` | Compound: the speaker narrows their own broad claim AND concedes the narrow defect. |
| 18 | `scope_narrow_accepted` | Mapped | `concedes_narrow_point` | The other side's narrowing accepted. |
| 19 | `claim_revised` | Mapped | `narrows_claim` | Speaker revises their own claim down. |
| 20 | `synthesis_named` | Mapped | `ready_for_synthesis` | Clean. |
| 21 | `narrow_claim_accepted` | Mapped | `concedes_narrow_point` | Same as #18. |
| 22 | `branch_recommendation` | Mapped | `suggests_side_branch` | Clean. |

### Counts

- Direct verbatim match: 0 (the scenario uses paraphrased high-level names, the catalog uses structural-signal names)
- Mapped to a real id (single or compound): **17**
- No match in catalog: **5** (`assertion`, `evidence_debt_opened`, `causal_mechanism_named`, `anti_amplification_warning`, `anti_amplification_challenge`)

### Why the 5 no-matches happen

All 5 are **higher-level adversarial-discourse labels**, not **lower-level structural signals**. The real catalog asks "did the move *do* this structural thing?" The scenario asks "did the move *succeed at* this rhetorical move?" The two ontologies are adjacent but not identical.

Specifically:
- `assertion`, `evidence_debt_opened`, `causal_mechanism_named` (Move 1) are all about what the **root claim** rhetorically does. The catalog handles the same move as `introduces_new_issue` + `provides_evidence=0`. Move 1's analysis can use those.
- `anti_amplification_warning` and `anti_amplification_challenge` (Moves 5-6) capture a paired ANTI-amplification rhetorical move. The catalog only has the **speaker-side** classifier (`uses_popularity_as_evidence`); the opponent's challenge to it shows up as `asks_for_evidence` (a follow-on evidence request), not as a paired classifier.

### Coverage of the catalog

The scenario, after substitutions, exercises these real-catalog ids:

- `introduces_new_issue` (Move 1)
- `asks_for_evidence` (Moves 2, 4, 6 — three exercises)
- `provides_evidence` (Move 3)
- `evidence_supports_claim` (Move 3 — expected `=0`)
- `creates_source_chain_gap` (Moves 3, 6 — two exercises)
- `requests_clarification` (Move 4 — definition; also Move 6's quote request)
- `uses_popularity_as_evidence` (Move 5)
- `narrows_claim` (Move 7)
- `concedes_narrow_point` (Moves 7, 8)
- `ready_for_synthesis` (Move 8)
- `suggests_side_branch` (Move 8)

That's **11 distinct real-catalog ids** exercised in 8 moves — under the 15-id design target the smoke test wanted ("at least fifteen distinct classifier ids"). The shortfall is partly because the scenario predicts paired ids (challenge + warning) that the catalog represents as one.

To hit the 15-id target, the scenario would need to add moves that exercise: `responds_to_parent`, `quote_anchors_parent`, `answers_clarification`, `shifts_to_person_or_intent`, `contains_playable_hot_take`, `is_satire_or_parody`, `cites_retraction`, `suggests_diagonal_tangent`, `fits_selected_debate_mode`, `needs_pre_send_pause`, etc. That's a scenario-design adjustment, not a runner change.

---

## Recommendations

### Overall: AMBER

The smoke test is **runnable in principle**, but the operator must make three specific decisions before it proceeds. None of the decisions are blocking; all have clear options grounded in this scan.

### Specific operator decisions

1. **Phase 2 (`SKILL.md` edits) — pick the validator resolution.**
   - **Recommended:** `***` substitution. Scan 1 confirms it validates clean. Minimal text deviation from the original spec.
   - Alternates: drop the separator entirely (smallest pixels, no horizontal rule); or fix the validator (one-line regex tightening — out-of-scope for the smoke test).

2. **Q1 — pick the bot runner.**
   - **Recommended:** `runScenario.js` (deterministic). The scenario's intent table is precise; deterministic posting from a hand-authored scenario JSON eliminates bot-side variance from the referee comparison. The "no direct AI calls from your shell" prohibition is honored trivially.
   - Alternate: `runAiDrivenCorpus.js` (Anthropic-gated, requires extending the template set to support a free-form 8-move spec). Acceptable if the operator interprets "no direct AI calls from your shell" as excluding scripts' internal Anthropic calls. Note: bot-side variance under Anthropic generation will partly confound the referee comparison.

3. **Scan 6 — adjust the scenario's classifier predictions.**
   - The 5 no-match predicted names (`assertion`, `evidence_debt_opened`, `causal_mechanism_named`, `anti_amplification_warning`, `anti_amplification_challenge`) cannot be analyzed against the real catalog as-is.
   - **Option A:** Drop those 5 predictions; analyze remaining 17. The match-analysis column in the smoke-test report will show "no prediction" for the moves that had only no-match predicted ids (Moves 1, 5, 6 are most affected — Moves 5 and 6 will still register `uses_popularity_as_evidence` and `asks_for_evidence` respectively, so the moves still produce data; only the predicted-vs-real comparison weakens).
   - **Option B:** Revise the scenario's predicted-signal lists to use real catalog ids (the substitutions in the table above). The smoke-test report will then have direct comparisons across all 22 predictions.
   - **Recommended:** Option B. The scenario's design intent is preserved; the predicted-signal table just speaks the catalog's structural vocabulary instead of the higher-level rhetorical vocabulary.

### Mechanism summary the smoke-test continuation can rely on

- **Auth path:** `.env.bot-tests` → `createBotClient(supabaseUrl, supabasePublishableKey)` → `signInBot(client, email, password)` → JWT carried implicitly by the supabase-js client.
- **Room creation:** authenticated `from('debates').insert({ created_by, title, resolution, description: '', status: 'open', constitution_id })` after looking up the active constitution.
- **Posting:** `buildSubmitArgumentBody({ debateId, parentArgumentId, move, side, clientSubmissionId })` → `sb.functions.invoke('submit-argument', { body })`.
- **Classify:** redact bodies → `sb.functions.invoke('semantic-referee', { body: ClassifyMoveRequest })` per the verbatim shape in Scan 4. Issue 1–2 calls per move (the hook's batching) and merge `binaries`.
- **Provider flip:** authorized direct DB write (the prompt explicitly permitted this via `semantic_referee_runtime_config` UPDATE) or the admin Edge Function (`admin-users` `action: 'set_semantic_config'`). The Supabase MCP `execute_sql` tool is available for the direct write.
- **Provider restore:** at run end, restore `provider_mode = 'anthropic'` (the state captured in Phase 1 of the smoke test).

---

## Phase 1 working-tree state at scan

```
## main...origin/main
 M .claude/settings.json                             (pre-existing — session)
 M .claude/skills/bot-provocateur/SKILL.md           (session-dirty — Phase 2 queued behind validator decision)
 M .claude/skills/bot-revocateur/SKILL.md            (session-dirty — same)
?? .claude/agents.zip                                (pre-existing)
?? .claude/scripts.zip                               (pre-existing)
?? .claude/skills.zip                                (pre-existing)
?? docs/testing-runs/2026-05-22-ai-driven-bot-corpus-dry.md              (pre-existing)
?? docs/testing-runs/2026-05-22-engagement-epidemiology-synthetic.md     (pre-existing)
```

Surfaced for transparency: the 2 dirty `SKILL.md` files are from this session's failed Phase-2 attempt (the `---` separator that tripped the validator). They are **not** abandoned-from-another-session and are unrelated to the scans above; Scan 1 confirms the `***` substitution resolves them when the operator picks that option.
