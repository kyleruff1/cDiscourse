/**
 * GAME-008 — botRoomPolicyModel pure-model tests.
 *
 * Covers the BOT_ROOM_POLICY constant, isBotSeededRoom, looksLikeBotSeedTag,
 * buildBotMarkingViewModel, assertBotRoomEligibility, determinism /
 * no-mutation, and the API-surface (no-posting-export) assertion.
 */
import {
  BOT_ROOM_POLICY,
  ALL_BOT_POLICY_DENY_REASONS,
  isBotSeededRoom,
  looksLikeBotSeedTag,
  buildBotMarkingViewModel,
  assertBotRoomEligibility,
  type BotRoomInputs,
  type BotParticipantHint,
} from '../src/features/debates/botRoomPolicyModel';
import type { RoomArgumentInput } from '../src/features/debates/roomContractModel';
import { cleanTitleForDedupe } from '../src/features/debates/conversationGalleryModel';
import * as botRoomPolicyModule from '../src/features/debates/botRoomPolicyModel';

// ── Fixtures ────────────────────────────────────────────────────

function arg(overrides: Partial<RoomArgumentInput>): RoomArgumentInput {
  return {
    id: 'a1',
    parentId: null,
    authorId: 'u1',
    argumentType: 'thesis',
    body: 'A reasonably long argument body for the room.',
    status: 'posted',
    createdAt: '2026-05-20T10:00:00.000Z',
    ...overrides,
  };
}

function inputs(overrides: Partial<BotRoomInputs>): BotRoomInputs {
  return {
    roomId: 'room-1',
    roomType: 'public',
    arguments: [],
    botHintsByUserId: [],
    ...overrides,
  };
}

// ── BOT_ROOM_POLICY ─────────────────────────────────────────────

describe('BOT_ROOM_POLICY', () => {
  it('has the card-named shape', () => {
    expect(BOT_ROOM_POLICY.botsMayCreate).toBe('public_only');
    expect(BOT_ROOM_POLICY.botMarkingRequired).toBe(true);
    expect(BOT_ROOM_POLICY.botMayBePrimaryOpponentOfRealUser).toBe(false);
    expect(BOT_ROOM_POLICY.botMayJoinPrivateRoomWithRealUser).toBe(false);
    expect(BOT_ROOM_POLICY.botsYieldSeatsToRealUsers).toBe(true);
  });

  it('is frozen — there is exactly one app-wide policy', () => {
    expect(Object.isFrozen(BOT_ROOM_POLICY)).toBe(true);
  });

  it('carries no score / band / heat / verdict / person field', () => {
    const keys = Object.keys(BOT_ROOM_POLICY);
    for (const k of keys) {
      expect(k.toLowerCase()).not.toMatch(/score|band|heat|verdict|winner|loser/);
    }
  });

  it('exposes all four deny reasons as a frozen list', () => {
    expect(Object.isFrozen(ALL_BOT_POLICY_DENY_REASONS)).toBe(true);
    expect(ALL_BOT_POLICY_DENY_REASONS).toEqual([
      'bots_create_public_only',
      'bot_primary_against_real_user',
      'bot_in_private_room_with_real_user',
      'bot_chime_in_not_permitted',
    ]);
  });
});

// ── isBotSeededRoom ─────────────────────────────────────────────

describe('isBotSeededRoom', () => {
  it('returns true when the root argument author is a bot', () => {
    const result = isBotSeededRoom(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
        botHintsByUserId: [{ userId: 'bot-1', isBot: true }],
      }),
    );
    expect(result).toBe(true);
  });

  it('returns false when the root argument author is a real user', () => {
    const result = isBotSeededRoom(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'human-1' })],
        botHintsByUserId: [{ userId: 'human-1', isBot: false }],
      }),
    );
    expect(result).toBe(false);
  });

  it('returns false for an empty room (no root)', () => {
    expect(isBotSeededRoom(inputs({ arguments: [] }))).toBe(false);
  });

  it('returns false when the root has no posted status', () => {
    const result = isBotSeededRoom(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1', status: 'draft' })],
        botHintsByUserId: [{ userId: 'bot-1', isBot: true }],
      }),
    );
    expect(result).toBe(false);
  });

  it('fails safe to human when the root author hint is absent', () => {
    const result = isBotSeededRoom(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'unknown-1' })],
        botHintsByUserId: [],
      }),
    );
    expect(result).toBe(false);
  });

  it('uses the earliest root when multiple roots exist', () => {
    const result = isBotSeededRoom(
      inputs({
        arguments: [
          arg({ id: 'late', parentId: null, authorId: 'bot-1', createdAt: '2026-05-20T12:00:00.000Z' }),
          arg({ id: 'early', parentId: null, authorId: 'human-1', createdAt: '2026-05-20T09:00:00.000Z' }),
        ],
        botHintsByUserId: [
          { userId: 'bot-1', isBot: true },
          { userId: 'human-1', isBot: false },
        ],
      }),
    );
    // earliest root = human-1 => not bot-seeded
    expect(result).toBe(false);
  });
});

// ── looksLikeBotSeedTag ─────────────────────────────────────────

describe('looksLikeBotSeedTag', () => {
  it('recognises a [xai-adv …] suffix tag', () => {
    expect(looksLikeBotSeedTag('Bike lanes are better [xai-adv 9018694f c45188c5]')).toBe(true);
  });

  it('recognises a [ai-corpus …] suffix tag', () => {
    expect(looksLikeBotSeedTag('Pitch clock changed pacing [ai-corpus fa172432 ai-seed]')).toBe(true);
  });

  it('recognises a [stress …] suffix tag', () => {
    expect(looksLikeBotSeedTag('Sports debate [stress-2026-05-17 #scenario-7]')).toBe(true);
  });

  it('returns false for an ordinary human title', () => {
    expect(looksLikeBotSeedTag('Should cities expand bike lanes?')).toBe(false);
  });

  it('returns false for null / empty / whitespace', () => {
    expect(looksLikeBotSeedTag(null)).toBe(false);
    expect(looksLikeBotSeedTag(undefined)).toBe(false);
    expect(looksLikeBotSeedTag('')).toBe(false);
    expect(looksLikeBotSeedTag('   ')).toBe(false);
  });

  it('agrees with the gallery model SUFFIX_TAG_PATTERNS family', () => {
    // When the gallery model strips a tag, looksLikeBotSeedTag must agree the
    // title carries one; when it does not strip, the helper must not.
    const taggedTitles = [
      'Bike lanes are better [xai-adv 9018694f]',
      'Pitch clock changed pacing [ai-corpus fa172432]',
      'Sports debate [stress-2026-05-17 #scenario-7]',
      'Topic [scenario-12 detail]',
      'Topic #ai-corpus-seed-9',
    ];
    for (const title of taggedTitles) {
      const stripped = cleanTitleForDedupe(title) !== title.trim();
      expect(looksLikeBotSeedTag(title)).toBe(stripped);
      expect(looksLikeBotSeedTag(title)).toBe(true);
    }
    const plainTitles = [
      'Should cities expand bike lanes?',
      'Is the pitch clock good for baseball?',
    ];
    for (const title of plainTitles) {
      expect(cleanTitleForDedupe(title)).toBe(title.trim());
      expect(looksLikeBotSeedTag(title)).toBe(false);
    }
  });
});

// ── buildBotMarkingViewModel ────────────────────────────────────

describe('buildBotMarkingViewModel', () => {
  it('marks a pure-bot room as bot-seeded with the seeded marker', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [
          arg({ id: 'root', parentId: null, authorId: 'bot-1' }),
          arg({ id: 'r1', parentId: 'root', authorId: 'bot-2', argumentType: 'rebuttal' }),
        ],
        botHintsByUserId: [
          { userId: 'bot-1', isBot: true },
          { userId: 'bot-2', isBot: true },
        ],
      }),
    );
    expect(vm.isBotSeededRoom).toBe(true);
    expect(vm.hasBotParticipant).toBe(true);
    expect(vm.roomMarkerLabel).toBe('Bot-seeded test room');
    expect(vm.participantMarkings).toHaveLength(2);
    expect(vm.participantMarkings.every((m) => m.isBot)).toBe(true);
  });

  it('marks a mixed room: every bot participant marked individually', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [
          arg({ id: 'root', parentId: null, authorId: 'human-1' }),
          arg({ id: 'r1', parentId: 'root', authorId: 'bot-1', argumentType: 'rebuttal' }),
          arg({ id: 'r2', parentId: 'root', authorId: 'bot-2', argumentType: 'rebuttal' }),
        ],
        botHintsByUserId: [
          { userId: 'human-1', isBot: false },
          { userId: 'bot-1', isBot: true },
          { userId: 'bot-2', isBot: true },
        ],
      }),
    );
    expect(vm.isBotSeededRoom).toBe(false);
    expect(vm.hasBotParticipant).toBe(true);
    expect(vm.roomMarkerLabel).toBe('Test room');
    const bots = vm.participantMarkings.filter((m) => m.isBot);
    const humans = vm.participantMarkings.filter((m) => !m.isBot);
    expect(bots).toHaveLength(2);
    expect(humans).toHaveLength(1);
    expect(bots.every((m) => m.markerLabel === 'Test bot')).toBe(true);
    expect(humans.every((m) => m.markerLabel === '')).toBe(true);
  });

  it('produces no room marker for a pure-human room', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'human-1' })],
        botHintsByUserId: [{ userId: 'human-1', isBot: false }],
      }),
    );
    expect(vm.isBotSeededRoom).toBe(false);
    expect(vm.hasBotParticipant).toBe(false);
    expect(vm.roomMarkerLabel).toBe('');
    expect(vm.roomAccessibilityLabel).toBe('');
  });

  it('uses the persona variant when a personaLabel is present', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
        botHintsByUserId: [
          { userId: 'bot-1', isBot: true, personaLabel: 'Provocateur' },
        ],
      }),
    );
    const marking = vm.participantMarkings.find((m) => m.userId === 'bot-1');
    expect(marking?.markerLabel).toBe('Provocateur · test bot');
  });

  it('falls back to the generic label when personaLabel is a banned token', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
        botHintsByUserId: [
          { userId: 'bot-1', isBot: true, personaLabel: 'troll bot' },
        ],
      }),
    );
    const marking = vm.participantMarkings.find((m) => m.userId === 'bot-1');
    expect(marking?.markerLabel).toBe('Test bot');
  });

  it('falls back to the generic label when personaLabel is empty / whitespace', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
        botHintsByUserId: [
          { userId: 'bot-1', isBot: true, personaLabel: '   ' },
        ],
      }),
    );
    const marking = vm.participantMarkings.find((m) => m.userId === 'bot-1');
    expect(marking?.markerLabel).toBe('Test bot');
  });

  it('reflects hasBotParticipant from hint-only users with no posted argument', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [],
        botHintsByUserId: [{ userId: 'bot-9', isBot: true }],
      }),
    );
    expect(vm.isBotSeededRoom).toBe(false);
    expect(vm.hasBotParticipant).toBe(true);
    expect(vm.roomMarkerLabel).toBe('Test room');
  });

  it('returns a frozen result', () => {
    const vm = buildBotMarkingViewModel(inputs({}));
    expect(Object.isFrozen(vm)).toBe(true);
    expect(Object.isFrozen(vm.participantMarkings)).toBe(true);
  });
});

// ── assertBotRoomEligibility ────────────────────────────────────

describe('assertBotRoomEligibility', () => {
  it('allows create_room in a public room', () => {
    expect(
      assertBotRoomEligibility({
        action: 'create_room',
        roomType: 'public',
        roomHasRealUserParty: false,
      }),
    ).toEqual({ allowed: true, reason: null });
  });

  it('denies create_room in a private room — bots_create_public_only', () => {
    expect(
      assertBotRoomEligibility({
        action: 'create_room',
        roomType: 'private',
        roomHasRealUserParty: false,
      }),
    ).toEqual({ allowed: false, reason: 'bots_create_public_only' });
  });

  it('denies join_as_primary against a real-user party — bot_primary_against_real_user', () => {
    expect(
      assertBotRoomEligibility({
        action: 'join_as_primary',
        roomType: 'public',
        roomHasRealUserParty: true,
      }),
    ).toEqual({ allowed: false, reason: 'bot_primary_against_real_user' });
  });

  it('allows join_as_primary in a bot-vs-bot public room', () => {
    expect(
      assertBotRoomEligibility({
        action: 'join_as_primary',
        roomType: 'public',
        roomHasRealUserParty: false,
      }),
    ).toEqual({ allowed: true, reason: null });
  });

  it('denies any SEAT action in a private room with a real party — bot_in_private_room_with_real_user', () => {
    // "Any seat" — the join actions. (create_room in a private room hits the
    // create-room rule first; covered separately below — design §2.4 order.)
    for (const action of ['join_as_primary', 'join_as_chime_in', 'join_as_observer'] as const) {
      expect(
        assertBotRoomEligibility({
          action,
          roomType: 'private',
          roomHasRealUserParty: true,
        }),
      ).toEqual({ allowed: false, reason: 'bot_in_private_room_with_real_user' });
    }
  });

  it('denies join_as_chime_in — bot_chime_in_not_permitted', () => {
    expect(
      assertBotRoomEligibility({
        action: 'join_as_chime_in',
        roomType: 'public',
        roomHasRealUserParty: false,
      }),
    ).toEqual({ allowed: false, reason: 'bot_chime_in_not_permitted' });
  });

  it('allows join_as_observer in a public room', () => {
    expect(
      assertBotRoomEligibility({
        action: 'join_as_observer',
        roomType: 'public',
        roomHasRealUserParty: true,
      }),
    ).toEqual({ allowed: true, reason: null });
  });

  it('create_room private outranks the create_room rule check order (private wins only with a real party)', () => {
    // private room, no real party, create_room => still bots_create_public_only
    expect(
      assertBotRoomEligibility({
        action: 'create_room',
        roomType: 'private',
        roomHasRealUserParty: false,
      }),
    ).toEqual({ allowed: false, reason: 'bots_create_public_only' });
  });
});

// ── Determinism / no-mutation ───────────────────────────────────

describe('determinism and no-mutation', () => {
  it('buildBotMarkingViewModel twice on the same input is deeply equal', () => {
    const i = inputs({
      arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
      botHintsByUserId: [{ userId: 'bot-1', isBot: true }],
    });
    expect(buildBotMarkingViewModel(i)).toEqual(buildBotMarkingViewModel(i));
  });

  it('does not mutate frozen input arrays', () => {
    const args: ReadonlyArray<RoomArgumentInput> = Object.freeze([
      arg({ id: 'root', parentId: null, authorId: 'bot-1' }),
    ]);
    const hints: ReadonlyArray<BotParticipantHint> = Object.freeze([
      { userId: 'bot-1', isBot: true },
    ]);
    const i = inputs({ arguments: args, botHintsByUserId: hints });
    expect(() => buildBotMarkingViewModel(i)).not.toThrow();
    expect(() => isBotSeededRoom(i)).not.toThrow();
  });
});

// ── API surface — no posting / scheduling / harvest export ──────

describe('API surface — live-posting non-enablement', () => {
  it('exports no posting / scheduling / harvest function', () => {
    const mod = botRoomPolicyModule as Record<string, unknown>;
    expect(typeof mod.enableBotPosting).toBe('undefined');
    expect(typeof mod.scheduleBotRun).toBe('undefined');
    expect(typeof mod.postBotMove).toBe('undefined');
    expect(typeof mod.harvestCorpus).toBe('undefined');
    expect(typeof mod.runBotCorpus).toBe('undefined');
    expect(typeof mod.triggerBotPosting).toBe('undefined');
  });

  it('every exported name is policy / marking only — no posting verb in any export name', () => {
    const forbidden = /post|schedule|harvest|run|trigger|enable|deploy|fetch|send/i;
    for (const name of Object.keys(botRoomPolicyModule)) {
      expect(name).not.toMatch(forbidden);
    }
  });
});
