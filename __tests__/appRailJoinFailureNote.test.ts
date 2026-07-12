/**
 * UX-PR-B (#918) — App rail-join failure note wiring (source-structure scan).
 *
 * The onJoinSide handler is an inline closure in App.tsx; the full App root is
 * too heavy to mount in jest, so — mirroring the established App-glue scan
 * pattern (roomEntryDefaultMode.test.ts) — this asserts the honest-failure
 * wiring structurally: the effect.kind === 'error' branch sets the room note and
 * announces it, and the note renders as a polite live region. Per R2 the note is
 * note-only (no retry button in the note; the rail is the retry surface).
 *
 * The pure decision (resolveJoinSideEffect -> { kind: 'error' }) is unit-tested
 * in seatClaimModel.test.ts; the deployed visual/announcement behavior is the
 * acceptance RUNTIME-CHECK.
 */
import fs from 'fs';
import path from 'path';

const APP_SRC = fs.readFileSync(path.resolve(process.cwd(), 'App.tsx'), 'utf8');

describe('App — UX-PR-B (#918) rail-join failure note', () => {
  it('handles the new effect.kind === "error" branch from resolveJoinSideEffect', () => {
    expect(APP_SRC).toMatch(/effect\.kind === 'error'/);
  });

  it('sets the room note and announces it politely on a genuine join failure', () => {
    expect(APP_SRC).toContain('setJoinFailureNote(effect.message)');
    expect(APP_SRC).toContain('AccessibilityInfo.announceForAccessibility(effect.message)');
  });

  it('clears the note on the select_side and full_room_observe outcomes', () => {
    // Both success-ish branches reset the note so it never lingers.
    const selectBranch = APP_SRC.slice(
      APP_SRC.indexOf("if (effect.kind === 'select_side')"),
      APP_SRC.indexOf("} else if (effect.kind === 'error')"),
    );
    expect(selectBranch).toContain('setJoinFailureNote(null)');
    // Two clears: one in select_side, one in full_room_observe.
    expect((selectBranch.match(/setJoinFailureNote\(null\)/g) ?? []).length).toBe(2);
  });

  it('renders the note as a polite live region (R2: note-only, no retry button)', () => {
    const start = APP_SRC.indexOf('{joinFailureNote ? (');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = APP_SRC.slice(start, APP_SRC.indexOf(') : null}', start));
    expect(block).toContain('accessibilityLiveRegion="polite"');
    expect(block).toContain('{joinFailureNote}');
    // R2 — the note carries NO retry affordance (the rail re-tap is the retry).
    expect(block).not.toContain('Pressable');
    expect(block).not.toContain('onPress');
  });
});
