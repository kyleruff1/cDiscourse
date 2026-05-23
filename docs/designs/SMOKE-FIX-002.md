# SMOKE-FIX-002 — Tighten seed prompt to enumerate routeSuggestion and frictionSuggestion + worked example

**Card:** SMOKE-FIX-002 (Rules UX · P1 · S · Release 6.9).
**Status:** Design draft.
**Epic:** Rules UX.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/240
**Branch:** `feat/SMOKE-FIX-002-seed-prompt-enum-coverage` (off `main`).
**Companion contracts:** MCP-001 (catalog v0), MCP-011 (Node validator), MCP-016 (boundary), MCP-017 (live Anthropic provider + seed prompt). No touch to MCP-018 (`mcp` adapter) or ADMIN-AI-001 (admin runtime config) in this card.
**Prior cards:** SMOKE-FIX-001 (#229; merged at `7140299`) — schema widening for `actorRole` + diagnostic log lines on `validation_failed`.
**Investigation companion:** `docs/testing-runs/2026-05-22-smoke-test-failure-investigation.md` (failure mode 2, ranked candidate causes).

---

## 1. Goal (one paragraph)

The 2026-05-23 smoke-test re-run after SMOKE-FIX-001's deploy (runId `5f67680a`, against `semantic-referee` deployment version 39) confirmed Fix A worked — move 1's two batches now pass the inbound `.strict()` gate — and named the cause of the residual move-2 + flip-probe failures via Fix B1's diagnostic lines: all three remaining `validation_failed` calls failed the OUTBOUND `SemanticRefereePacketSchema` at top-level path `["routeSuggestion"]`, meaning the Haiku 4.5 response either omits `routeSuggestion` or emits a value outside the 7-value `SemanticRouteSuggestion` enum. SMOKE-FIX-002 ships the narrow Option B2d remediation from SMOKE-FIX-001 §11: tighten `seedPrompt.ts`'s user-message instruction so it enumerates the 7 `routeSuggestion` enum values AND the 8 `frictionSuggestion` enum values inline (the analogous enum field the same prompt-vagueness affects — the orchestrator just halts on the first failure), adds a one-shot worked example showing the complete packet shape with concrete, ban-list-clean values, and bumps `SEED_PROMPT_VERSION` from `'mcp-semantic-referee-prompt-v0'` to `'mcp-semantic-referee-prompt-v1'` per the file comment's wording-change rule. The verification path is the Supabase GitHub integration's auto-redeploy on merge to `main`, followed by an operator re-run of `node scripts/bot-fixtures/runMcpSmokeTest.js`. If `frictionSuggestion` or `scoreHints` fails next, SMOKE-FIX-003 picks it up with the same shape.

---

## 2. Scope

### In scope

- **Edit 1 — enumerate the route + friction enums inline** in `seedPrompt.ts`'s `buildClassifierPrompt` user-message instruction. The instruction currently names the fields (`routeSuggestion`, `frictionSuggestion`) without listing their valid values. After this edit it lists the 7 `routeSuggestion` values and the 8 `frictionSuggestion` values verbatim.
- **Edit 2 — add a one-shot worked example** to the user-message text, showing the COMPLETE packet shape with concrete safe values. The example is structural — it demonstrates the JSON shape only; it explicitly does not prescribe answers. The example body carries:
  - one `binaries[]` entry (`classifierId: 'responds_to_parent'`, `value: 1`, `confidence: 'high'`, `reasonCode: 'parent_continuity_engaged'`);
  - `routeSuggestion: 'mainline'`;
  - `frictionSuggestion: 'none'`;
  - a full `scoreHints` object with all six integer fields set inside the `0..3` range.
- **Edit 3 — bump `SEED_PROMPT_VERSION`** from `'mcp-semantic-referee-prompt-v0'` to `'mcp-semantic-referee-prompt-v1'` (the file comment at lines 28-31 explicitly says a wording change bumps this).
- **New test — `__tests__/semanticRefereeSeedPromptEnumCoverage.test.ts`.** Source-scans `seedPrompt.ts` and asserts: (a) every `SemanticRouteSuggestion` enum value appears as a literal in the source; (b) every `SemanticFrictionSuggestion` enum value appears as a literal in the source; (c) the worked example block is present and well-formed; (d) `SEED_PROMPT_VERSION === 'mcp-semantic-referee-prompt-v1'`; (e) the worked example contains no token from the SMOKE-FIX-001 ban-list (`winner / loser / won / lost / right / wrong / true / false / correct / incorrect / verdict / proven / disproven / defeated / popular / unpopular / liar / lying / dishonest`) and no banned phrase (`bad faith`).
- **Updated `docs/core/current-status.md`.** A 3-line footnote under the Stage 6.4 line documenting the bump to prompt v1 and pointing to this design.

### Out of scope (explicitly — do NOT design or implement in this card)

- **Any change to `schema.ts`.** The schema is the contract; the prompt fits the contract. Widening or loosening the schema would change the public contract.
- **Any change to `anthropicProvider.ts`**, including SMOKE-FIX-001's diagnostic `console.warn` lines. Those stay. They will tell us if the next re-run still fails and where.
- **Any change to `contentSafetyScan.ts`** (the outbound content scanner). No new exemption, no new field, no widened ban-list.
- **Any change to `mockProvider.ts`, `mcpAdapter.ts`, `mcpAdapterCore.ts`**, or the `process-language-draft` Edge Function. SMOKE-FIX-002 stays inside `seedPrompt.ts` plus one new test file plus the `docs/core/current-status.md` footnote.
- **Any change to `src/features/`** — including `triggerGates.ts`, `semanticTriggerInput.ts`, `useSemanticReferee.ts`, `semanticRefereeTypes.ts`, `semanticRefereeValidator.ts`, `semanticCache.ts`, `semanticRefereeCacheKey.ts`.
- **Any change to `src/lib/edgeFunctions.ts`** (the Node-side `classifyMove` wrapper).
- **Any change to `PACKET_VERSION`, `ClassifyMoveDisabledReason`, `SemanticActorRole`, or the catalog v0 classifier-id list.** Catalog v0 is frozen.
- **No deterministic-fallback coercion logic anywhere.** The prompt is the only edit point — we do NOT add a "if `routeSuggestion` is missing, substitute `no_route_change`" step in the provider. The model is told the shape; the schema enforces it; rejection still goes through the existing degraded-but-stable fallback path.
- **No new fields in the catalog.** Catalog v0 is frozen.
- **No new test beyond the source-scan one named above.** The existing `__tests__/semanticAnthropicSeedPromptBanList.test.ts` keeps passing untouched.
- **No deletion or modification of SMOKE-FIX-001's diagnostic `console.warn` lines.** They are the next-line-of-evidence if SMOKE-FIX-002 still leaves a failure behind.
- **No migration.** No `flags` write. No service-role usage. No new RLS policy. No storage bucket touch.
- **No automatic deploy step in this card.** The Supabase GitHub integration handles the auto-redeploy on merge; the smoke-test re-run is the operator's acceptance check.
- **v1-scope-excluded features** — no voting, no winner-producing scoring, no real-time collab, no push notifications, no OAuth, no public API, no argument search.

---

## 3. Doctrine constraints (the lines a reviewer enforces)

Any violation is a blocker.

1. **No truth verdict in the worked example.** The example carries NO ban-list token from SMOKE-FIX-001's banned set (`winner`, `loser`, `won`, `lost`, `right`, `wrong`, `true`, `false`, `correct`, `incorrect`, `verdict`, `proven`, `disproven`, `defeated`, `popular`, `unpopular`, `liar`, `lying`, `dishonest`) and no banned phrase (`bad faith`). The example's `reasonCode` is structural-only (`parent_continuity_engaged`) and starts with one of the eight `REASON_CODE_FAMILIES` prefixes from `src/features/semanticReferee/semanticRefereeTypes.ts:210-219` (`parent_continuity`, `branch_routing`, `evidence`, `source_chain`, `movement`, `mode_fit`, `friction`, `banner`). The new test in §5.4 enforces this.
2. **The packet contract is untouched.** No widening of `SemanticRefereePacketSchema`. No new field in `ClassifyMoveRequest` or `SemanticRefereePacket`. No change to `PACKET_VERSION`. No change to `ClassifyMoveDisabledReason` in either the Deno or Node twin. The advisory packet remains `authoritative: false`; the boundary still cannot return a hard gate.
3. **The bumped prompt version is opaque diagnostic.** `'mcp-semantic-referee-prompt-v1'` is a deterministic, non-secret string. It is stamped onto the packet's `promptVersion` and used as a cache-key segment; it is never user-facing copy and never carries a truth claim about the move or the participant.
4. **No service-role, no privileged write, no migration, no RLS change.** This card reads no `SUPABASE_SERVICE_ROLE_KEY`, builds no service-role client, writes no table, no migration, no RLS change.
5. **No new AI call from the production app.** This card edits one Deno-side `_shared/` file consumed by an Edge Function. No `src/` file calls Anthropic / xAI / X API as a result of this card. The production app continues to call only `classifyMove` via the existing Edge Function boundary.
6. **No secret ever logged.** The worked example carries no key, no token, no JWT, no `sk-ant-…` / `xai-…` / `sb_secret_…` / Authorization / Bearer literal. The new test scans for these and asserts absence.
7. **Score never blocks posting.** The packet still has no `block` field, no truth field, no winner field. The example demonstrates the SAFE shape — `binaries[].value` is an integer literal `1` (not the JSON boolean `true`); `confidence` is one of `'low' | 'medium' | 'high'`; `scoreHints` integers are in `0..3`.
8. **The widening is monotone in the safe direction at the prompt layer.** A more-specific prompt can only make the model MORE likely to satisfy the existing `.strict()` schema. It cannot loosen the schema, cannot widen what is accepted, cannot accept anything previously rejected.
9. **No client surface change.** `src/features/semanticReferee/` and `src/features/arguments/useSemanticReferee.ts` are not modified. No new prop, no new type, no new export.
10. **Idempotent under re-deploy.** The Supabase GitHub integration's auto-redeploy on merge to `main` picks up the new prompt version. Running the deploy twice is a no-op. The cache invalidation (see §11) happens cleanly on the first redeploy.

---

## 4. Background — the named cause (from SMOKE-FIX-001's diagnostic lines)

The 2026-05-23 smoke-test re-run (runId `5f67680a`) against `semantic-referee` deployment version 39 produced THREE diagnostic `console.warn` entries from SMOKE-FIX-001's Fix B1, all matching the same shape and the same path:

| # | Timestamp (UTC) | Origin | layer | path | inputHash |
|---|---|---|---|---|---|
| 1 | 2026-05-23T03:03:41.019Z | move 2, batch 1 | `schema` | `["routeSuggestion"]` | `anthropic-<hash>` |
| 2 | 2026-05-23T03:03:44.985Z | move 2, batch 2 | `schema` | `["routeSuggestion"]` | `anthropic-<hash>` |
| 3 | 2026-05-23T03:03:48.953Z | post-flip probe | `schema` | `["routeSuggestion"]` | `anthropic-<hash>` |

The exact wire shape of each line:

```json
{"semanticReferee":"validation_failed","layer":"schema","path":["routeSuggestion"],"inputHash":"anthropic-<hash>"}
```

`layer: "schema"` (not `content_scan`) means the rejection fired inside `SemanticRefereePacketSchema.safeParse(stamped)` at `anthropicProvider.ts:187-190` (post-SMOKE-FIX-001 numbering) — the model's parsed JSON either omits `routeSuggestion` entirely OR sets it to a value that is not in the 7-member `SemanticRouteSuggestion` enum (`mainline | vertical_chime_branch | diagonal_tangent | outer_realm | cards_detail | synthesis_lane | no_route_change`). The `path` array is `["routeSuggestion"]` — top-level — so the failure is on the field itself, not inside a nested value.

The smoke test's three calls cover three different request shapes (two real moves' batches + the post-flip probe) and produce IDENTICAL `path: ["routeSuggestion"]` failures. That makes the failure **systematic in the model's output shape, not data-dependent** — exactly the prediction in SMOKE-FIX-001's investigation §"Probable causes — ranked" candidate 4 ("a required field is missing — lower likelihood, less likely because the user prompt is explicit about all three"). The smoke-test evidence inverts that ranking: the required field IS being omitted (or out-of-enum'd) systematically. The named remediation in SMOKE-FIX-001 §11 for this branch is Option B2d (tighten the prompt to enumerate values + show a worked example).

`frictionSuggestion` did not fire — but only because the schema short-circuits on the first failure. The current `buildClassifierPrompt` instruction names `frictionSuggestion` with the same prose-only treatment as `routeSuggestion` (line 146: "a `routeSuggestion`, a `frictionSuggestion`, and a `scoreHints` object of six integers 0..3"). It is the same prompt-vagueness affecting the same model on the same call; fixing only `routeSuggestion` would risk a same-class failure on `frictionSuggestion` the next run. The scope expansion to enumerate both at once is operator-authorized in the card description.

---

## 5. File changes

Total touched files: 3 (one source edit, one new test, one doc footnote). No production code outside the Deno-side `_shared/` tree. No `src/` file touched. No migration.

### 5.1 `supabase/functions/_shared/semanticReferee/seedPrompt.ts` — enumerate the route + friction enums inline

The current `instruction` is built at lines 139-148:

```ts
// before (lines 139-148)
const instruction = [
  'Answer each structural question above with 0 or 1 for the move below.',
  'Return ONLY a single JSON object — no prose, no markdown, no code fence,',
  'no chain-of-thought. The object must conform to the semantic-referee',
  'packet contract: a `binaries` array (one entry per requested classifier,',
  'each with `classifierId`, `value` 0 or 1, `confidence` low/medium/high,',
  'and a lowercase snake_case `reasonCode`), a `routeSuggestion`, a',
  '`frictionSuggestion`, and a `scoreHints` object of six integers 0..3.',
  'Do not include any blocking, verdict, truth, or winner field.',
].join(' ');
```

After the edit (one logical instruction; line-wrapping at the implementer's discretion):

```ts
// after — names the seven and eight enum values verbatim
const instruction = [
  'Answer each structural question above with 0 or 1 for the move below.',
  'Return ONLY a single JSON object — no prose, no markdown, no code fence,',
  'no chain-of-thought. The object must conform to the semantic-referee',
  'packet contract: a `binaries` array (one entry per requested classifier,',
  'each with `classifierId`, `value` 0 or 1, `confidence` low/medium/high,',
  'and a lowercase snake_case `reasonCode`), a `routeSuggestion`, a',
  '`frictionSuggestion`, and a `scoreHints` object of six integers 0..3.',
  '`routeSuggestion` MUST be exactly one of: "mainline", "vertical_chime_branch",',
  '"diagonal_tangent", "outer_realm", "cards_detail", "synthesis_lane",',
  '"no_route_change". `frictionSuggestion` MUST be exactly one of: "none",',
  '"soft_chip", "pre_send_pause", "ask_for_quote", "ask_for_source",',
  '"suggest_branch", "suggest_narrow", "cooldown_notice".',
  'Do not include any blocking, verdict, truth, or winner field.',
].join(' ');
```

Notes:

- The 7 `routeSuggestion` literals are the verbatim members of `ALL_ROUTE_SUGGESTIONS` in `types.ts:171-179`.
- The 8 `frictionSuggestion` literals are the verbatim members of `ALL_FRICTION_SUGGESTIONS` in `types.ts:181-190`.
- All enumerated values are quoted in the same `"double quotes"` style the example block will use, so the model sees consistent JSON-literal style throughout.
- The "Do not include any blocking, verdict, truth, or winner field." sentence stays in place after the enum lines (so the doctrine prohibition is not lost).
- No new instruction prose introduces a banned token. (`true`, `false`, `correct`, `incorrect`, `right`, `wrong`, `verdict`, `winner`, `loser`, etc. appear only inside the existing "Do not include..." prohibition — same documented-exception arrangement the system prompt already uses.)
- No file-level import is added or removed. `types.ts` is already imported (`ALL_SEMANTIC_CLASSIFIER_IDS` at line 23); the enum literals are inlined as string literals (not generated from the imported arrays) so that the source-scan test in §5.4 can simply `match(/"vertical_chime_branch"/)` etc. Inlining-vs-generating is a tradeoff: inlining keeps the prompt grep-able and the test trivial; generating would risk a future enum addition silently NOT appearing in the prompt. The card chooses inline for visibility, paired with the source-scan parity test.

### 5.2 `supabase/functions/_shared/semanticReferee/seedPrompt.ts` — add the worked example

After the enumerated `instruction`, insert a new `workedExample` text block followed by `buildInputBlock(request)`. The example is framed as "the contract shape; values are NOT prescribed — choose them based on the structural questions" — see §11 for the wording rationale.

The full text block (verbatim — the new test reads this as the canonical source):

```ts
// new block — inserted between `instruction` and the existing return value
const workedExample = [
  'Worked example of the packet shape (the values below are illustrative —',
  'choose your own values based on the structural questions; do not copy these',
  'verbatim):',
  '```json',
  '{',
  '  "binaries": [',
  '    {',
  '      "classifierId": "responds_to_parent",',
  '      "value": 1,',
  '      "confidence": "high",',
  '      "reasonCode": "parent_continuity_engaged"',
  '    }',
  '  ],',
  '  "routeSuggestion": "mainline",',
  '  "frictionSuggestion": "none",',
  '  "scoreHints": {',
  '    "continuityCredit": 2,',
  '    "evidencePressure": 1,',
  '    "branchHygiene": 1,',
  '    "synthesisReadiness": 0,',
  '    "sourceChainDebt": 0,',
  '    "unresolvedRedirectRisk": 0',
  '  }',
  '}',
  '```',
].join('\n');

return [
  'Structural questions for this move:',
  questionLines.join('\n'),
  '',
  instruction,
  '',
  workedExample,
  '',
  buildInputBlock(request),
].join('\n');
```

Concrete safe-value justifications (each must hold):

| Field | Value | Why safe |
|---|---|---|
| `binaries[0].classifierId` | `responds_to_parent` | First member of `ALL_SEMANTIC_CLASSIFIER_IDS` (`types.ts:146`); a real catalog-v0 id; the parity test in `__tests__/semanticAnthropicSeedPromptBanList.test.ts` already permits it. |
| `binaries[0].value` | `1` (integer literal, NOT `true`) | The schema requires `z.union([z.literal(0), z.literal(1)])`. Demonstrating the integer disambiguates a candidate failure mode B2b from SMOKE-FIX-001 §11 ("if `binaries[i].value` is boolean"). |
| `binaries[0].confidence` | `'high'` | One of `low / medium / high`. No bias toward any specific value beyond "this is the high-confidence variant". |
| `binaries[0].reasonCode` | `parent_continuity_engaged` | Starts with the `parent_continuity` family prefix from `REASON_CODE_FAMILIES` (`semanticRefereeTypes.ts:210-219`). `engaged` is not in any ban-list (verdict / person / popularity). Snake_case, lowercase. ≤ `MAX_COPY_FIELD_LEN` (280). |
| `routeSuggestion` | `'mainline'` | The first / most-common route. Frames the example as "stay on the main line" — the most-conservative possible suggestion, not biased toward branching. |
| `frictionSuggestion` | `'none'` | The friction-neutral default. Frames the example as "no friction suggested" — the most-conservative possible suggestion, not biased toward adding friction. |
| `scoreHints.continuityCredit` | `2` | In `0..3`. A mid-range value, not the maximum, so the example doesn't accidentally imply "always cap at 3". |
| `scoreHints.evidencePressure` | `1` | In `0..3`. |
| `scoreHints.branchHygiene` | `1` | In `0..3`. |
| `scoreHints.synthesisReadiness` | `0` | In `0..3`. |
| `scoreHints.sourceChainDebt` | `0` | In `0..3`. |
| `scoreHints.unresolvedRedirectRisk` | `0` | In `0..3`. |

The example block contains:

- ZERO ban-list tokens (`expectClean(workedExample, 'workedExample')` in the existing `semanticAnthropicSeedPromptBanList.test.ts` would pass — the parity test in §5.4 asserts this explicitly to make the constraint testable from source alone).
- ZERO secret-shaped substrings (no `sk-ant-…`, no `xai-…`, no `sb_secret_…`, no JWT-shape, no Bearer literal, no Authorization literal, no `@<handle>` token, no `https://` URL, no email-shape).
- ZERO chain-of-thought / off-contract keys (`reasoning`, `analysis`, `block`, `gate`, `message`, `system_prompt`).

The framing prose ("the values below are illustrative — choose your own values based on the structural questions; do not copy these verbatim") is what mitigates Risk A in §11 — it tells the model the example is a SHAPE demonstration, not a value prescription.

### 5.3 `supabase/functions/_shared/semanticReferee/seedPrompt.ts` — version bump

```ts
// before (line 31)
export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v0';
// after
export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v1';
```

The file's own header comment at lines 27-30 says this:

> The prompt-version string the packet is stamped with. Matches MCP-002's `promptVersion` and MCP-016's `MOCK_PROMPT_VERSION` — a wording change to any question bumps this to `-v1` and invalidates the upstream cache.

A worded change to the instruction prose AND the addition of a new worked-example block are both wording changes; both qualify. The bump is required (not optional) and tests in §5.4 assert the value.

### 5.4 New test — `__tests__/semanticRefereeSeedPromptEnumCoverage.test.ts`

A source-scan test mirroring the posture of `__tests__/semanticRefereeActorRoleParity.test.ts` (the SMOKE-FIX-001 parity test) — reads `seedPrompt.ts` as text, runs five `expect` blocks.

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ALL_ROUTE_SUGGESTIONS,
  ALL_FRICTION_SUGGESTIONS,
} from '../src/features/semanticReferee/semanticRefereeTypes';

const REPO_ROOT = path.resolve(__dirname, '..');
const SEED_PROMPT_PATH = path.join(
  REPO_ROOT,
  'supabase/functions/_shared/semanticReferee/seedPrompt.ts',
);

/** Ban-list mirror of `semanticAnthropicSeedPromptBanList.test.ts`. */
const BANNED_TOKENS: readonly string[] = [
  'winner', 'loser', 'won', 'lost', 'right', 'wrong',
  'true', 'false', 'correct', 'incorrect', 'verdict',
  'proven', 'disproven', 'defeated', 'popular', 'unpopular',
  'liar', 'lying', 'dishonest',
];
const BANNED_PHRASES: readonly string[] = ['bad faith'];

/** Secret / handle / URL shapes — assembled at runtime so this test file is grep-clean. */
const SHAPE_PATTERNS: readonly RegExp[] = [
  /@[A-Za-z0-9_]{1,15}\b/,
  /\bhttps?:\/\/\S+/i,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  new RegExp('sk-' + 'ant-' + '[A-Za-z0-9_-]{4,}', 'i'),
  /\bBearer\s+[A-Za-z0-9._-]{8,}/,
];

describe('SMOKE-FIX-002 — seed-prompt enum coverage', () => {
  const src = fs.readFileSync(SEED_PROMPT_PATH, 'utf8');

  it('SEED_PROMPT_VERSION is bumped to v1', () => {
    expect(src).toContain(
      "export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v1';",
    );
    expect(src).not.toContain(
      "export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v0';",
    );
  });

  it('every SemanticRouteSuggestion enum value appears in the prompt source', () => {
    for (const value of ALL_ROUTE_SUGGESTIONS) {
      // Must appear at least once as a double-quoted JSON literal in the prompt body.
      expect(src).toContain(`"${value}"`);
    }
  });

  it('every SemanticFrictionSuggestion enum value appears in the prompt source', () => {
    for (const value of ALL_FRICTION_SUGGESTIONS) {
      expect(src).toContain(`"${value}"`);
    }
  });

  it('the worked-example block is present and shape-complete', () => {
    // The block opens with the framing sentence so the test pins both the
    // disclaimer AND the JSON shape.
    expect(src).toMatch(/Worked example of the packet shape/);
    // All six scoreHints field names appear inside the block. (We assert
    // their presence, not their values — a different `1` vs `2` swap should
    // not break this test.)
    expect(src).toContain('"continuityCredit"');
    expect(src).toContain('"evidencePressure"');
    expect(src).toContain('"branchHygiene"');
    expect(src).toContain('"synthesisReadiness"');
    expect(src).toContain('"sourceChainDebt"');
    expect(src).toContain('"unresolvedRedirectRisk"');
    // The example uses an integer `1` literal for `value`, not the JSON
    // boolean `true` — disambiguates from candidate failure mode B2b.
    expect(src).toMatch(/"value":\s*1\b/);
    // The example's reasonCode starts with a real REASON_CODE_FAMILIES prefix.
    expect(src).toContain('parent_continuity_engaged');
  });

  it('the prompt source carries no banned token / phrase / shape outside the documented prohibitions', () => {
    // The existing prohibition sentence ("Do not include any blocking,
    // verdict, truth, or winner field.") legitimately names verdict /
    // truth / winner — those are the EXPLICIT prohibitions and are the
    // same documented exception the system prompt already uses. So we
    // strip the prohibition sentence before the per-segment scan.
    //
    // Approach: assert the banned tokens never appear OUTSIDE a "Do not"
    // / "MUST NOT" / "must not" sentence. The simplest robust check is to
    // remove every sentence containing "Do not" or "do not" and then scan
    // what is left.
    const stripped = src
      .split('\n')
      .filter((line) => !/do not/i.test(line))
      .join('\n');
    const lower = stripped.toLowerCase();
    for (const token of BANNED_TOKENS) {
      // Word-boundary match against the lower-cased stripped source.
      expect(lower).not.toMatch(new RegExp('\\b' + token + '\\b'));
    }
    for (const phrase of BANNED_PHRASES) {
      expect(lower).not.toContain(phrase);
    }
    for (const pattern of SHAPE_PATTERNS) {
      expect(pattern.test(src)).toBe(false);
    }
  });
});
```

Notes on the test:

- It is a SOURCE-SCAN, not a Deno import — `seedPrompt.ts` is zero-`npm:`-import already (so Jest CAN import it via the existing `_helpers/semanticRefereeDeno.ts` bridge), but the test deliberately reads the source as text so a future move of the literal into a generated form is caught.
- The ban-list scan deliberately strips lines containing `do not` before the per-segment match, because the existing prohibition sentence "Do not include any blocking, verdict, truth, or winner field." legitimately names ban-list tokens for prohibition purposes — same documented arrangement as the existing `semanticAnthropicSeedPromptBanList.test.ts` invariant 2. The stripping is conservative: any future doctrine sentence using `do not …` is also exempted, but doctrine sentences are vetted by the existing system-prompt test.
- The five `expect` blocks are independent; a single failure points the implementer at exactly one missing piece.
- The test imports `ALL_ROUTE_SUGGESTIONS` and `ALL_FRICTION_SUGGESTIONS` from `src/features/semanticReferee/semanticRefereeTypes.ts` (the Node-side mirror of `types.ts`) — those are the canonical Node-side arrays already used by the trigger gates and validator. The existing `__tests__/semanticDenoNodeParity.test.ts` already enforces that the Deno-side `ALL_ROUTE_SUGGESTIONS` / `ALL_FRICTION_SUGGESTIONS` arrays match the Node-side ones, so we have one source of truth for the test to read.
- The test runs against pure Node files — no Deno requirement, no `npm:` resolver.

### 5.5 `docs/core/current-status.md` — 3-line footnote

Appended under the Stage 6.4 line:

```
**SMOKE-FIX-002 follow-up (2026-05-23, post-redeploy v39):** the seed prompt is now `mcp-semantic-referee-prompt-v1` — it
enumerates the 7 `routeSuggestion` and 8 `frictionSuggestion` enum values inline and carries a one-shot worked example with
ban-list-clean concrete values. After Supabase auto-redeploys on merge, the smoke test re-run is the acceptance check.
See `docs/designs/SMOKE-FIX-002.md`.
```

No status change. Stage 6.4 stays current.

---

## 6. Deployment plan (operator action only)

This card writes code, tests, and a doc footnote. Deployment is the operator's action — but the operator's action is now AUTOMATED via the Supabase GitHub integration.

Per the user-memory note (`supabase-merge-autodeploy.md`): the Supabase GitHub integration auto-applies migrations + redeploys Edge Functions on merge to `main`. SMOKE-FIX-002 introduces no migration and edits a `_shared/` file consumed by `semantic-referee`. On merge:

1. The GitHub integration redeploys `semantic-referee` automatically. Expected version bump: `39 → 40` (the next monotonic version in the Supabase deployment timeline).
2. The redeploy picks up:
   - the enumerated `routeSuggestion` + `frictionSuggestion` lists in `buildClassifierPrompt`;
   - the worked-example block;
   - the bumped `SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v1'` stamp.
3. Cache behavior: the in-memory `SemanticPacketCache` in `src/features/semanticReferee/semanticCache.ts` keys on `promptVersion` (`semanticCache.ts:16 — Invalidation happens only by a promptVersion bump changing the key`). The v0 → v1 bump means current cache entries miss; the next classify call hits the live provider, gets the v1 packet, and stores it under the v1 key. No persisted state is affected (the cache is purely in-memory per warm Edge instance). See §11 Risk B.

Operator post-deploy action (manual, not a CI step):

1. Confirm the auto-redeploy landed (Supabase Studio → Edge Functions → `semantic-referee` → version `40` shown live).
2. Re-run the smoke test: `node scripts/bot-fixtures/runMcpSmokeTest.js`.
3. Capture the run-log under `logs/mcp-smoke-test/<runId>.json` (gitignored; operator attaches relevant portions to issue #240 if needed).
4. Acceptance: move 1's two batches succeed (unchanged from post-SMOKE-FIX-001); move 2's two batches AND the post-flip probe now produce `ok: true, enabled: true, packet: { ... }` — i.e., the Anthropic response passes both the outbound schema AND the content-safety scanner.
5. If `validation_failed` persists, the new `console.warn` diagnostic (SMOKE-FIX-001 Fix B1 — untouched in this card) names the new `layer / path / detail / inputHash`. The follow-up is SMOKE-FIX-003 (see §12).

No manual `supabase functions deploy` command is required. No migration. No admin runtime-config change. No secret change. The runtime config stays `providerMode: 'anthropic', enabled: true` exactly as the prior smoke-test runs recorded.

---

## 7. Rollback plan

Three reversible levels, in order of escalating action — identical structure to SMOKE-FIX-001's rollback:

1. **Code rollback** (default): revert the SMOKE-FIX-002 merge commit. The prompt reverts to v0 wording (no enumerated values, no worked example), `SEED_PROMPT_VERSION` returns to `'mcp-semantic-referee-prompt-v0'`, and the in-memory caches re-invalidate cleanly on the second version-change. The system returns to the post-SMOKE-FIX-001 state — degraded but stable, with `validation_failed` continuing to fire on the `["routeSuggestion"]` path and SMOKE-FIX-001's diagnostic lines continuing to report it.
2. **Deploy rollback** (if step 1 isn't enough — e.g. the redeploy is what introduced an issue): redeploy from a pre-SMOKE-FIX-002 commit. The Supabase GitHub integration will redeploy automatically once the revert lands on `main`; the operator can ALSO pin to deployment version `39` via the Supabase dashboard if Supabase keeps both versions live.
3. **Provider flip** (escape hatch if both above leave the system worse than degraded): the admin UI's `set_semantic_config` action flips `providerMode` from `'anthropic'` to `'mock'`. This stops every live Anthropic call instantly; users continue to see the deterministic layer-1 fallback. This is the same flip the smoke test exercises and the propagation is sub-3-seconds (the prior smoke-test runs recorded `propagationMs: 2391`).

Nothing this card lands can make the system "worse than degraded." The prompt is purely a wording change; it cannot loosen the outbound schema, cannot widen what is accepted, cannot break a previously-passing call. If the prompt happens to be WORSE than v0 for some reason (it shouldn't — it's strictly more specific), the system still reaches `validation_failed` at the same outbound wall and the user still sees the layer-1 fallback. No user-visible behavior change beyond "live classify starts working again, when it previously didn't."

---

## 8. Test plan

### 8.1 Required passing CI commands

- `npm run typecheck` — no `any`, no new untyped surface. (The new test file uses only typed Node `fs` + `path` + the existing Node-side `ALL_ROUTE_SUGGESTIONS` / `ALL_FRICTION_SUGGESTIONS` arrays.)
- `npm run lint` — no new lint warnings.
- `npm run test` — all existing tests pass; the new test in §5.4 is added to the suite.

### 8.2 Required new tests

- `__tests__/semanticRefereeSeedPromptEnumCoverage.test.ts` (§5.4) — five `expect` blocks: bumped version literal present; every `SemanticRouteSuggestion` value present as a JSON literal; every `SemanticFrictionSuggestion` value present as a JSON literal; worked-example block present with all six `scoreHints` field names and an integer `1` `value` literal; ban-list-clean outside the documented prohibitions.

### 8.3 Tests that MUST continue passing without edit

- `__tests__/semanticAnthropicSeedPromptBanList.test.ts` — the existing source-scan test that asserts no banned token appears in any classifier question or in the system prompt. The worked example is INSIDE `buildClassifierPrompt`'s user-message string. The test as written scans the question dictionary AND a full assembled prompt for handle / URL / secret shapes (invariant 2c, lines 166-177). The worked example must not break this — the §5.4 test additionally asserts the worked-example block is ban-list-clean, providing belt-and-suspenders.
- `__tests__/semanticDenoNodeParity.test.ts` — asserts the Deno-side and Node-side `ALL_ROUTE_SUGGESTIONS` / `ALL_FRICTION_SUGGESTIONS` arrays match. This card does NOT touch either side's array, so the test continues to pass unchanged.
- `__tests__/semanticPacketSchema.test.ts`, `__tests__/semanticAnthropicCore.test.ts`, `__tests__/semanticAnthropicContentScan.test.ts`, `__tests__/semanticAnthropicSourceScan.test.ts`, `__tests__/semanticRefereeActorRoleParity.test.ts`, `__tests__/semanticAnthropicValidationLogShape.test.ts` — none touch `seedPrompt.ts`'s instruction prose; all continue to pass.
- `__tests__/semanticCache.test.ts`, `__tests__/semanticRefereeCacheKey.test.ts` — the cache-key derivation does not depend on the literal version string; it embeds whatever `promptVersion` it is handed. A v0 → v1 bump changes the derived key (so cache entries miss) but the test's assertions are about key-derivation behavior, not the literal version string. The test continues to pass.

### 8.4 Hard acceptance criterion — smoke-test re-run

After the operator confirms the auto-redeploy (Supabase Studio shows `semantic-referee` deployment version `40` live), running `node scripts/bot-fixtures/runMcpSmokeTest.js` MUST produce a new run-log file under `logs/mcp-smoke-test/` in which:

- Move 1's two batches each return `ok: true, enabled: true, packet: { ... }`. (Unchanged from post-SMOKE-FIX-001 baseline.)
- Move 2's two batches each return `ok: true, enabled: true, packet: { ... }`. The packet's `routeSuggestion` is in `ALL_ROUTE_SUGGESTIONS`; `frictionSuggestion` is in `ALL_FRICTION_SUGGESTIONS`; all `scoreHints` integers are in `0..3`; `packetVersion === 'mcp-semantic-referee-v0'`; `promptVersion === 'mcp-semantic-referee-prompt-v1'`; `provider === 'anthropic'`.
- The post-flip probe returns `ok: true, enabled: true, packet: { ... }` with the same packet-shape constraints.
- The Supabase Studio function logs for `semantic-referee` contain ZERO new `console.warn` entries of the SMOKE-FIX-001 `semanticReferee: 'validation_failed'` shape during the run window. (If they contain any, the cause is named — file SMOKE-FIX-003.)

The smoke-test re-run is a manual operator step — the card design treats the re-run output as the acceptance check, NOT as part of CI. The card is "ready to close" when the new test passes, the typecheck + lint + test trio is green, the function auto-redeploys, and the new run log matches the criterion above.

### 8.5 What this card does NOT test

- It does not add an integration test against a real Anthropic call. No live API call from CI; the existing source-scan posture is enforced.
- It does not assert the model's behavior under v1 — it only asserts the prompt CONTAINS the values the schema requires. Whether the model uses them correctly is the smoke-test re-run's job.
- It does not test the cache invalidation path explicitly (the existing `semanticCache.test.ts` covers this for any prompt-version change; SMOKE-FIX-002 inherits that coverage).

---

## 9. Acceptance criteria (checkbox set for the GitHub issue)

- [ ] `supabase/functions/_shared/semanticReferee/seedPrompt.ts`'s `buildClassifierPrompt` user-message instruction enumerates the 7 `routeSuggestion` enum values (`mainline`, `vertical_chime_branch`, `diagonal_tangent`, `outer_realm`, `cards_detail`, `synthesis_lane`, `no_route_change`) and the 8 `frictionSuggestion` enum values (`none`, `soft_chip`, `pre_send_pause`, `ask_for_quote`, `ask_for_source`, `suggest_branch`, `suggest_narrow`, `cooldown_notice`) inline as double-quoted JSON literals.
- [ ] The same file contains a worked-example block introduced by "Worked example of the packet shape" with a framing sentence stating the values are illustrative, a JSON object with one `binaries[]` entry (`classifierId: "responds_to_parent"`, `value: 1`, `confidence: "high"`, `reasonCode: "parent_continuity_engaged"`), `routeSuggestion: "mainline"`, `frictionSuggestion: "none"`, and all six `scoreHints` integer fields in `0..3` (`continuityCredit: 2, evidencePressure: 1, branchHygiene: 1, synthesisReadiness: 0, sourceChainDebt: 0, unresolvedRedirectRisk: 0`).
- [ ] `SEED_PROMPT_VERSION` is `'mcp-semantic-referee-prompt-v1'`.
- [ ] `__tests__/semanticRefereeSeedPromptEnumCoverage.test.ts` exists, source-scans `seedPrompt.ts`, and passes all five `expect` blocks: bumped version literal, every `routeSuggestion` value present, every `frictionSuggestion` value present, worked-example shape complete, ban-list-clean outside documented prohibitions.
- [ ] `__tests__/semanticAnthropicSeedPromptBanList.test.ts` continues to pass without edit (the worked example introduces no banned token).
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] No change to `src/features/`, `src/lib/edgeFunctions.ts`, `supabase/functions/_shared/semanticReferee/schema.ts`, `supabase/functions/_shared/semanticReferee/anthropicProvider.ts`, `supabase/functions/_shared/semanticReferee/contentSafetyScan.ts`, `supabase/functions/_shared/semanticReferee/mockProvider.ts`, `supabase/functions/_shared/semanticReferee/mcpAdapter.ts`, or any migration.
- [ ] No change to `PACKET_VERSION`, `ClassifyMoveDisabledReason`, `SemanticActorRole`, or any catalog-v0 classifier id.
- [ ] No change to SMOKE-FIX-001's diagnostic `console.warn` lines in `anthropicProvider.ts`. They stay (they are the named-cause feedback channel for SMOKE-FIX-003 if needed).
- [ ] `docs/core/current-status.md` carries a 3-line footnote naming the v0 → v1 bump and pointing to this design.
- [ ] After Supabase auto-redeploy + operator smoke-test re-run: move 1, move 2, and the post-flip probe each return `enabled: true` packets satisfying the outbound `SemanticRefereePacketSchema` (no `validation_failed` shapes recorded in the function logs for the run window).

---

## 10. Risks and open questions

### Risks (two named explicitly; see §10.A and §10.B)

**Risk A — does the worked example accidentally bias the model toward `mainline` / `none` for every move?**

The worked example uses `routeSuggestion: "mainline"` and `frictionSuggestion: "none"` because those are the two MOST CONSERVATIVE values in the respective enums — "stay on the main line" and "no friction suggested" are exactly the no-action defaults. A naive model could read "the example uses `mainline`, so I should always emit `mainline`" and degrade routing diversity.

Mitigation:

- The example is framed by the immediately-preceding sentence: "**the values below are illustrative — choose your own values based on the structural questions; do not copy these verbatim**". This wording follows the same posture as the doctrine prohibition that already sits in the user message ("Do not include any blocking, verdict, truth, or winner field.") — the model has empirical evidence (from the SMOKE-FIX-001 re-run's successful move 1 calls) that it RESPECTS doctrine prohibitions when they are explicit.
- The structural questions (`questionLines`) appear ABOVE the example, so the per-classifier decision context is anchored before the model sees the example.
- The example demonstrates a CONCESSION-STYLE move (`responds_to_parent: 1`, `parent_continuity_engaged`, `routeSuggestion: "mainline"`) — the canonical "stay on the main line, engaged with the parent" pattern. This is the safest possible example to show, not a routing-ambiguous move that would tempt the model to copy the routing choice. A routing-ambiguous example (e.g. `value: 0` with `routeSuggestion: "diagonal_tangent"`) WOULD risk biasing routing decisions; the chosen pattern does not.
- The smoke-test re-run is the empirical check. If the post-deploy run shows `routeSuggestion: "mainline"` in every packet — including ones where the structural questions clearly indicate `vertical_chime_branch` or `diagonal_tangent` — that's the named cause for a follow-up tightening (probably SMOKE-FIX-003 with a multi-example pattern).

**Risk B — does bumping `SEED_PROMPT_VERSION` to `v1` invalidate any cache that callers depend on?**

The only consumer that hashes prompt-version is the `SemanticPacketCache` in `src/features/semanticReferee/semanticCache.ts`. From its file header (lines 14-17):

> LRU is a MEMORY bound, not a correctness mechanism and not invalidation. An evicted entry simply causes a future re-classification (a cost, not a wrong answer). There is NO time-based TTL. `lruTick` orders accesses; it is never compared against a clock. Invalidation happens only by a `promptVersion` bump changing the key — the store has no `expire` method by design.

A `v0 → v1` bump means existing in-memory cache entries derive a different key on lookup and miss; the next classify call hits the live provider, gets the v1 packet, and stores it under the v1 key. No persisted state is affected (the cache is purely in-memory per warm Edge instance — `DEFAULT_CACHE_CAPACITY = 256` entries per warm instance). The miss is a one-time cost per cache; subsequent calls on the same body hit the cache normally. This is the SAME invalidation contract the prior `v0` bump already exercised — operating exactly per design.

The only downstream consumers of `promptVersion` other than the cache are:

- `SemanticRefereePacket.promptVersion` — stamped onto every packet. Consumers (`src/features/arguments/useSemanticReferee.ts`) read it for telemetry / display but never branch on its exact value. The bump is transparent to them.
- The Deno-side `MOCK_PROMPT_VERSION` in `mockProvider.ts` — independent constant for the mock provider; this card does NOT modify it (mock provider is out of scope).
- Test fixtures referencing the v0 string by literal — none found in `__tests__/` other than the existing `semanticCache.test.ts` cache-key derivation (which embeds whatever `promptVersion` it is handed and does not compare to a literal); no test asserts `SEED_PROMPT_VERSION === 'mcp-semantic-referee-prompt-v0'`.

Net: cache misses for ~256 entries per warm instance on first deploy, then steady-state. Zero correctness risk. No persisted state.

### Open questions (each has a recommendation; flag any disagreement during review)

- **Should the enumerated values appear ONCE (in the instruction prose) or TWICE (in the instruction prose AND in the worked example)?** Recommendation: BOTH. The instruction prose lists them as PROSE; the worked example demonstrates one each in JSON CONTEXT. This is the same pattern the existing prompt uses for `binaries[]` (named in the prose; demonstrated in the example). Naming them only in the prose risks the model reading "a routeSuggestion" as "any string"; demonstrating them only in the example risks the model treating the example values as the only allowed values. Both together is the belt-and-suspenders posture.
- **Should the worked example show MULTIPLE `binaries[]` entries to demonstrate the array shape?** Recommendation: SINGLE entry. The model has the per-classifier question list right above it, so the array shape is already grounded. Multiple entries would expand the example without adding constraint coverage. If a future failure names `binaries[]`-as-empty-array as a cause, SMOKE-FIX-003 can broaden the example.
- **Should the worked example use a non-conservative routing choice (e.g. `vertical_chime_branch` + `suggest_branch`) to demonstrate that branching is allowed?** Recommendation: NO. See Risk A above. The conservative `mainline` + `none` pair is the safest example to show first; if routing diversity becomes a measured problem in the post-deploy data, a multi-example expansion ships as a separate card.
- **Should the example fence be a fenced JSON code block (`\`\`\`json`)?** Recommendation: YES. Models trained on markdown documentation respect fenced code blocks; the fence helps the model distinguish "this is example JSON" from "this is the JSON I should return". The post-instruction text already says "no markdown, no code fence" in the output — the example's fence is in the INPUT only, not what the model should emit.
- **Should the new test source-scan `seedPrompt.ts` directly OR import the assembled prompt via the Jest bridge?** Recommendation: SOURCE-SCAN. The bridge is fine for prompt-shape tests, but the §5.4 test specifically wants to assert "this literal appears in the source text" — a source-scan is the right tool. Bridge-importing would lose the per-line position information that makes future drift easier to diagnose.

---

## 11. Cache-and-version coherence note (for the implementer)

The prompt-version bump propagates as follows:

1. `seedPrompt.ts` exports `SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v1'`.
2. `anthropicProvider.ts` stamps it onto every successful packet at the `promptVersion` field (see `anthropicProvider.ts:92-94` — the existing stamp site; this card does not touch it).
3. The Edge-Function response carries the stamped `promptVersion: 'mcp-semantic-referee-prompt-v1'` to the caller.
4. `src/features/semanticReferee/semanticRefereeCacheKey.ts` derives the cache key including `promptVersion`; the `v1` packet hashes to a different key than any `v0` packet.
5. The `SemanticPacketCache` in `src/features/semanticReferee/semanticCache.ts` stores `v1` packets under `v1` keys. Existing `v0` entries are evicted on next-LRU-fill or simply miss on lookup; the cache is in-memory per warm Edge instance, so there is no cross-restart consistency concern.

The implementer does NOT need to touch any cache code. The bump propagates through existing infrastructure. The version bump is the ONLY cache-related action this card takes.

---

## 12. Follow-ups (NOT part of this card)

- **SMOKE-FIX-003 — same-shape follow-up for `frictionSuggestion` or `scoreHints`.** If the post-SMOKE-FIX-002 smoke-test re-run still produces `validation_failed` entries with `layer: 'schema'` AND `path: ["frictionSuggestion"]` OR `path: ["scoreHints", …]`, file SMOKE-FIX-003 with the same shape as this card: name the cause from SMOKE-FIX-001's diagnostic line; pick the narrowest applicable B2* option from SMOKE-FIX-001 §11; ship the prompt edit (or coercion step if the failure mode is `binaries[i].value` being boolean — that's option B2b); bump `SEED_PROMPT_VERSION` to `v2`; re-run the smoke test. The frame is repeatable.
- **Modularity slate** (separate roadmap track, independent of SMOKE-FIX-001/002/003) — documentation reorg, classifier-catalog inventory, prompt-template inventory, source-of-truth extraction, prompt-template refactor, banner/ledger refactor, move-position tracking, and the move-position-aware triggering rule. Proceeds in its own dependency order.
- **Anthropic-side schema-conformance tuning** — if the model continues to drift on routine fields after multiple SMOKE-FIX-* iterations, the next card switches strategy from "make the prompt more specific" to "wrap the call in `tool_use` with a fixed schema" (Anthropic's structured-output mode). That is a larger surface change with its own design and is NOT in scope for SMOKE-FIX-002. Filed as a candidate when SMOKE-FIX-003+ have exhausted prompt-only fixes.

---

## 13. Implementer note (2026-05-22)

Two small spec gaps surfaced during implementation. Both have minimal,
narrowly-scoped fixes that respect the design's binding intent.

**§8.3 vs §5.3 — `semanticAnthropicCore.test.ts` v0 literal.** §8.3 states:
"no test asserts `SEED_PROMPT_VERSION === 'mcp-semantic-referee-prompt-v0'`."
That statement is incorrect — `__tests__/semanticAnthropicCore.test.ts:161`
contains exactly that assertion. §5.3 says the bump is required (and the
file's own header comment at lines 26-31 documents the rule). The §5.3
intent is binding; the §8.3 statement was a factual error. The
implementer updated the one-line literal in that pre-existing test to
match the new v1 string. No other test required an edit. This is a
one-line follow-on consequence of §5.3 that §8.3 omitted; it does not
expand the card's scope and does not redesign anything.

**§5.4 strip filter — JSDoc-block doctrine prohibition.** §5.4's example
test strips lines matching `/do not/i` before the per-segment ban-list
scan. The file's own JSDoc doctrine block at `seedPrompt.ts:10-14` carries
a wrapped multi-line prohibition sentence using the "NO question asks the
model whether anything is true, correct, right, wrong, ..." form — the
banned tokens appear on the WRAPPED CONTINUATION LINES, not on the line
with the prohibition marker itself. The `/do not/i` filter alone leaves
those wrapped-continuation lines exposed and fails the scan. Per the
design's stated intent ("the banned tokens never appear OUTSIDE a 'Do
not' / 'MUST NOT' / 'must not' sentence" — the broader prohibition
concept, not the literal substring), the implementer extended the
stripping to ALSO remove JSDoc block comments wholesale (`/\*\* ... \*/`)
before the per-segment scan. JSDoc blocks are developer documentation
that never leaves the source file and never reaches the model. The scan
still catches banned tokens in the executable string literals (the
instruction prose, the worked example, the per-classifier questions, the
input block) — which is the load-bearing safety the design intends.
