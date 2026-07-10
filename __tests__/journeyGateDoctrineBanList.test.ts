/**
 * QA-001 (#692) — the consolidated journey-level doctrine ban-list.
 *
 * One pass over the UNION of the shipped copy constants that the ten ASP
 * journeys render, scanned for the verdict / AI-authority / social-feed family
 * plus the box-copy bans (proof / proven / validated). This CONSOLIDATES but does
 * NOT replace the per-surface ban-lists that already ship and pass:
 *   - copySystemBanList.test.ts        (room / seat / visibility / mediator / brand)
 *   - proofDrawerCopyBanList.test.ts   (PROOF_DRAWER_COPY + ATTACH_ERROR_COPY)
 *   - markerCopyBanList.test.ts        (MARKER_COPY + MARKER_ERROR_COPY)
 *   - feedbackMoveMarksCopyBanList.test.ts (move-mark labels / legend / bar)
 *
 * Matching reuses the house convention (copySystemBanList.test.ts): a
 * whole-word / whole-phrase, case-insensitive word-boundary regex, so legitimate
 * substrings never false-positive.
 *
 * Two controls, per MARK-001 ("a scan that cannot fail is not a test"):
 *   - Positive control: planted violators each trip.
 *   - Negative control: canonical shipped journey strings pass clean (no over-block).
 *
 * A few journey copy sources are module-private consts (DEBT_CHIP_COPY, the Map
 * surface labels). They reach the UI only through exported builders, so this scan
 * exercises the builder outputs rather than importing the raw consts.
 */
import {
  HOME_COPY,
  START_SHEET_COPY,
  PUBLIC_ARGUMENT_TOGGLE_COPY,
  STATE_RAIL_COPY,
} from '../src/features/arguments/gameCopy';
import { DISAGREEMENT_CLUSTER_LABELS } from '../src/features/arguments/startArgument/startArgumentTaxonomy';
import { MARKER_COPY, MARKER_ERROR_COPY } from '../src/features/arguments/markers/markerCopy';
import { PROOF_DRAWER_COPY, ATTACH_ERROR_COPY } from '../src/features/proof/proofDrawerCopy';
import {
  summarizeEvidenceDebtChip,
  type EvidenceDebtStatus,
} from '../src/features/evidence/evidenceDebtModel';
import { buildMapNodeActionSurface } from '../src/features/arguments/room/mapNodeActionSurfaceModel';
import { MEDIATOR_STATE_COPY } from '../src/features/mediator/mediatorPlainLanguage';
import { WHAT_REMAINS_UNRESOLVED } from '../src/lib/brandCopy';
import {
  MOVE_MARK_LABEL,
  MOVE_MARKS_BAR_COPY,
  MOVE_MARKS_LEGEND_LINE,
  allRenderedMoveMarkStrings,
} from '../src/features/feedback/moveMarksCopy';

/**
 * The consolidated banned vocabulary: the verdict / person-judgment family + the
 * AI-authority family + the social-feed / forum family (copySystemBanList §3),
 * plus the box-copy bans proof / proven / validated (proofDrawerCopyBanList).
 */
function bannedTokens(): readonly string[] {
  return [
    // verdict / correctness / person-judgment
    'winner', 'loser', 'score', 'verdict', 'truth', 'wrong', 'dishonest',
    'bad faith', 'manipulative', 'fallacy', 'liar', 'propagandist', 'extremist',
    // AI-authority
    'ai judge', 'ai decides',
    // social-feed / comment-thread / forum framing
    'social feed', 'comment thread', 'pile on', 'forum', 'audience',
    'open mic', 'join the debate', 'third side',
    // box-copy bans (evidence must never be called "proof")
    'proof', 'proven', 'validated',
  ];
}

/** Flatten every string value (recursively) out of a copy constant; skips functions. */
function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) flattenStrings(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      if (typeof v === 'function') continue;
      flattenStrings(v, out);
    }
  }
  return out;
}

function matchesBannedToken(text: string, token: string): boolean {
  const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(text);
}

/** Debt-chip copy (DEBT_CHIP_COPY is module-private) reached through its builder. */
const ALL_DEBT_STATUSES: readonly EvidenceDebtStatus[] = [
  'requested', 'supplied', 'challenged', 'accepted_by_participant',
  'accepted_by_both', 'unresolved', 'stale', 'branched',
];
function debtChipStrings(): string[] {
  return ALL_DEBT_STATUSES.flatMap((status) => {
    const chip = summarizeEvidenceDebtChip(status, 'source');
    return [chip.label, chip.helper, chip.accessibilityLabel];
  });
}

/** Map-surface labels are module-private consts reached through the builder. */
function mapSurfaceStrings(): string[] {
  const surface = buildMapNodeActionSurface({
    activeMessageId: 'n1',
    viewerRole: 'participant',
    actor: 'other',
    participantControls: [],
    observerActions: [],
    actingOnShortLabel: 'Message 1',
    isOpenPointMember: true,
  });
  return flattenStrings(surface);
}

/**
 * The scanned corpus: one [label, strings] pair per journey copy source. Each
 * journey's visible copy is named in docs/qa/journey-gate-j1-j10.md.
 */
const JOURNEY_COPY_SOURCES: ReadonlyArray<[string, string[]]> = [
  // J1 / J2 — Home
  ['HOME_COPY', flattenStrings(HOME_COPY)],
  // J3 / J4 — Start sheet + public toggle + disagreement taxonomy labels
  ['START_SHEET_COPY', flattenStrings(START_SHEET_COPY)],
  ['PUBLIC_ARGUMENT_TOGGLE_COPY', flattenStrings(PUBLIC_ARGUMENT_TOGGLE_COPY)],
  ['DISAGREEMENT_CLUSTER_LABELS', flattenStrings(DISAGREEMENT_CLUSTER_LABELS)],
  // J6 (text) — markers
  ['MARKER_COPY', flattenStrings(MARKER_COPY)],
  ['MARKER_ERROR_COPY', flattenStrings(MARKER_ERROR_COPY)],
  // J7 — proof drawer + debt chip
  ['PROOF_DRAWER_COPY', flattenStrings(PROOF_DRAWER_COPY)],
  ['ATTACH_ERROR_COPY', flattenStrings(ATTACH_ERROR_COPY)],
  ['DEBT_CHIP_COPY (via summarizeEvidenceDebtChip)', debtChipStrings()],
  // J9 — state rail + map surface + mediator board copy
  ['STATE_RAIL_COPY', flattenStrings(STATE_RAIL_COPY)],
  ['MAP_NODE_ACTION_SURFACE (via buildMapNodeActionSurface)', mapSurfaceStrings()],
  ['MEDIATOR_STATE_COPY', flattenStrings(MEDIATOR_STATE_COPY)],
  ['WHAT_REMAINS_UNRESOLVED', flattenStrings(WHAT_REMAINS_UNRESOLVED)],
  // J10 — boolean feedback bar
  ['MOVE_MARK_LABEL', flattenStrings(MOVE_MARK_LABEL)],
  ['MOVE_MARKS_BAR_COPY', flattenStrings(MOVE_MARKS_BAR_COPY)],
  ['MOVE_MARKS_LEGEND_LINE', flattenStrings(MOVE_MARKS_LEGEND_LINE)],
  ['allRenderedMoveMarkStrings()', allRenderedMoveMarkStrings()],
];

describe('QA-001 (#692) — no journey copy carries a banned token', () => {
  const banned = bannedTokens();

  it.each(JOURNEY_COPY_SOURCES)('%s is ban-list clean across all ten journeys', (_name, strings) => {
    expect(strings.length).toBeGreaterThan(0);
    for (const text of strings) {
      for (const token of banned) {
        expect({ text, token, tripped: matchesBannedToken(text, token) }).toEqual({
          text,
          token,
          tripped: false,
        });
      }
    }
  });
});

describe('QA-001 (#692) — positive control (the scan catches drift)', () => {
  const banned = bannedTokens();
  const violators = ['This is the winner.', 'This is proof of it.', 'Join the debate'];

  it.each(violators)('flags the intentionally-violating string %s', (text) => {
    expect(banned.some((token) => matchesBannedToken(text, token))).toBe(true);
  });
});

describe('QA-001 (#692) — negative control (canonical journey copy passes clean)', () => {
  const banned = bannedTokens();
  const clean = ['Start with someone', 'Answered my point', 'Answer this ↗', 'Source owed'];

  it.each(clean)('does not over-block the canonical string %s', (text) => {
    expect(banned.some((token) => matchesBannedToken(text, token))).toBe(false);
  });
});
