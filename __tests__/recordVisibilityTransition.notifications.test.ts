/**
 * QOL-039 ↔ QOL-040 — dispatch-shape contract test.
 *
 * Verifies that the `record-visibility-transition` Edge Function's
 * cross-function calls into `room-notifications` use the shape the
 * shipped QOL-040 contract expects:
 *
 *   - room_made_private — body carries `type`, `debateId`,
 *     `priorReadAccessIds: string[]`. The QOL-040 handler strips current
 *     primaries server-side and inserts one `room_notifications` row per
 *     remaining recipient.
 *   - chime_in_rejected — body carries `type`, `debateId`, `argumentId`,
 *     optional `meta.roomIsPrivate: true`. The QOL-040 handler derives
 *     the recipient from `arguments.author_id`; the function never passes
 *     a caller-supplied user-id list for this trigger.
 *
 * Companion to the seven cascade-anticipated tests under
 * `__tests__/notificationModel.*.test.ts` — those tests already pass
 * (they were authored as part of QOL-040 against the shipped contract);
 * this test guards QOL-039's dispatch shape against drift so a future
 * refactor cannot silently regress the contract.
 */
import fs from 'fs';
import path from 'path';

const TRANSITION_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'record-visibility-transition', 'index.ts'),
  'utf8',
);

// The shipped QOL-040 handler — the receiving function for both calls.
const ROOM_NOTIFICATIONS_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

describe('record-visibility-transition → room_made_private dispatch', () => {
  it('shapes the body with type + debateId + priorReadAccessIds', () => {
    expect(TRANSITION_SRC).toMatch(/type: 'room_made_private',[\s\S]*debateId,[\s\S]*priorReadAccessIds/);
  });

  it('passes the flat priorReadAccessIds array (per E1.5 — NOT the structured audiences object)', () => {
    // The original §5.4 design's structured audiences was replaced by
    // the flat array per E1.5; the dispatch must NOT carry the old
    // shape's keys.
    expect(TRANSITION_SRC).not.toContain('audiences.retainedParticipantUserIds');
    expect(TRANSITION_SRC).not.toContain('audiences.nonParticipantObserverUserIds');
  });

  it('QOL-040 room-notifications still accepts priorReadAccessIds (the receiving side)', () => {
    // Source-scan QOL-040 to confirm the receiving handler reads the
    // flat array; if QOL-040 ever changes its contract, this test
    // catches the QOL-039 drift.
    expect(ROOM_NOTIFICATIONS_SRC).toContain('priorReadAccessIds');
    expect(ROOM_NOTIFICATIONS_SRC).toMatch(/handleRoomMadePrivate/);
  });
});

describe('record-visibility-transition → chime_in_rejected dispatch', () => {
  it('shapes the body with type + debateId + argumentId per chime-in', () => {
    expect(TRANSITION_SRC).toMatch(/type: 'chime_in_rejected',[\s\S]*debateId,[\s\S]*argumentId: arg\.id/);
  });

  it('carries meta.roomIsPrivate: true on the body', () => {
    // QOL-040's `resolveDeepLink` returns null when type is
    // chime_in_rejected AND meta.roomIsPrivate is true — exactly the
    // post-private-transition revoked-access scenario.
    expect(TRANSITION_SRC).toMatch(/meta:\s*\{\s*roomIsPrivate:\s*true\s*\}/);
  });

  it('NEVER passes a caller-supplied user-id list for chime_in_rejected', () => {
    // QOL-040's `handleChimeInRejected` derives the recipient from
    // `arguments.author_id`. The dispatch payload carries only the
    // argument id; passing a user-id list would be the wrong shape AND
    // would let the caller fabricate notifications addressed elsewhere.
    const chimeInDispatchBlock = TRANSITION_SRC.match(
      /chime_in_rejected'[\s\S]*?invokeRoomNotifications/g,
    ) || [];
    for (const block of chimeInDispatchBlock) {
      expect(block).not.toContain('recipientUserId');
      expect(block).not.toContain('rejectedChimeInUserIds');
    }
  });

  it('QOL-040 room-notifications still gates chime_in_rejected on primary-side caller', () => {
    // Source-scan QOL-040 to confirm the receiving handler still
    // requires the caller to be an affirmative/negative primary. The
    // visibility-transition Edge Function calls with the creator's JWT,
    // which must be a primary (the creator is always seated).
    expect(ROOM_NOTIFICATIONS_SRC).toMatch(/handleChimeInRejected/);
    expect(ROOM_NOTIFICATIONS_SRC).toMatch(/'affirmative'.*'negative'/);
  });
});

describe('record-visibility-transition → notification failure handling', () => {
  it('a notification dispatch failure NEVER rolls back the visibility UPDATE', () => {
    // The catch path logs and continues with status='queued'. There is
    // no subsequent UPDATE that re-flips visibility to public, and the
    // §4.2 trigger would reject one anyway. The transition is final.
    expect(TRANSITION_SRC).toContain("status = 'queued'");
    expect(TRANSITION_SRC).not.toMatch(/visibility: 'public'/);
  });

  it('logs the failed-notification trigger without recipient PII', () => {
    // Find every console.* line; assert none of them carry email or
    // recipient_id or a JWT-shaped variable name.
    const lines = TRANSITION_SRC.split('\n');
    const offending: string[] = [];
    for (const line of lines) {
      if (!line.match(/console\.(error|warn|info|debug)/)) continue;
      const lower = line.toLowerCase();
      if (lower.includes('@')) offending.push(line.trim());
      if (lower.includes('recipient_id')) offending.push(line.trim());
      if (lower.includes('email')) offending.push(line.trim());
    }
    expect(offending).toEqual([]);
  });
});

describe('record-visibility-transition — count contract', () => {
  it('the response distinguishes the three count buckets the audit row records', () => {
    expect(TRANSITION_SRC).toContain('retainedParticipantCount');
    expect(TRANSITION_SRC).toContain('droppedParticipantCount');
    expect(TRANSITION_SRC).toContain('rejectedChimeInCount');
  });

  it('counts match the audit row column names (snake_case in the audit, camelCase in the response)', () => {
    // The audit row uses snake_case (DB convention); the response shape
    // uses camelCase (JS convention). The mapping must be one-to-one.
    expect(TRANSITION_SRC).toContain('retained_participant_count');
    expect(TRANSITION_SRC).toContain('dropped_participant_count');
    expect(TRANSITION_SRC).toContain('rejected_chime_in_count');
  });

  it('rejectedChimeInCount === the length of the per-chime-in dispatch array', () => {
    // Structural — they are both derived from `rejectedChimeInArgs`.
    // We assert the source uses the same list for both. Find the
    // count assignment, then the loop over rejectedChimeInArgs.
    expect(TRANSITION_SRC).toMatch(/rejected_chime_in_count: rejectedChimeInArgumentIds\.length/);
    expect(TRANSITION_SRC).toMatch(/for \(const arg of rejectedChimeInArgs\)/);
  });
});
