/**
 * Timeline / DAW-style track model for argument rooms.
 * Pure TypeScript — no React, no Supabase, no Anthropic, no network.
 *
 * Maps argument nodes into horizontal lanes (core, counter, receipts,
 * clarification, concession, tangent) for a track-style display.
 *
 * Stage 6.1.0
 */
import type { ArgumentRow, ArgumentFlag, TopicSatisfactionCheck } from './types';
import type { ArgumentCache } from './types';

// ── Types ──────────────────────────────────────────────────────

export type ArgumentTrackKind =
  | 'core'
  | 'counter'
  | 'receipts'
  | 'clarification'
  | 'concession'
  | 'tangent';

export interface ArgumentTimelineItem {
  argumentId: string;
  parentId: string | null;
  trackKind: ArgumentTrackKind;
  laneIndex: number;
  depth: number;
  startsAtTurn: number;
  label: string;
  status: string;
  isSelected: boolean;
  isFocused: boolean;
  isBranchRecommended: boolean;
}

export interface ArgumentTimelineInput {
  cache: ArgumentCache;
  selectedArgumentId?: string | null;
  focusedArgumentId?: string | null;
}

// ── Lane label map ─────────────────────────────────────────────

export const TRACK_LANE_LABELS: Record<ArgumentTrackKind, string> = {
  core: 'Core',
  counter: 'Counters',
  receipts: 'Receipts',
  clarification: 'Clarifications',
  concession: 'Concessions',
  tangent: 'Tangents',
};

export const TRACK_LANE_ORDER: ArgumentTrackKind[] = [
  'core',
  'counter',
  'receipts',
  'clarification',
  'concession',
  'tangent',
];

// ── Track kind mapping ─────────────────────────────────────────

export function mapArgumentToTrackKind(
  argument: ArgumentRow,
  flags: ArgumentFlag[],
  checks: TopicSatisfactionCheck[],
): ArgumentTrackKind {
  const hasOffTrackFlag = flags.some(
    (f) => f.flagCode === 'off_track' && f.status !== 'dismissed',
  );
  const hasWeakTopicCheck = checks.some(
    (c) => c.status === 'weak' || c.status === 'failed',
  );

  if (hasOffTrackFlag || (hasWeakTopicCheck && argument.depth > 1)) {
    return 'tangent';
  }

  switch (argument.argumentType) {
    case 'thesis':
    case 'claim':
      return 'core';
    case 'rebuttal':
    case 'counter_rebuttal':
      return 'counter';
    case 'evidence':
      return 'receipts';
    case 'clarification_request':
      return 'clarification';
    case 'concession':
      return 'concession';
    case 'synthesis':
      // synthesis that replies to concession goes to concession lane; otherwise core
      return 'concession';
    default:
      return 'core';
  }
}

// ── Timeline builder ───────────────────────────────────────────

export function buildArgumentTimeline(input: ArgumentTimelineInput): ArgumentTimelineItem[] {
  const { cache, selectedArgumentId, focusedArgumentId } = input;
  const items: ArgumentTimelineItem[] = [];
  const laneCounters: Record<ArgumentTrackKind, number> = {
    core: 0,
    counter: 0,
    receipts: 0,
    clarification: 0,
    concession: 0,
    tangent: 0,
  };

  // Sort arguments: roots first, then by depth, then by createdAt
  const sorted = Object.values(cache.argumentsById).sort((a, b) => {
    if ((a.parentId === null) !== (b.parentId === null)) {
      return a.parentId === null ? -1 : 1;
    }
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.createdAt < b.createdAt ? -1 : 1;
  });

  sorted.forEach((arg, turnIndex) => {
    const flags = cache.flagsByArgumentId[arg.id] ?? [];
    const checks = cache.checksByArgumentId[arg.id] ?? [];
    const trackKind = mapArgumentToTrackKind(arg, flags, checks);
    const laneIndex = laneCounters[trackKind]++;

    const hasOffTrackFlag = flags.some(
      (f) => f.flagCode === 'off_track' && f.status !== 'dismissed',
    );
    const childIds = cache.childIdsByParentId[arg.id] ?? [];

    items.push({
      argumentId: arg.id,
      parentId: arg.parentId,
      trackKind,
      laneIndex,
      depth: arg.depth,
      startsAtTurn: turnIndex,
      label: _buildTimelineLabel(arg),
      status: arg.status,
      isSelected: selectedArgumentId === arg.id,
      isFocused: focusedArgumentId === arg.id,
      isBranchRecommended: hasOffTrackFlag && childIds.length >= 1,
    });
  });

  return items;
}

function _buildTimelineLabel(arg: ArgumentRow): string {
  const typeLabel: Record<string, string> = {
    thesis: 'Thesis',
    claim: 'Claim',
    rebuttal: 'Counter',
    counter_rebuttal: 'Counter',
    evidence: 'Receipts',
    clarification_request: 'Clarify',
    concession: 'Concede',
    synthesis: 'Synthesis',
  };
  const prefix = typeLabel[arg.argumentType] ?? arg.argumentType;
  const excerpt = arg.body.length > 40 ? arg.body.slice(0, 37) + '…' : arg.body;
  return `${prefix}: ${excerpt}`;
}

// ── Lane queries ───────────────────────────────────────────────

export function getTimelineLanes(
  items: ArgumentTimelineItem[],
): Record<ArgumentTrackKind, ArgumentTimelineItem[]> {
  const lanes: Record<ArgumentTrackKind, ArgumentTimelineItem[]> = {
    core: [],
    counter: [],
    receipts: [],
    clarification: [],
    concession: [],
    tangent: [],
  };
  for (const item of items) {
    lanes[item.trackKind].push(item);
  }
  return lanes;
}

export function getCorePath(items: ArgumentTimelineItem[]): ArgumentTimelineItem[] {
  return items.filter((i) => i.trackKind === 'core');
}

export function getTangentCandidates(items: ArgumentTimelineItem[]): ArgumentTimelineItem[] {
  return items.filter((i) => i.trackKind === 'tangent' || i.isBranchRecommended);
}

export function shouldShowBranchButton(
  argument: ArgumentRow,
  flags: ArgumentFlag[],
  _checks: TopicSatisfactionCheck[],
): boolean {
  const hasOffTrackFlag = flags.some(
    (f) => f.flagCode === 'off_track' && f.status !== 'dismissed',
  );
  return hasOffTrackFlag && argument.depth > 1;
}
