/**
 * QUOTE-FORGE-002 (#842) — callback echo model. Real-derivation over the
 * production deriver. Firing negative controls + the title-only privacy
 * invariant (the excerpt is never emitted off the authorized path).
 */
import {
  deriveCallbackEcho,
  buildCallbackEchoesByMessageId,
  readCallbackRef,
  type ResolvedPriorLink,
} from '../src/features/arguments/crossRoom/callbackEchoModel';
import type { CrossRoomCallbackRef } from '../src/features/arguments/crossRoom/crossRoomCallbackRef';

const EXCERPT = 'Protected lanes reduce collisions on arterials.';

function ref(overrides: Partial<CrossRoomCallbackRef> = {}): CrossRoomCallbackRef {
  return {
    targetDebateId: 'debate-prior-1',
    excerpt: EXCERPT,
    targetTitleSnapshot: 'Bike-lane baseline',
    capturedFromArgumentId: 'arg-9',
    v: 1,
    ...overrides,
  };
}

function link(overrides: Partial<ResolvedPriorLink> = {}): ResolvedPriorLink {
  return {
    targetDebateId: 'debate-prior-1',
    accessState: 'authorized',
    title: 'Bike-lane baseline',
    ...overrides,
  };
}

describe('deriveCallbackEcho', () => {
  it('authorized — populated excerpt, tappable origin, "Callback to ..."', () => {
    const vm = deriveCallbackEcho({ messageId: 'm1', ref: ref(), link: link() });
    expect(vm).not.toBeNull();
    expect(vm!.accessState).toBe('authorized');
    expect(vm!.echoedExcerpt).toBe(EXCERPT);
    expect(vm!.canOpenOrigin).toBe(true);
    expect(vm!.targetDebateId).toBe('debate-prior-1');
    expect(vm!.originLine).toBe('Callback to “Bike-lane baseline”');
    expect(vm!.a11yFragment).toBe('callback to a prior argument');
  });

  it('returns null for a non-callback move (firing negative control)', () => {
    expect(deriveCallbackEcho({ messageId: 'm1', ref: null, link: link() })).toBeNull();
  });

  it('returns null for a malformed ref with an empty targetDebateId', () => {
    expect(
      deriveCallbackEcho({ messageId: 'm1', ref: ref({ targetDebateId: '' }), link: link() }),
    ).toBeNull();
  });

  it('title_only — SUPPRESSES the excerpt (privacy invariant), locks, not tappable', () => {
    const vm = deriveCallbackEcho({
      messageId: 'm1',
      ref: ref(),
      link: link({ accessState: 'title_only' }),
    });
    expect(vm).not.toBeNull();
    expect(vm!.accessState).toBe('title_only');
    expect(vm!.echoedExcerpt).toBe('');
    expect(vm!.isLocked).toBe(true);
    expect(vm!.canOpenOrigin).toBe(false);
    expect(vm!.targetDebateId).toBeNull();
    expect(vm!.a11yFragment).toBe('callback to a private prior argument');
    // The prior excerpt appears NOWHERE in the VM (incl. the a11y label).
    expect(JSON.stringify(vm)).not.toContain(EXCERPT);
    expect(vm!.accessibilityLabel).not.toContain(EXCERPT);
  });

  it('unavailable link — neutral arm, no excerpt, no title, no tap', () => {
    const vm = deriveCallbackEcho({
      messageId: 'm1',
      ref: ref(),
      link: link({ accessState: 'unavailable' }),
    });
    expect(vm!.accessState).toBe('unavailable');
    expect(vm!.echoedExcerpt).toBe('');
    expect(vm!.originTitle).toBe('');
    expect(vm!.canOpenOrigin).toBe(false);
  });

  it('no matching link row — unavailable arm (R3: no excerpt without authorized access)', () => {
    const vm = deriveCallbackEcho({ messageId: 'm1', ref: ref(), link: null });
    expect(vm!.accessState).toBe('unavailable');
    expect(vm!.echoedExcerpt).toBe('');
  });

  it('authorized but empty excerpt — renders no quote strip content', () => {
    const vm = deriveCallbackEcho({ messageId: 'm1', ref: ref({ excerpt: '   ' }), link: link() });
    expect(vm!.echoedExcerpt).toBe('');
    expect(vm!.accessState).toBe('authorized');
  });

  it('is deterministic', () => {
    const a = deriveCallbackEcho({ messageId: 'm1', ref: ref(), link: link() });
    const b = deriveCallbackEcho({ messageId: 'm1', ref: ref(), link: link() });
    expect(a).toEqual(b);
  });
});

describe('buildCallbackEchoesByMessageId', () => {
  it('only callback moves get an entry (non-callback key ABSENT, not just falsy)', () => {
    const linksByTargetDebateId = new Map<string, ResolvedPriorLink>([['debate-prior-1', link()]]);
    const map = buildCallbackEchoesByMessageId({
      moves: [
        { messageId: 'm1', ref: ref() },
        { messageId: 'm2', ref: null },
      ],
      linksByTargetDebateId,
    });
    expect(Object.prototype.hasOwnProperty.call(map, 'm1')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(map, 'm2')).toBe(false);
  });

  it('two callback moves to the same room resolve from ONE link (reuse)', () => {
    const linksByTargetDebateId = new Map<string, ResolvedPriorLink>([['debate-prior-1', link()]]);
    const map = buildCallbackEchoesByMessageId({
      moves: [
        { messageId: 'm1', ref: ref() },
        { messageId: 'm2', ref: ref({ excerpt: 'Another echoed line.' }) },
      ],
      linksByTargetDebateId,
    });
    expect(map.m1.echoedExcerpt).toBe(EXCERPT);
    expect(map.m2.echoedExcerpt).toBe('Another echoed line.');
    expect(map.m1.accessState).toBe('authorized');
  });

  it('a ref with no resolvable link degrades to the unavailable arm', () => {
    const map = buildCallbackEchoesByMessageId({
      moves: [{ messageId: 'm1', ref: ref() }],
      linksByTargetDebateId: new Map(),
    });
    expect(map.m1.accessState).toBe('unavailable');
  });
});

describe('readCallbackRef', () => {
  it('delegates to the shared reader (client_validation, R1)', () => {
    const blob = { crossRoomCallback: { targetDebateId: 'd', excerpt: 'x', v: 1 } };
    expect(readCallbackRef(blob)?.targetDebateId).toBe('d');
    expect(readCallbackRef({})).toBeNull();
    expect(readCallbackRef(undefined)).toBeNull();
  });
});
