/**
 * UX-COPY-SYSTEM-002 (#754) — centralized COPY-SYSTEM ban-list guard.
 *
 * Codified by docs/designs/CIVILDISCOURSE-COPY-SYSTEM.md §3 (banned vocabulary)
 * with the §3.6 carve-outs. This is the SINGLE consolidated guard that scans
 * the shipped product-language constants the doc §10 names — room / seat /
 * visibility / observer / invite / mediator / brand — against the unified
 * COPY-SYSTEM banned vocabulary. It is additive: it imports only
 * already-exported constants and asserts non-presence of tokens already
 * absent, so it is green on the current tree.
 *
 * Scope carve-out: STATUS_COPY (the de-scored comparative-standing vocabulary
 * from UX-COPY-001) is intentionally NOT in this scan set. It legitimately
 * carries the both-sides humility phrase "You might both be wrong" — a
 * both-sides standing framing, not a person-verdict — which is shipped product
 * copy owned by #676 and must not be mutated by this lane. The doc §10 names
 * room/seat/visibility/observer/mediator/brand as the scan set, which does not
 * include STATUS_COPY.
 *
 * Matching uses whole-word / whole-phrase, case-insensitive word-boundary
 * regex (identical to oneToOneRoomModel.test.ts) so legitimate substrings
 * never false-positive.
 */
import { ROOM_CONTRACT_COPY } from '../src/features/debates/roomContractModel';
import {
  SEAT_CLAIM_COPY,
  ROOM_ACCESS_COPY,
  ROOM_VISIBILITY_COPY,
  ROOM_ONE_TO_ONE_COPY,
  POINT_SCOPED_CHIME_IN_COPY,
  OBSERVER_COPY,
  TIMELINE_COPY,
  INVITE_COPY,
  ARGUMENT_ROOM_CREATE_COPY,
} from '../src/features/arguments/gameCopy';
import {
  MEDIATOR_STATE_COPY,
  MEDIATOR_STATE_HELPER,
  PATHWAY_STEP_COPY,
} from '../src/features/mediator/mediatorPlainLanguage';
import {
  PRODUCT_NAME,
  PRIMARY_TAGLINE,
  PRINCIPLE_MARK_THE_POINT,
  WHAT_REMAINS_UNRESOLVED,
  WHAT_WOULD_MOVE_THIS_FORWARD,
  AUTH_FIRST_RUN_COPY,
} from '../src/lib/brandCopy';

/**
 * The consolidated COPY-SYSTEM banned vocabulary (doc §3): the verdict /
 * person-judgment family + the AI-authority family + the social-feed / forum
 * family. Carve-outs (doc §3.6) are intentionally EXCLUDED.
 */
export function _copySystemBannedTokens(): string[] {
  return [
    // §3.1 verdict / correctness / person-judgment
    'winner', 'loser', 'score', 'verdict', 'truth', 'wrong', 'dishonest',
    'bad faith', 'manipulative', 'fallacy', 'liar', 'propagandist', 'extremist',
    // §3.2 AI-authority
    'ai judge', 'ai decides',
    // §3.4 social-feed / comment-thread / forum framing
    'social feed', 'comment thread', 'pile on', 'forum', 'audience',
    'open mic', 'join the debate', 'third side',
  ];
}

/** Flatten any string-valued copy constant (recurses objects; skips functions). */
function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) flattenStrings(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      if (typeof v === 'function') continue; // skip function-valued constants
      flattenStrings(v, out);
    }
  }
  return out;
}

function matchesBannedToken(text: string, token: string): boolean {
  const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(text);
}

const SHIPPED_COPY_CONSTANTS: ReadonlyArray<[string, unknown]> = [
  ['ROOM_CONTRACT_COPY', ROOM_CONTRACT_COPY],
  ['SEAT_CLAIM_COPY', SEAT_CLAIM_COPY],
  ['ROOM_ACCESS_COPY', ROOM_ACCESS_COPY],
  ['ROOM_VISIBILITY_COPY', ROOM_VISIBILITY_COPY],
  ['ROOM_ONE_TO_ONE_COPY', ROOM_ONE_TO_ONE_COPY],
  ['POINT_SCOPED_CHIME_IN_COPY', POINT_SCOPED_CHIME_IN_COPY],
  ['OBSERVER_COPY', OBSERVER_COPY],
  ['TIMELINE_COPY', TIMELINE_COPY],
  ['INVITE_COPY', INVITE_COPY],
  ['ARGUMENT_ROOM_CREATE_COPY', ARGUMENT_ROOM_CREATE_COPY],
  ['MEDIATOR_STATE_COPY', MEDIATOR_STATE_COPY],
  ['MEDIATOR_STATE_HELPER', MEDIATOR_STATE_HELPER],
  ['PATHWAY_STEP_COPY', PATHWAY_STEP_COPY],
  ['PRODUCT_NAME', PRODUCT_NAME],
  ['PRIMARY_TAGLINE', PRIMARY_TAGLINE],
  ['PRINCIPLE_MARK_THE_POINT', PRINCIPLE_MARK_THE_POINT],
  ['WHAT_REMAINS_UNRESOLVED', WHAT_REMAINS_UNRESOLVED],
  ['WHAT_WOULD_MOVE_THIS_FORWARD', WHAT_WOULD_MOVE_THIS_FORWARD],
  ['AUTH_FIRST_RUN_COPY', AUTH_FIRST_RUN_COPY],
];

describe('UX-COPY-SYSTEM-002 — shipped copy carries no banned vocabulary', () => {
  const banned = _copySystemBannedTokens();

  it.each(SHIPPED_COPY_CONSTANTS)('%s contains no banned COPY-SYSTEM token', (_name, constant) => {
    const strings = flattenStrings(constant);
    expect(strings.length).toBeGreaterThan(0);
    for (const text of strings) {
      for (const token of banned) {
        expect(matchesBannedToken(text, token)).toBe(false);
      }
    }
  });
});

describe('UX-COPY-SYSTEM-002 — positive control (the guard catches drift)', () => {
  const banned = _copySystemBannedTokens();
  const violators = ['This is the winner.', 'Comment thread below', 'Join the debate'];

  it.each(violators)('flags the intentionally-violating string %s', (text) => {
    const tripped = banned.some((token) => matchesBannedToken(text, token));
    expect(tripped).toBe(true);
  });
});

describe('UX-COPY-SYSTEM-002 — negative control (canonical copy passes clean)', () => {
  const banned = _copySystemBannedTokens();
  const clean = [
    'Public 1:1',
    'Respondent seat open',
    'Observers watching',
    'Readers do not use active seats',
    'Continue with Google',
  ];

  it.each(clean)('does not over-block the canonical string %s', (text) => {
    const tripped = banned.some((token) => matchesBannedToken(text, token));
    expect(tripped).toBe(false);
  });
});

describe('UX-COPY-SYSTEM-002 — §3.6 carve-outs pinned as invariants', () => {
  const banned = _copySystemBannedTokens();

  it('does NOT ban "block" (the "Evidence blocked" operator-preferred term)', () => {
    expect(banned).not.toContain('block');
    expect(banned).not.toContain('blocked');
  });

  it('does NOT ban "opponent" (OD-5 resolved seat word → "Other voice"; token survives in turnOpponent turn-line)', () => {
    expect(banned).not.toContain('opponent');
  });

  it('does NOT ban "hot" (the gallery activity carve-out)', () => {
    expect(banned).not.toContain('hot');
  });
});
