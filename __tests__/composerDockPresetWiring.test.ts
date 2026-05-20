/**
 * COMPOSER-002 — Preset wiring survives the dock (COMPOSER-001 regression).
 *
 * The SC-004 → composer preset round trip must be byte-identical after
 * the composer moves into the dock. The only thing COMPOSER-002 changes
 * is the *destination* of `composerOpen` (a dock toggle, not a screen
 * swap). The patch itself — `quickActionToPreset` / `actionDockToComposerPreset`
 * output — flows unchanged through `composerPreset` → the dock's
 * `initialPatch` → `<ArgumentComposer mode="dock" initialPatch=...>`.
 *
 * Pure-helper assertions (the preset mapping) + source-scan assertions
 * (the wiring), matching this repo's component-test discipline.
 */
import fs from 'fs';
import path from 'path';
import {
  quickActionToPreset,
  NARROW_PRESET_BODY,
  CONFIRM_PRESET_BODY,
  SYNTHESIZE_PRESET_BODY,
} from '../src/features/arguments/quickActionPresets';
import {
  actionDockToComposerPreset,
  type TimelineNodeActionDockTarget,
} from '../src/features/arguments/timelineNodeActionDockModel';
import {
  ASK_SOURCE_PRESET_BODY,
  ASK_QUOTE_PRESET_BODY,
} from '../src/features/evidence/sourceChainPresetCopy';

const ROOT = path.join(__dirname, '..');
const APP_SRC = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
const DOCK_SRC = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'arguments', 'ArgumentComposerDock.tsx'),
  'utf8',
);

const NODE_TARGET: TimelineNodeActionDockTarget = { kind: 'node', messageId: 'm-1' };
const CLUSTER_TARGET: TimelineNodeActionDockTarget = {
  kind: 'cluster',
  branchRootMessageId: 'm-root',
};

// ── 1. App.tsx still owns composerPreset and threads it to the dock ──

describe('COMPOSER-002 — App.tsx threads composerPreset into the dock', () => {
  it('the composerPreset state is unchanged', () => {
    expect(APP_SRC).toMatch(/const \[composerPreset, setComposerPreset\] = useState<MoveDraftPatch \| null>/);
  });

  it('the dock receives composerPreset as initialPatch', () => {
    expect(APP_SRC).toMatch(/<ArgumentComposerDock[\s\S]*?initialPatch=\{composerPreset\}/);
  });

  it('handleComposerClose still resets composerPreset (next open starts fresh)', () => {
    const block = APP_SRC.slice(
      APP_SRC.indexOf('handleComposerClose = ()'),
      APP_SRC.indexOf('handleComposerClose = ()') + 200,
    );
    expect(block).toMatch(/setComposerPreset\(null\)/);
  });

  it('handleSubmitSuccess still resets composerPreset and refreshes the room', () => {
    const block = APP_SRC.slice(
      APP_SRC.indexOf('handleSubmitSuccess = ()'),
      APP_SRC.indexOf('handleSubmitSuccess = ()') + 240,
    );
    expect(block).toMatch(/setComposerPreset\(null\)/);
    expect(block).toMatch(/refreshTreeRef\.current\?\.\(\)/);
  });

  it('onComposerPreset is still wired into ArgumentTreeScreen (preset emission unchanged)', () => {
    expect(APP_SRC).toMatch(/onComposerPreset=\{setComposerPreset\}/);
  });
});

// ── 2. The dock forwards the preset into ArgumentComposer ───────
//
// RULE-005 merges the structured-channel patch onto the caller's
// `initialPatch` before forwarding it. The dock now passes the merged
// `composerInitialPatch` (which equals `initialPatch ?? null` when no
// channel is selected, so the COMPOSER-001 preset still flows unchanged).

describe('COMPOSER-002 / RULE-005 — the dock forwards the preset to ArgumentComposer', () => {
  it('the dock declares an initialPatch prop', () => {
    expect(DOCK_SRC).toMatch(/initialPatch\?:\s*MoveDraftPatch\s*\|\s*null/);
  });

  it('the dock passes the merged composerInitialPatch into <ArgumentComposer initialPatch=...>', () => {
    const composerBlock = DOCK_SRC.slice(DOCK_SRC.indexOf('<ArgumentComposer'));
    expect(composerBlock).toMatch(/initialPatch=\{composerInitialPatch\}/);
  });

  it('composerInitialPatch falls back to the caller initialPatch when no channel is picked', () => {
    // The RULE-005 merge preserves the COMPOSER-001 preset round trip:
    // with no channel selected the merged patch is `initialPatch ?? null`.
    expect(DOCK_SRC).toMatch(/if \(selectedChannel === null\) return initialPatch \?\? null;/);
  });
});

// ── 3. COMPOSER-001 preset mapping regression — every action ───

describe('COMPOSER-002 — COMPOSER-001 preset mapping still produces the right patch', () => {
  it('narrow → concession + narrow_scope + NARROW_PRESET_BODY', () => {
    const patch = actionDockToComposerPreset('narrow', NODE_TARGET, null);
    expect(patch).not.toBeNull();
    expect(patch!.argumentType).toBe('concession');
    expect(patch!.suggestedTagCodes).toContain('narrow_scope');
    expect(patch!.body).toBe(NARROW_PRESET_BODY);
  });

  it('confirm → body-only patch with CONFIRM_PRESET_BODY (no forced type)', () => {
    const patch = actionDockToComposerPreset('confirm', NODE_TARGET, null);
    expect(patch).not.toBeNull();
    expect(patch!.body).toBe(CONFIRM_PRESET_BODY);
    expect(patch!.argumentType).toBeUndefined();
  });

  it('synthesize → synthesis + SYNTHESIZE_PRESET_BODY', () => {
    const patch = actionDockToComposerPreset('synthesize', CLUSTER_TARGET, null);
    expect(patch).not.toBeNull();
    expect(patch!.argumentType).toBe('synthesis');
    expect(patch!.body).toBe(SYNTHESIZE_PRESET_BODY);
  });

  it('ask_source → clarification_request + source_request + EV-002 body', () => {
    const patch = actionDockToComposerPreset('ask_source', NODE_TARGET, 'claim');
    expect(patch).not.toBeNull();
    expect(patch!.argumentType).toBe('clarification_request');
    expect(patch!.suggestedTagCodes).toContain('source_request');
    expect(patch!.body).toBe(ASK_SOURCE_PRESET_BODY);
  });

  it('ask_quote → clarification_request + quote_request + EV-002 body', () => {
    const patch = actionDockToComposerPreset('ask_quote', NODE_TARGET, 'claim');
    expect(patch).not.toBeNull();
    expect(patch!.argumentType).toBe('clarification_request');
    expect(patch!.suggestedTagCodes).toContain('quote_request');
    expect(patch!.body).toBe(ASK_QUOTE_PRESET_BODY);
  });

  it('challenge → rebuttal patch (counter_rebuttal when parent is a rebuttal)', () => {
    expect(quickActionToPreset('challenge', null)!.argumentType).toBe('rebuttal');
    expect(quickActionToPreset('challenge', 'rebuttal')!.argumentType).toBe('counter_rebuttal');
  });

  it('clarify → clarification_request', () => {
    expect(quickActionToPreset('clarify', 'claim')!.argumentType).toBe('clarification_request');
  });

  it('evidence → evidence type (composer auto-expands evidence fields)', () => {
    expect(quickActionToPreset('evidence', 'claim')!.argumentType).toBe('evidence');
  });

  it('concede → concession', () => {
    expect(quickActionToPreset('concede', 'claim')!.argumentType).toBe('concession');
  });

  it('reply → no preset (the dock opens without a forced type or body)', () => {
    expect(actionDockToComposerPreset('reply', NODE_TARGET, 'claim')).toBeNull();
  });

  it('branch → no preset (branch flow opens its own UI)', () => {
    expect(actionDockToComposerPreset('branch', NODE_TARGET, 'claim')).toBeNull();
  });
});

// ── 4. The composer applies the patch exactly once (appliedPatchRef) ──

describe('COMPOSER-002 — the apply-once guard is unchanged', () => {
  it('ArgumentComposer still keys preset application on appliedPatchRef', () => {
    const composerSrc = fs.readFileSync(
      path.join(ROOT, 'src', 'features', 'arguments', 'ArgumentComposer.tsx'),
      'utf8',
    );
    // A re-render with the same patch object must not re-apply — the dock
    // does not change this contract.
    expect(composerSrc).toMatch(/appliedPatchRef/);
    expect(composerSrc).toMatch(/initialPatch === appliedPatchRef\.current/);
  });
});
