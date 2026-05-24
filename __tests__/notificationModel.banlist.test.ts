/**
 * QOL-040 — doctrine ban-list scan over every string
 * `buildNotificationCopy` can produce, plus the email subject /
 * body produced by the room-notifications Edge Function helper.
 *
 * Per cdiscourse-doctrine §1 (no truth labels) and design §9
 * (no verdict / "rejected you" / "bad faith" copy).
 */
import fs from 'fs';
import path from 'path';
import {
  buildNotificationCopy,
  ALL_ROOM_NOTIFICATION_TYPES,
  type NotificationMeta,
  type RoomNotificationType,
} from '../src/features/notifications/notificationModel';

/**
 * Word-boundary regexes for the doctrine ban-list. Some banned
 * tokens are short English words ("bot", "true", "false",
 * "game") that legitimately appear as substrings of longer
 * words ("both", "construed", "frame"). The list MUST match
 * the standalone token only — `\bbot\b` not `bot`.
 */
const BANNED_TOKENS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: 'winner', re: /\bwinner\b/i },
  { label: 'loser', re: /\bloser\b/i },
  { label: 'correct', re: /\bcorrect\b/i },
  { label: 'true', re: /\btrue\b/i },
  { label: 'false', re: /\bfalse\b/i },
  { label: 'proven', re: /\bproven\b/i },
  { label: 'case closed', re: /\bcase closed\b/i },
  { label: 'game', re: /\bgame\b/i },
  { label: 'debate challenge', re: /\bdebate challenge\b/i },
  { label: 'rejected you', re: /\brejected you\b/i },
  { label: 'bad faith', re: /\bbad faith\b/i },
  { label: 'liar', re: /\bliar\b/i },
  { label: 'dishonest', re: /\bdishonest\b/i },
  { label: 'manipulative', re: /\bmanipulative\b/i },
  { label: 'extremist', re: /\bextremist\b/i },
  { label: 'propagandist', re: /\bpropagandist\b/i },
  { label: 'troll', re: /\btroll\b/i },
  { label: 'bot', re: /\bbot\b/i },
  { label: 'astroturfer', re: /\bastroturfer\b/i },
  { label: 'stupid', re: /\bstupid\b/i },
  { label: 'idiot', re: /\bidiot\b/i },
  { label: 'opponent', re: /\bopponent\b/i },
  { label: 'challenger', re: /\bchallenger\b/i },
];

/**
 * Produce a representative output for every (type × meta-variant)
 * combination we ship.
 */
function variantsForType(type: RoomNotificationType): Array<NotificationMeta> {
  switch (type) {
    case 'invite':
      return [{}, { roomIsPrivate: true }, { roomIsPrivate: false }];
    case 'concession_challenged':
      return [{}, { classification: 'framing' }, { classification: 'context' }, { classification: 'fact' }];
    case 'chime_in_posted':
    case 'invite_accepted_by_invitee':
      return [
        {},
        { actorNameVisible: true, actorDisplayName: 'Cara' },
        { actorNameVisible: false, actorDisplayName: 'Cara' },
        { actorNameVisible: true }, // missing name → falls back to "Someone"
      ];
    case 'chime_in_rejected':
      return [{}, { roomIsPrivate: true }];
    default:
      return [{}];
  }
}

describe('buildNotificationCopy — doctrine ban-list', () => {
  it('no banned token appears in any title for any trigger × meta variant', () => {
    const ROOM_TITLE_FIXTURES = [
      'A reasonable disagreement',
      'Is rent control good?',
      '', // empty falls back to "an argument"
    ];
    for (const type of ALL_ROOM_NOTIFICATION_TYPES) {
      for (const meta of variantsForType(type)) {
        for (const roomTitle of ROOM_TITLE_FIXTURES) {
          const { title } = buildNotificationCopy(type, roomTitle, meta);
          // The room title can contain literally anything (user
          // content). We assert OUR copy template never adds a
          // banned token. Strip the room title before scanning
          // — the title is user input, not our content.
          const safeTitle = title.replace(roomTitle, '');
          for (const { label, re } of BANNED_TOKENS) {
            expect({ type, meta, roomTitle, safeTitle, label }).toMatchObject({
              type,
              meta,
              roomTitle,
              safeTitle: expect.not.stringMatching(re),
              label,
            });
          }
        }
      }
    }
  });

  it('no banned token appears in any body for any trigger × meta variant', () => {
    const ROOM_TITLE_FIXTURES = ['A reasonable disagreement', ''];
    for (const type of ALL_ROOM_NOTIFICATION_TYPES) {
      for (const meta of variantsForType(type)) {
        for (const roomTitle of ROOM_TITLE_FIXTURES) {
          const { body } = buildNotificationCopy(type, roomTitle, meta);
          const safeBody = body.replace(roomTitle, '');
          for (const { label, re } of BANNED_TOKENS) {
            expect({ type, meta, roomTitle, safeBody, label }).toMatchObject({
              type,
              meta,
              roomTitle,
              safeBody: expect.not.stringMatching(re),
              label,
            });
          }
        }
      }
    }
  });

  it('no banned token in user-visible strings inside notificationCopy.ts', () => {
    // notificationCopy.ts hosts the screen-level chrome. Scan
    // every literal string in the source for the ban-list
    // tokens. A maintainer who adds a "winner" easter-egg is
    // caught here.
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'features', 'notifications', 'notificationCopy.ts'),
      'utf8',
    );
    for (const { label, re } of BANNED_TOKENS) {
      expect({ label, src }).toMatchObject({
        label,
        src: expect.not.stringMatching(re),
      });
    }
  });
});

describe('room-notifications Edge Function email body — doctrine ban-list', () => {
  /**
   * The email body is built inside the Edge Function. Source-scan
   * the function file for banned tokens. The email body template
   * lives inside `maybeSendInviteEmail`; we scan the whole file
   * because a refactor that moves the template should not be
   * able to bypass the test.
   */
  const SRC = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
    'utf8',
  );

  // Whitelist allowed engineering substrings that contain the
  // letters of banned tokens but are NOT user-facing copy:
  // - "false" appears in `actorNameVisible === false`
  // - "true" appears in `inputMeta.actorNameVisible === true`
  // - "game" appears nowhere we expect
  // These engineering substrings appear inside conditional
  // expressions, not inside any `'…'` string literal. We
  // therefore extract every string literal from the source and
  // ban-list-scan ONLY those.
  function extractStringLiterals(src: string): string[] {
    const literals: string[] = [];
    // Match single-quoted, double-quoted, and backtick-quoted
    // strings. Backtick strings include template substitutions
    // but we treat the whole literal as user-visible content.
    const re = /'([^'\\\n]*(?:\\.[^'\\\n]*)*)'|"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const lit = m[1] ?? m[2] ?? m[3] ?? '';
      if (lit) literals.push(lit);
    }
    return literals;
  }

  const LITERALS = extractStringLiterals(SRC);

  // Subset of banned tokens that should never appear in any
  // user-visible string. We use word-boundary regexes so that
  // engineering substrings ("both", "construed") don't false-
  // positive on a phrase-shaped token ("bot", "true").
  const STRICT_BANNED: ReadonlyArray<{ label: string; re: RegExp }> = [
    { label: 'winner', re: /\bwinner\b/i },
    { label: 'loser', re: /\bloser\b/i },
    { label: 'proven', re: /\bproven\b/i },
    { label: 'case closed', re: /\bcase closed\b/i },
    { label: 'rejected you', re: /\brejected you\b/i },
    { label: 'bad faith', re: /\bbad faith\b/i },
    { label: 'liar', re: /\bliar\b/i },
    { label: 'dishonest', re: /\bdishonest\b/i },
    { label: 'manipulative', re: /\bmanipulative\b/i },
    { label: 'extremist', re: /\bextremist\b/i },
    { label: 'propagandist', re: /\bpropagandist\b/i },
    { label: 'troll', re: /\btroll\b/i },
    { label: 'astroturfer', re: /\bastroturfer\b/i },
    { label: 'debate challenge', re: /\bdebate challenge\b/i },
  ];

  it('no strict-banned token appears in any string literal in room-notifications/index.ts', () => {
    for (const lit of LITERALS) {
      for (const { label, re } of STRICT_BANNED) {
        expect({ label, lit }).toMatchObject({
          label,
          lit: expect.not.stringMatching(re),
        });
      }
    }
  });
});
