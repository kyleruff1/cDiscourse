/**
 * QOL-039 — Static source-scan tests for the record-visibility-transition
 * Edge Function. Mirrors the manageRoomInviteSafety + roomNotifications.edge
 * patterns.
 *
 * The function file uses Deno-only imports (createServiceClient,
 * Deno.env.get, Deno.serve) and cannot be loaded by Jest. Instead we scan
 * the source for the structural + handler + dispatch invariants the design
 * names.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'record-visibility-transition', 'index.ts'),
  'utf8',
);

describe('record-visibility-transition — entry + auth', () => {
  it('declares a Deno.serve entry handler', () => {
    expect(SRC).toMatch(/Deno\.serve\(async \(req: Request\)/);
  });

  it('routes a CORS preflight on OPTIONS', () => {
    expect(SRC).toContain("req.method === 'OPTIONS'");
    expect(SRC).toContain('corsHeaders');
  });

  it('rejects non-POST with methodNotAllowed()', () => {
    expect(SRC).toContain("req.method !== 'POST'");
    expect(SRC).toContain('methodNotAllowed()');
  });

  it('requires a JWT (unauthorized() on missing Authorization header)', () => {
    expect(SRC).toMatch(/if \(!auth\) return unauthorized\(\)/);
  });

  it('validates the JWT via createCallerClient + getUser', () => {
    expect(SRC).toContain('createCallerClient');
    expect(SRC).toMatch(/auth\.getUser\(\)/);
  });

  it('validates the debateId param is a UUID before any DB read', () => {
    expect(SRC).toContain('isUuid');
    expect(SRC).toMatch(/badRequest\('debate_id_required'\)/);
  });
});

describe('record-visibility-transition — creator-only authorization (OD-1)', () => {
  it('refuses non-creator callers with 403 not_creator', () => {
    expect(SRC).toContain('debate.created_by !== callerId');
    expect(SRC).toContain("forbidden('not_creator')");
  });

  it('does NOT widen authorization to moderator/admin (OD-1)', () => {
    // The function never calls `is_moderator_or_admin` (the RPC) nor
    // reads `profiles.role` to widen the mod path — OD-1 keeps the gate
    // creator-only at the server layer.
    expect(SRC).not.toContain('is_moderator_or_admin');
    expect(SRC).not.toContain("'role'");
  });
});

describe('record-visibility-transition — visibility transition flow', () => {
  it('refuses the already-private case with 409 already_private', () => {
    expect(SRC).toMatch(/debate\.visibility === 'private'/);
    expect(SRC).toContain("'already_private'");
    expect(SRC).toContain('409');
  });

  it('UPDATES debates SET visibility="private" with optimistic concurrency guard', () => {
    // The update is gated on .eq('visibility', 'public') so a concurrent
    // racing call cannot double-transition.
    expect(SRC).toContain("visibility: 'private'");
    expect(SRC).toMatch(/\.eq\('visibility', 'public'\)/);
  });

  it('returns 500 update_failed when the UPDATE errors', () => {
    expect(SRC).toContain("internalError('update_failed')");
  });
});

describe('record-visibility-transition — audit row insert', () => {
  it('inserts a row into public.room_visibility_changes', () => {
    expect(SRC).toMatch(/\.from\('room_visibility_changes'\)/);
    expect(SRC).toMatch(/\.insert\(\{[\s\S]*trigger_kind:/);
  });

  it('records counts + rejected_chime_in_ids (argument IDs, not user IDs)', () => {
    expect(SRC).toContain('retained_participant_count');
    expect(SRC).toContain('dropped_participant_count');
    expect(SRC).toContain('rejected_chime_in_count');
    expect(SRC).toContain('rejected_chime_in_ids');
    // The user-id projection is intentionally NOT in the audit row.
    expect(SRC).not.toContain('rejected_chime_in_user_ids');
    expect(SRC).not.toContain('dropped_observer_user_ids');
  });

  it('records the actor as triggered_by_user_id = callerId', () => {
    expect(SRC).toContain('triggered_by_user_id: callerId');
  });

  it('records trigger_kind="manual_creator_action" by default', () => {
    expect(SRC).toContain("trigger_kind: 'manual_creator_action'");
  });

  it('reports auditWritten:false but still returns 200 on audit insert failure', () => {
    // The transition is not rolled back; the operator reconciles.
    expect(SRC).toContain('auditWritten = true');
    expect(SRC).toContain('auditWritten: false');
    // The catch-block path defaults to false; no rollback / no DB
    // re-write of `debates.visibility` to 'public' is attempted (which
    // would be impossible anyway per the §4.2 one-way trigger).
    expect(SRC).not.toContain('visibility: \'public\'');
  });
});

describe('record-visibility-transition — notification dispatch', () => {
  it('dispatches room_made_private via room-notifications', () => {
    expect(SRC).toMatch(/type: 'room_made_private'/);
  });

  it('passes priorReadAccessIds to room-notifications (flat array per E1.5)', () => {
    expect(SRC).toContain('priorReadAccessIds');
  });

  it('dispatches per-chime-in chime_in_rejected via room-notifications', () => {
    expect(SRC).toMatch(/type: 'chime_in_rejected'/);
    // Each call carries the argumentId — QOL-040 derives the recipient
    // from arguments.author_id; the function never passes a caller-
    // supplied user-id list to room-notifications for this trigger.
    expect(SRC).toContain('argumentId: arg.id');
  });

  it('passes meta.roomIsPrivate:true on the chime_in_rejected meta block', () => {
    // QOL-040's `chime_in_rejected` notification carries roomIsPrivate
    // in meta so its deep-link resolver can null the link for revoked-
    // access recipients.
    expect(SRC).toContain('roomIsPrivate: true');
  });

  it('NEVER rolls back the transition on notification failure (mirrors submit-argument pattern)', () => {
    // The catch path logs and continues with status='queued'; the
    // transition has already happened.
    expect(SRC).toMatch(/catch \(err\)/);
    expect(SRC).toContain("status = 'queued'");
    // No subsequent reverse-update attempt.
    expect(SRC).not.toMatch(/visibility: 'public'/);
  });

  it('uses the cross-function POST pattern with the caller JWT', () => {
    expect(SRC).toContain('functions/v1/room-notifications');
    expect(SRC).toContain('authorization: authHeader');
  });
});

describe('record-visibility-transition — response shape', () => {
  it('returns transitionId + counts + per-channel statuses', () => {
    expect(SRC).toContain('transitionId');
    expect(SRC).toContain('retainedParticipantCount');
    expect(SRC).toContain('droppedParticipantCount');
    expect(SRC).toContain('rejectedChimeInCount');
    expect(SRC).toContain('notificationsDispatched');
    expect(SRC).toContain('roomMadePrivate');
    expect(SRC).toContain('chimeInRejected');
  });

  it('NEVER returns recipient user IDs or emails in the response', () => {
    // The response shape carries counts + statuses. priorReadAccessIds
    // is in the in-flight derivation only, never in the response.
    const responseInterface = SRC.match(/interface RecordVisibilityTransitionResponse \{[\s\S]*?\}/);
    expect(responseInterface).toBeTruthy();
    if (responseInterface) {
      expect(responseInterface[0]).not.toContain('priorReadAccessIds');
      expect(responseInterface[0]).not.toContain('recipientId');
      expect(responseInterface[0]).not.toContain('email');
    }
  });
});
