/**
 * Stage 6.1.5.2 — Anti-amplification doctrine tests.
 *
 * Doctrine: popularity / repetition / engagement velocity / political identity
 * are NOT evidence. The schema may identify political frame for context but
 * must never grant factual standing on amplification alone.
 */
import * as fs from 'fs';
import * as path from 'path';

const det = require('../scripts/bot-fixtures/deterministicArgumentAnnotator');
const ann = require('../scripts/bot-fixtures/anthropicArgumentAnnotator');
const prompt = require('../scripts/bot-fixtures/anthropicAnnotationPrompt');

function detVector(over: Partial<Record<string, unknown>> = {}) {
  return {
    agreementScore: 0, disagreementScore: 0, coexistenceScore: 0, uncertaintyScore: 0.2,
    primaryStance: 'unclear', agreementType: 'none', disagreementType: 'none',
    replyFunction: 'unclear', scalarRationale: '', userReviewRequired: true, ...over,
  };
}

function annotate(bodyText: string, over: Record<string, unknown> = {}) {
  return det.deterministicAnnotate({
    scenario: { scenarioId: 's', roomId: 'r', resolution: 'X.' },
    move: { moveId: 'm', argumentType: 'claim', side: 'aff', body: bodyText, ...over },
    parent: null, thread: [], body: bodyText,
    deterministicVector: detVector(over.vector as Partial<Record<string, unknown>> || {}),
  });
}

describe('anti-amplification — viral / slogan / crowd-appeal text', () => {
  it('high engagement + low evidence → platformSupportWarning + suppress score gain', () => {
    const a = annotate('Going viral on the timeline. Everyone knows this is true. The whole timeline agrees.');
    expect(a.amplificationSignals.high_engagement_low_evidence).toBe(true);
    expect(a.amplificationSignals.appeal_to_virality).toBe(true);
    expect(a.amplificationSignals.appeal_to_crowd_size).toBe(true);
    expect(a.platformSupportWarning).toBe(true);
    expect(a.deterministicRuleCandidate.shouldSuppressScoreGainForAmplificationOnly).toBe(true);
    expect(a.deterministicRuleCandidate.shouldTreatAsOpinionNoFactualCredit).toBe(true);
    expect(a.recommendedGameTreatment).toBe('suppress_score_gain_for_amplification_only');
    expect(a.evidentiaryRisk).toBe('high');
    expect(a.amplificationRisk).toBe('high');
  });

  it('slogan-like repetition without target excerpt → flags slogan_or_chant_like', () => {
    const a = annotate('Wake up. Do your research. Follow the money. Open your eyes.');
    expect(a.amplificationSignals.slogan_or_chant_like).toBe(true);
    expect(a.amplificationSignals.copy_paste_risk).toBe(true);
    expect(a.platformSupportWarning).toBe(true);
  });

  it('factual allegation without evidence anchor → unknown_source_chain + ask_for_quote_anchor', () => {
    const a = annotate('They secretly admitted to it. Leaked emails prove it. Caught on tape.');
    expect(a.amplificationSignals.unknown_source_chain).toBe(true);
    expect(a.evidentiaryRisk).toBe('high');
    expect(a.deterministicRuleCandidate.shouldOfferQuoteAnchorForAllegation).toBe(true);
    expect(a.recommendedGameTreatment).toBe('ask_for_quote_anchor');
  });

  it('political generalization → shouldOfferScopeNarrowing', () => {
    const a = annotate('All democrats want to ban free speech. Every conservative is anti-science.');
    expect(a.deterministicRuleCandidate.shouldOfferScopeNarrowingForPoliticalGeneralization).toBe(true);
  });

  it('reply agrees strongly without adding evidence → platformSupportWarning', () => {
    const a = det.deterministicAnnotate({
      scenario: { scenarioId: 's', roomId: 'r', resolution: 'X.' },
      move: { moveId: 'm', argumentType: 'claim', side: 'aff', body: 'Exactly right. Spot on. Could not agree more.' },
      parent: { moveId: 'p', argumentType: 'thesis', body: 'X is unquestionable.' },
      thread: [], body: 'Exactly right. Spot on. Could not agree more.',
      deterministicVector: detVector({ agreementScore: 0.9, agreementType: 'conclusion' }),
    });
    expect(a.platformSupportWarning).toBe(true);
  });
});

describe('anti-amplification — receipt-backed text', () => {
  it('claim with attached evidence → evidentiaryRisk:low + no warning', () => {
    const a = det.deterministicAnnotate({
      scenario: { scenarioId: 's', roomId: 'r', resolution: 'X.' },
      move: {
        moveId: 'm', argumentType: 'evidence', side: 'aff',
        body: 'Per the official report, the agency confirmed the count was within the standard margin.',
        evidence: { label: 'Agency report 2025-Q3', sourceText: 'Page 14, table 2.' },
        targetExcerpt: 'count was within the standard margin',
      },
      parent: null, thread: [],
      body: 'Per the official report, the agency confirmed the count was within the standard margin.',
      deterministicVector: detVector(),
    });
    expect(a.evidentiaryRisk).toBe('low');
    expect(a.platformSupportWarning).toBe(false);
    expect(a.recommendedGameTreatment).toMatch(/allow_point_standing_after_evidence|allow_as_opinion_no_factual_credit/);
  });
});

describe('anti-amplification — text-only, no user labels', () => {
  it('never emits troll / bot / astroturf / propagandist / extremist anywhere in output', () => {
    const a = annotate('Going viral. Wake up. They secretly admitted it. Trust me, do your research.');
    const blob = JSON.stringify(a).toLowerCase();
    for (const t of ['troll', 'astroturf', 'astroturfer', 'propagandist', 'extremist', 'liar', 'dishonest', 'bad faith', 'manipulative']) {
      expect(blob).not.toContain(t);
    }
  });

  it('justification describes TEXT features, never the author', () => {
    const a = annotate('Going viral. Everyone knows this. Wake up.');
    const j = (a.justification || '').toLowerCase();
    // Justification never makes claims about the author.
    expect(j).not.toMatch(/this user|the author is|the speaker is/);
    // It does talk about text features.
    expect(j).toMatch(/text|claim|frame|signals|features/);
  });
});

describe('Anthropic prompt — anti-amplification doctrine encoded', () => {
  it('system prompt states popularity / repetition / engagement velocity / political identity are NOT evidence', () => {
    const sys = prompt.SYSTEM_PROMPT.toLowerCase();
    expect(sys).toMatch(/popularity is not evidence/i);
    expect(sys).toMatch(/repetition is not evidence/i);
    expect(sys).toMatch(/engagement velocity is not evidence/i);
    expect(sys).toMatch(/political identity is not evidence/i);
  });

  it('system prompt forbids user labels: troll, bot, astroturfer, plus existing verdict tokens', () => {
    const sys = prompt.SYSTEM_PROMPT.toLowerCase();
    for (const t of ['troll', 'bot', 'astroturfer', 'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist']) {
      expect(sys).toContain(t);
    }
  });

  it('system prompt frames politicalValence as describing TEXT, not user', () => {
    const sys = prompt.SYSTEM_PROMPT;
    expect(sys).toMatch(/politicalValence` describes the rhetorical frame of the TEXT, never the user/);
  });

  it('schema description enumerates every new field + label set', () => {
    const schema = prompt.SCHEMA_DESCRIPTION;
    for (const f of ['politicalIssueFrame', 'politicalValence', 'amplificationSignals', 'evidentiaryRisk', 'amplificationRisk', 'platformSupportWarning', 'recommendedGameTreatment', 'justification']) {
      expect(schema).toContain(f);
    }
    for (const v of ['election_process', 'culture_war', 'climate_energy', 'pro_institutional', 'anti_media_frame']) {
      expect(schema).toContain(v);
    }
    for (const k of ['repeated_claim_language', 'high_engagement_low_evidence', 'appeal_to_virality', 'unknown_source_chain']) {
      expect(schema).toContain(k);
    }
    for (const t of ['suppress_score_gain_for_amplification_only', 'ask_for_primary_source', 'allow_point_standing_after_evidence']) {
      expect(schema).toContain(t);
    }
  });

  it('schema description bumps schemaVersion to 2', () => {
    expect(prompt.SCHEMA_DESCRIPTION).toContain('"schemaVersion": 2');
  });
});

describe('annotator validation — accepts the new fields', () => {
  function fullV2() {
    return {
      schemaVersion: 2,
      moveId: 'm1', roomId: null, scenarioId: 's', parentMoveId: null,
      argumentType: 'thesis', side: 'aff',
      messageCategory: 'root_claim', primaryRhetoricalArchetype: 'unclear',
      secondaryRhetoricalArchetypes: [],
      opinionVector: {}, agreementDisagreementVector: {},
      issueDebtSignal: {}, gameImplication: {},
      qualifierCodes: [], categoryCodes: [],
      evidenceSignals: {}, threadSignals: {},
      modelJustification: { shortReason: 'ok', observableTextFeatures: [], uncertaintyNotes: [] },
      deterministicRuleCandidate: {
        shouldCreateRule: false, ruleName: null, ruleCondition: null, uiNudge: null,
        shouldSuppressScoreGainForAmplificationOnly: false,
        shouldAskForPrimarySource: true,
        shouldMarkEvidenceRiskHigh: false,
        shouldShowAmplificationRiskBadge: true,
        shouldTreatAsOpinionNoFactualCredit: false,
        shouldCreateIssueDebtForUnsupportedClaim: false,
        shouldOfferScopeNarrowingForPoliticalGeneralization: false,
        shouldOfferQuoteAnchorForAllegation: false,
        shouldBranchContextIfClaimNeedsBackground: false,
      },
      politicalIssueFrame: 'culture_war',
      politicalValence: 'populist_frame',
      amplificationSignals: { appeal_to_virality: true, repeated_claim_language: false, high_engagement_low_evidence: false, slogan_or_chant_like: false, copy_paste_risk: false, outrage_hook: false, link_without_receipt_context: false, screenshot_without_primary_source: false, appeal_to_crowd_size: false, unknown_source_chain: false },
      evidentiaryRisk: 'high', amplificationRisk: 'medium',
      platformSupportWarning: true,
      recommendedGameTreatment: 'ask_for_primary_source',
      justification: 'text shows appeal-to-virality features; claim lacks primary-source anchor.',
      userReviewRequired: true,
    };
  }

  it('validator accepts a complete v2 annotation and preserves all new fields', () => {
    const out = ann.validateAnnotation(fullV2(), {});
    expect(out).not.toBeNull();
    expect(out!.schemaVersion).toBe(2);
    expect(out!.politicalIssueFrame).toBe('culture_war');
    expect(out!.platformSupportWarning).toBe(true);
    expect(out!.amplificationSignals.appeal_to_virality).toBe(true);
    expect(out!.deterministicRuleCandidate.shouldAskForPrimarySource).toBe(true);
  });

  it('validator coerces invalid political frames to "unclear"', () => {
    const out = ann.validateAnnotation({ ...fullV2(), politicalIssueFrame: 'made_up_frame' }, {});
    expect(out!.politicalIssueFrame).toBe('unclear');
  });

  it('validator coerces invalid evidentiary risks to "unknown"', () => {
    const out = ann.validateAnnotation({ ...fullV2(), evidentiaryRisk: 'super_high' }, {});
    expect(out!.evidentiaryRisk).toBe('unknown');
  });

  it('validator forces unknown amplification-signal keys to false', () => {
    const out = ann.validateAnnotation({ ...fullV2(), amplificationSignals: { repeated_claim_language: 'yes-as-string' } }, {});
    expect(out!.amplificationSignals.repeated_claim_language).toBe(true); // Boolean('yes-as-string') === true
    expect(out!.amplificationSignals.appeal_to_virality).toBe(false);
  });
});

describe('schema source — file-level safety', () => {
  it('schema TS file documents the doctrine + FORBIDDEN_USER_LABELS', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/features/engagementIntelligence/anthropicArgumentAnnotations.ts'), 'utf8');
    expect(src).toMatch(/Popularity is not evidence/);
    expect(src).toMatch(/Repetition is not evidence/);
    expect(src).toMatch(/FORBIDDEN_USER_LABELS/);
  });
});
