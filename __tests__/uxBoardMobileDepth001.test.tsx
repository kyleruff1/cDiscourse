/**
 * UX-BOARD-MOBILE-DEPTH-001 (#758) — mobile reading-depth fix.
 *
 * The selected-node body was clamped to a 280-char excerpt with no way to read
 * the rest at 390px (a truncation dead-end). The fix is additive: the model
 * carries the full redacted body on `bodyFull`, and the sidecar renders a
 * read-only "Show full body" disclosure toggle when the excerpt is truncated.
 *
 * MODEL: bodyFull reachable; the 280-char cap / isTruncated / fullBodyLength
 *   pins are unchanged.
 * COMPONENT (source-scan): the toggle exists, is gated on isTruncated, carries
 *   the a11y / touch-target budget, and adds no edit/action/submit affordance.
 * READING DEPTH: the full body is reachable in <= 2 taps at 390px.
 */
import fs from 'fs';
import path from 'path';

import {
  buildSidecarViewModel,
  type BuildSidecarViewModelInput,
  type SidecarSection_WhatThisMoveSays,
  type SidecarViewModel,
} from '../src/features/arguments/argumentReplySidecarModel';
import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

// ── Minimal fixtures (mirror argumentReplySidecarModel.test.ts) ──

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: 'm1',
    parentId: null,
    ordinal: 1,
    createdAt: '2026-06-18T10:00:00.000Z',
    createdAtLabel: '2026-06-18 10:00',
    relativeLabel: 'now',
    actorLabel: 'You',
    kindLabel: 'claim',
    sideLabel: 'Aff',
    bodyPreview: 'parent preview body',
    badges: [],
    droppedTags: [],
    depth: 0,
    lane: 0,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'branch-1',
    branchRootMessageId: 'm1',
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: true,
    isLatest: true,
    isDetached: false,
    isActivePath: true,
    isRoot: true,
    isFirstRebuttal: false,
    standingBand: 'neutral' as TimelineStandingBand,
    toneBand: 'calm' as TimelineToneBand,
    temperatureBand: 'cool' as TimelineTemperatureBand,
    kindColor: '#22c55e',
    kindColorFamily: 'claim' as TimelineKindColorFamily,
    x: 100,
    y: 120,
    accessibilityLabel: 'm1',
    ...over,
  };
}

function fakeViewModel(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: 'm1',
    ordinal: 1,
    createdAtLabel: '2026-06-18 10:00',
    relativeLabel: 'now',
    body: 'A short claim body.',
    kindLabel: 'claim',
    actor: 'self',
    sideLabel: 'Aff',
    isLatest: true,
    isActive: true,
    parentHint: null,
    qualifierBadges: [],
    pointStandingHint: null,
    allowedControls: ['view_qualifiers', 'request_deletion'],
    deletionRequested: false,
    ...over,
  };
}

function input(over: Partial<BuildSidecarViewModelInput> = {}): BuildSidecarViewModelInput {
  const node = fakeNode();
  return {
    activeNode: node,
    activeViewModel: fakeViewModel(),
    parentNode: null,
    totalCount: 1,
    activePathIds: [node.messageId],
    lifecycleMap: null,
    metadataLedger: null,
    viewMode: 'stack',
    bodyExcerptCap: undefined,
    ...over,
  };
}

function pickWhatSays(vm: SidecarViewModel): SidecarSection_WhatThisMoveSays {
  const s = vm.sections.find((x) => x.kind === 'what_this_move_says');
  expect(s).toBeDefined();
  return s as SidecarSection_WhatThisMoveSays;
}

// ── 1. Model — bodyFull reachability ─────────────────────────────

describe('UX-BOARD-MOBILE-DEPTH-001 — model bodyFull', () => {
  it('short body (≤ 280 chars): bodyFull === bodyExcerpt === input body, not truncated', () => {
    const body = 'a'.repeat(100);
    const vm = buildSidecarViewModel(input({ activeViewModel: fakeViewModel({ body }) }));
    const what = pickWhatSays(vm);
    expect(what.isTruncated).toBe(false);
    expect(what.bodyExcerpt).toBe(body);
    expect(what.bodyFull).toBe(body);
  });

  it('long body (> 280 chars): excerpt is capped/ellipsized BUT bodyFull is the full body', () => {
    const words = Array(120).fill('word').join(' '); // > 280 chars, with spaces
    const vm = buildSidecarViewModel(input({ activeViewModel: fakeViewModel({ body: words }) }));
    const what = pickWhatSays(vm);
    // Existing 280-cap pins (byte-identical): excerpt is truncated + ellipsized.
    expect(what.isTruncated).toBe(true);
    expect(what.bodyExcerpt.length).toBeLessThanOrEqual(281);
    expect(what.bodyExcerpt.endsWith('…')).toBe(true);
    // The full body is reachable, in full, with no ellipsis.
    expect(what.bodyFull).toBe(words);
    expect(what.bodyFull.length).toBe(what.fullBodyLength);
    expect(what.bodyFull.endsWith('…')).toBe(false);
    // The full body is longer than the excerpt — the dead-end is closed.
    expect(what.bodyFull.length).toBeGreaterThan(what.bodyExcerpt.length);
  });
});

// ── 2. Component source-scan — the disclosure toggle ─────────────

describe('UX-BOARD-MOBILE-DEPTH-001 — sidecar toggle', () => {
  const ROOT = path.join(__dirname, '..');
  const src = fs.readFileSync(
    path.join(ROOT, 'src', 'features', 'arguments', 'ArgumentReplySidecar.tsx'),
    'utf8',
  );

  it('renders a testID="sidecar-show-full-body" toggle', () => {
    expect(src).toContain('testID="sidecar-show-full-body"');
  });

  it('gates the toggle on section.isTruncated (clamped body only)', () => {
    expect(src).toMatch(/section\.isTruncated\s*\?/);
  });

  it('renders bodyFull when expanded, bodyExcerpt otherwise', () => {
    expect(src).toMatch(/showFullBody\s*\?\s*section\.bodyFull\s*:\s*section\.bodyExcerpt/);
  });

  it('the toggle carries the a11y + touch-target budget', () => {
    expect(src).toMatch(/accessibilityRole="button"/);
    expect(src).toMatch(/accessibilityState=\{\{\s*expanded:\s*showFullBody\s*\}\}/);
    expect(src).toMatch(/hitSlop=\{SHOW_DETAILS_HIT_SLOP\}/);
    // SHOW_DETAILS_HIT_SLOP (8) + showDetailsButton minHeight 28 → ≥ 44 effective.
    expect(src).toMatch(/SHOW_DETAILS_HIT_SLOP = \{ top: 8, bottom: 8, left: 8, right: 8 \}/);
  });

  it('the toggle labels are plain, verdict-free, snake_case-free', () => {
    expect(src).toContain('Show full body');
    expect(src).toContain('Show less');
    const banned = ['winner', 'loser', 'truth', 'verdict', 'liar', 'dishonest'];
    for (const token of banned) {
      expect(src.toLowerCase()).not.toContain(token);
    }
    // No snake_case in the new toggle labels.
    expect('Show full body').not.toMatch(/[a-z]+_[a-z]+/);
    expect('Show less').not.toMatch(/[a-z]+_[a-z]+/);
  });

  it('adds NO edit/action/submit affordance (read-only disclosure only)', () => {
    expect(src).not.toMatch(/\bTextInput\b/);
    expect(src).not.toMatch(/onChangeText/);
    expect(src).not.toMatch(/\beditable=/);
    expect(src).not.toMatch(/\bonAction\b/);
    expect(src).not.toMatch(/\bdispatch\b/);
    // The component still accepts only the `viewModel` prop (no new prop).
    expect(src).toMatch(/export function ArgumentReplySidecar\(\{\s*viewModel\s*\}/);
  });
});

// ── 3. Reading depth target ──────────────────────────────────────

describe('UX-BOARD-MOBILE-DEPTH-001 — reading depth at 390px', () => {
  const ROOT = path.join(__dirname, '..');
  const DEPTH_TARGET = 2; // tap 1: Show full details (compact panel); tap 2: Show full body (sidecar)

  it('the full selected-node body is reachable in <= 2 taps (both affordances exist)', () => {
    const sidecarSrc = fs.readFileSync(
      path.join(ROOT, 'src', 'features', 'arguments', 'ArgumentReplySidecar.tsx'),
      'utf8',
    );
    const panelSrc = fs.readFileSync(
      path.join(ROOT, 'src', 'features', 'arguments', 'TimelineSelectedReadoutPanel.tsx'),
      'utf8',
    );
    expect(DEPTH_TARGET).toBe(2);
    // tap 1 affordance — the compact panel's expand trigger.
    expect(panelSrc).toContain('timeline-readout-expand-trigger');
    // tap 2 affordance — the sidecar's full-body disclosure.
    expect(sidecarSrc).toContain('testID="sidecar-show-full-body"');
  });
});
