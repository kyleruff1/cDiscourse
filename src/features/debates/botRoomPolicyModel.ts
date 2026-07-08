/**
 * GAME-008 — Bot public-room policy + public argument seeding.
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI. JSON-serializable
 * inputs and outputs so the same model could run in an Edge Function later if a
 * follow-up persistence card needs it server-side.
 *
 * This model is the PRODUCT-LEVEL POLICY for bots in public argument rooms. It
 * is NOT the bot-fixture runner internals (those stay operator-gated under
 * `scripts/bot-fixtures/`). It defines: what a bot may and may not do
 * (`BOT_ROOM_POLICY`), a pure predicate for "is this a bot-seeded room?"
 * (`isBotSeededRoom`), a policy ENFORCEMENT GATE (`assertBotRoomEligibility`),
 * and the read-time bot-marking view contract (`buildBotMarkingViewModel`).
 *
 * Doctrine anchor — read this before changing anything in this file:
 *
 *   - A bot marker describes the ACCOUNT TYPE ("Test bot"), never a verdict.
 *     A bot never decides who is right. `BOT_ROOM_POLICY` carries no score, no
 *     band, no heat, no person-attribution field — only behavioural
 *     constraints.
 *   - Bots are public-room only. A bot never creates / joins a private 1v1 room
 *     with a real user, and a bot is never the Primary Opponent of a real user
 *     in a way that misrepresents it as human.
 *   - `assertBotRoomEligibility` is a GATE (a predicate the UI may consult),
 *     never a TRIGGER. This module exports NO posting / scheduling / harvest
 *     function — live bot posting stays operator-gated. The §10 API-surface
 *     test asserts this by omission.
 *   - The model never queries the database. There is no `is_bot` column on
 *     `public.profiles`; the schema-of-record for bot identity
 *     (`auth.users.user_metadata`, `public.bot_user_registry`) is admin /
 *     service-role only. GAME-008 consumes already-derived per-user `isBot`
 *     hints (the GAME-004 `RoomArgumentInput.isBot` seam, lifted to a per-user
 *     `BotParticipantHint`). Absent hint => fail-safe-human.
 *   - This file imports nothing from any score / standing / heat /
 *     anti-amplification module. A bot's presence is orthogonal to standing.
 */

import type { RoomType, RoomArgumentInput } from './roomContractModel';
import { BOT_MARKER_COPY } from '../arguments/gameCopy';

// Re-export the GAME-004 / GAME-005 types this model consumes so callers can
// import the bot-policy surface from one place without re-importing the
// upstream models. GAME-008 does not redefine these — they belong to GAME-004.
export type { RoomType } from './roomContractModel';

// ── §1.1 BotRoomPolicy — the frozen app-wide policy constant ─────

/**
 * GAME-008 — the product-level bot-room policy. A single immutable,
 * app-wide constant. Bots are a dev/test concept; this object states what
 * a bot may and may not do at the product level. It is NOT per-room and
 * NOT persisted — it is a frozen declaration the whole app reads.
 */
export interface BotRoomPolicy {
  /** Bots may CREATE / seed public rooms only — never a private 1v1. */
  readonly botsMayCreate: 'public_only';
  /** A bot participant must always be clearly + individually marked. */
  readonly botMarkingRequired: true;
  /**
   * A bot is NEVER the Primary Opponent of a REAL user. (A bot may face a
   * bot; a bot may seed a public room's Initiator seat. It must never sit
   * in seat 2 against a human in a way that misrepresents it as human.)
   */
  readonly botMayBePrimaryOpponentOfRealUser: false;
  /**
   * A bot NEVER joins a private 1v1 room that has a real-user party.
   * (Restates the private-room boundary as an explicit policy field so a
   * test can assert it directly.)
   */
  readonly botMayJoinPrivateRoomWithRealUser: false;
  /**
   * Bots yield active public seats to real users — a bot never displaces
   * or out-ranks a real claimant. (OD-1 confirms the user-facing framing;
   * the mechanism is already structural via GAME-005 — see design §3.)
   */
  readonly botsYieldSeatsToRealUsers: true;
}

/** The single, frozen, app-wide bot-room policy. */
export const BOT_ROOM_POLICY: BotRoomPolicy = Object.freeze({
  botsMayCreate: 'public_only',
  botMarkingRequired: true,
  botMayBePrimaryOpponentOfRealUser: false,
  botMayJoinPrivateRoomWithRealUser: false,
  botsYieldSeatsToRealUsers: true,
});

// ── §1.2 Input types — what the model reads ─────────────────────

/**
 * GAME-008 — a per-user "is this account a bot" hint. The model is given
 * a SET of these (one per relevant userId). The model does NOT derive the
 * hint — see design §1.3 for the no-migration v1 sources.
 */
export interface BotParticipantHint {
  userId: string;
  /** True when this account is a dev/test bot. */
  isBot: boolean;
  /**
   * Optional neutral persona label for the in-room marker, e.g.
   * "Provocateur bot" / "Source-trail bot". Never a real person name,
   * never a verdict word. Routed through copy; falls back to the generic
   * "test bot" label when absent. From bot_user_registry.persona when an
   * admin surface supplies it; otherwise undefined.
   */
  personaLabel?: string | null;
}

/**
 * GAME-008 — the read-time inputs for the room-level predicates + the
 * marking view-model. All fields are data the room already loads.
 */
export interface BotRoomInputs {
  roomId: string;
  /** GAME-004 room type. v1 default 'public' (ROOM_TYPE_DEFAULT). */
  roomType: RoomType;
  /** The room's posted arguments — GAME-004's narrowed shape, reused. */
  arguments: ReadonlyArray<RoomArgumentInput>;
  /**
   * Per-user bot hints for every author / participant in the room. A
   * missing userId is treated as NOT a bot (fail-safe-human default).
   */
  botHintsByUserId: ReadonlyArray<BotParticipantHint>;
}

// ── §1.4 BotMarkingViewModel — the bot-marking view contract ─────

/**
 * GAME-008 — the read-time bot marking for ONE participant. Pure data,
 * no JSX. Consumed by the in-room participant marker.
 */
export interface BotParticipantMarking {
  userId: string;
  /** True when this participant must show a bot marker. */
  isBot: boolean;
  /**
   * Plain-language marker label — neutral, never alarming, never a
   * verdict. e.g. "Test bot" or a persona-specific "Provocateur · test
   * bot". Routed through BOT_MARKER_COPY. Empty string when !isBot.
   */
  markerLabel: string;
  /** Verbose screen-reader label for the marker. */
  accessibilityLabel: string;
}

/**
 * GAME-008 — the read-time bot marking for a ROOM (gallery card +
 * in-room header). Pure data, no JSX.
 */
export interface BotMarkingViewModel {
  roomId: string;
  /** True when the room's opening (root) argument author is a bot. */
  isBotSeededRoom: boolean;
  /** True when ANY participant in the room is a bot (mixed or pure). */
  hasBotParticipant: boolean;
  /**
   * Room-level marker for the gallery card + in-room header. Non-alarming
   * "test room" copy. Empty string when the room has no bot at all.
   */
  roomMarkerLabel: string;
  /** Verbose screen-reader label for the room-level marker. */
  roomAccessibilityLabel: string;
  /**
   * Per-participant markings, one entry per known participant. Entries
   * with isBot === false carry an empty markerLabel — the UI renders a
   * marker only for isBot === true.
   */
  participantMarkings: ReadonlyArray<BotParticipantMarking>;
}

// ── §2.4 Policy enforcement — types ─────────────────────────────

/** A proposed bot action the policy must vet, before it could ever happen. */
export type BotRoomAction =
  | 'create_room' //        a bot opening a new room
  | 'join_as_primary' //    a bot taking the Primary Opponent seat (seat 2)
  | 'join_as_chime_in' //   a bot taking a chime-in seat (3..6)
  | 'join_as_observer'; //  a bot observing

export type BotPolicyDenyReason =
  | 'bots_create_public_only' //          bot tried to create a non-public room
  | 'bot_primary_against_real_user' //    bot tried seat 2 vs a real-user room
  | 'bot_in_private_room_with_real_user' // bot tried any seat in a private 1v1 with a real party
  | 'bot_chime_in_not_permitted'; //      bots do not claim chime-in seats (GAME-005 inherited)

/** Frozen list of every deny reason — tests + copy coverage iterate this. */
export const ALL_BOT_POLICY_DENY_REASONS: ReadonlyArray<BotPolicyDenyReason> =
  Object.freeze([
    'bots_create_public_only',
    'bot_primary_against_real_user',
    'bot_in_private_room_with_real_user',
    'bot_chime_in_not_permitted',
  ]);

export interface BotRoomEligibilityResult {
  allowed: boolean;
  /** null when allowed; the first failing reason otherwise. */
  reason: BotPolicyDenyReason | null;
}

export interface AssertBotRoomEligibilityInput {
  /** The action a bot account is proposing. */
  action: BotRoomAction;
  /** The room's GAME-004 type. */
  roomType: RoomType;
  /**
   * Whether the room currently has at least one REAL-user party (a
   * non-bot Initiator or non-bot Primary Opponent). Caller derives this
   * from the GAME-004 RoomContract + the bot hints.
   */
  roomHasRealUserParty: boolean;
}

// ── Internal helpers ────────────────────────────────────────────

/**
 * Chronologically sorted copy of the posted arguments. Sorts by `createdAt`
 * ascending, tie-broken by `id` ascending — identical determinism to
 * GAME-004 / GAME-005. Does NOT mutate the input array.
 */
function sortedChronologically(
  argumentsList: ReadonlyArray<RoomArgumentInput>,
): RoomArgumentInput[] {
  return argumentsList.slice().sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

/** The earliest posted root argument, or null when there is none. */
function resolveRootArgument(
  argumentsList: ReadonlyArray<RoomArgumentInput>,
): RoomArgumentInput | null {
  const roots = sortedChronologically(
    // ADMIN-ARGS-INACTIVE-001 — exclude inactive rows from root resolution.
    // Absence of the field is treated as active.
    argumentsList.filter(
      (a) => a.parentId === null && a.status === 'posted' && (a.inactiveAt ?? null) === null,
    ),
  );
  return roots.length > 0 ? roots[0] : null;
}

/**
 * Resolve the `BotParticipantHint` for a userId. Absent hint => a
 * fail-safe-human default (`isBot: false`). The consequences of a wrong
 * guess are asymmetric (design §1.3): wrongly marking a human as a bot is a
 * serious misrepresentation; wrongly omitting a bot marker only degrades a
 * test surface. So absent => human.
 */
function resolveHint(
  userId: string | null,
  hints: ReadonlyArray<BotParticipantHint>,
): BotParticipantHint {
  if (userId === null) {
    return { userId: '', isBot: false };
  }
  const found = hints.find((h) => h.userId === userId);
  if (found !== undefined) return found;
  return { userId, isBot: false };
}

/**
 * Defensive persona-label sanitiser. `bot_user_registry.persona` is
 * admin-authored free text — if a persona string ever carried a verdict /
 * alarming / person-attribution token it must NOT reach the marker. Returns
 * the trimmed persona when it is safe and non-empty, otherwise null (the
 * marker builder falls back to the generic "Test bot"). See design §6.15.
 */
function safePersonaLabel(personaLabel: string | null | undefined): string | null {
  if (typeof personaLabel !== 'string') return null;
  const trimmed = personaLabel.trim();
  if (trimmed.length === 0) return null;
  const lower = trimmed.toLowerCase();
  for (const token of _forbiddenBotMarkerTokens()) {
    if (lower.includes(token)) return null;
  }
  return trimmed;
}

// ── §2.1 isBotSeededRoom — the card's named predicate ───────────

/**
 * GAME-008 — true when the room's opening (root) argument was authored by
 * a test bot. Deterministic, pure. "Bot-seeded" is defined by the ROOT
 * author specifically — a public room a bot started — not merely by a bot
 * being present (use `BotMarkingViewModel.hasBotParticipant` for that).
 *
 * Steps:
 *  1. Find the root argument: parentId === null && status === 'posted',
 *     earliest by createdAt (defensive, mirrors GAME-004 buildRoomContract).
 *  2. If no root => false (an unopened room is not "bot-seeded").
 *  3. Look up the root author's BotParticipantHint. Absent hint => false
 *     (fail-safe-human, design §1.3).
 *  4. Return that hint's isBot.
 */
export function isBotSeededRoom(inputs: BotRoomInputs): boolean {
  const root = resolveRootArgument(inputs.arguments);
  if (root === null) return false;
  return resolveHint(root.authorId, inputs.botHintsByUserId).isBot;
}

// ── §2.2 looksLikeBotSeedTag — no-migration hint helper ─────────

/**
 * GAME-008 — deterministic recognition of a corpus-runner bot-seed title
 * tag, e.g. "...[xai-adv 9018694f]" / "...[ai-corpus ...]" / "...[stress
 * ...]". REUSES the SUFFIX_TAG_PATTERNS family the gallery model already
 * ships (`cleanTitleForDedupe`). Pure string predicate — no I/O. This is
 * one of the two no-migration sources a caller may use to build a
 * `BotParticipantHint` (design §1.3). The model itself does not call this —
 * it is exported so a loader can build hints without a query.
 *
 * Kept in lockstep with `conversationGalleryModel.SUFFIX_TAG_PATTERNS`; the
 * shared test fixture in `__tests__/botRoomPolicyModel.test.ts` asserts both
 * agree.
 */
// HOME-001 (#874): patterns 1 and 2 gained a `reseed` alternative in lockstep
// with conversationGalleryModel.SUFFIX_TAG_PATTERNS so the reseeder title tag
// `[reseed-<pack>-<yyyymmdd>-<hash8>]` is recognised as a bot-seed tag. The
// `\b`-anchored `seed-` alternative did not catch `reseed` (no word boundary
// before the inner `seed`), so a distinct alternative was required. The shared
// parity fixture in __tests__/botRoomPolicyModel.test.ts asserts both families
// agree on the reseed family.
const BOT_SEED_TAG_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /\s*\[(?:xai-adv|ai-corpus|stress|reseed|stage-\d+(?:\.\d+)*|run-\d+|scenario-\d+|seed-\d+)\b[^\]]*\]\s*$/i,
  /\s*\[(?:xai|ai|bot|corpus|stress|scenario|seed|reseed)[\w\d\s\-_:.,#]*\]\s*$/i,
  /\s*\([\w\d\s\-_:.,#]*?(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d\s\-_:.,#]*?\)\s*$/i,
  /\s*#(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d_-]+\s*$/i,
]);

export function looksLikeBotSeedTag(title: string | null | undefined): boolean {
  if (typeof title !== 'string' || title.trim().length === 0) return false;
  return BOT_SEED_TAG_PATTERNS.some((re) => re.test(title));
}

// ── §2.3 buildBotMarkingViewModel ───────────────────────────────

/**
 * Build the marker label + a11y label for one participant hint.
 * Non-bot => empty markerLabel.
 */
function buildParticipantMarking(
  hint: BotParticipantHint,
): BotParticipantMarking {
  if (!hint.isBot) {
    return {
      userId: hint.userId,
      isBot: false,
      markerLabel: '',
      accessibilityLabel: '',
    };
  }
  const persona = safePersonaLabel(hint.personaLabel);
  const markerLabel =
    persona === null
      ? BOT_MARKER_COPY.participant_marker
      : BOT_MARKER_COPY.participant_marker_persona.replace('{persona}', persona);
  return {
    userId: hint.userId,
    isBot: true,
    markerLabel,
    accessibilityLabel: BOT_MARKER_COPY.participant_a11y,
  };
}

/**
 * GAME-008 — build the read-time bot-marking projection for a room.
 * Pure, deterministic — same input twice yields a deeply-equal frozen
 * result. Steps:
 *  1. isBotSeededRoom = isBotSeededRoom(inputs).
 *  2. Collect distinct author + participant userIds; for each, resolve
 *     the BotParticipantHint (absent => isBot:false).
 *  3. hasBotParticipant = any hint isBot === true.
 *  4. roomMarkerLabel: room_marker_seeded when isBotSeededRoom; else
 *     room_marker when hasBotParticipant; else '' (no marker).
 *  5. participantMarkings: one BotParticipantMarking per known userId;
 *     markerLabel from BOT_MARKER_COPY (persona variant when personaLabel
 *     present); '' for non-bots.
 *  6. All a11y labels from BOT_MARKER_COPY.
 */
export function buildBotMarkingViewModel(
  inputs: BotRoomInputs,
): BotMarkingViewModel {
  const seeded = isBotSeededRoom(inputs);

  // Collect the distinct relevant userIds, in a deterministic order: every
  // posted-argument author first (chronological), then any hint-only user
  // not already seen. This keeps the output stable across renders.
  const orderedUserIds: string[] = [];
  const seen = new Set<string>();
  for (const argument of sortedChronologically(inputs.arguments)) {
    const authorId = argument.authorId;
    if (authorId === null || seen.has(authorId)) continue;
    seen.add(authorId);
    orderedUserIds.push(authorId);
  }
  for (const hint of inputs.botHintsByUserId) {
    if (seen.has(hint.userId)) continue;
    seen.add(hint.userId);
    orderedUserIds.push(hint.userId);
  }

  const participantMarkings: BotParticipantMarking[] = orderedUserIds.map(
    (userId) =>
      Object.freeze(
        buildParticipantMarking(resolveHint(userId, inputs.botHintsByUserId)),
      ),
  );

  const hasBotParticipant = participantMarkings.some((m) => m.isBot);

  let roomMarkerLabel = '';
  let roomAccessibilityLabel = '';
  if (seeded) {
    roomMarkerLabel = BOT_MARKER_COPY.room_marker_seeded;
    roomAccessibilityLabel = BOT_MARKER_COPY.room_a11y_seeded;
  } else if (hasBotParticipant) {
    roomMarkerLabel = BOT_MARKER_COPY.room_marker;
    roomAccessibilityLabel = BOT_MARKER_COPY.room_a11y_has_bot;
  }

  return Object.freeze({
    roomId: inputs.roomId,
    isBotSeededRoom: seeded,
    hasBotParticipant,
    roomMarkerLabel,
    roomAccessibilityLabel,
    participantMarkings: Object.freeze(participantMarkings),
  });
}

// ── §2.4 assertBotRoomEligibility — the policy enforcement gate ──

/**
 * GAME-008 — pure policy predicate. Given a proposed bot action, returns
 * whether the BOT_ROOM_POLICY permits it. Deterministic, no I/O.
 *
 * Rules (checked in order):
 *  - 'create_room' allowed ONLY when roomType === 'public'
 *    (bots_create_public_only otherwise).
 *  - ANY action in a 'private' room that has a real-user party is denied
 *    (bot_in_private_room_with_real_user) — bots never join a private 1v1
 *    with a real user.
 *  - 'join_as_primary' (seat 2) denied when roomHasRealUserParty is true
 *    (bot_primary_against_real_user) — a bot is never the Primary Opponent
 *    of a real user. (A bot-vs-bot public room is allowed.)
 *  - 'join_as_chime_in' is always denied (bot_chime_in_not_permitted) —
 *    GAME-005 already excludes bots from chime-in seats; GAME-008 states
 *    it as policy so a test can assert it.
 *  - 'join_as_observer' is always allowed (a bot observing harms nobody).
 *
 * NOTE: this predicate is a POLICY GATE. v1 has no live-bot-posting code
 * path that calls it at write time (live posting stays operator-gated in
 * scripts/bot-fixtures/). It exists so the policy is encoded + testable
 * NOW, and so any future write path (a follow-up card) has one
 * authoritative gate to call. GAME-008 ships the gate; it does NOT ship a
 * caller that triggers bot posting.
 */
export function assertBotRoomEligibility(
  input: AssertBotRoomEligibilityInput,
): BotRoomEligibilityResult {
  // 1. A bot may only CREATE a public room.
  if (input.action === 'create_room' && input.roomType !== 'public') {
    return { allowed: false, reason: 'bots_create_public_only' };
  }

  // 2. A bot never takes ANY seat in a private 1v1 that has a real-user
  //    party. The private-room boundary is absolute.
  if (input.roomType === 'private' && input.roomHasRealUserParty) {
    return { allowed: false, reason: 'bot_in_private_room_with_real_user' };
  }

  // 3. A bot is never the Primary Opponent of a real user. (A bot-vs-bot
  //    public room — roomHasRealUserParty false — is allowed.)
  if (input.action === 'join_as_primary' && input.roomHasRealUserParty) {
    return { allowed: false, reason: 'bot_primary_against_real_user' };
  }

  // 4. Bots never claim a chime-in seat — restates the GAME-005 exclusion
  //    as explicit GAME-008 policy.
  if (input.action === 'join_as_chime_in') {
    return { allowed: false, reason: 'bot_chime_in_not_permitted' };
  }

  // 5. Everything else (create public room, join_as_primary in a bot-vs-bot
  //    room, join_as_observer) is allowed.
  return { allowed: true, reason: null };
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/botRoomPolicyDoctrine.test.ts`.
 * NOT a content filter. Mirrors `_forbiddenChimeInGovernanceTokens` so
 * GAME-008 copy is held to the same bar: verdict tokens, amplification
 * tokens, alarming tokens, person-attribution / punitive tokens. A bot
 * marker describes an ACCOUNT TYPE; it is never a verdict, never alarming,
 * never a deceptive "this is a human" framing.
 */
export function _forbiddenBotMarkerTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'right',
    'wrong',
    'won',
    'lost',
    'defeated',
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
    'upvote',
    'downvote',
    // Alarming tokens — a test-bot marker is calm, never alarming
    'fake',
    'spam',
    'malicious',
    'danger',
    'warning',
    'troll',
    // Punitive / removal tokens
    'booted',
    'kicked',
    'banned',
  ];
}
