/**
 * START-001 (#827) — PersonArgumentPicker RNTL suite.
 *
 * Covers the rendered picker: fixed source order (recents -> e-mail ->
 * open-floor-LAST), the actionable empty-recents state, the inline invalid
 * e-mail reason, row height / hit-target a11y floors, and role/state/label on
 * every pressable row. Also a source-scan proving no profiles enumeration and
 * no feature-flag import in any new picker file.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { PersonArgumentPicker } from '../src/features/arguments/startArgument/PersonArgumentPicker';
import type {
  PersonTarget,
  RecentOpponent,
} from '../src/features/arguments/startArgument/personArgumentPickerModel';
import { START_SHEET_COPY } from '../src/features/arguments/gameCopy';

function recent(email: string, ms: number): RecentOpponent {
  return { email, maskedEmail: `${email.charAt(0)}•••@${email.split('@')[1]}`, lastInvitedAtMs: ms };
}

const RECENTS: RecentOpponent[] = [recent('dana@example.com', 2), recent('sam@example.com', 1)];

describe('PersonArgumentPicker — source order', () => {
  it('renders recents first and the open-floor row LAST', () => {
    const { getByTestId, getAllByRole } = render(
      <PersonArgumentPicker value={null} onChange={jest.fn()} recents={RECENTS} />,
    );
    // Recents + open-floor are radios; the e-mail entry is a labelled field.
    const radios = getAllByRole('radio');
    // Last radio is the open-floor row.
    const last = radios[radios.length - 1];
    expect(last.props.accessibilityLabel).toBe(START_SHEET_COPY.openFloorLabel);
    expect(getByTestId('person-picker-open-floor')).toBeTruthy();
    expect(getByTestId('person-picker-recent-dana@example.com')).toBeTruthy();
    expect(getByTestId('person-picker-email')).toBeTruthy();
  });
});

describe('PersonArgumentPicker — selection + emit', () => {
  it('emits a profile target when a recent is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PersonArgumentPicker value={null} onChange={onChange} recents={RECENTS} />,
    );
    fireEvent.press(getByTestId('person-picker-recent-dana@example.com'));
    expect(onChange).toHaveBeenCalledWith({ kind: 'profile', email: 'dana@example.com' });
  });

  it('emits an email target as the field is typed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PersonArgumentPicker value={null} onChange={onChange} recents={RECENTS} />,
    );
    fireEvent.changeText(getByTestId('person-picker-email-input'), 'new@example.com');
    expect(onChange).toHaveBeenCalledWith({ kind: 'email', email: 'new@example.com' });
  });

  it('emits open_floor when the open-floor row is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PersonArgumentPicker value={null} onChange={onChange} recents={RECENTS} />,
    );
    fireEvent.press(getByTestId('person-picker-open-floor'));
    expect(onChange).toHaveBeenCalledWith({ kind: 'open_floor' });
  });

  it('marks the selected recent (color-independent: accessibilityState.selected + glyph)', () => {
    const value: PersonTarget = { kind: 'profile', email: 'dana@example.com' };
    const { getByTestId } = render(
      <PersonArgumentPicker value={value} onChange={jest.fn()} recents={RECENTS} />,
    );
    const row = getByTestId('person-picker-recent-dana@example.com');
    expect(row.props.accessibilityState.selected).toBe(true);
    // The unselected sibling is NOT selected.
    expect(getByTestId('person-picker-recent-sam@example.com').props.accessibilityState.selected).toBe(false);
  });
});

describe('PersonArgumentPicker — empty recents (actionable)', () => {
  it('shows the actionable empty note and still renders the e-mail field + open floor', () => {
    const { getByTestId, queryByTestId } = render(
      <PersonArgumentPicker value={null} onChange={jest.fn()} recents={[]} />,
    );
    expect(getByTestId('person-picker-recents-empty')).toBeTruthy();
    expect(getByTestId('person-picker-email')).toBeTruthy();
    expect(getByTestId('person-picker-open-floor')).toBeTruthy();
    // No recent rows.
    expect(queryByTestId('person-picker-recent-dana@example.com')).toBeNull();
  });
});

describe('PersonArgumentPicker — inline e-mail reason', () => {
  it('renders the matrix plain-language reason when passed', () => {
    const reason = 'Add just one email — you can invite one person as you start.';
    const { getByTestId } = render(
      <PersonArgumentPicker
        value={{ kind: 'email', email: 'a@b.com, c@d.com' }}
        onChange={jest.fn()}
        recents={RECENTS}
        emailReason={reason}
      />,
    );
    expect(getByTestId('person-picker-email-reason').props.children).toBe(reason);
  });

  it('omits the reason element when none is passed', () => {
    const { queryByTestId } = render(
      <PersonArgumentPicker value={null} onChange={jest.fn()} recents={RECENTS} />,
    );
    expect(queryByTestId('person-picker-email-reason')).toBeNull();
  });
});

describe('PersonArgumentPicker — a11y floors', () => {
  it('recent + open-floor rows are >= 52px tall', () => {
    const { getByTestId } = render(
      <PersonArgumentPicker value={null} onChange={jest.fn()} recents={RECENTS} />,
    );
    for (const id of ['person-picker-recent-dana@example.com', 'person-picker-open-floor']) {
      const flat = StyleSheet.flatten(getByTestId(id).props.style);
      expect(flat.minHeight).toBeGreaterThanOrEqual(52);
    }
  });

  it('every pressable row has role radio + accessibilityState + a label', () => {
    const { getAllByRole } = render(
      <PersonArgumentPicker value={null} onChange={jest.fn()} recents={RECENTS} />,
    );
    const radios = getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(3); // 2 recents + open floor
    for (const r of radios) {
      expect(r.props.accessibilityState).toBeDefined();
      expect(typeof r.props.accessibilityLabel).toBe('string');
      expect(r.props.accessibilityLabel.length).toBeGreaterThan(0);
    }
  });
});

describe('new picker files — no profiles enumeration / no flag import', () => {
  const FILES = [
    'src/features/arguments/startArgument/personArgumentPickerModel.ts',
    'src/features/arguments/startArgument/recentOpponentsApi.ts',
    'src/features/arguments/startArgument/useRecentOpponents.ts',
    'src/features/arguments/startArgument/PersonArgumentPicker.tsx',
    'src/features/arguments/startArgument/StartArgumentSheet.tsx',
  ];

  it('no new picker file performs a profiles search / ilike', () => {
    for (const rel of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src).not.toMatch(/from\(\s*['"]profiles['"]\s*\)/);
      expect(src).not.toMatch(/\.ilike\(/);
    }
  });

  it('no new picker file imports the feature-flag registry (App.tsx is sole consumer)', () => {
    for (const rel of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src).not.toMatch(/from\s+['"][^'"]*featureFlags['"]/);
    }
  });

  it('no new picker file references a service-role literal', () => {
    for (const rel of FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src).not.toMatch(/SERVICE_ROLE/);
    }
  });
});
