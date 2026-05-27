/**
 * MCP-SERVER-004-FAMILY-C — Family C prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 17 Family C rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every positive flag
 *   - Prompt uses observation-not-verdict framing (no winner/truth tokens
 *     outside the explicit negation block which is doctrine-positive)
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B's
 *   - Doctrine ban-list scan of the prompt template literals returns 0 hits
 *     in user-facing observation framing
 *   - rejects_candidate_understanding prompt entry surfaces the "not 'you are
 *     wrong'" doctrine guard verbatim
 *   - acknowledges_misread prompt entry surfaces the "not a verdict on the
 *     original author" doctrine guard verbatim
 *   - flags_term_ambiguity prompt entry surfaces the "does NOT accuse the
 *     parent author of writing ambiguously" doctrine guard verbatim
 *   - clarified prompt entry surfaces the lifecycle FALSE-low guard
 *   - User prompt includes the clarified lifecycle note
 *   - User prompt includes the repair-positive cross-key framing note
 *   - No repair-as-failure framing in the prompt template (scan)
 *   - No error-correction framing in the prompt template (scan)
 *   - Subset prompt request only includes requested rawKeys in questions
 *     block
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_C_SYSTEM_PROMPT,
  FAMILY_C_MAX_TOKENS,
  FAMILY_C_TEMPERATURE,
  FAMILY_C_MAX_BODY_FIELD_LEN,
  buildFamilyCUserPrompt,
  type ValidatedFamilyCRequest,
} from '../lib/familyCPrompt.ts';
import {
  FAMILY_C_RAW_KEYS,
  FAMILY_C_PROMPT_ENTRIES,
  FAMILY_C_CLASSIFIER_SET_VERSION,
} from '../lib/familyCKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyCRequest> = {}): ValidatedFamilyCRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-1',
    parentNodeId: 'parent-node-1',
    currentText: 'Are you saying libraries are public goods funded like roads?',
    parentText: 'Libraries are infrastructure.',
    threadContextExcerpt: 'Discussion of library funding.',
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family C system prompt contains the 7 absolute rules byte-equal to Family A and Family B', () => {
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
    if (!FAMILY_C_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family C system prompt missing absolute rule: ${rule}`);
    }
    if (!FAMILY_A_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family A system prompt missing absolute rule (parity check): ${rule}`);
    }
    if (!FAMILY_B_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family B system prompt missing absolute rule (parity check): ${rule}`);
    }
  }
});

Deno.test('Family C system prompt contains collaborative-grounding structural framing', () => {
  // Fragments are short enough to never span the prompt's hard line breaks
  // (the prompt is hand-wrapped at ~80-100 chars per line).
  const framing = [
    'structural REPAIR or GROUNDING relationships',
    'Repair is collaborative grounding work',
    'both sides remain valid contributors to the',
    'None of these',
    'is a verdict on either participant',
    'Conservative-positives bias',
    'most moves exhibit',
    '0 to 2 repair signals',
    'substantive',
    'grounding content',
  ];
  for (const fragment of framing) {
    if (!FAMILY_C_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family C system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family C MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_C_MAX_TOKENS, 1500);
  assertEquals(FAMILY_C_TEMPERATURE, 0);
  assertEquals(FAMILY_C_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family C user prompt (default request) includes all 17 rawKeys', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  for (const rawKey of FAMILY_C_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family C user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family C user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  for (const entry of FAMILY_C_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family C prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family C prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family C prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family C user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  for (const entry of FAMILY_C_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family C prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family C prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family C prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family C user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family C prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family C prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family C prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family C user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family C prompt missing schemaVersion literal');
  }
});

Deno.test('Family C user prompt declares classifierSetVersion family-c-v1', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_C_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family C prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-c-v1')) {
    throw new Error('Family C prompt does not literally contain "family-c-v1"');
  }
});

Deno.test('Family C user prompt includes clarified lifecycle FALSE-low guard note', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  if (!prompt.includes('Note about clarified')) {
    throw new Error('Family C prompt missing clarified lifecycle note header');
  }
  if (!prompt.includes('cluster-level lifecycle state')) {
    throw new Error('Family C prompt missing clarified lifecycle description');
  }
  if (!prompt.includes('answer FALSE')) {
    throw new Error('Family C prompt missing FALSE-low instruction');
  }
  if (!prompt.includes('low confidence')) {
    throw new Error('Family C prompt missing low-confidence instruction');
  }
});

Deno.test('Family C user prompt includes repair-positive cross-key framing note', () => {
  const prompt = buildFamilyCUserPrompt(buildRequest());
  if (!prompt.includes('Note about repair as collaborative grounding')) {
    throw new Error('Family C prompt missing collaborative-grounding note header');
  }
  if (!prompt.includes('None of these')) {
    throw new Error('Family C prompt missing "none of these" anchor');
  }
  if (!prompt.includes('is a verdict on either participant')) {
    throw new Error('Family C prompt missing "verdict on either participant" anchor');
  }
});

Deno.test('Family C user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_C_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_C_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_C_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-c-node-id-test-42',
  });
  const prompt = buildFamilyCUserPrompt(request);
  if (!prompt.includes('UNIQUE_C_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family C prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_C_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family C prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_C_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family C prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-c-node-id-test-42')) {
    throw new Error('Family C prompt missing nodeId');
  }
});

Deno.test('Family C user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyCUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family C prompt missing root-move parentText rendering');
  }
});

Deno.test('Family C user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['offers_candidate_understanding', 'confirms_understanding', 'rejects_candidate_understanding'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyCUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_C_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the questions block.
  // (They may appear in framing text like the repair-positive note, which is intentional.)
  const questionsBlockStart = prompt.indexOf('Repair and grounding questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing repair-grounding-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['acknowledges_misread', 'flags_term_ambiguity', 'scope_mismatch_identified'];
  for (const rawKey of nonRequestedKeys) {
    // The questions block uses `- <rawKey>:` as the line prefix.
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family C rejects_candidate_understanding prompt entry surfaces "not you are wrong" doctrine guard verbatim', () => {
  const entry = FAMILY_C_PROMPT_ENTRIES.find((e) => e.rawKey === 'rejects_candidate_understanding');
  if (!entry) throw new Error('rejects_candidate_understanding prompt entry missing');
  const expectedGuardFragment = "the rejector saying 'that is not what I meant,' not 'you are wrong.'";
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `rejects_candidate_understanding falsePositiveGuards missing verbatim doctrine guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family C acknowledges_misread prompt entry surfaces "not a verdict on the original author" doctrine guard verbatim', () => {
  const entry = FAMILY_C_PROMPT_ENTRIES.find((e) => e.rawKey === 'acknowledges_misread');
  if (!entry) throw new Error('acknowledges_misread prompt entry missing');
  const expectedGuardFragment = 'acknowledging a misread is constructive repair work, not a verdict on the original author';
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `acknowledges_misread falsePositiveGuards missing verbatim doctrine guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family C flags_term_ambiguity prompt entry surfaces "does NOT accuse the parent author of writing ambiguously" doctrine guard verbatim', () => {
  const entry = FAMILY_C_PROMPT_ENTRIES.find((e) => e.rawKey === 'flags_term_ambiguity');
  if (!entry) throw new Error('flags_term_ambiguity prompt entry missing');
  const expectedGuardFragment = 'flagging an ambiguous term opens shared understanding; it does NOT accuse the parent author of writing ambiguously';
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `flags_term_ambiguity falsePositiveGuards missing verbatim doctrine guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family C clarified prompt entry surfaces lifecycle FALSE-low guard verbatim', () => {
  const entry = FAMILY_C_PROMPT_ENTRIES.find((e) => e.rawKey === 'clarified');
  if (!entry) throw new Error('clarified prompt entry missing');
  const expectedGuardFragment = 'when you only see the move text and not the full cluster, answer FALSE with low confidence';
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `clarified falsePositiveGuards missing verbatim lifecycle FALSE-low guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family C prompt template: no repair-as-failure framing in any per-key prompt entry', () => {
  // Scan the rendered user prompt for tokens that would frame repair as a
  // failure of either participant. The system prompt's "Repair is collaborative
  // grounding work; both sides remain valid contributors" line is the
  // anti-doctrine anchor; the per-key entries must not contradict.
  const prompt = buildFamilyCUserPrompt(buildRequest());
  // Tokens that would imply repair-as-failure: standalone "fail", "failed_to"
  // (as a hyphenated/underscored descriptor; the words "failure" appear
  // legitimately in the per-key text when describing what is NOT a positive,
  // e.g. "constructive repair work, not a failure"). We scan for descriptive
  // verdict shapes only.
  const repairAsFailurePatterns: RegExp[] = [
    /\bfailed\s+to\s+understand/i,
    /\bfailure\s+to\s+communicate/i,
    /\bfailed\s+communication/i,
  ];
  for (const re of repairAsFailurePatterns) {
    if (re.test(prompt)) {
      throw new Error(
        `Family C prompt contains repair-as-failure framing matching ${re}`,
      );
    }
  }
});

Deno.test('Family C prompt template: no error-correction framing in per-key descriptions', () => {
  // Scan the rendered user prompt for descriptive tokens that would frame
  // repair as error-correction (positioning one side as having made an
  // "error" or "mistake"). The word "correction" appears legitimately in
  // the self-repair example ("Actually, correction — I meant 13%") and in
  // "corrected paraphrase" — those are the author's own constructive moves,
  // not verdicts on the parent. We scan for accusatory shapes only.
  const prompt = buildFamilyCUserPrompt(buildRequest());
  const errorCorrectionPatterns: RegExp[] = [
    /\bparent\s+made\s+an\s+error/i,
    /\bparent\s+author\s+made\s+a\s+mistake/i,
    /\bparent's\s+error/i,
    /\bauthor's\s+mistake/i,
  ];
  for (const re of errorCorrectionPatterns) {
    if (re.test(prompt)) {
      throw new Error(
        `Family C prompt contains accusatory error-correction framing matching ${re}`,
      );
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family C system prompt contains banned tokens only in negation form', () => {
  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    let match;
    while ((match = globalPattern.exec(FAMILY_C_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_C_SYSTEM_PROMPT, match.index);
      // System prompt: only the "You do NOT" negations are allowed, plus the
      // doctrine-positive line "None of these / is a verdict on either participant"
      // which surfaces "verdict" in a NEGATION sense (the line is the closing
      // half of a sentence that begins "None of these is a verdict ...").
      const isNegation = line.includes(' NOT ') || line.includes('NOT decide') || line.includes('NOT treat');
      const isVerdictNegationClosing = line.includes('is a verdict on either participant');
      if (!isNegation && !isVerdictNegationClosing) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family C system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family C user prompt contains no banned tokens outside doctrine-positive negations or structural-repair vocabulary', () => {
  // The user prompt iterates 17 Family C per-rawKey entries. Banned tokens
  // can appear as:
  //   (a) doctrine-positive negations ("MUST NOT", "Do NOT", "You do NOT",
  //       "never implies", "NOT decide", "NOT treat", "not 'you are wrong'",
  //       "not a verdict", "not a failure") — explicit doctrine guards
  //   (b) the rejects_candidate_understanding doctrine guard contains the
  //       verbatim phrase "'you are wrong'" but the "wrong" appears in
  //       negation form ("not 'you are wrong'") — this is doctrine-positive
  //   (c) Schegloff/Sacks repair vocabulary uses "correct" / "correction" /
  //       "corrected" / "corrects" descriptively (NOT verdictively) as the
  //       technical name for the repair move type. Examples:
  //         - "confirm or correct that paraphrase"
  //         - "invitation to correct"
  //         - "the move corrects rather than confirms"
  //         - "self-correct or self-clarify"
  //         - "Actually, correction — I meant 13%"
  //       These are descriptive Schegloff/Sacks repair-pattern names, not
  //       verdicts. The ban-list scan against the model's RESPONSE catches
  //       verdict-y uses (e.g., "they got the correct interpretation"); the
  //       PROMPT TEMPLATE uses these terms in standard discourse-analysis sense.
  //   (d) "is a verdict on either participant" — closing half of the
  //       "None of these / is a verdict on either participant" sentence.
  //
  // Anything OUTSIDE these classes is a doctrine violation.
  const sample = buildFamilyCUserPrompt(buildRequest());

  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

  function isDoctrinePositive(line: string, matchedToken: string): boolean {
    // Class (a): negation patterns.
    if (
      line.includes(' NOT ') ||
      line.includes('NOT decide') ||
      line.includes('NOT treat') ||
      line.includes('never implies') ||
      line.includes('MUST NOT') ||
      line.includes('not a verdict') ||
      line.includes('not a failure') ||
      line.includes("not 'you are wrong'")
    ) {
      return true;
    }
    // Class (d): the "is a verdict on either participant" closing line.
    if (line.includes('is a verdict on either participant')) {
      return true;
    }
    // Class (c): Schegloff/Sacks repair vocabulary uses these terms descriptively.
    // Allow "correct" / "correction" / "corrected" / "corrects" / "correcting"
    // as Schegloff/Sacks repair-pattern names. These are NOT verdicts about
    // who was right; they are the technical name for the repair-move TYPE.
    if (/correct/i.test(matchedToken)) {
      // The user prompt's per-key descriptions use "correct" / "correction" /
      // "corrected" / "corrects" / "self-correct" in the descriptive
      // Schegloff/Sacks sense (the move TYPE name), not as a verdict.
      return true;
    }
    return false;
  }

  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    let match;
    while ((match = globalPattern.exec(sample)) !== null) {
      const line = lineForMatch(sample, match.index);
      if (!isDoctrinePositive(line, match[0])) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family C user prompt OUTSIDE allowed classes: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      // Avoid infinite loops on zero-width matches.
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});
