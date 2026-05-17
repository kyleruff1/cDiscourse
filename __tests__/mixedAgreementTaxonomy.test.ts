/**
 * Mixed-agreement taxonomy — deterministic classifier tests.
 *
 * No network. No xAI. We assert:
 *  - "Broad accept, narrow decline" detected when a reply agrees with the
 *    main conclusion / value frame but rejects a specific scope / evidence /
 *    definition / causal point.
 *  - "Narrow accept, broad decline" detected when a reply grants a small
 *    premise / example but rejects via broad-quantifier language.
 *  - Tangents and jokes override mixed classes.
 *  - `playableTensionScore` rewards high coexistence + specific axis hooks
 *    and is dampened on tangent/joke/person-attack.
 *  - TS ↔ JS twin parity.
 *  - The flag object always carries `userReviewRequired: true` and never
 *    leaks moderation / verdict tokens.
 */
import * as path from 'path';
import {
  computeAgreementDisagreementVector,
} from '../src/features/engagementIntelligence/agreementScalar';
import { classifyMixedAgreement, toGradingFlags } from '../src/features/engagementIntelligence/mixedAgreementTaxonomy';

const repoRoot = process.cwd();

function flagsFor(rootText: string, replyText: string) {
  const v = computeAgreementDisagreementVector(rootText, replyText);
  return classifyMixedAgreement(v, rootText, replyText);
}

describe('classifyMixedAgreement — class boundaries', () => {
  it('detects broad_accept_narrow_decline ("I agree with the main point, but your scope is off")', () => {
    const f = flagsFor(
      'Settings pages should ship with search by default.',
      'I agree with the overall conclusion — most settings pages do need it. But narrow the claim: this is true for enterprise apps, not all consumer products.',
    );
    expect(f.mixedAgreementClass).toBe('broad_accept_narrow_decline');
    expect(f.broadAcceptor).toBe(true);
    expect(f.narrowDecliner).toBe(true);
    expect(f.userReviewRequired).toBe(true);
    expect(['ask_for_scope_boundary', 'ask_for_source', 'ask_for_definition']).toContain(f.suggestedGameNudge);
  });

  it('detects narrow_accept_broad_decline ("I grant the example, but the whole claim is wrong")', () => {
    const f = flagsFor(
      'Onboarding screens are usually an apology for bad UI.',
      'I grant that some onboarding screens are weak evidence of bad UI. But always saying they are an apology overstates it — that framing is wrong for every consumer app.',
    );
    expect(f.mixedAgreementClass).toBe('narrow_accept_broad_decline');
    expect(f.narrowAcceptor).toBe(true);
    expect(f.broadDecliner).toBe(true);
  });

  it('tangent overrides mixed classes', () => {
    const f = flagsFor(
      'Tabs are overused in product UI.',
      'Speaking of, off topic but my coffee shop is too loud lately.',
    );
    expect(f.mixedAgreementClass).toBe('tangent_or_joke');
    expect(f.suggestedGameNudge).toBe('split_tangent');
  });

  it('joke overrides mixed classes', () => {
    const f = flagsFor(
      'Tabs are overused.',
      'lol you might be onto something 😂',
    );
    expect(f.mixedAgreementClass).toBe('tangent_or_joke');
  });

  it('pure_accept when high agreement and almost no disagreement', () => {
    const f = flagsFor(
      'A useful empty state beats a tutorial for first-time users.',
      'Agreed. The overall conclusion is exactly right.',
    );
    expect(['pure_accept', 'broad_accept_narrow_decline']).toContain(f.mixedAgreementClass);
  });

  it('pure_decline when strong disagreement and no agreement', () => {
    const f = flagsFor(
      'Every successful product has good onboarding.',
      'Wrong. That does not follow at all. Non sequitur.',
    );
    expect(['pure_decline', 'narrow_accept_broad_decline']).toContain(f.mixedAgreementClass);
  });

  it('unclear_mixed when both signals are weak', () => {
    const f = flagsFor('A claim.', 'Maybe.');
    expect(['unclear_mixed', 'tangent_or_joke']).toContain(f.mixedAgreementClass);
  });
});

describe('playableTensionScore', () => {
  it('rewards mixed agreement + specific axis + narrowing markers', () => {
    const high = flagsFor(
      'Defense-first teams are more fun than highlight teams.',
      'Fair point on overall conclusion, but in this case the source for late-game viewership is the part to narrow — what counts as "fun" matters.',
    );
    const low = flagsFor('A claim.', 'lol idk 😂');
    expect(high.playableTensionScore).toBeGreaterThan(low.playableTensionScore);
    expect(high.playableTensionScore).toBeGreaterThan(0.4);
    expect(low.playableTensionScore).toBeLessThanOrEqual(0.3);
  });

  it('caps tangent / joke at <= 0.3', () => {
    const t = flagsFor('A claim.', 'Speaking of which, unrelated, parking is bad.');
    expect(t.playableTensionScore).toBeLessThanOrEqual(0.3);
  });

  it('depresses score when person-attack language is present', () => {
    const a = flagsFor('A claim.', 'You are a liar.');
    expect(a.playableTensionScore).toBeLessThan(0.3);
  });
});

describe('breadth bands', () => {
  it('agreementBreadth=broad when reply agrees with conclusion/value at high score', () => {
    const f = flagsFor(
      'Trash talk is part of sports literacy.',
      'I grant the overall conclusion. The value frame here is exactly right. But narrow that down for amateur leagues.',
    );
    expect(f.agreementBreadth).toBe('broad');
  });

  it('disagreementBreadth=broad when broad quantifiers AND broad axis', () => {
    const f = flagsFor(
      'Settings pages should ship with search.',
      'No, that framing is wrong — that is never the right approach for everyone.',
    );
    // Either pure_decline or narrow_accept_broad_decline; in either case the
    // broad axis with broad-quantifier language should classify as broad.
    expect(['broad', 'medium']).toContain(f.disagreementBreadth);
  });
});

describe('toGradingFlags', () => {
  it('returns only the production grading surface', () => {
    const f = flagsFor(
      'Settings pages should ship with search.',
      'Agreed on the overall conclusion. But narrow the claim — this is the scope point.',
    );
    const g = toGradingFlags(f);
    expect(Object.keys(g).sort()).toEqual(['broadAcceptor', 'broadDecliner', 'mixedAgreementClass', 'narrowAcceptor', 'narrowDecliner', 'playableTensionScore']);
  });
});

describe('safety invariants', () => {
  it('output JSON never contains forbidden moderation tokens', () => {
    const f = flagsFor(
      'A claim.',
      'Fair point but narrow the scope — what counts as success here?',
    );
    const blob = JSON.stringify(f).toLowerCase();
    for (const t of ['liar', 'dishonest', 'bad faith', 'manipulative', 'manipulation', 'extremist', 'propagandist', 'winner', 'loser', 'verdict']) {
      expect(blob).not.toContain(t);
    }
  });
});

describe('TS ↔ JS twin parity', () => {
  const jsTwin = require(path.join(repoRoot, 'scripts/engagement-intelligence/mixedAgreementTaxonomyJs.js'));

  const probes: { name: string; root: string; reply: string }[] = [
    { name: 'broad_accept_narrow_decline', root: 'Settings pages should ship with search.', reply: 'I agree with the overall conclusion. But narrow the claim — only for enterprise apps.' },
    { name: 'narrow_accept_broad_decline', root: 'Onboarding screens are usually an apology for bad UI.', reply: 'I grant the example, but always saying so is wrong for every consumer product.' },
    { name: 'tangent', root: 'Tabs are overused.', reply: 'Speaking of, off topic.' },
    { name: 'pure_accept', root: 'Read receipts make conversations worse.', reply: 'Agreed. Receipts make conversations more anxious.' },
    { name: 'unclear', root: 'A claim.', reply: 'Maybe.' },
  ];
  for (const probe of probes) {
    it(`TS and JS agree on ${probe.name}`, () => {
      const v = computeAgreementDisagreementVector(probe.root, probe.reply);
      const tsF = classifyMixedAgreement(v, probe.root, probe.reply);
      const jsF = jsTwin.classifyMixedAgreement(v, probe.root, probe.reply);
      expect(jsF.mixedAgreementClass).toBe(tsF.mixedAgreementClass);
      expect(jsF.broadAcceptor).toBe(tsF.broadAcceptor);
      expect(jsF.narrowAcceptor).toBe(tsF.narrowAcceptor);
      expect(jsF.broadDecliner).toBe(tsF.broadDecliner);
      expect(jsF.narrowDecliner).toBe(tsF.narrowDecliner);
      expect(Math.abs(jsF.playableTensionScore - tsF.playableTensionScore)).toBeLessThan(0.001);
      expect(jsF.suggestedGameNudge).toBe(tsF.suggestedGameNudge);
    });
  }
});
