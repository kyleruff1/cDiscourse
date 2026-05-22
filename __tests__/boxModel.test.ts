/**
 * QOL-030 — One-box composer state machine tests.
 *
 * Design §9 test plan, `boxModel` bullet:
 *  - type / target / view state transitions.
 *  - per-type draft park / restore is lossless.
 *  - `renderSchema` returns the right kind for every type.
 *
 * Full branch coverage of every public function (test-discipline: pure-TS
 * models get 100% branch coverage). Doctrine / ban-list live in the
 * companion `oneBoxCopyBanList.test.ts`.
 */

import {
  ALL_BOX_TYPES,
  ALL_BOX_TARGET_KINDS,
  ALL_BOX_VIEWS,
  ALL_BOX_LIFECYCLES,
  ALL_SCHEMA_KINDS,
  NO_TARGET,
  EMPTY_DRAFT,
  createEmptyDraftBuffers,
  isDraftEmpty,
  createBoxState,
  renderSchema,
  switchBoxType,
  changeBoxTarget,
  switchBoxView,
  updateActiveDraft,
  enterReview,
  leaveReview,
  markPosted,
  resetAfterPost,
  _forbiddenBoxTokens,
  type BoxType,
  type BoxTarget,
  type Draft,
} from '../src/features/arguments/oneBox/boxModel';

// ── Fixtures ───────────────────────────────────────────────────

const nodeTarget: BoxTarget = { kind: 'node', referenceId: 'm1', roomId: null };
const roomTarget: BoxTarget = { kind: 'room', roomId: 'room-1', referenceId: null };

function draftWithBody(body: string): Draft {
  return { body, listItems: [], fields: {} };
}

// ── 1. Vocabulary completeness ─────────────────────────────────

describe('QOL-030 boxModel — vocabulary', () => {
  it('exposes 12 box types', () => {
    expect(ALL_BOX_TYPES).toHaveLength(12);
    expect(new Set(ALL_BOX_TYPES).size).toBe(12);
  });

  it('exposes 6 target kinds', () => {
    expect(ALL_BOX_TARGET_KINDS).toHaveLength(6);
    expect(new Set(ALL_BOX_TARGET_KINDS).size).toBe(6);
  });

  it('exposes both views', () => {
    expect([...ALL_BOX_VIEWS].sort()).toEqual(['cards', 'timeline']);
  });

  it('exposes 6 lifecycle states', () => {
    expect(ALL_BOX_LIFECYCLES).toHaveLength(6);
    expect([...ALL_BOX_LIFECYCLES].sort()).toEqual(
      ['drafting', 'empty', 'parked', 'posted', 'review', 'typed'].sort(),
    );
  });

  it('exposes 4 schema kinds', () => {
    expect([...ALL_SCHEMA_KINDS].sort()).toEqual(
      ['composite', 'forced_list', 'free_body', 'structured_form'].sort(),
    );
  });

  it('NO_TARGET is the empty (none) target', () => {
    expect(NO_TARGET.kind).toBe('none');
    expect(NO_TARGET.referenceId).toBeNull();
  });
});

// ── 2. Draft buffers ───────────────────────────────────────────

describe('QOL-030 boxModel — draft buffers', () => {
  it('createEmptyDraftBuffers keys every BoxType to EMPTY_DRAFT', () => {
    const buffers = createEmptyDraftBuffers();
    for (const type of ALL_BOX_TYPES) {
      expect(buffers[type]).toBe(EMPTY_DRAFT);
    }
  });

  it('createEmptyDraftBuffers returns a fresh frozen object each call', () => {
    const a = createEmptyDraftBuffers();
    const b = createEmptyDraftBuffers();
    expect(a).not.toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('isDraftEmpty is true for the empty draft', () => {
    expect(isDraftEmpty(EMPTY_DRAFT)).toBe(true);
  });

  it('isDraftEmpty is true for a whitespace-only body', () => {
    expect(isDraftEmpty(draftWithBody('   \n  '))).toBe(true);
  });

  it('isDraftEmpty is false when the body has content', () => {
    expect(isDraftEmpty(draftWithBody('hello'))).toBe(false);
  });

  it('isDraftEmpty is false when a list item has content', () => {
    expect(isDraftEmpty({ body: '', listItems: ['', 'a point'], fields: {} })).toBe(false);
  });

  it('isDraftEmpty is true when every list item is blank', () => {
    expect(isDraftEmpty({ body: '', listItems: ['', '  '], fields: {} })).toBe(true);
  });

  it('isDraftEmpty is false when a field value has content', () => {
    expect(isDraftEmpty({ body: '', listItems: [], fields: { amount: '120' } })).toBe(false);
  });

  it('isDraftEmpty is true when every field value is blank', () => {
    expect(isDraftEmpty({ body: '', listItems: [], fields: { amount: '', note: ' ' } })).toBe(true);
  });
});

// ── 3. createBoxState ──────────────────────────────────────────

describe('QOL-030 boxModel — createBoxState', () => {
  it('defaults to a root_claim box with no target, timeline view, empty lifecycle', () => {
    const s = createBoxState();
    expect(s.type).toBe('root_claim');
    expect(s.target).toBe(NO_TARGET);
    expect(s.view).toBe('timeline');
    expect(s.stageContext).toBeNull();
    expect(s.lifecycle).toBe('empty');
  });

  it('honours an explicit init type / target / view / stage', () => {
    const s = createBoxState({
      type: 'respond',
      target: nodeTarget,
      view: 'cards',
      stageContext: 'rebutted',
    });
    expect(s.type).toBe('respond');
    expect(s.target).toBe(nodeTarget);
    expect(s.view).toBe('cards');
    expect(s.stageContext).toBe('rebutted');
  });

  it('starts with a complete per-type draft-buffer map', () => {
    const s = createBoxState();
    for (const type of ALL_BOX_TYPES) {
      expect(s.draftBuffers[type]).toBe(EMPTY_DRAFT);
    }
  });
});

// ── 4. renderSchema — kind per type ────────────────────────────

describe('QOL-030 boxModel — renderSchema', () => {
  it('returns a schema for every box type', () => {
    for (const type of ALL_BOX_TYPES) {
      const schema = renderSchema(type, NO_TARGET);
      expect(schema.type).toBe(type);
      expect(ALL_SCHEMA_KINDS).toContain(schema.kind);
      expect(schema.sections.length).toBeGreaterThan(0);
    }
  });

  it('root_claim is a free-body schema that configures the room', () => {
    const schema = renderSchema('root_claim', NO_TARGET);
    expect(schema.kind).toBe('free_body');
    expect(schema.configuresRoom).toBe(true);
    expect(schema.hasFreeBody).toBe(true);
    expect(schema.sections).toEqual(['room_setup', 'body']);
  });

  it('respond is the composite schema (concession list + body)', () => {
    const schema = renderSchema('respond', nodeTarget);
    expect(schema.kind).toBe('composite');
    expect(schema.sections).toEqual(['concession_list', 'body']);
    expect(schema.hasFreeBody).toBe(true);
  });

  it('respond_to_concession is a forced list with NO free body', () => {
    const schema = renderSchema('respond_to_concession', NO_TARGET);
    expect(schema.kind).toBe('forced_list');
    expect(schema.hasFreeBody).toBe(false);
    expect(schema.sections).toEqual(['concession_list']);
  });

  it('add_evidence is a structured form with NO free body', () => {
    const schema = renderSchema('add_evidence', NO_TARGET);
    expect(schema.kind).toBe('structured_form');
    expect(schema.hasFreeBody).toBe(false);
  });

  it('respond_to_evidence is a structured form WITH a clarification body', () => {
    const schema = renderSchema('respond_to_evidence', NO_TARGET);
    expect(schema.kind).toBe('structured_form');
    expect(schema.hasFreeBody).toBe(true);
    expect(schema.sections).toContain('structured_fields');
    expect(schema.sections).toContain('body');
  });

  it('ask_source / ask_quote are short-prompt structured forms', () => {
    for (const t of ['ask_source', 'ask_quote'] as BoxType[]) {
      const schema = renderSchema(t, NO_TARGET);
      expect(schema.kind).toBe('structured_form');
      expect(schema.sections).toEqual(['short_prompt']);
      expect(schema.hasFreeBody).toBe(false);
    }
  });

  it('clarify / narrow / confirm / synthesize are free-body schemas', () => {
    for (const t of ['clarify', 'narrow', 'confirm', 'synthesize'] as BoxType[]) {
      const schema = renderSchema(t, NO_TARGET);
      expect(schema.kind).toBe('free_body');
      expect(schema.hasFreeBody).toBe(true);
    }
  });

  it('branch_tangent is a free-body schema with a side-branch section', () => {
    const schema = renderSchema('branch_tangent', NO_TARGET);
    expect(schema.kind).toBe('free_body');
    expect(schema.sections).toContain('side_branch');
  });

  it('only root_claim configures the room', () => {
    for (const type of ALL_BOX_TYPES) {
      const schema = renderSchema(type, NO_TARGET);
      expect(schema.configuresRoom).toBe(type === 'root_claim');
    }
  });

  it('forced-list schemas never claim a free body', () => {
    for (const type of ALL_BOX_TYPES) {
      const schema = renderSchema(type, NO_TARGET);
      if (schema.kind === 'forced_list') expect(schema.hasFreeBody).toBe(false);
    }
  });

  it('throws on an unknown box type', () => {
    expect(() => renderSchema('not_a_type' as BoxType, NO_TARGET)).toThrow(/unknown box type/);
  });

  it('the target argument does not change the schema kind (v1 routes on type)', () => {
    expect(renderSchema('respond', nodeTarget).kind).toBe(
      renderSchema('respond', roomTarget).kind,
    );
  });
});

// ── 5. switchBoxType — non-destructive park / restore ──────────

describe('QOL-030 boxModel — switchBoxType', () => {
  it('switching to the same type is a referential no-op', () => {
    const s = createBoxState({ type: 'respond' });
    expect(switchBoxType(s, 'respond')).toBe(s);
  });

  it('changes the type and leaves the lifecycle "typed" for an empty buffer', () => {
    const s = createBoxState();
    const next = switchBoxType(s, 'add_evidence');
    expect(next.type).toBe('add_evidence');
    expect(next.lifecycle).toBe('typed');
  });

  it('parks the current draft and restores it on switch-back (lossless)', () => {
    let s = createBoxState({ type: 'respond' });
    // Draft something in `respond`.
    s = updateActiveDraft(s, draftWithBody('my refutation'));
    expect(s.draftBuffers.respond.body).toBe('my refutation');
    // Switch to `clarify` — the respond draft must be PARKED, not lost.
    s = switchBoxType(s, 'clarify');
    expect(s.type).toBe('clarify');
    expect(s.draftBuffers.respond.body).toBe('my refutation'); // parked
    expect(s.draftBuffers.clarify.body).toBe(''); // fresh
    // Draft something in `clarify`.
    s = updateActiveDraft(s, draftWithBody('what do you mean?'));
    // Switch BACK to `respond` — its parked draft is restored.
    s = switchBoxType(s, 'respond');
    expect(s.type).toBe('respond');
    expect(s.draftBuffers.respond.body).toBe('my refutation'); // restored
    expect(s.draftBuffers.clarify.body).toBe('what do you mean?'); // still parked
  });

  it('switching to a type with a parked non-empty buffer resumes "drafting"', () => {
    let s = createBoxState({ type: 'respond' });
    s = updateActiveDraft(s, draftWithBody('parked content'));
    s = switchBoxType(s, 'clarify'); // park respond
    const back = switchBoxType(s, 'respond');
    expect(back.lifecycle).toBe('drafting');
  });

  it('never mutates the input state', () => {
    const s = createBoxState({ type: 'respond' });
    const snapshot = JSON.stringify(s);
    switchBoxType(s, 'clarify');
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('throws on an unknown destination type', () => {
    const s = createBoxState();
    expect(() => switchBoxType(s, 'bogus' as BoxType)).toThrow(/unknown box type/);
  });
});

// ── 6. changeBoxTarget ─────────────────────────────────────────

describe('QOL-030 boxModel — changeBoxTarget', () => {
  it('re-points the box and sets the node stage context', () => {
    const s = createBoxState({ type: 'respond' });
    const next = changeBoxTarget(s, nodeTarget, 'rebutted');
    expect(next.target).toBe(nodeTarget);
    expect(next.stageContext).toBe('rebutted');
  });

  it('clears the stage context for a non-node target', () => {
    const s = createBoxState({ type: 'respond', stageContext: 'open' });
    const next = changeBoxTarget(s, roomTarget, 'rebutted');
    // A room target has no lifecycle stage — cleared regardless of the arg.
    expect(next.stageContext).toBeNull();
  });

  it('keeps the current type buffer intact across a target change', () => {
    let s = createBoxState({ type: 'respond' });
    s = updateActiveDraft(s, draftWithBody('draft on node m1'));
    const next = changeBoxTarget(s, { kind: 'node', referenceId: 'm2' }, 'open');
    // The buffer is per-type — a target change does not move/destroy it.
    expect(next.draftBuffers.respond.body).toBe('draft on node m1');
  });

  it('lifecycle reflects the current type buffer after a target change', () => {
    const empty = changeBoxTarget(createBoxState({ type: 'respond' }), nodeTarget, 'open');
    expect(empty.lifecycle).toBe('typed');

    let s = createBoxState({ type: 'respond' });
    s = updateActiveDraft(s, draftWithBody('content'));
    const drafting = changeBoxTarget(s, nodeTarget, 'open');
    expect(drafting.lifecycle).toBe('drafting');
  });

  it('never mutates the input state', () => {
    const s = createBoxState({ type: 'respond' });
    const snapshot = JSON.stringify(s);
    changeBoxTarget(s, nodeTarget, 'open');
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

// ── 7. switchBoxView — presentation only ───────────────────────

describe('QOL-030 boxModel — switchBoxView', () => {
  it('switching to the same view is a referential no-op', () => {
    const s = createBoxState();
    expect(switchBoxView(s, 'timeline')).toBe(s);
  });

  it('changes the view and preserves type / target / lifecycle / drafts', () => {
    let s = createBoxState({ type: 'respond', target: nodeTarget });
    s = updateActiveDraft(s, draftWithBody('mid-compose'));
    const next = switchBoxView(s, 'cards');
    expect(next.view).toBe('cards');
    // Everything else is byte-identical.
    expect(next.type).toBe('respond');
    expect(next.target).toBe(nodeTarget);
    expect(next.lifecycle).toBe(s.lifecycle);
    expect(next.draftBuffers).toBe(s.draftBuffers);
  });

  it('never mutates the input state', () => {
    const s = createBoxState();
    const snapshot = JSON.stringify(s);
    switchBoxView(s, 'cards');
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

// ── 8. updateActiveDraft ───────────────────────────────────────

describe('QOL-030 boxModel — updateActiveDraft', () => {
  it('writes into ONLY the active type buffer', () => {
    let s = createBoxState({ type: 'respond' });
    s = updateActiveDraft(s, draftWithBody('respond text'));
    expect(s.draftBuffers.respond.body).toBe('respond text');
    // Every other buffer is untouched.
    expect(s.draftBuffers.clarify).toBe(EMPTY_DRAFT);
    expect(s.draftBuffers.add_evidence).toBe(EMPTY_DRAFT);
  });

  it('advances the lifecycle to "drafting" when the draft has content', () => {
    const s = updateActiveDraft(createBoxState(), draftWithBody('x'));
    expect(s.lifecycle).toBe('drafting');
  });

  it('returns the lifecycle to "typed" when the draft is emptied', () => {
    let s = updateActiveDraft(createBoxState(), draftWithBody('x'));
    expect(s.lifecycle).toBe('drafting');
    s = updateActiveDraft(s, EMPTY_DRAFT);
    expect(s.lifecycle).toBe('typed');
  });

  it('is a no-op when the box is already posted', () => {
    let s = createBoxState();
    s = updateActiveDraft(s, draftWithBody('content'));
    s = markPosted(s);
    expect(s.lifecycle).toBe('posted');
    const after = updateActiveDraft(s, draftWithBody('stray keystroke'));
    expect(after).toBe(s); // unchanged
  });

  it('is a no-op when the box is under review', () => {
    let s = createBoxState();
    s = updateActiveDraft(s, draftWithBody('content'));
    s = enterReview(s);
    expect(s.lifecycle).toBe('review');
    const after = updateActiveDraft(s, draftWithBody('change'));
    expect(after).toBe(s); // unchanged
  });

  it('freezes the new draft-buffer map', () => {
    const s = updateActiveDraft(createBoxState(), draftWithBody('x'));
    expect(Object.isFrozen(s.draftBuffers)).toBe(true);
  });

  it('never mutates the input state', () => {
    const s = createBoxState();
    const snapshot = JSON.stringify(s);
    updateActiveDraft(s, draftWithBody('x'));
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

// ── 9. review lifecycle — enterReview / leaveReview ────────────

describe('QOL-030 boxModel — enterReview / leaveReview', () => {
  it('enterReview moves drafting → review', () => {
    let s = updateActiveDraft(createBoxState(), draftWithBody('x'));
    s = enterReview(s);
    expect(s.lifecycle).toBe('review');
  });

  it('enterReview is a no-op from a non-drafting lifecycle', () => {
    const empty = createBoxState();
    expect(enterReview(empty)).toBe(empty); // empty
    const typed = switchBoxType(createBoxState(), 'respond');
    expect(enterReview(typed)).toBe(typed); // typed
  });

  it('leaveReview moves review → drafting and keeps the draft', () => {
    let s = updateActiveDraft(createBoxState({ type: 'respond' }), draftWithBody('keep me'));
    s = enterReview(s);
    s = leaveReview(s);
    expect(s.lifecycle).toBe('drafting');
    expect(s.draftBuffers.respond.body).toBe('keep me');
  });

  it('leaveReview is a no-op from a non-review lifecycle', () => {
    const drafting = updateActiveDraft(createBoxState(), draftWithBody('x'));
    expect(leaveReview(drafting)).toBe(drafting);
  });
});

// ── 10. markPosted / resetAfterPost ────────────────────────────

describe('QOL-030 boxModel — markPosted / resetAfterPost', () => {
  it('markPosted clears the just-posted buffer and sets lifecycle "posted"', () => {
    let s = updateActiveDraft(createBoxState({ type: 'respond' }), draftWithBody('committed'));
    s = markPosted(s);
    expect(s.lifecycle).toBe('posted');
    expect(s.draftBuffers.respond).toBe(EMPTY_DRAFT);
  });

  it('markPosted preserves every OTHER type parked buffer', () => {
    let s = createBoxState({ type: 'respond' });
    s = updateActiveDraft(s, draftWithBody('respond draft'));
    s = switchBoxType(s, 'clarify'); // park respond
    s = updateActiveDraft(s, draftWithBody('clarify draft'));
    s = markPosted(s); // post the clarify move
    expect(s.draftBuffers.clarify).toBe(EMPTY_DRAFT); // spent
    expect(s.draftBuffers.respond.body).toBe('respond draft'); // still parked
  });

  it('markPosted works from the review lifecycle', () => {
    let s = updateActiveDraft(createBoxState(), draftWithBody('x'));
    s = enterReview(s);
    s = markPosted(s);
    expect(s.lifecycle).toBe('posted');
  });

  it('markPosted is a no-op from a non-drafting / non-review lifecycle', () => {
    const empty = createBoxState();
    expect(markPosted(empty)).toBe(empty);
    const typed = switchBoxType(createBoxState(), 'respond');
    expect(markPosted(typed)).toBe(typed);
  });

  it('resetAfterPost moves posted → empty so the box can compose again', () => {
    let s = updateActiveDraft(createBoxState(), draftWithBody('x'));
    s = markPosted(s);
    s = resetAfterPost(s);
    expect(s.lifecycle).toBe('empty');
  });

  it('resetAfterPost is a no-op from a non-posted lifecycle', () => {
    const drafting = updateActiveDraft(createBoxState(), draftWithBody('x'));
    expect(resetAfterPost(drafting)).toBe(drafting);
  });

  it('never mutates the input state', () => {
    let s = updateActiveDraft(createBoxState(), draftWithBody('x'));
    const snapshot = JSON.stringify(s);
    markPosted(s);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

// ── 11. Full compose round trip ────────────────────────────────

describe('QOL-030 boxModel — full compose round trip', () => {
  it('empty → typed → drafting → review → posted → empty', () => {
    let s = createBoxState(); // empty
    expect(s.lifecycle).toBe('empty');
    s = switchBoxType(s, 'respond'); // typed
    expect(s.lifecycle).toBe('typed');
    s = updateActiveDraft(s, draftWithBody('here is my reply')); // drafting
    expect(s.lifecycle).toBe('drafting');
    s = enterReview(s); // review
    expect(s.lifecycle).toBe('review');
    s = markPosted(s); // posted
    expect(s.lifecycle).toBe('posted');
    s = resetAfterPost(s); // empty, ready for the next move
    expect(s.lifecycle).toBe('empty');
  });
});

// ── 12. Ban-list export shape ──────────────────────────────────

describe('QOL-030 boxModel — _forbiddenBoxTokens', () => {
  it('returns a non-empty token list', () => {
    expect(_forbiddenBoxTokens().length).toBeGreaterThan(0);
  });

  it('includes the core verdict + amplification tokens', () => {
    const tokens = _forbiddenBoxTokens();
    for (const t of ['winner', 'loser', 'viral', 'engagement']) {
      expect(tokens).toContain(t);
    }
  });
});
