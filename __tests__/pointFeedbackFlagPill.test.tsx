/**
 * UX-FLAGS-004 (#836) — PointFeedbackFlagPill actionable-arm tests.
 *
 * The pill is inert (role text) UNLESS the parent passes BOTH onPress AND
 * actionable === true — then it is a calm button (same muted visual) with role +
 * hint + 44x44 hitSlop + a web focus ring. Covers: inert default, actionable
 * button fires onPress(flag.id), the firing negative control (onPress present but
 * actionable false stays inert), and grayscale glyph legibility.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PointFeedbackFlagPill } from '../src/features/feedbackFlags/PointFeedbackFlagPill';
import type { PointFeedbackFlagViewModel } from '../src/features/feedbackFlags/pointFeedbackFlagsModel';

function vm(
  p: Partial<PointFeedbackFlagViewModel> & { id: string; label: string },
): PointFeedbackFlagViewModel {
  return {
    id: p.id,
    label: p.label,
    helper: p.helper,
    tone: p.tone ?? 'prompt',
    neverGrantsStanding: p.neverGrantsStanding ?? false,
    accessibilityLabel: p.accessibilityLabel ?? `Prompt, ${p.label}`,
    family: p.family ?? 'evidence_source_chain',
  };
}

const RECEIPT = vm({ id: 'needs_a_receipt', label: 'Needs a receipt', tone: 'prompt', neverGrantsStanding: true });

describe('PointFeedbackFlagPill — inert by default (byte-identical to UX-FLAGS-002)', () => {
  it('renders role="text" and no onPress when onPress is absent', () => {
    const { getByTestId } = render(<PointFeedbackFlagPill flag={RECEIPT} />);
    const pill = getByTestId('point-feedback-flag-needs_a_receipt');
    expect(pill.props.accessibilityRole).toBe('text');
    expect(pill.props.onPress).toBeUndefined();
    expect(pill.props.accessibilityHint).toBeUndefined();
  });

  it('firing negative control: onPress present but actionable={false} renders the inert View with no press handler', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PointFeedbackFlagPill flag={RECEIPT} onPress={onPress} actionable={false} />,
    );
    const pill = getByTestId('point-feedback-flag-needs_a_receipt');
    // The rendered host is the inert View: role text, and NO onPress affordance
    // on the element (a stray onPress prop is ignored when actionable is false).
    expect(pill.props.accessibilityRole).toBe('text');
    expect(pill.props.onPress).toBeUndefined();
    expect(pill.type).toBe('View');
  });
});

describe('PointFeedbackFlagPill — actionable arm (flag on + gated by parent)', () => {
  it('renders role="button", a hint, and 44x44-clearing hitSlop', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PointFeedbackFlagPill flag={RECEIPT} onPress={onPress} actionable />,
    );
    const pill = getByTestId('point-feedback-flag-needs_a_receipt');
    expect(pill.props.accessibilityRole).toBe('button');
    expect(typeof pill.props.accessibilityHint).toBe('string');
    expect(pill.props.accessibilityHint.length).toBeGreaterThan(0);
    const slop = pill.props.hitSlop;
    expect(slop.top).toBeGreaterThanOrEqual(12);
    expect(slop.bottom).toBeGreaterThanOrEqual(12);
    expect(slop.left).toBeGreaterThanOrEqual(12);
    expect(slop.right).toBeGreaterThanOrEqual(12);
  });

  it('fires onPress with the flag id when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PointFeedbackFlagPill flag={RECEIPT} onPress={onPress} actionable />,
    );
    fireEvent.press(getByTestId('point-feedback-flag-needs_a_receipt'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('needs_a_receipt');
  });

  it('keeps the accessibility label = the VM spoken label (unchanged from inert)', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagPill flag={RECEIPT} onPress={jest.fn()} actionable />,
    );
    expect(getByTestId('point-feedback-flag-needs_a_receipt').props.accessibilityLabel).toBe(
      'Prompt, Needs a receipt',
    );
  });

  it('applies a resolved style and pins the web focus-ring wiring at the source', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagPill flag={RECEIPT} onPress={jest.fn()} actionable />,
    );
    // The Pressable resolves its function style, so props.style is the resolved
    // value (array/object), not the function itself — just assert it is present.
    expect(getByTestId('point-feedback-flag-needs_a_receipt').props.style).toBeDefined();
    // Pin the focus ring wiring (web-only, focus-state gated) at the source.
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/feedbackFlags/PointFeedbackFlagPill.tsx'),
      'utf8',
    );
    expect(src).toContain('pillFocused');
    expect(src).toContain('FOCUS_RING');
    expect(src).toMatch(/Platform\.OS === 'web'/);
  });
});

describe('PointFeedbackFlagPill — grayscale legibility (glyph carries tone)', () => {
  function glyphOf(node: { props: { children?: unknown } }): string {
    const strings: string[] = [];
    const walk = (n: unknown): void => {
      if (n == null) return;
      if (typeof n === 'string') {
        strings.push(n);
        return;
      }
      if (Array.isArray(n)) {
        n.forEach(walk);
        return;
      }
      if (typeof n === 'object') walk((n as { props?: { children?: unknown } }).props?.children);
    };
    walk(node.props.children);
    return strings.join('').trim().charAt(0);
  }

  it('the actionable button keeps the same tone glyph as the inert pill', () => {
    const inert = render(<PointFeedbackFlagPill flag={RECEIPT} />);
    const actionable = render(
      <PointFeedbackFlagPill flag={RECEIPT} onPress={jest.fn()} actionable />,
    );
    const inertGlyph = glyphOf(inert.getByTestId('point-feedback-flag-needs_a_receipt'));
    const actionableGlyph = glyphOf(actionable.getByTestId('point-feedback-flag-needs_a_receipt'));
    expect(inertGlyph).toBe('?'); // prompt tone
    expect(actionableGlyph).toBe(inertGlyph); // visual is unchanged, only role/hint/hitSlop
  });
});
