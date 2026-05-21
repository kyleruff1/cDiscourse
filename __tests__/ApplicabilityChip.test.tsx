/**
 * QOL-037 — ApplicabilityChip tests.
 *
 * Follows the repo's UI test discipline (see EvidenceDebtChip.test.tsx /
 * ReceiptChip.test.tsx): the chip's load-bearing render decisions — the locked
 * label per status, the tone → color mapping, color independence, the
 * hide-when-undisputed rule, the tap target — are extracted into pure helpers /
 * driven by the pure model and exercised here; the component contract (roles,
 * non-pressable, no copy of its own) is asserted by a source-scan.
 *
 * The .tsx extension is retained for parity with EvidenceDebtChip.test.tsx;
 * the pure-helper variant is still TypeScript-valid as .tsx.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildApplicabilityChipContainerStyle,
  APPLICABILITY_CHIP_HIT_SLOP,
} from '../src/features/evidence/ApplicabilityChip';
import {
  ALL_APPLICABILITY_STATUSES,
  summarizeApplicabilityChip,
} from '../src/features/evidence/evidenceApplicabilityModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const VERDICT_TOKENS = [
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
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
];

const AMPLIFICATION_TOKENS = [
  'likes',
  'retweets',
  'shares',
  'views',
  'followers',
  'verified',
  'engagement',
  'viral',
  'trending',
  'popular',
];

// ── Renders nothing for the undisputed default ─────────────────

describe('ApplicabilityChip — hidden when undisputed', () => {
  it('the undisputed contract is not visible (no chip on uncontested evidence)', () => {
    const contract = summarizeApplicabilityChip('applicability_undisputed');
    expect(contract.isVisible).toBe(false);
    // The component returns null for an invisible contract — asserted by the
    // source-scan below; here we lock the model decision the component reads.
    expect(contract.label).toBe('');
  });
});

// ── Locked label + helper per visible status ───────────────────

describe('ApplicabilityChip — locked label + helper per status', () => {
  it('applicability_disputed → "Applicability disputed" with a helper', () => {
    const contract = summarizeApplicabilityChip('applicability_disputed');
    expect(contract.isVisible).toBe(true);
    expect(contract.label).toBe('Applicability disputed');
    expect(contract.helper.length).toBeGreaterThan(0);
  });

  it('applicability_supported → "Applicability supported" with a helper', () => {
    const contract = summarizeApplicabilityChip('applicability_supported');
    expect(contract.isVisible).toBe(true);
    expect(contract.label).toBe('Applicability supported');
    expect(contract.helper.length).toBeGreaterThan(0);
  });
});

// ── Color independence ─────────────────────────────────────────

describe('ApplicabilityChip — color independence', () => {
  it('every visible status carries a non-empty text label (text carries meaning)', () => {
    for (const status of ALL_APPLICABILITY_STATUSES) {
      const contract = summarizeApplicabilityChip(status);
      if (contract.isVisible) {
        expect(contract.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('the container style is computable for every tone without a renderer', () => {
    for (const status of ALL_APPLICABILITY_STATUSES) {
      const contract = summarizeApplicabilityChip(status);
      const style = buildApplicabilityChipContainerStyle(contract);
      expect(typeof style.backgroundColor).toBe('string');
      expect(style.backgroundColor.length).toBeGreaterThan(0);
      expect(typeof style.borderColor).toBe('string');
    }
  });

  it('the attention tone (disputed) gets a solid border so it reads in monochrome', () => {
    const disputed = buildApplicabilityChipContainerStyle(
      summarizeApplicabilityChip('applicability_disputed'),
    );
    expect(disputed.borderWidth).toBe(1);
  });

  it('non-attention tones get no border (the label still carries meaning)', () => {
    const supported = buildApplicabilityChipContainerStyle(
      summarizeApplicabilityChip('applicability_supported'),
    );
    expect(supported.borderWidth).toBe(0);
  });
});

// ── Tap target ─────────────────────────────────────────────────

describe('ApplicabilityChip — tap target', () => {
  it('hit-slop expands the effective touch surface toward 44×44', () => {
    expect(APPLICABILITY_CHIP_HIT_SLOP.top).toBeGreaterThanOrEqual(10);
    expect(APPLICABILITY_CHIP_HIT_SLOP.bottom).toBeGreaterThanOrEqual(10);
    expect(APPLICABILITY_CHIP_HIT_SLOP.left).toBeGreaterThanOrEqual(10);
    expect(APPLICABILITY_CHIP_HIT_SLOP.right).toBeGreaterThanOrEqual(10);
  });

  it('the hit-slop constant is frozen', () => {
    expect(Object.isFrozen(APPLICABILITY_CHIP_HIT_SLOP)).toBe(true);
  });
});

// ── Ban-list ───────────────────────────────────────────────────

describe('ApplicabilityChip — ban-list', () => {
  it('no rendered chip string carries a verdict / amplification / snake_case token', () => {
    for (const status of ALL_APPLICABILITY_STATUSES) {
      const contract = summarizeApplicabilityChip(status);
      for (const text of [contract.label, contract.helper]) {
        if (text.length === 0) continue;
        const lower = text.toLowerCase();
        for (const token of VERDICT_TOKENS) {
          if (token === 'true') {
            expect(lower).not.toMatch(/\btrue\b/);
          } else {
            expect(lower).not.toContain(token);
          }
        }
        for (const token of AMPLIFICATION_TOKENS) {
          expect(lower).not.toContain(token);
        }
        expect(looksLikeInternalCode(text.trim())).toBe(false);
      }
    }
  });
});

// ── Component-contract source-scan ─────────────────────────────

describe('ApplicabilityChip — component contract (source-scan)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'features', 'evidence', 'ApplicabilityChip.tsx'),
    'utf8',
  );

  it('returns null when the contract is not visible (no chip on uncontested evidence)', () => {
    expect(src).toMatch(/if\s*\(\s*!contract\.isVisible\s*\)\s*return null/);
  });

  it('is a non-pressable status indicator — uses View, never Pressable', () => {
    expect(src).not.toMatch(/Pressable/);
    expect(src).toMatch(/accessibilityRole="text"/);
  });

  it('exposes an accessibilityLabel built from the contract', () => {
    expect(src).toMatch(/accessibilityLabel=\{accessibilityLabel\}/);
  });

  it('authors no user-facing copy of its own — renders contract.label only', () => {
    // The only <Text> child is `{contract.label}` — no string literal copy.
    expect(src).toMatch(/\{contract\.label\}/);
  });

  it('imports the chip contract type from the pure model', () => {
    expect(src).toMatch(
      /import type \{ ApplicabilityChipContract \} from '\.\/evidenceApplicabilityModel'/,
    );
  });

  it('makes no Supabase / network / AI import', () => {
    // Scan import statements specifically — the file's doc comment legitimately
    // says "no Supabase" as a doctrine note.
    const importLines = src
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line) || /from ['"]/.test(line));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/supabase/);
      expect(line.toLowerCase()).not.toMatch(/anthropic|openai|\bxai\b/);
    }
    expect(src).not.toMatch(/fetch\(/);
  });
});
