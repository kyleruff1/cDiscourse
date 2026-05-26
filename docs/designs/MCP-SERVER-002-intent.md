# MCP-SERVER-002 Design Intent Brief — Family A Boolean Observation Tool

**Card:** MCP-SERVER-002 — Family A Boolean Observation Tool (real classifier replacing the scaffolded "not_implemented" envelope; Family A only; uses MCP-021A schema verbatim; includes 2 folded-in MCP-SERVER-001 follow-ups: actorRole=moderator enum + docs corrections)
**Track:** MCP-SERVER-*
**Priority:** P0 / Urgent
**Effort:** M-L
**Filed:** 2026-05-26
**Author:** Operator-authored
**Status:** Binding for MCP-SERVER-002 designer phase. Stage 2 HALT is CONDITIONAL per autonomous-pipeline authorization.
**Predecessors:** MCP-SERVER-001 (8a1652c, PR #308); MCP-SERVER-001-SMOKE PASS (bae4984)
**Downstream cards (sequenced):** MCP-SERVER-002-SMOKE → MCP-021C-EDGE-SMOKE → MCP-021C-FAMILY-A-PROD → MCP-SERVER-003+ / MCP-021C-FAMILY-B+ → ADMIN-MCP-001 → OPS-MCP-OBSERVABILITY

---

## Why this brief exists

MCP-SERVER-001 proved the operator-hosted MCP server foundation works for the existing semantic-referee tool: Supabase semantic-referee Edge Function → mcpAdapter.ts → hosted Deno MCP server → Anthropic → validated SemanticRefereePacket → `provider=mcp` / `inputHash=mcp-…`.

It did NOT prove the boolean-observation classifier path. The `classify_argument_boolean_observations` tool on the MCP server is still scaffolded — it returns `{isError: true, reason: "not_implemented", scaffoldedFor: "MCP-SERVER-002"}` for every call. That scaffold was correct at MCP-SERVER-001's scope. This card replaces it with real Family A classification.

The expandable Boolean Machine Observation system (MCP-021A taxonomy → MCP-021B persistence → MCP-021C-EDGE runtime → MCP-021C-FAMILY-* enablement) cannot produce any real persisted classifier output until this card ships.

---

## Central product rule

The MCP server returns Family A boolean classifications matching MCP-021A's existing schema verbatim. The CDiscourse client never calls the MCP server directly. The MCP server holds Anthropic credentials server-side. The MCP-021C-EDGE Edge Function (already shipped) is the only authenticated client that calls the tool.

The boolean classifier returns OBSERVATIONS, not verdicts. Each of the 16 Family A keys answers "is this observation present in the move?", never "is this move correct / good / acceptable?". The prompt MUST reflect that framing or the doctrine ban-list catches it.

---

## Binding decisions

### Decision 1 — Family A only; 16 keys binding

Family A keys are binding; exactly 16 (verbatim from MCP-021A):

```
supports_parent
challenges_parent
refines_parent
extends_parent
distinguishes_parent
reframes_parent
questions_parent
summarizes_parent
acknowledges_parent
corrects_parent_detail
contrasts_with_parent
answers_parent_question
has_rebuttal
has_counter_rebuttal
rebutted
quote_anchors_parent
```

If `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` disagrees with this list during designer Phase A, HALT (Trigger 7).

Family B-J keys are out of scope. The tool's request schema accepts only `family: "parent_relation"`. Other family values return a structured `unsupported_family` error.

### Decision 2 — MCP-021A schema verbatim

The tool's response shape is whatever MCP-021A's `parseMcpBooleanObservationResponse` parser accepts. No new wire contract. The schemaVersion string is `mcp-021.machine-observations.boolean.v1` (or whatever constant Phase A verifies as canonical).

The implementation imports MCP-021A's schema constants directly (or via the parser bridge established in MCP-SERVER-001 per its Phase A.3 parser-import resolution — likely Outcome 3 server-side mirror with drift test; designer Phase A confirms).

If MCP-021A's parser rejects the Family A response on any fixture test case, HALT (Trigger 15). Do NOT modify the parser to make the response fit.

### Decision 3 — Prompt engineering is the load-bearing surface

The 16 Family A keys are heterogeneous. Some are concretely binary (`supports_parent`, `challenges_parent`, `questions_parent`). Some require parent-context interpretation (`refines_parent`, `extends_parent`, `distinguishes_parent` — all imply the model understood the parent claim). Some are inter-move relational (`has_rebuttal`, `rebutted`).

Designer Phase A.4 designs the prompt structure. Source material:
- MCP-021A's verbose definitions: positiveExamples, negativeExamples, falsePositiveGuards per key
- MCP-021A's confidenceEligibility per key
- The 3 fixture moves from MCP-021C-EDGE Decision 10:
  - arg1 `f41b18b0-…` (root; depth 0)
  - arg2 `781f8057-…` (depth 1; reply to arg1)
  - arg3 `db0de3e0-…` (depth 2; reply to arg2)

The prompt MUST:
- Be authored from the verbose definitions, not invented
- Treat each key as an observation, not a verdict
- Require the model to provide `confidence: "low" | "medium" | "high"` on every positive flag
- Discard the result if confidence is missing (sanitizer-side rejection)
- Avoid all doctrine ban-list words (winner, loser, verdict, correct, fallacy, etc.)

The prompt MUST NOT:
- Ask the model to judge correctness of the claim
- Ask the model to identify the "better" argument
- Use verdict-style language even in scaffolding instructions
- Encourage the model to produce 16 booleans regardless of evidence (most moves will flag 2-4 keys; few will flag many; the prompt should reward conservative positives over false positives)

### Decision 4 — Validation discipline reuses MCP-SERVER-001 patterns

Response validation follows MCP-SERVER-001's `classify_semantic_move` pattern:
- Validate model returned JSON
- Validate against MCP-021A's parseMcpBooleanObservationResponse
- Sanitize via MCP-021A's sanitizeMcpBooleanObservationResponse (drops unknown rawKeys; truncates evidenceSpan to 240 chars; enforces confidence-required)
- Doctrine ban-list scan over the final response strings
- If any validation step fails, return structured `validation_failed` error matching MCP error envelope

NO adaptive parsing. NO fallback shape coercion. NO retry-with-different-prompt on validation failure (that's a future card if proven needed).

### Decision 5 — classify_semantic_move MUST NOT regress

The MCP server's existing `classify_semantic_move` tool from MCP-SERVER-001 must continue to pass all 5 of its smoke checks (checks 4 + 8 from the 9-check smoke; plus the 3 hosted health stability calls).

This card touches the boolean-observation tool only. The semantic-move tool, its prompt, its validation, its tests, and its smoke behavior must remain byte-equal.

If the implementer must factor out shared code (e.g., bearer auth, structured logging, schema bridge) for the boolean tool, the refactor must be additive: extract to shared module, semantic-move tool imports from shared, semantic-move's tests pass byte-equal.

### Decision 6 — No persistence writes from the MCP server

The MCP server returns the classification response to the caller (the MCP-021C-EDGE Edge Function). The MCP server does NOT write to Supabase tables. The Edge Function is responsible for persisting via the existing MCP-021B persistence path.

This preserves the trust boundary: MCP server holds Anthropic credentials; CDiscourse holds Supabase credentials. Neither holds the other.

### Decision 7 — actorRole=moderator enum addition (folded-in follow-up)

MCP-SERVER-001-SMOKE Phase 5 surfaced a non-blocking compatibility finding: Supabase's `ClassifyMoveRequestSchema` (`supabase/functions/_shared/semanticReferee/schema.ts:108`) permits `actorRole="moderator"` but the MCP server's accepted enum (`mcp-server/lib/semanticRefereePacketSchema.ts:85-90` `ALL_ACTOR_ROLES`) is `{initiator, primary_opponent, chime_in, observer}` only.

MCP-SERVER-002 adds `'moderator'` to the MCP server's enum. The change is:
- 1 line in the server-side `ALL_ACTOR_ROLES` constant
- 1 line in the server-side `actorRole` TypeScript type (line 136)
- 1 line in the error-detail message (line 241)
- 1 new test asserting `actorRole=moderator` is accepted on both tools

This is a documented EXCEPTION to the read-only boundary on `mcp-server/lib/semanticRefereePacketSchema.ts`. The exception is bounded to the actorRole addition only. NO other actorRole changes. NO additional enum expansion. Drift fix only.

### Decision 8 — Docs corrections (folded-in follow-up)

Two docs corrections from MCP-SERVER-001-SMOKE:

**(a)** MCP-018 runbook (`docs/deployment/mcp-018-mcp-adapter-runbook.md`): add a binding precedence note:

```
Provider precedence (binding):
1. semantic_referee_runtime_config.provider_mode (DB row) — wins if present
2. SEMANTIC_REFEREE_PROVIDER env var — wins only if no DB row exists
3. Default 'mock' — wins only if neither is set
```

**(b)** MCP-SERVER-001-SMOKE template (`docs/audits/MCP-SERVER-001-smoke-template.md`): correct SQL using the actual schema (`id` is boolean singleton; column is `enabled` not `semantic_referee_enabled`):

```diff
-where id = '<id-from-select>';
+where id = true;  -- singleton table; id is boolean, not uuid

-set provider_mode = 'mcp', semantic_referee_enabled = true
+set provider_mode = 'mcp', enabled = true
```

NO other docs changes. NO "while we're here" expansions (Trigger 19).

---

## Required production deliverables

1. **Real `classify_argument_boolean_observations` tool implementation:**
   - `mcp-server/tools/classifyArgumentBooleanObservations.ts` updated (no longer scaffold; Family A request returns real classification)
   - Anthropic provider call with Family-A-specific prompt
   - Response validation via MCP-021A parser
   - Sanitization via MCP-021A sanitizer
   - Doctrine ban-list scan on response strings
   - Structured logging (no raw prompts; no raw responses; hashes acceptable)
   - Returns structured `unsupported_family` error for non-Family-A requests

2. **Family A prompt:**
   - `mcp-server/lib/familyAPrompt.ts` (or equivalent)
   - Authored from MCP-021A verbose definitions
   - Treats keys as observations, not verdicts
   - Requires confidence on every positive flag
   - Avoids all doctrine ban-list words
   - Phase A.4 designs; implementer renders into the file

3. **actorRole=moderator enum addition:**
   - Server-side `ALL_ACTOR_ROLES` constant updated (add `'moderator'`)
   - Server-side `actorRole` TS type updated (add `| 'moderator'`)
   - Server-side error-detail message updated
   - 1 new test: `actorRole=moderator` accepted on both tools

4. **Drift tests against MCP-021A parser:**
   - Server-side test asserts Family A response on 3+ fixture moves passes parseMcpBooleanObservationResponse verbatim
   - If parser-import strategy is Outcome 3 (server-side mirror; drift test from MCP-SERVER-001), this card adds Family A coverage to the existing drift test

5. **Server-side test additions:**
   - Family A tool returns valid response shape for valid input
   - Family A tool rejects unknown family with structured error
   - Family A tool validates confidence-required
   - Doctrine ban-list scan on response: 0 hits per fixture
   - Anthropic mock (for CI): returns canned valid Family A response
   - Anthropic mock (for CI): returns malformed response → tool returns validation_failed envelope
   - actorRole=moderator: accepted on both tools
   - classify_semantic_move: 5 smoke checks still pass (regression)

6. **Updated runbook:**
   - `docs/deployment/mcp-server-001-runbook.md`:
     - Add: provider precedence binding note (Decision 8a)
     - Add: how to test Family A locally with fixture provider
     - Add: how to verify Family A response shape via curl
     - NO other content changes

7. **Updated MCP-SERVER-001-SMOKE template:**
   - SQL correction (Decision 8b)
   - NO other content changes

8. **NEW: MCP-SERVER-002-SMOKE template:**
   - `docs/audits/MCP-SERVER-002-smoke-template.md`
   - 3 phases (not 5 — Supabase wiring already validated in MCP-SERVER-001-SMOKE):
     - Phase 1: Local server smoke (both tools)
     - Phase 2: Hosted deploy + hosted smoke (both tools; real Anthropic; real Family A response)
     - Phase 3: MCP-021A parser validation (operator runs the parser against the hosted Family A response; verifies schemaVersion + flags shape + confidence-required + no doctrine ban-list hits)
   - Verdict: PASS / PARTIAL / FAIL
   - Authorization rules:
     - PASS: MCP-021C-EDGE-SMOKE authorized to re-run
     - PARTIAL: scope a fix card; do NOT authorize MCP-021C-EDGE-SMOKE
     - FAIL: file MCP-SERVER-002-FIX

9. **Bounded edits in CDiscourse repo:**
   - Append MCP-SERVER-002 section to docs/core/current-status.md
   - Latest implementer card HTML comment block at top of current-status.md
   - NO changes to MCP-018 adapter
   - NO changes to MCP-021A taxonomy/schema/definitions
   - NO changes to MCP-021B persistence files
   - NO changes to MCP-021C-EDGE files
   - NO changes to UX files
   - NO changes to root package.json/package-lock.json

10. **`.gitignore` extension (optional ops cleanup; small):**
    - Add `phase5-*.json` to gitignore so operator-territory smoke artifacts no longer surface as untracked files
    - This is consistent with the existing `.claude-tmp/` and `netlify-prod.git` patterns
    - Bounded; one line addition

---

## Strict out of scope (any item HALTS)

1. Family B-J implementation (Trigger 7)
2. Persistence writes from MCP server (Trigger 8)
3. Display cap change / new UI (Trigger 9)
4. New taxonomy key (Trigger 10)
5. Activating account UI "Coming later (MCP-018)" affordance (Trigger 11)
6. New MCP-021A wire contract (Trigger 12)
7. New CDiscourse package dependency (Trigger 13)
8. classify_semantic_move regression (Trigger 14)
9. Modifying MCP-021A/B/C-EDGE files (Triggers 16-18)
10. Docs scope expansion beyond the 3 named items (Trigger 19)
11. Verdict/winner/correctness/fallacy/bad-faith language in prompt or response (Trigger 20-21)
12. Automatic production trigger / auto-run on argument post (MCP-021C-FAMILY-A-PROD's job, not this card)

---

## Read-only API boundaries

MCP-SERVER-002 MAY modify:
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` (scaffold → real)
- `mcp-server/lib/familyAPrompt.ts` (NEW)
- `mcp-server/lib/familyAKeys.ts` (NEW; 16-key constant)
- `mcp-server/lib/semanticRefereePacketSchema.ts` — BOUNDED EXCEPTION for the actorRole=moderator addition only (Decision 7); no other lines change
- `mcp-server/tests/` (new tests for Family A + actorRole; existing tests must continue to pass)
- `mcp-server/fixtures/classify-argument-boolean-observations.*.json` (new fixtures; replace scaffolded-response.json if shape changes)
- `scripts/mcp-server-001-smoke.sh` (extend check 5 + 9 to validate real Family A response shape, not just "not_implemented" envelope)
- `docs/deployment/mcp-server-001-runbook.md` (precedence note + Family A testing instructions)
- `docs/deployment/mcp-018-mcp-adapter-runbook.md` (precedence note per Decision 8a)
- `docs/audits/MCP-SERVER-001-smoke-template.md` (SQL correction per Decision 8b)
- `docs/audits/MCP-SERVER-002-smoke-template.md` (NEW)
- `docs/designs/MCP-SERVER-002.md` (NEW; designer output)
- `docs/reviews/MCP-SERVER-002-review.md` (NEW; reviewer output)
- `docs/core/current-status.md` (handoff section)
- `.gitignore` (BOUNDED; add `phase5-*.json` pattern; ops cleanup per Deliverable 10)

MCP-SERVER-002 MAY NOT modify:
- `mcp-server/tools/classifySemanticMove.ts` (any change is a regression — Trigger 14)
- `mcp-server/lib/seedPrompt.ts` (semantic-move prompt; byte-equal)
- `mcp-server/lib/anthropic.ts` (shared provider call; byte-equal unless additive refactor — see Decision 5)
- Any MCP-018 adapter file in `supabase/functions/_shared/semanticReferee/`
- Any MCP-021A taxonomy / schema / definition file (Trigger 16)
- Any MCP-021B persistence file (Trigger 17)
- Any MCP-021C-EDGE file (Trigger 18)
- Any UX file
- Root `package.json` / `package-lock.json` (Trigger 13)
- Any Supabase migration
- Any existing Edge Function

---

## Designer required reading (in order)

1. `docs/designs/MCP-SERVER-002-intent.md` (this brief)
2. `docs/audits/MCP-SERVER-001-SMOKE-2026-05-26.md` (precedent; especially the DB-config diagnostic and actorRole non-blocking finding)
3. `docs/designs/MCP-SERVER-001.md` (server architecture)
4. `mcp-server/tools/classifyArgumentBooleanObservations.ts` (the scaffold being replaced)
5. `mcp-server/tools/classifySemanticMove.ts` (the pattern to mirror)
6. `src/features/nodeLabels/mcpBooleanObservationSchema.ts` (parser + sanitizer + schemaVersion constant)
7. `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` (16 entries with verbose definitions; the prompt-engineering source material)
8. `mcp-server/lib/seedPrompt.ts` (the pattern semantic-move uses; informs Family A prompt structure)
9. `mcp-server/lib/anthropic.ts` (provider call pattern)
10. `mcp-server/lib/doctrineBanList.ts` (the ban-list the prompt must avoid)
11. `docs/deployment/mcp-server-001-runbook.md` (precedence note target location)
12. Official MCP Streamable HTTP transport documentation (verify no spec changes since MCP-SERVER-001 shipped)

---

## Required designer Phase A audits

**Phase A.1 — MCP-021A schema reuse strategy:**
- Confirm schemaVersion constant
- Confirm parser + sanitizer are reusable from MCP-SERVER-001's parser-import strategy (Outcome 1 / 2 / 3)
- If Outcome 3 (server-side mirror), document where the Family A drift test extends the existing parity test

**Phase A.2 — Family A registry verification:**
- Confirm exactly 16 entries
- Confirm verbatim match with binding list in Decision 1
- Confirm verbose fields (positiveExamples, negativeExamples, falsePositiveGuards, confidenceEligibility) present on all entries
- Document any entries where verbose definitions are sparse (these are higher prompt-engineering risk)

**Phase A.3 — Anthropic provider reuse:**
- Confirm `mcp-server/lib/anthropic.ts` (or equivalent) is reusable
- Document model id (likely claude-haiku-4-5 per MCP-SERVER-001)
- Document timeout discipline (per-call + per-tool)
- If a different model would serve Family A better (e.g., claude-sonnet-4-5 for nuanced relational keys like has_counter_rebuttal), surface as operator-deferred decision

**Phase A.4 — Family A prompt design (load-bearing):**
- Design prompt structure from MCP-021A verbose definitions
- Determine: single prompt covering all 16 keys, OR sub-batches by semantic group (e.g., relation-keys batch + rebuttal-keys batch)? Default: single prompt; smaller surface area, easier to validate
- Determine prompt length budget (Family A's 16 keys with verbose definitions could exceed token budget; if so, document abbreviation strategy)
- Confirm confidence-required is part of the prompt instruction
- Confirm observation-not-verdict framing
- Run doctrine ban-list grep on the drafted prompt; 0 hits required
- If no viable prompt structure exists, HALT (Trigger 27)

**Phase A.5 — Fixture move selection:**
- Confirm 3 fixture moves from MCP-SERVER-001 Decision 10 are still resolvable in linked Supabase
- For Family A specifically, each fixture should exercise different expected positives:
  - arg1 (root): minimal positives (no parent to relate to; should flag few keys; tests "moves with no parent" handling)
  - arg2 (depth 1): moderate positives (has parent; likely challenges_parent / refines_parent / has_rebuttal)
  - arg3 (depth 2): rich positives (replies to a rebuttal; likely has_counter_rebuttal / rebutted on parent; tests relational keys)
- Document expected positives per fixture (used by smoke template Phase 3)

**Phase A.6 — actorRole enum addition surface:**
- Confirm the exact server-side files holding the enum + schema: `mcp-server/lib/semanticRefereePacketSchema.ts:85-90` (`ALL_ACTOR_ROLES`) + `:136` (TS type) + `:241` (error detail message)
- Confirm Supabase's `ClassifyMoveRequestSchema` definition at `supabase/functions/_shared/semanticReferee/schema.ts:108` already has 5 values including `'moderator'` (source-of-truth side)
- Document the 4-line change pattern (constant + TS type + error message + 1 test)

**Phase A.7 — Docs corrections surface:**
- Confirm the exact line in MCP-018 runbook where precedence note belongs (likely under DB-config alternative section)
- Confirm the exact SQL lines in MCP-SERVER-001-SMOKE template needing correction
- Document the diff-style changes for both

**Phase A.8 — MCP-SERVER-002-SMOKE template design:**
- 3-phase template (not 5):
  - Phase 1: local server smoke (both tools, real Anthropic if key available locally, or fixture-mode fallback)
  - Phase 2: hosted deploy + hosted smoke (both tools; real Anthropic; real Family A response on 3 fixture moves)
  - Phase 3: MCP-021A parser validation (operator runs parser against hosted Family A response; verifies schemaVersion + flags + confidence + doctrine grep)
- Verdict rules:
  - PASS: all 3 phases; MCP-021C-EDGE-SMOKE authorized to re-run
  - PARTIAL: scope fix card
  - FAIL: file MCP-SERVER-002-FIX

If ANY trigger fires during Phase A, HALT immediately.

---

## Designer deliverable

Create `docs/designs/MCP-SERVER-002.md` with required sections:

1. Scope-reality audit (Phase A.1, A.2, A.3 findings)
2. Family A prompt design (Phase A.4 binding output)
3. Tool implementation design (request validation → prompt build → Anthropic call → response parse → sanitize → ban-list scan → return)
4. Fixture move selection + expected positives (Phase A.5)
5. actorRole enum addition surface (Phase A.6)
6. Docs corrections (Phase A.7)
7. MCP-SERVER-002-SMOKE template design (Phase A.8)
8. Test plan (8+ new server-side tests; CDiscourse-side presence test for new audit template only)
9. Read-only boundary list
10. Conditional HALT trigger table (all 23 triggers + 4 designer-specific)
11. Brief ledger

---

## Brief ledger requirement

MCP-SERVER-002's design document MUST include a ledger naming:

- MCP-021A schema version constant (verbatim)
- Parser-import strategy reused from MCP-SERVER-001 (Outcome 1 / 2 / 3)
- If Outcome 3: how Family A extends the existing drift test
- Family A registry verification result (16 keys verbatim)
- Anthropic model id (claude-haiku-4-5 or alternative; rationale)
- Family A prompt structure (single vs batched; token budget; any abbreviation strategy)
- 3 fixture moves + expected positives per move
- actorRole enum addition: exact files + lines changed
- Docs corrections: exact files + diff blocks
- MCP-SERVER-002-SMOKE template: 3 phases + verdict rules
- Operator-deferred review items

---

## Post-merge operator follow-up (NOT part of the pipeline)

After MCP-SERVER-002 merges, the operator runs MCP-SERVER-002-SMOKE:

**Phase 1 — Local smoke (5 min):**
1. `cd mcp-server && deno task dev` (with fixture provider OR real Anthropic key)
2. `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>`
3. Expected: 9/9 PASS (including check 5 + 9 now validating real Family A response, not "not_implemented")

**Phase 2 — Hosted deploy + hosted smoke (15-20 min):**
1. Deploy via Deno Deploy (Git push to main triggers auto-deploy if linked, OR `deployctl deploy` manually)
2. Verify hosted env vars unchanged from MCP-SERVER-001 state (ANTHROPIC_API_KEY + MCP_SERVER_BEARER_TOKEN + MODEL_PROVIDER=anthropic + MCP_SERVER_ENV=prod + ANTHROPIC_MODEL=claude-haiku-4-5)
3. `bash scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net --token <hosted-token>`
4. Expected: 9/9 PASS; checks 4 + 8 call real Anthropic for semantic-move (regression); checks 5 + 9 call real Anthropic for Family A boolean (new validation)
5. Capture the actual Family A response payload for Phase 3

**Phase 3 — MCP-021A parser validation (10 min):**
1. Save the Family A response from Phase 2 hosted smoke to `/tmp/family-a-response.json`
2. Run a small validator script (provided in design doc §7):
   ```
   deno run --allow-read mcp-server/scripts/validate-family-a-response.ts /tmp/family-a-response.json
   ```
3. Expected output:
   - schemaVersion matches MCP-021A constant
   - flags array present
   - all positive flags have confidence
   - all rawKeys are in Family A's 16-key set
   - evidenceSpan strings ≤ 240 chars
   - 0 doctrine ban-list hits in response strings
4. Record results in audit doc

**Record verdict:** PASS / PARTIAL / FAIL per template

**Authorization rules:**
- PASS → MCP-021C-EDGE-SMOKE AUTHORIZED to re-run
- PARTIAL → scope fix card; do NOT authorize re-run
- FAIL → file MCP-SERVER-002-FIX
