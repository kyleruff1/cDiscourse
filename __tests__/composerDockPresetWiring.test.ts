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

  it('onComposerPreset is wired into ArgumentTreeScreen through the seed-if-empty guard (UX-FLAGS-004 Decision 8)', () => {
    // The raw setComposerPreset is wrapped by handleComposerPreset so no seeded
    // preset overwrites a mid-typed draft. Preset emission is preserved: on the
    // empty-draft path (the common case) the guard calls setComposerPreset with
    // the full preset, so the COMPOSER-001 round trip still holds.
    expect(APP_SRC).toMatch(/onComposerPreset=\{handleComposerPreset\}/);
    const block = APP_SRC.slice(
      APP_SRC.indexOf('handleComposerPreset = ('),
      APP_SRC.indexOf('handleComposerPreset = (') + 400,
    );
    expect(block).toMatch(/setComposerPreset\(/);
  });
});

// ── 2. The dock forwards the preset into the OneBox ─────────────
//
// QOL-030 refactor: the dock now hosts `OneBox`. The RULE-005 channel
// chip row folded into the OneBox's Act popout, so the dock no longer
// merges a channel patch — it folds only the RULE-004
// advisory-transformation patch onto the caller's `initialPatch` and
// passes the result (`oneBoxInitialPatch`) to `<OneBox>`. When no
// transformation is pending the merged patch is still `initialPatch ??
// null`, so the COMPOSER-001 preset round trip is unchanged.

describe('COMPOSER-002 / QOL-030 — the dock forwards the preset to the OneBox', () => {
  it('the dock declares an initialPatch prop', () => {
    expect(DOCK_SRC).toMatch(/initialPatch\?:\s*MoveDraftPatch\s*\|\s*null/);
  });

  it('the dock passes the merged oneBoxInitialPatch into <OneBox initialPatch=...>', () => {
    const oneBoxBlock = DOCK_SRC.slice(DOCK_SRC.indexOf('<OneBox'));
    expect(oneBoxBlock).toMatch(/initialPatch=\{oneBoxInitialPatch\}/);
  });

  it('oneBoxInitialPatch falls back to the caller initialPatch when nothing is merged', () => {
    // When no RULE-004 transformation is pending the merged patch is
    // still `initialPatch ?? null` (COMPOSER-001 round trip preserved).
    expect(DOCK_SRC).toMatch(
      /if \(transformationPatch === null\) return initialPatch \?\? null;/,
    );
  });

  it('the OneBox forwards the merged patch to the hosted ArgumentComposer', () => {
    // The post path is unchanged — one layer deeper. The OneBox merges
    // its flash-menu type patch onto the caller patch and hands the
    // result to the composer.
    const oneBoxSrc = fs.readFileSync(
      path.join(ROOT, 'src', 'features', 'arguments', 'oneBox', 'OneBox.tsx'),
      'utf8',
    );
    const composerBlock = oneBoxSrc.slice(oneBoxSrc.indexOf('<ArgumentComposer'));
    expect(composerBlock).toMatch(/initialPatch=\{composerInitialPatch\}/);
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
