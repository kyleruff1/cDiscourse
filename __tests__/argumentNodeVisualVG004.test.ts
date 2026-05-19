/**
 * VG-004 — Timeline node visual polish tests.
 *
 * A pure / style-rule test suite, consistent with `BranchCollapseStub.
 * test.tsx` and `railSegmentModel.test.ts`. The repo's timeline tests do
 * NOT call React-Testing-Library `render()` — all new visual logic is
 * extracted into pure helpers so it is unit-testable without a renderer,
 * plus a source-scan over `ArgumentTimelineMap.tsx` for invariants.
 *
 * Doctrine ban-list assertions (groups 7 + 8) are mandatory because the
 * card touches user-facing accessibility strings.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ALL_TIMELINE_DENSITY_MODES,
  NODE_GLOW_SHADOW_RADIUS_PX,
  NODE_GLOW_STROKE_WIDTH_PX,
  NODE_HALO_RING_WIDTH_PX,
  NODE_TONE_TINT_MAX_ALPHA,
  TIMELINE_NODE_GAP_BY_DENSITY,
  deriveTimelineNodeVisualStyle,
  resolveNodeGapPx,
  type DeriveTimelineNodeVisualInput,
  type TimelineDensityMode,
} from '../src/features/arguments/timelineNodeVisualModel';
import {
  buildArgumentTimelineMap,
  TIMELINE_NODE_GAP,
  type ArgumentMessageInput,
  type TimelineTemperatureBand,
  type TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { buildBranchCollapseStubLabelParts } from '../src/features/arguments/BranchCollapseStub';
import type { RailStubViewModel } from '../src/features/arguments/branchTopologyModel';
import { GLOW, RECEIPT_MARK, ARGUMENT, BRAND } from '../src/lib/designTokens';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Ban-list ─────────────────────────────────────────────────────

const VERDICT_TOKENS: ReadonlyArray<string> = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'proven',
  'disproven',
  'winning',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'verdict',
  'right',
  'wrong',
];

const AMPLIFICATION_TOKENS: ReadonlyArray<string> = [
  'viral',
  'trending',
  'likes',
  'retweets',
  'shares',
  'followers',
  'verified',
  'engagement',
  'amplification',
  'popular',
];

function assertNoBanned(s: string, tokens: ReadonlyArray<string>) {
  const lower = s.toLowerCase();
  for (const t of tokens) {
    expect(lower.includes(t.toLowerCase())).toBe(false);
  }
}

// ── Fixture builders ─────────────────────────────────────────────

const ALL_TONE_BANDS: ReadonlyArray<TimelineToneBand> = [
  'calm',
  'measured',
  'heated',
  'hostile',
  'unknown',
];

const ALL_TEMPERATURE_BANDS: ReadonlyArray<TimelineTemperatureBand> = [
  'cool',
  'mild',
  'warm',
  'hot',
  'unknown',
];

function visualInput(
  over: Partial<DeriveTimelineNodeVisualInput> = {},
): DeriveTimelineNodeVisualInput {
  return {
    isActive: over.isActive ?? false,
    isActivePath: over.isActivePath ?? false,
    isSelected: over.isSelected ?? false,
    toneBand: over.toneBand ?? 'calm',
    temperatureBand: over.temperatureBand ?? 'cool',
    hasEvidenceArtifact: over.hasEvidenceArtifact ?? false,
    prefersReducedMotion: over.prefersReducedMotion ?? false,
  };
}

function fakeStub(over: Partial<RailStubViewModel> = {}): RailStubViewModel {
  return {
    stubId: over.stubId ?? 'stub-br',
    branchRootMessageId: over.branchRootMessageId ?? 'br',
    anchorX: over.anchorX ?? 250,
    anchorY: over.anchorY ?? 120,
    hiddenMessageCount: over.hiddenMessageCount ?? 3,
    label: over.label ?? '+3',
    accessibilityLabel:
      over.accessibilityLabel ??
      '3 hidden replies on the side branch. Tap to expand.',
    containsActive: over.containsActive ?? false,
    borderColor: over.borderColor ?? '#06b6d4',
  };
}

let msgClock = 0;
function msg(over: Partial<ArgumentMessageInput> = {}): ArgumentMessageInput {
  msgClock += 1;
  return {
    id: over.id ?? `m${msgClock}`,
    debateId: over.debateId ?? 'debate-1',
    parentId: over.parentId ?? null,
    authorId: over.authorId ?? 'u1',
    side: over.side ?? 'for',
    argumentType: over.argumentType ?? 'claim',
    body: over.body ?? 'A reasonable argument body.',
    createdAt:
      over.createdAt ?? new Date(1_700_000_000_000 + msgClock * 1000).toISOString(),
    updatedAt: over.updatedAt,
  };
}

// ── 1. resolveNodeGapPx ──────────────────────────────────────────

describe('VG-004 — resolveNodeGapPx', () => {
  it('undefined density resolves to 44 (the normal default)', () => {
    expect(resolveNodeGapPx(undefined)).toBe(44);
  });

  it("'normal' resolves to 44", () => {
    expect(resolveNodeGapPx('normal')).toBe(44);
  });

  it("'compact' resolves to 28", () => {
    expect(resolveNodeGapPx('compact')).toBe(28);
  });

  it("'expanded' resolves to 64", () => {
    expect(resolveNodeGapPx('expanded')).toBe(64);
  });

  it('every density mode resolves to a positive integer', () => {
    for (const mode of ALL_TIMELINE_DENSITY_MODES) {
      const gap = resolveNodeGapPx(mode);
      expect(Number.isInteger(gap)).toBe(true);
      expect(gap).toBeGreaterThan(0);
    }
  });

  it('the gap lookup matches the resolver for every mode', () => {
    for (const mode of ALL_TIMELINE_DENSITY_MODES) {
      expect(resolveNodeGapPx(mode)).toBe(TIMELINE_NODE_GAP_BY_DENSITY[mode]);
    }
  });
});

// ── 2. deriveTimelineNodeVisualStyle — glow ──────────────────────

describe('VG-004 — deriveTimelineNodeVisualStyle: glow', () => {
  it('active node → glowTier active_node, stroke 2', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput({ isActive: true, isActivePath: true }));
    expect(v.glowTier).toBe('active_node');
    expect(v.glowStrokeWidthPx).toBe(2);
  });

  it('active-path-not-active node → glowTier active_path, stroke 2', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActive: false, isActivePath: true }),
    );
    expect(v.glowTier).toBe('active_path');
    expect(v.glowStrokeWidthPx).toBe(2);
  });

  it('off-path node → glowTier none, stroke 0', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActive: false, isActivePath: false }),
    );
    expect(v.glowTier).toBe('none');
    expect(v.glowStrokeWidthPx).toBe(0);
  });

  it('reduce-motion ON → shadow radius 0 but stroke stays 2 (stroke-only fallback)', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActive: true, isActivePath: true, prefersReducedMotion: true }),
    );
    expect(v.glowShadowRadiusPx).toBe(0);
    expect(v.glowStrokeWidthPx).toBe(2);
  });

  it('reduce-motion OFF → shadow radius 12 on a glowing node', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActive: true, isActivePath: true, prefersReducedMotion: false }),
    );
    expect(v.glowShadowRadiusPx).toBe(12);
  });

  it('off-path node has shadow 0 regardless of reduce-motion', () => {
    for (const reduced of [false, true]) {
      const v = deriveTimelineNodeVisualStyle(
        visualInput({ isActivePath: false, prefersReducedMotion: reduced }),
      );
      expect(v.glowShadowRadiusPx).toBe(0);
    }
  });
});

// ── 3. deriveTimelineNodeVisualStyle — halo ──────────────────────

describe('VG-004 — deriveTimelineNodeVisualStyle: halo', () => {
  it('selected node → haloRingWidthPx 3', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput({ isSelected: true }));
    expect(v.haloRingWidthPx).toBe(3);
  });

  it('not-selected node → haloRingWidthPx 0', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput({ isSelected: false }));
    expect(v.haloRingWidthPx).toBe(0);
  });

  it('active AND selected → glow active_node and halo 3 co-exist', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActive: true, isActivePath: true, isSelected: true }),
    );
    expect(v.glowTier).toBe('active_node');
    expect(v.haloRingWidthPx).toBe(3);
  });

  it('reduce-motion does not change halo width (halo is a static stroke)', () => {
    const on = deriveTimelineNodeVisualStyle(
      visualInput({ isSelected: true, prefersReducedMotion: true }),
    );
    const off = deriveTimelineNodeVisualStyle(
      visualInput({ isSelected: true, prefersReducedMotion: false }),
    );
    expect(on.haloRingWidthPx).toBe(off.haloRingWidthPx);
    expect(on.haloRingWidthPx).toBe(3);
  });
});

// ── 4. deriveTimelineNodeVisualStyle — receipt mark ──────────────

describe('VG-004 — deriveTimelineNodeVisualStyle: receipt mark', () => {
  it('hasEvidenceArtifact true → showsReceiptMark true', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput({ hasEvidenceArtifact: true }));
    expect(v.showsReceiptMark).toBe(true);
  });

  it('hasEvidenceArtifact false → showsReceiptMark false', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput({ hasEvidenceArtifact: false }));
    expect(v.showsReceiptMark).toBe(false);
  });

  it('detached node (off-path) with an artifact still shows the receipt mark', () => {
    // Detached nodes are never on the active path, but evidence can be
    // attached to a detached move — the mark must still render.
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActivePath: false, hasEvidenceArtifact: true }),
    );
    expect(v.showsReceiptMark).toBe(true);
    expect(v.glowTier).toBe('none');
    expect(v.toneTint).toBeNull();
  });
});

// ── 5. deriveTimelineNodeVisualStyle — tone tint ─────────────────

describe('VG-004 — deriveTimelineNodeVisualStyle: tone tint', () => {
  it('active-path node → toneTint non-null with alpha ≤ 0.18', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput({ isActivePath: true }));
    expect(v.toneTint).not.toBeNull();
    expect(v.toneTint!.alpha).toBeLessThanOrEqual(NODE_TONE_TINT_MAX_ALPHA);
  });

  it('non-active-path node → toneTint null (card item 5, doctrine)', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput({ isActivePath: false }));
    expect(v.toneTint).toBeNull();
  });

  it('detached (off-path) node → toneTint null', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActivePath: false, toneBand: 'hostile', temperatureBand: 'hot' }),
    );
    expect(v.toneTint).toBeNull();
  });

  it('tint color comes from the VG-002 tone-band hue table', () => {
    const expected: Record<TimelineToneBand, string> = {
      calm: '#22c55e',
      measured: '#3b82f6',
      heated: '#f97316',
      hostile: '#ef4444',
      unknown: '#94a3b8',
    };
    for (const tone of ALL_TONE_BANDS) {
      const v = deriveTimelineNodeVisualStyle(
        visualInput({ isActivePath: true, toneBand: tone }),
      );
      expect(v.toneTint).not.toBeNull();
      expect(v.toneTint!.color).toBe(expected[tone]);
    }
  });

  it('alpha never exceeds the cap for any temperature band', () => {
    for (const temp of ALL_TEMPERATURE_BANDS) {
      const v = deriveTimelineNodeVisualStyle(
        visualInput({ isActivePath: true, temperatureBand: temp }),
      );
      expect(v.toneTint).not.toBeNull();
      expect(v.toneTint!.alpha).toBeLessThanOrEqual(NODE_TONE_TINT_MAX_ALPHA);
      expect(v.toneTint!.alpha).toBeGreaterThan(0);
    }
  });
});

// ── 6. Doctrine — glow/halo are strength-independent ─────────────

describe('VG-004 — doctrine: glow/halo never read strength', () => {
  it('two nodes differing only in tone/temperature get identical glow + halo', () => {
    const base = deriveTimelineNodeVisualStyle(
      visualInput({
        isActive: true,
        isActivePath: true,
        isSelected: true,
        toneBand: 'calm',
        temperatureBand: 'cool',
      }),
    );
    const heated = deriveTimelineNodeVisualStyle(
      visualInput({
        isActive: true,
        isActivePath: true,
        isSelected: true,
        toneBand: 'hostile',
        temperatureBand: 'hot',
      }),
    );
    expect(heated.glowTier).toBe(base.glowTier);
    expect(heated.glowStrokeWidthPx).toBe(base.glowStrokeWidthPx);
    expect(heated.glowShadowRadiusPx).toBe(base.glowShadowRadiusPx);
    expect(heated.haloRingWidthPx).toBe(base.haloRingWidthPx);
  });

  it('the only field that may differ when tone changes is toneTint', () => {
    const calm = deriveTimelineNodeVisualStyle(
      visualInput({ isActivePath: true, toneBand: 'calm', temperatureBand: 'cool' }),
    );
    const hot = deriveTimelineNodeVisualStyle(
      visualInput({ isActivePath: true, toneBand: 'hostile', temperatureBand: 'hot' }),
    );
    // Everything except toneTint is identical.
    expect({ ...hot, toneTint: null }).toEqual({ ...calm, toneTint: null });
    expect(hot.toneTint).not.toEqual(calm.toneTint);
  });

  it('glow tier is driven only by navigation state, not tone', () => {
    for (const tone of ALL_TONE_BANDS) {
      for (const temp of ALL_TEMPERATURE_BANDS) {
        const v = deriveTimelineNodeVisualStyle(
          visualInput({ isActivePath: false, toneBand: tone, temperatureBand: temp }),
        );
        expect(v.glowTier).toBe('none');
        expect(v.haloRingWidthPx).toBe(0);
      }
    }
  });
});

// ── 7. Doctrine ban-list on accessibilityFragment ────────────────

describe('VG-004 — doctrine ban-list: accessibilityFragment', () => {
  function allFragments(): string[] {
    const out: string[] = [];
    for (const isActive of [false, true]) {
      for (const isActivePath of [false, true]) {
        for (const isSelected of [false, true]) {
          for (const hasEvidenceArtifact of [false, true]) {
            for (const prefersReducedMotion of [false, true]) {
              for (const toneBand of ALL_TONE_BANDS) {
                for (const temperatureBand of ALL_TEMPERATURE_BANDS) {
                  const v = deriveTimelineNodeVisualStyle({
                    isActive,
                    isActivePath,
                    isSelected,
                    hasEvidenceArtifact,
                    prefersReducedMotion,
                    toneBand,
                    temperatureBand,
                  });
                  out.push(v.accessibilityFragment);
                }
              }
            }
          }
        }
      }
    }
    return out;
  }

  it('no accessibilityFragment contains a verdict token', () => {
    for (const fragment of allFragments()) {
      assertNoBanned(fragment, VERDICT_TOKENS);
    }
  });

  it('no accessibilityFragment contains an amplification token', () => {
    for (const fragment of allFragments()) {
      assertNoBanned(fragment, AMPLIFICATION_TOKENS);
    }
  });

  it('no accessibilityFragment looks like an internal code', () => {
    for (const fragment of allFragments()) {
      expect(looksLikeInternalCode(fragment)).toBe(false);
    }
  });

  it('fragment lists active and selected together without contradiction', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActive: true, isActivePath: true, isSelected: true }),
    );
    expect(v.accessibilityFragment).toContain('active move');
    expect(v.accessibilityFragment).toContain('selected');
  });

  it('fragment is empty when no added state applies', () => {
    const v = deriveTimelineNodeVisualStyle(visualInput());
    expect(v.accessibilityFragment).toBe('');
  });
});

// ── 8. buildBranchCollapseStubLabelParts ─────────────────────────

describe('VG-004 — buildBranchCollapseStubLabelParts', () => {
  it('returns a non-empty glyph and the verbatim count text', () => {
    const parts = buildBranchCollapseStubLabelParts(fakeStub({ label: '+7' }));
    expect(parts.glyph.length).toBeGreaterThan(0);
    expect(parts.countText).toBe('+7');
  });

  it('glyph is a single visible character', () => {
    const parts = buildBranchCollapseStubLabelParts(fakeStub());
    expect([...parts.glyph]).toHaveLength(1);
    expect(parts.glyph.trim().length).toBeGreaterThan(0);
  });

  it('glyph and countText carry zero verdict / amplification / internal-code tokens', () => {
    for (const label of ['+1', '+2', '+3', '+12', '+99']) {
      const parts = buildBranchCollapseStubLabelParts(fakeStub({ label }));
      assertNoBanned(parts.glyph, VERDICT_TOKENS);
      assertNoBanned(parts.glyph, AMPLIFICATION_TOKENS);
      assertNoBanned(parts.countText, VERDICT_TOKENS);
      assertNoBanned(parts.countText, AMPLIFICATION_TOKENS);
      expect(looksLikeInternalCode(parts.glyph)).toBe(false);
      expect(looksLikeInternalCode(parts.countText)).toBe(false);
    }
  });
});

// ── 9. Token assertions ──────────────────────────────────────────

describe('VG-004 — GLOW / RECEIPT_MARK tokens', () => {
  it('GLOW.activePath has the card-literal 2px stroke / 12px shadow', () => {
    expect(GLOW.activePath.strokeWidthPx).toBe(2);
    expect(GLOW.activePath.shadowRadiusPx).toBe(12);
  });

  it('GLOW.selectedHalo has the card-literal 3px ring and reuses BRAND cream', () => {
    expect(GLOW.selectedHalo.ringWidthPx).toBe(3);
    expect(GLOW.selectedHalo.color).toBe(BRAND.accent.cream);
  });

  it('RECEIPT_MARK reuses the ARGUMENT.evidence color family (no new color)', () => {
    expect(RECEIPT_MARK.color).toBe(ARGUMENT.evidence.bg);
    expect(RECEIPT_MARK.innerColor).toBe(ARGUMENT.evidence.fg);
  });

  it('the derived helper constants match the GLOW token block', () => {
    expect(NODE_GLOW_STROKE_WIDTH_PX).toBe(GLOW.activePath.strokeWidthPx);
    expect(NODE_GLOW_SHADOW_RADIUS_PX).toBe(GLOW.activePath.shadowRadiusPx);
    expect(NODE_HALO_RING_WIDTH_PX).toBe(GLOW.selectedHalo.ringWidthPx);
  });
});

// ── 10. Source-scan invariants on ArgumentTimelineMap.tsx ────────

describe('VG-004 — ArgumentTimelineMap.tsx source-scan invariants', () => {
  const source = readFileSync(
    join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentTimelineMap.tsx'),
    'utf8',
  );

  it('reads AccessibilityInfo.isReduceMotionEnabled (reduce-motion gate exists)', () => {
    expect(source).toContain('AccessibilityInfo');
    expect(source).toContain('isReduceMotionEnabled');
  });

  it('does not import react-native-svg (no new dependency)', () => {
    // The file header comment mentions react-native-svg as the dep we
    // deliberately avoid — assert there is no actual import statement.
    expect(/^import[^\n]*['"]react-native-svg['"]/m.test(source)).toBe(false);
    expect(/from ['"]react-native-svg['"]/.test(source)).toBe(false);
  });

  it('uses the pure deriveTimelineNodeVisualStyle helper (no inline magic)', () => {
    expect(source).toContain('deriveTimelineNodeVisualStyle');
  });
});

// ── 11. VG-001 contract preserved ────────────────────────────────

describe('VG-004 — VG-001 kind-color contract preserved', () => {
  it('the helper output never carries a fill/kind color key', () => {
    const v = deriveTimelineNodeVisualStyle(
      visualInput({ isActive: true, isActivePath: true, hasEvidenceArtifact: true }),
    );
    expect(v).not.toHaveProperty('fillColor');
    expect(v).not.toHaveProperty('kindColor');
    expect(v).not.toHaveProperty('backgroundColor');
  });

  it('the glow and receipt mark are additive layers, not a fill override', () => {
    // The helper only returns stroke/shadow/halo/tint/mark fields — the
    // node fill stays the source of type-by-color (VG-001).
    const v = deriveTimelineNodeVisualStyle(visualInput({ isActivePath: true }));
    expect(Object.keys(v).sort()).toEqual(
      [
        'accessibilityFragment',
        'glowShadowRadiusPx',
        'glowStrokeWidthPx',
        'glowTier',
        'haloRingWidthPx',
        'showsReceiptMark',
        'toneTint',
      ].sort(),
    );
  });
});

// ── 12. Density does not move the active node ────────────────────

describe('VG-004 — density preserves the active node', () => {
  function buildMapAt(density: TimelineDensityMode) {
    msgClock = 0;
    const messages: ArgumentMessageInput[] = [
      msg({ id: 'r', argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', argumentType: 'rebuttal' }),
      msg({ id: 'b', parentId: 'a', argumentType: 'claim' }),
      msg({ id: 'c', parentId: 'b', argumentType: 'claim' }),
    ];
    return buildArgumentTimelineMap({
      messages,
      currentUserId: 'me',
      activeMessageId: 'b',
      density,
    });
  }

  it('compact vs expanded keep identical node id order and active node', () => {
    const compact = buildMapAt('compact');
    const expanded = buildMapAt('expanded');
    expect(compact.nodes.map((n) => n.messageId)).toEqual(
      expanded.nodes.map((n) => n.messageId),
    );
    expect(compact.activeNode?.messageId).toBe('b');
    expect(expanded.activeNode?.messageId).toBe('b');
  });

  it('only the x coordinate differs between density presets', () => {
    const compact = buildMapAt('compact');
    const expanded = buildMapAt('expanded');
    for (let i = 0; i < compact.nodes.length; i += 1) {
      expect(compact.nodes[i].messageId).toBe(expanded.nodes[i].messageId);
      expect(compact.nodes[i].ordinal).toBe(expanded.nodes[i].ordinal);
      // Expanded spacing (64px gap) is wider than compact (28px gap),
      // so non-root nodes drift further right.
      if (i > 0) {
        expect(expanded.nodes[i].x).toBeGreaterThan(compact.nodes[i].x);
      }
    }
  });

  it('omitting density uses the normal default (gap 44)', () => {
    msgClock = 0;
    const messages: ArgumentMessageInput[] = [
      msg({ id: 'r', argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', argumentType: 'rebuttal' }),
    ];
    const withDefault = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    msgClock = 0;
    const messagesB: ArgumentMessageInput[] = [
      msg({ id: 'r', argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', argumentType: 'rebuttal' }),
    ];
    const withNormal = buildArgumentTimelineMap({
      messages: messagesB,
      currentUserId: 'me',
      density: 'normal',
    });
    expect(withDefault.nodes.map((n) => n.x)).toEqual(
      withNormal.nodes.map((n) => n.x),
    );
    // TIMELINE_NODE_GAP is the 'normal' default — kept consistent.
    expect(TIMELINE_NODE_GAP).toBe(44);
  });
});
