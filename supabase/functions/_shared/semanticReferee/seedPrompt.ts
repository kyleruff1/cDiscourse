/**
 * MCP-017 — Semantic referee live-provider seed prompt (zod-free).
 *
 * The canonical structured prompt template for the live Anthropic provider.
 * Carries one bounded STRUCTURAL yes/no question for every one of the 23
 * catalog-v0 classifier ids frozen in `types.ts` (`ALL_SEMANTIC_CLASSIFIER_IDS`).
 * Each question is the catalog-v0 condensation of the corresponding family in
 * the MCP-002 seed bank (`docs/semantic-prompts/mcp-semantic-referee-prompt-bank.md`).
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
 * This file is PURE TYPESCRIPT — it imports only `types.ts`. Zero `npm:`
 * imports, so the `_helpers/semanticRefereeDeno.ts` Jest bridge can `require()`
 * it directly.
 */
import { ALL_SEMANTIC_CLASSIFIER_IDS } from './types.ts';
import type { ClassifyMoveRequest, SemanticClassifierId } from './types.ts';

/**
 * The prompt-version string the packet is stamped with. Matches MCP-002's
 * `promptVersion` and MCP-016's `MOCK_PROMPT_VERSION` — a wording change to any
 * question bumps this to `-v1` and invalidates the upstream cache.
 */
export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v0';

/**
 * One bounded STRUCTURAL yes/no question for each catalog-v0 classifier id.
 * The model answers each with `0` or `1`. The question describes the move, not
 * the person; it asks a structural / play-quality question, never a truth one.
 *
 * Keyed by every `SemanticClassifierId` — the mirror test fails the build if a
 * future catalog change adds an id without a question here, or adds an extra
 * key not in the catalog.
 */
export const CLASSIFIER_QUESTION_TEXT: Readonly<Record<SemanticClassifierId, string>> = {
  // §A — parent continuity.
  responds_to_parent:
    "Does this move directly engage the parent's claim, mechanism, question, evidence, or requested clarification?",
  introduces_new_issue:
    'Does this move raise a new issue that could be debated separately from the parent?',
  quote_anchors_parent:
    'Does this move quote or paraphrase a span of the parent and then engage that span in its body?',
  requests_clarification:
    'Does this move ask what the other participant means by a term or statement?',
  answers_clarification:
    'Does this move answer a clarification request raised earlier in the thread?',
  // §C — evidence and source chain.
  asks_for_evidence:
    'Does this move request a source, citation, primary source, receipt, or exact quote?',
  provides_evidence:
    'Does this move include or reference an attached source, excerpt, quotation, or record?',
  evidence_supports_claim:
    'Does the attached evidence appear to attach to the exact claim being made in this move?',
  uses_popularity_as_evidence:
    "Does this move use likes, shares, virality, or an \"everyone says\" appeal as evidentiary support?",
  uses_satire_as_evidence:
    'Does this move use satire, parody, a meme, or fiction as factual support for a claim?',
  cites_retraction:
    'Does this move cite a retraction, correction, update, or changed record?',
  creates_source_chain_gap:
    'Does this move leave a gap in the source trail — a missing origin, quote, context, or link?',
  // §D — constructive movement.
  narrows_claim:
    'Does this move limit a broader claim to a more specific, more defensible scope?',
  concedes_narrow_point:
    'Does this move accept a specific, limited point raised by the other participant?',
  ready_for_synthesis:
    'Is there clear shared ground in the thread plus only limited unresolved debt?',
  needs_pre_send_pause:
    'Could this move be tightened by its author before it is sent?',
  // §E — debate-mode fit.
  fits_selected_debate_mode:
    "Does this move's register fit the room's selected debate mode?",
  contains_playable_hot_take:
    'Is this move spicy, contrarian, or provocative while still being a coherent, answerable claim?',
  is_satire_or_parody:
    'Does this move itself read as satire, parody, a meme, or fiction rather than a literal claim?',
  // §B / §G — branch routing and friction.
  suggests_side_branch:
    'Would this move read more cleanly on a same-topic side branch than on the main line?',
  suggests_diagonal_tangent:
    'Does this move step to a related but distinct issue that fits its own tangent branch?',
  shifts_to_person_or_intent:
    'Does this move redirect from the argument toward the other participant or their intent?',
  contains_unplayable_insult_only:
    'Is this move only an insult, with no claim, question, or evidence to engage?',
};

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
    'Do not include any blocking, verdict, truth, or winner field.',
  ].join(' ');

  return [
    'Structural questions for this move:',
    questionLines.join('\n'),
    '',
    instruction,
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
