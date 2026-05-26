/**
 * MCP-SERVER-001 — Mirror of the semantic-referee seed prompt.
 *
 * Mirrors the canonical sources:
 *   - `supabase/functions/_shared/semanticReferee/seedPrompt.ts`
 *     (`buildClassifierPrompt`, `SEED_PROMPT_VERSION`)
 *   - `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts`
 *     (`SEMANTIC_REFEREE_SYSTEM_PROMPT`, `MAX_TOKENS`, `TEMPERATURE`)
 *   - `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts`
 *     (catalog entries the prompt iterates)
 *
 * The MCP server is a separately-deployed artifact, so we COPY the canonical
 * text here rather than import across tree boundaries. A parity test in
 * `tests/seedPromptParity.test.ts` reads BOTH this file and the upstream as
 * source text and fails the build on drift on any of:
 *   - the system-prompt absolute rules
 *   - the 35-id classifier enumeration
 *   - the route + friction enumerations
 *   - the structured-output instruction
 */
import type { ClassifyMoveRequestValue } from './semanticRefereePacketSchema.ts';
import {
  ALL_ROUTE_SUGGESTIONS,
  ALL_FRICTION_SUGGESTIONS,
} from './semanticRefereePacketSchema.ts';

/** Prompt-version string the upstream cache uses. Mirror of seedPrompt.ts:46. */
export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v2';

/** Model token bound — matches anthropicClassifierCore.ts. */
export const MAX_TOKENS = 900;

/** Deterministic decoding. Matches anthropicClassifierCore.ts. */
export const TEMPERATURE = 0;

/**
 * The system-prompt boilerplate — verbatim mirror of
 * `SEMANTIC_REFEREE_SYSTEM_PROMPT` in `anthropicClassifierCore.ts`.
 *
 * DOCTRINE: every absolute rule is load-bearing. A wording change here MUST
 * also update the upstream file and trigger the parity test.
 */
export const SEMANTIC_REFEREE_SYSTEM_PROMPT =
  `You are a CDiscourse semantic classifier for a structured debate application.
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
prompt describes — no prose, no markdown, no chain-of-thought.`;

/**
 * Subset of the catalog the server iterates when assembling the prompt.
 * Mirrors `SEMANTIC_CLASSIFIER_CATALOG` in
 * `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts`.
 *
 * Only the two fields the prompt needs (id, structuralQuestion) are mirrored.
 * The parity test pins the id list and structuralQuestion text against the
 * upstream catalog.
 */
export interface SeedPromptCatalogEntry {
  readonly id: string;
  readonly structuralQuestion: string;
}

export const SEED_PROMPT_CATALOG: readonly SeedPromptCatalogEntry[] = Object.freeze([
  { id: 'responds_to_parent', structuralQuestion: 'Does this move respond to the parent move (rather than introducing a new topic)?' },
  { id: 'introduces_new_issue', structuralQuestion: 'Does this move introduce a new issue not raised by the parent move?' },
  { id: 'asks_for_evidence', structuralQuestion: 'Does this move explicitly ask the parent for evidence?' },
  { id: 'provides_evidence', structuralQuestion: 'Does this move provide evidence, citation, quote, or data?' },
  { id: 'evidence_supports_claim', structuralQuestion: 'If evidence is present, does it structurally support a claim the move makes?' },
  { id: 'quote_anchors_parent', structuralQuestion: 'Does this move quote or anchor a specific span of the parent?' },
  { id: 'narrows_claim', structuralQuestion: 'Does this move narrow a broad claim from the parent or from itself?' },
  { id: 'concedes_narrow_point', structuralQuestion: 'Does this move concede a narrow point while preserving a broader stance?' },
  { id: 'requests_clarification', structuralQuestion: 'Does this move ask for clarification of an ambiguous term or position?' },
  { id: 'answers_clarification', structuralQuestion: 'Does this move answer a prior clarification request?' },
  { id: 'shifts_to_person_or_intent', structuralQuestion: 'Does this move shift focus from the argument to the person or their intent?' },
  { id: 'uses_popularity_as_evidence', structuralQuestion: 'Does this move rely on popularity, engagement, or virality as evidence?' },
  { id: 'contains_playable_hot_take', structuralQuestion: 'Does this move contain a heated phrasing that is still playable as a structural claim?' },
  { id: 'contains_unplayable_insult_only', structuralQuestion: 'Is this move only an insult, with no playable structural claim?' },
  { id: 'is_satire_or_parody', structuralQuestion: 'Is this move framed as satire or parody?' },
  { id: 'uses_satire_as_evidence', structuralQuestion: 'Does this move treat satire or parody output as factual evidence?' },
  { id: 'cites_retraction', structuralQuestion: 'Does this move cite a retraction, correction, or withdrawal?' },
  { id: 'creates_source_chain_gap', structuralQuestion: 'Does this move reference a source without enough origin path to verify it?' },
  { id: 'suggests_side_branch', structuralQuestion: 'Does this move suggest a side branch on the same topic axis?' },
  { id: 'suggests_diagonal_tangent', structuralQuestion: 'Does this move open a diagonal tangent off the current axis?' },
  { id: 'fits_selected_debate_mode', structuralQuestion: "Does this move's structure fit the selected debate mode of the room?" },
  { id: 'needs_pre_send_pause', structuralQuestion: 'Would a pre-send pause for the participant improve the move structurally?' },
  { id: 'ready_for_synthesis', structuralQuestion: 'Does this move signal readiness for synthesis between the participants?' },
  { id: 'disputes_evidence_applicability', structuralQuestion: 'Does this move dispute the applicability of cited evidence to the claim at hand?' },
  { id: 'references_prior_agreement', structuralQuestion: 'Does this move reference a point the participants previously agreed on?' },
  { id: 'provides_temporal_constraint', structuralQuestion: 'Does this move introduce a time-bound qualifier (date range, era, recency)?' },
  { id: 'accepts_partial_with_caveat', structuralQuestion: 'Does this move accept part of the parent claim while adding a structural caveat?' },
  { id: 'provides_alternate_interpretation', structuralQuestion: "Does this move offer an alternate interpretation of the parent's claim or evidence?" },
  { id: 'opens_evidence_debt_marker', structuralQuestion: 'Does this move open a marker that future evidence is owed to settle a sub-claim?' },
  { id: 'closes_evidence_debt_marker', structuralQuestion: 'Does this move close a prior evidence-owed marker with concrete evidence?' },
  { id: 'supplies_corroborating_document', structuralQuestion: 'Does this move supply a corroborating document or named source?' },
  { id: 'introduces_sub_axis', structuralQuestion: 'Does this move introduce a sub-axis that splits the parent argument into narrower threads?' },
  { id: 'concedes_with_new_dispute', structuralQuestion: 'Does this move concede the prior point while introducing a new specific dispute?' },
  { id: 'proposes_settlement_terms', structuralQuestion: 'Does this move propose terms under which the participants could settle this thread?' },
  { id: 'accepts_settlement_terms', structuralQuestion: 'Does this move accept previously proposed settlement terms?' },
]);

function buildInputBlock(request: ClassifyMoveRequestValue): string {
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

export function buildClassifierPrompt(request: ClassifyMoveRequestValue): string {
  const requestedIds = new Set<string>(request.requestedClassifiers);
  const seen = new Set<string>();
  const questionLines: string[] = [];
  for (const entry of SEED_PROMPT_CATALOG) {
    if (!requestedIds.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    questionLines.push(`- ${entry.id}: ${entry.structuralQuestion}`);
  }

  const instruction = [
    'Answer each structural question above with 0 or 1 for the move below.',
    'Return ONLY a single JSON object — no prose, no markdown, no code fence,',
    'no chain-of-thought. The object must conform to the semantic-referee',
    'packet contract: a `binaries` array (one entry per requested classifier,',
    'each with `classifierId`, `value` 0 or 1, `confidence` low/medium/high,',
    'and a lowercase snake_case `reasonCode`), a `routeSuggestion`, a',
    '`frictionSuggestion`, and a `scoreHints` object of six integers 0..3.',
    `\`routeSuggestion\` MUST be exactly one of: ${ALL_ROUTE_SUGGESTIONS.map((v) => `"${v}"`).join(', ')}.`,
    `\`frictionSuggestion\` MUST be exactly one of: ${ALL_FRICTION_SUGGESTIONS.map((v) => `"${v}"`).join(', ')}.`,
    'Do not include any blocking, verdict, truth, or winner field.',
  ].join(' ');

  const exampleClassifierId = SEED_PROMPT_CATALOG[0].id;
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
