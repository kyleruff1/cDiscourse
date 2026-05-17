/**
 * Stage 6.1.5.2 — X News anti-amplification report section tests.
 */
import * as fs from 'fs';
import * as path from 'path';

const reporter = require('../scripts/engagement-intelligence/xNewsAntiAmplificationReport');

function mockPair(rootText: string, replyText: string, idx: number, opts: Record<string, unknown> = {}) {
  return {
    pairId: `pair-${idx}`,
    rootText, replyText,
    _rootTextRedacted: rootText, _replyTextRedacted: replyText,
    finalVector: {
      agreementScore: 0.4, disagreementScore: 0.2, coexistenceScore: 0.3,
      uncertaintyScore: 0.2, primaryStance: 'weak_agree',
      agreementType: 'conclusion', disagreementType: 'none',
      replyFunction: 'agree', scalarRationale: '', userReviewRequired: true,
    },
    mixedFlags: {
      mixedAgreementClass: 'broad_accept_narrow_decline',
      broadAcceptor: true, narrowAcceptor: false, broadDecliner: false,
      narrowDecliner: true, playableTensionScore: 0.6,
      suggestedGameNudge: 'ask_for_scope_boundary',
    },
    ...opts,
  };
}

describe('buildAntiAmplificationSection — shape + safety', () => {
  it('produces markdown with per-pair root + reply annotations', () => {
    const pairs = [
      mockPair('Climate policy: a carbon-capture mandate accelerates decarbonization.', 'Exactly right. Going viral on the timeline today. Everyone knows this.', 0),
      mockPair('Election integrity remains a top concern for many voters.', 'They secretly admitted the system is rigged. Wake up — do your research.', 1),
    ];
    const interpretations = pairs.map((p) => ({ pairId: p.pairId, finalVector: p.finalVector, mixedFlags: p.mixedFlags, _rootTextRedacted: p._rootTextRedacted, _replyTextRedacted: p._replyTextRedacted }));
    const { markdown, rootAnnotations, replyAnnotations } = reporter.buildAntiAmplificationSection({ pairs, interpretations });
    expect(rootAnnotations).toHaveLength(2);
    expect(replyAnnotations).toHaveLength(2);
    expect(markdown).toMatch(/## Anti-amplification doctrine — root \+ reply annotations/);
    expect(markdown).toMatch(/Aggregate — roots/);
    expect(markdown).toMatch(/Aggregate — replies/);
    expect(markdown).toMatch(/Top issue frames \(roots\)/);
    expect(markdown).toMatch(/Top political valence frames/);
    expect(markdown).toMatch(/Evidentiary risk \(replies\)/);
    expect(markdown).toMatch(/Amplification signals fired \(replies\)/);
    expect(markdown).toMatch(/Deterministic rule flags fired \(replies\)/);
    expect(markdown).toMatch(/High amplification-risk \/ low-evidence pairs/);
    expect(markdown).toMatch(/Claims that should NOT receive factual standing/);
    expect(markdown).toMatch(/Claims that could receive standing AFTER evidence/);
    expect(markdown).toMatch(/Broad agreement \+ narrow disagreement coexists/);
    expect(markdown).toMatch(/## Anti-amplification recommendations/);
  });

  it('surfaces per-pair fields (stance, agreementScalar, evidentiaryRisk, recommendedGameTreatment)', () => {
    const pairs = [mockPair('A debatable resolution.', 'A specific reply with quote anchor "debatable" and primary source receipt.', 0)];
    const interpretations = pairs.map((p) => ({ pairId: p.pairId, finalVector: p.finalVector, mixedFlags: p.mixedFlags, _rootTextRedacted: p._rootTextRedacted, _replyTextRedacted: p._replyTextRedacted }));
    const { markdown } = reporter.buildAntiAmplificationSection({ pairs, interpretations });
    expect(markdown).toMatch(/reply\.stance:/);
    expect(markdown).toMatch(/reply\.agreementScalar:/);
    expect(markdown).toMatch(/reply\.evidentiaryRisk:/);
    expect(markdown).toMatch(/reply\.recommendedGameTreatment:/);
    expect(markdown).toMatch(/reply\.issueDebtCreated:/);
    expect(markdown).toMatch(/reply\.justification:/);
  });

  it('never emits forbidden user labels in any section', () => {
    const pairs = [mockPair(
      'They claim X is the case.',
      'You are a liar and a propagandist — wake up — bad faith manipulation — extremist.',
      0,
    )];
    const interpretations = pairs.map((p) => ({ pairId: p.pairId, finalVector: p.finalVector, mixedFlags: p.mixedFlags, _rootTextRedacted: p._rootTextRedacted, _replyTextRedacted: p._replyTextRedacted }));
    const { markdown, replyAnnotations } = reporter.buildAntiAmplificationSection({ pairs, interpretations });
    // The annotator-authored fields never contain verdict tokens. We check
    // the rendered LABELS and ANNOTATION fields, not the raw quoted body
    // (which is shown verbatim — the body itself is X user input, redacted
    // by the upstream pilot redactor).
    const annJson = JSON.stringify(replyAnnotations[0]).toLowerCase();
    for (const t of ['liar', 'propagandist', 'extremist', 'manipulative', 'bad faith', 'troll', 'astroturf']) {
      expect(annJson).not.toContain(t);
    }
    expect(markdown).toMatch(/justification/);
  });

  it('returns rootAnnotations + replyAnnotations as full schema-v2 shape', () => {
    const pairs = [mockPair('Root.', 'Reply.', 0)];
    const interpretations = pairs.map((p) => ({ pairId: p.pairId, finalVector: p.finalVector, mixedFlags: p.mixedFlags, _rootTextRedacted: p._rootTextRedacted, _replyTextRedacted: p._replyTextRedacted }));
    const { rootAnnotations, replyAnnotations } = reporter.buildAntiAmplificationSection({ pairs, interpretations });
    for (const a of [...rootAnnotations, ...replyAnnotations]) {
      expect(a.schemaVersion).toBe(2);
      expect(a.userReviewRequired).toBe(true);
      expect(typeof a.politicalIssueFrame).toBe('string');
      expect(typeof a.evidentiaryRisk).toBe('string');
      expect(typeof a.platformSupportWarning).toBe('boolean');
      expect(typeof a.amplificationSignals).toBe('object');
      expect(typeof a.deterministicRuleCandidate.shouldAskForPrimarySource).toBe('boolean');
    }
  });
});

describe('xNewsAntiAmplificationReport — file-level safety', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'scripts/engagement-intelligence/xNewsAntiAmplificationReport.js'), 'utf8');

  it('does not import network / xAI / Anthropic clients', () => {
    expect(src).not.toMatch(/require\(['"][^'"]*fetch[^'"]*['"]\)/);
    expect(src).not.toMatch(/require\(['"][^'"]*anthropic[^'"]*['"]\)/i);
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/);
    expect(src).not.toMatch(/process\.env\.XAI_API_KEY/);
  });

  it('annotates via the deterministic annotator (dev-only, no network)', () => {
    expect(src).toMatch(/deterministicAnnotate/);
  });
});
