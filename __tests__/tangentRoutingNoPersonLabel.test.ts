/**
 * BR-003 — tangent routing ban-list / no-person-label doctrine test.
 *
 * "Structural redirect, no person labels": every string BR-003 produces
 * describes the MOVE's structural relationship to its parent, or the
 * THREAD — never the person. This suite scans every produced string —
 * every `TANGENT_ROUTING_COPY` value, every resolvable advisory / reason
 * line, the `MainlineDemotionAdvisory.plainLanguage` — for verdict,
 * amplification, block, and person-attribution tokens, and asserts zero
 * matches. It also asserts no snake_case internal code leaks.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import { TANGENT_ROUTING_COPY, looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import {
  ALL_REDIRECT_REASONS,
  ALL_REDIRECT_RISKS,
  _forbiddenTangentTokens,
  buildMainlineDemotionAdvisory,
  tangentAdvisoryPlainLanguage,
  tangentReasonPlainLanguage,
  type RedirectRisk,
} from '../src/features/arguments/tangentRoutingModel';

// ── Collect every produced string ──────────────────────────────

function everyProducedString(): string[] {
  const strings: string[] = [];

  // Every frozen copy value.
  for (const value of Object.values(TANGENT_ROUTING_COPY)) {
    strings.push(value);
  }

  // Every advisory headline (one per non-none risk).
  for (const risk of ALL_REDIRECT_RISKS) {
    const line = tangentAdvisoryPlainLanguage({
      risk: risk as RedirectRisk,
      reason: null,
      suggestedAction: 'continue',
    });
    if (line.length > 0) strings.push(line);
  }

  // Every per-reason detail line.
  for (const reason of ALL_REDIRECT_REASONS) {
    strings.push(tangentReasonPlainLanguage(reason));
  }

  // The mainline-demotion advisory plain-language line.
  strings.push(
    buildMainlineDemotionAdvisory({ authorSide: 'affirmative', recentMoves: [] })
      .plainLanguage,
  );

  return strings.filter((s) => s.length > 0);
}

// ── Ban-list scan ──────────────────────────────────────────────

describe('BR-003 — no verdict / person / amplification / block tokens', () => {
  const banned = _forbiddenTangentTokens();
  const produced = everyProducedString();

  it('produces at least one string to scan', () => {
    expect(produced.length).toBeGreaterThan(0);
  });

  for (const token of banned) {
    it(`never emits the banned token "${token}"`, () => {
      for (const s of produced) {
        expect(s.toLowerCase()).not.toContain(token);
      }
    });
  }

  it('person-attribution tokens are explicitly in the ban-list', () => {
    for (const t of ['dodge', 'evade', 'evasion']) {
      expect(banned).toContain(t);
    }
  });
});

// ── No snake_case leak ─────────────────────────────────────────

describe('BR-003 — no internal code leaks into user-facing strings', () => {
  it('no produced string looks like an internal code', () => {
    for (const s of everyProducedString()) {
      expect(looksLikeInternalCode(s)).toBe(false);
    }
  });

  it('no produced string contains a raw snake_case identifier', () => {
    for (const s of everyProducedString()) {
      // No `word_word` lowercase identifier tokens.
      expect(s).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

// ── Move-level / thread-level framing ──────────────────────────

describe('BR-003 — copy describes the move or the thread, never the person', () => {
  it('the demotion advisory names the thread, not a participant', () => {
    const line = TANGENT_ROUTING_COPY.demotion_advisory.toLowerCase();
    expect(line).toContain('thread');
  });

  it('every string is non-empty and within the 100-char copy budget', () => {
    for (const value of Object.values(TANGENT_ROUTING_COPY)) {
      expect(value.length).toBeGreaterThan(0);
      expect(value.length).toBeLessThanOrEqual(100);
    }
  });
});
