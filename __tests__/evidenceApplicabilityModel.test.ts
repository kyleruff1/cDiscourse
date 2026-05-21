/**
 * QOL-037 — pure-model tests for evidenceApplicabilityModel.ts.
 *
 * No React, no Supabase, no network. Targets 100% line + branch coverage on
 * the model + copy (design §11 coverage target). Covers: the choice-set shape,
 * the required-clarification rule, the derivation table, the transition
 * preview, the chip contract, the view-model, and the doctrine ban-lists.
 */
import {
  ALL_EVIDENCE_RESPONSE_CHOICES,
  ALL_APPLICABILITY_STATUSES,
  EVIDENCE_RESPONSE_CHOICES,
  MIN_CLARIFICATION_CHARS,
  validateEvidenceResponseDraft,
  deriveApplicabilityStatus,
  previewApplicabilityTransition,
  summarizeApplicabilityChip,
  buildRespondToEvidenceViewModel,
  type EvidenceResponseChoice,
  type EvidenceResponseRecord,
} from '../src/features/evidence/evidenceApplicabilityModel';
import {
  ALL_EVIDENCE_APPLICABILITY_STRINGS,
  CLARIFICATION_REQUIRED_REASON,
  CLARIFICATION_TOO_SHORT_REASON,
  APPLICABILITY_CHIP_LABELS,
  APPLICABILITY_CHIP_HELPERS,
} from '../src/features/evidence/evidenceApplicabilityCopy';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Fixtures ───────────────────────────────────────────────────

let seq = 0;
function makeResponse(
  overrides: Partial<EvidenceResponseRecord> = {},
): EvidenceResponseRecord {
  seq += 1;
  return {
    evidenceArtifactId: 'art-1',
    argumentId: `arg-${seq}`,
    choice: 'dispute_applicability',
    clarificationBody: 'The note says practice space but February was settled.',
    respondedByUserId: 'user-A',
    respondedAt: `2026-05-21T00:00:${String(seq).padStart(2, '0')}Z`,
    ...overrides,
  };
}

const NON_ACCEPT_CHOICES: EvidenceResponseChoice[] = [
  'accept_with_caveat',
  'dispute_date',
  'dispute_amount',
  'dispute_applicability',
  'request_source',
  'request_clarification',
];

// ── Shape / enum coverage ──────────────────────────────────────

describe('QOL-037 — choice-set + enum shape', () => {
  it('EvidenceResponseChoice union has exactly the seven documented values', () => {
    expect([...ALL_EVIDENCE_RESPONSE_CHOICES].sort()).toEqual(
      [
        'accept',
        'accept_with_caveat',
        'dispute_amount',
        'dispute_applicability',
        'dispute_date',
        'request_clarification',
        'request_source',
      ].sort(),
    );
    expect(ALL_EVIDENCE_RESPONSE_CHOICES).toHaveLength(7);
  });

  it('ApplicabilityStatus union has exactly the three documented values', () => {
    expect([...ALL_APPLICABILITY_STATUSES].sort()).toEqual(
      [
        'applicability_disputed',
        'applicability_supported',
        'applicability_undisputed',
      ].sort(),
    );
    expect(ALL_APPLICABILITY_STATUSES).toHaveLength(3);
  });

  it('ALL_EVIDENCE_RESPONSE_CHOICES and ALL_APPLICABILITY_STATUSES are frozen', () => {
    expect(Object.isFrozen(ALL_EVIDENCE_RESPONSE_CHOICES)).toBe(true);
    expect(Object.isFrozen(ALL_APPLICABILITY_STATUSES)).toBe(true);
  });

  it('EVIDENCE_RESPONSE_CHOICES has exactly 7 frozen descriptors, one per choice', () => {
    expect(EVIDENCE_RESPONSE_CHOICES).toHaveLength(7);
    expect(Object.isFrozen(EVIDENCE_RESPONSE_CHOICES)).toBe(true);
    for (const descriptor of EVIDENCE_RESPONSE_CHOICES) {
      expect(Object.isFrozen(descriptor)).toBe(true);
    }
    const ids = EVIDENCE_RESPONSE_CHOICES.map((d) => d.choice).sort();
    expect(ids).toEqual([...ALL_EVIDENCE_RESPONSE_CHOICES].sort());
  });

  it('each descriptor matches the design §5 table verbatim', () => {
    const byChoice = new Map(EVIDENCE_RESPONSE_CHOICES.map((d) => [d.choice, d]));

    expect(byChoice.get('accept')).toMatchObject({
      label: 'Accept evidence',
      requiresClarification: false,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    });
    expect(byChoice.get('accept_with_caveat')).toMatchObject({
      label: 'Accept with caveat',
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    });
    expect(byChoice.get('dispute_date')).toMatchObject({
      label: 'Dispute the date',
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    });
    expect(byChoice.get('dispute_amount')).toMatchObject({
      label: 'Dispute the amount',
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    });
    expect(byChoice.get('dispute_applicability')).toMatchObject({
      label: 'Dispute what it applies to',
      requiresClarification: true,
      appliesApplicabilityTransition: 'open_dispute',
      opensEvidenceDebt: false,
    });
    expect(byChoice.get('request_source')).toMatchObject({
      label: 'Ask for the source',
      requiresClarification: false,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: true,
    });
    expect(byChoice.get('request_clarification')).toMatchObject({
      label: 'Ask for clarification',
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    });
  });

  it('only dispute_applicability drives an applicability transition', () => {
    const transitioning = EVIDENCE_RESPONSE_CHOICES.filter(
      (d) => d.appliesApplicabilityTransition !== null,
    );
    expect(transitioning).toHaveLength(1);
    expect(transitioning[0].choice).toBe('dispute_applicability');
  });

  it('only request_source opens an evidence debt', () => {
    const debtOpening = EVIDENCE_RESPONSE_CHOICES.filter((d) => d.opensEvidenceDebt);
    expect(debtOpening).toHaveLength(1);
    expect(debtOpening[0].choice).toBe('request_source');
  });

  it('MIN_CLARIFICATION_CHARS is 12', () => {
    expect(MIN_CLARIFICATION_CHARS).toBe(12);
  });
});

// ── validateEvidenceResponseDraft — the required-clarification rule ──

describe('QOL-037 — validateEvidenceResponseDraft', () => {
  it('accept + empty body → valid', () => {
    expect(validateEvidenceResponseDraft('accept', '')).toEqual({
      isValid: true,
      blockingReason: null,
    });
  });

  it('accept + non-empty body → valid (clarification allowed, not required)', () => {
    expect(validateEvidenceResponseDraft('accept', 'No reservations here.')).toEqual({
      isValid: true,
      blockingReason: null,
    });
  });

  it.each(NON_ACCEPT_CHOICES)(
    '%s + empty body → invalid with the "add a note" reason',
    (choice) => {
      const result = validateEvidenceResponseDraft(choice, '');
      expect(result.isValid).toBe(false);
      expect(result.blockingReason).toBe(CLARIFICATION_REQUIRED_REASON);
    },
  );

  it.each(NON_ACCEPT_CHOICES)(
    '%s + whitespace-only body → invalid (whitespace trimmed)',
    (choice) => {
      const result = validateEvidenceResponseDraft(choice, '    \n\t  ');
      expect(result.isValid).toBe(false);
      expect(result.blockingReason).toBe(CLARIFICATION_REQUIRED_REASON);
    },
  );

  it('non-accept + body shorter than the floor → invalid with the "too short" reason', () => {
    // 'too short' is 8 chars < 12.
    const result = validateEvidenceResponseDraft('dispute_applicability', 'too sho');
    expect(result.isValid).toBe(false);
    expect(result.blockingReason).toBe(CLARIFICATION_TOO_SHORT_REASON);
  });

  it('non-accept + body exactly at the floor → valid', () => {
    const body = 'x'.repeat(MIN_CLARIFICATION_CHARS);
    expect(validateEvidenceResponseDraft('dispute_date', body)).toEqual({
      isValid: true,
      blockingReason: null,
    });
  });

  it.each(NON_ACCEPT_CHOICES)('%s + body well above the floor → valid', (choice) => {
    const result = validateEvidenceResponseDraft(
      choice,
      'This is a full sentence of clarification text.',
    );
    expect(result).toEqual({ isValid: true, blockingReason: null });
  });

  it('request_source + non-empty seeded body → valid (body satisfies the rule)', () => {
    // The EV-002 preset body is well above the floor.
    const result = validateEvidenceResponseDraft(
      'request_source',
      "Could you point to the source you're working from here?",
    );
    expect(result).toEqual({ isValid: true, blockingReason: null });
  });

  it('request_source + cleared body → rule re-engages, invalid', () => {
    const result = validateEvidenceResponseDraft('request_source', '');
    expect(result.isValid).toBe(false);
    expect(result.blockingReason).toBe(CLARIFICATION_REQUIRED_REASON);
  });

  it('non-accept + undefined body → invalid (defensive nullish handling)', () => {
    const result = validateEvidenceResponseDraft(
      'dispute_applicability',
      undefined as never,
    );
    expect(result.isValid).toBe(false);
    expect(result.blockingReason).toBe(CLARIFICATION_REQUIRED_REASON);
  });
});

// ── deriveApplicabilityStatus — the derivation table ───────────

describe('QOL-037 — deriveApplicabilityStatus', () => {
  it('empty responses → applicability_undisputed', () => {
    expect(deriveApplicabilityStatus([])).toBe('applicability_undisputed');
  });

  it('non-array input → applicability_undisputed (defensive)', () => {
    expect(deriveApplicabilityStatus(null as never)).toBe('applicability_undisputed');
    expect(deriveApplicabilityStatus(undefined as never)).toBe(
      'applicability_undisputed',
    );
  });

  it('one dispute_applicability → applicability_disputed', () => {
    expect(
      deriveApplicabilityStatus([makeResponse({ choice: 'dispute_applicability' })]),
    ).toBe('applicability_disputed');
  });

  it('dispute then accept by the disputing party → applicability_supported', () => {
    const status = deriveApplicabilityStatus([
      makeResponse({
        choice: 'dispute_applicability',
        respondedByUserId: 'user-A',
        respondedAt: '2026-05-21T00:00:01Z',
      }),
      makeResponse({
        choice: 'accept',
        respondedByUserId: 'user-A',
        clarificationBody: '',
        respondedAt: '2026-05-21T00:00:02Z',
      }),
    ]);
    expect(status).toBe('applicability_supported');
  });

  it('dispute then accept by a DIFFERENT party → still applicability_disputed', () => {
    const status = deriveApplicabilityStatus([
      makeResponse({
        choice: 'dispute_applicability',
        respondedByUserId: 'user-A',
        respondedAt: '2026-05-21T00:00:01Z',
      }),
      makeResponse({
        choice: 'accept',
        respondedByUserId: 'user-B',
        clarificationBody: '',
        respondedAt: '2026-05-21T00:00:02Z',
      }),
    ]);
    expect(status).toBe('applicability_disputed');
  });

  it('supported then a fresh dispute_applicability → re-opens to disputed', () => {
    const status = deriveApplicabilityStatus([
      makeResponse({
        choice: 'dispute_applicability',
        respondedByUserId: 'user-A',
        respondedAt: '2026-05-21T00:00:01Z',
      }),
      makeResponse({
        choice: 'accept',
        respondedByUserId: 'user-A',
        clarificationBody: '',
        respondedAt: '2026-05-21T00:00:02Z',
      }),
      makeResponse({
        choice: 'dispute_applicability',
        respondedByUserId: 'user-B',
        respondedAt: '2026-05-21T00:00:03Z',
      }),
    ]);
    expect(status).toBe('applicability_disputed');
  });

  it('accept while NO dispute is open → stays applicability_undisputed', () => {
    expect(
      deriveApplicabilityStatus([
        makeResponse({ choice: 'accept', clarificationBody: '' }),
      ]),
    ).toBe('applicability_undisputed');
  });

  it.each<EvidenceResponseChoice>([
    'dispute_date',
    'dispute_amount',
    'accept_with_caveat',
    'request_source',
    'request_clarification',
  ])('%s alone never moves off applicability_undisputed', (choice) => {
    expect(deriveApplicabilityStatus([makeResponse({ choice })])).toBe(
      'applicability_undisputed',
    );
  });

  it('dispute_date / dispute_amount do NOT resolve an open dispute', () => {
    const status = deriveApplicabilityStatus([
      makeResponse({
        choice: 'dispute_applicability',
        respondedByUserId: 'user-A',
        respondedAt: '2026-05-21T00:00:01Z',
      }),
      makeResponse({
        choice: 'dispute_amount',
        respondedByUserId: 'user-A',
        respondedAt: '2026-05-21T00:00:02Z',
      }),
      makeResponse({
        choice: 'dispute_date',
        respondedByUserId: 'user-A',
        respondedAt: '2026-05-21T00:00:03Z',
      }),
    ]);
    expect(status).toBe('applicability_disputed');
  });

  it('a record with an unknown choice is ignored, not crashed (edge case 13)', () => {
    const status = deriveApplicabilityStatus([
      makeResponse({ choice: 'some_future_choice' as never }),
      makeResponse({
        choice: 'dispute_applicability',
        respondedAt: '2026-05-21T00:00:09Z',
      }),
    ]);
    expect(status).toBe('applicability_disputed');
  });

  it('a null record in the array is ignored, not crashed', () => {
    const status = deriveApplicabilityStatus([
      null as never,
      makeResponse({ choice: 'dispute_applicability' }),
    ]);
    expect(status).toBe('applicability_disputed');
  });

  it('order independence: two disputes in any order → applicability_disputed', () => {
    const a = makeResponse({
      choice: 'dispute_applicability',
      argumentId: 'd1',
      respondedAt: '2026-05-21T00:00:01Z',
    });
    const b = makeResponse({
      choice: 'dispute_applicability',
      argumentId: 'd2',
      respondedAt: '2026-05-21T00:00:02Z',
    });
    expect(deriveApplicabilityStatus([a, b])).toBe('applicability_disputed');
    expect(deriveApplicabilityStatus([b, a])).toBe('applicability_disputed');
  });

  it('walks oldest-first regardless of input array order', () => {
    // Provide the accept BEFORE the dispute in array order, but with a LATER
    // timestamp — the chronological walk must still see dispute → accept.
    const accept = makeResponse({
      choice: 'accept',
      respondedByUserId: 'user-A',
      clarificationBody: '',
      respondedAt: '2026-05-21T00:00:09Z',
    });
    const dispute = makeResponse({
      choice: 'dispute_applicability',
      respondedByUserId: 'user-A',
      respondedAt: '2026-05-21T00:00:01Z',
    });
    expect(deriveApplicabilityStatus([accept, dispute])).toBe(
      'applicability_supported',
    );
  });

  it('a corroborating move resolves an open dispute → applicability_supported', () => {
    const status = deriveApplicabilityStatus(
      [
        makeResponse({
          choice: 'dispute_applicability',
          argumentId: 'dispute-1',
          respondedByUserId: 'user-A',
          respondedAt: '2026-05-21T00:00:01Z',
        }),
        makeResponse({
          choice: 'request_clarification',
          argumentId: 'corroborating-1',
          respondedByUserId: 'user-B',
          respondedAt: '2026-05-21T00:00:02Z',
        }),
      ],
      { corroboratedByArgumentIds: ['corroborating-1'] },
    );
    expect(status).toBe('applicability_supported');
  });

  it('a corroborating id with NO open dispute leaves the status undisputed', () => {
    const status = deriveApplicabilityStatus(
      [
        makeResponse({
          choice: 'request_clarification',
          argumentId: 'corroborating-1',
        }),
      ],
      { corroboratedByArgumentIds: ['corroborating-1'] },
    );
    expect(status).toBe('applicability_undisputed');
  });

  it('a record missing respondedAt sorts deterministically, no crash', () => {
    const noTimestamp = makeResponse({
      choice: 'dispute_applicability',
      respondedAt: undefined as never,
    });
    const withTimestamp = makeResponse({
      choice: 'request_clarification',
      respondedAt: '2026-05-21T00:00:09Z',
    });
    expect(deriveApplicabilityStatus([withTimestamp, noTimestamp])).toBe(
      'applicability_disputed',
    );
    expect(deriveApplicabilityStatus([noTimestamp, withTimestamp])).toBe(
      'applicability_disputed',
    );
  });

  it('equal timestamps keep input order (stable sort)', () => {
    const ts = '2026-05-21T00:00:05Z';
    const dispute = makeResponse({
      choice: 'dispute_applicability',
      respondedByUserId: 'user-A',
      respondedAt: ts,
    });
    const accept = makeResponse({
      choice: 'accept',
      respondedByUserId: 'user-A',
      clarificationBody: '',
      respondedAt: ts,
    });
    // dispute first → accept resolves it.
    expect(deriveApplicabilityStatus([dispute, accept])).toBe(
      'applicability_supported',
    );
    // accept first (no dispute open yet) → dispute leaves it disputed.
    expect(deriveApplicabilityStatus([accept, dispute])).toBe(
      'applicability_disputed',
    );
  });
});

// ── previewApplicabilityTransition ─────────────────────────────

describe('QOL-037 — previewApplicabilityTransition', () => {
  it('dispute_applicability from undisputed → previews applicability_disputed', () => {
    expect(
      previewApplicabilityTransition('dispute_applicability', 'applicability_undisputed'),
    ).toBe('applicability_disputed');
  });

  it('dispute_applicability from supported → previews applicability_disputed (re-open)', () => {
    expect(
      previewApplicabilityTransition('dispute_applicability', 'applicability_supported'),
    ).toBe('applicability_disputed');
  });

  it.each<EvidenceResponseChoice>([
    'accept',
    'accept_with_caveat',
    'dispute_date',
    'dispute_amount',
    'request_source',
    'request_clarification',
  ])('%s from any status previews the UNCHANGED status', (choice) => {
    for (const status of ALL_APPLICABILITY_STATUSES) {
      expect(previewApplicabilityTransition(choice, status)).toBe(status);
    }
  });

  it('an unknown choice previews the unchanged status (defensive)', () => {
    expect(
      previewApplicabilityTransition(
        'future_choice' as never,
        'applicability_disputed',
      ),
    ).toBe('applicability_disputed');
  });
});

// ── summarizeApplicabilityChip ─────────────────────────────────

describe('QOL-037 — summarizeApplicabilityChip', () => {
  it('applicability_undisputed → isVisible false, empty label + helper', () => {
    const chip = summarizeApplicabilityChip('applicability_undisputed');
    expect(chip).toEqual({
      label: '',
      helper: '',
      tone: 'neutral',
      isVisible: false,
      status: 'applicability_undisputed',
    });
  });

  it('applicability_disputed → "Applicability disputed", tone attention, visible', () => {
    const chip = summarizeApplicabilityChip('applicability_disputed');
    expect(chip.label).toBe('Applicability disputed');
    expect(chip.helper).toBe(APPLICABILITY_CHIP_HELPERS.applicability_disputed);
    expect(chip.tone).toBe('attention');
    expect(chip.isVisible).toBe(true);
    expect(chip.status).toBe('applicability_disputed');
  });

  it('applicability_supported → "Applicability supported", tone info, visible', () => {
    const chip = summarizeApplicabilityChip('applicability_supported');
    expect(chip.label).toBe('Applicability supported');
    expect(chip.helper).toBe(APPLICABILITY_CHIP_HELPERS.applicability_supported);
    expect(chip.tone).toBe('info');
    expect(chip.isVisible).toBe(true);
    expect(chip.status).toBe('applicability_supported');
  });

  it('every status produces a contract (exhaustive)', () => {
    for (const status of ALL_APPLICABILITY_STATUSES) {
      const chip = summarizeApplicabilityChip(status);
      expect(chip.status).toBe(status);
    }
  });
});

// ── buildRespondToEvidenceViewModel ────────────────────────────

describe('QOL-037 — buildRespondToEvidenceViewModel', () => {
  it('returns all 7 choices and the artifact id', () => {
    const vm = buildRespondToEvidenceViewModel('art-9', [], 'March rent');
    expect(vm.evidenceArtifactId).toBe('art-9');
    expect(vm.choices).toHaveLength(7);
    expect(vm.choices).toBe(EVIDENCE_RESPONSE_CHOICES);
  });

  it('currentApplicabilityStatus reflects the responses', () => {
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [makeResponse({ choice: 'dispute_applicability' })],
      'March rent',
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_disputed');
  });

  it('claimedApplicability passes through when provided', () => {
    const vm = buildRespondToEvidenceViewModel('art-1', [], 'March practice-room rent');
    expect(vm.claimedApplicability).toBe('March practice-room rent');
  });

  it('claimedApplicability is null when QOL-036 metadata is absent (edge case 9)', () => {
    const vm = buildRespondToEvidenceViewModel('art-1', [], null);
    expect(vm.claimedApplicability).toBeNull();
  });

  it('claimedApplicability is null when an empty / whitespace string is passed', () => {
    expect(buildRespondToEvidenceViewModel('art-1', [], '   ').claimedApplicability).toBeNull();
    expect(buildRespondToEvidenceViewModel('art-1', [], '').claimedApplicability).toBeNull();
  });

  it('disputedApplicability is the latest open dispute clarification', () => {
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'First dispute clarification text.',
          respondedAt: '2026-05-21T00:00:01Z',
        }),
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'Most recent dispute clarification text.',
          respondedAt: '2026-05-21T00:00:09Z',
        }),
      ],
      'March rent',
    );
    expect(vm.disputedApplicability).toBe('Most recent dispute clarification text.');
  });

  it('disputedApplicability keeps the most-recent dispute when a later array entry is older', () => {
    // The second array entry has an EARLIER timestamp — the model must still
    // surface the chronologically most-recent dispute, not the last array slot.
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'The chronologically most recent dispute text.',
          respondedAt: '2026-05-21T00:00:09Z',
        }),
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'An older dispute that came first in time.',
          respondedAt: '2026-05-21T00:00:01Z',
        }),
      ],
      'March rent',
    );
    expect(vm.disputedApplicability).toBe(
      'The chronologically most recent dispute text.',
    );
  });

  it('disputedApplicability handles a dispute record missing respondedAt', () => {
    // Two open disputes — the FIRST array entry has no timestamp, so the
    // running-winner side of the comparison exercises the nullish fallback.
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'A dispute with no timestamp at all.',
          respondedAt: undefined as never,
        }),
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'A dispute with a real timestamp.',
          respondedAt: '2026-05-21T00:00:05Z',
        }),
      ],
      'March rent',
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_disputed');
    expect(vm.disputedApplicability).not.toBeNull();
  });

  it('disputedApplicability handles a LATER dispute record missing respondedAt', () => {
    // The SECOND array entry has no timestamp — the candidate side of the
    // comparison exercises the nullish fallback at the other position.
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'A dispute with a real timestamp first.',
          respondedAt: '2026-05-21T00:00:05Z',
        }),
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'A later dispute with no timestamp.',
          respondedAt: undefined as never,
        }),
      ],
      'March rent',
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_disputed');
    expect(vm.disputedApplicability).not.toBeNull();
  });

  it('disputedApplicability is null when the open dispute clarification is undefined', () => {
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: undefined as never,
          respondedAt: '2026-05-21T00:00:05Z',
        }),
      ],
      'March rent',
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_disputed');
    expect(vm.disputedApplicability).toBeNull();
  });

  it('disputedApplicability is null when no dispute is open', () => {
    const vm = buildRespondToEvidenceViewModel('art-1', [], 'March rent');
    expect(vm.disputedApplicability).toBeNull();
  });

  it('disputedApplicability is null once the dispute is resolved (supported)', () => {
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        makeResponse({
          choice: 'dispute_applicability',
          respondedByUserId: 'user-A',
          clarificationBody: 'A dispute clarification here.',
          respondedAt: '2026-05-21T00:00:01Z',
        }),
        makeResponse({
          choice: 'accept',
          respondedByUserId: 'user-A',
          clarificationBody: '',
          respondedAt: '2026-05-21T00:00:02Z',
        }),
      ],
      'March rent',
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_supported');
    expect(vm.disputedApplicability).toBeNull();
  });

  it('disputedApplicability is null when the open dispute has a blank clarification', () => {
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [makeResponse({ choice: 'dispute_applicability', clarificationBody: '   ' })],
      'March rent',
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_disputed');
    expect(vm.disputedApplicability).toBeNull();
  });

  it('handles a non-array responses argument defensively', () => {
    const vm = buildRespondToEvidenceViewModel('art-1', null as never, 'March rent');
    expect(vm.currentApplicabilityStatus).toBe('applicability_undisputed');
    expect(vm.disputedApplicability).toBeNull();
  });

  it('skips a null element while still resolving the open dispute clarification', () => {
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        null as never,
        makeResponse({
          choice: 'dispute_applicability',
          clarificationBody: 'The dispute clarification text here.',
          respondedAt: '2026-05-21T00:00:05Z',
        }),
      ],
      'March rent',
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_disputed');
    expect(vm.disputedApplicability).toBe('The dispute clarification text here.');
  });

  it('threads corroborating-move ids through to the derivation', () => {
    const vm = buildRespondToEvidenceViewModel(
      'art-1',
      [
        makeResponse({
          choice: 'dispute_applicability',
          argumentId: 'dispute-1',
          respondedAt: '2026-05-21T00:00:01Z',
        }),
        makeResponse({
          choice: 'request_clarification',
          argumentId: 'corroborating-1',
          respondedAt: '2026-05-21T00:00:02Z',
        }),
      ],
      'March rent',
      { corroboratedByArgumentIds: ['corroborating-1'] },
    );
    expect(vm.currentApplicabilityStatus).toBe('applicability_supported');
  });
});

// ── Doctrine ban-lists ─────────────────────────────────────────

// The §8 forbidden token list — verdict words. `right` is enforced as a
// standalone word (the copy avoids "the right month" entirely) so a substring
// like "copyright" would not false-positive — none of the QOL-037 strings
// contain it anyway.
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
  'case closed',
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

/** Every QOL-037 system-generated string the model can emit, for ban-list
 *  iteration: the copy surface + descriptor labels/helpers + chip
 *  labels/helpers + every preview-derived label. */
function allSystemStrings(): string[] {
  const strings: string[] = [...ALL_EVIDENCE_APPLICABILITY_STRINGS];
  for (const descriptor of EVIDENCE_RESPONSE_CHOICES) {
    strings.push(descriptor.label, descriptor.helper);
  }
  for (const status of ALL_APPLICABILITY_STATUSES) {
    const chip = summarizeApplicabilityChip(status);
    strings.push(chip.label, chip.helper);
  }
  return strings.filter((s) => s.length > 0);
}

describe('QOL-037 — doctrine ban-list', () => {
  it('no system-generated string contains a verdict token', () => {
    for (const text of allSystemStrings()) {
      const lower = text.toLowerCase();
      for (const token of VERDICT_TOKENS) {
        if (token === 'true') {
          // word-boundary check so "construe" / "trust" never false-positive.
          expect(lower).not.toMatch(/\btrue\b/);
        } else if (token === 'right') {
          expect(lower).not.toMatch(/\bright\b/);
        } else {
          expect(lower).not.toContain(token);
        }
      }
      // 'right' as a verdict is forbidden — checked as a standalone word.
      expect(lower).not.toMatch(/\bright\b/);
    }
  });

  it('no system-generated string contains an amplification token', () => {
    for (const text of allSystemStrings()) {
      const lower = text.toLowerCase();
      for (const token of AMPLIFICATION_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no system-generated string looks like an internal snake_case code', () => {
    for (const text of allSystemStrings()) {
      // A whole string that is itself a code is forbidden; a multi-word
      // sentence is fine even if it contains short words.
      expect(looksLikeInternalCode(text.trim())).toBe(false);
    }
  });

  it('the internal EvidenceResponseChoice ids never equal a user-facing label', () => {
    const labels = new Set(EVIDENCE_RESPONSE_CHOICES.map((d) => d.label));
    for (const id of ALL_EVIDENCE_RESPONSE_CHOICES) {
      expect(labels.has(id)).toBe(false);
    }
  });

  it('applicability status chip labels are status phrasing, never a truth verdict', () => {
    // Explicit doctrine assertion (design §11): the two visible chip labels
    // describe a STATUS ("disputed" / "supported"), not a truth value.
    expect(APPLICABILITY_CHIP_LABELS.applicability_disputed).toMatch(/disputed/i);
    expect(APPLICABILITY_CHIP_LABELS.applicability_supported).toMatch(/supported/i);
    for (const label of Object.values(APPLICABILITY_CHIP_LABELS)) {
      expect(label.toLowerCase()).not.toMatch(/\b(proven|true|false)\b/);
    }
  });

  it('every blocking reason is plain language with no snake_case', () => {
    const validations = [
      validateEvidenceResponseDraft('dispute_applicability', ''),
      validateEvidenceResponseDraft('dispute_applicability', 'short'),
    ];
    for (const v of validations) {
      expect(v.blockingReason).not.toBeNull();
      expect(looksLikeInternalCode(v.blockingReason!)).toBe(false);
      expect(v.blockingReason).not.toMatch(/_/);
    }
  });
});
