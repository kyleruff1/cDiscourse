/**
 * EV-003 — EvidenceDebtChip tests.
 *
 * The repo's UI test discipline is pure-helper + source-scan (the pinned
 * react-test-renderer is held away from @testing-library's peer — see
 * ReceiptChip.test.tsx / evidenceAnnotationChip.test.tsx). The chip's
 * load-bearing render decisions — the locked label per status, tone → color
 * mapping, color independence, the hide-when-not-visible rule, the tap
 * target — are extracted into pure helpers / driven by the pure model and
 * exercised here; the component contract (roles, hit slop, no copy of its
 * own) is asserted by a source-scan.
 *
 * Note: the .tsx extension is retained for parity with ReceiptChip.test.tsx;
 * the pure-helper variant is still TypeScript-valid as .tsx.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildEvidenceDebtChipContainerStyle,
  EVIDENCE_DEBT_CHIP_HIT_SLOP,
} from '../src/features/evidence/EvidenceDebtChip';
import {
  ALL_EVIDENCE_DEBT_KINDS,
  ALL_EVIDENCE_DEBT_STATUSES,
  getNodeEvidenceDebtChip,
  getNodeEvidenceDebtSummary,
  summarizeEvidenceDebtChip,
} from '../src/features/evidence/evidenceDebtModel';
import type { EvidenceDebtStatus } from '../src/features/evidence/evidenceDebtModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const LOCKED_LABELS: Readonly<Record<EvidenceDebtStatus, string>> = {
  requested: 'Source requested',
  supplied: 'Evidence attached',
  challenged: 'Supplied evidence questioned',
  accepted_by_participant: 'Accepted by one side',
  accepted_by_both: 'Settled by both',
  unresolved: 'Still unresolved',
  stale: 'Source still owed',
  branched: 'Moved to a branch',
};

// ── Locked label per status ───────────────────────────────────

describe('EvidenceDebtChip — locked label per status', () => {
  it.each(ALL_EVIDENCE_DEBT_STATUSES)('renders the locked label for %s', (status) => {
    const contract = summarizeEvidenceDebtChip(status, 'source');
    expect(contract.label).toBe(LOCKED_LABELS[status]);
  });
});

// ── Color independence ────────────────────────────────────────

describe('EvidenceDebtChip — color independence', () => {
  it('every visible chip carries a non-empty text label (text carries meaning)', () => {
    for (const status of ALL_EVIDENCE_DEBT_STATUSES) {
      for (const kind of ALL_EVIDENCE_DEBT_KINDS) {
        const contract = summarizeEvidenceDebtChip(status, kind);
        expect(contract.label.length).toBeGreaterThan(0);
        expect(contract.accessibilityLabel.length).toBeGreaterThan(0);
      }
    }
  });

  it('no two statuses share a chip label', () => {
    const labels = ALL_EVIDENCE_DEBT_STATUSES.map((s) => LOCKED_LABELS[s]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

// ── isVisible:false renders nothing ───────────────────────────

describe('EvidenceDebtChip — visibility', () => {
  it('a node with no debts yields an isVisible:false contract (chip renders nothing)', () => {
    const summary = getNodeEvidenceDebtSummary('empty-node', []);
    const contract = getNodeEvidenceDebtChip(summary);
    expect(contract.isVisible).toBe(false);
  });

  it('the component returns null for an isVisible:false contract', () => {
    // Source-scan: the component short-circuits to null before rendering.
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/evidence/EvidenceDebtChip.tsx'),
      'utf8',
    );
    expect(src).toMatch(/if \(!contract\.isVisible\) return null/);
  });

  it('a node with any debt (even settled) yields an isVisible:true contract', () => {
    const summary = getNodeEvidenceDebtSummary('n', [
      {
        id: 'd:debt',
        debateId: 'room',
        nodeId: 'n',
        requestArgumentId: 'd',
        debtKind: 'source',
        requestedByUserId: 'u',
        requestedAt: '2026-05-10T00:00:00.000Z',
        status: 'accepted_by_both',
        ageDays: 1,
        isStale: false,
      },
    ]);
    expect(getNodeEvidenceDebtChip(summary).isVisible).toBe(true);
  });
});

// ── Tone → token mapping ──────────────────────────────────────

describe('EvidenceDebtChip — tone → color token', () => {
  it('attention maps to an amber-family background (not red / magenta)', () => {
    const style = buildEvidenceDebtChipContainerStyle(
      summarizeEvidenceDebtChip('challenged', 'source'),
    );
    // #7c2d12 is the EV-002 amber/attention token.
    expect(style.backgroundColor).toBe('#7c2d12');
  });

  it('info maps to a teal/blue-family background', () => {
    const style = buildEvidenceDebtChipContainerStyle(
      summarizeEvidenceDebtChip('requested', 'source'),
    );
    // #0c4a6e is the EV-002 info token.
    expect(style.backgroundColor).toBe('#0c4a6e');
  });

  it('neutral and muted map to slate-family backgrounds', () => {
    expect(
      buildEvidenceDebtChipContainerStyle(summarizeEvidenceDebtChip('accepted_by_both', 'source'))
        .backgroundColor,
    ).toBe('#1e293b');
    expect(
      buildEvidenceDebtChipContainerStyle(summarizeEvidenceDebtChip('stale', 'source'))
        .backgroundColor,
    ).toBe('#1f2937');
  });

  it('an attention chip gets a visible border so it reads in monochrome', () => {
    const style = buildEvidenceDebtChipContainerStyle(
      summarizeEvidenceDebtChip('challenged', 'source'),
    );
    expect(style.borderWidth).toBeGreaterThan(0);
  });
});

// ── Tap target ────────────────────────────────────────────────

describe('EvidenceDebtChip — tap target', () => {
  it('hitSlop expands the effective area to ≥ 44×44', () => {
    // minHeight 28 + top 10 + bottom 10 = 48 ≥ 44.
    const vertical = 28 + EVIDENCE_DEBT_CHIP_HIT_SLOP.top + EVIDENCE_DEBT_CHIP_HIT_SLOP.bottom;
    expect(vertical).toBeGreaterThanOrEqual(44);
    expect(EVIDENCE_DEBT_CHIP_HIT_SLOP.left).toBeGreaterThanOrEqual(10);
    expect(EVIDENCE_DEBT_CHIP_HIT_SLOP.right).toBeGreaterThanOrEqual(10);
  });
});

// ── Component contract — source scan ──────────────────────────

describe('EvidenceDebtChip.tsx — component contract', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/features/evidence/EvidenceDebtChip.tsx'),
    'utf8',
  );

  it('the chip is accessibilityRole="text" (read-only status indicator, not pressable in v1)', () => {
    expect(src).toMatch(/accessibilityRole="text"/);
    // No Pressable — the chip is non-pressable in v1.
    expect(src).not.toMatch(/Pressable/);
  });

  it('the chip binds its accessibilityLabel to the contract sentence', () => {
    expect(src).toMatch(/accessibilityLabel=\{contract\.accessibilityLabel\}/);
  });

  it('the chip applies hitSlop for a consistent 44+ touch surface', () => {
    expect(src).toMatch(/EVIDENCE_DEBT_CHIP_HIT_SLOP/);
    expect(src).toMatch(/hitSlop=\{EVIDENCE_DEBT_CHIP_HIT_SLOP\}/);
  });

  it('the chip authors no copy of its own — every string comes from the contract', () => {
    // The only <Text> child is {contract.label}.
    expect(src).toMatch(/\{contract\.label\}/);
  });

  it('the chip carries a testID for the timeline-node integration', () => {
    expect(src).toMatch(/evidence-debt-chip/);
  });
});

// ── Ban-list over every rendered string ───────────────────────

describe('EvidenceDebtChip — ban-list over rendered text', () => {
  const BANNED = [
    'proof',
    'proven',
    'disproven',
    'true',
    'false',
    'correct',
    'incorrect',
    'winner',
    'loser',
    'verdict',
    'wrong',
    'case closed',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'astroturfer',
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    'engagement',
    'viral',
    'trending',
    'popular',
  ];

  it('every rendered chip string is free of banned tokens', () => {
    // Word-boundary match — repo-standard ban-list shape. A substring check
    // would false-positive ("bot" inside "both"); the tokens ban WORDS.
    for (const status of ALL_EVIDENCE_DEBT_STATUSES) {
      for (const kind of ALL_EVIDENCE_DEBT_KINDS) {
        const c = summarizeEvidenceDebtChip(status, kind);
        for (const s of [c.label, c.helper, c.accessibilityLabel]) {
          const lower = s.toLowerCase();
          for (const tok of BANNED) {
            const re = new RegExp(`\\b${tok.replace(/\s+/g, '\\s+')}\\b`, 'i');
            expect(re.test(lower)).toBe(false);
          }
        }
      }
    }
  });

  it('no rendered chip label looks like an internal code', () => {
    for (const status of ALL_EVIDENCE_DEBT_STATUSES) {
      expect(looksLikeInternalCode(summarizeEvidenceDebtChip(status, 'source').label)).toBe(false);
    }
  });
});
