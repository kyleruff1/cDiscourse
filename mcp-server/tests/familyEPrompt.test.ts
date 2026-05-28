/**
 * MCP-SERVER-006-FAMILY-E — Family E prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 16 Family E rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every positive flag
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B/C/D's
 *   - System prompt contains the scheme-as-descriptive doctrine framing
 *   - System prompt contains slippery_slope / abductive / analogy doctrine
 *     anchors verbatim
 *   - Per-key falsePositiveGuards for slippery_slope / abductive / analogy
 *     contain verbatim doctrine guards
 *   - Doctrine ban-list scan of the prompt template literals returns 0 hits
 *     in user-facing scheme framing (only negation form allowed)
 *   - Subset prompt request only includes requested rawKeys in questions block
 *   - FAMILY_E_MAX_TOKENS === 1500 (matches Family A/B/C; NO bump per design §2)
 *   - FAMILY_E_TEMPERATURE === 0
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_E_SYSTEM_PROMPT,
  FAMILY_E_MAX_TOKENS,
  FAMILY_E_TEMPERATURE,
  FAMILY_E_MAX_BODY_FIELD_LEN,
  buildFamilyEUserPrompt,
  type ValidatedFamilyERequest,
} from '../lib/familyEPrompt.ts';
import {
  FAMILY_E_RAW_KEYS,
  FAMILY_E_PROMPT_ENTRIES,
  FAMILY_E_CLASSIFIER_SET_VERSION,
} from '../lib/familyEKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';
import { FAMILY_C_SYSTEM_PROMPT } from '../lib/familyCPrompt.ts';
import { FAMILY_D_SYSTEM_PROMPT } from '../lib/familyDPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyERequest> = {}): ValidatedFamilyERequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-e-1',
    parentNodeId: 'parent-node-e-1',
    currentText: 'If we permit this regulation, agencies will start defining acceptable speech, then expand the categories, then arrive at full suppression.',
    parentText: 'A targeted regulation against fraudulent product claims has been proposed.',
    threadContextExcerpt: 'Discussion of platform content regulation.',
    requestedFamilies: ['argument_scheme'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family E system prompt contains the 7 absolute rules byte-equal to Family A, B, C, and D', () => {
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
    if (!FAMILY_E_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family E system prompt missing absolute rule: ${rule}`);
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
  }
});

Deno.test('Family E system prompt contains scheme-as-descriptive structural framing', () => {
  // Fragments are short enough to never span the prompt's hard line breaks
  // (the prompt is hand-wrapped at ~80-100 chars per line).
  const framing = [
    'Walton (1995, 2008) argumentation',
    'SCHEMES as its primary inferential support',
    'Schemes are descriptive shape facts',
    'CRITICAL QUESTION (these live in Family F, not here)',
    'CRITICAL DOCTRINE',
    'slippery_slope_reasoning_present is a SCHEME',
    'abductive_explanation_present is a SCHEME (Peirce',
    'analogy_reasoning_present is a SCHEME (Walton',
    'Conservative-positives bias',
    'most moves exhibit 0 to 2 schemes',
  ];
  for (const fragment of framing) {
    if (!FAMILY_E_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family E system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family E system prompt contains slippery_slope doctrine anchor verbatim', () => {
  // Design §3 BINDING: the system prompt MUST explicitly forbid the
  // model from framing slippery_slope as fallacy/weak/invalid/etc.
  const expectedFragments = [
    'slippery_slope_reasoning_present is a SCHEME',
    'CDiscourse treats it descriptively',
    'chain-of-consequences inference pattern',
    'MUST NOT call this a',
    'fallacy, fallacious, weak, invalid, bad reasoning, a logical error, flawed, wrong',
    'proof of anything',
    'consequence_probability_unclear,',
    'this family only detects the',
    'PATTERN, never adjudicates it',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_E_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family E system prompt missing slippery_slope doctrine fragment: "${fragment}"`);
    }
  }
});

Deno.test('Family E system prompt contains abductive doctrine anchor verbatim', () => {
  const expectedFragments = [
    'abductive_explanation_present is a SCHEME',
    'Peirce: inference to best explanation',
    'It is\n  not a fallacy',
    'normal pattern in scientific argument',
    'does NOT mean\n  the inference is sound',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_E_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family E system prompt missing abductive doctrine fragment: "${fragment}"`);
    }
  }
});

Deno.test('Family E system prompt contains analogy doctrine anchor verbatim', () => {
  const expectedFragments = [
    'analogy_reasoning_present is a SCHEME (Walton: analogy scheme)',
    'It is not a fallacy',
    'critical question (analogy_mapping_missing, Family F)',
    'probes the mapping',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_E_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family E system prompt missing analogy doctrine fragment: "${fragment}"`);
    }
  }
});

Deno.test('Family E MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_E_MAX_TOKENS, 1500);
  assertEquals(FAMILY_E_TEMPERATURE, 0);
  assertEquals(FAMILY_E_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family E user prompt (default request) includes all 16 rawKeys', () => {
  const prompt = buildFamilyEUserPrompt(buildRequest());
  for (const rawKey of FAMILY_E_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family E user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family E user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyEUserPrompt(buildRequest());
  for (const entry of FAMILY_E_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family E prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family E prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family E prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family E user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyEUserPrompt(buildRequest());
  for (const entry of FAMILY_E_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family E prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family E prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family E prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family E user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyEUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family E prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family E prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family E prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family E user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyEUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family E prompt missing schemaVersion literal');
  }
});

Deno.test('Family E user prompt declares classifierSetVersion family-e-v1', () => {
  const prompt = buildFamilyEUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_E_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family E prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-e-v1')) {
    throw new Error('Family E prompt does not literally contain "family-e-v1"');
  }
});

Deno.test('Family E user prompt includes scheme-as-descriptive cross-key framing note', () => {
  const prompt = buildFamilyEUserPrompt(buildRequest());
  if (!prompt.includes('Note about schemes as descriptive patterns')) {
    throw new Error('Family E prompt missing scheme-as-descriptive note header');
  }
  if (!prompt.includes('slippery_slope_reasoning_present is a SCHEME')) {
    throw new Error('Family E prompt missing slippery_slope doctrine anchor in user prompt');
  }
  if (!prompt.includes('never a fallacy')) {
    throw new Error('Family E prompt missing "never a fallacy" anchor');
  }
  if (!prompt.includes('abductive_explanation_present (Peirce: inference to best explanation)')) {
    throw new Error('Family E prompt missing abductive doctrine anchor in user prompt');
  }
  if (!prompt.includes('analogy_reasoning_present is a SCHEME (Walton), not a fallacy')) {
    throw new Error('Family E prompt missing analogy doctrine anchor in user prompt');
  }
});

Deno.test('Family E user prompt includes adversarial-fallacy-word handling instruction', () => {
  // Amendment §2.2 BINDING: even when input contains "fallacy", the model
  // must not echo the framing. The user prompt MUST tell the model this.
  const prompt = buildFamilyEUserPrompt(buildRequest());
  if (!prompt.includes('If the move\'s text itself contains the word "fallacy"')) {
    throw new Error('Family E prompt missing adversarial-fallacy-word instruction');
  }
  if (!prompt.includes('your output evidenceSpan')) {
    throw new Error('Family E prompt missing evidenceSpan-anchoring instruction');
  }
  if (!prompt.includes('MUST NOT echo the fallacy framing')) {
    throw new Error('Family E prompt missing "MUST NOT echo" instruction');
  }
});

Deno.test('Family E user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_E_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_E_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_E_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-e-node-id-test-42',
  });
  const prompt = buildFamilyEUserPrompt(request);
  if (!prompt.includes('UNIQUE_E_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family E prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_E_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family E prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_E_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family E prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-e-node-id-test-42')) {
    throw new Error('Family E prompt missing nodeId');
  }
});

Deno.test('Family E user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyEUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family E prompt missing root-move parentText rendering');
  }
});

Deno.test('Family E user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['slippery_slope_reasoning_present', 'causal_reasoning_present', 'consequence_reasoning_present'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyEUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the questions block.
  // (They may appear in framing text like the scheme-as-descriptive note, which is intentional.)
  const questionsBlockStart = prompt.indexOf('Argument-scheme questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing argument-scheme-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['analogy_reasoning_present', 'cost_benefit_reasoning_present', 'risk_reasoning_present'];
  for (const rawKey of nonRequestedKeys) {
    // The questions block uses `- <rawKey>:` as the line prefix.
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family E user prompt rejects non-Family-E rawKeys via filter (cross-family safety)', () => {
  // If the caller mistakenly passes a Family A rawKey, the filter drops
  // it (the validator at the dispatcher layer also rejects, but the prompt
  // builder is defensive).
  const request = buildRequest({
    requestedRawKeys: ['causal_reasoning_present', 'supports_parent', 'disputes_definition'],
  });
  const prompt = buildFamilyEUserPrompt(request);
  // Family E key included.
  if (!prompt.includes('causal_reasoning_present')) {
    throw new Error('Family E prompt missing valid Family E rawKey causal_reasoning_present');
  }
  // Family A / B keys filtered out of the questions block.
  const questionsBlockStart = prompt.indexOf('Argument-scheme questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  if (questionsBlock.includes('- supports_parent:')) {
    throw new Error('Family E prompt incorrectly includes Family A key supports_parent in questions block');
  }
  if (questionsBlock.includes('- disputes_definition:')) {
    throw new Error('Family E prompt incorrectly includes Family B key disputes_definition in questions block');
  }
});

Deno.test('Family E slippery_slope prompt entry surfaces verbatim doctrine guards', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'slippery_slope_reasoning_present');
  if (!entry) throw new Error('slippery_slope_reasoning_present prompt entry missing');
  const expectedFragments = [
    'slippery-slope is a SCHEME, never a fallacy',
    'consequence_probability_unclear, Family F',
    "MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'bad reasoning', 'flawed', 'wrong', 'proof of', 'logical error'",
    "If the move's text itself contains the word 'fallacy'",
    "must NOT echo or assert the fallacy framing",
    'anchor the chain pattern, not the fallacy framing',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `slippery_slope_reasoning_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family E abductive prompt entry surfaces verbatim doctrine guards', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'abductive_explanation_present');
  if (!entry) throw new Error('abductive_explanation_present prompt entry missing');
  const expectedFragments = [
    'abductive explanation (Peirce: inference to best explanation) is a SCHEME, not a fallacy',
    'normal pattern in scientific argument',
    "MUST NOT contain words like 'fallacy', 'invalid', 'flawed', 'weak', 'wrong'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `abductive_explanation_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family E analogy prompt entry surfaces verbatim doctrine guards', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'analogy_reasoning_present');
  if (!entry) throw new Error('analogy_reasoning_present prompt entry missing');
  const expectedFragments = [
    'analogy is a SCHEME (Walton). It is not a fallacy',
    'analogy_mapping_missing, Family F',
    "MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'bad reasoning', 'wrong'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `analogy_reasoning_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family E system prompt contains banned tokens only in negation form', () => {
  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

  // For multi-line negations like:
  //   "The output MUST NOT call this a
  //    fallacy, fallacious, weak, invalid, bad reasoning, a logical error, flawed, wrong,
  //    or proof of anything."
  // the continuation lines do not themselves contain "NOT". Walk back up to 3
  // lines from the match looking for an open negation that continues to this
  // line.
  function contextLinesForMatch(text: string, matchIndex: number): string[] {
    const lineEnd = text.indexOf('\n', matchIndex);
    const upTo = lineEnd === -1 ? text.length : lineEnd;
    const head = text.slice(0, upTo);
    const lines = head.split('\n');
    // Return the matched line plus up to 3 preceding lines as context.
    return lines.slice(Math.max(0, lines.length - 4));
  }

  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    let match;
    while ((match = globalPattern.exec(FAMILY_E_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_E_SYSTEM_PROMPT, match.index);
      const context = contextLinesForMatch(FAMILY_E_SYSTEM_PROMPT, match.index).join(' ');
      // Allowed forms: explicit negations of the rule, single-line OR
      // multi-line (the negation may begin on a preceding line).
      const isNegation =
        line.includes(' NOT ') ||
        line.includes('NOT decide') ||
        line.includes('NOT treat') ||
        line.includes('MUST NOT') ||
        line.includes('not a fallacy') ||
        line.includes('not adjudicates') ||
        line.includes('NEVER means') ||
        // Multi-line negation continuations (look back at preceding lines):
        context.includes('MUST NOT call this a') ||
        context.includes('You do NOT') ||
        context.includes(' is not a fallacy');
      if (!isNegation) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family E system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}" (context: "${context}")`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('Family E prompt template: no scheme-as-fault framing in any per-key prompt entry', () => {
  // Scan the rendered user prompt for tokens that would frame schemes as
  // faults. The system prompt's "Schemes are descriptive shape facts"
  // line is the anti-doctrine anchor; the per-key entries must not
  // contradict.
  const prompt = buildFamilyEUserPrompt(buildRequest());
  // Tokens that would imply scheme-as-fault (positive assertions, not negations).
  const schemeAsFaultPatterns: RegExp[] = [
    /\bscheme\s+is\s+fallacious\b/i,
    /\bthis\s+scheme\s+is\s+wrong\b/i,
    /\bthe\s+pattern\s+is\s+invalid\b/i,
    /\bthe\s+reasoning\s+is\s+flawed\b/i,
  ];
  for (const re of schemeAsFaultPatterns) {
    if (re.test(prompt)) {
      throw new Error(
        `Family E prompt contains scheme-as-fault framing matching ${re}`,
      );
    }
  }
});
