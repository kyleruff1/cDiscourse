/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: option + spine alignment validators.
 *
 * Asserts:
 *   - validateOptionAlignment fires when the body ignores the summary.
 *   - validateSpineAlignment fires when the body's opening doesn't match.
 *   - One retry, then deterministic skeleton-fill fallback on persistent fail.
 *   - All existing renderer validators (banned phrases, forbidden labels,
 *     length, target excerpt, concession marker) still fire.
 */
const renderer = require('../scripts/bot-fixtures/xaiAdversarialMoveRenderer');

const OPTION = {
  optionId: 'opt-001',
  bankName: 'evidence_pressure_options',
  skeleton: {
    targetExcerpt: 'mode shift on the parallel arterial',
    spineHint: 'quote-led',
    axisHint: 'evidence',
    summary: 'demand primary source mode shift mechanism parallel arterial traffic',
    evidenceDebt: ['primary source for the mode-shift number'],
    antiAmplificationNote: 'viral civic infographics are not primary records',
  },
};

describe('CORPUS-30 renderer alignment validators', () => {
  it('validateOptionAlignment passes when body contains targetExcerpt verbatim', () => {
    const body = 'I want to talk about mode shift on the parallel arterial; show the receipt.';
    expect(renderer.validateOptionAlignment(body, OPTION)).toBeNull();
  });

  it('validateOptionAlignment passes when ≥40% summary tokens overlap', () => {
    const body = 'Press on the primary source and the mechanism behind the mode shift; receipts for the parallel arterial traffic.';
    expect(renderer.validateOptionAlignment(body, OPTION)).toBeNull();
  });

  it('validateOptionAlignment fails when the body ignores the summary entirely', () => {
    const body = 'I think the weather was unusual that quarter and that explains everything.';
    const r = renderer.validateOptionAlignment(body, OPTION);
    expect(r).toMatch(/option_alignment_below_threshold/);
  });

  it('validateSpineAlignment passes when body has a quote in the first 80 chars (quote-led)', () => {
    const body = '"Cities that add a continuous bike lane" is the operative phrase; press on the mechanism.';
    expect(renderer.validateSpineAlignment(body, 'quote-led')).toBeNull();
  });

  it('validateSpineAlignment fails when body opening does not match the spine pattern', () => {
    const body = 'Just an observation about the corridor and the data set we have.';
    const r = renderer.validateSpineAlignment(body, 'quote-led');
    expect(r).toBe('spine_alignment_failed:quote-led');
  });

  it('deterministicSkeletonFill always produces a body that passes option alignment', () => {
    const body = renderer.deterministicSkeletonFill({
      selectedOption: OPTION, voiceId: 'empiricist', spineId: 'mechanism-led', parent: { body: 'parent body' },
    });
    expect(renderer.validateOptionAlignment(body, OPTION)).toBeNull();
  });

  it('renderAlignedAdversarialMove falls back to deterministic fill when client is null', async () => {
    const result = await renderer.renderAlignedAdversarialMove({
      selectedOption: OPTION,
      voiceId: 'empiricist',
      spineId: 'mechanism-led',
      attribution: { runTag: 'corpus-dev-synthetic-20260603-1422-cafebabe', threadIndex: 0, role: 'provocateur', moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 0 },
      parent: { body: 'parent body', argumentType: 'thesis', depth: 1 },
      persona: { skillRole: 'bot-provocateur', skillHash: 'prov-hash', alias: 'bot-a' },
      scene: { category: 'xai_adversarial', topicBucket: 'civic_policy', title: 'A claim' },
      slot: { argumentType: 'rebuttal', depth: 3 },
      skillBundle: { provocateurText: 'prov body', revocateurText: 'rev body' },
      conversationSummary: 'm1: a claim\nm2: an objection',
      client: null,
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.body.length).toBeGreaterThan(0);
    expect(result.selectedOptionId).toBe('opt-001');
    expect(result.voiceId).toBe('empiricist');
    expect(result.spineId).toBe('mechanism-led');
    expect(result.attribution).toMatchObject({ runTag: 'corpus-dev-synthetic-20260603-1422-cafebabe', threadIndex: 0, role: 'provocateur', moveIndex: 3 });
  });

  it('falls back to skeleton-fill when Anthropic ignores the option after retry', async () => {
    // Mock client that returns a body that fails option alignment both times.
    const client = {
      generate: async () => ({ text: JSON.stringify({ body: 'The weather changed last quarter.', disagreementAxis: 'evidence', mechanism: null }) }),
      snapshotUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    };
    const result = await renderer.renderAlignedAdversarialMove({
      selectedOption: OPTION,
      voiceId: 'empiricist',
      spineId: 'mechanism-led',
      attribution: { runTag: 'tag', threadIndex: 1, role: 'provocateur', moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 1 },
      parent: { body: 'parent', argumentType: 'thesis', depth: 1 },
      persona: { skillRole: 'bot-provocateur', skillHash: 'prov-hash', alias: 'bot-a' },
      scene: { category: 'xai_adversarial', topicBucket: 'civic_policy', title: 'A claim' },
      slot: { argumentType: 'rebuttal', depth: 3 },
      skillBundle: { provocateurText: 'prov body', revocateurText: 'rev body' },
      conversationSummary: '',
      client,
      maxRetries: 1,
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.validationFailureReason).toBe('validation_failed_after_retries');
    expect(result.alignmentFailureReason).toMatch(/option_alignment|spine_alignment/);
  });

  it('preserves existing validators: a banned canned phrase still fails', async () => {
    // Mock client returns body that aligns to option but contains a banned phrase.
    const summaryTokens = 'primary source mechanism mode shift parallel arterial';
    const body = `Counter to the previous point. Press on ${summaryTokens}; receipts please.`;
    expect(renderer.hasBannedCannedPhrase(body)).toBe(true);
    // The existing renderer signature still validates this.
    const client = {
      generate: async () => ({ text: JSON.stringify({ body, disagreementAxis: 'evidence', mechanism: 'm' }) }),
      snapshotUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    };
    const result = await renderer.renderAlignedAdversarialMove({
      selectedOption: OPTION,
      voiceId: 'empiricist',
      spineId: 'mechanism-led',
      attribution: { runTag: 'tag', threadIndex: 2, role: 'provocateur', moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 0 },
      parent: { body: 'parent', argumentType: 'thesis', depth: 1 },
      persona: { skillRole: 'bot-provocateur', skillHash: 'prov-hash', alias: 'bot-a' },
      scene: { category: 'xai_adversarial', topicBucket: 'civic_policy', title: 'A claim' },
      slot: { argumentType: 'rebuttal', depth: 3 },
      skillBundle: { provocateurText: 'prov body', revocateurText: 'rev body' },
      conversationSummary: '',
      client,
      maxRetries: 0,
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.validationFailureReason).toBe('validation_failed_after_retries');
  });

  it('passes when body satisfies option, spine, AND existing validators', async () => {
    const body = '"mode shift on the parallel arterial" is the operative quote; demand the primary source for that traffic mechanism.';
    const client = {
      generate: async () => ({ text: JSON.stringify({ body, disagreementAxis: 'evidence', mechanism: 'mode-shift' }) }),
      snapshotUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    };
    const result = await renderer.renderAlignedAdversarialMove({
      selectedOption: OPTION,
      voiceId: 'empiricist',
      spineId: 'quote-led',
      attribution: { runTag: 'tag', threadIndex: 3, role: 'provocateur', moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 0 },
      parent: { body: 'parent body about mode shift', argumentType: 'thesis', depth: 1 },
      persona: { skillRole: 'bot-provocateur', skillHash: 'prov-hash', alias: 'bot-a' },
      scene: { category: 'xai_adversarial', topicBucket: 'civic_policy', title: 'A claim' },
      slot: { argumentType: 'rebuttal', depth: 3 },
      skillBundle: { provocateurText: 'prov body', revocateurText: 'rev body' },
      conversationSummary: '',
      forceTargetExcerpt: 'mode shift on the parallel arterial',
      client,
    });
    expect(result.source).toBe('anthropic');
    expect(result.validationFailureReason).toBeNull();
    expect(result.alignmentFailureReason).toBeNull();
  });

  it('OPTION_ALIGNMENT_THRESHOLD is the documented v1 default (40%)', () => {
    expect(renderer.OPTION_ALIGNMENT_THRESHOLD).toBeCloseTo(0.40, 5);
  });

  it('SPINE_OPENING_PATTERNS covers all 9 spine ids', () => {
    const spines = ['quote-led', 'counterexample-led', 'definition-led', 'mechanism-led', 'scope-led', 'concession-then-pivot', 'question-led', 'analogy-led', 'second-order-effect-led'];
    for (const s of spines) {
      expect((renderer.SPINE_OPENING_PATTERNS as Record<string, RegExp>)[s]).toBeInstanceOf(RegExp);
    }
  });

  it('tokenize ignores stopwords and short tokens', () => {
    const t: string[] = renderer.tokenize('A primary source for the mechanism on the arterial');
    expect(t).toContain('primary');
    expect(t).toContain('source');
    expect(t).toContain('mechanism');
    expect(t).toContain('arterial');
    expect(t).not.toContain('the');
    expect(t).not.toContain('on');
    expect(t).not.toContain('a');
  });
});
