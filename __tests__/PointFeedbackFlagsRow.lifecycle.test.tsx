/**
 * UX-FLAGS-005 (issue 837) — PointFeedbackFlagsRow lifecycle render tests.
 *
 * Extends the UX-FLAGS-002 render pins with the three new lifecycle
 * empty-branches:
 *
 *   ready   (or omitted)  -> render null (byte-identical to UX-FLAGS-002)
 *   pending               -> render ONE calm passive-readout <Text>
 *   failed                -> render null (silent doctrine)
 *
 * Non-empty flag list ignores lifecycleState -- content always wins over
 * posture. A firing negative control asserts no raw queue enum ever
 * surfaces in the rendered tree for any lifecycle input.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { PointFeedbackFlagsRow } from '../src/features/feedbackFlags/PointFeedbackFlagsRow';
import type { PointFeedbackFlagViewModel } from '../src/features/feedbackFlags/pointFeedbackFlagsModel';
import { POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY } from '../src/features/arguments/gameCopy';

function vm(p: Partial<PointFeedbackFlagViewModel> & { id: string; label: string }): PointFeedbackFlagViewModel {
  return {
    id: p.id,
    label: p.label,
    helper: p.helper,
    tone: p.tone ?? 'descriptive',
    neverGrantsStanding: p.neverGrantsStanding ?? false,
    accessibilityLabel: p.accessibilityLabel ?? `Note, ${p.label}`,
    family: p.family ?? 'parent_relation',
  };
}

const SAMPLE_FLAG: PointFeedbackFlagViewModel = vm({
  id: 'needs_a_receipt',
  label: 'Needs a receipt',
  tone: 'prompt',
  helper: 'A source would help.',
  neverGrantsStanding: true,
});

// ─────────────────────────────────────────────────────────────────
// Empty-flags branches: the three lifecycle states.
// ─────────────────────────────────────────────────────────────────

describe('UX-FLAGS-005 PointFeedbackFlagsRow — empty flags + lifecycle', () => {
  it('flags=[], lifecycleState omitted -> renders null (byte-identical to UX-FLAGS-002)', () => {
    expect(render(<PointFeedbackFlagsRow flags={[]} />).toJSON()).toBeNull();
  });

  it('flags=[], lifecycleState="ready" -> renders null', () => {
    expect(
      render(<PointFeedbackFlagsRow flags={[]} lifecycleState="ready" />).toJSON(),
    ).toBeNull();
  });

  it('flags=[], lifecycleState="failed" -> renders null (silent doctrine)', () => {
    expect(
      render(<PointFeedbackFlagsRow flags={[]} lifecycleState="failed" />).toJSON(),
    ).toBeNull();
  });

  it('flags=[], lifecycleState="pending" -> renders one quiet Text with the plain-language copy', () => {
    const { getByTestId, queryByTestId } = render(
      <PointFeedbackFlagsRow flags={[]} lifecycleState="pending" />,
    );
    const pending = getByTestId('point-feedback-flags-pending');
    expect(pending).toBeTruthy();
    expect(pending.props.accessibilityRole).toBe('text');
    // The visible string is exactly the plain-language copy from the source
    // of truth.
    expect(pending.props.children).toBe(POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending);
    // The pending line is NOT a button, NOT a live-region, NOT interactive.
    expect(pending.props.onPress).toBeUndefined();
    expect(pending.props.accessibilityLiveRegion).toBeUndefined();
    // No pill row / helper block / more-count on the pending branch.
    expect(queryByTestId('point-feedback-flag-needs_a_receipt')).toBeNull();
    expect(queryByTestId('point-feedback-flags-helpers')).toBeNull();
    expect(queryByTestId('point-feedback-flags-more')).toBeNull();
    expect(queryByTestId('point-feedback-flags-why-toggle')).toBeNull();
  });

  it('flags=[], lifecycleState="pending" mount tree has NO Pressable (non-interactive)', () => {
    const tree = render(<PointFeedbackFlagsRow flags={[]} lifecycleState="pending" />).toJSON();
    expect(tree).not.toBeNull();
    // The JSON tree must not contain any Pressable / Button node.
    const s = JSON.stringify(tree);
    expect(s.toLowerCase()).not.toContain('pressable');
    expect(s.toLowerCase()).not.toContain('touchableopacity');
  });
});

// ─────────────────────────────────────────────────────────────────
// Content-wins-over-posture: non-empty flags ignore lifecycleState.
// ─────────────────────────────────────────────────────────────────

describe('UX-FLAGS-005 PointFeedbackFlagsRow — content wins over posture', () => {
  it('non-empty flags + lifecycleState="pending" renders the pill row (pending line NOT present)', () => {
    const { getByTestId, queryByTestId } = render(
      <PointFeedbackFlagsRow flags={[SAMPLE_FLAG]} lifecycleState="pending" />,
    );
    expect(getByTestId('point-feedback-flag-needs_a_receipt')).toBeTruthy();
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
  });

  it('non-empty flags + lifecycleState="failed" renders the pill row exactly as today', () => {
    const { getByTestId, queryByTestId } = render(
      <PointFeedbackFlagsRow flags={[SAMPLE_FLAG]} lifecycleState="failed" />,
    );
    expect(getByTestId('point-feedback-flag-needs_a_receipt')).toBeTruthy();
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
  });

  it('non-empty flags + lifecycleState="ready" renders the pill row exactly as today', () => {
    const { getByTestId, queryByTestId } = render(
      <PointFeedbackFlagsRow flags={[SAMPLE_FLAG]} lifecycleState="ready" />,
    );
    expect(getByTestId('point-feedback-flag-needs_a_receipt')).toBeTruthy();
    expect(queryByTestId('point-feedback-flags-pending')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// Firing negative controls: no raw queue enum reaches the DOM.
// ─────────────────────────────────────────────────────────────────

describe('UX-FLAGS-005 PointFeedbackFlagsRow — doctrine ban-list', () => {
  const BANNED_INTERNAL_CODES = [
    'retry_scheduled',
    'dead_letter',
    'failed_terminal',
    'leased',
    'succeeded',
    'provider_server_error',
    'provider_network_error',
    'provider_timeout',
    'failure_reason',
    'failure_sub_reason',
    'dead_letter_reason',
    'sub_reason',
  ];

  function renderedString(el: React.ReactElement): string {
    return JSON.stringify(render(el).toJSON()).toLowerCase();
  }

  it('empty + pending render contains no internal queue / provider code', () => {
    const s = renderedString(<PointFeedbackFlagsRow flags={[]} lifecycleState="pending" />);
    for (const code of BANNED_INTERNAL_CODES) {
      expect(s).not.toContain(code);
    }
  });

  it('empty + failed render is null (contains no string at all)', () => {
    const tree = render(
      <PointFeedbackFlagsRow flags={[]} lifecycleState="failed" />,
    ).toJSON();
    expect(tree).toBeNull();
  });

  it('non-empty flags + every lifecycle input contains no internal code', () => {
    for (const state of ['ready', 'pending', 'failed'] as const) {
      const s = renderedString(<PointFeedbackFlagsRow flags={[SAMPLE_FLAG]} lifecycleState={state} />);
      for (const code of BANNED_INTERNAL_CODES) {
        expect(s).not.toContain(code);
      }
    }
  });

  it('pending copy does not surface a verdict / apology / urgency', () => {
    const s = renderedString(<PointFeedbackFlagsRow flags={[]} lifecycleState="pending" />);
    for (const banned of [
      'winner',
      'loser',
      'true',
      'false',
      'wrong',
      'sorry',
      'error',
      'failed',
      'unable',
      'could not',
      'try again',
      'loading',
      'processing',
      'urgent',
      'now',
    ]) {
      expect(s).not.toContain(banned);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Reduce-motion + a11y posture.
// ─────────────────────────────────────────────────────────────────

describe('UX-FLAGS-005 PointFeedbackFlagsRow — a11y posture', () => {
  it('pending line uses accessibilityRole=text (not button, not header)', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={[]} lifecycleState="pending" />,
    );
    const el = getByTestId('point-feedback-flags-pending');
    expect(el.props.accessibilityRole).toBe('text');
  });

  it('pending line has no accessibilityLiveRegion (silent to screen readers on transition)', () => {
    const { getByTestId } = render(
      <PointFeedbackFlagsRow flags={[]} lifecycleState="pending" />,
    );
    const el = getByTestId('point-feedback-flags-pending');
    expect(el.props.accessibilityLiveRegion).toBeUndefined();
  });
});
