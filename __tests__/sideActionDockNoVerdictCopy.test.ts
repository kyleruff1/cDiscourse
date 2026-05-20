/**
 * SC-005 — Doctrine ban-list.
 *
 * Scans every visible string the dock can render against the
 * verdict / person-label ban-list, and asserts no string is an internal
 * code (`looksLikeInternalCode`). This is the cdiscourse-doctrine §1 / §9
 * guard: the dock surfaces moves, never verdicts; no raw internal code
 * reaches a label, helper, or header.
 */
import {
  getRailActions,
  RAIL_ACTION_CATEGORIES,
  RAIL_ACTION_CATEGORY_LABEL,
} from '../src/features/arguments/ArgumentSideActionRail';
import {
  buildCollapsedDockLabel,
  buildExpandedDockViewModel,
  type DockContext,
} from '../src/features/arguments/ObserverActionDockLayout';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Ban-list ────────────────────────────────────────────────────

const BAN_LIST = [
  'winner', 'loser', 'correct', 'incorrect', 'true', 'false', 'right', 'wrong',
  'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
  'stupid', 'idiot', 'truth', 'proven', 'verdict', 'popular', 'trending', 'viral',
];

function containsBannedToken(s: string): string | null {
  const lower = s.toLowerCase();
  for (const token of BAN_LIST) {
    // Word-boundary match so legitimate substrings (none expected here)
    // are not falsely flagged.
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) return token;
  }
  return null;
}

// ── Collect every visible string the dock can render ────────────

const ALL_DOCK_CONTEXTS: DockContext[] = [
  'observer_no_node', 'observer_node', 'participant_own', 'participant_other',
];

function collectVisibleStrings(): { source: string; value: string }[] {
  const out: { source: string; value: string }[] = [];

  // 1. Every RailAction label + helper across the three action sets.
  const allActions = [
    ...getRailActions('observer', 'other'),
    ...getRailActions('participant', 'other'),
    ...getRailActions('participant', 'self'),
  ];
  for (const a of allActions) {
    out.push({ source: `action.label[${a.code}]`, value: a.label });
    out.push({ source: `action.helper[${a.code}]`, value: a.helper });
  }

  // 2. The four collapsed labels — primary + a11y label + a11y hint.
  for (const ctx of ALL_DOCK_CONTEXTS) {
    const label = buildCollapsedDockLabel(ctx);
    out.push({ source: `collapsed.primary[${ctx}]`, value: label.primary });
    out.push({ source: `collapsed.accessibilityLabel[${ctx}]`, value: label.accessibilityLabel });
    out.push({ source: `collapsed.accessibilityHint[${ctx}]`, value: label.accessibilityHint });
  }

  // 3. Every category header label.
  for (const cat of RAIL_ACTION_CATEGORIES) {
    out.push({ source: `category.header[${cat}]`, value: RAIL_ACTION_CATEGORY_LABEL[cat] });
  }

  // 4. The three dock titles.
  out.push({
    source: 'title.observer',
    value: buildExpandedDockViewModel(getRailActions('observer', 'other'), 'observer', 'other').title,
  });
  out.push({
    source: 'title.own',
    value: buildExpandedDockViewModel(getRailActions('participant', 'self'), 'participant', 'self').title,
  });
  out.push({
    source: 'title.other',
    value: buildExpandedDockViewModel(getRailActions('participant', 'other'), 'participant', 'other').title,
  });

  return out;
}

const VISIBLE_STRINGS = collectVisibleStrings();

// ── Tests ───────────────────────────────────────────────────────

describe('SC-005 doctrine — no verdict / person-label copy', () => {
  it('collected a non-trivial set of dock strings to scan', () => {
    expect(VISIBLE_STRINGS.length).toBeGreaterThan(20);
  });

  it('no dock string contains a verdict / person-label ban-list token', () => {
    for (const { source, value } of VISIBLE_STRINGS) {
      const hit = containsBannedToken(value);
      if (hit) {
        throw new Error(`Banned token "${hit}" in ${source}: "${value}"`);
      }
    }
  });
});

describe('SC-005 doctrine — no internal codes leak into labels', () => {
  it('no dock string looks like an internal code', () => {
    for (const { source, value } of VISIBLE_STRINGS) {
      expect({ source, looksLikeCode: looksLikeInternalCode(value) })
        .toEqual({ source, looksLikeCode: false });
    }
  });

  it('no dock string contains snake_case or a code-like arrow/colon shape', () => {
    for (const { source, value } of VISIBLE_STRINGS) {
      // Allow the human "/" separator in "Watch / Observe" etc.
      expect({ source, value }).toEqual({ source, value });
      expect(value).not.toMatch(/[a-z]_[a-z]/);
    }
  });
});
