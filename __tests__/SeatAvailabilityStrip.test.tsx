/**
 * ARG-ROOM-005 (#616) — SeatAvailabilityStrip accessibility + rendering.
 *
 * Read-only strip: role + label, >= 44 px band, color is never the only signal
 * (the meaning lives in the words), counts only / no identities, no Pressable.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SeatAvailabilityStrip } from '../src/features/arguments/SeatAvailabilityStrip';
import {
  deriveSeatAvailability,
  buildSeatAvailabilityViewModel,
} from '../src/features/debates/seatClaimModel';
import type { ParticipantSide } from '../src/features/debates/types';

function vmFor(activeCount: number, viewerSide: ParticipantSide | null) {
  const a = deriveSeatAvailability({
    visibility: 'public',
    activeParticipantCount: activeCount,
    knownReservedInviteCount: 0,
    viewerSide,
  });
  return buildSeatAvailabilityViewModel(a, viewerSide);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

describe('SeatAvailabilityStrip — accessibility', () => {
  it('exposes role="summary" and a single-shot accessibilityLabel', () => {
    const vm = vmFor(2, null);
    const { getByTestId } = render(<SeatAvailabilityStrip viewModel={vm} />);
    const root = getByTestId('seat-availability-strip');
    expect(root.props.accessibilityRole).toBe('summary');
    expect(root.props.accessibilityLabel).toBe(vm.accessibilityLabel);
    expect(root.props.accessibilityLabel.length).toBeGreaterThan(0);
  });

  it('renders a comfortable >= 44 px band', () => {
    const { getByTestId } = render(<SeatAvailabilityStrip viewModel={vmFor(2, null)} />);
    const style = flattenStyle(getByTestId('seat-availability-strip').props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('color is never the only signal — the open-slot meaning is carried by the words', () => {
    const open = render(<SeatAvailabilityStrip viewModel={vmFor(2, null)} />);
    const full = render(<SeatAvailabilityStrip viewModel={vmFor(5, null)} />);
    const openLabel = open.getByTestId('seat-availability-open-label').props.children;
    const fullLabel = full.getByTestId('seat-availability-open-label').props.children;
    // The text differs (3 open seats vs No open seats), not just the color.
    expect(openLabel).not.toBe(fullLabel);
    expect(fullLabel).toBe('No open seats');
  });
});

describe('SeatAvailabilityStrip — rendering', () => {
  it('shows the open-slot count + viewer-state line when seats are free', () => {
    const { getByTestId, queryByTestId } = render(
      <SeatAvailabilityStrip viewModel={vmFor(1, null)} />,
    );
    expect(getByTestId('seat-availability-open-label').props.children).toBe('4 open seats');
    expect(getByTestId('seat-availability-viewer-state').props.children).toBe("You're watching.");
    // No full-room nudge when seats are free.
    expect(queryByTestId('seat-availability-full-nudge')).toBeNull();
  });

  it('shows the observe nudge when the room is full and the viewer is not active', () => {
    const { getByTestId } = render(<SeatAvailabilityStrip viewModel={vmFor(5, null)} />);
    expect(getByTestId('seat-availability-full-nudge').props.children).toBe(
      'This argument is full. You can still watch.',
    );
  });

  it('shows "You\'re in this argument." for an active participant', () => {
    const { getByTestId, queryByTestId } = render(
      <SeatAvailabilityStrip viewModel={vmFor(5, 'moderator')} />,
    );
    expect(getByTestId('seat-availability-viewer-state').props.children).toBe(
      "You're in this argument.",
    );
    // A full room with the viewer ACTIVE shows no observe nudge.
    expect(queryByTestId('seat-availability-full-nudge')).toBeNull();
  });
});
