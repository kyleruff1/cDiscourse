/**
 * NAV-HEADER-INLINE-001 — stylized primary nav, rendered INSIDE the masthead.
 *
 * (Refines NAV-START-ARGUMENT-001 Slice B / PR #527.)
 *
 * Presentational. The shell mounts this into AppHeader's `navSlot` so the
 * primary navigation is part of the masthead/header region itself — a
 * single cohesive, stylized nav bar that shares the header container with
 * the large logo lockup. It is NOT a separate strip rendered beneath the
 * header.
 *
 * Layout (operator feedback 2026-06-06):
 *   ┌──────────────── masthead (AppHeader) ─────────────────────────────┐
 *   │ [LOGO]      ┌──── this stylized nav bar ────────────┐      [gear] │
 *   │  ...tagline │ Start · Browse · My Args · Profile  About → │        │
 *   │             │                                cdiscourse… │        │
 *   │             └──────────────────────────────────────────┘         │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 *   - large logo left (owned by AppHeader)
 *   - stylized primary nav inline in the masthead (this component)
 *   - About CivilDiscourse top-right of the bar
 *   - copyright lower-right of the bar
 *   - the tagline stays anchored to the logo lockup (AppHeader), it does
 *     NOT float into the nav
 *
 * Stylization (the "more stylized" ask): a real bar with its own elevated
 * panel background, a hairline outline + bottom rule, generous spacing,
 * and three distinct item states (resting · selected · pressed). The
 * selected state is carried by weight + a leading ● marker + an underline
 * indicator in addition to color, so it survives a grayscale snapshot
 * (doctrine / accessibility).
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
  // On phone the bar stacks (nav row, then About + copyright row) so the
  // logo / nav / tagline / About / copyright never overlap; on tablet /
  // wide the nav sits on the left of the bar and About + copyright anchor
  // to the right of the same row.
  const isPhone = band === 'phone';

  return (
    <View
      style={[styles.root, isPhone && styles.rootPhone]}
      testID="app-primary-nav"
    >
      {/* Primary nav row. */}
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

      {/* Right cluster: About (top) + copyright (below). On tablet / wide
          this anchors to the right edge of the bar; on phone it wraps to a
          second row aligned right. */}
      <View style={[styles.rightCluster, isPhone && styles.rightClusterPhone]}>
        <PrimaryNavItem
          section="about"
          label={PRIMARY_NAV_LABELS.about}
          hint={PRIMARY_NAV_HINTS.about}
          active={activeSection === 'about'}
          onPress={() => onNavigate('about')}
          testID="app-primary-nav-about"
        />
        {/* Copyright / site mark. Decorative text — not a button. */}
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
      {/* Underline indicator — a second non-color cue for the active item.
          Always present (transparent when resting) so the row height does
          not shift between states; only its color changes when active. */}
      <View
        style={[styles.itemUnderline, active && styles.itemUnderlineOn]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The stylized bar. An elevated panel with a hairline outline + bottom
  // rule so it reads as a real, polished nav bar inside the dark masthead
  // (not plain stacked text buttons). On tablet / wide the nav sits left,
  // the About + copyright cluster anchors right, on one row.
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.s,
    backgroundColor: BRAND.surface.appElevated.bg,
    borderWidth: 1,
    borderColor: BRAND.accent.creamHairline,
    borderRadius: RADIUS.lg,
    borderBottomWidth: 2,
    borderBottomColor: SURFACE_TOKENS.focusRing,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  rootPhone: {
    // Phone: stack the nav row above the About + copyright cluster.
    flexDirection: 'column',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
  },
  // Primary nav row. Tablet / wide: single row, left-aligned. Phone: wraps.
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  navRowPhone: {
    justifyContent: 'flex-start',
  },
  item: {
    minHeight: TOUCH_TARGET.minSizePx,
    minWidth: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    borderColor: SURFACE_TOKENS.focusRing,
    backgroundColor: BRAND.surface.app.bg,
  },
  itemPressed: { opacity: 0.7 },
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
  // Underline indicator: a grayscale-legible active cue. Transparent when
  // resting (reserves height), focus-ring colored when active.
  itemUnderline: {
    height: 2,
    marginTop: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
  },
  itemUnderlineOn: {
    backgroundColor: SURFACE_TOKENS.focusRing,
  },
  // Right cluster: About (top) + copyright (below), anchored right.
  rightCluster: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  rightClusterPhone: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  copyright: {
    fontSize: 11,
    color: BRAND.text.muted,
  },
});
