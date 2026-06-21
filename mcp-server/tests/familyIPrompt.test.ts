/**
 * MCP-SERVER-010-FAMILY-I — Family I prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 6 Family I rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every flag
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B/C/D/E/F/G/H's
 *   - System prompt contains the topology↔verdict CRITICAL-DOCTRINE block verbatim
 *   - System prompt contains the 2 misreadable-key doctrine anchors
 *   - Per-key falsePositiveGuards for the 2 misreadable keys contain verbatim guards
 *   - Doctrine ban-list scan of the system prompt returns hits only in negation form
 *   - Subset prompt request only includes requested rawKeys in questions block
 *   - rawKeys filter rejects non-I keys (incl. the 15 excluded deterministic keys)
 *   - FAMILY_I_MAX_TOKENS === 1500 (matches Family A/B/C/E/F/G/H; NO bump per design §A.2)
 *   - FAMILY_I_TEMPERATURE === 0
 *   - FAMILY_I_MAX_BODY_FIELD_LEN === 8000
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_I_SYSTEM_PROMPT,
  FAMILY_I_MAX_TOKENS,
  FAMILY_I_TEMPERATURE,
  FAMILY_I_MAX_BODY_FIELD_LEN,
  buildFamilyIUserPrompt,
  type ValidatedFamilyIRequest,
} from '../lib/familyIPrompt.ts';
import {
  FAMILY_I_RAW_KEYS,
  FAMILY_I_PROMPT_ENTRIES,
  FAMILY_I_CLASSIFIER_SET_VERSION,
} from '../lib/familyIKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from '../lib/modelInfoEmissionDirective.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';
import { FAMILY_C_SYSTEM_PROMPT } from '../lib/familyCPrompt.ts';
import { FAMILY_D_SYSTEM_PROMPT } from '../lib/familyDPrompt.ts';
import { FAMILY_E_SYSTEM_PROMPT } from '../lib/familyEPrompt.ts';
import { FAMILY_F_SYSTEM_PROMPT } from '../lib/familyFPrompt.ts';
import { FAMILY_G_SYSTEM_PROMPT } from '../lib/familyGPrompt.ts';
import { FAMILY_H_SYSTEM_PROMPT } from '../lib/familyHPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyIRequest> = {}): ValidatedFamilyIRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-i-1',
    parentNodeId: 'parent-node-i-1',
    currentText: "Worth thinking about museum funding too — that's a different question.",
    parentText: 'A debate over whether library funding should be increased.',
    threadContextExcerpt: 'Discussion of public library funding levels.',
    requestedFamilies: ['thread_topology'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family I system prompt contains the 7 absolute rules byte-equal to Family A, B, C, D, E, F, G, and H', () => {
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
    if (!FAMILY_I_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family I system prompt missing absolute rule: ${rule}`);
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
    if (!FAMILY_H_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family H system prompt missing absolute rule (parity check): ${rule}`);
    }
  }
});

Deno.test('Family I system prompt contains the thread-topology descriptive-structure framing', () => {
  const framing = [
    'exhibits one or more THREAD-TOPOLOGY structural',
    'whether the move introduces a new issue distinct from',
    'CRITICAL DOCTRINE — thread-topology relations are DESCRIPTIVE STRUCTURE, never verdicts',
    'describes HOW A MOVE RELATES TO THE CONVERSATION GRAPH',
    'Conservative-positives bias',
    '0 to 2',
  ];
  for (const fragment of framing) {
    if (!FAMILY_I_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family I system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family I system prompt contains the topology↔verdict CRITICAL-DOCTRINE block verbatim', () => {
  // Design §A.3.1 BINDING: the system prompt MUST explicitly forbid the
  // model from framing thread-topology relations as verdicts.
  const expectedFragments = [
    'A thread-topology observation describes HOW A MOVE RELATES TO THE CONVERSATION GRAPH',
    'A new issue is not a derailment.',
    'Introducing a new issue is a structural branching event',
    'Returning to a prior issue is not repetition.',
    'returning to a parked issue is often productive when it brings new evidence',
    'Referencing external context is not authority by popularity.',
    'popularity / virality / engagement of an external source is NOT',
    'Comparing options is not picking a winner.',
    'records the STRUCTURE of the comparison, not an adjudication',
    'The output MUST NOT contain the words: off-topic, derailing, derail, evasive, evading,',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_I_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(
        `Family I system prompt missing topology↔verdict doctrine fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family I MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_I_MAX_TOKENS, 1500);
  assertEquals(FAMILY_I_TEMPERATURE, 0);
  assertEquals(FAMILY_I_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family I user prompt (default request) includes all 6 rawKeys', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  for (const rawKey of FAMILY_I_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family I user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family I user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  for (const entry of FAMILY_I_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family I prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family I prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family I prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family I user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  for (const entry of FAMILY_I_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family I prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family I prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family I prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family I user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family I prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family I prompt missing confidence band enumeration');
  }
  // MCP-EGI-002: the weak two-rule hint ("Every key in observations MUST also
  // appear in confidence") was replaced by the STRICT RESPONSE-SHAPE CONTRACT
  // block (parity with Family E). The intent — that observations / confidence
  // / evidenceSpan keys must coordinate — is preserved and strengthened.
  const referencesObservations = /\bobservations\b/.test(prompt);
  const referencesConfidence = /\bconfidence\b/.test(prompt);
  const assertsCoordination =
    /(identical|same\s+exact|exactly\s+the\s+same)/i.test(prompt) &&
    /(checkedRawKeys|observations|confidence|evidenceSpan)[\s\S]{0,800}?(checkedRawKeys|observations|confidence|evidenceSpan)/i.test(
      prompt,
    );
  if (!(referencesObservations && referencesConfidence && assertsCoordination)) {
    throw new Error(
      'Family I prompt missing observations/confidence coordination requirement (expected the STRICT RESPONSE-SHAPE CONTRACT block)',
    );
  }
});

Deno.test('Family I user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family I prompt missing schemaVersion literal');
  }
});

Deno.test('Family I user prompt declares classifierSetVersion family-i-v1', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_I_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family I prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-i-v1')) {
    throw new Error('Family I prompt does not literally contain "family-i-v1"');
  }
});

Deno.test('Family I user prompt includes the descriptive-structure cross-key framing note', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  if (!prompt.includes('Note about thread-topology relations as DESCRIPTIVE STRUCTURE')) {
    throw new Error('Family I prompt missing descriptive-structure note header');
  }
  if (!prompt.includes('NONE of these is a verdict')) {
    throw new Error('Family I prompt missing "NONE of these is a verdict" anchor');
  }
  // NOTE: the user-prompt note is hand-wrapped, so assert wrap-safe single-
  // line subspans (the full "A new issue is not a derailment" phrase straddles
  // a newline in the template literal).
  if (!prompt.includes('is not a derailment')) {
    throw new Error('Family I prompt missing new-issue-as-branching anchor in user prompt');
  }
  if (!prompt.includes('is not repetition')) {
    throw new Error('Family I prompt missing return-as-re-engagement anchor in user prompt');
  }
  if (!prompt.includes('is not picking a winner')) {
    throw new Error('Family I prompt missing comparison-as-structure anchor in user prompt');
  }
});

Deno.test('Family I user prompt includes adversarial-verdict-word handling instruction', () => {
  // Design §A.4 D4 BINDING: Fixtures C/D input contains verdict words
  // ("off-topic"/"dodging"/"rehashing"/"going in circles"); the model must
  // not echo the framing. The user prompt MUST tell the model this.
  const prompt = buildFamilyIUserPrompt(buildRequest());
  if (!prompt.includes("If the move's text itself contains verdict words")) {
    throw new Error('Family I prompt missing adversarial-verdict-word instruction');
  }
  if (!prompt.includes('your output evidenceSpan MUST NOT echo the verdict')) {
    throw new Error('Family I prompt missing "MUST NOT echo" instruction');
  }
});

Deno.test('Family I user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_I_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_I_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_I_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-i-node-id-test-42',
  });
  const prompt = buildFamilyIUserPrompt(request);
  if (!prompt.includes('UNIQUE_I_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family I prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_I_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family I prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_I_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family I prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-i-node-id-test-42')) {
    throw new Error('Family I prompt missing nodeId');
  }
});

Deno.test('Family I user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyIUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family I prompt missing root-move parentText rendering');
  }
});

Deno.test('Family I user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['introduces_new_issue', 'returns_to_prior_issue'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyIUserPrompt(request);

  for (const rawKey of subset) {
    const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  const questionsBlockStart = prompt.indexOf('Thread-topology questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing thread-topology-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['references_prior_agreement', 'introduces_sub_axis', 'compares_options'];
  for (const rawKey of nonRequestedKeys) {
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family I user prompt with empty requestedRawKeys includes all 6 in the questions block', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Thread-topology questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  for (const rawKey of FAMILY_I_RAW_KEYS) {
    if (!questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Empty-rawKeys prompt missing rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family I user prompt rejects non-Family-I rawKeys via filter (cross-family safety)', () => {
  // If the caller mistakenly passes a Family A/B/C/D/E/F/G/H rawKey OR one of
  // the 15 excluded deterministic Family I keys, the filter drops it (the
  // validator at the dispatcher layer also rejects).
  const request = buildRequest({
    requestedRawKeys: [
      'introduces_new_issue',
      'supports_parent',
      'concedes_broader_point',
      'has_reply',
      'splits_thread',
      'open',
    ],
  });
  const prompt = buildFamilyIUserPrompt(request);
  if (!prompt.includes('introduces_new_issue')) {
    throw new Error('Family I prompt missing valid Family I rawKey introduces_new_issue');
  }
  const questionsBlockStart = prompt.indexOf('Thread-topology questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  // Cross-family + excluded-deterministic keys filtered out of the questions block.
  for (const dropped of [
    'supports_parent',
    'concedes_broader_point',
    'has_reply',
    'splits_thread',
    'open',
  ]) {
    if (questionsBlock.includes(`- ${dropped}:`)) {
      throw new Error(`Family I prompt incorrectly includes non-I key ${dropped} in questions block`);
    }
  }
});

Deno.test('Family I introduces_new_issue prompt entry surfaces verbatim doctrine guards (misreadable key)', () => {
  const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === 'introduces_new_issue');
  if (!entry) throw new Error('introduces_new_issue prompt entry missing');
  const expectedFragments = [
    'introducing a new issue is a structural BRANCHING event',
    'It is NEVER framed as "off-topic", "derailing", "evasive"',
    'The output MUST NOT contain: off-topic, derailing, evasive, dodging',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `introduces_new_issue falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('Family I returns_to_prior_issue prompt entry surfaces verbatim doctrine guards (misreadable key)', () => {
  const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === 'returns_to_prior_issue');
  if (!entry) throw new Error('returns_to_prior_issue prompt entry missing');
  const expectedFragments = [
    'returning to a prior issue is a structural RE-ENGAGEMENT',
    'It is NEVER framed as "rehashing", "repetitive", "going in circles"',
    'The output MUST NOT contain: rehashing, repetitive, "going in circles"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `returns_to_prior_issue falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family I system prompt contains shared banned tokens only in negation form', () => {
  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

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
    while ((match = globalPattern.exec(FAMILY_I_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_I_SYSTEM_PROMPT, match.index);
      const context = contextLinesForMatch(FAMILY_I_SYSTEM_PROMPT, match.index).join(' ');
      const isNegation =
        line.includes(' NOT ') ||
        line.includes('NOT decide') ||
        line.includes('NOT treat') ||
        line.includes('MUST NOT') ||
        line.includes('NEVER') ||
        line.includes(' never ') ||
        line.includes('never a verdict') ||
        line.includes('not a verdict') ||
        line.includes('not a derailment') ||
        line.includes('not repetition') ||
        line.includes('not picking') ||
        line.includes('not authority') ||
        context.includes('MUST NOT contain') ||
        context.includes('MUST NOT echo') ||
        context.includes('You do NOT') ||
        context.includes('NEVER') ||
        context.includes(' never ') ||
        context.includes('not a verdict');
      if (!isNegation) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family I system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}" (context: "${context}")`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('Family I user prompt questions block has exactly 6 lines for the default (empty) request', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Thread-topology questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const matches = questionsBlock.match(/^- [a-z_]+:/gm);
  if (!matches) throw new Error('questions block produced no rawKey lines');
  assertEquals(matches.length, 6);
});

Deno.test('Family I 2 misreadable keys each carry the "MUST NOT contain" enumeration verbatim', () => {
  const misreadableKeys = ['introduces_new_issue', 'returns_to_prior_issue'];
  for (const rawKey of misreadableKeys) {
    const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`${rawKey} prompt entry missing`);
    if (!entry.falsePositiveGuards.includes('MUST NOT contain')) {
      throw new Error(
        `${rawKey} falsePositiveGuards missing "MUST NOT contain" enumeration (misreadable-key binding)`,
      );
    }
  }
});

// ── MCP-EGI-002 — Family I strict response-shape contract + compares_options
//                  per-key reinforcement ──
//
// 2026-06-21 D3 surfaced hosted-MCP `validation_failed` at path
// `evidenceSpan.compares_options` after Anthropic HTTP 200, masked by the
// Edge as `provider_server_error`. The Family I prompt previously carried only
// a weak two-rule coordination hint. This card lifts Family E's STRICT
// RESPONSE-SHAPE CONTRACT block into Family I and adds rule 6 for
// compares_options. The exact live rejected shape was NOT confirmed (the
// validator detail is structurally suppressed); these tests guard all four
// possible live shapes — length>240, value-type, missing entry, extra entry —
// without claiming which one occurred.

Deno.test('Family I user prompt: declares a strict response-shape contract block (MCP-EGI-002)', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  if (!/STRICT\s+RESPONSE-SHAPE\s+CONTRACT/i.test(prompt)) {
    throw new Error(
      'Family I user prompt is missing the STRICT RESPONSE-SHAPE CONTRACT block (MCP-EGI-002)',
    );
  }
});

Deno.test('Family I user prompt: enforces bidirectional key-set equality across the four maps (MCP-EGI-002)', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  const referencesAllFour =
    /checkedRawKeys/.test(prompt) &&
    /observations/.test(prompt) &&
    /confidence/.test(prompt) &&
    /evidenceSpan/.test(prompt);
  if (!referencesAllFour) {
    throw new Error(
      'Family I user prompt does not reference all four packet maps (checkedRawKeys / observations / confidence / evidenceSpan)',
    );
  }
  const equalityAsserted =
    /(identical|same\s+exact|key[-\s]set\s+equality|exactly\s+(once|the\s+same))/i.test(
      prompt,
    );
  if (!equalityAsserted) {
    throw new Error(
      'Family I user prompt does not assert bidirectional key-set equality across the four packet maps',
    );
  }
  if (!/no\s+extras?[,\s]+no\s+omissions?/i.test(prompt)) {
    throw new Error(
      'Family I user prompt does not contain the "no extras, no omissions" packet-shape guardrail',
    );
  }
});

Deno.test('Family I user prompt: forbids object / array / boolean / number in evidenceSpan values (MCP-EGI-002)', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  const forbids = (token: string) =>
    new RegExp(`(NEVER|never|no)\\s+(a\\s+|an\\s+)?${token}`, 'i').test(prompt);
  for (const token of ['object', 'array', 'boolean', 'number']) {
    if (!forbids(token)) {
      throw new Error(
        `Family I user prompt does not forbid evidenceSpan value type "${token}"`,
      );
    }
  }
  if (!/string.*null|null.*string/is.test(prompt)) {
    throw new Error(
      'Family I user prompt does not enumerate string-or-null as the allowed evidenceSpan value types',
    );
  }
  if (!/240/.test(prompt)) {
    throw new Error(
      'Family I user prompt does not cite the 240-character evidenceSpan length cap',
    );
  }
});

Deno.test('Family I user prompt: prescribes null evidenceSpan for false observations (MCP-EGI-002)', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  const negativeNullRule =
    /(observations\[\s*rawKey\s*\]|observations\[[^\]]*\])\s+is\s+false[^.]*?null/is.test(
      prompt,
    ) || /false[^.]*?evidenceSpan[^.]*?null/is.test(prompt);
  if (!negativeNullRule) {
    throw new Error(
      'Family I user prompt does not prescribe null evidenceSpan for false observations',
    );
  }
});

Deno.test('Family I user prompt: directs a self-check before emitting the JSON (MCP-EGI-002)', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  const selfCheckPresent =
    /(SELF-CHECK|before\s+you\s+(return|emit|output))/i.test(prompt) &&
    /(verify|regenerate|each\s+check\s+fails)/i.test(prompt);
  if (!selfCheckPresent) {
    throw new Error(
      'Family I user prompt does not direct a self-check before emitting the JSON',
    );
  }
});

Deno.test('Family I user prompt: declares per-rawKey shape reinforcement for compares_options (MCP-EGI-002 rule 6)', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  if (!/evidenceSpan\.compares_options/.test(prompt)) {
    throw new Error(
      'Family I user prompt RAWKEY-SHAPE REINFORCEMENT does not name evidenceSpan.compares_options (MCP-EGI-002)',
    );
  }
  const blockMatch = prompt.match(
    /RAWKEY-SHAPE\s+REINFORCEMENT\s+—\s+compares_options[\s\S]*?(?=RAWKEY-SHAPE\s+REINFORCEMENT|Conservative-positives\s+bias|Answer\s+each|Input\s+to\s+classify)/i,
  );
  if (!blockMatch) {
    throw new Error('Could not isolate compares_options reinforcement block');
  }
  const block = blockMatch[0];
  for (const token of ['object', 'array', 'boolean', 'number']) {
    if (!new RegExp(`\\b${token}\\b`, 'i').test(block)) {
      throw new Error(
        `compares_options reinforcement does not list "${token}" as not allowed`,
      );
    }
  }
  if (!/240/.test(block)) {
    throw new Error(
      'compares_options reinforcement does not cite the 240-char cap',
    );
  }
  if (!/missing\s+entry/i.test(block)) {
    throw new Error(
      'compares_options reinforcement does not name missing-entry shape',
    );
  }
  if (!/(string\s+up\s+to\s+240|JSON\s+string\s+up\s+to\s+240)/i.test(block)) {
    throw new Error(
      'compares_options reinforcement does not enumerate the allowed string-up-to-240 shape',
    );
  }
  if (!/\bnull\b/.test(block)) {
    throw new Error(
      'compares_options reinforcement does not enumerate the allowed null shape',
    );
  }
});

Deno.test('Family I user prompt: STRICT block does not introduce banned verdict tokens (MCP-EGI-002)', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  const blockMatch = prompt.match(
    /STRICT\s+RESPONSE-SHAPE\s+CONTRACT[\s\S]*?(?=Conservative-positives bias)/i,
  );
  if (!blockMatch) {
    throw new Error('Could not isolate the STRICT RESPONSE-SHAPE CONTRACT block for scanning');
  }
  const block = blockMatch[0];
  // Family I doctrine bans verdict tokens (off-topic / derailing / evasive /
  // dodging / rehashing / repetitive / "going in circles" / winner / loser).
  const bannedPatterns: RegExp[] = [
    /\boff-topic\b/i,
    /\bderailing\b/i,
    /\bevasive\b/i,
    /\bdodging\b/i,
    /\brehashing\b/i,
    /\brepetitive\b/i,
    /\bgoing\s+in\s+circles\b/i,
    /\bwinner\b/i,
    /\bloser\b/i,
  ];
  for (const re of bannedPatterns) {
    if (re.test(block)) {
      throw new Error(
        `Family I STRICT RESPONSE-SHAPE CONTRACT block introduces banned verdict token matching ${re}`,
      );
    }
  }
});

// OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — the shared response-envelope emission
// directive is interpolated immediately before the response-shape JSON example.
// Additive: the response-shape example itself is unchanged.
Deno.test('MODELINFO-SHAPE: Family I user prompt carries the modelInfo emission directive immediately before the response-shape example', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  const directiveIndex = prompt.indexOf(MODEL_INFO_EMISSION_DIRECTIVE);
  if (directiveIndex < 0) {
    throw new Error('Family I user prompt missing the modelInfo emission directive');
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

Deno.test('MODELINFO-SHAPE: Family I response-shape JSON example is unchanged by the directive', () => {
  const prompt = buildFamilyIUserPrompt(buildRequest());
  for (
    const fragment of [
      '"provider": "mcp"',
      '"serverName": "<server identifier>"',
      '"classifierSetVersion": "family-i-v1"',
    ]
  ) {
    if (!prompt.includes(fragment)) {
      throw new Error(`Family I response-shape example missing/altered fragment: ${fragment}`);
    }
  }
  if (prompt.split(MODEL_INFO_EMISSION_DIRECTIVE).length !== 2) {
    throw new Error('the modelInfo emission directive must appear exactly once');
  }
});
