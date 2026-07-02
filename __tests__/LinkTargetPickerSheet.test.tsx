/**
 * QUOTE-FORGE-001 — LinkTargetPickerSheet tests (RNTL).
 *
 * Covers: candidate listing (only what it is given), same-circle section
 * header visibility, the pickerEmpty state, the observer disabled-with-
 * reason path, note clamp, the create flow (select -> submit), and the
 * a11y contract (role / label / state / hit target) on every Pressable.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LinkTargetPickerSheet } from '../src/features/arguments/crossRoom/LinkTargetPickerSheet';
import { LINKED_PRIOR_ARGUMENT_COPY } from '../src/features/arguments/crossRoom/linkedPriorArgumentCopy';
import type {
  LinkTargetCandidate,
  LinkTargetPickerModel,
} from '../src/features/arguments/crossRoom/linkTargetPickerModel';

function candidate(over: Partial<LinkTargetCandidate> = {}): LinkTargetCandidate {
  return {
    debateId: over.debateId ?? 'd1',
    title: over.title ?? 'A prior argument',
    circleId: over.circleId ?? null,
    sameCircle: over.sameCircle ?? false,
  };
}

function model(over: Partial<LinkTargetPickerModel> = {}): LinkTargetPickerModel {
  return {
    sameCircle: over.sameCircle ?? [],
    other: over.other ?? [candidate()],
    moreNotShown: over.moreNotShown ?? false,
    isEmpty: over.isEmpty ?? false,
  };
}

function renderSheet(over: Partial<React.ComponentProps<typeof LinkTargetPickerSheet>> = {}) {
  const onCreate = jest.fn().mockResolvedValue({ ok: true });
  const onClose = jest.fn();
  const utils = render(
    <LinkTargetPickerSheet
      visible
      model={model()}
      loadingCandidates={false}
      canCreate
      onCreate={onCreate}
      onClose={onClose}
      reduceMotionOverride
      {...over}
    />,
  );
  return { onCreate, onClose, ...utils };
}

describe('LinkTargetPickerSheet — listing', () => {
  it('renders the create affordance copy and the candidate it is given', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('link-target-picker-sheet')).toBeTruthy();
    expect(getByTestId('link-target-create-affordance')).toBeTruthy();
    expect(getByTestId('link-target-candidate-d1')).toBeTruthy();
  });

  it('shows the same-circle section header only when same-circle candidates exist', () => {
    const { queryByTestId, rerender } = renderSheet({
      model: model({ sameCircle: [], other: [candidate()] }),
    });
    expect(queryByTestId('link-target-same-circle-header')).toBeNull();

    rerender(
      <LinkTargetPickerSheet
        visible
        model={model({ sameCircle: [candidate({ debateId: 'sc1', sameCircle: true })], other: [] })}
        loadingCandidates={false}
        canCreate
        onCreate={jest.fn()}
        onClose={jest.fn()}
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('link-target-same-circle-header')).toBeTruthy();
    expect(queryByTestId('link-target-candidate-sc1')).toBeTruthy();
  });

  it('renders the pickerEmpty copy for an empty model', () => {
    const { getByTestId, getByText } = renderSheet({
      model: model({ sameCircle: [], other: [], isEmpty: true }),
    });
    expect(getByTestId('link-target-empty')).toBeTruthy();
    expect(getByText(LINKED_PRIOR_ARGUMENT_COPY.pickerEmpty)).toBeTruthy();
  });

  it('renders the more-not-shown line when the model flags it', () => {
    const { getByTestId } = renderSheet({ model: model({ moreNotShown: true }) });
    expect(getByTestId('link-target-more-not-shown')).toBeTruthy();
  });
});

describe('LinkTargetPickerSheet — observer disabled-with-reason', () => {
  it('shows the observer reason and disables the submit button', () => {
    const { getByTestId } = renderSheet({ canCreate: false });
    expect(getByTestId('link-target-observer-reason')).toBeTruthy();
    const submit = getByTestId('link-target-submit');
    expect(submit.props.accessibilityState.disabled).toBe(true);
  });
});

describe('LinkTargetPickerSheet — create flow', () => {
  it('selects a candidate and submits with the note', async () => {
    const onCreate = jest.fn().mockResolvedValue({ ok: true });
    const onClose = jest.fn();
    const { getByTestId } = render(
      <LinkTargetPickerSheet
        visible
        model={model({ other: [candidate({ debateId: 'pick-me', title: 'Pick me' })] })}
        loadingCandidates={false}
        canCreate
        onCreate={onCreate}
        onClose={onClose}
        reduceMotionOverride
      />,
    );
    // Submit is disabled until a candidate is picked.
    expect(getByTestId('link-target-submit').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('link-target-candidate-pick-me'));
    fireEvent.changeText(getByTestId('link-target-note-input'), 'why it matters');
    fireEvent.press(getByTestId('link-target-submit'));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0][0].debateId).toBe('pick-me');
    expect(onCreate.mock.calls[0][1]).toBe('why it matters');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows a plain-language error when create fails (sheet stays open)', async () => {
    const onCreate = jest.fn().mockResolvedValue({ ok: false, error: 'Could not reference it.' });
    const onClose = jest.fn();
    const { getByTestId } = render(
      <LinkTargetPickerSheet
        visible
        model={model({ other: [candidate({ debateId: 'x' })] })}
        loadingCandidates={false}
        canCreate
        onCreate={onCreate}
        onClose={onClose}
        reduceMotionOverride
      />,
    );
    fireEvent.press(getByTestId('link-target-candidate-x'));
    fireEvent.press(getByTestId('link-target-submit'));
    await waitFor(() => expect(getByTestId('link-target-error')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes calmly on a duplicate (idempotent success)', async () => {
    const onCreate = jest.fn().mockResolvedValue({ ok: true, duplicate: true });
    const onClose = jest.fn();
    const { getByTestId } = render(
      <LinkTargetPickerSheet
        visible
        model={model({ other: [candidate({ debateId: 'dup' })] })}
        loadingCandidates={false}
        canCreate
        onCreate={onCreate}
        onClose={onClose}
        reduceMotionOverride
      />,
    );
    fireEvent.press(getByTestId('link-target-candidate-dup'));
    fireEvent.press(getByTestId('link-target-submit'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('LinkTargetPickerSheet — note clamp', () => {
  it('clamps the note to 280 characters', () => {
    const { getByTestId } = renderSheet({
      model: model({ other: [candidate({ debateId: 'z' })] }),
    });
    const input = getByTestId('link-target-note-input');
    fireEvent.changeText(input, 'y'.repeat(400));
    expect(input.props.value.length).toBe(280);
  });
});

describe('LinkTargetPickerSheet — a11y', () => {
  it('every interactive control is a button with a label, state, and 44x44 hit target', () => {
    const { getByTestId } = renderSheet({
      model: model({ other: [candidate({ debateId: 'a11y' })] }),
    });
    const controls = [
      getByTestId('link-target-candidate-a11y'),
      getByTestId('link-target-cancel'),
      getByTestId('link-target-submit'),
    ];
    for (const c of controls) {
      expect(c.props.accessibilityRole).toBe('button');
      expect(typeof c.props.accessibilityLabel).toBe('string');
      expect(c.props.accessibilityLabel.length).toBeGreaterThan(0);
      expect(c.props.accessibilityState).toBeDefined();
      const hs = c.props.hitSlop;
      expect(hs.top + hs.bottom).toBeGreaterThanOrEqual(20);
      expect(hs.left + hs.right).toBeGreaterThanOrEqual(20);
    }
  });

  it('the note input carries an accessibilityLabel', () => {
    const { getByTestId } = renderSheet({
      model: model({ other: [candidate({ debateId: 'n' })] }),
    });
    const input = getByTestId('link-target-note-input');
    expect(typeof input.props.accessibilityLabel).toBe('string');
    expect(input.props.accessibilityLabel.length).toBeGreaterThan(0);
  });
});

// ── Ban-list — no new user-facing string carries a forbidden token ──
describe('LinkTargetPickerSheet — ban-list', () => {
  it('the observer reason + section copy carry no verdict / amplification token', () => {
    // The sheet strings that are NOT drawn from LINKED_PRIOR_ARGUMENT_COPY
    // (which is scanned by linkedPriorArgumentCopy.test.ts) are asserted
    // clean here against the same forbidden list.
    const {
      _forbiddenLinkedPriorTokens,
    } = require('../src/features/arguments/crossRoom/linkedPriorArgumentCopy');
    const banned: string[] = _forbiddenLinkedPriorTokens();
    const rendered = render(
      <LinkTargetPickerSheet
        visible
        model={model({ other: [candidate({ debateId: 'b' })], moreNotShown: true })}
        loadingCandidates={false}
        canCreate={false}
        onCreate={jest.fn()}
        onClose={jest.fn()}
        reduceMotionOverride
      />,
    );
    // Collect only the rendered text + accessibilityLabels — NOT the whole
    // JSON tree (whose boolean prop values like `visible: true` would
    // false-positive on the "true" token).
    const strings: string[] = [];
    const walk = (node: unknown): void => {
      if (node == null) return;
      if (typeof node === 'string') {
        strings.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === 'object') {
        const n = node as { props?: Record<string, unknown>; children?: unknown };
        const label = n.props?.accessibilityLabel;
        if (typeof label === 'string') strings.push(label);
        if (n.children != null) walk(n.children);
      }
    };
    walk(rendered.toJSON());
    const text = strings.join(' ').toLowerCase();
    for (const token of banned) {
      expect(text).not.toContain(token.toLowerCase());
    }
  });
});
