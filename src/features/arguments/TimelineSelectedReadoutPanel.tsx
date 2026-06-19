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
// UX-SELECTED-NODE-001 — restrained gold accent (selected-node "center of the
// room" halo + in-card left accent). Existing UX-BRAND-001 tokens; no new hex.
import { BRAND } from '../../lib/designTokens';

interface Props {
  viewModel: TimelineSelectedReadoutViewModel;
  /**
   * UX-001.2 — When true (the new default mount-site below the Timeline),
   * the panel renders a 5-line summary with an expand trigger to the
   * 6-section sidecar. When false / omitted, the legacy full sidecar
   * renders (IX-004 back-compat).
   */
  compact?: boolean;
  /**
   * UX-SELECTED-NODE-001 (§6 / §9.3) — read-only "Go to parent point" jump.
   * When provided, the responding-to anchor renders a "Go to parent point"
   * affordance that calls this (the host wires it to setActiveMessageId on
   * the parent). Omitted at the root (no parent) — the affordance is then
   * not rendered. Read-only selection jump; never a submit / write.
   */
  onGoToParent?: () => void;
}

export function TimelineSelectedReadoutPanel({ viewModel, compact, onGoToParent }: Props) {
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
  // UX-SELECTED-NODE-001 (row 3) — the parent / target excerpt. Already on
  // the SC-003 view-model (argumentReplySidecarModel.parentBodyPreview, ≤120
  // chars, word-boundary truncated, redaction-safe). Surfaced in the compact
  // selected-node anchor for the first time here. null at the root → omitted.
  const parentExcerpt =
    whatSection && whatSection.kind === 'what_this_move_says'
      ? whatSection.parentBodyPreview
      : null;
  const branchLine =
    whereSection && whereSection.kind === 'where_it_sits'
      ? whereSection.branchLabel
      : '';

  // UX-SELECTED-NODE-001 (row 1) — the selected-node "center of the room"
  // treatment renders ONLY when there is an actual subject (not the empty
  // hint). The gold halo (border) + the in-card left accent stripe mark THIS
  // card as the selected point; the gold is deliberately distinct from the
  // indigo (GLOW.activePath) active-path system. Geometry (the left-accent
  // stripe width + the border) carries the signal in grayscale; no animation.
  const showSelectedTreatment = !viewModel.isEmpty;

  return (
    <View
      style={[
        styles.panel,
        showSelectedTreatment && styles.selectedCard,
      ]}
      testID="timeline-selected-readout-panel"
      accessibilityLabel={viewModel.accessibilityPanelLabel}
    >
      {/* UX-SELECTED-NODE-001 (row 2, O-2 in-card LEFT ACCENT) — an in-card
          left-edge accent stripe. It lives INSIDE this card's own bounds (it
          is part of the selected card), NOT a separate column or board rail.
          Decorative (geometry); hidden from the screen reader. */}
      {showSelectedTreatment ? (
        <View
          style={styles.selectedCardLeftAccent}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="selected-node-card-left-accent"
        />
      ) : null}
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
          {/* UX-SELECTED-NODE-001 (rows 2-3) — the "Responding to this point"
              anchor. The v4 lead-in is anchored where composition is bound;
              the structural "#N (kind)" identity stays as the sub-label
              (parentLine — NEVER a fabricated display name, §7 R3); the parent
              excerpt (parentBodyPreview, row 3) renders below it when present;
              and the read-only "Go to parent point" jump (§6 / §9.3) renders
              when the host supplies onGoToParent. The whole block is omitted
              cleanly at the root (no parentLine and no excerpt). */}
          {parentLine || parentExcerpt ? (
            <View style={styles.respondingAnchor} testID="selected-node-responding-anchor">
              <Text style={styles.respondingAnchorLead} numberOfLines={1}>
                Responding to this point
              </Text>
              {parentLine ? (
                <Text style={styles.parentLine} numberOfLines={1}>
                  {parentLine}
                </Text>
              ) : null}
              {parentExcerpt ? (
                <Text
                  style={styles.parentExcerptLine}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  testID="selected-node-parent-excerpt"
                >
                  {parentExcerpt}
                </Text>
              ) : null}
              {onGoToParent ? (
                <Pressable
                  onPress={onGoToParent}
                  style={styles.goToParentTrigger}
                  accessibilityRole="button"
                  accessibilityLabel="Go to parent point"
                  accessibilityHint="Selects the point this move is responding to."
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID="selected-node-go-to-parent"
                >
                  <Text style={styles.goToParentText}>Go to parent point →</Text>
                </Pressable>
              ) : null}
            </View>
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
  // UX-SELECTED-NODE-001 (row 1) — the selected-node card "center of the
  // room" halo. A restrained GOLD border (BRAND.accent.goldBorder) replaces
  // the resting indigo card border so THIS card reads as the selected point,
  // distinct from the indigo (GLOW.activePath) active-path system. The
  // paddingLeft makes room for the in-card left-accent stripe so content is
  // never overlapped. The card keeps overflow:hidden, so the stripe stays
  // within the card's own rounded bounds (it is part of the card, not a rail).
  selectedCard: {
    borderColor: BRAND.accent.goldBorder,
    paddingLeft: 4,
  },
  // UX-SELECTED-NODE-001 (row 2, O-2) — the IN-CARD left accent stripe. A
  // 4px gold edge pinned to the LEFT of THIS card, inside its bounds. It is
  // NOT a separate column / board rail — it is part of the selected card.
  // Geometry (the stripe) carries the signal in grayscale; gold is the color
  // supplement. Decorative; hidden from the screen reader.
  selectedCardLeftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: BRAND.accent.gold,
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
  // UX-SELECTED-NODE-001 (rows 2-3) — the "Responding to this point" anchor
  // group. A small top margin sets it apart from the body line above; the
  // lead-in is the loudest line in the group (gold), the structural identity
  // (parentLine) and the excerpt are quieter context below it.
  respondingAnchor: {
    marginTop: 3,
    gap: 1,
  },
  respondingAnchorLead: {
    color: BRAND.accent.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  // The parent excerpt is the parent's body text (verbatim, ≤120 chars).
  // Two-line clamp so it never blows the compact height budget on phone.
  parentExcerptLine: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  // "Go to parent point" — read-only nav. Self-aligned start so the 44px
  // (visual + hitSlop) target never spans the full card width.
  goToParentTrigger: {
    marginTop: 2,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  goToParentText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '700',
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
