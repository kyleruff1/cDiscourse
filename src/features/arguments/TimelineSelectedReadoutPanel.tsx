/**
 * IX-004 + UX-001.2 — TimelineSelectedReadoutPanel.
 *
 * Selected-Timeline-message readout. Renders below the Timeline (UX-001.2
 * relocation; IX-004 originally placed it above), in two modes:
 *
 *   - `compact === true` (UX-001.2 default): a 5-line summary (type, body
 *     excerpt, parent hint, reply count, "acting on" target) plus an
 *     expand trigger that opens the SC-003 6-section sidecar inline. This
 *     fits the brief's per-band height envelope (68 / 76 / 88 px) and
 *     keeps the Timeline as the first substantive in-room object.
 *
 *   - `compact === false` (legacy IX-004 placement): the full SC-003
 *     6-section sidecar plus the IX-004 chrome (stale banner + reply
 *     count line). Back-compat path; tests that previously mounted the
 *     panel without the prop continue to pass.
 *
 * The IX-004 contract is preserved verbatim in BOTH modes:
 *   - Root `<View>` carries `accessibilityLabel` summarising kind +
 *     ordinal + standing band + reply count.
 *   - `accessibilityLiveRegion="polite"` host announces selection changes
 *     on web; on native, `announceForAccessibility` fires from a
 *     `useEffect` keyed on `selectedMessageId`.
 *   - The stale banner ("That message is no longer here — showing the
 *     latest move.") renders identically in both modes.
 *
 * Click feedback is content change (the panel re-renders with the new
 * subject); no animation. Reduce-motion safe.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ArgumentReplySidecar } from './ArgumentReplySidecar';
import type { TimelineSelectedReadoutViewModel } from './timelineSelectedReadoutModel';

interface Props {
  viewModel: TimelineSelectedReadoutViewModel;
  /**
   * UX-001.2 — When true (the new default mount-site below the Timeline),
   * the panel renders a 5-line summary with an expand trigger to the
   * 6-section sidecar. When false / omitted, the legacy full sidecar
   * renders (IX-004 back-compat).
   */
  compact?: boolean;
}

export function TimelineSelectedReadoutPanel({ viewModel, compact }: Props) {
  // Native-only: announce the selection change. Web uses the
  // accessibilityLiveRegion host below — gating on Platform prevents a
  // double-announcement on web (RN-web reads the live region itself).
  const lastAnnouncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const key = viewModel.selectedMessageId ?? '__empty__';
    if (lastAnnouncedRef.current === key) return;
    lastAnnouncedRef.current = key;
    try {
      AccessibilityInfo.announceForAccessibility(
        viewModel.accessibilitySelectionAnnouncement,
      );
    } catch {
      // Some platforms (web shim, jest) lack this API — swallow.
    }
  }, [viewModel.selectedMessageId, viewModel.accessibilitySelectionAnnouncement]);

  const [expanded, setExpanded] = useState(false);
  const { height: viewportHeight } = useWindowDimensions();

  // Reset expanded state when selection changes (the new subject's compact
  // summary is the loud confirmation; a sticky expand on the prior subject
  // would be a stale signal).
  const lastSelectionRef = useRef<string | null>(viewModel.selectedMessageId);
  useEffect(() => {
    if (lastSelectionRef.current !== viewModel.selectedMessageId) {
      lastSelectionRef.current = viewModel.selectedMessageId;
      setExpanded(false);
    }
  }, [viewModel.selectedMessageId]);

  // Whether to render the compact summary. compact defaults to false so
  // existing callers continue to get the legacy panel.
  const renderCompact = compact === true;

  // Compact summary fields, drawn from the SC-003 view-model.
  const whatSection = viewModel.sidecar.sections.find(
    (s) => s.kind === 'what_this_move_says',
  );
  const whereSection = viewModel.sidecar.sections.find(
    (s) => s.kind === 'where_it_sits',
  );
  const kindLine =
    whatSection && whatSection.kind === 'what_this_move_says'
      ? whatSection.kindLabel
      : '';
  const bodyLine =
    whatSection && whatSection.kind === 'what_this_move_says'
      ? whatSection.bodyExcerpt
      : '';
  const parentLine =
    whatSection && whatSection.kind === 'what_this_move_says'
      ? whatSection.parentHint
      : null;
  const branchLine =
    whereSection && whereSection.kind === 'where_it_sits'
      ? whereSection.branchLabel
      : '';

  return (
    <View
      style={styles.panel}
      testID="timeline-selected-readout-panel"
      accessibilityLabel={viewModel.accessibilityPanelLabel}
    >
      {/* Web live region — keyed on the selected id so RN-web re-announces
          on every selection change. Native ignores the prop and uses the
          announceForAccessibility effect above. The host has no visible
          chrome of its own. */}
      <View
        key={viewModel.selectedMessageId ?? '__empty__'}
        accessibilityLiveRegion="polite"
        style={styles.liveRegion}
      >
        <Text style={styles.liveRegionText}>
          {viewModel.accessibilitySelectionAnnouncement}
        </Text>
      </View>

      {viewModel.staleNotice ? (
        <View style={styles.staleBanner} testID="timeline-readout-stale-banner">
          <Text style={styles.staleBannerText}>{viewModel.staleNotice}</Text>
        </View>
      ) : null}

      {viewModel.isEmpty ? null : renderCompact ? (
        <View style={styles.compactBody} testID="timeline-readout-compact">
          <Text style={styles.kindLine} numberOfLines={1}>
            {kindLine}
          </Text>
          {bodyLine ? (
            <Text style={styles.bodyLine} numberOfLines={1} ellipsizeMode="tail">
              {bodyLine}
            </Text>
          ) : null}
          {parentLine ? (
            <Text style={styles.parentLine} numberOfLines={1}>
              {parentLine}
            </Text>
          ) : null}
          <Text style={styles.metaLine} numberOfLines={1}>
            {viewModel.replyCountLabel}
            {branchLine ? ` · ${branchLine}` : ''}
          </Text>
          {viewModel.actingOnShortLabel ? (
            <Text style={styles.actingLine} numberOfLines={1}>
              Acting on: {viewModel.actingOnShortLabel}
            </Text>
          ) : null}
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            style={styles.expandTrigger}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide full details' : 'Show full details'}
            accessibilityState={{ expanded }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            testID="timeline-readout-expand-trigger"
          >
            <Text style={styles.expandTriggerText}>
              {expanded ? 'Hide full details ▴' : 'Show full details ▾'}
            </Text>
          </Pressable>
          {expanded ? (
            <View
              style={[styles.expandedHost, { maxHeight: Math.max(160, Math.round(viewportHeight * 0.3)) }]}
              testID="timeline-readout-expanded"
            >
              <ArgumentReplySidecar viewModel={viewModel.sidecar} />
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={styles.replyCount} testID="timeline-readout-reply-count">
            {viewModel.replyCountLabel}
          </Text>
          <ArgumentReplySidecar viewModel={viewModel.sidecar} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The panel chrome is deliberately minimal so the wrapped SC-003 sidecar
  // keeps its own internal ScrollView and the Timeline above is not
  // squeezed on short phones. UX-001.2 moves the panel below the Timeline;
  // the marginTop replaces the old marginBottom so the gap sits above the
  // panel instead of between panel and Timeline.
  panel: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#312e81',
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  // Visually-hidden host — present for the screen reader, off-screen for
  // sighted users. The selection cue is the panel content change itself.
  liveRegion: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    left: -9999,
  },
  liveRegionText: { fontSize: 1, color: '#0b1220' },
  // Informational banner — amber/slate, NOT red. Not an error tone, not
  // a verdict. Border weight (not color alone) marks it as a notice.
  staleBanner: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  staleBannerText: { color: '#fde68a', fontSize: 12, fontWeight: '600' },
  replyCount: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  // UX-001.2 — compact summary. The 5 lines target a total height of
  // ~68 px on phone (paddingVertical 6 × 2 + 5 × line 11 = 67) and ~88
  // on wide (paddingVertical 10 × 2 + 5 × line 12 = 80). The expand
  // trigger adds ~22; expanded body is host-capped at 30% viewport.
  compactBody: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 1,
  },
  kindLine: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  bodyLine: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '500',
  },
  parentLine: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  metaLine: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  actingLine: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '600',
  },
  expandTrigger: {
    marginTop: 4,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  expandTriggerText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '700',
  },
  expandedHost: {
    marginTop: 4,
  },
});
