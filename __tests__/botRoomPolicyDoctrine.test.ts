/**
 * GAME-008 — doctrine + safety tests for the bot-room policy model.
 *
 *  - Ban-list: no verdict / amplification / alarming / punitive token
 *    reaches any BOT_MARKER_COPY string or any label / a11y string produced
 *    by buildBotMarkingViewModel across every permutation.
 *  - No deceptive framing: no marker string presents the bot as a person;
 *    the only permitted "person" use is the explicit negation "not a person".
 *  - Plain language: looksLikeInternalCode is false for every visible
 *    string; no snake_case enum-value (join_as_primary, etc.) leaks.
 *  - Forbidden imports: botRoomPolicyModel.ts imports nothing from React,
 *    Supabase, or any score / standing / heat / anti-amplification module.
 *  - No service-role / no Edge Function / no live posting in the model or
 *    the two components.
 */
import fs from 'fs';
import path from 'path';
import {
  buildBotMarkingViewModel,
  _forbiddenBotMarkerTokens,
  type BotRoomInputs,
} from '../src/features/debates/botRoomPolicyModel';
import type { RoomArgumentInput } from '../src/features/debates/roomContractModel';
import { BOT_MARKER_COPY, looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const REPO = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const MODEL_SRC = read('src/features/debates/botRoomPolicyModel.ts');
const PARTICIPANT_MARKER_SRC = read('src/features/debates/BotParticipantMarker.tsx');
const ROOM_MARKER_SRC = read('src/features/debates/BotRoomMarker.tsx');

/**
 * The `import` lines of a source file only. Forbidden-import assertions
 * scan THIS, not the whole file, so a doc-comment that mentions a banned
 * word (e.g. "no Supabase import") never false-matches.
 */
function importLines(src: string): string {
  return src
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line))
    .join('\n');
}

const MODEL_IMPORTS = importLines(MODEL_SRC);

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

/** Collect every user-facing string GAME-008 can produce. */
function collectBotMarkerStrings(): string[] {
  const strings: string[] = [...Object.values(BOT_MARKER_COPY)];

  // Pure-bot seeded room.
  const pureBot = buildBotMarkingViewModel(
    inputs({
      arguments: [
        arg({ id: 'root', parentId: null, authorId: 'bot-1' }),
        arg({ id: 'r1', parentId: 'root', authorId: 'bot-2', argumentType: 'rebuttal' }),
      ],
      botHintsByUserId: [
        { userId: 'bot-1', isBot: true },
        { userId: 'bot-2', isBot: true, personaLabel: 'Provocateur' },
      ],
    }),
  );
  // Mixed room.
  const mixed = buildBotMarkingViewModel(
    inputs({
      arguments: [
        arg({ id: 'root', parentId: null, authorId: 'human-1' }),
        arg({ id: 'r1', parentId: 'root', authorId: 'bot-1', argumentType: 'rebuttal' }),
      ],
      botHintsByUserId: [
        { userId: 'human-1', isBot: false },
        { userId: 'bot-1', isBot: true, personaLabel: 'Source-trail' },
      ],
    }),
  );
  // Pure-human room.
  const human = buildBotMarkingViewModel(
    inputs({
      arguments: [arg({ id: 'root', parentId: null, authorId: 'human-1' })],
      botHintsByUserId: [{ userId: 'human-1', isBot: false }],
    }),
  );

  for (const vm of [pureBot, mixed, human]) {
    strings.push(vm.roomMarkerLabel, vm.roomAccessibilityLabel);
    for (const m of vm.participantMarkings) {
      strings.push(m.markerLabel, m.accessibilityLabel);
    }
  }
  return strings.filter((s) => s.length > 0);
}

// ── Ban-list ────────────────────────────────────────────────────

/** Short tokens needing whole-word matching to avoid false substring hits. */
const WORD_BOUNDARY_TOKENS = new Set([
  'right',
  'wrong',
  'won',
  'lost',
  'idiot',
]);

describe('GAME-008 doctrine — ban-list', () => {
  const strings = collectBotMarkerStrings();
  const banned = _forbiddenBotMarkerTokens();

  it('produces a non-trivial set of user-facing strings to scan', () => {
    expect(strings.length).toBeGreaterThan(8);
  });

  it('no marker string contains a verdict / amplification / alarming / punitive token', () => {
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const token of banned) {
        if (WORD_BOUNDARY_TOKENS.has(token)) {
          expect(new RegExp(`\\b${token}\\b`, 'i').test(s)).toBe(false);
        } else {
          expect(lower).not.toContain(token);
        }
      }
    }
  });

  it('the ban-list itself does not include "bot" — "Test bot" is the marker', () => {
    expect(banned).not.toContain('bot');
  });
});

// ── No deceptive framing ────────────────────────────────────────

describe('GAME-008 doctrine — no deceptive framing', () => {
  const strings = collectBotMarkerStrings();

  it('no marker string frames the bot as a real user / real person', () => {
    for (const s of strings) {
      const lower = s.toLowerCase();
      expect(lower).not.toContain('real user');
      expect(lower).not.toContain('real person');
    }
  });

  it('the only permitted use of the word "person" is the explicit negation "not a person"', () => {
    // Whole-word match — "persona" (a template placeholder) is NOT the
    // word "person" and must not be flagged.
    for (const s of strings) {
      const lower = s.toLowerCase();
      const matches = lower.match(/\bperson\b/g);
      if (matches === null) continue;
      // Every whole-word "person" must be immediately preceded by "not a ".
      const re = /\bperson\b/g;
      let m: RegExpExecArray | null = re.exec(lower);
      while (m !== null) {
        const before = lower.slice(Math.max(0, m.index - 6), m.index);
        expect(before).toBe('not a ');
        m = re.exec(lower);
      }
    }
  });

  it('no marker string describes the bot as "human"', () => {
    for (const s of strings) {
      expect(s.toLowerCase()).not.toContain('human');
    }
  });
});

// ── Plain language ──────────────────────────────────────────────

describe('GAME-008 doctrine — plain language', () => {
  it('looksLikeInternalCode is false for every visible BOT_MARKER_COPY string', () => {
    for (const s of Object.values(BOT_MARKER_COPY)) {
      // {persona} template placeholder aside, the rendered copy is plain.
      expect(looksLikeInternalCode(s)).toBe(false);
    }
  });

  it('no enum-value / snake_case code leaks into a user-facing string', () => {
    const strings = collectBotMarkerStrings();
    const enumLeaks = [
      'join_as_primary',
      'join_as_chime_in',
      'join_as_observer',
      'create_room',
      'bots_create_public_only',
      'bot_primary_against_real_user',
      'bot_in_private_room_with_real_user',
      'bot_chime_in_not_permitted',
      'public_only',
    ];
    for (const s of strings) {
      for (const leak of enumLeaks) {
        expect(s).not.toContain(leak);
      }
    }
  });
});

// ── Forbidden imports ───────────────────────────────────────────

describe('GAME-008 doctrine — forbidden imports in botRoomPolicyModel.ts', () => {
  it('imports nothing from React or React Native', () => {
    expect(/from\s+['"]react['"]/.test(MODEL_IMPORTS)).toBe(false);
    expect(/from\s+['"]react-native['"]/.test(MODEL_IMPORTS)).toBe(false);
  });

  it('imports nothing from Supabase', () => {
    expect(MODEL_IMPORTS.toLowerCase()).not.toContain('supabase');
  });

  it('imports nothing from a score / standing / heat / anti-amplification module', () => {
    for (const needle of [
      'argumentScoreModel',
      'pointStanding',
      'antiAmplification',
      'heatModel',
    ]) {
      expect(MODEL_IMPORTS).not.toContain(needle);
    }
  });

  it('imports nothing from a network module', () => {
    for (const needle of ['axios', 'XMLHttpRequest']) {
      expect(MODEL_IMPORTS).not.toContain(needle);
    }
    // No bare fetch() call anywhere in the model body either.
    expect(MODEL_SRC).not.toContain('fetch(');
  });

  it('imports only the GAME-004 / GAME-005 contract types + the copy block', () => {
    expect(MODEL_SRC).toContain("from './roomContractModel'");
    expect(MODEL_SRC).toContain("from '../arguments/gameCopy'");
  });
});

// ── No service-role / no Edge Function / no live posting ────────

describe('GAME-008 doctrine — no service-role / no Edge Function / no live posting', () => {
  const sources = [
    ['botRoomPolicyModel.ts', MODEL_SRC],
    ['BotParticipantMarker.tsx', PARTICIPANT_MARKER_SRC],
    ['BotRoomMarker.tsx', ROOM_MARKER_SRC],
  ] as const;

  it('no source references service-role', () => {
    for (const [name, src] of sources) {
      expect(/SERVICE_ROLE|service_role/.test(src)).toBe(false);
      void name;
    }
  });

  it('no source invokes an Edge Function', () => {
    for (const [, src] of sources) {
      expect(/functions\.invoke/.test(src)).toBe(false);
    }
  });

  it('no source calls an AI provider', () => {
    // Precise needles — the model legitimately recognises corpus-runner
    // title tags like "[xai-adv …]", which is NOT an AI provider call.
    for (const [, src] of sources) {
      expect(src).not.toContain('anthropic');
      expect(src).not.toContain('Anthropic');
      expect(src).not.toContain('api.x.ai');
      expect(src).not.toContain('api.anthropic');
      expect(src).not.toContain('XAI_API_KEY');
      expect(src).not.toContain('ANTHROPIC_API_KEY');
    }
  });

  it('no source contains a posting / scheduling / harvest trigger', () => {
    for (const [, src] of sources) {
      expect(/enableBotPosting|scheduleBotRun|harvestCorpus|postBotMove/.test(src)).toBe(false);
    }
  });
});
