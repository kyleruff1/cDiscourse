/**
 * QOL-030 — Popout chassis: `Popout`.
 *
 * The anchored container the three popouts — Act (QOL-031), Inspect
 * (QOL-032), Go (QOL-033) — all stand inside (QOL-030 design §6.4).
 *
 * Behaviour (QOL-030 design §6.4 / one-box-interface-model.md §6):
 *  - Anchored container — a compact panel, NOT a full-screen modal.
 *  - Board-non-blocking scrim — the scrim shields stray touches but does
 *    NOT hide the board behind it (a thin, low-opacity veil). Tapping the
 *    scrim DOES dismiss the popout (a popout is a quick, light surface —
 *    unlike the composer dock whose scrim is inert).
 *  - Fast "flash" open/close — 140 ms (inside the design's 120-160 ms
 *    band). Reduce-motion → instant (no fade).
 *  - Focus trap — `accessibilityViewIsModal` on the panel.
 *  - `Esc` closes (web) — and native hardware-back closes via `<Modal
 *    onRequestClose>`.
 *
 * QOL-030 ships the CHASSIS; QOL-031/032/033 plug their content models in
 * as children. The chassis itself authors no flash-menu copy.
 *
 * Doctrine / accessibility:
 *  - Reduce-motion is read from `AccessibilityInfo`, with a caller
 *    override winning (mirrors `ArgumentComposerDock`).
 *  - The header label + close control are plain language; the close
 *    control is a ≥ 44×44 `Pressable` with role + label.
 *  - Presentational. No Supabase, no network, no AI.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SURFACE_TOKENS, RADIUS, SPACING } from '../../../lib/designTokens';

/** Flash open/close duration (logical ms) — inside the design's 120-160 band. */
export const POPOUT_FLASH_DURATION_MS = 140;

/** Anchor edge for the panel. Most popouts anchor near the bottom dock. */
export type PopoutAnchor = 'bottom' | 'top';

export interface PopoutProps {
  /** Drives mount + the flash animation. When false the popout is not rendered. */
  visible: boolean;
  /** Plain-language popout title (e.g. "Act", "Inspect", "Go"). */
  title: string;
  /** Close the popout. Called by the close control, the scrim, Esc, and back. */
  onClose: () => void;
  /** Popout content — the QOL-031/032/033 groups. */
  children: React.ReactNode;
  /** Anchor edge — defaults to `bottom`. */
  anchor?: PopoutAnchor;
  /**
   * Effective reduce-motion (OS value composed with the user's
   * preference). When omitted the popout reads `AccessibilityInfo` itself.
   * Mirrors `ArgumentComposerDock.reduceMotionOverride`.
   */
  reduceMotionOverride?: boolean;
  /** testID passthrough for the popout root. */
  testID?: string;
}

/** Flash travel distance (logical px) for the open animation. */
const FLASH_TRAVEL = 12;

/**
 * The anchored popout container. A thin React shell over the flash
 * animation + focus trap; the content models (QOL-031/032/033) are
 * rendered as `children`.
 */
export function Popout({
  visible,
  title,
  onClose,
  children,
  anchor = 'bottom',
  reduceMotionOverride,
  testID,
}: PopoutProps) {
  // ── reduce-motion read (mirrors ArgumentComposerDock) ──
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    try {
      const result = AccessibilityInfo.isReduceMotionEnabled();
      if (result && typeof result.then === 'function') {
        result
          .then((enabled) => {
            if (!cancelled) setPrefersReducedMotion(enabled === true);
          })
          .catch(() => {
            // Some platforms (web shim, jest) reject — keep the default.
          });
      }
    } catch {
      // API unavailable — keep the default.
    }
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        if (!cancelled) setPrefersReducedMotion(enabled === true);
      });
    } catch {
      // Listener API unavailable — the one-shot read above still works.
    }
    return () => {
      cancelled = true;
      try {
        subscription?.remove();
      } catch {
        // Swallow — listener may already be torn down.
      }
    };
  }, []);

  // The threaded effective reduce-motion value WINS over the OS read.
  const effectiveReducedMotion =
    typeof reduceMotionOverride === 'boolean' ? reduceMotionOverride : prefersReducedMotion;

  // ── flash animation ──
  // `progress` 0 = closed, 1 = open. Reduce-motion → snap (no fade).
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (effectiveReducedMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: POPOUT_FLASH_DURATION_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, effectiveReducedMotion, progress]);

  // ── web Escape close ──
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Reduce-motion: opacity-only (no translate). Otherwise translate + opacity.
  const panelAnimatedStyle = useMemo(() => {
    const opacity = progress;
    if (effectiveReducedMotion) {
      return { opacity };
    }
    const translate = progress.interpolate({
      inputRange: [0, 1],
      // Bottom anchor slides up from below; top anchor slides down.
      outputRange: anchor === 'bottom' ? [FLASH_TRAVEL, 0] : [-FLASH_TRAVEL, 0],
    });
    return { opacity, transform: [{ translateY: translate }] };
  }, [progress, effectiveReducedMotion, anchor]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={[styles.backdrop, anchor === 'top' ? styles.backdropTop : styles.backdropBottom]}
        testID={testID ?? 'one-box-popout'}
      >
        {/* Board-non-blocking scrim — a thin veil that does NOT hide the
            board. Tapping it dismisses the popout (a popout is a light,
            quick surface). It is hidden from assistive tech — `Esc` /
            the close control / hardware-back are the labelled paths. */}
        <Pressable
          style={styles.scrim}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={handleClose}
          testID="one-box-popout-scrim"
        />

        <Animated.View
          style={[styles.panel, panelAnimatedStyle]}
          accessibilityViewIsModal
          accessibilityLabel={title}
          testID="one-box-popout-panel"
        >
          {/* Header strip — title + close. */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              style={styles.closeButton}
              testID="one-box-popout-close"
            >
              {/* `esc` is a text affordance (not a color swatch). */}
              <Text style={styles.closeText}>esc</Text>
            </Pressable>
          </View>

          {/* Content — the QOL-031/032/033 groups. Scrolls when long. */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The scrim veil is deliberately LOW opacity — the board stays visible
  // behind the popout (design §6.4 "scrim that does not hide the board").
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.32)',
  },
  backdropBottom: {
    justifyContent: 'flex-end',
  },
  backdropTop: {
    justifyContent: 'flex-start',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    // Anchored — NOT full-screen. Caps at 72% height so the board stays
    // visible above/below.
    maxHeight: '72%',
    backgroundColor: SURFACE_TOKENS.overlay,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: SURFACE_TOKENS.textPrimary,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.s,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    fontFamily: 'monospace',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.xs,
  },
});
