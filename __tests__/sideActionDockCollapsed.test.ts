/**
 * SC-005 — Collapsed-by-default dock behavior.
 *
 * Covers:
 *  - the breakpoint resolver (`resolveObserverDockVariant`),
 *  - the four-way `DockContext` derivation,
 *  - the four collapsed primary labels,
 *  - the narrow-sheet height cap,
 *  - the component's collapsed-by-default contract (source-scan, matching
 *    the repo's component-test pattern in `composerDockA11y.test.ts`).
 */
import fs from 'fs';
import path from 'path';
import {
  resolveObserverDockVariant,
  deriveDockContext,
  buildCollapsedDockLabel,
  resolveSheetMaxHeightPx,
  SHEET_MIN_HEIGHT_PX,
  DOCK_SIDE_BREAKPOINT,
  type DockContext,
} from '../src/features/arguments/ObserverActionDockLayout';

const RAIL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentSideActionRail.tsx'),
  'utf8',
);

// ── 1. resolveObserverDockVariant ───────────────────────────────

describe('SC-005 resolveObserverDockVariant', () => {
  it('narrow viewport (360) resolves to a bottom sheet', () => {
    expect(resolveObserverDockVariant(360)).toBe('sheet');
  });

  it('wide viewport (1024) resolves to the side dock', () => {
    expect(resolveObserverDockVariant(1024)).toBe('side');
  });

  it('width 0 resolves to side (web static-export first paint)', () => {
    expect(resolveObserverDockVariant(0)).toBe('side');
  });

  it('width exactly at the breakpoint (720) resolves to side', () => {
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT)).toBe('side');
  });

  it('width just below the breakpoint (719) resolves to sheet', () => {
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT - 1)).toBe('sheet');
  });

  it('non-finite width (NaN) resolves to side', () => {
    expect(resolveObserverDockVariant(Number.NaN)).toBe('side');
  });

  it('negative width resolves to side', () => {
    expect(resolveObserverDockVariant(-200)).toBe('side');
  });
});

// ── 2. deriveDockContext ────────────────────────────────────────

describe('SC-005 deriveDockContext', () => {
  it('observer with no selected node → observer_no_node', () => {
    expect(deriveDockContext('observer', 'other', false)).toBe('observer_no_node');
    expect(deriveDockContext('observer', 'self', false)).toBe('observer_no_node');
    expect(deriveDockContext('observer', 'bot', false)).toBe('observer_no_node');
  });

  it('observer with a selected node → observer_node (for any bubbleActor)', () => {
    expect(deriveDockContext('observer', 'other', true)).toBe('observer_node');
    expect(deriveDockContext('observer', 'self', true)).toBe('observer_node');
    expect(deriveDockContext('observer', 'admin', true)).toBe('observer_node');
  });

  it('participant on own bubble → participant_own (regardless of selection)', () => {
    expect(deriveDockContext('participant', 'self', false)).toBe('participant_own');
    expect(deriveDockContext('participant', 'self', true)).toBe('participant_own');
  });

  it('participant on another bubble → participant_other (regardless of selection)', () => {
    expect(deriveDockContext('participant', 'other', false)).toBe('participant_other');
    expect(deriveDockContext('participant', 'bot', true)).toBe('participant_other');
    expect(deriveDockContext('participant', 'admin', false)).toBe('participant_other');
    expect(deriveDockContext('participant', 'unknown', true)).toBe('participant_other');
  });
});

// ── 3. buildCollapsedDockLabel — the four primary strings ────────

describe('SC-005 buildCollapsedDockLabel', () => {
  const expected: Record<DockContext, string> = {
    observer_no_node: 'Watch',
    observer_node: 'Actions on this point',
    participant_own: 'On your message',
    participant_other: 'Reply',
  };

  it('returns the four collapsed primary strings per the issue scope', () => {
    for (const ctx of Object.keys(expected) as DockContext[]) {
      expect(buildCollapsedDockLabel(ctx).primary).toBe(expected[ctx]);
    }
  });

  it('every label carries a non-empty accessibilityLabel + accessibilityHint', () => {
    for (const ctx of Object.keys(expected) as DockContext[]) {
      const label = buildCollapsedDockLabel(ctx);
      expect(label.accessibilityLabel.length).toBeGreaterThan(0);
      expect(label.accessibilityHint.length).toBeGreaterThan(0);
    }
  });

  it('the caret glyph is NOT stored in the primary string (component appends it)', () => {
    for (const ctx of Object.keys(expected) as DockContext[]) {
      expect(buildCollapsedDockLabel(ctx).primary).not.toContain('▾');
      expect(buildCollapsedDockLabel(ctx).primary).not.toContain('▴');
    }
  });
});

// ── 4. resolveSheetMaxHeightPx ──────────────────────────────────

describe('SC-005 resolveSheetMaxHeightPx', () => {
  it('returns ~28% of a normal viewport height', () => {
    expect(resolveSheetMaxHeightPx(800)).toBe(Math.round(800 * 0.28));
  });

  it('never returns a value >= the viewport height (never full-screen)', () => {
    for (const h of [200, 400, 600, 800, 1200]) {
      expect(resolveSheetMaxHeightPx(h)).toBeLessThan(h);
    }
  });

  it('clamps up to the floor on a short device so the sheet stays usable', () => {
    // 28% of 400 = 112 < 168 floor → clamps to 168, still < 400.
    expect(resolveSheetMaxHeightPx(400)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(400)).toBeLessThan(400);
  });

  it('returns the floor for a non-positive / non-finite height', () => {
    expect(resolveSheetMaxHeightPx(0)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(-100)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(Number.NaN)).toBe(SHEET_MIN_HEIGHT_PX);
  });

  it('stays strictly below even a viewport shorter than the floor', () => {
    // 150 < 168 floor — the cap must still leave a visible board slice.
    const h = resolveSheetMaxHeightPx(150);
    expect(h).toBeLessThan(150);
    expect(h).toBeGreaterThan(0);
  });
});

// ── 5. Collapsed-by-default component contract (source-scan) ─────

describe('SC-005 rail — collapsed-by-default contract', () => {
  it('observers default collapsed; participants default expanded (Stage 6.4 rule preserved)', () => {
    expect(RAIL_SRC).toMatch(/defaultCollapsed\s*\?\?\s*\(viewerRole\s*===\s*['"]observer['"]\)/);
  });

  it('collapse state is local UI state (useState), not a route transition', () => {
    expect(RAIL_SRC).toMatch(/useState\(initialCollapsed\)/);
    expect(RAIL_SRC).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(RAIL_SRC).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(RAIL_SRC).not.toMatch(/\bnavigation\.navigate\s*\(/);
  });

  it('the collapsed chip text is the context-derived primary label + caret', () => {
    // collapsedLabel.primary is rendered, then the caret glyph appended.
    expect(RAIL_SRC).toMatch(/collapsedLabel\.primary/);
    expect(RAIL_SRC).toMatch(/▾/);
  });

  it('expanding the dock notifies the parent (onExpandedChange) for mutual exclusion', () => {
    expect(RAIL_SRC).toMatch(/onExpandedChange/);
  });

  it('the dock force-collapses while another panel is open (isAnyPanelOpen)', () => {
    // `expanded` is derived as `!collapsed && !isAnyPanelOpen`.
    expect(RAIL_SRC).toMatch(/!collapsed\s*&&\s*!isAnyPanelOpen/);
  });

  it('changing the selected node does not appear in any auto-collapse effect', () => {
    // Expanded state must persist across node-selection changes — there is
    // no effect that calls setCollapsed(true) on activeMessageId change.
    expect(RAIL_SRC).not.toMatch(/activeMessageId[\s\S]{0,120}setCollapsed\(true\)/);
  });
});
