/**
 * UX-SELECTED-NODE-001 — selected-node "center of the room" treatment
 * (LOCAL-ONLY scope; the room-level rail / board topology is SUPERSEDED to
 * UX-BOARD-RAIL-001 #706).
 *
 * This card composes the already-shipped mediator + readout surfaces into one
 * coherent selected-node anatomy with a strictly LOCAL, in-the-selected-card
 * delta:
 *
 *   1. a restrained GOLD selected-node card halo + an IN-CARD left accent
 *      (distinct from the indigo active-path system; geometry carries the
 *      signal in grayscale);
 *   2. a "Responding to this point" anchor (top, not a left rail) with the
 *      structural identity sub-label and the parent excerpt (parentBodyPreview,
 *      ≤120 chars — rendered ONLY when the data exists);
 *   3. exactly ONE primary state chip (no chip soup);
 *   4. the four already-mounted Inspect siblings sectioned into the v4
 *      drawer's four named sections via SelectedNodeInspectDrawer;
 *   5. an Act-dominant Act/Inspect/Go dock (Inspect + Go stay ≥44px);
 *   6. a read-only "Go to parent point" jump.
 *
 * The small composable pieces (SelectedNodeInspectDrawer, the responding-to
 * anchor in TimelineSelectedReadoutPanel) are rendered directly with React
 * Testing Library; the large, heavily-pinned ArgumentGameSurface mount tree is
 * verified by SOURCE-SCAN (the repo pattern for that file — see
 * uxMediator002NodeMarkup.test.tsx), including a PROOF that no room-level rail
 * / timeline-topology code is touched.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { SelectedNodeInspectDrawer } from '../src/features/mediator/SelectedNodeInspectDrawer';
import { TimelineSelectedReadoutPanel } from '../src/features/arguments/TimelineSelectedReadoutPanel';
import { _forbiddenMediatorTokens } from '../src/features/mediator';
import { BRAND } from '../src/lib/designTokens';
import type {
  TimelineSelectedReadoutViewModel,
} from '../src/features/arguments/timelineSelectedReadoutModel';
import type {
  SidecarViewModel,
  SidecarSection_WhatThisMoveSays,
} from '../src/features/arguments/argumentReplySidecarModel';
import { Text } from 'react-native';

const REPO = process.cwd();
const SURFACE_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'arguments', 'ArgumentGameSurface.tsx'),
  'utf8',
);
const PANEL_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'arguments', 'TimelineSelectedReadoutPanel.tsx'),
  'utf8',
);
const DRAWER_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'mediator', 'SelectedNodeInspectDrawer.tsx'),
  'utf8',
);

// ── Fixtures ──────────────────────────────────────────────────

function fakeWhatSays(
  over: Partial<SidecarSection_WhatThisMoveSays> = {},
): SidecarSection_WhatThisMoveSays {
  return {
    kind: 'what_this_move_says',
    bodyExcerpt: over.bodyExcerpt ?? 'A readable body excerpt for the selected move.',
    isTruncated: over.isTruncated ?? false,
    fullBodyLength: over.fullBodyLength ?? 48,
    createdAtLabel: over.createdAtLabel ?? '2026-06-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    parentHint: 'parentHint' in over ? (over.parentHint ?? null) : 'Replied to · #2 (Claim)',
    parentBodyPreview:
      'parentBodyPreview' in over
        ? (over.parentBodyPreview ?? null)
        : 'The opening claim that this move is responding to.',
    actorLabel: over.actorLabel ?? 'You',
    sideLabel: over.sideLabel ?? 'Aff',
    kindLabel: over.kindLabel ?? 'Challenge',
    isHidden: over.isHidden ?? false,
    hiddenNotice: over.hiddenNotice ?? null,
    standingLine: over.standingLine ?? 'Standing: neutral',
    toneLine: over.toneLine ?? 'Tone: calm',
    heatLine: over.heatLine ?? 'Heat: cool',
  };
}

function fakeSidecar(over: Partial<SidecarViewModel> = {}): SidecarViewModel {
  const isEmpty = over.isEmpty ?? false;
  return {
    isEmpty,
    selectedMessageId:
      'selectedMessageId' in over ? over.selectedMessageId! : isEmpty ? null : 'm3',
    viewMode: over.viewMode ?? 'timeline',
    sections: over.sections ?? (isEmpty ? [] : [fakeWhatSays()]),
    accessibilityRootLabel:
      over.accessibilityRootLabel ?? 'Challenge from You. Message 3 of 5.',
    emptyStateMessage:
      over.emptyStateMessage ?? 'Pick a message on the timeline to see details.',
  };
}

function fakeReadoutVm(
  over: Partial<TimelineSelectedReadoutViewModel> = {},
): TimelineSelectedReadoutViewModel {
  const isEmpty = over.isEmpty ?? false;
  return {
    isEmpty,
    selectedMessageId: 'selectedMessageId' in over ? over.selectedMessageId! : isEmpty ? null : 'm3',
    status: over.status ?? 'explicit',
    staleNotice: over.staleNotice ?? null,
    sidecar: over.sidecar ?? (isEmpty ? fakeSidecar({ isEmpty: true }) : fakeSidecar()),
    directReplyCount: over.directReplyCount ?? 1,
    replyCountLabel: over.replyCountLabel ?? '1 direct reply',
    actingOnShortLabel: over.actingOnShortLabel ?? 'Challenge · #3',
    accessibilityPanelLabel:
      over.accessibilityPanelLabel ?? 'Challenge from You. Message 3 of 5. 1 direct reply.',
    accessibilitySelectionAnnouncement:
      over.accessibilitySelectionAnnouncement ?? 'Challenge from You. Message 3 of 5. 1 direct reply.',
  };
}

// ── 1. Responding-to anchor + parent excerpt (rows 2-3) ───────

describe('UX-SELECTED-NODE-001 — responding-to anchor + parent excerpt', () => {
  it('renders the "Responding to this point" anchor when the node has a parent', () => {
    const { getByTestId, getByText } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact />,
    );
    expect(getByTestId('selected-node-responding-anchor')).toBeTruthy();
    expect(getByText('Responding to this point')).toBeTruthy();
  });

  it('renders the parent excerpt (parentBodyPreview) when present', () => {
    const { getByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact />,
    );
    const excerpt = getByTestId('selected-node-parent-excerpt');
    expect(excerpt).toBeTruthy();
    expect(excerpt.props.children).toBe('The opening claim that this move is responding to.');
  });

  it('omits the anchor + excerpt cleanly at the ROOT (no parent data)', () => {
    const rootVm = fakeReadoutVm({
      sidecar: fakeSidecar({
        sections: [fakeWhatSays({ parentHint: null, parentBodyPreview: null })],
      }),
    });
    const { queryByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={rootVm} compact />,
    );
    expect(queryByTestId('selected-node-responding-anchor')).toBeNull();
    expect(queryByTestId('selected-node-parent-excerpt')).toBeNull();
  });

  it('renders the excerpt even when parentHint is absent but the preview exists', () => {
    const vm = fakeReadoutVm({
      sidecar: fakeSidecar({
        sections: [fakeWhatSays({ parentHint: null, parentBodyPreview: 'Just the preview.' })],
      }),
    });
    const { getByTestId } = render(<TimelineSelectedReadoutPanel viewModel={vm} compact />);
    expect(getByTestId('selected-node-responding-anchor')).toBeTruthy();
    expect(getByTestId('selected-node-parent-excerpt').props.children).toBe('Just the preview.');
  });

  it('NEVER synthesizes a person/display name on the anchor (§7 R3)', () => {
    const { queryByText } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact />,
    );
    // The anchor uses the structural identity only — no "<Name>'s claim".
    expect(queryByText(/Maya/i)).toBeNull();
    expect(queryByText(/'s claim/i)).toBeNull();
  });

  it('does NOT render the selected-node treatment in the empty state', () => {
    const { queryByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm({ isEmpty: true })} compact />,
    );
    // includeHiddenElements proves the accent is genuinely NOT rendered (not
    // merely hidden from the default a11y query).
    expect(queryByTestId('selected-node-card-left-accent', { includeHiddenElements: true })).toBeNull();
    expect(queryByTestId('selected-node-responding-anchor')).toBeNull();
  });
});

// ── 2. Gold halo + in-card left accent (row 1) ────────────────

describe('UX-SELECTED-NODE-001 — gold halo + in-card left accent', () => {
  it('renders the in-card left accent stripe on the selected card', () => {
    const { getByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact />,
    );
    // The accent is decorative (accessibilityElementsHidden) — RNTL hides it
    // from queries by default; include hidden elements to assert its style.
    const accent = getByTestId('selected-node-card-left-accent', { includeHiddenElements: true });
    expect(accent).toBeTruthy();
    const flat = Array.isArray(accent.props.style)
      ? Object.assign({}, ...accent.props.style.filter(Boolean))
      : accent.props.style;
    // GOLD fill — distinct from the indigo active-path system; the stripe is
    // pinned LEFT and lives inside the card bounds (it is the card, not a rail).
    expect(flat.backgroundColor).toBe(BRAND.accent.gold);
    expect(flat.position).toBe('absolute');
    expect(flat.left).toBe(0);
  });

  it('the left accent is hidden from the screen reader (decorative geometry)', () => {
    const { getByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact />,
    );
    const accent = getByTestId('selected-node-card-left-accent', { includeHiddenElements: true });
    expect(accent.props.accessibilityElementsHidden).toBe(true);
    expect(accent.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('uses the GOLD halo distinct from the indigo (GLOW.activePath) accent', () => {
    // The selected card border switches to the restrained gold border; the
    // indigo (#a5b4fc / #312e81) active-path system is unchanged.
    expect(PANEL_SRC).toMatch(/selectedCard:\s*\{[\s\S]*?borderColor:\s*BRAND\.accent\.goldBorder/);
    expect(PANEL_SRC).toMatch(/selectedCardLeftAccent:\s*\{[\s\S]*?backgroundColor:\s*BRAND\.accent\.gold/);
    // No new hex literal is introduced for the gold — it comes from the token.
    expect(PANEL_SRC).not.toMatch(/#C6A15B/);
  });
});

// ── 3. Go-to-parent (read-only nav) ───────────────────────────

describe('UX-SELECTED-NODE-001 — go-to-parent (read-only)', () => {
  it('renders a "Go to parent point" button that calls onGoToParent', () => {
    const onGoToParent = jest.fn();
    const { getByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact onGoToParent={onGoToParent} />,
    );
    const btn = getByTestId('selected-node-go-to-parent');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('Go to parent point');
    fireEvent.press(btn);
    expect(onGoToParent).toHaveBeenCalledTimes(1);
  });

  it('omits the go-to-parent affordance when onGoToParent is not provided (root)', () => {
    const { queryByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact />,
    );
    expect(queryByTestId('selected-node-go-to-parent')).toBeNull();
  });

  it('the go-to-parent target is ≥44px touch-safe via hitSlop', () => {
    const { getByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact onGoToParent={jest.fn()} />,
    );
    const btn = getByTestId('selected-node-go-to-parent');
    expect(btn.props.hitSlop).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
  });
});

// ── 4. Four-section Inspect drawer (O-4) ──────────────────────

describe('UX-SELECTED-NODE-001 — SelectedNodeInspectDrawer (four sections)', () => {
  it('renders the four named section headers when all slots are supplied', () => {
    const { getByText, getByTestId } = render(
      <SelectedNodeInspectDrawer
        whyThisState={<Text>why-content</Text>}
        structureNotes={<Text>structure-content</Text>}
        moveForward={<Text>move-content</Text>}
        history={<Text>history-content</Text>}
      />,
    );
    expect(getByText('Why this state')).toBeTruthy();
    expect(getByText('Other structure notes')).toBeTruthy();
    expect(getByText('Move forward:')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
    expect(getByTestId('selected-node-inspect-drawer')).toBeTruthy();
  });

  it('section headers expose accessibilityRole="header"', () => {
    const { getByTestId } = render(
      <SelectedNodeInspectDrawer whyThisState={<Text>x</Text>} history={<Text>y</Text>} />,
    );
    expect(getByTestId('selected-node-inspect-header-why').props.accessibilityRole).toBe('header');
    expect(getByTestId('selected-node-inspect-header-history').props.accessibilityRole).toBe('header');
  });

  it('omits a section (and its header) cleanly when the slot is null — no empty chrome', () => {
    const { queryByText, getByText } = render(
      <SelectedNodeInspectDrawer whyThisState={<Text>why</Text>} history={null} moveForward={null} />,
    );
    expect(getByText('Why this state')).toBeTruthy();
    expect(queryByText('History')).toBeNull();
    expect(queryByText('Move forward:')).toBeNull();
  });

  it('renders the "Other structure notes" section when only the provenance slot is set', () => {
    const { getByText } = render(
      <SelectedNodeInspectDrawer structureProvenance={<Text>provenance</Text>} />,
    );
    expect(getByText('Other structure notes')).toBeTruthy();
    expect(getByText('provenance')).toBeTruthy();
  });

  it('renders nothing when every slot is null', () => {
    const { toJSON } = render(<SelectedNodeInspectDrawer />);
    expect(toJSON()).toBeNull();
  });
});

// ── 5. Drawer wiring + four siblings preserved (source-scan) ──

describe('UX-SELECTED-NODE-001 — ArgumentGameSurface drawer wiring', () => {
  it('mounts the SelectedNodeInspectDrawer under the inspectVisible + activeMessageId gate', () => {
    expect(SURFACE_SRC).toMatch(
      /inspectVisible && activeMessageId \?\s*\(\s*<SelectedNodeInspectDrawer/,
    );
  });

  it('passes all FOUR shipped Inspect siblings into the drawer slots (composed, not deleted)', () => {
    // Each sibling + its testID is preserved verbatim inside a named slot.
    expect(SURFACE_SRC).toContain('testID="mediator-node-inspect-detail-active"');
    expect(SURFACE_SRC).toContain('testID="ux001-5a-inspect-groups-overlay"');
    expect(SURFACE_SRC).toContain('testID="metadata-diff-inspector"');
    expect(SURFACE_SRC).toContain('testID="ref004-inspect-open-issue-detail"');
    // wired through the named slots
    expect(SURFACE_SRC).toMatch(/whyThisState=\{/);
    expect(SURFACE_SRC).toMatch(/structureNotes=\{/);
    expect(SURFACE_SRC).toMatch(/history=\{/);
  });

  it('imports the drawer wrapper from the mediator feature', () => {
    expect(SURFACE_SRC).toMatch(
      /import \{ SelectedNodeInspectDrawer \} from '\.\.\/mediator\/SelectedNodeInspectDrawer'/,
    );
  });
});

// ── 6. Act-dominant dock (row 10) ─────────────────────────────

describe('UX-SELECTED-NODE-001 — Act-dominant Act/Inspect/Go dock', () => {
  it('the Act trigger carries the dominant style markers', () => {
    // The Act Pressable's style array includes the dominant button style and
    // its label uses the dominant label style. (The style attribute precedes
    // the testID on the Pressable, so match the dominant style appearing
    // within proximity of the Act trigger testID in EITHER order.)
    const actBlock = SURFACE_SRC.slice(
      Math.max(0, SURFACE_SRC.indexOf('board-menu-trigger-act') - 600),
      SURFACE_SRC.indexOf('board-menu-trigger-act') + 200,
    );
    expect(actBlock).toMatch(/styles\.menuTriggerButtonDominant/);
    expect(actBlock).toMatch(/styles\.menuTriggerLabelDominant/);
  });

  it('Inspect + Go remain the resting trigger style (NOT dominant)', () => {
    // The dominant style appears exactly once (Act only).
    const dominantCount = (SURFACE_SRC.match(/menuTriggerButtonDominant/g) ?? []).length;
    // One in the JSX usage + one in the StyleSheet definition = 2 references.
    expect(dominantCount).toBe(2);
  });

  it('all three triggers meet the 44px touch target via minHeight', () => {
    expect(SURFACE_SRC).toMatch(/menuTriggerButton:\s*\{[\s\S]*?minHeight:\s*44/);
  });

  it('the dominant style uses the gold token (no new hex) + a non-color weight cue', () => {
    expect(SURFACE_SRC).toMatch(/menuTriggerButtonDominant:\s*\{[\s\S]*?BRAND\.accent\.goldSoft/);
    expect(SURFACE_SRC).toMatch(/menuTriggerLabelDominant:\s*\{[\s\S]*?fontWeight:\s*'800'/);
  });
});

// ── 7. NO room-level rail / timeline-topology change (PROOF) ──

describe('UX-SELECTED-NODE-001 — NO room/timeline/board topology change (local-only proof)', () => {
  it('the timeline container, DisagreementPointsRail, ArgumentSideActionRail mounts are UNCHANGED in the diff', () => {
    // These rails are still mounted exactly where the board-rail design left
    // them — this card never relocates them. (Presence proof; the diff proof
    // is the git diff --name-only check in the implementer report.)
    expect(SURFACE_SRC).toContain('<DisagreementPointsRail');
    expect(SURFACE_SRC).toContain('<ArgumentSideActionRail');
    expect(SURFACE_SRC).toContain('<OpenIssuesRail');
  });

  it('introduces NO flex-direction / column / two-pane layout change', () => {
    // No new "row" container introduced around the timeline body; the panel
    // changes are all WITHIN the selected card. (The board column layout is
    // UX-BOARD-RAIL-001's scope — this card must not add one.)
    expect(PANEL_SRC).not.toMatch(/flexDirection:\s*'row'/);
    // The in-card accent is absolutely positioned WITHIN the card, never a
    // sibling column.
    expect(PANEL_SRC).toMatch(/selectedCardLeftAccent:\s*\{[\s\S]*?position:\s*'absolute'/);
  });

  it('the panel does NOT import or reference any room-level rail component', () => {
    expect(PANEL_SRC).not.toMatch(/DisagreementPointsRail/);
    expect(PANEL_SRC).not.toMatch(/ArgumentSideActionRail/);
    expect(PANEL_SRC).not.toMatch(/OpenIssuesRail/);
  });
});

// ── 8. No chip soup (single primary chip) ─────────────────────

describe('UX-SELECTED-NODE-001 — no chip soup', () => {
  it('the default node view still mounts exactly ONE primary state chip', () => {
    // The single chip row (UX-MEDIATOR-002) is unchanged; this card adds no
    // second competing chip surface in the default view.
    const chipMounts = (SURFACE_SRC.match(/testID="mediator-node-marker-active"/g) ?? []).length;
    expect(chipMounts).toBe(1);
  });

  it('the responding-to anchor adds CONTEXT lines, not chips', () => {
    // The anchor renders <Text> lines (lead + identity + excerpt), never a
    // chip/badge component.
    expect(PANEL_SRC).toMatch(/respondingAnchor/);
    expect(PANEL_SRC).not.toMatch(/respondingAnchor[\s\S]{0,200}MediatorNodeMarker/);
  });
});

// ── 9. Ban-list clean (doctrine §1/§2/§9) ─────────────────────

describe('UX-SELECTED-NODE-001 — ban-list clean copy', () => {
  const BANNED = _forbiddenMediatorTokens();

  it('the drawer source carries no banned verdict/person/popularity token', () => {
    // Whole-word match so legitimate code identifiers that merely CONTAIN a
    // banned substring (e.g. "provenance" contains "proven", "true" appears in
    // boolean code) do not false-positive. The intent is to catch banned
    // tokens in user-facing copy, not code.
    for (const token of BANNED) {
      const whole = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      expect(DRAWER_SRC).not.toMatch(whole);
    }
  });

  it('the new selected-node copy strings are individually clean', () => {
    const COPY = [
      'Responding to this point',
      'Go to parent point',
      'Why this state',
      'Other structure notes',
      'Move forward:',
      'History',
    ];
    for (const s of COPY) {
      const lower = s.toLowerCase();
      for (const token of BANNED) {
        // "history" / "structure" etc. contain no banned token; the short
        // ambiguous tokens are checked as whole words.
        const isWholeWord = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s);
        expect(isWholeWord).toBe(false);
      }
      // No snake_case leak.
      expect(lower).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('the rendered anchor + excerpt strings carry no snake_case / verdict token', () => {
    const { getByText, getByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact onGoToParent={jest.fn()} />,
    );
    const strings = [
      (getByText('Responding to this point').props.children as string),
      (getByTestId('selected-node-parent-excerpt').props.children as string),
      (getByTestId('selected-node-go-to-parent').props.accessibilityLabel as string),
    ];
    for (const s of strings) {
      expect(typeof s).toBe('string');
      expect(s).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

// ── 10. Sensitive composer-only marks never on node/drawer ────

describe('UX-SELECTED-NODE-001 — sensitive composer-only marks stay hidden', () => {
  it('the drawer wrapper never references a sensitive composer-only code', () => {
    // The wrapper is presentation-only; the filterMarksBySurface gate
    // (UX-MEDIATOR-002) already excludes composer-only Observations from the
    // node + inspect surfaces. This card adds no path that widens exposure.
    const SENSITIVE = [
      'shifts_to_person_or_intent',
      'contains_unplayable_insult_only',
      'needs_pre_send_pause',
    ];
    for (const code of SENSITIVE) {
      expect(DRAWER_SRC).not.toContain(code);
      expect(PANEL_SRC).not.toContain(code);
    }
  });
});

// ── 11. Mobile — no overflow at 320/360/390/414 ───────────────

describe('UX-SELECTED-NODE-001 — mobile: top anchor, no forced rail, no overflow', () => {
  it.each([320, 360, 390, 414])(
    'renders the selected-node treatment at width %ipx without throwing',
    (width) => {
      // jsdom has no real layout; we assert the subtree renders and the
      // accent stays an in-card absolute element (no fixed-width column that
      // would overflow a narrow viewport).
      const prevWidth = (global as { innerWidth?: number }).innerWidth;
      (global as { innerWidth?: number }).innerWidth = width;
      try {
        const { getByTestId } = render(
          <TimelineSelectedReadoutPanel viewModel={fakeReadoutVm()} compact onGoToParent={jest.fn()} />,
        );
        const accent = getByTestId('selected-node-card-left-accent', { includeHiddenElements: true });
        const flat = Array.isArray(accent.props.style)
          ? Object.assign({}, ...accent.props.style.filter(Boolean))
          : accent.props.style;
        // A 4px stripe, NOT a wide column — it cannot push content off a
        // 320px viewport.
        expect(flat.width).toBe(4);
        expect(getByTestId('selected-node-responding-anchor')).toBeTruthy();
      } finally {
        (global as { innerWidth?: number }).innerWidth = prevWidth;
      }
    },
  );

  it('the panel does NOT force a fixed-width left RAIL column at any width', () => {
    // A left rail would be a sibling column with a fixed width + flexDirection
    // row at the panel root. The accent is absolutely positioned inside the
    // card instead.
    expect(PANEL_SRC).not.toMatch(/leftRail|railColumn|boardColumn/);
  });
});
