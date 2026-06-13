/**
 * ARG-ROOM-008 — re-surface the create-time invite copy-link.
 *
 * Closes the ARG-ROOM-003 user-exposure gate: a private room (003's default)
 * created with invite email OFF (the QOL-040 default) has an UNREACHABLE
 * invitee because the one-time raw `inviteLink` returned by the
 * `create-argument-room` Edge was discarded by `createDebate`. This card stops
 * discarding it (the `CreatedRoom` result-shape) and renders it once on the
 * StartArgumentPage post-create success state, REUSING the shipped
 * `INVITE_PANEL_COPY` copy-link affordance.
 *
 * This suite asserts the create-surface behaviour:
 *   - create with an invite (link returned) → the one-time copy-link box shows
 *     the RAW link, and the landing hand-off is DEFERRED until "Continue";
 *   - public-no-invite (no link) → no box, navigate immediately (no regression);
 *   - "Continue" hands off once and the link is NOT re-exposed (one-time);
 *   - the copy control toggles to the "Copied" feedback;
 *   - inviter-only by construction (no box on initial render);
 *   - a11y on the copy + continue controls (role / label / >= 44px);
 *   - the raw token is NEVER logged (behavioural console spy) and the page
 *     imports no storage API (static scan) — it is never persisted;
 *   - ban-list over the new copy strings.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StartArgumentPage } from '../src/features/arguments/startArgument/StartArgumentPage';
import type { Debate, CreateDebateInput, CreatedRoom } from '../src/features/debates/types';
import type { StartArgumentSurface } from '../src/features/arguments/startArgument/startArgumentTaxonomy';
import { ARGUMENT_ROOM_CREATE_COPY } from '../src/features/arguments/gameCopy';
import { INVITE_PANEL_COPY } from '../src/features/invites/inviteCopy';

const RAW_LINK = 'https://cdiscourse.app/invite/redeem?token=tok_secret_ABC123xyz';

function fakeDebate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'deb-1',
    createdBy: 'user-1',
    title: 'T',
    resolution: 'R',
    description: '',
    status: 'open',
    constitutionId: 'const-1',
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z',
    myParticipantSide: 'moderator',
    visibility: 'private',
    ...overrides,
  };
}

function fakeCreated(inviteLink: string | null): CreatedRoom {
  return { debate: fakeDebate(), inviteLink };
}

type GetByTestId = ReturnType<typeof render>['getByTestId'];
type TestNode = ReturnType<GetByTestId>;

/** Fill the declaration + a valid invite email so a Private create submits. */
function fillPrivateWithInvite(getByTestId: GetByTestId) {
  fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
  fireEvent.changeText(getByTestId('start-argument-invite-email'), 'guest@example.com');
}

/** Resolve a Pressable's style whether it is an array or a `({pressed})` fn. */
function flattenPressableStyle(node: TestNode) {
  const styleProp = node.props.style;
  const resolved = typeof styleProp === 'function' ? styleProp({ pressed: false }) : styleProp;
  return StyleSheet.flatten(resolved);
}

// ── Surfacing the box ─────────────────────────────────────────────

describe('StartArgumentPage create-time invite link — surfaces the box', () => {
  it('shows the one-time copy-link box with the RAW link after a private create', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(RAW_LINK));
    const onCreated = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    // Inviter-only by construction: no box before the creator submits.
    expect(queryByTestId('start-argument-invite-link-box')).toBeNull();

    fillPrivateWithInvite(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });

    await waitFor(() => expect(getByTestId('start-argument-invite-link-box')).toBeTruthy());
    // The raw token is surfaced verbatim so the inviter can copy it.
    expect(getByTestId('start-argument-invite-link-text').props.children).toBe(RAW_LINK);
    // The landing hand-off is DEFERRED — navigation must not happen until the
    // inviter has had the chance to copy the link.
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('threads no invite + no link on public-no-invite → no box, navigate immediately', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(null));
    const onCreated = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    // No link → no copy-link box; the page handed off straight to the room.
    expect(queryByTestId('start-argument-invite-link-box')).toBeNull();
  });

  it('uses the chosen surface on the deferred hand-off (Card)', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(RAW_LINK));
    const onCreated = jest.fn();
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    fireEvent.press(getByTestId('start-argument-surface-card'));
    fillPrivateWithInvite(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(getByTestId('start-argument-invite-link-continue')).toBeTruthy());
    fireEvent.press(getByTestId('start-argument-invite-link-continue'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: 'deb-1' });
    expect(onCreated.mock.calls[0][1] as StartArgumentSurface).toBe('card');
  });
});

// ── One-time: Continue does not re-expose ─────────────────────────

describe('StartArgumentPage create-time invite link — one-time', () => {
  it('Continue hands off once and the link is NOT re-exposed', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(RAW_LINK));
    const onCreated = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    fillPrivateWithInvite(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(getByTestId('start-argument-invite-link-box')).toBeTruthy());

    fireEvent.press(getByTestId('start-argument-invite-link-continue'));

    // The box is gone (link cleared from state) and stays gone — there is no
    // affordance that brings the one-time link back.
    await waitFor(() => expect(queryByTestId('start-argument-invite-link-box')).toBeNull());
    expect(queryByTestId('start-argument-invite-link-text')).toBeNull();
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: 'deb-1' });
  });

  it('the copy control toggles to the "Copied" feedback and does not navigate', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(RAW_LINK));
    const onCreated = jest.fn();
    const { getByTestId, queryByText } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    fillPrivateWithInvite(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(getByTestId('start-argument-invite-link-copy')).toBeTruthy());
    // Before copy → the action label.
    expect(queryByText(INVITE_PANEL_COPY.copyLinkButton)).toBeTruthy();
    fireEvent.press(getByTestId('start-argument-invite-link-copy'));
    // After copy → the success feedback; copying never navigates.
    await waitFor(() => expect(queryByText(INVITE_PANEL_COPY.copyLinkSuccess)).toBeTruthy());
    expect(onCreated).not.toHaveBeenCalled();
  });
});

// ── Accessibility ─────────────────────────────────────────────────

describe('StartArgumentPage create-time invite link — accessibility', () => {
  it('the copy + continue controls expose button role + label and meet 44px', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(RAW_LINK));
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={jest.fn()} onCancel={jest.fn()} />,
    );
    fillPrivateWithInvite(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(getByTestId('start-argument-invite-link-copy')).toBeTruthy());

    const copy = getByTestId('start-argument-invite-link-copy');
    expect(copy.props.accessibilityRole).toBe('button');
    expect(copy.props.accessibilityLabel).toBe(INVITE_PANEL_COPY.copyLinkButton);
    expect(flattenPressableStyle(copy).minHeight).toBeGreaterThanOrEqual(44);

    const cont = getByTestId('start-argument-invite-link-continue');
    expect(cont.props.accessibilityRole).toBe('button');
    expect(cont.props.accessibilityLabel).toBe(
      ARGUMENT_ROOM_CREATE_COPY.invite_link_continue_label,
    );
    expect(flattenPressableStyle(cont).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('renders the raw link as selectable text so it can be copied', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(RAW_LINK));
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={jest.fn()} onCancel={jest.fn()} />,
    );
    fillPrivateWithInvite(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(getByTestId('start-argument-invite-link-text')).toBeTruthy());
    expect(getByTestId('start-argument-invite-link-text').props.selectable).toBe(true);
  });
});

// ── Token safety: never logged, never persisted ───────────────────

describe('StartArgumentPage create-time invite link — token never logged', () => {
  it('never passes the raw token to console during the whole flow', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
    ];
    try {
      const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated(RAW_LINK));
      const { getByTestId } = render(
        <StartArgumentPage onCreate={onCreate} onCreated={jest.fn()} onCancel={jest.fn()} />,
      );
      fillPrivateWithInvite(getByTestId);
      await act(async () => {
        fireEvent.press(getByTestId('start-argument-submit'));
      });
      await waitFor(() => expect(getByTestId('start-argument-invite-link-copy')).toBeTruthy());
      fireEvent.press(getByTestId('start-argument-invite-link-copy'));
      fireEvent.press(getByTestId('start-argument-invite-link-continue'));

      for (const spy of spies) {
        for (const call of spy.mock.calls) {
          const serialised = call.map((a) => String(a)).join(' ');
          expect(serialised).not.toContain(RAW_LINK);
          expect(serialised).not.toContain('tok_secret_ABC123xyz');
        }
      }
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

// ── Static source scan: no console, no storage (never persisted) ──

const ROOT = path.join(__dirname, '..');
const PAGE_SRC = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'arguments', 'startArgument', 'StartArgumentPage.tsx'),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
const PAGE_CODE = stripComments(PAGE_SRC);

describe('StartArgumentPage — token handling source guards', () => {
  it('contains no console.* (the page handles a raw invite token)', () => {
    expect(PAGE_CODE).not.toMatch(/console\./);
  });

  it('imports no persistence API (the raw link is never written to storage)', () => {
    for (const api of [
      'AsyncStorage',
      'SecureStore',
      'expo-secure-store',
      'async-storage',
      'localStorage',
      'sessionStorage',
      'MMKV',
    ]) {
      expect(PAGE_CODE).not.toContain(api);
    }
  });

  it('reuses the shipped INVITE_PANEL_COPY copy-link affordance', () => {
    expect(PAGE_CODE).toContain('INVITE_PANEL_COPY.copyLinkButton');
    expect(PAGE_CODE).toContain('INVITE_PANEL_COPY.copyLinkSuccess');
  });
});

// ── Ban-list over the new copy ────────────────────────────────────

describe('StartArgumentPage create-time invite link — copy doctrine', () => {
  const NEW_COPY = [
    ARGUMENT_ROOM_CREATE_COPY.invite_link_box_title,
    ARGUMENT_ROOM_CREATE_COPY.invite_link_box_helper,
    ARGUMENT_ROOM_CREATE_COPY.invite_link_continue_label,
  ];

  // Verdict / amplification / person-attribution + account-enumeration tokens.
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'truth',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    'popular',
    'trending',
    'viral',
    'troll',
    'challenger',
    'opponent',
    // No account enumeration on the create surface.
    'account',
    'existing user',
    'new user',
    'sign up',
    'registered',
  ];

  it('every new copy string is non-empty and free of banned framing', () => {
    for (const value of NEW_COPY) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      const lower = value.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no new copy string leaks a snake_case internal code', () => {
    for (const value of NEW_COPY) {
      expect(value).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
