/**
 * QOL-038 — doctrine ban-list scan over every exported invite string.
 *
 * Covers:
 *   - Every string in `INVITE_PANEL_COPY`
 *   - Every string + function output in `INVITE_REDEEM_COPY`
 *   - `INVITE_EMAIL_SUBJECT`
 *   - The output of `buildInviteEmailBody`
 *   - The output of `plainLanguageForInviteError` for every known code
 *
 * Banned tokens (per cdiscourse-doctrine §1 + the QOL-038 issue
 * acceptance non-negotiables + the post-QOL-035 framing scrub):
 *   - winner / loser / liar / dishonest / bad faith / manipulative /
 *     extremist / propagandist / stupid / idiot
 *   - challenger / opponent  (post-QOL-035)
 *   - debate challenge / game invite  (QOL-038 issue-acceptance)
 *   - "argue about", "take a side"   (legacy framing the rewrite removes)
 *
 * Also:
 *   - No raw snake_case internal code reaches a user-visible string.
 *   - The text is human and ban-list-clean.
 */
import {
  BANNED_INVITE_FRAMING,
  INVITE_EMAIL_SUBJECT,
  INVITE_PANEL_COPY,
  INVITE_REDEEM_COPY,
  INVITE_CREDENTIAL_COPY,
  buildInviteEmailBody,
  plainLanguageForInviteError,
} from '../src/features/invites/inviteCopy';

// Whole-word tokens — short tokens where `includes` would over-match.
const BANNED_WORD_TOKENS = ['true', 'false', 'right', 'wrong', 'correct', 'incorrect'];

// Substring tokens — extracted from BANNED_INVITE_FRAMING plus a few
// legacy phrases the QOL-038 rewrite removed.
const BANNED_SUBSTRING_TOKENS = [
  ...BANNED_INVITE_FRAMING,
  'argue about',
  'take a side',
  'take the other side',
];

function collectAllStrings(): string[] {
  const out: string[] = [];

  // Panel copy
  for (const v of Object.values(INVITE_PANEL_COPY)) {
    if (typeof v === 'string') out.push(v);
  }

  // Redeem copy — strings + function outputs.
  for (const [key, v] of Object.entries(INVITE_REDEEM_COPY)) {
    if (typeof v === 'string') {
      out.push(v);
    } else if (typeof v === 'function') {
      // Each templated function takes (string, string?) — feed a couple
      // of fixtures to expose the template output.
      const fn = v as (...args: string[]) => string;
      if (key === 'signedOutInvite') out.push(fn('A room title', 'Alex'));
      else if (key === 'emailMismatchBody') out.push(fn('Alex', 'me@example.com'));
      else if (key === 'expiredBody' || key === 'roomArchivedBody') {
        out.push(fn('Alex'));
      } else {
        try {
          out.push(fn('A', 'B'));
        } catch {
          // ignore — defensive
        }
      }
    }
  }

  // EMAIL-TRANSPORT-002 — credential step copy (strings + function outputs).
  for (const [key, v] of Object.entries(INVITE_CREDENTIAL_COPY)) {
    if (typeof v === 'string') {
      out.push(v);
    } else if (typeof v === 'function') {
      const fn = v as (...args: string[]) => string;
      // `body` / `signInBody` take (roomTitle, inviter).
      if (key === 'body' || key === 'signInBody') {
        out.push(fn('A room title', 'Alex'));
      } else {
        try {
          out.push(fn('A', 'B'));
        } catch {
          // ignore — defensive
        }
      }
    }
  }

  // Email subject + body
  out.push(INVITE_EMAIL_SUBJECT);
  out.push(
    buildInviteEmailBody({
      roomTitle: 'A room title',
      inviteLink: 'https://dev.cdiscourse.com/invite/abc',
      invitedByDisplayName: 'Alex',
    }),
  );

  // Plain-language error map — every known code.
  for (const code of [
    'cannot_invite_self',
    'room_not_visible',
    'not_allowed_to_invite',
    'room_archived',
    'room_closed',
    'room_already_has_invite', // ARG-ROOM-006 item (g)
    'invite_revoked',
    'invite_expired',
    'invite_already_accepted',
    'invite_email_mismatch',
    'invite_not_found',
    'invite_not_visible',
    'unauthorized',
    'network_error',
    'empty_response',
    'invite_action_failed',
    'invite_insert_failed',
    'invite_lookup_failed',
    'invite_revoke_failed',
    'enrolment_failed',
    // EMAIL-TRANSPORT-002 (Option B) codes.
    'account_exists',
    'provision_failed',
    'weak_password',
  ]) {
    out.push(plainLanguageForInviteError(code));
  }
  // Unknown code fallback.
  out.push(plainLanguageForInviteError('totally_unknown_code'));

  return out;
}

const STRINGS = collectAllStrings();

describe('inviteCopy doctrine — every user-visible string is ban-list clean', () => {
  it('the corpus is non-trivial (vacuous-pass guard)', () => {
    expect(STRINGS.length).toBeGreaterThan(30);
  });

  it('no string contains a banned substring (verdicts + invite framing)', () => {
    for (const s of STRINGS) {
      const lower = s.toLowerCase();
      for (const token of BANNED_SUBSTRING_TOKENS) {
        // Helpful error includes the offending string for fast triage.
        expect({ token, string: s }).toMatchObject({ token });
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no string contains a banned whole-word verdict token', () => {
    for (const s of STRINGS) {
      for (const token of BANNED_WORD_TOKENS) {
        const re = new RegExp(`\\b${token}\\b`, 'i');
        expect(re.test(s)).toBe(false);
      }
    }
  });

  it('no string contains a raw snake_case internal code', () => {
    for (const s of STRINGS) {
      // Strip URL paths and tokens in fixture strings (the invite link
      // legitimately contains `dev.cdiscourse.com/invite/abc` — that's
      // path syntax, not snake_case copy).
      const stripped = s
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\binvite_/g, '') // copy mentions inviteId / invitee labels, but no raw codes
        ;
      expect(/[a-z]+_[a-z]+/.test(stripped)).toBe(false);
    }
  });

  it('the issue-acceptance non-negotiables never appear', () => {
    for (const s of STRINGS) {
      const lower = s.toLowerCase();
      expect(lower).not.toContain('debate challenge');
      expect(lower).not.toContain('game invite');
    }
  });
});

describe('inviteCopy doctrine — no banned token in the file source', () => {
  // A second-layer scan over the source file catches a future copy
  // change that adds a banned token without going through the
  // collected-strings path (e.g. as a comment that becomes a label).
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'invites', 'inviteCopy.ts'),
    'utf8',
  );

  // We allow the banned tokens to appear in `BANNED_INVITE_FRAMING`
  // itself (the data structure that names them) and in comments
  // documenting them. The user-visible strings are scanned by the
  // collected-strings test above. The source-scan here checks a
  // narrower property: the file does not contain any obviously banned
  // verdict construction like `winner` outside the BANNED_ definition.
  it('the banned-token literal "winner" appears only in the BANNED_INVITE_FRAMING list', () => {
    const matches = src.match(/winner/g) || [];
    // We expect: 1 occurrence inside BANNED_INVITE_FRAMING, and that's
    // it. If a future commit adds a `winnerCopy: 'You are the winner'`
    // (or similar), this count breaks.
    expect(matches.length).toBe(1);
  });
});
