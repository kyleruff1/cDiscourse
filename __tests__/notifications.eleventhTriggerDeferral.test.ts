/**
 * QOL-040 — eleventh trigger (`invite_expired_notice`) deferral
 * source-scan.
 *
 * Per E2.3 + E7.3: the eleventh trigger is intentionally NOT in
 * the `RoomNotificationType` union or the migration's `type`
 * CHECK constraint. A comment in the trigger registry
 * (notificationModel.ts file header) documents the deferral.
 *
 * Belt-and-braces: this test asserts the comment is present AND
 * that no code path attempts to insert a row with the deferred
 * type. The migration's CHECK constraint would reject such an
 * insert at the DB; this test catches a typo at code review.
 */
import fs from 'fs';
import path from 'path';

const NOTIFICATION_MODEL_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'notifications', 'notificationModel.ts'),
  'utf8',
);

const ROOM_NOTIFICATIONS_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

const MIGRATION_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260524000014_qol_040_room_notifications.sql',
  ),
  'utf8',
);

const SUBMIT_ARGUMENT_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'submit-argument', 'index.ts'),
  'utf8',
);

describe('eleventh trigger deferral — comment present in notificationModel.ts', () => {
  it('the file header mentions invite_expired_notice + the deferral', () => {
    expect(NOTIFICATION_MODEL_SRC).toContain('invite_expired_notice');
    // The comment must say the trigger is intentionally absent
    // and reference the operator decision.
    expect(NOTIFICATION_MODEL_SRC).toContain('Trigger 11');
    expect(NOTIFICATION_MODEL_SRC).toContain('intentionally');
  });

  it('the file header explains the rationale (pg_cron or lazy derivation)', () => {
    expect(NOTIFICATION_MODEL_SRC).toMatch(/pg_cron|lazy/);
  });
});

describe('eleventh trigger deferral — type union does NOT include invite_expired_notice', () => {
  it('the RoomNotificationType union does not list invite_expired_notice as a member', () => {
    // The TYPE declaration is `export type RoomNotificationType = …`.
    // We isolate the union body to assert membership.
    const typeIdx = NOTIFICATION_MODEL_SRC.indexOf('export type RoomNotificationType');
    expect(typeIdx).toBeGreaterThan(-1);
    const semi = NOTIFICATION_MODEL_SRC.indexOf(';', typeIdx);
    const unionBody = NOTIFICATION_MODEL_SRC.slice(typeIdx, semi);
    expect(unionBody).not.toContain("'invite_expired_notice'");
    // The 10 expected values must all be present.
    for (const v of [
      "'invite'",
      "'new_response'",
      "'concession_challenged'",
      "'source_requested'",
      "'evidence_supplied'",
      "'chime_in_posted'",
      "'room_made_private'",
      "'chime_in_rejected'",
      "'argument_settled'",
      "'invite_accepted_by_invitee'",
    ]) {
      expect(unionBody).toContain(v);
    }
  });

  it('the frozen ALL_ROOM_NOTIFICATION_TYPES array does not include invite_expired_notice', () => {
    const allIdx = NOTIFICATION_MODEL_SRC.indexOf('ALL_ROOM_NOTIFICATION_TYPES');
    expect(allIdx).toBeGreaterThan(-1);
    const closingBracket = NOTIFICATION_MODEL_SRC.indexOf(']', allIdx);
    const block = NOTIFICATION_MODEL_SRC.slice(allIdx, closingBracket);
    expect(block).not.toContain('invite_expired_notice');
  });
});

describe('eleventh trigger deferral — migration CHECK does NOT include invite_expired_notice', () => {
  it('the type CHECK constraint enumerates the ten allowed types only', () => {
    // The migration's `type text not null check (type in (…))`.
    const checkIdx = MIGRATION_SRC.indexOf('check (type in');
    expect(checkIdx).toBeGreaterThan(-1);
    // Slice through the closing parenthesis of the check.
    const closeIdx = MIGRATION_SRC.indexOf('))', checkIdx);
    const block = MIGRATION_SRC.slice(checkIdx, closeIdx);
    expect(block).not.toContain('invite_expired_notice');
  });
});

describe('eleventh trigger deferral — no INSERT attempt with invite_expired_notice', () => {
  it('room-notifications Edge Function — invite_expired_notice appears only in deferral comments, never in code', () => {
    // Strip block + line comments and re-scan. If the
    // remaining code mentions the deferred trigger, that's a
    // real reference.
    const stripped = ROOM_NOTIFICATIONS_SRC
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(stripped).not.toContain('invite_expired_notice');
  });

  it('submit-argument Edge Function never references invite_expired_notice (anywhere — no deferral comments here)', () => {
    expect(SUBMIT_ARGUMENT_SRC).not.toContain('invite_expired_notice');
  });

  it('notificationModel only mentions invite_expired_notice in JSDoc / comments, never in code', () => {
    // The model legitimately mentions the deferred trigger in
    // its file header AND in the JSDoc above the
    // RoomNotificationType union. Both are comments. Strip
    // comments and assert no code mention.
    const stripped = NOTIFICATION_MODEL_SRC
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(stripped).not.toContain('invite_expired_notice');
    // And: the comment mentions should be present (the
    // deferral acknowledgement).
    expect(NOTIFICATION_MODEL_SRC).toContain('invite_expired_notice');
  });
});
