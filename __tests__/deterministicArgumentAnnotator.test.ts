/**
 * Stage 6.1.5.1 — Deterministic fallback annotator shape + behavior tests.
 */
const det = require('../scripts/bot-fixtures/deterministicArgumentAnnotator');

function detVector(over: Partial<Record<string, unknown>> = {}) {
  return {
    agreementScore: 0, disagreementScore: 0, coexistenceScore: 0, uncertaintyScore: 0.2,
    primaryStance: 'unclear', agreementType: 'none', disagreementType: 'none',
    replyFunction: 'unclear', scalarRationale: '', userReviewRequired: true, ...over,
  };
}

describe('deterministicAnnotate — output shape', () => {
  it('returns the full AnthropicArgumentAnnotation shape', () => {
    const a = det.deterministicAnnotate({
      scenario: { scenarioId: 'scen-1', roomId: 'room-1', resolution: 'X.' },
      move: { moveId: 'm1', argumentType: 'thesis', side: 'aff', body: 'X is the case.' },
      parent: null, thread: [], body: 'X is the case.',
      deterministicVector: detVector(),
      reason: 'no_anthropic_client',
    });

    expect(a.schemaVersion).toBe(2);
    expect(a.moveId).toBe('m1');
    expect(a.userReviewRequired).toBe(true);
    expect(a.annotationSource).toBe('deterministic_fallback');
    // Stage 6.1.5.2 — anti-amplification fields are always present.
    expect(typeof a.politicalIssueFrame).toBe('string');
    expect(typeof a.politicalValence).toBe('string');
    expect(typeof a.evidentiaryRisk).toBe('string');
    expect(typeof a.amplificationRisk).toBe('string');
    expect(typeof a.platformSupportWarning).toBe('boolean');
    expect(typeof a.recommendedGameTreatment).toBe('string');
    expect(typeof a.justification).toBe('string');
    expect(a.amplificationSignals).toEqual(expect.objectContaining({
      repeated_claim_language: expect.any(Boolean),
      high_engagement_low_evidence: expect.any(Boolean),
      slogan_or_chant_like: expect.any(Boolean),
      appeal_to_virality: expect.any(Boolean),
    }));
    expect(a.deterministicRuleCandidate).toEqual(expect.objectContaining({
      shouldSuppressScoreGainForAmplificationOnly: expect.any(Boolean),
      shouldAskForPrimarySource: expect.any(Boolean),
      shouldMarkEvidenceRiskHigh: expect.any(Boolean),
      shouldShowAmplificationRiskBadge: expect.any(Boolean),
      shouldTreatAsOpinionNoFactualCredit: expect.any(Boolean),
      shouldCreateIssueDebtForUnsupportedClaim: expect.any(Boolean),
      shouldOfferScopeNarrowingForPoliticalGeneralization: expect.any(Boolean),
      shouldOfferQuoteAnchorForAllegation: expect.any(Boolean),
      shouldBranchContextIfClaimNeedsBackground: expect.any(Boolean),
    }));
    expect(typeof a.messageCategory).toBe('string');
    expect(typeof a.primaryRhetoricalArchetype).toBe('string');
    expect(Array.isArray(a.secondaryRhetoricalArchetypes)).toBe(true);
    expect(Array.isArray(a.qualifierCodes)).toBe(true);
    expect(Array.isArray(a.categoryCodes)).toBe(true);
    expect(a.opinionVector).toBeDefined();
    expect(a.agreementDisagreementVector).toBeDefined();
    expect(a.issueDebtSignal).toBeDefined();
    expect(a.gameImplication).toBeDefined();
    expect(a.evidenceSignals).toBeDefined();
    expect(a.threadSignals).toBeDefined();
    expect(a.modelJustification.shortReason).toBeTruthy();
    expect(a.deterministicRuleCandidate).toBeDefined();
  });

  it('classifies a receipt-demanding rebuttal as receipt_demander and creates a rule candidate', () => {
    const a = det.deterministicAnnotate({
      scenario: { scenarioId: 's', roomId: 'r', resolution: 'X.' },
      move: { moveId: 'm9', argumentType: 'rebuttal', side: 'neg', body: 'Source? Where is this from? Drop the receipts.', disagreementAxis: 'evidence' },
      parent: { moveId: 'm1', argumentType: 'thesis', body: 'X is broadly the case.' },
      thread: [{ moveId: 'm1', argumentType: 'thesis', side: 'aff', parentMoveId: null, body: 'X is broadly the case.' }],
      body: 'Source? Where is this from? Drop the receipts.',
      deterministicVector: detVector({ disagreementScore: 0.5, disagreementType: 'evidence' }),
    });
    expect(a.primaryRhetoricalArchetype).toBe('receipt_demander');
    expect(a.deterministicRuleCandidate.shouldCreateRule).toBe(true);
    expect(a.issueDebtSignal.created).toBe(true);
    expect(a.issueDebtSignal.repairSuggestion).toBe('provide_receipt');
  });

  it('classifies a concession as concession_repairer with repaired:true', () => {
    const a = det.deterministicAnnotate({
      scenario: { scenarioId: 's', roomId: 'r', resolution: 'X.' },
      move: { moveId: 'm5', argumentType: 'concession', side: 'aff', body: 'You are right about that specific edge case. I narrow my claim.' },
      parent: { moveId: 'm4', argumentType: 'rebuttal', body: 'Your scope is too broad — edge case foo breaks it.' },
      thread: [],
      body: 'You are right about that specific edge case. I narrow my claim.',
      deterministicVector: detVector({ agreementScore: 0.5, coexistenceScore: 0.4 }),
    });
    expect(a.messageCategory).toBe('concession');
    expect(a.primaryRhetoricalArchetype).toBe('concession_repairer');
    expect(a.issueDebtSignal.repaired).toBe(true);
  });

  it('emits userReviewRequired=true on every output regardless of input', () => {
    for (const argType of ['thesis', 'claim', 'rebuttal', 'evidence', 'concession', 'synthesis', 'clarification_request']) {
      const a = det.deterministicAnnotate({
        scenario: { scenarioId: 's', roomId: 'r', resolution: 'X.' },
        move: { moveId: 'mq', argumentType: argType, side: 'aff', body: 'test body' },
        parent: null, thread: [], body: 'test body', deterministicVector: detVector(),
      });
      expect(a.userReviewRequired).toBe(true);
    }
  });

  it('never emits any forbidden verdict token in the output JSON', () => {
    const a = det.deterministicAnnotate({
      scenario: { scenarioId: 's', roomId: 'r', resolution: 'X.' },
      move: { moveId: 'm', argumentType: 'rebuttal', side: 'neg', body: 'wrong, this is bad faith manipulation by a propagandist', disagreementAxis: 'evidence' },
      parent: { moveId: 'p', argumentType: 'thesis', body: 'X is the case.' },
      thread: [], body: 'wrong, this is bad faith manipulation by a propagandist',
      deterministicVector: detVector({ disagreementScore: 0.8 }),
    });
    const j = JSON.stringify({ ...a, _: undefined });
    // The deterministic annotator must not propagate verdict tokens into its own labels.
    // We check fields that the annotator authors (NOT the user body which is the input).
    for (const f of ['messageCategory', 'primaryRhetoricalArchetype', 'qualifierCodes', 'categoryCodes', 'modelJustification']) {
      const fieldJson = JSON.stringify((a as Record<string, unknown>)[f]).toLowerCase();
      for (const t of ['liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist', 'winner', 'loser']) {
        expect(fieldJson).not.toContain(t);
      }
    }
    expect(j.length).toBeGreaterThan(0);
  });
});
