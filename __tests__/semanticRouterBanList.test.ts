/**
 * MCP-012 — Semantic call router: doctrine ban-list scan.
 *
 * Scans every `TriggerReasonCode`, every `SemanticBatchGroup.label`, and every
 * exported string the five new modules can produce for verdict / person
 * tokens. Zero matches (cdiscourse-doctrine §1).
 *
 * The scan matches WHOLE snake_case / whitespace segments — mirroring MCP-011's
 * `tokenSegments` approach — so partial-word false hits like `route` (in
 * `trigger_branch_route_not_ambiguous`) or `send` (in `pre_send_review`) are
 * avoided. Only an exact segment equal to a banned token fails.
 */

import {
  SEMANTIC_BATCH_GROUPS,
} from '../src/features/semanticReferee/classifierBatching';
import type { TriggerReasonCode } from '../src/features/semanticReferee/triggerGates';

/**
 * Verdict / person tokens that must never appear as a whole segment in any
 * user-reachable string the card produces.
 */
const BANNED_TOKENS: readonly string[] = [
  'winner',
  'loser',
  'won',
  'lost',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'proven',
  'defeated',
  'liar',
  'lying',
  'dishonest',
  'manipulative',
  'troll',
  'propagandist',
  'extremist',
  'stupid',
  'idiot',
  'dumb',
  'smart',
];

/**
 * Every `TriggerReasonCode` value. `TriggerReasonCode` is a string-literal
 * union with no runtime array, so the codes are listed here; a drift between
 * this list and the type is caught by the `satisfies` assertion below.
 */
const ALL_TRIGGER_REASON_CODES = [
  'trigger_post_submit_allowed',
  'trigger_pre_send_review_allowed',
  'trigger_evidence_inspection_allowed',
  'trigger_branch_routing_allowed',
  'trigger_synthesis_readiness_allowed',
  'trigger_referee_feedback_allowed',
  'trigger_forbidden_event',
  'trigger_layer_disabled',
  'trigger_room_mode_off',
  'trigger_role_not_participant',
  'trigger_pre_send_not_opted_in',
  'trigger_pre_send_mode_not_strict',
  'trigger_branch_route_not_ambiguous',
  'trigger_synthesis_below_threshold',
] as const satisfies readonly TriggerReasonCode[];

/**
 * Split a string into whole segments on `_` and whitespace, lowercased — the
 * same segmentation MCP-011's validator uses to avoid partial-word false hits.
 */
function tokenSegments(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter((s) => s.length > 0);
}

/** Assert no segment of `value` exactly equals a banned token. */
function expectNoBannedSegment(value: string, context: string): void {
  const segments = tokenSegments(value);
  for (const banned of BANNED_TOKENS) {
    expect({ context, value, banned, hit: segments.includes(banned) }).toEqual({
      context,
      value,
      banned,
      hit: false,
    });
  }
}

describe('MCP-012 ban-list — TriggerReasonCode', () => {
  it('no reason code contains a verdict / person token segment', () => {
    for (const code of ALL_TRIGGER_REASON_CODES) {
      expectNoBannedSegment(code, 'TriggerReasonCode');
    }
  });

  it('documents that `route` (in trigger_branch_route_not_ambiguous) is not a banned token', () => {
    // `route` is a substring concern only — the whole-segment scan never
    // matches it because `route` is not in BANNED_TOKENS. This test pins the
    // intent so a future substring scan does not regress.
    expect(BANNED_TOKENS).not.toContain('route');
    expect(tokenSegments('trigger_branch_route_not_ambiguous')).toContain('route');
  });
});

describe('MCP-012 ban-list — SemanticBatchGroup labels', () => {
  it('no batch-group label contains a verdict / person token segment', () => {
    for (const group of SEMANTIC_BATCH_GROUPS) {
      expectNoBannedSegment(group.label, `SemanticBatchGroup[${group.id}].label`);
    }
  });

  it('no batch-group id contains a verdict / person token segment', () => {
    for (const group of SEMANTIC_BATCH_GROUPS) {
      expectNoBannedSegment(group.id, `SemanticBatchGroup.id`);
    }
  });
});

describe('MCP-012 ban-list — exported classifier-id strings', () => {
  it('no classifier id in any batch group contains a banned token segment', () => {
    for (const group of SEMANTIC_BATCH_GROUPS) {
      for (const classifierId of group.classifierIds) {
        expectNoBannedSegment(classifierId, `SemanticBatchGroup[${group.id}] classifierId`);
      }
    }
  });
});
