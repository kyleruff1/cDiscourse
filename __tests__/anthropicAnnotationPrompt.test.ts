/**
 * Stage 6.1.5.1 — Anthropic annotation prompt builder safety + shape tests.
 */
const promptModule = require('../scripts/bot-fixtures/anthropicAnnotationPrompt');

describe('anthropicAnnotationPrompt — system prompt safety contract', () => {
  const sys = promptModule.SYSTEM_PROMPT;

  it('forbids truth verdicts and judging who is correct', () => {
    expect(sys).toMatch(/NOT a truth engine/);
    expect(sys).toMatch(/NOT a moderator/);
    expect(sys).toMatch(/NOT a judge/);
    expect(sys).toMatch(/DO NOT decide who is correct/i);
    expect(sys).toMatch(/winning|losing/);
  });

  it('forbids labeling users as liar, dishonest, bad faith, manipulative, extremist, propagandist, stupid, idiot', () => {
    for (const t of ['liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot']) {
      expect(sys.toLowerCase()).toContain(t);
    }
  });

  it('forbids demographic / political / religious / health / sexuality / protected-class inference', () => {
    expect(sys).toMatch(/demographic/i);
    expect(sys).toMatch(/political/i);
    expect(sys).toMatch(/religious/i);
    expect(sys).toMatch(/health/i);
    expect(sys).toMatch(/sexuality/i);
    expect(sys).toMatch(/protected-class/i);
  });

  it('forbids moderation recommendations and demands compact JSON only', () => {
    expect(sys).toMatch(/moderation/i);
    expect(sys).toMatch(/compact JSON/i);
    expect(sys).toMatch(/userReviewRequired/);
  });
});

describe('anthropicAnnotationPrompt — user prompt shape', () => {
  function baseInput() {
    return {
      scenarioId: 'scen-1', roomId: 'room-9', rootClaim: 'X is the case', topicResolution: 'Resolved: X.', topicKeywords: ['x', 'y'],
      thread: [
        { moveId: 'm1', argumentType: 'thesis', side: 'aff', parentMoveId: null, body: 'X is the case because…' },
        { moveId: 'm2', argumentType: 'rebuttal', side: 'neg', parentMoveId: 'm1', body: 'No, your scope is too broad.' },
      ],
      parent: { moveId: 'm2', argumentType: 'rebuttal', body: 'No, your scope is too broad.' },
      moveId: 'm3', argumentType: 'evidence', side: 'aff', disagreementAxis: null,
      body: 'Here is a receipt for X: report ABC.', targetExcerpt: 'scope is too broad',
      evidence: { label: 'Report ABC', sourceText: 'Table 2 of report ABC.' },
      deterministicVector: { agreementScore: 0.1, disagreementScore: 0.4, coexistenceScore: 0.2, uncertaintyScore: 0.2, primaryStance: 'weak_disagree', agreementType: 'none', disagreementType: 'scope', replyFunction: 'rebut_scope', scalarRationale: '', userReviewRequired: true },
    };
  }

  it('includes scenario / root / parent / current move sections in user prompt', () => {
    const { user, system } = promptModule.buildAnnotationPrompt(baseInput());
    expect(typeof system).toBe('string');
    expect(user).toMatch(/scenarioId: scen-1/);
    expect(user).toMatch(/rootClaim: X is the case/);
    expect(user).toMatch(/parentMoveId: m2/);
    expect(user).toMatch(/moveId: m3/);
    expect(user).toMatch(/argumentType: evidence/);
    expect(user).toMatch(/Here is a receipt for X/);
    expect(user).toMatch(/attachedEvidence/);
    expect(user).toMatch(/Deterministic stance vector/);
    expect(user).toMatch(/Output the JSON object only/);
  });

  it('includes the schema description with all label sets', () => {
    const { user } = promptModule.buildAnnotationPrompt(baseInput());
    for (const v of ['root_claim', 'challenge', 'concession', 'synthesis', 'tangent']) expect(user).toContain(v);
    for (const v of ['receipt_demander', 'scope_narrower', 'evidence_challenger', 'concession_repairer']) expect(user).toContain(v);
    for (const v of ['fact', 'definition', 'causal', 'scope', 'framing']) expect(user).toContain(v);
    for (const v of ['provide_receipt', 'quote_exact_bit', 'narrow_scope', 'branch_thread']) expect(user).toContain(v);
  });

  it('does not embed any API key, Authorization, or secret-shape token', () => {
    const { user, system } = promptModule.buildAnnotationPrompt(baseInput());
    const blob = `${system}\n${user}`;
    expect(blob).not.toMatch(/Authorization:/);
    expect(blob).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    expect(blob).not.toMatch(/sk-ant-/);
    expect(blob).not.toMatch(/sb_secret_/);
    expect(blob).not.toMatch(/xai-/);
  });
});
