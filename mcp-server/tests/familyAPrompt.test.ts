/**
 * MCP-SERVER-002 — Family A prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 19 Family A rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every positive flag
 *   - Prompt uses observation-not-verdict framing (no winner/truth tokens
 *     outside the explicit negation block which is doctrine-positive)
 *   - Doctrine ban-list scan of the prompt template literals returns 0 hits
 *     in user-facing observation framing (negations in the absolute-rules
 *     block are doctrine-positive and identical to MCP-SERVER-001 precedent)
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_A_SYSTEM_PROMPT,
  FAMILY_A_MAX_TOKENS,
  FAMILY_A_TEMPERATURE,
  buildFamilyAUserPrompt,
  type ValidatedFamilyARequest,
} from '../lib/familyAPrompt.ts';
import {
  FAMILY_A_RAW_KEYS,
  FAMILY_A_PROMPT_ENTRIES,
  FAMILY_A_CLASSIFIER_SET_VERSION,
} from '../lib/familyAKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyARequest> = {}): ValidatedFamilyARequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-1',
    parentNodeId: 'parent-node-1',
    currentText: 'The cited 30% figure refers to new sales, not stock.',
    parentText: 'EV adoption is at 30% nationally.',
    threadContextExcerpt: 'Discussion of EV adoption metrics.',
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family A system prompt contains the 7 absolute rules byte-equal to semantic-move', () => {
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
    if (!FAMILY_A_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family A system prompt missing absolute rule: ${rule}`);
    }
  }
});

Deno.test('Family A system prompt contains structural-only framing', () => {
  const framing = [
    "exhibits structural relationships toward its PARENT",
    "Conservative-positives bias",
    "Do NOT mark all rawKeys true",
    "substantive content is required for every positive",
  ];
  for (const fragment of framing) {
    if (!FAMILY_A_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family A system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family A MAX_TOKENS and TEMPERATURE constants are set correctly', () => {
  assertEquals(FAMILY_A_MAX_TOKENS, 1500);
  assertEquals(FAMILY_A_TEMPERATURE, 0);
});

Deno.test('Family A user prompt (default request) includes all 19 rawKeys', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  for (const rawKey of FAMILY_A_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family A user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('MCP-BUILD2b: Family A user prompt asks the 3 new parent-relation booleanQuestions', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  const newKeys = [
    'acknowledges_parent_strength',
    'compares_parent_to_sibling_branch',
    'identifies_parent_scope_limit',
  ];
  for (const rawKey of newKeys) {
    const entry = FAMILY_A_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`MCP-BUILD2b prompt entry missing for ${rawKey}`);
    // The rawKey appears in the questions block (`- <rawKey>: <question>`).
    if (!prompt.includes(`- ${rawKey}:`)) {
      throw new Error(`Family A prompt missing questions-block line for ${rawKey}`);
    }
    // The verbatim booleanQuestion text is in the prompt.
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family A prompt missing booleanQuestion for ${rawKey}`);
    }
  }
});

Deno.test('MCP-BUILD2b: acknowledges_parent_strength entry describes the MOVE, never the author', () => {
  const entry = FAMILY_A_PROMPT_ENTRIES.find(
    (e) => e.rawKey === 'acknowledges_parent_strength',
  );
  if (!entry) throw new Error('acknowledges_parent_strength prompt entry missing');
  // The verdict-adjacent fence: the guard explicitly says it describes the
  // MOVE, never the author.
  if (!entry.falsePositiveGuards.includes('describes the MOVE, never the author')) {
    throw new Error(
      'acknowledges_parent_strength falsePositiveGuards missing describes-the-MOVE-not-the-author fence',
    );
  }
  // The fence states it never asserts the parent IS strong/right.
  if (!entry.falsePositiveGuards.includes('never says the parent IS strong or right')) {
    throw new Error(
      'acknowledges_parent_strength falsePositiveGuards missing the parent-not-asserted-strong fence',
    );
  }
  // Ban the verdict tokens "correct" / "true" / "wins" from the label +
  // booleanQuestion (manifest §1 A1 requirement).
  for (const field of [entry.label, entry.booleanQuestion]) {
    for (const banned of ['correct', 'true', 'wins']) {
      const re = new RegExp(`\\b${banned}\\b`, 'i');
      if (re.test(field)) {
        throw new Error(
          `acknowledges_parent_strength field contains banned verdict token "${banned}": ${field}`,
        );
      }
    }
  }
});

Deno.test('Family A user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  for (const entry of FAMILY_A_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family A prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family A prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family A prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family A user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  for (const entry of FAMILY_A_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family A prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family A prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family A prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family A user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family A prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family A prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family A prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family A user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family A prompt missing schemaVersion literal');
  }
});

Deno.test('Family A user prompt declares classifierSetVersion family-a-v1', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_A_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family A prompt missing classifierSetVersion literal');
  }
});

Deno.test('Family A user prompt warns about auto_metadata/lifecycle limitation', () => {
  const prompt = buildFamilyAUserPrompt(buildRequest());
  if (!prompt.includes('has_rebuttal, has_counter_rebuttal, and rebutted')) {
    throw new Error('Family A prompt missing auto_metadata/lifecycle warning header');
  }
  if (!prompt.includes('answer FALSE')) {
    throw new Error('Family A prompt missing auto_metadata/lifecycle FALSE-with-low-confidence guidance');
  }
});

Deno.test('Family A user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-node-id-test-42',
  });
  const prompt = buildFamilyAUserPrompt(request);
  if (!prompt.includes('UNIQUE_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family A prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family A prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family A prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-node-id-test-42')) {
    throw new Error('Family A prompt missing nodeId');
  }
});

Deno.test('Family A user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyAUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family A prompt missing root-move parentText rendering');
  }
});

Deno.test('Family A user prompt with subset requestedRawKeys includes only those rawKeys', () => {
  const subset = ['supports_parent', 'challenges_parent', 'refines_parent'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyAUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_A_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the structural-questions block.
  // (They may appear in framing text like the has_rebuttal/has_counter_rebuttal/rebutted
  // limitation note, which is intentional.)
  const questionsBlockStart = prompt.indexOf('Structural questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing structural-questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['extends_parent', 'distinguishes_parent', 'reframes_parent'];
  for (const rawKey of nonRequestedKeys) {
    // The questions block uses `- <rawKey>:` as the line prefix.
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family A prompt template literals contain only doctrine-positive negations or binding structural vocabulary', () => {
  // The system prompt + user prompt template literals contain `winner`,
  // `truth`, etc. as NEGATIONS in the absolute-rules block (e.g., "You do
  // NOT decide the winner of any debate."). The doctrine ban-list scan in
  // the server runs against the MODEL's RESPONSE, not the server-constructed
  // prompt. The negations are doctrine-positive per the MCP-SERVER-001
  // precedent and are identical to seedPrompt.ts:48-50.
  //
  // Additionally, the binding Family A rawKey `corrects_parent_detail` is
  // BINDING per intent brief Decision 1. The verb "corrects" / "correct"
  // appears in its booleanQuestion / definitions / examples because the
  // STRUCTURAL meaning of that rawKey is "the move corrects a specific
  // factual detail" — a structural-vocabulary use, NOT a verdict that the
  // parent is incorrect overall. The upstream `src/features/nodeLabels/
  // machineObservationDefinitions/familyA.ts` carries the same vocabulary
  // 15+ times; the upstream is doctrinally cleared.
  //
  // Strategy: every banned-token match must fall in one of these classes:
  //   (a) a "You do NOT" / "NOT decide" / "NOT treat" negation
  //   (b) the binding rawKey `corrects_parent_detail` or its vocabulary
  //       (its booleanQuestion / positiveDefinition / etc. — the rawKey
  //       set this card SHIPS structurally)
  //   (c) inside an example string where the `correct` token is being
  //       used as a structural verb ("offers the substitute value",
  //       "minor edits") — NOT as a verdict.
  //
  // Anything outside these classes is a doctrine violation.
  const sample = buildFamilyAUserPrompt(buildRequest());

  // Allow-list of substrings that contain `correct` as structural
  // vocabulary (the corrects_parent_detail rawKey). Matches whose line
  // contains any of these substrings are doctrine-positive.
  const STRUCTURAL_VOCAB_ALLOW_LIST = [
    'corrects_parent_detail',
    'corrects a specific factual detail',
    'correct a specific factual detail',
    'minor edits',  // negative-guard language in the rawKey
  ];

  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

  function isDoctrinePositive(line: string): boolean {
    // Class (a): negation patterns.
    if (line.includes(' NOT ') || line.includes('NOT decide') || line.includes('NOT treat')) {
      return true;
    }
    // Class (b)+(c): structural vocabulary.
    for (const allowed of STRUCTURAL_VOCAB_ALLOW_LIST) {
      if (line.includes(allowed)) return true;
    }
    return false;
  }

  // Scan the user prompt.
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
          `DOCTRINE BAN-LIST hit in Family A user prompt OUTSIDE allowed classes: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      // Avoid infinite loops on zero-width matches.
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }

  // Scan the system prompt. Banned tokens are permitted ONLY in the
  // "You do NOT" negation block. The system prompt should NOT use
  // structural vocabulary (corrects_*); enforce stricter standard here.
  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    let match;
    while ((match = globalPattern.exec(FAMILY_A_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_A_SYSTEM_PROMPT, match.index);
      // System prompt: only the "You do NOT" negations are allowed.
      if (!line.includes(' NOT ') && !line.includes('NOT decide') && !line.includes('NOT treat')) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family A system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});
