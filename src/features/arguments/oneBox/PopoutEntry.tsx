/**
 * QOL-030 — Popout chassis: `PopoutEntry`.
 *
 * One row in a popout — the shared leaf primitive QOL-031 (Act), QOL-032
 * (Inspect) and QOL-033 (Go) all consume verbatim (QOL-030 design §6.4).
 *
 * An entry carries: an optional leading glyph, a terminology-clean label,
 * an optional key badge, an enabled / disabled state with a visible
 * reason, and a `kind` (`box-opening` / `direct` / `role-change` /
 * `navigate` / `inspect`).
 *
 * Doctrine / accessibility (cdiscourse-doctrine, accessibility-targets):
 *  - The leading glyph is a `<Text>` glyph — NEVER an icon-library import
 *    (expo-rn-patterns: icon libraries are banned; use repo glyphs).
 *  - Color is never the only signal: the label text + the optional glyph +
 *    the disabled-reason text all carry meaning without color.
 *  - Every row is a `<Pressable accessibilityRole="button">` with a
 *    descriptive `accessibilityLabel`, `accessibilityState` (disabled),
 *    and a ≥ 44×44 effective tap target (`PADDED_HIT_SLOP` lifts a short
 *    row).
 *  - A disabled entry stays VISIBLE with a one-line reason — never a
 *    silent omission (one-box-interface-model.md §5 W2).
 *  - No verdict / amplification copy is authored here — the caller passes
 *    plain-language strings; the QOL-031/032/033 content models own the
 *    vocabulary.
 *
 * Presentational only. Local state-free. No Supabase, no network, no AI.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS, RADIUS, SPACING } from '../../../lib/designTokens';

/**
 * The entry kind — drives the leading glyph and is exposed to the content
 * models. `box-opening` opens the one-box; `direct` fires an action with
 * no box; `role-change` changes participation; `navigate` / `inspect` are
 * the Go / Inspect popout kinds (QOL-033 / QOL-032).
 */
export type PopoutEntryKind =
  | 'box-opening'
  | 'direct'
  | 'role-change'
  | 'navigate'
  | 'inspect';

/** Frozen list of every entry kind. */
export const ALL_POPOUT_ENTRY_KINDS: ReadonlyArray<PopoutEntryKind> = Object.freeze([
  'box-opening',
  'direct',
  'role-change',
  'navigate',
  'inspect',
]);

/**
 * Leading glyph per entry kind. Plain `<Text>` glyphs — NOT an icon
 * library (expo-rn-patterns). Each is shape-distinct so the kind is
 * legible without color.
 *  - box-opening → a pencil-like compose glyph.
 *  - direct      → a bullet (a plain action).
 *  - role-change → a swap glyph.
 *  - navigate    → a right arrow.
 *  - inspect     → a magnifier.
 */
const KIND_GLYPH: Readonly<Record<PopoutEntryKind, string>> = Object.freeze({
  'box-opening': '✎',
  direct: '•',
  'role-change': '⇄',
  navigate: '→',
  inspect: '🔎',
});

/**
 * Hit-slop that lifts a short row to a ≥ 44×44 effective tap target.
 * Mirrors `PRESEND_HIT_SLOP`. Frozen so callers can share one object.
 */
export const PADDED_HIT_SLOP = Object.freeze({ top: 8, bottom: 8, left: 8, right: 8 });

/** Minimum visual row height (logical px). With the hit-slop the
 *  effective target clears 44×44. */
export const POPOUT_ENTRY_MIN_HEIGHT = 44;

/**
 * Builds the screen-reader label for a popout row — extracted as a pure
 * helper so the repo's pure-helper UI-test discipline can exercise it
 * without an RN renderer (mirrors `buildAdvisoryAccessibilityLabel`).
 *
 * Verbose on purpose — a screen-reader user gets one read per element.
 * Promotion + disabled state are spoken as WORDS, never color-only.
 */
export function buildPopoutEntryAccessibilityLabel(input: {
  label: string;
  accessibilityLabel?: string;
  isPromoted?: boolean;
  isDisabled?: boolean;
  disabledReason?: string | null;
}): string {
  const base = input.accessibilityLabel ?? input.label;
  const promotedPrefix = input.isPromoted ? 'Suggested. ' : '';
  const disabledSuffix = input.isDisabled
    ? input.disabledReason
      ? ` (unavailable: ${input.disabledReason})`
      : ' (unavailable)'
    : '';
  return `${promotedPrefix}${base}${disabledSuffix}`;
}

export interface PopoutEntryProps {
  /** Plain-language label. Authored by the caller's content model. */
  label: string;
  /** Entry kind — picks the leading glyph + is forwarded to handlers. */
  kind: PopoutEntryKind;
  /**
   * Optional keyboard badge text (e.g. "R", "Esc"). Rendered as a small
   * monospace chip. The keyboard *layer* itself is IX-003 — this is the
   * visual badge slot only.
   */
  keyBadge?: string | null;
  /** Optional verbose accessibility label. Falls back to `label`. */
  accessibilityLabel?: string;
  /**
   * True when the row is the promoted / emphasized entry (the §3.4
   * stage-promoted Act entry). Renders with a heavier weight + a leading
   * marker — emphasis is text-weight + shape, never color alone.
   */
  isPromoted?: boolean;
  /** True when the row is rendered but cannot be invoked. */
  isDisabled?: boolean;
  /**
   * One-line plain-language reason shown under a disabled row. A disabled
   * entry is never silently omitted (one-box model §5 W2).
   */
  disabledReason?: string | null;
  /** Invoked on press. Not called when `isDisabled`. */
  onPress: () => void;
  /** testID passthrough. */
  testID?: string;
}

/**
 * A single popout row. Pure presentation — the parent `PopoutGroup`
 * supplies the data; the content model (QOL-031/032/033) supplies the
 * copy.
 */
export function PopoutEntry({
  label,
  kind,
  keyBadge,
  accessibilityLabel,
  isPromoted = false,
  isDisabled = false,
  disabledReason,
  onPress,
  testID,
}: PopoutEntryProps) {
  const glyph = KIND_GLYPH[kind] ?? KIND_GLYPH.direct;

  // The screen-reader label — built by the exported pure helper so the
  // computation is unit-testable without a renderer.
  const a11yLabel = useMemo(
    () =>
      buildPopoutEntryAccessibilityLabel({
        label,
        accessibilityLabel,
        isPromoted,
        isDisabled,
        disabledReason,
      }),
    [accessibilityLabel, label, isPromoted, isDisabled, disabledReason],
  );

  return (
    <View>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled: isDisabled }}
        hitSlop={PADDED_HIT_SLOP}
        style={[styles.row, isPromoted && styles.rowPromoted, isDisabled && styles.rowDisabled]}
        testID={testID}
      >
        {/* Leading glyph — shape signal for the entry kind. */}
        <Text
          style={[styles.glyph, isDisabled && styles.textDisabled]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {isPromoted ? '★ ' : ''}
          {glyph}
        </Text>

        {/* Label — the primary text signal. */}
        <Text
          style={[
            styles.label,
            isPromoted && styles.labelPromoted,
            isDisabled && styles.textDisabled,
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>

        {/* Key badge — optional small chip on the trailing edge. */}
        {keyBadge ? (
          <View style={styles.keyBadge}>
            <Text
              style={styles.keyBadgeText}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {keyBadge}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Disabled reason — a one-line plain-language explanation under the
          row. Never a silent omission. */}
      {isDisabled && disabledReason ? (
        <Text style={styles.disabledReason} numberOfLines={2}>
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: POPOUT_ENTRY_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    gap: SPACING.s,
  },
  rowPromoted: {
    // Emphasis is a raised surface + (below) heavier text — not color.
    backgroundColor: SURFACE_TOKENS.raised,
  },
  rowDisabled: {
    // Disabled rows stay visible; opacity + the reason text carry it.
    opacity: 0.55,
  },
  glyph: {
    fontSize: 15,
    color: SURFACE_TOKENS.textSecondary,
    width: 26,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: SURFACE_TOKENS.textPrimary,
  },
  labelPromoted: {
    fontWeight: '800',
  },
  textDisabled: {
    color: SURFACE_TOKENS.textMuted,
  },
  keyBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    // A monospace family keeps single-letter badges visually stable.
    fontFamily: 'monospace',
  },
  disabledReason: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    paddingHorizontal: SPACING.m + 26 + SPACING.s,
    paddingBottom: SPACING.xs,
  },
});
