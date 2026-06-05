/**
 * ADMIN-ARGUMENTS-003 — useAdminArgumentsPrefs hook tests.
 *
 * Verifies the AsyncStorage persist + restore loop end-to-end against the
 * official in-memory async-storage mock:
 *  - starts at the defaults, then resolves the (empty) load.
 *  - updatePref applies to state AND writes the blob under the right key.
 *  - a second mount RESTORES the persisted blob (the core "prefs survive a
 *    remount" guarantee).
 *  - a corrupt stored blob falls back to defaults (never throws).
 *  - the persisted JSON is written under the canonical key with no secret.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useAdminArgumentsPrefs } from '../src/features/admin/useAdminArgumentsPrefs';
import { adminArgumentsPrefsKey } from '../src/features/session/sessionKeys';
import {
  DEFAULT_ADMIN_ARGUMENTS_PREFS,
  type AdminArgumentsPrefs,
} from '../src/features/admin/adminArgumentsPrefsModel';

interface Captured {
  prefs: AdminArgumentsPrefs | null;
  loading: boolean | null;
  updatePref: ReturnType<typeof useAdminArgumentsPrefs>['updatePref'] | null;
}

function Probe({ captured }: { captured: Captured }) {
  const r = useAdminArgumentsPrefs();
  captured.prefs = r.prefs;
  captured.loading = r.loading;
  captured.updatePref = r.updatePref;
  return <Text testID="probe">probe</Text>;
}

function freshCaptured(): Captured {
  return { prefs: null, loading: null, updatePref: null };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useAdminArgumentsPrefs — initial load', () => {
  it('starts at the defaults and resolves loading=false', async () => {
    const captured = freshCaptured();
    render(<Probe captured={captured} />);
    expect(captured.prefs).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
    await waitFor(() => expect(captured.loading).toBe(false));
    expect(captured.prefs).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
  });
});

describe('useAdminArgumentsPrefs — persist + restore', () => {
  it('updatePref updates state and persists the blob', async () => {
    const captured = freshCaptured();
    render(<Probe captured={captured} />);
    await waitFor(() => expect(captured.loading).toBe(false));

    await act(async () => {
      captured.updatePref!('runTagFilter', 'xai_adv');
      captured.updatePref!('density', 'compact');
      captured.updatePref!('limit', 200);
    });

    expect(captured.prefs?.runTagFilter).toBe('xai_adv');
    expect(captured.prefs?.density).toBe('compact');
    expect(captured.prefs?.limit).toBe(200);

    const stored = await AsyncStorage.getItem(adminArgumentsPrefsKey('admin'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.runTagFilter).toBe('xai_adv');
    expect(parsed.density).toBe('compact');
    expect(parsed.limit).toBe(200);
  });

  it('a second mount restores the persisted blob (survives a remount)', async () => {
    // First mount: change some prefs.
    const first = freshCaptured();
    const view = render(<Probe captured={first} />);
    await waitFor(() => expect(first.loading).toBe(false));
    await act(async () => {
      first.updatePref!('sortField', 'created_at');
      first.updatePref!('sortDirection', 'asc');
      first.updatePref!('runTagFilter', 'stress');
    });
    view.unmount();

    // Second mount: the blob is restored from storage.
    const second = freshCaptured();
    render(<Probe captured={second} />);
    await waitFor(() => expect(second.loading).toBe(false));
    expect(second.prefs?.sortField).toBe('created_at');
    expect(second.prefs?.sortDirection).toBe('asc');
    expect(second.prefs?.runTagFilter).toBe('stress');
  });
});

describe('useAdminArgumentsPrefs — corrupt storage', () => {
  it('falls back to defaults when the stored blob is garbage', async () => {
    await AsyncStorage.setItem(adminArgumentsPrefsKey('admin'), '{not valid json');
    const captured = freshCaptured();
    render(<Probe captured={captured} />);
    await waitFor(() => expect(captured.loading).toBe(false));
    expect(captured.prefs).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
  });

  it('rebuilds a partial stored blob from defaults', async () => {
    await AsyncStorage.setItem(
      adminArgumentsPrefsKey('admin'),
      JSON.stringify({ density: 'compact' }),
    );
    const captured = freshCaptured();
    render(<Probe captured={captured} />);
    await waitFor(() => expect(captured.loading).toBe(false));
    expect(captured.prefs).toEqual({ ...DEFAULT_ADMIN_ARGUMENTS_PREFS, density: 'compact' });
  });
});

describe('useAdminArgumentsPrefs — storage key', () => {
  it('writes under the canonical admin-arguments-prefs key with no secret', async () => {
    const captured = freshCaptured();
    render(<Probe captured={captured} />);
    await waitFor(() => expect(captured.loading).toBe(false));
    await act(async () => {
      captured.updatePref!('limit', 100);
    });
    const key = adminArgumentsPrefsKey('admin');
    expect(key).toBe('cdiscourse:admin-arguments-prefs:admin');
    const stored = (await AsyncStorage.getItem(key)) ?? '';
    expect(stored.toLowerCase()).not.toContain('token');
    expect(stored.toLowerCase()).not.toContain('secret');
    expect(stored.toLowerCase()).not.toContain('service_role');
  });
});
