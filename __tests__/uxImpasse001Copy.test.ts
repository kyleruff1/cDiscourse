/**
 * UX-IMPASSE-001 (#689) — dignified structured-impasse copy (display-only).
 *
 * Copy + ban-list + dignity assertions over the impasse-family wording, plus the
 * load-bearing DEFERRAL PROOFS: `value_tradeoff` and `key_detail_unavailable`
 * are NOT surfaced as new primary chips (the v4 display map is unchanged), the
 * dormant copy constants exist but are unwired, and an insufficient signal
 * collapses to Open — never a stronger impasse.
 *
 * Pure-model test: imports constants + the deterministic lookups / derivation.
 * No React, no Supabase, no fetch.
 */
import {
  MEDIATOR_STATE_COPY,
  IMPASSE_SUBTYPE_COPY,
  VALUE_TRADEOFF_DISPLAY_COPY,
  KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY,
  helperForMediatorState,
  _forbiddenMediatorTokens,
  V4_DISPLAY_STATE_BY_CODE,
  v4DisplayStateFor,
  nextMovesForState,
  _forbiddenNextMoveTokens,
} from '../src/features/mediator';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';

/**
 * The §5 explicit ban-list for this card (operator-locked §4). Person-neutral,
 * dignified, advisory — never deadlock / failure / verdict / who's-right /
 * tone-or-intent. Merged with the shipped mediator + next-move ban-lists.
 *
 * NOTE: "right" is allowed ONLY in the literal phrase "right now" (per §4); the
 * scan below special-cases it so the substring guard does not false-positive on
 * the shipped Evidence-blocked "not available right now" wording.
 */
const IMPASSE_BANNED_PHRASES: ReadonlyArray<string> = Object.freeze([
  'deadlock',
  'failure',
  'failed',
  'fail',
  'wrong',
  'bad faith',
  'dishonest',
  'liar',
  'truth',
  'verdict',
  'winner',
  'loser',
  'score',
  'fallacy',
  'decide for me',
  'ai thinks',
  'ai judge',
  'credibility',
  'intent',
  'emotion',
  'tone',
  'anger',
  'voice',
  'dead end',
  'dead-end',
  'give up',
  'defeat',
  'lost',
  'manipulative',
]);

/** Assert a single visible string is dignified + ban-list clean. */
function assertDignified(label: string, value: string): void {
  expect(typeof value).toBe('string');
  expect(value.length).toBeGreaterThan(0);
  const lower = value.toLowerCase();

  // §5 explicit ban-list (this card).
  for (const phrase of IMPASSE_BANNED_PHRASES) {
    expect(`${label} :: ${lower}`).not.toContain(phrase);
  }

  // The shipped mediator ban-list, with the documented "right now" carve-out:
  // the only legitimate "right" is in "right now" (shipped Evidence-blocked copy).
  const lowerSansRightNow = lower.split('right now').join('');
  for (const token of _forbiddenMediatorTokens()) {
    expect(`${label} :: ${lowerSansRightNow}`).not.toContain(token);
  }

  // No raw snake_case internal-code leak.
  expect(value).not.toMatch(/[a-z]+_[a-z]+/);
}

describe('UX-IMPASSE-001 — dignified impasse copy', () => {
  describe('Structured impasse copy (SHIP NOW)', () => {
    it('carries the §4 operator-locked lead / help / next verbatim', () => {
      expect(IMPASSE_SUBTYPE_COPY.structured_impasse.lead).toBe(
        'The disagreement is preserved.',
      );
      expect(IMPASSE_SUBTYPE_COPY.structured_impasse.help).toBe(
        'No available next move would test this point further yet.',
      );
      expect(IMPASSE_SUBTYPE_COPY.structured_impasse.next).toBe(
        'Reopen with a source, shared definition, or narrower claim.',
      );
    });

    it('keeps the shipped chip label "Structured impasse" (no MEDIATOR_STATE_COPY change)', () => {
      expect(IMPASSE_SUBTYPE_COPY.structured_impasse.chip).toBe('Structured impasse');
      expect(MEDIATOR_STATE_COPY.structured_impasse).toBe('Structured impasse');
    });

    it('the state helper reflects the dignified lead + help wording', () => {
      const helper = helperForMediatorState('structured_impasse');
      expect(helper).toContain('The disagreement is preserved.');
      expect(helper).toContain('No available next move would test this point further yet.');
    });

    it('is dignified + ban-list clean on every visible line', () => {
      const c = IMPASSE_SUBTYPE_COPY.structured_impasse;
      assertDignified('impasse.lead', c.lead);
      assertDignified('impasse.help', c.help);
      assertDignified('impasse.next', c.next);
      assertDignified('impasse.helper', helperForMediatorState('structured_impasse'));
    });
  });

  describe('No current pathway copy (folded into Structured impasse — Q4)', () => {
    it('exists as a reserved alternate whose chip folds into "Structured impasse"', () => {
      expect(IMPASSE_SUBTYPE_COPY.no_current_pathway.chip).toBe('Structured impasse');
    });

    it('is dignified + ban-list clean (no dead-end / give-up framing)', () => {
      const c = IMPASSE_SUBTYPE_COPY.no_current_pathway;
      assertDignified('no_current_pathway.lead', c.lead);
      assertDignified('no_current_pathway.help', c.help);
      assertDignified('no_current_pathway.next', c.next);
    });
  });

  describe('Narrowed copy treats concession as PROGRESS, not defeat', () => {
    it('lead + help align to §4 (smaller now / continue on the remaining point)', () => {
      expect(IMPASSE_SUBTYPE_COPY.narrowed.lead).toBe('The disagreement is smaller now.');
      expect(IMPASSE_SUBTYPE_COPY.narrowed.help).toBe('Continue on the remaining point.');
    });

    it('the state helper reflects the dignified narrowed wording', () => {
      const helper = helperForMediatorState('narrowed');
      expect(helper).toContain('The disagreement is smaller now.');
      expect(helper).toContain('Continue on the remaining point.');
    });

    it('next-moves frame concession as a repair (Continue smaller / Concede resolved)', () => {
      const moves = nextMovesForState('narrowed');
      const labels = moves.map((m) => m.label);
      expect(labels).toContain('Continue on the smaller point');
      expect(labels).toContain('Concede the resolved part');
    });

    it('keeps the shipped chip label (no MEDIATOR_STATE_COPY change)', () => {
      // §2.3 + Q5: chip label stays shipped so UX-MEDIATOR-002/005 tests stay green.
      expect(IMPASSE_SUBTYPE_COPY.narrowed.chip).toBe(MEDIATOR_STATE_COPY.narrowed);
      expect(MEDIATOR_STATE_COPY.narrowed).toBe('Partially narrowed');
    });

    it('is dignified + ban-list clean (no defeat / loss framing)', () => {
      const c = IMPASSE_SUBTYPE_COPY.narrowed;
      assertDignified('narrowed.lead', c.lead);
      assertDignified('narrowed.help', c.help);
      assertDignified('narrowed.next', c.next);
      assertDignified('narrowed.helper', helperForMediatorState('narrowed'));
    });
  });

  describe('Evidence blocked stays neutral (KEEP shipped #003)', () => {
    it('preserves the byte-identical shipped #003 helper copy', () => {
      // Regression guard — UX-MEDIATOR-003 wording must not silently change.
      expect(helperForMediatorState('evidence_blocked')).toBe(
        'The evidence path is not available right now. ' +
          'Name what kind of record would test this point, without demanding private access. ' +
          'Mark evidence unavailable, branch the provable part, or ask what kind of record would test this.',
      );
      expect(MEDIATOR_STATE_COPY.evidence_blocked).toBe('Evidence blocked');
    });

    it('the mirrored IMPASSE_SUBTYPE_COPY entry is dignified (no hidden / withheld / blame)', () => {
      const c = IMPASSE_SUBTYPE_COPY.evidence_blocked;
      assertDignified('evidence_blocked.lead', c.lead);
      assertDignified('evidence_blocked.help', c.help);
      assertDignified('evidence_blocked.next', c.next);
      for (const v of [c.lead, c.help, c.next]) {
        const lower = v.toLowerCase();
        expect(lower).not.toContain('hidden');
        expect(lower).not.toContain('withheld');
        expect(lower).not.toContain('blame');
        expect(lower).not.toContain('refused');
      }
    });
  });

  describe('DEFERRAL PROOF — value_tradeoff / key_detail_unavailable NOT surfaced as primary chips', () => {
    it('V4_DISPLAY_STATE_BY_CODE.value_tradeoff is UNCHANGED (maps to open)', () => {
      expect(V4_DISPLAY_STATE_BY_CODE.value_tradeoff).toBe('open');
      expect(v4DisplayStateFor('value_tradeoff')).toBe('open');
    });

    it('V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable is UNCHANGED (folds into evidence_blocked)', () => {
      expect(V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable).toBe('evidence_blocked');
      expect(v4DisplayStateFor('key_detail_unavailable')).toBe('evidence_blocked');
    });

    it('a value_tradeoff point displays as Open with the ordinary next-move set (no impasse escalation)', () => {
      // value_tradeoff maps to 'open' for display (asserted above); the ordinary
      // Open next-move set follows — never the impasse line.
      expect(v4DisplayStateFor('value_tradeoff')).toBe('open');
      const moves = nextMovesForState('open');
      const labels = moves.map((m) => m.label);
      // Ordinary Open guidance — never the impasse "Preserve the disagreement" line.
      expect(labels).toContain('Respond to the exact point');
      expect(labels).not.toContain('Preserve the disagreement');
      expect(labels).not.toContain('Reopen with a source, definition, or narrower claim');
    });

    it('the dormant "Different priorities" chip text is NOT a v4 display label', () => {
      // It exists as a constant but no display-map value points at it, so it can
      // never render as a primary chip from the shipped projection.
      const displayValues = Object.values(V4_DISPLAY_STATE_BY_CODE);
      expect(displayValues).not.toContain(VALUE_TRADEOFF_DISPLAY_COPY.chip);
      expect(displayValues).not.toContain(KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip);
    });
  });

  describe('Dormant subtype constants exist but are UNWIRED (→ UX-IMPASSE-002 #710)', () => {
    it('"Different priorities" copy is authored and dignified', () => {
      expect(VALUE_TRADEOFF_DISPLAY_COPY.chip).toBe('Different priorities');
      assertDignified('value_tradeoff.lead', VALUE_TRADEOFF_DISPLAY_COPY.lead);
      assertDignified('value_tradeoff.help', VALUE_TRADEOFF_DISPLAY_COPY.help);
      assertDignified('value_tradeoff.next', VALUE_TRADEOFF_DISPLAY_COPY.next);
    });

    it('"Key detail unavailable" copy is authored and dignified', () => {
      expect(KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip).toBe('Key detail unavailable');
      assertDignified('key_detail.lead', KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.lead);
      assertDignified('key_detail.help', KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.help);
      assertDignified('key_detail.next', KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.next);
    });

    it('the dormant constants are NOT part of IMPASSE_SUBTYPE_COPY (the wired block)', () => {
      const wiredKeys = Object.keys(IMPASSE_SUBTYPE_COPY);
      expect(wiredKeys).not.toContain('value_tradeoff');
      expect(wiredKeys).not.toContain('key_detail_unavailable');
      expect(wiredKeys).toEqual([
        'structured_impasse',
        'evidence_blocked',
        'narrowed',
        'no_current_pathway',
      ]);
    });
  });

  describe('Insufficient signal collapses to Open — never a stronger impasse', () => {
    it('the open state yields the neutral move set, never an impasse line', () => {
      const moves = nextMovesForState('open');
      const labels = moves.map((m) => m.label);
      expect(labels).toContain('Respond to the exact point');
      expect(labels).toContain('Ask a clarifying question');
      expect(labels).not.toContain('Preserve the disagreement');
    });

    it('an unknown / insufficient display state falls back to the Open move set', () => {
      // nextMovesForState is total: an unknown code collapses to `open`.
      const moves = nextMovesForState('definitely_not_a_state' as never);
      const labels = moves.map((m) => m.label);
      expect(labels).toContain('Respond to the exact point');
      expect(labels).not.toContain('Preserve the disagreement');
    });
  });

  describe('Next-move ban-list parity over the impasse copy', () => {
    it('every IMPASSE_SUBTYPE_COPY string passes the next-move (person-attribution) ban-list', () => {
      const personBan = _forbiddenNextMoveTokens();
      const allStrings = Object.values(IMPASSE_SUBTYPE_COPY).flatMap((c) => [
        c.lead,
        c.help,
        c.next,
      ]);
      for (const s of allStrings) {
        const lower = s.toLowerCase().split('right now').join('');
        for (const token of personBan) {
          // Whole-string contains-check mirrors the shipped next-move scan.
          expect(lower.includes(token)).toBe(false);
        }
      }
    });
  });

  describe('The rail impasse chrome copy is dignified', () => {
    it('the rail preserve + reopen lines are ban-list clean', () => {
      assertDignified('rail.impassePreserved', DISAGREEMENT_POINTS_RAIL_COPY.impassePreserved);
      assertDignified('rail.impasseReopen', DISAGREEMENT_POINTS_RAIL_COPY.impasseReopen);
    });

    it('the rail reopen line matches the §4 wording / the IMPASSE_SUBTYPE_COPY next line', () => {
      expect(DISAGREEMENT_POINTS_RAIL_COPY.impassePreserved).toBe('The disagreement is preserved.');
      expect(DISAGREEMENT_POINTS_RAIL_COPY.impasseReopen).toBe(
        IMPASSE_SUBTYPE_COPY.structured_impasse.next,
      );
    });
  });
});
