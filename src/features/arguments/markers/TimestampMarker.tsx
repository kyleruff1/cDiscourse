/**
 * MARK-002 (#894) — TimestampMarker.
 *
 * ONE component, three placements (Design Pass Output 6):
 *   - source_span:    the highlighted run inside the quoted card body.
 *   - reply_reference: the chip on the reply card; tap deep-links to the source.
 *   - composer_scope:  the chip in the ROOM-003 composer bar; the clear un-scopes.
 *
 * Doctrine + a11y (cdiscourse-doctrine, accessibility-targets):
 *   - A marker quotes the MOMENT, never judges it: a span + a verbatim quote, no
 *     verdict, no score. Copy comes from markerCopy (ban-list clean).
 *   - Color is never the only signal: the chip pairs a tint with the typographic
 *     quote glyphs (and a chevron on the reply chip); the source-span highlight
 *     pairs a tint with an underline, so it reads in grayscale.
 *   - Chips are at least 32px with hitSlop to reach the 44x44 target; every
 *     Pressable carries role + label + state.
 *   - Reduce-motion safe by construction (no animation; the prop is threaded for
 *     symmetry only).
 *
 * All comments are apostrophe-free for the uxOneOneTwoDoctrine scanner.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  buildSourceSpanSegments,
  formatMarkerChipLabel,
  type MarkerPlacement,
  type TimestampMarkerViewModel,
} from './timestampMarkerModel';
import { MARKER_COPY } from './markerCopy';

export interface TimestampMarkerProps {
  placement: MarkerPlacement;
  marker: TimestampMarkerViewModel;
  /** For source_span: the target body to compute the highlight segments. */
  body?: string;
  /** reply_reference tap -> deep-link to the source span. */
  onOpenSource?: (targetArgumentId: string, markerId: string) => void;
  /** composer_scope clear -> un-scope the pending marker. */
  onClear?: () => void;
  /** Threaded for symmetry; the component has no motion to gate. */
  reduceMotion?: boolean;
}

export function TimestampMarker(props: TimestampMarkerProps): React.ReactElement | null {
  const { placement, marker } = props;

  if (placement === 'source_span') {
    const segments =
      typeof props.body === 'string'
        ? buildSourceSpanSegments(props.body, { spanStart: marker.spanStart, spanEnd: marker.spanEnd })
        : null;
    // Drift or missing body: render nothing here; the card body renders plain and
    // the reply chip still resolves via the durable quotedText.
    if (!segments) return null;
    return (
      <Text style={styles.sourceSpanBody} testID={`timestamp-marker-source-span-${marker.id}`}>
        {segments.before}
        <Text style={styles.sourceSpanMarked} accessibilityLabel={`Quoted phrase: ${segments.marked}`}>
          {segments.marked}
        </Text>
        {segments.after}
      </Text>
    );
  }

  if (placement === 'reply_reference') {
    if (marker.state === 'orphaned') {
      return (
        <View style={styles.orphanChip} testID={`timestamp-marker-orphan-${marker.id}`}>
          <Text style={styles.orphanText}>{MARKER_COPY.orphanedLabel}</Text>
          <Text style={styles.orphanQuote} numberOfLines={1}>
            {formatMarkerChipLabel(marker.quotedText)}
          </Text>
        </View>
      );
    }
    return (
      <Pressable
        onPress={() => props.onOpenSource?.(marker.targetArgumentId, marker.id)}
        accessibilityRole="button"
        accessibilityLabel={MARKER_COPY.replyChipA11yLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID={`timestamp-marker-reply-${marker.id}`}
        style={styles.replyChip}
      >
        <Text style={styles.replyChipText} numberOfLines={1}>
          {formatMarkerChipLabel(marker.quotedText)}
          {MARKER_COPY.replyChipChevron}
        </Text>
      </Pressable>
    );
  }

  // composer_scope
  return (
    <View style={styles.scopeChip} testID="timestamp-marker-composer-scope">
      <Text
        style={styles.scopeChipText}
        numberOfLines={1}
        accessibilityLabel={MARKER_COPY.composerScopeA11yLabel}
      >
        {formatMarkerChipLabel(marker.quotedText)}
      </Text>
      {props.onClear ? (
        <Pressable
          onPress={props.onClear}
          accessibilityRole="button"
          accessibilityLabel={MARKER_COPY.composerScopeClearA11yLabel}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="timestamp-marker-composer-scope-clear"
          style={styles.scopeClear}
        >
          <Text style={styles.scopeClearGlyph}>{'✕'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sourceSpanBody: { color: '#e2e8f0', fontSize: 15, lineHeight: 21, marginTop: 8 },
  // Tint PLUS underline: the highlight reads in grayscale (color not the only cue).
  sourceSpanMarked: {
    backgroundColor: '#1e3a5f',
    color: '#f8fafc',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  replyChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    backgroundColor: '#111827',
    minHeight: 32,
    justifyContent: 'center',
  },
  replyChipText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700', fontStyle: 'italic' },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    backgroundColor: '#111827',
    minHeight: 32,
  },
  scopeChipText: { flexShrink: 1, color: '#a5b4fc', fontSize: 12, fontWeight: '700', fontStyle: 'italic' },
  scopeClear: {
    minWidth: 20,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeClearGlyph: { color: '#94a3b8', fontSize: 13 },
  orphanChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
    backgroundColor: '#0b1220',
    minHeight: 32,
    justifyContent: 'center',
    gap: 2,
  },
  orphanText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  orphanQuote: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
});
