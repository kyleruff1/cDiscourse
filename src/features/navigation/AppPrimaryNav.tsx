/**
 * NAV-START-ARGUMENT-001 Slice B — global header / masthead primary nav.
 *
 * Presentational. Lives in the shared app shell (mounted once in App.tsx)
 * so the primary navigation appears on every normal authenticated page —
 * Arguments / Start Argument / Timeline / Card / room / My Arguments /
 * Profile / About — without being copied per-screen.
 *
 * Layout (operator screenshot + spec):
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ [LOGO]                  primary nav (centered)   About → │  ← upper-right
 *   │  tagline                                       cdiscourse… │  ← copyright lower-right
 *   └────────────────────────────────────────────────────────────┘
 *
 * The large logo + tagline lockup is owned by AppHeader (rendered above
 * this strip). THIS component renders the navigation row, the upper-right
 * About entry, and the lower-right copyright/site mark, so the masthead
 * grid keeps logo / nav / tagline / copyright from overlapping.
 *
 * Doctrine + invariants:
 *   - Every nav item is a real <Pressable> with accessibilityRole="button",
 *     a >= 44x44 effective tap target, and accessibilityState.selected for
 *     the active section.
 *   - State-only. Tapping an item calls `onNavigate(section)`; the shell
 *     translates that into in-memory state transitions
 *     (resolvePrimaryNavTransition). NO router, NO Linking, NO history —
 *     the TL-003 / COMPOSER-002 no-route invariant is preserved.
 *   - PUBLIC surface. It never renders Admin / Debug / classifier-health /
 *     H-I-J / routing / production-family controls. Those stay in the
 *     role-gated secondary tab row (App.tsx), unchanged.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND, SURFACE_TOKENS, SPACING, RADIUS, TOUCH_TARGET } from '../../lib/designTokens';
import type { Band } from '../../hooks/useHeaderBreakpoint';
import { useHeaderBreakpoint } from '../../hooks/useHeaderBreakpoint';
import {
  PRIMARY_NAV_ORDER,
  PRIMARY_NAV_LABELS,
  PRIMARY_NAV_HINTS,
  type PrimaryNavSection,
} from './appPrimaryNavModel';

/**
 * Copyright / site mark, lower-right. The project has no pre-existing
 * canonical copyright string component (searched: no match), so this uses
 * the operator screenshot's verbatim wording. Defined here as the single
 * source of truth; the test pins it.
 */
export const APP_COPYRIGHT_TEXT = 'cdiscourse.com © 2026' as const;

interface AppPrimaryNavProps {
  /** The active primary section (drives accessibilityState.selected). */
  activeSection: PrimaryNavSection;
  /** Called with the tapped section. The shell applies the transition. */
  onNavigate: (section: PrimaryNavSection) => void;
  /**
   * Test/SSR override for the responsive band. When omitted the component
   * reads `useHeaderBreakpoint()`. Mirrors CollapsedComposerStrip's
   * `bandOverride` convention so tests pin a layout without a window mock.
   */
  bandOverride?: Band;
}

export function AppPrimaryNav({ activeSection, onNavigate, bandOverride }: AppPrimaryNavProps) {
  const breakpoint = useHeaderBreakpoint();
  const band: Band = bandOverride ?? breakpoint.band;
  // On phone the nav wraps to two rows; on tablet/wide it sits on one row.
  const isPhone = band === 'phone';

  return (
    <View style={styles.root} testID="app-primary-nav">
      {/* Centered primary nav row. */}
      <View
        style={[styles.navRow, isPhone && styles.navRowPhone]}
        accessibilityRole="tablist"
        accessibilityLabel="Primary navigation"
        testID="app-primary-nav-row"
      >
        {PRIMARY_NAV_ORDER.map((section) => (
          <PrimaryNavItem
            key={section}
            section={section}
            label={PRIMARY_NAV_LABELS[section]}
            hint={PRIMARY_NAV_HINTS[section]}
            active={activeSection === section}
            onPress={() => onNavigate(section)}
          />
        ))}
      </View>

      {/* Upper-right: About CivilDiscourse (public/user-facing). */}
      <View style={styles.upperRight}>
        <PrimaryNavItem
          section="about"
          label={PRIMARY_NAV_LABELS.about}
          hint={PRIMARY_NAV_HINTS.about}
          active={activeSection === 'about'}
          onPress={() => onNavigate('about')}
          testID="app-primary-nav-about"
        />
      </View>

      {/* Lower-right: copyright / site mark. Decorative text — not a button. */}
      <View style={styles.lowerRight}>
        <Text style={styles.copyright} testID="app-primary-nav-copyright" accessibilityRole="text">
          {APP_COPYRIGHT_TEXT}
        </Text>
      </View>
    </View>
  );
}

// ── One nav item (real button) ─────────────────────────────────────

function PrimaryNavItem({
  section,
  label,
  hint,
  active,
  onPress,
  testID,
}: {
  section: PrimaryNavSection;
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: active }}
      hitSlop={TOUCH_TARGET.hitSlopAll}
      style={({ pressed }) => [
        styles.item,
        active && styles.itemActive,
        pressed && styles.itemPressed,
      ]}
      testID={testID ?? `app-primary-nav-item-${section}`}
    >
      <View style={styles.itemInner}>
        {/* Shape carries the active state in addition to color: an active
            item shows a leading ● glyph + bolder label, so the selection
            survives a grayscale snapshot (doctrine / accessibility). */}
        <Text style={[styles.itemMarker, active && styles.itemMarkerOn]}>
          {active ? '●' : ''}
        </Text>
        <Text
          style={[styles.itemLabel, active && styles.itemLabelActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: BRAND.surface.appElevated.bg,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.accent.creamHairline,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  // Centered nav row. Tablet/wide: single centered row. Phone: wraps.
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.s,
    // Reserve right space so the centered row does not collide with the
    // absolutely-positioned About / copyright on tablet/wide.
    paddingRight: SPACING.l,
  },
  navRowPhone: {
    justifyContent: 'flex-start',
    paddingRight: 0,
  },
  item: {
    minHeight: TOUCH_TARGET.minSizePx,
    minWidth: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    borderColor: SURFACE_TOKENS.focusRing,
    backgroundColor: BRAND.surface.app.bg,
  },
  itemPressed: { opacity: 0.8 },
  itemInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  itemMarker: { fontSize: 11, color: SURFACE_TOKENS.focusRing, minWidth: 8 },
  itemMarkerOn: { color: SURFACE_TOKENS.focusRing },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.text.muted,
  },
  itemLabelActive: {
    fontWeight: '800',
    color: BRAND.text.primary,
  },
  upperRight: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.m,
  },
  lowerRight: {
    position: 'absolute',
    bottom: SPACING.xs,
    right: SPACING.m,
  },
  copyright: {
    fontSize: 11,
    color: BRAND.text.muted,
  },
});
