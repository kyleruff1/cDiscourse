# MCP-SERVER-002 — Review

**Verdict:** **PASS** (Approve)
**Reviewer agent run:** 2026-05-26
**Branch:** `feat/MCP-SERVER-002-family-a-boolean-observation-tool`
**Base commit:** `7a5892f`
**Head commit:** `e6c857d`
**Design:** `docs/designs/MCP-SERVER-002.md`
**Intent brief:** `docs/designs/MCP-SERVER-002-intent.md`

---

## Summary

MCP-SERVER-002 promotes `classify_argument_boolean_observations` from the
scaffolded `not_implemented` envelope to a real Family A
(parent_relation) classifier using all 16 binding rawKeys per MCP-021A,
folds in the actorRole=moderator enum addition and 3 named docs
corrections, and ships an additive refactor of the Anthropic call path
that keeps `classify_semantic_move` byte-equal. The design (1,273
lines) is rigorously executed across 6 commits. All 22 verdict-matrix
items PASS. All 9 stop conditions CLEAN. 86 doctrine ban-list hits in
the diff are accounted for across four allowed categories (prompt
negations, design prose, pattern definitions, negative-test fixtures,
and binding structural vocabulary for `corrects_parent_detail`). Wire
compatibility with MCP-021A's parser is enforced by 2 parity tests +
14 fixture-parity tests. CDiscourse Jest tests at **543 suites /
17,592 tests / exit 0** (+1 suite / +15 tests). Server-side Deno tests
at **200 tests / exit 0** (+110). Typecheck + lint clean.

Authorization for orchestrator to proceed to PR creation + squash-merge.

---

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (exit 0) |
| `npm test` (Jest) | PASS (exit 0) — 543 suites / 17,592 tests; +1 suite / +15 tests vs base |
| `deno test mcp-server/tests/` | PASS (exit 0) — 200 tests / 0 failed; +110 vs base |
| Secret scan | CLEAN — only env-var name references in runbooks, source-scan test patterns, intentional placeholders |
| Doctrine scan | 86 ban-list hits all categorized in 4 allowed classes (see Item A) |

---

## 22-item verdict matrix

| # | Item | Verdict | Evidence |
|---|---|---|---|
| A | Doctrine — no verdict language in user-facing strings | **PASS** | All 86 hits across 15 files fall in 4 categories: (a) prompt negations, (b) design prose, (c) pattern definitions, (d) negative-test fixtures + `corrects_parent_detail` structural vocab. `familyAPrompt.test.ts:221-317` enforces this. |
| B | Read-only API boundary (MCP-018/021A/021B/021C-EDGE) | **PASS** | `git diff` over those 5 paths returns **0 lines**. |
| C | Client-secret boundary (CRITICAL) | **PASS** | `git diff -- src/ app/` matches for MCP_URL / MCP_TOKEN / SEMANTIC_REFEREE_MCP / EXPO_PUBLIC_*MCP / ANTHROPIC_API_KEY = **0**. |
| D | Root package boundary | **PASS** | `git diff -- package.json package-lock.json` = **0 lines**. |
| E | Family A 16 keys verbatim | **PASS** | `mcp-server/lib/familyAKeys.ts:49-66` declares 16 frozen rawKeys; `familyAKeysParity.test.ts` enforces set-equal parity bidirectionally vs upstream `familyA.ts` (16 declarations). Verified PASS in Deno run. |
| F | Family B-J unsupported_family rejection | **PASS** | `familyABooleanRequestSchema.ts` returns `kind: 'unsupported_family'` with structured detail; fixture `unsupported-family-request.json` asserted in `familyAFixtureParity.test.ts:252-261`. |
| G | MCP-021A schema used verbatim | **PASS** | `mcpBooleanObservationSchemaParity.test.ts` enforces schemaVersion + MAX_EVIDENCE_SPAN_CHARS (240) + MAX_FLAGS_PER_RESPONSE (20) + 6 failure-reason strings present in both upstream and mirror. Upstream `src/features/nodeLabels/mcpBooleanObservationSchema.ts` had 0 line diff. |
| H | Family A prompt authored from MCP-021A verbose definitions | **PASS** | `familyAKeys.ts:89-` declares 16 `FamilyAPromptEntry` blocks with positiveDefinition, negativeDefinition, positiveExample, negativeExample, falsePositiveGuards mirrored from upstream. `familyAPrompt.test.ts:107-120` asserts every entry's verbose fields appear in the built user prompt. |
| I | Family A prompt frames keys as OBSERVATIONS not verdicts | **PASS** | `familyAPrompt.ts:46-71` system prompt is byte-equivalent to semantic-move's 7 absolute rules ("You do NOT decide who is right", "the winner", "truth value", etc.) + structural framing ("structural classifier", "STRUCTURAL relationships", "an observation about the move's STRUCTURE, not a judgement about who is right"). Conservative-positives bias instructs "answer false when unsure" rather than confident yes/no. `familyAPrompt.test.ts:47-76` enforces the structural framing fragments. |
| J | Confidence required on every positive flag | **PASS** | `mcpBooleanObservationSchemaMirror.ts:218-254` enforces observations/confidence/evidenceSpan key-set coordination; missing confidence for any observations key = `validation_failed`. Prompt template at `familyAPrompt.ts:184-185` instructs the model to coordinate keys. `familyAPrompt.test.ts:122-133` verifies prompt requires `confidence` + `low|medium|high` enumeration. |
| K | Family A response passes MCP-021A parser on 3 fixture moves | **PASS** | `familyAFixtureParity.test.ts:46-80` runs `validateMcpBooleanObservationResponse` against arg1, arg2, arg3 fixture responses + the canonical fixture. All 4 fixtures PASS the parser + ban-list scan. |
| L | Sanitization applied (unknown rawKey, evidenceSpan ≤ 240) | **PASS** | Mirror validator at lines 209-215 rejects `evidenceSpan` > 240 chars; lines 256-265 reject `observations` key absent from `checkedRawKeys`; `familyAFixtureParity.test.ts:102-120` asserts cap enforced on fixtures. |
| M | Doctrine ban-list scan returns 0 hits on test responses | **PASS** | `familyABanListScan.ts` scans evidenceSpan + modelInfo.serverName + modelInfo.classifierSetVersion; the 4 production fixtures (canonical + arg1 + arg2 + arg3) pass the scan; intentionally-malformed `family-a-ban-list-response.json` is rejected (negative test). `familyABanListScan.test.ts` exercises every banned token shape. |
| N | Anthropic provider call — server-side only; no client leakage | **PASS** | `anthropicNoLogging.test.ts:21-129` runs 3 runtime tests (success / failure / timeout) with a fake key and asserts the key never appears in any log line. `anthropicCall.ts` is the single point where the key reaches the network. |
| O | Structured logging excludes raw prompts + responses | **PASS** | `anthropicNoLogging.test.ts:131-169` source-scans `anthropic.ts`, `anthropicCall.ts`, `familyAAnthropic.ts` for `console.log` containing Authorization / x-api-key / ANTHROPIC_API_KEY. All 3 scans PASS. `classifyArgumentBooleanObservationsSourceScan.test.ts:80-92` adds the boolean tool to the scan. |
| P | classify_semantic_move byte-equal + Anthropic refactor additive | **PASS** | `git diff -- mcp-server/tools/classifySemanticMove.ts` = **0 lines**. `git diff -- mcp-server/lib/seedPrompt.ts` = **0 lines**. `anthropic.ts` is refactored to use `anthropicCall.ts` but all public exports (`runAnthropicSemanticReferee`, `extractAnthropicContentText`, `parseJsonFromContent`, 4 constants) preserved byte-equal. Backward-compat type aliases at lines 59-61. Semantic-move tests pass in Deno run. |
| Q | actorRole=moderator on both tools; existing 4 still accepted | **PASS** | 3-line surgical change at `semanticRefereePacketSchema.ts:90, 137, 242` matches design §5.2 binding diffs verbatim. `actorRoleModerator.test.ts` (5 tests) asserts: ALL_ACTOR_ROLES includes moderator + length=5; validator accepts moderator; all 4 existing roles still accepted (regression); junk strings still rejected; error message includes moderator. |
| R | Docs corrections — exactly 3 named edits + smoke template + runbook | **PASS** | 6 docs files touched: MCP-018 runbook precedence note (Decision 8a verbatim); MCP-SERVER-001 smoke template SQL block (Decision 8b verbatim with corrected `id = true` + `enabled` schema); MCP-SERVER-001 runbook Family A testing section; new MCP-SERVER-002 smoke template; design doc; current-status handoff. No "while we're here" expansions. |
| S | NEW MCP-SERVER-002-SMOKE template — 3 phases + verdict rules | **PASS** | `docs/audits/MCP-SERVER-002-smoke-template.md` has Phase 1 (local), Phase 2 (hosted), Phase 3 (parser validation) headers + Verdict section with PASS / PARTIAL / FAIL + failure-reason interpretation table + authorization graph. 194 lines. |
| T | Server tests — exit 0; cover positive + malformed + unsupported + actorRole + regression | **PASS** | Deno test run captured: **200 passed / 0 failed** in 1s. Test files cover: positive happy path (classifyArgumentBooleanObservations.test.ts), malformed-response (familyAResponseValidator + familyAFixtureParity), unsupported_family (fixture + schema), actorRole=moderator (actorRoleModerator), classify_semantic_move regression (classifySemanticMove + seedPromptParity UNCHANGED). |
| U | CDiscourse tests — exit 0; minimal delta | **PASS** | `npm test` captured: **543 suites / 17592 tests passed / 0 total / exit 0** in 19.6s. Delta = +1 suite / +15 tests, matching implementer claim. Only addition: `__tests__/mcpServerTwoPresence.test.ts`. |
| V | Typecheck + lint — exit 0; no new dependencies | **PASS** | `npm run typecheck` exit 0. `npm run lint` exit 0. `package.json` + `package-lock.json` diff = 0 lines. |

**Result: 22/22 PASS.**

---

## Design conformance

- [x] All design file-changes are present (47 files modified; matches design §9.1 allow-list)
- [x] No undocumented file-changes (every touched file is in the §9.1 MAY-modify list)
- [x] Data model matches design (16 keys verbatim; MCP-021A schemaVersion verbatim; failure-reason enum verbatim)
- [x] API contracts match design (request validator + response validator + ban-list scan ordering per design §3)
- [x] Prompt structure matches design §2.1-2.4 verbatim (single prompt, MAX_TOKENS=1500, conservative-positives, response shape)
- [x] 3-commit-cadence matches design §11.2 binding plan (6 commits — implementer matched exactly)
- [x] Operator-deferred items surfaced (4 items per design §11.3 — visible in current-status.md handoff)

---

## Doctrine self-check (all checked)

- [x] No truth/winner/loser language in user-facing strings — see Item A breakdown
- [x] Score never blocks posting — N/A; this card is observation-only, not scoring
- [x] No service-role in client code — `git diff -- src/ app/` for SERVICE_ROLE = 0 matches
- [x] No direct insert into public.arguments — N/A; MCP-SERVER-002 makes no Supabase calls
- [x] No AI calls in production app paths — All Anthropic calls in `mcp-server/lib/` (Deno-targeted, not bundled into app/)
- [x] Plain language only (no raw internal codes in UI strings) — N/A; no UI surface
- [x] Epic-specific doctrine (cdiscourse-doctrine §10a) — Every key is a Machine Observation, never a verdict; `modelInfo.provider='mcp'` identifies machine-source; sensitive observations not in Family A scope
- [x] evidence-doctrine — Family A keys do not include popularity/engagement; absolute rule "You do NOT treat popularity, engagement, or virality as evidence" is in the system prompt verbatim
- [x] supabase-edge-contract — No service-role usage; MCP server holds only Anthropic credentials; CDiscourse holds only Supabase credentials; trust boundary preserved

---

## Doctrine ban-list 86-hit categorization

The deeper grep scan returned 86 hits across 15 files (the implementer's
"76" claim was a slightly different regex; both numbers are in the
same band; same categorization applies). Sampled and confirmed:

| File | Hits | Category | Verification |
|---|---|---|---|
| `docs/designs/MCP-SERVER-002.md` | 27 | (b) Design prose explaining the doctrine, the ban-list patterns, and the `corrects_parent_detail` rawKey | Sample: "winner — appears in 'You do NOT decide the winner...'" |
| `mcp-server/tests/familyABanListScan.test.ts` | 20 | (d) Negative-test fixtures verifying the ban-list scanner catches each banned token | Sample: `evidenceSpan: { supports_parent: 'declared the winner of round two' }` (test that scanner REJECTS) |
| `mcp-server/tests/familyAPrompt.test.ts` | 13 | (a) Prompt negations + (c) allow-list pattern definitions + (e) `corrects_parent_detail` structural vocab allow-list | Sample: `'correct a specific factual detail'` (structural verb, not verdict) |
| `mcp-server/lib/familyAPrompt.ts` | 6 | (a) Prompt negations in absolute-rules block + JSDoc comments explaining the negations are doctrine-positive | Sample: "You do NOT decide the winner of any debate." |
| `docs/core/current-status.md` | 4 | (b) Handoff prose explaining the doctrine boundary | Sample: "...stays byte-equal (Trigger 14 protected)" |
| `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` | 3 | (a) Negation tests + JSDoc explaining doctrine constraint | Sample: tool description test ensures no verdict tokens |
| `mcp-server/lib/familyAKeys.ts` | 2 | (e) `corrects_parent_detail` rawKey booleanQuestion (structural vocab; upstream-bound) + JSDoc | Sample: "Does this move correct a specific factual detail..." |
| `mcp-server/lib/familyABanListScan.ts` | 2 | (c) Ban-list pattern definitions (scanner itself) | The scanner needs to reference what it's scanning for |
| `docs/audits/MCP-SERVER-002-smoke-template.md` | 2 | (b) Smoke template explanation prose | Sample: "Validator finds doctrine ban-list hit" failure-reason interpretation |
| `__tests__/mcpServerTwoPresence.test.ts` | 2 | (a) Negation pattern reference + presence-test assertion | Sample: assertion that smoke template contains ban-list scan reference |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | 1 | (a) JSDoc explaining the tool returns "structural observations only, never verdicts" | Tool description prose |
| `mcp-server/tests/familyAFixtureParity.test.ts` | 1 | (d) Negative test that the ban-list response fixture rejects | Sample: "negative test" |
| `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` | 1 | (a) JSDoc explaining "the validator never blesses verdict-style fields" | JSDoc only |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-a-ban-list-response.json` | 1 | (d) Negative-test fixture; intentional `"winner"` token in evidenceSpan to verify scanner catches it | Tested at familyAFixtureParity.test.ts:227-235 |
| `__tests__/mcpServerOnePresence.test.ts` | 1 | (a) Existing pattern reference (pre-existing change) | (Updated only to add MCP-SERVER-002 awareness) |

**Total: 86 hits, ALL categorized in the four allowed classes. 0 doctrine violations.** The strictest enforcement is in `familyAPrompt.test.ts:221-317`, which iterates DOCTRINE_BAN_PATTERNS against the actual generated prompt and rejects any hit outside the explicit allow-list (negations + `corrects_parent_detail` structural vocabulary).

---

## Anthropic refactor additivity

Confirmed via `mcp-server/lib/anthropic.ts:30-99`:

- `runAnthropicSemanticReferee(request, requestId, fetchImpl)` — SIGNATURE BYTE-EQUAL
- `ANTHROPIC_API_URL`, `ANTHROPIC_API_VERSION`, `DEFAULT_ANTHROPIC_MODEL`, `DEFAULT_MODEL_TIMEOUT_MS` — RE-EXPORTED
- `extractAnthropicContentText`, `parseJsonFromContent` — RE-EXPORTED
- `AnthropicResult` / `AnthropicFailure` — preserved as backward-compat type aliases for `AnthropicCallSuccess` / `AnthropicCallFailure`

The HTTP / timeout / fetch / parse skeleton moved to `anthropicCall.ts`. Both `anthropic.ts` (semantic-move) and `familyAAnthropic.ts` (Family A) call `callAnthropic`. The smoke checks 4 + 8 (semantic-move) will remain byte-equal regression gates in Phase 2 hosted smoke. The Deno test run confirmed semantic-move's existing tests + seedPromptParity all PASS unchanged.

---

## Family A prompt — observation-vs-verdict semantic spot-check

System prompt at `familyAPrompt.ts:46-71`:

Doctrine-positive negations (mirror semantic-move §50 verbatim):
```
- You do NOT decide who is right in a debate.
- You do NOT decide the winner of any debate.
- You do NOT assign a truth value to any claim.
- You do NOT treat popularity, engagement, or virality as evidence.
- You do NOT describe, judge, or label the person — only the move's structure.
- You do NOT recommend hiding, deleting, or modifying any content.
- You do NOT block an ordinary post — your output is advisory metadata only.
```

Observation framing:
```
"You classify whether an argument MOVE exhibits structural relationships
toward its PARENT move. Each question is an observation about the move's
STRUCTURE, not a judgement about who is right."
```

User-prompt questions per `familyAKeys.ts:89-`:
- "Does this move's substantive content support..." (structural)
- "Does this move's substantive content challenge..." (structural)
- "Does this move correct a specific factual detail..." (structural)
- "Does this move ask a substantive question..." (structural)

NONE of the 16 booleanQuestion fields ask the model to judge correctness of the move OR the parent. NONE asks for a "winner" or "stronger" determination. The conservative-positives bias instruction enforces "answer false when unsure" — the opposite of verdict bias. **Item I PASS with high confidence.**

---

## Suggestions (non-blocking)

1. **Hosted-smoke verification still pending.** The Phase 2 (Deno Deploy + real Anthropic) smoke + Phase 3 (validator script against captured payload) run post-merge. This card's local smoke (Phase 1 with fixture provider) passed 9/9; the live model + the actual Anthropic-returned schema shape are not yet exercised. This is by design (operator follow-up) but the smoke template Phase 2/3 must run before any downstream card (MCP-021C-EDGE-SMOKE, MCP-021C-FAMILY-A-PROD) is authorized.

2. **auto_metadata/lifecycle key fidelity (operator-deferred #2).** Three rawKeys (`has_rebuttal`, `has_counter_rebuttal`, `rebutted`) describe argument-tree facts the model cannot directly observe from move text alone. The prompt warns the model and instructs `answer FALSE with low confidence`. The timeline sanitizer will drop these `low`-confidence positives, so end-user visibility is intact, but the operator should review Phase 2 output to confirm the false-positive rate is acceptable. MCP-021C-FAMILY-A-PROD is the right place to decide whether the Edge Function pre-fills these deterministically.

3. **Token budget actual vs estimated (operator-deferred #4).** The design estimated 4,000-5,000 input tokens; the abbreviation strategy is documented as out-of-scope for v1. The operator should record the actual `usage.input_tokens` from the first hosted call and file a follow-up if > 6,000.

4. **classifySemanticMove inputSchema enum reconciliation.** The MCP-SERVER-002 smoke template surfaces that `classifySemanticMove.ts`'s documented JSON-schema enum still lists 4 actorRole values, while the validator now accepts 5. This is an operator-deferred follow-up (the design's deferred decision #d). The internal validator is the source-of-truth and accepts 5; only external consumers reading the JSON schema directly would notice the mismatch. Surface in a future operator decision.

None of these are blocking for PR merge.

---

## Operator next steps

1. **Push the branch** (already pushed to origin at `e6c857d`):
   ```
   git push -u origin feat/MCP-SERVER-002-family-a-boolean-observation-tool
   ```

2. **Open PR** with the standard format:
   ```
   gh pr create --title "MCP-SERVER-002: Family A Boolean Observation Tool (M-L; real classifier replaces scaffold; 16 keys verbatim; classify_semantic_move byte-equal; actorRole=moderator folded in)" \
     --body-file docs/reviews/MCP-SERVER-002-review.md
   ```

3. **Squash-merge after PR review** (no Supabase migration; no CDiscourse Edge Function deploy required).

4. **Post-merge Deno Deploy auto-deploys** the MCP server on push to main. No manual deploy step.

5. **Operator runs MCP-SERVER-002-SMOKE post-deploy:**
   - **Phase 1 (5 min)** — local smoke with `MCP_SERVER_USE_FIXTURE_PROVIDER=true`:
     ```
     cd mcp-server && deno task start  # in one terminal
     bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>
     ```
     Expected: 9/9 PASS (real Family A response shape, not scaffold envelope)
   - **Phase 2 (15-20 min)** — hosted smoke with real Anthropic:
     ```
     bash scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net --token <hosted-token>
     ```
     Capture the Family A response payload to `/tmp/family-a-response.json`.
   - **Phase 3 (10 min)** — MCP-021A parser validation:
     ```
     deno run --allow-read mcp-server/scripts/validate-family-a-response.ts /tmp/family-a-response.json
     ```
     Expected: `VALIDATE_FAMILY_A_RESPONSE: PASS`.

6. **Authorization graph (post Phase 1-3 PASS):**
   - MCP-021C-EDGE-SMOKE — AUTHORIZED to re-run with live Family A
   - MCP-021C-FAMILY-A-PROD — AUTHORIZED to file (auto-trigger on argument post)
   - MCP-SERVER-003 (Family B design) — AUTHORIZED
   - ADMIN-MCP-001 — was already authorized post-MCP-SERVER-001-SMOKE; remains authorized
   - OPS-MCP-OBSERVABILITY — AUTHORIZED to scope

7. **Post-merge worktree cleanup** (commands in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup"):
   ```
   git worktree list | grep "feat/MCP-SERVER-002"
   git worktree remove -f -f ".claude/worktrees/agent-<hash>"
   git branch -D feat/MCP-SERVER-002-family-a-boolean-observation-tool
   ```
