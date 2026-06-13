/**
 * NAV-START-ARGUMENT-001 Slice A — Start Argument page tests.
 *
 * Render + behavior:
 *   - page renders;
 *   - declaration is required (no create call when empty);
 *   - Timeline / Card surface selector renders;
 *   - taxonomy selectors render;
 *   - submit uses the EXISTING creation path (onCreate is called);
 *   - the selected surface controls the landing route (onCreated carries it);
 *   - NO classifier / AI / MCP invocation in the submit path.
 *
 * Source-scan (separate describe):
 *   - the page does NOT reuse the old New Argument bright-white container /
 *     class names or literal white backdrops;
 *   - the page imports no classifier / semantic-referee / MCP / AI module;
 *   - the gallery now renders StartArgumentPage, not CreateDebateForm.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StartArgumentPage } from '../src/features/arguments/startArgument/StartArgumentPage';
import type { Debate, CreateDebateInput, CreatedRoom } from '../src/features/debates/types';
import type { StartArgumentSurface } from '../src/features/arguments/startArgument/startArgumentTaxonomy';

function fakeDebate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'deb-1',
    createdBy: 'user-1',
    title: 'T',
    resolution: 'R',
    description: '',
    status: 'open',
    constitutionId: 'const-1',
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
    myParticipantSide: 'moderator',
    visibility: 'public',
    ...overrides,
  };
}

/**
 * ARG-ROOM-008 — `onCreate` now resolves to a `CreatedRoom` (debate + the
 * one-time create-time inviteLink). The link is null here; the create-time
 * invite-link box behaviour is exercised in `startArgumentInviteLinkBox.test`.
 */
function fakeCreated(inviteLink: string | null = null): CreatedRoom {
  return { debate: fakeDebate(), inviteLink };
}

describe('StartArgumentPage — render', () => {
  it('renders the page chrome', () => {
    const { getByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(getByTestId('start-argument-page')).toBeTruthy();
    expect(getByTestId('start-argument-declaration')).toBeTruthy();
  });

  it('renders the Timeline / Card surface selector', () => {
    const { getByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(getByTestId('start-argument-surface')).toBeTruthy();
    expect(getByTestId('start-argument-surface-timeline')).toBeTruthy();
    expect(getByTestId('start-argument-surface-card')).toBeTruthy();
  });

  it('renders the three optional taxonomy selectors', () => {
    const { getByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(getByTestId('start-argument-scheme')).toBeTruthy();
    expect(getByTestId('start-argument-strategy')).toBeTruthy();
    expect(getByTestId('start-argument-cause')).toBeTruthy();
    // A verified scheme option + a verified HiTODS strategy + a cause render.
    expect(getByTestId('start-argument-scheme-argument_from_example')).toBeTruthy();
    expect(getByTestId('start-argument-strategy-complex_counter_argument')).toBeTruthy();
    expect(getByTestId('start-argument-cause-informant_related')).toBeTruthy();
  });
});

describe('StartArgumentPage — declaration is required', () => {
  it('does NOT call the creation path when the declaration is empty', async () => {
    const onCreate = jest.fn(async () => fakeCreated());
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCancel={jest.fn()} />,
    );
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('does NOT call the creation path when the declaration is whitespace only', async () => {
    const onCreate = jest.fn(async () => fakeCreated());
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(getByTestId('start-argument-declaration'), '   \n\t ');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe('StartArgumentPage — submit uses the existing creation path', () => {
  it('calls onCreate with the declaration as the resolution', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated());
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCancel={jest.fn()} />,
    );
    // ARG-ROOM-003 — the visibility selector now defaults to Private (submit
    // is disabled until an invite is added). This test only cares about the
    // resolution/title threading, so switch to Public to enable submit.
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(
      getByTestId('start-argument-declaration'),
      'Cars should yield to bikes in protected lanes.',
    );
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const input = onCreate.mock.calls[0][0] as CreateDebateInput;
    expect(input.resolution).toBe('Cars should yield to bikes in protected lanes.');
    // A title is derived from the declaration (no separate title field).
    expect(input.title.length).toBeGreaterThan(0);
    // ARG-ROOM-003 — the form always passes an EXPLICIT visibility, and threads
    // no invite when the field is empty.
    expect(input.visibility).toBe('public');
    expect(input.invite).toBeUndefined();
  });
});

describe('StartArgumentPage — selected surface controls the landing route', () => {
  it('default surface is timeline', async () => {
    const onCreate = jest.fn(async () => fakeCreated());
    const surfaces: StartArgumentSurface[] = [];
    const onCreated = jest.fn((_d: Debate, s: StartArgumentSurface) => {
      surfaces.push(s);
    });
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    // ARG-ROOM-003 — switch to Public so submit is enabled (default is Private,
    // which requires an invite); this test is about the surface hand-off only.
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(surfaces).toEqual(['timeline']);
  });

  it('choosing Card lands the author on the card surface', async () => {
    const onCreate = jest.fn(async () => fakeCreated());
    const onCreated = jest.fn();
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    // ARG-ROOM-003 — switch to Public so submit is enabled (default Private).
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.press(getByTestId('start-argument-surface-card'));
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const surface = onCreated.mock.calls[0][1] as StartArgumentSurface;
    expect(surface).toBe('card');
  });

  it('does NOT hand off the landing route when create returns null', async () => {
    const onCreate = jest.fn(async () => null);
    const onCreated = jest.fn();
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    // ARG-ROOM-003 — switch to Public so submit is enabled (default Private).
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
  });
});

// ── Source-scan: dark styling + no classifier in the submit path ──

const ROOT = path.join(__dirname, '..');
const PAGE_SRC = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'arguments', 'startArgument', 'StartArgumentPage.tsx'),
  'utf8',
);
const GALLERY_SRC = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'debates', 'ConversationGalleryScreen.tsx'),
  'utf8',
);

describe('StartArgumentPage — dark styling, no white-backdrop reuse', () => {
  it('does not reuse the old New Argument bright-white container class names', () => {
    // CreateDebateForm used these style keys; the new page must not.
    for (const oldClass of [
      'visibilityOption',
      'visibilityOptionSelected',
      'visibilityGroup',
      'visibilityHelper',
    ]) {
      expect(PAGE_SRC).not.toContain(oldClass);
    }
  });

  it('does not paint a white / near-white backdrop', () => {
    // No literal white fills (the old form used #fff / #fafafa / #f4f4f4).
    expect(PAGE_SRC).not.toMatch(/backgroundColor:\s*['"]#fff['"]/i);
    expect(PAGE_SRC).not.toMatch(/backgroundColor:\s*['"]#ffffff['"]/i);
    expect(PAGE_SRC).not.toMatch(/#fafafa/i);
    expect(PAGE_SRC).not.toMatch(/#f4f4f4/i);
  });

  it('builds surfaces from the dark SURFACE_TOKENS system', () => {
    expect(PAGE_SRC).toContain('SURFACE_TOKENS');
  });

  it('does not import the old CreateDebateForm / TextInputField white primitives', () => {
    // Scan import lines only — a doc comment may name CreateDebateForm to
    // explain the replacement, but neither white primitive is imported.
    const importLines = PAGE_SRC.split(/\r?\n/).filter((l) => /^\s*import\b/.test(l));
    for (const line of importLines) {
      expect(line).not.toContain('CreateDebateForm');
      expect(line).not.toContain('TextInputField');
    }
  });
});

describe('StartArgumentPage — no classifier / AI / MCP in the page', () => {
  const FORBIDDEN_MODULES = [
    'semanticReferee',
    'classifier',
    'mcp',
    'anthropic',
    'xai',
    '/ai',
    'aiMoveRenderer',
  ];

  it.each(FORBIDDEN_MODULES)('does not import a %s module', (token) => {
    // Scan import lines only (case-insensitive) — no AI/classifier coupling.
    const importLines = PAGE_SRC.split(/\r?\n/).filter((l) => /^\s*import\b/.test(l));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toContain(token.toLowerCase());
    }
  });

  it('does not invoke a classifier / referee / AI call in the submit path', () => {
    expect(PAGE_SRC).not.toMatch(/classify\s*\(/i);
    expect(PAGE_SRC).not.toMatch(/runReferee|invokeReferee|semanticReferee/i);
    expect(PAGE_SRC).not.toMatch(/functions\.invoke/);
  });

  it('the only network-shaped call is the injected onCreate prop (existing path)', () => {
    // The page touches Supabase only through the onCreate prop; it imports
    // no supabase client directly.
    expect(PAGE_SRC).not.toContain("from '../../../lib/supabase'");
    expect(PAGE_SRC).toContain('onCreate(input)');
  });
});

describe('ConversationGalleryScreen — wires StartArgumentPage as the create surface', () => {
  it('renders StartArgumentPage, not the old CreateDebateForm', () => {
    expect(GALLERY_SRC).toContain('StartArgumentPage');
    // The CreateDebateForm component is no longer rendered in the gallery.
    expect(GALLERY_SRC).not.toMatch(/<CreateDebateForm\b/);
  });

  it('passes the existing onCreate path straight into the page', () => {
    expect(GALLERY_SRC).toMatch(/onCreate=\{onCreate\}/);
  });

  it('forwards the chosen surface to the landing-route hand-off', () => {
    expect(GALLERY_SRC).toContain('onCreatedWithSurface');
  });
});
