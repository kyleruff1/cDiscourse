/**
 * Stage 6.1.5.1 — Anthropic annotator wrapper tests.
 *
 * Verifies:
 *  - validateAnnotation accepts a complete shape and rejects bad inputs
 *  - validateAnnotation rejects any forbidden verdict token
 *  - annotateMove falls back to the deterministic annotator when client errors
 *  - annotateMove falls back when client returns invalid JSON
 *  - annotateMove uses anthropic source when the JSON parses + validates
 *  - source file does not leak API keys / Authorization headers
 */
import * as fs from 'fs';
import * as path from 'path';

const ann = require('../scripts/bot-fixtures/anthropicArgumentAnnotator');

function fullAnnotation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    moveId: 'm1',
    roomId: 'room-1',
    scenarioId: 'scen-1',
    parentMoveId: null,
    argumentType: 'thesis',
    side: 'affirmative',
    messageCategory: 'root_claim',
    primaryRhetoricalArchetype: 'unclear',
    secondaryRhetoricalArchetypes: [],
    opinionVector: {
      broadAgreement: 0, narrowAgreement: 0, broadDisagreement: 0, narrowDisagreement: 0,
      coexistenceScore: 0, uncertaintyScore: 0.2, emotionalValence: 'neutral', heatLevel: 'cold',
    },
    agreementDisagreementVector: {
      agreementScore: 0, disagreementScore: 0, coexistenceScore: 0, uncertaintyScore: 0.2,
      primaryStance: 'unclear', agreementType: 'none', disagreementType: 'none',
      replyFunction: 'unclear', scalarRationale: '', userReviewRequired: true,
    },
    issueDebtSignal: { axis: 'none', created: false, repaired: false, unresolved: false, repairSuggestion: 'none' },
    gameImplication: {
      pressureCreated: false, pressureAxis: 'none', responderCanRecover: false,
      concessionWouldHelp: false, branchRecommended: false, playableTensionScore: 0,
      suggestedUiNudge: null, suggestedQualifierCode: null,
    },
    qualifierCodes: [],
    categoryCodes: ['root_claim'],
    evidenceSignals: { asksForSource: false, providesSource: false, asksForQuote: false, providesQuote: false, evidenceSpecificity: 'none' },
    threadSignals: { parentResponsive: false, topicDriftPossible: false, branchCandidate: false, depth: 0, chainRole: 'root' },
    modelJustification: { shortReason: 'plausible root claim', observableTextFeatures: [], uncertaintyNotes: [] },
    deterministicRuleCandidate: { shouldCreateRule: false, ruleName: null, ruleCondition: null, uiNudge: null },
    annotationSource: 'anthropic',
    userReviewRequired: true,
    ...overrides,
  };
}

describe('validateAnnotation', () => {
  it('accepts a complete annotation', () => {
    const out = ann.validateAnnotation(fullAnnotation(), { scenarioId: 'scen-1', roomId: 'room-1', parentMoveId: null });
    expect(out).not.toBeNull();
    expect(out!.userReviewRequired).toBe(true);
  });

  it('rejects when userReviewRequired is missing or false', () => {
    expect(ann.validateAnnotation(fullAnnotation({ userReviewRequired: false }), {})).toBeNull();
  });

  it('rejects when required scalar fields are missing', () => {
    const bad = fullAnnotation();
    delete (bad as Record<string, unknown>).moveId;
    expect(ann.validateAnnotation(bad, {})).toBeNull();
  });

  it('rejects when a forbidden verdict token appears anywhere in the JSON', () => {
    for (const t of ['liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist', 'winner', 'loser', 'stupid', 'idiot']) {
      const bad = fullAnnotation({ modelJustification: { shortReason: `the speaker is a ${t}`, observableTextFeatures: [], uncertaintyNotes: [] } });
      expect(ann.validateAnnotation(bad, {})).toBeNull();
    }
  });

  it('clamps numeric fields and normalizes missing sub-shapes', () => {
    const partial = {
      moveId: 'mx', argumentType: 'evidence', side: 'aff', userReviewRequired: true,
      opinionVector: { broadAgreement: 5, narrowDisagreement: -3 },
    };
    const out = ann.validateAnnotation(partial, { scenarioId: 's' });
    expect(out).not.toBeNull();
    expect(out!.opinionVector.broadAgreement).toBe(1);
    expect(out!.opinionVector.narrowDisagreement).toBe(0);
    expect(out!.issueDebtSignal.axis).toBe('none');
    expect(out!.gameImplication.pressureCreated).toBe(false);
    expect(out!.scenarioId).toBe('s');
  });
});

describe('annotateMove fallback paths', () => {
  const base = {
    scenario: { scenarioId: 'scen-1', roomId: 'room-1', resolution: 'Resolved: X.', moves: [] },
    move: { moveId: 'm1', argumentType: 'thesis', side: 'aff', body: 'X is the case.' },
    parent: null,
    thread: [],
    body: 'X is the case.',
    deterministicVector: { agreementScore: 0, disagreementScore: 0, coexistenceScore: 0, uncertaintyScore: 0, primaryStance: 'unclear', agreementType: 'none', disagreementType: 'none', replyFunction: 'unclear', scalarRationale: '', userReviewRequired: true },
  };

  it('falls back to deterministic when no client is provided', async () => {
    const out = await ann.annotateMove({ client: null, ...base });
    expect(out.annotationSource).toBe('deterministic_fallback');
    expect(out.userReviewRequired).toBe(true);
  });

  it('falls back when client throws on first + retry calls', async () => {
    const client = { generate: jest.fn(async () => { throw new Error('connection_reset'); }) };
    const out = await ann.annotateMove({ client, ...base });
    expect(client.generate).toHaveBeenCalledTimes(2);
    expect(out.annotationSource).toBe('deterministic_fallback');
    expect(out.modelJustification.shortReason).toMatch(/anthropic_invalid_or_error|Deterministic fallback/);
  });

  it('falls back when client returns invalid JSON twice', async () => {
    const client = { generate: jest.fn(async () => ({ text: 'not json at all' })) };
    const out = await ann.annotateMove({ client, ...base });
    expect(client.generate).toHaveBeenCalledTimes(2);
    expect(out.annotationSource).toBe('deterministic_fallback');
  });

  it('returns anthropic source when client returns valid JSON', async () => {
    const valid = JSON.stringify(fullAnnotation({ moveId: 'm1', argumentType: 'thesis', side: 'aff' }));
    const client = { generate: jest.fn(async () => ({ text: valid })) };
    const out = await ann.annotateMove({ client, ...base });
    expect(out.annotationSource).toBe('anthropic');
    expect(out.userReviewRequired).toBe(true);
  });

  it('returns anthropic_retry source when first call invalid, second valid', async () => {
    const valid = JSON.stringify(fullAnnotation({ moveId: 'm1', argumentType: 'thesis', side: 'aff' }));
    const client = {
      generate: jest.fn()
        .mockResolvedValueOnce({ text: 'oops not json' })
        .mockResolvedValueOnce({ text: valid }),
    };
    const out = await ann.annotateMove({ client, ...base });
    expect(out.annotationSource).toBe('anthropic_retry');
  });
});

describe('sanitizeAnnotationError', () => {
  it('strips secret-shape tokens from error messages', () => {
    const msg = ann.sanitizeAnnotationError(new Error('failed Bearer sk-ant-abcdef0123456789abcdef0123456789 trailing'));
    expect(msg).not.toMatch(/sk-ant-/);
    expect(msg).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{16,}/);
  });
});

describe('annotator source — file-level safety', () => {
  const repoRoot = process.cwd();
  const annPath = path.join(repoRoot, 'scripts/bot-fixtures/anthropicArgumentAnnotator.js');
  const detPath = path.join(repoRoot, 'scripts/bot-fixtures/deterministicArgumentAnnotator.js');

  it('annotator file does not contain Authorization header literals or hardcoded keys', () => {
    const src = fs.readFileSync(annPath, 'utf8');
    expect(src).not.toMatch(/sk-ant-[A-Za-z0-9]/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    expect(src).not.toMatch(/Authorization:\s*['"]/);
  });

  it('annotator file routes secret loading through claudeMessagesClient', () => {
    const src = fs.readFileSync(annPath, 'utf8');
    expect(src).toMatch(/require\(['"]\.\/claudeMessagesClient['"]\)/);
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/);
  });

  it('deterministic annotator never imports network / supabase / anthropic clients', () => {
    const src = fs.readFileSync(detPath, 'utf8');
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/require\(['"][^'"]*(anthropic|supabase|claudeMessagesClient|@supabase\/)/i);
    expect(src).not.toMatch(/import\s.*['"][^'"]*(anthropic|supabase)/i);
  });
});
