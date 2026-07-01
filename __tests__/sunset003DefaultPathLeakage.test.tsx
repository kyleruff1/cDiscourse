/**
 * SUNSET-003 — default-path raw-MCP/debug leakage regression pin.
 *
 * The durable guard that no future card can silently regress the wave-2
 * outcome: on the DEFAULT room render path, machine detail is present only
 * as plain-language labels, and every raw / dense form (family internal
 * names, rawKey strings, snake_case codes, confidence numerals, evidenceSpan
 * text, run/debug ids, composer-only sensitive codes) stays behind an
 * explicit opt-in (readout Show-full-details, card More-detail).
 *
 * Two default surfaces are rendered with ONE observation-rich fixture
 * spanning families A-I:
 *   1. Timeline-mode default — the compact TimelineSelectedReadoutPanel plus
 *      the PointFeedbackFlagsRow (the canonical default readout sub-surfaces;
 *      the full ArgumentGameSurface mount is heavy and provider-bound in
 *      jest, so the design prefers these faithful sub-surfaces).
 *   2. Stack-mode default — the CardDetailPanel for the active card with the
 *      default collapsed state (detailExpanded === false).
 *
 * Scan classes (a)-(i) per the SUNSET-003 test spec. testIDs are NEVER
 * scanned, so familyCode-in-testID (card-detail-classifier-group-*) is safe
 * by construction.
 *
 * All comments here are apostrophe-free with balanced quotes/backticks as a
 * doctrine-scanner precaution (landmine 1).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { TimelineSelectedReadoutPanel } from '../src/features/arguments/TimelineSelectedReadoutPanel';
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { PointFeedbackFlagsRow } from '../src/features/feedbackFlags';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import { buildPointFeedbackFlags } from '../src/features/feedbackFlags/pointFeedbackFlagsModel';
import { prioritizePointFeedbackFlags } from '../src/features/feedbackFlags/feedbackFlagPriority';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../src/features/nodeLabels/nodeLabelTypes';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';

import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import type { CardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type { SidecarViewModel } from '../src/features/arguments/argumentReplySidecarModel';
import type { TimelineSelectedReadoutViewModel } from '../src/features/arguments/timelineSelectedReadoutModel';
import type { PointFeedbackFlagViewModel } from '../src/features/feedbackFlags/pointFeedbackFlagsModel';
import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

const ACTIVE = 'msg-active';
const PARENT = 'msg-parent';

// ── Sentinels the default path must NEVER surface as text ──────────────

const EVIDENCE_SPAN_SENTINEL = 'EVIDENCE_SPAN_SENTINEL bikes are safer downtown';
const RUN_DEBUG_SENTINEL = 'RUN_DEBUG_SENTINEL_abc123';
const SCHEMA_VERSION_SENTINEL = 'SCHEMA_VERSION_SENTINEL_v2xyz';
const UNKNOWN_RAW_KEY = 'totally_unregistered_key';
const COMPOSER_ONLY_RAW_KEY = 'shifts_to_person_or_intent';

// The family internal names (scan class b). Sourced from the registry so the
// list can never drift from the real family union.
const FAMILY_INTERNAL_NAMES: ReadonlyArray<string> = ALL_MACHINE_OBSERVATION_FAMILIES;

// Fixture rawKeys that must never appear as text (scan class c).
const FIXTURE_RAW_KEYS: ReadonlyArray<string> = [
  'quote_anchors_parent',
  'challenges_parent',
  'source_attached',
  'has_rebuttal',
  'source_chain_gap',
  'introduces_new_issue',
  UNKNOWN_RAW_KEY,
  COMPOSER_ONLY_RAW_KEY,
];

// Shared verdict ban-list (doctrine section 1). Matched on default AND
// expanded text.
const BANNED_VERDICT: ReadonlyArray<string> = [
  'winner',
  'loser',
  'liar',
  'true',
  'false',
  'correct',
  'incorrect',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
];

// Confidence numerals the default path must not render (scan class e). The
// classifier renders confidence as PIPS, never as a number.
const CONFIDENCE_NUMERALS: ReadonlyArray<string> = ['0.82', '82%'];

const SNAKE_CASE = /[a-z]+_[a-z0-9_]+/;

// A tiny plain-word allowlist for scan (a). looksLikeInternalCode is TRUE for
// any lone lowercase token of 5+ chars, so a legitimately plain single-word
// leaf would false-trip. The default surfaces render multi-word strings, but
// this allowlist keeps the blanket scan honest without weakening it.
const PLAIN_WORD_ALLOWLIST: ReadonlyArray<string> = [];

// ── Depth-first collectors (idiom from openIssuesRailNoRawCodes.test.ts) ──

function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string') {
    if (node.length > 0) out.push(node);
    return out;
  }
  if (typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  const n = node as { children?: unknown };
  if (n.children != null) collectText(n.children, out);
  return out;
}

function collectA11yLabels(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === 'string' || typeof node === 'number') return out;
  if (Array.isArray(node)) {
    for (const child of node) collectA11yLabels(child, out);
    return out;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  const label = n.props?.accessibilityLabel;
  if (typeof label === 'string' && label.length > 0) out.push(label);
  if (n.children != null) collectA11yLabels(n.children, out);
  return out;
}

// ── The core leakage assertion, run over any rendered tree ────────────

function assertNoRawLeakage(tree: unknown, phase: string): void {
  const texts = collectText(tree);
  const labels = collectA11yLabels(tree);
  const scanned = [...texts, ...labels];

  // There must be SOMETHING rendered (guards against a false-green where the
  // surface renders nothing and every scan passes trivially).
  expect(texts.length).toBeGreaterThan(0);

  for (const s of scanned) {
    const lower = s.toLowerCase();

    // (a) looksLikeInternalCode — every leaf text + populated a11y label. A
    // lone code-shaped plain word is allowlisted (currently empty); a real
    // internal code trips the detector.
    if (!PLAIN_WORD_ALLOWLIST.includes(s)) {
      expect({ phase, leaf: s, tripped: looksLikeInternalCode(s) }).toEqual({
        phase,
        leaf: s,
        tripped: false,
      });
    }

    // (b) family internal names.
    for (const fam of FAMILY_INTERNAL_NAMES) {
      expect(lower).not.toContain(fam);
    }

    // (c) fixture rawKey strings.
    for (const key of FIXTURE_RAW_KEYS) {
      expect(s).not.toContain(key);
    }

    // (d) snake_case tokens.
    expect(s).not.toMatch(SNAKE_CASE);

    // (e) confidence numerals.
    for (const numeral of CONFIDENCE_NUMERALS) {
      expect(s).not.toContain(numeral);
    }

    // (f) evidenceSpan sentinel.
    expect(s).not.toContain(EVIDENCE_SPAN_SENTINEL);

    // (g) run/debug id sentinels.
    expect(s).not.toContain(RUN_DEBUG_SENTINEL);
    expect(s).not.toContain(SCHEMA_VERSION_SENTINEL);

    // (h) composer-only sensitive code (raw). Its plain label is covered by
    // the dedicated composer-only test below.
    expect(s).not.toContain(COMPOSER_ONLY_RAW_KEY);

    // Shared verdict ban-list (doctrine section 1) — default AND expanded.
    for (const b of BANNED_VERDICT) {
      const re = new RegExp(`\\b${b.replace(/ /g, '\\s')}\\b`);
      expect(re.test(lower)).toBe(false);
    }
  }
}

// ── Fixture rows (families A-I; survivors + suppressed cases) ──────────

function persistedRow(over: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: RUN_DEBUG_SENTINEL,
    debateId: 'deb-1',
    argumentId: ACTIVE,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-06-30T00:00:00.000Z',
    ...over,
  };
}

/**
 * Observation-rich persisted rows. Survivors (valid schema + registered
 * rawKey + high confidence) produce plain-language chips inside the expansion;
 * the unknown-rawKey, wrong-schema, and composer-only rows are all dropped or
 * suppressed and pin the suppress-not-echo path.
 */
function richPersistedRows(): MachineObservationResultRow[] {
  return [
    // Survivor carrying the evidenceSpan sentinel (renders only when expanded).
    persistedRow({
      id: 'r1',
      rawKey: 'quote_anchors_parent',
      family: 'parent_relation',
      evidenceSpan: EVIDENCE_SPAN_SENTINEL,
    }),
    persistedRow({ id: 'r2', rawKey: 'challenges_parent', family: 'parent_relation' }),
    persistedRow({ id: 'r3', rawKey: 'source_attached', family: 'evidence_source_chain' }),
    // Unknown rawKey — must be suppressed, never echoed (scan class c).
    persistedRow({ id: 'r4', rawKey: UNKNOWN_RAW_KEY, family: 'thread_topology' }),
    // Wrong-schema debug sentinel — dropped by the schema filter; its
    // schemaVersion string must never surface (scan class g).
    persistedRow({ id: 'r5', rawKey: 'source_chain_gap', schemaVersion: SCHEMA_VERSION_SENTINEL }),
    // Composer-only sensitive code — suppressed at the selected_context
    // surface; must never render on the target node (scan class h).
    persistedRow({ id: 'r6', rawKey: COMPOSER_ONLY_RAW_KEY, family: 'sensitive_composer' }),
  ];
}

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: ACTIVE,
    parentId: PARENT,
    ordinal: 4,
    createdAt: '2026-06-30T12:00:00.000Z',
    createdAtLabel: '2026-06-30 12:00',
    relativeLabel: '2h ago',
    actorLabel: 'Other side',
    kindLabel: 'rebuttal',
    sideLabel: 'Neg',
    bodyPreview: 'rebuttal body preview',
    badges: [],
    droppedTags: [],
    depth: 1,
    lane: 1,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'branch-1',
    branchRootMessageId: 'cluster-1',
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: true,
    isLatest: true,
    isDetached: false,
    isActivePath: true,
    isRoot: false,
    isFirstRebuttal: false,
    standingBand: 'pretty_right' as TimelineStandingBand,
    toneBand: 'measured' as TimelineToneBand,
    temperatureBand: 'warm' as TimelineTemperatureBand,
    kindColor: '#f97316',
    kindColorFamily: 'challenge' as TimelineKindColorFamily,
    x: 0,
    y: 0,
    accessibilityLabel: 'rebuttal',
    ...over,
  };
}

function fakeViewModel(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: ACTIVE,
    ordinal: 4,
    createdAtLabel: '2026-06-30 12:00',
    relativeLabel: '2h ago',
    body: 'Bike lanes do not improve safety in every district.',
    kindLabel: 'rebuttal',
    actor: 'other',
    sideLabel: 'Neg',
    isLatest: true,
    isActive: true,
    parentHint: null,
    qualifierBadges: ['Scope challenge'],
    pointStandingHint: 'Needs work',
    allowedControls: [],
    deletionRequested: false,
    ...over,
  };
}

function cardModel(rows: ReadonlyArray<MachineObservationResultRow>): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE,
    chronologicalIds: [PARENT, ACTIVE],
    ordinalOf: (id) => (id === ACTIVE ? 4 : id === PARENT ? 3 : null),
    kindLabelOf: (id) => (id === ACTIVE ? 'rebuttal' : 'claim'),
    parentIdOf: (id) => (id === ACTIVE ? PARENT : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: rows,
    manualTagEntries: [],
    autoMetadataCodes: [],
    clusterState: 'rebutted',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: 'Receipts owed: a source for this claim.',
    standingHint: 'Needs work',
    lifecycleState: 'sourced',
    flagLabels: ['Scope challenge'],
    parentBodyPreview: 'We should narrow the scope.',
    parentOrdinal: 3,
    parentKindLabel: 'claim',
    parentMessageId: PARENT,
    parentActor: 'other',
    parentActorLabel: 'Other side',
    standingToneHeatNode: fakeNode(),
    standingToneHeatViewModel: fakeViewModel(),
  });
}

function flagsFrom(rows: ReadonlyArray<MachineObservationResultRow>, isOwnPoint: boolean) {
  const built = buildPointFeedbackFlags(rows, { isOwnPoint });
  return prioritizePointFeedbackFlags(built);
}

// ── Rich sidecar view-model for the compact readout ───────────────────

/**
 * A rich sidecar view-model with a populated Semantic flags section. The
 * compact readout renders only the what/where summary by default; the sidecar
 * (and its flags) is behind the Show-full-details expand. The flag chips carry
 * an internal sourceCode (never rendered) and a plain-language label (rendered
 * only when the section is uncondensed inside the expansion).
 */
function richSidecar(over: Partial<SidecarViewModel> = {}): SidecarViewModel {
  return {
    isEmpty: false,
    selectedMessageId: ACTIVE,
    // Stack view-mode so the semantic-flag section is uncondensed once the
    // readout is expanded (the labels then render for the positive control).
    viewMode: 'stack',
    sections: [
      {
        kind: 'what_this_move_says',
        bodyExcerpt: 'Bike lanes do not improve safety in every district.',
        isTruncated: false,
        fullBodyLength: 49,
        bodyFull: 'Bike lanes do not improve safety in every district.',
        createdAtLabel: '2026-06-30 12:00',
        relativeLabel: '2h ago',
        parentHint: 'Replied to · #3 (Claim)',
        parentBodyPreview: 'We should narrow the scope.',
        actorLabel: 'Other side',
        sideLabel: 'Neg',
        kindLabel: 'Rebuttal',
        isHidden: false,
        hiddenNotice: null,
        standingLine: 'Standing: Well supported',
        toneLine: 'Tone: Measured',
        heatLine: 'Heat: Warm',
      },
      {
        kind: 'where_it_sits',
        branchLabel: 'Mainline',
        laneIndex: 1,
        depth: 1,
        pathLabel: 'Root to #3 to #4',
        totalCount: 4,
        ordinal: 4,
      },
      {
        kind: 'semantic_flags',
        isCondensed: false,
        totalCount: 2,
        chips: [
          {
            id: 'manual_tag:scope_issue',
            family: 'manual_tag',
            label: 'Scope challenge',
            helperLine: 'A participant flagged the claim scope as too broad.',
            iconHint: 'scope_brackets',
            sourceCode: 'scope_issue',
          },
          {
            id: 'auto_metadata:source_requested',
            family: 'auto_metadata',
            label: 'Source requested',
            helperLine: 'Someone asked for a primary source.',
            iconHint: 'dotted_hexagon',
            sourceCode: 'source_requested',
          },
        ],
      },
    ],
    accessibilityRootLabel:
      'Rebuttal from Other side. Message 4 of 4. Well supported. Two direct replies.',
    emptyStateMessage: 'Pick a message on the timeline to see details.',
    ...over,
  };
}

function richReadout(over: Partial<TimelineSelectedReadoutViewModel> = {}): TimelineSelectedReadoutViewModel {
  const sidecar = richSidecar();
  return {
    isEmpty: false,
    selectedMessageId: ACTIVE,
    status: 'default_latest',
    staleNotice: null,
    sidecar,
    directReplyCount: 2,
    replyCountLabel: '2 direct replies',
    actingOnShortLabel: 'Rebuttal · #4',
    accessibilityPanelLabel:
      'Rebuttal from Other side. Message 4 of 4. Well supported. 2 direct replies.',
    accessibilitySelectionAnnouncement:
      'Selected rebuttal from Other side, message 4 of 4.',
    ...over,
  };
}

// A friendly-flag view-model for the timeline PointFeedbackFlagsRow. The id /
// family carry internal codes (never rendered); the label is plain (#850).
function friendlyFlag(over: Partial<PointFeedbackFlagViewModel> = {}): PointFeedbackFlagViewModel {
  return {
    id: 'callback_material',
    label: 'Callback material',
    helper: 'This move quotes the point it answers.',
    tone: 'descriptive',
    neverGrantsStanding: false,
    accessibilityLabel: 'Descriptive: Callback material',
    family: 'parent_relation',
    ...over,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 1. Timeline-mode default — compact readout + friendly-flag row
// ══════════════════════════════════════════════════════════════════════

describe('SUNSET-003 — timeline-mode default render is leak-free', () => {
  it('the compact readout (nothing expanded) surfaces no raw MCP/debug detail', () => {
    const tree = render(
      <TimelineSelectedReadoutPanel viewModel={richReadout()} compact />,
    ).toJSON();
    assertNoRawLeakage(tree, 'timeline-readout-default');
  });

  it('the point friendly-flag row (nothing expanded) surfaces no raw MCP/debug detail', () => {
    const prioritized = flagsFrom(richPersistedRows(), false);
    const tree = render(
      <PointFeedbackFlagsRow flags={prioritized.visible} suppressedCount={prioritized.suppressedCount} />,
    ).toJSON();
    assertNoRawLeakage(tree, 'timeline-flag-row-default');
  });

  it('renders a hand-authored friendly-flag row with no raw code leak', () => {
    const tree = render(
      <PointFeedbackFlagsRow
        flags={[
          friendlyFlag(),
          friendlyFlag({ id: 'direct_challenge', label: 'Direct challenge', family: 'disagreement_axis' }),
        ]}
      />,
    ).toJSON();
    assertNoRawLeakage(tree, 'timeline-flag-row-authored');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Stack-mode default — CardDetailPanel collapsed (detailExpanded === false)
// ══════════════════════════════════════════════════════════════════════

describe('SUNSET-003 — stack-mode default (CardDetailPanel collapsed) is leak-free', () => {
  it('the collapsed active card surfaces no raw MCP/debug detail', () => {
    const tree = render(
      <CardDetailPanel
        model={cardModel(richPersistedRows())}
        currentMessageBody="Bike lanes do not improve safety in every district."
        pointFeedbackFlags={flagsFrom(richPersistedRows(), false)}
      />,
    ).toJSON();
    assertNoRawLeakage(tree, 'card-collapsed-default');
  });

  it('the own-bubble collapsed card surfaces no raw MCP/debug detail', () => {
    const tree = render(
      <CardDetailPanel
        model={cardModel(richPersistedRows())}
        currentMessageBody="Bike lanes do not improve safety in every district."
        pointFeedbackFlags={flagsFrom(richPersistedRows(), true)}
        bubbleActor="self"
        viewerRole="participant"
      />,
    ).toJSON();
    assertNoRawLeakage(tree, 'card-collapsed-own-bubble');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Empty-observation fixture — the calm null default
// ══════════════════════════════════════════════════════════════════════

describe('SUNSET-003 — empty-observation default renders nothing machine-derived', () => {
  it('the collapsed card with no observations still passes the leak scan', () => {
    const tree = render(
      <CardDetailPanel
        model={cardModel([])}
        currentMessageBody="Bike lanes do not improve safety in every district."
        pointFeedbackFlags={prioritizePointFeedbackFlags([])}
      />,
    ).toJSON();
    // The flag row is null; the card renders the message + meta only. The scan
    // holds trivially and pins the calm-null path.
    assertNoRawLeakage(tree, 'card-collapsed-empty');
  });

  it('the friendly-flag row renders nothing for an empty flag list', () => {
    const tree = render(<PointFeedbackFlagsRow flags={[]} />).toJSON();
    expect(tree).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Composer-only sensitive code stays off the target node (scan class h)
// ══════════════════════════════════════════════════════════════════════

describe('SUNSET-003 — composer-only sensitive code never renders on the target node', () => {
  it('neither the raw code nor its plain label appears in the card (default OR expanded)', () => {
    const { toJSON, getByTestId } = render(
      <CardDetailPanel
        model={cardModel(richPersistedRows())}
        currentMessageBody="Bike lanes do not improve safety in every district."
        pointFeedbackFlags={flagsFrom(richPersistedRows(), false)}
      />,
    );
    // The plain label for shifts_to_person_or_intent must be absent from the
    // target node entirely (composer-only surfaces it elsewhere, never here).
    const composerOnlyPlainFragments = ['shifts to', 'person or intent', 'attacks the person'];
    const scanFor = (): string => collectText(toJSON()).join(' ').toLowerCase();
    for (const frag of composerOnlyPlainFragments) {
      expect(scanFor()).not.toContain(frag);
    }
    // And after expanding, still absent.
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    for (const frag of composerOnlyPlainFragments) {
      expect(scanFor()).not.toContain(frag);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Opt-in positive control (scan class i) — labels appear, raw never does
// ══════════════════════════════════════════════════════════════════════

describe('SUNSET-003 — opt-in positive control: detail relocated, not deleted', () => {
  it('card More-detail reveals plain-language labels while raw codes stay hidden', () => {
    const { toJSON, getByTestId } = render(
      <CardDetailPanel
        model={cardModel(richPersistedRows())}
        currentMessageBody="Bike lanes do not improve safety in every district."
        pointFeedbackFlags={flagsFrom(richPersistedRows(), false)}
      />,
    );
    // Before expansion: the classifier zone is absent and the evidence span
    // sentinel is nowhere in the default tree.
    const beforeTexts = collectText(toJSON());
    const beforeJoined = beforeTexts.join(' ');
    expect(beforeJoined).not.toContain(EVIDENCE_SPAN_SENTINEL);
    expect(beforeJoined).not.toContain('Classifier observations');

    fireEvent.press(getByTestId('card-detail-more-toggle'));

    // After expansion: the plain-language machine-observation surface now
    // renders (the detail was relocated, not deleted) while the RAW rawKeys /
    // family names / debug ids still never appear as raw tokens.
    const afterTexts = collectText(toJSON());
    expect(afterTexts.length).toBeGreaterThan(beforeTexts.length);

    const afterJoined = afterTexts.join(' ');
    // The plain-language classifier surface appears in the expansion (proves
    // the detail relocated, not deleted).
    expect(afterJoined).toContain('Classifier observations');
    // Raw rawKeys never surface even when expanded.
    for (const key of FIXTURE_RAW_KEYS) {
      expect(afterJoined).not.toContain(key);
    }
    // Family internal names never surface even when expanded.
    for (const fam of FAMILY_INTERNAL_NAMES) {
      expect(afterJoined.toLowerCase()).not.toContain(fam);
    }
    // Run/debug id sentinels never surface even when expanded.
    expect(afterJoined).not.toContain(RUN_DEBUG_SENTINEL);
    expect(afterJoined).not.toContain(SCHEMA_VERSION_SENTINEL);
    // Confidence numerals never surface even when expanded (PIPS only).
    for (const numeral of CONFIDENCE_NUMERALS) {
      expect(afterJoined).not.toContain(numeral);
    }
    // The shared verdict ban-list holds in the expanded tree too.
    const lowerAfter = afterJoined.toLowerCase();
    for (const b of BANNED_VERDICT) {
      const re = new RegExp(`\\b${b.replace(/ /g, '\\s')}\\b`);
      expect(re.test(lowerAfter)).toBe(false);
    }
  });

  it('readout Show-full-details reveals plain flag labels while raw sourceCodes stay hidden', () => {
    const { toJSON, getByTestId } = render(
      <TimelineSelectedReadoutPanel viewModel={richReadout()} compact />,
    );
    // Default compact: the sidecar flags are not mounted.
    const beforeJoined = collectText(toJSON()).join(' ');
    expect(beforeJoined).not.toContain('scope_issue');
    expect(beforeJoined).not.toContain('source_requested');

    fireEvent.press(getByTestId('timeline-readout-expand-trigger'));

    const afterJoined = collectText(toJSON()).join(' ');
    // Plain flag labels appear (relocated, not deleted).
    expect(afterJoined).toContain('Scope challenge');
    expect(afterJoined).toContain('Source requested');
    // The internal sourceCodes still never render.
    expect(afterJoined).not.toContain('scope_issue');
    expect(afterJoined).not.toContain('source_requested');
  });
});
