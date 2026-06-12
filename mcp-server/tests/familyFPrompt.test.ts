/**
 * MCP-SERVER-007-FAMILY-F + MCP-BUILD2f — Family F prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 17 Family F rawKeys (14 + 3 MCP-BUILD2f) when requestedRawKeys is empty
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every positive flag
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B/C/D/E's
 *   - System prompt contains the CQ-as-productive-probe doctrine framing
 *   - System prompt contains consequence_probability_unclear E↔F partnership
 *     doctrine anchor verbatim (HIGHEST RISK; HALT triggers #17, #18, #22)
 *   - Per-key falsePositiveGuards for the 6 doctrine-risk keys contain
 *     verbatim doctrine guards
 *   - Doctrine ban-list scan of the prompt template literals returns hits
 *     in only negation form (e.g., "MUST NOT call this a fallacy")
 *   - Subset prompt request only includes requested rawKeys in questions block
 *   - FAMILY_F_MAX_TOKENS === 1500 (matches Family A/B/C/E; NO bump per design §2)
 *   - FAMILY_F_TEMPERATURE === 0
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_F_SYSTEM_PROMPT,
  FAMILY_F_MAX_TOKENS,
  FAMILY_F_TEMPERATURE,
  FAMILY_F_MAX_BODY_FIELD_LEN,
  buildFamilyFUserPrompt,
  type ValidatedFamilyFRequest,
} from '../lib/familyFPrompt.ts';
import {
  FAMILY_F_RAW_KEYS,
  FAMILY_F_PROMPT_ENTRIES,
  FAMILY_F_CLASSIFIER_SET_VERSION,
} from '../lib/familyFKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from '../lib/modelInfoEmissionDirective.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';
import { FAMILY_C_SYSTEM_PROMPT } from '../lib/familyCPrompt.ts';
import { FAMILY_D_SYSTEM_PROMPT } from '../lib/familyDPrompt.ts';
import { FAMILY_E_SYSTEM_PROMPT } from '../lib/familyEPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyFRequest> = {}): ValidatedFamilyFRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-f-1',
    parentNodeId: 'parent-node-f-1',
    currentText:
      'If we permit this regulation, agencies will start defining acceptable speech, then expand the categories, then arrive at full suppression.',
    parentText: 'A targeted regulation against fraudulent product claims has been proposed.',
    threadContextExcerpt: 'Discussion of platform content regulation.',
    requestedFamilies: ['critical_question'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family F system prompt contains the 7 absolute rules byte-equal to Family A, B, C, D, and E', () => {
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
    if (!FAMILY_F_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family F system prompt missing absolute rule: ${rule}`);
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
  }
});

Deno.test('Family F system prompt contains CQ-as-productive-probe structural framing', () => {
  const framing = [
    'You classify a MOVE against 17 structural observations',
    'QUESTIONS that productive inquiry would raise',
    'structural observation about an ABSENCE or GAP',
    'CRITICAL DOCTRINE — critical questions are PRODUCTIVE PROBES, never verdicts',
    'flags a GAP the move has not yet filled',
    'The CQ opens a productive inquiry; it never closes',
    'one with a verdict',
    'NEVER implies the argument scheme it probes is a fallacy',
    'Conservative-positives bias',
    // System prompt is hand-wrapped: "most\nmoves have 0 to 2 unmet CQs"
    'moves have 0 to 2 unmet CQs',
  ];
  for (const fragment of framing) {
    if (!FAMILY_F_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family F system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family F system prompt contains consequence_probability_unclear E↔F partnership doctrine anchor verbatim', () => {
  // Design §3 BINDING: the system prompt MUST explicitly forbid the
  // model from framing consequence_probability_unclear as fallacy/verdict
  // even when the input contains slippery-slope reasoning.
  // This is HALT triggers #17, #18, #22 mitigation.
  const expectedFragments = [
    'consequence_probability_unclear is the highest-doctrine-risk CQ',
    "partners with Family E's",
    'slippery_slope_reasoning_present',
    'which E treats descriptively, never as a fallacy',
    'the model\'s output',
    'MUST NOT call the slippery-slope inference a fallacy, fallacious, weak, invalid, bad',
    'unmet-means-fallacy',
    'or',
    'any verdict on argument quality',
    'anchors the PROBABILITY GAP',
    'never the conclusion that the chain is bad reasoning',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_F_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(
        `Family F system prompt missing consequence_probability_unclear doctrine fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family F system prompt contains Walton (1995, 2008) CQ doctrine anchor', () => {
  const expectedFragments = [
    'Walton (1995, 2008)',
    'every scheme has critical questions that',
    'PROBE without REJECTING the scheme',
    // System prompt is hand-wrapped: "Family E\n  detects argument schemes"
    'detects argument schemes',
    'Family F probes the critical questions',
    'complementary, descriptive, and structurally independent',
    "An unmet CQ does NOT mean E's",
    'scheme is fallacious',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_F_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family F system prompt missing Walton CQ doctrine fragment: "${fragment}"`);
    }
  }
});

Deno.test('Family F MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_F_MAX_TOKENS, 1500);
  assertEquals(FAMILY_F_TEMPERATURE, 0);
  assertEquals(FAMILY_F_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family F user prompt (default request) includes all 17 rawKeys', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  for (const rawKey of FAMILY_F_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family F user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family F user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  for (const entry of FAMILY_F_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family F prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family F prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family F prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family F user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  for (const entry of FAMILY_F_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family F prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family F prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family F prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family F user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family F prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family F prompt missing confidence band enumeration');
  }
  // The OPS-MCP-FAMILIES-E-F-RESPONSE-SHAPE-TUNING update replaced the
  // weak one-way coordination phrase ("Every key in observations MUST
  // also appear in confidence") with the stronger bidirectional STRICT
  // RESPONSE-SHAPE CONTRACT block. The intent — that confidence keys
  // must coordinate with observations — is preserved and strengthened.
  // This test now asserts the stronger contract.
  const referencesObservations = /\bobservations\b/.test(prompt);
  const referencesConfidence = /\bconfidence\b/.test(prompt);
  const assertsCoordination =
    /(identical|same\s+exact|exactly\s+the\s+same)/i.test(prompt) &&
    /(checkedRawKeys|observations|confidence|evidenceSpan)[\s\S]{0,800}?(checkedRawKeys|observations|confidence|evidenceSpan)/i.test(
      prompt,
    );
  if (!(referencesObservations && referencesConfidence && assertsCoordination)) {
    throw new Error(
      'Family F prompt missing observations/confidence coordination requirement (expected the STRICT RESPONSE-SHAPE CONTRACT block)',
    );
  }
});

Deno.test('Family F user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family F prompt missing schemaVersion literal');
  }
});

Deno.test('Family F user prompt declares classifierSetVersion family-f-v1', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_F_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family F prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-f-v1')) {
    throw new Error('Family F prompt does not literally contain "family-f-v1"');
  }
});

Deno.test('Family F user prompt includes CQ-as-productive-probe cross-key framing note', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  if (!prompt.includes('Note about critical questions as productive probes')) {
    throw new Error('Family F prompt missing CQ-as-productive-probe note header');
  }
  if (!prompt.includes('Critical questions OPEN productive inquiry')) {
    throw new Error('Family F prompt missing "OPEN productive inquiry" anchor');
  }
  if (!prompt.includes('NEVER mean the')) {
    throw new Error('Family F prompt missing "NEVER mean" anchor');
  }
  if (!prompt.includes('consequence_probability_unclear is the highest-risk CQ')) {
    throw new Error('Family F prompt missing consequence_probability_unclear doctrine anchor in user prompt');
  }
  if (!prompt.includes('flagging the probability gap NEVER means the chain')) {
    throw new Error('Family F prompt missing "flagging the probability gap NEVER means" anchor');
  }
  if (!prompt.includes('Peirce: inference to best explanation')) {
    throw new Error('Family F prompt missing Peirce abductive doctrine anchor');
  }
});

Deno.test('Family F user prompt includes adversarial-fallacy-word handling instruction', () => {
  // Design §4 D4 BINDING: Fixture C input contains "fallacy"; the model
  // must not echo the framing. The user prompt MUST tell the model this.
  const prompt = buildFamilyFUserPrompt(buildRequest());
  if (!prompt.includes('If the move\'s text itself contains the word "fallacy"')) {
    throw new Error('Family F prompt missing adversarial-fallacy-word instruction');
  }
  if (!prompt.includes('your output evidenceSpan')) {
    throw new Error('Family F prompt missing evidenceSpan-anchoring instruction');
  }
  if (!prompt.includes('MUST NOT echo the fallacy framing')) {
    throw new Error('Family F prompt missing "MUST NOT echo" instruction');
  }
});

Deno.test('Family F user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_F_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_F_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_F_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-f-node-id-test-42',
  });
  const prompt = buildFamilyFUserPrompt(request);
  if (!prompt.includes('UNIQUE_F_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family F prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_F_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family F prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_F_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family F prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-f-node-id-test-42')) {
    throw new Error('Family F prompt missing nodeId');
  }
});

Deno.test('Family F user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyFUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family F prompt missing root-move parentText rendering');
  }
});

Deno.test('Family F user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = [
    'consequence_probability_unclear',
    'missing_warrant',
    'alternative_explanation_available',
  ];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyFUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the questions block.
  // (They may appear in framing text like the CQ-as-productive-probe note, which is intentional.)
  const questionsBlockStart = prompt.indexOf('Critical-question questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing critical-question-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['scope_limit_unstated', 'qualification_missing', 'comparison_baseline_missing'];
  for (const rawKey of nonRequestedKeys) {
    // The questions block uses `- <rawKey>:` as the line prefix.
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family F user prompt rejects non-Family-F rawKeys via filter (cross-family safety)', () => {
  // If the caller mistakenly passes a Family A/B/C/D/E rawKey, the filter drops
  // it (the validator at the dispatcher layer also rejects, but the prompt
  // builder is defensive).
  const request = buildRequest({
    requestedRawKeys: [
      'consequence_probability_unclear',
      'supports_parent',
      'disputes_definition',
      'causal_reasoning_present',
    ],
  });
  const prompt = buildFamilyFUserPrompt(request);
  // Family F key included.
  if (!prompt.includes('consequence_probability_unclear')) {
    throw new Error('Family F prompt missing valid Family F rawKey consequence_probability_unclear');
  }
  // Family A / B / E keys filtered out of the questions block.
  const questionsBlockStart = prompt.indexOf('Critical-question questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  if (questionsBlock.includes('- supports_parent:')) {
    throw new Error('Family F prompt incorrectly includes Family A key supports_parent in questions block');
  }
  if (questionsBlock.includes('- disputes_definition:')) {
    throw new Error('Family F prompt incorrectly includes Family B key disputes_definition in questions block');
  }
  if (questionsBlock.includes('- causal_reasoning_present:')) {
    throw new Error('Family F prompt incorrectly includes Family E key causal_reasoning_present in questions block');
  }
});

Deno.test('Family F consequence_probability_unclear prompt entry surfaces verbatim doctrine guards (HIGHEST RISK)', () => {
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'consequence_probability_unclear');
  if (!entry) throw new Error('consequence_probability_unclear prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION about probability anchoring, never a verdict',
    "Family E's slippery_slope_reasoning_present",
    'evidenceSpan MUST be a verbatim quote',
    "MUST NOT contain words like 'fallacy'",
    "the model's own output must NOT echo or assert the fallacy framing",
    'The evidenceSpan must anchor the probability gap, not the fallacy framing',
    'The CQ opens an inquiry; never closes one with a verdict',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `consequence_probability_unclear falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family F missing_warrant prompt entry surfaces Toulmin doctrine guards (MEDIUM RISK)', () => {
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'missing_warrant');
  if (!entry) throw new Error('missing_warrant prompt entry missing');
  const expectedFragments = [
    "this is a CRITICAL QUESTION on Toulmin's warrant structure",
    'never a verdict that the argument is unwarranted, invalid, or wrong',
    "'what would warrant this claim?'",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(`missing_warrant falsePositiveGuards missing verbatim fragment: "${fragment}"`);
    }
  }
});

Deno.test('Family F authority_basis_missing prompt entry surfaces Walton authority CQ guards (MEDIUM RISK)', () => {
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'authority_basis_missing');
  if (!entry) throw new Error('authority_basis_missing prompt entry missing');
  const expectedFragments = [
    "this is a CRITICAL QUESTION on Walton's expert-authority scheme",
    'never a verdict that the authority appeal is fallacious',
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `authority_basis_missing falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family F analogy_mapping_missing prompt entry surfaces Walton analogy CQ guards (MEDIUM RISK)', () => {
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'analogy_mapping_missing');
  if (!entry) throw new Error('analogy_mapping_missing prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION about analogy mapping, never a verdict',
    "partners with Family E's analogy_reasoning_present",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `analogy_mapping_missing falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family F causal_mechanism_missing prompt entry surfaces Walton causal CQ guards (MEDIUM RISK)', () => {
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'causal_mechanism_missing');
  if (!entry) throw new Error('causal_mechanism_missing prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION on causal scheme mechanism',
    'never a verdict that the causal claim is fallacious or false',
    "partners with Family E's causal_reasoning_present",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `causal_mechanism_missing falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family F alternative_explanation_available prompt entry surfaces Peirce CQ guards (MEDIUM RISK)', () => {
  const entry = FAMILY_F_PROMPT_ENTRIES.find(
    (e) => e.rawKey === 'alternative_explanation_available',
  );
  if (!entry) throw new Error('alternative_explanation_available prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION on abductive reasoning',
    'Peirce: inference to best explanation',
    'never a verdict that abductive reasoning is fallacious',
    "partners with Family E's abductive_explanation_present",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `alternative_explanation_available falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family F system prompt contains banned tokens only in negation form', () => {
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
    while ((match = globalPattern.exec(FAMILY_F_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_F_SYSTEM_PROMPT, match.index);
      const context = contextLinesForMatch(FAMILY_F_SYSTEM_PROMPT, match.index).join(' ');
      const isNegation =
        line.includes(' NOT ') ||
        line.includes('NOT decide') ||
        line.includes('NOT treat') ||
        line.includes('MUST NOT') ||
        line.includes('never closes') ||
        line.includes('NEVER implies') ||
        line.includes('never a verdict') ||
        line.includes(' never as a fallacy') ||
        line.includes('with a verdict.') ||
        // Multi-line negation continuations:
        context.includes('MUST NOT call the slippery-slope inference a') ||
        context.includes('You do NOT') ||
        context.includes('never a verdict') ||
        context.includes('NEVER implies') ||
        context.includes('never closes') ||
        context.includes(' is not a fallacy');
      if (!isNegation) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family F system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}" (context: "${context}")`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('Family F prompt template: no CQ-as-fault framing in any per-key prompt entry', () => {
  // Scan the rendered user prompt for tokens that would frame CQs as faults.
  // The system prompt's "PRODUCTIVE PROBES, never verdicts" is the
  // anti-doctrine anchor; the per-key entries must not contradict.
  const prompt = buildFamilyFUserPrompt(buildRequest());
  // Tokens that would imply CQ-as-fault (positive assertions, not negations).
  const cqAsFaultPatterns: RegExp[] = [
    /\bthe\s+CQ\s+is\s+fallacious\b/i,
    /\bthis\s+CQ\s+is\s+wrong\b/i,
    /\bunmet\s+CQ\s+is\s+a\s+fallacy\b/i,
    /\bthe\s+critical\s+question\s+proves\s+wrong\b/i,
  ];
  for (const re of cqAsFaultPatterns) {
    if (re.test(prompt)) {
      throw new Error(`Family F prompt contains CQ-as-fault framing matching ${re}`);
    }
  }
});

// ── OPS-MCP-FAMILIES-E-F-RESPONSE-SHAPE-TUNING — packet-shape guardrails ──
//
// PR #422's retry surfaced an analogous critical_question packet-shape
// failure at evidenceSpan.alternative_explanation_available — same
// mechanism the Family E mitigation (PR #421) targeted on
// evidenceSpan.abductive_explanation_present. These tests mirror the PR
// #421 prompt source-scan pattern for the Family F user prompt. Durable:
// they fail if the STRICT RESPONSE-SHAPE CONTRACT block, the key-set-
// equality guardrail, the evidenceSpan value-type guardrail, the
// alternative_explanation_available rawKey callout, or the self-check
// directive is removed.

Deno.test('Family F user prompt: declares a strict response-shape contract block', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  if (!/STRICT\s+RESPONSE-SHAPE\s+CONTRACT/i.test(prompt)) {
    throw new Error(
      'Family F user prompt is missing the STRICT RESPONSE-SHAPE CONTRACT block — packet-shape guardrails removed',
    );
  }
});

Deno.test('Family F user prompt: enforces bidirectional key-set equality across the four maps', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  // The validator (mcpBooleanObservationSchemaMirror.ts:218-265) enforces
  // observations/confidence/evidenceSpan bidirectional equality + a
  // one-way observations ⊆ checkedRawKeys check. The prompt must
  // instruct identical key sets across all four to prevent the
  // checkedRawKeys arity drift R3 surfaced on the analogous E path.
  const referencesAllFour =
    /checkedRawKeys/.test(prompt) &&
    /observations/.test(prompt) &&
    /confidence/.test(prompt) &&
    /evidenceSpan/.test(prompt);
  if (!referencesAllFour) {
    throw new Error(
      'Family F user prompt does not reference all four packet maps (checkedRawKeys / observations / confidence / evidenceSpan)',
    );
  }
  const equalityAsserted =
    /(identical|same\s+exact|key[-\s]set\s+equality|exactly\s+(once|the\s+same))/i.test(
      prompt,
    );
  if (!equalityAsserted) {
    throw new Error(
      'Family F user prompt does not assert bidirectional key-set equality across the four packet maps',
    );
  }
  if (!/no\s+extras?[,\s]+no\s+omissions?/i.test(prompt)) {
    throw new Error(
      'Family F user prompt does not contain the "no extras, no omissions" packet-shape guardrail',
    );
  }
});

Deno.test('Family F user prompt: forbids object / array / boolean / number in evidenceSpan values', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  const forbids = (token: string) =>
    new RegExp(`(NEVER|never|no|Not\\s+allowed)\\s+(a\\s+|an\\s+)?${token}`, 'i').test(prompt);
  for (const token of ['object', 'array', 'boolean', 'number']) {
    if (!forbids(token)) {
      throw new Error(
        `Family F user prompt does not forbid evidenceSpan value type "${token}"`,
      );
    }
  }
  if (!/string.*null|null.*string/is.test(prompt)) {
    throw new Error(
      'Family F user prompt does not enumerate string-or-null as the allowed evidenceSpan value types',
    );
  }
  if (!/240/.test(prompt)) {
    throw new Error(
      'Family F user prompt does not cite the 240-character evidenceSpan length cap',
    );
  }
});

Deno.test('Family F user prompt: prescribes null evidenceSpan for false observations', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  const negativeNullRule =
    /(observations\[\s*rawKey\s*\]|observations\[[^\]]*\])\s+is\s+false[^.]*?null/is.test(
      prompt,
    ) || /false[^.]*?evidenceSpan[^.]*?null/is.test(prompt);
  if (!negativeNullRule) {
    throw new Error(
      'Family F user prompt does not prescribe null evidenceSpan for false observations',
    );
  }
});

Deno.test('Family F user prompt: directs a self-check before emitting the JSON', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  const selfCheckPresent =
    /(SELF-CHECK|before\s+you\s+(return|emit|output))/i.test(prompt) &&
    /(verify|regenerate|each\s+check\s+fails)/i.test(prompt);
  if (!selfCheckPresent) {
    throw new Error(
      'Family F user prompt does not direct a self-check before emitting the JSON',
    );
  }
});

Deno.test('Family F user prompt: names alternative_explanation_available in the no-special-shape rule', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  // The specific failure path observed in PR #422 was
  // evidenceSpan.alternative_explanation_available being object/array.
  // The prompt must explicitly call out this rawKey alongside other
  // doctrine-risk CQs in the no-nested-shape guardrail.
  if (!/alternative_explanation_available/.test(prompt)) {
    throw new Error(
      'Family F user prompt does not name alternative_explanation_available in the response-shape guardrail block',
    );
  }
  // Must also name consequence_probability_unclear, analogy_mapping_missing,
  // and missing_warrant for symmetry with the existing doctrine-risk
  // anchors in F's system prompt.
  if (
    !/consequence_probability_unclear/.test(prompt) ||
    !/analogy_mapping_missing/.test(prompt) ||
    !/missing_warrant/.test(prompt)
  ) {
    throw new Error(
      'Family F user prompt does not also name consequence_probability_unclear, analogy_mapping_missing, and missing_warrant in the response-shape block',
    );
  }
});

Deno.test('Family F user prompt: declares per-rawKey shape reinforcement for alternative_explanation_available', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  if (!/RAWKEY-SHAPE\s+REINFORCEMENT/i.test(prompt)) {
    throw new Error(
      'Family F user prompt is missing the RAWKEY-SHAPE REINFORCEMENT section heading',
    );
  }
  if (!/evidenceSpan\.alternative_explanation_available/.test(prompt)) {
    throw new Error(
      'Family F user prompt RAWKEY-SHAPE REINFORCEMENT does not name evidenceSpan.alternative_explanation_available',
    );
  }
  const allowsStringAndNull =
    /(string\s+up\s+to\s+240|≤\s*240\s*char|<=\s*240\s*char|up\s+to\s+240\s+character)/i.test(
      prompt,
    ) && /\bnull\b/.test(prompt);
  if (!allowsStringAndNull) {
    throw new Error(
      'Family F user prompt RAWKEY-SHAPE REINFORCEMENT does not enumerate the allowed string-or-null shape',
    );
  }
  const blockMatch = prompt.match(
    /RAWKEY-SHAPE\s+REINFORCEMENT[\s\S]*?(?=Conservative-positives bias|Answer each|Input to classify)/i,
  );
  if (!blockMatch) {
    throw new Error('Could not isolate RAWKEY-SHAPE REINFORCEMENT block for scanning');
  }
  const block = blockMatch[0];
  for (const token of ['object', 'array', 'boolean', 'number']) {
    if (!new RegExp(`\\b${token}\\b`, 'i').test(block)) {
      throw new Error(
        `RAWKEY-SHAPE REINFORCEMENT for alternative_explanation_available does not list "${token}" as not allowed`,
      );
    }
  }
});

Deno.test('Family F user prompt: declares per-rawKey shape reinforcement for unstated_assumption (rule 7)', () => {
  // OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING. The R3 logs proved
  // evidenceSpan.unstated_assumption was the one uncovered Family-F rawKey
  // that deterministically dead-lettered argId 9ef5aab5 (4/4 attempts,
  // validation_failed + packet_invalid). This mirrors the proven rule-6
  // RAWKEY-SHAPE REINFORCEMENT pattern for one more rawKey. Durable: fails
  // if rule 7 is removed or its allowed/forbidden enumeration is dropped.
  const prompt = buildFamilyFUserPrompt(buildRequest());

  // The rule-7 heading must name unstated_assumption explicitly.
  if (!/RAWKEY-SHAPE\s+REINFORCEMENT\s+—\s+unstated_assumption/i.test(prompt)) {
    throw new Error(
      'Family F user prompt is missing the rule-7 RAWKEY-SHAPE REINFORCEMENT — unstated_assumption heading',
    );
  }
  if (!/evidenceSpan\.unstated_assumption/.test(prompt)) {
    throw new Error(
      'Family F user prompt rule-7 RAWKEY-SHAPE REINFORCEMENT does not name evidenceSpan.unstated_assumption',
    );
  }

  // Isolate ONLY the rule-7 block (from its own heading to the
  // Conservative-positives bias prose / Answer-each directive / Input).
  const blockMatch = prompt.match(
    /7\.\s+RAWKEY-SHAPE\s+REINFORCEMENT\s+—\s+unstated_assumption[\s\S]*?(?=Conservative-positives bias|Answer each|Input to classify)/i,
  );
  if (!blockMatch) {
    throw new Error('Could not isolate the rule-7 unstated_assumption block for scanning');
  }
  const block = blockMatch[0];

  // Allowed values: a string up to 240 chars OR null.
  const allowsStringAndNull =
    /(string\s+up\s+to\s+240|≤\s*240\s*char|<=\s*240\s*char|up\s+to\s+240\s+character)/i.test(
      block,
    ) && /\bnull\b/.test(block);
  if (!allowsStringAndNull) {
    throw new Error(
      'Family F user prompt rule-7 RAWKEY-SHAPE REINFORCEMENT does not enumerate the allowed string-≤240-or-null shape',
    );
  }

  // Forbidden value types: object / array / boolean / number.
  for (const token of ['object', 'array', 'boolean', 'number']) {
    if (!new RegExp(`\\b${token}\\b`, 'i').test(block)) {
      throw new Error(
        `RAWKEY-SHAPE REINFORCEMENT for unstated_assumption does not list "${token}" as not allowed`,
      );
    }
  }

  // The rule-7 block must anchor the unstated-assumption GAP, never the alternative-explanation
  // gap (proves it is a genuine mirror, not an accidental duplicate of rule 6's anchor wording).
  if (!/unstated-assumption gap/i.test(block)) {
    throw new Error(
      'Family F user prompt rule-7 block does not anchor the unstated-assumption gap',
    );
  }

  // The rule-7 block must restate the false→null / true→string convention and the validator path.
  if (!/When\s+false,\s+the\s+value\s+MUST\s+be\s+null/i.test(block)) {
    throw new Error(
      'Family F user prompt rule-7 block does not restate the false→null convention',
    );
  }
  if (
    !/validator[\s\S]*?evidenceSpan\.unstated_assumption/i.test(block)
  ) {
    throw new Error(
      'Family F user prompt rule-7 block does not close with the validator-path sentence at evidenceSpan.unstated_assumption',
    );
  }

  // DOCTRINE (shape-only): the rule-7 clause is JSON-type-shape reinforcement ONLY.
  // It MUST NOT introduce any quality / verdict / fallacy framing. This is an
  // isolated banned-token scan over the new clause alone (mirrors the
  // STRICT-RESPONSE-SHAPE-CONTRACT block scan below but scoped to rule 7).
  const bannedPatterns: RegExp[] = [
    /\bfallacy\b/i,
    /\bfallacious\b/i,
    /\bweak\b/i,
    /\binvalid\b/i,
    /\bflawed\b/i,
    /\bwrong\b/i,
    /\bbad\s+reasoning\b/i,
    /\blogical\s+error\b/i,
    /\bproves\s+wrong\b/i,
    /\brefutes\b/i,
    /\binvalidates\b/i,
    /\bunmet-means-fallacy\b/i,
    /\bwinner\b/i,
    /\bloser\b/i,
    /\bliar\b/i,
    /\bdishonest\b/i,
  ];
  for (const re of bannedPatterns) {
    if (re.test(block)) {
      throw new Error(
        `rule-7 unstated_assumption RAWKEY-SHAPE REINFORCEMENT introduces banned doctrine token matching ${re}`,
      );
    }
  }
});

Deno.test('Family F user prompt: response-shape guardrail block does not introduce banned verdict tokens', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  // The existing F prompt uses doctrine-risk tokens (fallacy, fallacious,
  // weak, invalid, flawed, wrong, bad reasoning, proves wrong, refutes,
  // invalidates, unmet-means-fallacy) only in NEGATION form ("never a
  // fallacy", "NEVER means", etc.). The new STRICT RESPONSE-SHAPE
  // CONTRACT block must not introduce any of these in standalone or
  // positive-assertion form.
  const blockMatch = prompt.match(
    /STRICT\s+RESPONSE-SHAPE\s+CONTRACT[\s\S]*?(?=Conservative-positives bias|Answer each|Input to classify)/i,
  );
  if (!blockMatch) {
    throw new Error('Could not isolate the STRICT RESPONSE-SHAPE CONTRACT block for scanning');
  }
  const block = blockMatch[0];
  const bannedPatterns: RegExp[] = [
    /\bfallacy\b/i,
    /\bfallacious\b/i,
    /\binvalid\b/i,
    /\bflawed\b/i,
    /\bwrong\b/i,
    /\bweak\s+argument\b/i,
    /\bbad\s+reasoning\b/i,
    /\blogical\s+error\b/i,
    /\bproof\s+of\b/i,
    /\bproves\s+wrong\b/i,
    /\brefutes\b/i,
    /\binvalidates\b/i,
    /\bunmet-means-fallacy\b/i,
  ];
  for (const re of bannedPatterns) {
    if (re.test(block)) {
      throw new Error(
        `STRICT RESPONSE-SHAPE CONTRACT block introduces banned token matching ${re}`,
      );
    }
  }
});

// OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — the shared response-envelope emission
// directive is interpolated immediately before the response-shape JSON example.
// Additive: the response-shape example itself is unchanged.
Deno.test('MODELINFO-SHAPE: Family F user prompt carries the modelInfo emission directive immediately before the response-shape example', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  const directiveIndex = prompt.indexOf(MODEL_INFO_EMISSION_DIRECTIVE);
  if (directiveIndex < 0) {
    throw new Error('Family F user prompt missing the modelInfo emission directive');
  }
  const definitionsIndex = prompt.indexOf('Definitions and examples');
  const anchorIndex = prompt.indexOf('The object MUST conform to this shape:');
  if (!(directiveIndex > definitionsIndex)) {
    throw new Error('directive must appear after the definitions block');
  }
  if (!(directiveIndex < anchorIndex)) {
    throw new Error('directive must appear before the response-shape example');
  }
  const between = prompt.slice(directiveIndex + MODEL_INFO_EMISSION_DIRECTIVE.length, anchorIndex);
  if (between.trim() !== '') {
    throw new Error('directive is not immediately before the response-shape example');
  }
});

Deno.test('MODELINFO-SHAPE: Family F response-shape JSON example is unchanged by the directive', () => {
  const prompt = buildFamilyFUserPrompt(buildRequest());
  for (
    const fragment of [
      '"provider": "mcp"',
      '"serverName": "<server identifier>"',
      '"classifierSetVersion": "family-f-v1"',
    ]
  ) {
    if (!prompt.includes(fragment)) {
      throw new Error(`Family F response-shape example missing/altered fragment: ${fragment}`);
    }
  }
  if (prompt.split(MODEL_INFO_EMISSION_DIRECTIVE).length !== 2) {
    throw new Error('the modelInfo emission directive must appear exactly once');
  }
});
