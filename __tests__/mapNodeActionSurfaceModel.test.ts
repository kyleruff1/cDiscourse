/**
 * ROOM-004 (#886) — mapNodeActionSurfaceModel unit coverage (S1).
 *
 * Pure-model: the popover action row mirrors the injected actor actions,
 * own-move is band-free with an Open Act path, the open-point membership line
 * is derived from the injected flag, accessibility labels are well-formed,
 * empty / null input is defensive, and the produced copy is ban-list clean.
 */
import {
  buildMapNodeActionSurface,
  _forbiddenMapSurfaceTokens,
  type MapNodeActionSurfaceInput,
} from '../src/features/arguments/room/mapNodeActionSurfaceModel';
import { getRailActions } from '../src/features/arguments/ArgumentSideActionRail';
import type { RailBubbleActor, RailViewerRole } from '../src/features/arguments/railActionCategories';

function makeInput(over: Partial<MapNodeActionSurfaceInput> = {}): MapNodeActionSurfaceInput {
  const has = (k: keyof MapNodeActionSurfaceInput) => Object.prototype.hasOwnProperty.call(over, k);
  const viewerRole: RailViewerRole = over.viewerRole ?? 'participant';
  const actor: RailBubbleActor = over.actor ?? 'other';
  return {
    activeMessageId: has('activeMessageId') ? (over.activeMessageId as string | null) : 'm4',
    viewerRole,
    actor,
    actions: has('actions') ? (over.actions as MapNodeActionSurfaceInput['actions']) : getRailActions(viewerRole, actor),
    actingOnShortLabel: has('actingOnShortLabel') ? (over.actingOnShortLabel as string | null) : 'Message 4',
    isOpenPointMember: over.isOpenPointMember ?? false,
  };
}

// ── Action row mirrors the injected actor actions ─────────────

describe('mapNodeActionSurfaceModel — action row', () => {
  it('participant-other → reply / disagree popover row', () => {
    const surface = buildMapNodeActionSurface(makeInput({ viewerRole: 'participant', actor: 'other' }));
    expect(surface.actionRow.map((a) => a.code)).toEqual(['reply', 'disagree']);
    expect(surface.isOwnMove).toBe(false);
  });

  it('observer → watch / join / share popover row', () => {
    const surface = buildMapNodeActionSurface(
      makeInput({ viewerRole: 'observer' as RailViewerRole, actor: 'other' }),
    );
    expect(surface.actionRow.map((a) => a.code)).toEqual(['watch', 'join_aff', 'join_neg', 'share']);
    expect(surface.isOwnMove).toBe(false);
  });

  it('own move → empty rail row + isOwnMove true + Open Act path', () => {
    const surface = buildMapNodeActionSurface(makeInput({ viewerRole: 'participant', actor: 'self' }));
    expect(surface.actionRow).toEqual([]);
    expect(surface.isOwnMove).toBe(true);
    expect(surface.openActLabel).toBe('Open Act ▾');
    expect(surface.openActHint).toBe('View qualifiers or request deletion');
  });

  it('the action row is a faithful pass-through of the injected list (never re-authored)', () => {
    const injected = getRailActions('participant', 'other');
    const surface = buildMapNodeActionSurface(makeInput({ actions: injected }));
    expect(surface.actionRow).toEqual(injected);
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
    expect(Array.isArray(surface.actionRow)).toBe(true);
  });

  it('missing actions → empty action row', () => {
    const surface = buildMapNodeActionSurface(
      makeInput({ actions: undefined as unknown as MapNodeActionSurfaceInput['actions'] }),
    );
    expect(surface.actionRow).toEqual([]);
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
      surface.openActLabel,
      surface.openActHint,
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
