/**
 * COMPOSER-001 — Composer prefill wiring tests.
 *
 * SC-004 ships the dock model `actionDockToComposerPreset(action, target,
 * parentType)` which returns the right `MoveDraftPatch` for each of
 * `narrow` / `confirm` / `synthesize` (plus the existing EV-002 presets).
 * Before COMPOSER-001 the room shell's dock dispatch discarded the patch
 * for narrow/confirm/synthesize and routed them through `handleAction(
 * 'reply', ...)`, which made `FullRoomGameSurfaceMount.handleAction`
 * compute a `presetLabel='reply'` preset (null) and clear whatever the
 * dock had chosen.
 *
 * This file proves the seam-wiring fix by combining:
 *
 *   1. A pure-TS model assertion: `actionDockToComposerPreset(action,
 *      target, null)` returns the expected `MoveDraftPatch` for each of
 *      the three SC-004 actions (regression / contract test).
 *   2. A source-scan of `ArgumentGameSurface.tsx` asserting the dock
 *      dispatch path computes the preset once via
 *      `actionDockToComposerPreset(action, target, parentType)` and
 *      threads it into `handleAction(control, messageId, preset)`.
 *   3. A source-scan of `ArgumentTreeScreen.tsx` asserting
 *      `FullRoomGameSurfaceMount.handleAction` accepts the optional
 *      `explicitPreset` argument and prefers it over the locally-computed
 *      EV-002 preset, while still computing one for plain bubble
 *      controls (regression for EV-002 `source` / `quote` / `weak_source`).
 *   4. An EV-002 regression assertion: `quickActionToPreset('source',
 *      ...)` / `'quote'` / `'weak_source'` still return non-null patches
 *      with their seeded bodies.
 *   5. Non-preset action assertion: `reply` / `branch` / `flag` /
 *      `mark_moved_on` / `mark_ignored` / `open_cards_detail` /
 *      `expand_branch` produce `null` from `actionDockToComposerPreset`
 *      (no auto-fill body), preserving the design's intent.
 *
 * No React. No render harness. The seam is asserted via source
 * inspection, mirroring `timelineNodeActionDockSelectionExclusion.test.ts`.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  actionDockToComposerPreset,
  type TimelineNodeActionDockTarget,
} from '../src/features/arguments/timelineNodeActionDockModel';
import {
  NARROW_PRESET_BODY,
  CONFIRM_PRESET_BODY,
  SYNTHESIZE_PRESET_BODY,
  quickActionToPreset,
} from '../src/features/arguments/quickActionPresets';
import {
  ASK_QUOTE_PRESET_BODY,
  ASK_SOURCE_PRESET_BODY,
  ASK_STRONGER_SOURCE_PRESET_BODY,
} from '../src/features/evidence/sourceChainPresetCopy';

const GAME_SURFACE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'arguments', 'room', 'ArgumentRoom.tsx'),
  'utf8',
);
const TREE_SCREEN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentTreeScreen.tsx'),
  'utf8',
);

const NODE_TARGET: TimelineNodeActionDockTarget = {
  kind: 'node',
  messageId: 'm-target',
};
const CLUSTER_TARGET: TimelineNodeActionDockTarget = {
  kind: 'cluster',
  branchRootMessageId: 'm-root',
};

describe('COMPOSER-001 — dock model returns the right preset for the three SC-004 actions', () => {
  it('narrow returns a concession patch with NARROW_PRESET_BODY and a narrow_scope tag', () => {
    const patch = actionDockToComposerPreset('narrow', NODE_TARGET, null);
    expect(patch).not.toBeNull();
    expect(patch!.body).toBe(NARROW_PRESET_BODY);
    expect(patch!.argumentType).toBe('concession');
    expect(patch!.suggestedTagCodes).toContain('narrow_scope');
  });

  it('confirm returns a body-only patch with CONFIRM_PRESET_BODY (no forced argumentType)', () => {
    const patch = actionDockToComposerPreset('confirm', NODE_TARGET, null);
    expect(patch).not.toBeNull();
    expect(patch!.body).toBe(CONFIRM_PRESET_BODY);
    // confirm intentionally leaves argumentType unset; the user picks the
    // move type in the composer. The seeded body speaks to the
    // accept-the-narrowed-point shape regardless of the chosen type.
    expect(patch!.argumentType).toBeUndefined();
  });

  it('synthesize returns a synthesis patch with SYNTHESIZE_PRESET_BODY', () => {
    const patch = actionDockToComposerPreset('synthesize', CLUSTER_TARGET, null);
    expect(patch).not.toBeNull();
    expect(patch!.body).toBe(SYNTHESIZE_PRESET_BODY);
    expect(patch!.argumentType).toBe('synthesis');
  });
});

describe('COMPOSER-001 — EV-002 regression: source / quote / weak_source still prefill correctly', () => {
  it('actionDockToComposerPreset("ask_source", ...) returns the EV-002 source preset', () => {
    const patch = actionDockToComposerPreset('ask_source', NODE_TARGET, 'claim');
    expect(patch).not.toBeNull();
    expect(patch!.body).toBe(ASK_SOURCE_PRESET_BODY);
    expect(patch!.argumentType).toBe('clarification_request');
    expect(patch!.suggestedTagCodes).toContain('source_request');
  });

  it('actionDockToComposerPreset("ask_quote", ...) returns the EV-002 quote preset', () => {
    const patch = actionDockToComposerPreset('ask_quote', NODE_TARGET, 'claim');
    expect(patch).not.toBeNull();
    expect(patch!.body).toBe(ASK_QUOTE_PRESET_BODY);
    expect(patch!.argumentType).toBe('clarification_request');
    expect(patch!.suggestedTagCodes).toContain('quote_request');
  });

  it('quickActionToPreset("weak_source", ...) still returns the stronger-source patch', () => {
    // weak_source is still dispatched via the popover quick-action path —
    // SC-004's `ask_source` dock action covers the "ask for any source"
    // case, and `weak_source` covers the "ask for a stronger / primary"
    // case. Regression-asserting the EV-002 contract verbatim.
    const patch = quickActionToPreset('weak_source', 'claim');
    expect(patch).not.toBeNull();
    expect(patch!.body).toBe(ASK_STRONGER_SOURCE_PRESET_BODY);
    expect(patch!.argumentType).toBe('clarification_request');
    expect(patch!.suggestedTagCodes).toContain('source_chain_weak');
  });
});

describe('COMPOSER-001 — non-preset actions still return null (no auto-fill body)', () => {
  it('reply produces no preset (composer opens without a forced type or body)', () => {
    expect(actionDockToComposerPreset('reply', NODE_TARGET, 'claim')).toBeNull();
  });

  it('branch produces no preset (branch flow opens its own UI)', () => {
    expect(actionDockToComposerPreset('branch', NODE_TARGET, 'claim')).toBeNull();
  });

  it('flag produces no preset (existing moderation flow)', () => {
    expect(actionDockToComposerPreset('flag', NODE_TARGET, 'claim')).toBeNull();
  });

  it('mark_moved_on produces no preset (manual-tag dispatch, not a post)', () => {
    expect(actionDockToComposerPreset('mark_moved_on', NODE_TARGET, 'claim')).toBeNull();
  });

  it('mark_ignored produces no preset (manual-tag dispatch, not a post)', () => {
    expect(actionDockToComposerPreset('mark_ignored', NODE_TARGET, 'claim')).toBeNull();
  });

  it('open_cards_detail produces no preset (surface toggle)', () => {
    expect(actionDockToComposerPreset('open_cards_detail', NODE_TARGET, 'claim')).toBeNull();
  });

  it('expand_branch produces no preset (BR-001 collapsed-stub toggle)', () => {
    expect(actionDockToComposerPreset('expand_branch', NODE_TARGET, 'claim')).toBeNull();
  });
});

describe('COMPOSER-001 — ArgumentGameSurface source-scan: dock dispatch threads the preset through handleAction', () => {
  it('handleActionDockAction computes the preset via actionDockToComposerPreset(action, target, parentType)', () => {
    expect(GAME_SURFACE_SRC.includes('actionDockToComposerPreset(action, target, parentType)')).toBe(true);
  });

  it('the dock dispatch passes the preset as the third argument to handleAction for narrow/confirm/synthesize', () => {
    // The fall-through path (narrow / concede / confirm / synthesize /
    // clarify / add_evidence) dispatches through reply with the preset
    // threaded into the third argument.
    expect(GAME_SURFACE_SRC.includes("handleAction('reply', targetMessageId, preset)")).toBe(true);
  });

  it('reply and branch dock actions pass null (no auto-fill body) to handleAction', () => {
    expect(GAME_SURFACE_SRC.includes("handleAction('reply', targetMessageId, null)")).toBe(true);
    expect(GAME_SURFACE_SRC.includes("handleAction('branch', targetMessageId, null)")).toBe(true);
  });

  it('challenge / ask_source / ask_quote pass the resolved preset to handleAction', () => {
    expect(GAME_SURFACE_SRC.includes("handleAction('disagree', targetMessageId, preset)")).toBe(true);
    expect(GAME_SURFACE_SRC.includes("handleAction('ask_for_source', targetMessageId, preset)")).toBe(true);
    expect(GAME_SURFACE_SRC.includes("handleAction('ask_for_quote', targetMessageId, preset)")).toBe(true);
  });

  it('the onAction prop accepts an optional third preset argument', () => {
    // Loose multiline regex — the prop is documented and exported with the
    // optional third argument.
    expect(GAME_SURFACE_SRC).toMatch(/onAction\?:\s*\(\s*\n[\s\S]*?control:\s*ArgumentBubbleControl,[\s\S]*?messageId:\s*string,[\s\S]*?preset\?:\s*MoveDraftPatch\s*\|\s*null,?\s*\n\s*\)/);
  });

  it('handleAction forwards the preset to onAction', () => {
    expect(GAME_SURFACE_SRC.includes('onAction?.(control, messageId, preset)')).toBe(true);
  });
});

describe('COMPOSER-001 — ArgumentTreeScreen source-scan: explicitPreset is preferred over the recomputed EV-002 preset', () => {
  it('handleAction accepts the optional explicitPreset argument', () => {
    expect(TREE_SCREEN_SRC).toMatch(/explicitPreset\?:\s*MoveDraftPatch\s*\|\s*null/);
  });

  it('the dispatch prefers explicitPreset !== undefined over the local quickActionToPreset call', () => {
    expect(TREE_SCREEN_SRC.includes('explicitPreset !== undefined')).toBe(true);
    expect(TREE_SCREEN_SRC.includes('? explicitPreset')).toBe(true);
  });

  it('EV-002 fallback still runs: quickActionToPreset is invoked when no explicitPreset is supplied', () => {
    // The (() => { ... presetLabel = ... ; return quickActionToPreset(...) })()
    // arrow is the EV-002 regression path. Confirm it's still present.
    expect(TREE_SCREEN_SRC.includes('quickActionToPreset(presetLabel, arg.argumentType)')).toBe(true);
    expect(TREE_SCREEN_SRC).toMatch(/presetLabel\s*=\s*\n[\s\S]*?control === 'disagree' \? 'challenge'[\s\S]*?control === 'ask_for_source' \? 'source'[\s\S]*?control === 'ask_for_quote' \? 'quote'/);
  });

  it('the preset is pushed to onComposerPreset BEFORE onReply (so the composer applies it on mount)', () => {
    // Two sequential calls in the same conditional: onComposerPreset(preset)
    // then onReply(messageId, arg).
    const reIdx = TREE_SCREEN_SRC.indexOf('onComposerPreset(preset)');
    const replyIdx = TREE_SCREEN_SRC.indexOf('onReply(messageId, arg)');
    expect(reIdx).toBeGreaterThan(-1);
    expect(replyIdx).toBeGreaterThan(-1);
    expect(reIdx).toBeLessThan(replyIdx);
  });
});

describe('COMPOSER-001 — verdict-token guard on the three SC-004 preset bodies (regression)', () => {
  // SC-004's doctrine tests already lock the preset-body content; this is a
  // tight regression check so COMPOSER-001's wiring layer can't silently
  // depend on a mutated body.
  const BANNED = [
    'winner', 'loser', 'true', 'false', 'liar', 'dishonest',
    'bad faith', 'manipulative', 'forbid', 'disallow',
    'block', 'prevent', 'reject', 'denied',
  ];
  const BODIES = [NARROW_PRESET_BODY, CONFIRM_PRESET_BODY, SYNTHESIZE_PRESET_BODY];

  for (const body of BODIES) {
    for (const token of BANNED) {
      it(`preset body does not contain banned token "${token}"`, () => {
        expect(body.toLowerCase()).not.toContain(token);
      });
    }
  }
});
