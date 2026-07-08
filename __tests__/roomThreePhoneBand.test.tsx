/**
 * ROOM-003 (#829) — absorbed #832 (mobile sheet behavior + phone band).
 *
 * The bar is a width-agnostic bottom bar (flex), so it renders across bands;
 * every pressable meets the 44x44 touch target (the reserved voice slot is
 * 56). The More popout inherits the dock breakpoint: sheet below 720, right
 * panel at/above 720, via the shipped resolveDockLayoutVariant.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/edgeFunctions', () => ({
  ...jest.requireActual('../src/lib/edgeFunctions'),
  submitArgumentDraft: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    SUPABASE_CONFIGURED: true,
    supabase: {
      ...actual.supabase,
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
  };
});
jest.mock('../src/features/arguments/useConstitution', () => {
  const c = jest.requireActual('../src/domain/constitution');
  return {
    useConstitution: () => ({
      loading: false,
      error: null,
      source: 'local_fallback',
      activeConstitution: c.constitutionVersion,
      activeRules: c.constitutionRules,
      tagDefinitions: c.tagDefinitions,
      flagDefinitions: c.flagDefinitions,
    }),
  };
});

import { render } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { ArgumentEntryComposer } from '../src/features/arguments/composer/ArgumentEntryComposer';
import { resolveDockLayoutVariant, DOCK_SIDE_BREAKPOINT } from '../src/features/arguments/ArgumentComposerDock';
import { TOUCH_TARGET } from '../src/lib/designTokens';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { Debate } from '../src/features/debates/types';

const DEBATE: Debate = {
  id: 'debate-1',
  createdBy: 'host-1',
  title: 'Bike lanes',
  resolution: 'City streets should add protected bike lanes on arterials.',
  description: 'A debate about street safety.',
  status: 'open',
  constitutionId: 'const-1',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  myParticipantSide: 'affirmative',
  visibility: 'public',
};

const PARENT: ArgumentRow = {
  id: 'arg-parent',
  debateId: DEBATE.id,
  parentId: null,
  authorId: 'other-user',
  argumentType: 'claim',
  side: 'negative',
  body: 'Protected bike lanes make arterial streets safer for everyone.',
  depth: 0,
  status: 'posted',
  targetExcerpt: null,
  disagreementAxis: null,
  railPayload: {},
  clientValidation: {},
  serverValidation: {},
  clientSubmissionId: null,
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
};

function mountBar() {
  return render(
    <AppSessionProvider>
      <ArgumentEntryComposer
        debate={DEBATE}
        selectedParentId={PARENT.id}
        parentArgument={PARENT}
        participantSide="affirmative"
        onOpenMore={jest.fn()}
        onSubmitSuccess={jest.fn()}
        onClearParent={jest.fn()}
      />
    </AppSessionProvider>,
  );
}

function flatStyle(node: { props: { style?: unknown } }): Record<string, unknown> {
  const s = node.props.style;
  const resolved = typeof s === 'function' ? (s as (a: { pressed: boolean }) => unknown)({ pressed: false }) : s;
  return (StyleSheet.flatten(resolved as never) as Record<string, unknown>) ?? {};
}

describe('ROOM-003 #832 — More popout breakpoint (resolveDockLayoutVariant)', () => {
  it('is a bottom sheet below 720 and a right panel at/above 720', () => {
    expect(DOCK_SIDE_BREAKPOINT).toBe(720);
    expect(resolveDockLayoutVariant(390)).toBe('sheet'); // phone
    expect(resolveDockLayoutVariant(719)).toBe('sheet');
    expect(resolveDockLayoutVariant(720)).toBe('side'); // tablet+ panel
    expect(resolveDockLayoutVariant(768)).toBe('side');
    expect(resolveDockLayoutVariant(1440)).toBe('side'); // wide
  });
});

describe('ROOM-003 #832 — the bar renders and meets 44px touch targets', () => {
  it('renders the bar surface (width-agnostic bottom bar)', () => {
    const r = mountBar();
    expect(r.getByTestId('argument-entry-composer')).toBeTruthy();
    expect(r.getByTestId('argument-entry-composer-input')).toBeTruthy();
  });

  it('every bar pressable meets the 44px minimum height (voice slot is 56)', () => {
    const r = mountBar();
    const min = TOUCH_TARGET.minSizePx; // 44
    const heights: Record<string, number> = {
      'argument-entry-composer-proof': min,
      'argument-entry-composer-mic': 56,
      'argument-entry-composer-more': min,
      'argument-entry-composer-send': min,
      'argument-entry-composer-chip-clear': min,
    };
    for (const [testID, expectedMin] of Object.entries(heights)) {
      const style = flatStyle(r.getByTestId(testID));
      expect({ testID, minHeight: style.minHeight }).toEqual({ testID, minHeight: expectedMin });
    }
  });

  it('the tap-width controls meet the 44px minimum width', () => {
    const r = mountBar();
    for (const testID of [
      'argument-entry-composer-proof',
      'argument-entry-composer-more',
      'argument-entry-composer-send',
      'argument-entry-composer-chip-clear',
    ]) {
      const style = flatStyle(r.getByTestId(testID));
      expect({ testID, ok: (style.minWidth as number) >= TOUCH_TARGET.minSizePx }).toEqual({ testID, ok: true });
    }
  });

  it('the compact controls also carry a hitSlop for effective target size', () => {
    const r = mountBar();
    for (const testID of ['argument-entry-composer-proof', 'argument-entry-composer-more', 'argument-entry-composer-chip-clear']) {
      const node = r.getByTestId(testID);
      expect({ testID, hasHitSlop: node.props.hitSlop != null }).toEqual({ testID, hasHitSlop: true });
    }
  });
});
