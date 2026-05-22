/**
 * MCP-019 — `bannerSelectionInputFromPacket` tests.
 *
 * The packet → `BannerSelectionInput` adapter (Defect 1). Covers the
 * positive-binary filter (value === 1 only, packet order, confidence carried),
 * the empty-`categoryReadings` v1 path, the forward-compatible `LedgerResult`
 * path, and the "feeds selectBanner without a type error" integration.
 */
import { buildBannerSelectionInputFromPacket } from '../src/features/refereeBanners/bannerSelectionInputFromPacket';
import { selectBanner } from '../src/features/refereeBanners/selectBanner';
import { VALID_FIXTURES } from '../src/features/semanticReferee/semanticRefereeFixtures';
import type { SemanticRefereePacket } from '../src/features/semanticReferee/semanticRefereeTypes';
import type { LedgerResult } from '../src/features/refereeLedger/types';

function packetWithBinaries(
  binaries: SemanticRefereePacket['binaries'],
): SemanticRefereePacket {
  return { ...VALID_FIXTURES.validMinimal, binaries };
}

describe('buildBannerSelectionInputFromPacket — positive binaries', () => {
  it('keeps only value === 1 binaries, in packet order', () => {
    const packet = packetWithBinaries([
      { classifierId: 'responds_to_parent', value: 1, confidence: 'high', reasonCode: 'parent_continuity_a' },
      { classifierId: 'introduces_new_issue', value: 0, confidence: 'medium', reasonCode: 'parent_continuity_b' },
      { classifierId: 'provides_evidence', value: 1, confidence: 'low', reasonCode: 'evidence_c' },
    ]);
    const input = buildBannerSelectionInputFromPacket(packet);
    expect(input.positiveBinaries.map((b) => b.classifierId)).toEqual([
      'responds_to_parent',
      'provides_evidence',
    ]);
  });

  it('carries the confidence of each positive binary', () => {
    const packet = packetWithBinaries([
      { classifierId: 'responds_to_parent', value: 1, confidence: 'high', reasonCode: 'parent_continuity_a' },
      { classifierId: 'provides_evidence', value: 1, confidence: 'low', reasonCode: 'evidence_c' },
    ]);
    const input = buildBannerSelectionInputFromPacket(packet);
    expect(input.positiveBinaries).toEqual([
      { classifierId: 'responds_to_parent', confidence: 'high' },
      { classifierId: 'provides_evidence', confidence: 'low' },
    ]);
  });

  it('returns an empty positiveBinaries list when no binary reads 1', () => {
    const packet = packetWithBinaries([
      { classifierId: 'responds_to_parent', value: 0, confidence: 'high', reasonCode: 'parent_continuity_a' },
    ]);
    const input = buildBannerSelectionInputFromPacket(packet);
    expect(input.positiveBinaries).toEqual([]);
  });
});

describe('buildBannerSelectionInputFromPacket — categoryReadings', () => {
  it('is [] when no LedgerResult is supplied (the v1 reality)', () => {
    const input = buildBannerSelectionInputFromPacket(VALID_FIXTURES.validContinuity);
    expect(input.categoryReadings).toEqual([]);
  });

  it('maps a LedgerResult 1:1 when one is supplied (forward-compat path)', () => {
    const ledger: LedgerResult = {
      pointId: 'p',
      moveArgumentId: 'm',
      categoryReadings: [
        {
          category: 'continuity',
          delta: 0.2,
          outcome: 'agreement',
          confidence: 'high',
          requiresUserChoice: false,
          feedbackCode: 'clean_parent_tie',
          factualStandingAxis: false,
          creditAxis: 'hygiene',
        },
      ],
      economyDelta: null,
      antiAmplification: null,
      ineligibilityReasons: [],
      needsUserChoice: false,
      exploitRiskScore: 0,
      creditStates: [],
      userReviewRequired: true,
    };
    const input = buildBannerSelectionInputFromPacket(VALID_FIXTURES.validContinuity, ledger);
    expect(input.categoryReadings).toEqual([
      {
        feedbackCode: 'clean_parent_tie',
        confidence: 'high',
        outcome: 'agreement',
        requiresUserChoice: false,
      },
    ]);
  });
});

describe('buildBannerSelectionInputFromPacket — guards', () => {
  it('returns the empty input shape for a null packet (never throws)', () => {
    const input = buildBannerSelectionInputFromPacket(null);
    expect(input).toEqual({ positiveBinaries: [], categoryReadings: [] });
  });

  it('returns the empty input shape for undefined (never throws)', () => {
    const input = buildBannerSelectionInputFromPacket(undefined);
    expect(input).toEqual({ positiveBinaries: [], categoryReadings: [] });
  });
});

describe('buildBannerSelectionInputFromPacket — feeds selectBanner', () => {
  it('a VALID_FIXTURES packet produces a deterministic BannerSelectionResult', () => {
    const input = buildBannerSelectionInputFromPacket(VALID_FIXTURES.validContinuity);
    const result = selectBanner(input);
    // Deterministic — same input → same result.
    expect(selectBanner(input)).toEqual(result);
    // The result is a well-formed BannerSelectionResult.
    expect(result).toHaveProperty('banner');
    expect(result).toHaveProperty('selectionTrace');
  });

  it('a packet with no positive binaries selects no banner', () => {
    const packet = packetWithBinaries([
      { classifierId: 'responds_to_parent', value: 0, confidence: 'high', reasonCode: 'parent_continuity_a' },
    ]);
    const result = selectBanner(buildBannerSelectionInputFromPacket(packet));
    expect(result.banner).toBeNull();
  });
});
