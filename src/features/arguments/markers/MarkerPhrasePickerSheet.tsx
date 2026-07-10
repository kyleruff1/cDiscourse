/**
 * MARK-002 (#894) — MarkerPhrasePickerSheet.
 *
 * The honest v1 phrase-selection gesture (Gesture reality audit): free
 * text-selection with reliable char offsets is not robust cross-platform, so v1
 * presents a deterministic phrase picker. segmentPhrases splits the target body
 * into sentence-ish phrases with EXACT char offsets; tapping a phrase yields
 * { spanStart, spanEnd, quote } computed from the same body the client loaded,
 * so the quote matches the server slice byte-for-byte. An empty / boundary-free
 * body offers a single Whole move row.
 *
 * A11y (accessibility-targets): each phrase row is a >=44px Pressable with role
 * + label; the sheet has a header and a cancel affordance; no non-essential
 * animation (reduce-motion safe by construction). Bottom sheet under 720px, side
 * sheet at or above 720px.
 *
 * All comments are apostrophe-free for the uxOneOneTwoDoctrine scanner.
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { segmentPhrases, type PendingMarkerScope } from './timestampMarkerModel';
import { MARKER_COPY } from './markerCopy';

export interface MarkerPhrasePickerSheetProps {
  /** The quoted (target) argument id. */
  targetArgumentId: string;
  /** The target body the client loaded (the offset authority). */
  targetBody: string;
  windowWidth: number;
  onPick: (scope: PendingMarkerScope) => void;
  onCancel: () => void;
  reduceMotion?: boolean;
}

export function MarkerPhrasePickerSheet(props: MarkerPhrasePickerSheetProps): React.ReactElement {
  const { targetArgumentId, targetBody } = props;
  const phrases = useMemo(() => segmentPhrases(targetBody), [targetBody]);
  const isSide = props.windowWidth >= 720;

  // Whole-move fallback when the body has no clear phrase boundary. Guarded so a
  // genuinely empty body (which submit-argument disallows) never mints a
  // zero-length span.
  const rows =
    phrases.length > 0
      ? phrases
      : targetBody.length > 0
        ? [{ text: MARKER_COPY.wholeMoveLabel, start: 0, end: targetBody.length }]
        : [];

  return (
    <View
      style={[styles.overlay, isSide ? styles.overlaySide : styles.overlayBottom]}
      testID="marker-phrase-picker-sheet"
    >
      <View style={[styles.sheet, isSide ? styles.sheetSide : styles.sheetBottom]}>
        <View style={styles.headerRow}>
          <Text style={styles.header} accessibilityRole="header">
            {MARKER_COPY.pickerHeader}
          </Text>
          <Pressable
            onPress={props.onCancel}
            accessibilityRole="button"
            accessibilityLabel={MARKER_COPY.pickerCancelA11yLabel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="marker-phrase-picker-cancel"
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>{MARKER_COPY.pickerCancel}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {rows.map((phrase, i) => (
            <Pressable
              key={`${phrase.start}-${phrase.end}-${i}`}
              onPress={() =>
                props.onPick({
                  targetArgumentId,
                  spanStart: phrase.start,
                  spanEnd: phrase.end,
                  // The RAW, untrimmed slice so it matches the server slice exactly.
                  quote: targetBody.slice(phrase.start, phrase.end),
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Quote: ${phrase.text}`}
              testID={`marker-phrase-row-${i}`}
              style={styles.row}
            >
              <Text style={styles.rowText} numberOfLines={3}>
                {phrase.text}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
  },
  overlayBottom: { justifyContent: 'flex-end' },
  overlaySide: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  sheet: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  sheetBottom: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  sheetSide: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    width: 380,
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  cancelButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
  list: { flexGrow: 0 },
  row: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#111827',
    marginVertical: 4,
    justifyContent: 'center',
  },
  rowText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
});
