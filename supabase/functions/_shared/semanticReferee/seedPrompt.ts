/**
 * MCP-017 — Semantic referee live-provider seed prompt (zod-free).
 *
 * The canonical structured prompt template for the live Anthropic provider.
 * Carries one bounded STRUCTURAL yes/no question for every catalog-v0
 * classifier id frozen in `types.ts` (`ALL_SEMANTIC_CLASSIFIER_IDS`).
 *
 * Authority chain (post-MCP-MOD-004):
 *
 *   `semanticClassifierCatalog.ts`  →  `CLASSIFIER_QUESTION_TEXT` (this file)
 *
 * The per-id question text is no longer hand-written here. Every entry in
 * `CLASSIFIER_QUESTION_TEXT` is derived from `SEMANTIC_CLASSIFIER_CATALOG`'s
 * `structuralQuestion` field by iterating the catalog at module load. A
 * wording change is a one-line edit in the catalog and bumps
 * `SEED_PROMPT_VERSION` here.
 *
 * DOCTRINE (cdiscourse-doctrine §1, MCP-001 §7, MCP-017 design §3 rule 5):
 *   - Every question asks about the move's STRUCTURE — parent continuity,
 *     evidence hygiene, branch hygiene, movement, mode fit, friction. NO
 *     question asks the model whether anything is true, correct, right, wrong,
 *     factual, proven, popular, or who is winning.
 *   - `__tests__/semanticAnthropicSeedPromptBanList.test.ts` scans every string
 *     here for the doctrine ban-list vocabulary AND asserts id-coverage parity
 *     with `ALL_SEMANTIC_CLASSIFIER_IDS` (every id, no extra keys).
 *
 * This file is PURE TYPESCRIPT — it imports only `types.ts` and
 * `semanticClassifierCatalog.ts`. Zero `npm:` imports, so the
 * `_helpers/semanticRefereeDeno.ts` Jest bridge can `require()` it directly.
 */
import { ALL_SEMANTIC_CLASSIFIER_IDS } from './types.ts';
import type { ClassifyMoveRequest, SemanticClassifierId } from './types.ts';
import { SEMANTIC_CLASSIFIER_CATALOG } from './semanticClassifierCatalog.ts';

/**
 * The prompt-version string the packet is stamped with. Matches MCP-002's
 * `promptVersion` and MCP-016's `MOCK_PROMPT_VERSION` — a wording change to any
 * question bumps this to `-v1` and invalidates the upstream cache.
 */
export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v1';

/**
 * One bounded STRUCTURAL yes/no question for each catalog-v0 classifier id.
 * The model answers each with `0` or `1`. The question describes the move, not
 * the person; it asks a structural / play-quality question, never a truth one.
 *
 * Derived from `SEMANTIC_CLASSIFIER_CATALOG` — the catalog is the
 * source-of-truth (MCP-MOD-004). Adding or removing an id requires the catalog
 * update (and a `SemanticClassifierId` union edit); editing a question is a
 * one-line catalog edit + a `SEED_PROMPT_VERSION` bump.
 *
 * Keyed by every `SemanticClassifierId` — the mirror test fails the build if a
 * future catalog change adds an id without a catalog entry, or adds an extra
 * key not in the catalog.
 */
export const CLASSIFIER_QUESTION_TEXT: Readonly<Record<SemanticClassifierId, string>> =
  Object.freeze(
    Object.fromEntries(
      SEMANTIC_CLASSIFIER_CATALOG.map((entry) => [entry.id, entry.structuralQuestion]),
    ) as Record<SemanticClassifierId, string>,
  );

/**
 * The redacted-input block: the move + parent bodies + room context the model
 * classifies. Bodies arrive already redacted (`redaction.ts`); this only frames
 * them for the prompt.
 */
function buildInputBlock(request: ClassifyMoveRequest): string {
  const lines: string[] = ['Input to classify:'];
  const ctx = request.roomContext;
  if (ctx.debateMode) lines.push(`Room debate mode: ${ctx.debateMode}`);
  if (ctx.selectedAction) lines.push(`Selected action: ${ctx.selectedAction}`);
  if (ctx.selectedMoveType) lines.push(`Declared move type: ${ctx.selectedMoveType}`);
  if (ctx.side) lines.push(`Participant side: ${ctx.side}`);
  if (ctx.actorRole) lines.push(`Participant role: ${ctx.actorRole}`);
  if (request.parentBodyRedacted !== undefined) {
    lines.push(`Parent move (the move being replied to):\n${request.parentBodyRedacted}`);
  } else {
    lines.push('Parent move: none — this is a root move.');
  }
  lines.push(`Move to classify:\n${request.moveBodyRedacted}`);
  return lines.join('\n');
}

/**
 * Assemble the user-message string for the live provider: the per-id structural
 * question list for `request.requestedClassifiers`, the strict-JSON output
 * instruction, and the redacted input block.
 *
 * Only the requested classifiers' questions are emitted — never others. An
 * unknown / non-catalog id in `requestedClassifiers` is skipped silently (the
 * inbound schema already rejects such a request before the provider runs).
 */
export function buildClassifierPrompt(request: ClassifyMoveRequest): string {
  // De-duplicate while preserving first-seen order; emit only catalog ids.
  const seen = new Set<string>();
  const questionLines: string[] = [];
  for (const id of request.requestedClassifiers) {
    if (seen.has(id)) continue;
    seen.add(id);
    const question = CLASSIFIER_QUESTION_TEXT[id as SemanticClassifierId];
    if (question === undefined) continue;
    questionLines.push(`- ${id}: ${question}`);
  }

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

  // The worked example references one classifier id by NAME in its illustrative
  // JSON body. The id-literal is sourced from the catalog's first entry rather
  // than hardcoded here, so no per-id id-string appears in this file (the
  // source-scan test `seedPromptNoHardcodedClassifierIds.test.ts` enforces it).
  const exampleClassifierId = SEMANTIC_CLASSIFIER_CATALOG[0].id;
  const workedExample = [
    'Worked example of the packet shape (the values below are illustrative —',
    'choose your own values based on the structural questions; do not copy these',
    'verbatim):',
    '```json',
    '{',
    '  "binaries": [',
    '    {',
    `      "classifierId": "${exampleClassifierId}",`,
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
}

/**
 * The catalog ids in declaration order — re-exported so the core / tests do not
 * re-import `types.ts` solely for this.
 */
export const SEED_PROMPT_CLASSIFIER_IDS: readonly SemanticClassifierId[] =
  ALL_SEMANTIC_CLASSIFIER_IDS;
