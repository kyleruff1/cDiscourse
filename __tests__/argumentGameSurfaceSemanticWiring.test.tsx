/**
 * MCP-019 — ArgumentGameSurface + ArgumentTreeScreen semantic-wiring scan.
 *
 * Source-scan (repo UI test discipline). Verifies the surface renders the
 * referee banner / override sheet conditionally behind absent-by-default
 * optional props, that the render is inline (no Modal, no route push), that
 * the banner does not gate the composer / action rail, and that the room
 * shell wires `useSemanticReferee` into the post-success path only.
 */
import * as fs from 'fs';
import * as path from 'path';

const SURFACE = fs.readFileSync(
  path.join(process.cwd(), 'src/features/arguments/ArgumentGameSurface.tsx'),
  'utf8',
);
const TREE = fs.readFileSync(
  path.join(process.cwd(), 'src/features/arguments/ArgumentTreeScreen.tsx'),
  'utf8',
);

describe('ArgumentGameSurface — referee banner wiring', () => {
  it('imports RefereeBannerView', () => {
    expect(SURFACE).toMatch(/import \{ RefereeBannerView \}/);
  });

  it('renders RefereeBannerView only when refereeBanner is truthy', () => {
    expect(SURFACE).toMatch(/refereeBanner \?\s*\(?\s*<RefereeBannerView/s);
  });

  it('declares refereeBanner / overridePrompt / onConfirmOverride as optional props', () => {
    expect(SURFACE).toMatch(/refereeBanner\?:/);
    expect(SURFACE).toMatch(/overridePrompt\?:/);
    expect(SURFACE).toMatch(/onConfirmOverride\?:/);
  });
});

describe('ArgumentGameSurface — override sheet wiring', () => {
  it('imports SemanticOverrideChoiceSheet', () => {
    expect(SURFACE).toMatch(/import \{\s*SemanticOverrideChoiceSheet/);
  });

  it('renders the sheet only when overridePrompt.shouldOffer is true', () => {
    expect(SURFACE).toMatch(/overridePrompt && overridePrompt\.shouldOffer/);
  });

  it('the override sheet is inline — not a Modal, not a navigation push', () => {
    // The surface mounts SemanticOverrideChoiceSheet directly; it must not
    // wrap it in a Modal or push a route.
    expect(SURFACE).not.toMatch(/<Modal[^>]*SemanticOverrideChoiceSheet/s);
    expect(SURFACE).not.toMatch(/navigation\.(navigate|push)/);
  });
});

describe('ArgumentGameSurface — additive, non-blocking', () => {
  it('the new render blocks are conditional (absent props → nothing renders)', () => {
    // Both new blocks short-circuit on a falsy prop.
    expect(SURFACE).toMatch(/refereeBanner \?/);
    expect(SURFACE).toMatch(/\? \(\s*<SemanticOverrideChoiceSheet/s);
  });

  it('the banner does not gate the composer or the action rail', () => {
    // The ArgumentSideActionRail + ArgumentBubbleActions render
    // unconditionally w.r.t. the referee state — no `refereeBanner &&`
    // guard wraps them.
    expect(SURFACE).not.toMatch(/refereeBanner[^\n]*ArgumentSideActionRail/);
    expect(SURFACE).not.toMatch(/refereeBanner[^\n]*ArgumentBubbleActions/);
  });

  it('the surface still imports its pre-MCP-019 core components', () => {
    // A sanity check that the change was additive — the existing surface is intact.
    expect(SURFACE).toMatch(/ArgumentBubbleStack/);
    expect(SURFACE).toMatch(/ArgumentTimelineMap/);
    expect(SURFACE).toMatch(/ArgumentSideActionRail/);
  });
});

describe('ArgumentTreeScreen — room-shell wiring', () => {
  it('imports and calls useSemanticReferee', () => {
    expect(TREE).toMatch(/import \{ useSemanticReferee \}/);
    expect(TREE).toMatch(/useSemanticReferee\(\)/);
  });

  it('fires onMovePosted only for a newly-arrived move authored by the current user', () => {
    expect(TREE).toMatch(/onMovePosted/);
    expect(TREE).toMatch(/authorId === currentUserId/);
  });

  it('does not fire on the very first room load (a load is not a post)', () => {
    expect(TREE).toMatch(/isFirstObservation/);
  });

  it('passes the banner / override slice + confirm callback to the surface', () => {
    expect(TREE).toMatch(/refereeBanner=\{/);
    expect(TREE).toMatch(/overridePrompt=\{/);
    expect(TREE).toMatch(/onConfirmOverride=\{/);
  });

  it('the post-success path never gates submit-argument or the composer', () => {
    // onMovePosted is fire-and-forget (`void refereeOnMovePosted(...)`) — it
    // is not awaited, so it cannot delay anything.
    expect(TREE).toMatch(/void refereeOnMovePosted\(/);
  });

  it('confirmOverride routes the in-memory record write through the hook', () => {
    expect(TREE).toMatch(/referee\.confirmOverride/);
  });
});
