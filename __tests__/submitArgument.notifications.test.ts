/**
 * QOL-040 — submit-argument's notification side-effect insert.
 *
 * Source-scan tests. The Edge Function file uses Deno-only
 * imports; we assert the side-effect block's structural
 * invariants:
 *   - It runs AFTER the argument insert succeeds.
 *   - It is wrapped in try/catch — a notification failure
 *     NEVER rolls back the argument insert.
 *   - It classifies the trigger inline with the
 *     notificationModel.classifyArgumentTrigger semantics.
 *   - It uses the service-role client to insert (no caller
 *     client; no RLS bypass attempt via a different path).
 *   - It strips the author from the recipient list.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'submit-argument', 'index.ts'),
  'utf8',
);

/**
 * Extract the QOL-040 side-effect block: from the marker
 * comment through the end of the matching catch block. We find
 * the marker, then locate the closing brace of the catch by
 * tracking brace depth from the catch body's opening brace.
 */
function extractBlock(src: string): string {
  const start = src.indexOf('QOL-040 — notification side-effect');
  if (start < 0) return '';
  const catchAnchor = src.indexOf('} catch (notifyErr) {', start);
  if (catchAnchor < 0) return src.slice(start);
  const openBraceIdx = src.indexOf('{', catchAnchor + '} catch (notifyErr)'.length);
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < src.length && depth > 0) {
    const ch = src.charAt(i);
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  return src.slice(start, i);
}

const BLOCK = extractBlock(SRC);

describe('submit-argument — notification side-effect block', () => {
  it('declares a QOL-040 marker comment so a future refactor leaves a paper trail', () => {
    expect(SRC).toContain('QOL-040 — notification side-effect');
  });

  it('extracted block is non-empty (the side-effect actually exists)', () => {
    expect(BLOCK.length).toBeGreaterThan(0);
  });

  it('is wrapped in a try/catch — never rolls back on failure', () => {
    expect(BLOCK).toMatch(/try \{/);
    expect(BLOCK).toMatch(/} catch \(notifyErr\) \{/);
  });

  it('the catch branch logs a sanitised error label (no body, no Authorization)', () => {
    expect(BLOCK).toContain('submit_argument_notification_failed');
    const catchIdx = BLOCK.indexOf('} catch (notifyErr) {');
    const catchBlock = BLOCK.slice(catchIdx);
    // Strip comments — the doctrine comment legitimately
    // mentions "Authorization" / "body" as things NOT logged.
    const strippedCatch = catchBlock
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(strippedCatch.toLowerCase()).not.toMatch(/authorization/);
    expect(strippedCatch).not.toMatch(/data\.body/);
    expect(strippedCatch).not.toMatch(/recipient_id/);
  });

  it('runs AFTER the argument insert (insertedArg.id is referenced)', () => {
    expect(BLOCK).toContain('insertedArg.id');
  });

  it('uses the service-role client for the notification insert', () => {
    expect(BLOCK).toMatch(/serviceClient[\s\S]*\.from\('room_notifications'\)[\s\S]*\.insert\(/);
  });

  it('uses ONLY the service-role client for the notification insert (not caller)', () => {
    expect(BLOCK).not.toMatch(/callerClient[\s\S]*room_notifications/);
  });

  it('strips the author from the recipient list (user.id !== uid filter)', () => {
    expect(BLOCK).toContain('!== user.id');
  });

  it('classifies the trigger using the design-defined precedence (evidence > concession > source > new)', () => {
    expect(BLOCK).toContain("trigger = 'evidence_supplied'");
    expect(BLOCK).toContain("trigger = 'concession_challenged'");
    expect(BLOCK).toContain("trigger = 'source_requested'");
    expect(BLOCK).toContain("trigger = 'new_response'");
  });

  it('never inserts a notification with a trigger value the migration does not allow', () => {
    for (const t of [
      'room_made_private',
      'chime_in_posted',
      'chime_in_rejected',
      'argument_settled',
      'invite_accepted_by_invitee',
    ]) {
      expect(BLOCK).not.toContain(`trigger = '${t}'`);
    }
    // 'invite' is not in submit-argument's catalogue either.
    expect(BLOCK).not.toContain("trigger = 'invite'");
  });
});
