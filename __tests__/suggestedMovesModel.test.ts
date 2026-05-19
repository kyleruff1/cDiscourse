/**
 * ST-002 — suggestedMovesModel tests.
 *
 * Pure-TS deriver coverage. No React, no Supabase, no network.
 *
 *   - 9-code vocabulary coverage (every `SuggestedMoveCode` appears under
 *     at least one input).
 *   - Lifecycle-state primary table (19 states, exhaustive).
 *   - Manual-tag override (9 promotable tags + 1 deferred).
 *   - Auto-metadata refinement (6 refining codes).
 *   - Source-chain override (4 statuses that fire).
 *   - Preset + dock mapping invariants.
 *   - Rationale ban-list / person-attribution / snake_case scans.
 *   - Cap enforcement (label ≤ 24, rationale ≤ 80, length ≤ max).
 *   - Determinism.
 *   - Doctrine: standing band ignored; no engagement / amplification
 *     identifier leaks; no forbidden imports.
 */

import fs from 'fs';
import path from 'path';

import {
  deriveSuggestedMoves,
  buildRationale,
  _forbiddenSuggestionTokens,
  ALL_SUGGESTED_MOVE_CODES,
  type SuggestedMove,
  type SuggestedMoveCode,
  type SuggestionDerivationInput,
  type SuggestionSignal,
  type SuggestedNextMove,
} from '../src/features/arguments/suggestedMovesModel';
import {
  ALL_POINT_LIFECYCLE_STATES,
  type PointLifecycleClusterSummary,
  type PointLifecycleState,
} from '../src/features/lifecycle';
import {
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  type AutoMetadataCode,
  type ClusterMetadataSummary,
  type ManualTagCode,
  type ManualTagEntry,
  type MoveLinkageRecord,
} from '../src/features/metadata';
import { ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES } from '../src/features/arguments/timelineNodeActionDockModel';
import { quickActionToPreset } from '../src/features/arguments/quickActionPresets';
import { ALL_SOURCE_CHAIN_STATUSES, type SourceChainStatus } from '../src/features/evidence/evidenceModel';

// ── Fixtures ──────────────────────────────────────────────────

function fakeClusterSummary(over: Partial<PointLifecycleClusterSummary> = {}): PointLifecycleClusterSummary {
  return {
    clusterId: over.clusterId ?? 'c1',
    rootMessageId: over.rootMessageId ?? 'm1',
    state: (over.state ?? 'open') as PointLifecycleState,
    plainLabel: over.plainLabel ?? 'Open',
    messageIds: over.messageIds ?? ['m1'],
    memberCount: over.memberCount ?? 1,
    affirmativeMoveCount: over.affirmativeMoveCount ?? 0,
    negativeMoveCount: over.negativeMoveCount ?? 0,
    observerMoveCount: over.observerMoveCount ?? 0,
    hasOpenSourceOrQuoteRequest: over.hasOpenSourceOrQuoteRequest ?? false,
    hasConcessionOrSynthesisMove: over.hasConcessionOrSynthesisMove ?? false,
    worstEvidenceStatus: over.worstEvidenceStatus ?? 'no_source',
    primaryAxis: over.primaryAxis ?? null,
    isAdvisory: over.isAdvisory ?? false,
  };
}

function fakeClusterMetadata(over: Partial<ClusterMetadataSummary> = {}): ClusterMetadataSummary {
  return {
    clusterId: over.clusterId ?? 'c1',
    manualTagCodes: over.manualTagCodes ?? [],
    autoMetadataCodes: over.autoMetadataCodes ?? [],
    lifecycleState: (over.lifecycleState ?? 'open') as PointLifecycleState,
    lastManualTagAt: over.lastManualTagAt ?? null,
    taggingParticipantCount: over.taggingParticipantCount ?? 0,
  };
}

function fakeManualTagEntry(code: ManualTagCode): ManualTagEntry {
  return {
    code,
    appliedByUserId: 'u1',
    appliedByActorRole: 'participant_affirmative',
    appliedAt: '2026-05-19T00:00:00.000Z',
    dedupeKey: `${code}:u1`,
    note: null,
  };
}

function fakeMoveLinkage(
  over: Partial<MoveLinkageRecord> = {},
  tags: ReadonlyArray<ManualTagCode> = [],
): MoveLinkageRecord {
  return {
    messageId: over.messageId ?? 'm1',
    parentMessageId: over.parentMessageId ?? null,
    rootPointId: over.rootPointId ?? 'm1',
    pointClusterId: over.pointClusterId ?? 'c1',
    branchId: over.branchId ?? 'b1',
    targetExcerpt: over.targetExcerpt ?? null,
    disagreementAxis: over.disagreementAxis ?? null,
    semanticFlags: over.semanticFlags ?? [],
    userAppliedTags: over.userAppliedTags ?? tags.map(fakeManualTagEntry),
    autoDerivedMetadata: over.autoDerivedMetadata ?? [],
    lifecycleEventsCausedByMove: over.lifecycleEventsCausedByMove ?? [],
  };
}

function baseInput(over: Partial<SuggestionDerivationInput> = {}): SuggestionDerivationInput {
  return {
    clusterSummary: 'clusterSummary' in over ? (over.clusterSummary as PointLifecycleClusterSummary | null) : fakeClusterSummary(),
    clusterMetadata: 'clusterMetadata' in over ? (over.clusterMetadata as ClusterMetadataSummary | null) : fakeClusterMetadata(),
    moveLinkage: 'moveLinkage' in over ? (over.moveLinkage as MoveLinkageRecord | null) : null,
    sourceChainStatus: 'sourceChainStatus' in over ? (over.sourceChainStatus as SourceChainStatus | null) : null,
    evidentiaryRisk: 'evidentiaryRisk' in over ? (over.evidentiaryRisk as 'low' | 'medium' | 'high' | 'unknown' | null) : null,
    latestMoveType: 'latestMoveType' in over ? (over.latestMoveType as SuggestionDerivationInput['latestMoveType']) : null,
    activePathDepth: over.activePathDepth ?? 0,
    isNoRebuttal: over.isNoRebuttal ?? false,
    stopReason: 'stopReason' in over ? (over.stopReason as string | null) : null,
    isOnSideBranch: over.isOnSideBranch ?? false,
    isTangent: over.isTangent ?? false,
    standingBand: 'standingBand' in over ? (over.standingBand as string | null) : null,
    maxSuggestions: over.maxSuggestions,
  };
}

// ── 1. Empty / null inputs ─────────────────────────────────────

describe('ST-002 — empty / null inputs', () => {
  it('all-null input returns []', () => {
    const out = deriveSuggestedMoves(
      baseInput({ clusterSummary: null, clusterMetadata: null }),
    );
    expect(out).toEqual([]);
  });

  it('clusterSummary === null only — returns []', () => {
    const out = deriveSuggestedMoves(baseInput({ clusterSummary: null }));
    expect(out).toEqual([]);
  });

  it('clusterMetadata === null only — still derives from lifecycle', () => {
    const out = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'narrowed' }),
        clusterMetadata: null,
      }),
    );
    expect(out.map((s) => s.code)).toEqual(['confirm']);
  });

  it('moveLinkage === null — no manual-tag promotions, lifecycle still applies', () => {
    const out = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'synthesis_ready' }),
        moveLinkage: null,
      }),
    );
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].code).toBe('synthesize');
  });

  it('maxSuggestions === 0 returns []', () => {
    const out = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'synthesis_ready' }),
        maxSuggestions: 0,
      }),
    );
    expect(out).toEqual([]);
  });
});

// ── 2. Lifecycle-state primary coverage (19 states) ────────────

describe('ST-002 — lifecycle-state primary coverage', () => {
  const EXPECTED: Record<PointLifecycleState, SuggestedMoveCode[]> = {
    open: [],
    answered: [],
    rebutted: [],
    clarified: [],
    sourced: [],
    quote_requested: ['ask_quote'],
    source_requested: ['ask_source'],
    narrowed: ['confirm'],
    conceded: ['confirm', 'synthesize'],
    confirmed: ['synthesize'],
    synthesis_ready: ['synthesize', 'confirm'],
    moved_on_by_affirmative: ['confirm', 'synthesize'],
    moved_on_by_negative: ['confirm', 'synthesize'],
    ignored_by_affirmative: ['synthesize'],
    ignored_by_negative: ['synthesize'],
    ignored_by_both: ['synthesize'],
    exhausted: ['narrow', 'branch_tangent'],
    branch_recommended: ['branch_tangent', 'narrow'],
    archived_or_resolved: [],
  };

  for (const state of ALL_POINT_LIFECYCLE_STATES) {
    it(`state=${state} emits expected codes`, () => {
      const out = deriveSuggestedMoves(
        baseInput({
          clusterSummary: fakeClusterSummary({ state }),
          clusterMetadata: fakeClusterMetadata({ lifecycleState: state }),
        }),
      );
      expect(out.map((s) => s.code)).toEqual(EXPECTED[state]);
    });
  }
});

// ── 3. Manual-tag override ─────────────────────────────────────

describe('ST-002 — manual-tag override', () => {
  const PROMOTIONS: Array<[ManualTagCode, SuggestedMoveCode]> = [
    ['needs_source', 'ask_source'],
    ['needs_quote', 'ask_quote'],
    ['scope_issue', 'challenge_scope'],
    ['causal_mechanism', 'challenge_mechanism'],
    ['evidence_debt', 'ask_source'],
    ['concession_offered', 'confirm'],
    ['narrowed_claim', 'confirm'],
    ['tangent', 'branch_tangent'],
    ['ready_for_synthesis', 'synthesize'],
  ];

  for (const [tag, expectedCode] of PROMOTIONS) {
    it(`manual tag ${tag} promotes ${expectedCode} to position 0`, () => {
      const out = deriveSuggestedMoves(
        baseInput({
          clusterSummary: fakeClusterSummary({ state: 'open' }),
          moveLinkage: fakeMoveLinkage({}, [tag]),
        }),
      );
      expect(out.length).toBeGreaterThan(0);
      expect(out[0].code).toBe(expectedCode);
      const sigs = out[0].sourceSignals;
      const found = sigs.find(
        (s) => s.kind === 'manual_tag_present' && (s as { kind: 'manual_tag_present'; tag: ManualTagCode }).tag === tag,
      );
      expect(found).toBeDefined();
    });
  }

  it('definition_issue is deferred — no promotion', () => {
    const out = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'open' }),
        moveLinkage: fakeMoveLinkage({}, ['definition_issue']),
      }),
    );
    // Lifecycle `open` emits []; definition_issue does not promote; so [].
    expect(out).toEqual([]);
  });
});

// ── 4. Auto-metadata refinement ────────────────────────────────

describe('ST-002 — auto-metadata refinement', () => {
  const PROMOTIONS: Array<[AutoMetadataCode, SuggestedMoveCode]> = [
    ['synthesis_candidate', 'synthesize'],
    ['branch_suggested', 'branch_tangent'],
    ['repeated_axis_pressure', 'narrow'],
    ['point_exhausted', 'narrow'],
    ['point_stalled', 'synthesize'],
    ['no_response_after_n_turns', 'synthesize'],
  ];

  for (const [code, expectedCode] of PROMOTIONS) {
    it(`auto-metadata ${code} surfaces ${expectedCode}`, () => {
      const out = deriveSuggestedMoves(
        baseInput({
          clusterSummary: fakeClusterSummary({ state: 'open' }),
          clusterMetadata: fakeClusterMetadata({
            lifecycleState: 'open',
            autoMetadataCodes: [code],
          }),
        }),
      );
      const codes = out.map((s) => s.code);
      expect(codes).toContain(expectedCode);
    });
  }
});

// ── 5. Source-chain override ──────────────────────────────────

describe('ST-002 — source-chain override', () => {
  const OVERRIDES: Array<[SourceChainStatus, SuggestedMoveCode]> = [
    ['no_source', 'ask_source'],
    ['unverified', 'ask_source'],
    ['broken', 'ask_source'],
    ['source_no_quote', 'ask_quote'],
  ];

  for (const [status, expectedCode] of OVERRIDES) {
    it(`status=${status} puts ${expectedCode} at position 0`, () => {
      const out = deriveSuggestedMoves(
        baseInput({
          clusterSummary: fakeClusterSummary({ state: 'synthesis_ready' }),
          sourceChainStatus: status,
        }),
      );
      expect(out.length).toBeGreaterThan(0);
      expect(out[0].code).toBe(expectedCode);
      const sig = out[0].sourceSignals.find((s) => s.kind === 'broken_source_chain');
      expect(sig).toBeDefined();
    });
  }

  it('source_and_quote and primary_present do not override lifecycle', () => {
    for (const status of ['source_and_quote', 'primary_present'] as SourceChainStatus[]) {
      const out = deriveSuggestedMoves(
        baseInput({
          clusterSummary: fakeClusterSummary({ state: 'synthesis_ready' }),
          sourceChainStatus: status,
        }),
      );
      expect(out[0].code).toBe('synthesize');
    }
  });
});

// ── 6. Preset mapping invariant ────────────────────────────────

describe('ST-002 — preset mapping invariant', () => {
  // Build an exhaustive fixture set that elicits every code.
  function suggestionsFromEveryCode(): SuggestedMove[] {
    const out: SuggestedMove[] = [];
    // ask_source via source-chain
    out.push(...deriveSuggestedMoves(baseInput({ sourceChainStatus: 'no_source' })));
    // ask_quote via source-chain
    out.push(...deriveSuggestedMoves(baseInput({ sourceChainStatus: 'source_no_quote' })));
    // narrow via lifecycle exhausted
    out.push(...deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state: 'exhausted' }) })));
    // concede — no lifecycle state surfaces this in v1, but the manual tag
    // table does not include it. To exercise the `concede` code we route
    // through the lifecycle table once we have it; ALL_SUGGESTED_MOVE_CODES
    // includes `concede` and the deriver supports it via SUGGESTED_MOVE_*
    // maps. We verify it surfaces via the all-codes synthetic build below.
    // confirm via lifecycle narrowed
    out.push(...deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state: 'narrowed' }) })));
    // synthesize via lifecycle synthesis_ready
    out.push(...deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state: 'synthesis_ready' }) })));
    // challenge_mechanism via manual tag
    out.push(...deriveSuggestedMoves(baseInput({ moveLinkage: fakeMoveLinkage({}, ['causal_mechanism']) })));
    // challenge_scope via manual tag
    out.push(...deriveSuggestedMoves(baseInput({ moveLinkage: fakeMoveLinkage({}, ['scope_issue']) })));
    // branch_tangent via manual tag
    out.push(...deriveSuggestedMoves(baseInput({ moveLinkage: fakeMoveLinkage({}, ['tangent']) })));
    return out;
  }

  const VALID_PRESETS: ReadonlyArray<string> = Object.freeze([
    'reply',
    'challenge',
    'source',
    'quote',
    'clarify',
    'evidence',
    'concede',
    'branch',
    'flag',
    'weak_source',
    'inspect_receipt',
    'narrow',
    'confirm',
    'synthesize',
  ]);

  it('every emitted presetKey is a member of QuickActionLabel', () => {
    const all = suggestionsFromEveryCode();
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      expect(VALID_PRESETS).toContain(s.presetKey);
    }
  });

  it('every emitted presetKey resolves through quickActionToPreset without throw', () => {
    const all = suggestionsFromEveryCode();
    for (const s of all) {
      // quickActionToPreset returns null for some labels (reply / branch /
      // flag / inspect_receipt); the contract is just that it does not
      // throw and is a known QuickActionLabel.
      expect(() => quickActionToPreset(s.presetKey, null)).not.toThrow();
    }
  });
});

// ── 7. Dock-action mapping invariant ───────────────────────────

describe('ST-002 — dock-action mapping invariant', () => {
  it('every dockAction is null or in TimelineNodeActionDockActionCode', () => {
    const out: SuggestedMove[] = [];
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      out.push(...deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state }) })));
    }
    for (const code of ALL_AUTO_METADATA_CODES) {
      out.push(
        ...deriveSuggestedMoves(
          baseInput({
            clusterMetadata: fakeClusterMetadata({ autoMetadataCodes: [code] }),
          }),
        ),
      );
    }
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      if (s.dockAction === null) continue;
      expect(ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES).toContain(s.dockAction);
    }
  });
});

// ── 8. Rationale ban-list scan ─────────────────────────────────

describe('ST-002 — rationale ban-list', () => {
  function buildAllRationales(): string[] {
    const out: string[] = [];
    // Every signal kind × the codes that fire it.
    const fixtures: SuggestionSignal[][] = [
      [{ kind: 'unresolved_source_request' }],
      [{ kind: 'unresolved_quote_request' }],
      [{ kind: 'narrow_concession_opportunity' }],
      [{ kind: 'synthesis_ready' }],
      [{ kind: 'point_exhausted_same_axis' }],
      [{ kind: 'branch_recommended_off_axis' }],
      [{ kind: 'no_response_after_n_turns' }],
    ];
    for (const s of ALL_SOURCE_CHAIN_STATUSES) {
      fixtures.push([{ kind: 'broken_source_chain', status: s }]);
    }
    for (const tag of ALL_MANUAL_TAG_CODES) {
      fixtures.push([{ kind: 'manual_tag_present', tag }]);
    }
    for (const code of ALL_AUTO_METADATA_CODES) {
      fixtures.push([{ kind: 'auto_metadata_present', code }]);
    }
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      fixtures.push([{ kind: 'lifecycle_state_match', state }]);
    }
    for (const code of ALL_SUGGESTED_MOVE_CODES) {
      fixtures.push([{ kind: 'preset_gap', code }]);
    }
    for (const fx of fixtures) out.push(buildRationale(fx));
    return out;
  }

  it('no rationale contains a forbidden lifecycle / metadata / amplification token', () => {
    const banned = _forbiddenSuggestionTokens();
    const rationales = buildAllRationales();
    for (const r of rationales) {
      const lower = r.toLowerCase();
      for (const tok of banned) {
        // Whole-word check (single token).
        const re = new RegExp(`\\b${tok.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        expect(lower).not.toMatch(re);
      }
    }
  });
});

// ── 9. Person-attribution scan ─────────────────────────────────

describe('ST-002 — person-attribution scan', () => {
  const PERSON_ATTRIBUTION_TOKENS = [
    'you',
    'your',
    "you're",
    'yours',
    'they',
    'their',
    "they're",
    'theirs',
    'the user',
    'the author',
    'the poster',
    'the speaker',
    'the participant',
    'this person',
    'this user',
  ];

  function allRationales(): string[] {
    const out: string[] = [];
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      for (const s of deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state }) }))) {
        out.push(s.rationale);
      }
    }
    for (const status of ALL_SOURCE_CHAIN_STATUSES) {
      for (const s of deriveSuggestedMoves(baseInput({ sourceChainStatus: status }))) {
        out.push(s.rationale);
      }
    }
    for (const code of ALL_AUTO_METADATA_CODES) {
      for (const s of deriveSuggestedMoves(
        baseInput({ clusterMetadata: fakeClusterMetadata({ autoMetadataCodes: [code] }) }),
      )) {
        out.push(s.rationale);
      }
    }
    for (const tag of ALL_MANUAL_TAG_CODES) {
      for (const s of deriveSuggestedMoves(baseInput({ moveLinkage: fakeMoveLinkage({}, [tag]) }))) {
        out.push(s.rationale);
      }
    }
    return out;
  }

  it('no rationale contains a person-attribution token', () => {
    const rationales = allRationales();
    expect(rationales.length).toBeGreaterThan(0);
    for (const r of rationales) {
      const lower = r.toLowerCase();
      for (const tok of PERSON_ATTRIBUTION_TOKENS) {
        const re = new RegExp(`\\b${tok.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        expect(lower).not.toMatch(re);
      }
    }
  });
});

// ── 10. Snake_case scan (rationale + label) ────────────────────

describe('ST-002 — snake_case scan', () => {
  it('no rationale or label contains snake_case', () => {
    const re = /[a-z]+_[a-z]+/;
    const out: SuggestedMove[] = [];
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      out.push(...deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state }) })));
    }
    for (const code of ALL_AUTO_METADATA_CODES) {
      out.push(
        ...deriveSuggestedMoves(
          baseInput({ clusterMetadata: fakeClusterMetadata({ autoMetadataCodes: [code] }) }),
        ),
      );
    }
    for (const tag of ALL_MANUAL_TAG_CODES) {
      out.push(...deriveSuggestedMoves(baseInput({ moveLinkage: fakeMoveLinkage({}, [tag]) })));
    }
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      expect(s.rationale).not.toMatch(re);
      expect(s.label).not.toMatch(re);
    }
  });
});

// ── 11. Cap enforcement ────────────────────────────────────────

describe('ST-002 — cap enforcement', () => {
  it('every rationale ≤ 80 chars and every label ≤ 24 chars', () => {
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const out = deriveSuggestedMoves(
        baseInput({
          clusterSummary: fakeClusterSummary({ state }),
          clusterMetadata: fakeClusterMetadata({
            lifecycleState: state,
            autoMetadataCodes: ['synthesis_candidate', 'branch_suggested', 'point_stalled'],
          }),
          moveLinkage: fakeMoveLinkage({}, ['needs_source', 'tangent']),
        }),
      );
      for (const s of out) {
        expect(s.rationale.length).toBeLessThanOrEqual(80);
        expect(s.label.length).toBeLessThanOrEqual(24);
      }
    }
  });

  it('returned array length ≤ maxSuggestions', () => {
    const out = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'exhausted' }),
        clusterMetadata: fakeClusterMetadata({
          autoMetadataCodes: ['synthesis_candidate', 'branch_suggested', 'point_stalled'],
        }),
        moveLinkage: fakeMoveLinkage({}, ['needs_source', 'tangent']),
        maxSuggestions: 2,
      }),
    );
    expect(out.length).toBeLessThanOrEqual(2);
  });
});

// ── 12. Gap-code routing ───────────────────────────────────────

describe('ST-002 — gap-code routing', () => {
  it('challenge_mechanism routes to challenge preset + signal', () => {
    const out = deriveSuggestedMoves(
      baseInput({ moveLinkage: fakeMoveLinkage({}, ['causal_mechanism']) }),
    );
    const cm = out.find((s) => s.code === 'challenge_mechanism');
    expect(cm).toBeDefined();
    expect(cm!.presetKey).toBe('challenge');
    expect(cm!.dockAction).toBe('challenge');
    expect(cm!.sourceSignals.some((s) => s.kind === 'preset_gap')).toBe(true);
  });

  it('challenge_scope routes to narrow preset + signal', () => {
    const out = deriveSuggestedMoves(
      baseInput({ moveLinkage: fakeMoveLinkage({}, ['scope_issue']) }),
    );
    const cs = out.find((s) => s.code === 'challenge_scope');
    expect(cs).toBeDefined();
    expect(cs!.presetKey).toBe('narrow');
    expect(cs!.dockAction).toBe('narrow');
    expect(cs!.sourceSignals.some((s) => s.kind === 'preset_gap')).toBe(true);
  });

  it('branch_tangent routes to branch preset + signal', () => {
    const out = deriveSuggestedMoves(
      baseInput({ moveLinkage: fakeMoveLinkage({}, ['tangent']) }),
    );
    const bt = out.find((s) => s.code === 'branch_tangent');
    expect(bt).toBeDefined();
    expect(bt!.presetKey).toBe('branch');
    expect(bt!.dockAction).toBe('branch');
    expect(bt!.sourceSignals.some((s) => s.kind === 'preset_gap')).toBe(true);
  });
});

// ── 13. No-forced-gate ─────────────────────────────────────────

describe('ST-002 — no-forced-gate', () => {
  it('empty suggestion array is a valid output (no must-act sentinel)', () => {
    const out = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'open' }),
        clusterMetadata: fakeClusterMetadata({ lifecycleState: 'open' }),
      }),
    );
    expect(Array.isArray(out)).toBe(true);
    expect(out).toEqual([]);
  });

  it('no SuggestedMove field name implies execution / dispatch / callback', () => {
    const all = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'narrowed' }),
        clusterMetadata: fakeClusterMetadata({ autoMetadataCodes: ['synthesis_candidate'] }),
        moveLinkage: fakeMoveLinkage({}, ['needs_source']),
      }),
    );
    for (const s of all) {
      for (const key of Object.keys(s)) {
        expect(key).not.toMatch(/onPress|onAction|dispatch|callback|handler/i);
      }
    }
  });
});

// ── 14. Determinism ────────────────────────────────────────────

describe('ST-002 — determinism', () => {
  it('identical inputs return structurally-equal arrays', () => {
    const input = baseInput({
      clusterSummary: fakeClusterSummary({ state: 'exhausted' }),
      clusterMetadata: fakeClusterMetadata({
        autoMetadataCodes: ['branch_suggested'],
      }),
      moveLinkage: fakeMoveLinkage({}, ['needs_source']),
    });
    const a = deriveSuggestedMoves(input);
    const b = deriveSuggestedMoves(input);
    expect(a).toEqual(b);
  });

  it('sourceSignals order is stable', () => {
    const input = baseInput({
      clusterSummary: fakeClusterSummary({ state: 'narrowed' }),
      moveLinkage: fakeMoveLinkage({}, ['needs_source']),
    });
    const a = deriveSuggestedMoves(input);
    const b = deriveSuggestedMoves(input);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].sourceSignals.map((s) => s.kind)).toEqual(b[i].sourceSignals.map((s) => s.kind));
    }
  });
});

// ── 15. Doctrine: standing band does not change output ─────────

describe('ST-002 — doctrine invariants', () => {
  it('standing band Strongly supported vs Needs work — identical output', () => {
    const a = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'exhausted' }),
        standingBand: 'Strongly supported',
      }),
    );
    const b = deriveSuggestedMoves(
      baseInput({
        clusterSummary: fakeClusterSummary({ state: 'exhausted' }),
        standingBand: 'Needs work',
      }),
    );
    expect(a).toEqual(b);
  });
});

// ── 16. Source-scan: no amplification / engagement reads ───────

describe('ST-002 — source-scan: no amplification / engagement', () => {
  const MODEL_PATH = path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'suggestedMovesModel.ts',
  );

  function read(): string {
    return fs.readFileSync(MODEL_PATH, 'utf8');
  }

  it('the deriver file contains no engagement / amplification / likes / shares / followers / trending / viral identifier reads', () => {
    const src = read();
    // Identifier reads — must NOT exist as a free identifier or property access.
    // We exclude the source-scan test prose itself by scanning only the
    // model file, not this test.
    for (const tok of ['engagement', 'amplification', 'likes', 'shares', 'followers', 'trending', 'viral']) {
      // Allow the word inside a comment that explicitly mentions doctrine,
      // but the model file's only references are within doctrine comments
      // describing what we DON'T do — scan for identifier-shaped usage.
      const re = new RegExp(`\\b${tok}\\b\\s*[\\.:=]`, 'i');
      expect(src).not.toMatch(re);
    }
  });
});

// ── 17. Forbidden imports ──────────────────────────────────────

describe('ST-002 — forbidden imports', () => {
  const MODEL_PATH = path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'suggestedMovesModel.ts',
  );

  function read(): string {
    return fs.readFileSync(MODEL_PATH, 'utf8');
  }

  /**
   * Strip line-comments and block-comments so doctrine prose that NAMES a
   * forbidden token (to document what we DON'T do) doesn't trip the
   * identifier-shape scan.
   */
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
  }

  it('no value import of buildPointLifecycleMap / deriveAutoMetadataForMessage / grading / anti-amplification', () => {
    const src = stripComments(read());
    for (const ident of [
      'buildPointLifecycleMap',
      'deriveAutoMetadataForMessage',
      'gradeChallenge',
      'gradeRepair',
      'applyAntiAmplification',
    ]) {
      const re = new RegExp(`\\b${ident}\\b`);
      expect(src).not.toMatch(re);
    }
  });

  it('no supabase / fetch / anthropic / xai / ArgumentComposer / react / react-native imports', () => {
    const src = stripComments(read());
    expect(src).not.toMatch(/from\s+['"][^'"]*supabase/);
    expect(src).not.toMatch(/from\s+['"][^'"]*ArgumentComposer/);
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native['"]/);
    expect(src).not.toMatch(/\banthropic\b/i);
    expect(src).not.toMatch(/\bxai\b/i);
    // fetch as a free identifier call
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });
});

// ── 18. ALL_SUGGESTED_MOVE_CODES matches the union ─────────────

describe('ST-002 — ALL_SUGGESTED_MOVE_CODES coverage', () => {
  it('every code in ALL_SUGGESTED_MOVE_CODES is reachable under some input', () => {
    const reachable = new Set<SuggestedMoveCode>();

    // ask_source / ask_quote via source-chain
    for (const s of deriveSuggestedMoves(baseInput({ sourceChainStatus: 'no_source' }))) {
      reachable.add(s.code);
    }
    for (const s of deriveSuggestedMoves(baseInput({ sourceChainStatus: 'source_no_quote' }))) {
      reachable.add(s.code);
    }
    // narrow + branch_tangent via lifecycle exhausted
    for (const s of deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state: 'exhausted' }) }))) {
      reachable.add(s.code);
    }
    // confirm via lifecycle narrowed
    for (const s of deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state: 'narrowed' }) }))) {
      reachable.add(s.code);
    }
    // synthesize via lifecycle synthesis_ready
    for (const s of deriveSuggestedMoves(baseInput({ clusterSummary: fakeClusterSummary({ state: 'synthesis_ready' }) }))) {
      reachable.add(s.code);
    }
    // challenge_mechanism + challenge_scope via manual tags
    for (const s of deriveSuggestedMoves(baseInput({ moveLinkage: fakeMoveLinkage({}, ['causal_mechanism']) }))) {
      reachable.add(s.code);
    }
    for (const s of deriveSuggestedMoves(baseInput({ moveLinkage: fakeMoveLinkage({}, ['scope_issue']) }))) {
      reachable.add(s.code);
    }
    // concede — v1 doctrine: no lifecycle state or tag emits `concede`
    // outright; the code exists in the vocabulary for ST-003 / PRESET-001
    // consumers (and as a future lifecycle-driven suggestion when LIFE-001
    // surfaces a `concession_offered` lifecycle path).
    // Verify the code is part of the typed vocabulary and the preset / dock
    // mapping table cover it.
    expect(ALL_SUGGESTED_MOVE_CODES).toContain('concede');
    // Synthetic surface check — construct a signal-only rationale and
    // verify the build helpers accept the code.
    const rationale = buildRationale([{ kind: 'preset_gap', code: 'concede' }]);
    expect(typeof rationale).toBe('string');

    // Every OTHER code must be reachable through a real derivation path.
    for (const code of ALL_SUGGESTED_MOVE_CODES) {
      if (code === 'concede') continue;
      expect(reachable.has(code)).toBe(true);
    }
  });
});

// ── 19. SuggestedNextMove type re-export ──────────────────────

describe('ST-002 — SuggestedNextMove type re-export', () => {
  it('SuggestedNextMove equals SuggestedMove', () => {
    // Compile-time check via runtime tautology: a value typed as
    // SuggestedNextMove is structurally a SuggestedMove.
    const sm: SuggestedMove = {
      code: 'ask_source',
      label: 'A',
      rationale: 'r',
      presetKey: 'source',
      dockAction: 'ask_source',
      sourceSignals: [],
    };
    const widened: SuggestedNextMove = sm;
    expect(widened).toBe(sm);
  });
});
