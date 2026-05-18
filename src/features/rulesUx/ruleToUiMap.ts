/**
 * RULE-001 — Semantic rule-to-UI map.
 *
 * Single source of truth that maps a rule / semantic axis code (the kind
 * the validator or the engagement-intelligence pipeline emits) to the
 * user-facing TOOL the room UI should surface in response.
 *
 *   source_chain        → Ask for the source
 *   evidence_debt       → Needs receipts
 *   scope               → Narrow the claim
 *   definition          → Define the term
 *   logic               → Challenge the inference
 *   causal              → Challenge the mechanism
 *   anti_amplification  → Popularity is not proof
 *   synthesis_ready     → Offer synthesis
 *
 * Pairs with `toPlainLanguage` in `arguments/gameCopy.ts`:
 *   - `toPlainLanguage(code)` returns a LABEL — "what is this axis?".
 *   - `mapRuleToUiAffordance(code)` returns a TOOL — "what should the
 *     UI suggest the user DO about this axis?".
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI. The map is
 * a frozen `const` so callers cannot mutate it at runtime.
 *
 * NEVER returns:
 *   - raw snake_case codes in user-facing fields (`toolLabel`,
 *     `tooltipHint`, `composerLead`);
 *   - verdict / truth tokens (winner / loser / liar / dishonest /
 *     manipulative / extremist / propagandist / stupid / idiot);
 *   - user labels of any kind (the affordance describes the MOVE, not
 *     the speaker).
 */

// ── Code vocabulary ───────────────────────────────────────────

/**
 * Stable string identifier for a rule axis. New axes MUST be added here
 * and to `RULE_TO_UI_AFFORDANCE` together, in the same commit; tests will
 * fail otherwise.
 */
export type RuleCode =
  | 'source_chain'
  | 'evidence_debt'
  | 'scope'
  | 'definition'
  | 'logic'
  | 'causal'
  | 'anti_amplification'
  | 'synthesis_ready'
  | 'platform_support_warning'
  | 'parent_nonresponsive'
  | 'tangent_shift'
  | 'off_topic'
  | 'weak_topic'
  | 'ad_hominem'
  | 'civility_risk'
  | 'concession_evasion'
  | 'loaded_clarification'
  | 'duplicate';

/**
 * The MOVE category the affordance recommends the user take. Used by
 * composer / quick-action surfaces to pre-select the right tool. None of
 * these claim correctness; they only suggest the SHAPE of the next move.
 */
export type RuleSuggestedMove =
  | 'ask_source'
  | 'request_receipts'
  | 'narrow_scope'
  | 'define_term'
  | 'challenge_inference'
  | 'challenge_mechanism'
  | 'flag_amplification'
  | 'offer_synthesis'
  | 'tighten_relevance'
  | 'restate_neutral'
  | 'cool_tone'
  | 'differentiate'
  | 'await_evidence';

/**
 * Single affordance — what the UI surfaces for a given rule code.
 *
 * Fields are all plain English, suitable for direct rendering. Surfaces
 * that need a shorter label use `toolLabel`; surfaces with room for a
 * sentence of guidance use `tooltipHint`; composers can pre-fill the
 * lead line via `composerLead` (also plain English).
 */
export interface RuleUiAffordance {
  code: RuleCode;
  toolLabel: string;
  tooltipHint: string;
  composerLead: string;
  suggestedMove: RuleSuggestedMove;
}

// ── The map ───────────────────────────────────────────────────

/**
 * The 8 issue-mentioned codes use the exact labels from the RULE-001
 * acceptance text. The additional codes follow the same pattern so any
 * rule axis surfaced by the timeline / sidecar gets a tool, not a raw
 * snake_case token.
 */
export const RULE_TO_UI_AFFORDANCE: Readonly<Record<RuleCode, RuleUiAffordance>> = Object.freeze({
  source_chain: {
    code: 'source_chain',
    toolLabel: 'Ask for the source',
    tooltipHint: 'Ask the speaker to name the primary source for this claim.',
    composerLead: 'What is the primary source for this claim?',
    suggestedMove: 'ask_source',
  },
  evidence_debt: {
    code: 'evidence_debt',
    toolLabel: 'Needs receipts',
    tooltipHint: 'This line is carrying a claim that has not been supported with evidence yet.',
    composerLead: 'Receipts that would support this claim:',
    suggestedMove: 'request_receipts',
  },
  scope: {
    code: 'scope',
    toolLabel: 'Narrow the claim',
    tooltipHint: 'The claim is broader than what the evidence covers. Suggest a tighter version.',
    composerLead: 'A narrower version of this claim that would hold up:',
    suggestedMove: 'narrow_scope',
  },
  definition: {
    code: 'definition',
    toolLabel: 'Define the term',
    tooltipHint: 'The argument hinges on a term that has not been defined.',
    composerLead: 'Pin down the meaning of:',
    suggestedMove: 'define_term',
  },
  logic: {
    code: 'logic',
    toolLabel: 'Challenge the inference',
    tooltipHint: 'The premises may be fine but the step to the conclusion is in question.',
    composerLead: 'The step that does not follow:',
    suggestedMove: 'challenge_inference',
  },
  causal: {
    code: 'causal',
    toolLabel: 'Challenge the mechanism',
    tooltipHint: 'A cause-and-effect claim that needs a mechanism, not just correlation.',
    composerLead: 'The mechanism is:',
    suggestedMove: 'challenge_mechanism',
  },
  anti_amplification: {
    code: 'anti_amplification',
    toolLabel: 'Popularity is not proof',
    tooltipHint: 'This line is amplified but not evidenced. Engagement does not equal support.',
    composerLead: 'Beyond reach, what is the evidence?',
    suggestedMove: 'flag_amplification',
  },
  synthesis_ready: {
    code: 'synthesis_ready',
    toolLabel: 'Offer synthesis',
    tooltipHint: 'The two sides have narrowed enough that a combined statement may capture both.',
    composerLead: 'Combined statement that both sides could accept:',
    suggestedMove: 'offer_synthesis',
  },
  platform_support_warning: {
    code: 'platform_support_warning',
    toolLabel: 'Hold off on scoring',
    tooltipHint: 'This line should not gain factual standing until evidence arrives.',
    composerLead: 'Evidence that would let this be scored:',
    suggestedMove: 'await_evidence',
  },
  parent_nonresponsive: {
    code: 'parent_nonresponsive',
    toolLabel: 'Tie it to the parent',
    tooltipHint: 'The reply does not engage with the parent. Connect them.',
    composerLead: 'How this responds to the parent:',
    suggestedMove: 'tighten_relevance',
  },
  tangent_shift: {
    code: 'tangent_shift',
    toolLabel: 'Branch this off',
    tooltipHint: 'The thread has shifted enough that a branch reads cleaner than a reply.',
    composerLead: 'Branch title for the side discussion:',
    suggestedMove: 'tighten_relevance',
  },
  off_topic: {
    code: 'off_topic',
    toolLabel: 'Bring it back on topic',
    tooltipHint: 'The reply is not engaging the resolution. Reframe or branch.',
    composerLead: 'How this connects to the resolution:',
    suggestedMove: 'tighten_relevance',
  },
  weak_topic: {
    code: 'weak_topic',
    toolLabel: 'Sharpen the topic link',
    tooltipHint: 'The topic connection is light. Make the link explicit.',
    composerLead: 'The link to the topic is:',
    suggestedMove: 'tighten_relevance',
  },
  ad_hominem: {
    code: 'ad_hominem',
    toolLabel: 'Refocus on the claim',
    tooltipHint: 'Keep the move on the argument, not the speaker.',
    composerLead: 'Restate this about the claim, not the person:',
    suggestedMove: 'restate_neutral',
  },
  civility_risk: {
    code: 'civility_risk',
    toolLabel: 'Cool the tone',
    tooltipHint: 'The tone is heating up. A measured restatement helps.',
    composerLead: 'A calmer version of the same point:',
    suggestedMove: 'cool_tone',
  },
  concession_evasion: {
    code: 'concession_evasion',
    toolLabel: 'Hold the concession line',
    tooltipHint: 'The concession looks like it dodges the original point. Restate it on the actual axis.',
    composerLead: 'What is actually being conceded:',
    suggestedMove: 'restate_neutral',
  },
  loaded_clarification: {
    code: 'loaded_clarification',
    toolLabel: 'Neutralize the question',
    tooltipHint: 'The clarification reads loaded. A neutral phrasing avoids smuggling a claim.',
    composerLead: 'A neutral version of the clarification:',
    suggestedMove: 'restate_neutral',
  },
  duplicate: {
    code: 'duplicate',
    toolLabel: 'Differentiate from siblings',
    tooltipHint: 'A nearby reply already makes a similar point. Show what is new here.',
    composerLead: 'What is different here from the sibling reply:',
    suggestedMove: 'differentiate',
  },
});

// ── Public API ────────────────────────────────────────────────

/**
 * Normalise a free-form code to the canonical lowercase / underscored
 * form used as a map key. Mirrors the normaliser in `gameCopy.ts`.
 */
function normalise(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Returns the affordance for a known rule code, or `null` for an unknown
 * code. Callers that need to defensively suppress unknown codes in a
 * normal-user UI surface should prefer `mapRuleToUiAffordanceOrSuppress`,
 * which has the same shape but communicates intent at the call site.
 */
export function mapRuleToUiAffordance(code: string | null | undefined): RuleUiAffordance | null {
  const k = normalise(code);
  if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(RULE_TO_UI_AFFORDANCE, k)) {
    return RULE_TO_UI_AFFORDANCE[k as RuleCode];
  }
  return null;
}

/** Suppresses unknown codes for normal-user surfaces. */
export function mapRuleToUiAffordanceOrSuppress(code: string | null | undefined): RuleUiAffordance | null {
  return mapRuleToUiAffordance(code);
}

/** All known rule codes, in declaration order. Useful for tests + docs. */
export const ALL_RULE_CODES: ReadonlyArray<RuleCode> = Object.freeze(
  Object.keys(RULE_TO_UI_AFFORDANCE) as RuleCode[],
);

/** All known suggested-move category ids. */
export const ALL_RULE_SUGGESTED_MOVES: ReadonlyArray<RuleSuggestedMove> = Object.freeze([
  'ask_source',
  'request_receipts',
  'narrow_scope',
  'define_term',
  'challenge_inference',
  'challenge_mechanism',
  'flag_amplification',
  'offer_synthesis',
  'tighten_relevance',
  'restate_neutral',
  'cool_tone',
  'differentiate',
  'await_evidence',
]);
