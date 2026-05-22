/**
 * QOL-042 — one-box root_claim linkedPriorRoomId integration tests.
 *
 * The root_claim box's setup draft accepts an OPTIONAL linkedPriorRoomId.
 * The field is additive: omitting it leaves every existing box behaviour
 * unchanged, and a draft carrying ONLY a link id is still "empty" (a link
 * id is room setup, not drafted body content).
 */
import {
  createBoxState,
  createEmptyDraftBuffers,
  isDraftEmpty,
  switchBoxType,
  updateActiveDraft,
  EMPTY_DRAFT,
  type Draft,
} from '../src/features/arguments/oneBox/boxModel';

describe('Draft.linkedPriorRoomId — additive optional field', () => {
  it('EMPTY_DRAFT leaves linkedPriorRoomId undefined', () => {
    expect(EMPTY_DRAFT.linkedPriorRoomId).toBeUndefined();
  });

  it('every per-type buffer starts with linkedPriorRoomId undefined', () => {
    const buffers = createEmptyDraftBuffers();
    expect(buffers.root_claim.linkedPriorRoomId).toBeUndefined();
    expect(buffers.respond.linkedPriorRoomId).toBeUndefined();
  });

  it('a Draft with only a linkedPriorRoomId is still empty (link id is setup, not content)', () => {
    const draft: Draft = {
      ...EMPTY_DRAFT,
      linkedPriorRoomId: 'room-prior-1',
    };
    expect(isDraftEmpty(draft)).toBe(true);
  });

  it('a Draft with a body is non-empty regardless of the link id', () => {
    const draft: Draft = {
      ...EMPTY_DRAFT,
      body: 'My opening claim',
      linkedPriorRoomId: 'room-prior-1',
    };
    expect(isDraftEmpty(draft)).toBe(false);
  });
});

describe('root_claim box — linkedPriorRoomId round-trips through the draft', () => {
  it('updateActiveDraft preserves a linkedPriorRoomId set on the root_claim draft', () => {
    const state = createBoxState({ type: 'root_claim' });
    const next = updateActiveDraft(state, {
      ...EMPTY_DRAFT,
      body: 'Opening claim that references a prior argument',
      linkedPriorRoomId: 'room-prior-7',
    });
    expect(next.draftBuffers.root_claim.linkedPriorRoomId).toBe('room-prior-7');
    expect(next.draftBuffers.root_claim.body).toBe(
      'Opening claim that references a prior argument',
    );
  });

  it('omitting linkedPriorRoomId leaves room creation behaviour unchanged (non-breaking)', () => {
    const state = createBoxState({ type: 'root_claim' });
    const next = updateActiveDraft(state, {
      ...EMPTY_DRAFT,
      body: 'A plain opening claim',
    });
    expect(next.draftBuffers.root_claim.linkedPriorRoomId).toBeUndefined();
    expect(next.lifecycle).toBe('drafting');
  });

  it('a parked root_claim draft retains its link id after a type switch and back', () => {
    let state = createBoxState({ type: 'root_claim' });
    state = updateActiveDraft(state, {
      ...EMPTY_DRAFT,
      body: 'Opening claim',
      linkedPriorRoomId: 'room-prior-9',
    });
    // Switch away — the root_claim buffer is parked, not destroyed.
    state = switchBoxType(state, 'respond');
    // Switch back.
    state = switchBoxType(state, 'root_claim');
    expect(state.draftBuffers.root_claim.linkedPriorRoomId).toBe('room-prior-9');
    expect(state.draftBuffers.root_claim.body).toBe('Opening claim');
  });
});
