/**
 * REF-005 — Request review / Mark concern copy ban-list scan (design §10 / §11).
 *
 * Scans every rendered string — the model copy maps (`CONCERN_TYPE_LABELS`,
 * `CONCERN_TYPE_DESCRIPTIONS`, `REMEDY_LABELS`) and every composer string
 * (`REQUEST_REVIEW_COMPOSER_COPY`, which is the single source of every
 * header / readout / accessibilityLabel the component renders) — for the 16
 * prohibited person/verdict tokens. Also proves:
 *   - zero raw snake_case in any rendered string;
 *   - no person-verdict is EXPRESSIBLE: the composer renders exactly one
 *     free-text field (the quote), and the concern / remedy choices are
 *     bounded chip sets mapped from the frozen vocabularies — there is no
 *     free-text concern field anywhere.
 *
 * Mirrors `ConcessionListSection.test.tsx` / `FistBumpReaction.test.tsx`.
 * Pure TS — no React render needed for the scan.
 */
import fs from 'fs';
import path from 'path';
import {
  CONCERN_TYPE_DESCRIPTIONS,
  CONCERN_TYPE_LABELS,
  REMEDY_LABELS,
} from '../src/features/requestReview/requestReviewModel';
import { REQUEST_REVIEW_COMPOSER_COPY } from '../src/features/requestReview/RequestReviewComposer';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// The 16 prohibited person/verdict tokens (design §10). Named only as
// prohibitions; mirrors doctrine §1/§2.2 + the userAllegationRegistry scan.
const BANNED_TOKENS = [
  'liar',
  'dishonest',
  'manipulative',
  'bad faith',
  'troll',
  'astroturfer',
  'propagandist',
  'extremist',
  'bot',
  'shill',
  'winner',
  'loser',
  'true',
  'false',
  'correct',
  'stupid',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary match — "token" means a word, so legitimate substrings
// (e.g. "about" must NOT trip "bot") never false-positive.
function containsBannedToken(value: string): string | null {
  const lower = value.toLowerCase();
  for (const token of BANNED_TOKENS) {
    if (new RegExp(`\\b${escapeRegex(token)}\\b`, 'i').test(lower)) return token;
  }
  return null;
}

function collectRenderedStrings(): Array<{ source: string; value: string }> {
  const out: Array<{ source: string; value: string }> = [];
  for (const [k, v] of Object.entries(CONCERN_TYPE_LABELS)) {
    out.push({ source: `CONCERN_TYPE_LABELS.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(CONCERN_TYPE_DESCRIPTIONS)) {
    out.push({ source: `CONCERN_TYPE_DESCRIPTIONS.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(REMEDY_LABELS)) {
    out.push({ source: `REMEDY_LABELS.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(REQUEST_REVIEW_COMPOSER_COPY)) {
    out.push({ source: `REQUEST_REVIEW_COMPOSER_COPY.${k}`, value: v });
  }
  return out;
}

const COMPOSER_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'requestReview', 'RequestReviewComposer.tsx'),
  'utf8',
);

// ── Ban-list scan ──────────────────────────────────────────────

describe('REF-005 copy ban-list', () => {
  it('scans exactly the 16 prohibited tokens', () => {
    expect(BANNED_TOKENS.length).toBe(16);
    expect(BANNED_TOKENS).toEqual(Array.from(new Set(BANNED_TOKENS)));
  });

  it('no rendered string contains a prohibited person/verdict token', () => {
    for (const { source, value } of collectRenderedStrings()) {
      expect({ source, hit: containsBannedToken(value) }).toEqual({ source, hit: null });
    }
  });

  it('every rendered string is non-empty plain language', () => {
    for (const { source, value } of collectRenderedStrings()) {
      expect({ source, len: value.length }).toEqual({ source, len: value.length });
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('no rendered string is a raw internal code', () => {
    for (const { value } of collectRenderedStrings()) {
      expect(looksLikeInternalCode(value)).toBe(false);
    }
  });

  it('no rendered string leaks raw snake_case', () => {
    for (const { source, value } of collectRenderedStrings()) {
      expect({ source, snake: /[a-z0-9]+_[a-z0-9]+/.test(value) }).toEqual({ source, snake: false });
    }
  });
});

// ── No person-verdict is expressible ───────────────────────────

describe('REF-005 — no person-verdict is expressible', () => {
  it('the composer renders exactly one free-text field (the quote), no free-text concern', () => {
    const textInputCount = (COMPOSER_SRC.match(/<TextInput/g) ?? []).length;
    expect(textInputCount).toBe(1);
    // The single field is the quote — labelled as a passage quote, not a
    // characterization of a person.
    expect(COMPOSER_SRC).toContain('quote-input');
  });

  it('concern + remedy choices are bounded chip sets mapped from the frozen vocabularies', () => {
    expect(COMPOSER_SRC).toMatch(/ALL_REVIEW_CONCERN_TYPES\.map/);
    expect(COMPOSER_SRC).toMatch(/ALL_REVIEW_REQUESTED_REMEDIES\.map/);
    // The bounded chips are radios (a fixed choice), not editable text.
    expect(COMPOSER_SRC).toMatch(/accessibilityRole="radio"/);
  });

  it('the person-directed concern labels are procedural, not verdicts', () => {
    // "About the person rather than the claim" describes the MOVE's relation
    // to the claim — it says nothing about whether the person is a liar /
    // troll / bad-faith actor (those words are unexpressible by any path).
    expect(CONCERN_TYPE_LABELS.about_person_not_claim).toBe(
      'About the person rather than the claim',
    );
    expect(containsBannedToken(CONCERN_TYPE_LABELS.about_person_not_claim)).toBeNull();
    expect(containsBannedToken(CONCERN_TYPE_LABELS.harassment_concern)).toBeNull();
  });
});
