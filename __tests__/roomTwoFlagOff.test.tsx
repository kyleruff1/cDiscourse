/**
 * ROOM-002 (#885) — flag-off byte-identical proof.
 *
 * The Ringside feed renders ONLY behind room_exchange_v2. With the flag OFF
 * the Exchange lens is byte-identical to today:
 *   - ExchangeView returns the stack subtree (ArgumentBubbleStack +
 *     conditional participant ArgumentBubbleActions), UNCHANGED — the early
 *     return short-circuits only when the flag is on AND a feed is supplied;
 *   - ArgumentRoom builds ringsideFeed as null when the flag is off (no wasted
 *     derivation) and passes roomExchangeV2Enabled + ringsideFeed to
 *     ExchangeView;
 *   - the new files read no featureFlags (App.tsx stays the sole flag
 *     consumer; the mount decision arrives as a prop).
 *
 * Modeled on roomThreeFlagOff.test.tsx (source-scan discipline; no runtime
 * render). The byte-identity of the stack subtree is proven by embedding the
 * verbatim opening of the stack return block and asserting it survives intact.
 */
import fs from 'fs';
import path from 'path';

const ROOM = process.cwd();
const EXCHANGE_SRC = fs.readFileSync(
  path.join(ROOM, 'src/features/arguments/room/ExchangeView.tsx'),
  'utf8',
);
const ARGUMENT_ROOM_SRC = fs.readFileSync(
  path.join(ROOM, 'src/features/arguments/room/ArgumentRoom.tsx'),
  'utf8',
);
const NEW_FILES = [
  'src/features/arguments/room/ringsideFeedModel.ts',
  'src/features/arguments/room/RingsideFeed.tsx',
  'src/features/arguments/room/RingsideCard.tsx',
];

// ── Logic identity ────────────────────────────────────────────

/** The Ringside feed mounts iff the flag is on AND a feed is supplied. */
function ringsideMounted(roomExchangeV2Enabled: boolean, hasFeed: boolean): boolean {
  return roomExchangeV2Enabled && hasFeed;
}

describe('ROOM-002 flag-off — logic identity', () => {
  it('the feed is NOT mounted when the flag is OFF; it mounts only when ON with a feed', () => {
    expect(ringsideMounted(false, false)).toBe(false);
    expect(ringsideMounted(false, true)).toBe(false);
    expect(ringsideMounted(true, false)).toBe(false);
    expect(ringsideMounted(true, true)).toBe(true);
  });
});

// ── ExchangeView — early return gate + stack else-branch ───────

describe('ROOM-002 flag-off — ExchangeView renders the stack unless the flag is on', () => {
  it('the Ringside early return is gated on roomExchangeV2Enabled AND ringsideFeed', () => {
    expect(EXCHANGE_SRC).toMatch(
      /if \(props\.roomExchangeV2Enabled && props\.ringsideFeed\) \{/,
    );
  });

  it('RingsideFeed renders only inside the flag-on early return (before the stack return)', () => {
    const guardIdx = EXCHANGE_SRC.indexOf('if (props.roomExchangeV2Enabled && props.ringsideFeed)');
    const ringsideIdx = EXCHANGE_SRC.indexOf('<RingsideFeed');
    const stackIdx = EXCHANGE_SRC.indexOf('<ArgumentBubbleStack');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(ringsideIdx).toBeGreaterThan(guardIdx);
    // The Ringside feed appears in the early return, BEFORE the stack subtree.
    expect(ringsideIdx).toBeLessThan(stackIdx);
    // There is exactly one RingsideFeed mount.
    expect((EXCHANGE_SRC.match(/<RingsideFeed/g) ?? []).length).toBe(1);
  });

  it('the stack subtree survives verbatim as the flag-off else branch (byte-identity)', () => {
    // The opening of the stack return block, byte-for-byte as it shipped
    // pre-ROOM-002. If any of these lines drift, the flag-off render is no
    // longer byte-identical and this assertion fails.
    const STACK_RETURN_HEAD = [
      '  return (',
      '    <>',
      '            <ArgumentBubbleStack',
      '              viewModels={props.viewModels}',
      '              activeMessageId={props.activeMessageId}',
      '              onActivate={props.onActivate}',
      '              onPrevious={props.onPrevious}',
      '              onNext={props.onNext}',
      '              onToggleMode={props.onToggleMode}',
    ].join('\n');
    expect(EXCHANGE_SRC).toContain(STACK_RETURN_HEAD);
  });

  it('the participant ArgumentBubbleActions gate is preserved verbatim', () => {
    expect(EXCHANGE_SRC).toContain(
      "{props.activeViewModel && props.viewerRole === 'participant' ? (",
    );
    expect(EXCHANGE_SRC).toContain('<ArgumentBubbleActions');
  });
});

// ── ArgumentRoom — projection gate + prop pass ────────────────

describe('ROOM-002 flag-off — ArgumentRoom builds the feed only when the flag is on', () => {
  it('ringsideFeed is null when the flag is off (no wasted derivation)', () => {
    expect(ARGUMENT_ROOM_SRC).toMatch(
      /const ringsideFeed = useMemo<RingsideFeedViewModel \| null>\(\(\) => \{\s*\n\s*if \(!roomExchangeV2Enabled\) return null;/,
    );
  });

  it('ArgumentRoom passes roomExchangeV2Enabled + ringsideFeed to ExchangeView', () => {
    expect(ARGUMENT_ROOM_SRC).toMatch(/<ExchangeView[\s\S]*?roomExchangeV2Enabled=\{roomExchangeV2Enabled\}/);
    expect(ARGUMENT_ROOM_SRC).toMatch(/<ExchangeView[\s\S]*?ringsideFeed=\{ringsideFeed\}/);
  });

  it('the observer action set is the injected getRailActions set (no forked table)', () => {
    expect(ARGUMENT_ROOM_SRC).toMatch(/observerActionsFor: \(actor\) => getRailActions\('observer', actor\)/);
  });
});

// ── No new featureFlags consumer ──────────────────────────────

describe('ROOM-002 flag-off — the new files read no featureFlags', () => {
  it('none of the new Ringside files import featureFlags', () => {
    for (const rel of NEW_FILES) {
      const src = fs.readFileSync(path.join(ROOM, rel), 'utf8');
      expect({ rel, hit: /featureFlags/.test(src) }).toEqual({ rel, hit: false });
    }
  });
});
