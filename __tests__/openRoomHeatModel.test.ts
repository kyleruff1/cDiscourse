/**
 * Stage 6.5 prep — Open-room HOT model tests.
 *
 * HOT means activity / friction / unresolved argumentative pressure.
 * HOT does NOT mean popularity, virality, truth credit, or abuse.
 */
import {
  classifyOpenRoom,
  classifyRoomList,
  HEAT_REASON_CODES,
  RECOMMENDED_ACTIONS,
  HEAT_BANDS,
  redactTitle,
  looksAbusive,
} from '../scripts/bot-fixtures/openRoomHeatModel';

type RoomMsg = { id: string; parent_id: string | null; author_id: string | null; argument_type: string | null; body: string; created_at: string; status: string };
function msg(partial: Partial<RoomMsg>): RoomMsg {
  return {
    id: partial.id || 'm?',
    parent_id: partial.parent_id ?? null,
    author_id: partial.author_id ?? 'author-a',
    argument_type: partial.argument_type ?? 'claim',
    body: partial.body ?? 'A body.',
    created_at: partial.created_at ?? '2026-05-17T00:00:00Z',
    status: partial.status ?? 'posted',
  };
}

const NOW_MS = new Date('2026-05-18T01:00:00Z').getTime();

describe('classifyOpenRoom — empty room is not engageable', () => {
  it('empty room → safeToPost=false, band=quiet, ineligibleReason=empty_room', () => {
    const c = classifyOpenRoom({ debateId: 'd-empty', title: 'A debate', messages: [], nowMs: NOW_MS });
    expect(c.safeToPost).toBe(false);
    expect(c.heatBand).toBe('quiet');
    expect(c.moveCount).toBe(0);
    expect(c.ineligibleReason).toBe('empty_room');
    expect(c.recommendedAction).toBeNull();
  });

  it('moveCount >= 1 is required for any rebuttal recommendation', () => {
    const c = classifyOpenRoom({ debateId: 'd1', title: 't', messages: [msg({ id: 'm1' })], nowMs: NOW_MS });
    expect(c.moveCount).toBe(1);
    expect(c.safeToPost).toBe(true);
    expect(['first_rebuttal', 'countermechanism', 'narrow_scope', 'synthesis_attempt', 'source_chain_pressure', 'ask_quote', 'defend_root', 'concede_narrow', 'branch_recommendation']).toContain(c.recommendedAction);
  });
});

describe('classifyOpenRoom — unreplied root gets high priority', () => {
  it('returns reason no_rebuttal + recommendedAction=first_rebuttal + bot=revocateur', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [msg({ id: 'r', argument_type: 'thesis', created_at: '2026-05-17T20:00:00Z' })],
      nowMs: NOW_MS,
    });
    expect(c.reasonCodes).toContain('no_rebuttal');
    expect(c.recommendedAction).toBe('first_rebuttal');
    expect(c.recommendedBot).toBe('bot-revocateur');
    expect(c.targetMoveId).toBe('r');
  });
});

describe('classifyOpenRoom — source-chain + evidence debt raise heat', () => {
  it('detects source-chain debt and pushes heat up', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', argument_type: 'thesis', body: 'A broad claim about X.', created_at: '2026-05-17T20:00:00Z' }),
        msg({ id: 'a', parent_id: 'r', argument_type: 'rebuttal', body: 'Quote the source — show your work on the primary record.', created_at: '2026-05-17T22:00:00Z' }),
      ],
      nowMs: NOW_MS,
    });
    expect(c.reasonCodes).toContain('source_chain_debt');
    expect(c.heatBand).not.toBe('quiet');
    expect(c.recommendedAction).toBe('source_chain_pressure');
    expect(c.recommendedBot).toBe('bot-revocateur');
    expect(c.targetMoveId).toBe('a');
  });

  it('detects evidence debt', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', argument_type: 'thesis', created_at: '2026-05-17T20:00:00Z' }),
        msg({ id: 'a', parent_id: 'r', argument_type: 'rebuttal', body: 'The evidence is missing — show the data and the study.', created_at: '2026-05-17T22:00:00Z' }),
      ],
      nowMs: NOW_MS,
    });
    expect(c.reasonCodes).toContain('evidence_debt');
  });
});

describe('classifyOpenRoom — recent activity is friction, not truth', () => {
  it('recent active rooms can be HOT without implying truth credit', () => {
    const baseTs = '2026-05-18T00:00:00Z'; // 1h before NOW_MS
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', argument_type: 'thesis', created_at: '2026-05-17T20:00:00Z' }),
        msg({ id: 'a', parent_id: 'r', argument_type: 'rebuttal', body: 'Quote the source.', created_at: '2026-05-17T22:00:00Z' }),
        msg({ id: 'b', parent_id: 'a', argument_type: 'counter_rebuttal', body: 'Pressing on the mechanism.', created_at: baseTs }),
      ],
      nowMs: NOW_MS,
    });
    expect(c.reasonCodes).toContain('recent_activity');
    expect(c.heatBand).not.toBe('overheated'); // not popularity, just friction
  });
});

describe('classifyOpenRoom — abuse never increases desired heat', () => {
  it('abusive latest message marks overheated and unsafe to post', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', argument_type: 'thesis', created_at: '2026-05-17T20:00:00Z' }),
        msg({ id: 'a', parent_id: 'r', argument_type: 'rebuttal', body: 'kill yourself for thinking that.', created_at: '2026-05-17T22:00:00Z' }),
      ],
      nowMs: NOW_MS,
    });
    expect(c.heatBand).toBe('overheated');
    expect(c.safeToPost).toBe(false);
  });

  it('threat/doxx/protected-class markers in body trigger overheated', () => {
    expect(looksAbusive('<threat>')).toBe(true);
    expect(looksAbusive('<protected-class-attack>')).toBe(true);
    expect(looksAbusive('A regular argument.')).toBe(false);
  });
});

describe('classifyOpenRoom — popularity is never converted to truth', () => {
  it('high human participant count raises heat modestly but does NOT inject truth-credit fields', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', author_id: 'u1', argument_type: 'thesis', created_at: '2026-05-17T20:00:00Z' }),
        msg({ id: 'a', author_id: 'u2', parent_id: 'r', argument_type: 'rebuttal', body: 'A challenge.', created_at: '2026-05-17T20:30:00Z' }),
        msg({ id: 'b', author_id: 'u3', parent_id: 'a', argument_type: 'counter_rebuttal', body: 'A defense.', created_at: '2026-05-17T21:00:00Z' }),
        msg({ id: 'c', author_id: 'u4', parent_id: 'b', argument_type: 'rebuttal', body: 'Another challenge.', created_at: '2026-05-17T22:00:00Z' }),
      ],
      botUserIds: [],
      nowMs: NOW_MS,
    });
    expect(c.uniqueParticipantCount).toBe(4);
    expect(c.botParticipantCount).toBe(0);
    expect(c.heatScore).toBeGreaterThan(0);
    // Schema: nothing in the output claims winners, truth, or factual support.
    expect(Object.prototype.hasOwnProperty.call(c, 'winnerPreview')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(c, 'truthScore')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(c, 'factualStanding')).toBe(false);
  });

  it('bot-only back-and-forth does not pump human-participant heat', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', author_id: 'bot-a', argument_type: 'thesis', created_at: '2026-05-17T20:00:00Z' }),
        msg({ id: 'a', author_id: 'bot-b', parent_id: 'r', argument_type: 'rebuttal', body: 'A challenge.', created_at: '2026-05-17T20:30:00Z' }),
      ],
      botUserIds: ['bot-a', 'bot-b'],
      nowMs: NOW_MS,
    });
    expect(c.botParticipantCount).toBe(2);
    // Human-participant heat bump should be absent.
    expect(c.heatScore).toBeLessThan(60);
  });
});

describe('classifyOpenRoom — schema + reason-code catalogue', () => {
  it('every reason code emitted is in the public catalogue', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', argument_type: 'thesis', created_at: '2026-05-17T20:00:00Z' }),
        msg({ id: 'a', parent_id: 'r', argument_type: 'rebuttal', body: 'Quote the source. Define the scope. The cause is missing.', created_at: '2026-05-17T22:00:00Z' }),
      ],
      nowMs: NOW_MS,
    });
    for (const r of c.reasonCodes) expect(HEAT_REASON_CODES).toContain(r);
  });

  it('heatBand is always one of the four known bands', () => {
    const c = classifyOpenRoom({ debateId: 'd1', title: 't', messages: [msg({ id: 'r' })], nowMs: NOW_MS });
    expect(HEAT_BANDS).toContain(c.heatBand);
  });

  it('recommendedAction (when present) is from the public catalogue', () => {
    const c = classifyOpenRoom({
      debateId: 'd1', title: 't',
      messages: [
        msg({ id: 'r', argument_type: 'thesis' }),
        msg({ id: 'a', parent_id: 'r', argument_type: 'rebuttal', body: 'Quote the source.' }),
      ],
      nowMs: NOW_MS,
    });
    if (c.recommendedAction) expect(RECOMMENDED_ACTIONS).toContain(c.recommendedAction);
  });

  it('redactTitle strips identifier shapes defensively', () => {
    expect(redactTitle('Posted at @someuser https://x.com/foo')).not.toMatch(/@someuser/);
    expect(redactTitle('Posted at @someuser https://x.com/foo')).toContain('<x-handle>');
    expect(redactTitle('Posted at @someuser https://x.com/foo')).toContain('<x-link>');
  });
});

describe('classifyRoomList — sort by heat among engageable rooms', () => {
  it('engageable rooms sort before non-engageable; engageable rooms sort by heat desc', () => {
    const rooms = [
      { debateId: 'd-empty', title: 't', messages: [] },
      { debateId: 'd-quiet', title: 't', messages: [msg({ id: 'r' })] },
      { debateId: 'd-hot', title: 't', messages: [
        msg({ id: 'r', argument_type: 'thesis' }),
        msg({ id: 'a', parent_id: 'r', argument_type: 'rebuttal', body: 'Quote the source — show me the primary record.', author_id: 'u2' }),
        msg({ id: 'b', parent_id: 'a', argument_type: 'counter_rebuttal', body: 'I will defend the mechanism.', author_id: 'u3' }),
      ] },
    ];
    const sorted = classifyRoomList(rooms, { nowMs: NOW_MS });
    expect(sorted[0].roomId).toBe('d-hot');
    expect(sorted[sorted.length - 1].roomId).toBe('d-empty');
    expect(sorted[sorted.length - 1].safeToPost).toBe(false);
  });
});
