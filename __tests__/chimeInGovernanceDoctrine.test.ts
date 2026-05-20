/**
 * GAME-005 — doctrine + safety tests for the public-seat / chime-in
 * governance model.
 *
 *  - Ban-list: no verdict / amplification / punitive / person-attribution /
 *    like-vote token reaches any frozen copy string or any label / notice
 *    produced by the view-model builders across every permutation.
 *  - looksLikeInternalCode is false for every visible string (no snake_case
 *    enum-value leak — `off_track` must never reach a user string).
 *  - Forbidden imports: publicSeatModel.ts imports nothing from React,
 *    Supabase, or any score / standing / heat / anti-amplification module.
 *  - No service-role / no Edge Function in the model, the two components,
 *    or the hook.
 */
import fs from 'fs';
import path from 'path';
import {
  buildPublicRoomSeatMap,
  buildPublicRoomMetricsViewModel,
  buildGovernanceControlViewModel,
  _forbiddenChimeInGovernanceTokens,
  type GovernanceReaction,
} from '../src/features/debates/publicSeatModel';
import {
  buildRoomContract,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import { CHIME_IN_GOVERNANCE_COPY, looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import type { CollapsedBranchSummary } from '../src/features/arguments/branchGrammarModel';

const REPO = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const MODEL_SRC = read('src/features/debates/publicSeatModel.ts');
const CONTROL_SRC = read('src/features/debates/ChimeInGovernanceControl.tsx');
const STRIP_SRC = read('src/features/debates/PublicRoomMetricsStrip.tsx');
const HOOK_SRC = read('src/features/debates/useChimeInGovernance.ts');

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';
const NOW = Date.parse('2026-05-20T12:00:00.000Z');

const ROOT: RoomArgumentInput = {
  id: 'root',
  parentId: null,
  authorId: INITIATOR,
  argumentType: 'thesis',
  body: 'Opening claim long enough to count as a real opening move here.',
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

function contractFrom(args: RoomArgumentInput[]) {
  const input: BuildRoomContractInput = {
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: args,
  };
  return buildRoomContract(input);
}

function summary(over: Partial<CollapsedBranchSummary>): CollapsedBranchSummary {
  return {
    branchId: 'b1',
    branchRootMessageId: 'm1',
    direction: 'chime_in_vertical',
    messageCount: 3,
    participantCount: 2,
    lastActivityAt: '2026-05-20T05:00:00.000Z',
    recencyLabel: 'active 1h ago',
    unresolvedCount: 0,
    primaryPartyEngaged: false,
    summaryLine: 'Chime-in branch summary line for the metrics strip',
    accessibilityLabel: 'Chime-in branch. Tap to expand.',
    ...over,
  };
}

/** Collect every user-facing string GAME-005 can produce. */
function collectGovernanceStrings(): string[] {
  const strings: string[] = [...Object.values(CHIME_IN_GOVERNANCE_COPY)];

  const CHIME_A = 'u-chime-a';
  const args = [
    ROOT,
    move({ id: 'opp', authorId: OPPONENT, argumentType: 'rebuttal' }),
    move({
      id: 'ca',
      authorId: CHIME_A,
      argumentType: 'claim',
      createdAt: '2026-05-20T02:00:00.000Z',
    }),
  ];
  const contract = contractFrom(args);

  const reactionSets: GovernanceReaction[][] = [
    [],
    [
      {
        byPrimarySeat: 'initiator',
        byUserId: INITIATOR,
        targetBranchOrMessageId: 'b',
        targetChimeInUserId: CHIME_A,
        kind: 'off_track',
        at: '2026-05-20T05:00:00.000Z',
        retracted: false,
      },
      {
        byPrimarySeat: 'primary_opponent',
        byUserId: OPPONENT,
        targetBranchOrMessageId: 'b',
        targetChimeInUserId: CHIME_A,
        kind: 'off_track',
        at: '2026-05-20T06:00:00.000Z',
        retracted: false,
      },
    ],
  ];

  for (const reactions of reactionSets) {
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      governanceReactions: reactions,
      chimeInBranchIdByUserId: new Map([[CHIME_A, 'branch-a']]),
      nowMs: NOW,
    });

    const metricsVm = buildPublicRoomMetricsViewModel(seatMap, [
      summary({}),
    ]);
    strings.push(metricsVm.seatCountLabel);
    strings.push(metricsVm.chimeInCountLabel);
    strings.push(metricsVm.sideBranchesHeading);
    strings.push(metricsVm.accessibilityLabel);
    strings.push(...metricsVm.branchStateLabels);

    for (const viewer of [INITIATOR, OPPONENT]) {
      const controlVm = buildGovernanceControlViewModel({
        seatMap,
        targetChimeInUserId: CHIME_A,
        targetBranchId: 'branch-a',
        viewerUserId: viewer,
        governanceReactions: reactions,
      });
      for (const reaction of controlVm.reactions) {
        strings.push(reaction.label);
        strings.push(reaction.accessibilityLabel);
      }
      if (controlVm.observerFallbackNotice !== null) {
        strings.push(controlVm.observerFallbackNotice);
      }
    }
  }
  return strings;
}

// ── Ban-list ───────────────────────────────────────────────────

/**
 * Short tokens that need whole-word matching so a legitimate substring
 * (e.g. "right" inside no copy here, defensively) cannot false-match.
 */
const WORD_BOUNDARY_TOKENS = new Set([
  'true',
  'false',
  'right',
  'wrong',
  'won',
  'lost',
  'like',
  'vote',
  'bot',
]);

describe('GAME-005 doctrine — ban-list', () => {
  const strings = collectGovernanceStrings();
  const banned = _forbiddenChimeInGovernanceTokens();

  it('produces a non-trivial set of user-facing strings to scan', () => {
    expect(strings.length).toBeGreaterThan(10);
  });

  it('no governance string contains a verdict / amplification / punitive token', () => {
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

  it('no governance string contains a snake_case internal code', () => {
    for (const s of strings) {
      expect(/[a-z]+_[a-z]+/.test(s)).toBe(false);
    }
  });

  it('looksLikeInternalCode is false for every visible governance string', () => {
    for (const s of strings) {
      expect(looksLikeInternalCode(s)).toBe(false);
    }
  });

  it('the enum value "off_track" never appears in a user-facing string', () => {
    for (const s of strings) {
      expect(s).not.toContain('off_track');
    }
  });
});

// ── Forbidden imports — heat / standing / score / React / Supabase ──

describe('GAME-005 doctrine — forbidden imports in publicSeatModel.ts', () => {
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

describe('GAME-005 doctrine — no service-role, no Edge Function, no schema write', () => {
  const sources: Array<[string, string]> = [
    ['publicSeatModel.ts', MODEL_SRC],
    ['ChimeInGovernanceControl.tsx', CONTROL_SRC],
    ['PublicRoomMetricsStrip.tsx', STRIP_SRC],
    ['useChimeInGovernance.ts', HOOK_SRC],
  ];

  for (const [name, src] of sources) {
    it(`${name} has no service-role / functions.invoke reference`, () => {
      expect(src).not.toContain('SERVICE_ROLE');
      expect(src).not.toContain('service_role');
      expect(src).not.toContain('functions.invoke');
    });
  }

  it('the model + hook never write to debate_participants.side', () => {
    // chime_in is a derived role only — never a DB value. There is no
    // .update / .insert / .from('debate_participants') anywhere.
    for (const src of [MODEL_SRC, HOOK_SRC]) {
      expect(src).not.toContain(".from('debate_participants')");
      expect(src).not.toContain('.update(');
      expect(src).not.toContain('.insert(');
    }
  });

  it('the model makes no AI / network call (deterministic)', () => {
    expect(MODEL_SRC).not.toContain('anthropic');
    expect(MODEL_SRC).not.toContain('Anthropic');
    expect(MODEL_SRC).not.toContain('api.x.ai');
  });
});

// ── BR-004 / GAME-004 consumption ──────────────────────────────

describe('GAME-005 doctrine — consumes BR-004 + GAME-004, does not redesign them', () => {
  it('imports the GAME-004 qualifying-response predicate (anti-sniping inherited)', () => {
    expect(MODEL_SRC).toContain('isQualifyingResponse');
    expect(MODEL_SRC).toContain("from './roomContractModel'");
  });

  it('imports BR-004 CollapsedBranchSummary as a consumed type', () => {
    expect(MODEL_SRC).toContain('CollapsedBranchSummary');
    expect(MODEL_SRC).toContain("from '../arguments/branchGrammarModel'");
  });
});
