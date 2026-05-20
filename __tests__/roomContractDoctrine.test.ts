/**
 * GAME-004 — doctrine + safety tests for the room contract model.
 *
 *  - Ban-list: no verdict word reaches any frozen copy string or any label
 *    produced by `buildRoomContractViewModel` across every viewer permutation.
 *  - Forbidden imports: `roomContractModel.ts` imports nothing from React,
 *    Supabase, or any score / standing / heat module — heat and standing are
 *    not seat properties.
 *  - No service-role / no Edge Function in the model or the component.
 */
import fs from 'fs';
import path from 'path';
import {
  buildRoomContract,
  buildRoomContractViewModel,
  ROOM_CONTRACT_COPY,
  type BuildRoomContractInput,
} from '../src/features/debates/roomContractModel';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const MODEL_SRC = read('src/features/debates/roomContractModel.ts');
const STRIP_SRC = read('src/features/debates/RoomContractSeatStrip.tsx');

// ── Ban-list ───────────────────────────────────────────────────

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'challenger who is wrong',
];

/**
 * Whole-word verdict tokens checked separately so legitimate substrings
 * (e.g. "true" inside no string here, but defensively) cannot false-match
 * neighbouring text. These are short tokens that would otherwise be too
 * aggressive as a bare `includes`.
 */
const VERDICT_WORD_TOKENS = ['true', 'false', 'right', 'wrong'];

function collectContractStrings(): string[] {
  const strings: string[] = [...Object.values(ROOM_CONTRACT_COPY)];

  const INITIATOR = 'u-init';
  const OPPONENT = 'u-opp';
  const OTHER = 'u-other';
  const base: BuildRoomContractInput = {
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: [],
  };
  const longBody =
    'I disagree with the root claim because the cited mechanism does not hold here.';
  const rootArg = {
    id: 'root',
    parentId: null,
    authorId: INITIATOR,
    argumentType: 'thesis',
    body: 'Opening claim long enough to count as a real move.',
    status: 'posted',
    createdAt: '2026-05-20T00:30:00.000Z',
  };
  const reply = {
    id: 'a1',
    parentId: 'root',
    authorId: OPPONENT,
    argumentType: 'rebuttal',
    body: longBody,
    status: 'posted',
    createdAt: '2026-05-20T01:00:00.000Z',
  };

  // Permutations: public open seat, public claimed, private claimed —
  // each viewed as initiator / opponent / observer / null.
  const contracts = [
    buildRoomContract({ ...base, arguments: [rootArg] }),
    buildRoomContract({ ...base, arguments: [rootArg, reply] }),
    buildRoomContract({
      ...base,
      roomType: 'private',
      invitedOpponentUserId: OPPONENT,
      arguments: [rootArg, reply],
    }),
  ];
  const viewers: Array<string | null> = [INITIATOR, OPPONENT, OTHER, null];

  for (const contract of contracts) {
    for (const viewer of viewers) {
      const vm = buildRoomContractViewModel(contract, viewer, [rootArg, reply]);
      strings.push(vm.roomTypeLabel);
      strings.push(vm.initiatorSeat.label);
      strings.push(vm.opponentSeat.label);
      strings.push(vm.accessibilityLabel);
      if (vm.turnLabel !== null) strings.push(vm.turnLabel);
    }
  }
  return strings;
}

describe('GAME-004 doctrine — ban-list', () => {
  const strings = collectContractStrings();

  it('no contract string contains a verdict token', () => {
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const token of VERDICT_TOKENS) {
        expect(lower).not.toContain(token);
      }
      for (const token of VERDICT_WORD_TOKENS) {
        expect(new RegExp(`\\b${token}\\b`, 'i').test(s)).toBe(false);
      }
    }
  });

  it('no contract string contains a snake_case internal code', () => {
    for (const s of strings) {
      expect(/[a-z]+_[a-z]+/.test(s)).toBe(false);
    }
  });
});

// ── Forbidden imports — heat / standing / score / React / Supabase ──

describe('GAME-004 doctrine — forbidden imports in roomContractModel.ts', () => {
  const forbidden = [
    "from 'react'",
    'from "react"',
    '../../lib/supabase',
    'argumentScoreModel',
    'claimStanding',
    'pointStanding',
    'heatModel',
    'antiAmplification',
  ];

  it('the model imports nothing from React, Supabase, score, standing, or heat', () => {
    for (const needle of forbidden) {
      expect(MODEL_SRC).not.toContain(needle);
    }
  });

  it('the model contains no fetch / network call', () => {
    expect(MODEL_SRC).not.toContain('fetch(');
    expect(MODEL_SRC).not.toContain('XMLHttpRequest');
  });
});

// ── No service-role / no Edge Function ─────────────────────────

describe('GAME-004 doctrine — no service-role, no Edge Function', () => {
  it('roomContractModel.ts has no service-role / functions.invoke reference', () => {
    expect(MODEL_SRC).not.toContain('SERVICE_ROLE');
    expect(MODEL_SRC).not.toContain('service_role');
    expect(MODEL_SRC).not.toContain('functions.invoke');
  });

  it('RoomContractSeatStrip.tsx has no service-role / functions.invoke reference', () => {
    expect(STRIP_SRC).not.toContain('SERVICE_ROLE');
    expect(STRIP_SRC).not.toContain('service_role');
    expect(STRIP_SRC).not.toContain('functions.invoke');
  });

  it('RoomContractSeatStrip.tsx renders no Pressable (read-time, informational)', () => {
    // The component is informational — no tappable affordance. Scan for the
    // JSX tag and the RN import, not the bare word (the doc comment names it).
    expect(STRIP_SRC).not.toContain('<Pressable');
    expect(/import\s*\{[^}]*\bPressable\b[^}]*\}\s*from\s*'react-native'/.test(STRIP_SRC)).toBe(
      false,
    );
  });
});
