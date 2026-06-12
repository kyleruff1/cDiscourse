/**
 * MCP-SERVER-003-FAMILY-B — Family B prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 17 Family B rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every positive flag
 *   - Prompt uses observation-not-verdict framing (no winner/truth tokens
 *     outside the explicit negation block which is doctrine-positive)
 *   - System prompt's 7 absolute rules are byte-equal to Family A's
 *   - Doctrine ban-list scan of the prompt template literals returns 0 hits
 *     in user-facing observation framing
 *   - disputes_value_weighting prompt entry surfaces the "MUST NOT imply one
 *     value is 'right'" doctrine guard verbatim
 *   - disputes_relevance prompt entry surfaces the "relevance dispute
 *     requires a reason" doctrine guard verbatim
 *   - Subset prompt request only includes requested rawKeys in questions
 *     block
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_B_SYSTEM_PROMPT,
  FAMILY_B_MAX_TOKENS,
  FAMILY_B_TEMPERATURE,
  FAMILY_B_MAX_BODY_FIELD_LEN,
  buildFamilyBUserPrompt,
  type ValidatedFamilyBRequest,
} from '../lib/familyBPrompt.ts';
import {
  FAMILY_B_RAW_KEYS,
  FAMILY_B_PROMPT_ENTRIES,
  FAMILY_B_CLASSIFIER_SET_VERSION,
} from '../lib/familyBKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from '../lib/modelInfoEmissionDirective.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyBRequest> = {}): ValidatedFamilyBRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-1',
    parentNodeId: 'parent-node-1',
    currentText: 'You are defining infrastructure to exclude branch libraries.',
    parentText: 'Library funding should support infrastructure.',
    threadContextExcerpt: 'Discussion of library funding.',
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family B system prompt contains the 7 absolute rules byte-equal to Family A', () => {
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
    if (!FAMILY_B_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family B system prompt missing absolute rule: ${rule}`);
    }
    if (!FAMILY_A_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family A system prompt missing absolute rule (parity check): ${rule}`);
    }
  }
});

Deno.test('Family B system prompt contains disagreement-axis structural framing', () => {
  // Fragments are short enough to never span the prompt's hard line breaks
  // (the prompt is hand-wrapped at ~80-100 chars per line).
  const framing = [
    'structural DISAGREEMENT relationships',
    'Disagreement is productive and',
    'both sides remain valid contributions to the debate',
    'umbrella key disagreement_present',
    'Conservative-positives bias',
    'Most moves exhibit 0 to 3 disagreement sub-axes',
    'substantive',
    'disagreement content is required for every positive',
  ];
  for (const fragment of framing) {
    if (!FAMILY_B_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family B system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family B MAX_TOKENS / TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_B_MAX_TOKENS, 1500);
  assertEquals(FAMILY_B_TEMPERATURE, 0);
  assertEquals(FAMILY_B_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family B user prompt (default request) includes all 17 rawKeys', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  for (const rawKey of FAMILY_B_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family B user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family B user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  for (const entry of FAMILY_B_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family B prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family B prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family B prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family B user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  for (const entry of FAMILY_B_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family B prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family B prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family B prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family B user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family B prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family B prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family B prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family B user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family B prompt missing schemaVersion literal');
  }
});

Deno.test('Family B user prompt declares classifierSetVersion family-b-v1', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_B_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family B prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-b-v1')) {
    throw new Error('Family B prompt does not literally contain "family-b-v1"');
  }
});

Deno.test('Family B user prompt includes umbrella/subtype note', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  if (
    !prompt.includes(
      'Note about disagreement_present, the 13 disagreement sub-axes, and the 3 disagreement-quality observations',
    )
  ) {
    throw new Error('Family B prompt missing umbrella/subtype note header');
  }
  if (!prompt.includes('do not auto-cascade')) {
    throw new Error('Family B prompt missing "do not auto-cascade" instruction');
  }
});

Deno.test('MCP-BUILD2a: Family B user prompt asks the 3 new disagreement-quality booleanQuestions', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  const newKeys = [
    'isolates_main_disagreement',
    'distinguishes_fact_value_disagreement',
    'preserves_face_while_disagreeing',
  ];
  for (const rawKey of newKeys) {
    const entry = FAMILY_B_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`MCP-BUILD2a prompt entry missing for ${rawKey}`);
    // The rawKey appears in the questions block (`- <rawKey>: <question>`).
    if (!prompt.includes(`- ${rawKey}:`)) {
      throw new Error(`Family B prompt missing questions-block line for ${rawKey}`);
    }
    // The verbatim booleanQuestion text is in the prompt.
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family B prompt missing booleanQuestion for ${rawKey}`);
    }
  }
});

Deno.test('MCP-BUILD2a: preserves_face_while_disagreeing entry describes the MOVE, never the author', () => {
  const entry = FAMILY_B_PROMPT_ENTRIES.find(
    (e) => e.rawKey === 'preserves_face_while_disagreeing',
  );
  if (!entry) throw new Error('preserves_face_while_disagreeing prompt entry missing');
  // The verdict-adjacent fence: the guard explicitly says it describes the
  // MOVE, never the author.
  if (!entry.falsePositiveGuards.includes('describes the MOVE, never the author')) {
    throw new Error(
      'preserves_face_while_disagreeing falsePositiveGuards missing describes-the-MOVE-not-the-author fence',
    );
  }
  // An attack-the-person move must be FALSE — the guard says so.
  if (!entry.falsePositiveGuards.includes('attacks the person')) {
    throw new Error(
      'preserves_face_while_disagreeing falsePositiveGuards missing the attack-makes-it-FALSE guard',
    );
  }
});

Deno.test('Family B user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_B_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_B_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_B_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-b-node-id-test-42',
  });
  const prompt = buildFamilyBUserPrompt(request);
  if (!prompt.includes('UNIQUE_B_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family B prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_B_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family B prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_B_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family B prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-b-node-id-test-42')) {
    throw new Error('Family B prompt missing nodeId');
  }
});

Deno.test('Family B user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyBUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family B prompt missing root-move parentText rendering');
  }
});

Deno.test('Family B user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['disagreement_present', 'disputes_definition', 'disputes_scope'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyBUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_B_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the questions block.
  // (They may appear in framing text like the umbrella/subtype note, which is intentional.)
  const questionsBlockStart = prompt.indexOf('Disagreement-axis questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing disagreement-axis-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['disputes_value_weighting', 'disputes_relevance', 'disputes_analogy'];
  for (const rawKey of nonRequestedKeys) {
    // The questions block uses `- <rawKey>:` as the line prefix.
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family B disputes_value_weighting prompt entry surfaces "MUST NOT imply one value is right" doctrine guard verbatim', () => {
  const entry = FAMILY_B_PROMPT_ENTRIES.find((e) => e.rawKey === 'disputes_value_weighting');
  if (!entry) throw new Error('disputes_value_weighting prompt entry missing');
  const expectedGuardFragment = "Doctrine note: copy MUST NOT imply one value is 'right'. The disagreement is genuine; both values are real.";
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `disputes_value_weighting falsePositiveGuards missing verbatim doctrine guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family B disputes_relevance prompt entry surfaces "relevance dispute requires a reason" doctrine guard verbatim', () => {
  const entry = FAMILY_B_PROMPT_ENTRIES.find((e) => e.rawKey === 'disputes_relevance');
  if (!entry) throw new Error('disputes_relevance prompt entry missing');
  const expectedGuardFragment = 'Do NOT mark TRUE for dismissive moves with no argument; relevance dispute requires a reason.';
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `disputes_relevance falsePositiveGuards missing verbatim doctrine guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family B system prompt contains banned tokens only in negation form', () => {
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
    while ((match = globalPattern.exec(FAMILY_B_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_B_SYSTEM_PROMPT, match.index);
      // System prompt: only the "You do NOT" negations are allowed.
      if (!line.includes(' NOT ') && !line.includes('NOT decide') && !line.includes('NOT treat')) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family B system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family B user prompt contains no banned tokens outside doctrine-positive negations or structural-disagreement vocabulary', () => {
  // The user prompt iterates 17 Family B per-rawKey entries. Banned tokens
  // can appear as:
  //   (a) doctrine-positive negations ("MUST NOT", "Do NOT", "You do NOT",
  //       "never implies", "NOT decide", "NOT treat") — explicit doctrine guards
  //   (b) the rawKey `disputes_value_weighting` doctrine guard's verbatim
  //       text "MUST NOT imply one value is 'right'" which surfaces the
  //       BANNED token "right" — but "right" is NOT in the ban list
  //       (only `winner`, `loser`, `correct`, etc. are)
  //
  // Anything OUTSIDE these classes is a doctrine violation.
  const sample = buildFamilyBUserPrompt(buildRequest());

  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

  function isDoctrinePositive(line: string): boolean {
    // Class (a): negation patterns.
    if (
      line.includes(' NOT ') ||
      line.includes('NOT decide') ||
      line.includes('NOT treat') ||
      line.includes('never implies') ||
      line.includes('MUST NOT')
    ) {
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
      if (!isDoctrinePositive(line)) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family B user prompt OUTSIDE allowed classes: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      // Avoid infinite loops on zero-width matches.
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

// OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — the shared response-envelope emission
// directive is interpolated immediately before the response-shape JSON example.
// Additive: the response-shape example itself is unchanged.
Deno.test('MODELINFO-SHAPE: Family B user prompt carries the modelInfo emission directive immediately before the response-shape example', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  const directiveIndex = prompt.indexOf(MODEL_INFO_EMISSION_DIRECTIVE);
  if (directiveIndex < 0) {
    throw new Error('Family B user prompt missing the modelInfo emission directive');
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

Deno.test('MODELINFO-SHAPE: Family B response-shape JSON example is unchanged by the directive', () => {
  const prompt = buildFamilyBUserPrompt(buildRequest());
  for (
    const fragment of [
      '"provider": "mcp"',
      '"serverName": "<server identifier>"',
      '"classifierSetVersion": "family-b-v1"',
    ]
  ) {
    if (!prompt.includes(fragment)) {
      throw new Error(`Family B response-shape example missing/altered fragment: ${fragment}`);
    }
  }
  if (prompt.split(MODEL_INFO_EMISSION_DIRECTIVE).length !== 2) {
    throw new Error('the modelInfo emission directive must appear exactly once');
  }
});
