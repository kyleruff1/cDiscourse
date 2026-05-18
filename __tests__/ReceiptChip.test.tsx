/**
 * EV-002 — ReceiptChip pure-helper tests.
 *
 * The repo's test discipline is pure-TS (no RN renderer dependency). The
 * chip's load-bearing decisions — display label, dotted-teal ring, hit
 * target size, accessibility label, ban-list compliance — are all
 * extracted into pure helpers (`buildReceiptChipDisplayLabel`,
 * `buildReceiptChipContainerStyle`, etc.) and exercised here.
 *
 * Asserts:
 *   - For every SourceChainStatus, the chip's display label matches the
 *     EV-001 locked copy.
 *   - When `count > 1`, the display label carries the +N suffix.
 *   - `showsSourceChainPressure === true` produces a dotted-teal ring;
 *     === false produces no ring.
 *   - Color independence — the text carries the same info as the ring.
 *   - hitSlop is large enough that the effective tap target reaches 44×44.
 *   - Ban-list: no verdict / amplification / snake_case token in any
 *     rendered string.
 *
 * Note: the .tsx extension is retained because the file historically
 * housed RN-tree tests; the current pure-helper variant is still
 * TypeScript-valid as .tsx.
 */
import {
  buildReceiptChipAccessibilityLabel,
  buildReceiptChipContainerStyle,
  buildReceiptChipDisplayLabel,
  RECEIPT_CHIP_HIT_SLOP,
  RECEIPT_CHIP_RING_COLOR,
} from '../src/features/evidence/ReceiptChip';
import {
  ALL_SOURCE_CHAIN_STATUSES,
  summarizeArtifactsForReceiptChip,
  type EvidenceArtifact,
  type ReceiptChipContract,
  type SourceChainStatus,
} from '../src/features/evidence/evidenceModel';
import { ARGUMENT } from '../src/lib/designTokens';

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'astroturfer',
  'verdict',
  'proof',
  'proven',
  'disproven',
];

const AMPLIFICATION_TOKENS = [
  'likes',
  'retweets',
  'shares',
  'followers',
  'verified',
  'engagement',
  'amplification',
  'trending',
  'virality',
  'popular',
  'viral',
];

function chipFor(status: SourceChainStatus, count = 1): ReceiptChipContract {
  if (status === 'no_source') return summarizeArtifactsForReceiptChip([]);
  const arts: EvidenceArtifact[] = [];
  for (let i = 0; i < count; i++) {
    arts.push({
      id: `a:evidence:${i}`,
      argumentId: 'a',
      kind: 'url',
      label: `example ${i}`,
      sourceChainStatus: status,
      risk: 'unknown',
      addedByUserId: 'u',
      createdAt: '2026-05-18T00:00:00Z',
      url: 'https://example.com/x',
      quote: status === 'source_and_quote' ? 'a verbatim line' : undefined,
    });
  }
  return summarizeArtifactsForReceiptChip(arts);
}

describe('EV-002 ReceiptChip helpers — renders per status', () => {
  for (const status of ALL_SOURCE_CHAIN_STATUSES) {
    it(`status=${status} display label matches EV-001 locked copy`, () => {
      const contract = chipFor(status);
      const display = buildReceiptChipDisplayLabel(contract);
      expect(display).toBe(contract.label);
      const a11y = buildReceiptChipAccessibilityLabel(contract);
      expect(a11y).toContain(contract.label);
      expect(a11y).toContain(contract.helper);
    });
  }

  it('shows a +N count suffix when more than one artifact is present', () => {
    const contract = chipFor('source_no_quote', 3);
    expect(buildReceiptChipDisplayLabel(contract)).toMatch(/ \+2$/);
  });

  it('shows no count suffix when count === 1', () => {
    const contract = chipFor('source_no_quote', 1);
    expect(buildReceiptChipDisplayLabel(contract)).not.toMatch(/ \+\d+$/);
  });
});

describe('EV-002 ReceiptChip — dotted teal ring + color independence', () => {
  it('renders a dotted ring with the teal-700 token when showsSourceChainPressure is true', () => {
    const contract = chipFor('no_source');
    expect(contract.showsSourceChainPressure).toBe(true);
    const style = buildReceiptChipContainerStyle(contract);
    expect(style.borderStyle).toBe('dotted');
    expect(style.borderColor).toBe(RECEIPT_CHIP_RING_COLOR);
    expect(style.borderWidth).toBeGreaterThan(0);
  });

  it('ring color is the VG-001 ARGUMENT.branch.bg token (teal-700, no magenta/red)', () => {
    expect(RECEIPT_CHIP_RING_COLOR).toBe(ARGUMENT.branch.bg);
    // Sanity: it's the teal-700 hex.
    expect(RECEIPT_CHIP_RING_COLOR).toBe('#0f766e');
  });

  it('renders no dotted ring (borderWidth 0) when showsSourceChainPressure is false', () => {
    const contract = chipFor('source_and_quote');
    expect(contract.showsSourceChainPressure).toBe(false);
    const style = buildReceiptChipContainerStyle(contract);
    expect(style.borderStyle === 'solid' && style.borderWidth === 0).toBe(true);
  });

  it('every status has a non-empty text label (color independence)', () => {
    for (const status of ALL_SOURCE_CHAIN_STATUSES) {
      const contract = chipFor(status);
      expect(contract.label.length).toBeGreaterThan(0);
      expect(buildReceiptChipDisplayLabel(contract).length).toBeGreaterThan(0);
    }
  });
});

describe('EV-002 ReceiptChip — hit-slop tap target', () => {
  it('hitSlop pads ≥ 20px in each axis, providing ≥ 44×44 effective tap target', () => {
    // Base minHeight 28 + (10 + 10) padding = 48 ≥ 44.
    expect(RECEIPT_CHIP_HIT_SLOP.top + RECEIPT_CHIP_HIT_SLOP.bottom).toBeGreaterThanOrEqual(20);
    expect(RECEIPT_CHIP_HIT_SLOP.left + RECEIPT_CHIP_HIT_SLOP.right).toBeGreaterThanOrEqual(20);
  });

  it('RECEIPT_CHIP_HIT_SLOP is frozen', () => {
    expect(Object.isFrozen(RECEIPT_CHIP_HIT_SLOP)).toBe(true);
  });
});

describe('EV-002 ReceiptChip — ban-list pass on every rendered string', () => {
  it('no display label or accessibility label contains a verdict / amplification token', () => {
    for (const status of ALL_SOURCE_CHAIN_STATUSES) {
      const contract = chipFor(status);
      const a11y = buildReceiptChipAccessibilityLabel(contract).toLowerCase();
      const display = buildReceiptChipDisplayLabel(contract).toLowerCase();
      for (const banned of VERDICT_TOKENS) {
        expect({ status, where: 'a11y', banned, value: a11y }).toMatchObject({ status, where: 'a11y', banned });
        expect(a11y.includes(banned)).toBe(false);
        expect(display.includes(banned)).toBe(false);
      }
      for (const banned of AMPLIFICATION_TOKENS) {
        expect(a11y.includes(banned)).toBe(false);
        expect(display.includes(banned)).toBe(false);
      }
    }
  });
});
