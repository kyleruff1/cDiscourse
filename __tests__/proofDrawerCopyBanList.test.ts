/**
 * PROOF-002 (#889) — COPY LAW scan.
 *
 * Every user-facing string this card authors (PROOF_DRAWER_COPY +
 * ATTACH_ERROR_COPY) must carry NO box-copy token (proof / proven / validated)
 * and NO verdict token (winner / loser / true / false / liar / ...). Each scan
 * has a FIRING negative control. Component / type / file names (ProofDrawer,
 * ProofChip, proof_items) are internal and EXEMPT — not scanned. ProofChip
 * authors NO copy of its own: it renders the shipped, already-ban-list-clean
 * RECEIPT_CHIP_COPY, asserted here by construction.
 */
import { PROOF_DRAWER_COPY, ATTACH_ERROR_COPY } from '../src/features/proof/proofDrawerCopy';

const BOX_TOKENS = ['proof', 'proven', 'validated'];
const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'propagandist',
  'extremist',
  'true',
  'false',
  'correct',
];

/** Flatten every string value (recursively) out of the frozen copy objects. */
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, acc);
  }
  return acc;
}

const ALL_STRINGS = [...collectStrings(PROOF_DRAWER_COPY), ...collectStrings(ATTACH_ERROR_COPY)];

describe('PROOF-002 COPY LAW — box-copy token ban', () => {
  it('no authored string contains proof / proven / validated', () => {
    for (const s of ALL_STRINGS) {
      const lower = s.toLowerCase();
      for (const t of BOX_TOKENS) {
        expect({ string: s, token: t, hit: lower.includes(t) }).toEqual({ string: s, token: t, hit: false });
      }
    }
  });

  it('negative control — the scan WOULD fire on a planted proof token', () => {
    const planted = 'This is proof of the claim.';
    expect(BOX_TOKENS.some((t) => planted.toLowerCase().includes(t))).toBe(true);
  });
});

describe('PROOF-002 COPY LAW — verdict token ban', () => {
  it('no authored string contains a verdict / person token', () => {
    for (const s of ALL_STRINGS) {
      const lower = s.toLowerCase();
      for (const t of VERDICT_TOKENS) {
        expect({ string: s, token: t, hit: lower.includes(t) }).toEqual({ string: s, token: t, hit: false });
      }
    }
  });

  it('negative control — the scan WOULD fire on a planted verdict token', () => {
    const planted = 'You are the winner of this debate.';
    expect(VERDICT_TOKENS.some((t) => planted.toLowerCase().includes(t))).toBe(true);
  });
});

describe('PROOF-002 COPY LAW — Source/Receipts vocabulary present', () => {
  it('the drawer title + attach button speak Source', () => {
    expect(PROOF_DRAWER_COPY.title.toLowerCase()).toContain('source');
    expect(PROOF_DRAWER_COPY.attachButton.toLowerCase()).toContain('source');
    expect(PROOF_DRAWER_COPY.attachedHeader.toLowerCase()).toContain('source');
  });
});
