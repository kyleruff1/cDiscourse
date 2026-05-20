/**
 * GAME-008 — BotParticipantMarker component contract.
 *
 * The repo's test discipline avoids runtime react-test-renderer (the pinned
 * renderer version is held away from @testing-library's peer). So the
 * marker's load-bearing render decisions are exercised through (a) the pure
 * `BotParticipantMarking` view-model that fully drives what it renders and
 * (b) a source-scan of the component.
 *
 * Asserts:
 *  - the marker renders the "Test bot" copy for an isBot:true marking.
 *  - the marker renders nothing for an isBot:false marking.
 *  - the persona variant copy is used when a personaLabel is present.
 *  - every visible string is inside a <Text>; the marker root exposes an
 *    accessibilityLabel; the marker is non-interactive (no Pressable).
 *  - the marker is identifiable by shape + text, not color alone.
 */
import fs from 'fs';
import path from 'path';
import { BotParticipantMarker } from '../src/features/debates/BotParticipantMarker';
import {
  buildBotMarkingViewModel,
  type BotRoomInputs,
  type BotParticipantMarking,
} from '../src/features/debates/botRoomPolicyModel';
import type { RoomArgumentInput } from '../src/features/debates/roomContractModel';

const REPO = process.cwd();
const MARKER_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/BotParticipantMarker.tsx'),
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

// ── The view-model the component renders ────────────────────────

describe('BotParticipantMarker — render contract via the view-model', () => {
  it('a bot marking carries the "Test bot" label the marker renders', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
        botHintsByUserId: [{ userId: 'bot-1', isBot: true }],
      }),
    );
    const marking = vm.participantMarkings.find((m) => m.userId === 'bot-1');
    expect(marking?.isBot).toBe(true);
    expect(marking?.markerLabel).toBe('Test bot');
  });

  it('a non-bot marking carries an empty label — the marker renders nothing', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'human-1' })],
        botHintsByUserId: [{ userId: 'human-1', isBot: false }],
      }),
    );
    const marking = vm.participantMarkings.find((m) => m.userId === 'human-1');
    expect(marking?.isBot).toBe(false);
    expect(marking?.markerLabel).toBe('');
  });

  it('the component returns null for an isBot:false marking', () => {
    const marking: BotParticipantMarking = {
      userId: 'human-1',
      isBot: false,
      markerLabel: '',
      accessibilityLabel: '',
    };
    expect(BotParticipantMarker({ marking })).toBeNull();
  });

  it('the component returns an element for an isBot:true marking', () => {
    const marking: BotParticipantMarking = {
      userId: 'bot-1',
      isBot: true,
      markerLabel: 'Test bot',
      accessibilityLabel: 'This participant is a test bot, not a person.',
    };
    expect(BotParticipantMarker({ marking })).not.toBeNull();
  });

  it('uses the persona variant label when a personaLabel is present', () => {
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

  it('a bot marking carries a verbose accessibility label', () => {
    const vm = buildBotMarkingViewModel(
      inputs({
        arguments: [arg({ id: 'root', parentId: null, authorId: 'bot-1' })],
        botHintsByUserId: [{ userId: 'bot-1', isBot: true }],
      }),
    );
    const marking = vm.participantMarkings.find((m) => m.userId === 'bot-1');
    expect(typeof marking?.accessibilityLabel).toBe('string');
    expect((marking?.accessibilityLabel ?? '').length).toBeGreaterThan(20);
    expect((marking?.accessibilityLabel ?? '').toLowerCase()).toContain('not a person');
  });
});

// ── Source-scan — RN primitives, Text wrapping, accessibility ───

describe('BotParticipantMarker — source contract', () => {
  it('is exported as a named function component', () => {
    expect(typeof BotParticipantMarker).toBe('function');
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
    expect(MARKER_SRC).toContain('accessibilityLabel={marking.accessibilityLabel}');
  });

  it('renders the marker label inside a <Text>', () => {
    expect(MARKER_SRC).toContain('{marking.markerLabel}');
  });

  it('returns null for a non-bot marking (renders nothing)', () => {
    expect(MARKER_SRC).toContain('if (!marking.isBot) return null');
  });

  it('uses a shape glyph so the marker is legible without color', () => {
    // A shape glyph + the literal word "Test bot" — grayscale-legible.
    expect(MARKER_SRC).toContain('markerGlyph');
    expect(MARKER_SRC).toContain("borderStyle: 'dashed'");
  });

  it('imports no router / navigation library (no route transition)', () => {
    expect(MARKER_SRC).not.toContain('navigation');
    expect(MARKER_SRC).not.toContain('expo-router');
    expect(MARKER_SRC).not.toContain('@react-navigation');
  });
});
