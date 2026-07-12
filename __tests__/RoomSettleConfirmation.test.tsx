/**
 * SETTLE-001 (#911) — RoomSettleConfirmation render + confirm-gate contract.
 *
 * Renders the right title + bullets per mode, proves no write fires without an
 * explicit confirm (cancel/dismiss never call onConfirm), and pins the a11y +
 * reduce-motion contract via a source scan (mirrors MakePrivateConfirmation).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';
import { RoomSettleConfirmation } from '../src/features/debates/RoomSettleConfirmation';
import { buildSettleConsequences, ROOM_SETTLE_COPY } from '../src/features/debates/settleRoomModel';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/debates/RoomSettleConfirmation.tsx'),
  'utf8',
);

describe('RoomSettleConfirmation — settle mode', () => {
  it('renders the settle title, intro, and every settle bullet', () => {
    const { getByText } = render(
      <RoomSettleConfirmation
        visible
        mode="settle"
        consequences={buildSettleConsequences('settle')}
        submitting={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText(ROOM_SETTLE_COPY.confirm_settle_title)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.confirm_intro)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.effect_no_new_moves)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.effect_no_new_joiners)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.effect_stays_readable)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.effect_becomes_linkable)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.effect_reversible)).toBeTruthy();
  });

  it('the primary button carries the settle label', () => {
    const { getByTestId, getByText } = render(
      <RoomSettleConfirmation
        visible
        mode="settle"
        consequences={buildSettleConsequences('settle')}
        submitting={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByTestId('room-settle-confirm')).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.confirm_settle_primary)).toBeTruthy();
  });
});

describe('RoomSettleConfirmation — reopen mode', () => {
  it('renders the reopen title + reopen bullets, and NOT the settle-only bullet', () => {
    const { getByText, queryByText } = render(
      <RoomSettleConfirmation
        visible
        mode="reopen"
        consequences={buildSettleConsequences('reopen')}
        submitting={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText(ROOM_SETTLE_COPY.confirm_reopen_title)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.effect_new_moves_allowed)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.effect_content_unchanged)).toBeTruthy();
    // R2 — the reopen sheet is honest that inbound weave links persist.
    expect(getByText(ROOM_SETTLE_COPY.effect_existing_links_kept)).toBeTruthy();
    expect(queryByText(ROOM_SETTLE_COPY.effect_no_new_joiners)).toBeNull();
  });
});

describe('RoomSettleConfirmation — no write without confirm', () => {
  it('pressing the primary fires onConfirm and NOT onCancel', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <RoomSettleConfirmation
        visible
        mode="settle"
        consequences={buildSettleConsequences('settle')}
        submitting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId('room-settle-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('pressing cancel fires onCancel and NEVER onConfirm (no write on dismiss)', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <RoomSettleConfirmation
        visible
        mode="settle"
        consequences={buildSettleConsequences('settle')}
        submitting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId('room-settle-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('RoomSettleConfirmation — accessibility + reduce-motion (source contract)', () => {
  it('both buttons meet the 44px tap target (actionButton minHeight 44)', () => {
    expect(SRC).toMatch(/minHeight:\s*44/);
  });

  it('the primary button exposes busy via accessibilityState', () => {
    expect(SRC).toMatch(/accessibilityState=\{\{ busy: submitting \}\}/);
  });

  it('both buttons carry accessibilityRole button', () => {
    expect(SRC).toContain('accessibilityRole="button"');
  });

  it('the sheet is an alert-role region', () => {
    expect(SRC).toContain('accessibilityRole="alert"');
  });

  it('respects reduce-motion (animationType none when reduceMotion is set)', () => {
    expect(SRC).toMatch(/animationType=\{reduceMotion \? 'none' : 'fade'\}/);
  });

  it('disables both buttons while submitting', () => {
    expect(SRC).toMatch(/disabled=\{submitting\}/);
  });
});
