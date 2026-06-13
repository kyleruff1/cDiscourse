/**
 * ARG-ROOM-001 — pure-model tests for argumentRoomCreationMatrix.ts.
 *
 * Covers every public function (deriveArgumentRoomCreation, the capacity
 * helpers, the plain-language mapper), the binding contract matrix, the five
 * operator-ratified examples verbatim, determinism + non-mutation + frozen
 * output, the ban-list / no-snake_case-leak doctrine, and the public-cap
 * 6 -> 5 reconciliation parity.
 */
import {
  deriveArgumentRoomCreation,
  fitsPublicCapacity,
  fitsPrivateCapacity,
  plainLanguageForCreationReason,
  ARGUMENT_ROOM_CREATION_COPY,
  ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS,
  PUBLIC_ACTIVE_PARTICIPANT_CAP,
  PRIVATE_ACTIVE_PARTICIPANT_CAP,
  MAX_DIRECT_INVITES_AT_CREATION,
  _forbiddenArgumentRoomCreationTokens,
  type ArgumentRoomCreationIntent,
} from '../src/features/debates/argumentRoomCreationMatrix';
import {
  PUBLIC_ROOM_SEAT_CAP,
  PRIMARY_SEAT_COUNT,
} from '../src/features/debates/publicSeatModel';
import {
  plainLanguageForInviteError,
  BANNED_INVITE_FRAMING,
} from '../src/features/invites/inviteCopy';

const intent = (
  visibility: ArgumentRoomCreationIntent['visibility'],
  directInviteEmails: string[],
): ArgumentRoomCreationIntent => ({ visibility, directInviteEmails });

// A representative spread of inputs used by the cross-branch invariant tests.
const SAMPLE_INTENTS: ArgumentRoomCreationIntent[] = [
  intent('private', []),
  intent('private', ['a@example.com']),
  intent('public', []),
  intent('public', ['a@example.com']),
  intent('public', ['a@example.com', 'b@example.com']),
  intent('private', ['a@example.com', 'b@example.com']),
  intent('public', ['nope']),
  intent('private', ['x@y.com,']),
  intent('public', [', ,']),
  intent('public', ['  Alice@Example.COM ']),
];

// ── Binding matrix rows ─────────────────────────────────────────

describe('ARG-ROOM-001 — binding creation matrix rows', () => {
  it('private + no email → invalid (private_requires_invite), cap 2, reserved 0, open 0', () => {
    const r = deriveArgumentRoomCreation(intent('private', []));
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('private_requires_invite');
    expect(r.capacity).toBe(2);
    expect(r.directInviteCount).toBe(0);
    expect(r.reservedInviteSeats).toBe(0);
    expect(r.openSlots).toBe(0);
  });

  it('private + one valid email → valid, cap 2, count 1, reserved 1, open 0', () => {
    const r = deriveArgumentRoomCreation(intent('private', ['a@example.com']));
    expect(r.valid).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.capacity).toBe(2);
    expect(r.directInviteCount).toBe(1);
    expect(r.reservedInviteSeats).toBe(1);
    expect(r.openSlots).toBe(0);
  });

  it('public + no email → valid, cap 5, reserved 0, open 4', () => {
    const r = deriveArgumentRoomCreation(intent('public', []));
    expect(r.valid).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.capacity).toBe(5);
    expect(r.directInviteCount).toBe(0);
    expect(r.reservedInviteSeats).toBe(0);
    expect(r.openSlots).toBe(4);
  });

  it('public + one valid email → valid, cap 5, reserved 1, open 3', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['a@example.com']));
    expect(r.valid).toBe(true);
    expect(r.capacity).toBe(5);
    expect(r.directInviteCount).toBe(1);
    expect(r.reservedInviteSeats).toBe(1);
    expect(r.openSlots).toBe(3);
  });

  it('public + two emails → invalid (too_many_direct_invites)', () => {
    const r = deriveArgumentRoomCreation(
      intent('public', ['a@example.com', 'b@example.com']),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('too_many_direct_invites');
  });

  it('private + two emails → invalid (too_many_direct_invites)', () => {
    const r = deriveArgumentRoomCreation(
      intent('private', ['a@example.com', 'b@example.com']),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('too_many_direct_invites');
  });
});

// ── The five operator-ratified examples (verbatim) ──────────────

describe('ARG-ROOM-001 — operator-ratified acceptance examples (verbatim)', () => {
  it('private [] → INVALID private_requires_invite', () => {
    const r = deriveArgumentRoomCreation({
      visibility: 'private',
      directInviteEmails: [],
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('private_requires_invite');
  });

  it('private [a@example.com] → VALID, capacity 2, reservedInviteSeats 1, openSlots 0', () => {
    const r = deriveArgumentRoomCreation({
      visibility: 'private',
      directInviteEmails: ['a@example.com'],
    });
    expect(r.valid).toBe(true);
    expect(r.capacity).toBe(2);
    expect(r.reservedInviteSeats).toBe(1);
    expect(r.openSlots).toBe(0);
  });

  it('public [] → VALID, capacity 5, reservedInviteSeats 0, openSlots 4', () => {
    const r = deriveArgumentRoomCreation({
      visibility: 'public',
      directInviteEmails: [],
    });
    expect(r.valid).toBe(true);
    expect(r.capacity).toBe(5);
    expect(r.reservedInviteSeats).toBe(0);
    expect(r.openSlots).toBe(4);
  });

  it('public [a@example.com] → VALID, capacity 5, reservedInviteSeats 1, openSlots 3', () => {
    const r = deriveArgumentRoomCreation({
      visibility: 'public',
      directInviteEmails: ['a@example.com'],
    });
    expect(r.valid).toBe(true);
    expect(r.capacity).toBe(5);
    expect(r.reservedInviteSeats).toBe(1);
    expect(r.openSlots).toBe(3);
  });

  it('public [a@example.com, b@example.com] → INVALID too_many_direct_invites', () => {
    const r = deriveArgumentRoomCreation({
      visibility: 'public',
      directInviteEmails: ['a@example.com', 'b@example.com'],
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('too_many_direct_invites');
  });
});

// ── Invalid email ───────────────────────────────────────────────

describe('ARG-ROOM-001 — invalid email', () => {
  it.each(['nope', 'a@', '@b.com', 'a@b'])(
    'public + "%s" → invalid_email',
    (bad) => {
      const r = deriveArgumentRoomCreation(intent('public', [bad]));
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('invalid_email');
    },
  );

  it('private + a malformed email → invalid_email (not private_requires_invite)', () => {
    const r = deriveArgumentRoomCreation(intent('private', ['nope']));
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('invalid_email');
  });
});

// ── Self-invite (default reject, both visibilities) ─────────────

describe('ARG-ROOM-001 — self-invite', () => {
  it('public + invitee equal to creatorEmail → self_invite', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['creator@x.com']), {
      creatorEmail: 'creator@x.com',
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('self_invite');
  });

  it('private + invitee equal to creatorEmail → self_invite', () => {
    const r = deriveArgumentRoomCreation(intent('private', ['creator@x.com']), {
      creatorEmail: 'creator@x.com',
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('self_invite');
  });

  it('self-invite match is case / whitespace insensitive', () => {
    const r = deriveArgumentRoomCreation(
      intent('public', ['  Creator@X.COM ']),
      { creatorEmail: 'creator@x.com' },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('self_invite');
  });

  it('no creatorEmail supplied → self-invite NOT detected, result is valid', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['creator@x.com']));
    expect(r.valid).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it('creatorEmail null → self-invite check skipped, result is valid', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['creator@x.com']), {
      creatorEmail: null,
    });
    expect(r.valid).toBe(true);
  });

  it('creatorEmail different from invitee → valid', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['guest@x.com']), {
      creatorEmail: 'creator@x.com',
    });
    expect(r.valid).toBe(true);
  });
});

// ── Multi-email reject (one direct invite max) ──────────────────

describe('ARG-ROOM-001 — one direct invite max', () => {
  it('array of two addresses (raw length > 1) → too_many_direct_invites', () => {
    const r = deriveArgumentRoomCreation(
      intent('public', ['a@x.com', 'b@y.com']),
    );
    expect(r.reason).toBe('too_many_direct_invites');
  });

  it('"a@x.com, b@y.com" single field paste → too_many (NOT invalid_email)', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['a@x.com, b@y.com']));
    expect(r.reason).toBe('too_many_direct_invites');
  });

  it('"a@x.com; b@y.com" semicolon paste → too_many', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['a@x.com; b@y.com']));
    expect(r.reason).toBe('too_many_direct_invites');
  });

  it('"a@x.com b@y.com" space paste → too_many', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['a@x.com b@y.com']));
    expect(r.reason).toBe('too_many_direct_invites');
  });

  it('trailing separator "a@x.com," → valid single invite', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['a@x.com,']));
    expect(r.valid).toBe(true);
    expect(r.directInviteCount).toBe(1);
  });

  it('field of only separators ", ," → treated as empty (private invalid, public valid)', () => {
    expect(deriveArgumentRoomCreation(intent('private', [', ,'])).reason).toBe(
      'private_requires_invite',
    );
    expect(deriveArgumentRoomCreation(intent('public', [', ,'])).valid).toBe(
      true,
    );
  });

  it('single blank element [""] → treated as empty', () => {
    expect(deriveArgumentRoomCreation(intent('private', [''])).reason).toBe(
      'private_requires_invite',
    );
    expect(deriveArgumentRoomCreation(intent('public', ['   '])).valid).toBe(
      true,
    );
  });

  it('MAX_DIRECT_INVITES_AT_CREATION is 1', () => {
    expect(MAX_DIRECT_INVITES_AT_CREATION).toBe(1);
  });
});

// ── Normalisation + mask composition (reuses shipped helpers) ───

describe('ARG-ROOM-001 — normalisation + mask composition', () => {
  it('"  Alice@Example.COM " → normalised lower+trim, masked storage forms', () => {
    const r = deriveArgumentRoomCreation(
      intent('public', ['  Alice@Example.COM ']),
    );
    expect(r.valid).toBe(true);
    expect(r.normalisedDirectInviteEmail).toBe('alice@example.com');
    expect(r.maskedDirectInviteEmail).toBe('a•••@example.com');
  });

  it('a reject result carries null normalised + null masked email', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['nope']));
    expect(r.valid).toBe(false);
    expect(r.normalisedDirectInviteEmail).toBeNull();
    expect(r.maskedDirectInviteEmail).toBeNull();
  });

  it('a public no-invite valid result carries null normalised + null masked', () => {
    const r = deriveArgumentRoomCreation(intent('public', []));
    expect(r.valid).toBe(true);
    expect(r.normalisedDirectInviteEmail).toBeNull();
    expect(r.maskedDirectInviteEmail).toBeNull();
  });
});

// ── Visibility normalisation (mirrors createDebate) ─────────────

describe('ARG-ROOM-001 — visibility normalisation', () => {
  it('unknown / garbage visibility coerces to public (capacity 5)', () => {
    const r = deriveArgumentRoomCreation({
      visibility: 'weird' as ArgumentRoomCreationIntent['visibility'],
      directInviteEmails: [],
    });
    expect(r.visibility).toBe('public');
    expect(r.capacity).toBe(5);
    expect(r.valid).toBe(true);
  });

  it('explicit private stays private (capacity 2)', () => {
    const r = deriveArgumentRoomCreation(intent('private', ['a@example.com']));
    expect(r.visibility).toBe('private');
    expect(r.capacity).toBe(2);
  });
});

// ── Cross-branch derivation invariants ──────────────────────────

describe('ARG-ROOM-001 — derivation invariants', () => {
  it('reservedInviteSeats === directInviteCount for every valid result', () => {
    for (const i of SAMPLE_INTENTS) {
      const r = deriveArgumentRoomCreation(i);
      if (r.valid) expect(r.reservedInviteSeats).toBe(r.directInviteCount);
    }
  });

  it('openSlots === capacity - 1 (creator) - reservedInviteSeats for every valid result', () => {
    for (const i of SAMPLE_INTENTS) {
      const r = deriveArgumentRoomCreation(i);
      if (r.valid) {
        expect(r.openSlots).toBe(r.capacity - 1 - r.reservedInviteSeats);
      }
    }
  });

  it('1 (creator) + reservedInviteSeats + openSlots === capacity for every valid result', () => {
    for (const i of SAMPLE_INTENTS) {
      const r = deriveArgumentRoomCreation(i);
      if (r.valid) {
        expect(1 + r.reservedInviteSeats + r.openSlots).toBe(r.capacity);
      }
    }
  });

  it('openSlots ∈ {0,3,4}, counts ∈ {0,1}, capacity ∈ {2,5} across all branches', () => {
    for (const i of SAMPLE_INTENTS) {
      const r = deriveArgumentRoomCreation(i);
      expect([0, 3, 4]).toContain(r.openSlots);
      expect([0, 1]).toContain(r.directInviteCount);
      expect([0, 1]).toContain(r.reservedInviteSeats);
      expect([2, 5]).toContain(r.capacity);
    }
  });

  it('post-create active(1) + reserved fits the cap for every valid result', () => {
    for (const i of SAMPLE_INTENTS) {
      const r = deriveArgumentRoomCreation(i);
      if (!r.valid) continue;
      const fits =
        r.visibility === 'public'
          ? fitsPublicCapacity(1, r.reservedInviteSeats)
          : fitsPrivateCapacity(1, r.reservedInviteSeats);
      expect(fits).toBe(true);
    }
  });

  it('every reject zeroes the seat fields, carries no email, and names a reason', () => {
    for (const i of SAMPLE_INTENTS) {
      const r = deriveArgumentRoomCreation(i);
      if (r.valid) continue;
      expect(r.directInviteCount).toBe(0);
      expect(r.reservedInviteSeats).toBe(0);
      expect(r.openSlots).toBe(0);
      expect(r.normalisedDirectInviteEmail).toBeNull();
      expect(r.maskedDirectInviteEmail).toBeNull();
      expect(ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS).toContain(r.reason);
    }
  });
});

// ── Capacity helpers ────────────────────────────────────────────

describe('ARG-ROOM-001 — capacity helpers', () => {
  it('fitsPublicCapacity: 4+1 fits (=5), 4+2 does not (boundary 5)', () => {
    expect(fitsPublicCapacity(4, 1)).toBe(true);
    expect(fitsPublicCapacity(4, 2)).toBe(false);
    expect(fitsPublicCapacity(5, 0)).toBe(true);
    expect(fitsPublicCapacity(5, 1)).toBe(false);
  });

  it('fitsPrivateCapacity: 1+1 fits (=2), 2+1 does not (boundary 2)', () => {
    expect(fitsPrivateCapacity(1, 1)).toBe(true);
    expect(fitsPrivateCapacity(2, 1)).toBe(false);
    expect(fitsPrivateCapacity(2, 0)).toBe(true);
    expect(fitsPrivateCapacity(0, 0)).toBe(true);
  });
});

// ── Plain language + ban-list (doctrine §1, §9) ─────────────────

describe('ARG-ROOM-001 — plain language + ban-list', () => {
  const emittedCopy = (): string[] => [
    ARGUMENT_ROOM_CREATION_COPY.private_requires_invite,
    ARGUMENT_ROOM_CREATION_COPY.too_many_direct_invites,
    ...ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS.map(
      plainLanguageForCreationReason,
    ),
    plainLanguageForCreationReason(null),
    plainLanguageForCreationReason(undefined),
  ];

  it('every reason maps to a non-empty string with no snake_case leak', () => {
    const reasons = [
      ...ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS,
      null,
      undefined,
    ];
    for (const r of reasons) {
      const copy = plainLanguageForCreationReason(r);
      expect(typeof copy).toBe('string');
      expect(copy.length).toBeGreaterThan(0);
      expect(copy).not.toContain('_');
    }
  });

  it('a raw reason code never leaks verbatim into its plain language', () => {
    for (const r of ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS) {
      expect(plainLanguageForCreationReason(r)).not.toContain(r);
    }
  });

  it('unknown / undefined reason → shipped generic fallback', () => {
    const generic = plainLanguageForInviteError(null);
    expect(plainLanguageForCreationReason(undefined)).toBe(generic);
    expect(
      plainLanguageForCreationReason(
        'totally_unknown' as unknown as Parameters<
          typeof plainLanguageForCreationReason
        >[0],
      ),
    ).toBe(generic);
  });

  it('self_invite + invalid_email copy reuse the shipped invite strings', () => {
    expect(plainLanguageForCreationReason('self_invite')).toBe(
      plainLanguageForInviteError('cannot_invite_self'),
    );
    expect(plainLanguageForCreationReason('invalid_email')).toBe(
      plainLanguageForInviteError('invalid_email'),
    );
  });

  it('authors exactly the two new neutral strings', () => {
    expect(plainLanguageForCreationReason('private_requires_invite')).toBe(
      ARGUMENT_ROOM_CREATION_COPY.private_requires_invite,
    );
    expect(plainLanguageForCreationReason('too_many_direct_invites')).toBe(
      ARGUMENT_ROOM_CREATION_COPY.too_many_direct_invites,
    );
    expect(
      ARGUMENT_ROOM_CREATION_COPY.private_requires_invite.length,
    ).toBeGreaterThan(0);
    expect(
      ARGUMENT_ROOM_CREATION_COPY.too_many_direct_invites.length,
    ).toBeGreaterThan(0);
  });

  it('no emitted copy contains a banned verdict / person token', () => {
    const forbidden = _forbiddenArgumentRoomCreationTokens();
    for (const copy of emittedCopy()) {
      const lower = copy.toLowerCase();
      for (const token of forbidden) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no emitted copy contains a QOL-038 BANNED_INVITE_FRAMING token', () => {
    for (const copy of emittedCopy()) {
      const lower = copy.toLowerCase();
      for (const token of BANNED_INVITE_FRAMING) {
        expect(lower).not.toContain(token.toLowerCase());
      }
    }
  });
});

// ── Determinism + non-mutation + frozen (engine.ts discipline) ──

describe('ARG-ROOM-001 — determinism + non-mutation', () => {
  it('same input twice → deeply-equal result', () => {
    const a = deriveArgumentRoomCreation(intent('public', ['a@example.com']), {
      creatorEmail: 'creator@x.com',
    });
    const b = deriveArgumentRoomCreation(intent('public', ['a@example.com']), {
      creatorEmail: 'creator@x.com',
    });
    expect(a).toEqual(b);
  });

  it('does not mutate the intent or opts objects', () => {
    const emails = ['a@example.com'];
    const intentObj: ArgumentRoomCreationIntent = {
      visibility: 'public',
      directInviteEmails: emails,
    };
    const optsObj = { creatorEmail: 'creator@x.com' };
    deriveArgumentRoomCreation(intentObj, optsObj);
    expect(intentObj.directInviteEmails).toBe(emails); // same array reference
    expect(intentObj.directInviteEmails).toEqual(['a@example.com']);
    expect(intentObj.visibility).toBe('public');
    expect(optsObj).toEqual({ creatorEmail: 'creator@x.com' });
  });

  it('returns a frozen object', () => {
    const r = deriveArgumentRoomCreation(intent('public', ['a@example.com']));
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ── Reconciliation parity (public cap 6 → 5; roadmap §4.1) ──────

describe('ARG-ROOM-001 — public cap reconciliation parity', () => {
  // roadmap 2026-06-13 §4.1 divergence ledger, operator decision 2: the public
  // active-participant cap is reconciled from GAME-005's shipped 6 down to 5,
  // with ONE source of truth shared between publicSeatModel and this matrix.
  it('PUBLIC_ACTIVE_PARTICIPANT_CAP === 5 === PUBLIC_ROOM_SEAT_CAP', () => {
    expect(PUBLIC_ACTIVE_PARTICIPANT_CAP).toBe(5);
    expect(PUBLIC_ROOM_SEAT_CAP).toBe(5);
    expect(PUBLIC_ACTIVE_PARTICIPANT_CAP).toBe(PUBLIC_ROOM_SEAT_CAP);
  });

  it('PRIVATE_ACTIVE_PARTICIPANT_CAP === 2 === PRIMARY_SEAT_COUNT', () => {
    expect(PRIVATE_ACTIVE_PARTICIPANT_CAP).toBe(2);
    expect(PRIMARY_SEAT_COUNT).toBe(2);
    expect(PRIVATE_ACTIVE_PARTICIPANT_CAP).toBe(PRIMARY_SEAT_COUNT);
  });

  it('the ArgumentRoomCapacity literal union {2, 5} matches the two caps', () => {
    expect(new Set([PRIVATE_ACTIVE_PARTICIPANT_CAP, PUBLIC_ACTIVE_PARTICIPANT_CAP])).toEqual(
      new Set([2, 5]),
    );
  });

  it('ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS holds exactly the four ratified reasons', () => {
    expect([...ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS].sort()).toEqual(
      [
        'invalid_email',
        'private_requires_invite',
        'self_invite',
        'too_many_direct_invites',
      ].sort(),
    );
  });
});
