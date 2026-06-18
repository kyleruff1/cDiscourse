/**
 * BRAND-001 / UX-001.1 — Global CivilDiscourse app header.
 *
 * Stage 1 (PR #55 / commit abba2e8): persistent top-of-page chrome
 * with the cream-on-black logo on the left and an optional right
 * slot. Tapping the logo dispatches a state-only deselect.
 *
 * Stage 2 (PR #55 / commit aa50630): the logo grew to 110px at wide
 * viewports (>= 720dp) inside a 152px header, with the tagline
 * "Just get to the bottom of it" rendered next to / under the logo
 * via `AppHeaderTagline`. Narrow viewports kept the Stage 1 64px
 * header. A 1px cream-hairline divider replaced the Stage 1 solid
 * `appElevated` border.
 *
 * UX-001.1 (this card): logo + header heights are now band-aware
 * (phone 44/64, tablet 80/96, wide 96/120) per the new
 * 3-band breakpoint. The wide header is tightened from 152 -> 120 to
 * satisfy the epic's "header height does not bury the active board"
 * non-negotiable; tablet gains an intermediate 96px header. The
 * wordmark fallback now reads its `fontSize` / `lineHeight` /
 * `fontWeight` / `letterSpacing` from `BRAND.typography.wordmarkFallback`
 * per band (replacing the prior inline `fontSize: 18` / `fontSize: 28`
 * literals). The home pressable gains a per-band `minWidth`
 * (120 / 200 / 240) so the brand+nav group is visibly larger on
 * tablet+wide.
 *
 * Stays state-only — no router, no navigation. Preserves the TL-003
 * no-route invariant.
 *
 * The logo is a regular `Image` source — no `react-native-svg`. If the
 * PNG asset is missing for any reason, the header falls back to a
 * text-only `CivilDiscourse` cream wordmark so the rest of the app
 * still renders. The fallback honors the breakpoint band via the
 * `BRAND.typography.wordmarkFallback[band]` size.
 */
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { TextStyle } from 'react-native';
import { BRAND } from '../lib/designTokens';
import type { Band } from '../hooks/useHeaderBreakpoint';
import { useHeaderBreakpoint } from '../hooks/useHeaderBreakpoint';
// Operator request 2026-05-26: the tagline is rendered inline in AppHeader
// (under the prominent logo at 10 px, italic serif, slightly indented to
// the right). AppHeaderTagline still exists for callers that want the
// stand-alone component; AppHeader itself no longer mounts it.
import { APP_HEADER_TAGLINE_TEXT } from './AppHeaderTagline';

interface Props {
  /** Called when the user taps the logo / brand area. */
  onHomePress?: () => void;
  /** Optional content rendered at the right edge of the header. */
  rightSlot?: React.ReactNode;
  /**
   * NAV-HEADER-INLINE-001 — optional primary-navigation content rendered
   * INSIDE the masthead container (not as a separate strip beneath it).
   * When provided, the header lays out as a single cohesive nav bar:
   * the large logo + tagline lockup on the left and the navSlot inline
   * to its right, sharing one header container + one bottom hairline.
   *
   * The slot is intentionally a `React.ReactNode` so the shell (which
   * owns the in-memory nav state) supplies the wired `AppPrimaryNav`.
   * AppHeader stays state-only — it positions the slot, it does not own
   * navigation. The TL-003 / COMPOSER-002 no-route invariant is therefore
   * unaffected: this prop carries a presentational node, never a router.
   */
  navSlot?: React.ReactNode;
  /**
   * Inject the resolved asset module for testing. The default uses the
   * canonical PNG at `assets/branding/civic-discourse-logo.png`.
   */
  logoSource?: React.ComponentProps<typeof Image>['source'];
}

// Hoist the default require so the bundler resolves the asset once.
const DEFAULT_LOGO = require('../../assets/branding/civic-discourse-logo.png');

// BRAND-001 — composed accessibility label for screen readers. The
// home pressable groups the logo + tagline into a single utterance so
// VoiceOver / TalkBack reads "CivilDiscourse, A high-trust room for
// hard conversations., button" exactly once.
const HOME_ACCESSIBILITY_LABEL = `CivilDiscourse, ${APP_HEADER_TAGLINE_TEXT}`;

/**
 * UX-001.1 — Per-band `minWidth` for the home pressable. Makes the
 * brand+nav group visibly larger on tablet+wide. All three values
 * meet the 44dp horizontal hit-target bar with the 8dp left+right
 * hitSlop (120+16, 200+16, 240+16 all >= 44).
 */
function getHomePressableMinWidth(band: Band): number {
  switch (band) {
    case 'phone':
      return 120;
    case 'tablet':
      return 200;
    case 'wide':
      return 240;
  }
}

// Operator request 2026-05-26: render the logo at ≥3× its prior wide-band
// size and keep it uniform across every breakpoint. Implemented locally
// here (NOT in BRAND.logoHeightByBand / BRAND.headerHeightByBand) so the
// design-system constants — and the 50+ tests pinning them — stay
// untouched. The breakpoint hook still drives `band` (for tagline layout
// + home-pressable minWidth); only the rendered logo + header heights
// are overridden.
const PROMINENT_LOGO_HEIGHT_PX = 288;
// Tight padding above and below: 4 px top + 4 px bottom = 8 px combined.
// Header total height therefore = 288 + 8 = 296.
const PROMINENT_HEADER_HEIGHT_PX = PROMINENT_LOGO_HEIGHT_PX + 8;

// UX-BRAND-ASSETS-002 — the masthead logo is now the gold horizontal lockup
// (`civic-discourse-logo.png`, 800×260, aspect ≈ 3.077). It is MUCH wider per
// unit height than the prior grey water-scene (3:2 / aspect 1.5). The Image
// renders at width = height × LOGO_ASPECT_RATIO, so at the prominent 288 px
// height the gold lockup would be 288 × 3.077 ≈ 886 px wide — wider than every
// supported viewport (it overflows even a 768 px tablet). The width-cap below
// therefore applies to EVERY band (not just phone, as in UX-MOBILE-001): the
// returned height is capped so its rendered width (height × aspect) can never
// exceed the available header width. Where the prominent height physically
// fits (wide, and tablet from ~1000 px up) the prominent decision is honored
// unchanged; where it would overflow the logo is fitted to the available width
// — preserving the #654 / UX-MOBILE-004 intent (no horizontal overflow, no
// edge gutter, masthead never dominates the first screen).
const LOGO_ASPECT_RATIO = 800 / 260; // ≈ 3.0769 (gold horizontal lockup)
const HEADER_HORIZONTAL_BUDGET_PX = 24; // root paddingHorizontal (12 + 12)
const MIN_PHONE_LOGO_HEIGHT_PX = 64; // still a legible brand mark on a narrow phone
// UX-MOBILE-004 (supersedes the UX-MOBILE-001 phone behavior) — live 390/300
// measurement confirmed #654 removed the body overflow, but the phone masthead
// stayed prominent-but-TALL, eating the mobile first screen ("desktop canvas
// squeezed into mobile"). The logo is product guidance, NOT a fixed-pixel
// mandate: on phone we cap the logo to a COMPACT height so the masthead leaves
// room for the first interactive content, while tablet / wide keep the
// prominent 288px where it fits. Width still never exceeds the viewport.
const MAX_PHONE_LOGO_HEIGHT_PX = 160;

/**
 * Resolve the rendered masthead logo height for a band + viewport width.
 *
 * UX-BRAND-ASSETS-002 — the gold lockup is aspect ≈ 3.077, so the prominent
 * 288 px height would render ≈ 886 px wide and overflow every viewport. The
 * height is therefore capped by the AVAILABLE WIDTH on every band:
 *
 * - Compute `widthFit = floor(available / aspect)` — the tallest height whose
 *   rendered width (height × aspect) still fits the available header width
 *   (viewport − the 24 px header padding budget).
 * - Tablet / wide: height = `min(PROMINENT_LOGO_HEIGHT_PX, widthFit)`. Where
 *   the prominent height fits (wide; tablet once the viewport is wide enough)
 *   the prominent 288 px is honored unchanged; on a narrow tablet the logo is
 *   fitted to the width so it cannot overflow / create an edge gutter.
 * - Phone: height = `clamp(widthFit, MIN_PHONE_LOGO_HEIGHT_PX,
 *   MAX_PHONE_LOGO_HEIGHT_PX)` — a COMPACT cap so the masthead does not
 *   dominate the mobile first screen, with a legibility floor.
 * - A non-positive width (SSR / static first paint) keeps the prominent size;
 *   hydration corrects it (`resolveBand(0) === 'wide'`, so this path is
 *   effectively the wide first paint).
 *
 * The result ALWAYS satisfies `height × LOGO_ASPECT_RATIO <= available` for a
 * positive viewport width (the width-cap never lets the rendered logo exceed
 * the available header width). Pure + deterministic (unit-tested).
 */
export function resolveMastheadLogoHeightPx(band: Band, viewportWidth: number): number {
  if (!(viewportWidth > 0)) return PROMINENT_LOGO_HEIGHT_PX;
  const available = Math.max(0, viewportWidth - HEADER_HORIZONTAL_BUDGET_PX);
  const widthFit = Math.floor(available / LOGO_ASPECT_RATIO);
  if (band !== 'phone') {
    // Tablet / wide: prominent where it fits, else fitted to the width.
    return Math.min(PROMINENT_LOGO_HEIGHT_PX, widthFit);
  }
  // Phone: compact cap + legibility floor, still fitted to the width.
  return Math.max(MIN_PHONE_LOGO_HEIGHT_PX, Math.min(MAX_PHONE_LOGO_HEIGHT_PX, widthFit));
}

export function AppHeader({ onHomePress, rightSlot, navSlot, logoSource }: Props) {
  const source = logoSource ?? DEFAULT_LOGO;
  const { band } = useHeaderBreakpoint();
  // UX-MOBILE-001 — fit the logo to the viewport on phone so its rendered
  // width (height × 1.5) cannot force body-level horizontal scroll. Tablet /
  // wide keep the prominent operator-decided size.
  const { width: viewportWidth } = useWindowDimensions();
  const logoHeightPx = resolveMastheadLogoHeightPx(band, viewportWidth);
  const headerHeightPx = logoHeightPx + 8;
  // Operator request 2026-05-26: the layout is now always stacked — logo
  // on top, tagline tucked underneath. The Stage 2 inline-on-wide layout
  // is retired alongside the band-specific logo sizes.
  const homePressableStyle = [styles.homePressable, { minWidth: getHomePressableMinWidth(band) }];
  const wordmarkFallbackStyle: TextStyle = BRAND.typography.wordmarkFallback[band];

  // NAV-HEADER-INLINE-001 — when the masthead carries the primary nav we
  // reflow on narrow viewports (phone): the brand lockup and the nav stack
  // vertically so the logo / nav / tagline / About / copyright never
  // overlap. On tablet / wide they sit on one row (logo left, nav inline,
  // gear right). With no navSlot the header keeps its fixed prominent
  // height (every prior consumer unchanged).
  const hasNav = navSlot != null;
  const isPhone = band === 'phone';
  const rootStyle = hasNav
    ? [styles.root, styles.rootWithNav, isPhone ? styles.rootWithNavPhone : null]
    : [styles.root, { height: headerHeightPx }];

  return (
    <View
      style={rootStyle}
      accessibilityRole="header"
      accessibilityLabel="CivilDiscourse"
      testID="app-header"
    >
      <Pressable
        onPress={onHomePress}
        accessibilityRole="button"
        accessibilityLabel={HOME_ACCESSIBILITY_LABEL}
        accessibilityHint="Returns to the conversation gallery"
        testID="app-header-home"
        // BRAND-001 Stage 2 / UX-001.1: hitSlop preserves a >= 44 x 44
        // effective touch target across all bands. Phone: 44+8+8=60 vertical,
        // 120+8+8=136 horizontal. Tablet: 80+8+8=96 vertical,
        // 200+8+8=216 horizontal. Wide: 96+8+8=112 vertical,
        // 240+8+8=256 horizontal.
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={homePressableStyle}
      >
        <View style={styles.homeInnerRow}>
          {source ? (
            <Image
              source={source}
              // Operator request 2026-05-26: explicit width (natural 3:2
              // aspect → height × 1.5) prevents react-native-web from
              // sizing the Image element wider than the visible logo
              // and "centering" the logo inside that whitespace.
              style={{
                height: logoHeightPx,
                width: logoHeightPx * LOGO_ASPECT_RATIO,
                // UX-MOBILE-001 — hard cap so the logo can never exceed the
                // viewport width even if the fitted height math is off.
                maxWidth: '100%',
              }}
              resizeMode="contain"
              accessibilityLabel="CivilDiscourse"
              accessible
              testID="app-header-logo-image"
            />
          ) : (
            <Text
              style={[styles.wordmarkFallback, wordmarkFallbackStyle]}
              testID="app-header-logo-fallback"
            >
              CivilDiscourse
            </Text>
          )}
          {/* UX-COPY-001: tagline sits to the RIGHT of the logo,
              anchored to the logo's bottom edge with only a hair of
              horizontal gap. 10 px italic serif. Renders the full
              BRAND.taglineText fixture ("A high-trust room for hard
              conversations.") with no leading-ellipsis fragment prefix
              (the prior "..." fragment was tied to the retired
              "...just get to the bottom of it" copy). */}
          <Text
            accessibilityRole="text"
            testID="app-header-tagline"
            style={styles.taglineInline}
            numberOfLines={1}
            allowFontScaling
          >
            {APP_HEADER_TAGLINE_TEXT}
          </Text>
        </View>
      </Pressable>
      {/* NAV-HEADER-INLINE-001 — the primary navigation lives INSIDE the
          masthead container, inline to the right of the brand lockup
          (tablet / wide) or reflowed beneath it (phone). It shares this
          header's background + bottom hairline, so the logo and the nav
          read as one cohesive, stylized nav bar — not a separate strip
          beneath the header. AppHeader only positions the slot; the
          shell supplies the wired nav. */}
      {hasNav ? (
        <View
          style={[styles.navSlot, isPhone ? styles.navSlotPhone : null]}
          testID="app-header-nav-slot"
        >
          {navSlot}
        </View>
      ) : null}
      <View style={styles.rightSlot} testID="app-header-right-slot">
        {rightSlot ?? null}
      </View>
      <View
        style={styles.divider}
        testID="app-header-divider"
        // Decorative; do not announce as a separate element.
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}

export const APP_HEADER_HEIGHT = BRAND.headerHeightPx;

const styles = StyleSheet.create({
  root: {
    backgroundColor: BRAND.surface.app.bg,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // The hairline divider lives inside the root as an absolutely
    // positioned 1px line so resizing between breakpoints does not
    // shift the layout. No shadow — keeps the header flat and avoids
    // FCP regression on web.
    position: 'relative',
  },
  // NAV-HEADER-INLINE-001 — masthead-with-nav layout. When the header
  // carries the primary nav the fixed prominent height is released so the
  // brand lockup + inline nav (+ tagline + About + copyright) lay out
  // cleanly. On tablet / wide they sit on one row; the navSlot takes the
  // flexible middle space between the logo (left) and the gear (right).
  rootWithNav: {
    height: undefined,
    minHeight: PROMINENT_HEADER_HEIGHT_PX,
    paddingVertical: 4,
    // NAV-HEADER-INLINE-001 follow-up (operator "SHOULD BE HERE" = the TOP
    // masthead band): top-align the logo / nav / gear so the primary nav
    // sits in the top band to the right of the logo, NOT vertically centered
    // mid-height against the tall logo lockup.
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  // Phone reflow: stack the brand lockup on top of the nav so nothing
  // overlaps in the tightest layout budget.
  rootWithNavPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
    minHeight: undefined,
  },
  // The inline nav region. `flex: 1` claims the space between the brand
  // lockup and the right slot on tablet / wide; full width on phone.
  navSlot: {
    flex: 1,
    alignSelf: 'stretch',
    // Top-align the nav bar within the masthead (operator "SHOULD BE HERE" =
    // the top band). A small top inset aligns the bar with the logo's top.
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  navSlotPhone: {
    flex: undefined,
    width: '100%',
  },
  homePressable: {
    // UX-001.1 — `minWidth` now flows in inline per band via
    // getHomePressableMinWidth(band); the StyleSheet entry keeps the
    // shared center-axis justification.
    justifyContent: 'center',
  },
  homeInnerRow: {
    flexDirection: 'row',
    // `flex-end` anchors the tagline against the bottom edge of the
    // (much taller) logo image, so the tagline visually sits at the
    // logo's baseline instead of floating high or hugging the nav bar.
    alignItems: 'flex-end',
  },
  // Operator request 2026-05-26: prominent-logo tagline sits to the
  // RIGHT of the logo (inline, not stacked) at 10 px italic serif,
  // anchored against the logo's bottom edge by `alignItems: 'flex-end'`
  // on the parent row, with a small horizontal gap.
  taglineInline: {
    color: BRAND.text.taglineFg,
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia, "Times New Roman", serif',
    }),
    fontStyle: 'italic',
    fontSize: 10,
    lineHeight: 14,
    paddingLeft: 6,
    paddingBottom: 8,
  },
  // UX-001.1 — color only; per-band fontSize / lineHeight / fontWeight /
  // letterSpacing now come from BRAND.typography.wordmarkFallback[band].
  wordmarkFallback: {
    color: BRAND.text.primary,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: BRAND.accent.creamHairline,
  },
});
