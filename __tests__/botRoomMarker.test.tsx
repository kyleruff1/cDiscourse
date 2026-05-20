/**
 * GAME-008 — BotRoomMarker component contract.
 *
 * The repo's test discipline avoids runtime react-test-renderer. So the
 * marker's load-bearing render decisions are exercised through (a) the pure
 * `BotMarkingViewModel` that fully drives what it renders and (b) a
 * source-scan of the component.
 *
 * Asserts:
 *  - renders "Bot-seeded test room" for an isBotSeededRoom:true view-model
 *    (gallery + room context).
 *  - renders "Test room" for hasBotParticipant:true && isBotSeededRoom:false.
 *  - renders nothing for a view-model with no bot at all.
 *  - every visible string is inside a <Text>; the marker root exposes an
 *    accessibilityLabel; the marker is non-interactive (no Pressable).
 *  - context 'gallery' vs 'room' does not change the copy.
 */
import fs from 'fs';
import path from 'path';
import { BotRoomMarker } from '../src/features/debates/BotRoomMarker';
import {
  buildBotMarkingViewModel,
  type BotRoomInputs,
  type BotMarkingViewModel,
} from '../src/features/debates/botRoomPolicyModel';
import type { RoomArgumentInput } from '../src/features/debates/roomContractModel';

const REPO = process.cwd();
const MARKER_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/BotRoomMarker.tsx'),
  'utf8',
);

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

const seededVm: BotMarkingViewModel = buildBotMarkingViewModel(
  inputs({
    arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
    botHintsByUserId: [{ userId: 'bot-1', isBot: true }],
  }),
);

const hasBotVm: BotMarkingViewModel = buildBotMarkingViewModel(
  inputs({
    arguments: [
      arg({ id: 'root', parentId: null, authorId: 'human-1' }),
      arg({ id: 'r1', parentId: 'root', authorId: 'bot-1', argumentType: 'rebuttal' }),
    ],
    botHintsByUserId: [
      { userId: 'human-1', isBot: false },
      { userId: 'bot-1', isBot: true },
    ],
  }),
);

const noBotVm: BotMarkingViewModel = buildBotMarkingViewModel(
  inputs({
    arguments: [arg({ id: 'root', parentId: null, authorId: 'human-1' })],
    botHintsByUserId: [{ userId: 'human-1', isBot: false }],
  }),
);

// ── The view-model the component renders ────────────────────────

describe('BotRoomMarker — render contract via the view-model', () => {
  it('a bot-seeded view-model carries the "Bot-seeded test room" label', () => {
    expect(seededVm.isBotSeededRoom).toBe(true);
    expect(seededVm.roomMarkerLabel).toBe('Bot-seeded test room');
  });

  it('a has-bot but not-seeded view-model carries the "Test room" label', () => {
    expect(hasBotVm.isBotSeededRoom).toBe(false);
    expect(hasBotVm.hasBotParticipant).toBe(true);
    expect(hasBotVm.roomMarkerLabel).toBe('Test room');
  });

  it('a no-bot view-model carries an empty room label', () => {
    expect(noBotVm.roomMarkerLabel).toBe('');
  });

  it('the component returns null for a no-bot view-model', () => {
    expect(BotRoomMarker({ viewModel: noBotVm, context: 'gallery' })).toBeNull();
    expect(BotRoomMarker({ viewModel: noBotVm, context: 'room' })).toBeNull();
  });

  it('the component returns an element for a bot-seeded view-model', () => {
    expect(BotRoomMarker({ viewModel: seededVm, context: 'gallery' })).not.toBeNull();
    expect(BotRoomMarker({ viewModel: seededVm, context: 'room' })).not.toBeNull();
  });

  it('the component returns an element for a has-bot view-model', () => {
    expect(BotRoomMarker({ viewModel: hasBotVm, context: 'gallery' })).not.toBeNull();
    expect(BotRoomMarker({ viewModel: hasBotVm, context: 'room' })).not.toBeNull();
  });

  it('context gallery vs room does not change the marker copy', () => {
    // The label comes from the view-model, which the context does not touch.
    expect(seededVm.roomMarkerLabel).toBe('Bot-seeded test room');
    expect(hasBotVm.roomMarkerLabel).toBe('Test room');
  });

  it('a bot view-model carries a verbose room accessibility label', () => {
    expect(seededVm.roomAccessibilityLabel.length).toBeGreaterThan(20);
    expect(hasBotVm.roomAccessibilityLabel.length).toBeGreaterThan(20);
  });
});

// ── Source-scan — RN primitives, Text wrapping, accessibility ───

describe('BotRoomMarker — source contract', () => {
  it('is exported as a named function component', () => {
    expect(typeof BotRoomMarker).toBe('function');
  });

  it('uses only View / Text RN primitives (no new dependency)', () => {
    expect(MARKER_SRC).toContain("from 'react-native'");
    expect(MARKER_SRC).toContain('View');
    expect(MARKER_SRC).toContain('Text');
  });

  it('is non-interactive — renders no Pressable / Touchable element', () => {
    expect(MARKER_SRC).not.toContain('<Pressable');
    expect(MARKER_SRC).not.toContain('<Touchable');
    expect(MARKER_SRC).not.toContain('onPress');
  });

  it('the marker root exposes an accessibilityLabel', () => {
    expect(MARKER_SRC).toContain('accessibilityLabel={viewModel.roomAccessibilityLabel}');
  });

  it('renders the room marker label inside a <Text>', () => {
    expect(MARKER_SRC).toContain('{viewModel.roomMarkerLabel}');
  });

  it('returns null for a no-bot view-model (renders nothing)', () => {
    expect(MARKER_SRC).toContain('viewModel.roomMarkerLabel.length === 0');
  });

  it('uses a shape glyph so the marker is legible without color', () => {
    expect(MARKER_SRC).toContain('markerGlyph');
    expect(MARKER_SRC).toContain("borderStyle: 'dashed'");
  });

  it('imports no router / navigation library (no route transition)', () => {
    expect(MARKER_SRC).not.toContain('navigation');
    expect(MARKER_SRC).not.toContain('expo-router');
    expect(MARKER_SRC).not.toContain('@react-navigation');
  });
});
