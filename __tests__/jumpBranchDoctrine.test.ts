/**
 * GAME-006 — Jump Branch doctrine ban-list + source-scan.
 *
 * Asserts every user-facing string is structural and non-punitive — no
 * verdict / amplification / person-attribution / punitive-movement tokens —
 * and that the model imports nothing from React / Supabase / any score / heat
 * module and contains no service-role / Edge-Function call.
 */
import fs from 'fs';
import path from 'path';
import {
  buildJumpControlViewModel,
  buildJumpMarkers,
  jumpDenyReasonLabel,
  ALL_JUMP_DENY_REASONS,
  _forbiddenJumpBranchTokens,
  type JumpEligibility,
} from '../src/features/debates/jumpBranchModel';
import {
  buildRoomContract,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import { buildPublicRoomSeatMap } from '../src/features/debates/publicSeatModel';
import { JUMP_BRANCH_COPY, looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const REPO = process.cwd();
const MODEL_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/jumpBranchModel.ts'),
  'utf8',
);
/** Only the `import ...` lines of the model — comments / prose excluded. */
const MODEL_IMPORT_LINES = MODEL_SRC.split('\n')
  .filter((line) => /^\s*import\b/.test(line) || /^\s*\}\s+from\s+/.test(line))
  .join('\n');
const CONTROL_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/JumpBranchControl.tsx'),
  'utf8',
);
const MARKER_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/JumpBranchMarker.tsx'),
  'utf8',
);

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';
const CHIME_A = 'u-chime-a';
const NOW = Date.parse('2026-05-20T12:00:00.000Z');

const ROOT: RoomArgumentInput = {
  id: 'root',
  parentId: null,
  authorId: INITIATOR,
  argumentType: 'thesis',
  body: 'Opening claim long enough to count as a real opening move here today.',
  status: 'posted',
  createdAt: '2026-05-20T00:30:00.000Z',
};

function move(over: Partial<RoomArgumentInput>): RoomArgumentInput {
  return {
    id: 'm',
    parentId: 'root',
    authorId: 'u',
    argumentType: 'rebuttal',
    body: 'A real argumentative move long enough to clear the qualifying gate.',
    status: 'posted',
    createdAt: '2026-05-20T01:00:00.000Z',
    ...over,
  };
}

/** Every user-facing string GAME-006 can produce, across all permutations. */
function collectVisibleStrings(): string[] {
  const out: string[] = [];

  // 1. Every value in the frozen copy block.
  for (const v of Object.values(JUMP_BRANCH_COPY)) {
    if (typeof v === 'string') out.push(v);
  }

  // 2. Every disabled-reason label.
  for (const reason of ALL_JUMP_DENY_REASONS) {
    out.push(jumpDenyReasonLabel(reason));
  }

  // 3. The control view-model — enabled + every disabled permutation.
  const eligibilities: JumpEligibility[] = [
    { ok: true, reason: null },
    ...ALL_JUMP_DENY_REASONS.map((reason) => ({ ok: false, reason })),
  ];
  for (const eligibility of eligibilities) {
    const vm = buildJumpControlViewModel({
      eligibility,
      participantUserId: CHIME_A,
      destinationBranchId: 'branch-b',
    });
    out.push(vm.actionLabel, vm.confirmPrompt, vm.confirmLabel, vm.cancelLabel);
    out.push(vm.accessibilityLabel, vm.accessibilityHint);
    if (vm.disabledReasonLabel !== null) out.push(vm.disabledReasonLabel);
  }

  // 4. Marker view-models — both kinds.
  const args = [
    ROOT,
    move({ id: 'opp', authorId: OPPONENT }),
    move({
      id: 'ca1',
      authorId: CHIME_A,
      argumentType: 'claim',
      createdAt: '2026-05-20T02:00:00.000Z',
    }),
    move({
      id: 'ca2',
      authorId: CHIME_A,
      argumentType: 'rebuttal',
      createdAt: '2026-05-20T03:00:00.000Z',
    }),
  ];
  const contract = buildRoomContract({
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: args,
  });
  const seatMap = buildPublicRoomSeatMap({
    roomContract: contract,
    arguments: args,
    participants: [],
    nowMs: NOW,
  });
  const markers = buildJumpMarkers({
    roomContract: contract,
    arguments: args,
    branchIdByArgumentId: new Map([
      ['ca1', 'branch-a'],
      ['ca2', 'branch-b'],
    ]),
    seatMap,
    nowMs: NOW,
  });
  for (const m of markers) {
    out.push(m.markerLabel, m.whenLabel, m.accessibilityLabel);
  }

  return out;
}

// ── Ban-list ───────────────────────────────────────────────────

describe('GAME-006 doctrine — ban-list', () => {
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
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
    'popular',
    'trending',
    'viral',
    'upvote',
    'downvote',
    'troll',
    ' bot ',
    'booted',
    'kicked',
    'banned',
    'abandoned',
    'quit',
    'gave up',
    'deserted',
  ];

  it('no visible GAME-006 string contains a verdict / punitive token', () => {
    const strings = collectVisibleStrings();
    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) {
      const lower = ` ${s.toLowerCase()} `;
      for (const banned of BANNED) {
        expect(lower).not.toContain(banned);
      }
    }
  });

  it('_forbiddenJumpBranchTokens is non-empty and includes punitive-movement tokens', () => {
    const tokens = _forbiddenJumpBranchTokens();
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toContain('abandoned');
    expect(tokens).toContain('quit');
    expect(tokens).toContain('deserted');
    expect(tokens).toContain('winner');
  });

  it('every visible string is free of the model own forbidden tokens', () => {
    const tokens = _forbiddenJumpBranchTokens();
    for (const s of collectVisibleStrings()) {
      const lower = s.toLowerCase();
      for (const token of tokens) {
        // Word-ish containment — "true" must not appear, but allow it
        // never to: the copy is authored to avoid every token.
        expect(lower).not.toContain(token.toLowerCase());
      }
    }
  });
});

// ── Plain language — no internal-code leak ─────────────────────

describe('GAME-006 doctrine — plain language', () => {
  it('no visible string looks like an internal code (no snake_case leak)', () => {
    for (const s of collectVisibleStrings()) {
      // The relative-time templates carry a {rel} placeholder; the rendered
      // strings never do. Skip the raw template fragments.
      if (s.includes('{rel}')) continue;
      expect(looksLikeInternalCode(s)).toBe(false);
    }
  });

  it('no JumpDenyReason enum value appears verbatim in a user string', () => {
    const enumValues = ALL_JUMP_DENY_REASONS.map((r) => String(r));
    for (const s of collectVisibleStrings()) {
      for (const value of enumValues) {
        expect(s).not.toContain(value);
      }
    }
  });
});

// ── Forbidden imports — no heat, no score, no React, no Supabase ──

describe('GAME-006 doctrine — forbidden imports (model)', () => {
  it('jumpBranchModel imports nothing from React', () => {
    expect(MODEL_IMPORT_LINES).not.toMatch(/from ['"]react['"]/);
    expect(MODEL_IMPORT_LINES).not.toMatch(/from ['"]react-native['"]/);
  });

  it('jumpBranchModel imports nothing from Supabase', () => {
    expect(MODEL_IMPORT_LINES).not.toContain('lib/supabase');
    expect(MODEL_IMPORT_LINES).not.toContain('@supabase');
  });

  it('jumpBranchModel imports nothing from any score / standing / heat module', () => {
    expect(MODEL_IMPORT_LINES.toLowerCase()).not.toContain('argumentscoremodel');
    expect(MODEL_IMPORT_LINES.toLowerCase()).not.toContain('pointstanding');
    expect(MODEL_IMPORT_LINES.toLowerCase()).not.toContain('antiamplification');
    expect(MODEL_IMPORT_LINES.toLowerCase()).not.toContain('heat');
  });

  it('jumpBranchModel makes no network / AI call', () => {
    expect(MODEL_SRC).not.toContain('fetch(');
    expect(MODEL_SRC.toLowerCase()).not.toContain('anthropic');
    // The xAI provider modules — scan import lines, not the word in prose.
    expect(MODEL_IMPORT_LINES.toLowerCase()).not.toContain('xai');
  });
});

// ── No service-role / no Edge Function ─────────────────────────

describe('GAME-006 doctrine — no service-role / no Edge Function', () => {
  const allSources = [MODEL_SRC, CONTROL_SRC, MARKER_SRC];

  it('no GAME-006 source references service-role', () => {
    for (const src of allSources) {
      expect(src).not.toContain('SERVICE_ROLE');
      expect(src).not.toContain('service_role');
    }
  });

  it('no GAME-006 source invokes an Edge Function or inserts into arguments', () => {
    for (const src of allSources) {
      expect(src).not.toContain('functions.invoke');
      expect(src).not.toContain(".from('arguments')");
      expect(src).not.toContain('.from("arguments")');
    }
  });

  it('no GAME-006 source leaves a console.log', () => {
    for (const src of allSources) {
      expect(src).not.toContain('console.log');
    }
  });
});
