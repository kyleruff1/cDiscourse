/**
 * DEMO-001 — Bundled fixture tests.
 *
 * Pure model (no React, no Supabase, no network). Pins the fixture through
 * the REAL derivation pipeline: `deriveEvidenceDebts` opens / resolves the
 * source debt, and `buildOpenIssue` reads `burden: 'source_owed'` on the
 * disputed node (the design's `source_owed` lever — pinned, not trusted by
 * inspection). Also scans every authored string for banned tokens + raw
 * codes.
 */
import {
  DEMO_FIXTURE_ROOM,
  DEMO_MOVE_TRANSITIONS,
  DEMO_ROOM_ID,
  DEMO_MSG,
  DEMO_FIXTURE_NOW_MS,
  ALL_DEMO_FIXTURE_STATE_IDS,
  ALL_DEMO_MOVE_CODES,
  ALL_DEMO_FIXTURE_STRINGS,
  type DemoFixtureStateId,
} from '../src/features/demoCorridor/demoFixtureRoom';
import {
  deriveEvidenceDebts,
  getNodeEvidenceDebtSummary,
  OPEN_EVIDENCE_DEBT_STATUSES,
  type EvidenceDebtArgumentInput,
} from '../src/features/evidence';
import { buildArtifactsByMessageId } from '../src/features/arguments/argumentGameSurfaceEvidence';
import { buildRefereeCardInput } from '../src/features/arguments/cardView/refereeCardAssembly';
import { buildOpenIssue } from '../src/features/refereeLoop';
import { constitutionRules } from '../src/domain/constitution';
import type { ArgumentType } from '../src/domain/constitution/types';

// Mirror the surface's debt derivation (ArgumentGameSurface.tsx:607-624).
function deriveDebts(stateId: DemoFixtureStateId) {
  const s = DEMO_FIXTURE_ROOM[stateId];
  const artifacts = buildArtifactsByMessageId(s.messages);
  const debtArgs: EvidenceDebtArgumentInput[] = s.messages.map((m) => ({
    id: m.id,
    debateId: DEMO_ROOM_ID,
    parentId: m.parentId,
    authorId: m.authorId ?? null,
    argumentType: m.argumentType ?? null,
    side: m.side ?? null,
    createdAt: m.createdAt,
    tagCodes: (s.tagsByArgumentId[m.id] || []).map((t) => t.tagCode),
    artifacts: artifacts[m.id] ?? [],
  }));
  return deriveEvidenceDebts({ debateId: DEMO_ROOM_ID, arguments: debtArgs, nowMs: DEMO_FIXTURE_NOW_MS });
}

/** Open source debts attached to the disputed claim node. */
function openSourceDebtsOnClaim(stateId: DemoFixtureStateId) {
  const debts = deriveDebts(stateId);
  return getNodeEvidenceDebtSummary(DEMO_MSG.claim, debts).debts.filter(
    (d) => d.debtKind === 'source' && OPEN_EVIDENCE_DEBT_STATUSES.includes(d.status),
  );
}

/** buildOpenIssue over a fixture state's active node (the surface's chain). */
function deriveIssue(stateId: DemoFixtureStateId, activeMessageId: string) {
  const s = DEMO_FIXTURE_ROOM[stateId];
  const debts = deriveDebts(stateId);
  const nodeDebts = getNodeEvidenceDebtSummary(activeMessageId, debts).debts;
  const active = s.messages.find((m) => m.id === activeMessageId)!;
  const parent = active.parentId ? s.messages.find((m) => m.id === active.parentId) ?? null : null;
  const input = buildRefereeCardInput({
    roomId: DEMO_ROOM_ID,
    activeMessageId,
    storedArgumentType: (active.argumentType ?? null) as ArgumentType | null,
    parentType: (parent?.argumentType ?? null) as ArgumentType | null,
    sameSideAsParent: false,
    carriesSupportEvidence: false,
    viewerRole: 'participant_other',
    rules: constitutionRules,
    lifecycleSnapshot: null,
    clusterSummary: null,
    clusterMetadata: null,
    moveLinkage: null,
    openEvidenceDebts: nodeDebts,
    sourceChainStatus: null,
    manualTagCodes: [],
    autoMetadataCodes: [],
    machineObservationMarks: [],
    userAllegationMarks: [],
    bannerSelection: null,
    targetExcerpt: active.body,
    quoteAnchor: null,
    isOnSideBranch: false,
    isTangent: false,
    activePathDepth: 1,
    isNoRebuttal: false,
  });
  return input ? buildOpenIssue(input) : null;
}

describe('DEMO_FIXTURE_ROOM — shape', () => {
  it('every state is a well-formed ArgumentMessageInput room', () => {
    for (const id of ALL_DEMO_FIXTURE_STATE_IDS) {
      const s = DEMO_FIXTURE_ROOM[id];
      expect(s.debate.id).toBe(DEMO_ROOM_ID);
      expect(s.messages.length).toBeGreaterThanOrEqual(3);
      for (const m of s.messages) {
        expect(typeof m.id).toBe('string');
        expect(m.debateId).toBe(DEMO_ROOM_ID);
        expect(typeof m.body).toBe('string');
        expect(m.body.length).toBeGreaterThan(0);
        expect(typeof m.createdAt).toBe('string');
        expect(['affirmative', 'negative', 'neutral']).toContain(m.side);
      }
      // The active + latest ids resolve to real messages.
      expect(s.messages.some((m) => m.id === s.activeMessageId)).toBe(true);
      expect(s.messages.some((m) => m.id === s.latestMessageId)).toBe(true);
    }
  });

  it('the scripted move → state table is complete and consistent', () => {
    expect(Object.keys(DEMO_MOVE_TRANSITIONS).sort()).toEqual([...ALL_DEMO_MOVE_CODES].sort());
    for (const move of ALL_DEMO_MOVE_CODES) {
      expect(ALL_DEMO_FIXTURE_STATE_IDS).toContain(DEMO_MOVE_TRANSITIONS[move]);
    }
  });
});

describe('DEMO_FIXTURE_ROOM — the source_owed lever (pinned, not inspected)', () => {
  it('disputed: the disputed claim owes exactly one open source', () => {
    expect(openSourceDebtsOnClaim('disputed')).toHaveLength(1);
  });

  it('buildOpenIssue over the disputed claim yields burden source_owed on the evidence axis', () => {
    const issue = deriveIssue('disputed', DEMO_MSG.claim);
    expect(issue).not.toBeNull();
    expect(issue!.burden).toBe('source_owed');
    expect(issue!.axis).toBe('evidence');
    // The disputed claim challenges the root; the open source debt drives
    // the source_requested state. (relationToParent === 'challenges' is the
    // derived value — the design's inspection-guess of 'asks_source' was
    // explicitly flagged as not-to-be-trusted; burden is the binding pin.)
    expect(issue!.relationToParent).toBe('challenges');
    expect(issue!.state).toBe('source_requested');
  });
});

describe('DEMO_FIXTURE_ROOM — the scripted post-move debt changes', () => {
  it('add_evidence resolves the source debt (open count drops 1 → 0)', () => {
    expect(openSourceDebtsOnClaim('disputed')).toHaveLength(1);
    expect(openSourceDebtsOnClaim('after_add_evidence')).toHaveLength(0);
  });

  it('ask_source adds a second open source request (the viewer\'s own)', () => {
    expect(openSourceDebtsOnClaim('after_ask_source')).toHaveLength(2);
  });

  it('narrow keeps the source owed (a narrowing supplies no source)', () => {
    expect(openSourceDebtsOnClaim('after_narrow')).toHaveLength(1);
  });

  it('branch preserves the mainline source debt', () => {
    expect(openSourceDebtsOnClaim('after_branch')).toHaveLength(1);
  });

  it('after_add_evidence still derives a real (non-null) Open Issue on the new move', () => {
    // The surface re-derives a fresh issue on the evidence node — never a
    // hand-set label.
    const issue = deriveIssue('after_add_evidence', DEMO_MSG.evidence);
    expect(issue).not.toBeNull();
    expect(issue!.burden).not.toBe('source_owed');
  });
});

describe('DEMO_FIXTURE_ROOM — doctrine safety over all authored strings', () => {
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    ' true',
    'false',
    'truth',
    'untrue',
    'dishonest',
    'liar',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    'verdict',
    'bad faith',
    'proof of',
  ];

  it('no fixture string carries a banned verdict / person token', () => {
    for (const raw of ALL_DEMO_FIXTURE_STRINGS) {
      const lower = raw.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
    }
  });

  it('no fixture body leaks a raw snake_case classifier / type code', () => {
    for (const raw of ALL_DEMO_FIXTURE_STRINGS) {
      expect(raw).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
    }
  });
});
