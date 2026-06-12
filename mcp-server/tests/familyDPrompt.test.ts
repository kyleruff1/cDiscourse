/**
 * MCP-SERVER-005-FAMILY-D — Family D prompt structure + doctrine ban-list scan tests.
 *
 * Critical invariants:
 *   - Prompt includes all 22 Family D Subset rawKeys (when requestedRawKeys is empty)
 *   - Prompt includes each rawKey's booleanQuestion + positiveDefinition +
 *     negativeDefinition + positiveExample + negativeExample + falsePositiveGuards
 *   - Prompt instructs the model to return confidence on every positive flag
 *   - System prompt's 7 absolute rules are byte-equal to Family A/B/C's
 *   - Doctrine ban-list scan of the prompt template literals returns 0 hits
 *     in user-facing observation framing outside negation form
 *   - anecdote_used prompt entry surfaces the "not weakness" doctrine guard verbatim
 *   - burden_request_present prompt entry surfaces the "not a verdict" doctrine
 *     guard verbatim
 *   - evidence_gap_present prompt entry surfaces the anti-amplification anchor
 *     verbatim
 *   - User prompt includes the Subset-path note (8 deterministic keys excluded)
 *   - User prompt includes the anti-amplification anchor + doctrine-risk-key
 *     framing block
 *   - No anecdote-as-weak / burden-as-verdict / evidence-gap-as-failure
 *     framing in any per-key prompt-entry corpus
 *   - MAX_TOKENS === 1800 (Stage 2B-approved bump from 1500)
 *   - TEMPERATURE === 0; MAX_BODY_FIELD_LEN === 8000
 *   - Subset prompt request only includes requested rawKeys in questions block
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_D_SYSTEM_PROMPT,
  FAMILY_D_MAX_TOKENS,
  FAMILY_D_TEMPERATURE,
  FAMILY_D_MAX_BODY_FIELD_LEN,
  buildFamilyDUserPrompt,
  type ValidatedFamilyDRequest,
} from '../lib/familyDPrompt.ts';
import {
  FAMILY_D_RAW_KEYS,
  FAMILY_D_PROMPT_ENTRIES,
  FAMILY_D_CLASSIFIER_SET_VERSION,
} from '../lib/familyDKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from '../lib/modelInfoEmissionDirective.ts';
import { FAMILY_A_SYSTEM_PROMPT } from '../lib/familyAPrompt.ts';
import { FAMILY_B_SYSTEM_PROMPT } from '../lib/familyBPrompt.ts';
import { FAMILY_C_SYSTEM_PROMPT } from '../lib/familyCPrompt.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1' as const;

function buildRequest(overrides: Partial<ValidatedFamilyDRequest> = {}): ValidatedFamilyDRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-d-1',
    parentNodeId: 'parent-node-d-1',
    currentText: 'Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions from 2020 to 2023.',
    parentText: 'EVs reduce emissions in cities.',
    threadContextExcerpt: 'Discussion of EV emission impact.',
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: [],
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('Family D system prompt contains the 7 absolute rules byte-equal to Family A/B/C', () => {
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
    if (!FAMILY_D_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Family D system prompt missing absolute rule: ${rule}`);
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
  }
});

Deno.test('Family D system prompt contains evidence-source-chain doctrine framing', () => {
  // Fragments are short enough to fit within the prompt's hand-wrapped
  // line widths (~80-100 chars). The system prompt wraps at sentence
  // boundaries and embeds these fragments on single lines.
  const framing = [
    'structural EVIDENCE-SOURCE-CHAIN',
    'evidence request',
    'evidence provision',
    'evidence gap',
    'source-chain repair',
    'never a judgement about who is right about the',
    'collaborative grounding moves',
  ];
  for (const fragment of framing) {
    if (!FAMILY_D_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family D system prompt missing structural framing fragment: ${fragment}`);
    }
  }
});

Deno.test('Family D system prompt contains anti-amplification anchor (cdiscourse-doctrine §3)', () => {
  // Per Stage 2B + design §4.3: the system prompt encodes the
  // anti-amplification rule that popularity / repetition / engagement is
  // NOT evidence. Fragments are short enough to fit within the prompt's
  // hand-wrapped line widths.
  const antiAmplificationFragments = [
    'Popularity / repetition / engagement are NOT evidence',
    'commonly-asserted',
    'evidence gap regardless of how often it has',
  ];
  for (const fragment of antiAmplificationFragments) {
    if (!FAMILY_D_SYSTEM_PROMPT.includes(fragment)) {
      throw new Error(`Family D system prompt missing anti-amplification fragment: ${fragment}`);
    }
  }
});

Deno.test('Family D MAX_TOKENS is 1800 (Stage 2B-approved bump from 1500)', () => {
  assertEquals(FAMILY_D_MAX_TOKENS, 1800);
});

Deno.test('Family D TEMPERATURE / MAX_BODY_FIELD_LEN constants are set correctly', () => {
  assertEquals(FAMILY_D_TEMPERATURE, 0);
  assertEquals(FAMILY_D_MAX_BODY_FIELD_LEN, 8000);
});

Deno.test('Family D user prompt (default request) includes all 22 Subset rawKeys', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  for (const rawKey of FAMILY_D_RAW_KEYS) {
    if (!prompt.includes(rawKey)) {
      throw new Error(`Family D user prompt missing rawKey: ${rawKey}`);
    }
  }
});

Deno.test('Family D user prompt includes each rawKey booleanQuestion + positiveDefinition + negativeDefinition', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  for (const entry of FAMILY_D_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Family D prompt missing booleanQuestion for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.positiveDefinition)) {
      throw new Error(`Family D prompt missing positiveDefinition for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeDefinition)) {
      throw new Error(`Family D prompt missing negativeDefinition for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family D user prompt includes each rawKey positiveExample + negativeExample + falsePositiveGuards', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  for (const entry of FAMILY_D_PROMPT_ENTRIES) {
    if (!prompt.includes(entry.positiveExample)) {
      throw new Error(`Family D prompt missing positiveExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.negativeExample)) {
      throw new Error(`Family D prompt missing negativeExample for ${entry.rawKey}`);
    }
    if (!prompt.includes(entry.falsePositiveGuards)) {
      throw new Error(`Family D prompt missing falsePositiveGuards for ${entry.rawKey}`);
    }
  }
});

Deno.test('Family D user prompt instructs model to provide confidence on every rawKey', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  if (!prompt.includes('confidence')) {
    throw new Error('Family D prompt missing "confidence" instruction');
  }
  if (!prompt.includes('low|medium|high')) {
    throw new Error('Family D prompt missing confidence band enumeration');
  }
  if (!prompt.includes('Every key in observations MUST also appear in confidence')) {
    throw new Error('Family D prompt missing observations/confidence coordination requirement');
  }
});

Deno.test('Family D user prompt declares the response schemaVersion', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  if (!prompt.includes(SCHEMA_VERSION)) {
    throw new Error('Family D prompt missing schemaVersion literal');
  }
});

Deno.test('Family D user prompt declares classifierSetVersion family-d-v1', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  if (!prompt.includes(FAMILY_D_CLASSIFIER_SET_VERSION)) {
    throw new Error('Family D prompt missing classifierSetVersion literal');
  }
  if (!prompt.includes('family-d-v1')) {
    throw new Error('Family D prompt does not literally contain "family-d-v1"');
  }
});

Deno.test('Family D user prompt includes Subset-path note (8 deterministic keys excluded)', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  if (!prompt.includes('Note about the Subset path')) {
    throw new Error('Family D prompt missing Subset-path note header');
  }
  if (!prompt.includes('22 ai-classifier')) {
    throw new Error('Family D prompt missing 22 ai-classifier description');
  }
  if (!prompt.includes('do NOT infer or emit')) {
    throw new Error('Family D prompt missing do-NOT-infer-deterministic instruction');
  }
});

Deno.test('Family D user prompt includes anti-amplification anchor + doctrine-risk-key framing block', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  if (!prompt.includes('Note about anti-amplification and doctrine-risk keys')) {
    throw new Error('Family D prompt missing anti-amplification note header');
  }
  if (!prompt.includes('None')) {
    throw new Error('Family D prompt missing "None" anchor');
  }
  if (!prompt.includes('verdict on either participant')) {
    throw new Error('Family D prompt missing "verdict on either participant" anchor');
  }
  if (!prompt.includes('Popularity / repetition / engagement are NOT evidence')) {
    throw new Error('Family D prompt missing anti-amplification anchor');
  }
});

Deno.test('Family D user prompt embeds the input move text + parent text + thread context', () => {
  const request = buildRequest({
    currentText: 'UNIQUE_D_MOVE_TEXT_FOR_TEST_42',
    parentText: 'UNIQUE_D_PARENT_TEXT_FOR_TEST_42',
    threadContextExcerpt: 'UNIQUE_D_THREAD_CONTEXT_FOR_TEST_42',
    nodeId: 'unique-d-node-id-test-42',
  });
  const prompt = buildFamilyDUserPrompt(request);
  if (!prompt.includes('UNIQUE_D_MOVE_TEXT_FOR_TEST_42')) {
    throw new Error('Family D prompt missing currentText');
  }
  if (!prompt.includes('UNIQUE_D_PARENT_TEXT_FOR_TEST_42')) {
    throw new Error('Family D prompt missing parentText');
  }
  if (!prompt.includes('UNIQUE_D_THREAD_CONTEXT_FOR_TEST_42')) {
    throw new Error('Family D prompt missing threadContextExcerpt');
  }
  if (!prompt.includes('unique-d-node-id-test-42')) {
    throw new Error('Family D prompt missing nodeId');
  }
});

Deno.test('Family D user prompt renders root move parent text as "none"', () => {
  const request = buildRequest({ parentText: null, parentNodeId: null });
  const prompt = buildFamilyDUserPrompt(request);
  if (!prompt.includes('none — this is a root move.')) {
    throw new Error('Family D prompt missing root-move parentText rendering');
  }
});

Deno.test('Family D user prompt with subset requestedRawKeys includes only those rawKeys in questions block', () => {
  const subset = ['source_provided', 'provides_evidence', 'statistic_used'];
  const request = buildRequest({ requestedRawKeys: subset });
  const prompt = buildFamilyDUserPrompt(request);

  // Each requested key's booleanQuestion is present.
  for (const rawKey of subset) {
    const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`Test setup error: missing prompt entry for ${rawKey}`);
    if (!prompt.includes(entry.booleanQuestion)) {
      throw new Error(`Subset prompt missing booleanQuestion for ${rawKey}`);
    }
  }

  // Non-requested rawKeys do NOT appear in the questions block.
  const questionsBlockStart = prompt.indexOf('Evidence-source-chain questions for this move:');
  const questionsBlockEnd = prompt.indexOf('\nDefinitions and examples');
  if (questionsBlockStart < 0 || questionsBlockEnd < 0) {
    throw new Error('Prompt missing evidence-source-chain questions block markers');
  }
  const questionsBlock = prompt.slice(questionsBlockStart, questionsBlockEnd);
  const nonRequestedKeys = ['anecdote_used', 'burden_request_present', 'evidence_gap_present'];
  for (const rawKey of nonRequestedKeys) {
    // The questions block uses `- <rawKey>:` as the line prefix.
    if (questionsBlock.includes(`- ${rawKey}:`)) {
      throw new Error(`Subset prompt includes non-requested rawKey in questions block: ${rawKey}`);
    }
  }
});

Deno.test('Family D anecdote_used prompt entry surfaces "not weakness" doctrine guard verbatim', () => {
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'anecdote_used');
  if (!entry) throw new Error('anecdote_used prompt entry missing');
  // Verbatim guard from intent brief §4.1 + design §4.1.
  const expectedGuardFragment = 'anecdote is legitimate evidence in some contexts';
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `anecdote_used falsePositiveGuards missing verbatim doctrine guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
  const expectedNotWeaknessFragment = 'copy must NOT imply weakness';
  if (!entry.falsePositiveGuards.includes(expectedNotWeaknessFragment)) {
    throw new Error(
      `anecdote_used falsePositiveGuards missing "copy must NOT imply weakness" guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family D burden_request_present prompt entry surfaces "descriptively, not a verdict" doctrine guard verbatim', () => {
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'burden_request_present');
  if (!entry) throw new Error('burden_request_present prompt entry missing');
  // Verbatim guard fragments from intent brief §4.2 + design §4.2.
  const expectedGuardFragment = 'debated philosophical territory';
  if (!entry.falsePositiveGuards.includes(expectedGuardFragment)) {
    throw new Error(
      `burden_request_present falsePositiveGuards missing "debated philosophical territory" guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
  const expectedNotVerdictFragment = 'descriptively, not as a verdict on which side is right';
  if (!entry.falsePositiveGuards.includes(expectedNotVerdictFragment)) {
    throw new Error(
      `burden_request_present falsePositiveGuards missing "descriptively, not as a verdict" guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family D evidence_gap_present prompt entry surfaces anti-amplification anchor verbatim', () => {
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'evidence_gap_present');
  if (!entry) throw new Error('evidence_gap_present prompt entry missing');
  // Verbatim guard fragments from intent brief §4.3 + design §4.3.
  const expectedAntiAmpFragment = 'Popularity / repetition / engagement are NOT evidence';
  if (!entry.falsePositiveGuards.includes(expectedAntiAmpFragment)) {
    throw new Error(
      `evidence_gap_present falsePositiveGuards missing anti-amplification anchor. Got: ${entry.falsePositiveGuards}`,
    );
  }
  const expectedNotFailureFragment = 'does NOT imply the move is dishonest, low-quality, or manipulative';
  if (!entry.falsePositiveGuards.includes(expectedNotFailureFragment)) {
    throw new Error(
      `evidence_gap_present falsePositiveGuards missing "does NOT imply dishonest/low-quality/manipulative" guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('Family D prompt template: no anecdote-as-weak framing in any per-key prompt entry', () => {
  // Stage 2B + intent brief §4.1: anecdote_used must NOT be framed as
  // weakness. Scan all per-key entries for accusatory shapes (treat
  // weakness language as positive emission about the move's value).
  // The doctrine guards LEGITIMATELY contain 'imply weakness' / 'imply low quality'
  // inside NOT-negation; we scan for unprefixed positive claims about weakness.
  for (const entry of FAMILY_D_PROMPT_ENTRIES) {
    const corpus = [entry.booleanQuestion, entry.positiveDefinition, entry.negativeDefinition,
                    entry.positiveExample, entry.negativeExample].join('\n');
    // Patterns that would frame anecdote as weakness (NOT inside NOT-negation).
    const weaknessPatterns: RegExp[] = [
      /\bis\s+weak\b/i,
      /\bis\s+inferior\b/i,
      /\bis\s+merely\b/i,
      /\bis\s+unreliable\b/i,
      /\bis\s+lesser\b/i,
    ];
    for (const re of weaknessPatterns) {
      if (re.test(corpus)) {
        throw new Error(
          `Family D entry ${entry.rawKey} contains anecdote-as-weak framing matching ${re}`,
        );
      }
    }
  }
});

Deno.test('Family D prompt template: no burden-as-verdict framing in burden_request_present per-key entry', () => {
  // Stage 2B + intent brief §4.2: burden_request_present must NOT be
  // framed as a verdict on which side bears the burden.
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'burden_request_present');
  if (!entry) throw new Error('burden_request_present entry missing');
  const corpus = [entry.booleanQuestion, entry.positiveDefinition, entry.negativeDefinition,
                  entry.positiveExample, entry.negativeExample].join('\n');
  const verdictPatterns: RegExp[] = [
    /\bthe\s+burden\s+is\s+truly\b/i,
    /\bactually\s+bears\s+the\s+burden\b/i,
    /\bthe\s+right\s+answer\b/i,
    /\bwho\s+is\s+correct\b/i,
  ];
  for (const re of verdictPatterns) {
    if (re.test(corpus)) {
      throw new Error(
        `burden_request_present entry contains verdict framing matching ${re}`,
      );
    }
  }
});

Deno.test('Family D prompt template: no evidence-gap-as-failure framing in evidence_gap_present per-key entry', () => {
  // Stage 2B + intent brief §4.3: evidence_gap_present must NOT be
  // framed as failure / dishonesty / low quality.
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'evidence_gap_present');
  if (!entry) throw new Error('evidence_gap_present entry missing');
  // Positive-tone framings (NOT negation) that would treat gap as failure.
  const corpus = [entry.booleanQuestion, entry.positiveDefinition, entry.negativeDefinition,
                  entry.positiveExample, entry.negativeExample].join('\n');
  const failurePatterns: RegExp[] = [
    /\bauthor\s+failed\b/i,
    /\bthe\s+move\s+is\s+false\b/i,
    /\bthe\s+move\s+is\s+lying\b/i,
    /\bproves\s+the\s+claim\s+is\s+wrong\b/i,
  ];
  for (const re of failurePatterns) {
    if (re.test(corpus)) {
      throw new Error(
        `evidence_gap_present entry contains failure framing matching ${re}`,
      );
    }
  }
});

Deno.test('Family D prompt template: no popularity-as-evidence framing in any per-key entry', () => {
  // Stage 2B + design §6 doctrine rationale: the anti-amplification
  // anchor is encoded in the prompt; no per-key entry may suggest
  // popularity / virality counts as evidence.
  const popularityAsEvidencePatterns: RegExp[] = [
    /\bwidely\s+believed\s+counts\b/i,
    /\bviral\s+claims\s+are\s+evidence\b/i,
    /\beveryone\s+knows\s+counts\b/i,
    /\bif\s+enough\s+people\s+say/i,
  ];
  for (const entry of FAMILY_D_PROMPT_ENTRIES) {
    const corpus = [entry.booleanQuestion, entry.positiveDefinition, entry.negativeDefinition,
                    entry.positiveExample, entry.negativeExample, entry.falsePositiveGuards].join('\n');
    for (const re of popularityAsEvidencePatterns) {
      if (re.test(corpus)) {
        throw new Error(
          `Family D entry ${entry.rawKey} contains popularity-as-evidence framing matching ${re}`,
        );
      }
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family D system prompt contains banned tokens only in negation form', () => {
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
    while ((match = globalPattern.exec(FAMILY_D_SYSTEM_PROMPT)) !== null) {
      const line = lineForMatch(FAMILY_D_SYSTEM_PROMPT, match.index);
      // Allow standard negation patterns and the doctrine-positive
      // "verdict on either participant" closing.
      const isNegation =
        line.includes(' NOT ') ||
        line.includes('NOT decide') ||
        line.includes('NOT treat') ||
        line.includes('NOT imply') ||
        line.includes('not as a verdict') ||
        line.includes('NOT determine');
      const isVerdictNegationClosing = line.includes('verdict on either participant');
      if (!isNegation && !isVerdictNegationClosing) {
        throw new Error(
          `DOCTRINE BAN-LIST hit in Family D system prompt OUTSIDE negation block: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

Deno.test('DOCTRINE BAN-LIST scan: Family D user prompt contains no banned tokens outside doctrine-positive negations or descriptive vocabulary', () => {
  // The user prompt iterates 22 Family D per-rawKey entries. Banned tokens
  // can appear as:
  //   (a) doctrine-positive negations ("MUST NOT", "Do NOT", "You do NOT",
  //       "does NOT imply", "never implies", "NOT decide", "NOT treat",
  //       "not a verdict", "not a failure", "not as a verdict")
  //   (b) the "verdict on either participant" closing-phrase
  //   (c) descriptive structural vocabulary: "correct" / "correction" /
  //       "corrected" / "corrects" / "correcting" (Schegloff/Sacks repair
  //       terminology shared with Family C — Family D's per-key text uses
  //       these terms only as repair-pattern names, not verdictively)
  //
  // Anything OUTSIDE these classes is a doctrine violation.
  const sample = buildFamilyDUserPrompt(buildRequest());

  function lineForMatch(text: string, matchIndex: number): string {
    const start = text.lastIndexOf('\n', matchIndex) + 1;
    const end = text.indexOf('\n', matchIndex);
    return text.slice(start, end === -1 ? text.length : end);
  }

  function isDoctrinePositive(line: string, matchedToken: string): boolean {
    if (
      line.includes(' NOT ') ||
      line.includes('NOT decide') ||
      line.includes('NOT treat') ||
      line.includes('NOT imply') ||
      line.includes('NOT determine') ||
      line.includes('never implies') ||
      line.includes('MUST NOT') ||
      line.includes('not a verdict') ||
      line.includes('not a failure') ||
      line.includes('not as a verdict') ||
      line.includes("not 'you are wrong'")
    ) {
      return true;
    }
    if (line.includes('verdict on either participant')) {
      return true;
    }
    // Descriptive Schegloff/Sacks repair-pattern names allowed.
    if (/correct/i.test(matchedToken)) {
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
          `DOCTRINE BAN-LIST hit in Family D user prompt OUTSIDE allowed classes: pattern ${pattern} matched on line: "${line}"`,
        );
      }
      if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1;
    }
  }
});

// OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — the shared response-envelope emission
// directive is interpolated immediately before the response-shape JSON example.
// Additive: the response-shape example itself is unchanged.
Deno.test('MODELINFO-SHAPE: Family D user prompt carries the modelInfo emission directive immediately before the response-shape example', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  const directiveIndex = prompt.indexOf(MODEL_INFO_EMISSION_DIRECTIVE);
  if (directiveIndex < 0) {
    throw new Error('Family D user prompt missing the modelInfo emission directive');
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

Deno.test('MODELINFO-SHAPE: Family D response-shape JSON example is unchanged by the directive', () => {
  const prompt = buildFamilyDUserPrompt(buildRequest());
  for (
    const fragment of [
      '"provider": "mcp"',
      '"serverName": "<server identifier>"',
      '"classifierSetVersion": "family-d-v1"',
    ]
  ) {
    if (!prompt.includes(fragment)) {
      throw new Error(`Family D response-shape example missing/altered fragment: ${fragment}`);
    }
  }
  if (prompt.split(MODEL_INFO_EMISSION_DIRECTIVE).length !== 2) {
    throw new Error('the modelInfo emission directive must appear exactly once');
  }
});
