/**
 * UX-COMPOSER-005 (#831) — the callback line-capture sheet (presentational).
 *
 * After the shipped room picker selects a prior room, this sheet lists that
 * room posted moves the viewer legitimately reads (the caller-scoped
 * listArgumentsForDebate rows the parent hook fetched) as tappable rows;
 * tapping one captures its body verbatim (clamped) as the callback excerpt.
 *
 * INV-1 (weaver-capture gate): the sheet performs NO fetch and NEVER
 * synthesizes an excerpt. When the prior room is not readable to the weaver
 * (`locked`) or has no moves, it offers no excerpt — the callback cannot be
 * fabricated. R5: minimal verbatim line pick — no span-selection, no search box.
 *
 * Accessibility: every row is a 44x44 Pressable with role/label; color is not
 * the only signal. `reduceMotion` snaps the sheet open.
 *
 * RN primitives only. No new dependency. Comments apostrophe-free.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CALLBACK_COMPOSER_COPY } from './callbackComposerCopy';
import { clampCallbackExcerpt } from './callbackCaptureModel';

/** One capturable prior-room move (id + verbatim body). */
export interface CallbackCaptureMove {
  id: string;
  body: string;
}

export interface CallbackCaptureSheetProps {
  visible: boolean;
  /** The picked prior room title, for the sheet subtitle. */
  roomTitle: string;
  /** True while the room moves are being fetched. */
  loading: boolean;
  /**
   * True when the prior room is not readable to the weaver (title-only). No
   * excerpt is offered; the lock line renders as context (never a denial).
   */
  locked: boolean;
  /** The caller-readable prior-room moves. */
  moves: ReadonlyArray<CallbackCaptureMove>;
  /** Snaps the sheet open when reduce-motion is on. */
  reduceMotion?: boolean;
  /** Capture the tapped move body as the callback excerpt. */
  onCapture: (move: CallbackCaptureMove) => void;
  /** Close the sheet without capturing. */
  onClose: () => void;
}

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export function CallbackCaptureSheet({
  visible,
  roomTitle,
  loading,
  locked,
  moves,
  reduceMotion,
  onCapture,
  onClose,
}: CallbackCaptureSheetProps) {
  const animationType = reduceMotion === true ? 'none' : 'slide';
  const title = roomTitle.trim().length > 0 ? roomTitle.trim() : 'the prior argument';

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="callback-capture-sheet">
          <Text style={styles.title}>{CALLBACK_COMPOSER_COPY.captureSheetTitle}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {CALLBACK_COMPOSER_COPY.echoOrigin(title)}
          </Text>

          {loading ? (
            <Text style={styles.notice}>Loading lines…</Text>
          ) : locked ? (
            <Text style={styles.notice} testID="callback-capture-locked">
              {CALLBACK_COMPOSER_COPY.lockedCaptureLine}
            </Text>
          ) : moves.length === 0 ? (
            <Text style={styles.notice} testID="callback-capture-empty">
              {CALLBACK_COMPOSER_COPY.captureSheetEmpty}
            </Text>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {moves.map((move) => {
                const preview = clampCallbackExcerpt(move.body);
                return (
                  <Pressable
                    key={move.id}
                    onPress={() => onCapture(move)}
                    accessibilityRole="button"
                    accessibilityLabel={`Call back this line: ${preview}`}
                    hitSlop={HIT_SLOP}
                    style={styles.row}
                    testID={`callback-capture-row-${move.id}`}
                  >
                    <Text style={styles.rowGlyph} accessibilityElementsHidden>
                      {'“'}
                    </Text>
                    <Text style={styles.rowText} numberOfLines={3}>
                      {preview}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel weaving a callback"
              hitSlop={HIT_SLOP}
              testID="callback-capture-cancel"
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#1f2937',
    maxHeight: '80%',
  },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 16, marginBottom: 12 },
  notice: { color: '#94a3b8', fontSize: 13, paddingVertical: 12 },
  list: { maxHeight: 320, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    minHeight: 44,
  },
  rowGlyph: { color: '#a5b4fc', fontSize: 18, fontWeight: '800', lineHeight: 20 },
  rowText: { color: '#f8fafc', fontSize: 13, flex: 1, lineHeight: 18 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, minHeight: 44, justifyContent: 'center' },
  btnSecondary: { backgroundColor: '#1f2937' },
  btnSecondaryText: { color: '#e2e8f0', fontWeight: '700' },
});
