/**
 * IX-004 — TimelineSelectedReadoutPanel.
 *
 * The prominent, persistent instrument panel for the selected Timeline
 * message. It sits ABOVE the timeline map (and the action dock) inside
 * `ArgumentGameSurface`'s timeline branch. It is the loud, in-surface
 * confirmation of WHICH message is selected — not a transient popover.
 *
 * The panel is READ-ONLY: no callbacks, no dispatch, no `onAction`. It is
 * a thin presentation layer over `TimelineSelectedReadoutViewModel`
 * (`timelineSelectedReadoutModel.ts`), and it wraps the existing SC-003
 * `ArgumentReplySidecar` rather than re-implementing its six sections.
 *
 * Click feedback is NOT authored here — the unmistakable confirmation is
 * the panel itself re-rendering with the new subject (a content change,
 * color-independent) plus VG-004's existing node glow on the timeline.
 * IX-004 adds NO animation; the panel snaps. Reduce-motion is unaffected.
 *
 * Accessibility:
 *   - Root `<View>` carries `accessibilityLabel` summarising the selected
 *     message kind + ordinal + standing band + reply count.
 *   - A `accessibilityLiveRegion="polite"` host announces the selection
 *     change on web; on native, `announceForAccessibility` fires from a
 *     `useEffect` keyed on `selectedMessageId` (Platform-gated so a web
 *     build never double-announces).
 */
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { ArgumentReplySidecar } from './ArgumentReplySidecar';
import type { TimelineSelectedReadoutViewModel } from './timelineSelectedReadoutModel';

interface Props {
  viewModel: TimelineSelectedReadoutViewModel;
}

export function TimelineSelectedReadoutPanel({ viewModel }: Props) {
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

      {viewModel.isEmpty ? null : (
        <Text style={styles.replyCount} testID="timeline-readout-reply-count">
          {viewModel.replyCountLabel}
        </Text>
      )}

      <ArgumentReplySidecar viewModel={viewModel.sidecar} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The panel chrome is deliberately minimal (banner + one count line)
  // so the wrapped SC-003 sidecar keeps its own internal ScrollView and
  // the timeline map below is not squeezed on short phones.
  panel: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#312e81',
    borderRadius: 10,
    marginBottom: 8,
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
});
