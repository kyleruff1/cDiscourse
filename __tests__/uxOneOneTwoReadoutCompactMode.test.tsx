/**
 * UX-001.2 — TimelineSelectedReadoutPanel compact mode (Q12 cat 5
 * additions).
 *
 * Source-scan + light structural verification that the panel accepts a
 * `compact?: boolean` prop, renders a 5-line summary in compact mode,
 * exposes a `Show full details` expand trigger, and renders the full
 * sidecar inline when expanded. Back-compat (no prop) renders the
 * legacy IX-004 6-section sidecar.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const PANEL_SRC = read('src/features/arguments/TimelineSelectedReadoutPanel.tsx');

describe('UX-001.2 — TimelineSelectedReadoutPanel.compact prop', () => {
  it('the Props interface accepts an optional compact boolean', () => {
    expect(PANEL_SRC).toMatch(/compact\?\:\s*boolean/);
  });

  it('the compact path renders a 5-line summary host testID', () => {
    expect(PANEL_SRC).toContain('testID="timeline-readout-compact"');
  });

  it('the compact summary uses kind / body / parent / meta / acting lines', () => {
    expect(PANEL_SRC).toMatch(/style=\{styles\.kindLine\}/);
    expect(PANEL_SRC).toMatch(/style=\{styles\.bodyLine\}/);
    expect(PANEL_SRC).toMatch(/style=\{styles\.parentLine\}/);
    expect(PANEL_SRC).toMatch(/style=\{styles\.metaLine\}/);
    expect(PANEL_SRC).toMatch(/style=\{styles\.actingLine\}/);
  });

  it('the body line uses numberOfLines={1} + ellipsizeMode="tail"', () => {
    // The body excerpt is single-line truncated so the compact summary
    // honours the 68/76/88 height cap per band.
    expect(PANEL_SRC).toMatch(
      /style=\{styles\.bodyLine\}\s+numberOfLines=\{1\}\s+ellipsizeMode="tail"/,
    );
  });

  it('the expand trigger is a Pressable with accessibilityRole="button"', () => {
    expect(PANEL_SRC).toContain('testID="timeline-readout-expand-trigger"');
    expect(PANEL_SRC).toMatch(/accessibilityLabel=\{expanded \? 'Hide full details' : 'Show full details'\}/);
    expect(PANEL_SRC).toMatch(/accessibilityState=\{\{\s*expanded\s*\}\}/);
  });

  it('the expanded host caps at ~30% of viewport height', () => {
    // `maxHeight: Math.max(160, Math.round(viewportHeight * 0.3))` —
    // the brief allows up to 30% on expand. The floor of 160 ensures the
    // sidecar renders something useful on very short viewports.
    expect(PANEL_SRC).toMatch(/maxHeight:\s*Math\.max\(160,\s*Math\.round\(viewportHeight\s*\*\s*0\.3\)\)/);
  });

  it('expanded state renders the full ArgumentReplySidecar inline', () => {
    expect(PANEL_SRC).toMatch(
      /<View\s+style=\{\[styles\.expandedHost,[\s\S]*?<ArgumentReplySidecar viewModel=\{viewModel\.sidecar\}\s*\/>/,
    );
  });
});

describe('UX-001.2 — IX-004 contract preserved in compact mode', () => {
  it('the accessibilityLiveRegion="polite" host still emits announcements', () => {
    expect(PANEL_SRC).toMatch(/accessibilityLiveRegion="polite"/);
  });

  it('the stale notice path is preserved', () => {
    expect(PANEL_SRC).toContain('testID="timeline-readout-stale-banner"');
    expect(PANEL_SRC).toMatch(/viewModel\.staleNotice/);
  });

  it('the announceForAccessibility effect keyed on selectedMessageId still fires on native', () => {
    expect(PANEL_SRC).toMatch(/AccessibilityInfo\.announceForAccessibility/);
    expect(PANEL_SRC).toMatch(/viewModel\.selectedMessageId/);
  });

  it('back-compat: compact === undefined / false renders the legacy 6-section sidecar', () => {
    // The non-compact branch still renders the reply count + the full
    // sidecar inline (legacy IX-004 mount path).
    expect(PANEL_SRC).toContain('testID="timeline-readout-reply-count"');
    expect(PANEL_SRC).toMatch(/<ArgumentReplySidecar viewModel=\{viewModel\.sidecar\}\s*\/>/);
  });
});

describe('UX-001.2 — Selection change resets the expand state', () => {
  it('useEffect keyed on selectedMessageId resets expanded to false', () => {
    expect(PANEL_SRC).toMatch(/setExpanded\(false\)/);
    expect(PANEL_SRC).toMatch(/lastSelectionRef\.current\s*!==\s*viewModel\.selectedMessageId/);
  });
});

describe('UX-001.2 — panel layout (marginTop replaces marginBottom)', () => {
  it('the panel sits BELOW the Timeline, so marginTop spaces it from the rail', () => {
    expect(PANEL_SRC).toMatch(/panel:\s*\{[\s\S]*?marginTop:\s*8/);
    // The old `marginBottom: 8` for sitting above the timeline is gone.
    expect(PANEL_SRC).not.toMatch(/panel:\s*\{[\s\S]*?marginBottom:\s*8/);
  });
});
