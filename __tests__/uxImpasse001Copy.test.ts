/**
 * UX-IMPASSE-001 (#689) — dignified structured-impasse copy (display-only).
 *
 * Copy + ban-list + dignity assertions over the impasse-family wording.
 *
 * NOTE (UX-IMPASSE-002 #710): the original DEFERRAL PROOFS here have been
 * INVERTED into SURFACING PROOFS — `value_tradeoff` and `key_detail_unavailable`
 * are now surfaced as their own primary chips (the v4 display map projects each
 * to itself), with operator-locked copy and their own next-move sets. The
 * genuinely deferred subtypes (`accounts_differ`, `no_current_pathway`) stay
 * dormant. An insufficient signal still collapses to Open — never a stronger
 * impasse. The evidence_blocked byte-identical regression block stays green.
 *
 * Pure-model test: imports constants + the deterministic lookups / derivation.
 * No React, no Supabase, no fetch.
 */
import {
  MEDIATOR_STATE_COPY,
  IMPASSE_SUBTYPE_COPY,
  VALUE_TRADEOFF_DISPLAY_COPY,
  KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY,
  ACCOUNTS_DIFFER_DISPLAY_COPY,
  helperForMediatorState,
  plainLanguageForMediatorState,
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

  describe('SURFACING PROOF — value_tradeoff / key_detail_unavailable surfaced as primary chips (#710)', () => {
    it('V4_DISPLAY_STATE_BY_CODE.value_tradeoff is SURFACED (identity) — #710', () => {
      expect(V4_DISPLAY_STATE_BY_CODE.value_tradeoff).toBe('value_tradeoff');
      expect(v4DisplayStateFor('value_tradeoff')).toBe('value_tradeoff');
    });

    it('V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable is SURFACED (identity) — #710', () => {
      expect(V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable).toBe('key_detail_unavailable');
      expect(v4DisplayStateFor('key_detail_unavailable')).toBe('key_detail_unavailable');
    });

    it('a value_tradeoff point displays its own state with the "Name the tradeoff" move set (no impasse escalation) — #710', () => {
      // value_tradeoff now maps to itself for display; its own next-move set
      // follows — the dominant is "Name the tradeoff", never the impasse line.
      expect(v4DisplayStateFor('value_tradeoff')).toBe('value_tradeoff');
      const moves = nextMovesForState('value_tradeoff');
      const labels = moves.map((m) => m.label);
      expect(moves[0].label).toBe('Name the tradeoff');
      // Never an impasse line — surfacing a more specific state never escalates.
      expect(labels).not.toContain('Preserve the disagreement');
      expect(labels).not.toContain('Reopen with a source, definition, or narrower claim');
    });

    it('the "Different priorities" / "Key detail unavailable" chip text IS a v4 display label — #710', () => {
      // Each surfaced state projects to itself, so its chip label is what the
      // node chip / rail badge / distribution segment render.
      expect(plainLanguageForMediatorState('value_tradeoff')).toBe(VALUE_TRADEOFF_DISPLAY_COPY.chip);
      expect(plainLanguageForMediatorState('key_detail_unavailable')).toBe(
        KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip,
      );
      expect(VALUE_TRADEOFF_DISPLAY_COPY.chip).toBe('Different priorities');
      expect(KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip).toBe('Key detail unavailable');
    });
  });

  describe('Surfaced subtype copy constants are dignified + wired (UX-IMPASSE-002 #710)', () => {
    it('"Different priorities" copy is authored, dignified, and operator-locked', () => {
      expect(VALUE_TRADEOFF_DISPLAY_COPY.chip).toBe('Different priorities');
      expect(VALUE_TRADEOFF_DISPLAY_COPY.lead).toBe('This point turns on a value tradeoff.');
      assertDignified('value_tradeoff.lead', VALUE_TRADEOFF_DISPLAY_COPY.lead);
      assertDignified('value_tradeoff.help', VALUE_TRADEOFF_DISPLAY_COPY.help);
      assertDignified('value_tradeoff.next', VALUE_TRADEOFF_DISPLAY_COPY.next);
    });

    it('"Key detail unavailable" copy is authored, dignified, and operator-locked', () => {
      expect(KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip).toBe('Key detail unavailable');
      expect(KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.lead).toBe('A key detail is not available to test here.');
      assertDignified('key_detail.lead', KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.lead);
      assertDignified('key_detail.help', KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.help);
      assertDignified('key_detail.next', KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.next);
    });

    it('the surfaced copy chip values feed the wired display labels', () => {
      // The surfaced states project to themselves, so the chip == the rendered
      // node/rail/distribution label for each.
      expect(plainLanguageForMediatorState('value_tradeoff')).toBe(VALUE_TRADEOFF_DISPLAY_COPY.chip);
      expect(plainLanguageForMediatorState('key_detail_unavailable')).toBe(
        KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip,
      );
    });

    it('the surfaced subtypes are still NOT part of IMPASSE_SUBTYPE_COPY (the impasse block)', () => {
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

  describe('Deferred subtype copy stays dormant (#710 follow-up — NOT surfaced)', () => {
    it('ACCOUNTS_DIFFER_DISPLAY_COPY is authored + dignified but unwired (RECOLLECTION_KEYS empty in v1)', () => {
      expect(ACCOUNTS_DIFFER_DISPLAY_COPY.chip).toBe('Difference of recollection');
      expect(ACCOUNTS_DIFFER_DISPLAY_COPY.lead).toBe('The accounts do not line up.');
      assertDignified('accounts_differ.lead', ACCOUNTS_DIFFER_DISPLAY_COPY.lead);
      assertDignified('accounts_differ.help', ACCOUNTS_DIFFER_DISPLAY_COPY.help);
      assertDignified('accounts_differ.next', ACCOUNTS_DIFFER_DISPLAY_COPY.next);
    });

    it('no_current_pathway stays the structured-impasse frame (chip folds; never a distinct chip)', () => {
      expect(IMPASSE_SUBTYPE_COPY.no_current_pathway.chip).toBe('Structured impasse');
      assertDignified('no_current_pathway.lead', IMPASSE_SUBTYPE_COPY.no_current_pathway.lead);
      assertDignified('no_current_pathway.help', IMPASSE_SUBTYPE_COPY.no_current_pathway.help);
      assertDignified('no_current_pathway.next', IMPASSE_SUBTYPE_COPY.no_current_pathway.next);
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
