/**
 * UX-001.3 — useComposerDraftRegistry hook tests.
 *
 * Covers:
 *  - Initial state is an empty registry.
 *  - writeDraft → readDraft round-trip.
 *  - hasDraft true after write, false after a write of empty draft.
 *  - Per-target × per-mode persistence.
 *  - Changing debateId resets the registry.
 *  - Mode switch round-trip: Reply → Add Evidence → Reply restores the
 *    Reply body.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useComposerDraftRegistry } from '../src/features/arguments/composer/useComposerDraftRegistry';
import type { Draft } from '../src/features/arguments/oneBox/boxModel';

interface Captured {
  readDraft: ReturnType<typeof useComposerDraftRegistry>['readDraft'] | null;
  writeDraft: ReturnType<typeof useComposerDraftRegistry>['writeDraft'] | null;
  hasDraft: ReturnType<typeof useComposerDraftRegistry>['hasDraft'] | null;
  snapshot: ReturnType<typeof useComposerDraftRegistry>['snapshot'] | null;
}

function Probe({
  debateId,
  captured,
}: {
  debateId: string;
  captured: Captured;
}) {
  const r = useComposerDraftRegistry(debateId);
  captured.readDraft = r.readDraft;
  captured.writeDraft = r.writeDraft;
  captured.hasDraft = r.hasDraft;
  captured.snapshot = r.snapshot;
  return <Text testID="probe">probe</Text>;
}

function makeDraft(body: string): Draft {
  return { body, listItems: Object.freeze([]), fields: Object.freeze({}) };
}

describe('useComposerDraftRegistry — initial state', () => {
  it('starts with an empty registry', () => {
    const captured: Captured = {
      readDraft: null,
      writeDraft: null,
      hasDraft: null,
      snapshot: null,
    };
    render(<Probe debateId="d-1" captured={captured} />);
    expect(Object.keys(captured.snapshot ?? {})).toEqual([]);
  });

  it('readDraft on a fresh registry returns EMPTY_DRAFT', () => {
    const captured: Captured = {
      readDraft: null,
      writeDraft: null,
      hasDraft: null,
      snapshot: null,
    };
    render(<Probe debateId="d-1" captured={captured} />);
    const d = captured.readDraft?.('arg-1', 'respond');
    expect(d?.body).toBe('');
    expect(d?.listItems).toEqual([]);
    expect(d?.fields).toEqual({});
  });
});

describe('useComposerDraftRegistry — write + read', () => {
  it('round-trips a draft', () => {
    const captured: Captured = {
      readDraft: null,
      writeDraft: null,
      hasDraft: null,
      snapshot: null,
    };
    render(<Probe debateId="d-1" captured={captured} />);
    act(() => {
      captured.writeDraft?.('arg-1', 'respond', makeDraft('Hello reply'));
    });
    expect(captured.readDraft?.('arg-1', 'respond').body).toBe('Hello reply');
  });

  it('hasDraft is true after a non-empty write, false after a clear', () => {
    const captured: Captured = {
      readDraft: null,
      writeDraft: null,
      hasDraft: null,
      snapshot: null,
    };
    render(<Probe debateId="d-1" captured={captured} />);
    act(() => {
      captured.writeDraft?.('arg-1', 'respond', makeDraft('not empty'));
    });
    expect(captured.hasDraft?.('arg-1', 'respond')).toBe(true);
    act(() => {
      captured.writeDraft?.('arg-1', 'respond', makeDraft(''));
    });
    expect(captured.hasDraft?.('arg-1', 'respond')).toBe(false);
  });
});

describe('useComposerDraftRegistry — mode switch round-trip (the load-bearing brief case)', () => {
  it('Reply → Add Evidence → Reply restores the Reply body', () => {
    const captured: Captured = {
      readDraft: null,
      writeDraft: null,
      hasDraft: null,
      snapshot: null,
    };
    render(<Probe debateId="d-1" captured={captured} />);
    // Reply body for target A.
    act(() => {
      captured.writeDraft?.('arg-A', 'respond', makeDraft('My reply body.'));
    });
    // Park Reply; start Add Evidence body for target A.
    act(() => {
      captured.writeDraft?.('arg-A', 'add_evidence', makeDraft('My evidence URL/text.'));
    });
    // Switch back to Reply — the Reply body is restored.
    expect(captured.readDraft?.('arg-A', 'respond').body).toBe('My reply body.');
    expect(captured.readDraft?.('arg-A', 'add_evidence').body).toBe('My evidence URL/text.');
  });
});

describe('useComposerDraftRegistry — per-target isolation', () => {
  it('the Reply for target A is independent of the Reply for target B', () => {
    const captured: Captured = {
      readDraft: null,
      writeDraft: null,
      hasDraft: null,
      snapshot: null,
    };
    render(<Probe debateId="d-1" captured={captured} />);
    act(() => {
      captured.writeDraft?.('arg-A', 'respond', makeDraft('body A'));
      captured.writeDraft?.('arg-B', 'respond', makeDraft('body B'));
    });
    expect(captured.readDraft?.('arg-A', 'respond').body).toBe('body A');
    expect(captured.readDraft?.('arg-B', 'respond').body).toBe('body B');
  });
});

describe('useComposerDraftRegistry — debateId reset', () => {
  it('changing the debate id zeroes the registry', () => {
    const captured: Captured = {
      readDraft: null,
      writeDraft: null,
      hasDraft: null,
      snapshot: null,
    };
    const { rerender } = render(<Probe debateId="d-1" captured={captured} />);
    act(() => {
      captured.writeDraft?.('arg-1', 'respond', makeDraft('hello'));
    });
    expect(captured.readDraft?.('arg-1', 'respond').body).toBe('hello');
    rerender(<Probe debateId="d-2" captured={captured} />);
    // After the room change, the buffer is gone.
    expect(captured.readDraft?.('arg-1', 'respond').body).toBe('');
  });
});
