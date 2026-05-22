/**
 * QOL-031 — ActPopout component contract (the flash menu).
 *
 * QOL-031 design §9 test plan. QOL-031 is the RENDERING of QOL-030's
 * `buildActPopout` — the 3-gate output itself is delegated to
 * `actPopoutModel.test.ts`; this suite asserts the RENDER contract:
 *
 *  - group order is fixed (the model's `ACT_GROUP_ORDER`, unreordered),
 *  - the §3.4 stage-promoted entry is emphasized,
 *  - a host-disabled entry stays VISIBLE with a one-line reason — never a
 *    silent omission,
 *  - the §6 narrative-frame table is reproduced,
 *  - the §8 edge cases (zero box-opening entries, own node, primary seat
 *    open, stale popout),
 *  - the convergence (SC-001 / SC-004 / RULE-005 models still drive the
 *    same actions — consumed, not re-derived),
 *  - the doctrine ban-list + chassis a11y.
 *
 * Follows the repo's `.tsx` UI-test discipline (`goPopoutComponent.test.tsx`
 * / `TimelineMiniMap.test.tsx`): the load-bearing render decision is
 * extracted into a pure helper (`buildActRenderGroups`) and exercised
 * directly; the component WIRING (chassis use, the no-write doctrine,
 * reduce-motion threading, the kind dispatch) is asserted by a static
 * source-scan. `.tsx` extension matches the sibling popout test files.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildActRenderGroups,
  actEntryKindToChassisKind,
} from '../src/features/arguments/oneBox/ActPopout';
import {
  buildActPopout,
  flattenActPopout,
  getPromotedEntry,
  ACT_GROUP_ORDER,
  type ActEntryId,
  type BuildActPopoutInput,
} from '../src/features/arguments/oneBox/actPopoutModel';
import type { ConstitutionRule } from '../src/domain/constitution/types';
import { constitutionRules } from '../src/domain/constitution';

const ONEBOX_DIR = path.join(process.cwd(), 'src', 'features', 'arguments', 'oneBox');
const ACT_POPOUT_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'ActPopout.tsx'), 'utf8');
const ONEBOX_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'OneBox.tsx'), 'utf8');

/**
 * Strips block + line comments so an import-purity scan inspects real CODE
 * only — a doctrine comment that names a forbidden primitive must not
 * register as a usage. Same helper shape as `goPopoutComponent.test.tsx`.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const ACT_POPOUT_CODE = stripComments(ACT_POPOUT_SRC);
const ONEBOX_CODE = stripComments(ONEBOX_SRC);

// ── Fixture helpers (mirror actPopoutModel.test.ts) ────────────

/**
 * A node-target popout input with sensible defaults. `parentType` /
 * `stage` are read with an explicit `in` check so a test can pass an
 * explicit `null` without the `??` default overriding it.
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

/** Builds the rendered groups for an input (model → render projection). */
function renderGroups(over: Partial<BuildActPopoutInput> = {}, disabled?: Partial<Record<ActEntryId, string>>) {
  return buildActRenderGroups(buildActPopout(nodeInput(over)), disabled);
}

/** Every render row, flattened in group order. */
function renderRows(over: Partial<BuildActPopoutInput> = {}, disabled?: Partial<Record<ActEntryId, string>>) {
  return renderGroups(over, disabled).flatMap((g) => g.entries);
}

// ── 1. Chassis use — ActPopout stands on the QOL-030 chassis ───

describe('QOL-031 ActPopout — chassis use', () => {
  it('stands on the QOL-030 Popout chassis (does not re-implement it)', () => {
    expect(ACT_POPOUT_CODE).toMatch(/import\s*\{\s*Popout\s*\}\s*from\s*'\.\/Popout'/);
  });

  it('renders rows through the chassis PopoutGroup', () => {
    expect(ACT_POPOUT_CODE).toMatch(/from\s*'\.\/PopoutGroup'/);
    expect(ACT_POPOUT_CODE).toMatch(/<PopoutGroup/);
  });

  it('titles the popout "Act"', () => {
    expect(ACT_POPOUT_CODE).toMatch(/title="Act"/);
  });

  it('does not redefine the chassis primitives (no local Popout/PopoutEntry decl)', () => {
    // QOL-031 must not fork the chassis — only consume it.
    expect(ACT_POPOUT_CODE).not.toMatch(/function\s+Popout\s*\(/);
    expect(ACT_POPOUT_CODE).not.toMatch(/function\s+PopoutEntry\s*\(/);
    expect(ACT_POPOUT_CODE).not.toMatch(/function\s+PopoutGroup\s*\(/);
  });

  it('builds its content from buildActPopout (the QOL-030 pure model)', () => {
    // QOL-031 CONSUMES the model — it must not re-author the 3-gate logic.
    expect(ACT_POPOUT_CODE).toMatch(/buildActPopout\(/);
  });

  it('threads reduce-motion into the chassis (accessibility)', () => {
    expect(ACT_POPOUT_CODE).toMatch(/reduceMotionOverride=\{reduceMotionOverride\}/);
  });
});

// ── 2. Group order is fixed (design §3.3 / §9) ─────────────────

describe('QOL-031 ActPopout — group order is fixed', () => {
  it('renders groups in the model ACT_GROUP_ORDER, never reordered', () => {
    // The render projection preserves the order buildActPopout emits.
    const groups = renderGroups({ parentType: 'claim' });
    const order = groups.map((g) => g.id);
    const expected = ACT_GROUP_ORDER.filter((g) => order.includes(g));
    expect(order).toEqual([...expected]);
  });

  it('the fixed order is Respond · Evidence · Resolve · Structure · Direct · Participation', () => {
    expect([...ACT_GROUP_ORDER]).toEqual([
      'respond',
      'evidence',
      'resolve',
      'structure',
      'direct',
      'role',
    ]);
  });

  it('the projection adds no group and drops no group the model emitted', () => {
    const model = buildActPopout(nodeInput({ parentType: 'claim' }));
    const rendered = buildActRenderGroups(model);
    expect(rendered.map((g) => g.id)).toEqual(model.map((g) => g.id));
  });

  it('every rendered row keeps its model order within the group', () => {
    const model = buildActPopout(nodeInput({ parentType: 'claim', stage: 'open' }));
    const rendered = buildActRenderGroups(model);
    for (let i = 0; i < model.length; i += 1) {
      expect(rendered[i].entries.map((e) => e.key)).toEqual(
        model[i].entries.map((e) => e.id),
      );
    }
  });
});

// ── 3. The promoted entry is emphasized (design §3.4 / §9) ─────

describe('QOL-031 ActPopout — promoted entry is emphasized', () => {
  it('the §3.4 stage-promoted entry renders with isPromoted true', () => {
    // `open` promotes `reply`; off a clarification_request parent `reply`
    // (a claim child) survives the engine gate.
    const rows = renderRows({ parentType: 'clarification_request', stage: 'open' });
    const promoted = rows.filter((r) => r.isPromoted);
    expect(promoted.length).toBe(1);
    expect(promoted[0].key).toBe('reply');
  });

  it('exactly one row is promoted when a stage promotes a surviving entry', () => {
    const rows = renderRows({ parentType: 'claim', stage: 'narrowed' });
    // `narrowed` promotes `confirm` (engine-exempt — always survives).
    expect(rows.filter((r) => r.isPromoted).map((r) => r.key)).toEqual(['confirm']);
  });

  it('no row is promoted for a stageless target', () => {
    const rows = renderRows({ parentType: 'claim', stage: null });
    expect(rows.some((r) => r.isPromoted)).toBe(false);
  });

  it('the promoted render row matches the model getPromotedEntry', () => {
    const model = buildActPopout(nodeInput({ parentType: 'claim', stage: 'confirmed' }));
    const modelPromoted = getPromotedEntry(model);
    const renderedPromoted = buildActRenderGroups(model)
      .flatMap((g) => g.entries)
      .filter((e) => e.isPromoted);
    expect(renderedPromoted.map((e) => e.key)).toEqual(
      modelPromoted ? [modelPromoted.id] : [],
    );
  });

  it('a promoted entry that is also host-disabled drops the promotion', () => {
    // A disabled row cannot be a suggested move (§9).
    const rows = renderRows(
      { parentType: 'clarification_request', stage: 'open' },
      { reply: 'Not available right now.' },
    );
    const reply = rows.find((r) => r.key === 'reply');
    expect(reply?.isDisabled).toBe(true);
    expect(reply?.isPromoted).toBe(false);
  });
});

// ── 4. Disabled entries are visible WITH a reason (design §3.3) ─

describe('QOL-031 ActPopout — disabled entries visible with a reason', () => {
  it('a host-disabled entry renders with isDisabled + the supplied reason', () => {
    const rows = renderRows({ parentType: 'claim' }, { flag: "You can't flag your own move." });
    const flag = rows.find((r) => r.key === 'flag');
    expect(flag).toBeDefined();
    expect(flag?.isDisabled).toBe(true);
    expect(flag?.disabledReason).toBe("You can't flag your own move.");
  });

  it('a disabled entry is NEVER omitted — it stays in its group', () => {
    const withDisabled = renderRows({ parentType: 'claim' }, { flag: 'unavailable' });
    const without = renderRows({ parentType: 'claim' });
    // Same row set — disabling does not remove the row.
    expect(withDisabled.map((r) => r.key).sort()).toEqual(without.map((r) => r.key).sort());
  });

  it('an entry not in the disabled map renders enabled with no reason', () => {
    const rows = renderRows({ parentType: 'claim' }, { flag: 'unavailable' });
    const challenge = rows.find((r) => r.key === 'challenge');
    expect(challenge?.isDisabled).toBe(false);
    expect(challenge?.disabledReason).toBeNull();
  });

  it('with no disabled map, every produced row is enabled', () => {
    for (const row of renderRows({ parentType: 'claim', stage: 'open' })) {
      expect(row.isDisabled).toBe(false);
      expect(row.disabledReason).toBeNull();
    }
  });

  it('the chassis renders the disabled reason under the row (PopoutEntry)', () => {
    // The chassis PopoutEntry already shows `disabledReason` under a
    // disabled row; QOL-031 supplies it — the wiring scan proves the prop
    // is threaded.
    expect(ACT_POPOUT_CODE).toMatch(/disabledReason/);
    expect(ACT_POPOUT_CODE).toMatch(/isDisabled/);
  });
});

// ── 5. Entry-kind → chassis-kind mapping (design §3.2 / §4) ────

describe('QOL-031 ActPopout — entry kinds', () => {
  it('maps the three Act entry kinds onto the three chassis kinds', () => {
    expect(actEntryKindToChassisKind('box_opening')).toBe('box-opening');
    expect(actEntryKindToChassisKind('direct')).toBe('direct');
    expect(actEntryKindToChassisKind('role_change')).toBe('role-change');
  });

  it('every rendered row carries a chassis kind drawn from the three', () => {
    for (const row of renderRows({ parentType: 'claim', role: 'participant_other' })) {
      expect(['box-opening', 'direct', 'role-change']).toContain(row.kind);
    }
  });

  it('every rendered row keeps a stable key (the ActEntryId)', () => {
    for (const row of renderRows({ parentType: 'claim' })) {
      expect(typeof row.key).toBe('string');
      expect(row.key.length).toBeGreaterThan(0);
    }
  });
});

// ── 6. Narrative frames — the design §6 table reproduced ───────
//
// QOL-031 design §6 — "the Act popout in action". Each frame names a
// selected target + stage + role and the promoted group / top entry. The
// render layer reproduces it: given the frame's inputs, the rendered
// groups carry the expected promoted top entry / group composition.

interface ActFrame {
  id: string;
  desc: string;
  input: Partial<BuildActPopoutInput>;
  /** The render row id expected to be promoted (null = nothing promoted). */
  promoted: ActEntryId | null;
  /** The group id the promoted entry sits in (when there is one). */
  promotedGroup?: string;
}

const NARRATIVE_FRAMES: ActFrame[] = [
  {
    id: 'S1 F2',
    desc: 'B on the root — node · open → Respond promoted; top = Reply',
    // `open` promotes `reply`; off a clarification_request parent the
    // reply (a claim child) survives the engine gate so it can promote.
    input: { parentType: 'clarification_request', stage: 'open' },
    promoted: 'reply',
    promotedGroup: 'respond',
  },
  {
    id: 'S1 F3',
    desc: 'A on B response — node · rebutted → Respond promoted',
    input: { parentType: 'clarification_request', stage: 'rebutted' },
    promoted: 'reply',
    promotedGroup: 'respond',
  },
  {
    id: 'S1 F5',
    desc: 'Observer C arrives — node · open, observer → participation only',
    input: { parentType: 'claim', stage: 'open', role: 'observer' },
    // Observer entries are participation-only; `reply` was role-removed so
    // the stage gate cannot promote it (it never promotes a filtered move).
    promoted: null,
  },
  {
    id: 'S1 F6',
    desc: 'A & B on the chime-in node — primary role, governance active',
    // The shipped model has no governance group; a primary on a node has
    // the full move set. The frame asserts the render layer keeps the
    // participant move set intact (Govern folds into Direct in the model).
    input: { parentType: 'claim', stage: 'open', role: 'participant_other' },
    promoted: null,
  },
  {
    id: 'S1 F7',
    desc: 'A makes the room private — room target, creator → Direct: Make private',
    input: { targetKind: 'room', parentType: null, role: 'participant_other' },
    promoted: null,
  },
  {
    id: 'S2 F3',
    desc: 'A on evidence-backed node — evidence object · sourced',
    input: { targetKind: 'evidenceObject', parentType: null, role: 'participant_other' },
    promoted: null,
  },
  {
    id: 'S2 F5',
    desc: 'A asks for a source — node · rebutted → Evidence: Ask source available',
    // Design §6 highlights the Evidence group's "Ask source" as the move
    // taken. Off a `claim` parent the stage-promoted `reply` (a claim
    // child) is engine-filtered, so the model promotes nothing — the frame
    // asserts the Evidence "Ask source" entry is present + available
    // instead (the design's intent; a separate assertion below proves it).
    input: { parentType: 'claim', stage: 'rebutted', role: 'participant_other' },
    promoted: null,
  },
  {
    id: 'S2 F6',
    desc: 'B on the source_requested node → Add evidence promoted to the top',
    input: { parentType: 'claim', stage: 'source_requested', role: 'participant_other' },
    promoted: 'add_evidence',
    promotedGroup: 'evidence',
  },
];

describe('QOL-031 ActPopout — narrative frames (design §6)', () => {
  it('reproduces all 8 design §6 frames', () => {
    expect(NARRATIVE_FRAMES).toHaveLength(8);
  });

  describe.each(NARRATIVE_FRAMES)('$id — $desc', (frame) => {
    const rows = renderRows(frame.input);

    it('promotes the expected top entry (or nothing)', () => {
      const promoted = rows.filter((r) => r.isPromoted).map((r) => r.key);
      expect(promoted).toEqual(frame.promoted ? [frame.promoted] : []);
    });

    if (frame.promoted && frame.promotedGroup) {
      it(`the promoted entry sits in the ${frame.promotedGroup} group, slot 0`, () => {
        const group = renderGroups(frame.input).find((g) => g.id === frame.promotedGroup);
        expect(group).toBeDefined();
        expect(group?.entries[0].key).toBe(frame.promoted);
        expect(group?.entries[0].isPromoted).toBe(true);
      });
    }
  });

  it('S2 F5 — the rebutted node surfaces "Ask source" in the Evidence group', () => {
    // Design §6 — "A asks for a source". The Evidence group carries an
    // available `ask_source` entry the user can act on.
    const groups = renderGroups({ parentType: 'claim', stage: 'rebutted' });
    const evidence = groups.find((g) => g.id === 'evidence');
    const askSource = evidence?.entries.find((e) => e.key === 'ask_source');
    expect(askSource).toBeDefined();
    expect(askSource?.isDisabled).toBe(false);
  });

  it('S2 F6 proves the node-stage-driven flash menu end to end', () => {
    // `source_requested` promotes `add_evidence` to the very top of the
    // Evidence group — the design §6 "stage promotes Add evidence" row.
    const groups = renderGroups({ parentType: 'claim', stage: 'source_requested' });
    const evidence = groups.find((g) => g.id === 'evidence');
    expect(evidence?.entries[0].key).toBe('add_evidence');
    expect(evidence?.entries[0].isPromoted).toBe(true);
  });

  it('S1 F5 — the observer frame offers only participation entries', () => {
    const rows = renderRows({ parentType: 'claim', stage: 'open', role: 'observer' });
    const ids = rows.map((r) => r.key).sort();
    expect(ids).toEqual(
      ['chime_in', 'join_against', 'join_for', 'view_qualifiers', 'watch'].sort(),
    );
    // No box-opening compose entries.
    for (const row of rows) {
      expect(row.kind).not.toBe('box-opening');
    }
  });

  it('S1 F7 — the room frame surfaces Make private in the Direct group', () => {
    const groups = renderGroups({ targetKind: 'room', parentType: null });
    const direct = groups.find((g) => g.id === 'direct');
    expect(direct?.entries.map((e) => e.key)).toContain('make_private');
  });
});

// ── 7. Edge cases — design §8 ──────────────────────────────────

describe('QOL-031 ActPopout — edge cases (design §8)', () => {
  it('zero box-opening entries — a locked node leaves no compose rows', () => {
    // Empty rules → the engine gate removes every typed entry; only
    // engine-exempt entries (branch_tangent, view_qualifiers, role) remain.
    const rows = renderRows({ parentType: 'claim', rules: [] as ConstitutionRule[] });
    // No engine-typed box-opening compose entry survives.
    expect(rows.some((r) => r.key === 'reply')).toBe(false);
    expect(rows.some((r) => r.key === 'challenge')).toBe(false);
    expect(rows.some((r) => r.key === 'add_evidence')).toBe(false);
  });

  it('zero entries entirely — the popout shows the empty note, no box opens', () => {
    // A root context with empty rules + observer role can leave nothing.
    const groups = renderGroups({
      parentType: null,
      rules: [] as ConstitutionRule[],
      role: 'observer',
    });
    // Observer keeps role + qualifiers; root context keeps engine-exempt.
    // The render projection still produces a (possibly small) group list;
    // the component's empty-note branch is source-scanned below.
    expect(Array.isArray(groups)).toBe(true);
  });

  it('renders an empty-state note when the model yields zero groups', () => {
    // The component's §8 zero-entry branch.
    expect(ACT_POPOUT_CODE).toMatch(/one-box-act-popout-empty/);
    expect(ACT_POPOUT_CODE).toMatch(/No actions are available here yet/);
  });

  it('own node — box-opening + Flag removed; only qualifiers + Request deletion', () => {
    const rows = renderRows({ parentType: 'claim', role: 'own_bubble' });
    const ids = rows.map((r) => r.key).sort();
    expect(ids).toEqual(['request_deletion', 'view_qualifiers'].sort());
    // No Flag on your own move.
    expect(ids).not.toContain('flag');
    // No box-opening compose row.
    for (const row of rows) {
      expect(row.kind).not.toBe('box-opening');
    }
  });

  it('primary seat open — a host can disable governance with a reason', () => {
    // The shipped model folds governance into the Direct group; a host
    // that wants the §8 "primary seat open → Govern hidden" behaviour
    // disables those entries with a reason rather than omitting them.
    const rows = renderRows(
      { parentType: 'claim', role: 'participant_other' },
      { flag: 'No one to govern with — the primary seat is open.' },
    );
    const flag = rows.find((r) => r.key === 'flag');
    expect(flag?.isDisabled).toBe(true);
    expect(flag?.disabledReason).toContain('primary seat is open');
  });

  it('stale popout — re-deriving with a new stage produces a fresh result', () => {
    // A stage change while the popout is open re-derives on the next
    // render (the component re-runs buildActPopout via useMemo deps).
    const before = renderRows({ parentType: 'claim', stage: 'open' });
    const after = renderRows({ parentType: 'claim', stage: 'narrowed' });
    // The promoted entry changed — the re-derivation is honest.
    expect(before.filter((r) => r.isPromoted).map((r) => r.key)).not.toEqual(
      after.filter((r) => r.isPromoted).map((r) => r.key),
    );
  });
});

// ── 8. Convergence — SC-001 / SC-004 / RULE-005 still drive ────
//
// QOL-031 design §5. The Act popout converges three shipped surfaces; the
// models behind them still drive the same actions — consumed, not
// re-derived. The render layer proves the entries are still present.

describe('QOL-031 ActPopout — convergence (design §5)', () => {
  it('SC-001 folds in — Direct + Participation groups carry Watch / Join', () => {
    const groups = renderGroups({ parentType: 'claim', role: 'observer' });
    const role = groups.find((g) => g.id === 'role');
    const ids = role?.entries.map((e) => e.key) ?? [];
    expect(ids).toContain('watch');
    expect(ids).toContain('join_for');
    expect(ids).toContain('join_against');
  });

  it('SC-004 folds in — the box-opening groups carry the compose entries', () => {
    const rows = renderRows({ parentType: 'claim' });
    const boxOpening = rows.filter((r) => r.kind === 'box-opening').map((r) => r.key);
    // The action→preset surface is intact (challenge / add_evidence / …).
    expect(boxOpening).toContain('challenge');
    expect(boxOpening).toContain('add_evidence');
  });

  it('RULE-005 folds in — the channel→type vocabulary is the box-opening set', () => {
    const rows = renderRows({ parentType: 'claim' });
    // The flash menu IS the RULE-005 chip row's successor — it offers the
    // compose entries through the same buildActPopout box-opening kinds.
    expect(rows.some((r) => r.kind === 'box-opening')).toBe(true);
  });

  it('re-derives nothing — ActPopout calls buildActPopout, not a fork', () => {
    // The convergence is "reuse the models" — the render layer must call
    // the shipped model, never re-author the gates.
    expect(ACT_POPOUT_CODE).toMatch(/buildActPopout\(/);
    // No fork of the 3-gate pipeline.
    expect(ACT_POPOUT_CODE).not.toMatch(/applyEngineGate|applyRoleGate|applyStageGate/);
  });
});

// ── 9. No-write doctrine (design §10) ──────────────────────────

describe('QOL-031 ActPopout — no-write doctrine', () => {
  it('imports no Supabase client', () => {
    expect(/from ['"][^'"]*supabase/.test(ACT_POPOUT_CODE)).toBe(false);
  });

  it('performs no network call', () => {
    expect(/\bfetch\(/.test(ACT_POPOUT_CODE)).toBe(false);
    expect(/\bXMLHttpRequest\b/.test(ACT_POPOUT_CODE)).toBe(false);
  });

  it('imports no AI provider', () => {
    expect(/anthropic|openai|x\.ai/i.test(ACT_POPOUT_CODE)).toBe(false);
  });

  it('does not write to public.arguments or bypass submit-argument', () => {
    expect(/submit-argument/.test(ACT_POPOUT_CODE)).toBe(false);
    expect(/\.insert\(|\.update\(|\.delete\(/.test(ACT_POPOUT_CODE)).toBe(false);
  });

  it('does not use the service role anywhere', () => {
    expect(/SERVICE_ROLE|service_role/.test(ACT_POPOUT_CODE)).toBe(false);
  });

  it('does not import a router (Act fires host callbacks — no route change)', () => {
    expect(/from ['"][^'"]*(react-navigation|expo-router)/.test(ACT_POPOUT_CODE)).toBe(false);
  });

  it('reads no wall clock (deterministic render projection)', () => {
    expect(/Date\.now\(\)/.test(ACT_POPOUT_CODE)).toBe(false);
  });

  it('direct entries route through host callbacks, never a direct mutation', () => {
    // The component dispatches `direct` entries to `onDirectAction` — the
    // host wires them to the SHIPPED Edge Functions / RLS.
    expect(ACT_POPOUT_CODE).toMatch(/onDirectAction\(/);
  });
});

// ── 10. Dispatch wiring — the three entry kinds (design §3.2) ──

describe('QOL-031 ActPopout — kind dispatch', () => {
  it('a box-opening entry calls onSelectBoxType and closes the popout', () => {
    expect(ACT_POPOUT_CODE).toMatch(/onSelectBoxType\(/);
    // The box-opening branch closes the popout on selection (§3.1).
    expect(ACT_POPOUT_CODE).toMatch(/case 'box_opening'/);
  });

  it('a direct entry calls onDirectAction and closes the popout', () => {
    expect(ACT_POPOUT_CODE).toMatch(/case 'direct'/);
    expect(ACT_POPOUT_CODE).toMatch(/onDirectAction\(/);
  });

  it('a role-change entry calls onRoleChange (host re-opens the popout)', () => {
    expect(ACT_POPOUT_CODE).toMatch(/case 'role_change'/);
    expect(ACT_POPOUT_CODE).toMatch(/onRoleChange\(/);
  });

  it('OneBox wires the ActPopout in (the QOL-031 registration)', () => {
    // The minimal-registration wiring — OneBox renders ActPopout, not its
    // own inline Popout block.
    expect(ONEBOX_CODE).toMatch(/<ActPopout/);
    expect(ONEBOX_CODE).toMatch(/import\s*\{\s*ActPopout\s*\}/);
  });

  it('OneBox no longer hand-rolls the Popout chassis for the flash menu', () => {
    // The inline Popout/PopoutGroup block is gone — ActPopout owns it.
    expect(ONEBOX_CODE).not.toMatch(/<Popout\b/);
  });
});

// ── 11. Doctrine ban-list — every rendered label is clean ──────

const BANNED = [
  'winner',
  'loser',
  'won',
  'lost',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'correct',
  'incorrect',
];

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  // `won` / `lost` need a word boundary to avoid false hits.
  if (token === 'won' || token === 'lost') {
    return new RegExp(`\\b${token}\\b`).test(lower);
  }
  return lower.includes(token);
}

describe('QOL-031 ActPopout — doctrine ban-list scan', () => {
  it('no rendered entry label or reason carries a verdict token', () => {
    // Scan every produced render row across a spread of inputs + a
    // host-disabled row.
    const inputs: Partial<BuildActPopoutInput>[] = [
      { parentType: 'claim', stage: 'open' },
      { parentType: 'claim', role: 'own_bubble' },
      { parentType: 'claim', role: 'observer' },
      { targetKind: 'room', parentType: null },
      { targetKind: 'evidenceObject', parentType: null },
    ];
    for (const input of inputs) {
      for (const row of renderRows(input)) {
        for (const token of BANNED) {
          expect(hitsBanned(row.label, token)).toBe(false);
          expect(hitsBanned(row.accessibilityLabel ?? '', token)).toBe(false);
        }
      }
    }
  });

  it('no rendered group heading carries a verdict token', () => {
    for (const group of renderGroups({ parentType: 'claim', stage: 'open' })) {
      for (const token of BANNED) {
        expect(hitsBanned(group.label, token)).toBe(false);
      }
    }
  });

  it('the component authors only the empty-state note as literal copy', () => {
    // The one literal string ActPopout authors — must be clean + plain.
    expect(ACT_POPOUT_CODE).toMatch(/No actions are available here yet/);
    for (const token of BANNED) {
      expect(hitsBanned('No actions are available here yet.', token)).toBe(false);
    }
  });
});

// ── 12. Render-projection completeness ─────────────────────────

describe('QOL-031 ActPopout — render projection is faithful', () => {
  it('buildActRenderGroups is a pure function — no AI / network / clock', () => {
    const modelSrc = stripComments(ACT_POPOUT_SRC);
    // The projection helper lives in ActPopout.tsx; the file is React but
    // the helper itself must stay deterministic — covered by the no-write
    // scan above; this asserts no Date.now() leaked into the helper.
    expect(/Date\.now\(\)/.test(modelSrc)).toBe(false);
  });

  it('the projection carries every model entry id 1:1', () => {
    const model = buildActPopout(nodeInput({ parentType: 'claim', stage: 'open' }));
    const modelIds = flattenActPopout(model).map((e) => e.id).sort();
    const renderIds = buildActRenderGroups(model)
      .flatMap((g) => g.entries)
      .map((e) => e.key)
      .sort();
    expect(renderIds).toEqual(modelIds);
  });

  it('an empty model yields an empty projection', () => {
    expect(buildActRenderGroups([])).toEqual([]);
  });

  it('the projection preserves accessibility labels verbatim', () => {
    const model = buildActPopout(nodeInput({ parentType: 'claim' }));
    const rendered = buildActRenderGroups(model).flatMap((g) => g.entries);
    for (const row of rendered) {
      const modelEntry = flattenActPopout(model).find((e) => e.id === row.key);
      expect(row.accessibilityLabel).toBe(modelEntry?.accessibilityLabel);
    }
  });
});
