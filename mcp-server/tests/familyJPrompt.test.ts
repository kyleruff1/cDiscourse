/**
 * MCP-SERVER-011-FAMILY-J — Family J prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 5 Family J rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every flag
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B/C/D/E/F/G/H/I's
 *   - System prompt contains the §10a sensitive-composer CRITICAL-DOCTRINE block verbatim
 *   - System prompt contains the per-key doctrine anchors (person-shift, insult-only,
 *     pause, satire, popularity)
 *   - Per-key falsePositiveGuards for the verdict-adjacent keys contain verbatim guards
 *   - Doctrine ban-list scan of the system prompt returns hits only in negation form
 *   - Subset prompt request only includes requested rawKeys in questions block
 *   - rawKeys filter rejects non-J keys
 *   - FAMILY_J_MAX_TOKENS === 1500 (matches A/B/C/E/F/G/H/I; NO bump per design §4)
 *   - FAMILY_J_TEMPERATURE === 0
 *   - FAMILY_J_MAX_BODY_FIELD_LEN === 8000
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_J_SYSTEM_PROMPT,
  FAMILY_J_MAX_TOKENS,
  FAMILY_J_TEMPERATURE,
  FAMILY_J_MAX_BODY_FIELD_LEN,
  buildFamilyJUserPrompt,
  type ValidatedFamilyJRequest,
} from '../lib/familyJPrompt.ts';
import {
  FAMILY_J_RAW_KEYS,
  FAMILY_J_PROMPT_ENTRIES,
  FAMILY_J_CLASSIFIER_SET_VERSION,
} from '../lib/familyJKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';
import { FAMILY_C_SYSTEM_PROMPT } from '../lib/familyCPrompt.ts';
import { FAMILY_D_SYSTEM_PROMPT } from '../lib/familyDPrompt.ts';
import { FAMILY_E_SYSTEM_PROMPT } from '../lib/familyEPrompt.ts';
import { FAMILY_F_SYSTEM_PROMPT } from '../lib/familyFPrompt.ts';
import { FAMILY_G_SYSTEM_PROMPT } from '../lib/familyGPrompt.ts';
import { FAMILY_H_SYSTEM_PROMPT } from '../lib/familyHPrompt.ts';
import { FAMILY_I_SYSTEM_PROMPT } from '../lib/familyIPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyJRequest> = {}): ValidatedFamilyJRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-j-1',
    parentNodeId: 'parent-node-j-1',
    currentText: 'You only believe that because you work for an EV company.',
    parentText: 'EVs reduce urban pollution.',
    threadContextExcerpt: 'Discussion of EV adoption and urban air quality.',
    requestedFamilies: ['sensitive_composer'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family J system prompt contains the 7 absolute rules byte-equal to Family A-I', () => {
  const absoluteRules = [
    'You do NOT decide who is right in a debate.',
    'You do NOT decide the winner of any debate.',
    'You do NOT assign a truth value to any claim.',
    'You do NOT treat popularity, engagement, or virality as evidence.',
    "You do NOT describe, judge, or label the person — only the move's structure.",
    'You do NOT recommend hiding, deleting, or modifying any content.',
    'You do NOT block an ordinary post — your output is advisory metadata only.',
  ];
  const allPrompts = [
    FAMILY_A_SYSTEM_PROMPT,
    FAMILY_B_SYSTEM_PROMPT,
    FAMILY_C_SYSTEM_PROMPT,
    FAMILY_D_SYSTEM_PROMPT,
    FAMILY_E_SYSTEM_PROMPT,
    FAMILY_F_SYSTEM_PROMPT,
    FAMILY_G_SYSTEM_PROMPT,
    FAMILY_H_SYSTEM_PROMPT,
    FAMILY_I_SYSTEM_PROMPT,
    FAMILY_J_SYSTEM_PROMPT,
  ];
  for (const rule of absoluteRules) {
    for (const prompt of allPrompts) {
      if (!prompt.includes(rule)) {
        throw new Error(`A system prompt is missing absolute rule: ${rule}`);
      }
    }
  }
});

Deno.test('Family J system prompt preserves load-bearing rule #5 (do NOT label the person) verbatim', () => {
  if (!FAMILY_J_SYSTEM_PROMPT.includes("You do NOT describe, judge, or label the person — only the move's structure.")) {
    throw new Error('Family J system prompt missing the load-bearing person rule #5');
  }
});

Deno.test('Family J system prompt contains the sensitive-composer descriptive-structure framing', () => {
  const framing = [
    'exhibits one or more SENSITIVE-COMPOSER structural',
    "whether the move shifts focus from the parent's claim to the parent's poster",
    'CRITICAL DOCTRINE — sensitive-composer observations are PRIVATE STRUCTURAL NUDGES, never',
    "describes a STRUCTURAL FEATURE of the move's own text",
    'Conservative-positives bias',
    'most moves have 0 positives',
  ];
  for (const fragment of framing) {
    if (!FAMILY_J_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family J system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family J system prompt contains the §10a sensitive-composer CRITICAL-DOCTRINE block verbatim', () => {
  const expectedFragments = [
    'A sensitive-composer observation describes a STRUCTURAL FEATURE of the move',
    "shifts_to_person_or_intent records that the move's CONTENT addresses the parent's poster",
    'NEVER an "ad hominem" verdict, NEVER a "personal attack" label',
    'contains_unplayable_insult_only records the structural ABSENCE OF A PLAYABLE CLAIM',
    'needs_pre_send_pause records reactive / escalatory STRUCTURAL MARKERS',
    'uses_satire_as_evidence records that the text cites a satire / parody source as if it',
    'uses_popularity_as_evidence records that the text leans on how widely an idea is shared',
    'The output MUST NOT contain the words: troll, bot, astroturfer, toxic, hostile, abusive,',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_J_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family J system prompt missing sensitive-composer doctrine fragment: "${fragment}"`);
    }
  }
});

Deno.test('Family J MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_J_MAX_TOKENS, 1500);
  assertEquals(FAMILY_J_TEMPERATURE, 0);
  assertEquals(FAMILY_J_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family J user prompt (default request) includes all 5 rawKeys', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  for (const rawKey of FAMILY_J_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family J user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family J user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  for (const entry of FAMILY_J_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family J prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family J prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family J prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family J user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  for (const entry of FAMILY_J_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family J prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family J prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family J prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family J user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family J prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family J prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family J prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family J user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family J prompt missing schemaVersion literal');
  }
});

Deno.test('Family J user prompt declares classifierSetVersion family-j-v1', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_J_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family J prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-j-v1')) {
    throw new Error('Family J prompt does not literally contain "family-j-v1"');
  }
});

Deno.test('Family J user prompt includes the descriptive-structure cross-key framing note', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  if (!prompt.includes('Note about sensitive-composer observations as DESCRIPTIVE STRUCTURE')) {
    throw new Error('Family J prompt missing descriptive-structure note header');
  }
  if (!prompt.includes('NONE of these is a verdict on the person or their intent')) {
    throw new Error('Family J prompt missing "NONE of these is a verdict" anchor');
  }
  // Wrap-safe single-line subspans of the cross-key note (the leading "A "
  // straddles a newline in the template literal, so assert without it).
  if (!prompt.includes('person-shift is not a personal-attack verdict')) {
    throw new Error('Family J prompt missing person-shift-as-structure anchor in user prompt');
  }
});

Deno.test('Family J user prompt includes the slur-in-input handling instruction', () => {
  // Design §6: the model may detect the feature when the input contains a
  // slur, but the evidence_span MUST NOT echo it.
  const prompt = buildFamilyJUserPrompt(buildRequest());
  if (!prompt.includes("If the move's own text itself contains a slur or person label")) {
    throw new Error('Family J prompt missing slur-in-input instruction');
  }
  if (!prompt.includes('your output evidenceSpan MUST NOT echo the slur or')) {
    throw new Error('Family J prompt missing "MUST NOT echo" instruction');
  }
});

Deno.test('Family J user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_J_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_J_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_J_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-j-node-id-test-42',
  });
  const prompt = buildFamilyJUserPrompt(request);
  if (!prompt.includes('UNIQUE_J_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family J prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_J_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family J prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_J_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family J prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-j-node-id-test-42')) {
    throw new Error('Family J prompt missing nodeId');
  }
});

Deno.test('Family J user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyJUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family J prompt missing root-move parentText rendering');
  }
});

Deno.test('Family J user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['shifts_to_person_or_intent', 'needs_pre_send_pause'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyJUserPrompt(request);

  for (const rawKey of subset) {
    const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  const questionsBlockStart = prompt.indexOf('Sensitive-composer questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing sensitive-composer-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = [
    'contains_unplayable_insult_only',
    'uses_popularity_as_evidence',
    'uses_satire_as_evidence',
  ];
  for (const rawKey of nonRequestedKeys) {
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family J user prompt with empty requestedRawKeys includes all 5 in the questions block', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Sensitive-composer questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  for (const rawKey of FAMILY_J_RAW_KEYS) {
    if (!questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Empty-rawKeys prompt missing rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family J user prompt rejects non-Family-J rawKeys via filter (cross-family safety)', () => {
  const request = buildRequest({
    requestedRawKeys: [
      'shifts_to_person_or_intent',
      'supports_parent',
      'introduces_new_issue',
      'claim_specificity_low',
    ],
  });
  const prompt = buildFamilyJUserPrompt(request);
  if (!prompt.includes('shifts_to_person_or_intent')) {
    throw new Error('Family J prompt missing valid Family J rawKey shifts_to_person_or_intent');
  }
  const questionsBlockStart = prompt.indexOf('Sensitive-composer questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  for (const dropped of ['supports_parent', 'introduces_new_issue', 'claim_specificity_low']) {
    if (questionsBlock.includes(`- ${dropped}:`)) {
      throw new Error(`Family J prompt incorrectly includes non-J key ${dropped} in questions block`);
    }
  }
});

Deno.test('Family J shifts_to_person_or_intent prompt entry surfaces verbatim MAXIMAL doctrine guards', () => {
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'shifts_to_person_or_intent');
  if (!entry) throw new Error('shifts_to_person_or_intent prompt entry missing');
  const expectedFragments = [
    'DOCTRINE (MAXIMAL — axis-partner)',
    'MUST NOT echo any slur the move itself contains',
    'The output MUST NOT contain: troll, toxic, hostile, abusive, ad hominem, personal attack, bad actor',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(`shifts_to_person_or_intent falsePositiveGuards missing verbatim fragment: "${fragment}"`);
    }
  }
});

Deno.test('Family J uses_popularity_as_evidence prompt entry encodes the §3 boundary', () => {
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'uses_popularity_as_evidence');
  if (!entry) throw new Error('uses_popularity_as_evidence prompt entry missing');
  const expectedFragments = [
    'DOCTRINE (§3 anti-amplification)',
    'engagement credit and factual-standing eligibility are SEPARATE scores',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(`uses_popularity_as_evidence falsePositiveGuards missing verbatim fragment: "${fragment}"`);
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family J system prompt contains shared banned tokens only in negation form', () => {
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
    while ((match = globalPattern.exec(FAMILY_J_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_J_SYSTEM_PROMPT, match.index);
      const context = contextLinesForMatch(FAMILY_J_SYSTEM_PROMPT, match.index).join(' ');
      const isNegation =
        line.includes(' NOT ') ||
        line.includes('NOT decide') ||
        line.includes('NOT treat') ||
        line.includes('MUST NOT') ||
        line.includes('NEVER') ||
        line.includes(' never ') ||
        line.includes('never a verdict') ||
        line.includes('not a verdict') ||
        context.includes('MUST NOT contain') ||
        context.includes('MUST NOT echo') ||
        context.includes('You do NOT') ||
        context.includes('NEVER') ||
        context.includes(' never ') ||
        context.includes('not a verdict');
      if (!isNegation) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family J system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}" (context: "${context}")`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('Family J user prompt questions block has exactly 5 lines for the default (empty) request', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Sensitive-composer questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const matches = questionsBlock.match(/^- [a-z_]+:/gm);
  if (!matches) throw new Error('questions block produced no rawKey lines');
  assertEquals(matches.length, 5);
});

Deno.test('Family J 4 verdict-adjacent keys each carry the "MUST NOT contain" enumeration verbatim', () => {
  const verdictAdjacentKeys = [
    'shifts_to_person_or_intent',
    'contains_unplayable_insult_only',
    'needs_pre_send_pause',
    'uses_satire_as_evidence',
  ];
  for (const rawKey of verdictAdjacentKeys) {
    const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`${rawKey} prompt entry missing`);
    if (!entry.falsePositiveGuards.includes('MUST NOT contain')) {
      throw new Error(`${rawKey} falsePositiveGuards missing "MUST NOT contain" enumeration (verdict-adjacent binding)`);
    }
  }
});

Deno.test('Family J system prompt closes with the conservative-positives bias + sparse note', () => {
  if (!FAMILY_J_SYSTEM_PROMPT.includes('The feature MUST be clearly')) {
    throw new Error('Family J system prompt missing conservative-positives closing line');
  }
  if (!FAMILY_J_SYSTEM_PROMPT.includes('Sensitive features are usually sparse')) {
    throw new Error('Family J system prompt missing sparse-features note');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OPS-MCP-FAMILY-J-SPAN-SHAPE-REINFORCEMENT (E3 amendment follow-up) —
// BINDING SPAN-SELECTION RULE block + needs_pre_send_pause concrete escape.
// The #421/#423 STRICT-shape reinforcement precedent. Validator unchanged.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('SPAN-SHAPE: Family J user prompt carries the BINDING SPAN-SELECTION RULE block with all four sub-rules', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  const expectedFragments = [
    'SPAN-SELECTION RULE (BINDING — applies to EVERY rawKey above, not only the person-shift key)',
    '(a) SHORTEST SUB-SPAN',
    '(b) SELF-SCAN',
    '(c) NARROW TO EXCLUDE',
    '(d) NARROW-OR-FALSE',
    'answer FALSE for that',
  ];
  for (const fragment of expectedFragments) {
    if (!prompt.includes(fragment)) {
      throw new Error(`Family J user prompt missing SPAN-SELECTION RULE fragment: "${fragment}"`);
    }
  }
});

Deno.test('SPAN-SHAPE: SPAN-SELECTION RULE carries the concrete WRONG-burst reactive-marker example', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest());
  // Concrete example required (mirrors the person-shift key's "because you work for…" example).
  if (!prompt.includes('WRONG WRONG WRONG!!!')) {
    throw new Error('Family J user prompt SPAN-SELECTION RULE missing the WRONG-burst typographic example');
  }
  if (!prompt.includes('because you work for')) {
    throw new Error('Family J user prompt SPAN-SELECTION RULE missing the person-shift clean-anchor example');
  }
  // The non-echo escape is anchored on the validator path so the model knows the consequence.
  if (!prompt.includes('validation_failed at evidenceSpan.<rawKey>')) {
    throw new Error('Family J user prompt SPAN-SELECTION RULE missing the validator-path consequence anchor');
  }
});

Deno.test('SPAN-SHAPE: needs_pre_send_pause SYSTEM-prompt paragraph carries the interleaved-slur concrete escape', () => {
  // The E3 amendment gap: the pause paragraph named WHAT to anchor (all-caps
  // bursts, repeated punctuation) but had no sub-span selection rule for when
  // the markers are interleaved with person labels. This closes it.
  const expectedFragments = [
    'When the reactive markers are INTERLEAVED with a slur or person label',
    'SHORTEST typographic fragment that carries the marker',
    'WRONG WRONG WRONG!!!',
    'answer false for this key rather than emit a',
  ];
  for (const fragment of expectedFragments) {
    if (!FAMILY_J_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family J system prompt needs_pre_send_pause paragraph missing escape fragment: "${fragment}"`);
    }
  }
});

Deno.test('SPAN-SHAPE: needs_pre_send_pause prompt-entry guard carries the sub-span/non-echo constraint', () => {
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'needs_pre_send_pause');
  if (!entry) throw new Error('needs_pre_send_pause prompt entry missing');
  const expectedFragments = [
    'SPAN-SELECTION (non-echo)',
    'SHORTEST typographic fragment only',
    'WRONG WRONG WRONG!!!',
    'answer false rather than emit a span that echoes the slur',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(`needs_pre_send_pause falsePositiveGuards missing SPAN-SELECTION fragment: "${fragment}"`);
    }
  }
  // The prior per-key guards survive verbatim (verdict-adjacent enumeration unchanged).
  if (!entry.falsePositiveGuards.includes('The output MUST NOT contain: unhinged, hostile, aggressive, losing it.')) {
    throw new Error('needs_pre_send_pause falsePositiveGuards lost its prior MUST NOT contain enumeration');
  }
});

Deno.test('SPAN-SHAPE: the SPAN-SELECTION RULE block does not disturb the questions block (still exactly 5 lines)', () => {
  const prompt = buildFamilyJUserPrompt(buildRequest({ requestedRawKeys: [] }));
  const questionsBlockStart = prompt.indexOf('Sensitive-composer questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const matches = questionsBlock.match(/^- [a-z_]+:/gm);
  if (!matches) throw new Error('questions block produced no rawKey lines');
  assertEquals(matches.length, 5);
  // The SPAN-SELECTION RULE block lives AFTER the slur-in-input instruction and
  // BEFORE the input — never inside the questions or definitions blocks.
  const spanRuleIndex = prompt.indexOf('SPAN-SELECTION RULE (BINDING');
  const inputIndex = prompt.indexOf('Input to classify:');
  if (spanRuleIndex < 0 || inputIndex < 0 || spanRuleIndex > inputIndex) {
    throw new Error('SPAN-SELECTION RULE block is mis-positioned relative to the input block');
  }
});
