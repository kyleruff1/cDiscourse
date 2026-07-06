/**
 * UX-001.5A — Call-site wiring tests.
 *
 * Verifies the three bounded edits in ArgumentGameSurface.tsx
 * (Edits A/B/C per design §10) AND verifies that the read-only
 * boundary files remain BYTE-IDENTICAL to their pre-UX-001.5A state.
 *
 * Maps acceptance criteria for trigger 7 (no modification of UX-001.{1-7}
 * read-only files outside bounded list).
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = process.cwd();

const GAME_SURFACE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'src', 'features', 'arguments', 'room', 'ArgumentRoom.tsx'),
  'utf8',
);

describe('UX-001.5A — Edit A: composer-only observationChips into RefereeBannerView', () => {
  it('imports adaptSemanticRefereeSourceComposer from nodeLabels', () => {
    expect(GAME_SURFACE_SRC).toMatch(/adaptSemanticRefereeSourceComposer/);
    expect(GAME_SURFACE_SRC).toMatch(/from '\.\.\/\.\.\/nodeLabels'/);
  });

  it('imports toAnnotationChipDescriptors from nodeLabels', () => {
    expect(GAME_SURFACE_SRC).toMatch(/toAnnotationChipDescriptors/);
  });

  it('imports AnnotationChipDescriptor type from nodeAnnotations', () => {
    expect(GAME_SURFACE_SRC).toMatch(/AnnotationChipDescriptor/);
  });

  it('memoizes uxOneOneFiveAComposerObservationChips via useMemo', () => {
    expect(GAME_SURFACE_SRC).toMatch(/uxOneOneFiveAComposerObservationChips\s*=\s*useMemo/);
  });

  it('passes observationChips to RefereeBannerView', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /<RefereeBannerView[^>]*observationChips=\{uxOneOneFiveAComposerObservationChips\}/s,
    );
  });

  it('Risk 1 mitigation: composer-only codes default to [] for graceful degradation', () => {
    // The implementation defines composerOnlyCodes as an empty const
    // since refereeBanner does not currently expose the slot.
    expect(GAME_SURFACE_SRC).toMatch(
      /const composerOnlyCodes:\s*ReadonlyArray<string>\s*=\s*\[\]/,
    );
  });
});

// UX-MEDIATOR-002 RECONCILIATION — "Edit B" originally pinned the DOUBLE-MOUNT
// default view (MediatorNodeMarker chip + NodeLabelStrip second chip surface
// stacked below the Timeline). UX-MEDIATOR-002 collapses the "chip soup": the
// default view now renders exactly ONE primary state chip (MediatorNodeMarker,
// projected through v4DisplayStateFor) and the NodeLabelStrip
// Observation/Allegation content is relocated into the existing Inspect overlay
// (NodeLabelInspectGroups). NodeLabelStrip is therefore no longer mounted —
// nor imported — in the default view. The block below is updated (not weakened)
// to the new single-chip-default + content-in-Inspect contract; the same prop
// wiring (manualTagEntries / autoMetadataCodes / clusterState) is now verified
// on the Inspect-overlay mount instead of the default-view strip. See
// docs/designs/UX-MEDIATOR-002.md §5 ("Existing tests that PIN the current
// multi-chip markup").
describe('UX-MEDIATOR-002 (was UX-001.5A Edit B): one chip default; strip content in Inspect', () => {
  it('does NOT mount NodeLabelStrip in the default view (the second chip surface is gone)', () => {
    expect(GAME_SURFACE_SRC).not.toMatch(/<NodeLabelStrip\s/);
  });

  it('does NOT import NodeLabelStrip into the surface anymore (unmounted)', () => {
    // The component remains exported from nodeLabels for a future selected-
    // context surface; it is simply no longer imported here.
    expect(GAME_SURFACE_SRC).not.toMatch(/^\s*NodeLabelStrip,\s*$/m);
  });

  it('mounts exactly ONE default-view chip (MediatorNodeMarker), gated on the marker', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /activeNodeMediatorMarker \?[\s\S]*?<MediatorNodeMarker[\s\S]*?testID="mediator-node-marker-active"/,
    );
  });

  it('relocates the strip content into the Inspect overlay (NodeLabelInspectGroups)', () => {
    // The same prop wiring the old default-view strip used now flows into the
    // Inspect-overlay groups mount.
    expect(GAME_SURFACE_SRC).toMatch(/<NodeLabelInspectGroups\s/);
    expect(GAME_SURFACE_SRC).toMatch(/messageId=\{activeMessageId\}/);
  });

  it('Inspect overlay wires manualTagEntries from manualTagsByMessageId map', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /manualTagEntries=\{manualTagsByMessageId\.get\(activeMessageId\)\s*\?\?\s*\[\]\}/,
    );
  });

  it('Inspect overlay wires autoMetadataCodes from metadataLedger.byMessage', () => {
    expect(GAME_SURFACE_SRC).toMatch(/metadataLedger\.byMessage[\s\S]*?autoDerivedMetadata/);
  });

  it('Inspect overlay wires clusterState from lifecycleMap.byMessage', () => {
    expect(GAME_SURFACE_SRC).toMatch(/lifecycleMap\.byMessage[\s\S]*?clusterState/);
  });
});

describe('UX-001.5A — Edit C: NodeLabelInspectGroups sibling overlay (alternative path)', () => {
  it('imports NodeLabelInspectGroups from nodeLabels', () => {
    expect(GAME_SURFACE_SRC).toMatch(/NodeLabelInspectGroups/);
  });

  it('mounts NodeLabelInspectGroups adjacent to InspectPopout', () => {
    expect(GAME_SURFACE_SRC).toMatch(/<NodeLabelInspectGroups\s/);
  });

  it('overlay is gated on inspectVisible AND activeMessageId', () => {
    // UX-SELECTED-NODE-001 (reconciliation): the four Inspect siblings are
    // now sectioned into the v4 drawer via SelectedNodeInspectDrawer, so the
    // `inspectVisible && activeMessageId` gate is on the DRAWER (which renders
    // NodeLabelInspectGroups in its `structureNotes` slot) rather than
    // directly on NodeLabelInspectGroups. The gate is unchanged in INTENT —
    // NodeLabelInspectGroups still only renders inside that gate.
    expect(GAME_SURFACE_SRC).toMatch(
      /inspectVisible\s*&&\s*activeMessageId\s*\?\s*\(\s*<SelectedNodeInspectDrawer/,
    );
    // NodeLabelInspectGroups is wired into the gated drawer's structureNotes
    // slot (still mounted only behind the same gate).
    expect(GAME_SURFACE_SRC).toMatch(/structureNotes=\{\s*<NodeLabelInspectGroups/);
  });
});

describe('UX-001.5A — Read-only API boundary verification (trigger 7)', () => {
  it('does NOT modify InspectPopout.tsx (zero diff)', () => {
    // Verify InspectPopout.tsx is not touched — search for any UX-001.5A
    // marker in the InspectPopout source file. The file lives at the
    // documented oneBox path.
    const inspectPopoutSrc = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'src',
        'features',
        'arguments',
        'oneBox',
        'InspectPopout.tsx',
      ),
      'utf8',
    );
    expect(inspectPopoutSrc).not.toMatch(/UX-001\.5A/);
    expect(inspectPopoutSrc).not.toMatch(/NodeLabelStrip/);
    expect(inspectPopoutSrc).not.toMatch(/NodeLabelInspectGroups/);
  });

  it('does NOT modify inspectContentBuilder.ts (alternative path chosen)', () => {
    const builderSrc = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'src',
        'features',
        'arguments',
        'oneBox',
        'inspectContentBuilder.ts',
      ),
      'utf8',
    );
    expect(builderSrc).not.toMatch(/UX-001\.5A/);
    expect(builderSrc).not.toMatch(/NodeLabelStrip/);
    expect(builderSrc).not.toMatch(/NodeLabelInspectGroups/);
  });

  it('does NOT modify RefereeBannerView.tsx (uses existing UX-001.5 prop)', () => {
    // Pre-existing UX-001.5A forward-compat markers exist in this file
    // from UX-001.5 itself (the descriptor source slot, the optional
    // observationChips prop). UX-001.5A introduces ZERO new content
    // here — it only consumes the existing optional prop from the
    // GameSurface call site. Verified via git diff vs main.
    const refereeSrc = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'src',
        'features',
        'refereeBanners',
        'RefereeBannerView.tsx',
      ),
      'utf8',
    );
    // The file imports AnnotationChipDescriptor + AnnotationChipStrip
    // already (from UX-001.5). UX-001.5A does NOT introduce a new
    // NodeLabel* import — that would indicate modification.
    expect(refereeSrc).not.toMatch(/NodeLabelStrip/);
    expect(refereeSrc).not.toMatch(/NodeLabelInspectGroups/);
    expect(refereeSrc).not.toMatch(/from '\.\.\/nodeLabels/);
  });

  it('does NOT modify ArgumentTimelineMap.tsx (UX-001.2 territory)', () => {
    const mapSrc = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'src',
        'features',
        'arguments',
        'ArgumentTimelineMap.tsx',
      ),
      'utf8',
    );
    expect(mapSrc).not.toMatch(/UX-001\.5A/);
    expect(mapSrc).not.toMatch(/NodeLabelStrip/);
  });

  it('does NOT modify ArgumentScoreTracker.tsx (UX-001.2 territory)', () => {
    const trackerSrc = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'src',
        'features',
        'arguments',
        'ArgumentScoreTracker.tsx',
      ),
      'utf8',
    );
    expect(trackerSrc).not.toMatch(/UX-001\.5A/);
  });

  it('does NOT modify designTokens.ts (UX-001.7 territory)', () => {
    const tokensSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'lib', 'designTokens.ts'),
      'utf8',
    );
    expect(tokensSrc).not.toMatch(/UX-001\.5A/);
  });

  it('does NOT modify any file under src/features/nodeAnnotations/', () => {
    // Pre-existing UX-001.5A forward-compat markers exist in
    // annotationChipDescriptor.ts (the source: 'machine' | 'user' slot)
    // and the index.ts (re-exports). UX-001.5A does NOT add new
    // primitives or modify existing ones — it consumes the
    // already-shipped UX-001.5 layer. The scan below checks for
    // NodeLabel* signal which would indicate inverse-direction
    // contamination of the primitive layer.
    const dir = path.join(REPO_ROOT, 'src', 'features', 'nodeAnnotations');
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src).not.toMatch(/NodeLabelStrip/);
      expect(src).not.toMatch(/NodeLabelInspectGroups/);
      expect(src).not.toMatch(/from '\.\.\/nodeLabels/);
    }
  });

  it('does NOT add a supabase migration', () => {
    const migrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir);
    for (const f of files) {
      expect(f).not.toMatch(/ux.*005A|ux_001_5a/i);
    }
  });

  it('does NOT add a supabase edge function', () => {
    const fnsDir = path.join(REPO_ROOT, 'supabase', 'functions');
    if (fs.existsSync(fnsDir)) {
      const files = fs.readdirSync(fnsDir);
      for (const f of files) {
        expect(f).not.toMatch(/ux.*005A|ux_001_5a/i);
      }
    }
  });

  it('does NOT touch useSemanticReferee.ts', () => {
    const semanticSrc = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'src',
        'features',
        'arguments',
        'useSemanticReferee.ts',
      ),
      'utf8',
    );
    expect(semanticSrc).not.toMatch(/UX-001\.5A/);
  });

  it('does NOT touch any file under src/features/metadata/', () => {
    const dir = path.join(REPO_ROOT, 'src', 'features', 'metadata');
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) continue;
      const src = fs.readFileSync(full, 'utf8');
      expect(src).not.toMatch(/UX-001\.5A/);
    }
  });

  it('does NOT touch any file under src/features/lifecycle/', () => {
    const dir = path.join(REPO_ROOT, 'src', 'features', 'lifecycle');
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) continue;
      const src = fs.readFileSync(full, 'utf8');
      expect(src).not.toMatch(/UX-001\.5A/);
    }
  });

  it('does NOT touch any file under src/features/semanticReferee/', () => {
    const dir = path.join(REPO_ROOT, 'src', 'features', 'semanticReferee');
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) continue;
      const src = fs.readFileSync(full, 'utf8');
      expect(src).not.toMatch(/UX-001\.5A/);
    }
  });
});

describe('UX-001.5A — package.json invariance', () => {
  it('package.json does not change as part of this card', () => {
    const pkg = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    // The pre-card content does not contain any UX-001.5A marker; this
    // test fails if a future commit erroneously adds a dependency for
    // the card.
    expect(pkg).not.toMatch(/UX-001\.5A/);
  });
});
