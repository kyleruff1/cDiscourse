/**
 * MCP-SERVER-008-FAMILY-G — Family G prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 18 Family G rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every flag
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B/C/D/E/F's
 *   - System prompt contains the resolution<->verdict CRITICAL-DOCTRINE block verbatim
 *   - System prompt contains the concedes_broader_point axis-partner doctrine anchor
 *   - Per-key falsePositiveGuards for the verdict-adjacent keys contain verbatim guards
 *   - Doctrine ban-list scan of the system prompt returns hits only in negation form
 *   - Subset prompt request only includes requested rawKeys in questions block
 *   - FAMILY_G_MAX_TOKENS === 1500 (matches Family A/B/C/E/F; NO bump per design §A.2)
 *   - FAMILY_G_TEMPERATURE === 0
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_G_SYSTEM_PROMPT,
  FAMILY_G_MAX_TOKENS,
  FAMILY_G_TEMPERATURE,
  FAMILY_G_MAX_BODY_FIELD_LEN,
  buildFamilyGUserPrompt,
  type ValidatedFamilyGRequest,
} from '../lib/familyGPrompt.ts';
import {
  FAMILY_G_RAW_KEYS,
  FAMILY_G_PROMPT_ENTRIES,
  FAMILY_G_CLASSIFIER_SET_VERSION,
} from '../lib/familyGKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';
import { FAMILY_C_SYSTEM_PROMPT } from '../lib/familyCPrompt.ts';
import { FAMILY_D_SYSTEM_PROMPT } from '../lib/familyDPrompt.ts';
import { FAMILY_E_SYSTEM_PROMPT } from '../lib/familyEPrompt.ts';
import { FAMILY_F_SYSTEM_PROMPT } from '../lib/familyFPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyGRequest> = {}): ValidatedFamilyGRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-g-1',
    parentNodeId: 'parent-node-g-1',
    currentText:
      "Stepping back — the broader carbon-tax effectiveness argument is weaker than I thought; I withdraw the broad claim and stand on the narrow scope only.",
    parentText: 'A debate over whether carbon taxes reduce emissions generally.',
    threadContextExcerpt: 'Discussion of carbon-tax effectiveness across jurisdictions.',
    requestedFamilies: ['resolution_progress'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family G system prompt contains the 7 absolute rules byte-equal to Family A, B, C, D, E, and F', () => {
  const absoluteRules = [
    'You do NOT decide who is right in a debate.',
    'You do NOT decide the winner of any debate.',
    'You do NOT assign a truth value to any claim.',
    'You do NOT treat popularity, engagement, or virality as evidence.',
    "You do NOT describe, judge, or label the person — only the move's structure.",
    'You do NOT recommend hiding, deleting, or modifying any content.',
    'You do NOT block an ordinary post — your output is advisory metadata only.',
  ];
  for (const rule of absoluteRules) {
    if (!FAMILY_G_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family G system prompt missing absolute rule: ${rule}`);
    }
    if (!FAMILY_A_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family A system prompt missing absolute rule (parity check): ${rule}`);
    }
    if (!FAMILY_B_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family B system prompt missing absolute rule (parity check): ${rule}`);
    }
    if (!FAMILY_C_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family C system prompt missing absolute rule (parity check): ${rule}`);
    }
    if (!FAMILY_D_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family D system prompt missing absolute rule (parity check): ${rule}`);
    }
    if (!FAMILY_E_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family E system prompt missing absolute rule (parity check): ${rule}`);
    }
    if (!FAMILY_F_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family F system prompt missing absolute rule (parity check): ${rule}`);
    }
  }
});

Deno.test('Family G system prompt contains the resolution-progress descriptive-convergence framing', () => {
  const framing = [
    'exhibits one or more RESOLUTION-PROGRESS structural',
    'a claim narrowed, a narrow point conceded, a broader point relinquished',
    'CRITICAL DOCTRINE — resolution-progress states are DESCRIPTIVE CONVERGENCE-STATE, never verdicts',
    'describes the SHAPE of the exchange',
    'sides retain their standing regardless',
    'Conservative-positives bias',
    // System prompt is hand-wrapped: "most moves have 0 to 2 positives"
    'most moves have 0 to 2 positives',
  ];
  for (const fragment of framing) {
    if (!FAMILY_G_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family G system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family G system prompt contains the resolution<->verdict CRITICAL-DOCTRINE block verbatim', () => {
  // Design §A.3.1 BINDING: the system prompt MUST explicitly forbid the
  // model from framing resolution-progress states as verdicts.
  const expectedFragments = [
    'It NEVER asserts who is ahead, who is behind, who won, who',
    "or that a dispute was settled IN ONE SIDE'S FAVOR",
    'Concession is a SCORING REPAIR, not a defeat.',
    'A broad concession is',
    'it resets standing for future rebuilding — it is NOT a verdict',
    'Synthesis is a GAMEPLAY move, not a verdict about who won.',
    "BOTH sides' elements are being combined",
    'Settlement / closure is procedural, not adjudication.',
    'CLOSING\n  engagement on a point',
    'The output MUST NOT contain the words: won, lost, winner, loser, defeated, prevailed,',
    'capitulated, ahead, behind, "settled in favor", "won the argument", "conceded the loss",',
    'its own output evidence_span MUST NOT echo the verdict framing',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_G_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(
        `Family G system prompt missing resolution<->verdict doctrine fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family G MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_G_MAX_TOKENS, 1500);
  assertEquals(FAMILY_G_TEMPERATURE, 0);
  assertEquals(FAMILY_G_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family G user prompt (default request) includes all 18 rawKeys', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest());
  for (const rawKey of FAMILY_G_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family G user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family G user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest());
  for (const entry of FAMILY_G_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family G prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family G prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family G prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family G user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest());
  for (const entry of FAMILY_G_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family G prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family G prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family G prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family G user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family G prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family G prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family G prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family G user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family G prompt missing schemaVersion literal');
  }
});

Deno.test('Family G user prompt declares classifierSetVersion family-g-v1', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_G_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family G prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-g-v1')) {
    throw new Error('Family G prompt does not literally contain "family-g-v1"');
  }
});

Deno.test('Family G user prompt includes the descriptive-convergence cross-key framing note', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest());
  if (!prompt.includes('Note about resolution-progress states as DESCRIPTIVE CONVERGENCE-STATE')) {
    throw new Error('Family G prompt missing descriptive-convergence note header');
  }
  if (!prompt.includes('NONE of these is a verdict on who won')) {
    throw new Error('Family G prompt missing "NONE of these is a verdict" anchor');
  }
  if (!prompt.includes('Concession is a SCORING REPAIR, never a defeat')) {
    throw new Error('Family G prompt missing concession-as-repair anchor in user prompt');
  }
  if (!prompt.includes('Synthesis is a GAMEPLAY move, not a verdict')) {
    throw new Error('Family G prompt missing synthesis-as-gameplay anchor in user prompt');
  }
  if (!prompt.includes('Settlement / closure is procedural')) {
    throw new Error('Family G prompt missing settlement-as-procedural anchor in user prompt');
  }
});

Deno.test('Family G user prompt includes adversarial-verdict-word handling instruction', () => {
  // Design §A.4 D4 BINDING: Fixture C input contains "won"/"lost"/"beat"; the
  // model must not echo the framing. The user prompt MUST tell the model this.
  const prompt = buildFamilyGUserPrompt(buildRequest());
  if (!prompt.includes('If the move\'s text itself contains verdict words')) {
    throw new Error('Family G prompt missing adversarial-verdict-word instruction');
  }
  if (!prompt.includes('your output evidenceSpan MUST NOT echo the verdict framing')) {
    throw new Error('Family G prompt missing "MUST NOT echo" instruction');
  }
});

Deno.test('Family G user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_G_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_G_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_G_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-g-node-id-test-42',
  });
  const prompt = buildFamilyGUserPrompt(request);
  if (!prompt.includes('UNIQUE_G_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family G prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_G_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family G prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_G_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family G prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-g-node-id-test-42')) {
    throw new Error('Family G prompt missing nodeId');
  }
});

Deno.test('Family G user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyGUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family G prompt missing root-move parentText rendering');
  }
});

Deno.test('Family G user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['concedes_broader_point', 'synthesis_proposed', 'common_ground_identified'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyGUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the questions block.
  // (They may appear in framing text like the descriptive-convergence note, which is intentional.)
  const questionsBlockStart = prompt.indexOf('Resolution-progress questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing resolution-progress-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['narrows_claim', 'action_item_proposed', 'followup_question_proposed'];
  for (const rawKey of nonRequestedKeys) {
    // The questions block uses `- <rawKey>:` as the line prefix.
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family G user prompt with empty requestedRawKeys includes all 18 in the questions block', () => {
  const prompt = buildFamilyGUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Resolution-progress questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  for (const rawKey of FAMILY_G_RAW_KEYS) {
    if (!questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Empty-rawKeys prompt missing rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family G user prompt rejects non-Family-G rawKeys via filter (cross-family safety)', () => {
  // If the caller mistakenly passes a Family A/B/C/D/E/F rawKey, the filter
  // drops it (the validator at the dispatcher layer also rejects, but the
  // prompt builder is defensive).
  const request = buildRequest({
    requestedRawKeys: [
      'concedes_broader_point',
      'supports_parent',
      'disputes_definition',
      'consequence_probability_unclear',
    ],
  });
  const prompt = buildFamilyGUserPrompt(request);
  // Family G key included.
  if (!prompt.includes('concedes_broader_point')) {
    throw new Error('Family G prompt missing valid Family G rawKey concedes_broader_point');
  }
  // Family A / B / F keys filtered out of the questions block.
  const questionsBlockStart = prompt.indexOf('Resolution-progress questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  if (questionsBlock.includes('- supports_parent:')) {
    throw new Error('Family G prompt incorrectly includes Family A key supports_parent in questions block');
  }
  if (questionsBlock.includes('- disputes_definition:')) {
    throw new Error('Family G prompt incorrectly includes Family B key disputes_definition in questions block');
  }
  if (questionsBlock.includes('- consequence_probability_unclear:')) {
    throw new Error('Family G prompt incorrectly includes Family F key consequence_probability_unclear in questions block');
  }
});

Deno.test('Family G user prompt also filters out the EXCLUDED deterministic G keys (subset safety)', () => {
  // The 12 deterministic G keys are not part of the ai_classifier subset.
  // Even if a caller passes them, the prompt builder filters them out.
  const request = buildRequest({
    requestedRawKeys: ['synthesis_proposed', 'conceded', 'narrowed', 'branch_suggested'],
  });
  const prompt = buildFamilyGUserPrompt(request);
  const questionsBlockStart = prompt.indexOf('Resolution-progress questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  if (!questionsBlock.includes('- synthesis_proposed:')) {
    throw new Error('Family G prompt missing valid subset key synthesis_proposed');
  }
  for (const excluded of ['conceded', 'narrowed', 'branch_suggested']) {
    if (questionsBlock.includes(`- ${excluded}:`)) {
      throw new Error(`Family G prompt incorrectly includes excluded deterministic key in questions block: ${excluded}`);
    }
  }
});

Deno.test('Family G concedes_broader_point prompt entry surfaces verbatim doctrine guards (HIGHEST RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'concedes_broader_point');
  if (!entry) throw new Error('concedes_broader_point prompt entry missing');
  const expectedFragments = [
    'a broad concession is RELINQUISHMENT of the broader frame',
    'NEVER framed as "this side lost"',
    'The evidence_span MUST anchor the verbatim relinquishment',
    'its output MUST NOT echo "win" / "lost" / "beat"',
    'The output MUST NOT contain: won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `concedes_broader_point falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family G system prompt contains shared banned tokens only in negation form', () => {
  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

  // Walk back up to 3 preceding lines to capture multi-line negation context.
  function contextLinesForMatch(text: string, matchIndex: number): string[] {
    const lineEnd = text.indexOf('\n', matchIndex);
    const upTo = lineEnd === -1 ? text.length : lineEnd;
    const head = text.slice(0, upTo);
    const lines = head.split('\n');
    return lines.slice(Math.max(0, lines.length - 4));
  }

  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    let match;
    while ((match = globalPattern.exec(FAMILY_G_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_G_SYSTEM_PROMPT, match.index);
      const context = contextLinesForMatch(FAMILY_G_SYSTEM_PROMPT, match.index).join(' ');
      const isNegation =
        line.includes(' NOT ') ||
        line.includes('NOT decide') ||
        line.includes('NOT treat') ||
        line.includes('MUST NOT') ||
        line.includes('NEVER') ||
        line.includes(' never ') ||
        line.includes('never a verdict') ||
        line.includes('not a verdict') ||
        line.includes('not a defeat') ||
        // Multi-line negation continuations:
        context.includes('MUST NOT contain') ||
        context.includes('You do NOT') ||
        context.includes('NEVER') ||
        context.includes(' never ') ||
        context.includes('not a verdict');
      if (!isNegation) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family G system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}" (context: "${context}")`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('Family G prompt template: no resolution-as-verdict framing in any per-key prompt entry', () => {
  // Scan the rendered user prompt for tokens that would frame resolution
  // states as verdicts (positive ASSERTIONS, not negations). NOTE: phrases
  // like "settled in X's favor" appear in the prompt ONLY inside doctrine
  // negations ("NEVER means ... settled in X's favor"), so they are NOT
  // scanned here — the dedicated runtime ban-list scan
  // (familyGAdversarialDoctrine.test.ts) is the authoritative check for
  // verdict tokens in OUTPUT. These patterns catch positive-assertion
  // framings that must never appear in the prompt template.
  const prompt = buildFamilyGUserPrompt(buildRequest());
  const verdictFramingPatterns: RegExp[] = [
    /\bthis\s+side\s+won\b/i,
    /\bthe\s+conceding\s+side\s+lost\b/i,
    /\bthe\s+(?:winner|loser)\s+is\b/i,
  ];
  for (const re of verdictFramingPatterns) {
    if (re.test(prompt)) {
      throw new Error(`Family G prompt contains resolution-as-verdict framing matching ${re}`);
    }
  }
});
