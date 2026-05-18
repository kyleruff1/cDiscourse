/**
 * Stage 6.1.8 — argumentGameSurface pure-TS tests.
 */
import {
  buildArgumentBubbleViewModels,
  defaultSurfaceState,
  getBubbleControlsForActor,
  getDisplayTitle,
  getLatestMessageId,
  getNextMessageId,
  getPreviousMessageId,
  getStackTransformForIndex,
  getTimelineSegments,
  sortMessagesChronologically,
  toggleSurfaceMode,
  STACK_VISIBLE_RADIUS,
  ALL_BUBBLE_CONTROLS,
  type ArgumentMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';

function mkMsg(id: string, createdAt: string, over: Partial<ArgumentMessageInput> = {}): ArgumentMessageInput {
  return {
    id,
    debateId: 'd-1',
    parentId: null,
    authorId: 'u-other',
    argumentType: 'rebuttal',
    side: 'negative',
    body: `body-${id}`,
    createdAt,
    ...over,
  };
}

describe('sortMessagesChronologically + getLatestMessageId', () => {
  it('sorts by createdAt ascending and reports the latest id', () => {
    const msgs = [
      mkMsg('m3', '2026-05-17T03:00:00Z'),
      mkMsg('m1', '2026-05-17T01:00:00Z'),
      mkMsg('m2', '2026-05-17T02:00:00Z'),
    ];
    const sorted = sortMessagesChronologically(msgs);
    expect(sorted.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(getLatestMessageId(msgs)).toBe('m3');
  });

  it('falls back to id ordering when timestamps tie', () => {
    const t = '2026-05-17T01:00:00Z';
    const sorted = sortMessagesChronologically([mkMsg('b', t), mkMsg('a', t)]);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('getPreviousMessageId / getNextMessageId', () => {
  const ids = ['m1', 'm2', 'm3', 'm4'];
  it('next snaps to first when no current', () => {
    expect(getNextMessageId(ids, null)).toBe('m1');
  });
  it('previous snaps to last when no current', () => {
    expect(getPreviousMessageId(ids, null)).toBe('m4');
  });
  it('previous returns null at start, next returns null at end', () => {
    expect(getPreviousMessageId(ids, 'm1')).toBeNull();
    expect(getNextMessageId(ids, 'm4')).toBeNull();
  });
});

describe('getDisplayTitle', () => {
  it('prefers the explicit debate title', () => {
    expect(getDisplayTitle({ debateTitle: 'My debate' })).toBe('My debate');
  });

  it('falls back to root body excerpt when title is empty', () => {
    expect(getDisplayTitle({ debateTitle: '', rootBody: 'A claim about bike lanes' })).toBe('A claim about bike lanes');
  });

  it('falls back to "Untitled argument" when title AND root body are empty', () => {
    expect(getDisplayTitle({})).toBe('Untitled argument');
    expect(getDisplayTitle({ debateTitle: '', rootBody: '' })).toBe('Untitled argument');
  });

  it('trims and clamps long titles', () => {
    const long = 'x'.repeat(200);
    expect(getDisplayTitle({ debateTitle: long, maxChars: 30 })).toHaveLength(30);
  });

  it('redacts verdict tokens before displaying', () => {
    const out = getDisplayTitle({ debateTitle: 'They are propagandists and liars' });
    expect(out.toLowerCase()).not.toContain('propagandist');
    expect(out.toLowerCase()).not.toContain('liar');
    expect(out).toContain('[redacted-term]');
  });
});

describe('getBubbleControlsForActor', () => {
  it('self bubble exposes only view_qualifiers + request_deletion (no edit/disagree/flag)', () => {
    const controls = getBubbleControlsForActor('self');
    expect(controls).toContain('view_qualifiers');
    expect(controls).toContain('request_deletion');
    expect(controls).not.toContain('reply');
    expect(controls).not.toContain('disagree');
    expect(controls).not.toContain('flag');
    expect(controls).not.toContain('ask_for_source');
    expect(controls).not.toContain('ask_for_quote');
    expect(controls).not.toContain('branch');
    // No "edit" control exists in the union — that's the architectural guarantee.
  });

  it('self bubble suppresses request_deletion when an open request already exists', () => {
    const controls = getBubbleControlsForActor('self', { hasOpenDeletionRequest: true });
    expect(controls).not.toContain('request_deletion');
    expect(controls).toContain('view_qualifiers');
  });

  it('other-user bubble exposes the rich interaction set', () => {
    const controls = getBubbleControlsForActor('other');
    for (const c of ['reply', 'disagree', 'flag', 'ask_for_source', 'ask_for_quote', 'branch', 'view_qualifiers']) {
      expect(controls).toContain(c);
    }
    expect(controls).not.toContain('request_deletion');
  });

  it('bot bubble behaves like other-user (interactable, not deletable)', () => {
    const controls = getBubbleControlsForActor('bot');
    expect(controls).toContain('reply');
    expect(controls).not.toContain('request_deletion');
  });
});

describe('buildArgumentBubbleViewModels', () => {
  const messages: ArgumentMessageInput[] = [
    mkMsg('m1', '2026-05-17T01:00:00Z', { authorId: 'u-other', argumentType: 'thesis', side: 'affirmative' }),
    mkMsg('m2', '2026-05-17T02:00:00Z', { authorId: 'u-self', parentId: 'm1', argumentType: 'rebuttal' }),
    mkMsg('m3', '2026-05-17T03:00:00Z', { authorId: 'u-other', parentId: 'm2', argumentType: 'counter_rebuttal' }),
  ];

  it('marks the latest message active by default and assigns ordinals', () => {
    const vms = buildArgumentBubbleViewModels({ messages, currentUserId: 'u-self' });
    expect(vms).toHaveLength(3);
    expect(vms.map((v) => v.ordinal)).toEqual([1, 2, 3]);
    expect(vms[2].isLatest).toBe(true);
    expect(vms[2].isActive).toBe(true);
    expect(vms[0].isLatest).toBe(false);
  });

  it('classifies actor correctly + applies actor-specific control set', () => {
    const vms = buildArgumentBubbleViewModels({ messages, currentUserId: 'u-self' });
    expect(vms[0].actor).toBe('other');
    expect(vms[1].actor).toBe('self');
    expect(vms[2].actor).toBe('other');
    expect(vms[1].allowedControls).toContain('request_deletion');
    expect(vms[1].allowedControls).not.toContain('disagree');
    expect(vms[0].allowedControls).toContain('disagree');
  });

  it('parent hint pulls from the lookup function', () => {
    const vms = buildArgumentBubbleViewModels({
      messages,
      currentUserId: 'u-self',
      parentHintLookup: (id) => (id === 'm1' ? 'we should narrow scope' : null),
    });
    expect(vms[1].parentHint).toContain('we should narrow scope');
  });

  it('suppresses request_deletion on a self bubble when an open request exists', () => {
    const vms = buildArgumentBubbleViewModels({
      messages, currentUserId: 'u-self', deletionRequestedMap: { m2: true },
    });
    const self = vms.find((v) => v.actor === 'self')!;
    expect(self.deletionRequested).toBe(true);
    expect(self.allowedControls).not.toContain('request_deletion');
  });

  it('redacts verdict tokens from the rendered body', () => {
    const vms = buildArgumentBubbleViewModels({
      messages: [mkMsg('mx', '2026-05-17T04:00:00Z', { body: 'They are liars and propagandists' })],
      currentUserId: 'u-self',
    });
    expect(vms[0].body.toLowerCase()).not.toContain('liar');
    expect(vms[0].body.toLowerCase()).not.toContain('propagandist');
  });
});

describe('getTimelineSegments', () => {
  const messages: ArgumentMessageInput[] = [
    mkMsg('m1', '2026-05-17T01:00:00Z', { argumentType: 'thesis' }),
    mkMsg('m2', '2026-05-17T02:00:00Z', { argumentType: 'rebuttal', authorId: 'u-self' }),
    mkMsg('m3', '2026-05-17T03:00:00Z', { argumentType: 'evidence' }),
  ];

  it('produces one segment per message with accessibility labels', () => {
    const segs = getTimelineSegments({ messages, currentUserId: 'u-self' });
    expect(segs).toHaveLength(3);
    expect(segs[0].accessibilityLabel).toMatch(/Message 1 of 3/);
    expect(segs[1].accessibilityLabel).toMatch(/rebuttal/);
  });

  it('marks the latest segment active by default', () => {
    const segs = getTimelineSegments({ messages, currentUserId: 'u-self' });
    expect(segs[segs.length - 1].isActive).toBe(true);
  });

  it('merges category/qualifier badges into the segment', () => {
    const segs = getTimelineSegments({
      messages,
      currentUserId: 'u-self',
      categoryLabelById: { m2: 'Challenge' },
      qualifierLabelById: { m2: 'Narrow scope' },
    });
    expect(segs[1].badges).toEqual(expect.arrayContaining(['Challenge', 'Narrow scope']));
  });
});

describe('getStackTransformForIndex', () => {
  it('puts the active card at scale 1, opacity 1, zIndex max', () => {
    const t = getStackTransformForIndex(5, 5, 10);
    expect(t.scale).toBe(1);
    expect(t.opacity).toBe(1);
    expect(t.zIndex).toBe(1000);
    expect(t.isActive).toBe(true);
  });

  it('fans older + newer cards behind with reduced scale + opacity', () => {
    const older = getStackTransformForIndex(3, 5, 10);
    const newer = getStackTransformForIndex(7, 5, 10);
    expect(older.scale).toBeLessThan(1);
    expect(older.opacity).toBeLessThan(1);
    expect(older.translateY).not.toBe(0);
    expect(newer.translateY).not.toBe(0);
  });

  it('far cards beyond the visible radius collapse to a low-opacity tier', () => {
    const farOlder = getStackTransformForIndex(0, 8, 20);
    expect(farOlder.opacity).toBeLessThan(0.2);
    expect(farOlder.scale).toBeLessThan(0.8);
    expect(STACK_VISIBLE_RADIUS).toBe(3);
  });
});

describe('defaultSurfaceState + toggleSurfaceMode', () => {
  it('defaults mode=stack and activeMessageId=latest', () => {
    const state = defaultSurfaceState([
      mkMsg('a', '2026-05-17T01:00:00Z'),
      mkMsg('b', '2026-05-17T02:00:00Z'),
    ]);
    expect(state.mode).toBe('stack');
    expect(state.activeMessageId).toBe('b');
    expect(state.chronologicalIds).toEqual(['a', 'b']);
  });

  it('toggleSurfaceMode flips stack ↔ timeline', () => {
    expect(toggleSurfaceMode('stack')).toBe('timeline');
    expect(toggleSurfaceMode('timeline')).toBe('stack');
  });
});

describe('Control set hygiene', () => {
  it('the canonical control union never includes a body-edit affordance', () => {
    expect(ALL_BUBBLE_CONTROLS).not.toContain('edit' as never);
    expect(ALL_BUBBLE_CONTROLS).not.toContain('edit_body' as never);
  });
});

// ── EV-002 — artifactsByMessageId pure helper ─────────────────

describe('EV-002 buildArtifactsByMessageId', () => {
  it('returns an empty list for messages with no attachedEvidence', () => {
    const { buildArtifactsByMessageId } = require('../src/features/arguments/argumentGameSurfaceEvidence');
    const msgs = [mkMsg('m1', '2026-05-18T01:00:00Z')];
    const map = buildArtifactsByMessageId(msgs);
    expect(map.m1).toEqual([]);
  });

  it('builds EV-001 artifacts from clientValidation.attachedEvidence-shaped fields', () => {
    const { buildArtifactsByMessageId } = require('../src/features/arguments/argumentGameSurfaceEvidence');
    const msgs = [
      mkMsg('m1', '2026-05-18T01:00:00Z', {
        attachedEvidence: [{ url: 'https://example.com/x', label: 'example' }],
      }),
    ];
    const map = buildArtifactsByMessageId(msgs);
    expect(map.m1.length).toBe(1);
    expect(map.m1[0].kind).toBe('url');
    expect(map.m1[0].url).toBe('https://example.com/x');
    expect(map.m1[0].sourceChainStatus).toBe('source_no_quote');
    expect(map.m1[0].argumentId).toBe('m1');
  });

  it('drops empty / all-null attachments (EV-001 adapter discipline)', () => {
    const { buildArtifactsByMessageId } = require('../src/features/arguments/argumentGameSurfaceEvidence');
    const msgs = [
      mkMsg('m1', '2026-05-18T01:00:00Z', {
        attachedEvidence: [{ url: null, sourceText: null, quote: null }],
      }),
    ];
    const map = buildArtifactsByMessageId(msgs);
    expect(map.m1).toEqual([]);
  });

  it('defensively maps missing authorId to "unknown" (no service-role inference)', () => {
    const { buildArtifactsByMessageId } = require('../src/features/arguments/argumentGameSurfaceEvidence');
    const msgs = [
      mkMsg('m1', '2026-05-18T01:00:00Z', {
        authorId: null,
        attachedEvidence: [{ url: 'https://example.com/x' }],
      }),
    ];
    const map = buildArtifactsByMessageId(msgs);
    expect(map.m1[0].addedByUserId).toBe('unknown');
  });
});
