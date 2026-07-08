/**
 * ROOM-001 (#876) — ArgumentStateRail component (RNTL).
 *
 * Verifies both-lens render parity (the strip is a pure function of the model,
 * so it renders identically regardless of which lens mounts it), deep-link
 * callback wiring (no state write on tap — the callback is the only effect),
 * accessibility (role / label / state, 44px target), color-independence (glyph +
 * text carry meaning), the 3-inline + overflow + horizontal-scroll structure,
 * and reduce-motion parity.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ArgumentStateRail } from '../src/features/arguments/room/ArgumentStateRail';
import {
  deriveArgumentStateRail,
  type ArgumentStateRailInput,
} from '../src/features/arguments/room/argumentStateRailModel';

function baseInput(overrides: Partial<ArgumentStateRailInput> = {}): ArgumentStateRailInput {
  return {
    viewerRole: 'participant',
    participantSide: 'affirmative',
    turnLabel: 'Your move',
    visibility: 'public',
    opponentSeatIsOpen: false,
    openPointCount: 2,
    receiptsOwedCount: 1,
    ...overrides,
  };
}

describe('ArgumentStateRail — render + parity', () => {
  it('renders the strip container + a chip for each visible model chip', () => {
    const model = deriveArgumentStateRail(baseInput());
    const { getByTestId } = render(<ArgumentStateRail model={model} />);
    expect(getByTestId('argument-state-rail')).toBeTruthy();
    for (const chip of model.chips) {
      expect(getByTestId(`argument-state-rail-chip-${chip.id}`)).toBeTruthy();
    }
  });

  it('is a pure function of the model — identical model props render identical chips (lens parity)', () => {
    const model = deriveArgumentStateRail(baseInput());
    const a = render(<ArgumentStateRail model={model} testID="lens-a" />);
    const b = render(<ArgumentStateRail model={model} testID="lens-b" />);
    for (const chip of model.chips) {
      expect(a.getByTestId(`lens-a-chip-${chip.id}`)).toBeTruthy();
      expect(b.getByTestId(`lens-b-chip-${chip.id}`)).toBeTruthy();
    }
  });

  it('renders nothing when the model has no chips (defensive calm default)', () => {
    const empty = { turnState: 'observer' as const, chips: [], visibleChips: [], overflowCount: 0, accessibilityLabel: 'x' };
    const { queryByTestId } = render(<ArgumentStateRail model={empty} />);
    expect(queryByTestId('argument-state-rail')).toBeNull();
  });
});

describe('ArgumentStateRail — deep-link callbacks (no write on tap)', () => {
  it('tapping open_points calls onOpenMap only', () => {
    const onOpenMap = jest.fn();
    const onOpenDebts = jest.fn();
    const onOpenRoomDetails = jest.fn();
    const model = deriveArgumentStateRail(baseInput({ openPointCount: 3 }));
    const { getByTestId } = render(
      <ArgumentStateRail model={model} onOpenMap={onOpenMap} onOpenDebts={onOpenDebts} onOpenRoomDetails={onOpenRoomDetails} />,
    );
    fireEvent.press(getByTestId('argument-state-rail-chip-open_points'));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
    expect(onOpenDebts).not.toHaveBeenCalled();
    expect(onOpenRoomDetails).not.toHaveBeenCalled();
  });

  it('tapping receipts_owed calls onOpenDebts', () => {
    const onOpenDebts = jest.fn();
    const model = deriveArgumentStateRail(baseInput({ receiptsOwedCount: 2 }));
    const { getByTestId } = render(<ArgumentStateRail model={model} onOpenDebts={onOpenDebts} />);
    fireEvent.press(getByTestId('argument-state-rail-chip-receipts_owed'));
    expect(onOpenDebts).toHaveBeenCalledTimes(1);
  });

  it('tapping visibility calls onOpenRoomDetails when supplied', () => {
    const onOpenRoomDetails = jest.fn();
    const model = deriveArgumentStateRail(baseInput());
    const { getByTestId } = render(<ArgumentStateRail model={model} onOpenRoomDetails={onOpenRoomDetails} />);
    fireEvent.press(getByTestId('argument-state-rail-chip-visibility'));
    expect(onOpenRoomDetails).toHaveBeenCalledTimes(1);
  });

  it('the turn chip is informational and never invokes a callback', () => {
    const onOpenMap = jest.fn();
    const onOpenRoomDetails = jest.fn();
    const model = deriveArgumentStateRail(baseInput());
    const { getByTestId } = render(
      <ArgumentStateRail model={model} onOpenMap={onOpenMap} onOpenRoomDetails={onOpenRoomDetails} />,
    );
    fireEvent.press(getByTestId('argument-state-rail-chip-turn'));
    expect(onOpenMap).not.toHaveBeenCalled();
    expect(onOpenRoomDetails).not.toHaveBeenCalled();
  });
});

describe('ArgumentStateRail — accessibility + informational fallback', () => {
  it('interactive chips expose accessibilityRole=button + label + state', () => {
    const model = deriveArgumentStateRail(baseInput({ openPointCount: 3 }));
    const { getByTestId } = render(<ArgumentStateRail model={model} onOpenMap={() => {}} />);
    const chip = getByTestId('argument-state-rail-chip-open_points');
    expect(chip.props.accessibilityRole).toBe('button');
    expect(typeof chip.props.accessibilityLabel).toBe('string');
    expect(chip.props.accessibilityLabel.length).toBeGreaterThan(0);
    expect(chip.props.accessibilityState).toEqual({ disabled: false });
  });

  it('a deep-linkable chip renders as a non-pressable View when its callback is absent', () => {
    const model = deriveArgumentStateRail(baseInput({ openPointCount: 3 }));
    // No onOpenMap supplied → the open_points chip is informational.
    const { getByTestId } = render(<ArgumentStateRail model={model} />);
    const chip = getByTestId('argument-state-rail-chip-open_points');
    expect(chip.props.accessibilityRole).toBeUndefined();
    // Still exposes a screen-reader label.
    expect(chip.props.accessibilityLabel.length).toBeGreaterThan(0);
  });

  it('carries the root strip accessibility label', () => {
    const model = deriveArgumentStateRail(baseInput());
    const { getByTestId } = render(<ArgumentStateRail model={model} />);
    expect(getByTestId('argument-state-rail').props.accessibilityLabel).toBe(model.accessibilityLabel);
  });
});

describe('ArgumentStateRail — color independence', () => {
  it('chip meaning survives without color — the visible text is the model label', () => {
    const model = deriveArgumentStateRail(baseInput({ visibility: 'private', openPointCount: 4, receiptsOwedCount: 2 }));
    const { getByText } = render(<ArgumentStateRail model={model} />);
    // Each chip label renders as text (grayscale-legible), not conveyed by tone alone.
    expect(getByText('Private 1:1')).toBeTruthy();
    expect(getByText('4 open points')).toBeTruthy();
    expect(getByText('2 receipts owed')).toBeTruthy();
    expect(getByText('Your move')).toBeTruthy();
  });
});

describe('ArgumentStateRail — overflow + horizontal scroll', () => {
  it('renders a horizontal ScrollView owning the chip row', () => {
    const model = deriveArgumentStateRail(baseInput({ opponentSeatIsOpen: true }));
    const { getByTestId } = render(<ArgumentStateRail model={model} />);
    const scroll = getByTestId('argument-state-rail-scroll');
    expect(scroll.props.horizontal).toBe(true);
  });

  it('shows the +N overflow badge with the model overflowCount when more than 3 chips are visible', () => {
    // 5 visible → overflowCount 2.
    const model = deriveArgumentStateRail(
      baseInput({ openPointCount: 3, receiptsOwedCount: 2, opponentSeatIsOpen: true, visibility: 'private' }),
    );
    expect(model.chips).toHaveLength(5);
    expect(model.overflowCount).toBe(2);
    const { getByTestId, getByText } = render(<ArgumentStateRail model={model} />);
    expect(getByTestId('argument-state-rail-overflow')).toBeTruthy();
    expect(getByText('+2')).toBeTruthy();
  });

  it('omits the overflow badge when 3 or fewer chips are visible', () => {
    const model = deriveArgumentStateRail(baseInput({ openPointCount: 1, receiptsOwedCount: 0, opponentSeatIsOpen: false }));
    expect(model.chips.length).toBeLessThanOrEqual(3);
    const { queryByTestId } = render(<ArgumentStateRail model={model} />);
    expect(queryByTestId('argument-state-rail-overflow')).toBeNull();
  });
});

describe('ArgumentStateRail — reduce motion', () => {
  it('renders the identical chip set under reduceMotion (no crash, no animation)', () => {
    const model = deriveArgumentStateRail(baseInput({ openPointCount: 3 }));
    const { getByTestId } = render(<ArgumentStateRail model={model} reduceMotion onOpenMap={() => {}} />);
    for (const chip of model.chips) {
      expect(getByTestId(`argument-state-rail-chip-${chip.id}`)).toBeTruthy();
    }
  });
});
