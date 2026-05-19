/**
 * SC-003 — ArgumentReplySidecar component contract tests.
 *
 * Follows the repo convention (see BranchCollapseStub.test.tsx): the
 * tests are static source scans + builder-level invariants rather than
 * react-test-renderer invocations. The component itself is a thin
 * presentation layer; its behavior is fully expressed in the view model
 * (covered in `argumentReplySidecarModel.test.ts`).
 *
 * The scans enforce the SC-003 ↔ SC-004 boundary at the source level:
 *
 *   - The component does NOT import or reference SC-004's action
 *     vocabulary.
 *   - The component does NOT render a body-edit affordance (no
 *     `<TextInput editable>`, no `onChangeText`).
 *   - The component does NOT carry an `onAction` / `onPress` external
 *     callback prop.
 *   - The component does NOT render raw snake_case codes — the only
 *     interpolated `testID` snake_case patterns are allowed because
 *     testIDs are non-rendered (they go through `accessibilityIdentifier`
 *     / `nativeID` but are not text shown to users).
 */
import fs from 'fs';
import path from 'path';

const COMPONENT_PATH = path.join(
  process.cwd(),
  'src',
  'features',
  'arguments',
  'ArgumentReplySidecar.tsx',
);

function readSource(): string {
  return fs.readFileSync(COMPONENT_PATH, 'utf8');
}

// ── 1. No reference to SC-004's action vocabulary ─────────────

describe('SC-003 — component source: no SC-004 action references', () => {
  const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
    /timelineNodeActionDockModel/,
    /TimelineNodeActionDockActionCode/,
    /actionDockToComposerPreset/,
    /quickActionPresets/,
    /quickActionToPreset/,
    /MoveDraftPatch/,
    /\bSUBMIT\b/,
  ];

  it.each(FORBIDDEN_PATTERNS)(
    'component does not contain pattern %s',
    (pattern) => {
      const src = readSource();
      expect(src).not.toMatch(pattern);
    },
  );
});

// ── 2. No action callback / dispatch prop ─────────────────────

describe('SC-003 — component source: no external action callback', () => {
  it('does not declare an onAction prop in its Props interface', () => {
    const src = readSource();
    // The component's `Props` interface should expose only `viewModel`.
    // We scan for `onAction`, `dispatch`, `onAct`, etc. in any
    // identifier position.
    expect(src).not.toMatch(/\bonAction\b/);
    expect(src).not.toMatch(/\bdispatch\b/);
    expect(src).not.toMatch(/\bonActionDockAction\b/);
  });

  it('does not contain an `actionsRow` style or container', () => {
    const src = readSource();
    expect(src).not.toMatch(/actionsRow/);
    expect(src).not.toMatch(/actionChip[^L]/); // allow other tokens that contain 'action' word fragments
  });

  it('does not contain `OTHER_ACTIONS` or `SELF_ACTIONS` arrays', () => {
    const src = readSource();
    expect(src).not.toMatch(/OTHER_ACTIONS/);
    expect(src).not.toMatch(/SELF_ACTIONS/);
  });
});

// ── 3. Body-edit ban ──────────────────────────────────────────

describe('SC-003 — component source: body editing is forbidden', () => {
  it('does not import or reference TextInput', () => {
    const src = readSource();
    expect(src).not.toMatch(/\bTextInput\b/);
  });

  it('does not declare onChangeText / onSubmitEditing handlers', () => {
    const src = readSource();
    expect(src).not.toMatch(/onChangeText/);
    expect(src).not.toMatch(/onSubmitEditing/);
  });

  it('does not include an `editable` prop', () => {
    const src = readSource();
    expect(src).not.toMatch(/\beditable=/);
  });
});

// ── 4. Component prop surface ─────────────────────────────────

describe('SC-003 — component source: prop contract', () => {
  it('only accepts a `viewModel` prop on the Props interface', () => {
    const src = readSource();
    // Crude AST-free scan: every `function ArgumentReplySidecar(props ...)` line
    // should destructure exactly `viewModel`.
    expect(src).toMatch(/export function ArgumentReplySidecar\(\{\s*viewModel\s*\}/);
  });
});

// ── 5. testID preserved ───────────────────────────────────────

describe('SC-003 — component source: testID preserved', () => {
  it('emits the `argument-reply-sidecar` root testID', () => {
    const src = readSource();
    expect(src).toMatch(/testID="argument-reply-sidecar"/);
  });
});

// ── 6. Accessibility on the Show-details toggle ───────────────

describe('SC-003 — component source: accessibility on Show details', () => {
  it('Show details Pressable has accessibilityRole + accessibilityLabel + hitSlop', () => {
    const src = readSource();
    // The button is the only interactive in the component.
    expect(src).toMatch(/accessibilityRole="button"/);
    expect(src).toMatch(/accessibilityLabel="Show flag details"/);
    expect(src).toMatch(/hitSlop=\{SHOW_DETAILS_HIT_SLOP\}/);
  });

  it('hitSlop constant resolves to a symmetric ≥ 8px slop (so total tap target reaches 44+ visual+slop budget)', () => {
    const src = readSource();
    // Constant declaration shape — quick sanity grep.
    expect(src).toMatch(/SHOW_DETAILS_HIT_SLOP = \{ top: 8, bottom: 8, left: 8, right: 8 \}/);
  });
});

// ── 7. Snake_case rendering ban (text children) ───────────────

describe('SC-003 — component source: no snake_case rendered tokens', () => {
  it('no <Text> child literal contains snake_case (interpolations are fine)', () => {
    const src = readSource();
    // Crude heuristic: any literal `<Text ...>foo_bar</Text>` (no
    // braces) is forbidden. Interpolations like `<Text>{x}</Text>` go
    // through the view-model (where the model tests assert no
    // snake_case sneaks through).
    const textChildMatches = src.match(/<Text[^>]*>([^<{}]+)<\/Text>/g) ?? [];
    for (const m of textChildMatches) {
      const inner = m.replace(/^<Text[^>]*>/, '').replace(/<\/Text>$/, '');
      expect(/[a-z]{2,}_[a-z]{2,}/.test(inner)).toBe(false);
    }
  });
});

// ── 8. No router / navigation primitives ──────────────────────

describe('SC-003 — component source: no router/navigation', () => {
  const ROUTING_PATTERNS: RegExp[] = [
    /from\s+['"]@react-navigation\/[^'"]+['"]/,
    /from\s+['"]expo-router['"]/,
    /from\s+['"]react-router(?:-native|-dom)?['"]/,
    /\bnavigation\.(navigate|push|replace|reset)\s*\(/,
    /\brouter\.(push|replace)\s*\(/,
  ];

  it.each(ROUTING_PATTERNS)('component does not contain %s', (re) => {
    const src = readSource();
    expect(src).not.toMatch(re);
  });
});
