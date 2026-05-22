/**
 * QOL-030 — Narrative-replay tests.
 *
 * Design §9 test plan: "Narrative replay tests — Scenario 1 frames F1–F14
 * and Scenario 2 F1–F10 reproduced: given the selected node + stage,
 * assert the expected box type and flash-menu top entry."
 *
 * The QOL-030 design is *derived, not asserted* (design §0): every box
 * type and every flash-menu rule exists because a storyboard frame
 * demanded it. This suite is that derivation's end-to-end proof — it walks
 * the two storyboards frame by frame and, for each frame, asserts:
 *
 *   1. the expected box `(type · schema kind)` from `switchBoxType` +
 *      `renderSchema` (the §3–§5 box-model derivation), and
 *   2. the expected flash-menu top entry from
 *      `getPromotedEntry(buildActPopout(...))` (the §3.4 soft-gate table),
 *
 * given the frame's selected target kind, LIFE-001 stage, viewer role and
 * parent Constitution type.
 *
 * Storyboards replayed:
 *  - Scenario 1 — `docs/ux-storyboards/roommates-dishes-public-argument.md`
 *    (design §4 frame table F1–F14).
 *  - Scenario 2 — `docs/ux-storyboards/band-space-rent-private-evidence-argument.md`
 *    (design §5 frame table F1–F10).
 *
 * Box-type derivation (`switchBoxType` / `renderSchema`) is parent-type
 * INDEPENDENT — it asserts the §3–§5 model exactly. The promoted-entry
 * assertion uses the frame's honest parent type; where the §3.4 promoted
 * entry would be engine-filtered for that parent (e.g. `reply` produces a
 * `claim`, valid only off a `clarification_request`), the frame notes it
 * and asserts the box opens via a `respond`-group entry that survives —
 * the design's "promotes Respond" intent — rather than asserting a
 * resurrected entry the hard gate correctly removed.
 *
 * Pure-TS — no React, no Supabase, no network. The `OneBox` component is
 * deliberately NOT imported (it value-imports AsyncStorage); the two pure
 * models carry the whole §3–§5 derivation under test.
 */
import {
  createBoxState,
  switchBoxType,
  renderSchema,
  type BoxType,
  type SchemaKind,
} from '../src/features/arguments/oneBox/boxModel';
import {
  buildActPopout,
  getPromotedEntry,
  flattenActPopout,
  type ActEntryId,
  type ActTargetKind,
  type ActViewerRole,
  type BuildActPopoutInput,
} from '../src/features/arguments/oneBox/actPopoutModel';
import type { ArgumentType, ConstitutionRule } from '../src/domain/constitution/types';
import { constitutionRules } from '../src/domain/constitution';
import type { PointLifecycleState } from '../src/features/lifecycle';

// ── Frame model ────────────────────────────────────────────────

/**
 * A single storyboard frame as the QOL-030 models see it.
 *
 *  - `boxType` / `schemaKind` — what `switchBoxType` + `renderSchema`
 *    must produce for the frame's move. `null` when the frame opens NO
 *    box (a direct-entry frame: governance / make-private / settle).
 *  - `targetKind` — the Act-popout target kind for the frame.
 *  - `role` / `stage` / `parentType` — the three gate inputs.
 *  - `promotedEntry` — the flash-menu top entry `getPromotedEntry` must
 *    return; `null` when the frame promotes nothing (no stage, observer
 *    menu, room target, read-only node).
 *  - `mustOfferEntry` — an entry id that MUST appear in the built popout
 *    (the box-opening entry for the frame's move, when the promoted entry
 *    is engine-filtered for the honest parent type).
 */
interface Frame {
  id: string;
  who: string;
  selected: string;
  boxType: BoxType | null;
  schemaKind: SchemaKind | null;
  targetKind: ActTargetKind;
  role: ActViewerRole;
  stage: PointLifecycleState | null;
  parentType: ArgumentType | null;
  promotedEntry: ActEntryId | null;
  mustOfferEntry?: ActEntryId;
  note?: string;
}

const RULES: ConstitutionRule[] = constitutionRules;

function popoutInput(f: Frame): BuildActPopoutInput {
  return {
    targetKind: f.targetKind,
    role: f.role,
    stage: f.stage,
    parentType: f.parentType,
    rules: RULES,
  };
}

// ── Scenario 1 — Roommates / dishes (public) ───────────────────
//
// design §4 frame table. The room is public; A + B are primaries,
// C is an observer who chimes in.

const SCENARIO_1: Frame[] = [
  {
    id: 'F1',
    who: 'A',
    selected: 'new room — root claim',
    // F1 both scenarios — the root box: free body + room setup.
    boxType: 'root_claim',
    schemaKind: 'free_body',
    // The root claim configures the room — a `room` target.
    targetKind: 'room',
    role: 'participant_other',
    stage: null,
    parentType: null,
    // A room target promotes nothing — make-private is its only entry.
    promotedEntry: null,
    note: 'Root is the only type; the box also configures the room.',
  },
  {
    id: 'F2',
    who: 'B',
    selected: 'Node 1 · open',
    // F2 Scenario 1 — the composite `respond`: concession list + body.
    boxType: 'respond',
    schemaKind: 'composite',
    targetKind: 'node',
    role: 'participant_other',
    stage: 'open',
    // Node 1 is A's root claim — a `claim`.
    parentType: 'claim',
    // §3.4: `open` promotes Reply. `reply` produces a `claim`; a claim is
    // not a valid child of a claim → the engine gate removes `reply`, so
    // no promotion. The `respond` box still opens via `challenge` (also a
    // `respond`-group box-opening entry) — the design's "promotes Respond".
    promotedEntry: null,
    mustOfferEntry: 'challenge',
    note: 'open→Reply, but reply(claim) is engine-filtered off a claim parent.',
  },
  {
    id: 'F3',
    who: 'A',
    selected: "Node 2 · rebutted — B's concession set",
    // F3 Scenario 1 — respond_to_concession: a forced list mirroring the
    // concession set, row-for-row.
    boxType: 'respond_to_concession',
    schemaKind: 'forced_list',
    // The target is a concession SET, not a node (finding F3).
    targetKind: 'concessionSet',
    role: 'participant_other',
    stage: 'rebutted',
    // A concession set has no parent-child transition — engine gate
    // skipped for a concessionSet target.
    parentType: null,
    // A non-node target promotes nothing (the stage gate is node-scoped).
    promotedEntry: null,
    mustOfferEntry: 'respond_to_concession',
    note: 'Target is a concession set; respond_to_concession is offered.',
  },
  {
    id: 'F4',
    who: 'B',
    selected: 'Node 3 · rebutted',
    boxType: 'respond',
    schemaKind: 'composite',
    targetKind: 'node',
    role: 'participant_other',
    stage: 'rebutted',
    // Node 3 is A's concession-acceptance + fact disagreement — a
    // rebuttal-shaped move.
    parentType: 'rebuttal',
    // §3.4: `rebutted` promotes Reply. `reply`(claim) is not a valid child
    // of a rebuttal → engine-filtered; `challenge` (counter_rebuttal off a
    // rebuttal) survives and opens the `respond` box.
    promotedEntry: null,
    mustOfferEntry: 'challenge',
  },
  {
    id: 'F5',
    who: 'Observer C',
    selected: 'Node 4 · open — chime in',
    // F5 Scenario 1 — a chime-in opens no compose box; it is a role-change
    // entry (the observer menu). The chime-in's TARGET is a branch off a
    // node (finding F5).
    boxType: null,
    schemaKind: null,
    targetKind: 'node',
    role: 'observer',
    stage: 'open',
    parentType: 'claim',
    // Observer menu — Watch / Join / Chime in. None is stage-promoted
    // (the §3.4 promoted entries are all participant box-opening moves
    // that the observer role gate removes).
    promotedEntry: null,
    mustOfferEntry: 'chime_in',
    note: 'Observer flash menu = participation actions, never compose types.',
  },
  {
    id: 'F6',
    who: 'A & B',
    selected: 'chime-in node — governance',
    // F6 — governance reactions are DIRECT entries; no box opens.
    boxType: null,
    schemaKind: null,
    targetKind: 'node',
    role: 'participant_other',
    stage: 'open',
    parentType: 'claim',
    promotedEntry: null,
    // `flag` (Send for review) is the shipped direct governance entry on
    // the QOL-030 chassis — the chime-in disposition set lands with
    // GAME-005 / QOL-031.
    mustOfferEntry: 'flag',
    note: 'Governance reactions are direct flash-menu entries — no box.',
  },
  {
    id: 'F7',
    who: 'A',
    selected: 'room — make private',
    // F7 — make-private is a DIRECT entry on the ROOM target. No box.
    boxType: null,
    schemaKind: null,
    targetKind: 'room',
    role: 'participant_other',
    stage: null,
    parentType: null,
    promotedEntry: null,
    mustOfferEntry: 'make_private',
    note: 'room is a first-class target; make-private is a direct entry.',
  },
  {
    id: 'F8',
    who: 'A',
    selected: 'Node 4 · (mainline)',
    boxType: 'respond',
    schemaKind: 'composite',
    targetKind: 'node',
    role: 'participant_other',
    // Node 4 is B's mainline response — answered once A replies; here A is
    // about to respond, so the node A selects is `open` to A's next move.
    stage: 'open',
    // Node 4 is B's response on the dishes line — a rebuttal-shaped move.
    parentType: 'rebuttal',
    promotedEntry: null,
    mustOfferEntry: 'challenge',
  },
  {
    id: 'F9',
    who: 'B',
    selected: 'Node 5',
    boxType: 'respond',
    schemaKind: 'composite',
    targetKind: 'node',
    role: 'participant_other',
    stage: 'open',
    // Node 5 is A's concession + refutation — a rebuttal-shaped move.
    parentType: 'rebuttal',
    promotedEntry: null,
    mustOfferEntry: 'challenge',
  },
  {
    id: 'F10',
    who: 'A',
    selected: 'Node 6 — Touché + flag tangent',
    // F10 — Touché + flag-tangent are DIRECT entries; no box.
    boxType: null,
    schemaKind: null,
    targetKind: 'node',
    role: 'participant_other',
    stage: 'rebutted',
    parentType: 'rebuttal',
    promotedEntry: null,
    // The "door unlocked" tangent splits via the structural branch entry.
    mustOfferEntry: 'branch_tangent',
    note: 'Touché + tangent-split are direct / structural — no compose box.',
  },
  {
    id: 'F11',
    who: 'B',
    selected: 'tangent node',
    // F11 — a normal response, this time on the tangent branch.
    boxType: 'respond',
    schemaKind: 'composite',
    // The move is on a branch — a `branch` target.
    targetKind: 'branch',
    role: 'participant_other',
    stage: 'open',
    // The tangent root ("door unlocked") is a fresh claim.
    parentType: 'claim',
    // §3.4: `open` promotes Reply; reply(claim) off a claim is engine-
    // filtered → `challenge` carries the `respond` box.
    promotedEntry: null,
    mustOfferEntry: 'challenge',
  },
  {
    id: 'F12',
    who: 'A',
    selected: 'tangent — fist-bump',
    // F12 — fist-bump acknowledge is a DIRECT entry; no box.
    boxType: null,
    schemaKind: null,
    targetKind: 'branch',
    role: 'participant_other',
    stage: 'rebutted',
    parentType: 'claim',
    promotedEntry: null,
    note: 'Fist-bump is a direct reaction — no compose box.',
  },
  {
    id: 'F13-F14',
    who: 'B, A',
    selected: 'mainline — summary + settle',
    // F13–F14 — summary + settle are DIRECT; the room locks. No box.
    boxType: null,
    schemaKind: null,
    targetKind: 'node',
    role: 'participant_other',
    // The settled mainline node is read-only — archived_or_resolved.
    stage: 'archived_or_resolved',
    parentType: 'rebuttal',
    // §3.4: archived_or_resolved promotes NOTHING (read-only — no box).
    promotedEntry: null,
    note: 'Settle locks the board; a resolved node promotes nothing.',
  },
];

// ── Scenario 2 — Band / rent (private, evidence) ───────────────
//
// design §5 frame table. The room is private from F1; A + B are primaries;
// the dispute is evidence applicability.

const SCENARIO_2: Frame[] = [
  {
    id: 'F1',
    who: 'A',
    selected: 'new room — root claim (private)',
    // F1 — the root box; visibility = private is set inside the box.
    boxType: 'root_claim',
    schemaKind: 'free_body',
    targetKind: 'room',
    role: 'participant_other',
    stage: null,
    parentType: null,
    promotedEntry: null,
    note: 'root_claim carries room setup — incl. private visibility.',
  },
  {
    id: 'F2',
    who: 'B',
    selected: 'Node 1 · open — attach evidence',
    // F2 Scenario 2 — add_evidence is a STRUCTURED FORM (the QOL-036
    // payment fields) — a different schema kind from `respond`.
    boxType: 'add_evidence',
    schemaKind: 'structured_form',
    targetKind: 'node',
    role: 'participant_other',
    stage: 'open',
    // Node 1 is A's root claim — a `claim`. `evidence` IS a valid child
    // of a claim → the `add_evidence` entry survives the engine gate.
    parentType: 'claim',
    // §3.4: `open` promotes Reply (engine-filtered off a claim) — no
    // promotion; the structured `add_evidence` entry is what F2 needs.
    promotedEntry: null,
    mustOfferEntry: 'add_evidence',
    note: 'add_evidence is a structured form — the box renders more than a body.',
  },
  {
    id: 'F3',
    who: 'A',
    selected: 'Node 2 · sourced — respond to evidence',
    // F3 Scenario 2 — respond_to_evidence: a structured choice set +
    // required clarification. Targets an evidence OBJECT (finding F3).
    boxType: 'respond_to_evidence',
    schemaKind: 'structured_form',
    targetKind: 'evidenceObject',
    role: 'participant_other',
    // Node 2 is evidence-backed → its lifecycle stage is `sourced`.
    stage: 'sourced',
    // An evidence object has no parent-child transition — engine gate
    // skipped for an evidenceObject target.
    parentType: null,
    // A non-node target promotes nothing.
    promotedEntry: null,
    mustOfferEntry: 'respond_to_evidence',
    note: 'Evidence status (applicability_disputed) is on the object, not the node.',
  },
  {
    id: 'F4',
    who: 'B',
    selected: 'Node 3 · rebutted',
    // F4 — a normal agree-with-caveat response.
    boxType: 'respond',
    schemaKind: 'composite',
    targetKind: 'node',
    role: 'participant_other',
    stage: 'rebutted',
    // Node 3 is A's evidence-applicability challenge — a rebuttal.
    parentType: 'rebuttal',
    promotedEntry: null,
    mustOfferEntry: 'challenge',
  },
  {
    id: 'F5',
    who: 'A',
    selected: 'Node 4 — ask for a source',
    // F5 Scenario 2 — ask_source: a short targeted prompt (a distinct
    // schema kind — `structured_form` with a short_prompt section).
    boxType: 'ask_source',
    schemaKind: 'structured_form',
    targetKind: 'node',
    role: 'participant_other',
    // Node 4 is B's caveat — `open` to A's ask.
    stage: 'open',
    // Node 4 (B's agree-with-caveat) is a rebuttal-shaped move; an
    // `ask_source` entry produces a `clarification_request`, a valid
    // child of a rebuttal → it survives the engine gate.
    parentType: 'rebuttal',
    promotedEntry: null,
    mustOfferEntry: 'ask_source',
    note: 'Ask-source is a short prompt box; it moves Node 4 to source_requested.',
  },
  {
    id: 'F6',
    who: 'B',
    selected: 'Node 4 · source_requested — add evidence',
    // F6 Scenario 2 — the node-stage-driven design end to end: A's
    // ask_source moved Node 4 to `source_requested`; §3.4 promotes
    // "Add evidence" for that stage, so B's box practically pre-selects.
    boxType: 'add_evidence',
    schemaKind: 'structured_form',
    targetKind: 'node',
    role: 'participant_other',
    stage: 'source_requested',
    // Node 4 is B's caveat — a rebuttal; `evidence` is a valid child of a
    // rebuttal → the promoted `add_evidence` entry survives the gates.
    parentType: 'rebuttal',
    // §3.4: `source_requested` promotes `add_evidence` — and it survives.
    promotedEntry: 'add_evidence',
    mustOfferEntry: 'add_evidence',
    note: 'source_requested → the stage drives the flash menu directly (design §5.1).',
  },
  {
    id: 'F7',
    who: 'A',
    selected: 'Node 4 · sourced — respond to concession + refutation',
    // F7 — respond_to_concession against the now-sourced caveat, plus a
    // refutation on the amount (a forced list mirroring the concessions).
    boxType: 'respond_to_concession',
    schemaKind: 'forced_list',
    targetKind: 'concessionSet',
    role: 'participant_other',
    stage: 'sourced',
    parentType: null,
    promotedEntry: null,
    mustOfferEntry: 'respond_to_concession',
  },
  {
    id: 'F8',
    who: 'B',
    selected: 'Node 5 — respond to evidence + add evidence',
    // F8 — a disagree-context response to evidence (the headline move is
    // the structured evidence response).
    boxType: 'respond_to_evidence',
    schemaKind: 'structured_form',
    targetKind: 'evidenceObject',
    role: 'participant_other',
    stage: 'sourced',
    parentType: null,
    promotedEntry: null,
    mustOfferEntry: 'respond_to_evidence',
  },
  {
    id: 'F9',
    who: 'A',
    selected: 'Node 6 · sourced — accept evidence + summary',
    // F9 — accept-evidence is a DIRECT entry; the summary settles the
    // room. No compose box for the accept itself.
    boxType: null,
    schemaKind: null,
    targetKind: 'evidenceObject',
    role: 'participant_other',
    stage: 'sourced',
    parentType: null,
    promotedEntry: null,
    note: 'Accept-evidence is a direct disposition — no compose box.',
  },
  {
    id: 'F10',
    who: 'B',
    selected: 'room — confirm resolution',
    // F10 — confirm-resolution is a DIRECT entry on the room; the room
    // locks. No box.
    boxType: null,
    schemaKind: null,
    targetKind: 'room',
    role: 'participant_other',
    stage: null,
    parentType: null,
    promotedEntry: null,
    note: 'Confirm-resolution locks the room — a direct entry, no box.',
  },
];

// ── Replay assertions ──────────────────────────────────────────

/**
 * Asserts the box-type derivation for a frame: `switchBoxType` re-types a
 * fresh box, and `renderSchema` returns the design's schema kind. Box-type
 * derivation is parent-type INDEPENDENT — it proves the §3–§5 model.
 */
function assertBoxType(f: Frame): void {
  if (f.boxType === null) {
    // A direct-entry frame opens NO box — nothing to derive.
    expect(f.schemaKind).toBeNull();
    return;
  }
  const typed = switchBoxType(createBoxState(), f.boxType);
  expect(typed.type).toBe(f.boxType);
  const schema = renderSchema(typed.type, typed.target);
  expect(schema.type).toBe(f.boxType);
  expect(schema.kind).toBe(f.schemaKind);
}

/**
 * Asserts the flash-menu derivation for a frame: `buildActPopout` over the
 * three gates, then `getPromotedEntry` for the §3.4 top entry, and
 * `mustOfferEntry` (when present) is in the built popout.
 */
function assertFlashMenu(f: Frame): void {
  const groups = buildActPopout(popoutInput(f));
  const promoted = getPromotedEntry(groups);
  expect(promoted?.id ?? null).toBe(f.promotedEntry);
  if (f.promotedEntry !== null) {
    expect(promoted?.isPromoted).toBe(true);
  }
  if (f.mustOfferEntry !== undefined) {
    const ids = flattenActPopout(groups).map((e) => e.id);
    expect({ frame: f.id, offers: f.mustOfferEntry, present: ids.includes(f.mustOfferEntry) }).toEqual(
      { frame: f.id, offers: f.mustOfferEntry, present: true },
    );
  }
}

describe('QOL-030 narrative replay — Scenario 1 (roommates / dishes, public)', () => {
  it('replays exactly the 13 design §4 frames F1–F14', () => {
    expect(SCENARIO_1.map((f) => f.id)).toEqual([
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13-F14',
    ]);
  });

  for (const f of SCENARIO_1) {
    describe(`${f.id} — ${f.who} · ${f.selected}`, () => {
      it(`box type = ${f.boxType ?? '(none — direct entry)'}`, () => {
        assertBoxType(f);
      });

      it(`flash-menu top entry = ${f.promotedEntry ?? '(none)'}`, () => {
        assertFlashMenu(f);
      });
    });
  }
});

describe('QOL-030 narrative replay — Scenario 2 (band / rent, private, evidence)', () => {
  it('replays exactly the 10 design §5 frames F1–F10', () => {
    expect(SCENARIO_2.map((f) => f.id)).toEqual([
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10',
    ]);
  });

  for (const f of SCENARIO_2) {
    describe(`${f.id} — ${f.who} · ${f.selected}`, () => {
      it(`box type = ${f.boxType ?? '(none — direct entry)'}`, () => {
        assertBoxType(f);
      });

      it(`flash-menu top entry = ${f.promotedEntry ?? '(none)'}`, () => {
        assertFlashMenu(f);
      });
    });
  }
});

// ── Cross-cutting derivation checks ────────────────────────────

describe('QOL-030 narrative replay — derivation invariants', () => {
  const ALL_FRAMES = [...SCENARIO_1, ...SCENARIO_2];

  it('every frame that opens a box names a real BoxType + a renderable schema', () => {
    for (const f of ALL_FRAMES) {
      if (f.boxType === null) continue;
      const schema = renderSchema(switchBoxType(createBoxState(), f.boxType).type, createBoxState().target);
      // The schema kind a frame asserts must be the model's actual kind.
      expect({ frame: f.id, kind: schema.kind }).toEqual({ frame: f.id, kind: f.schemaKind });
    }
  });

  it('Scenario 1 F2 forces the composite `respond` box (design §4.1 finding F2)', () => {
    // The headline finding: B's move is concessions (a list) AND a
    // refutation (a body) — one composite box, not two types.
    const f2 = SCENARIO_1.find((f) => f.id === 'F2');
    expect(f2?.boxType).toBe('respond');
    const schema = renderSchema('respond', createBoxState().target);
    expect(schema.kind).toBe('composite');
    expect(schema.sections).toContain('concession_list');
    expect(schema.sections).toContain('body');
  });

  it('Scenario 2 F2 forces a structured-form box (design §5.1 finding)', () => {
    // The box must render structured forms, not only bodies + lists.
    const f2 = SCENARIO_2.find((f) => f.id === 'F2');
    expect(f2?.boxType).toBe('add_evidence');
    expect(renderSchema('add_evidence', createBoxState().target).kind).toBe('structured_form');
  });

  it('Scenario 2 F6 proves the node-stage-driven flash menu end to end', () => {
    // F5 ask_source → Node 4 `source_requested`; §3.4 promotes Add
    // evidence; F6 builds the popout for that stage and the promotion
    // survives the hard gates (evidence is a valid child of a rebuttal).
    const f6 = SCENARIO_2.find((f) => f.id === 'F6')!;
    const promoted = getPromotedEntry(buildActPopout(popoutInput(f6)));
    expect(promoted?.id).toBe('add_evidence');
    expect(promoted?.isPromoted).toBe(true);
  });

  it('the root_claim box is the only box that configures the room (F1 both scenarios)', () => {
    for (const root of ['root_claim'] as BoxType[]) {
      expect(renderSchema(root, createBoxState().target).configuresRoom).toBe(true);
    }
    // No other box type configures the room.
    for (const f of ALL_FRAMES) {
      if (f.boxType === null || f.boxType === 'root_claim') continue;
      expect({
        frame: f.id,
        type: f.boxType,
        configuresRoom: renderSchema(f.boxType, createBoxState().target).configuresRoom,
      }).toEqual({ frame: f.id, type: f.boxType, configuresRoom: false });
    }
  });

  it('every direct-entry frame opens no box and promotes nothing', () => {
    // F6 / F7 / F10 / F12 / F13-F14 (Scenario 1) and F9 / F10 (Scenario 2)
    // are direct / settle frames — the design §4 findings F6/F7/F10/F12.
    const directFrames = ALL_FRAMES.filter((f) => f.boxType === null);
    expect(directFrames.length).toBeGreaterThanOrEqual(7);
    for (const f of directFrames) {
      expect({ frame: f.id, schema: f.schemaKind }).toEqual({ frame: f.id, schema: null });
      expect({ frame: f.id, promoted: f.promotedEntry }).toEqual({ frame: f.id, promoted: null });
    }
  });

  it('the observer frame (S1 F5) offers only participation entries — no compose box', () => {
    const f5 = SCENARIO_1.find((f) => f.id === 'F5')!;
    const flat = flattenActPopout(buildActPopout(popoutInput(f5)));
    expect(flat.length).toBeGreaterThan(0);
    for (const e of flat) {
      // Observer entries are role-change or direct — never box-opening.
      expect(e.kind).not.toBe('box_opening');
    }
  });

  it('a resolved/settled node (S1 F13-F14) promotes nothing — read-only', () => {
    const f = SCENARIO_1.find((fr) => fr.id === 'F13-F14')!;
    expect(getPromotedEntry(buildActPopout(popoutInput(f)))).toBeNull();
  });
});
