/**
 * ARG-ROOM-001 — Argument-room creation matrix (pure shared validator).
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI, no `async`, no
 * clock, no randomness. JSON-serializable in and out, frozen output — so the
 * SAME module runs identically on the client create surface and in the server
 * enforcement path (mirrors `src/domain/constitution/engine.ts`). Never import
 * Supabase, React, or any network library into this file.
 *
 * The one decision this card answers, at room-creation time: given a chosen
 * visibility and an optional single direct-invite email, is this a valid room
 * to create, and what is its seat accounting?
 *
 * Binding product contract (roadmap 2026-06-13 §1; operator-ratified 2026-06-13):
 *   One direct invite at creation. Private rooms are 1v1 (max 2 active
 *   participants). Public rooms are capped at five active participants. A
 *   public direct invite reserves one of the five seats. Public with no invite
 *   is valid. Private with no invite is invalid. Observers are not active
 *   participants. Max one direct invite per room.
 *
 * Doctrine anchor — read before changing anything in this file:
 *  - This model decides structural CAPACITY and VALIDITY, never correctness.
 *    No produced string says winner / loser / true / false / liar / etc. A
 *    reject is a structural "not a valid room to create", never a verdict about
 *    a person. Visibility is an ACCESS property, never a verdict (QOL-039).
 *  - Internal reason codes are NEVER echoed to a user. Every reason maps
 *    through `plainLanguageForCreationReason`, which reuses the shipped invite
 *    copy and its generic fallback for unknown codes (doctrine §9).
 *  - One source of truth for capacity: this module IMPORTS
 *    `PUBLIC_ROOM_SEAT_CAP` / `PRIMARY_SEAT_COUNT` from `publicSeatModel`
 *    rather than authoring a second literal. A parity test pins both.
 *  - Email shape + normalisation + masking REUSE the shipped invite helpers —
 *    no new regex — so this model and the invite Edge function agree.
 *  - Decision-only: NO migration, NO Edge, NO RLS, NO write path. The sibling
 *    enforcement card (ARG-ROOM-002) imports this on the server plane; until it
 *    lands, the matrix is advisory.
 */

import { PUBLIC_ROOM_SEAT_CAP, PRIMARY_SEAT_COUNT } from './publicSeatModel';
import {
  validateInviteEmailInput,
  plainLanguageForInviteError,
} from '../invites/inviteCopy';
import { normaliseInviteeEmail, maskInviteeEmail } from '../invites/inviteModel';

// ── Visibility + capacity ───────────────────────────────────────

export type ArgumentRoomVisibility = 'public' | 'private';

/** The two total active-participant capacities a room can carry. */
export type ArgumentRoomCapacity = 2 | 5;

/**
 * Reconciled capacity seams — imported, not re-authored (one source of truth).
 *
 * The roadmap §4.1 divergence ledger reconciles the public active-participant
 * cap from GAME-005's shipped `6` down to `5`; `PUBLIC_ROOM_SEAT_CAP` carries
 * that flip (see `publicSeatModel.ts`). The explicit literal annotations below
 * double as a COMPILE-TIME reconcile guard: if a future edit reverts the cap to
 * `6`, this file stops compiling. The runtime parity test pins the same.
 */
export const PUBLIC_ACTIVE_PARTICIPANT_CAP: 5 = PUBLIC_ROOM_SEAT_CAP;
export const PRIVATE_ACTIVE_PARTICIPANT_CAP: 2 = PRIMARY_SEAT_COUNT;

/** The maximum number of direct invites allowed at room creation. */
export const MAX_DIRECT_INVITES_AT_CREATION = 1;

// ── Reject reasons ──────────────────────────────────────────────

export type ArgumentRoomCreationRejectReason =
  | 'private_requires_invite'
  | 'too_many_direct_invites'
  | 'invalid_email'
  | 'self_invite';

/** Frozen list — tests iterate this; copy coverage iterates this. */
export const ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS: ReadonlyArray<ArgumentRoomCreationRejectReason> =
  Object.freeze([
    'private_requires_invite',
    'too_many_direct_invites',
    'invalid_email',
    'self_invite',
  ]);

// ── Input + options ─────────────────────────────────────────────

export interface ArgumentRoomCreationIntent {
  /** The chosen room visibility. Normalised defensively: anything other than
   *  `'private'` is treated as `'public'` (mirrors `createDebate`). */
  visibility: ArgumentRoomVisibility;
  /**
   * The direct-invite emails the creator supplied. The ratified shape is an
   * ARRAY with **max length 1**. A raw length > 1 → `too_many_direct_invites`.
   * An empty array (or one blank/separators-only element) means no direct
   * invite — valid only for a public room. A single element that itself
   * contains multiple addresses (comma/semicolon/space separated) is also
   * `too_many_direct_invites` (checked before per-email shape).
   */
  directInviteEmails: string[];
}

export interface DeriveArgumentRoomCreationOptions {
  /**
   * When supplied, enables the pure-layer self-invite check (the invitee
   * equal to the creator → `self_invite`, default for both visibilities). When
   * absent, the pure layer cannot detect self-invite and skips the check — the
   * Edge guard (reading the real session email) stays authoritative, exactly
   * as today (manage-room-invite). Never used to query account existence.
   */
  creatorEmail?: string | null;
}

// ── Derived result ──────────────────────────────────────────────

export interface ArgumentRoomCreationDerived {
  visibility: ArgumentRoomVisibility;
  /** Total active-participant capacity (2 private / 5 public). */
  capacity: ArgumentRoomCapacity;
  /** Accepted direct-invite count. 0 on any reject. */
  directInviteCount: 0 | 1;
  /** Seats held against the cap for the pending invite. `=== directInviteCount`
   *  for every valid result. 0 on any reject. */
  reservedInviteSeats: 0 | 1;
  /**
   * Self-claimable open participant slots remaining after creation
   * (`capacity − 1 creator − reservedInviteSeats`). The operator's name for
   * the design's `openParticipantSlotsAfterCreation`. 0 on any reject.
   */
  openSlots: 0 | 3 | 4;
  valid: boolean;
  /** Present only when `valid === false`. Omitted on a valid result. */
  reason?: ArgumentRoomCreationRejectReason;
  /**
   * Composition outputs so the downstream enforcement / invite path never
   * re-normalises. `normalisedDirectInviteEmail` is the `lower(trim)` storage
   * form (for the server / create-invite path); `maskedDirectInviteEmail`
   * (`a•••@example.com`) is the ONLY form for any echo / list surface. Both
   * null when there is no accepted invite (including every reject).
   */
  normalisedDirectInviteEmail: string | null;
  maskedDirectInviteEmail: string | null;
}

// ── Internal helpers ────────────────────────────────────────────

/** Multi-address separators. A syntactically valid address contains none of
 *  these (`normaliseInviteeEmail` rejects any `\s`), so splitting is safe. */
const INVITE_SPLIT_PATTERN = /[,;\s]+/;

/**
 * Flatten the supplied emails into non-empty trimmed tokens. Splits each entry
 * on `[,;\s]+` so a multi-address paste in a single field becomes multiple
 * tokens (checked before per-email shape → a specific `too_many_direct_invites`
 * rather than a generic `invalid_email`). Does not mutate the input.
 */
function collectInviteTokens(emails: ReadonlyArray<string>): string[] {
  const tokens: string[] = [];
  for (const entry of emails) {
    if (typeof entry !== 'string') continue;
    for (const part of entry.split(INVITE_SPLIT_PATTERN)) {
      const trimmed = part.trim();
      if (trimmed.length > 0) tokens.push(trimmed);
    }
  }
  return tokens;
}

/**
 * Seat identity (design § "Product contract"): the creator always occupies one
 * active seat (auto-join), so open = capacity − 1 (creator) − reserved. On the
 * valid path the (capacity, reserved) combos are (5,0)→4, (5,1)→3, (2,1)→0, so
 * the result is always one of `0 | 3 | 4`. The throw guards an off-contract
 * value (unreachable for the ratified matrix) rather than emitting a bad seat
 * count silently.
 */
function deriveOpenSlots(
  capacity: ArgumentRoomCapacity,
  reserved: 0 | 1,
): 0 | 3 | 4 {
  const open = capacity - 1 - reserved;
  if (open === 0 || open === 3 || open === 4) return open;
  throw new Error(
    `argumentRoomCreationMatrix: off-contract openSlots ${open} (capacity ${capacity}, reserved ${reserved})`,
  );
}

/** Build a frozen reject result with all seat fields zeroed and no email. */
function reject(
  visibility: ArgumentRoomVisibility,
  capacity: ArgumentRoomCapacity,
  reason: ArgumentRoomCreationRejectReason,
): ArgumentRoomCreationDerived {
  return Object.freeze({
    visibility,
    capacity,
    directInviteCount: 0,
    reservedInviteSeats: 0,
    openSlots: 0,
    valid: false,
    reason,
    normalisedDirectInviteEmail: null,
    maskedDirectInviteEmail: null,
  });
}

/** Build a frozen valid result. Enforces `reservedInviteSeats === count`. */
function accept(args: {
  visibility: ArgumentRoomVisibility;
  capacity: ArgumentRoomCapacity;
  directInviteCount: 0 | 1;
  normalisedDirectInviteEmail: string | null;
}): ArgumentRoomCreationDerived {
  const reserved: 0 | 1 = args.directInviteCount;
  return Object.freeze({
    visibility: args.visibility,
    capacity: args.capacity,
    directInviteCount: args.directInviteCount,
    reservedInviteSeats: reserved,
    openSlots: deriveOpenSlots(args.capacity, reserved),
    valid: true,
    normalisedDirectInviteEmail: args.normalisedDirectInviteEmail,
    maskedDirectInviteEmail:
      args.normalisedDirectInviteEmail === null
        ? null
        : maskInviteeEmail(args.normalisedDirectInviteEmail),
  });
}

// ── deriveArgumentRoomCreation — the single decision function ────

/**
 * The creation-matrix validator. Pure + deterministic — calling it twice on the
 * same input yields a deeply-equal, frozen result, and the input is never
 * mutated. Runs a fixed-order decision (stable reasons, like
 * `explainQualifyingResponse`):
 *
 *  1. Normalise visibility (anything but `'private'` → `'public'`); capacity
 *     follows from visibility alone (public → 5, private → 2).
 *  2. Raw array longer than one → `too_many_direct_invites` (max one invite).
 *  3. No non-empty token → empty: private → `private_requires_invite`;
 *     public → valid (0 reserved, 4 open).
 *  4. A single field that splits into multiple addresses →
 *     `too_many_direct_invites` (checked before per-email shape).
 *  5. Per-email shape via the shipped `validateInviteEmailInput` /
 *     `normaliseInviteeEmail` → `invalid_email` on failure.
 *  6. Self-invite (only when `creatorEmail` supplied) → `self_invite`.
 *  7. Otherwise valid: 1 invite, 1 reserved seat, open = capacity − 2.
 */
export function deriveArgumentRoomCreation(
  intent: ArgumentRoomCreationIntent,
  opts?: DeriveArgumentRoomCreationOptions,
): ArgumentRoomCreationDerived {
  // 1. Visibility + capacity (mirrors debatesApi.ts visibility normalisation).
  const visibility: ArgumentRoomVisibility =
    intent.visibility === 'private' ? 'private' : 'public';
  const capacity: ArgumentRoomCapacity =
    visibility === 'public'
      ? PUBLIC_ACTIVE_PARTICIPANT_CAP
      : PRIVATE_ACTIVE_PARTICIPANT_CAP;

  const rawEmails: ReadonlyArray<string> = Array.isArray(
    intent.directInviteEmails,
  )
    ? intent.directInviteEmails
    : [];

  // 2. (ratified) Max one direct invite — a raw array longer than one is
  //    structurally too many, regardless of element contents.
  if (rawEmails.length > MAX_DIRECT_INVITES_AT_CREATION) {
    return reject(visibility, capacity, 'too_many_direct_invites');
  }

  // Flatten + split (before per-email shape) so a multi-address paste yields a
  // specific too-many, not a generic invalid-email.
  const tokens = collectInviteTokens(rawEmails);

  // 3. No direct invite supplied (empty array, or a blank/separators-only field).
  if (tokens.length === 0) {
    if (visibility === 'private') {
      // A private room is 1v1 — it requires its one invite at creation.
      return reject(visibility, capacity, 'private_requires_invite');
    }
    // Public with no invite is valid: 0 reserved, 4 open.
    return accept({
      visibility,
      capacity,
      directInviteCount: 0,
      normalisedDirectInviteEmail: null,
    });
  }

  // 4. A single field that splits into multiple addresses → too many.
  if (tokens.length > 1) {
    return reject(visibility, capacity, 'too_many_direct_invites');
  }

  const token = tokens[0];
  // Unreachable given the length checks above; narrows the type for the checker.
  if (typeof token !== 'string' || token.length === 0) {
    return reject(visibility, capacity, 'invalid_email');
  }

  // 5. Email shape — reuse the shipped local validator (no new regex).
  if (validateInviteEmailInput(token) !== null) {
    return reject(visibility, capacity, 'invalid_email');
  }
  const normalised = normaliseInviteeEmail(token);
  if (normalised === null) {
    // Belt-and-braces: the shape validator passed but the storage normaliser
    // disagrees — treat as invalid rather than emit a bad storage form.
    return reject(visibility, capacity, 'invalid_email');
  }

  // 6. Self-invite — best-effort in the pure layer; only when a creator email
  //    is supplied. Compared on the normalised (case/whitespace-insensitive)
  //    form. The Edge guard stays authoritative when creatorEmail is absent.
  const creatorEmail = opts?.creatorEmail;
  if (typeof creatorEmail === 'string') {
    const normalisedCreator = normaliseInviteeEmail(creatorEmail);
    if (normalisedCreator !== null && normalisedCreator === normalised) {
      return reject(visibility, capacity, 'self_invite');
    }
  }

  // 7. Valid with one reserved invite seat.
  return accept({
    visibility,
    capacity,
    directInviteCount: 1,
    normalisedDirectInviteEmail: normalised,
  });
}

// ── Capacity helpers ────────────────────────────────────────────

/**
 * Does an active-participant count plus reserved invite seats fit within the
 * PUBLIC cap? `active + reserved <= PUBLIC_ACTIVE_PARTICIPANT_CAP` (5).
 */
export function fitsPublicCapacity(
  activeParticipants: number,
  reservedInviteSeats: number,
): boolean {
  return activeParticipants + reservedInviteSeats <= PUBLIC_ACTIVE_PARTICIPANT_CAP;
}

/**
 * Does an active-participant count plus reserved invite seats fit within the
 * PRIVATE cap? `active + reserved <= PRIVATE_ACTIVE_PARTICIPANT_CAP` (2).
 */
export function fitsPrivateCapacity(
  activeParticipants: number,
  reservedInviteSeats: number,
): boolean {
  return activeParticipants + reservedInviteSeats <= PRIVATE_ACTIVE_PARTICIPANT_CAP;
}

// ── Plain-language copy ─────────────────────────────────────────

/**
 * The two genuinely new neutral copy strings this card authors (frozen,
 * scanned by the ban-list test). The other reasons reuse the shipped invite
 * copy. All person-neutral, verdict-free, plain language (doctrine §1, §9).
 */
export const ARGUMENT_ROOM_CREATION_COPY = Object.freeze({
  private_requires_invite:
    'A private argument needs one invite so someone can join you.',
  too_many_direct_invites:
    'Add just one email — you can invite one person as you start.',
});

/**
 * Map a creation reject reason to neutral plain language. Reuses the shipped
 * `plainLanguageForInviteError` for the two overlapping reasons (`self_invite`
 * → `cannot_invite_self`, `invalid_email`) and its generic fallback for an
 * unknown / undefined reason — the raw reason code is NEVER echoed (doctrine
 * §9, mirroring the invite layer).
 */
export function plainLanguageForCreationReason(
  reason: ArgumentRoomCreationRejectReason | null | undefined,
): string {
  switch (reason) {
    case 'private_requires_invite':
      return ARGUMENT_ROOM_CREATION_COPY.private_requires_invite;
    case 'too_many_direct_invites':
      return ARGUMENT_ROOM_CREATION_COPY.too_many_direct_invites;
    case 'self_invite':
      return plainLanguageForInviteError('cannot_invite_self');
    case 'invalid_email':
      return plainLanguageForInviteError('invalid_email');
    default:
      // Unknown / undefined → shipped generic fallback (never echo a raw code).
      return plainLanguageForInviteError(null);
  }
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/argumentRoomCreationMatrix.test.ts`.
 * NOT a content filter. Mirrors the sibling pure-model ban lists
 * (`_forbiddenChimeInGovernanceTokens` etc.): every string this module can emit
 * describes the ROOM's structure, never a verdict, never a person. Includes the
 * QOL-038 `BANNED_INVITE_FRAMING` person tokens (`challenger` / `opponent`).
 */
export function _forbiddenArgumentRoomCreationTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'truth',
    'true',
    'false',
    'right',
    'wrong',
    'won',
    'lost',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    // Amplification tokens
    'popular',
    'trending',
    'viral',
    // Person-attribution tokens
    'troll',
    'bot',
    // QOL-038 banned invite framing
    'challenger',
    'opponent',
  ];
}
