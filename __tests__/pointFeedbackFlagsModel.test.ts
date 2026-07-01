/**
 * UX-FLAGS-002 — pointFeedbackFlagsModel adapter tests.
 *
 * The adapter is the pure DATA layer for the point-level friendly-flag UI. It
 * delegates ALL routing + suppression to the #850 descriptor layer and only
 * shapes the surviving descriptors into calm render view models. These tests
 * pin the delegation contract, the doctrine fences (Family J excluded, Family D
 * never grants standing, no raw codes / verdict tokens in rendered fields), the
 * own-bubble suppression, de-dupe, stable order (NO cap), and the freeze/purity.
 */
import {
  buildPointFeedbackFlags,
  type PointObservationInput,
  type PointFeedbackFlagViewModel,
} from '../src/features/feedbackFlags/pointFeedbackFlagsModel';
import { _forbiddenVerdictTokens } from '../src/features/feedbackFlags/friendlyFlagMap';

const OTHER: { isOwnPoint: false } = { isOwnPoint: false };
const OWN: { isOwnPoint: true } = { isOwnPoint: true };

function obs(family: string, rawKey: string): PointObservationInput {
  return { family, rawKey } as PointObservationInput;
}

/** Regex for a raw snake_case-looking code (two lowercase words joined by _). */
const SNAKE_RE = /[a-z]+_[a-z]+/;

/** Standing/credit/score words banned from any Family D rendered field. */
const STANDING_WORDS = ['standing', 'credit', 'score', 'proven', 'points', 'wins', 'win'];

function renderedFields(vm: PointFeedbackFlagViewModel): string[] {
  const out = [vm.label, vm.accessibilityLabel];
  if (typeof vm.helper === 'string') out.push(vm.helper);
  return out;
}

describe('UX-FLAGS-002 buildPointFeedbackFlags', () => {
  it('maps an A-family acknowledges_parent observation to the "Nice bridge" label', () => {
    const flags = buildPointFeedbackFlags(
      [obs('parent_relation', 'acknowledges_parent')],
      OTHER,
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].id).toBe('nice_bridge');
    expect(flags[0].label).toBe('Nice bridge');
    expect(flags[0].tone).toBe('positive');
  });

  it('passes Family D neverGrantsStanding through and renders NO standing/credit/score words', () => {
    const flags = buildPointFeedbackFlags(
      [
        obs('evidence_source_chain', 'provides_evidence'), // brought_receipts
        obs('evidence_source_chain', 'asks_for_evidence'), // needs_a_receipt
        obs('evidence_source_chain', 'source_requested'), // open_receipt
        obs('evidence_source_chain', 'creates_source_chain_gap'), // complete_the_chain
      ],
      OTHER,
    );
    expect(flags.length).toBe(4);
    for (const vm of flags) {
      expect(vm.neverGrantsStanding).toBe(true);
      // The a11y label carries the receipt/source framing (not standing).
      expect(vm.accessibilityLabel.toLowerCase()).toContain('receipt or source help');
      for (const field of renderedFields(vm)) {
        const lower = field.toLowerCase();
        for (const w of STANDING_WORDS) {
          expect(lower.includes(w)).toBe(false);
        }
      }
    }
  });

  it('excludes Family J (sensitive_composer) entirely', () => {
    const flags = buildPointFeedbackFlags(
      [
        obs('sensitive_composer', 'shifts_to_person_or_intent'),
        obs('sensitive_composer', 'contains_unplayable_insult_only'),
        obs('sensitive_composer', 'needs_pre_send_pause'),
      ],
      OTHER,
    );
    expect(flags).toEqual([]);
  });

  it('drops unknown family, unknown rawKey, *_false, and no_* readings', () => {
    const flags = buildPointFeedbackFlags(
      [
        obs('not_a_family', 'whatever'),
        obs('parent_relation', 'not_a_real_key'),
        obs('parent_relation', 'acknowledges_parent_false'),
        obs('evidence_source_chain', 'no_source_attached'),
      ],
      OTHER,
    );
    expect(flags).toEqual([]);
  });

  it('honors clientSuppressed by hiding those flags (stubbed descriptor)', () => {
    // Force `thread_topology` into the client-suppress set at the #850 layer and
    // confirm the adapter drops it. Restore afterward so no test bleeds.
    const map = require('../src/features/feedbackFlags/friendlyFlagMap');
    const descriptor = map.FRIENDLY_FLAG_DESCRIPTORS.new_issue;
    const original = descriptor.clientSuppressed;
    const spy = jest
      .spyOn(map, 'friendlyFlagsFor')
      .mockReturnValue(Object.freeze([{ ...descriptor, clientSuppressed: true }]));
    try {
      const flags = buildPointFeedbackFlags(
        [obs('thread_topology', 'introduces_new_issue')],
        OTHER,
      );
      expect(flags).toEqual([]);
    } finally {
      spy.mockRestore();
      descriptor.clientSuppressed = original;
    }
  });

  it('drops own-bubble challenge-adjacent flags but keeps a positive bridge on the own bubble', () => {
    const observations = [
      obs('parent_relation', 'acknowledges_parent'), // nice_bridge (positive, kept)
      obs('parent_relation', 'challenges_parent'), // direct_challenge (own-suppressed)
      obs('disagreement_axis', 'disputes_scope'), // disagrees_on_scope (own-suppressed)
      obs('claim_clarity', 'claim_specificity_low'), // could_be_more_specific (own-suppressed)
    ];

    const own = buildPointFeedbackFlags(observations, OWN);
    expect(own.map((f) => f.id)).toEqual(['nice_bridge']);

    const other = buildPointFeedbackFlags(observations, OTHER);
    expect(other.map((f) => f.id)).toEqual([
      'nice_bridge',
      'direct_challenge',
      'disagrees_on_scope',
      'could_be_more_specific',
    ]);
  });

  it('de-dupes two rows that resolve to the same flag key', () => {
    const flags = buildPointFeedbackFlags(
      [
        obs('parent_relation', 'acknowledges_parent'), // nice_bridge
        obs('parent_relation', 'supports_parent'), // nice_bridge (dup)
      ],
      OTHER,
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].id).toBe('nice_bridge');
  });

  it('preserves input order with NO cap and NO ranking (length not sliced to 3)', () => {
    const flags = buildPointFeedbackFlags(
      [
        obs('parent_relation', 'acknowledges_parent'), // nice_bridge
        obs('argument_scheme', 'analogy_reasoning_present'), // strong_comparison
        obs('claim_clarity', 'claim_present'), // clear_claim
        obs('resolution_progress', 'narrows_claim'), // narrowed_the_claim
        obs('critical_question', 'missing_warrant'), // unanswered_question
      ],
      OTHER,
    );
    expect(flags.map((f) => f.id)).toEqual([
      'nice_bridge',
      'strong_comparison',
      'clear_claim',
      'narrowed_the_claim',
      'unanswered_question',
    ]);
    expect(flags.length).toBe(5); // NOT capped to 3
  });

  it('never leaks a raw family / rawKey / snake_case into rendered fields (id + family exempt)', () => {
    // Exercise one flag per family that maps.
    const flags = buildPointFeedbackFlags(
      [
        obs('parent_relation', 'acknowledges_parent'),
        obs('disagreement_axis', 'preserves_face_while_disagreeing'),
        obs('misunderstanding_repair', 'clarified'),
        obs('evidence_source_chain', 'provides_evidence'),
        obs('argument_scheme', 'analogy_reasoning_present'),
        obs('critical_question', 'missing_warrant'),
        obs('resolution_progress', 'conceded'),
        obs('claim_clarity', 'claim_present'),
        obs('thread_topology', 'introduces_new_issue'),
      ],
      OTHER,
    );
    expect(flags.length).toBeGreaterThan(0);
    for (const vm of flags) {
      for (const field of renderedFields(vm)) {
        expect(field).not.toMatch(SNAKE_RE);
      }
    }
  });

  it('emits no forbidden verdict tokens in any rendered field (#850 ban-list)', () => {
    const banned = _forbiddenVerdictTokens();
    const flags = buildPointFeedbackFlags(
      [
        obs('parent_relation', 'acknowledges_parent'),
        obs('parent_relation', 'challenges_parent'),
        obs('disagreement_axis', 'disputes_scope'),
        obs('evidence_source_chain', 'provides_evidence'),
        obs('resolution_progress', 'conceded'),
        obs('claim_clarity', 'claim_specificity_low'),
      ],
      OTHER,
    );
    for (const vm of flags) {
      for (const field of renderedFields(vm)) {
        const lower = field.toLowerCase();
        for (const token of banned) {
          expect(lower.includes(token)).toBe(false);
        }
      }
    }
  });

  it('returns a frozen empty array for non-array / null / undefined input', () => {
    const a = buildPointFeedbackFlags(null, OTHER);
    const b = buildPointFeedbackFlags(undefined, OTHER);
    const c = buildPointFeedbackFlags(123 as unknown as PointObservationInput[], OTHER);
    for (const result of [a, b, c]) {
      expect(result).toEqual([]);
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it('freezes the output array and each view model', () => {
    const flags = buildPointFeedbackFlags(
      [obs('parent_relation', 'acknowledges_parent')],
      OTHER,
    );
    expect(Object.isFrozen(flags)).toBe(true);
    expect(Object.isFrozen(flags[0])).toBe(true);
  });
});
