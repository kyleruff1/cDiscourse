/**
 * QOL-030 — Act popout content model tests.
 *
 * Design §9 test plan, `actPopoutModel` bullet — the 3-gate pipeline:
 *  - engine drops invalid types.
 *  - role drops forbidden entries.
 *  - **stage only re-orders, never removes** (the named doctrine test).
 *  - the §3.4 promotion table.
 *  - observer / own-bubble matrices.
 *
 * Full branch coverage of every public function (test-discipline: pure-TS
 * models get 100% branch coverage). Doctrine / ban-list also live in the
 * companion `oneBoxCopyBanList.test.ts`.
 */

import {
  buildActPopout,
  flattenActPopout,
  getPromotedEntry,
  ACT_GROUP_ORDER,
  ACT_GROUP_LABEL,
  ALL_ACT_VIEWER_ROLES,
  ALL_ACT_ENTRY_IDS,
  _debug,
  type ActEntryId,
  type ActViewerRole,
  type BuildActPopoutInput,
} from '../src/features/arguments/oneBox/actPopoutModel';
import type { ArgumentType, ConstitutionRule } from '../src/domain/constitution/types';
import { constitutionRules } from '../src/domain/constitution';
import { ALL_POINT_LIFECYCLE_STATES } from '../src/features/lifecycle';
import type { PointLifecycleState } from '../src/features/lifecycle';

// ── Fixture helpers ────────────────────────────────────────────

/**
 * A node-target popout input with sensible defaults.
 *
 * `parentType` / `stage` are read with an explicit `in` check, NOT `??`,
 * so a test can pass an explicit `null` (a root context / no stage)
 * without the nullish-coalescing default silently overriding it.
 */
function nodeInput(over: Partial<BuildActPopoutInput> = {}): BuildActPopoutInput {
  return {
    targetKind: over.targetKind ?? 'node',
    role: over.role ?? 'participant_other',
    stage: 'stage' in over ? (over.stage ?? null) : null,
    parentType: 'parentType' in over ? (over.parentType ?? null) : 'claim',
    rules: over.rules ?? constitutionRules,
  };
}

/** All entry ids present in a built popout. */
function entryIds(groups: ReturnType<typeof buildActPopout>): ActEntryId[] {
  return flattenActPopout(groups).map((e) => e.id);
}

// ── 1. Group ordering + labels ─────────────────────────────────

describe('QOL-030 actPopoutModel — groups', () => {
  it('exposes the 6-group order Respond..Role', () => {
    expect([...ACT_GROUP_ORDER]).toEqual([
      'respond',
      'evidence',
      'resolve',
      'structure',
      'direct',
      'role',
    ]);
  });

  it('every group has a plain-language label', () => {
    for (const g of ACT_GROUP_ORDER) {
      expect(ACT_GROUP_LABEL[g].length).toBeGreaterThan(0);
    }
  });

  it('built groups appear in ACT_GROUP_ORDER', () => {
    const groups = buildActPopout(nodeInput());
    const order = groups.map((g) => g.id);
    const expectedOrder = ACT_GROUP_ORDER.filter((g) => order.includes(g));
    expect(order).toEqual([...expectedOrder]);
  });

  it('exposes every viewer role', () => {
    expect([...ALL_ACT_VIEWER_ROLES].sort()).toEqual(
      ['observer', 'own_bubble', 'participant_other'].sort(),
    );
  });

  it('every candidate entry id is in the entry-definition table', () => {
    expect(ALL_ACT_ENTRY_IDS.length).toBeGreaterThan(0);
    for (const id of ALL_ACT_ENTRY_IDS) {
      expect(_debug.ACT_ENTRY_DEFINITIONS[id]).toBeDefined();
    }
  });
});

// ── 2. Gate 1 — engine gate (hard) ─────────────────────────────

describe('QOL-030 actPopoutModel — engine gate drops invalid child types', () => {
  it('a concession parent allows only synthesis children → reply/challenge dropped', () => {
    // Constitution v1: concession → [synthesis] only.
    const groups = buildActPopout(nodeInput({ parentType: 'concession' }));
    const ids = entryIds(groups);
    // `synthesize` (synthesis) survives.
    expect(ids).toContain('synthesize');
    // `reply` (claim) + `challenge` (rebuttal) + `clarify` are NOT valid
    // children of a concession → removed by the engine gate.
    expect(ids).not.toContain('reply');
    expect(ids).not.toContain('challenge');
    expect(ids).not.toContain('clarify');
  });

  it('a claim parent allows rebuttal/evidence/clarification/concession children', () => {
    const groups = buildActPopout(nodeInput({ parentType: 'claim' }));
    const ids = entryIds(groups);
    expect(ids).toContain('challenge'); // rebuttal — valid
    expect(ids).toContain('add_evidence'); // evidence — valid
    expect(ids).toContain('clarify'); // clarification_request — valid
    expect(ids).toContain('concede'); // concession — valid
    // `reply` produces a `claim`; a claim is NOT a valid child of a claim
    // in Constitution v1 → the engine gate removes it.
    expect(ids).not.toContain('reply');
  });

  it('a clarification_request parent allows claim children → reply survives', () => {
    // Constitution v1: clarification_request → [claim, evidence].
    const groups = buildActPopout(nodeInput({ parentType: 'clarification_request' }));
    const ids = entryIds(groups);
    expect(ids).toContain('reply'); // claim — valid here
    expect(ids).toContain('add_evidence'); // evidence — valid
    expect(ids).not.toContain('challenge'); // rebuttal — not valid here
  });

  it('challenge survives when EITHER rebuttal or counter_rebuttal is valid', () => {
    // rebuttal parent → counter_rebuttal is a valid child → challenge kept.
    const fromRebuttal = entryIds(buildActPopout(nodeInput({ parentType: 'rebuttal' })));
    expect(fromRebuttal).toContain('challenge');
  });

  it('null parent (root context) keeps only no-Constitution-type entries', () => {
    const groups = buildActPopout(nodeInput({ parentType: null }));
    const ids = entryIds(groups);
    // Typed entries (reply / challenge / add_evidence / clarify…) removed.
    expect(ids).not.toContain('reply');
    expect(ids).not.toContain('challenge');
    expect(ids).not.toContain('add_evidence');
    // Exempt entries (branch_tangent / view_qualifiers / role…) survive.
    for (const id of ids) {
      expect(_debug.ACT_ENTRY_DEFINITIONS[id].argumentType).toBeNull();
    }
  });

  it('empty rules → engine gate removes every typed entry (degraded fallback)', () => {
    const groups = buildActPopout(nodeInput({ rules: [] as ConstitutionRule[] }));
    const ids = entryIds(groups);
    for (const id of ids) {
      // With no transition table, only exempt entries survive.
      expect(_debug.ACT_ENTRY_DEFINITIONS[id].argumentType).toBeNull();
    }
  });

  it('exempt entries (argumentType null) are never engine-filtered', () => {
    // confirm / synthesize-set / branch_tangent / respond_to_concession
    // have null argumentType. branch_tangent must survive on every parent.
    for (const parentType of [
      'claim',
      'rebuttal',
      'evidence',
      'concession',
    ] as ArgumentType[]) {
      const ids = entryIds(buildActPopout(nodeInput({ parentType })));
      expect(ids).toContain('branch_tangent');
    }
  });

  it('the engine gate is skipped for a room target (no parent-child transition)', () => {
    const groups = buildActPopout(nodeInput({ targetKind: 'room', parentType: null }));
    expect(entryIds(groups)).toContain('make_private');
  });
});

// ── 3. Gate 2 — role gate (hard) ───────────────────────────────

describe('QOL-030 actPopoutModel — role gate (hard)', () => {
  it('observer flash menu is Watch / Join / Chime-in / Qualifiers only', () => {
    const groups = buildActPopout(nodeInput({ role: 'observer' }));
    const ids = entryIds(groups).sort();
    expect(ids).toEqual(['chime_in', 'join_against', 'join_for', 'view_qualifiers', 'watch'].sort());
    // No participant compose entries.
    expect(ids).not.toContain('reply');
    expect(ids).not.toContain('challenge');
    expect(ids).not.toContain('add_evidence');
  });

  it('own-bubble keeps ONLY qualifiers + request-deletion', () => {
    const groups = buildActPopout(nodeInput({ role: 'own_bubble' }));
    const ids = entryIds(groups).sort();
    expect(ids).toEqual(['request_deletion', 'view_qualifiers'].sort());
    // The own-bubble safety rule: no reply / challenge / flag / score on
    // your own move.
    expect(ids).not.toContain('reply');
    expect(ids).not.toContain('challenge');
    expect(ids).not.toContain('flag');
  });

  it('participant_other keeps the full participant set minus request_deletion', () => {
    const ids = entryIds(buildActPopout(nodeInput({ role: 'participant_other' })));
    expect(ids).toContain('challenge');
    expect(ids).toContain('add_evidence');
    expect(ids).toContain('flag');
    // request_deletion is an own-move action — never offered on another's
    // bubble.
    expect(ids).not.toContain('request_deletion');
  });

  it('own-bubble result holds no box-opening entries (qualifiers/deletion are direct)', () => {
    const flat = flattenActPopout(buildActPopout(nodeInput({ role: 'own_bubble' })));
    for (const e of flat) {
      expect(e.kind).not.toBe('box_opening');
      expect(e.opensBoxType).toBeNull();
    }
  });

  it('observer entries are all role-change or direct (never box-opening)', () => {
    const flat = flattenActPopout(buildActPopout(nodeInput({ role: 'observer' })));
    for (const e of flat) {
      expect(e.kind).not.toBe('box_opening');
    }
  });
});

// ── 4. Gate 3 — stage gate (soft) — THE DOCTRINE TEST ──────────

describe('QOL-030 actPopoutModel — stage gate ONLY orders, never removes (doctrine)', () => {
  it('a stage NEVER removes an entry the hard gates kept — every stage', () => {
    // The doctrine-critical test: for EVERY lifecycle stage, the entry
    // SET is identical to the no-stage result; only the ORDER may differ.
    const base = nodeInput({ stage: null });
    const noStageIds = new Set(entryIds(buildActPopout(base)));
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const stagedIds = new Set(entryIds(buildActPopout(nodeInput({ stage }))));
      expect(stagedIds).toEqual(noStageIds);
    }
  });

  it('a stage never enables an entry the engine gate removed', () => {
    // A concession parent removes `reply`. No stage may resurrect it.
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const ids = entryIds(buildActPopout(nodeInput({ parentType: 'concession', stage })));
      expect(ids).not.toContain('reply');
    }
  });

  it('a stage never enables an entry the role gate removed', () => {
    // own-bubble removes `challenge`. No stage may resurrect it.
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const ids = entryIds(buildActPopout(nodeInput({ role: 'own_bubble', stage })));
      expect(ids).not.toContain('challenge');
    }
  });

  it('the §3.4 table: source_requested promotes Add evidence', () => {
    const groups = buildActPopout(nodeInput({ stage: 'source_requested' }));
    const promoted = getPromotedEntry(groups);
    expect(promoted?.id).toBe('add_evidence');
    expect(promoted?.isPromoted).toBe(true);
  });

  it('the §3.4 table: synthesis_ready promotes Synthesize', () => {
    // `synthesize` produces a `synthesis` move — valid only off a
    // `concession` parent in Constitution v1. The parent must allow it
    // for the soft gate to promote it (the stage gate never resurrects a
    // hard-gate-filtered entry).
    const promoted = getPromotedEntry(
      buildActPopout(nodeInput({ stage: 'synthesis_ready', parentType: 'concession' })),
    );
    expect(promoted?.id).toBe('synthesize');
  });

  it('the §3.4 table: narrowed promotes Confirm', () => {
    const promoted = getPromotedEntry(buildActPopout(nodeInput({ stage: 'narrowed' })));
    expect(promoted?.id).toBe('confirm');
  });

  it('the §3.4 table: exhausted promotes Open a side issue (branch)', () => {
    const promoted = getPromotedEntry(buildActPopout(nodeInput({ stage: 'exhausted' })));
    expect(promoted?.id).toBe('branch_tangent');
  });

  it('the §3.4 table: open promotes Reply', () => {
    const promoted = getPromotedEntry(buildActPopout(nodeInput({
      stage: 'open',
      parentType: 'clarification_request', // so `reply` survives the engine gate
    })));
    expect(promoted?.id).toBe('reply');
  });

  it('the promoted entry is first in its group', () => {
    const groups = buildActPopout(nodeInput({ stage: 'synthesis_ready', parentType: 'concession' }));
    const resolveGroup = groups.find((g) => g.id === 'resolve');
    expect(resolveGroup?.entries[0]?.id).toBe('synthesize');
  });

  it('archived_or_resolved promotes nothing (read-only node)', () => {
    const promoted = getPromotedEntry(buildActPopout(nodeInput({ stage: 'archived_or_resolved' })));
    expect(promoted).toBeNull();
  });

  it('no promotion when the promoted entry was filtered by a hard gate', () => {
    // source_requested promotes `add_evidence`; own-bubble removes it.
    // The stage gate must NOT resurrect it — promotion silently no-ops.
    const groups = buildActPopout(nodeInput({ role: 'own_bubble', stage: 'source_requested' }));
    expect(getPromotedEntry(groups)).toBeNull();
  });

  it('a null stage promotes nothing', () => {
    expect(getPromotedEntry(buildActPopout(nodeInput({ stage: null })))).toBeNull();
  });

  it('exactly one entry is ever promoted', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const flat = flattenActPopout(buildActPopout(nodeInput({ stage })));
      const promotedCount = flat.filter((e) => e.isPromoted).length;
      expect(promotedCount).toBeLessThanOrEqual(1);
    }
  });
});

// ── 5. Target-kind enumeration ─────────────────────────────────

describe('QOL-030 actPopoutModel — target-kind enumeration', () => {
  it('a room target offers make-private', () => {
    const ids = entryIds(buildActPopout(nodeInput({ targetKind: 'room' })));
    expect(ids).toEqual(['make_private']);
  });

  it('a concessionSet target offers respond-to-concession + synthesize', () => {
    const ids = entryIds(buildActPopout(nodeInput({ targetKind: 'concessionSet' })));
    expect(ids).toContain('respond_to_concession');
    expect(ids).toContain('synthesize');
  });

  it('an evidenceObject target offers respond-to-evidence', () => {
    const ids = entryIds(buildActPopout(nodeInput({ targetKind: 'evidenceObject' })));
    expect(ids).toContain('respond_to_evidence');
  });

  it('a branch target offers reply / challenge / branch_tangent (engine-gated)', () => {
    // A branch off a claim node — the engine gate uses the parent type.
    const ids = entryIds(buildActPopout(nodeInput({ targetKind: 'branch', parentType: 'claim' })));
    expect(ids).toContain('branch_tangent');
    expect(ids).toContain('challenge'); // rebuttal valid off a claim
  });

  it('an unknown target kind yields an empty popout', () => {
    const groups = buildActPopout(
      nodeInput({ targetKind: 'bogus' as BuildActPopoutInput['targetKind'] }),
    );
    expect(groups).toEqual([]);
  });
});

// ── 6. Empty-result edge case (design §8) ──────────────────────

describe('QOL-030 actPopoutModel — empty / degraded results', () => {
  it('observer + a room target → no entries (observer cannot make a room private)', () => {
    // make_private is direct; observer role keeps neither it nor anything
    // else in the room candidate set → the box does not open.
    const groups = buildActPopout(nodeInput({ targetKind: 'room', role: 'observer' }));
    expect(flattenActPopout(groups)).toHaveLength(0);
  });

  it('flattenActPopout of an empty result is an empty array', () => {
    expect(flattenActPopout([])).toEqual([]);
  });

  it('getPromotedEntry of an empty result is null', () => {
    expect(getPromotedEntry([])).toBeNull();
  });
});

// ── 7. Determinism / purity ────────────────────────────────────

describe('QOL-030 actPopoutModel — determinism', () => {
  it('buildActPopout is idempotent for identical input', () => {
    const input = nodeInput({ stage: 'rebutted' });
    expect(JSON.stringify(buildActPopout(input))).toBe(JSON.stringify(buildActPopout(input)));
  });

  it('buildActPopout does not mutate its input', () => {
    const input = nodeInput({ stage: 'open' });
    const snapshot = JSON.stringify(input);
    buildActPopout(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// ── 8. Internal gate helpers (direct branch coverage) ──────────

describe('QOL-030 actPopoutModel — internal gate helpers', () => {
  it('applyRoleGate observer keeps only OBSERVER_ALLOWED', () => {
    const all = [...ALL_ACT_ENTRY_IDS];
    const kept = _debug.applyRoleGate(all, 'observer' as ActViewerRole);
    for (const id of kept) expect(_debug.OBSERVER_ALLOWED.has(id)).toBe(true);
  });

  it('applyRoleGate own_bubble keeps only OWN_BUBBLE_ALLOWED', () => {
    const all = [...ALL_ACT_ENTRY_IDS];
    const kept = _debug.applyRoleGate(all, 'own_bubble' as ActViewerRole);
    for (const id of kept) expect(_debug.OWN_BUBBLE_ALLOWED.has(id)).toBe(true);
  });

  it('applyEngineGate with a null parent keeps only exempt entries', () => {
    const kept = _debug.applyEngineGate([...ALL_ACT_ENTRY_IDS], null, constitutionRules);
    for (const id of kept) {
      expect(_debug.ACT_ENTRY_DEFINITIONS[id].argumentType).toBeNull();
    }
  });

  it('applyStageGate with a null stage leaves the order untouched', () => {
    const ids: ActEntryId[] = ['reply', 'challenge', 'clarify'];
    const { ordered, promoted } = _debug.applyStageGate(ids, null);
    expect(ordered).toEqual(ids);
    expect(promoted).toBeNull();
  });

  it('applyStageGate moves the promoted entry to the front', () => {
    const ids: ActEntryId[] = ['reply', 'add_evidence', 'clarify'];
    const { ordered, promoted } = _debug.applyStageGate(ids, 'source_requested');
    expect(ordered[0]).toBe('add_evidence');
    expect(promoted).toBe('add_evidence');
  });

  it('applyStageGate does not promote an entry absent from the list', () => {
    // `source_requested` promotes `add_evidence`; if it is not present the
    // gate must not invent it.
    const ids: ActEntryId[] = ['reply', 'clarify'];
    const { ordered, promoted } = _debug.applyStageGate(ids, 'source_requested');
    expect(ordered).toEqual(ids);
    expect(promoted).toBeNull();
  });

  it('every lifecycle state either promotes a known entry id or nothing', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const promoted = _debug.STAGE_PROMOTED_ENTRY[stage as PointLifecycleState];
      if (promoted !== undefined) {
        expect(ALL_ACT_ENTRY_IDS).toContain(promoted);
      }
    }
  });
});
