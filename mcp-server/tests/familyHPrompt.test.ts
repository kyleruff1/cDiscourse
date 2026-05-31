/**
 * MCP-SERVER-009-FAMILY-H — Family H prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 12 Family H rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every flag
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B/C/D/E/F/G's
 *   - System prompt contains the clarity↔verdict CRITICAL-DOCTRINE block verbatim
 *   - System prompt contains the 4 HIGHEST-risk axis-partner doctrine anchors
 *   - Per-key falsePositiveGuards for the 4 HIGHEST-risk keys contain verbatim guards
 *   - Doctrine ban-list scan of the system prompt returns hits only in negation form
 *   - Subset prompt request only includes requested rawKeys in questions block
 *   - FAMILY_H_MAX_TOKENS === 1500 (matches Family A/B/C/E/F/G; NO bump per design §A.2)
 *   - FAMILY_H_TEMPERATURE === 0
 *   - FAMILY_H_MAX_BODY_FIELD_LEN === 8000
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_H_SYSTEM_PROMPT,
  FAMILY_H_MAX_TOKENS,
  FAMILY_H_TEMPERATURE,
  FAMILY_H_MAX_BODY_FIELD_LEN,
  buildFamilyHUserPrompt,
  type ValidatedFamilyHRequest,
} from '../lib/familyHPrompt.ts';
import {
  FAMILY_H_RAW_KEYS,
  FAMILY_H_PROMPT_ENTRIES,
  FAMILY_H_CLASSIFIER_SET_VERSION,
} from '../lib/familyHKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';
import { FAMILY_C_SYSTEM_PROMPT } from '../lib/familyCPrompt.ts';
import { FAMILY_D_SYSTEM_PROMPT } from '../lib/familyDPrompt.ts';
import { FAMILY_E_SYSTEM_PROMPT } from '../lib/familyEPrompt.ts';
import { FAMILY_F_SYSTEM_PROMPT } from '../lib/familyFPrompt.ts';
import { FAMILY_G_SYSTEM_PROMPT } from '../lib/familyGPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyHRequest> = {}): ValidatedFamilyHRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-h-1',
    parentNodeId: 'parent-node-h-1',
    currentText: 'Carbon taxes work.',
    parentText: 'A debate over whether carbon taxes reduce emissions generally.',
    threadContextExcerpt: 'Discussion of carbon-tax effectiveness across jurisdictions.',
    requestedFamilies: ['claim_clarity'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family H system prompt contains the 7 absolute rules byte-equal to Family A, B, C, D, E, F, and G', () => {
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
    if (!FAMILY_H_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family H system prompt missing absolute rule: ${rule}`);
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
    if (!FAMILY_G_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family G system prompt missing absolute rule (parity check): ${rule}`);
    }
  }
});

Deno.test('Family H system prompt contains the claim-clarity descriptive-formulation framing', () => {
  const framing = [
    'exhibits one or more CLAIM-CLARITY structural',
    'a claim explicitly stated or absent, a reason attached or absent',
    'CRITICAL DOCTRINE — claim-clarity states are DESCRIPTIVE FORMULATION-STATE, never verdicts',
    'describes the SURFACE FORMULATION of a move',
    'Conservative-positives bias',
    // The "most moves have 1 to 3 positives" phrase is hand-wrapped in the
    // system prompt as `most\nmoves have 1 to 3 positives`; assert the
    // unique-enough subspan.
    '1 to 3 positives',
  ];
  for (const fragment of framing) {
    if (!FAMILY_H_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family H system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family H system prompt contains the clarity↔verdict CRITICAL-DOCTRINE block verbatim', () => {
  // Design §A.3.1 BINDING: the system prompt MUST explicitly forbid the
  // model from framing claim-clarity states as verdicts.
  // Note: the system prompt is hand-wrapped, so each asserted fragment is
  // a unique-enough single-line subspan that survives word wrapping.
  const expectedFragments = [
    'A claim-clarity observation describes the SURFACE FORMULATION of a move',
    'It NEVER asserts whether the move is "weak", "strong",',
    'Absence is not failure.',
    'ABSENCE OF A STATED CONCLUSION',
    'No reason attached is not unsupported.',
    'ABSENCE OF AN ATTACHED REASON',
    'Broad is not weak.',
    'records the structural BREADTH OF',
    'a different SHAPE, not a lower QUALITY',
    'Unclear reference is not speaker error.',
    'records the structural REFERENCE AMBIGUITY',
    'The output MUST NOT contain the words: weak, sloppy, lazy, careless, confused, unsound,',
    'unsupported, incoherent, illogical, "bad reasoning", "bad argument", "bad writing",',
    'its own output evidence_span MUST NOT echo the',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_H_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(
        `Family H system prompt missing clarity↔verdict doctrine fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family H MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_H_MAX_TOKENS, 1500);
  assertEquals(FAMILY_H_TEMPERATURE, 0);
  assertEquals(FAMILY_H_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family H user prompt (default request) includes all 12 rawKeys', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest());
  for (const rawKey of FAMILY_H_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family H user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family H user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest());
  for (const entry of FAMILY_H_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family H prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family H prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family H prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family H user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest());
  for (const entry of FAMILY_H_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family H prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family H prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family H prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family H user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family H prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family H prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family H prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family H user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family H prompt missing schemaVersion literal');
  }
});

Deno.test('Family H user prompt declares classifierSetVersion family-h-v1', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_H_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family H prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-h-v1')) {
    throw new Error('Family H prompt does not literally contain "family-h-v1"');
  }
});

Deno.test('Family H user prompt includes the descriptive-formulation cross-key framing note', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest());
  if (!prompt.includes('Note about claim-clarity states as DESCRIPTIVE FORMULATION-STATE')) {
    throw new Error('Family H prompt missing descriptive-formulation note header');
  }
  if (!prompt.includes('NONE of these is a verdict')) {
    throw new Error('Family H prompt missing "NONE of these is a verdict" anchor');
  }
  if (!prompt.includes('Absence is not failure')) {
    throw new Error('Family H prompt missing absence-as-formulation anchor in user prompt');
  }
  if (!prompt.includes('Broad is not weak')) {
    throw new Error('Family H prompt missing broad-as-shape anchor in user prompt');
  }
  if (!prompt.includes('Unclear reference is not speaker')) {
    throw new Error('Family H prompt missing unclear-reference-as-structural anchor in user prompt');
  }
});

Deno.test('Family H user prompt includes adversarial-verdict-word handling instruction', () => {
  // Design §A.4 D4 BINDING: Fixtures C/D/E/F input contains verdict words
  // ("weak"/"sloppy"/"unsupported"/"lazy"/"unclear"); the model must not
  // echo the framing. The user prompt MUST tell the model this.
  const prompt = buildFamilyHUserPrompt(buildRequest());
  if (!prompt.includes("If the move's text itself contains verdict words")) {
    throw new Error('Family H prompt missing adversarial-verdict-word instruction');
  }
  if (!prompt.includes('your output evidenceSpan MUST NOT echo the verdict')) {
    throw new Error('Family H prompt missing "MUST NOT echo" instruction');
  }
});

Deno.test('Family H user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_H_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_H_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_H_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-h-node-id-test-42',
  });
  const prompt = buildFamilyHUserPrompt(request);
  if (!prompt.includes('UNIQUE_H_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family H prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_H_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family H prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_H_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family H prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-h-node-id-test-42')) {
    throw new Error('Family H prompt missing nodeId');
  }
});

Deno.test('Family H user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyHUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family H prompt missing root-move parentText rendering');
  }
});

Deno.test('Family H user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['claim_specificity_low', 'conclusion_missing', 'reason_missing'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyHUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the questions block.
  const questionsBlockStart = prompt.indexOf('Claim-clarity questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing claim-clarity-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['provides_temporal_constraint', 'hedging_present', 'modal_language_present'];
  for (const rawKey of nonRequestedKeys) {
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family H user prompt with empty requestedRawKeys includes all 12 in the questions block', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Claim-clarity questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  for (const rawKey of FAMILY_H_RAW_KEYS) {
    if (!questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Empty-rawKeys prompt missing rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family H user prompt rejects non-Family-H rawKeys via filter (cross-family safety)', () => {
  // If the caller mistakenly passes a Family A/B/C/D/E/F/G rawKey, the
  // filter drops it (the validator at the dispatcher layer also rejects,
  // but the prompt builder is defensive).
  const request = buildRequest({
    requestedRawKeys: [
      'claim_specificity_low',
      'supports_parent',
      'disputes_definition',
      'concedes_broader_point',
    ],
  });
  const prompt = buildFamilyHUserPrompt(request);
  // Family H key included.
  if (!prompt.includes('claim_specificity_low')) {
    throw new Error('Family H prompt missing valid Family H rawKey claim_specificity_low');
  }
  // Family A / B / G keys filtered out of the questions block.
  const questionsBlockStart = prompt.indexOf('Claim-clarity questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  if (questionsBlock.includes('- supports_parent:')) {
    throw new Error('Family H prompt incorrectly includes Family A key supports_parent in questions block');
  }
  if (questionsBlock.includes('- disputes_definition:')) {
    throw new Error('Family H prompt incorrectly includes Family B key disputes_definition in questions block');
  }
  if (questionsBlock.includes('- concedes_broader_point:')) {
    throw new Error('Family H prompt incorrectly includes Family G key concedes_broader_point in questions block');
  }
});

Deno.test('Family H claim_specificity_low prompt entry surfaces verbatim doctrine guards (HIGHEST RISK axis-partner)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'claim_specificity_low');
  if (!entry) throw new Error('claim_specificity_low prompt entry missing');
  const expectedFragments = [
    'a broad claim is a structural SHAPE',
    'NEVER framed as "weak", "vague", "lazy", "sloppy"',
    'The evidence_span MUST anchor the verbatim broad-scoped wording',
    'its output MUST NOT echo "weak"/"vague"/"sloppy"/"lazy"',
    'The output MUST NOT contain: weak, sloppy, lazy, careless, confused, unsound, unsupported, incoherent, illogical',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `claim_specificity_low falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family H conclusion_missing prompt entry surfaces verbatim doctrine guards (HIGHEST RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'conclusion_missing');
  if (!entry) throw new Error('conclusion_missing prompt entry missing');
  const expectedFragments = [
    'absence of a stated conclusion is a structural FORMULATION CHOICE',
    'It is NEVER framed as "argument is incomplete"',
    'The output MUST NOT contain: incomplete, unfinished',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `conclusion_missing falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family H reason_missing prompt entry surfaces verbatim doctrine guards (HIGHEST RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'reason_missing');
  if (!entry) throw new Error('reason_missing prompt entry missing');
  const expectedFragments = [
    'absence of an attached reason is a structural FORMULATION CHOICE',
    'It is NEVER framed as "argument is unsupported"',
    'The output MUST NOT contain: unsupported, ungrounded, unjustified',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `reason_missing falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family H unclear_reference_present prompt entry surfaces verbatim doctrine guards (HIGHEST RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'unclear_reference_present');
  if (!entry) throw new Error('unclear_reference_present prompt entry missing');
  const expectedFragments = [
    'presence of an ambiguous referring expression is a structural feature VISIBLE TO THE CLASSIFIER',
    'It is NEVER framed as the speaker being "unclear", "sloppy"',
    'The output MUST NOT contain: unclear (as speaker label)',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `unclear_reference_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family H system prompt contains shared banned tokens only in negation form', () => {
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
    while ((match = globalPattern.exec(FAMILY_H_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_H_SYSTEM_PROMPT, match.index);
      const context = contextLinesForMatch(FAMILY_H_SYSTEM_PROMPT, match.index).join(' ');
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
        context.includes('MUST NOT echo') ||
        context.includes('You do NOT') ||
        context.includes('NEVER') ||
        context.includes(' never ') ||
        context.includes('not a verdict');
      if (!isNegation) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family H system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}" (context: "${context}")`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('Family H prompt template: no clarity-as-verdict framing in any per-key prompt entry', () => {
  // Scan the rendered user prompt for tokens that would frame claim-clarity
  // states as verdicts (positive ASSERTIONS, not negations). NOTE: phrases
  // like "weak" appear in the prompt ONLY inside doctrine negations
  // ("NEVER framed as 'weak'" / "MUST NOT contain: weak"), so they are NOT
  // scanned here — the dedicated runtime ban-list scan
  // (familyHAdversarialDoctrine.test.ts) is the authoritative check for
  // verdict tokens in OUTPUT. These patterns catch positive-assertion
  // framings that must never appear in the prompt template (e.g., "the
  // move was clearly weak", "the speaker is unclear-and-sloppy"); they
  // require declarative-with-be-verb shape outside any quoted negation
  // context. Quote characters in the match exclude legitimate negation
  // enumerations like 'NEVER asserts whether the move is "weak"'.
  const prompt = buildFamilyHUserPrompt(buildRequest());
  const verdictFramingPatterns: RegExp[] = [
    /\bthe\s+move\s+(?:was|is)\s+clearly\s+weak\b/i,
    /\bthe\s+speaker\s+is\s+sloppy\b/i,
    /\bthe\s+(?:author|speaker)\s+failed\s+to\s+ground\b/i,
  ];
  for (const re of verdictFramingPatterns) {
    if (re.test(prompt)) {
      throw new Error(`Family H prompt contains clarity-as-verdict framing matching ${re}`);
    }
  }
});

Deno.test('Family H user prompt questions block has exactly 12 lines for the default (empty) request', () => {
  const prompt = buildFamilyHUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Claim-clarity questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  // Each line starts with "- <rawKey>:".
  const matches = questionsBlock.match(/^- [a-z_]+:/gm);
  if (!matches) throw new Error('questions block produced no rawKey lines');
  assertEquals(matches.length, 12);
});

Deno.test('Family H 4 HIGHEST-risk keys each carry the "MUST NOT contain" enumeration verbatim', () => {
  // The 4 HIGHEST-risk keys must each enumerate their forbidden output
  // words. This is the per-key doctrine binding from §A.3.2.
  const highestRiskKeys = [
    'claim_specificity_low',
    'conclusion_missing',
    'reason_missing',
    'unclear_reference_present',
  ];
  for (const rawKey of highestRiskKeys) {
    const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`${rawKey} prompt entry missing`);
    if (!entry.falsePositiveGuards.includes('MUST NOT contain')) {
      throw new Error(
        `${rawKey} falsePositiveGuards missing "MUST NOT contain" enumeration (HIGHEST-risk binding)`,
      );
    }
  }
});
