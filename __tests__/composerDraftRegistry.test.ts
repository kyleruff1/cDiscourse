/**
 * UX-001.3 — composerDraftRegistry pure-model tests.
 *
 * Covers the per-target × per-mode draft persistence contract:
 *  - empty registry round-trips
 *  - setDraft / getDraft / clearDraft semantics
 *  - per-target isolation (target A's Reply ≠ target B's Reply)
 *  - per-mode isolation (Reply ≠ Add Evidence at the same target)
 *  - listNonEmptyDrafts ordering
 *  - dropTarget surgical removal
 *  - immutability (registry snapshots are frozen, inputs never mutated)
 */
import {
  ROOT_TARGET_KEY,
  clearDraft,
  createEmptyComposerDraftRegistry,
  deriveTargetKey,
  dropTarget,
  getDraft,
  hasDraftAt,
  isRegistryEmpty,
  listNonEmptyDrafts,
  setDraft,
} from '../src/features/arguments/composer/composerDraftRegistry';
import { EMPTY_DRAFT } from '../src/features/arguments/oneBox/boxModel';
import type { Draft } from '../src/features/arguments/oneBox/boxModel';

const replyDraftA: Draft = Object.freeze({
  body: 'I disagree with the claim about X.',
  listItems: Object.freeze([]),
  fields: Object.freeze({}),
});

const replyDraftB: Draft = Object.freeze({
  body: 'I disagree with the claim about Y.',
  listItems: Object.freeze([]),
  fields: Object.freeze({}),
});

const addEvidenceDraft: Draft = Object.freeze({
  body: '',
  listItems: Object.freeze([]),
  fields: Object.freeze({ url: 'https://example.org/study', label: 'Study' }),
});

describe('composerDraftRegistry — deriveTargetKey', () => {
  it('returns the ROOT sentinel for null parent', () => {
    expect(deriveTargetKey(null)).toBe(ROOT_TARGET_KEY);
  });

  it('returns the parent id for a non-null parent', () => {
    expect(deriveTargetKey('arg-123')).toBe('arg-123');
  });

  it('ROOT_TARGET_KEY is the underscore-bracketed sentinel', () => {
    expect(ROOT_TARGET_KEY).toBe('__root__');
  });
});

describe('composerDraftRegistry — empty registry', () => {
  it('createEmptyComposerDraftRegistry returns an empty frozen registry', () => {
    const registry = createEmptyComposerDraftRegistry();
    expect(Object.keys(registry)).toEqual([]);
    expect(Object.isFrozen(registry)).toBe(true);
  });

  it('getDraft on an empty registry returns EMPTY_DRAFT', () => {
    const registry = createEmptyComposerDraftRegistry();
    expect(getDraft(registry, 'arg-1', 'respond')).toBe(EMPTY_DRAFT);
    expect(getDraft(registry, ROOT_TARGET_KEY, 'root_claim')).toBe(EMPTY_DRAFT);
  });

  it('isRegistryEmpty returns true for a fresh registry', () => {
    expect(isRegistryEmpty(createEmptyComposerDraftRegistry())).toBe(true);
  });

  it('hasDraftAt returns false on an empty registry', () => {
    const registry = createEmptyComposerDraftRegistry();
    expect(hasDraftAt(registry, 'arg-1', 'respond')).toBe(false);
  });
});

describe('composerDraftRegistry — setDraft / getDraft round-trip', () => {
  it('writes and reads a draft at (targetKey, boxType)', () => {
    const r0 = createEmptyComposerDraftRegistry();
    const r1 = setDraft(r0, 'arg-A', 'respond', replyDraftA);
    expect(getDraft(r1, 'arg-A', 'respond')).toBe(replyDraftA);
  });

  it('does not mutate the input registry', () => {
    const r0 = createEmptyComposerDraftRegistry();
    setDraft(r0, 'arg-A', 'respond', replyDraftA);
    // The original is still empty.
    expect(Object.keys(r0)).toEqual([]);
  });

  it('returns a frozen registry on every write', () => {
    const r0 = createEmptyComposerDraftRegistry();
    const r1 = setDraft(r0, 'arg-A', 'respond', replyDraftA);
    expect(Object.isFrozen(r1)).toBe(true);
    expect(Object.isFrozen(r1['arg-A'])).toBe(true);
  });

  it('overwrites a previous draft at the same key', () => {
    const r0 = createEmptyComposerDraftRegistry();
    const r1 = setDraft(r0, 'arg-A', 'respond', replyDraftA);
    const overwritten: Draft = {
      body: 'Different body now.',
      listItems: Object.freeze([]),
      fields: Object.freeze({}),
    };
    const r2 = setDraft(r1, 'arg-A', 'respond', overwritten);
    expect(getDraft(r2, 'arg-A', 'respond').body).toBe('Different body now.');
  });
});

describe('composerDraftRegistry — per-target isolation', () => {
  it('Reply on target A and Reply on target B are independent', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = setDraft(r, 'arg-B', 'respond', replyDraftB);
    expect(getDraft(r, 'arg-A', 'respond').body).toBe(replyDraftA.body);
    expect(getDraft(r, 'arg-B', 'respond').body).toBe(replyDraftB.body);
  });

  it('writing target B does not touch target A', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    const snapshotA = r['arg-A'];
    r = setDraft(r, 'arg-B', 'respond', replyDraftB);
    expect(r['arg-A']).toBe(snapshotA);
  });

  it('ROOT and a parent id are independent target keys', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, ROOT_TARGET_KEY, 'root_claim', {
      body: 'My new resolution thoughts.',
      listItems: Object.freeze([]),
      fields: Object.freeze({}),
    });
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    expect(getDraft(r, ROOT_TARGET_KEY, 'root_claim').body).toBe(
      'My new resolution thoughts.',
    );
    expect(getDraft(r, 'arg-A', 'respond').body).toBe(replyDraftA.body);
  });
});

describe('composerDraftRegistry — per-mode isolation', () => {
  it('Reply and Add Evidence at the same target are independent', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = setDraft(r, 'arg-A', 'add_evidence', addEvidenceDraft);
    expect(getDraft(r, 'arg-A', 'respond')).toBe(replyDraftA);
    expect(getDraft(r, 'arg-A', 'add_evidence')).toBe(addEvidenceDraft);
  });

  it('switching Reply → AddEvidence → Reply preserves the Reply draft', () => {
    let r = createEmptyComposerDraftRegistry();
    // 1. Start a Reply.
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    // 2. Park it; start Add Evidence.
    r = setDraft(r, 'arg-A', 'add_evidence', addEvidenceDraft);
    // 3. Switch back to Reply — the prior Reply body is still there.
    expect(getDraft(r, 'arg-A', 'respond').body).toBe(replyDraftA.body);
  });
});

describe('composerDraftRegistry — clearDraft', () => {
  it('clears a single (targetKey, boxType) buffer to EMPTY_DRAFT', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = clearDraft(r, 'arg-A', 'respond');
    expect(getDraft(r, 'arg-A', 'respond')).toBe(EMPTY_DRAFT);
  });

  it('does not touch siblings at the same target', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = setDraft(r, 'arg-A', 'add_evidence', addEvidenceDraft);
    r = clearDraft(r, 'arg-A', 'respond');
    expect(getDraft(r, 'arg-A', 'add_evidence')).toBe(addEvidenceDraft);
  });

  it('is a no-op when the target has no buffers', () => {
    const r0 = createEmptyComposerDraftRegistry();
    const r1 = clearDraft(r0, 'arg-A', 'respond');
    expect(r1).toBe(r0);
  });
});

describe('composerDraftRegistry — isRegistryEmpty / hasDraftAt', () => {
  it('hasDraftAt is true after a write, false after a clear', () => {
    let r = createEmptyComposerDraftRegistry();
    expect(hasDraftAt(r, 'arg-A', 'respond')).toBe(false);
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    expect(hasDraftAt(r, 'arg-A', 'respond')).toBe(true);
    r = clearDraft(r, 'arg-A', 'respond');
    expect(hasDraftAt(r, 'arg-A', 'respond')).toBe(false);
  });

  it('isRegistryEmpty is false when any buffer is non-empty', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    expect(isRegistryEmpty(r)).toBe(false);
  });

  it('isRegistryEmpty is true when every buffer is empty after clear', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = clearDraft(r, 'arg-A', 'respond');
    expect(isRegistryEmpty(r)).toBe(true);
  });

  it('a draft of only whitespace counts as empty', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', {
      body: '   \n\t   ',
      listItems: Object.freeze([]),
      fields: Object.freeze({}),
    });
    expect(hasDraftAt(r, 'arg-A', 'respond')).toBe(false);
    expect(isRegistryEmpty(r)).toBe(true);
  });
});

describe('composerDraftRegistry — listNonEmptyDrafts', () => {
  it('returns an empty frozen array for an empty registry', () => {
    const list = listNonEmptyDrafts(createEmptyComposerDraftRegistry());
    expect(list).toEqual([]);
    expect(Object.isFrozen(list)).toBe(true);
  });

  it('lists every non-empty (targetKey, boxType) pair', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = setDraft(r, 'arg-A', 'add_evidence', addEvidenceDraft);
    r = setDraft(r, 'arg-B', 'respond', replyDraftB);
    const list = listNonEmptyDrafts(r);
    expect(list).toHaveLength(3);
    // Insertion order preserved.
    expect(list[0]).toEqual({ targetKey: 'arg-A', boxType: 'respond' });
    expect(list[1]).toEqual({ targetKey: 'arg-A', boxType: 'add_evidence' });
    expect(list[2]).toEqual({ targetKey: 'arg-B', boxType: 'respond' });
  });

  it('does not list empty buffers', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = setDraft(r, 'arg-A', 'add_evidence', EMPTY_DRAFT);
    const list = listNonEmptyDrafts(r);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ targetKey: 'arg-A', boxType: 'respond' });
  });
});

describe('composerDraftRegistry — dropTarget', () => {
  it('removes every buffer at the given target', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    r = setDraft(r, 'arg-A', 'add_evidence', addEvidenceDraft);
    r = setDraft(r, 'arg-B', 'respond', replyDraftB);
    r = dropTarget(r, 'arg-A');
    expect(getDraft(r, 'arg-A', 'respond')).toBe(EMPTY_DRAFT);
    expect(getDraft(r, 'arg-A', 'add_evidence')).toBe(EMPTY_DRAFT);
    expect(getDraft(r, 'arg-B', 'respond')).toBe(replyDraftB);
  });

  it('is a no-op for an unknown target', () => {
    let r = createEmptyComposerDraftRegistry();
    r = setDraft(r, 'arg-A', 'respond', replyDraftA);
    const r2 = dropTarget(r, 'arg-X');
    expect(r2).toBe(r);
  });
});

describe('composerDraftRegistry — doctrine ban-list', () => {
  it('no verdict token in the constants', () => {
    const banned = ['winner', 'loser', 'liar', 'true', 'false', 'correct'];
    const text = [ROOT_TARGET_KEY].join(' ').toLowerCase();
    for (const b of banned) {
      expect(text).not.toContain(b);
    }
  });
});
