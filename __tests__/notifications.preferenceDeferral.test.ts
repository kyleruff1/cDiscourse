/**
 * QOL-040 — preferences deferral source-scan.
 *
 * Per E3.2 + E7.2: QOL-040 ships notifications WITHOUT consuming
 * any user preference. The existing `notificationsOptInStub`
 * stays a stub. Two acknowledgement comments must be present so
 * a future implementer who removes the comment block without
 * also wiring the preference consumer is caught by the test
 * suite.
 *
 * This is a source-scan test, NOT a behaviour test. There is no
 * preference branch to test (per E3.3 — useNotifications always
 * polls).
 */
import fs from 'fs';
import path from 'path';

const USE_NOTIFICATIONS_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'notifications', 'useNotifications.ts'),
  'utf8',
);

const USER_PREFS_MODEL_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'preferences', 'userPreferencesModel.ts'),
  'utf8',
);

describe('preferences deferral — comment present in useNotifications.ts', () => {
  it('the leading comment names QOL-040 + the deferral + the stub name', () => {
    expect(USE_NOTIFICATIONS_SRC).toContain('QOL-040');
    expect(USE_NOTIFICATIONS_SRC).toContain('notificationsOptInStub');
    // The comment must say notifications "always polls" so a
    // future reader understands the stub is intentionally
    // ignored.
    expect(USE_NOTIFICATIONS_SRC).toContain('always polls');
  });

  it('the comment names the follow-up card (QOL-040.1)', () => {
    expect(USE_NOTIFICATIONS_SRC).toContain('QOL-040.1');
  });

  it('the hook does NOT branch on the preference (code-side scan, comments allowed to mention the stub)', () => {
    // The leading comment block legitimately mentions the stub
    // (that's the entire point of the deferral acknowledgement).
    // We assert the CODE side never reads the field — any read
    // in actual TS code would be a `notificationsOptInStub`
    // identifier following a `.` or assignment, not inside a
    // // or /* comment.
    //
    // Strip block + line comments and re-scan.
    const stripped = USE_NOTIFICATIONS_SRC
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(stripped).not.toMatch(/notificationsOptInStub/);
    expect(stripped).not.toMatch(/notificationsEnabled/);
  });
});

describe('preferences deferral — JSDoc present on notificationsOptInStub', () => {
  it('the JSDoc names QOL-040 + the deferral', () => {
    // The JSDoc immediately above the field declaration must
    // name QOL-040.
    const stubLineIdx = USER_PREFS_MODEL_SRC.indexOf('notificationsOptInStub: boolean;');
    expect(stubLineIdx).toBeGreaterThan(-1);
    // Slice 400 chars before the field declaration to capture
    // its JSDoc.
    const preface = USER_PREFS_MODEL_SRC.slice(Math.max(0, stubLineIdx - 400), stubLineIdx);
    expect(preface).toContain('QOL-040');
    expect(preface).toContain('deferred');
  });

  it('the JSDoc names the follow-up card (QOL-040.1)', () => {
    const stubLineIdx = USER_PREFS_MODEL_SRC.indexOf('notificationsOptInStub: boolean;');
    const preface = USER_PREFS_MODEL_SRC.slice(Math.max(0, stubLineIdx - 400), stubLineIdx);
    expect(preface).toContain('QOL-040.1');
  });

  it('the stub field itself is unchanged — still a `boolean`', () => {
    expect(USER_PREFS_MODEL_SRC).toContain('notificationsOptInStub: boolean;');
  });

  it('the default is unchanged — still `false`', () => {
    // The defaults block lists `notificationsOptInStub: false`.
    expect(USER_PREFS_MODEL_SRC).toContain('notificationsOptInStub: false');
  });
});
