/**
 * UX-001.2 — Chrome layer removals (Q12 cat 4).
 *
 * Source-scan verification that the 11 superseded prior aesthetic
 * placements named in the brief have been collapsed, relocated, or
 * nullified per the design's Q2 table. Each test asserts the absence of
 * a specific token in the relevant in-scope file.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const APP_SRC = read('App.tsx');
const SURFACE_SRC = read('src/features/arguments/ArgumentGameSurface.tsx');
const TIMELINE_MAP_SRC = read('src/features/arguments/ArgumentTimelineMap.tsx');

describe('UX-001.2 — App.tsx roomToolbar is dissolved', () => {
  it('App.tsx contains no styles.roomToolbar JSX', () => {
    expect(APP_SRC).not.toMatch(/<View style=\{styles\.roomToolbar\}/);
  });

  it('App.tsx contains no roomToolbar style entry', () => {
    expect(APP_SRC).not.toMatch(/^\s*roomToolbar:\s*\{/m);
  });

  it('App.tsx contains no roomToolbarInner style entry', () => {
    expect(APP_SRC).not.toMatch(/^\s*roomToolbarInner:\s*\{/m);
  });

  it('App.tsx contains no toolbarChip style entries', () => {
    expect(APP_SRC).not.toMatch(/^\s*toolbarChip:\s*\{/m);
    expect(APP_SRC).not.toMatch(/^\s*toolbarChipActive:\s*\{/m);
    expect(APP_SRC).not.toMatch(/^\s*toolbarChipText:\s*\{/m);
    expect(APP_SRC).not.toMatch(/^\s*toolbarChipTextActive:\s*\{/m);
  });

  it('App.tsx contains no toolbarSep / roomLabel style entries', () => {
    expect(APP_SRC).not.toMatch(/^\s*toolbarSep:\s*\{/m);
    expect(APP_SRC).not.toMatch(/^\s*roomLabel:\s*\{/m);
  });

  it('App.tsx no longer imports ScrollView (the roomToolbar host)', () => {
    expect(APP_SRC).not.toMatch(/\bScrollView,?\s*\n/);
  });
});

describe('UX-001.2 — ArgumentGameSurface.header is removed', () => {
  it('the styles.header JSX block is gone', () => {
    expect(SURFACE_SRC).not.toMatch(/<View style=\{styles\.header\}/);
  });

  it('the styles.header style entry is gone', () => {
    expect(SURFACE_SRC).not.toMatch(/^\s*header:\s*\{[^}]*paddingHorizontal/m);
  });

  it('the styles.modeChip / modeChipActive / modeChipText entries are gone', () => {
    expect(SURFACE_SRC).not.toMatch(/^\s*modeChip:\s*\{/m);
    expect(SURFACE_SRC).not.toMatch(/^\s*modeChipActive:\s*\{/m);
    expect(SURFACE_SRC).not.toMatch(/^\s*modeChipText:\s*\{/m);
  });

  it('the styles.title / styles.statusRow / styles.latestStatus entries are gone', () => {
    expect(SURFACE_SRC).not.toMatch(/^\s*title:\s*\{\s*color: '#f8fafc'/m);
    expect(SURFACE_SRC).not.toMatch(/^\s*statusRow:\s*\{/m);
    expect(SURFACE_SRC).not.toMatch(/^\s*latestStatus:\s*\{/m);
  });

  it('the surface-mode-toggle testID is gone (the in-header chip is removed)', () => {
    expect(SURFACE_SRC).not.toMatch(/surface-mode-toggle/);
  });
});

describe('UX-001.2 — ArgumentTimelineMap controlsRow is restructured into an overlay', () => {
  it('the controlsRow style entry is gone', () => {
    expect(TIMELINE_MAP_SRC).not.toMatch(/^\s*controlsRow:\s*\{/m);
  });

  it('the styles.controlsRow JSX block is gone', () => {
    expect(TIMELINE_MAP_SRC).not.toMatch(/<View style=\{styles\.controlsRow\}/);
  });

  it('a new overlayControls style entry exists', () => {
    expect(TIMELINE_MAP_SRC).toMatch(/^\s*overlayControls:\s*\{/m);
  });

  it('the overlay container uses position: absolute + zIndex + top + right', () => {
    expect(TIMELINE_MAP_SRC).toMatch(/overlayControls:\s*\{[\s\S]*?position:\s*'absolute'/);
    expect(TIMELINE_MAP_SRC).toMatch(/overlayControls:\s*\{[\s\S]*?zIndex:\s*10/);
    expect(TIMELINE_MAP_SRC).toMatch(/overlayControls:\s*\{[\s\S]*?top:\s*4/);
    expect(TIMELINE_MAP_SRC).toMatch(/overlayControls:\s*\{[\s\S]*?right:\s*4/);
  });

  it('the five preserved testIDs are still present in the overlay', () => {
    for (const id of [
      'timeline-prev',
      'timeline-next',
      'timeline-jump-latest',
      'timeline-jump-root',
      'timeline-toggle-mode',
    ]) {
      expect(TIMELINE_MAP_SRC).toContain(`testID="${id}"`);
    }
  });

  it('the controls are rendered inside the new timeline-controls-overlay testID', () => {
    expect(TIMELINE_MAP_SRC).toMatch(/testID="timeline-controls-overlay"/);
  });
});

describe('UX-001.2 — Internal rail offset replaces the legacy 120 literal', () => {
  it('ArgumentTimelineMap no longer hardcodes top: 120 on the rail', () => {
    // The rail's `top` style is computed from BAND_RAIL_OFFSET[band], not
    // the legacy `120` literal.
    expect(TIMELINE_MAP_SRC).not.toMatch(/top:\s*120\s*\+\s*TIMELINE_NODE_SIZE/);
  });

  it('ArgumentTimelineMap reads BAND_RAIL_OFFSET from the new helper', () => {
    expect(TIMELINE_MAP_SRC).toMatch(/import\s+\{\s*BAND_RAIL_OFFSET\s*\}\s+from\s+'\.\/timelineViewportLayoutModel'/);
  });

  it('ArgumentTimelineMap uses railTopOffset in the rail top calculation', () => {
    expect(TIMELINE_MAP_SRC).toMatch(/top:\s*railTopOffset\s*\+\s*TIMELINE_NODE_SIZE\s*\/\s*2\s*-\s*1/);
  });

  it('bands overlay the rail with pointerEvents="none" and reduced opacity', () => {
    // The band <View> sets `pointerEvents` prop and `opacity` in style.
    expect(TIMELINE_MAP_SRC).toMatch(/pointerEvents="none"/);
    expect(TIMELINE_MAP_SRC).toMatch(/opacity:\s*0\.6/);
  });
});

describe('UX-001.2 — ArgumentScoreTracker mount-site moved below the Timeline', () => {
  it('the score tracker JSX renders AFTER the timeline (MapView) mount-site', () => {
    // ASP-EXTRACT-001 — the mode === timeline col1 body is now <MapView>
    // (the ArgumentTimelineMap moved inside it). The ordering constraint is
    // unchanged: the col1 timeline body still precedes col2 ScoreTracker in
    // source order.
    const trackerIdx = SURFACE_SRC.indexOf('<ArgumentScoreTracker');
    const mapIdx = SURFACE_SRC.indexOf('<MapView');
    expect(trackerIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeGreaterThan(-1);
    expect(trackerIdx).toBeGreaterThan(mapIdx);
  });

  it('the score tracker still receives the same trends prop (component unchanged)', () => {
    expect(SURFACE_SRC).toMatch(/<ArgumentScoreTracker trends=\{participantTrends\} \/>/);
  });
});

describe('UX-001.2 — TimelineSelectedReadoutPanel mount-site uses compact prop', () => {
  it('the readout panel renders below the Timeline with the compact prop', () => {
    // UX-SELECTED-NODE-001 (reconciliation): the mount now spans multiple
    // lines because it gained the read-only `onGoToParent` jump prop. The
    // viewModel + compact contract is preserved.
    expect(SURFACE_SRC).toMatch(
      /<TimelineSelectedReadoutPanel\s+viewModel=\{timelineReadoutViewModel\}\s+compact/,
    );
  });

  it('the readout panel mount-site is AFTER the timeline (MapView) mount-site', () => {
    // ASP-EXTRACT-001 — timeline body is now <MapView> (see note above).
    const panelIdx = SURFACE_SRC.indexOf('<TimelineSelectedReadoutPanel');
    const mapIdx = SURFACE_SRC.indexOf('<MapView');
    expect(panelIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeGreaterThan(-1);
    expect(panelIdx).toBeGreaterThan(mapIdx);
  });
});
