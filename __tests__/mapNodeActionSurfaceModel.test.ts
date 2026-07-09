/**
 * ROOM-004 (#886) — mapNodeActionSurfaceModel unit coverage (S1).
 *
 * Pure-model: the popover action row MIRRORS the Ringside card (participant =
 * allowedControls; observer = getRailActions), the open-point membership line is
 * derived from the injected flag, accessibility labels are well-formed, empty /
 * null input is defensive, the control->rail-code bridge is exact, and the
 * produced copy is ban-list clean.
 */
import {
  buildMapNodeActionSurface,
  mapActionRowToRailCodes,
  BUBBLE_CONTROL_TO_RAIL_ACTION_CODE,
  _forbiddenMapSurfaceTokens,
  type MapNodeActionSurfaceInput,
} from '../src/features/arguments/room/mapNodeActionSurfaceModel';
import {
  getBubbleControlsForActor,
  type ArgumentBubbleControl,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { getRailActions, railActionToBubbleControl } from '../src/features/arguments/ArgumentSideActionRail';
import type { RailBubbleActor, RailViewerRole } from '../src/features/arguments/railActionCategories';

function makeInput(over: Partial<MapNodeActionSurfaceInput> = {}): MapNodeActionSurfaceInput {
  const has = (k: keyof MapNodeActionSurfaceInput) => Object.prototype.hasOwnProperty.call(over, k);
  const viewerRole: RailViewerRole = over.viewerRole ?? 'participant';
  const actor: RailBubbleActor = over.actor ?? 'other';
  return {
    activeMessageId: has('activeMessageId') ? (over.activeMessageId as string | null) : 'm4',
    viewerRole,
    actor,
    participantControls: has('participantControls')
      ? (over.participantControls as ArgumentBubbleControl[])
      : getBubbleControlsForActor(actor),
    observerActions: has('observerActions')
      ? (over.observerActions as MapNodeActionSurfaceInput['observerActions'])
      : getRailActions('observer', actor),
    actingOnShortLabel: has('actingOnShortLabel') ? (over.actingOnShortLabel as string | null) : 'Message 4',
    isOpenPointMember: over.isOpenPointMember ?? false,
  };
}

// ── Action row mirrors the Ringside card ──────────────────────

describe('mapNodeActionSurfaceModel — action row mirrors the Ringside card', () => {
  it('participant-other → the FULL allowedControls set (7 controls), not just reply/disagree', () => {
    const surface = buildMapNodeActionSurface(makeInput({ viewerRole: 'participant', actor: 'other' }));
    expect(surface.actionRow.kind).toBe('participant');
    if (surface.actionRow.kind === 'participant') {
      expect(surface.actionRow.controls).toEqual([
        'reply',
        'disagree',
        'flag',
        'ask_for_source',
        'ask_for_quote',
        'branch',
        'view_qualifiers',
      ] as ArgumentBubbleControl[]);
    }
    expect(surface.isOwnMove).toBe(false);
  });

  it('participant-self (own node) → view_qualifiers + request_deletion ONLY', () => {
    const surface = buildMapNodeActionSurface(makeInput({ viewerRole: 'participant', actor: 'self' }));
    expect(surface.actionRow.kind).toBe('participant');
    if (surface.actionRow.kind === 'participant') {
      expect(surface.actionRow.controls).toEqual(['view_qualifiers', 'request_deletion'] as ArgumentBubbleControl[]);
    }
    expect(surface.isOwnMove).toBe(true);
  });

  it('own node with an open deletion request drops request_deletion', () => {
    const surface = buildMapNodeActionSurface(
      makeInput({
        viewerRole: 'participant',
        actor: 'self',
        participantControls: getBubbleControlsForActor('self', { hasOpenDeletionRequest: true }),
      }),
    );
    expect(surface.actionRow.kind === 'participant' && surface.actionRow.controls).toEqual([
      'view_qualifiers',
    ] as ArgumentBubbleControl[]);
  });

  it('observer → watch / join / share', () => {
    const surface = buildMapNodeActionSurface(
      makeInput({ viewerRole: 'observer' as RailViewerRole, actor: 'other' }),
    );
    expect(surface.actionRow.kind).toBe('observer');
    if (surface.actionRow.kind === 'observer') {
      expect(surface.actionRow.actions.map((a) => a.code)).toEqual(['watch', 'join_aff', 'join_neg', 'share']);
    }
  });
});

// ── Control -> rail-code bridge ───────────────────────────────

describe('mapNodeActionSurfaceModel — control bridge + normalization', () => {
  it('BUBBLE_CONTROL_TO_RAIL_ACTION_CODE is the exact inverse of railActionToBubbleControl', () => {
    for (const control of Object.keys(BUBBLE_CONTROL_TO_RAIL_ACTION_CODE) as ArgumentBubbleControl[]) {
      const railCode = BUBBLE_CONTROL_TO_RAIL_ACTION_CODE[control];
      expect(railActionToBubbleControl(railCode)).toBe(control);
    }
  });

  it('mapActionRowToRailCodes normalizes a participant row into rail codes', () => {
    const surface = buildMapNodeActionSurface(makeInput({ viewerRole: 'participant', actor: 'other' }));
    expect(mapActionRowToRailCodes(surface.actionRow)).toEqual([
      'reply',
      'disagree',
      'flag',
      'ask_source',
      'ask_quote',
      'split_branch',
      'qualifiers',
    ]);
  });

  it('mapActionRowToRailCodes passes observer codes through', () => {
    const surface = buildMapNodeActionSurface(makeInput({ viewerRole: 'observer' as RailViewerRole, actor: 'other' }));
    expect(mapActionRowToRailCodes(surface.actionRow)).toEqual(['watch', 'join_aff', 'join_neg', 'share']);
  });
});

// ── Sidecar links + membership ────────────────────────────────

describe('mapNodeActionSurfaceModel — sidecar', () => {
  it('always exposes Answer this + Open disagreement points links', () => {
    const surface = buildMapNodeActionSurface(makeInput());
    expect(surface.sidecarLinks.map((l) => l.key)).toEqual(['answer_this', 'open_debts']);
    expect(surface.sidecarLinks[0].label).toBe('Answer this ↗');
    expect(surface.sidecarLinks[1].label).toBe('Open disagreement points');
  });

  it('open-point membership line renders only for an open-point member', () => {
    expect(buildMapNodeActionSurface(makeInput({ isOpenPointMember: true })).openPointMembershipLine).toBe(
      'Part of an open point',
    );
    expect(buildMapNodeActionSurface(makeInput({ isOpenPointMember: false })).openPointMembershipLine).toBeNull();
  });
});

// ── Accessibility label ───────────────────────────────────────

describe('mapNodeActionSurfaceModel — accessibility label', () => {
  it('names the acting-on subject', () => {
    expect(buildMapNodeActionSurface(makeInput({ actingOnShortLabel: 'Message 4' })).accessibilityLabel).toBe(
      'Actions for Message 4.',
    );
  });

  it('falls back to a neutral subject when no label is supplied', () => {
    expect(buildMapNodeActionSurface(makeInput({ actingOnShortLabel: null })).accessibilityLabel).toBe(
      'Actions for this point.',
    );
  });

  it('carries the Answer this + Close copy', () => {
    const surface = buildMapNodeActionSurface(makeInput());
    expect(surface.answerThisLabel).toBe('Answer this ↗');
    expect(surface.answerThisHint).toContain('reply composer scoped to this point');
    expect(surface.closeLabel).toBe('Close actions');
  });
});

// ── Defensive input ───────────────────────────────────────────

describe('mapNodeActionSurfaceModel — defensive input', () => {
  it('null activeMessageId → messageId null, defined surface', () => {
    const surface = buildMapNodeActionSurface(makeInput({ activeMessageId: null }));
    expect(surface.messageId).toBeNull();
    expect(surface.actionRow.kind).toBe('participant');
  });

  it('missing participant controls → empty participant row', () => {
    const surface = buildMapNodeActionSurface(
      makeInput({ participantControls: undefined as unknown as ArgumentBubbleControl[] }),
    );
    expect(surface.actionRow.kind === 'participant' && surface.actionRow.controls).toEqual([]);
  });
});

// ── Ban-list ──────────────────────────────────────────────────

describe('mapNodeActionSurfaceModel — ban-list', () => {
  it('exposes the forbidden-token list', () => {
    const tokens = _forbiddenMapSurfaceTokens();
    expect(tokens).toContain('proof');
    expect(tokens).toContain('winner');
    expect(tokens.length).toBeGreaterThan(10);
  });

  it('no produced static label / hint contains a forbidden token', () => {
    const surface = buildMapNodeActionSurface(makeInput({ isOpenPointMember: true }));
    const strings = [
      surface.answerThisLabel,
      surface.answerThisHint,
      surface.closeLabel,
      surface.openPointMembershipLine ?? '',
      ...surface.sidecarLinks.flatMap((l) => [l.label, l.hint]),
    ];
    for (const s of strings) {
      for (const tok of _forbiddenMapSurfaceTokens()) {
        expect(s.toLowerCase()).not.toContain(tok);
      }
    }
  });
});
