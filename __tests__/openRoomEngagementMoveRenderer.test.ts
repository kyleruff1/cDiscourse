/**
 * Stage 6.5 — Tests for the heat-aware engagement move renderer.
 *
 * These tests focus on the *shape* of the renderer's prompts and the
 * deterministic validators. We do NOT invoke Anthropic; the runner's
 * client is mocked. No network is hit.
 */
const renderer = require('../scripts/bot-fixtures/openRoomEngagementMoveRenderer');

const {
  buildEngagementSystemPrompt,
  buildEngagementUserPayload,
  parseModelResponse,
  ensureLengthBounds,
  hasConcessionMarker,
  hasBannedCannedPhrase,
  hasForbiddenUserLabel,
  looksAbusiveBody,
  deterministicFallbackBody,
  CONCESSION_MARKERS,
  BANNED_CANNED_PHRASES,
  FORBIDDEN_USER_LABELS,
  ALLOWED_AXES,
  REASON_CODE_AXIS_HINTS,
  renderEngagementMove,
} = renderer;

const SKILL_BODY = '## Identity\nYou are a test bot account in a dev environment.';

describe('buildEngagementSystemPrompt — HOT context is inlined verbatim', () => {
  it('includes the skill body, heat band, reason codes, recommended action, recent axes', () => {
    const sys = buildEngagementSystemPrompt({
      skillRole: 'bot-revocateur',
      skillBodyText: SKILL_BODY,
      skillHash: 'abcdef01',
      heatContext: {
        heatBand: 'hot',
        moveCount: 3,
        reasonCodes: ['source_chain_debt', 'evidence_debt'],
        recommendedAction: 'source_chain_pressure',
        recentAxes: ['evidence', 'evidence'],
      },
    });
    expect(sys).toContain('bot-revocateur');
    expect(sys).toContain('abcdef01');
    expect(sys).toContain('You are a test bot account');
    expect(sys).toContain('heat band:');
    expect(sys).toContain('hot');
    expect(sys).toContain('source_chain_debt');
    expect(sys).toContain('source_chain_pressure');
    // Anti-repeat: locked axis must be named
    expect(sys).toContain('AVOID repeating this axis again: evidence');
  });

  it('reminds the model that HOT does NOT mean popularity / virality / truth credit', () => {
    const sys = buildEngagementSystemPrompt({
      skillRole: 'bot-revocateur',
      skillBodyText: SKILL_BODY,
      skillHash: 'abcdef01',
      heatContext: { heatBand: 'warming', moveCount: 1, reasonCodes: [], recommendedAction: 'first_rebuttal', recentAxes: [] },
    });
    expect(sys.toLowerCase()).toContain('popularity');
    expect(sys.toLowerCase()).toContain('not evidence');
    expect(sys.toLowerCase()).toContain('hot does not mean rude');
  });

  it('lists every banned canned phrase verbatim so the model sees them', () => {
    const sys = buildEngagementSystemPrompt({
      skillRole: 'bot-provocateur',
      skillBodyText: SKILL_BODY,
      skillHash: '00112233',
      heatContext: { heatBand: 'warming', moveCount: 1, reasonCodes: [], recommendedAction: 'defend_root', recentAxes: [] },
    });
    expect(sys).toContain('Counter to the previous point');
    expect(sys).toContain('The causal disagreement is the heart of it');
    expect(sys).toContain('narrow back to');
  });

  it('names every forbidden user label in the body so the model sees them', () => {
    const sys = buildEngagementSystemPrompt({
      skillRole: 'bot-provocateur',
      skillBodyText: SKILL_BODY,
      skillHash: '00112233',
      heatContext: { heatBand: 'warming', moveCount: 1, reasonCodes: [], recommendedAction: 'defend_root', recentAxes: [] },
    });
    const lc = sys.toLowerCase();
    for (const lbl of FORBIDDEN_USER_LABELS) expect(lc).toContain(lbl);
  });
});

describe('buildEngagementUserPayload — includes parent body, slot, target excerpt', () => {
  it('inlines the parent body and the slot info', () => {
    const payload = buildEngagementUserPayload({
      scene: { titleRedacted: 'A topic <x-handle>' },
      parent: { argumentType: 'thesis', body: 'A broad claim about traffic policy.', depth: 0 },
      slot: { argumentType: 'rebuttal', depth: 2 },
      conversationSummary: '  prior1 (thesis): A broad claim about traffic policy.',
      forceTargetExcerpt: 'A broad claim',
      heatContext: { recommendedAction: 'first_rebuttal', heatBand: 'warming' },
    });
    expect(payload).toContain('A broad claim about traffic policy.');
    expect(payload).toMatch(/argumentType:\s+rebuttal/);
    expect(payload).toMatch(/depth \(1-indexed\):\s+2/);
    expect(payload).toContain('Quote this short phrase verbatim somewhere in the "body" field: "A broad claim".');
  });

  it('includes a retry note when one is provided', () => {
    const payload = buildEngagementUserPayload({
      scene: {}, parent: null, slot: { argumentType: 'rebuttal', depth: 2 },
      heatContext: { heatBand: 'warming', recommendedAction: 'first_rebuttal' },
      retryNote: 'Strict JSON; body 80-300 chars',
    });
    expect(payload).toContain('Retry note: Strict JSON; body 80-300 chars');
  });
});

describe('parseModelResponse — strict JSON contract', () => {
  it('parses a clean object', () => {
    const r = parseModelResponse('{"body":"Quote: \\"A claim\\". Mechanism unstated.","disagreementAxis":"evidence","mechanism":"unstated mechanism","targetExcerpt":"A claim"}');
    expect(r.body).toContain('Quote:');
    expect(r.axis).toBe('evidence');
    expect(r.mechanism).toBe('unstated mechanism');
    expect(r.targetExcerpt).toBe('A claim');
    expect(r.jsonParsed).toBe(true);
  });

  it('strips ```json fences', () => {
    const r = parseModelResponse('```json\n{"body":"A body that is plain prose, no fences.","disagreementAxis":"scope","mechanism":"overgeneralisation","targetExcerpt":"a body"}\n```');
    expect(r.body).toContain('plain prose');
    expect(r.axis).toBe('scope');
  });

  it('rejects an unknown axis (returns null axis)', () => {
    const r = parseModelResponse('{"body":"x","disagreementAxis":"vibes","mechanism":"y"}');
    expect(r.axis).toBeNull();
  });

  it('clears a body that still looks like a JSON wrapper', () => {
    const wrappedRaw = '{"body": "{\\"body\\": \\"actual body inside\\"}", "disagreementAxis": "evidence"}';
    const r = parseModelResponse(wrappedRaw);
    // The defensive unwrap reads the inner shape, so the result should be either
    // the inner body OR an empty string — but never the outer wrapper-shape string.
    expect(r.body).not.toMatch(/"body"\s*:/);
  });
});

describe('Validators — banned phrases, forbidden labels, abuse, concession, length', () => {
  it('detects banned canned phrases (case-insensitive)', () => {
    expect(hasBannedCannedPhrase('Counter to the previous point — nope.')).toBe(true);
    expect(hasBannedCannedPhrase('A natural reply.')).toBe(false);
  });

  it('detects forbidden user labels only in person-labeling context', () => {
    expect(hasForbiddenUserLabel('You are a propagandist.')).toBe('propagandist');
    expect(hasForbiddenUserLabel("they're bots.")).toBe('bot');
    // Bare use of the word "bot" should NOT trigger — this is a test bot itself.
    expect(hasForbiddenUserLabel('I am a test bot account.')).toBeNull();
  });

  it('detects abusive body tokens', () => {
    expect(looksAbusiveBody('<threat> against the speaker')).toBe(true);
    expect(looksAbusiveBody('kill yourself for thinking that')).toBe(true);
    expect(looksAbusiveBody('A regular natural argument.')).toBe(false);
  });

  it('detects concession markers', () => {
    expect(hasConcessionMarker('Fair point — i concede the narrow case.')).toBe(true);
    expect(hasConcessionMarker('A reply with no concession.')).toBe(false);
  });

  it('ensureLengthBounds truncates with ellipsis', () => {
    const long = 'x'.repeat(400);
    const out = ensureLengthBounds(long);
    expect(out.length).toBeLessThanOrEqual(360);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('deterministicFallbackBody — never violates the validators', () => {
  it('provocateur fallback contains no banned phrases / forbidden labels / abuse', () => {
    const body = deterministicFallbackBody({
      skillRole: 'bot-provocateur',
      parent: { body: 'A broad claim about traffic policy.' },
      heatContext: { recommendedAction: 'defend_root' },
    });
    expect(hasBannedCannedPhrase(body)).toBe(false);
    expect(hasForbiddenUserLabel(body)).toBeNull();
    expect(looksAbusiveBody(body)).toBe(false);
    expect(body.length).toBeGreaterThan(40);
  });

  it('revocateur fallback for first_rebuttal contains a quote and an evidence-debt phrase', () => {
    const body = deterministicFallbackBody({
      skillRole: 'bot-revocateur',
      parent: { body: 'A specific factual claim that needs receipts.' },
      heatContext: { recommendedAction: 'first_rebuttal' },
    });
    expect(body.toLowerCase()).toContain('quote');
    expect(body.toLowerCase()).toContain('evidence');
    expect(hasBannedCannedPhrase(body)).toBe(false);
    expect(hasForbiddenUserLabel(body)).toBeNull();
  });

  it('revocateur fallback for source_chain_pressure mentions primary source', () => {
    const body = deterministicFallbackBody({
      skillRole: 'bot-revocateur',
      parent: { body: 'The screenshot says X is happening.' },
      heatContext: { recommendedAction: 'source_chain_pressure' },
    });
    expect(body.toLowerCase()).toContain('primary');
  });
});

describe('renderEngagementMove — returns deterministic fallback when no client is provided', () => {
  it('produces a fallback move with no validation failures', async () => {
    const result = await renderEngagementMove({
      client: null,
      scene: { titleRedacted: 'Some topic' },
      parent: { argumentType: 'thesis', body: 'A broad claim about X.', depth: 0 },
      slot: { argumentType: 'rebuttal', depth: 1 },
      persona: { skillRole: 'bot-revocateur', alias: 'revocateur-bot', skillHash: 'abc12345' },
      skillBundle: { provocateurText: 'PROVO', revocateurText: 'REVO' },
      conversationSummary: '',
      heatContext: { heatBand: 'warming', moveCount: 0, reasonCodes: ['no_rebuttal'], recommendedAction: 'first_rebuttal', recentAxes: [] },
      fallbackAxis: 'evidence',
      forceTargetExcerpt: null,
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.body.length).toBeGreaterThan(40);
    expect(result.skillHash).toBe('abc12345');
    expect(result.chosenAxis).toBe('evidence');
  });

  it('returns anthropic source when the mock client produces clean strict JSON', async () => {
    const mock = {
      generate: async () => ({ text: '{"body":"Quote: \\"A broad claim\\". The mechanism is asserted without a primary source — evidence debt remains.","disagreementAxis":"evidence","mechanism":"unstated mechanism","targetExcerpt":"A broad claim"}' }),
      snapshotUsage: () => ({ calls: 1 }),
    };
    const result = await renderEngagementMove({
      client: mock,
      scene: { titleRedacted: 'Some topic' },
      parent: { argumentType: 'thesis', body: 'A broad claim about X.', depth: 0 },
      slot: { argumentType: 'rebuttal', depth: 1 },
      persona: { skillRole: 'bot-revocateur', alias: 'revocateur-bot', skillHash: 'abc12345' },
      skillBundle: { provocateurText: 'PROVO', revocateurText: 'REVO' },
      conversationSummary: '',
      heatContext: { heatBand: 'warming', moveCount: 1, reasonCodes: ['evidence_debt'], recommendedAction: 'ask_quote', recentAxes: [] },
      fallbackAxis: 'evidence',
      forceTargetExcerpt: 'A broad claim',
    });
    expect(result.source).toBe('anthropic');
    expect(result.chosenAxis).toBe('evidence');
    expect(result.body.toLowerCase()).toContain('a broad claim');
    expect(result.jsonParsed).toBe(true);
  });

  it('falls back when the mock client returns a banned canned phrase', async () => {
    const mock = {
      generate: async () => ({ text: '{"body":"Counter to the previous point — that is wrong.","disagreementAxis":"evidence","mechanism":"x","targetExcerpt":"prev"}' }),
    };
    const result = await renderEngagementMove({
      client: mock,
      scene: {},
      parent: { argumentType: 'thesis', body: 'A claim.', depth: 0 },
      slot: { argumentType: 'rebuttal', depth: 1 },
      persona: { skillRole: 'bot-revocateur', alias: 'r', skillHash: 'h' },
      skillBundle: { provocateurText: '', revocateurText: '' },
      conversationSummary: '',
      heatContext: { heatBand: 'warming', moveCount: 1, reasonCodes: [], recommendedAction: 'first_rebuttal', recentAxes: [] },
      fallbackAxis: 'evidence',
      maxRetries: 1,
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.validationFailureReason).toContain('banned_canned_phrase');
  });

  it('falls back when the mock client labels the other speaker', async () => {
    const mock = {
      generate: async () => ({ text: '{"body":"You are a propagandist. Bring receipts.","disagreementAxis":"evidence","mechanism":"x","targetExcerpt":"prev"}' }),
    };
    const result = await renderEngagementMove({
      client: mock,
      scene: {},
      parent: { argumentType: 'thesis', body: 'A claim.', depth: 0 },
      slot: { argumentType: 'rebuttal', depth: 1 },
      persona: { skillRole: 'bot-revocateur', alias: 'r', skillHash: 'h' },
      skillBundle: { provocateurText: '', revocateurText: '' },
      conversationSummary: '',
      heatContext: { heatBand: 'warming', moveCount: 1, reasonCodes: [], recommendedAction: 'first_rebuttal', recentAxes: [] },
      fallbackAxis: 'evidence',
      maxRetries: 1,
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.validationFailureReason).toMatch(/forbidden_user_label:propagandist/);
  });

  it('marks axisRepeatHit when the model returns the locked-out axis', async () => {
    const mock = {
      generate: async () => ({ text: '{"body":"Quote: \\"A claim\\". A natural evidence-pressure follow-up reply, no banned phrases, no labels.","disagreementAxis":"evidence","mechanism":"x","targetExcerpt":"A claim"}' }),
    };
    const result = await renderEngagementMove({
      client: mock,
      scene: {},
      parent: { argumentType: 'thesis', body: 'A claim.', depth: 0 },
      slot: { argumentType: 'rebuttal', depth: 1 },
      persona: { skillRole: 'bot-revocateur', alias: 'r', skillHash: 'h' },
      skillBundle: { provocateurText: '', revocateurText: '' },
      conversationSummary: '',
      heatContext: { heatBand: 'warming', moveCount: 3, reasonCodes: ['evidence_debt'], recommendedAction: 'ask_quote', recentAxes: ['evidence', 'evidence'] },
      fallbackAxis: 'scope',
      forceTargetExcerpt: 'A claim',
    });
    expect(result.source).toBe('anthropic');
    expect(result.axisRepeatHit).toBe(true);
  });
});

describe('Reason-code axis hints — catalogue health', () => {
  it('every hint axis is in the ALLOWED_AXES vocabulary', () => {
    for (const [code, hints] of Object.entries(REASON_CODE_AXIS_HINTS)) {
      for (const a of hints as string[]) {
        expect(ALLOWED_AXES).toContain(a);
      }
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it('CONCESSION_MARKERS and BANNED_CANNED_PHRASES are non-empty arrays', () => {
    expect(CONCESSION_MARKERS.length).toBeGreaterThan(0);
    expect(BANNED_CANNED_PHRASES.length).toBeGreaterThan(0);
  });
});
